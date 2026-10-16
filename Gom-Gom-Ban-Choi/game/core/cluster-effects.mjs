// Hiệu ứng khi gom cụm to / gom đôi (thuần logic). Chạy trên bàn SAU khi gom thường (clearMatches).
//   cụm 4: pounce — phá 1 lớp vật cản (thùng, khoá chuồng, cỏ) ở các ô kề quanh cụm, không xoá mèo
//   cụm 5: yarn   — nổ 3×3 quanh điểm tụ
//   cụm 6: cross  — xoá hàng + cột qua điểm tụ
//   cụm 7+: herd  — gom mọi mèo cùng màu còn trên bàn + mở 1 khoá chuồng gần nhất
// Gom đôi (2+ cụm): 3+3 → leap (mèo vồ 1 lớp vật cản gần nhất; bàn không còn vật cản thì xoá 2 mèo lẻ) · 4+4 → 2 pounce + yarn · 5+ & 5+ → 2 yarn + herd màu đông nhất · lệch cỡ → hiệu ứng cụm to.
// Điểm cả lượt nhân DOUBLE_MULT khi gom đôi (session.mjs).
import { mergeTarget, wakeFatCats } from './board-rules.mjs';
import { rollPoints } from './scoring.mjs';
import { EFFECTS } from '../data/tuning.mjs';

const kindOf = size => (size >= 7 ? 'herd' : size === 6 ? 'cross' : size === 5 ? 'yarn' : size === 4 ? 'pounce' : null);
const ring = (cells, W, H) => {
  const own = new Set(cells), out = new Set();
  cells.forEach(i => { const r = Math.floor(i / W), c = i % W;
    [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([y, x]) => { if (y >= 0 && y < H && x >= 0 && x < W && !own.has(y * W + x)) out.add(y * W + x); }); });
  return [...out];
};
const square = (center, W, H) => { const r = Math.floor(center / W), c = center % W, out = [];
  for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < H && x >= 0 && x < W) out.push(y * W + x);
  return out; };
const cross = (center, W, H) => { const r = Math.floor(center / W), c = center % W, out = [];
  for (let x = 0; x < W; x++) out.push(r * W + x);
  for (let y = 0; y < H; y++) if (y !== r) out.push(y * W + c);
  return out; };

