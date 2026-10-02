// Mô phỏng mọi màn bằng bot tham lam (xét mọi hướng xoay, mọi ô, có dùng Gửi tạm) để cân độ khó.
// Chạy: node tools/simulate-levels.mjs [số ván mỗi màn] [--sweep] [--dda] [--json] [--baseline]
//   --dda       tỉ lệ thắng của từng bản biến thể theo số element (độ khó thích ứng, adaptive.mjs)
//   --baseline  ghi kết quả vào tools/baseline.json (mốc để đối chiếu sau khi port sang Cocos)
//   --json      in kết quả dạng JSON
// Cùng seed luôn ra cùng kết quả (bộ chia thẻ và bot đều dùng số ngẫu nhiên có seed).
// Bot chỉ nhìn 1 nước nên yếu hơn người chơi thật một chút: tỉ lệ thắng của bot là cận dưới.
import { LEVELS, parseBoard, parseCard, boardSize } from '../game/levels.mjs';
import { holdUnlocked } from '../game/tuning.mjs';
import { playableCells } from '../game/board-shapes.mjs';
import { clearMatches } from '../game/board-rules.mjs';
import { MATCH_SIZE } from '../game/scoring.mjs';
import { play } from './bot.mjs';
import { writeFileSync } from 'node:fs';

const RUNS = Number(process.argv.slice(2).find(arg => /^\d+$/.test(arg)) ?? 400);
const JSON_OUT = process.argv.includes('--json'), BASELINE = process.argv.includes('--baseline');

// Kiểm tra dữ liệu màn: bàn không có sẵn cụm gom được, ô tutorial hợp lệ.
function validate(level, n) {
  const board = parseBoard(level.board), { W, H } = boardSize(level.board);
  if (level.board.some(row => row.length !== W)) throw new Error(`Màn ${n}: các hàng của bàn không cùng độ dài`);
  if (clearMatches(board, W, H, MATCH_SIZE).cleared.length) throw new Error(`Màn ${n}: bàn đầu đã có cụm gom được`);
  (level.deck || []).forEach(spec => { if (parseCard(spec).items.some(item => !item.group)) throw new Error(`Màn ${n}: thẻ lỗi ${spec}`); });
}

const boardLabel = level => { const { W, H } = boardSize(level.board); return `${W}×${H} ${playableCells(level.board)}ô`; };
const log = (...args) => { if (!JSON_OUT) console.log(...args); };
const rows = [];
log(`Mô phỏng ${RUNS} ván mỗi màn\n`);
log('Màn | Tên              | Bàn         | Lượt | Mục tiêu | Thắng | Kẹt  | ★ TB | Điểm TB');
LEVELS.forEach((level, i) => {
  validate(level, i + 1);
  const results = Array.from({ length: RUNS }, (_, run) => play(level, (i + 1) * 100000 + run, { hold: holdUnlocked(i) }));
  const wins = results.filter(r => r.win), stuck = results.filter(r => r.reason === 'stuck').length;
  const stars = wins.length ? wins.reduce((s, r) => s + r.stars, 0) / wins.length : 0;
  const avg = results.reduce((s, r) => s + r.score, 0) / RUNS;
  rows.push({ level: i + 1, name: level.name, board: boardLabel(level), tier: level.tier || 'normal', moves: level.moves, target: level.target, winRate: +(wins.length / RUNS).toFixed(3), stuckRate: +(stuck / RUNS).toFixed(3), avgStars: +stars.toFixed(2), avgScore: Math.round(avg) });
  log(`${String(i + 1).padStart(3)} | ${level.name.padEnd(16)} | ${boardLabel(level).padEnd(11)} | ${String(level.moves).padStart(4)} | ${String(level.target).padStart(8)} | ${(wins.length / RUNS * 100).toFixed(0).padStart(4)}% | ${(stuck / RUNS * 100).toFixed(0).padStart(3)}% | ${stars.toFixed(1).padStart(4)} | ${avg.toFixed(0).padStart(6)}`);
});

const report = { runsPerLevel: RUNS, seed: 'level × 100000 + run', note: 'bot tham lam nhìn 1 nước; tỉ lệ thắng là cận dưới của người chơi thật', levels: rows };
if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
if (BASELINE) { writeFileSync(new URL('./baseline.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`); log('\nĐã ghi tools/baseline.json'); }

// --dda: tỉ lệ thắng của bot ở từng bản biến thể theo số element (adaptive.mjs). Bản ít element phải thắng
// nhiều hơn; dòng nào đảo thứ tự thì gắn "!" để xem lại.
if (process.argv.includes('--dda')) {
  const { buildVariant, elementCount, isAdaptive } = await import('../game/adaptive.mjs');
  console.log('\nĐộ khó thích ứng: tỉ lệ thắng theo số element (* = bản gốc)');
  LEVELS.forEach((base, i) => {
    if (!isAdaptive(base)) return;
    const seen = new Set(), row = [];
    for (let target = 0; target <= 5; target++) {
      const level = buildVariant(base, target), count = elementCount(level);
      if (seen.has(count)) continue;
      seen.add(count);
      const wins = Array.from({ length: 200 }, (_, run) => play(level, (i + 1) * 100000 + run, { hold: holdUnlocked(i) })).filter(r => r.win).length / 200;
      row.push({ count, wins, mark: count === elementCount(base) ? '*' : '' });
    }
    const ordered = row.every((cell, k) => !k || cell.wins <= row[k - 1].wins + 0.05);
    console.log(`${String(i + 1).padStart(2)}. ${base.name.padEnd(16)} ${row.map(c => `${c.count}${c.mark}:${(c.wins * 100).toFixed(0).padStart(3)}%`).join('  ')}${ordered ? '' : '  !'}`);
  });
}

// --sweep: thử nhiều mức mục tiêu để chọn mức cho đúng đường cong độ khó.
if (process.argv.includes('--sweep')) {
  console.log('\nSweep mục tiêu (tỉ lệ thắng của bot):');
  LEVELS.forEach((level, i) => {
    if (i < 2) return;
    const row = [];
    for (let k = 1; k <= 2.2; k += 0.2) {
      const target = Math.round(level.target * k / 10) * 10;
      const wins = Array.from({ length: 200 }, (_, run) => play({ ...level, target }, (i + 1) * 100000 + run, { hold: holdUnlocked(i) })).filter(r => r.win).length;
      row.push(`${target}:${(wins / 2).toFixed(0)}%`);
    }
    console.log(`${i + 1}. ${level.name.padEnd(14)} ${row.join('  ')}`);
  });
}
