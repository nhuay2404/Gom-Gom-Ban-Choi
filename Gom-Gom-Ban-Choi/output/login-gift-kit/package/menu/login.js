// Quà đăng nhập 7 ngày (nút "7-Day Gift" ở Home): dạng lịch, không streak. Logic chọn ô ở core/login.mjs, số quà ở economy.mjs
// (LOGIN_CALENDAR, LOGIN_CATS). Popup tự bật tối đa một lần mỗi ngày khi về Home mà còn quà chưa nhận. Nhận đủ 7 ô thì nút ẩn.
import { LOGIN_CALENDAR, LOGIN_CATS, LOGIN_FROM_LEVEL } from '../data/economy.mjs';
import { loadProgress, levelsCleared } from '../core/progression.mjs';
import * as ob from '../app/onboarding.js';
import { loadLogin, saveLogin, claimLogin, canClaimLogin, loginDone, loginCoins } from '../core/login.mjs';
import { dayKey } from '../core/gems.mjs';
import { CATALOG, itemById, giftItem, claimCat } from '../deco/deco-data.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, getBoosters, storeBoosters, BOOSTER_NAMES, gemTag } from '../app/shared.js';
import { grantGems } from '../app/store.js';
import { loginShell, loginGrid } from './login-view.mjs';

const fmt = n => n.toLocaleString('en-US');
// Ảnh thưởng 3D theo đúng thứ tự LOGIN_CALENDAR, dựa trên booster và vật phẩm gốc trong game.
const REWARD_ART = Array.from({ length: LOGIN_CALENDAR.length }, (_, i) => i === 2 ? './assets/img/login-gift/heart-cushion.jpg' : `./assets/img/login-gift/reward-day${i + 1}.png`);
// Mèo quà: breed có trong danh mục mèo = mèo thật, nhận được ngay; chưa có = "mèo chờ".
const realBreed = id => { const breed = LOGIN_CATS[id]?.breed; return breed && CATALOG.some(entry => entry.cat === 'cats' && entry.breed === breed) ? breed : null; };

// Nội dung một ô: biểu tượng (HTML) + dòng chữ.
function cellArt(cell, index) {
  const art = REWARD_ART[index] ?? REWARD_ART[0];
  if (cell.booster) return { art, premium: true, text: `${BOOSTER_NAMES[cell.booster]}${cell.n > 1 ? ` ×${cell.n}` : ''}` };
  if (cell.coins) return { art, text: fmt(loginCoins(cell)) };
  if (cell.item) return { art, gem: Boolean(cell.gems), text: `<span class="login-item-name">${itemById(cell.item)?.name ?? 'Gift'}</span>${cell.gems ? `<span class="login-gems">+ ${gemTag(cell.gems)}</span>` : ''}`, exclusive: true };
  if (cell.cat) return { art, text: LOGIN_CATS[cell.cat]?.name ?? 'New cat' };
  return { icon, text: '' };
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
const grid = () => dialog.querySelector('.login-grid');
const pageNow = () => Math.round(grid().scrollLeft / grid().clientWidth);
function goPage(i, smooth = true) {
  const last = LOGIN_CALENDAR.length - 1, page = Math.max(0, Math.min(last, i));
  grid().scrollTo({ left: page * grid().clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  syncPage(page);
}
// Chấm trang + mũi tên theo trang đang xem.
function syncPage(page = pageNow()) {
  const state = loadLogin();
  dialog.style.setProperty('--login-art', `url("${new URL(REWARD_ART[page] ?? REWARD_ART[0], document.baseURI).href}")`);
  dialog.dataset.reward = LOGIN_CALENDAR[page]?.booster ? 'booster' : LOGIN_CALENDAR[page]?.item ? 'item' : 'gift';
  dialog.querySelector('.login-dots').innerHTML = LOGIN_CALENDAR.map((_, i) => `<i class="${i === page ? 'on' : ''}${i < state.claimed ? ' got' : ''}"></i>`).join('');
  dialog.querySelector('.login-nav.prev').disabled = page <= 0;
  dialog.querySelector('.login-nav.next').disabled = page >= LOGIN_CALENDAR.length - 1;
}

// page: trang mở ra (mặc định: ô hôm nay / ô kế tiếp chưa nhận).
function renderPanel(page) {
  if (!dialog) return;
  const state = loadLogin(), today = canClaimLogin(state, Date.now());
  dialog.querySelector('.login-grid').innerHTML = loginGrid(LOGIN_CALENDAR, state, today, cellArt);
  goPage(page ?? state.claimed, false);
  dialog.querySelector('[data-claim]').hidden = !today;
  dialog.querySelector('[data-claim]').textContent = 'Claim';
  dialog.querySelector('.login-note').textContent = today ? 'A gift is waiting for you!' : loginDone(state) ? 'All 7 gifts collected!' : 'Come back tomorrow for the next gift. No rush: gifts never expire.';
}

function claimToday() {
  const got = claimLogin(loadLogin(), Date.now());
  if (got.error) return showToast(got.error);
  saveLogin(got.state);
  const note = grantCell(LOGIN_CALENDAR[got.index], got.index);
  refreshWallet();
  playSound('reward');
  showToast(`Day ${got.index + 1} gift: ${note}!`);
  // Nhận xong: đứng ở ô vừa nhận rồi lướt sang quà ngày mai.
  renderPanel(got.index);
  setTimeout(() => dialog && goPage(got.index + 1), 650);
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
  box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
  document.body.append(box);
  dialog = box;
  box.showModal();
  // Đo bề ngang trang sau khi popup đã hiện (trước đó clientWidth = 0).
  renderPanel();
  grid().addEventListener('scroll', () => syncPage(), { passive: true });
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
