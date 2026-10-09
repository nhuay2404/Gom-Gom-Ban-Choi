// Sinh bố trí mèo đặt sẵn cho DDA (game/gameplay/cat-layouts.mjs). Chạy: npm run cat-layouts [-- tên màn hoặc số màn ...]
// DDA không đổi thiết kế (bàn, vật cản, chuồng, lượt): chỉ được xê dịch vài con mèo tự do. Độ khó của một bố trí không đoán
// được bằng công thức (dời mèo còn ảnh hưởng phá thùng, mở chuồng, chỗ trống) nên ĐO bằng bot "trung bình" trên cùng bộ seed
// với bố trí thiết kế, rồi chỉ giữ bố trí lệch nhẹ đúng khoảng của từng mức (BANDS, điểm % tỉ lệ thắng):
//   -2 dễ hơn rõ · -1 dễ hơn chút · 0 khác chỗ mà độ khó như thiết kế (cho người chơi chán) · +1 khó hơn chút · +2 khó hơn rõ.
// Mỗi mức giữ tối đa KEEP bố trí để người chơi gặp lại màn không thấy y hệt. Hàng thẻ (tuneDealer) cộng thêm lúc chơi.
import { writeFileSync, readFileSync } from 'node:fs';
import { LEVELS } from '../game/gameplay/levels.mjs';
import { isAdaptive, nudgeCats, mulberry32, hashOf } from '../game/gameplay/adaptive.mjs';
import { holdUnlocked } from '../game/gameplay/tuning.mjs';
import { play } from './bot.mjs';

const BANDS = { '-2': [6, 14], '-1': [2, 7], 0: [-2, 2], 1: [-7, -2], 2: [-14, -6] };
const NOISE = 30, CANDIDATES = 40, SCREEN = 60, RUNS = 200, KEEP = 3, MAX_MOVES = 3;
const FILE = new URL('../game/gameplay/cat-layouts.mjs', import.meta.url);

const only = process.argv.slice(2);
const pick = (level, i) => !only.length || only.includes(String(i + 1)) || only.includes(level.name);
const old = await import(FILE.href).then(m => m.CAT_LAYOUTS).catch(() => ({}));
const out = { ...old };

const rate = (level, i, runs) => {
  let wins = 0;
  for (let r = 0; r < runs; r++) if (play(level, (i + 1) * 100000 + r, { noise: NOISE, hold: holdUnlocked(i) }).win) wins++;
  return wins / runs * 100;
};

// Ghi file sau MỖI màn: công cụ chạy lâu (~1 phút / màn), bị dừng giữa chừng vẫn giữ được các màn đã đo.
function save() {
  const ordered = Object.fromEntries(LEVELS.filter(l => out[l.name]).map(l => [l.name, out[l.name]]));
  writeFileSync(FILE, `// SINH TỰ ĐỘNG bởi tools/generate-cat-layouts.mjs (bot noise ${NOISE}, ${RUNS} ván / bố trí). Đừng sửa tay; chạy lại công cụ
// sau khi sửa màn (npm run cat-layouts). Khoá = tên màn; mức -2 … 2 (âm = dễ hơn) -> các bố trí mèo đã đo (cùng định dạng levels.mjs).
// Bố trí không còn đúng thiết kế của màn (màn bị sửa sau khi sinh) bị adaptive.mjs bỏ qua.
export const CAT_LAYOUTS = ${JSON.stringify(ordered, null, 2)};
`);
  return Object.keys(ordered).length;
}

const started = Date.now();
LEVELS.forEach((base, i) => {
  if (!isAdaptive(base) || !pick(base, i)) return;
  const base60 = rate(base, i, SCREEN), base200 = rate(base, i, RUNS);
  const rng = mulberry32(hashOf(base.name)), seen = new Set([base.board.join('')]), table = {};
  for (let k = 0; k < CANDIDATES; k++) {
    const rows = nudgeCats(base.board, rng, MAX_MOVES);
    if (!rows || seen.has(rows.join(''))) continue;
    seen.add(rows.join(''));
    const quick = rate({ ...base, board: rows }, i, SCREEN) - base60;
    if (!Object.values(BANDS).some(([lo, hi]) => quick >= lo - 6 && quick <= hi + 6)) continue;
    const delta = rate({ ...base, board: rows }, i, RUNS) - base200;
    for (const [shift, [lo, hi]] of Object.entries(BANDS)) {
      if (delta < lo || delta > hi) continue;
      (table[shift] ??= []).push({ rows, delta });
      break;
    }
  }
  const kept = {};
  for (const [shift, list] of Object.entries(table)) {
    // Ưu tiên bố trí sát giữa khoảng của mức (ổn định nhất).
    const [lo, hi] = BANDS[shift], mid = (lo + hi) / 2;
    kept[shift] = list.sort((a, b) => Math.abs(a.delta - mid) - Math.abs(b.delta - mid)).slice(0, KEEP);
  }
  out[base.name] = Object.fromEntries(Object.entries(kept).map(([s, list]) => [s, list.map(x => x.rows)]));
  const summary = ['-2', '-1', '0', '1', '2'].map(s => `${s}:${(kept[s] || []).map(x => (x.delta > 0 ? '+' : '') + x.delta.toFixed(0)).join(',') || '—'}`).join('  ');
  save();
  console.log(`${String(i + 1).padStart(2)}. ${base.name.padEnd(20)} gốc ${base200.toFixed(0).padStart(3)}%  ${summary}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
});

console.log(`
Đã ghi game/gameplay/cat-layouts.mjs (${save()} màn)`);
