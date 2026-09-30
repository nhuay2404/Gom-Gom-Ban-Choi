// 10 màn đầu của Gom Gom Rotate: dữ liệu màn + bộ chia thẻ. Thuần dữ liệu/logic, không đụng giao diện
// (bộ mô phỏng tools/simulate-levels.mjs dùng chung file này để cân độ khó).
//
// Nhịp (beat) theo khuôn "dạy -> luyện -> biến tấu -> thử thách", độ khó răng cưa (lên, thả nhẹ, lên cao hơn):
//   1 Kéo thả + gom 3 (tutorial ép nước)   2 Xoay thẻ (tutorial)       3 Gom to = điểm to (tutorial)
//   4 Ô gửi tạm (tutorial)                  5 Luyện tập (nghỉ)          6 Thêm loại mèo
//   7 Thẻ 3 mèo (tip)                       8 Bàn chật (đỉnh nhỏ)        9 Thêm loại mèo (thả nhẹ)
//  10 Thử thách chương (Khó)
//
// Bàn: 6 chuỗi x 6 ký tự, '.' là ô trống, 'X' là thùng gỗ (chặn ô, vỡ khi gom mèo sát bên). Ký tự mèo:
export const LETTERS = { O: 'orange', G: 'gray', W: 'white', K: 'tuxedo', S: 'siamese', T: 'tabby' };

// Thẻ viết gọn: 'O' đơn · 'OG' đôi ngang · 'O|G' đôi dọc · 'I:OGW' ba ngang · 'V:OGW' ba dọc · 'L:OGW' chữ L.
const SHAPES = {
  single: [[0, 0]], domino: [[0, 0], [0, 1]], dominoV: [[0, 0], [1, 0]],
  line: [[0, 0], [0, 1], [0, 2]], lineV: [[0, 0], [1, 0], [2, 0]], elbow: [[0, 0], [1, 0], [1, 1]],
};

