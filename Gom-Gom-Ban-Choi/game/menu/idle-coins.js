// Xu tự sinh (core/idle.mjs): bong bóng xu trên đầu từng con mèo trong nhà, chạm để nhận. Sang Unity: IdleCoinView.
import { idlePending, idleFull, idleCap, tickIdle, claimIdle } from '../core/idle.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, ask, showToast, getDeco, setDeco, refreshWallet, noteEvent } from '../app/shared.js';
import { showRewarded, adReady } from '../app/ads.js';
import { REWARDED_ADS } from '../data/economy.mjs';
import { levelsCleared } from './context.js';
import { decoLocked, decoPop, renderDeco, refreshDecoDot } from './deco-panel.js';
import { room3d } from './room.js';
import { idleRewardOptions, startIdleMeter } from './idle-reward-view.mjs';

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

// Chấm đỏ ở tab Deco (deco-panel.js refreshDecoDot) khi có con mèo đã tích ≥ 80% trần xu idle: mời người chơi vào nhận.
const DOT_SHARE = .8;
export function idleDot() {
  const deco = getDeco(), cleared = levelsCleared(), cap = idleCap(cleared), now = Date.now();
  return cap > 0 && deco.cats.some(breed => idlePending(deco, cleared, now, breed) >= DOT_SHARE * cap);
}
// Xu idle tăng cả khi đang ở Home / Shop: kiểm lại chấm mỗi 30 giây (menu-controller.js gọi lúc khởi động).
export function startIdleDot() { setInterval(refreshDecoDot, 30000); }

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
// ADS-SDK: chỗ đặt "idle" — trước khi nhận, popup hỏi "Nhận N" hay "▶ Nhận N + REWARDED_ADS.idleBonus × N" (1 lần/ngày, REWARDED_ADS.caps.idle).
let idleAsking = false;
document.addEventListener('click', async event => {
  if (!event.target.closest('.idle-coin[data-breed]') || idleAsking) return;
  const preview = getDeco(), cleared = levelsCleared();
  const pending = preview.cats.reduce((sum, breed) => sum + idlePending(preview, cleared, Date.now(), breed), 0);
  if (!pending) return;
  let bonus = 0;
  if (adReady('idle') && Math.round(pending * REWARDED_ADS.idleBonus)) {
    idleAsking = true;
    const choice = await ask(idleRewardOptions(pending, REWARDED_ADS.idleBonus));
    if (choice === 'ad' && await showRewarded('idle')) bonus = 1;
    idleAsking = false;
    if (!choice) return;
  }
  claimAll(bonus);
});

function claimAll(withBonus) {
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
  const bonus = withBonus ? Math.round(total * withBonus) : 0;
  const before = getDeco().coins;
  setDeco({ ...deco, coins: deco.coins + bonus });
  playSound('reward');
  showToast(`+${total + bonus} coins!`);
  noteEvent('idle');
  renderDeco();
  refreshDecoDot();
  // Xu 3D bay từ từng con mèo vào thanh xu (deco-room.mjs flyCoins); số trên thanh giữ giá trị cũ tới khi xu chạm,
  // dự phòng 2.5 s nếu cảnh 3D không chạy.
  const pill = $('deco-coins').closest('.fh-coins'), box = pill.getBoundingClientRect(), target = { x: box.left + box.width * .22, y: box.top + box.height / 2 };
  $('deco-coins').textContent = before.toLocaleString('en-US');
  // Số xu 3D theo số xu nhận được so với trần tích của một con (idleCap): đầy trần = 12 đồng, ít thì ít, tối thiểu 1.
  const cap = Math.max(1, idleCap(cleared)), coinsFor = amount => Math.max(1, Math.min(12, Math.ceil(amount * (1 + withBonus) / cap * 12)));
  const flights = claimedBreeds.map(([breed, amount]) => room3d?.flyCoins(breed, target, coinsFor(amount), () => {
    pill.classList.remove('coin-hit'); void pill.offsetWidth; pill.classList.add('coin-hit');
    playSound('fill', 5);
  }) ?? Promise.resolve());
  Promise.all(flights).then(refreshWallet);
  setTimeout(refreshWallet, 2500);
}
