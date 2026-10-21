// HUD màn chơi + render() chung: số màn, lượt, ô Goal (mục tiêu còn lại, lắc + làm sáng ô khi đủ điểm mà còn mục tiêu),
// sắp hết lượt. Sang Unity: Hud (MonoBehaviour), render() thành Refresh().
import * as game from '../core/session.mjs';
import { LOW_MOVE_MOODS } from '../ui/cat-art.mjs';
import { LOW_MOVES } from '../data/tuning.mjs';
import { boostersUnlocked } from '../core/boosters.mjs';
import { CAGE_ICON_SVG, GRASS_ICON_SVG, LETTER_SVG, vaseSvg, SYRUP_DROP_SVG } from '../ui/board-art.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { refreshSkin, state } from './context.js';
import { renderScore, scoreSettled } from './score-bar.js';
import { renderBoard, fatMarkup } from './board-view.js';
import { renderCards, normalizePreview, layoutHints } from './cards.js';
import { renderBoosters } from './booster-bar.js';

// Đổi bộ giữa chừng (nút Home hub): vẽ lại quân đang có trên bàn + thẻ đang cầm / kế tiếp / Hold ở lần render tới
addEventListener('pieceskin', () => {
  refreshSkin();
  $('board').querySelectorAll(':scope > .cell').forEach(cell => { cell.renderedObject = undefined; });
  for (const el of document.querySelectorAll('*')) if ('renderedKey' in el) el.renderedKey = null; // thẻ đang cầm / kế tiếp / Hold (sự kiện hiếm)
  if (state) render();
});

export function render(message = '', error = false) {
  $('level-title').textContent = `Level ${state.levelIndex + 1}`;
  $('level-title').dataset.digits = String(state.levelIndex + 1).length; // số 2 chữ số: chữ nhỏ lại cho lọt giữa hai lá trên badge
  $('moves').textContent = state.moves;
  renderGoals();
  renderScore();
  $('booster-bar').querySelector('[data-boost="moves"]').classList.toggle('low-moves', !state.over && state.moves < 3 && boostersUnlocked(state.levelIndex));
  $('message').textContent = message;
  $('message').classList.toggle('error', error);
  renderBoard();
  paintGoalHint();
  renderCards();
  $('active-card').disabled = state.over;
  document.querySelector('.card-rotator').classList.toggle('can-rotate', !state.over && state.active.items.length > 1);
  // Thẻ dọc (nhiều hàng hơn cột) -> mũi tên xoay dựng dọc hai bên.
  const shape = normalizePreview(state.active.offsets);
  layoutHints(shape.rows > shape.cols, state.animateHints);
  $('hold').disabled = state.over || !state.holdOn;
  // Ô Hold chỉ hiện từ màn HOLD.UNLOCK_LEVEL (giữ chỗ trong dock để thẻ đang bóc không bị lệch).
  document.querySelector('.hold-column').classList.toggle('locked', !state.holdOn);
  renderLowMoves();
  renderBoosters();
}

// Ô bàn được giữ cố định; chỉ ô nào đổi mèo mới dựng lại. Không xoá/dựng lại cả 36 ô mỗi lần vẽ
// nên không bị chớp hình, không reset nhịp chớp mắt và không khựng khung hình.
// Ô Goal cạnh ô Move: mỗi mục tiêu còn lại một ô (cỏ / mèo trong lồng). Mục tiêu nào xong thì biến mất; hết mục tiêu thì ẩn
// cả ô Goal (ô Move về chỗ của màn không có mục tiêu).
// has = màn có loại mục tiêu này từ đầu; ô Goal hiện đủ mọi mục tiêu còn lại (tối đa 3, mỗi loại một ô).
const GOAL_KINDS = {
  grass: { has: () => state.grassTotal, icon: () => GRASS_ICON_SVG, left: () => game.grassLeft(state), label: 'grass tiles' },
  cage: { has: () => state.hasCages, icon: () => CAGE_ICON_SVG, left: () => game.cagesLeft(state), label: 'caged cats' },
  fat: { has: () => state.hasFat, icon: () => `<span class="goal-fat">${fatMarkup('sleep')}</span>`, left: () => game.fatLeft(state), label: 'sleepy big cats' },
  // thư / mảnh bình đang bay (match-fx.js flyToGoal) chưa trừ: số chỉ giảm lúc chạm ô Goal
  mail: { has: () => state.mailTotal, icon: () => LETTER_SVG, left: () => Math.max(0, state.mailTotal - state.mail + state.flying.mail), label: 'letters' },
  vase: { has: () => state.hasVase, icon: () => vaseSvg(), left: () => game.vasesLeft(state) + state.flying.vase, label: 'vases' },
  syrup: { has: () => state.hasSyrup, icon: () => SYRUP_DROP_SVG, left: () => game.syrupLeft(state) + state.flying.syrup, label: 'syrup-covered cats' },
};

