// Weekly events driven by a data calendar (no server needed: fixed cycle counted from an epoch on the player's clock).
// config.events = {
//   epoch: { year, month, day },  cycleDays: 28,
//   calendar: [{ id, slot: 'main' | 'side' | 'offer', weekdays: [0..6] (0 = Monday), weeks?: [1..4] }],
//   defs: { <id>: { type: 'ladder' | 'collect' | 'race' | 'sale', name, fromLevel, ...type params } },
// }
// Consecutive weekdays of one calendar entry form one run; a run's key is `${id}:${startDay}` and progress resets when it changes.
// All functions are pure and return { state, rewards: [{ eventId, label, reward, big }] }; the facade grants the rewards.
import { dayKey, dayNumber, dayStart, seeded, clockTampered } from '../platform/time.mjs';

const HOUR_MS = 60 * 60 * 1000;
const tol = config => (config.clockToleranceMin ?? 10) * 60 * 1000;
const E = config => config.events;

// ---------- Calendar ----------
export function calendarDay(config, ms) {
  const { epoch, cycleDays } = E(config), day = dayNumber(ms, epoch), cycleDay = ((day % cycleDays) + cycleDays) % cycleDays;
  return { day, cycle: Math.floor(day / cycleDays), cycleDay, week: Math.floor(cycleDay / 7) + 1, weekday: cycleDay % 7 };
}
export function scheduled(config, ms) {
  if (!E(config)) return [];
  const cal = calendarDay(config, ms), epoch = E(config).epoch;
  return E(config).calendar.filter(entry => entry.weekdays.includes(cal.weekday) && (!entry.weeks || entry.weeks.includes(cal.week))).map(entry => {
    let first = cal.weekday, last = cal.weekday;
    while (entry.weekdays.includes(first - 1)) first--;
    while (entry.weekdays.includes(last + 1)) last++;
    const startDay = cal.day - (cal.weekday - first), def = E(config).defs[entry.id];
    return { id: entry.id, type: def.type, slot: entry.slot, key: `${entry.id}:${dayKey(dayStart(startDay, epoch))}`,
      start: dayStart(startDay, epoch), end: dayStart(cal.day + (last - cal.weekday) + 1, epoch) };
  });
}
export const eventOpen = (config, id, cleared) => cleared + 1 >= (E(config).defs[id].fromLevel ?? 1);
export const eventCounts = (config, id, level) => level >= (E(config).defs[id].fromLevel ?? 1);
// Runs the player can take part in right now (unlocked by progress).
export const running = (config, ms, cleared) => scheduled(config, ms).filter(run => eventOpen(config, run.id, cleared));
const runningOfType = (config, ms, cleared, type) => running(config, ms, cleared).filter(run => run.type === type);

const progressOf = (state, id) => state.events?.[id] ?? null;
const withProgress = (state, id, progress) => ({ ...state, events: { ...state.events, [id]: progress } });

// ---------- Ladder: win = up one step, loss = down one step; step rewards once per climb, top reward then restart ----------
function ladderOf(state, run) {
  const p = progressOf(state, run.id);
  return p?.key === run.key ? p : { key: run.key, step: 0, paid: [], tops: 0 };
}
export function ladderStatus(state, config, run) { return { run, ...ladderOf(state, run), def: E(config).defs[run.id] }; }
function ladderEnd(state, config, run, win, rewards) {
  const def = E(config).defs[run.id];
  let p = ladderOf(state, run);
  if (!win) return withProgress(state, run.id, { ...p, step: Math.max(0, p.step - 1) });
  const step = p.step + 1, stepReward = def.stepRewards?.[step];
  if (stepReward && !p.paid.includes(step)) {
    rewards.push({ eventId: run.id, label: `${def.name} step ${step}`, reward: stepReward });
    p = { ...p, paid: [...p.paid, step] };
  }
  if (step >= def.steps) {
    rewards.push({ eventId: run.id, label: `${def.name} top`, reward: p.tops && def.repeatTop ? def.repeatTop : def.top, big: true });
    return withProgress(state, run.id, { ...p, step: 0, paid: [], tops: p.tops + 1 });
  }
  return withProgress(state, run.id, { ...p, step });
}

