// Luật đọc dữ liệu màn (thuần logic): đọc bàn / cỏ / thẻ viết gọn, bộ chia thẻ, tính sao. Dữ liệu màn ở data/levels.mjs.
// Sang Unity: static class LevelRules (C#), đọc LevelData (ScriptableObject / JSON xuất bằng npm run export:data).
import { LETTERS, SHAPES } from '../data/levels.mjs';
import { CAGE, VASE, ADAPTIVE } from '../data/tuning.mjs';
import { matchesSomewhere } from './board-rules.mjs';
import { boardSize } from './board-shapes.mjs';

// Cỏ (`grass`): lớp nằm DƯỚI mèo / ô trống, các hàng chuỗi cùng cỡ với `board` ('~' = ô có cỏ, '.' = sạch). Gom một cụm thì
// cỏ dưới các mèo của cụm bị phá (session.mjs). Màn có cỏ: phải dọn hết cỏ VÀ đủ điểm `target`. Ô thùng / kim loại / ngoài bàn
// không bao giờ có cỏ (bàn DDA đổi bố cục có thể đặt vật cản lên chỗ cỏ cũ).
export function parseGrass(level) {
  if (!level.grass) return null;
  const cells = level.board.join('');
  return [...level.grass.join('')].map((ch, k) => ch === '~' && !'XM#@%'.includes(cells[k] ?? '#'));
}
export const grassCount = level => (parseGrass(level) || []).filter(Boolean).length;

// Ô ngoài bàn ('#') chặn ô như kim loại (không đặt được, không vỡ, búa không đập được) nhưng không vẽ.
// Chữ thường ('o', 'k'...) = mèo bị nhốt trong chuồng (tuning.mjs CAGE): { group, cage: số khóa còn lại }.
// Chữ số '1'–'9' = ô của mèo béo 2×2 đang ngủ (board-rules.mjs wakeFatCats), số = số lần phải đánh thức; mỗi khối 2×2 chữ số liền
// nhau là một con: { fat, fatId: ô góc trên-trái, breed }.
// '@' = hộp thư: chặn ô như kim loại, không bao giờ vỡ (cả búa / herd); gom sát bên thì bay thư vào Goal (board-rules.mjs `mail`).
// '%' = bình hoa: { vase: số lần trúng còn lại } (tuning.mjs VASE), lần gom sát đầu chỉ nứt, hết lượt trúng thì vỡ (board-rules.mjs `cracked` / `shattered`).
// `syrup` (tuỳ chọn): lớp siro dâu phủ lên mèo, các hàng chuỗi cùng cỡ với bàn ('~' = mèo ở ô đó bị phủ; ô không phải mèo thường thì bỏ qua).
// Mèo phủ siro = chuồng 1 khoá có cờ `syrup` ({ group, cage: 1, syrup: true }): không vào cụm, gom sát bên là siro vỡ (board-rules.mjs `syrup`).
export function parseBoard(rows, syrup) {
  const width = rows[0]?.length ?? 0;
  const board = rows.join('').split('').map(ch => (ch === '.' ? null : ch === 'X' ? { block: true } : ch === 'M' ? { block: true, metal: true }
    : ch === '#' ? { block: true, metal: true, void: true }
      : ch === '@' ? { block: true, metal: true, mail: true }
      : ch === '%' ? { vase: VASE.HITS }
      : /[1-9]/.test(ch) ? { fat: Number(ch), fatMax: Number(ch), fatId: -1, breed: FAT_BREED }
        : ch !== ch.toUpperCase() ? { group: LETTERS[ch.toUpperCase()], locked: true, starting: true, cage: CAGE.LOCKS }
          : { group: LETTERS[ch], locked: true, starting: true }));
  board.forEach((cell, i) => {
    if (!cell?.fat || cell.fatId >= 0) return;
    const block = [i, i + 1, i + width, i + width + 1];
    if (i % width === width - 1 || !block.every(k => board[k]?.fat && board[k].fatId < 0)) throw new Error(`Mèo béo ở ô ${i} không đủ khối 2×2`);
    block.forEach(k => { board[k] = { ...board[k], fatId: i }; });
  });
  if (syrup) [...syrup.join('')].forEach((ch, i) => { if (ch === '~' && board[i]?.group && !board[i].cage) board[i] = { ...board[i], cage: 1, syrup: true }; });
  return board;
}
// Giống của mèo béo (vẽ to 2×2 trên bàn).
export const FAT_BREED = 'orange';

