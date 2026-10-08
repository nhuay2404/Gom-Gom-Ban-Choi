import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVEOPS } from './tuning.mjs';
import { EVENT_CALENDAR, CYCLE_DAYS } from './liveops-data.mjs';
import * as lo from './liveops.mjs';
import * as ev from './events.mjs';

const EV = LIVEOPS.EVENTS;
const HOUR = 60 * 60 * 1000;
// Giờ máy: thứ Hai 05/10/2026 = ngày 1 chu kỳ. at(ngày thứ n, giờ)
const at = (n, hour = 10) => new Date(2026, 9, 5 + n, hour).getTime();
const MON = 0, TUE = 1, FRI = 4, SAT = 5;
const CLEARED = 30, LEVEL = 25; // đã mở event, màn được tính
const fresh = () => lo.newLiveOps(at(0));
const ids = ms => ev.scheduled(ms).map(e => e.id).sort();

test('calendar: week / weekday from the fixed cycle, local midnight boundaries', () => {
  assert.deepEqual(ev.calendarDay(at(0)), { day: 0, cycle: 0, cycleDay: 0, week: 1, weekday: 0 });
  assert.deepEqual(ev.calendarDay(at(27, 23)), { day: 27, cycle: 0, cycleDay: 27, week: 4, weekday: 6 });
  assert.equal(ev.calendarDay(at(28, 0)).cycleDay, 0);
  assert.equal(ev.calendarDay(at(-1)).weekday, 6, 'before the epoch wraps backwards');
  assert.deepEqual(ids(at(MON)), ['yarn']);
  assert.deepEqual(ids(at(TUE)), ['race', 'yarn']);
  assert.deepEqual(ids(at(FRI)), ['fish']);
  assert.deepEqual(ids(at(SAT)), ['fish', 'race']);
  assert.deepEqual(ids(at(21 + SAT)), ['decoSale', 'fish', 'race'], 'Deco Sale only the last weekend of the season');
});

test('calendar: one run per block of days, ends at midnight after the last day', () => {
  const yarn = ev.scheduled(at(2)).find(e => e.id === 'yarn');
  assert.equal(yarn.key, 'yarn:2026-10-05');
  assert.equal(yarn.start, at(0, 0));
  assert.equal(yarn.end, at(4, 0));
  const fish = ev.scheduled(at(6, 23)).find(e => e.id === 'fish');
  assert.equal(fish.key, 'fish:2026-10-09');
  assert.equal(fish.end, at(7, 0));
});

test('calendar: never more than 1 main + 1 side event on any day of the cycle', () => {
  for (let day = 0; day < CYCLE_DAYS; day++) {
    const list = ev.scheduled(at(day));
    assert.ok(list.filter(e => e.kind === 'main').length === 1, `day ${day}: exactly one main event`);
    assert.ok(list.filter(e => e.kind === 'side').length <= 1, `day ${day}: at most one side event`);
  }
  EVENT_CALENDAR.forEach(entry => assert.ok(EV[entry.id], `${entry.id} has tuning`));
});

test('events open at fromLevel; levels below fromLevel do not count', () => {
  const from = EV.yarn.fromLevel;
  assert.equal(ev.eventOpen('yarn', from - 2), false);
  assert.equal(ev.eventOpen('yarn', from - 1), true);
  assert.equal(ev.yarnStatus(fresh(), at(MON), from - 2), null);
  const { state } = ev.eventLevelEnd(fresh(), at(MON), CLEARED, from - 2, true);
  assert.equal(ev.yarnStatus(state, at(MON), CLEARED).step, 0, 'replaying an early level gives no step');
});

