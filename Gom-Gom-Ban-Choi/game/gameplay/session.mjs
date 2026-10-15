// Một ván chơi (thuần logic, không đụng giao diện): bóc thẻ, xoay, gửi tạm, đặt, gom, thắng/thua, tutorial.
// Giao diện (main.js trên web, component Cocos sau này) chỉ gọi các hàm dưới đây rồi vẽ theo kết quả trả về;
// không tự sửa luật. Mọi hàm nhận `s` (session) và sửa trực tiếp trên nó.
import { clearMatches, connectedGroup, removeClusters, placementIndices, placeCard, rotateOffsets } from './board-rules.mjs';
import { MATCH_SIZE, turnPoints, clusterPoints, POINTS_PER_CRATE } from './scoring.mjs';
import { categories } from '../ui/cat-art.mjs';
import { LEVELS, LETTERS, SHAPES, DEFAULT_SHAPES, parseBoard, makeDealer, starsFor, boardSize, parseGrass, grassCount } from './levels.mjs';
import { BOARD, LUCKY, EFFECTS, holdUnlocked } from './tuning.mjs';
import { clusterEffects } from './cluster-effects.mjs';

const { PREVIEW_COUNT } = BOARD;
const withNames = card => ({ offsets: card.offsets, items: card.items.map(({ group }) => ({ group, name: categories[group].name })) });

