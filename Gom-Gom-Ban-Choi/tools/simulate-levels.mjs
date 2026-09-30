// Mô phỏng mọi màn bằng bot tham lam (xét mọi hướng xoay, mọi ô, có dùng Gửi tạm) để cân độ khó.
// Chạy: node tools/simulate-levels.mjs [số ván mỗi màn]
// Bot chỉ nhìn 1 nước nên yếu hơn người chơi thật một chút: tỉ lệ thắng của bot là cận dưới.
import { LEVELS, parseBoard, parseCard, makeDealer, starsFor } from '../game/levels.mjs';
import { clearMatches, placementIndices, rotateOffsets, connectedGroup } from '../game/board-rules.mjs';
import { MATCH_SIZE, matchPoints } from '../game/scoring.mjs';

const W = 6, H = 6, RUNS = Number(process.argv[2] ?? 400);
function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rotations = offsets => { const out = [offsets]; for (let i = 0; i < 3; i++) out.push(rotateOffsets(out.at(-1))); return out; };
const fits = (board, card) => rotations(card.offsets).some(o => board.some((_, a) => placementIndices(board, W, H, a, o)));

function bestMove(board, card) {
  let best = null;
  for (const offsets of rotations(card.offsets)) for (let anchor = 0; anchor < W * H; anchor++) {
    const indices = placementIndices(board, W, H, anchor, offsets);
    if (!indices) continue;
    const next = board.slice();
    indices.forEach((index, i) => { next[index] = { group: card.items[i].group }; });
    const match = clearMatches(next, W, H, MATCH_SIZE);
    const points = matchPoints(match.clusters);
    // Chưa gom được thì ưu tiên nước tạo cụm 2 (chuẩn bị gom), phạt nước làm bàn chật.
    let setup = 0;
    indices.forEach(index => { if (match.board[index]) setup += connectedGroup(match.board, W, H, index).length - 1; });
    const empty = match.board.filter(cell => !cell).length;
    const value = points * 10 + setup * 6 + empty * 0.5 + Math.random();
    if (!best || value > best.value) best = { value, match, points };
  }
  return best;
}

function play(level, seed) {
  const rng = mulberry32(seed), deal = makeDealer(level, rng);
  let board = parseBoard(level.board), score = 0, moves = level.moves, hold = null;
  const queue = [];
  const draw = () => { while (queue.length < 2) queue.push(deal(board)); return queue.shift(); };
  let active = draw();
  while (moves > 0) {
    // Lựa chọn: đặt thẻ đang bóc, hoặc đổi với Gửi tạm (ô trống thì cất và rút thẻ kế).
    const options = [{ card: active, after: () => {} }];
    const swapCard = hold || queue[0];
    options.push({ card: swapCard, after: () => { if (hold) hold = active; else { hold = active; queue.shift(); } } });
    let pick = null;
    for (const option of options) {
      const move = bestMove(board, option.card);
      if (move && (!pick || move.value > pick.move.value)) pick = { option, move };
    }
    if (!pick) return { win: false, reason: 'stuck', score };
    const swapping = pick.option.card !== active;
    if (swapping) pick.option.after();
    score += pick.move.points;
    board = pick.move.match.board;
    moves--;
    if (score >= level.target) return { win: true, stars: starsFor(level, moves), score };
    active = draw();
    if (!fits(board, active) && !(hold ? fits(board, hold) : true)) return { win: false, reason: 'stuck', score };
  }
  return { win: false, reason: 'moves', score };
}

// Kiểm tra dữ liệu màn: bàn không có sẵn cụm gom được, ô tutorial hợp lệ.
function validate(level, n) {
  const board = parseBoard(level.board);
  if (board.length !== 36) throw new Error(`Màn ${n}: bàn không đủ 36 ô`);
  if (clearMatches(board, W, H, MATCH_SIZE).cleared.length) throw new Error(`Màn ${n}: bàn đầu đã có cụm gom được`);
  (level.deck || []).forEach(spec => { if (parseCard(spec).items.some(item => !item.group)) throw new Error(`Màn ${n}: thẻ lỗi ${spec}`); });
}

console.log(`Mô phỏng ${RUNS} ván mỗi màn\n`);
console.log('Màn | Tên              | Lượt | Mục tiêu | Thắng | Kẹt  | ★ TB | Điểm TB');
LEVELS.forEach((level, i) => {
  validate(level, i + 1);
  const results = Array.from({ length: RUNS }, (_, run) => play(level, (i + 1) * 100000 + run));
  const wins = results.filter(r => r.win), stuck = results.filter(r => r.reason === 'stuck').length;
  const stars = wins.length ? wins.reduce((s, r) => s + r.stars, 0) / wins.length : 0;
  const avg = results.reduce((s, r) => s + r.score, 0) / RUNS;
  console.log(`${String(i + 1).padStart(3)} | ${level.name.padEnd(16)} | ${String(level.moves).padStart(4)} | ${String(level.target).padStart(8)} | ${(wins.length / RUNS * 100).toFixed(0).padStart(4)}% | ${(stuck / RUNS * 100).toFixed(0).padStart(3)}% | ${stars.toFixed(1).padStart(4)} | ${avg.toFixed(0).padStart(6)}`);
});

// --sweep: thử nhiều mức mục tiêu để chọn mức cho đúng đường cong độ khó.
if (process.argv.includes('--sweep')) {
  console.log('\nSweep mục tiêu (tỉ lệ thắng của bot):');
  LEVELS.forEach((level, i) => {
    if (i < 2) return;
    const row = [];
    for (let k = 1; k <= 2.2; k += 0.2) {
      const target = Math.round(level.target * k / 10) * 10;
      const wins = Array.from({ length: 200 }, (_, run) => play({ ...level, target }, (i + 1) * 100000 + run)).filter(r => r.win).length;
      row.push(`${target}:${(wins / 2).toFixed(0)}%`);
    }
    console.log(`${i + 1}. ${level.name.padEnd(14)} ${row.join('  ')}`);
  });
}