export function parseCard(spec) {
  const [kind, letters] = spec.includes(':') ? spec.split(':') : [null, spec.replace('|', '')];
  const offsets = kind ? { I: SHAPES.line, V: SHAPES.lineV, L: SHAPES.elbow }[kind]
    : spec.includes('|') ? SHAPES.dominoV : letters.length === 2 ? SHAPES.domino : SHAPES.single;
  return { offsets: offsets.map(point => point.slice()), items: [...letters].map(ch => ({ group: LETTERS[ch] })) };
}


// Sao theo số lượt còn dư lúc thắng.
export function starsFor(level, movesLeft) {
  if (movesLeft >= Math.ceil(level.moves * 0.3)) return 3;
  if (movesLeft >= Math.ceil(level.moves * 0.12)) return 2;
  return 1;
}

// Mặc định của bộ chia khi màn không ghi `shapes` / `assist` (adaptive.mjs cũng dựa vào đây để chỉnh).
export const DEFAULT_SHAPES = { single: 6, domino: 5, triple: 1 };
export const DEFAULT_ASSIST = 0.3;

// Bộ chia: phát hết thẻ kịch bản, sau đó thẻ ngẫu nhiên theo tỉ lệ hình của màn. `assist` = xác suất màu
// của một mèo được chọn theo mèo đang có trên bàn (nhiều con cùng màu thì dễ ra màu đó) cho đỡ bí.
// `harsh` (lần đầu vào màn paywall, adaptive.mjs): thẻ "xấu" — mỗi mèo lấy màu ÍT có trên bàn nhất, các mèo trong cùng thẻ khác màu nhau
// (khó ghép cụm), không có trợ màu. Màn trông y hệt bình thường (cùng mục tiêu, cùng số lượt).
// `queue` (DDA, adaptive.mjs tuneDealer): -2 … +2, nút độ khó chính của hàng thẻ. Dương: mỗi thẻ có xác suất ADAPTIVE.QUEUE_HARSH × queue
// là thẻ xấu như trên; âm: xác suất ADAPTIVE.QUEUE_HELP × |queue| là thẻ "giúp" (thử vài thẻ màu đang có trên bàn, lấy thẻ gom được ngay).
export function makeDealer(level, rng = Math.random) {
  const script = (level.deck || []).map(parseCard);
  const pool = [...level.cats].map(ch => LETTERS[ch]);
  const weights = level.shapes || DEFAULT_SHAPES;
  const bag = Object.entries(weights).flatMap(([name, n]) => Array(n).fill(name));
  const pick = list => list[Math.floor(rng() * list.length)];
  const color = board => {
    const present = board.filter(cell => cell?.group).map(cell => cell.group).filter(group => pool.includes(group));
    return present.length && rng() < (level.assist ?? DEFAULT_ASSIST) ? pick(present) : pick(pool);
  };
  const shapeOf = () => { const shape = pick(bag); return SHAPES[shape === 'triple' ? (rng() < 0.5 ? 'line' : 'elbow') : shape].map(point => point.slice()); };
  const harshCard = (board, offsets) => {
    const count = group => board.filter(cell => cell?.group === group).length;
    const order = pool.map(group => [group, count(group) + rng() * .5]).sort((a, b) => a[1] - b[1]).map(([group]) => group);
    return { offsets, items: offsets.map((_, k) => ({ group: order[k % order.length] })) };
  };
  const { W, H } = boardSize(level.board), queue = level.queue ?? 0;
  const helpCard = board => {
    const present = [...new Set(board.filter(cell => cell?.group && !cell.cage).map(cell => cell.group))].filter(group => pool.includes(group));
    for (let k = 0; k < 4 && present.length; k++) {
      const offsets = shapeOf(), group = pick(present), card = { offsets, items: offsets.map(() => ({ group })) };
      if (matchesSomewhere(board, W, H, card)) return card;
    }
    return null;
  };
  return board => {
    if (script.length) return script.shift();
    if (queue < 0 && rng() < ADAPTIVE.QUEUE_HELP * -queue) { const card = helpCard(board); if (card) return card; }
    const offsets = shapeOf();
    if (level.harsh || (queue > 0 && rng() < ADAPTIVE.QUEUE_HARSH * queue)) return harshCard(board, offsets);
    return { offsets, items: offsets.map(() => ({ group: color(board) })) };
  };
}
