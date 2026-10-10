// Lives: max N, one regenerates every regenMin; lost on a loss or a quit from `fromLevel` on (wins cost nothing).
// config.lives = { max, regenMin, fromLevel, introUnlimitedMin, refill: { gems: 60 }, adPerDay } or null (game without lives).
import { dayKey } from '../platform/time.mjs';
import { spend } from '../platform/state.mjs';

const MIN = 60 * 1000;
export const livesOn = (config, level) => !!config.lives && level >= (config.lives.fromLevel ?? 1);
export const hasUnlimited = (state, now) => state.lives.unlimitedUntil > now;

export function regen(state, config, now) {
  const L = config.lives, lives = state.lives;
  if (!L) return state;
  if (lives.n >= L.max || lives.regenFrom == null) return { ...state, lives: { ...lives, n: Math.min(lives.n, L.max), regenFrom: null } };
  const step = L.regenMin * MIN, gained = Math.max(0, Math.floor((now - lives.regenFrom) / step));
  const n = Math.min(L.max, lives.n + gained);
  return { ...state, lives: { ...lives, n, regenFrom: n >= L.max ? null : lives.regenFrom + gained * step } };
}

export function livesInfo(state, config, now) {
  if (!config.lives) return null;
  const s = regen(state, config, now), l = s.lives;
  const unlimitedMs = Math.max(0, l.unlimitedUntil - now);
  const nextMs = l.regenFrom == null ? 0 : Math.max(0, l.regenFrom + config.lives.regenMin * MIN - now);
  const adsLeft = (config.lives.adPerDay ?? 0) - (l.ads.day === dayKey(now) ? l.ads.used : 0);
  return { lives: l.n, max: config.lives.max, nextMs, unlimitedMs, canPlay: unlimitedMs > 0 || l.n > 0, adsLeft, refill: config.lives.refill };
}

export const canStart = (state, config, level, now) => !livesOn(config, level) || livesInfo(state, config, now).canPlay;

export function loseLife(state, config, level, now) {
  if (!livesOn(config, level) || hasUnlimited(state, now)) return state;
  const s = regen(state, config, now);
  if (s.lives.n <= 0) return s;
  return { ...s, lives: { ...s.lives, n: s.lives.n - 1, regenFrom: s.lives.regenFrom ?? now } };
}

export function addLives(state, config, count, now) {
  const s = regen(state, config, now), n = Math.min(config.lives.max, s.lives.n + count);
  return { ...s, lives: { ...s.lives, n, regenFrom: n >= config.lives.max ? null : s.lives.regenFrom } };
}

export function refill(state, config, now) {
  const paid = spend(regen(state, config, now), config.lives.refill);
  return paid && { ...paid, lives: { ...paid.lives, n: config.lives.max, regenFrom: null } };
}

export function adLife(state, config, now) {
  const info = livesInfo(state, config, now);
  if (!info || info.adsLeft <= 0) return null;
  const today = dayKey(now), used = state.lives.ads.day === today ? state.lives.ads.used : 0;
  const next = addLives(state, config, 1, now);
  return { ...next, lives: { ...next.lives, ads: { day: today, used: used + 1 } } };
}

// First time the player reaches a lives level: grant unlimited lives so the first lives level never feels short.
export function introLives(state, config, level, now) {
  if (state.lives.intro || !livesOn(config, level)) return { state, granted: 0 };
  const minutes = config.lives.introUnlimitedMin ?? 0;
  const lives = { ...state.lives, intro: true, unlimitedUntil: Math.max(state.lives.unlimitedUntil, now) + minutes * MIN };
  return { state: { ...state, lives }, granted: minutes };
}
