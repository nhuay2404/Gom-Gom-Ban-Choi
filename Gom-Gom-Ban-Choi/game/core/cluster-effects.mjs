// Hiệu ứng khi gom cụm to / gom đôi (thuần logic). Chạy trên bàn SAU khi gom thường (clearMatches).
//   cụm 4: pounce — phá 1 lớp vật cản (thùng, khoá chuồng, cỏ) ở các ô kề quanh cụm, không xoá mèo
//   cụm 5: yarn   — nổ 3×3 quanh điểm tụ
//   cụm 6: cross  — gom mọi mèo cùng màu cụm còn trên bàn + mở 1 khoá chuồng gần nhất
//   cụm 7+: herd  — dọn sạch cả bàn (mèo, mèo trong chuồng, thùng, kim loại, cỏ; mèo béo được đánh thức), mỗi thứ EFFECTS.WIPE điểm
// Gom đôi (2+ cụm): 3+3 → drop (thả 2 mèo đơn vào chỗ có lợi nhất: ưu tiên chỗ thành cụm 3+ để gom tiếp) · 4+4 → 2 pounce + yarn · 5+ & 5+ → 2 yarn + herd · lệch cỡ → hiệu ứng cụm to.
// Điểm cả lượt nhân DOUBLE_MULT khi gom đôi (session.mjs).
import { mergeTarget, wakeFatCats, connectedGroup, clearMatches } from './board-rules.mjs';
import { rollPoints, turnPoints, MATCH_SIZE } from './scoring.mjs';
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

