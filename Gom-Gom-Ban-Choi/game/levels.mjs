// 20 màn của Gom Gom Rotate: dữ liệu màn + bộ chia thẻ. Thuần dữ liệu/logic, không đụng giao diện
// (bộ mô phỏng tools/simulate-levels.mjs dùng chung file này để cân độ khó).
//
// Tiến trình (độ khó răng cưa: lên dần, thả ở màn nghỉ, lên cao hơn ở boss):
//   1–2  Tutorial: kéo thả + gom 3 · xoay thẻ + ô Hold + mẹo gom to (hết tutorial sau màn 2)
//   3–4  Chơi bình thường, chưa có vật cản
//   5    Giới thiệu thùng gỗ (barrel)        6–7  Thùng gỗ trong màn (+ mèo mướp)
//   8    Giới thiệu khối kim loại, kiêm màn nghỉ (breather)
//   9    Kim loại + thùng gỗ (+ mèo Xiêm)    10   BOSS chương 1 (đủ 6 giống, cả hai vật cản)
//   11–18 Xào lại cơ chế: không vật cản -> thùng -> kim loại -> cả hai, hai vòng, vòng sau khó hơn
//   18   Bottleneck (bức tường độ khó trước màn nghỉ + Boss)
//   19   Màn nghỉ                           20   BOSS chương 2
//
// `tier` = cấp độ khó hiện ở bảng vào màn và bản đồ: chill · normal · hard · boss.
// `introduces` = cơ chế mới của màn ('crate' | 'metal'), bảng vào màn gắn nhãn NEW.
//
// Bàn: 6 chuỗi x 6 ký tự, '.' ô trống, 'X' thùng gỗ (chặn ô, vỡ khi gom mèo sát bên), 'M' khối kim loại
// (chặn ô, không bao giờ vỡ). Ký tự mèo:
export const LETTERS = { O: 'orange', G: 'gray', W: 'white', K: 'tuxedo', S: 'siamese', T: 'tabby' };

// Thẻ viết gọn: 'O' đơn · 'OG' đôi ngang · 'O|G' đôi dọc · 'I:OGW' ba ngang · 'V:OGW' ba dọc · 'L:OGW' chữ L.
const SHAPES = {
  single: [[0, 0]], domino: [[0, 0], [0, 1]], dominoV: [[0, 0], [1, 0]],
  line: [[0, 0], [0, 1], [0, 2]], lineV: [[0, 0], [1, 0], [2, 0]], elbow: [[0, 0], [1, 0], [1, 1]],
};

