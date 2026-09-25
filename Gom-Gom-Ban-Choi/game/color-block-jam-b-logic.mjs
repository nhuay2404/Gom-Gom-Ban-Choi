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

// Thẻ domino đặt ở 2 ô a, b (kề nhau) -> offsets + anchor chuẩn hoá (anchor = ô trên-trái).
function dominoAt(a, b, groupA, groupB, width) {
  const [first, second, gFirst, gSecond] = a < b ? [a, b, groupA, groupB] : [b, a, groupB, groupA];
  const horizontal = second - first === 1;
  return { card: { offsets: horizontal ? [[0, 0], [0, 1]] : [[0, 0], [1, 0]], groups: [gFirst, gSecond] }, anchor: first };
}

// Thẻ "có ích" = đặt vào là gom được ngay. Liệt kê mọi ứng viên rồi ĐẶT THỬ từng thẻ, chọn thẻ gom
// được nhiều mèo nhất:
//  - 1 con cùng loại ghép vào một cặp;
//  - 2 con cùng loại ghép với một con lẻ;
//  - "gom đôi": 2 con khác loại, mỗi con ghép vào một cặp khác nhau -> một lượt dọn 2 cụm.
// Trả về { card: { offsets, groups }, anchor, cleared } hoặc null.
// odds (tuỳ chọn, từ clearOdds): ưu tiên cứu các cụm còn ít khả năng được gom - cụm đã có mèo chờ sẵn
// trong tay người chơi thì không ra thẻ trùng cho nó nữa.
export function findHelpfulCard(board, width, height, rng = Math.random, odds = null) {
  const clusters = clustersOf(board, width, height).filter(c => c.cells.length < 3);
  const candidates = [];
  const pairSpots = new Map(); // ô trống -> loại của cặp mà ô đó kề
  clusters.forEach(cluster => {
    const spots = emptyNeighbors(board, width, height, cluster);
    if (cluster.cells.length === 2) {
      spots.forEach(spot => {
        candidates.push({ card: { offsets: [[0, 0]], groups: [cluster.group] }, anchor: spot });
        if (!pairSpots.has(spot)) pairSpots.set(spot, cluster.group);
      });
    } else {
      spots.forEach(spot => DIRS(width).forEach(delta => {
        const other = inBoard(spot, delta, width, height);
        if (other >= 0 && !board[other]) candidates.push(dominoAt(spot, other, cluster.group, cluster.group, width));
      }));
    }
  });
  pairSpots.forEach((groupA, a) => DIRS(width).forEach(delta => {
    const b = inBoard(a, delta, width, height);
    if (b > a && pairSpots.has(b) && pairSpots.get(b) !== groupA) candidates.push(dominoAt(a, b, groupA, pairSpots.get(b), width));
  }));
  let best = null;
  candidates.forEach(candidate => {
    const card = { offsets: candidate.card.offsets, items: candidate.card.groups.map(group => ({ group })) };
    const placed = placeCard(board, width, height, candidate.anchor, card);
    if (placed.error) return;
    const clearedCells = clearMatches(placed.board, width, height, 3).cleared;
    const cleared = clearedCells.length;
    // "Cứu được bao nhiêu": mèo cũ trên bàn được dọn, mỗi con tính theo (1 - khả năng nó vốn được gom).
    const rescued = clearedCells.reduce((sum, index) => sum + (board[index] ? 1 - (odds ? odds[index] : 0) : 0), 0);
    // Chỉ cứu mèo đã gần chắc được gom (mèo chờ sẵn trong tay) thì không đáng -> bỏ.
    if (cleared < 3 || rescued <= .3) return;
    // Điểm = mèo cũ được cứu (x2) + số mèo dọn được sau lượt (đã trừ mèo mới thêm vào), phá hoà ngẫu nhiên.
    const value = rescued * 4 + cleared - candidate.card.groups.length + rng() * .5;
    if (!best || value > best.value) best = { ...candidate, cleared, value };
  });
  return best && { card: best.card, anchor: best.anchor, cleared: best.cleared };
}

