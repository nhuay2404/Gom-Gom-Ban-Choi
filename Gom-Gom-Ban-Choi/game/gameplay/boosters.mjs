// Kho booster của người chơi (thuần logic): số lượng từng loại, dùng một cái, mua bằng xu.
// Luật booster trong ván (đập ô, đổi thẻ, thêm lượt) nằm ở session.mjs.
import { BOOSTERS } from './tuning.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

export const BOOSTER_IDS = ['hammer', 'swap', 'moves'];
// Màn thứ `levelIndex` (0 = màn 1) có thanh booster không.
export const boostersUnlocked = levelIndex => levelIndex + 1 >= BOOSTERS.UNLOCK_LEVEL;

export function loadBoosters() {
  const saved = readJSON(SAVE_KEYS.boosters) || {};
  return Object.fromEntries(BOOSTER_IDS.map(id => [id, Number.isInteger(saved[id]) && saved[id] >= 0 ? saved[id] : BOOSTERS.START_STOCK]));
}
export function saveBoosters(stock) { writeJSON(SAVE_KEYS.boosters, stock); }

// Trả về kho mới sau khi dùng một cái; hết hàng thì null.
export function spendBooster(stock, id) {
  return stock[id] > 0 ? { ...stock, [id]: stock[id] - 1 } : null;
}
// Mua một cái bằng xu: trả về { stock, coins } mới, không đủ xu thì { error }.
export function buyBooster(stock, coins, id) {
  const price = BOOSTERS.PRICE[id];
  if (coins < price) return { error: 'Not enough coins' };
  return { stock: { ...stock, [id]: stock[id] + 1 }, coins: coins - price };
}
