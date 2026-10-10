// In-level helpers: win streak buffs and continue offers. The kit only decides WHAT is granted;
// the game adapter applies it (applyBuff / resume), so "+2 moves" or "+1 shield" stays game-specific.
// config.streak   = { fromLevel, tiers: [{ wins, buffs: { buffId: value } }] } or null
// config.continue = { fromLevel, prices: [{ gems: 60 }, ...], value, ad: { perAttempt, value } } or null

export const streakOn = (config, level) => !!config.streak && level >= (config.streak.fromLevel ?? 1);

// Highest tier reached by the current streak (null below the first tier).
export function streakTier(config, streak) {
  let tier = null;
  (config.streak?.tiers ?? []).forEach((t, index) => { if (streak >= t.wins) tier = { ...t, tier: index + 1 }; });
  return tier;
}

export function recordStreak(state, config, level, win) {
  if (!streakOn(config, level)) return state;
  return { ...state, streak: win ? state.streak + 1 : 0 };
}

export const continueOn = (config, level) => !!config.continue && level >= (config.continue.fromLevel ?? 1);
// `used` = paid continues already bought in this attempt.
export const continuePrice = (config, used) => config.continue.prices[Math.min(used, config.continue.prices.length - 1)];
