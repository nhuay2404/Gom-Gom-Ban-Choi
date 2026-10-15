// Hình dạng bàn (thuần dữ liệu/logic, không đụng giao diện). Bàn của mỗi màn là mảng chuỗi cùng độ dài,
// kích thước tuỳ màn (6×6 tới 8×8). Ký tự '#' = ô nằm ngoài bàn (không vẽ, không đặt mèo được) để tạo hình
// tim, tam giác, kim cương...
//
// Độ khó thích ứng (adaptive.mjs) dùng hai hàm dưới:
//   compactBoard: thu bàn về 6×6 vuông (người chơi đang vất vả / Easy)
//   expandBoard:  đặt bàn 6×6 vào một hình to hơn (người chơi giỏi)
export const VOID = '#';
export const COMPACT = 6;

// Khuôn hình: '.' = ô trong bàn, '#' = ngoài bàn.
export const SHAPES = {
  square7: ['.......', '.......', '.......', '.......', '.......', '.......', '.......'],
  square8: ['........', '........', '........', '........', '........', '........', '........', '........'],
  octagon: ['#.....#', '.......', '.......', '.......', '.......', '.......', '#.....#'],
  diamond: ['##...##', '#.....#', '.......', '.......', '.......', '#.....#', '##...##'],
  heart: ['#..##..#', '........', '........', '........', '#......#', '##....##', '###..###'],
  triangle: ['###..###', '##....##', '##....##', '#......#', '#......#', '........', '........'],
  hexagon: ['##....##', '#......#', '........', '........', '........', '#......#', '##....##'],
  cross: ['##....##', '##....##', '........', '........', '........', '........', '##....##', '##....##'],
  ring: ['........', '........', '........', '...##...', '...##...', '........', '........', '........'],
};

export const boardSize = rows => ({ W: rows[0].length, H: rows.length });
export const isPlainSquare = rows => rows.length === COMPACT && rows[0].length === COMPACT && !rows.join('').includes(VOID);
export const playableCells = rows => [...rows.join('')].filter(ch => ch !== VOID).length;

// Thu về 6×6: chọn khung 6×6 giữ được nhiều mèo đặt sẵn / vật cản nhất (hoà thì lấy khung gần giữa),
// ô ngoài bàn trong khung thành ô trống. Bỏ bớt mèo không bao giờ sinh cụm gom sẵn.
export function compactBoard(rows) {
  if (isPlainSquare(rows)) return rows;
  const { W, H } = boardSize(rows);
  if (W < COMPACT || H < COMPACT) return rows;
  let best = null;
  for (let top = 0; top <= H - COMPACT; top++) for (let left = 0; left <= W - COMPACT; left++) {
    const window = rows.slice(top, top + COMPACT).map(row => row.slice(left, left + COMPACT));
    const kept = [...window.join('')].filter(ch => ch !== '.' && ch !== VOID).length;
    const offCenter = Math.abs(top * 2 + COMPACT - H) + Math.abs(left * 2 + COMPACT - W);
    if (!best || kept > best.kept || (kept === best.kept && offCenter < best.offCenter)) best = { window, kept, offCenter };
  }
  return best.window.map(row => row.replaceAll(VOID, '.'));
}

// Đặt bàn vào khuôn `shape` (tên trong SHAPES): thử mọi vị trí, chọn chỗ không làm mất mèo / vật cản nào
// và gần giữa nhất. Không vị trí nào giữ đủ thì giữ nguyên bàn cũ.
export function expandBoard(rows, shape) {
  const mask = SHAPES[shape];
  if (!mask) return rows;
  const { W, H } = boardSize(rows), MW = mask[0].length, MH = mask.length;
  if (MW < W || MH < H) return rows;
  let best = null;
  for (let top = 0; top <= MH - H; top++) for (let left = 0; left <= MW - W; left++) {
    let lost = false;
    for (let r = 0; r < H && !lost; r++) for (let c = 0; c < W; c++) {
      if (rows[r][c] !== '.' && rows[r][c] !== VOID && mask[top + r][left + c] === VOID) { lost = true; break; }
    }
    if (lost) continue;
    const offCenter = Math.abs(top * 2 + H - MH) + Math.abs(left * 2 + W - MW);
    if (!best || offCenter < best.offCenter) best = { top, left, offCenter };
  }
  if (!best) return rows;
  return mask.map((maskRow, r) => [...maskRow].map((ch, c) => {
    if (ch === VOID) return VOID;
    const inner = rows[r - best.top]?.[c - best.left];
    return inner && inner !== VOID ? inner : '.';
  }).join(''));
}
