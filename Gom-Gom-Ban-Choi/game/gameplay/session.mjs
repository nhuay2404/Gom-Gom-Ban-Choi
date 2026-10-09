// Một ván chơi (thuần logic, không đụng giao diện): bóc thẻ, xoay, gửi tạm, đặt, gom, thắng/thua, tutorial.
// Giao diện (main.js trên web, component Cocos sau này) chỉ gọi các hàm dưới đây rồi vẽ theo kết quả trả về;
// không tự sửa luật. Mọi hàm nhận `s` (session) và sửa trực tiếp trên nó.
import { clearMatches, placementIndices, placeCard, rotateOffsets } from './board-rules.mjs';
import { MATCH_SIZE, turnPoints } from './scoring.mjs';
import { categories } from '../ui/cat-art.mjs';
import { LEVELS, parseBoard, makeDealer, starsFor, boardSize, parseGrass, grassCount } from './levels.mjs';
import { BOARD, holdUnlocked } from './tuning.mjs';

const { PREVIEW_COUNT } = BOARD;
const withNames = card => ({ offsets: card.offsets, items: card.items.map(({ group }) => ({ group, name: categories[group].name })) });

// `level`: bản màn đã chỉnh độ khó (adaptive.mjs); không truyền thì dùng màn gốc.
// s.W × s.H = kích thước bàn của màn; s.holdOn = màn đã mở ô Hold chưa (tuning.mjs: HOLD).
// s.grass = ô nào còn cỏ (mảng true/false, null nếu màn không có cỏ) · s.grassTotal = số ô cỏ lúc đầu (> 0 = mục tiêu là dọn hết cỏ).
export function createSession(levelIndex, { rng = Math.random, level = LEVELS[levelIndex] } = {}) {
  const { W, H } = boardSize(level.board);
  const s = {
    level, levelIndex, W, H, holdOn: holdUnlocked(levelIndex), grass: parseGrass(level), grassTotal: grassCount(level),
    board: parseBoard(level.board), deal: makeDealer(level, rng), deck: [], active: null, hold: null,
    score: 0, moves: level.moves, over: false, outcome: null,
    tutorial: level.tutorial ? { steps: level.tutorial, step: 0 } : null,
  };
  s.active = drawCard(s);
  s.active = withNames(openingCard(s.board, s.W, s.H, s.active));
  return s;
}

// Gom được ngay khi đặt `card` ở đâu đó (mọi hướng xoay)?
export function matchesSomewhere(board, W, H, card) {
  let offsets = card.offsets;
  for (let turn = 0; turn < 4; turn++, offsets = rotateOffsets(offsets)) {
    for (let anchor = 0; anchor < board.length; anchor++) {
      const indices = placementIndices(board, W, H, anchor, offsets);
      if (!indices) continue;
      const next = board.slice();
      indices.forEach((index, i) => { next[index] = { group: card.items[i].group }; });
      if (clearMatches(next, W, H, MATCH_SIZE).cleared.length) return true;
    }
  }
  return false;
}
// Thẻ đầu tiên của mọi ván phải gom được ngay ở lượt 1. Thẻ bóc ra chưa gom được thì đổi nhẹ nhất có thể:
// đổi màu một mèo của thẻ -> đổi màu cả thẻ (giữ hình) -> thẻ đôi cùng màu -> thẻ đơn. Màu chọn theo giống có nhiều
// mèo (không bị nhốt) trên bàn nhất. Không có cách nào thì giữ thẻ cũ.
export function openingCard(board, W, H, card) {
  if (matchesSomewhere(board, W, H, card)) return card;
  const counts = {};
  board.forEach(cell => { if (cell?.group && !cell.cage) counts[cell.group] = (counts[cell.group] || 0) + 1; });
  const groups = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const recolor = (target, i, group) => ({ offsets: target.offsets, items: target.items.map((item, k) => (i === -1 || k === i ? { group } : { group: item.group })) });
  const tries = [
    ...card.items.flatMap((_, i) => groups.map(group => recolor(card, i, group))),
    ...groups.map(group => recolor(card, -1, group)),
    ...groups.map(group => ({ offsets: [[0, 0], [0, 1]], items: [{ group }, { group }] })),
    ...groups.map(group => ({ offsets: [[0, 0]], items: [{ group }] })),
  ];
  return tries.find(next => matchesSomewhere(board, W, H, next)) ?? card;
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
    if (s.board.some((_, index) => placementIndices(s.board, s.W, s.H, index, offsets))) return true;
  }
  return false;
}
// Kẹt: thẻ đang bóc không vừa bàn và thẻ gửi tạm cũng không (ô gửi tạm trống thì vẫn còn đường rút thẻ).
// Màn chưa mở Hold: thẻ đang bóc không vừa là kẹt.
export function checkStuck(s) {
  if (s.over || canPlaceAnywhere(s, s.active)) return false;
  if (s.holdOn && (!s.hold || canPlaceAnywhere(s, s.hold))) return false;
  finish(s, false, 'No room left!');
  return true;
}
// Qua màn = đủ điểm VÀ đã bẻ hết khóa chuồng (không còn mèo nào bị nhốt trên bàn).
export const cagesLeft = s => s.board.filter(object => object?.cage).length;
export const grassLeft = s => (s.grass ? s.grass.filter(Boolean).length : 0);
// Màn có cỏ: dọn hết cỏ; màn thường: đủ điểm. Cả hai đều phải thả hết chuồng.
export const goalReached = s => cagesLeft(s) === 0 && (s.grassTotal ? grassLeft(s) === 0 : s.score >= s.level.target);
function finish(s, win, reason = '') {
  s.over = true;
  s.outcome = { win, reason, stars: win ? starsFor(s.level, s.moves) : 0 };
}