// ---------- Collect: tokens from `collect` signals of a given kind, milestone rewards ----------
function collectOf(state, run) {
  const p = progressOf(state, run.id);
  return p?.key === run.key ? p : { key: run.key, tokens: 0, reached: 0 };
}
export function collectStatus(state, config, run) { return { run, ...collectOf(state, run), def: E(config).defs[run.id] }; }
export function addTokens(state, config, run, count, rewards) {
  const def = E(config).defs[run.id];
  let p = collectOf(state, run);
  p = { ...p, tokens: p.tokens + count };
  while (p.reached < def.milestones.length && p.tokens >= def.milestones[p.reached].at) {
    rewards.push({ eventId: run.id, label: `${def.name} reward ${p.reached + 1}`, reward: def.milestones[p.reached].reward, big: p.reached === def.milestones.length - 1 });
    p = { ...p, reached: p.reached + 1 };
  }
  return withProgress(state, run.id, p);
}
// `collect` signal → every running collect event whose def.collect.kind matches.
export function eventCollect(state, config, ms, cleared, payload) {
  const rewards = [];
  if (!E(config) || clockTampered(state, ms, tol(config)) || !(payload.amount > 0)) return { state, rewards, added: {} };
  const added = {};
  for (const run of runningOfType(config, ms, cleared, 'collect')) {
    const def = E(config).defs[run.id];
    if (def.collect.kind !== payload.kind || !eventCounts(config, run.id, payload.level)) continue;
    const count = Math.round(payload.amount * (def.collect.per ?? 1));
    state = addTokens(state, config, run, count, rewards);
    added[run.id] = count;
  }
  return { state, rewards, added };
}
export function adDoubleLeft(state, config, id, ms) {
  const ads = state.events.ads ?? {};
  return (E(config).defs[id].adDoublePerDay ?? 0) - (ads.day === dayKey(ms) ? (ads[id] ?? 0) : 0);
}
// Rewarded ad: add `count` tokens again (doubling the last level's haul).
export function adDouble(state, config, ms, cleared, id, count) {
  const run = runningOfType(config, ms, cleared, 'collect').find(r => r.id === id), rewards = [];
  if (!run || count <= 0 || adDoubleLeft(state, config, id, ms) <= 0 || clockTampered(state, ms, tol(config))) return null;
  const today = dayKey(ms), ads = state.events.ads?.day === today ? state.events.ads : { day: today };
  state = { ...state, events: { ...state.events, ads: { ...ads, [id]: (ads[id] ?? 0) + 1 } } };
  return { state: addTokens(state, config, run, count, rewards), rewards };
}

