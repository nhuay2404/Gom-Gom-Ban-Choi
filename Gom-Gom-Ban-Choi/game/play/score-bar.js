// Thanh điểm: số "+N" bật ra ở chỗ gom rồi vỡ thành đốm bay vào thanh; thanh chỉ tăng khi đốm tới nơi (shownScore).
// Sang Unity: ScoreBar (MonoBehaviour).
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { state, wait } from './context.js';

// Điểm cộng: số "+N" bật to ở chỗ gom (nảy quá cỡ rồi về), rồi vỡ thành các đốm sao vàng bay vòng cung vào đầu thanh điểm.
// Thanh điểm / số điểm chỉ tăng khi đốm cuối cùng tới nơi (shownScore), đốm đầu tới thì thanh nảy + loé sáng.
// Giảm chuyển động: không có pop / bay, thanh cập nhật ngay.
// pendingFlights = điểm đã được tính vào state nhưng đốm chưa bật ra (cụm còn đang chụm lại): giữ thanh điểm đứng yên cho tới khi đốm bay tới.
let shownScore = 0, scoreFlights = 0, pendingFlights = 0, flightGen = 0;

export const releaseScoreSlot = () => { pendingFlights = Math.max(0, pendingFlights - 1); };

export const holdScoreSlots = n => { pendingFlights += n; };

export function resetScoreFlights() { flightGen++; scoreFlights = 0; pendingFlights = 0; }

// Mỗi loại điểm một màu + một cỡ hiệu ứng (màu / cỡ chữ / đốm ở CSS .score-pop.t-* / .score-orb.t-*):
//   crate (thùng vỡ, +10) · m3 · m4 · m5 · m6 · m7 (cụm 7 trở lên). Cụm càng to: chữ càng to, nảy càng mạnh, càng nhiều đốm bay.
const SCORE_TIERS = {
  crate: { orbs: 3, punch: 1.35 },
  m3: { orbs: 5, punch: 1.5 },
  m4: { orbs: 7, punch: 1.65 },
  m5: { orbs: 9, punch: 1.8 },
  m6: { orbs: 12, punch: 1.95 },
  m7: { orbs: 16, punch: 2.15 },
};

export const scoreTier = size => `m${Math.min(7, Math.max(3, size))}`;

export function showMergeScore(cell, points, delay = 300, tier = 'm3') {
  const { orbs, punch } = SCORE_TIERS[tier];
  if (reduceMotion.matches) return releaseScoreSlot();
  const rect = cell.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2, gen = flightGen;
  scoreFlights++;
  releaseScoreSlot();
  const pop = document.createElement('span');
  pop.className = `score-pop t-${tier}`;
  pop.textContent = `+${points}`;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.append(pop);
  const at = (dy, scale) => `translate(-50%, -50%) translateY(${dy}px) scale(${scale})`;
  pop.animate([
    { transform: at(0, .2), opacity: 0 },
    { transform: at(-26, punch), opacity: 1, offset: .22 },
    { transform: at(-30, .92), offset: .36 },
    { transform: at(-32, 1.05), offset: .46 },
    { transform: at(-34, 1), offset: .82 },
    { transform: at(-34, .4), opacity: .2 },
  ], { duration: 420, delay, easing: 'ease-out', fill: 'both' }).finished.catch(() => {}).then(() => pop.remove());
  // Hạt bay vào thanh gần như cùng lúc số điểm bật ra (không đợi số điểm tan).
  setTimeout(() => { if (gen === flightGen) flyToBar(x, y - 34, points, gen, tier, orbs); }, delay + 110);
}

