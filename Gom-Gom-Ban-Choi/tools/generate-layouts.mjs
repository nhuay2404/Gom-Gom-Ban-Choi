// Sinh offline các bản bố trí crate/wall theo mức độ khó cho từng màn, ghi vào game/level-layouts.mjs.
// Chạy: node tools/generate-layouts.mjs [số ván bot mỗi ứng viên, mặc định 80]
//
// Mỗi mức có luật số lượng riêng (crate C, wall W của bản gốc):
//   -2  thoáng     crate ≈ C/2, wall ≈ W/2           -1 nhẹ       crate C−1..C−2, wall W hoặc W−1
//   0b  đổi chỗ    giữ số lượng, dời ≥ nửa số vật cản  +1 hiểm      crate C+1..C+2, wall W..W+1
//   +2  rất hiểm   crate C+2..C+3, wall W+1..W+2
// Không bao giờ: đặt lên mèo sẵn hay ô ngoài bàn '#', tạo cụm gom sẵn, thêm loại vật cản trước màn giới thiệu nó.
// Với mỗi mức: sinh ~300 ứng viên, xếp hạng bằng layoutScore (game/layout-score.mjs), cho bot "trung bình" chơi thử
// các ứng viên đứng đầu, giữ bản có tỉ lệ thắng lệch so với bản gốc gần mục tiêu nhất (TARGET_DELTA).
// Cuối cùng kiểm tra thứ tự: −2 ≥ −1 ≥ gốc ≥ +1 ≥ +2 (sai số 3 điểm); mức nào phá thứ tự thì bỏ.
import { writeFileSync } from 'node:fs';
import { LEVELS, parseBoard } from '../game/levels.mjs';
import { clearMatches } from '../game/board-rules.mjs';
import { MATCH_SIZE } from '../game/scoring.mjs';
import { boardSize } from '../game/board-shapes.mjs';
import { isAdaptive } from '../game/adaptive.mjs';
import { layoutScore } from '../game/layout-score.mjs';
import { play, mulberry32 } from './bot.mjs';

const RUNS = Number(process.argv.slice(2).find(arg => /^\d+$/.test(arg)) ?? 80);
const PLAYER = { noise: 40, hold: true };
const TIERS = ['-2', '-1', '0b', '+1', '+2'];
const TARGET_DELTA = { '-2': 0.25, '-1': 0.12, '0b': 0, '+1': -0.12, '+2': -0.22 };
const HARDER = { '-2': false, '-1': false, '0b': null, '+1': true, '+2': true };
const CANDIDATES = 300, TESTED = 12;

const count = (rows, ch) => [...rows.join('')].filter(c => c === ch).length;
const crateFrom = LEVELS.findIndex(l => l.board.join('').includes('X'));
const wallFrom = LEVELS.findIndex(l => l.board.join('').includes('M'));

function counts(tier, C, W, index) {
  const pick = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  const canC = index >= crateFrom, canW = index >= wallFrom;
  return rng => {
    if (tier === '-2') return [Math.floor(C / 2), Math.floor(W / 2)];
    if (tier === '-1') return [Math.max(0, pick(rng, C - 2, C - 1)), Math.max(0, pick(rng, W - 1, W))];
    if (tier === '0b') return [C, W];
    if (tier === '+1') return [canC ? pick(rng, C + 1, C + 2) : C, canW && W ? pick(rng, W, W + 1) : W];
    return [canC ? pick(rng, C + 2, C + 3) : C, canW && W ? pick(rng, W + 1, W + 2) : W];
  };
}

const valid = rows => {
  const { W, H } = boardSize(rows);
  return !clearMatches(parseBoard(rows), W, H, MATCH_SIZE).cleared.length;
};

// Một ứng viên: giữ ngẫu nhiên một phần vật cản gốc ở chỗ cũ, phần còn lại đặt vào ô trống ngẫu nhiên.
function candidate(base, wantC, wantW, rng, moveShare) {
  const { W } = boardSize(base);
  const cells = [...base.join('')];
  const keep = { X: [], M: [] };
  cells.forEach((ch, i) => { if (ch === 'X' || ch === 'M') { keep[ch].push(i); cells[i] = '.'; } });
  const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  for (const [ch, want] of [['X', wantC], ['M', wantW]]) {
    const stay = shuffle(keep[ch]).slice(0, Math.min(want, Math.round(keep[ch].length * (1 - moveShare))));
    stay.forEach(i => { cells[i] = ch; });
    const free = shuffle(cells.map((c, i) => (c === '.' ? i : -1)).filter(i => i >= 0));
    for (let k = stay.length; k < want && free.length; k++) cells[free.pop()] = ch;
  }
  return base.map((_, r) => cells.slice(r * W, (r + 1) * W).join(''));
}