test('yarn climb: win up, lose down, step rewards once per climb, top resets and repeat pays half', () => {
  let s = fresh();
  const win = () => { const r = ev.eventLevelEnd(s, at(MON), CLEARED, LEVEL, true); s = r.state; return r.rewards; };
  const lose = () => { s = ev.eventLevelEnd(s, at(MON), CLEARED, LEVEL, false).state; };
  win();
  assert.deepEqual(win().map(r => r.reward), [EV.yarn.stepRewards[2]]);
  lose();
  assert.equal(ev.yarnStatus(s, at(MON), CLEARED).step, 1);
  assert.deepEqual(win(), [], 'step 2 again: already paid this climb');
  lose(); lose(); lose();
  assert.equal(ev.yarnStatus(s, at(MON), CLEARED).step, 0, 'never below 0');
  const all = [];
  for (let i = 0; i < EV.yarn.steps; i++) all.push(...win());
  assert.deepEqual(all.at(-1).reward, EV.yarn.top);
  assert.equal(s.gems, EV.yarn.top.gems);
  assert.equal(ev.yarnStatus(s, at(MON), CLEARED).step, 0);
  for (let i = 0; i < EV.yarn.steps - 1; i++) win();
  assert.equal(win().at(-1).reward, EV.yarn.repeatTop, 'second top in the same event pays repeatTop');
  // lượt event mới (tuần sau) bắt đầu lại từ đầu
  assert.equal(ev.yarnStatus(s, at(7 + MON), CLEARED).step, 0);
  assert.equal(ev.yarnStatus(s, at(7 + MON), CLEARED).tops, 0);
});

test('fish festival: fish per cat, milestones pay in order, last one is the exclusive deco item', () => {
  let s = fresh();
  let r = ev.addFish(s, at(FRI), CLEARED, LEVEL, 45);
  assert.deepEqual(r.rewards.map(x => x.reward), [EV.fish.milestones[0].reward]);
  r = ev.addFish(r.state, at(SAT), CLEARED, LEVEL, 1000);
  assert.equal(r.rewards.length, EV.fish.milestones.length - 1);
  assert.equal(r.rewards.at(-1).reward.deco, 'lantern-koi');
  assert.equal(ev.fishStatus(r.state, at(SAT), CLEARED).reached, EV.fish.milestones.length);
  assert.equal(ev.addFish(fresh(), at(MON), CLEARED, LEVEL, 50).added, 0, 'no fish outside the festival');
  assert.equal(ev.addFish(fresh(), at(FRI), CLEARED, EV.fish.fromLevel - 2, 50).added, 0, 'early levels give no fish');
  s = ev.addFish(fresh(), at(FRI), CLEARED, LEVEL, 10).state;
  assert.equal(ev.fishStatus(s, at(7 + FRI), CLEARED).fish, 0, 'next festival starts from zero');
});

test('fish festival: ad doubling capped per day', () => {
  let s = fresh();
  for (let i = 0; i < EV.fish.adDoublePerDay; i++) s = ev.doubleFish(s, at(FRI), CLEARED, LEVEL, 10).state;
  assert.equal(ev.doubleFish(s, at(FRI), CLEARED, LEVEL, 10), null);
  assert.equal(ev.fishStatus(s, at(FRI), CLEARED).fish, 10 * EV.fish.adDoublePerDay);
  assert.equal(ev.fishAdsLeft(s, at(SAT)), EV.fish.adDoublePerDay, 'resets the next day');
});