function flyToBar(x, y, points, gen, tier, count) {
  const track = $('score-fill').parentElement, bar = track.getBoundingClientRect();
  const tip = Math.min(1, (shownScore + points) / state.level.target);
  const tx = bar.left + Math.max(bar.height / 2, bar.width * tip - bar.height / 2), ty = bar.top + bar.height / 2;
  let landed = 0;
  for (let i = 0; i < count; i++) {
    const orb = document.createElement('span');
    orb.className = `score-orb t-${tier}`;
    orb.style.left = `${x}px`;
    orb.style.top = `${y}px`;
    document.body.append(orb);
    // Toả ra quanh số rồi bay vòng cung (lệch sang một bên) vào đầu thanh, nhỏ dần
    const angle = (i / count) * Math.PI * 2 + Math.random() * .5, spread = 26 + Math.random() * 14;
    const sx = Math.cos(angle) * spread, sy = Math.sin(angle) * spread, dx = tx - x, dy = ty - y;
    const bend = (i % 2 ? 1 : -1) * (40 + Math.random() * 30);
    const at = (px, py, scale) => `translate(-50%, -50%) translate(${px}px, ${py}px) scale(${scale})`;
    orb.animate([
      { transform: at(0, 0, .3), opacity: 0 },
      { transform: at(sx, sy, 1.2), opacity: 1, offset: .2 },
      { transform: at(sx + (dx - sx) * .5 + bend, sy + (dy - sy) * .45, .95), offset: .6 },
      { transform: at(dx, dy, .45), opacity: 1 },
    ], { duration: 240 + i * 12, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' }).finished.catch(() => {}).then(() => {
      orb.remove();
      if (gen !== flightGen) return;
      playSound('fill', count > 1 ? (i / (count - 1)) * 10 : 5);
      if (++landed === 1) bumpScoreBar();
      if (landed < count) return;
      shownScore = Math.min(state.score, shownScore + points);
      if (--scoreFlights <= 0) { scoreFlights = Math.max(0, scoreFlights); if (!pendingFlights) shownScore = state.score; }
      renderScore();
    });
  }
}

// Đợi mọi điểm đang bay chạm thanh, rồi đợi thanh chạy xong (transition width .45s) + nghỉ một nhịp ngắn khi đã đầy.
const SCORE_FILL_MS = 450, FULL_HOLD_MS = 350;

export async function scoreSettled() {
  if (reduceMotion.matches) return;
  const gen = flightGen;
  while ((scoreFlights > 0 || pendingFlights > 0) && gen === flightGen) await wait(50);
  await wait(SCORE_FILL_MS + FULL_HOLD_MS);
}

function bumpScoreBar() {
  const box = $('score-fill').closest('.progress');
  box.animate([{ scale: '1' }, { scale: '1.12 1.25' }, { scale: '.97' }, { scale: '1' }], { duration: 380, easing: 'ease-out' });
  box.classList.remove('gain'); void box.offsetWidth; box.classList.add('gain');
  // Cả bảng HUD (số lượt + thanh điểm) giật nhẹ như vừa bị năng lượng đập vào.
  const panel = box.closest('.fg-panel');
  if (!panel || reduceMotion.matches) return;
  panel.getAnimations().filter(animation => animation.id === 'hud-jolt').forEach(animation => animation.cancel());
  const jolt = panel.animate([
    { translate: '0 0', rotate: '0deg' }, { translate: '0 -3px', rotate: '-1.2deg', offset: .2 }, { translate: '0 2px', rotate: '1deg', offset: .45 },
    { translate: '0 -1px', rotate: '-.5deg', offset: .7 }, { translate: '0 0', rotate: '0deg' },
  ], { duration: 320, easing: 'ease-out', composite: 'add' });
  jolt.id = 'hud-jolt';
}

// Số điểm + thanh: đang có điểm bay thì giữ số đã hiện (shownScore), bay xong mới tăng.
export function renderScore() {
  if (!scoreFlights && !pendingFlights) shownScore = state.score;
  // Thanh tiến độ = điểm / mục tiêu điểm (mọi màn); số ô cỏ còn lại hiện ở ô Goal.
  $('score').textContent = shownScore;
  $('highscore').textContent = state.level.target;
  const progress = Math.min(1, shownScore / state.level.target);
  $('score-fill').style.width = `${progress * 100}%`;
  $('score-fill').parentElement.parentElement.classList.toggle('full', progress >= 1);
}