// `level`: bản màn đã chỉnh độ khó (adaptive.mjs); không truyền thì dùng màn gốc.
// s.W × s.H = kích thước bàn của màn; s.holdOn = màn đã mở ô Hold chưa (tuning.mjs: HOLD).
// s.grass = ô nào còn cỏ (mảng true/false, null nếu màn không có cỏ) · s.grassTotal = số ô cỏ lúc đầu (> 0 = phải dọn hết cỏ, thêm vào mục tiêu điểm).
export function createSession(levelIndex, { rng = Math.random, level = LEVELS[levelIndex] } = {}) {
  const { W, H } = boardSize(level.board);
  const s = {
    level, levelIndex, W, H, holdOn: holdUnlocked(levelIndex), grass: parseGrass(level), grassTotal: grassCount(level),
    board: parseBoard(level.board), deal: makeDealer(level, rng), rng, deck: [], active: null, hold: null,
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
  // Đổi thẻ (booster) còn lượt may mắn: thẻ bóc ra là thẻ có lợi nhất cho bàn hiện tại; thẻ "sắp tới" vẫn giữ trong hàng.
  if (s.lucky > 0) { s.lucky--; return luckyCard(s); }
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
// Mọi màn phải đủ điểm + thả hết chuồng; màn có cỏ còn phải dọn hết cỏ.
export const goalReached = s => cagesLeft(s) === 0 && grassLeft(s) === 0 && s.score >= s.level.target;
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
  // Cỏ dưới các mèo vừa gom bị phá.
  const cleaned = s.grass ? match.cleared.filter(index => s.grass[index]) : [];
  cleaned.forEach(index => { s.grass[index] = false; });
  // Cụm to / gom đôi: hiệu ứng chạy tiếp trên bàn sau khi gom (cluster-effects.mjs); gom đôi nhân điểm cả lượt.
  const effect = clusterEffects(match, result.indices, s.W, s.H, s.grass);
  const gained = Math.round((turnPoints(match) + effect.points) * (effect.double ? EFFECTS.DOUBLE_MULT : 1));
  s.board = effect.board;
  if (effect.grass) s.grass = effect.grass;
  s.score += gained;
  s.moves--;
  const tutorialAdvanced = advanceTutorial(s, 'place');
  const turn = { ok: true, result, match, effect, gained, tutorialAdvanced, win: false, lose: false, stuck: false, fit: true, cleaned };
  if (goalReached(s)) {
    finish(s, true);
    s.active = drawCard(s); // không để thẻ vừa đặt nằm lại trong ô đang bóc
    return { ...turn, win: true };
  }
  if (s.moves === 0) { finish(s, false, s.score >= s.level.target && !grassLeft(s) ? 'Cats still caged!' : 'Out of moves!'); return { ...turn, lose: true }; }
  s.active = drawCard(s);
  const fit = canPlaceAnywhere(s, s.active);
  const stuck = checkStuck(s);
  return { ...turn, fit, stuck, lose: stuck };
}

// ---------- Booster (không tốn lượt; kho booster do boosters.mjs giữ, ở đây chỉ là luật trên bàn) ----------
// Búa: đập vùng 3×3 quanh ô chạm, xoá MỌI thứ trong vùng (mèo, mèo trong chuồng, thùng, kim loại) + phá cỏ; ô ngoài bàn ('#') giữ nguyên.
// Điểm như gom: mèo cùng màu trong vùng tính như một cụm (clusterPoints theo số con), thùng / kim loại / chuồng mỗi cái POINTS_PER_CRATE.
export const canSmash = (s, index) => index >= 0 && index < s.board.length && !s.board[index]?.void;
export function smash(s, index) {
  if (s.over || tutorialStep(s)) return { ok: false };
  if (!canSmash(s, index)) return { ok: false, error: 'Pick a cell on the board.' };
  const turn = smashArea(s, index);
  if (!turn.ok) return turn;
  if (goalReached(s)) { finish(s, true); return { ...turn, win: true }; }
  return turn;
}
// Đập 3×3 (luật búa, không kiểm tra lượt / thắng).
function smashArea(s, index) {
  const r = Math.floor(index / s.W), c = index % s.W, cells = [];
  for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < s.H && x >= 0 && x < s.W && !s.board[y * s.W + x]?.void) cells.push(y * s.W + x);
  const removed = cells.filter(i => s.board[i]).map(i => ({ index: i, object: s.board[i] }));
  const cleaned = s.grass ? cells.filter(i => s.grass[i]) : [];
  if (!removed.length && !cleaned.length) return { ok: false, error: 'Nothing to smash here.' };
  const perGroup = {};
  let points = 0;
  removed.forEach(({ object }) => { if (object.group && !object.cage) perGroup[object.group] = (perGroup[object.group] || 0) + 1; else points += POINTS_PER_CRATE; });
  points += Object.values(perGroup).reduce((sum, n) => sum + clusterPoints(n), 0);
  s.board = s.board.slice();
  removed.forEach(({ index: i }) => { s.board[i] = null; });
  cleaned.forEach(i => { s.grass[i] = false; });
  s.score += points;
  return { ok: true, cells, removed, cleaned, points };
}
// Đổi thẻ: thẻ đang bóc + LUCKY_TURNS - 1 thẻ bóc sau đó là thẻ có lợi nhất cho bàn lúc bóc (luckyCard).
// Thẻ "sắp tới" giữ nguyên trong hàng, ra sau khi hết lượt may mắn.
export function swapCard(s) {
  if (s.over || tutorialStep(s)) return { ok: false };
  s.lucky = LUCKY.TURNS - 1;
  s.active = luckyCard(s);
  return { ok: true };
}
// Thẻ có lợi nhất: thử mọi hình thẻ của màn × tổ hợp màu đang có trên bàn (tối đa 4 màu đông nhất) × mọi hướng xoay / ô đặt;
// giá trị = điểm cả lượt (gồm hiệu ứng cụm to / gom đôi) + 10 mỗi ô cỏ / khoá chuồng phá được.
// Trả về { card, anchor, value } (card đã xoay đúng hướng đặt), không gom được gì thì null.
export function bestPlay(s) {
  const counts = {};
  s.board.forEach(o => { if (o?.group && !o.cage) counts[o.group] = (counts[o.group] || 0) + 1; });
  const colors = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
  const weights = s.level.shapes || DEFAULT_SHAPES;
  const shapes = Object.keys(weights).filter(k => weights[k] > 0).flatMap(k => (k === 'triple' ? ['line', 'elbow'] : [k]));
  const combos = n => (n === 0 ? [[]] : combos(n - 1).flatMap(rest => colors.map(color => [...rest, color])));
  let best = null;
  for (const shape of shapes) for (const groups of combos(SHAPES[shape].length)) {
    let offsets = SHAPES[shape].map(p => p.slice());
    for (let turn = 0; turn < 4; turn++, offsets = rotateOffsets(offsets)) for (let anchor = 0; anchor < s.board.length; anchor++) {
      const card = { offsets, items: groups.map(group => ({ group })) };
      const placed = placeCard(s.board, s.W, s.H, anchor, card);
      if (placed.error) continue;
      const match = clearMatches(placed.board, s.W, s.H, MATCH_SIZE);
      if (!match.cleared.length) continue;
      const fx = clusterEffects(match, placed.indices, s.W, s.H, s.grass);
      const grassHit = s.grass ? match.cleared.filter(i => s.grass[i]).length + fx.cleaned.length : 0;
      const value = (turnPoints(match) + fx.points) * (fx.double ? EFFECTS.DOUBLE_MULT : 1) + 10 * (grassHit + match.caged.length + match.freed.length + fx.caged.length + fx.freed.length);
      if (!best || value > best.value) best = { value, card, anchor };
    }
  }
  return best;
}
export function luckyCard(s) {
  const best = bestPlay(s);
  return withNames(best ? best.card : s.deal(s.board));
}

