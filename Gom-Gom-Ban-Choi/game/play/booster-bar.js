// Thanh booster trong ván: búa (đập 3×3, sáng vùng khi rê), đổi thẻ (thẻ may mắn), +lượt; hết hàng thì mua bằng xu.
// Luật booster ở core/session.mjs + core/boosters.mjs. Sang Unity: BoosterBar (MonoBehaviour).
import * as game from '../core/session.mjs';
import { BOOSTERS, LUCKY } from '../data/tuning.mjs';
import { spendBooster, boostersUnlocked } from '../core/boosters.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion, getBoosters, storeBoosters, buyOne, priceTag } from '../app/shared.js';
import { state, fxLayer, cellEl, W, H } from './context.js';
import { tutorialStep } from './tutorial.js';
import { track, endLevel } from './result.js';
import { render, nudgeGoals } from './hud.js';
import { breakCrates, flyBits, spawnPuff, shakeBoard } from './match-fx.js';
import { holdScoreSlots, showMergeScore, releaseScoreSlot } from './score-bar.js';
import { drainMoves, celebrateWin } from './finale.js';

// ===== Booster: mở từ màn BOOSTERS.UNLOCK_LEVEL, không tốn lượt; hết thì chạm là mua luôn bằng xu =====
// Búa đang giơ: chạm một ô trên bàn để đập (kho booster + mua bằng xu ở shared.js).
export let hammerArmed = false;

export function disarmHammer() { hammerArmed = false; }

export function renderBoosters() {
  const bar = $('booster-bar');
  bar.hidden = !boostersUnlocked(state.levelIndex);
  const busy = state.over || !!tutorialStep();
  bar.querySelectorAll('[data-boost]').forEach(button => {
    const id = button.dataset.boost, count = getBoosters()[id];
    button.disabled = busy;
    button.classList.toggle('armed', id === 'hammer' && hammerArmed);
    button.classList.toggle('empty', !count);
    button.querySelector('.boost-count').innerHTML = count || priceTag(id);
  });
  document.body.classList.toggle('hammer-armed', hammerArmed);
}

// Booster mua ngay trong ván (hết hàng, trả bằng xu) được ghi riêng để thống kê.
const haveBooster = id => {
  if (getBoosters()[id] > 0) return true;
  if (!buyOne(id)) return false;
  track.bought++;
  return true;
};

const useBooster = id => {
  track.boosters++; track.boostUse[id]++;
  storeBoosters(spendBooster(getBoosters(), id));
  $('booster-bar').querySelector('.suggest')?.classList.remove('suggest');
};

$('booster-bar').addEventListener('click', event => {
  const button = event.target.closest('[data-boost]');
  if (!button || button.disabled || state.over || state.animating) return;
  const id = button.dataset.boost;
  if (id === 'hammer') {
    if (hammerArmed) { hammerArmed = false; clearSmashArea(); return render(); }
    if (!haveBooster(id)) return renderBoosters();
    hammerArmed = true;
    return render('Tap the board to smash a 3×3 area.');
  }
  if (!haveBooster(id)) return renderBoosters();
  hammerArmed = false;
  if (id === 'swap' && game.swapCard(state).ok) {
    useBooster(id);
    playSound('draw');
    state.preview = null;
    render(`Lucky cards! The best card for the next ${LUCKY.TURNS} turns.`);
  }
  // Tỉ lệ điểm trước lần +lượt đầu tiên (chỉ để thống kê; adaptive.mjs không dùng booster để xét thắng/thua).
  if (id === 'moves') track.preBoostRatio ??= +(state.score / state.level.target).toFixed(3);
  if (id === 'moves' && game.addMoves(state, BOOSTERS.EXTRA_MOVES).ok) {
    useBooster(id);
    playSound('reward');
    render(`+${BOOSTERS.EXTRA_MOVES} moves!`);
    if (!reduceMotion.matches) document.querySelector('.moves-box').animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
});

addEventListener('keydown', event => { if (event.key === 'Escape' && hammerArmed) { hammerArmed = false; clearSmashArea(); render(); } });

// Búa: đập sạch vùng 3×3 — mèo co lại xoay tròn rồi biến mất, thùng / kim loại / chuồng vỡ văng mảnh; điểm bật ra ở ô chạm.
export function smashAt(cell) {
  if (!cell || state.over || state.animating) return;
  const index = Number(cell.dataset.index), turn = game.smash(state, index);
  if (!turn.ok) return render(turn.error || '', !!turn.error);
  state.goalHint = false;
  useBooster('hammer');
  hammerArmed = false;
  clearSmashArea();
  playSound('smash');
  const crates = turn.removed.filter(({ object }) => object.block && !object.metal).map(({ index: i }) => i);
  breakCrates(crates, 0);
  if (!reduceMotion.matches) {
    const layer = fxLayer();
    turn.removed.forEach(({ index: i, object }) => {
      const target = cellEl(i);
      if (!target || (object.block && !object.metal)) return; // thùng: breakCrates lo
      if (object.metal || object.cage) { flyBits(layer, target, object.cage ? 'cage-bar' : 'grass-bit', 6); spawnPuff(target); return; }
      const ghost = target.cloneNode(true);
      ghost.classList.add('smash-ghost');
      ghost.style.cssText += `;left:${target.offsetLeft}px;top:${target.offsetTop}px;width:${target.offsetWidth}px;height:${target.offsetHeight}px`;
      layer.append(ghost);
      ghost.animate([{ scale: 1, rotate: '0deg', opacity: 1 }, { scale: 1.15, rotate: '-12deg', opacity: 1, offset: .25 }, { scale: 0, rotate: '200deg', opacity: 0 }],
        { duration: 420, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished.then(() => ghost.remove());
      spawnPuff(target);
    });
    turn.cleaned.forEach(i => { const target = cellEl(i); if (target) flyBits(layer, target, 'grass-bit', 5); });
    shakeBoard(8);
  }
  holdScoreSlots(1);
  const at = cellEl(index);
  if (at && turn.points) showMergeScore(at, turn.points, 120, turn.points >= 60 ? 'm6' : 'm4'); else releaseScoreSlot();
  if (turn.win) {
    render(`You win with ${state.score} points! ✨`);
    return drainMoves().then(() => {
      const message = `You win with ${state.score} points! ✨`;
      render(message);
      return celebrateWin(message);
    }).then(() => endLevel(true));
  }
  nudgeGoals(); // búa cũng có thể đẩy điểm qua mục tiêu lần đầu
  render(`Smash! +${turn.points} points.`);
}

// Búa đang giơ: rê / chạm giữ trên bàn thì sáng vùng 3×3 sẽ bị đập.
function clearSmashArea() { document.querySelectorAll('#board .cell.smash-area').forEach(node => node.classList.remove('smash-area')); }

$('board').addEventListener('pointermove', event => {
  if (!hammerArmed) return;
  const cell = event.target.closest('.cell');
  if (!cell || cell.classList.contains('smash-center')) return;
  clearSmashArea();
  document.querySelectorAll('#board .cell.smash-center').forEach(node => node.classList.remove('smash-center'));
  const index = Number(cell.dataset.index), r = Math.floor(index / W), c = index % W;
  cell.classList.add('smash-center');
  for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < H && x >= 0 && x < W) cellEl(y * W + x)?.classList.add('smash-area');
});

$('board').addEventListener('pointerleave', () => { clearSmashArea(); document.querySelectorAll('#board .cell.smash-center').forEach(node => node.classList.remove('smash-center')); });