// Xác suất từng ô mèo trên bàn sẽ được gom, xét cả mèo người chơi đang có trong tay (thẻ đang bóc,
// ô gửi tạm, hàng chờ). pending = [{ groups: [...], weight }] - weight = độ chắc chắn nguồn đó sẽ được
// dùng (thẻ đang bóc cao nhất). Mỗi con mèo trong tay được "giao" cho một cụm cùng loại còn thiếu và còn
// chỗ đặt bên cạnh. Cụm được giao đủ -> xác suất = độ chắc của nguồn yếu nhất; giao một phần -> vừa;
// chưa có gì -> thấp. Trả về { odds: xác suất theo từng ô, clusters: [{ group, cells, need, odds }] }.
const BASE_ODDS = .12;
export function clearOdds(board, width, height, pending = []) {
  const clusters = clustersOf(board, width, height)
    .map(cluster => ({ ...cluster, need: Math.max(0, 3 - cluster.cells.length), sources: [],
      open: emptyNeighbors(board, width, height, cluster).length > 0 }));
  pending.forEach(({ groups, weight }) => groups.forEach(group => {
    const target = clusters
      .filter(c => c.group === group && c.open && c.sources.length < c.need)
      .sort((a, b) => b.cells.length - a.cells.length)[0]; // cụm gần xong nhận trước
    if (target) target.sources.push(weight);
  }));
  const odds = board.map(() => 0);
  clusters.forEach(cluster => {
    const covered = cluster.sources.length;
    cluster.odds = !cluster.need ? 1
      : covered >= cluster.need ? Math.min(...cluster.sources)
      : covered ? BASE_ODDS + (Math.max(...cluster.sources) - BASE_ODDS) * covered / cluster.need * .6
      : BASE_ODDS;
    cluster.cells.forEach(index => { odds[index] = cluster.odds; });
  });
  return { odds, clusters };
}

// Số mèo "dự kiến còn sót" = tổng (1 - xác suất được gom) của mọi mèo trên bàn.
export function expectedLeftover(board, odds) {
  return board.reduce((sum, cell, index) => sum + (cell ? 1 - odds[index] : 0), 0);
}

// Việc còn lại trên bàn: mỗi cụm cần ít nhất 1 thẻ nữa (cặp thiếu 1 con, con lẻ thiếu 2 con).
export function boardNeeds(board, width, height) {
  const clusters = clustersOf(board, width, height);
  return { turns: clusters.length, cats: clusters.reduce((sum, c) => sum + Math.max(0, 3 - c.cells.length), 0) };
}

// Tỉ lệ ra thẻ có ích, tính theo:
//  - tiến độ: bàn càng vơi càng cao (30% lúc đầu -> 100% khi còn <= 4 mèo);
//  - áp lực lượt: số lượt tối thiểu còn cần gần bằng số lượt còn lại -> chỉ ra thẻ có ích.
// remaining có thể là số mèo "dự kiến còn sót" (expectedLeftover) thay vì số mèo thô.
export function helpChance(remaining, initial, movesLeft = Infinity, turnsNeeded = 0) {
  if (remaining <= 4) return 1;
  if (turnsNeeded >= movesLeft - 1) return 1;
  const progress = 1 - remaining / Math.max(initial, 1);
  const pressure = Number.isFinite(movesLeft) ? Math.max(0, turnsNeeded / Math.max(movesLeft, 1) - .4) : 0;
  return Math.min(1, Math.max(.3, .3 + progress * .9 + pressure));
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
// Nước gom tốt nhất cho một thẻ trên bàn hiện tại (thử cả 4 hướng xoay, mọi vị trí). Dùng khi AI
// "đặt thử" thẻ đang bóc / thẻ trong hàng: không tin vị trí đã định từ lúc lập kế hoạch vì bàn có thể
// đã đổi. Trả về { board (đã gom), cleared } hoặc null nếu thẻ không gom được gì.
export function bestClearingMove(board, width, height, card, size = 3) {
  let best = null, offsets = card.offsets;
  for (let turn = 0; turn < 4; turn++, offsets = rotateOffsets(offsets)) {
    for (let anchor = 0; anchor < width * height; anchor++) {
      if (!placementIndices(board, width, height, anchor, offsets)) continue;
      const placed = placeCard(board, width, height, anchor, { offsets, items: card.items });
      const match = clearMatches(placed.board, width, height, size);
      const value = match.cleared.length - card.items.length;
      if (match.cleared.length >= size && (!best || value > best.value)) best = { board: match.board, cleared: match.cleared.length, value };
    }
  }
  return best && { board: best.board, cleared: best.cleared };
}