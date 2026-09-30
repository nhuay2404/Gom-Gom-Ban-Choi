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
    name: 'Hello, Kitty', feature: 'Drag & match 3',
    moves: 4, target: 60, cats: 'OG',
    board: ['......', '......', '..OO..', '......', '.GG...', '......'],
    deck: ['O', 'G', 'O', 'G'],
    tutorial: [
      { type: 'drag', anchor: 16, text: 'Drag the orange cat onto the glowing cell to make 3!' },
      { type: 'drag', anchor: 27, text: 'Great! Now match 3 gray cats.' },
    ],
  },
  {
    name: 'Round and Round', feature: 'Rotate cards',
    moves: 5, target: 60, cats: 'OGW',
    board: ['......', '.G.W..', '.W.G..', '.GOW..', '......', '......'],
    deck: ['OO', 'W|W'],
    tutorial: [
      { type: 'rotate', offsets: SHAPES.dominoV, text: 'The horizontal card won\'t fit the gap. Tap the card to rotate it!' },
      { type: 'drag', anchor: 8, text: 'A perfect fit! Drag it into the gap.' },
      { type: 'drag', anchor: 8, text: 'Match 4 white cats at once for more points!' },
    ],
  },
  {
    name: 'Go Big', feature: 'Big match = big score',
    moves: 8, target: 170, cats: 'OGW', assist: 0.5,
    board: ['......', '......', 'OO.OO.', '......', '..GW..', '..WG..'],
    deck: ['O'],
    tutorial: [
      { type: 'drag', anchor: 14, text: 'The more cats you match, the higher the score. Make 5 orange cats!' },
      { type: 'info', text: 'Match 3 = 30 · 4 = 50 · 5 = 80 · 6+ = 120 points. Now play on your own!' },
    ],
  },
  {
    name: 'Hold Slot', feature: 'Hold a card',
    moves: 10, target: 120, cats: 'OGW', assist: 0.5,
    board: ['......', '......', '..OO..', '......', '...WW.', '......'],
    // Thẻ thứ 3 (xám) phải khác mèo trắng đang cất, để lúc chạm Gửi tạm là một lần đổi thẻ thật sự.
    deck: ['W', 'O', 'G'],
    tutorial: [
      { type: 'hold', text: 'The next card fits better! Drag the white cat into the Hold slot.' },
      { type: 'drag', anchor: 16, text: 'The orange cat fits perfectly. Drag it onto the glowing cell!' },
      { type: 'tapHold', text: 'Tap the Hold slot to take the white cat back.' },
      { type: 'drag', anchor: 29, text: 'Match 3 white cats! You can use Hold as many times as you like.' },
    ],
  },
  {
    name: 'Practice', feature: 'Free play',
    moves: 16, target: 200, cats: 'OGW', assist: 0.4, // dư lượt: màn luyện tay
    board: ['O....G', '......', '..WW..', '......', 'G....O', '......'],
    deck: [],
  },
  {
    name: 'Tabby Cat', feature: '4th cat breed',
    moves: 16, target: 220, cats: 'OGWT', assist: 0.4, // dư lượt: làm quen giống mèo thứ 4
    board: ['OO....', '......', '...GG.', '......', 'WW....', '....TT'],
    deck: ['T'],
    tutorial: [
      { type: 'info', text: 'The tabby cat joins! 4 breeds are harder to match, so check the next cards and plan ahead.' },
      { type: 'drag', anchor: 33, free: true, text: 'Say hi to the newcomer: match 3 tabby cats!' },
    ],
  },
  {
    name: 'Crates', feature: 'Crates block cells',
    moves: 14, target: 310, cats: 'OGWT', assist: 0.4, shapes: { single: 4, domino: 4, triple: 3 },
    board: ['.....O', 'T.X..X', 'T..G..', 'X..GXX', '.XXX.X', 'WX..XW'],
    deck: ['L:GGT'],
    tutorial: [
      { type: 'info', text: 'Crates block cells, so cats can\'t be placed on them! Match cats next to a crate to break it.' },
      { type: 'drag', anchor: 3, free: true, text: 'Match 4 gray cats next to the crate to break it!' },
    ],
  },
  {
    name: 'Tight Board', feature: 'Make room',
    moves: 12, target: 340, cats: 'OGWT', assist: 0.3,
    board: ['OGW.TO', 'GW..OT', 'T.OG.W', 'WT.GO.', '.OWT.G', 'GT..WO'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Tight board! Make room first — if you run out of space, you lose.' }],
  },
  {
    name: 'Cat House', feature: 'Siamese cat',
    moves: 20, target: 270, cats: 'OGWTS', assist: 0.45, // dư lượt: nghỉ trước màn khó
    board: ['SS....', '......', '..O..G', '..O..G', '......', 'W....T'],
    deck: ['S'],
  },
  {
    name: 'Grand Challenge', feature: 'All 6 breeds', hard: true,
    moves: 18, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['K.O..S', 'K.O.T.', '..WW.T', 'G.....', 'G.SS.K', '..T..O'],
    deck: [],
  },
  // ===== Chương 2 (màn 11–20, phòng khách): khối kim loại 'M' chiếm ô, không bao giờ vỡ =====
  // Nhịp: 11 dạy (tutorial) -> 12 luyện -> 13 trộn thùng gỗ -> 14 tường chia bàn -> 15 nghỉ
  //       -> 16 mê cung -> 17 bàn chật -> 18 nghỉ -> 19 cửa sắt (trước boss) -> 20 BOSS.
  {
    name: 'Metal Block', feature: 'Metal blocks never break',
    moves: 8, target: 120, cats: 'OGW', assist: 0.5,
    board: ['......', '.MM...', 'O..G..', 'O.MG..', '......', 'W...W.'],
    deck: ['O', 'G'],
    tutorial: [
      { type: 'info', text: 'New obstacle: metal blocks! Like crates, they take up a cell. Unlike crates, they never break.' },
      { type: 'drag', anchor: 24, text: 'Match 3 orange cats right next to the metal. See? It stays put.' },
      { type: 'drag', anchor: 27, free: true, text: 'Plan your matches around the metal. Match 3 gray cats!' },
    ],
  },
  {
    name: 'Steel Corners', feature: 'Work around metal',
    moves: 17, target: 240, cats: 'OGWT', assist: 0.45, // dư lượt: luyện kim loại
    board: ['M....M', '..OO..', '.G..G.', '.G..G.', '..TT..', 'M....M'],
    deck: [],
  },
  {
    name: 'Crate & Steel', feature: 'Crates break, metal stays',
    moves: 18, target: 270, cats: 'OGWT', assist: 0.4, // dư lượt: làm quen thùng gỗ + kim loại
    board: ['X.M..X', '.O..O.', 'MXGG..', '..W.XM', '.O..W.', 'X..M.X'],
    deck: [],
  },
  {
    name: 'Divided', feature: 'A metal wall splits the board',
    moves: 14, target: 230, cats: 'OGWT', assist: 0.4,
    board: ['..M...', '.O.M.G', '..M...', '...M..', '.G.M.O', '..M..T'],
    deck: [],
  },
  {
    name: 'Sunny Nap', feature: 'Take a breather', breather: true,
    moves: 19, target: 210, cats: 'OGW', assist: 0.5, // dư lượt: breather
    board: ['......', '.M..M.', '..OO..', '..WW..', '.M..M.', '......'],
    deck: [],
  },
  {
    name: 'Steel Maze', feature: 'Five breeds + metal maze',
    moves: 15, target: 230, cats: 'OGWTS', assist: 0.4,
    board: ['M.M..M', '..O.G.', 'M..M..', '.W..M.', '..M..T', 'S..M..'],
    deck: [],
  },
  {
    name: 'Tight Steel', feature: 'Crowded + metal',
    moves: 14, target: 240, cats: 'OGWTS', assist: 0.35,
    board: ['OGM.TO', 'G..WM.', 'M.OG.W', '.TM.O.', 'W.GM.S', '.S.T.M'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Crowded and full of steel! Clear space early, or you\'ll run out of room.' }],
  },
  {
    name: 'Tea Break', feature: 'Take a breather', breather: true,
    moves: 20, target: 230, cats: 'OGWT', assist: 0.5, // dư lượt: breather
    board: ['......', '.OO.M.', '.M....', '....M.', '.M.GG.', '......'],
    deck: [],
  },
  {
    name: 'Iron Gate', feature: 'All 6 breeds + steel',
    moves: 18, target: 300, cats: 'OGWTSK', assist: 0.4,
    board: ['M.X.XM', '.O..G.', 'X.MM.X', '..W.K.', '.S.XT.', 'M..O.M'],
    deck: [],
  },
  {
    name: 'Steel Fortress', feature: 'Boss level', hard: true, boss: true,
    moves: 20, target: 350, cats: 'OGWTSK', assist: 0.4,
    board: ['MM..MM', 'M.OG.M', '.X..X.', '.TK.S.', 'M.W..M', 'MM..MM'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Boss level: the Steel Fortress! Use every trick: rotate, hold, and big matches.' }],
  },
];

export function parseBoard(rows) {
  return rows.join('').split('').map(ch => (ch === '.' ? null : ch === 'X' ? { block: true } : ch === 'M' ? { block: true, metal: true }
    : { group: LETTERS[ch], locked: true, starting: true }));
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
