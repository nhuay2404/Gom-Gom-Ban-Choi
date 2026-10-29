// Phần dùng chung của hai luồng điều khiển (game/play/, game/menu/): DOM helper, toast, ví xu, ví gem, kho booster.
import { loadProgress, earnedCoins, levelsCleared, unlockedCount } from '../core/progression.mjs';
import { BOOSTERS } from '../data/tuning.mjs';
import { START_COINS } from '../data/economy.mjs';
import { loadBoosters, saveBoosters, buyBooster, PACK_SIZE, boostersUnlocked } from '../core/boosters.mjs';
import { loadDaily, saveDaily, rollDaily, noteDaily as countDaily, dailyOpen } from '../core/daily.mjs';
import { idleOpen } from '../core/idle.mjs';
import { loadWallet, saveWallet } from '../core/gems.mjs';
import { loadDeco, saveDeco, baseLeft, basesLeft, petsLeft, stylesLeft, nextArea, areaOpen, AREA_ORDER, AREA_NAMES } from '../deco/deco-data.mjs';
import { loadQuests, saveQuests, fillQuests, noteQuests, questsOpen } from '../core/quests.mjs';
import { LEVELS } from '../data/levels.mjs';
import { playSound } from '../ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';
import { openConfirmation } from '../ui/shared/confirmation-view.mjs';

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
export function ask(options) {
  const { title, body = '', choices, className = '' } = options;
  // Pet rewards already have a bespoke art layout; other choices share the confirmation kit.
  if (!className.split(/\s+/).includes('idle-claim')) return openConfirmation(options);
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
  ['map-coins', 'deco-coins', 'shop-coins'].forEach(id => countTo($(id), deco.coins));
  document.querySelectorAll('.fh-gems b').forEach(node => countTo(node, wallet.gems));
}
// Số trên ví: tăng thì đếm dần lên (nhanh lúc đầu, chậm dần, ≤ .9 s), giảm (tiêu) thì đổi ngay.
const counting = new WeakMap();
function countTo(node, value) {
  const from = Number(node.textContent.replace(/[^0-9]/g, '')) || 0, show = n => { node.textContent = Math.round(n).toLocaleString('en-US'); };
  cancelAnimationFrame(counting.get(node));
  if (value <= from || reduceMotion.matches || !node.isConnected) return show(value);
  const start = performance.now(), duration = Math.min(900, 350 + (value - from) * 4);
  const step = now => {
    const k = Math.min(1, (now - start) / duration);
    show(from + (value - from) * (1 - (1 - k) ** 3));
    if (k < 1) counting.set(node, requestAnimationFrame(step));
  };
  counting.set(node, requestAnimationFrame(step));
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

// ===== Nhiệm vụ ngày (core/daily.mjs, bảng menu/daily.js) + nhiệm vụ tiến trình (core/quests.mjs, bảng menu/quests.js) =====
// Cả màn chơi lẫn menu báo sự kiện qua noteEvent; hai bảng nghe sự kiện 'tasks' để vẽ lại chấm số trên nút.
// getDaily: null = chưa mở (chưa qua FTUE). Sang ngày thì tự ra bộ nhiệm vụ mới theo tình trạng hiện tại.
export function getDaily(now = Date.now()) {
  const unlocked = unlockedCount(loadProgress());
  if (!dailyOpen(unlocked)) return null;
  const saved = loadDaily();
  const daily = rollDaily(saved, { unlocked, boosters: boostersUnlocked(unlocked - 1), idle: idleOpen(levelsCleared(loadProgress())), base: baseLeft(deco) }, now);
  if (daily !== saved) saveDaily(daily);
  return daily;
}
export function setDaily(daily) { saveDaily(daily); dispatchEvent(new Event('tasks')); }
// Trạng thái game mà nhiệm vụ tiến trình đo (màn đã thắng, khu kế tiếp, số chỗ / mèo / kiểu đồ còn lại).
export function questCtx() {
  const progress = loadProgress(), area = nextArea(deco);
  return { unlocked: unlockedCount(progress), cleared: levelsCleared(progress), maxLevel: LEVELS.length, nextArea: area, areaName: area && AREA_NAMES[area],
    open: ['garden', ...AREA_ORDER].filter(id => areaOpen(deco, id)), basesLeft: basesLeft(deco), petsLeft: petsLeft(deco), stylesLeft: stylesLeft(deco) };
}
// null = chưa mở. Mỗi lần đọc đều đo lại tiến độ + lấp đủ nhiệm vụ.
export function getQuests() {
  const ctx = questCtx();
  if (!questsOpen(ctx.unlocked)) return null;
  const saved = loadQuests(), quests = fillQuests(saved, ctx);
  if (quests !== saved) saveQuests(quests);
  return quests;
}
export function setQuests(quests) { saveQuests(quests); dispatchEvent(new Event('tasks')); }
export function noteEvent(event, n = 1) {
  if (n <= 0) return;
  const daily = getDaily(), quests = getQuests();
  if (quests) { const next = noteQuests(quests, event, n); if (next !== quests) setQuests(next); }
  if (!daily) return;
  const result = countDaily(daily, event, n);
  if (result.daily === daily) return;
  setDaily(result.daily);
  if (result.done.length) showToast(`Daily task done: ${result.done[0].text}!`);
}
