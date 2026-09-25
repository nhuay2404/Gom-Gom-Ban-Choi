function neighbor(index, delta, width, height) {
  const next = index + delta;
  if (next < 0 || next >= width * height) return -1;
  if (Math.abs(delta) === 1 && Math.floor(index / width) !== Math.floor(next / width)) return -1;
  return next;
}

export function connectedGroup(board, width, height, source) {
  const group = board[source]?.group;
  if (!group) return [];
  const visited = new Set([source]), pending = [source];
  while (pending.length) {
    const current = pending.pop();
    for (const direction of [1, -1, width, -width]) {
      const next = neighbor(current, direction, width, height);
      if (next < 0 || visited.has(next) || board[next]?.group !== group) continue;
      visited.add(next); pending.push(next);
    }
  }
  return [...visited];
}

export function findLineMatch(board, width, height, size = 4) {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col <= width - size; col++) {
      const indices = Array.from({ length: size }, (_, offset) => row * width + col + offset);
      const group = board[indices[0]]?.group;
      if (group && indices.every(index => board[index]?.group === group)) return { group, indices, axis: 'horizontal' };
    }
  }
  for (let col = 0; col < width; col++) {
    for (let row = 0; row <= height - size; row++) {
      const indices = Array.from({ length: size }, (_, offset) => (row + offset) * width + col);
      const group = board[indices[0]]?.group;
      if (group && indices.every(index => board[index]?.group === group)) return { group, indices, axis: 'vertical' };
    }
  }
  return null;
}

export function slideDirectional(board, width, height, source, delta) {
  if (![1, -1, width, -width].includes(delta)) return { error: 'Chỉ được vuốt ngang hoặc dọc.' };
  const indices = connectedGroup(board, width, height, source);
  if (!indices.length) return { error: 'Không có thẻ để vuốt.' };
  const component = new Set(indices);
  const blocked = new Set();
  const destinations = new Map(indices.map(index => [index, neighbor(index, delta, width, height)]));
  for (const index of indices) {
    const destination = destinations.get(index);
    if (destination < 0 || (board[destination] && !component.has(destination))) blocked.add(index);
  }
  let changed;
  do {
    changed = false;
    for (const index of indices) {
      if (blocked.has(index)) continue;
      if (blocked.has(destinations.get(index))) { blocked.add(index); changed = true; }
    }
  } while (changed);
  const moving = indices.filter(index => !blocked.has(index));
  if (!moving.length) return { error: 'Cả cụm đều bị chặn.' };
  const nextBoard = board.slice();
  const tiles = moving.map(index => board[index]);
  moving.forEach(index => { nextBoard[index] = null; });
  moving.forEach((index, i) => { nextBoard[destinations.get(index)] = tiles[i]; });
  return { board: nextBoard, moved: moving.length, blocked: blocked.size };
}

// Gom: mọi cụm liền kề cùng nhóm có từ `size` món trở lên sẽ biến mất khỏi bàn.
export function clearMatches(board, width, height, size = 4) {
  const seen = new Set(), cleared = [], groups = [], clusters = [];
  board.forEach((cell, index) => {
    if (!cell || seen.has(index)) return;
    const cluster = connectedGroup(board, width, height, index);
    cluster.forEach(i => seen.add(i));
    if (cluster.length >= size) { cleared.push(...cluster); groups.push(cell.group); clusters.push(cluster); }
  });
  if (!cleared.length) return { board, cleared, groups, clusters };
  const nextBoard = board.slice();
  cleared.forEach(index => { nextBoard[index] = null; });
  return { board: nextBoard, cleared, groups, clusters };
}

// Điểm tụ của cụm khi gom: ô vừa đặt nằm trong cụm, ưu tiên ô gần tâm cụm nhất.
export function mergeTarget(cluster, placed, width) {
  const candidates = cluster.filter(index => placed.includes(index));
  const pool = candidates.length ? candidates : cluster;
  const distance = (a, b) => Math.abs(Math.floor(a / width) - Math.floor(b / width)) + Math.abs(a % width - b % width);
  return pool.reduce((best, index) => {
    const total = cluster.reduce((sum, other) => sum + distance(index, other), 0);
    return total < best.total ? { index, total } : best;
  }, { index: pool[0], total: Infinity }).index;
}

export function rotateOffsets(offsets) {
  const rotated = offsets.map(([row, col]) => [col, -row]);
  const minRow = Math.min(...rotated.map(([row]) => row));
  const minCol = Math.min(...rotated.map(([, col]) => col));
  return rotated.map(([row, col]) => [row - minRow, col - minCol]);
}

export function placementIndices(board, width, height, anchor, offsets) {
  const anchorRow = Math.floor(anchor / width), anchorCol = anchor % width;
  const indices = [];
  for (const [rowOffset, colOffset] of offsets) {
    const row = anchorRow + rowOffset, col = anchorCol + colOffset;
    if (row < 0 || row >= height || col < 0 || col >= width) return null;
    const index = row * width + col;
    if (board[index]) return null;
    indices.push(index);
  }
  return indices;
}