// ---------- Xả lượt sau khi thắng (sao đã chốt lúc thắng, chỉ cộng điểm) ----------
// Mỗi finaleTurn = một lượt AI thật: chọn thẻ (hàng thẻ được sắp lại) gom trọn MỘT cụm mèo tự do (cụm ≤ 4 sau khi gom để không
// nổ lan sang cụm khác). Còn R lượt mà bàn chỉ có C < R cụm thì bàn mọc thêm R − C "mảnh câu đố" (1–2 mèo, không chạm mèo cùng
// màu, có chỗ cho thẻ giải) → đúng R lượt là sạch bàn. Hết lượt mà còn mèo thì AI chơi tiếp (lượt thưởng, `extra`) tới khi sạch.
// Cụm không giải được bằng thẻ (bị vây kín) thì tự nổ luôn (`popped`).
const FINALE_SHAPES = [SHAPES.single, SHAPES.domino, SHAPES.line, SHAPES.elbow];
export function finaleTurn(s) {
  if (!s.outcome?.win) return { ok: false };
  let clusters = freeClusters(s);
  const spawned = clusters.length < s.moves ? spawnPieces(s, s.moves - clusters.length) : [];
  if (spawned.length) clusters = freeClusters(s);
  if (!clusters.length) return { ok: false };
  const extra = s.moves <= 0, before = s.board;
  // Cụm nhỏ trước (mảnh câu đố), cụm nào giải được bằng thẻ thì giải; không cụm nào giải được thì nổ cụm nhỏ nhất.
  clusters.sort((a, b) => a.length - b.length);
  let play = null;
  for (const cluster of clusters) if ((play = solveCluster(s, cluster))) break;
  let result, match;
  if (play) {
    s.active = withNames(play.card);
    result = placeCard(s.board, s.W, s.H, play.anchor, s.active);
    match = clearMatches(result.board, s.W, s.H, MATCH_SIZE);
  } else {
    const cluster = clusters[0];
    result = { board: before, indices: [] };
    match = removeClusters(s.board, s.W, s.H, [cluster], [s.board[cluster[0]].group]);
  }
  const cleaned = s.grass ? match.cleared.filter(index => s.grass[index]) : [];
  cleaned.forEach(index => { s.grass[index] = false; });
  const effect = clusterEffects(match, result.indices, s.W, s.H, s.grass);
  const gained = turnPoints(match) + effect.points;
  s.board = effect.board;
  if (effect.grass) s.grass = effect.grass;
  s.score += gained;
  if (!extra) s.moves--;
  return { ok: true, spawned, spawnBoard: spawned.length ? before : null, result, match, effect, gained, cleaned, extra, popped: !play };
}
const freeClusters = s => {
  const seen = new Set(), out = [];
  s.board.forEach((o, i) => {
    if (!o?.group || o.cage || seen.has(i)) return;
    const group = connectedGroup(s.board, s.W, s.H, i);
    group.forEach(k => seen.add(k));
    out.push(group);
  });
  return out;
};
// Thẻ cùng màu gom trọn `cluster` mà không nối thêm mèo khác (cụm sau khi gom ≤ 4: tối đa Pounce, không nổ lan). Ưu tiên cụm 4.
function solveCluster(s, cluster) {
  const group = s.board[cluster[0]].group;
  let best = null;
  for (const shape of FINALE_SHAPES) {
    if (cluster.length + shape.length < MATCH_SIZE || cluster.length + shape.length > 4) continue;
    let offsets = shape;
    for (let turn = 0; turn < 4; turn++, offsets = rotateOffsets(offsets)) for (let anchor = 0; anchor < s.board.length; anchor++) {
      const card = { offsets, items: offsets.map(() => ({ group })) };
      const placed = placeCard(s.board, s.W, s.H, anchor, card);
      if (placed.error) continue;
      const match = clearMatches(placed.board, s.W, s.H, MATCH_SIZE);
      if (match.clusters.length !== 1 || match.cleared.length !== cluster.length + shape.length || !cluster.every(i => match.cleared.includes(i))) continue;
      if (!best || match.cleared.length > best.size) best = { card, anchor, size: match.cleared.length };
    }
  }
  return best;
}
// Mọc `count` mảnh câu đố (1–2 mèo cùng màu) ở chỗ trống ngẫu nhiên: không chạm mèo cùng màu, và giải được bằng một thẻ
// (bàn quá kín thì mèo lẻ tự nổ).
function spawnPieces(s, count) {
  const rng = s.rng || Math.random, spawned = [];
  const colors = [...(s.level.cats || 'OGW')].map(ch => LETTERS[ch]);
  const neighbors = i => [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dy, dx]) => [Math.floor(i / s.W) + dy, (i % s.W) + dx])
    .filter(([y, x]) => y >= 0 && y < s.H && x >= 0 && x < s.W).map(([y, x]) => y * s.W + x);
  const empties = () => s.board.map((o, i) => (o ? -1 : i)).filter(i => i >= 0).sort(() => rng() - .5);
  for (let k = 0; k < count; k++) {
    let done = false;
    for (const cell of empties()) {
      const pairWith = rng() < .5 ? neighbors(cell).find(n => !s.board[n]) : undefined;
      const piece = pairWith === undefined ? [cell] : [cell, pairWith];
      const touching = new Set(piece.flatMap(neighbors).filter(n => !piece.includes(n)).map(n => s.board[n]?.group).filter(Boolean));
      for (const group of colors.filter(g => !touching.has(g)).sort(() => rng() - .5)) {
        const board = s.board;
        s.board = board.slice();
        piece.forEach(i => { s.board[i] = { group, locked: true }; });
        if (solveCluster(s, piece)) { spawned.push(...piece); done = true; break; }
        s.board = board;
      }
      if (done) break;
    }
    // Không chỗ nào đủ cho mảnh + thẻ giải (bàn kín vật cản): vẫn mọc 1 mèo vào ô trống, lượt đó nó tự nổ (finaleTurn `popped`).
    if (!done) {
      const cell = empties()[0];
      if (cell === undefined) break;
      const touching = new Set(neighbors(cell).map(n => s.board[n]?.group).filter(Boolean));
      s.board = s.board.slice();
      s.board[cell] = { group: colors.find(g => !touching.has(g)) || colors[0], locked: true };
      spawned.push(cell);
    }
  }
  return spawned;
}

// Thêm lượt.
export function addMoves(s, count) {
  if (s.over || tutorialStep(s)) return { ok: false };
  s.moves += count;
  return { ok: true };
}
