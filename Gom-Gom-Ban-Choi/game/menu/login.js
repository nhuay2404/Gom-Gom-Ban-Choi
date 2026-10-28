// Quà đăng nhập 7 ngày (nút "7-Day Gift" ở Home): dạng lịch, không streak. Logic chọn ô ở core/login.mjs, số quà ở economy.mjs
// (LOGIN_CALENDAR, LOGIN_CATS). Popup tự bật tối đa một lần mỗi ngày khi về Home mà còn quà chưa nhận. Nhận đủ 7 ô thì nút ẩn.
import { LOGIN_CALENDAR, LOGIN_CATS, LOGIN_FROM_LEVEL } from '../data/economy.mjs';
import { loadProgress, levelsCleared } from '../core/progression.mjs';
import * as ob from '../app/onboarding.js';
import { loadLogin, saveLogin, claimLogin, canClaimLogin, loginDone, loginCoins } from '../core/login.mjs';
import { dayKey } from '../core/gems.mjs';
import { CATALOG, itemById, giftItem, claimCat } from '../deco/deco-data.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, getBoosters, storeBoosters, BOOSTER_NAMES, reduceMotion } from '../app/shared.js';
import { grantGems } from '../app/store.js';
import { loginShell, loginGrid } from './login-view.mjs';
import { decoThumbnail, decoSpinner } from './room.js';
import { flyReward, flyArt } from './reward-fly.js';
import { liftWallet } from './wallet-lift.js';

const fmt = n => n.toLocaleString('en-US');
// Ảnh thưởng 3D theo đúng thứ tự LOGIN_CALENDAR, dựa trên booster và vật phẩm gốc trong game.
const REWARD_ART = Array.from({ length: LOGIN_CALENDAR.length }, (_, i) => i === 2 ? './assets/img/login-gift/heart-cushion.jpg' : `./assets/img/login-gift/reward-day${i + 1}.png`);
// Ảnh quà chụp từ model 3D toon (deco-room.mjs rewardModel; món deco dùng đúng model trong phòng). Chưa nạp Three.js / không WebGL thì dùng ảnh PNG cũ.
const rewardKind = cell => cell.booster ?? (cell.coins ? (cell.coins >= 2000 ? 'coins' : 'coin') : cell.item ? 'item' : 'gift');
const rewardEntry = index => { const cell = LOGIN_CALENDAR[index] ?? LOGIN_CALENDAR[0]; return { id: `login-reward-${index}`, reward: rewardKind(cell), item: cell.item }; };
const rewardArt = index => {
  const cell = LOGIN_CALENDAR[index] ?? LOGIN_CALENDAR[0];
  return decoThumbnail?.(rewardEntry(index), 360)
    ?? (cell.booster ? `./assets/img/play/booster-${cell.booster}.png` : REWARD_ART[index] ?? REWARD_ART[0]);
};
// Mèo quà: breed có trong danh mục mèo = mèo thật, nhận được ngay; chưa có = "mèo chờ".
const realBreed = id => { const breed = LOGIN_CATS[id]?.breed; return breed && CATALOG.some(entry => entry.cat === 'cats' && entry.breed === breed) ? breed : null; };

// Nội dung một ô: biểu tượng (HTML) + dòng chữ.
function cellArt(cell, index) {
  const art = rewardArt(index);
  if (cell.booster) return { art, text: `${BOOSTER_NAMES[cell.booster]} Booster${cell.n > 1 ? ` ×${cell.n}` : ''}` };
  // Núi xu (rewardKind 'coins'): thêm tia sáng + lấp lánh nhẹ (login-gift.css .gold).
  if (cell.coins) return { art, fx: rewardKind(cell) === 'coins' ? 'gold' : '', text: `${fmt(loginCoins(cell))} gold` };
  if (cell.item) return { art, gems: cell.gems, text: `<span class="login-item-name">${itemById(cell.item)?.name ?? 'Gift'} Furniture</span>` };
  if (cell.cat) return { art, text: LOGIN_CATS[cell.cat]?.name ?? 'New cat' };
  return { icon: '🎁', text: '' };
}

