// Persistent LiveOps state (one JSON document per game). Only kit-owned data lives here:
// kit currencies (gems), lives, daily login / quests, win streak, event progress. Game currencies and items stay in the game.
import { syncClock } from './time.mjs';

export const STATE_VERSION = 1;

export function newState(config, now) {
  const wallet = Object.fromEntries(Object.entries(config.currencies)
    .filter(([, c]) => c.owner === 'kit').map(([id, c]) => [id, c.start ?? 0]));
  return {
    v: STATE_VERSION,
    wallet,
    lives: { n: config.lives?.max ?? 0, regenFrom: null, unlimitedUntil: 0, intro: false, ads: { day: null, used: 0 } },
    maxSeen: now,
    login: { claimed: 0, lastDay: null },
    quests: null,
    streak: 0,
    events: { ads: { day: null } },
  };
}

// Merge a saved document over defaults (new fields added by later kit versions get their default).
export function loadState(saved, config, now) {
  const base = newState(config, now);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base, ...saved,
    wallet: { ...base.wallet, ...saved.wallet },
    lives: { ...base.lives, ...saved.lives, ads: { ...base.lives.ads, ...saved.lives?.ads } },
    login: { ...base.login, ...saved.login },
    events: { ...base.events, ...saved.events, ads: { ...base.events.ads, ...saved.events?.ads } },
  };
}

export const touchClock = (state, now, config) => syncClock(state, now, (config.clockToleranceMin ?? 10) * 60 * 1000);

// Apply the kit part of a reward: kit currencies + timers (only `unlimitedLives` is understood by the core).
export function applyKitReward(state, kitPart, now) {
  let next = state;
  for (const [id, n] of Object.entries(kitPart)) {
    if (id === 'timers') continue;
    next = { ...next, wallet: { ...next.wallet, [id]: (next.wallet[id] ?? 0) + n } };
  }
  const minutes = kitPart.timers?.unlimitedLives;
  if (minutes) next = { ...next, lives: { ...next.lives, unlimitedUntil: Math.max(next.lives.unlimitedUntil, now) + minutes * 60 * 1000 } };
  return next;
}

// Pay a price like { gems: 60 } from kit currencies. Returns null when the wallet is short.
export function spend(state, price) {
  for (const [id, n] of Object.entries(price)) if ((state.wallet[id] ?? 0) < n) return null;
  const wallet = { ...state.wallet };
  for (const [id, n] of Object.entries(price)) wallet[id] -= n;
  return { ...state, wallet };
}
