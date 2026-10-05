// Phần dùng chung của hai luồng điều khiển (play-controller.js, menu-controller.js): DOM helper, toast, ví xu, kho booster.
import { loadProgress, totalStars } from './gameplay/progression.mjs';
import { BOOSTERS } from './gameplay/tuning.mjs';
import { loadBoosters, saveBoosters, buyBooster } from './gameplay/boosters.mjs';
import { loadDeco, saveDeco } from './deco/deco-data.mjs';
import { playSound } from './ui/sound.mjs';

export const $ = id => document.getElementById(id);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Nút cho game dev chỉ hiện khi chạy localhost, URL có ?dev, hoặc bản HTML build bật cờ GOMGOM_DEV
// (tools/build-single-html.mjs, mặc định bật; build cho người chơi: npm run build:html -- --no-dev).
export const DEV_MODE = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || new URLSearchParams(location.search).has('dev')
  || globalThis.GOMGOM_DEV === true;

let toastTimer = 0;
export function showToast(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
}

// ===== Ví: đồ deco + xu nằm chung một bản lưu (deco-data.mjs). Màn chơi cộng xu khi thắng, Deco / booster tiêu xu. =====
let deco = loadDeco(totalStars(loadProgress()));
export const getDeco = () => deco;
export function setDeco(next) { deco = next; saveDeco(deco); }
export function refreshWallet() {
  ['home-coins', 'deco-coins', 'shop-coins'].forEach(id => { $(id).textContent = deco.coins.toLocaleString('en-US'); });
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
