// Thanh booster trong ván: búa (đập 3×3, sáng vùng khi rê), đổi thẻ (thẻ may mắn), +lượt; hết hàng thì popup ads / gem (app/store.js).
// Gợi ý dùng booster đúng lúc (nút nhấp nháy): suggestBoosters() sau mỗi lượt.
// Luật booster ở core/session.mjs + core/boosters.mjs. Sang Unity: BoosterBar (MonoBehaviour).
import * as game from '../core/session.mjs';
import { BOOSTERS, LUCKY } from '../data/tuning.mjs';
import { spendBooster, boostersUnlocked } from '../core/boosters.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion, getBoosters, storeBoosters, priceTag } from '../app/shared.js';
import { offerBooster, tookGemShopTrip } from '../app/store.js';
import { state, fxLayer, cellEl, W, H } from './context.js';
import { tutorialStep } from './tutorial.js';
import { track, endLevel, suspendForShop } from './result.js';
import { render, nudgeGoals } from './hud.js';
import { breakCrates, flyBits, spawnPuff, shakeBoard, animateFat, flyToGoal, breakVases, washSyrup } from './match-fx.js';
import { holdScoreSlots, showMergeScore, releaseScoreSlot } from './score-bar.js';
import { drainMoves, celebrateWin } from './finale.js';

// ===== Booster: mở từ màn BOOSTERS.UNLOCK_LEVEL, không tốn lượt; hết thì chạm mở popup xem ads / mua bằng gem =====
// Búa đang giơ: chạm một ô trên bàn để đập.
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

// Hết hàng: popup ads / gem; nhận được thì bấm lại nút để dùng luôn. Booster lấy ngay trong ván được ghi riêng để thống kê.
const haveBooster = (id, button) => {
  if (getBoosters()[id] > 0) return true;
  offerBooster(id).then(got => {
    renderBoosters();
    // Thiếu gem, đã chuyển tới Shop: treo ván; về Home thì chơi tiếp đúng chỗ (result.js resumeRun).
    if (tookGemShopTrip()) return suspendForShop('play');
    if (!got || state.over) return;
    track.bought++;
    button.click();
  });
  return false;
};

// Gợi ý booster đúng lúc (mỗi loại tối đa một lần mỗi ván): còn ≤ 3 lượt mà theo nhịp hiện tại không đủ điểm → +lượt;
// bàn sắp kín → búa; 2 lượt liền không gom được → thẻ mới. Gọi sau mỗi lượt chưa kết thúc ván.
export function suggestBoosters(turn) {
  if (!boostersUnlocked(state.levelIndex) || tutorialStep() || state.over) return;
  state.suggested ??= new Set();
  state.dryTurns = turn.match?.groups.length ? 0 : (state.dryTurns ?? 0) + 1;
  const used = state.level.moves - state.moves, pace = used ? state.score / used : 0;
  const free = state.board.filter(object => !object).length;
  const pick = state.moves <= 3 && state.score + pace * state.moves < state.level.target ? 'moves' : free <= 5 ? 'hammer' : state.dryTurns >= 2 ? 'swap' : null;
  if (!pick || state.suggested.has(pick)) return;
  state.suggested.add(pick);
  const bar = $('booster-bar');
  bar.querySelector('.suggest')?.classList.remove('suggest');
  bar.querySelector(`[data-boost="${pick}"]`).classList.add('suggest');
}

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
    if (!haveBooster(id, button)) return renderBoosters();
    hammerArmed = true;
    return render('Tap the board to smash a 3×3 area.');
  }
  if (!haveBooster(id, button)) return renderBoosters();
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
  animateFat(turn, 0); // mèo béo trúng búa: nhún / lăn (điểm lăn đã nằm trong số điểm của nhát búa)
  flyToGoal('mail', turn.mail, 120);
  washSyrup(turn.removed.filter(({ object }) => object.syrup).map(({ index: i }) => i), 0);
  breakVases({ cracked: [], shattered: turn.removed.filter(({ object }) => object.vase).map(({ index: i }) => i) }, 0);
  const crates = turn.removed.filter(({ object }) => object.block && !object.metal).map(({ index: i }) => i);
  breakCrates(crates, 0);
  if (!reduceMotion.matches) {
    const layer = fxLayer();
    turn.removed.forEach(({ index: i, object }) => {
      const target = cellEl(i);
      if (!target || (object.block && !object.metal) || object.vase) return; // thùng: breakCrates lo · bình: breakVases lo
      if (object.metal || (object.cage && !object.syrup)) { flyBits(layer, target, object.cage ? 'cage-bar' : 'grass-bit', 6); spawnPuff(target); return; }
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