// match = kết quả clearMatches, placed = ô vừa đặt thẻ, grass = mảng cỏ (hoặc null). Không sửa input.
export function clusterEffects(match, placed, W, H, grass) {
  const sizes = match.clusters.map(c => c.length).sort((a, b) => b - a);
  const out = { effects: [], board: match.board, blasted: [], broken: [], caged: [], freed: [], cleaned: [], woke: [], rolled: [], points: 0, double: sizes.length >= 2 };
  if (!sizes.length) return out;
  const board = match.board.slice(), lawn = grass ? grass.slice() : null;
  const hitCage = new Set(), fatHits = new Map();
  // mèo béo đã bị đánh thức bởi lượt gom này: hiệu ứng / mèo thả không đánh thức thêm (mỗi lượt tối đa 1 lần)
  const fatDone = new Set([...(match.woke ?? []), ...(match.rolled ?? [])].map(f => f.id));
  let runFat = new Set();
  // Một ô bị trúng: mèo thường bị xoá (trừ pounce), thùng vỡ, chuồng mất 1 khoá (mỗi chuồng 1 lần / lượt), cỏ bị phá,
  // mèo béo được đánh thức 1 lần mỗi hiệu ứng (dù trúng mấy ô của nó).
  // wipe (herd): xoá hẳn mọi thứ trừ mèo béo, kể cả kim loại và mèo trong chuồng, mỗi thứ (cả ô cỏ) EFFECTS.WIPE điểm.
  const wipePts = EFFECTS.WIPE ?? 20;
  const hit = (i, catsToo, wipe = false) => {
    let pts = 0;
    const cell = board[i];
    if (lawn?.[i]) { lawn[i] = false; out.cleaned.push(i); if (wipe) pts += wipePts; }
    if (!cell) return pts;
    if (cell.fat) { runFat.add(cell.fatId); return pts; }
    if (wipe) { board[i] = null; (cell.group ? out.blasted : out.broken).push(i); return pts + wipePts; }
    if (cell.cage) { if (hitCage.has(i)) return pts; hitCage.add(i);
      const { cage, ...cat } = cell;
      if (cage > 1) { board[i] = { ...cell, cage: cage - 1 }; out.caged.push(i); } else { board[i] = cat; out.freed.push(i); }
    } else if (cell.block) { if (!cell.metal) { board[i] = null; out.broken.push(i); pts += 10; } }
    else if (catsToo) { board[i] = null; out.blasted.push(i); pts += 10; }
    return pts;
  };
  // chain: hiệu ứng của cụm gom dây chuyền (UI chạy sau anim gom cụm đó); group: màu cụm (cụm dây chuyền không nằm trong match)
  const run = (kind, cluster, center, { chain = false, group: own } = {}) => {
    let pts = 0, cells, catsToo = kind !== 'pounce';
    runFat = new Set();
    if (kind === 'pounce') cells = ring(cluster, W, H);
    else if (kind === 'yarn') cells = square(center, W, H);
    else if (kind === 'herd') cells = board.map((_, i) => i);
    else {
      const group = cluster === null ? mostCommon(board) : own ?? match.groups[match.clusters.indexOf(cluster)];
      cells = board.map((cell, i) => (cell?.group === group && !cell.cage ? i : -1)).filter(i => i >= 0);
      const cage = nearestCage(board, center, W);
      if (cage >= 0) cells.push(cage);
    }
    cells = cells.filter(i => !board[i]?.void); // ô ngoài bàn ('#'): không trúng, không loé (giữ nguyên hình bàn)
    cells.forEach(i => { pts += hit(i, catsToo, kind === 'herd'); });
    if (kind === 'herd') cells = cells.filter(i => out.blasted.includes(i) || out.broken.includes(i) || out.cleaned.includes(i) || board[i]?.fat);
    runFat.forEach(id => { if (!fatDone.has(id)) fatHits.set(id, 1); });
    if (EFFECTS.CAP[kind]) pts = Math.min(pts, EFFECTS.CAP[kind]);
    out.points += pts;
    out.effects.push({ kind, center, cells, points: pts, ...(chain && { chain }) });
  };
  // Gom đôi 3+3: thả lần lượt 2 mèo đơn (1 ô) vào ô trống có lợi nhất. Ưu tiên chỗ thành cụm 3+ (to hơn, sát nhiều vật cản / cỏ hơn
  // thì hơn), không thì nối dài cụm sẵn có; hoà thì gần ô vừa đặt. Cụm thành hình được gom luôn (điểm như gom thường).
  const drop = center => {
    const groups = [...new Set([...match.groups, ...board.filter(c => c?.group && !c.cage).map(c => c.group)])];
    const dist = i => Math.abs(Math.floor(i / W) - Math.floor(center / W)) + Math.abs(i % W - center % W);
    const near = cells => ring(cells, W, H).filter(i => (board[i]?.block && !board[i].metal) || board[i]?.cage || board[i]?.fat || lawn?.[i]).length;
    const cells = [];
    for (let n = 0; n < 2; n++) {
      let best = null;
      board.forEach((cell, i) => {
        if (cell) return;
        for (const group of groups) {
          board[i] = { group };
          const cluster = connectedGroup(board, W, H, i);
          const value = (cluster.length >= MATCH_SIZE ? 1000 : 0) + cluster.length * 20 + near(cluster) * 15 - dist(i) * .1;
          if (!best || value > best.value) best = { value, i, group };
        }
        board[i] = null;
      });
      if (!best) break;
      board[best.i] = { group: best.group };
      cells.push(best.i);
    }
    out.dropped = cells.map(i => ({ index: i, group: board[i].group }));
    out.effects.push({ kind: 'drop', center, cells });
  };
  // Gom dây chuyền: cụm 3+ mới thành hình trên bàn (mèo thả xuống, mèo vừa được thả khỏi lồng nằm cạnh mèo cùng loại) gom luôn trong
  // lượt này, điểm như gom thường; cụm 4+ cũng nổ hiệu ứng cụm to như gom thường (chain: true); gom / nổ xong lại thả thêm lồng thì
  // gom tiếp. Gộp vào out.chain.
  const chainClear = () => {
    for (;;) {
      const skip = new Set([...fatDone, ...fatHits.keys()]);
      const chain = clearMatches(board, W, H, MATCH_SIZE, skip);
      if (!chain.cleared.length) return;
      chain.board.forEach((cell, i) => { board[i] = cell; });
      chain.cleared.forEach(i => { if (lawn?.[i]) { lawn[i] = false; out.cleaned.push(i); } });
      chain.woke.forEach(f => skip.add(f.id));
      const all = out.chain ??= { cleared: [], clusters: [], groups: [], broken: [], caged: [], freed: [], woke: [], rolled: [] };
      ['cleared', 'clusters', 'groups', 'broken', 'caged', 'freed', 'woke', 'rolled'].forEach(k => all[k].push(...chain[k]));
      out.broken.push(...chain.broken); out.caged.push(...chain.caged); out.freed.push(...chain.freed);
      out.points += turnPoints(chain);
      const sources = [...(out.dropped ?? []).map(d => d.index), ...match.freed ?? [], ...out.freed];
      chain.clusters.forEach((cluster, k) => {
        const kind = kindOf(cluster.length);
        if (kind) run(kind, cluster, mergeTarget(cluster, sources.filter(i => cluster.includes(i)), W), { chain: true, group: chain.groups[k] });
      });
    }
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
    drop(placed[0]);
  } else {
    const kind = kindOf(sizes[0]);
    if (kind) run(kind, ordered[0], centerOf(ordered[0]));
  }
  chainClear();
  // Mèo béo trúng hiệu ứng: đánh thức, đủ lần thì lăn dọn vùng 4×4 (cỏ trên đường lăn cũng bị phá).
  const fat = wakeFatCats(board, W, H, fatHits);
  out.board = fat.board;
  out.woke = [...(out.chain?.woke ?? []), ...fat.woke];
  out.rolled = [...(out.chain?.rolled ?? []), ...fat.rolled];
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
