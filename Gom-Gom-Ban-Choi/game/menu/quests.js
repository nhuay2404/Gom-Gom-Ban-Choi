// Bảng nhiệm vụ tiến trình (nút Quests ở Home + ở Deco): các mốc tiến trình, nhận thưởng xong thì nhiệm vụ mới đẻ ra ngay; hết nội dung thì báo đã xong.
// Logic ở core/quests.mjs, đếm sự kiện qua shared.js noteEvent. Dùng chung khung + hàng nhiệm vụ với bảng Daily (home.css .daily-*).
import { QUESTS } from '../data/economy.mjs';
import { claimQuest, questDone, questsClaimable } from '../core/quests.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, getQuests, setQuests, questCtx } from '../app/shared.js';
import { coin } from './deco-panel.js';

const fmt = n => n.toLocaleString('en-US');
const BUTTONS = ['home-quests', 'deco-quests'];

// Chấm số trên hai nút Quests = số nhiệm vụ đang chờ nhận.
export function renderQuestButtons() {
  const quests = getQuests(), count = quests ? questsClaimable(quests) : 0;
  for (const id of BUTTONS) {
    $(id).dataset.badge = count || '';
    $(id).setAttribute('aria-label', quests ? `Quests${count ? ` (${count} ready)` : ''}` : `Quests (open at level ${QUESTS.fromLevel})`);
  }
}
addEventListener('tasks', renderQuestButtons);

function questRow(q, index) {
  const done = questDone(q), pct = Math.round(q.progress / q.n * 100);
  return `<li class="daily-task${done ? ' done' : ''}">
    <b class="daily-text">${q.text}</b>
    <span class="daily-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.n}" aria-valuenow="${q.progress}"><i style="width:${pct}%"></i><em>${fmt(q.progress)}/${fmt(q.n)}</em></span>
    <button class="pill-button daily-claim" data-claim="${index}"${done ? '' : ' disabled'}>${coin(fmt(q.reward))}</button></li>`;
}

let dialog = null;
function renderPanel() {
  const quests = getQuests();
  if (!dialog || !quests) return;
  dialog.querySelector('.daily-body').innerHTML = quests.active.length ? `<ul class="daily-list">${quests.active.map(questRow).join('')}</ul>`
    : '<p class="quests-empty">All quests done! New ones arrive with new levels and areas.</p>';
}

function onClaim(event) {
  const button = event.target.closest('.daily-claim');
  if (!button || button.disabled) return;
  const got = claimQuest(getQuests(), Number(button.dataset.claim), questCtx());
  if (got.error) return showToast(got.error);
  setQuests(got.quests);
  setDeco({ ...getDeco(), coins: getDeco().coins + got.coins });
  refreshWallet();
  showToast(`+${fmt(got.coins)} coins! New quest added.`);
  playSound('reward');
  renderPanel();
}

export function openQuests() {
  if (!getQuests()) { showToast(`Quests open at level ${QUESTS.fromLevel}. Keep playing!`); return; }
  playSound('pick');
  const box = document.createElement('dialog');
  box.className = 'level-dialog store-dialog daily-dialog quests-dialog';
  box.setAttribute('aria-labelledby', 'quests-title');
  box.innerHTML = `<h2 id="quests-title">Quests</h2><p class="daily-reset">Finish one and a new quest appears</p><div class="daily-body"></div>
    <div class="store-choices"><button class="pill-button ghost" data-close>Close</button></div>`;
  box.addEventListener('click', event => { if (event.target.closest('[data-close]')) box.close(); else onClaim(event); });
  // Biến riêng của hộp này: sự kiện close tới trễ không được xoá hộp mới mở lại ngay sau đó.
  box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
  document.body.append(box);
  dialog = box;
  renderPanel();
  box.showModal();
}

for (const id of BUTTONS) $(id).onclick = openQuests;
