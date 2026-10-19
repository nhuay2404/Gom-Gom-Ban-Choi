// Phần dùng chung của hai luồng điều khiển (game/play/, game/menu/): DOM helper, toast, ví xu, kho booster.
import { loadProgress, earnedCoins, levelsCleared } from '../core/progression.mjs';
import { BOOSTERS } from '../data/tuning.mjs';
import { START_COINS } from '../data/economy.mjs';
import { loadBoosters, saveBoosters, buyBooster } from '../core/boosters.mjs';
import { loadDeco, saveDeco } from '../deco/deco-data.mjs';
import { playSound } from '../ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';

export const $ = id => document.getElementById(id);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Nút cho game dev chỉ hiện khi chạy localhost, URL có ?dev, hoặc bản HTML build bật cờ GOMGOM_DEV
// (tools/export/build-single-html.mjs, mặc định bật; build cho người chơi: npm run build:html -- --no-dev).
export const DEV_MODE = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || new URLSearchParams(location.search).has('dev')
  || globalThis.GOMGOM_DEV === true;

// Bộ quân trên bàn (mèo / chó): bộ chó mở khi chơi tới màn DOG_SKIN_LEVEL (đã thắng DOG_SKIN_LEVEL - 1 màn) và tự đổi sang chó;
// người chơi đổi qua lại ở nút bộ quân trên Home hub (lưu SAVE_KEYS.skin). Chưa tới màn đó thì luôn là mèo.
export const DOG_SKIN_LEVEL = 30;
export const dogSkinOpen = () => levelsCleared(loadProgress()) >= DOG_SKIN_LEVEL - 1;
export const pieceSkin = () => dogSkinOpen() ? (readText(SAVE_KEYS.skin) || 'dogs') : 'cats';
export const setPieceSkin = skin => { writeText(SAVE_KEYS.skin, skin); dispatchEvent(new Event('pieceskin')); }; // màn chơi nghe để đổi hình ngay

let toastTimer = 0;
export function showToast(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
}

// ===== Ví: đồ deco + xu nằm chung một bản lưu (deco-data.mjs). Màn chơi cộng xu khi thắng, Deco / booster tiêu xu. =====
let deco = loadDeco(START_COINS + earnedCoins(loadProgress()));
export const getDeco = () => deco;
// Dev "mod money" (nút Dev: Money): xu tiêu ra được cộng ngược vào ví thay vì trừ.
export const devMoney = () => DEV_MODE && (() => { try { return localStorage.getItem('gomgom-dev-money') === 'on'; } catch { return false; } })();
export function setDeco(next) {
  if (devMoney() && next.coins < deco.coins) next = { ...next, coins: deco.coins * 2 - next.coins };
  deco = next; saveDeco(deco);
}
export function refreshWallet() {
  ['map-coins', 'deco-coins', 'shop-coins'].forEach(id => { $(id).textContent = deco.coins.toLocaleString('en-US'); });
}

// ===== Kho booster: dùng trong ván (play-controller) và mua ở Shop (menu-controller) =====
let boosterStock = loadBoosters();
export const BOOSTER_NAMES = { hammer: 'Hammer', swap: 'New card', moves: `+${BOOSTERS.EXTRA_MOVES} moves` };
export const priceTag = id => `<i class="ico-coin"></i>${BOOSTERS.PRICE[id]}`;
export const getBoosters = () => boosterStock;
export function storeBoosters(stock) { boosterStock = stock; saveBoosters(stock); }
// Mua một cái bằng xu; trả về false nếu không đủ xu.
export function buyOne(id) {
  const bought = buyBooster(boosterStock, deco.coins, id);
  if (bought.error) { showToast(`Need ${BOOSTERS.PRICE[id] - deco.coins} more coins for ${BOOSTER_NAMES[id]}`); return false; }
  setDeco({ ...deco, coins: bought.coins });
  storeBoosters(bought.stock);
  refreshWallet();
  playSound('reward');
  showToast(`Bought ${BOOSTER_NAMES[id]} · −${BOOSTERS.PRICE[id]} coins`);
  return true;
}
