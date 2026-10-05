function neighbor(index, delta, width, height) {
  const next = index + delta;
  if (next < 0 || next >= width * height) return -1;
  if (Math.abs(delta) === 1 && Math.floor(index / width) !== Math.floor(next / width)) return -1;
  return next;
}

// Mèo trong chuồng (`cage` > 0) không thuộc cụm nào.
export function connectedGroup(board, width, height, source) {
  const group = board[source]?.cage ? null : board[source]?.group;
  if (!group) return [];
  const visited = new Set([source]), pending = [source];
  while (pending.length) {
    const current = pending.pop();
    for (const direction of [1, -1, width, -width]) {
      const next = neighbor(current, direction, width, height);
      if (next < 0 || visited.has(next) || board[next]?.group !== group || board[next].cage) continue;
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
  if (![1, -1, width, -width].includes(delta)) return { error: 'You can only swipe horizontally or vertically.' };
  const indices = connectedGroup(board, width, height, source);
  if (!indices.length) return { error: 'No cards to swipe.' };
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
  if (!moving.length) return { error: 'The whole group is blocked.' };
  const nextBoard = board.slice();
  const tiles = moving.map(index => board[index]);
  moving.forEach(index => { nextBoard[index] = null; });
  moving.forEach((index, i) => { nextBoard[destinations.get(index)] = tiles[i]; });
  return { board: nextBoard, moved: moving.length, blocked: blocked.size };
}

// Gom: mọi cụm liền kề cùng nhóm có từ `size` món trở lên sẽ biến mất khỏi bàn.
// Thùng gỗ ({ block: true }, không có group) chiếm ô, không bao giờ nằm trong cụm; ô bị gom nằm sát thùng
// (trên/dưới/trái/phải) thì thùng vỡ theo. `broken` = các ô thùng vừa vỡ.
// Khối kim loại ({ block: true, metal: true }) cũng chiếm ô nhưng không bao giờ vỡ.
// Mèo trong chuồng ({ group, cage }) chiếm ô, không vào cụm; gom sát bên thì chuồng mất một khóa (`caged`), hết khóa thì
// mèo được thả (`freed`) và từ lượt sau gom được như mèo thường.
export function clearMatches(board, width, height, size = 4) {
  const seen = new Set(), cleared = [], groups = [], clusters = [];
  board.forEach((cell, index) => {
    if (!cell || seen.has(index)) return;
    const cluster = connectedGroup(board, width, height, index);
    cluster.forEach(i => seen.add(i));
    if (cluster.length >= size) { cleared.push(...cluster); groups.push(cell.group); clusters.push(cluster); }
  });
  if (!cleared.length) return { board, cleared, groups, clusters, broken: [], caged: [], freed: [] };
  const nextBoard = board.slice(), broken = new Set(), hit = new Set();
  cleared.forEach(index => {
    nextBoard[index] = null;
    for (const delta of [1, -1, width, -width]) {
      const other = neighbor(index, delta, width, height);
      if (other >= 0 && board[other]?.block && !board[other].metal) broken.add(other);
      if (other >= 0 && board[other]?.cage) hit.add(other);
    }
  });
  broken.forEach(index => { nextBoard[index] = null; });
  // Chuồng: mỗi lần gom (dù nhiều ô của cụm chạm vào) chỉ mất một khóa; hết khóa thì mèo được thả ra tại chỗ.
  const caged = [], freed = [];
  hit.forEach(index => {
    const { cage, ...cat } = board[index];
    if (cage > 1) { nextBoard[index] = { ...board[index], cage: cage - 1 }; caged.push(index); } else { nextBoard[index] = cat; freed.push(index); }
  });
  return { board: nextBoard, cleared, groups, clusters, broken: [...broken], caged, freed };
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
  if (!indices) return { error: 'The card doesn\'t fit here.' };
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