export const LEVELS = [
  {
    name: 'Chào mèo nhỏ', feature: 'Kéo thả & gom 3',
    moves: 4, target: 60, cats: 'OG',
    board: ['......', '......', '..OO..', '......', '.GG...', '......'],
    deck: ['O', 'G', 'O', 'G'],
    tutorial: [
      { type: 'drag', anchor: 16, text: 'Kéo mèo cam vào ô sáng để ghép đủ 3 con!' },
      { type: 'drag', anchor: 27, text: 'Tuyệt! Giờ gom 3 mèo xám nhé.' },
    ],
  },
  {
    name: 'Xoay xoay', feature: 'Xoay thẻ',
    moves: 5, target: 60, cats: 'OGW',
    board: ['......', '.G.W..', '.W.G..', '.GOW..', '......', '......'],
    deck: ['OO', 'W|W'],
    tutorial: [
      { type: 'rotate', offsets: SHAPES.dominoV, text: 'Thẻ nằm ngang không lọt khe. Chạm vào thẻ để xoay!' },
      { type: 'drag', anchor: 8, text: 'Vừa khít rồi! Kéo vào khe nào.' },
      { type: 'drag', anchor: 8, text: 'Gom 4 mèo trắng một lúc để được nhiều điểm hơn!' },
    ],
  },
  {
    name: 'Gom thật to', feature: 'Cụm lớn = điểm lớn',
    moves: 8, target: 170, cats: 'OGW', assist: 0.5,
    board: ['......', '......', 'OO.OO.', '......', '..GW..', '..WG..'],
    deck: ['O'],
    tutorial: [
      { type: 'drag', anchor: 14, text: 'Gom càng nhiều mèo, điểm càng cao. Ghép 5 mèo cam nào!' },
      { type: 'info', text: 'Gom 3 = 30 · 4 = 50 · 5 = 80 · 6+ = 120 điểm. Giờ bạn tự chơi nhé!' },
    ],
  },
  {
    name: 'Ô gửi tạm', feature: 'Gửi tạm thẻ',
    moves: 10, target: 120, cats: 'OGW', assist: 0.5,
    board: ['......', '......', '..OO..', '......', '...WW.', '......'],
    deck: ['W', 'O'],
    tutorial: [
      { type: 'hold', text: 'Thẻ sau hợp hơn! Kéo mèo trắng vào ô Gửi tạm để cất.' },
      { type: 'drag', anchor: 16, text: 'Mèo cam vừa khít. Kéo vào ô sáng!' },
      { type: 'tapHold', text: 'Chạm ô Gửi tạm để lấy mèo trắng ra.' },
      { type: 'drag', anchor: 29, text: 'Gom 3 mèo trắng! Gửi tạm dùng bao nhiêu lần cũng được.' },
    ],
  },
  {
    name: 'Luyện tay', feature: 'Tự chơi',
    moves: 12, target: 200, cats: 'OGW', assist: 0.4,
    board: ['O....G', '......', '..WW..', '......', 'G....O', '......'],
    deck: [],
  },
  {
    name: 'Mèo mướp', feature: 'Loại mèo thứ 4',
    moves: 12, target: 220, cats: 'OGWT', assist: 0.4,
    board: ['OO....', '......', '...GG.', '......', 'WW....', '....TT'],
    deck: ['T'],
    tutorial: [
      { type: 'info', text: 'Mèo mướp gia nhập! 4 loại mèo sẽ khó ghép hơn, nhớ nhìn thẻ sắp tới để tính nước.' },
      { type: 'drag', anchor: 33, free: true, text: 'Chào bạn mới: gom 3 mèo mướp nào!' },
    ],
  },
  {
    name: 'Thùng gỗ', feature: 'Thùng gỗ chặn ô',
    moves: 14, target: 310, cats: 'OGWT', assist: 0.4, shapes: { single: 4, domino: 4, triple: 3 },
    board: ['.....O', 'T.X..X', 'T..G..', 'X..GXX', '.XXX.X', 'WX..XW'],
    deck: ['L:GGT'],
    tutorial: [
      { type: 'info', text: 'Thùng gỗ chặn ô, không đặt mèo lên được! Gom mèo sát bên thùng để phá nó.' },
      { type: 'drag', anchor: 3, free: true, text: 'Gom 4 mèo xám cạnh thùng để phá thùng nào!' },
    ],
  },
  {
    name: 'Bàn chật', feature: 'Dọn chỗ',
    moves: 12, target: 340, cats: 'OGWT', assist: 0.3,
    board: ['OGW.TO', 'GW..OT', 'T.OG.W', 'WT.GO.', '.OWT.G', 'GT..WO'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Bàn chật! Dọn chỗ trước, hết chỗ đặt là thua đấy.' }],
  },
  {
    name: 'Nhà đông mèo', feature: 'Mèo Xiêm',
    moves: 16, target: 270, cats: 'OGWTS', assist: 0.45,
    board: ['SS....', '......', '..O..G', '..O..G', '......', 'W....T'],
    deck: ['S'],
  },
  {
    name: 'Thử thách lớn', feature: 'Đủ 6 loại mèo', hard: true,
    moves: 18, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['K.O..S', 'K.O.T.', '..WW.T', 'G.....', 'G.SS.K', '..T..O'],
    deck: [],
  },
];

export function parseBoard(rows) {
  return rows.join('').split('').map(ch => (ch === '.' ? null : ch === 'X' ? { block: true } : { group: LETTERS[ch], locked: true, starting: true }));
}

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

// Bộ chia: phát hết thẻ kịch bản, sau đó thẻ ngẫu nhiên theo tỉ lệ hình của màn. `assist` = xác suất màu
// của một mèo được chọn theo mèo đang có trên bàn (nhiều con cùng màu thì dễ ra màu đó) cho đỡ bí.
export function makeDealer(level, rng = Math.random) {
  const script = (level.deck || []).map(parseCard);
  const pool = [...level.cats].map(ch => LETTERS[ch]);
  const weights = level.shapes || { single: 6, domino: 5, triple: 1 };
  const bag = Object.entries(weights).flatMap(([name, n]) => Array(n).fill(name));
  const pick = list => list[Math.floor(rng() * list.length)];
  const color = board => {
    const present = board.filter(cell => cell?.group).map(cell => cell.group).filter(group => pool.includes(group));
    return present.length && rng() < (level.assist ?? 0.3) ? pick(present) : pick(pool);
  };
  return board => {
    if (script.length) return script.shift();
    let shape = pick(bag);
    if (shape === 'triple') shape = rng() < 0.5 ? 'line' : 'elbow';
    const offsets = SHAPES[shape].map(point => point.slice());
    return { offsets, items: offsets.map(() => ({ group: color(board) })) };
  };
}