const winRate = (level, salt) => Array.from({ length: RUNS }, (_, r) => play(level, salt * 7919 + r * 104729 + 17, PLAYER)).filter(x => x.win).length / RUNS;

const out = {};
LEVELS.forEach((level, index) => {
  if (!isAdaptive(level)) return;
  const C = count(level.board, 'X'), W = count(level.board, 'M');
  if (!C && !W && index < crateFrom) return;
  const base = winRate(level, index);
  const picked = {}, rates = { 0: base };
  for (const tier of TIERS) {
    const rng = mulberry32(index * 1000 + TIERS.indexOf(tier) + 1), want = counts(tier, C, W, index);
    const seen = new Set(), pool = [];
    for (let k = 0; k < CANDIDATES; k++) {
      const [wc, ww] = want(rng);
      const rows = candidate(level.board, wc, ww, rng, tier === '0b' ? 0.6 : 0.35);
      const key = rows.join('');
      if (seen.has(key) || key === level.board.join('') || !valid(rows)) continue;
      seen.add(key);
      pool.push({ rows, score: layoutScore(rows) });
    }
    if (!pool.length) continue;
    // Mức dễ: lấy điểm bố trí thấp nhất; mức khó: cao nhất; đổi chỗ: gần điểm bản gốc nhất.
    const baseScore = layoutScore(level.board);
    pool.sort((a, b) => (HARDER[tier] === null ? Math.abs(a.score - baseScore) - Math.abs(b.score - baseScore) : HARDER[tier] ? b.score - a.score : a.score - b.score));
    let best = null;
    for (const c of pool.slice(0, TESTED)) {
      const rate = winRate({ ...level, board: c.rows }, index);
      const miss = Math.abs(rate - base - TARGET_DELTA[tier]);
      if (!best || miss < best.miss) best = { ...c, rate, miss };
    }
    picked[tier] = best;
    rates[tier] = best.rate;
  }
  // Thứ tự dễ -> khó phải đúng, nếu không bỏ mức gây sai.
  const order = ['-2', '-1', 0, '+1', '+2'].filter(t => t === 0 || picked[t]);
  for (let k = 1; k < order.length; k++) {
    if (rates[order[k]] > rates[order[k - 1]] + 0.03) {
      const drop = order[k] === 0 ? order[k - 1] : order[k];
      delete picked[drop];
      order.splice(order.indexOf(drop), 1); k = 0;
    }
  }
  if (picked['0b'] && Math.abs(rates['0b'] - base) > 0.08) delete picked['0b'];
  out[level.name] = Object.fromEntries(Object.entries(picked).map(([t, p]) => [t, p.rows]));
  console.log(`${String(index + 1).padStart(2)}. ${level.name.padEnd(16)} gốc ${(base * 100).toFixed(0).padStart(3)}% (X${C} M${W}) | `
    + TIERS.map(t => (picked[t] ? `${t}: ${(rates[t] * 100).toFixed(0)}% X${count(picked[t].rows, 'X')} M${count(picked[t].rows, 'M')}` : `${t}: —`)).join(' | '));
});

const header = `// SINH TỰ ĐỘNG bởi tools/generate-layouts.mjs (bot "trung bình", ${RUNS} ván mỗi ứng viên). Có thể sửa tay từng bản;
// chạy lại công cụ sẽ ghi đè. Khoá là tên màn, giá trị là bàn (cùng định dạng levels.mjs) theo mức:
//   '-2' thoáng · '-1' nhẹ · '0b' đổi chỗ vật cản (giữ số lượng) · '+1' hiểm · '+2' rất hiểm. Mức nào không có = dùng cách cũ.
// adaptive.mjs chọn mức theo profile người chơi.
`;
writeFileSync(new URL('../game/level-layouts.mjs', import.meta.url), `${header}export const LAYOUTS = ${JSON.stringify(out, null, 2)};\n`);
console.log('\nĐã ghi game/level-layouts.mjs');