// ---------- Race: first to `goal` wins within `hours` of joining; rivals are AI with seeded win times ----------
export function raceBots(config, id, race) {
  const def = E(config).defs[id], rng = seeded(`race:${race.key}`), names = def.botNames.slice(), span = def.hours * HOUR_MS;
  return def.bots.map(([lo, hi]) => {
    const name = names.splice(Math.floor(rng() * names.length), 1)[0];
    const wins = lo + Math.floor(rng() * (hi - lo + 1));
    return { name, times: Array.from({ length: wins }, () => race.joinedAt + Math.round(rng() * span)).sort((a, b) => a - b) };
  });
}
export const raceEnd = (config, id, race) => race.joinedAt + E(config).defs[id].hours * HOUR_MS;
export function raceStandings(config, id, race, ms) {
  const goal = E(config).defs[id].goal, at = Math.min(ms, raceEnd(config, id, race));
  const entry = (name, times, you = false) => {
    const done = times.filter(t => t <= at).slice(0, goal);
    return { name, you, ai: !you, wins: done.length, reachedAt: done.length ? done[done.length - 1] : race.joinedAt, finished: done.length >= goal };
  };
  const list = [entry('You', race.wins, true), ...raceBots(config, id, race).map(bot => entry(bot.name, bot.times))];
  return list.sort((a, b) => (b.wins - a.wins) || (a.reachedAt - b.reachedAt) || (a.you ? -1 : b.you ? 1 : 0));
}
function settleRace(state, config, id, ms, rewards) {
  const race = progressOf(state, id);
  if (!race || race.paid) return state;
  const standings = raceStandings(config, id, race, ms), you = standings.findIndex(e => e.you);
  if (!standings[you].finished && ms < raceEnd(config, id, race)) return state;
  const rank = you + 1, def = E(config).defs[id];
  rewards.push({ eventId: id, label: `${def.name} #${rank}`, reward: def.rewards[rank - 1], big: rank === 1 });
  return withProgress(state, id, { ...race, rank, paid: true });
}
// Join on the first counted level start of a race day (one race per run).
export function joinRaces(state, config, ms, cleared, level) {
  const rewards = [];
  if (!E(config) || clockTampered(state, ms, tol(config))) return { state, rewards, joined: [] };
  const joined = [];
  for (const id of Object.keys(E(config).defs).filter(i => E(config).defs[i].type === 'race')) state = settleRace(state, config, id, ms, rewards);
  for (const run of runningOfType(config, ms, cleared, 'race')) {
    const race = progressOf(state, run.id);
    if (!eventCounts(config, run.id, level) || race?.key === run.key || (race && !race.paid)) continue;
    state = withProgress(state, run.id, { key: run.key, joinedAt: ms, wins: [], rank: null, paid: false, seen: false });
    joined.push(run.id);
  }
  return { state, rewards, joined };
}
export function raceStatus(state, config, id, ms, cleared) {
  const race = progressOf(state, id), run = runningOfType(config, ms, cleared, 'race').find(r => r.id === id);
  if (race && !race.seen) return { id, race, standings: raceStandings(config, id, race, ms), end: raceEnd(config, id, race), over: !!race.rank || ms >= raceEnd(config, id, race), joinable: false };
  if (run && race?.key !== run.key) return { id, race: null, standings: null, end: run.end, joinable: true };
  return null;
}
export function markRaceSeen(state, id) {
  const race = progressOf(state, id);
  return race?.paid ? withProgress(state, id, { ...race, seen: true }) : state;
}

// ---------- Sale ----------
// Discount (0..1) of the sale running now, or 0. The game applies it to its own prices.
export function saleOff(config, ms, id) {
  const run = scheduled(config, ms).find(r => r.id === id && r.type === 'sale');
  return run ? E(config).defs[id].off : 0;
}

// ---------- Hooks used by the facade ----------
export function eventLevelEnd(state, config, ms, cleared, level, win) {
  const rewards = [];
  if (!E(config) || clockTampered(state, ms, tol(config))) return { state, rewards };
  for (const run of runningOfType(config, ms, cleared, 'ladder')) if (eventCounts(config, run.id, level)) state = ladderEnd(state, config, run, win, rewards);
  for (const id of Object.keys(E(config).defs).filter(i => E(config).defs[i].type === 'race')) {
    const race = progressOf(state, id);
    if (win && race && !race.paid && ms < raceEnd(config, id, race) && eventCounts(config, id, level)) state = withProgress(state, id, { ...race, wins: [...race.wins, ms] });
    state = settleRace(state, config, id, ms, rewards);
  }
  return { state, rewards };
}
// On app open / back to home: settle races whose time ran out.
export function syncEvents(state, config, ms) {
  const rewards = [];
  if (!E(config) || clockTampered(state, ms, tol(config))) return { state, rewards };
  for (const id of Object.keys(E(config).defs).filter(i => E(config).defs[i].type === 'race')) state = settleRace(state, config, id, ms, rewards);
  return { state, rewards };
}
// Home buttons: exactly one main event + at most one side event (offers are not buttons).
export function homeEvents(state, config, ms, cleared) {
  if (!E(config)) return [];
  const list = [], runs = running(config, ms, cleared);
  const main = runs.find(r => r.slot === 'main');
  if (main) list.push({ id: main.id, type: main.type, slot: 'main', end: main.end });
  for (const id of Object.keys(E(config).defs).filter(i => E(config).defs[i].type === 'race')) {
    const status = raceStatus(state, config, id, ms, cleared);
    if (status && list.length < 2) list.push({ id, type: 'race', slot: 'side', end: status.end });
  }
  return list;
}
