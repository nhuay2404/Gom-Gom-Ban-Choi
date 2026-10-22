// Xu tự sinh (core/idle.mjs): bong bóng xu trên đầu từng con mèo trong nhà, chạm để nhận. Sang Unity: IdleCoinView.
import { idlePending, idleFull, idleCap, tickIdle, claimIdle } from '../core/idle.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet } from '../app/shared.js';
import { showRewarded, adReady } from '../app/ads.js';
import { REWARDED_ADS } from '../data/economy.mjs';
import { levelsCleared } from './context.js';
import { decoLocked, decoPop, renderDeco } from './deco-panel.js';
import { room3d } from './room.js';

// ---------- Xu tự sinh (idle, core/idle.mjs): mỗi con mèo trong nhà có bong bóng xu riêng bám trên đầu, chạm để nhận ----------
// Số màn đã thắng đọc một lần mỗi lần vẽ Deco (không đọc save mỗi khung hình).
let idleCleared = 0;

export function startIdle() {
  idleCleared = levelsCleared();
  const deco = getDeco(), next = tickIdle(deco, idleCleared, Date.now());
  if (next !== deco) setDeco(next);
}

// Bong bóng mẫu #idle-coin (index.html) được nhân bản cho từng giống mèo (data-breed), cùng chỗ trong DOM nên dùng chung CSS.
const idleButtons = {};

const idleButton = breed => idleButtons[breed] ||= (() => {
  const button = $('idle-coin').cloneNode(true);
  button.removeAttribute('id');
  button.dataset.breed = breed;
  $('idle-coin').after(button);
  return button;
})();

export function placeIdleCoin() {
  const deco = getDeco(), now = Date.now();
  for (const [breed, button] of Object.entries(idleButtons)) if (!deco.cats.includes(breed)) button.hidden = true;
  for (const breed of deco.cats) {
    const amount = idlePending(deco, idleCleared, now, breed);
    const at = amount > 0 && !decoLocked && !decoPop ? room3d?.screenOfCatHead(breed) : null;
    if (!at && !idleButtons[breed]) continue;
    const button = idleButton(breed);
    button.hidden = !at;
    if (!at) continue;
    if (button.dataset.amount !== String(amount)) {
      button.dataset.amount = amount;
      button.querySelector('b').textContent = amount;
      button.classList.toggle('full', idleFull(deco, idleCleared, now, breed));
    }
    button.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
  }
}

// Chạm bong bóng của BẤT KỲ con nào = nhận xu của TẤT CẢ mèo trong nhà một lượt (mỗi bong bóng đang hiện nổ một đợt xu).
document.addEventListener('click', event => {
  if (!event.target.closest('.idle-coin[data-breed]')) return;
  let deco = getDeco(), total = 0;
  const now = Date.now(), cleared = levelsCleared(), claimedBreeds = [];
  for (const breed of deco.cats) {
    const claimed = claimIdle(deco, cleared, now, breed);
    if (!claimed.amount) continue;
    deco = claimed.deco;
    total += claimed.amount;
    claimedBreeds.push([breed, claimed.amount]);
    const button = idleButtons[breed];
    if (button) button.dataset.amount = '';
  }
  if (!total) return;
  const before = getDeco().coins;
  setDeco(deco);
  playSound('reward');
  showToast(`+${total} coins!`);
  renderDeco();
  // Xu 3D bay từ từng con mèo vào thanh xu (deco-room.mjs flyCoins); số trên thanh giữ giá trị cũ tới khi xu chạm,
  // dự phòng 2.5 s nếu cảnh 3D không chạy.
  const pill = $('deco-coins').closest('.fh-coins'), box = pill.getBoundingClientRect(), target = { x: box.left + box.width * .22, y: box.top + box.height / 2 };
  $('deco-coins').textContent = before.toLocaleString('en-US');
  // Số xu 3D theo số xu nhận được so với trần tích của một con (idleCap): đầy trần = 12 đồng, ít thì ít, tối thiểu 1.
  const cap = Math.max(1, idleCap(cleared)), coinsFor = amount => Math.max(1, Math.min(12, Math.ceil(amount / cap * 12)));
  const flights = claimedBreeds.map(([breed, amount]) => room3d?.flyCoins(breed, target, coinsFor(amount), () => {
    pill.classList.remove('coin-hit'); void pill.offsetWidth; pill.classList.add('coin-hit');
    playSound('fill', 5);
  }) ?? Promise.resolve());
  Promise.all(flights).then(refreshWallet);
  setTimeout(refreshWallet, 2500);
  offerIdleDouble(total);
});

// ADS-SDK: chỗ đặt "idle" — vừa nhận xu idle: nút "▶ +N" hiện vài giây cạnh ví, xem ads nhận thêm REWARDED_ADS.idleBonus × số vừa nhận
// (1 lần/ngày, REWARDED_ADS.caps.idle).
let idleDouble = null;
function offerIdleDouble(total) {
  idleDouble?.remove();
  if (!adReady('idle')) return;
  const bonus = Math.round(total * REWARDED_ADS.idleBonus);
  if (!bonus) return;
  const button = idleDouble = document.createElement('button');
  button.className = 'ad-double idle-double';
  button.innerHTML = `▶ <i class="ico-coin"></i>+${bonus.toLocaleString('en-US')}`;
  const timer = setTimeout(() => button.remove(), 8000);
  button.onclick = async () => {
    clearTimeout(timer);
    button.disabled = true;
    const watched = await showRewarded('idle');
    button.remove();
    if (!watched) return;
    setDeco({ ...getDeco(), coins: getDeco().coins + bonus });
    refreshWallet();
    playSound('reward');
    showToast(`+${bonus} coins!`);
  };
  $('deco').append(button);
}
