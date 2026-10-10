// Reward bundles. One shape for every source (login, chest, event, race, pass):
//   { <currency>: n, items: { <itemId>: n }, timers: { <timerId>: minutes }, random: { pool: [itemId], n } }
// Currencies listed in config.currencies with owner 'kit' (e.g. gems) are stored by the kit; everything else
// (game currencies such as coins, items such as boosters or deco) is handed to the game adapter's grant().

const RESERVED = new Set(['items', 'timers', 'random']);

// Replace `random` with concrete items (rng injectable for tests). Returns a new bundle without `random`.
export function resolveRandom(reward, rng = Math.random) {
  if (!reward?.random) return reward;
  const { random, ...rest } = reward;
  const items = { ...rest.items };
  for (let i = 0; i < (random.n ?? 1); i++) {
    const id = random.pool[Math.floor(rng() * random.pool.length)];
    items[id] = (items[id] ?? 0) + 1;
  }
  return { ...rest, items };
}

// Multiply every amount (rewarded-ad doubling).
export function scaleReward(reward, times) {
  const out = {};
  for (const [key, value] of Object.entries(reward)) {
    if (key === 'items' || key === 'timers') out[key] = Object.fromEntries(Object.entries(value).map(([id, n]) => [id, n * times]));
    else if (key === 'random') out.random = { ...value, n: (value.n ?? 1) * times };
    else out[key] = value * times;
  }
  return out;
}

// Split a resolved bundle into what the kit keeps and what the game receives.
export function splitReward(reward, currencies) {
  const kit = {}, game = {};
  for (const [key, value] of Object.entries(reward ?? {})) {
    if (key === 'items') { if (Object.keys(value).length) game.items = value; continue; }
    if (key === 'timers') { kit.timers = value; continue; }
    if (RESERVED.has(key)) continue;
    if (currencies[key]?.owner === 'kit') kit[key] = value;
    else game[key] = value;
  }
  return { kit, game };
}

export const isEmptyReward = reward => !reward || Object.keys(reward).every(key =>
  (key === 'items' || key === 'timers') ? !Object.keys(reward[key]).length : !reward[key]);
