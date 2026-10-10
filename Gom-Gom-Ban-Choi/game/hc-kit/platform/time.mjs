// Calendar helpers on the player's local clock, deterministic RNG and the clock rollback guard.
// No platform APIs: every function takes `now` (ms) so the core stays testable and engine-neutral.

const DAY_MS = 24 * 60 * 60 * 1000;

// Local calendar day, e.g. '2026-10-08'. A new day starts at 00:00 player time.
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function msToNextDay(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - ms;
}

// Whole days between `epoch` ({ year, month (1-12), day }) and the local day of `ms`. Uses UTC dates so DST never shifts it.
export function dayNumber(ms, epoch) {
  const d = new Date(ms);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(epoch.year, epoch.month - 1, epoch.day)) / DAY_MS);
}

// Local 00:00 of day n counted from `epoch`.
export const dayStart = (n, epoch) => new Date(epoch.year, epoch.month - 1, epoch.day + n).getTime();

// Deterministic RNG from a string (same day / same race key = same result after reload).
export function seeded(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Rollback guard: remember the highest time ever seen; a clock behind it by more than `toleranceMs` is "tampered"
// and blocks every claim / progress until real time passes the mark again.
export const clockTampered = (state, ms, toleranceMs) => ms + toleranceMs < state.maxSeen;
export function syncClock(state, ms, toleranceMs) {
  if (clockTampered(state, ms, toleranceMs)) return { state, tampered: true };
  return { state: { ...state, maxSeen: Math.max(state.maxSeen, ms) }, tampered: false };
}
