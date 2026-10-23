// Bảng nhiệm vụ ngày (nút Daily ở Home): vài nhiệm vụ nhẹ, mỗi nhiệm vụ thưởng xu (không rương, không booster).
// Logic ở core/daily.mjs, đếm sự kiện qua shared.js noteEvent. Sang Unity: DailyPanel.
import { DAILY } from '../data/economy.mjs';
import { claimMission, missionDone, claimable } from '../core/daily.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, getDaily, setDaily } from '../app/shared.js';
import { coin } from './deco-panel.js';

const fmt = n => n.toLocaleString('en-US');

// Chấm số trên nút Daily = số nhiệm vụ đang chờ nhận.
export function renderDailyButton() {
  const button = $('home-daily'), daily = getDaily(), count = daily ? claimable(daily) : 0;
  button.dataset.badge = count || '';
  button.setAttribute('aria-label', daily ? `Daily tasks${count ? ` (${count} ready)` : ''}` : `Daily tasks (open at level ${DAILY.fromLevel})`);
}
addEventListener('tasks', renderDailyButton);

// Giờ còn lại tới 0h (bộ nhiệm vụ mới).
function untilReset() {
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), mins = Math.ceil((next - now) / 6e4);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function missionRow(m, index) {
  const done = missionDone(m), pct = Math.round(m.progress / m.n * 100);
  const action = m.claimed ? '<span class="daily-done" aria-label="Claimed">✓</span>'
    : `<button class="pill-button daily-claim" data-claim="${index}"${done ? '' : ' disabled'}>${coin(fmt(m.reward))}</button>`;
  return `<li class="daily-task${done ? ' done' : ''}${m.claimed ? ' claimed' : ''}">
    <b class="daily-text">${m.text}</b>
    <span class="daily-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${m.n}" aria-valuenow="${m.progress}"><i style="width:${pct}%"></i><em>${fmt(m.progress)}/${fmt(m.n)}</em></span>
    ${action}</li>`;
}

let dialog = null;
function renderPanel() {
  const daily = getDaily();
  if (!dialog || !daily) return;
  dialog.querySelector('.daily-body').innerHTML = `<ul class="daily-list">${daily.missions.map(missionRow).join('')}</ul>`;
  dialog.querySelector('.daily-reset').textContent = `New tasks in ${untilReset()}`;
}

function onClaim(event) {
  const button = event.target.closest('.daily-claim');
  if (!button || button.disabled) return;
  const got = claimMission(getDaily(), Number(button.dataset.claim));
  if (got.error) return showToast(got.error);
  setDaily(got.daily);
  setDeco({ ...getDeco(), coins: getDeco().coins + got.coins });
  refreshWallet();
  showToast(`+${fmt(got.coins)} coins!`);
  playSound('reward');
  renderPanel();
}

export function openDaily() {
  if (!getDaily()) { showToast(`Daily tasks open at level ${DAILY.fromLevel}. Keep playing!`); return; }
  playSound('pick');
  const box = document.createElement('dialog');
  box.className = 'level-dialog store-dialog daily-dialog';
  box.setAttribute('aria-labelledby', 'daily-title');
  box.innerHTML = `<h2 id="daily-title">Daily tasks</h2><p class="daily-reset"></p><div class="daily-body"></div>
    <div class="store-choices"><button class="pill-button ghost" data-close>Close</button></div>`;
  box.addEventListener('click', event => { if (event.target.closest('[data-close]')) box.close(); else onClaim(event); });
  // Biến riêng của hộp này: sự kiện close tới trễ không được xoá hộp mới mở lại ngay sau đó.
  box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
  document.body.append(box);
  dialog = box;
  renderPanel();
  box.showModal();
}

$('home-daily').onclick = openDaily;
