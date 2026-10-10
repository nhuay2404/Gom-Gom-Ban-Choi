// Daily layer: 7-day login calendar (a missed day pauses, never resets) + daily quests with a chest.
// config.daily = { fromCleared, login: [reward x N], quests: { slots: { tier: points }, pool: { tier: [questDef] }, chest: reward } }
// questDef = { id, text, need, match: { signal, ...filters }, count: 'amount' | 'signals', fromCleared? }
//   match filters: any field of the signal payload must be equal, plus minAmount / minStars helpers.
import { dayKey, seeded, clockTampered } from '../platform/time.mjs';

const tol = config => (config.clockToleranceMin ?? 10) * 60 * 1000;
export const dailyOn = (config, cleared) => !!config.daily && cleared >= (config.daily.fromCleared ?? 0);

// ---------- Login ----------
export function loginStatus(state, config, now) {
  const rewards = config.daily.login, step = state.login.claimed % rewards.length;
  const claimedToday = state.login.lastDay === dayKey(now);
  return { step, claimedToday, canClaim: !claimedToday && !clockTampered(state, now, tol(config)), rewards };
}
export function claimLogin(state, config, now) {
  const status = loginStatus(state, config, now);
  if (!status.canClaim) return null;
  return { state: { ...state, login: { claimed: state.login.claimed + 1, lastDay: dayKey(now) } }, reward: status.rewards[status.step], step: status.step };
}

// ---------- Quests ----------
const allQuests = config => Object.values(config.daily.quests.pool).flat();
export const questDef = (config, id) => allQuests(config).find(q => q.id === id);
export const questGoal = config => Object.values(config.daily.quests.slots).reduce((a, b) => a + b, 0);

export function ensureQuests(state, config, now, cleared) {
  const day = dayKey(now);
  if (state.quests?.day === day) return state;
  const rng = seeded(`quests:${config.gameId}:${day}`);
  const list = Object.entries(config.daily.quests.slots).map(([tier, points]) => {
    const pool = config.daily.quests.pool[tier].filter(q => (q.fromCleared ?? 0) <= cleared);
    const quest = pool[Math.floor(rng() * pool.length)];
    return { id: quest.id, tier, points, have: 0, need: quest.need };
  });
  return { ...state, quests: { day, list, chest: false } };
}

export function matches(match, signal, payload) {
  if (match.signal !== signal) return false;
  for (const [key, value] of Object.entries(match)) {
    if (key === 'signal') continue;
    if (key === 'minAmount') { if ((payload.amount ?? 0) < value) return false; continue; }
    if (key === 'minStars') { if ((payload.stars ?? 0) < value) return false; continue; }
    if (payload[key] !== value) return false;
  }
  return true;
}

// Feed one signal to today's quests. Returns { state, completed: [quest] }.
export function trackQuests(state, config, now, signal, payload) {
  if (!state.quests || state.quests.day !== dayKey(now)) return { state, completed: [] };
  const completed = [];
  const list = state.quests.list.map(q => {
    const def = questDef(config, q.id);
    if (!def || q.have >= q.need || !matches(def.match, signal, payload)) return q;
    const add = def.count === 'amount' ? (payload.amount ?? 1) : 1;
    if (add <= 0) return q;
    const have = Math.min(q.need, q.have + add);
    if (have >= q.need) completed.push({ ...q, have });
    return { ...q, have };
  });
  return { state: { ...state, quests: { ...state.quests, list } }, completed };
}

export const questPoints = state => (state.quests?.list ?? []).reduce((sum, q) => sum + (q.have >= q.need ? q.points : 0), 0);
export const chestReady = (state, config) => !!state.quests && !state.quests.chest && questPoints(state) >= questGoal(config);
export function claimChest(state, config, now) {
  if (!chestReady(state, config) || clockTampered(state, now, tol(config))) return null;
  return { state: { ...state, quests: { ...state.quests, chest: true } }, reward: config.daily.quests.chest };
}