// ---------- Tutorial: các bước trong levels.mjs ----------
//   drag  (kéo vào ô `anchor`; `free` = chỉ gợi ý, đặt đâu cũng được) · rotate (xoay tới hướng `offsets`)
//   hold  (kéo vào ô Gửi tạm) · tapHold (chạm ô Gửi tạm) · info (đọc rồi bấm Tiếp tục; `focus`: 'score' / 'moves' / 'hold' = khoanh sáng phần HUD)
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
  if (s.over || !s.holdOn) return { ok: false };
  if (!tutorialAllows(s, 'hold')) return { ok: false, error: 'tutorial' };
  const previous = s.hold;
  s.hold = s.active;
  s.active = previous || drawCard(s);
  const tutorialAdvanced = advanceTutorial(s, previous ? 'tapHold' : 'hold');
  return { ok: true, swapped: !!previous, tutorialAdvanced, stuck: checkStuck(s) };
}

// Đặt thẻ đang bóc tại ô `anchor` (góc trên-trái của hình thẻ). Trả về đủ thông tin để giao diện diễn:
//   result  = { board (sau khi đặt, trước khi gom), indices (các ô vừa đặt) }
//   match   = { board (sau khi gom), cleared, clusters, groups, broken (thùng vừa vỡ), caged (chuồng vừa mất khóa), freed (chuồng vừa vỡ) }
//   gained  = điểm vừa được (cụm + thùng vỡ) · win / lose / stuck · fit (thẻ mới bóc có chỗ đặt không)
export function place(s, anchor) {
  if (s.over) return { ok: false };
  if (!tutorialAllows(s, 'place', anchor)) return { ok: false, error: 'tutorial' };
  const result = placeCard(s.board, s.W, s.H, anchor, s.active);
  if (result.error) return { ok: false, error: result.error };
  const match = clearMatches(result.board, s.W, s.H, MATCH_SIZE);
  const gained = turnPoints(match);
  s.board = match.board;
  s.score += gained;
  // Cỏ dưới các mèo vừa gom bị phá.
  const cleaned = s.grass ? match.cleared.filter(index => s.grass[index]) : [];
  cleaned.forEach(index => { s.grass[index] = false; });
  s.moves--;
  const tutorialAdvanced = advanceTutorial(s, 'place');
  const turn = { ok: true, result, match, gained, tutorialAdvanced, win: false, lose: false, stuck: false, fit: true, cleaned };
  if (goalReached(s)) {
    finish(s, true);
    s.active = drawCard(s); // không để thẻ vừa đặt nằm lại trong ô đang bóc
    return { ...turn, win: true };
  }
  if (s.moves === 0) { finish(s, false, !s.grassTotal && s.score >= s.level.target ? 'Cats still caged!' : 'Out of moves!'); return { ...turn, lose: true }; }
  s.active = drawCard(s);
  const fit = canPlaceAnywhere(s, s.active);
  const stuck = checkStuck(s);
  return { ...turn, fit, stuck, lose: stuck };
}

// ---------- Booster (không tốn lượt; kho booster do boosters.mjs giữ, ở đây chỉ là luật trên bàn) ----------
// Búa: đập vỡ một con mèo hoặc một thùng gỗ; đập vào chuồng thì mở chuồng, thả mèo ra tại chỗ (`freed`).
// Kim loại và ô trống thì không đập được.
export const canSmash = (s, index) => !!s.board[index] && !s.board[index].metal;
export function smash(s, index) {
  if (s.over || tutorialStep(s)) return { ok: false };
  if (!canSmash(s, index)) return { ok: false, error: s.board[index]?.metal ? 'Metal can\'t be smashed.' : 'Pick a cat or a crate.' };
  const object = s.board[index];
  s.board = s.board.slice();
  if (object.cage) {
    const { cage, ...cat } = object;
    s.board[index] = cat;
    if (goalReached(s)) { finish(s, true); return { ok: true, object, freed: true, win: true }; }
    return { ok: true, object, freed: true };
  }
  s.board[index] = null;
  return { ok: true, object };
}
// Đổi thẻ: bỏ thẻ đang bóc, bóc một thẻ ngẫu nhiên mới (thẻ "sắp tới" giữ nguyên để người chơi vẫn tính trước được).
export function swapCard(s) {
  if (s.over || tutorialStep(s)) return { ok: false };
  s.active = withNames(s.deal(s.board));
  return { ok: true };
}
// Thêm lượt.
export function addMoves(s, count) {
  if (s.over || tutorialStep(s)) return { ok: false };
  s.moves += count;
  return { ok: true };
}
