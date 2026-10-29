// Xu tự sinh (core/idle.mjs): bong bóng xu trên đầu từng con mèo trong nhà, chạm để nhận. Sang Unity: IdleCoinView.
import * as ob from '../app/onboarding.js';
import { idlePending, idleFull, idleCap, tickIdle, claimIdle } from '../core/idle.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, ask, showToast, getDeco, setDeco, getWallet, setWallet, refreshWallet, noteEvent } from '../app/shared.js';
import { adsUsed, noteAd } from '../core/gems.mjs';
import { showRewarded, adReady } from '../app/ads.js';
import { REWARDED_ADS } from '../data/economy.mjs';
import { levelsCleared } from './context.js';
import { decoLocked, decoPop, renderDeco, refreshDecoDot } from './deco-panel.js';
import { room3d } from './room.js';
import { idleRewardOptions } from './idle-reward-view.mjs';

// ---------- Xu tự sinh (idle, core/idle.mjs): mỗi con mèo trong nhà có bong bóng xu riêng bám trên đầu, chạm để nhận ----------
// Số màn đã thắng đọc một lần mỗi lần vẽ Deco (không đọc save mỗi khung hình).
let idleCleared = 0;

export function startIdle() {
  idleCleared = levelsCleared();
  const deco = getDeco(), next = tickIdle(deco, idleCleared, Date.now(), ob.petBoxes()); // con còn trong thùng chưa mở: không tích
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

// ---------- Vòng nhân lúc nhận (REWARDED_ADS.idleWheel): kim chạy qua lại trên nửa vòng tròn, nút xem ads ghi số xu theo ô kim đang chỉ ----------
// Kim chạy đều nên xác suất dừng ở mỗi ô = bề rộng ô (share). Ô lớn nhất (+300%) chỉ trúng jackpotPerDay lần / ngày; trúng rồi thì hiện +50%.
const SWEEP_MS = 900; // một lượt từ trái sang phải
const jackpotLeft = () => adsUsed(getWallet(), 'idleJackpot', Date.now()) < REWARDED_ADS.jackpotPerDay;
function wheelSlots() {
  const top = Math.max(...REWARDED_ADS.idleWheel.map(slot => slot.bonus)), open = jackpotLeft();
  return REWARDED_ADS.idleWheel.map(slot => ({ ...slot, jackpot: slot.bonus === top && open, bonus: slot.bonus === top && !open ? .5 : slot.bonus }));
}
// Nhãn hệ số như art (x1.2 / x1.5 / x4).
const mult = bonus => `x${+(1 + bonus).toFixed(1)}`;
// Mép các ô vẽ sẵn trên art đồng hồ (assets/img/idle-reward/meter-panel.png), đo ngay ngoài đầu kim, độ ngược chiều kim đồng hồ quanh trục kim, trái -> phải.
// Mỗi ô config trải hết ô vẽ của nó: kim chạy nhanh / chậm theo ô để thời gian ở ô = share (giữ xác suất kinh tế) mà kim vẫn chỉ đúng ô vẽ.
// shortcut: art vẽ cứng 5 ô x1.2 / x1.5 / x4 / x1.5 / x1.2, đổi số ô hoặc hệ số idleWheel thì phải vẽ lại art (hoặc vẽ ô bằng code).
const PAINTED = [178, 149, 117.5, 69.5, 37.5, 3];
// Gắn vòng vào popup vừa mở (ask dựng dialog ngay lúc gọi). Kim chạy tới khi bấm nút xem ads; trả về hàm đọc ô đã chốt (null = chưa chốt).
function attachWheel(pending) {
  const dialog = document.querySelector('dialog.idle-claim'), slots = wheelSlots();
  if (!dialog) return () => null;
  // Hết lượt trúng +300% hôm nay: ô x4 vẽ sẵn bị che bằng nhãn hệ số thật của ô đó
  const middle = slots[Math.floor(slots.length / 2)];
  if (!jackpotLeft()) dialog.querySelector('.meter-needle').insertAdjacentHTML('beforebegin', `<span class="meter-jackpot-off">${mult(middle.bonus)}</span>`);
  const needle = dialog.querySelector('.meter-needle'), adButton = dialog.querySelector('[data-choice="ad"]');
  const amount = adButton.querySelector('.meter-video-amount'), badge = dialog.querySelector('.meter-factor');
  let locked = null, shown = null, frame = 0;
  const start = performance.now();
  const step = now => {
    const t = ((now - start) / SWEEP_MS) % 2, p = t < 1 ? t : 2 - t;
    let i = 0, edge = 0;
    while (i < slots.length - 1 && p > edge + slots[i].share) edge += slots[i++].share;
    const k = Math.min(1, (p - edge) / slots[i].share), slot = slots[i];
    // Ảnh kim chĩa sang phải (0°): xoay âm = ngược chiều kim đồng hồ. Chỉ chạy 80% giữa ô: kim không bao giờ dừng ngay trên vạch chia
    needle.style.rotate = `${-(PAINTED[i] + (PAINTED[i + 1] - PAINTED[i]) * (.1 + .8 * k)).toFixed(1)}deg`;
    if (slot !== shown) {
      shown = slot;
      amount.textContent = (pending + Math.round(pending * slot.bonus)).toLocaleString('en-US');
      badge.textContent = mult(slot.bonus);
    }
    if (locked === null && dialog.open) frame = requestAnimationFrame(step);
  };
  // Vẽ khung đầu ngay (nút có số + hệ số từ đầu, bấm sớm vẫn chốt được ô), các khung sau theo requestAnimationFrame
  step(start);
  // Bấm lần 1: kim dừng, số xu đã nhân hiện vàng + nút toả sáng (giữ dialog mở). Bấm lần 2 mới cho ask() đóng dialog → xem ads.
  // capture: chặn trước listener đóng dialog của ask()
  dialog.addEventListener('click', event => {
    if (!event.target.closest('[data-choice="ad"]') || locked !== null) return;
    locked = shown; cancelAnimationFrame(frame);
    adButton.classList.add('locked');
    // Lớp sáng riêng nằm ngay sau nút (cùng chỗ, nhô ra ngoài): pseudo của chính nút không thể vừa sau mặt nút vừa trên nền popup
    const glow = document.createElement('span');
    glow.className = 'idle-ad-glow';
    adButton.before(glow);
    // Đo sau khi đổi chữ (nút có thể đổi cỡ); popup có zoom (base.css --s) nên quy toạ độ màn hình về toạ độ CSS của khung chứa.
    requestAnimationFrame(() => {
      const box = glow.offsetParent ?? dialog, at = adButton.getBoundingClientRect(), from = box.getBoundingClientRect(), k = from.width / box.offsetWidth || 1;
      Object.assign(glow.style, { left: `${(at.left - from.left) / k - box.clientLeft}px`, top: `${(at.top - from.top) / k - box.clientTop + box.scrollTop}px`, width: `${at.width / k}px`, height: `${at.height / k}px` });
    });
    event.stopPropagation();
  }, true);
  return () => locked;
}

// Chạm bong bóng của BẤT KỲ con nào = nhận xu của TẤT CẢ mèo trong nhà một lượt (mỗi bong bóng đang hiện nổ một đợt xu).
// ADS-SDK: chỗ đặt "idle" — trước khi nhận, popup hỏi "Nhận N" hay "▶ xem ads, nhận N × (1 + ô kim dừng)" (REWARDED_ADS.caps.idle lần / ngày).
let idleAsking = false;
document.addEventListener('click', async event => {
  if (!event.target.closest('.idle-coin[data-breed]') || idleAsking) return;
  const preview = getDeco(), cleared = levelsCleared();
  const pending = preview.cats.reduce((sum, breed) => sum + idlePending(preview, cleared, Date.now(), breed), 0);
  if (!pending) return;
  let bonus = 0;
  if (adReady('idle')) {
    idleAsking = true;
    const asked = ask(idleRewardOptions(pending, REWARDED_ADS.idleWheel[0].bonus)), lockedSlot = attachWheel(pending);
    const choice = await asked, slot = lockedSlot();
    if (choice === 'ad' && slot && await showRewarded('idle')) {
      bonus = slot.bonus;
      if (slot.jackpot) setWallet(noteAd(getWallet(), 'idleJackpot', Date.now()));
    }
    idleAsking = false;
    if (!choice) return;
  }
  claimAll(bonus);
});

// bonusRate: xu thêm theo tỉ lệ tổng vừa nhận (ô vòng nhân đã chốt), 0 = nhận thường.
function claimAll(bonusRate) {
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
  const bonus = Math.round(total * bonusRate);
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
  const cap = Math.max(1, idleCap(cleared)), coinsFor = amount => Math.max(1, Math.min(12, Math.ceil(amount * (1 + bonusRate) / cap * 12)));
  const flights = claimedBreeds.map(([breed, amount]) => room3d?.flyCoins(breed, target, coinsFor(amount), () => {
    pill.classList.remove('coin-hit'); void pill.offsetWidth; pill.classList.add('coin-hit');
    playSound('fill', 5);
  }) ?? Promise.resolve());
  Promise.all(flights).then(refreshWallet);
  setTimeout(refreshWallet, 2500);
}