export function placeCard(board, width, height, anchor, card) {
  const indices = placementIndices(board, width, height, anchor, card.offsets);
  if (!indices) return { error: 'Thẻ không vừa vị trí này.' };
  const nextBoard = board.slice();
  indices.forEach((index, offset) => { nextBoard[index] = { ...card.items[offset], locked: true }; });
  let adjacency = 0;
  const placed = new Set(indices);
  indices.forEach(index => {
    const cell = nextBoard[index];
    for (const delta of [1, -1, width, -width]) {
      const other = neighbor(index, delta, width, height);
      if (other >= 0 && !placed.has(other) && nextBoard[other]?.group === cell.group) adjacency++;
    }
  });
  return { board: nextBoard, indices, score: indices.length * 10 + adjacency * 5 };
}

// ===== Màn chơi "dọn sạch bàn" + hàng thẻ AI =====

const DIRS = (width) => [1, -1, width, -width];
function inBoard(index, delta, width, height) {
  const next = index + delta;
  if (next < 0 || next >= width * height) return -1;
  if (Math.abs(delta) === 1 && Math.floor(index / width) !== Math.floor(next / width)) return -1;
  return next;
}

export function remainingCats(board) {
  return board.filter(Boolean).length;
}

// Các cụm liền kề cùng loại đang có trên bàn.
export function clustersOf(board, width, height) {
  const seen = new Set(), result = [];
  board.forEach((cell, index) => {
    if (!cell || seen.has(index)) return;
    const cells = connectedGroup(board, width, height, index);
    cells.forEach(i => seen.add(i));
    result.push({ group: cell.group, cells });
  });
  return result;
}

// Các ô trống kề một cụm.
function emptyNeighbors(board, width, height, cluster) {
  const own = new Set(cluster.cells), out = new Set();
  cluster.cells.forEach(index => DIRS(width).forEach(delta => {
    const next = inBoard(index, delta, width, height);
    if (next >= 0 && !board[next] && !own.has(next)) out.add(next);
  }));
  return [...out];
}

// Thẻ "có ích": đặt vào là gom được ngay một cụm (cặp + 1 con, hoặc con lẻ + 2 con cùng loại).
// Trả về { card: { offsets, groups }, anchor } hoặc null nếu bàn không có chỗ hợp.
export function findHelpfulCard(board, width, height, rng = Math.random) {
  const clusters = clustersOf(board, width, height).filter(c => c.cells.length < 3);
  // Ưu tiên cụm 2 (chỉ cần 1 con), rồi tới cụm 1; trộn ngẫu nhiên trong cùng mức.
  clusters.sort((a, b) => (b.cells.length - a.cells.length) || (rng() - .5));
  for (const cluster of clusters) {
    const spots = emptyNeighbors(board, width, height, cluster).sort(() => rng() - .5);
    if (cluster.cells.length === 2 && spots.length) {
      return { card: { offsets: [[0, 0]], groups: [cluster.group] }, anchor: spots[0] };
    }
    for (const spot of spots) {
      for (const delta of [1, width, -1, -width].sort(() => rng() - .5)) {
        const other = inBoard(spot, delta, width, height);
        if (other < 0 || board[other] || cluster.cells.includes(other)) continue;
        const [first, second] = spot < other ? [spot, other] : [other, spot];
        const horizontal = Math.abs(delta) === 1;
        return { card: { offsets: horizontal ? [[0, 0], [0, 1]] : [[0, 0], [1, 0]], groups: [cluster.group, cluster.group] }, anchor: first };
      }
    }
  }
  return null;
}

// Tỉ lệ ra thẻ có ích: bàn càng vơi càng cao (30% lúc đầu -> 100% khi còn <= 4 mèo).
export function helpChance(remaining, initial) {
  if (remaining <= 4) return 1;
  const progress = 1 - remaining / Math.max(initial, 1);
  return Math.min(1, Math.max(.3, .3 + progress * .9));
}

// Bàn khởi đầu: vài cặp cùng loại đứng cạnh nhau (thiếu 1 là gom) + vài con lẻ; không có cụm >= 3.
export function generateStartBoard(width, height, groups, { pairs = 3, singles = 4 } = {}, rng = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const board = Array(width * height).fill(null);
    const pick = () => groups[Math.floor(rng() * groups.length)];
    let ok = true;
    const freeSpot = () => {
      for (let tries = 0; tries < 60; tries++) {
        const index = Math.floor(rng() * width * height);
        if (!board[index]) return index;
      }
      return -1;
    };
    for (let i = 0; i < pairs && ok; i++) {
      const group = pick(), a = freeSpot();
      const b = a < 0 ? -1 : DIRS(width).map(d => inBoard(a, d, width, height)).filter(n => n >= 0 && !board[n]).sort(() => rng() - .5)[0];
      if (a < 0 || b === undefined || b < 0) { ok = false; break; }
      board[a] = { group }; board[b] = { group };
    }
    for (let i = 0; i < singles && ok; i++) {
      const index = freeSpot();
      if (index < 0) { ok = false; break; }
      board[index] = { group: pick() };
    }
    if (!ok) continue;
    const sizes = clustersOf(board, width, height).map(c => c.cells.length);
    if (Math.max(...sizes) >= 3 || sizes.filter(s => s === 2).length < pairs) continue;
    return board;
  }
  throw new Error('Không tạo được bàn khởi đầu');
}