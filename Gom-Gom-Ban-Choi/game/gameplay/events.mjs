// LiveOps Phase 2 (thuần logic): event hằng tuần chạy theo lịch là dữ liệu (liveops-data.mjs) — Yarn Climb, Fish Festival,
// Cat Race (đối thủ máy), Deco Sale. Số liệu: tuning.mjs → LIVEOPS.EVENTS. Thiết kế: tai-lieu/6-Thiet-ke-LiveOps.html.
//
// State nằm trong save LiveOps (liveops.mjs) ở trường `events`. Mỗi lượt event có `key` = id + ngày bắt đầu ('fish:2026-10-09'):
// key đổi (sang lượt mới) thì tiến độ về 0. Mọi hàm nhận `now` (ms) để test được; `cleared` = số màn đã qua (mở event),
// `levelIndex` = màn vừa chơi (chỉ màn từ fromLevel trở lên mới tính, kể cả chơi lại). Hàm trả phần thưởng dạng
// { coins, gems, boosters, deco } trong `rewards: [{ id, label, reward }]`: gems ghi vào state ở đây, phần còn lại phía app cộng.
import { LIVEOPS } from './tuning.mjs';
import { EVENT_EPOCH, CYCLE_DAYS, EVENT_CALENDAR, RACE_BOTS } from './liveops-data.mjs';
import { dayKey, seeded } from './liveops.mjs';