// Trao quà của một ô; trả về dòng báo.
function grantCell(cell, index) {
  if (cell.booster) {
    storeBoosters({ ...getBoosters(), [cell.booster]: getBoosters()[cell.booster] + (cell.n ?? 1) });
    return `${BOOSTER_NAMES[cell.booster]} booster${(cell.n ?? 1) > 1 ? ` ×${cell.n}` : ''}`;
  }
  if (cell.coins) {
    const coins = loginCoins(cell);
    setDeco({ ...getDeco(), coins: getDeco().coins + coins });
    return `+${fmt(coins)} coins`;
  }
  const notes = [];
  if (cell.item) {
    const entry = itemById(cell.item), next = entry && giftItem(getDeco(), entry);
    // Đã có món (mua trước khi món thành quà độc quyền): đổi ra xu bằng giá món.
    if (next) { setDeco(next); notes.push(`${entry.name}! Find it in Deco`); }
    else if (entry) { setDeco({ ...getDeco(), coins: getDeco().coins + entry.price }); notes.push(`Already yours! +${fmt(entry.price)} coins`); }
  }
  if (cell.gems) { const gems = grantGems(`login:${index + 1}`, cell.gems); if (gems) notes.push(`+${gems} gems`); }
  if (cell.cat) {
    const breed = realBreed(cell.cat);
    if (breed) setDeco(claimCat(getDeco(), breed));
    else saveLogin({ ...loadLogin(), pendingCats: [...loadLogin().pendingCats, cell.cat] });
    notes.push(`${LOGIN_CATS[cell.cat]?.name ?? 'A new cat'} is coming home`);
  }
  return notes.join(' · ');
}

// Mèo chờ đã có mèo thật (data vừa điền breed): đưa vào nhà, gỡ khỏi danh sách chờ.
function settlePendingCats() {
  const state = loadLogin(), ready = state.pendingCats.filter(realBreed);
  if (!ready.length) return;
  ready.forEach(id => setDeco(claimCat(getDeco(), realBreed(id))));
  saveLogin({ ...state, pendingCats: state.pendingCats.filter(id => !realBreed(id)) });
}

// Mở quà đăng nhập: xong hướng dẫn tân thủ + đã thắng tới màn LOGIN_FROM_LEVEL. Trước đó nút ẩn, popup không tự bật.
const loginOpen = () => !ob.active() && levelsCleared(loadProgress()) >= LOGIN_FROM_LEVEL;

export function renderLoginButton() {
  const state = loadLogin(), button = $('home-login');
  button.hidden = !loginOpen() || loginDone(state);
  button.dataset.badge = canClaimLogin(state, Date.now()) ? '!' : '';
}

