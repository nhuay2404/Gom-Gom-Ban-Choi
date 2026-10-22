// Kho booster của người chơi (thuần logic): số lượng từng loại, dùng một cái, mua bằng gem (lẻ hoặc gói ×3).
// Luật booster trong ván (đập ô, đổi thẻ, thêm lượt) nằm ở session.mjs.
import { BOOSTERS } from '../data/tuning.mjs';
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
// Mua bằng gem: 1 cái (BOOSTERS.PRICE) hoặc gói ×3 (BOOSTERS.PACK_PRICE). Trả về { stock, gems } mới, thiếu gem thì { error, short }.
export const PACK_SIZE = 3;
export function buyBooster(stock, gems, id, pack = false) {
  const price = (pack ? BOOSTERS.PACK_PRICE : BOOSTERS.PRICE)[id];
  if (gems < price) return { error: 'Not enough gems', short: price - gems };
  return { stock: { ...stock, [id]: stock[id] + (pack ? PACK_SIZE : 1) }, gems: gems - price };
}
