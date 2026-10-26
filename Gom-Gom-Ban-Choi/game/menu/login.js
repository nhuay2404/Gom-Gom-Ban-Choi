// Quà đăng nhập 7 ngày (nút "7-Day Gift" ở Home): dạng lịch, không streak. Logic chọn ô ở core/login.mjs, số quà ở economy.mjs
// (LOGIN_CALENDAR, LOGIN_CATS). Popup tự bật tối đa một lần mỗi ngày khi về Home mà còn quà chưa nhận. Nhận đủ 7 ô thì nút ẩn.
import { LOGIN_CALENDAR, LOGIN_CATS } from '../data/economy.mjs';
import { loadLogin, saveLogin, claimLogin, canClaimLogin, loginDone, loginCoins } from '../core/login.mjs';
import { dayKey } from '../core/gems.mjs';
import { CATALOG, itemById, giftItem, claimCat } from '../deco/deco-data.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, getBoosters, storeBoosters, BOOSTER_NAMES, gemTag } from '../app/shared.js';
import { grantGems } from '../app/store.js';

const fmt = n => n.toLocaleString('en-US');
const ICON = { moves: '➕', hammer: '🔨', swap: '🔄' };
// Mèo quà: breed có trong danh mục mèo = mèo thật, nhận được ngay; chưa có = "mèo chờ".
const realBreed = id => { const breed = LOGIN_CATS[id]?.breed; return breed && CATALOG.some(entry => entry.cat === 'cats' && entry.breed === breed) ? breed : null; };

// Nội dung một ô: biểu tượng (HTML) + dòng chữ.
function cellArt(cell) {
  if (cell.booster) return { icon: ICON[cell.booster] ?? '🎁', text: `${BOOSTER_NAMES[cell.booster]}${cell.n > 1 ? ` ×${cell.n}` : ''}` };
  if (cell.coins) return { icon: '<i class="ico-coin"></i>', text: fmt(loginCoins(cell)) };
  if (cell.item) return { icon: '💗', text: `${itemById(cell.item)?.name ?? 'Gift'}${cell.gems ? ` + ${gemTag(cell.gems)}` : ''}` };
  if (cell.cat) return { icon: '🐱', text: LOGIN_CATS[cell.cat]?.name ?? 'New cat' };
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

export function renderLoginButton() {
  const state = loadLogin(), button = $('home-login');
  button.hidden = loginDone(state);
  button.dataset.badge = canClaimLogin(state, Date.now()) ? '!' : '';
}

let dialog = null;
function renderPanel() {
  if (!dialog) return;
  const state = loadLogin(), today = canClaimLogin(state, Date.now()), last = LOGIN_CALENDAR.length - 1;
  dialog.querySelector('.login-grid').innerHTML = LOGIN_CALENDAR.map((cell, i) => {
    const { icon, text } = cellArt(cell);
    const status = i < state.claimed ? 'claimed' : i === state.claimed ? (today ? 'today' : 'tomorrow') : 'locked';
    const tag = { claimed: '✓', today: 'Today', tomorrow: 'Tomorrow', locked: '' }[status];
    return `<li class="login-cell ${status}${i === last ? ' big' : ''}"><b>Day ${i + 1}</b><span class="login-icon" aria-hidden="true">${icon}</span><small>${text}</small>${tag ? `<em>${tag}</em>` : ''}</li>`;
  }).join('');
  dialog.querySelector('[data-claim]').hidden = !today;
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
  renderPanel();
  renderLoginButton();
}

export function openLogin() {
  if (dialog?.open) return;
  const box = document.createElement('dialog');
  box.className = 'level-dialog store-dialog login-dialog';
  box.setAttribute('aria-labelledby', 'login-title');
  box.innerHTML = `<h2 id="login-title">7-Day Gift</h2><p class="login-note"></p><ol class="login-grid"></ol>
    <div class="store-choices"><button class="pill-button" data-claim>Claim</button><button class="pill-button ghost" data-close>Close</button></div>`;
  box.addEventListener('click', event => { if (event.target.closest('[data-close]')) box.close(); else if (event.target.closest('[data-claim]')) claimToday(); });
  // Biến riêng của hộp này: sự kiện close tới trễ không được xoá hộp mới mở lại ngay sau đó.
  box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
  document.body.append(box);
  dialog = box;
  renderPanel();
  box.showModal();
}

// Gọi mỗi lần về Home: đưa mèo chờ vào nhà, vẽ nút, tự bật popup một lần mỗi ngày nếu còn quà chưa nhận.
export function showLoginOnHome() {
  settlePendingCats();
  renderLoginButton();
  const state = loadLogin(), now = Date.now();
  if (!canClaimLogin(state, now) || state.seenDay === dayKey(now) || document.querySelector('dialog[open]')) return;
  saveLogin({ ...state, seenDay: dayKey(now) });
  openLogin();
}

$('home-login').onclick = () => { playSound('pick'); openLogin(); };
