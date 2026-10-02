// Chấm độ khó của cách bố trí vật cản trên một bàn (thuần logic). Dùng cho tools/generate-layouts.mjs để
// xếp hạng các bố trí ứng viên trước khi cho bot chơi thử. Điểm càng cao bàn càng khó.
//   tripleSpots  số chỗ đặt vừa thẻ 3 ô (mọi hướng)                  ít = khó
//   largest      số ô của vùng trống liền nhau lớn nhất                nhỏ = khó (bàn bị chia cắt)
//   chokes       số ô trống mà lấp vào thì vùng trống bị tách làm đôi  nhiều = khó
//   hardCrates   số thùng có ≤ 1 ô trống sát bên (khó gom cạnh để phá)  nhiều = khó
//   pairBlocks   số vật cản nằm ngay đầu một cặp mèo đặt sẵn             nhiều = khó (chặn đường nối thành 3)
import { boardSize } from './board-shapes.mjs';

const isOpen = ch => ch === '.';
const isCat = ch => !'.XM#'.includes(ch);
const isObstacle = ch => ch === 'X' || ch === 'M';

function neighbors(i, W, H) {
  const x = i % W, y = (i - x) / W, out = [];
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (y > 0) out.push(i - W);
  if (y < H - 1) out.push(i + W);
  return out;
}

// Các vùng trống liền nhau (4 hướng), bỏ qua ô `skip`.
function regions(cells, W, H, skip = -1) {
  const seen = new Uint8Array(cells.length), sizes = [];
  cells.forEach((ch, start) => {
    if (start === skip || seen[start] || !isOpen(ch)) return;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      size++;
      for (const n of neighbors(i, W, H)) if (n !== skip && !seen[n] && isOpen(cells[n])) { seen[n] = 1; stack.push(n); }
    }
    sizes.push(size);
  });
  return sizes;
}

export function layoutMetrics(rows) {
  const { W, H } = boardSize(rows), cells = [...rows.join('')];
  let tripleSpots = 0;
  for (let i = 0; i < cells.length; i++) {
    const x = i % W;
    if (x <= W - 3 && isOpen(cells[i]) && isOpen(cells[i + 1]) && isOpen(cells[i + 2])) tripleSpots++;
    if (i + 2 * W < cells.length && isOpen(cells[i]) && isOpen(cells[i + W]) && isOpen(cells[i + 2 * W])) tripleSpots++;
    // chữ L: ô, ô dưới, ô dưới-phải (4 hướng xoay đều đếm qua 4 tổ hợp)
    if (x < W - 1 && i + W < cells.length) {
      const a = cells[i], b = cells[i + 1], c = cells[i + W], d = cells[i + W + 1];
      tripleSpots += [[a, c, d], [a, b, d], [a, b, c], [b, c, d]].filter(t => t.every(isOpen)).length;
    }
  }
  const base = regions(cells, W, H), largest = Math.max(0, ...base);
  let chokes = 0;
  cells.forEach((ch, i) => { if (isOpen(ch) && regions(cells, W, H, i).length > base.length) chokes++; });
  let hardCrates = 0, pairBlocks = 0;
  cells.forEach((ch, i) => {
    if (ch === 'X' && neighbors(i, W, H).filter(n => isOpen(cells[n])).length <= 1) hardCrates++;
    if (!isObstacle(ch)) return;
    // Vật cản ở đầu một cặp mèo cùng giống thẳng hàng: X O O hoặc O O X (ngang/dọc).
    const x = i % W;
    const pair = (a, b) => a >= 0 && b >= 0 && a < cells.length && b < cells.length && isCat(cells[a]) && cells[a] === cells[b];
    if ((x <= W - 3 && pair(i + 1, i + 2)) || (x >= 2 && pair(i - 1, i - 2)) || pair(i + W, i + 2 * W) || pair(i - W, i - 2 * W)) pairBlocks++;
  });
  return { tripleSpots, largest, chokes, hardCrates, pairBlocks, open: cells.filter(isOpen).length };
}

// Một con số để xếp hạng (chỉ so giữa các bố trí của CÙNG một màn).
export function layoutScore(rows) {
  const m = layoutMetrics(rows);
  return -0.04 * m.tripleSpots - 0.06 * m.largest + 0.6 * m.chokes + 0.8 * m.hardCrates + 0.6 * m.pairBlocks;
}
