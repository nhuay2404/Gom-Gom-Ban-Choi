// Bảng nhiệm vụ tiến trình (nút Quests ở Home + ở Deco): các mốc tiến trình, nhận thưởng xong thì nhiệm vụ mới đẻ ra ngay; hết nội dung thì báo đã xong.
// Logic ở core/quests.mjs; giao diện riêng ở quest-view.mjs và ui/home/quests.css.
import { QUESTS } from '../data/economy.mjs';
import { claimQuest, questsClaimable, questRank } from '../core/quests.mjs';
import { playSound, playMeow } from '../ui/sound.mjs';
import { grantGems } from '../app/store.js';
import { $, showToast, getDeco, setDeco, refreshWallet, getQuests, setQuests, questCtx } from '../app/shared.js';
import { questBody, questShell } from './quest-view.mjs';

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

let dialog = null;
function renderPanel() {
  const quests = getQuests();
  if (!dialog || !quests) return;
  dialog.querySelector('.quest-body').innerHTML = questBody(quests);
  const { rank, title, into, every } = questRank(quests);
  dialog.querySelector('.quest-subtitle').textContent = `Home rank ${rank + 1}: ${title} · ${into}/${every} to next rank`;
  const count = questsClaimable(quests);
  dialog.querySelector('.quest-summary').textContent = count ? `${count} reward${count > 1 ? 's' : ''} ready to collect` : quests.active.length ? `${quests.active.length} quests in progress` : 'All quests complete';
}

function onClaim(event) {
  const button = event.target.closest('.quest-claim');
  if (!button || button.disabled) return;
  const before = questRank(getQuests()).rank, got = claimQuest(getQuests(), Number(button.dataset.claim), questCtx());
  if (got.error) return showToast(got.error);
  setQuests(got.quests);
  setDeco({ ...getDeco(), coins: getDeco().coins + got.coins });
  refreshWallet();
  const { rank, title } = questRank(got.quests);
  // Lên bậc nhà: quà lớn theo mốc (gem, mỗi bậc chỉ một lần).
  const gems = rank > before ? grantGems(`quest-rank:${rank}`, QUESTS.rankGems) : 0;
  showToast(rank > before ? `New home rank: ${title}!${gems ? ` +${gems} gems` : ''}` : `+${fmt(got.coins)} coins!${got.quests.active.length ? ' Your quests are updated.' : ' All quests complete!'}`);
  playSound('reward');
  // Mèo trong nhà vui mừng: hệ quả nghe được ngay khi nhận.
  const cats = getDeco().cats;
  if (cats.length) setTimeout(() => playMeow(cats[Math.floor(Math.random() * cats.length)]), 350);
  renderPanel();
  dialog?.querySelector('.quest-close').focus();
}

export function openQuests() {
  if (dialog?.open) return;
  if (!getQuests()) { showToast(`Quests open at level ${QUESTS.fromLevel}. Keep playing!`); return; }
  playSound('pick');
  const box = document.createElement('dialog');
  box.className = 'quests-dialog';
  box.setAttribute('aria-labelledby', 'quests-title');
  box.innerHTML = questShell();
  box.addEventListener('click', event => { if (event.target.closest('[data-close]')) box.close(); else onClaim(event); });
  // Biến riêng của hộp này: sự kiện close tới trễ không được xoá hộp mới mở lại ngay sau đó.
  box.addEventListener('close', () => { box.remove(); if (dialog === box) dialog = null; });
  document.body.append(box);
  dialog = box;
  renderPanel();
  box.showModal();
}

for (const id of BUTTONS) $(id).onclick = openQuests;
addEventListener('tasks', renderPanel);