// match = kết quả clearMatches, placed = ô vừa đặt thẻ, grass = mảng cỏ (hoặc null). Không sửa input.
export function clusterEffects(match, placed, W, H, grass) {
  const sizes = match.clusters.map(c => c.length).sort((a, b) => b - a);
  const out = { effects: [], board: match.board, blasted: [], broken: [], caged: [], freed: [], cleaned: [], woke: [], rolled: [], points: 0, double: sizes.length >= 2 };
  if (!sizes.length) return out;
  const board = match.board.slice(), lawn = grass ? grass.slice() : null;
  const hitCage = new Set(), fatHits = new Map();
  let runFat = new Set();
  // Một ô bị trúng: mèo thường bị xoá (trừ pounce), thùng vỡ, chuồng mất 1 khoá (mỗi chuồng 1 lần / lượt), cỏ bị phá,
  // mèo béo được đánh thức 1 lần mỗi hiệu ứng (dù trúng mấy ô của nó).
  const hit = (i, catsToo) => {
    let pts = 0;
    const cell = board[i];
    if (lawn?.[i]) { lawn[i] = false; out.cleaned.push(i); }
    if (!cell) return pts;
    if (cell.fat) { runFat.add(cell.fatId); return pts; }
    if (cell.cage) { if (hitCage.has(i)) return pts; hitCage.add(i);
      const { cage, ...cat } = cell;
      if (cage > 1) { board[i] = { ...cell, cage: cage - 1 }; out.caged.push(i); } else { board[i] = cat; out.freed.push(i); }
    } else if (cell.block) { if (!cell.metal) { board[i] = null; out.broken.push(i); pts += 10; } }
    else if (catsToo) { board[i] = null; out.blasted.push(i); pts += 10; }
    return pts;
  };
  const run = (kind, cluster, center) => {
    let pts = 0, cells, catsToo = kind !== 'pounce';
    runFat = new Set();
    if (kind === 'leap') {
      const obstacle = nearest(board, center, W, i => (board[i]?.block && !board[i].metal) || board[i]?.cage || board[i]?.fat || (lawn?.[i] && !board[i]?.void));
      cells = obstacle.slice(0, 1);
      catsToo = !cells.length;
      if (catsToo) cells = nearest(board, center, W, i => board[i]?.group && !board[i].cage && !ring([i], W, H).some(n => board[n]?.group === board[i].group && !board[n].cage)).slice(0, 2);
    } else if (kind === 'pounce') cells = ring(cluster, W, H);
    else if (kind === 'yarn') cells = square(center, W, H);
    else if (kind === 'cross') cells = cross(center, W, H);
    else {
      const group = cluster === null ? mostCommon(board) : match.groups[match.clusters.indexOf(cluster)];
      cells = board.map((cell, i) => (cell?.group === group && !cell.cage ? i : -1)).filter(i => i >= 0);
      const cage = nearestCage(board, center, W);
      if (cage >= 0) cells.push(cage);
    }
    cells = cells.filter(i => !board[i]?.void); // ô ngoài bàn ('#'): không trúng, không loé (giữ nguyên hình bàn)
    cells.forEach(i => { pts += hit(i, catsToo); });
    runFat.forEach(id => fatHits.set(id, (fatHits.get(id) || 0) + 1));
    if (EFFECTS.CAP[kind]) pts = Math.min(pts, EFFECTS.CAP[kind]);
    out.points += pts;
    out.effects.push({ kind, center, cells });
  };
  const ordered = match.clusters.slice().sort((a, b) => b.length - a.length);
  const centerOf = cluster => mergeTarget(cluster, placed, W);
  if (out.double && sizes[1] >= 5) {
    ordered.slice(0, 2).forEach(c => run('yarn', c, centerOf(c)));
    run('herd', null, centerOf(ordered[0]));
  } else if (out.double && sizes[1] === 4 && sizes[0] === 4) {
    ordered.slice(0, 2).forEach(c => run('pounce', c, centerOf(c)));
    run('yarn', null, placed[0]);
  } else if (out.double && sizes[0] === 3) {
    run('leap', null, placed[0]);
  } else {
    const kind = kindOf(sizes[0]);
    if (kind) run(kind, ordered[0], centerOf(ordered[0]));
  }
  // Mèo béo trúng hiệu ứng: đánh thức, đủ lần thì lăn dọn vùng 4×4 (cỏ trên đường lăn cũng bị phá).
  const fat = wakeFatCats(board, W, H, fatHits);
  out.board = fat.board;
  out.woke = fat.woke;
  out.rolled = fat.rolled;
  out.points += rollPoints(fat.rolled);
  fat.rolled.forEach(roll => roll.area.forEach(i => { if (lawn?.[i]) { lawn[i] = false; out.cleaned.push(i); } }));
  out.grass = lawn;
  return out;
}

function mostCommon(board) {
  const count = {};
  board.forEach(cell => { if (cell?.group && !cell.cage) count[cell.group] = (count[cell.group] || 0) + 1; });
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
}
// Các ô thoả `pick`, gần `center` nhất trước (khoảng cách Manhattan).
function nearest(board, center, W, pick) {
  const dist = i => Math.abs(Math.floor(i / W) - Math.floor(center / W)) + Math.abs(i % W - center % W);
  return board.map((_, i) => i).filter(pick).sort((a, b) => dist(a) - dist(b));
}
const nearestCage = (board, center, W) => nearest(board, center, W, i => board[i]?.cage)[0] ?? -1;