export const LEVELS = [
  // ===== Chương 1: vườn =====
  {
    name: 'Hello, Kitty', feature: 'Drag & match 3', tier: 'normal',
    moves: 4, target: 60, cats: 'OG',
    board: ['......', '......', '..OO..', '......', '.GG...', '......'],
    deck: ['O', 'G', 'O', 'G'],
    // Mở đầu: giới thiệu mục tiêu điểm và số lượt ({target}/{moves} lấy từ màn), rồi mới dạy kéo thả.
    tutorial: [
      { type: 'info', focus: 'score', text: 'Fill this bar to win! Reach {target} points to clear the level.' },
      { type: 'info', focus: 'moves', text: 'You have {moves} moves. Placing a card uses 1 move, so make every move count!' },
      { type: 'drag', anchor: 16, text: 'Drag the orange cat onto the glowing cell to make 3!' },
      { type: 'drag', anchor: 27, text: 'Great! Now match 3 gray cats.' },
    ],
  },
  {
    // Tutorial cuối: xoay thẻ -> cất thẻ vào Hold -> mẹo gom to -> lấy thẻ từ Hold ra.
    name: 'Round and Round', feature: 'Rotate & Hold', tier: 'normal',
    moves: 6, target: 90, cats: 'OGW',
    board: ['...GG.', '.W....', '.G....', 'OW....', '....WW', '......'],
    deck: ['OO', 'W', 'G', 'G'],
    tutorial: [
      { type: 'rotate', offsets: SHAPES.dominoV, text: 'This card is sideways and won\'t fit the gap. Tap the card to rotate it!' },
      { type: 'drag', anchor: 6, text: 'A perfect fit! Drag it into the gap to match 3 orange cats.' },
      { type: 'hold', text: 'This white cat doesn\'t fit yet. Drag it into the Hold slot to save it for later.' },
      { type: 'drag', anchor: 5, text: 'Now match 3 gray cats!' },
      { type: 'info', text: 'Tip: bigger matches score more! 3 = 30 · 4 = 50 · 5 = 80 · 6+ = 120 points.' },
      { type: 'tapHold', text: 'Tap the Hold slot to bring the white cat back.' },
      { type: 'drag', anchor: 27, text: 'Match 3 white cats! You can use Hold as often as you like.' },
    ],
  },
  {
    name: 'Go Big', feature: 'Free play', tier: 'normal',
    moves: 10, target: 170, cats: 'OGW', assist: 0.5,
    board: ['......', '.O..G.', '......', '..WW..', '......', '.G..O.'],
    deck: [],
  },
  {
    name: 'Triple Cards', feature: 'More 3-cat cards', tier: 'normal',
    moves: 12, target: 280, cats: 'OGW', assist: 0.4, shapes: { single: 4, domino: 5, triple: 2 },
    board: ['O....W', '..GG..', '......', '.W..O.', '..OW..', 'G....G'],
    deck: [],
  },
  {
    name: 'Crates', feature: 'Crates block cells', tier: 'normal', introduces: 'crate',
    moves: 12, target: 180, cats: 'OGW', assist: 0.45,
    board: ['......', '.X....', '..G.X.', 'X.G...', '...X.O', 'W.X..O'],
    deck: ['G'],
    tutorial: [
      { type: 'info', text: 'Crates block cells, so cats can\'t sit on them. Match cats next to a crate to break it!' },
      { type: 'drag', anchor: 8, free: true, text: 'Match 3 gray cats next to the crate to break it!' },
    ],
  },
  {
    name: 'Crate Garden', feature: 'Crates + tabby cat', tier: 'normal',
    moves: 14, target: 260, cats: 'OGWT', assist: 0.4,
    board: ['X..O..', '.GG..X', '..X.W.', 'W...X.', '.X.T..', 'T..X.O'],
    deck: [],
  },
  {
    name: 'Tight Crates', feature: 'Crowded + crates', tier: 'hard',
    moves: 12, target: 270, cats: 'OGWT', assist: 0.35,
    board: ['OGX.TO', 'G..WX.', 'X.OG.W', '.TX.O.', 'W.GX.T', '.T..XO'],
    deck: [],
  },
  {
    name: 'Steel Nap', feature: 'Metal never breaks', tier: 'chill', introduces: 'metal',
    moves: 18, target: 240, cats: 'OGWT', assist: 0.5,
    board: ['......', '.M..M.', '..OO..', '..WW..', '.M..M.', '......'],
    deck: [],
    tutorial: [{ type: 'info', text: 'New: metal blocks! Like crates they take up a cell, but they never break. Plan around them.' }],
  },
  {
    name: 'Iron & Oak', feature: 'Metal + crates', tier: 'hard',
    moves: 16, target: 300, cats: 'OGWTS', assist: 0.4,
    board: ['X.M..X', '.O..O.', 'MXGG..', '..W.XM', '.O..T.', 'X..M.X'],
    deck: [],
  },
  {
    name: 'Garden Fortress', feature: 'Boss', tier: 'boss',
    moves: 20, target: 370, cats: 'OGWTSK', assist: 0.4,
    board: ['MX..XM', 'X.OG.X', '.K..S.', '.TW.K.', 'X.S..X', 'MX..XM'],
    deck: [],
  },
  // ===== Chương 2: phòng khách — xào lại cơ chế, hai vòng: trống -> thùng -> kim loại -> cả hai =====
  {
    name: 'Fresh Start', feature: 'No obstacles', tier: 'normal',
    moves: 14, target: 240, cats: 'OGWTS', assist: 0.45,
    board: ['O....G', '..T...', '.W..S.', '..SW..', '...T..', 'G....O'],
    deck: [],
  },
  {
    name: 'Crate Scatter', feature: 'Crates', tier: 'normal',
    moves: 15, target: 240, cats: 'OGWTS', assist: 0.4,
    board: ['.X..X.', 'X.O..G', '..TX..', '.S..W.', 'G..X.T', '.X..X.'],
    deck: [],
  },
  {
    name: 'Steel Corners', feature: 'Metal', tier: 'normal',
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.4,
    board: ['M....M', '..OO..', '.G..G.', '.S..S.', '..TT..', 'M....M'],
    deck: [],
  },
  {
    name: 'Crate & Steel', feature: 'Crates + metal', tier: 'hard',
    moves: 16, target: 270, cats: 'OGWTSK', assist: 0.4,
    board: ['X.M..X', '.O..K.', 'MXGG..', '..W.XM', '.K..W.', 'X..M.X'],
    deck: [],
  },
  {
    name: 'Open Field', feature: 'No obstacles, 6 breeds', tier: 'normal',
    moves: 14, target: 290, cats: 'OGWTSK', assist: 0.4,
    board: ['K.O..S', '..O.T.', '.WW..T', 'G.....', 'G.S..K', '..T..O'],
    deck: [],
  },
  {
    name: 'Crate Maze', feature: 'Lots of crates', tier: 'hard',
    moves: 16, target: 260, cats: 'OGWTSK', assist: 0.4,
    board: ['X...X.', '.O.G..', '..S.X.', 'XW.K..', '..T..X', '.X...O'],
    deck: [],
  },
  {
    name: 'Divided', feature: 'A metal wall splits the board', tier: 'hard',
    moves: 15, target: 240, cats: 'OGWTSK', assist: 0.4,
    board: ['..M...', '.O.M.G', '..M..S', '.K.M..', '.G.M.O', '..M..T'],
    deck: [],
  },
  {
    // Bottleneck của chương 2: bot thắng ~24% (mục tiêu cao, ít hỗ trợ màu), điểm TB ~294/330 = hụt một cú gom
    // -> người chơi thua sát nút, muốn chơi lại hoặc dùng booster. Ngay sau là màn nghỉ 19.
    name: 'Iron Gate', feature: 'Crates + metal', tier: 'hard',
    moves: 18, target: 330, cats: 'OGWTSK', assist: 0.3,
    board: ['M.X.XM', '.O..G.', 'X.MM.X', '..W.K.', '.S.XT.', 'M..O.M'],
    deck: [],
  },
  {
    name: 'Tea Break', feature: 'Take a breather', tier: 'chill',
    moves: 20, target: 290, cats: 'OGWT', assist: 0.5,
    board: ['......', '.OO.M.', '.M....', '....M.', '.M.GG.', '......'],
    deck: [],
  },
  {
    name: 'Steel Fortress', feature: 'Boss', tier: 'boss',
    moves: 22, target: 380, cats: 'OGWTSK', assist: 0.4,
    board: ['MM..MM', 'M.OG.M', '.X..X.', '.TK.S.', 'M.W..M', 'MM..MM'],
    deck: [],
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

// Mặc định của bộ chia khi màn không ghi `shapes` / `assist` (adaptive.mjs cũng dựa vào đây để chỉnh).
export const DEFAULT_SHAPES = { single: 6, domino: 5, triple: 1 };
export const DEFAULT_ASSIST = 0.3;

// Bộ chia: phát hết thẻ kịch bản, sau đó thẻ ngẫu nhiên theo tỉ lệ hình của màn. `assist` = xác suất màu
// của một mèo được chọn theo mèo đang có trên bàn (nhiều con cùng màu thì dễ ra màu đó) cho đỡ bí.
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
  return board => {
    if (script.length) return script.shift();
    let shape = pick(bag);
    if (shape === 'triple') shape = rng() < 0.5 ? 'line' : 'elbow';
    const offsets = SHAPES[shape].map(point => point.slice());
    return { offsets, items: offsets.map(() => ({ group: color(board) })) };
  };
}