let dialog = null;
// Popup dạng lật trang: mỗi trang (ô) là quà của một ngày, vuốt ngang / mũi tên để sang ngày khác (cuộn có điểm dừng, login-gift.css).
// Quà đã nhận không hiện nữa: trang đầu là ô `first` của lịch (ô chưa nhận đầu tiên; nhận đủ 7 thì chỉ còn ô cuối).
// page trong các hàm dưới = chỉ số ô trong LOGIN_CALENDAR.
let first = 0;
const grid = () => dialog.querySelector('.login-grid');
const pageNow = () => first + Math.round(grid().scrollLeft / grid().clientWidth);
function goPage(i, smooth = true) {
  const last = LOGIN_CALENDAR.length - 1, page = Math.max(first, Math.min(last, i));
  grid().scrollTo({ left: (page - first) * grid().clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  syncPage(page);
  if (!smooth) spinPage(page);
}
// Chấm trang + mũi tên theo trang đang xem (chỉ viết lại khi đổi trang: hàm này chạy theo từng sự kiện cuộn).
let shown = -1;
function syncPage(page = pageNow()) {
  if (page === shown) return;
  shown = page;
  dialog.dataset.reward = LOGIN_CALENDAR[page]?.booster ? 'booster' : LOGIN_CALENDAR[page]?.item ? 'item' : 'gift';
  dialog.querySelector('.login-nav.prev').disabled = page <= first;
  dialog.querySelector('.login-nav.next').disabled = page >= LOGIN_CALENDAR.length - 1;
}

// Quà của trang đang xem là model 3D thật lắc qua lắc lại nhẹ quanh trục đứng (±SWAY rad, không quay vòng): canvas chung của
// deco-room.mjs thumbSpinner gắn vào trang đó, vẽ ~30 lần / giây. Trang khác giữ ảnh tĩnh. Chưa có 3D / giảm chuyển động: ảnh tĩnh.
// Chống giật khi lật trang: model dựng một lần mỗi ô rồi giữ tới khi đóng popup (dựng sẵn lúc rảnh); đang cuộn thì không vẽ,
// cuộn xong (SETTLE_MS không có sự kiện cuộn) mới gắn model của trang mới.
const SWAY = .35, SWAY_MS = 3200, SPIN_SIZE = 360, SETTLE_MS = 120;
const models = new Map();
let spin = null, settle = 0, prebuild = 0, scrolling = false;
const modelOf = page => {
  if (!models.has(page)) models.set(page, decoSpinner?.(rewardEntry(page), SPIN_SIZE) ?? null);
  return models.get(page);
};
function stopSpin() {
  if (!spin) return;
  cancelAnimationFrame(spin.raf); spin.model.canvas.remove();
  spin.img.style.visibility = '';
  spin = null;
}
function spinPage(page) {
  if (spin?.page === page && spin.model.canvas.isConnected) return;
  stopSpin();
  const img = dialog?.querySelectorAll('.login-cell')[page - first]?.querySelector('.login-icon>img');
  if (!img || reduceMotion.matches) return;
  const model = modelOf(page);
  if (!model) return;
  model.canvas.className = 'login-spin';
  img.after(model.canvas);
  model.draw(0);
  img.style.visibility = 'hidden';
  // Lắc bắt đầu từ góc 0 (đúng góc ảnh tĩnh) và biên độ tăng dần trong lượt đầu: đổi ảnh tĩnh -> model không nhảy góc.
  spin = { page, model, img, raf: 0, last: 0, start: performance.now() };
  const tick = t => {
    if (spin?.model !== model) return;
    spin.raf = requestAnimationFrame(tick);
    if (t - spin.last < 33) return;
    spin.last = t;
    const age = Math.max(0, t - spin.start), ease = Math.min(1, age / SWAY_MS);
    model.draw(spin.yaw = Math.sin(age / SWAY_MS * Math.PI * 2) * SWAY * ease * ease * (3 - 2 * ease));
  };
  spin.raf = requestAnimationFrame(tick);
}
// Chấm trang chạy theo vị trí cuộn (ngón tay kéo tới đâu chấm dài ra tới đó), không nhảy cóc giữa hai trang.
function paintDots() {
  const pos = grid().scrollLeft / grid().clientWidth;
  dialog.querySelectorAll('.login-dots i').forEach((dot, i) => {
    const k = Math.max(0, 1 - Math.abs(pos - i));
    dot.style.width = `${8 + 12 * k}px`;
    dot.classList.toggle('on', k > .5);
  });
}
function onScroll() {
  syncPage();
  paintDots();
  clearTimeout(settle);
  scrolling = true;
  if (spin) cancelAnimationFrame(spin.raf);
  settle = setTimeout(() => { scrolling = false; if (!dialog) return; if (spin) spin.page = -1; spinPage(pageNow()); }, SETTLE_MS);
}
// Dựng sẵn model các ô còn lại, mỗi lần rảnh một ô (lật tới là có ngay, không khựng). Đang cuộn thì chờ (núi xu dựng mất ~150 ms).
function prebuildModels() {
  const next = LOGIN_CALENDAR.findIndex((_, i) => i >= first && !models.has(i));
  if (!dialog || next < 0) return;
  // Vẽ thử một lần (đẩy lưới + texture lên GPU sẵn) rồi vẽ lại model đang hiện trong cùng tác vụ: canvas chỉ hiện lần vẽ sau.
  if (!scrolling) { modelOf(next)?.draw(0); spin?.model.draw(spin.yaw ?? 0); }
  prebuild = (window.requestIdleCallback ?? (f => setTimeout(f, 50)))(prebuildModels);
}
function dropModels() {
  stopSpin(); clearTimeout(settle); (window.cancelIdleCallback ?? clearTimeout)(prebuild);
  models.forEach(model => model?.dispose());
  models.clear();
}

// page: trang mở ra (mặc định: ô hôm nay / ô kế tiếp chưa nhận). from: ô đầu hiện (mặc định ô chưa nhận đầu tiên).
function renderPanel(page, from) {
  if (!dialog) return;
  const state = loadLogin(), today = canClaimLogin(state, Date.now());
  first = from ?? Math.min(state.claimed, LOGIN_CALENDAR.length - 1);
  stopSpin(); shown = -1;
  dialog.querySelector('.login-dots').innerHTML = '<i></i>'.repeat(LOGIN_CALENDAR.length - first);
  dialog.querySelector('.login-grid').innerHTML = loginGrid(LOGIN_CALENDAR, state, today, cellArt, first);
  goPage(page ?? state.claimed, false);
  paintDots();
  dialog.querySelector('[data-claim]').hidden = !today;
  dialog.querySelector('[data-claim]').textContent = 'Claim';
  // Không dòng nhắc: nhãn Day X đứng ở chỗ đó (login-gift.css), có Claim hay không đã đủ nói.
  dialog.querySelector('.login-note').hidden = true;
}

// Quà vừa nhận bay vào chỗ của nó: booster -> nút Play, xu / gem -> ví, món deco / mèo -> tab Deco.
// from / src đo TRƯỚC khi vẽ lại bảng (ảnh của trang đang xem, model 3D đang lắc thì đo canvas).
function flyCell(cell, from, src) {
  const wallet = flyReward(from, { coins: cell.coins ? loginCoins(cell) : 0, gems: cell.gems ?? 0 });
  const target = cell.booster ? $('home-play') : (cell.item || cell.cat) ? $('tabbar').querySelector('[data-tab="deco"]') : null;
  return Promise.all([wallet, target && flyArt(from, src, target)]);
}

function claimToday() {
  const got = claimLogin(loadLogin(), Date.now());
  if (got.error) return showToast(got.error);
  saveLogin(got.state);
  const cell = LOGIN_CALENDAR[got.index], img = dialog?.querySelectorAll('.login-cell')[got.index - first]?.querySelector('.login-icon>img');
  const from = (spin?.page === got.index ? spin.model.canvas : img)?.getBoundingClientRect(), before = { ...getDeco() };
  const note = grantCell(cell, got.index);
  // Ví giữ số cũ tới khi xu / gem bay tới.
  if (from?.width && !reduceMotion.matches) { $('map-coins').textContent = fmt(before.coins); flyCell(cell, from, img?.src).then(refreshWallet); }
  else refreshWallet();
  playSound('reward');
  showToast(`Day ${got.index + 1} gift: ${note}!`);
  // Nhận xong: ô vừa nhận hiện dấu tích một lúc rồi biến mất, quà ngày mai thành trang đầu.
  renderPanel(got.index, got.index);
  setTimeout(() => dialog && renderPanel(), 800);
  renderLoginButton();
  dialog?.querySelector('.login-close').focus();
}

export function openLogin() {
  if (dialog?.open) return;
  const box = document.createElement('dialog');
  box.className = 'level-dialog store-dialog login-dialog';
  box.setAttribute('aria-labelledby', 'login-title');
  box.innerHTML = loginShell();
  box.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) box.close();
    else if (event.target.closest('[data-claim]')) claimToday();
    else if (event.target.closest('[data-nav]')) goPage(pageNow() + Number(event.target.closest('[data-nav]').dataset.nav));
  });
  // Biến riêng của hộp này: sự kiện close tới trễ không được xoá hộp mới mở lại ngay sau đó.
  box.addEventListener('close', () => { if (dialog === box) { dropModels(); dialog = null; } dropWallet(); box.remove(); });
  document.body.append(box);
  dialog = box;
  box.showModal();
  // Ví nằm trên lớp mờ của popup để xu / gem bay vào thấy rõ.
  const dropWallet = liftWallet();
  // Đo bề ngang trang sau khi popup đã hiện (trước đó clientWidth = 0).
  renderPanel();
  grid().addEventListener('scroll', onScroll, { passive: true });
  prebuildModels();
  dragPages(grid());
}

