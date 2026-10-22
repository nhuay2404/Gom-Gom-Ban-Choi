// Phần dùng chung của hai luồng điều khiển (game/play/, game/menu/): DOM helper, toast, ví xu, ví gem, kho booster.
import { loadProgress, earnedCoins, levelsCleared } from '../core/progression.mjs';
import { BOOSTERS } from '../data/tuning.mjs';
import { START_COINS } from '../data/economy.mjs';
import { loadBoosters, saveBoosters, buyBooster, PACK_SIZE } from '../core/boosters.mjs';
import { loadWallet, saveWallet } from '../core/gems.mjs';
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

// Hộp hỏi dùng chung (continue, mua booster, thiếu gem, ưu đãi, IAP / ads giả lập): mỗi lần tạo một <dialog> mới nên chồng
// được lên nhau (continue → thiếu gem → mua gói). choices: [{ id, label (HTML), style ('ghost' | 'ad'), disabled }].
// Trả về id của nút bấm; đóng bằng Esc = null.
export function ask({ title, body = '', choices, className = '' }) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = `level-dialog store-dialog ${className}`;
    dialog.innerHTML = `<h2>${title}</h2>${body}<div class="store-choices">${choices.map(choice =>
      `<button class="pill-button ${choice.style ?? ''}" data-choice="${choice.id}"${choice.disabled ? ' disabled' : ''}>${choice.label}</button>`).join('')}</div>`;
    dialog.addEventListener('click', event => {
      const button = event.target.closest('[data-choice]');
      if (button) dialog.close(button.dataset.choice);
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(dialog.returnValue || null); });
    document.body.append(dialog);
    dialog.showModal();
  });
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
  document.querySelectorAll('.fh-gems b').forEach(node => { node.textContent = wallet.gems.toLocaleString('en-US'); });
}

// ===== Ví gem (core/gems.mjs): gem + đếm rewarded ads theo ngày + quà gem đã nhận + ưu đãi. Mua / tiêu qua app/store.js =====
let wallet = loadWallet();
export const getWallet = () => wallet;
export function setWallet(next) {
  if (devMoney() && next.gems < wallet.gems) next = { ...next, gems: wallet.gems * 2 - next.gems };
  wallet = next; saveWallet(wallet); refreshWallet();
}

// ===== Kho booster: dùng trong ván (play-controller) và mua ở Shop / popup hết kho (app/store.js) — chỉ bằng GEM =====
let boosterStock = loadBoosters();
export const BOOSTER_NAMES = { hammer: 'Hammer', swap: 'New card', moves: `+${BOOSTERS.EXTRA_MOVES} moves` };
export const gemTag = n => `<i class="ico-gem"></i>${n}`;
export const priceTag = (id, pack = false) => gemTag((pack ? BOOSTERS.PACK_PRICE : BOOSTERS.PRICE)[id]);
export const getBoosters = () => boosterStock;
export function storeBoosters(stock) { boosterStock = stock; saveBoosters(stock); }
// Mua 1 cái / gói ×3 bằng gem; thiếu gem thì trả { short } (số gem còn thiếu) để store.js mời mua gói gem.
export function buyOne(id, pack = false) {
  const bought = buyBooster(boosterStock, wallet.gems, id, pack);
  if (bought.error) return { short: bought.short };
  setWallet({ ...wallet, gems: bought.gems });
  storeBoosters(bought.stock);
  playSound('reward');
  showToast(`Bought ${BOOSTER_NAMES[id]}${pack ? ` ×${PACK_SIZE}` : ''} · −${(pack ? BOOSTERS.PACK_PRICE : BOOSTERS.PRICE)[id]} gems`);
  return { ok: true };
}