test('cat race: joins on a race day, bots are fixed per race, first to the goal wins', () => {
  const t0 = at(TUE, 9);
  assert.equal(ev.joinRace(fresh(), at(MON), CLEARED, LEVEL).joined, false, 'no race on Monday');
  let { state: s, joined } = ev.joinRace(fresh(), t0, CLEARED, LEVEL);
  assert.ok(joined);
  assert.equal(ev.joinRace(s, t0 + HOUR, CLEARED, LEVEL).joined, false, 'one race per race day');
  const race = ev.raceStatus(s, t0, CLEARED).race;
  assert.deepEqual(ev.raceBots(race), ev.raceBots(race), 'deterministic rivals');
  assert.equal(new Set(ev.raceBots(race).map(b => b.name)).size, EV.race.bots.length);
  // thắng đủ goal màn trong 1 giờ đầu: về nhất (đối thủ chưa ai kịp)
  let rewards = [];
  for (let i = 1; i <= EV.race.goal; i++) {
    const r = ev.eventLevelEnd(s, t0 + i * 60 * 1000, CLEARED, LEVEL, true);
    s = r.state; rewards = rewards.concat(r.rewards.filter(x => x.id === 'race'));
  }
  assert.equal(rewards.length, 1);
  assert.deepEqual(rewards[0].reward, EV.race.rewards[0]);
  assert.equal(ev.raceStatus(s, t0 + HOUR, CLEARED).race.rank, 1);
  // thắng thêm sau khi về đích: không trả thưởng lần nữa
  assert.equal(ev.eventLevelEnd(s, t0 + 2 * HOUR, CLEARED, LEVEL, true).rewards.filter(x => x.id === 'race').length, 0);
  // xem kết quả xong thì thôi hiện; ngày đua sau vào được lượt mới
  s = ev.markRaceSeen(s);
  assert.equal(ev.homeEvents(s, at(TUE, 23), CLEARED).some(e => e.id === 'race'), false);
  assert.ok(ev.joinRace(s, at(SAT), CLEARED, LEVEL).joined);
});

test('cat race: time out settles by standing, rivals are not shown as real people', () => {
  const t0 = at(SAT, 9);
  let s = ev.joinRace(fresh(), t0, CLEARED, LEVEL).state;
  s = ev.eventLevelEnd(s, t0 + HOUR, CLEARED, LEVEL, true).state;
  const end = ev.raceStatus(s, t0, CLEARED).end;
  assert.equal(end, t0 + EV.race.hours * HOUR);
  assert.equal(ev.syncEvents(s, end - 1).rewards.length, 0, 'still running');
  const { state, rewards } = ev.syncEvents(s, end + 1);
  const standings = ev.raceStandings(ev.raceStatus(state, end + 1, CLEARED).race, end + 1);
  const rank = standings.findIndex(e => e.you) + 1;
  assert.ok(rank > 1, 'one win in 24h does not win the race');
  assert.deepEqual(rewards[0].reward, EV.race.rewards[rank - 1]);
  assert.equal(ev.syncEvents(state, end + 2).rewards.length, 0, 'paid once');
  assert.ok(standings.every(e => e.you || !/\bplayer\b/i.test(e.name)));
});

test('deco sale only on its weekend', () => {
  assert.equal(ev.decoSaleOff(at(SAT)), 0);
  assert.equal(ev.decoSaleOff(at(21 + SAT)), EV.decoSale.off);
  assert.equal(ev.decoSaleOff(at(21 + 6, 23)), EV.decoSale.off);
  assert.equal(ev.decoSaleOff(at(28)), 0);
});

test('home shows exactly one main event and at most one side event', () => {
  const s = fresh();
  assert.deepEqual(ev.homeEvents(s, at(TUE), CLEARED).map(e => e.id), ['yarn', 'race']);
  assert.deepEqual(ev.homeEvents(s, at(TUE), EV.yarn.fromLevel - 2), [], 'locked before fromLevel');
});

test('clock set back: events stop counting and paying until the clock catches up', () => {
  const s = { ...fresh(), maxSeen: at(SAT, 12) };
  assert.equal(ev.addFish(s, at(FRI), CLEARED, LEVEL, 100).added, 0);
  assert.equal(ev.joinRace(s, at(TUE + 7), CLEARED, LEVEL).joined, true, 'later clock is fine');
  const back = { ...fresh(), maxSeen: at(TUE + 7, 12) };
  assert.equal(ev.joinRace(back, at(SAT), CLEARED, LEVEL).joined, false);
  assert.equal(ev.eventLevelEnd(back, at(MON + 7), CLEARED, LEVEL, true).state, back);
});