const goalsLeft = () => Object.keys(GOAL_KINDS).filter(kind => GOAL_KINDS[kind].has() && GOAL_KINDS[kind].left() > 0);

export function renderGoals() {
  const goals = goalsLeft();
  $('goal-box').hidden = !goals.length;
  $('goal-box').closest('.fg-panel').classList.toggle('has-goal', goals.length > 0);
  $('goal-box').classList.toggle('two', goals.length > 1);
  $('goal-box').classList.toggle('three', goals.length > 2);
  [['goal-icon', 'goal-count'], ['goal-icon2', 'goal-count2'], ['goal-icon3', 'goal-count3']].forEach(([iconId, countId], k) => {
    const kind = goals[k], icon = $(iconId);
    icon.hidden = $(countId).hidden = !kind;
    if (!kind) return;
    if (icon.dataset.kind !== kind) { icon.innerHTML = GOAL_KINDS[kind].icon(); icon.dataset.kind = kind; }
    $(countId).textContent = GOAL_KINDS[kind].left();
  });
  $('goal-box').setAttribute('aria-label', `${goals.map(kind => GOAL_KINDS[kind].label).join(' and ')} left`);
}

// Lần đầu đủ điểm mà còn mục tiêu: lúc thanh điểm vừa đầy (điểm bay vào xong), icon mục tiêu lắc và các ô mục tiêu trên bàn
// sáng lên (state.goalHint) tới nước đi kế tiếp — đã đi nước khác trước lúc đó thì không bật sáng nữa.
export function nudgeGoals() {
  if (state.goalNudged || state.score < state.level.target || !goalsLeft().length) return;
  state.goalNudged = true;
  const session = state, moves = state.moves;
  scoreSettled().then(() => {
    if (state !== session || state.over) return;
    if (state.moves === moves) { state.goalHint = true; paintGoalHint(); }
    if (reduceMotion.matches) return;
    ['goal-icon', 'goal-icon2', 'goal-icon3'].forEach(id => {
      const icon = $(id);
      if (icon.hidden) return;
      icon.classList.remove('goal-shake');
      void icon.offsetWidth;
      icon.classList.add('goal-shake');
      icon.addEventListener('animationend', () => icon.classList.remove('goal-shake'), { once: true });
    });
  });
}

function paintGoalHint() {
  const cols = 6;
  const lit = index => !!state.goalHint && (!!state.board[index]?.cage || !!state.board[index]?.fat || !!state.grass?.[index] || !!state.board[index]?.vase || (!!state.board[index]?.mail && game.mailLeft(state) > 0));
  $('board').querySelectorAll(':scope > .cell').forEach((cell, index) => {
    const on = lit(index), col = index % cols;
    cell.classList.toggle('goal-hint', on);
    // Ô kề cũng sáng: bỏ viền cạnh chung để cả cụm thành một khung liền
    cell.classList.toggle('hint-n', on && index >= cols && lit(index - cols));
    cell.classList.toggle('hint-s', on && lit(index + cols));
    cell.classList.toggle('hint-w', on && col > 0 && lit(index - 1));
    cell.classList.toggle('hint-e', on && col < cols - 1 && lit(index + 1));
  });
}

// Sắp hết lượt: ô Moves đổi màu + đập nhịp, mèo lộ biểu cảm buồn/lo (mỗi con một kiểu), thông báo ở vài lượt cuối.
const { CATS_AT: LOW_CATS_AT, MSG_AT: LOW_MSG_AT } = LOW_MOVES;

export function lowMovesText() {
  if (state.over || state.moves > LOW_MSG_AT || state.moves < 1) return '';
  return state.moves === 1 ? 'Last move!' : `${state.moves} moves left!`;
}

function renderLowMoves() {
  const left = state.moves, live = !state.over && left > 0;
  const box = $('moves').parentElement;
  box.classList.toggle('danger', live && left <= LOW_MSG_AT);
  box.classList.toggle('warn', live && left > LOW_MSG_AT && left <= Math.ceil(state.level.moves * 0.3));
  const low = live && left <= LOW_CATS_AT;
  // Vừa chuyển sang "sắp hết lượt": mèo kêu lo lắng một tiếng (không kêu lại mỗi lượt)
  if (low && !document.body.classList.contains('low-moves')) playSound('worried');
  document.body.classList.toggle('low-moves', low);
  if (low) document.body.classList.remove('afk', 'afk-deep');
  if (!low) return;
  const cats = [...document.querySelectorAll('#board > .cell.locked .cat, #active-card .cat, #hold .cat, #next-cards .cat')];
  // Xáo vòng các kiểu để các con cạnh nhau hiếm khi trùng biểu cảm.
  const offset = Math.floor(Math.random() * LOW_MOVE_MOODS.length);
  cats.forEach((cat, i) => { if (!cat.dataset.low) cat.dataset.low = LOW_MOVE_MOODS[(i * 3 + offset + Math.floor(Math.random() * 2)) % LOW_MOVE_MOODS.length]; });
}