const EV = LIVEOPS.EVENTS;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// ---------- Lịch ----------
// Số ngày (theo lịch giờ máy) tính từ EVENT_EPOCH; âm = trước mốc. Tính qua UTC của ngày địa phương để đổi giờ mùa hè không lệch.
export function dayNumber(ms) {
  const d = new Date(ms);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(EVENT_EPOCH.year, EVENT_EPOCH.month - 1, EVENT_EPOCH.day)) / DAY_MS);
}
// 00:00 (giờ máy) của ngày thứ n tính từ mốc.
export const dayStart = n => new Date(EVENT_EPOCH.year, EVENT_EPOCH.month - 1, EVENT_EPOCH.day + n).getTime();
// Vị trí trong chu kỳ season: cycleDay 0..27, week 1..4, weekday 0 = thứ Hai … 6 = Chủ nhật.
export function calendarDay(ms) {
  const day = dayNumber(ms), cycleDay = ((day % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS;
  return { day, cycle: Math.floor(day / CYCLE_DAYS), cycleDay, week: Math.floor(cycleDay / 7) + 1, weekday: cycleDay % 7 };
}
// Các lượt event đang chạy theo lịch hôm nay: [{ id, kind, key, start, end }] (end = 00:00 sau ngày cuối của lượt).
export function scheduled(ms) {
  const cal = calendarDay(ms);
  return EVENT_CALENDAR.filter(entry => entry.weekdays.includes(cal.weekday) && (!entry.weeks || entry.weeks.includes(cal.week))).map(entry => {
    let first = cal.weekday, last = cal.weekday;
    while (entry.weekdays.includes(first - 1)) first--;
    while (entry.weekdays.includes(last + 1)) last++;
    const startDay = cal.day - (cal.weekday - first);
    return { id: entry.id, kind: entry.kind, key: `${entry.id}:${dayKey(dayStart(startDay))}`, start: dayStart(startDay), end: dayStart(cal.day + (last - cal.weekday) + 1) };
  });
}
const scheduledOne = (id, ms) => scheduled(ms).find(event => event.id === id) ?? null;

// Event mở khi người chơi tới màn fromLevel; chỉ màn từ fromLevel trở lên mới tính tiến độ.
export const eventOpen = (id, cleared) => cleared + 1 >= EV[id].fromLevel;
export const eventCounts = (id, levelIndex) => levelIndex + 1 >= EV[id].fromLevel;
// Lượt event đang chạy mà người chơi tham gia được (đã tới mốc màn).
const running = (id, ms, cleared) => (eventOpen(id, cleared) ? scheduledOne(id, ms) : null);

// ---------- State ----------
export const newEvents = () => ({ yarn: null, fish: null, race: null, ads: { day: null, fish: 0 } });
const eventsOf = state => ({ ...newEvents(), ...state.events, ads: { ...newEvents().ads, ...state.events?.ads } });
const withEvents = (state, change) => ({ ...state, events: { ...eventsOf(state), ...change } });
// Gems của phần thưởng ghi luôn vào state; xu, booster, đồ Deco phía app cộng.
const pay = (state, reward) => (reward.gems ? { ...state, gems: state.gems + reward.gems } : state);
// Tiến độ của lượt hiện tại (lượt khác / chưa có = bắt đầu từ đầu).
function yarnOf(state, event) {
  const y = eventsOf(state).yarn;
  return y?.key === event.key ? y : { key: event.key, step: 0, paid: [], tops: 0 };
}
function fishOf(state, event) {
  const f = eventsOf(state).fish;
  return f?.key === event.key ? f : { key: event.key, fish: 0, reached: 0 };
}

// ---------- Yarn Climb: thắng lên 1 bậc, thua lùi 1 bậc; lên đỉnh nhận thưởng rồi leo lại ----------
export function yarnStatus(state, ms, cleared) {
  const event = running('yarn', ms, cleared);
  return event && { event, ...yarnOf(state, event), steps: EV.yarn.steps };
}
function yarnWin(state, ms, cleared, levelIndex, rewards) {
  const event = running('yarn', ms, cleared);
  if (!event || !eventCounts('yarn', levelIndex)) return state;
  let y = yarnOf(state, event), step = y.step + 1;
  const stepReward = EV.yarn.stepRewards[step];
  if (stepReward && !y.paid.includes(step)) {
    rewards.push({ id: 'yarn', label: `Yarn Climb step ${step}`, reward: stepReward });
    state = pay(state, stepReward);
    y = { ...y, paid: [...y.paid, step] };
  }
  if (step >= EV.yarn.steps) {
    const reward = y.tops ? EV.yarn.repeatTop : EV.yarn.top;
    rewards.push({ id: 'yarn', label: 'Yarn Climb top', reward, big: true });
    state = pay(state, reward);
    y = { ...y, step: 0, paid: [], tops: y.tops + 1 };
  } else y = { ...y, step };
  return withEvents(state, { yarn: y });
}
function yarnLose(state, ms, cleared, levelIndex) {
  const event = running('yarn', ms, cleared);
  if (!event || !eventCounts('yarn', levelIndex)) return state;
  const y = yarnOf(state, event);
  // bậc đã nhận quà giữ nguyên trong `paid`: thua rồi leo lại cùng bậc không nhận quà lần nữa
  return withEvents(state, { yarn: { ...y, step: Math.max(0, y.step - 1) } });
}

// ---------- Fish Festival: cá = số mèo của mỗi cụm gom (cả ván thua), 10 mốc ----------
export function fishStatus(state, ms, cleared) {
  const event = running('fish', ms, cleared);
  return event && { event, ...fishOf(state, event), milestones: EV.fish.milestones };
}
// Thêm cá; trả về { state, rewards } (mốc vừa qua). Không có event / màn chưa tính thì giữ nguyên.
export function addFish(state, ms, cleared, levelIndex, count) {
  const event = running('fish', ms, cleared), rewards = [];
  if (!event || !eventCounts('fish', levelIndex) || count <= 0) return { state, rewards, added: 0 };
  let f = fishOf(state, event);
  f = { ...f, fish: f.fish + count };
  while (f.reached < EV.fish.milestones.length && f.fish >= EV.fish.milestones[f.reached].fish) {
    const { reward } = EV.fish.milestones[f.reached];
    rewards.push({ id: 'fish', label: `Fish Festival reward ${f.reached + 1}`, reward, big: f.reached === EV.fish.milestones.length - 1 });
    state = pay(state, reward);
    f = { ...f, reached: f.reached + 1 };
  }
  return { state: withEvents(state, { fish: f }), rewards, added: count };
}
// Rewarded ad nhân đôi cá của màn vừa thắng: tối đa adDoublePerDay lần mỗi ngày.
export function fishAdsLeft(state, ms) {
  const ads = eventsOf(state).ads;
  return EV.fish.adDoublePerDay - (ads.day === dayKey(ms) ? ads.fish : 0);
}
export function doubleFish(state, ms, cleared, levelIndex, count) {
  if (fishAdsLeft(state, ms) <= 0 || !running('fish', ms, cleared)) return null;
  const ads = eventsOf(state).ads, today = dayKey(ms);
  const used = withEvents(state, { ads: { day: today, fish: (ads.day === today ? ads.fish : 0) + 1 } });
  return addFish(used, ms, cleared, levelIndex, count);
}

// ---------- Cat Race: đua với 4 mèo máy, ai thắng đủ `goal` màn trước; 24 giờ từ lúc vào ----------
// Đối thủ cố định theo lượt đua (cùng key = cùng tên, cùng giờ thắng): số màn thắng rải ngẫu nhiên trong 24 giờ.
export function raceBots(race) {
  const rng = seeded(`race:${race.key}`), names = RACE_BOTS.slice(), span = EV.race.hours * HOUR_MS;
  return EV.race.bots.map(([lo, hi]) => {
    const name = names.splice(Math.floor(rng() * names.length), 1)[0];
    const wins = lo + Math.floor(rng() * (hi - lo + 1));
    const times = Array.from({ length: wins }, () => race.joinedAt + Math.round(rng() * span)).sort((a, b) => a - b);
    return { name, times };
  });
}
export const raceEnd = race => race.joinedAt + EV.race.hours * HOUR_MS;
// Bảng xếp hạng tại thời điểm `ms` (không quá giờ kết thúc). you = true là người chơi.
// Thứ tự: về đích trước xếp trên; chưa về đích thì nhiều màn hơn xếp trên, bằng nhau thì ai đạt số đó sớm hơn xếp trên.
export function raceStandings(race, ms) {
  const goal = EV.race.goal, at = Math.min(ms, raceEnd(race));
  const entry = (name, times, you = false) => {
    const done = times.filter(t => t <= at).slice(0, goal);
    return { name, you, wins: done.length, reachedAt: done.length ? done[done.length - 1] : race.joinedAt, finished: done.length >= goal };
  };
  const list = [entry('You', race.wins, true), ...raceBots(race).map(bot => entry(bot.name, bot.times))];
  return list.sort((a, b) => (b.wins - a.wins) || (a.reachedAt - b.reachedAt) || (a.you ? -1 : b.you ? 1 : 0));
}
export function raceStatus(state, ms, cleared) {
  const race = eventsOf(state).race, today = running('race', ms, cleared);
  // Lượt đã vào: còn chạy, hoặc đã xong mà chưa nhận thưởng / chưa xem kết quả.
  // (`seen` chỉ bật sau khi đã chốt hạng, xem markRaceSeen)
  if (race && !race.seen) {
    const standings = raceStandings(race, ms);
    return { race, standings, end: raceEnd(race), over: !!race.rank || ms >= raceEnd(race), joinable: false };
  }
  // Hôm nay có đua mà chưa vào lượt này: vào được (tự vào khi bắt đầu một màn được tính).
  if (today && race?.key !== today.key) return { race: null, standings: null, end: today.end, joinable: true, event: today };
  return null;
}
// Vào đua khi bắt đầu một màn được tính trong ngày đua (mỗi ngày đua một lượt). Lượt cũ hết giờ mà chưa chốt thì chốt trước
// (trả thưởng trong `rewards`). Trả về { state, joined, rewards }.
export function joinRace(state, ms, cleared, levelIndex) {
  const rewards = [];
  state = settleRace(state, ms, rewards);
  const today = running('race', ms, cleared), race = eventsOf(state).race;
  if (!today || !eventCounts('race', levelIndex) || race?.key === today.key || (race && !race.paid)) return { state, joined: false, rewards };
  return { state: withEvents(state, { race: { key: today.key, joinedAt: ms, wins: [], rank: null, paid: false, seen: false } }), joined: true, rewards };
}
// Chốt hạng (về đích hoặc hết giờ) và trả thưởng một lần.
function settleRace(state, ms, rewards) {
  const race = eventsOf(state).race;
  if (!race || race.paid) return state;
  const standings = raceStandings(race, ms), you = standings.findIndex(e => e.you);
  if (!standings[you].finished && ms < raceEnd(race)) return state;
  const rank = you + 1, reward = EV.race.rewards[rank - 1];
  rewards.push({ id: 'race', label: `Cat Race #${rank}`, reward, big: rank === 1 });
  return withEvents(pay(state, reward), { race: { ...race, rank, paid: true } });
}
function raceWin(state, ms, levelIndex, rewards) {
  const race = eventsOf(state).race;
  if (!race || race.paid || ms >= raceEnd(race) || !eventCounts('race', levelIndex)) return settleRace(state, ms, rewards);
  return settleRace(withEvents(state, { race: { ...race, wins: [...race.wins, ms] } }), ms, rewards);
}
// Người chơi đã xem bảng kết quả cuộc đua đã xong: thôi hiện nút đua.
export function markRaceSeen(state) {
  const race = eventsOf(state).race;
  return race?.paid ? withEvents(state, { race: { ...race, seen: true } }) : state;
}

// ---------- Deco Sale ----------
export const decoSaleOff = ms => (scheduledOne('decoSale', ms) ? EV.decoSale.off : 0);
export const decoSaleEvent = ms => scheduledOne('decoSale', ms);

// ---------- Điểm nối với màn chơi ----------
// Kết thúc màn (thắng / thua / bỏ ngang). Trả về { state, rewards }.
export function eventLevelEnd(state, ms, cleared, levelIndex, win) {
  const rewards = [];
  let next = win ? yarnWin(state, ms, cleared, levelIndex, rewards) : yarnLose(state, ms, cleared, levelIndex);
  next = win ? raceWin(next, ms, levelIndex, rewards) : settleRace(next, ms, rewards);
  return { state: next, rewards };
}
// Lúc mở game / về Home: chốt cuộc đua đã hết giờ (trả thưởng).
export function syncEvents(state, ms) {
  const rewards = [];
  return { state: settleRace(state, ms, rewards), rewards };
}
// Nút event ở Home: đúng 1 event chính + tối đa 1 event phụ. [{ id, kind, end }]
export function homeEvents(state, ms, cleared) {
  const list = [];
  const main = ['yarn', 'fish'].map(id => running(id, ms, cleared)).find(Boolean);
  if (main) list.push({ id: main.id, kind: 'main', end: main.end });
  const race = raceStatus(state, ms, cleared);
  if (race) list.push({ id: 'race', kind: 'side', end: race.end });
  return list;
}