// Kéo bằng chuột (máy tính) để lật trang; cảm ứng đã vuốt được sẵn nhờ cuộn có điểm dừng. Kéo quá DRAG_PAGE px thì sang trang kế,
// ít hơn thì bật về trang cũ. Tắt điểm dừng trong lúc kéo để trang đi theo chuột.
const DRAG_PAGE = 40;
function dragPages(list) {
  let drag = null;
  list.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: list.scrollLeft, page: pageNow(), moved: false };
    list.setPointerCapture(event.pointerId);
  });
  list.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; list.classList.add('dragging'); }
    if (drag.moved) list.scrollLeft = drag.left - dx;
  });
  const end = event => {
    if (!drag) return;
    // Tính theo quãng kéo lúc thả (không dựa vào pointermove: chuột nhanh / máy chậm có thể không có sự kiện di chuột nào ở giữa).
    const dx = event.clientX - drag.x, { page } = drag;
    drag = null;
    if (Math.abs(dx) <= 5) { list.classList.remove('dragging'); return; }
    // Lật trang khi điểm dừng còn tắt; bật lại điểm dừng chỉ sau khi cuộn xong. Bật lại sớm thì trình duyệt bám về trang cũ, đè lệnh lật.
    list.classList.add('dragging');
    goPage(Math.abs(dx) > DRAG_PAGE ? page - Math.sign(dx) : page);
    const done = () => list.classList.remove('dragging');
    list.addEventListener('scrollend', done, { once: true });
    setTimeout(done, 700);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

// Gọi mỗi lần về Home: đưa mèo chờ vào nhà, vẽ nút, tự bật popup một lần mỗi ngày nếu còn quà chưa nhận.
export function showLoginOnHome() {
  settlePendingCats();
  renderLoginButton();
  const state = loadLogin(), now = Date.now();
  if (!loginOpen() || !canClaimLogin(state, now) || state.seenDay === dayKey(now) || document.querySelector('dialog[open]')) return;
  saveLogin({ ...state, seenDay: dayKey(now) });
  openLogin();
}

$('home-login').onclick = () => { playSound('pick'); openLogin(); };
