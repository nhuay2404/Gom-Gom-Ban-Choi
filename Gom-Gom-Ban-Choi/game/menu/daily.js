// Bảng nhiệm vụ ngày (nút Daily ở Home): vài nhiệm vụ nhẹ, mỗi nhiệm vụ thưởng xu (không rương, không booster).
// Logic ở core/daily.mjs, đếm sự kiện qua shared.js noteEvent. Sang Unity: DailyPanel.
import { DAILY } from '../data/economy.mjs';
import { claimMission, missionDone, claimable } from '../core/daily.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, getDaily, setDaily } from '../app/shared.js';
import { goToTask } from './task-nav.js';
import { flyReward } from './reward-fly.js';
import { liftWallet } from './wallet-lift.js';

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

// Cùng bộ thẻ với bảng Quests (ui/home/quests.css): icon | chữ + thanh tiến độ | nút xu. Đã nhận: dấu tích trên icon, nút mờ.
const art = './assets/img/quests/';
function missionRow(m, index) {
  const done = missionDone(m), pct = Math.round(m.progress / m.n * 100), ready = done && !m.claimed;
  // Chưa xong: chạm thẻ = đi tới chỗ làm (task-nav.js).
  const go = !done && !m.claimed;
  return `<li class="quest-card${ready ? ' is-ready' : ''}${m.claimed ? ' claimed' : ''}"${go ? ` data-go="${index}" role="button" tabindex="0"` : ''}>
    <div class="quest-icon"><img src="./assets/img/home/icon-daily-matte.png" alt="">${m.claimed ? `<img class="quest-check" src="${art}check.png" alt="">` : ''}</div>
    <div class="quest-info"><span class="quest-category">Daily${m.claimed ? ' · Claimed' : ready ? ' · Complete!' : '<span class="quest-go">Go ›</span>'}</span><b class="quest-text">${m.text}</b>
    <span class="quest-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${m.n}" aria-valuenow="${m.progress}"><i style="width:${pct}%"></i><em>${fmt(m.progress)} / ${fmt(m.n)}</em></span></div>
    <button class="quest-claim daily-claim" data-claim="${index}" aria-label="${m.claimed ? 'Claimed' : ready ? 'Claim' : 'Reward'} ${fmt(m.reward)} coins: ${m.text}"${ready ? '' : ' disabled'}><strong><img src="${art}icon-coin.png" alt="">${fmt(m.reward)}</strong></button></li>`;
}

let dialog = null;
function renderPanel() {
  const daily = getDaily();
  if (!dialog || !daily) return;
  dialog.querySelector('.daily-body').innerHTML = `<ul class="quest-list">${daily.missions.map(missionRow).join('')}</ul>`;
  dialog.querySelector('.daily-reset').textContent = `New tasks in ${untilReset()}`;
}

function onClaim(event) {
  const button = event.target.closest('.daily-claim');
  if (!button || button.disabled) return;
  const from = button.getBoundingClientRect(), got = claimMission(getDaily(), Number(button.dataset.claim));
  if (got.error) return showToast(got.error);
  setDaily(got.daily);
  setDeco({ ...getDeco(), coins: getDeco().coins + got.coins });
  flyReward(from, { coins: got.coins }).then(refreshWallet);
  showToast(`+${fmt(got.coins)} coins!`);
  playSound('reward');
  renderPanel();
}

export function openDaily() {
  if (!getDaily()) { showToast(`Daily tasks open at level ${DAILY.fromLevel}. Keep playing!`); return; }
  playSound('pick');
  const box = document.createElement('dialog');
  box.className = 'quests-dialog daily-dialog';
  box.setAttribute('aria-labelledby', 'daily-title');
  box.innerHTML = `<header class="quest-header"><img class="quest-emblem" src="./assets/img/home/icon-daily-matte.png" alt=""><h2 id="daily-title">Daily</h2><button class="quest-close" data-close aria-label="Close daily tasks" autofocus></button></header><p class="daily-reset"></p><div class="daily-body"></div>`;
  box.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) return box.close();
    if (event.target.closest('.daily-claim')) return onClaim(event);
    const card = event.target.closest('[data-go]');
    if (card) goMission(box, Number(card.dataset.go));
  });
  box.addEventListener('keydown', event => { const card = event.target.closest('[data-go]'); if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); goMission(box, Number(card.dataset.go)); } });
  // Biến riêng của hộp này: sự kiện close tới trễ không được xoá hộp mới mở lại ngay sau đó.
  let dropWallet = () => {};
  box.addEventListener('close', () => { dropWallet(); box.remove(); if (dialog === box) dialog = null; });
  document.body.append(box);
  dialog = box;
  renderPanel();
  box.showModal();
  // Ví nằm trên lớp mờ của bảng (không bị làm mờ), xu / gem nhận được bay vào đó.
  dropWallet = liftWallet();
}

// Chạm nhiệm vụ chưa xong: đóng bảng, đưa tới chỗ làm (task-nav.js), khoá = sự kiện của nhiệm vụ.
function goMission(box, index) {
  const mission = getDaily()?.missions[index];
  if (!mission) return;
  playSound('pick');
  box.close();
  goToTask(mission.event);
}

$('home-daily').onclick = openDaily;
