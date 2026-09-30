// Một ván chơi (thuần logic, không đụng giao diện): bóc thẻ, xoay, gửi tạm, đặt, gom, thắng/thua, tutorial.
// Giao diện (gom-gom.js trên web, component Cocos sau này) chỉ gọi các hàm dưới đây rồi vẽ theo kết quả trả về;
// không tự sửa luật. Mọi hàm nhận `s` (session) và sửa trực tiếp trên nó.
import { clearMatches, placementIndices, placeCard, rotateOffsets } from './board-rules.mjs';
import { MATCH_SIZE, matchPoints } from './scoring.mjs';
import { categories } from './cat-art.mjs';
import { LEVELS, parseBoard, makeDealer, starsFor } from './levels.mjs';
import { BOARD } from './tuning.mjs';

const { W, H, PREVIEW_COUNT } = BOARD;
const withNames = card => ({ offsets: card.offsets, items: card.items.map(({ group }) => ({ group, name: categories[group].name })) });

export function createSession(levelIndex, { rng = Math.random } = {}) {
  const level = LEVELS[levelIndex];
  const s = {
    level, levelIndex, board: parseBoard(level.board), deal: makeDealer(level, rng), deck: [], active: null, hold: null,
    score: 0, moves: level.moves, over: false, outcome: null,
    tutorial: level.tutorial ? { steps: level.tutorial, step: 0 } : null,
  };
  s.active = drawCard(s);
  return s;
}

// Bóc thẻ kế tiếp; luôn giữ đủ PREVIEW_COUNT thẻ "sắp tới" trong s.deck.
export function drawCard(s) {
  while (s.deck.length <= PREVIEW_COUNT) s.deck.push(withNames(s.deal(s.board)));
  return s.deck.shift();
}
export const upcoming = s => s.deck.slice(0, PREVIEW_COUNT);

export function canPlaceAnywhere(s, card) {
  let offsets = card.offsets;
  for (let turn = 0; turn < 4; turn++, offsets = rotateOffsets(offsets)) {
    if (s.board.some((_, index) => placementIndices(s.board, W, H, index, offsets))) return true;
  }
  return false;
}
// Kẹt: thẻ đang bóc không vừa bàn và thẻ gửi tạm cũng không (ô gửi tạm trống thì vẫn còn đường rút thẻ).
export function checkStuck(s) {
  if (s.over || canPlaceAnywhere(s, s.active) || !s.hold || canPlaceAnywhere(s, s.hold)) return false;
  finish(s, false, 'No room left!');
  return true;
}
function finish(s, win, reason = '') {
  s.over = true;
  s.outcome = { win, reason, stars: win ? starsFor(s.level, s.moves) : 0 };
}

// ---------- Tutorial: các bước trong levels.mjs ----------
//   drag  (kéo vào ô `anchor`; `free` = chỉ gợi ý, đặt đâu cũng được) · rotate (xoay tới hướng `offsets`)
//   hold  (kéo vào ô Gửi tạm) · tapHold (chạm ô Gửi tạm) · info (đọc rồi bấm Tiếp tục)
export const tutorialStep = s => s.tutorial?.steps[s.tutorial.step] || null;
export function tutorialAllows(s, action, anchor) {
  const step = tutorialStep(s);
  if (!step) return true;
  if (step.type === 'info') return false;
  if (step.free) return true;
  if (action === 'drag') return step.type === 'drag' || step.type === 'hold';
  if (action === 'place') return step.type === 'drag' && anchor === step.anchor;
  if (action === 'rotate') return step.type === 'rotate';
  if (action === 'hold') return step.type === 'hold' || step.type === 'tapHold';
  return false;
}
// Sang bước kế nếu hành động vừa làm đúng là việc của bước hiện tại. Trả về true nếu có chuyển bước.
export function advanceTutorial(s, action) {
  const step = tutorialStep(s);
  if (!step) return false;
  const done = step.type === 'drag' ? action === 'place'
    : step.type === 'rotate' ? action === 'rotate' && JSON.stringify(s.active.offsets) === JSON.stringify(step.offsets)
      : step.type === action;
  if (done) s.tutorial.step++;
  return done;
}
// Bước info: người chơi bấm Tiếp tục.
export function continueTutorial(s) {
  if (tutorialStep(s)?.type === 'info') s.tutorial.step++;
}

// ---------- Hành động của người chơi ----------
// Xoay thẻ đang bóc 90° thuận chiều.
export function rotate(s) {
  if (s.over || s.active.items.length < 2) return { ok: false };
  if (!tutorialAllows(s, 'rotate')) return { ok: false, error: 'tutorial' };
  s.active.offsets = rotateOffsets(s.active.offsets);
  return { ok: true, tutorialAdvanced: advanceTutorial(s, 'rotate') };
}

// Gửi tạm: ô trống thì cất thẻ và bóc thẻ mới; ô có thẻ thì đổi chỗ hai thẻ. Không giới hạn số lần.
export function hold(s) {
  if (s.over) return { ok: false };
  if (!tutorialAllows(s, 'hold')) return { ok: false, error: 'tutorial' };
  const previous = s.hold;
  s.hold = s.active;
  s.active = previous || drawCard(s);
  const tutorialAdvanced = advanceTutorial(s, previous ? 'tapHold' : 'hold');
  return { ok: true, swapped: !!previous, tutorialAdvanced, stuck: checkStuck(s) };
}

// Đặt thẻ đang bóc tại ô `anchor` (góc trên-trái của hình thẻ). Trả về đủ thông tin để giao diện diễn:
//   result  = { board (sau khi đặt, trước khi gom), indices (các ô vừa đặt) }
//   match   = { board (sau khi gom), cleared, clusters, groups, broken (thùng vừa vỡ) }
//   gained  = điểm vừa được · win / lose / stuck · fit (thẻ mới bóc có chỗ đặt không)
export function place(s, anchor) {
  if (s.over) return { ok: false };
  if (!tutorialAllows(s, 'place', anchor)) return { ok: false, error: 'tutorial' };
  const result = placeCard(s.board, W, H, anchor, s.active);
  if (result.error) return { ok: false, error: result.error };
  const match = clearMatches(result.board, W, H, MATCH_SIZE);
  const gained = matchPoints(match.clusters);
  s.board = match.board;
  s.score += gained;
  s.moves--;
  const tutorialAdvanced = advanceTutorial(s, 'place');
  const turn = { ok: true, result, match, gained, tutorialAdvanced, win: false, lose: false, stuck: false, fit: true };
  if (s.score >= s.level.target) {
    finish(s, true);
    s.active = drawCard(s); // không để thẻ vừa đặt nằm lại trong ô đang bóc
    return { ...turn, win: true };
  }
  if (s.moves === 0) { finish(s, false, 'Out of moves!'); return { ...turn, lose: true }; }
  s.active = drawCard(s);
  const fit = canPlaceAnywhere(s, s.active);
  const stuck = checkStuck(s);
  return { ...turn, fit, stuck, lose: stuck };
}
