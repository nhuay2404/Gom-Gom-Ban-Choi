// Dữ liệu 100 màn của Gom Gom Rotate (thuần dữ liệu; hàm đọc màn + bộ chia thẻ ở core/level-rules.mjs). Không đụng giao diện
// (bộ mô phỏng tools/levels/simulate-levels.mjs dùng chung file này để cân độ khó).
//
// Tiến trình (độ khó răng cưa: lên dần, thả ở màn nghỉ, lên cao hơn ở boss):
//   1–2  Tutorial: kéo thả + gom 3 · xoay thẻ + mẹo gom to
//   3–4  Chơi bình thường, chưa có vật cản
//   5    Giới thiệu thùng gỗ (barrel)        6–7  Thùng gỗ trong màn (+ mèo mướp)
//   8    Giới thiệu khối kim loại, kiêm màn nghỉ (breather)
//   9    Kim loại + thùng gỗ (+ mèo Xiêm)    10   BOSS chương 1 (đủ 6 giống, cả hai vật cản)
//   11   Mở ô Hold (tutorial) + giới thiệu chuồng mèo: từ đây bàn to hơn, nhiều hình, các màn khó hơn nên mới cần chỗ cất thẻ
//   Từ màn 11, mỗi chương 10 màn theo nhịp Royal Match "học -> thử thách -> ăn mừng":
//     x1–x4 normal dễ dần lên · x5 HARD (đỉnh giữa chương) · x6 màn nghỉ (chill, ăn mừng sau đỉnh)
//     x7–x9 normal khó dần lên · x0 BOSS (đỉnh cuối chương); màn x1 chương sau lại dễ (thở sau boss).
//   Mục tiêu điểm cân bằng bot (tỉ lệ thắng của bot, cận dưới của người thật): normal 95% -> ~70% trong chương,
//   hard 45% -> 33%, nghỉ ≥95%, boss 30% -> 22% (chương sau khó hơn chương trước một chút).
//   Chương 3 (21–30) phòng khách, chương 4 (31–40) phòng ngủ, chương 5 (41–50) bếp; mỗi chương mở sau boss chương trước.
//   Màn 21–30 dựng bằng script một lần. Màn 32–100 sinh bằng tools/levels/generate-levels.mjs: mỗi cơ chế (thùng, kim loại, chuồng,
//   cỏ, mèo béo) là một lớp độ khó, số lớp tăng theo tier + chương (layerCount); chương 4 lấy mèo béo làm lớp chính
//
// `tier` = cấp độ khó hiện ở bảng vào màn và bản đồ: chill · normal · hard · boss.
// `introduces` = cơ chế mới của màn ('crate' | 'metal' | 'hold' | 'cage' | 'grass' | 'fat'), bảng vào màn gắn nhãn NEW.
// `expand` = khuôn hình (board-shapes.mjs) khi độ khó thích ứng cần bàn to hơn cho màn 6×6 vuông.
//
// Bàn: các chuỗi cùng độ dài, 6×6 tới 8×8, hình dạng tuỳ màn (chương 1 chủ yếu 6×6, chương 2 to dần và
// nhiều hình: tim, tam giác, kim cương...). '.' ô trống, '#' ngoài bàn, 'X' thùng gỗ (chặn ô, vỡ khi gom
// mèo sát bên), 'M' khối kim loại (chặn ô, không bao giờ vỡ). Ký tự mèo:
export const LETTERS = { O: 'orange', G: 'gray', W: 'white', K: 'tuxedo', S: 'siamese', T: 'tabby' };

// Thẻ viết gọn: 'O' đơn · 'OG' đôi ngang · 'O|G' đôi dọc · 'I:OGW' ba ngang · 'V:OGW' ba dọc · 'L:OGW' chữ L.
export const SHAPES = {
  single: [[0, 0]], domino: [[0, 0], [0, 1]], dominoV: [[0, 0], [1, 0]],
  line: [[0, 0], [0, 1], [0, 2]], lineV: [[0, 0], [1, 0], [2, 0]], elbow: [[0, 0], [1, 0], [1, 1]],
};

export const LEVELS = [
  // ===== Chương 1: vườn =====
  {
    // Tutorial bằng hình, chỉ MỘT lần kéo (không chữ); các lượt sau người chơi tự chơi (ô 27 gom 3 mèo xám).
    name: 'Hello, Kitty', feature: 'Drag & match 3', tier: 'normal',
    moves: 4, target: 60, cats: 'OG',
    board: ['......', '......', '..OO..', '......', '.GG...', '......'],
    deck: ['O', 'G', 'O', 'G'],
    tutorial: [{ type: 'drag', anchor: 16 }],
  },
  {
    // Tutorial cuối phần mở đầu: xoay thẻ -> mẹo gom to. Chưa có ô Hold (mở ở màn 11).
    name: 'Round and Round', feature: 'Rotate cards', tier: 'normal',
    moves: 6, target: 90, cats: 'OGW',
    board: ['...GG.', '.W....', '.G....', 'OW....', '....WW', '......'],
    deck: ['OO', 'W', 'G'],
    tutorial: [
      // Chỉ dạy xoay; còn lại tự chơi (ô 6 gom cam, 27 gom trắng, 5 gom xám).
      { type: 'rotate', offsets: SHAPES.dominoV },
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
    moves: 12, target: 240, cats: 'OGW', assist: 0.45,
    board: ['......', '.X....', '..G.X.', 'X.G...', '...X.O', 'W.X..O'],
    deck: ['G'],
    tutorial: [{ type: 'drag', anchor: 8, free: true }],
  },
  {
    name: 'Crate Garden', feature: 'Crates + tabby cat', tier: 'normal',
    moves: 14, target: 320, cats: 'OGWT', assist: 0.4,
    board: ['#X..O.#', '.GG...X', '..X.W..', 'W...X..', '.X.T..T', 'T..X..O', '#..O..#'],
    deck: [],
  },
  {
    name: 'Tight Crates', feature: 'Crowded + crates', tier: 'hard',
    moves: 12, target: 360, cats: 'OGWT', assist: 0.35,
    board: ['OGX.TO', 'G..WX.', 'X.OG.W', '.TX.O.', 'W.GX.T', '.T..XO'],
    deck: [],
  },
  {
    name: 'Steel Nap', feature: 'Heart board + metal', tier: 'chill', introduces: 'metal',
    moves: 18, target: 240, cats: 'OGWT', assist: 0.5,
    board: ['#..##..#', '...MM...', '.M.OO.M.', '.M.WW.M.', '#..MM..#', '##....##', '###..###'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Metal blocks never break!' }],
  },
  {
    name: 'Iron & Oak', feature: 'Metal + crates', tier: 'hard',
    moves: 16, target: 360, cats: 'OGWTS', assist: 0.4,
    board: ['X..M..X', '.O.M.O.', '.XGG..S', 'MM.W.MM', '.O..T..', 'X..M.X.', '..SM.T.'],
    deck: [],
  },
  {
    // Paywall đầu tiên: mục tiêu đặt để người chơi trung bình gần như thua lần đầu (~10% thắng) và lần chơi lại qua được khi dùng
    // booster +lượt (2 cái ~80%, đủ từ quà tặng sẵn). DDA không nới màn này, chơi lại thì nút +lượt mời dùng (adaptive.mjs `paywall`).
    name: 'Garden Fortress', feature: 'Boss: cross board', tier: 'boss', paywall: true,
    moves: 20, target: 460, cats: 'OGWTSK', assist: 0.4,
    board: ['##..X.#W', '##.OG.##', 'X.MK.MSX', '.TW..M..', '..MS.T..', 'X.M.WMOX', '##.SK.##', '##.X..##'],
    deck: [],
  },
  // ===== Chương 2: phòng khách — mở ô Hold, bàn to dần và nhiều hình; xào lại cơ chế thùng -> kim loại -> cả hai =====
  {
    // Mở ô Hold: cất thẻ -> gom -> lấy thẻ ra -> gom. Từ màn này trở đi luôn có Hold.
    // Kiêm giới thiệu chuồng mèo: mèo trắng (ô 13) sát cụm cam ô 0-6-12, mèo mướp (ô 26) sát cụm xám ô 30-31-32,
    // nên hai lần gom theo kịch bản đều chạm chuồng; bong bóng giải thích hiện sau phần Hold.
    name: 'Fresh Start', feature: 'Hold a card + cat cages', tier: 'chill', introduces: 'hold',
    moves: 14, target: 210, cats: 'OGWTS', assist: 0.45,
    board: ['O....G', 'O.T...', '.w..S.', '..SW..', '..t...', 'GG...O'],
    deck: ['G', 'O'],
    tutorial: [
      // Cất thẻ rồi lấy lại, mỗi thao tác một lần; sau đó tự chơi (ô 12 gom cam, 32 gom xám — mỗi lần gom thả một chuồng).
      { type: 'hold' },
      { type: 'tapHold' },
      { type: 'info', text: 'Match next to a cage to free the cat!' },
    ],
  },
  {
    name: 'Crate Scatter', feature: 'Triangle board + crates', tier: 'normal',
    moves: 15, target: 300, cats: 'OGWTS', assist: 0.4,
    board: ['###..###', '##.X..##', '##O..G##', '#..TX..#', '#.S..W.#', 'G..X..T.', '.X..O..X'],
    deck: [],
  },
  {
    name: 'Steel Corners', feature: 'Diamond board + metal', tier: 'normal',
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.4,
    board: ['##...##', '#M.OOM#', '.G.M.G.', '..S.S..', '.M.TT.M', '#.W.MW#', '##...##'],
    deck: [],
  },
  {
    name: 'Crate & Steel', feature: 'Crates + metal', tier: 'normal',
    moves: 16, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['##X...##', '#.O.MK.#', '.XGGM.X.', '.M.W.X..', '.K.MW..T', '#X.MS.X#', '##..O.##'],
    deck: [],
  },
  {
    // Đỉnh HARD giữa chương 2 (cổng kim loại 2 lớp): ngay sau là màn nghỉ 16.
    name: 'Iron Gate', feature: 'Crates + metal', tier: 'hard',
    moves: 18, target: 370, cats: 'OGWTSK', assist: 0.3,
    board: ['...X.X..', '.O..MG..', 'XMM..MMX', 't..W.K..', '.S..X.T.', 'XMM..MMX', '..O..K..', '..X..X..'],
    deck: [],
  },
  {
    name: 'Tea Break', feature: 'Heart board, take a breather', tier: 'chill',
    moves: 20, target: 280, cats: 'OGWT', assist: 0.5,
    board: ['#..##..#', '.OO.M...', '.M....M.', '...MM...', '#M..GG.#', '##..M.##', '###..###'],
    deck: [],
  },
  {
    // Giới thiệu chuồng mèo: 4 chuồng đặt cạnh các cặp mèo sẵn để lần gom đầu tiên đã chạm chuồng.
    name: 'Open Field', feature: 'Open board + cages', tier: 'normal',
    moves: 23, target: 350, cats: 'OGWTSK', assist: 0.4,
    board: ['K..O...S', '...O.Tk.', '.WW.o.T.', 'G..##...', 'G..##.K.', '.tS...O.', '.T...S..', 'O..wK..W'],
    deck: [],
  },
  {
    name: 'Crate Maze', feature: 'Heart board + crates', tier: 'normal',
    moves: 19, target: 320, cats: 'OGWTSK', assist: 0.4,
    board: ['#X.##.X#', '..O.G.k.', '.X.S.X..', 'XW..K..X', '#..To.X#', '##X..O##', '###..###'],
    deck: [],
  },
  {
    name: 'Divided', feature: 'A metal wall splits the board', tier: 'normal',
    moves: 17, target: 300, cats: 'OGWTSK', assist: 0.4,
    board: ['...MM...', '.O..M.G.', '..MM..S.', '.K..MM..', '.G.M..O.', '..MM.T..', 'W..M....'],
    deck: [],
  },
  {
    name: 'Steel Fortress', feature: 'Boss: cross board', tier: 'boss',
    moves: 22, target: 460, cats: 'OGWTSK', assist: 0.4,
    board: ['##.w..##', '##MOGM##', '..X..X..', '.TKMMS..', '..SMMW.T', '..W..K..', '##MX.M##', '##.Ok.##'],
    deck: [],
  },

  // ===== Chương 3: phòng khách (mở sau màn 20) — xào lại mọi cơ chế, thêm chuồng mèo vào hầu hết các màn =====
  {
    // Giới thiệu bãi cỏ: phải dọn hết 16 ô cỏ VÀ đủ điểm. Cỏ nằm dưới các cặp mèo có sẵn (gom cặp là dọn),
    // dưới vài mèo lẻ và trên ô trống (phải đặt mèo vào rồi gom).
    name: 'Cozy Corner', feature: 'Grass: match on grass to clear it', tier: 'chill', introduces: 'grass',
    moves: 24, target: 360, cats: 'OGWTS', assist: 0.4,
    board: ['.....TT', '..G....', 'T....SS', 'T.XX...', '.GG....', 'OXOO...', 'X...T.X'],
    grass: ['....~~~', '..~~~..', '~....~~', '~......', '.~~~...', '~.~~...', '.......'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Match cats on the grass to clear it. Clear all the grass and reach the points to win!' }],
  },
  {
    name: "Sofa Rows", feature: "Rows of metal", tier: 'normal',
    moves: 15, target: 290, cats: 'OGWTSK', assist: 0.4,
    board: ['#MMO..#', '.......', '...MM..', 'SG.....', 'SGOOSO.', '...M...', '#WWOO.#'],
    deck: [],
  },
  {
    name: "Bookshelf", feature: "Metal shelves + crates", tier: 'normal',
    moves: 17, target: 380, cats: 'OGWTSK', assist: 0.4,
    board: ['S...S..O', 'S.MMM...', '...MMM.S', '...X.MMS', '.......X', 'X.KK....', 'KX..MW..', 'KTT..TT.'],
    deck: [],
  },
  {
    name: "Cat Nap Cages", feature: "Cages on a hexagon", tier: 'normal',
    moves: 22, target: 370, cats: 'OGWTSK', assist: 0.4,
    board: ['##..tT##', '#Kk.sS.#', '.......k', '.......O', '...K..GO', '#..G...#', '##.G..##'],
    deck: [],
  },
  {
    name: "Hallway Split", feature: "Metal wall + cages", tier: 'hard',
    moves: 20, target: 420, cats: 'OGWTSK', assist: 0.4,
    board: ['..M.MWW.', '.tTWW..M', '..OM....', '.GO##..w', 'TG.##...', 'T.G.MG..', '....M...', '....M...'],
    deck: [],
  },
  {
    name: 'Teacup', feature: 'Heart board, take a breather', tier: 'chill',
    moves: 20, target: 370, cats: 'OGWT', assist: 0.5,
    board: ['#..##..#', '.G..O...', '.G....M.', '...MO..G', '#.O.OM.#', '##OW..##', '###W.###'],
    deck: [],
  },
  {
    name: "Rug Pattern", feature: "Diamond board + crates", tier: 'normal',
    moves: 15, target: 380, cats: 'OGWTS', assist: 0.4,
    board: ['##.X.##', '#.X.T.#', 'TTW..G.', '....XGO', 'X..WWXO', '#...SX#', '##...##'],
    deck: [],
  },
  {
    name: "Lock & Box", feature: "Crates + cages", tier: 'normal',
    moves: 17, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['.W..XX..', 'oW......', 'O....X..', '......K.', '...TTsSX', '.K.X....', 'G...W..X', 'G..Kk...'],
    deck: [],
  },
  {
    name: "Window Bars", feature: "Metal + crates + cages", tier: 'normal',
    moves: 18, target: 400, cats: 'OGWTSK', assist: 0.3,
    board: ['.....MM.', '......XX', '..SS....', 'MM.OOXO.', 'S.T..MMW', '....SSX.', '.MM.X.TT', 'S.......'],
    deck: [],
  },
  {
    name: "Living Room Fortress", feature: "Boss: cross board", tier: 'boss',
    moves: 22, target: 560, cats: 'OGWTSK', assist: 0.4,
    board: ['##X.WX##', '##..WK##', 'OOWwMKGM', 'kKS..X..', '..S.....', 'X..gXM..', '##MT..##', '##M..M##'],
    deck: [],
  },
  // ===== Chương 4: phòng ngủ (mở sau màn 30) — mèo béo + thêm lớp; 32–40 sinh bằng tools/levels/generate-levels.mjs =====
  {
    // Giới thiệu mèo béo 2×2 (chữ số = số lần phải đánh thức, level-rules.mjs parseBoard): chỉ một con giữa bàn, không vật cản
    // khác. Thẻ đầu là mèo cam, thả vào ô 16 thì gom 3 con cam sát mèo béo -> thấy ngay lần đánh thức đầu tiên.
    name: 'Sleepy Giant', feature: 'NEW: wake up the big sleepy cat', tier: 'chill', introduces: 'fat',
    moves: 14, target: 300, cats: 'OGWT', assist: 0.45,
    board: ['..G....', '.......', 'OO.33..', '...33.W', '.G..T..', '...T..W', '.......'],
    deck: ['O'],
    tutorial: [
      { type: 'info', text: 'Shh! A big cat is napping. Match next to it 3 times to wake it up!' },
      { type: 'drag', anchor: 16 },
    ],
  },
  {
    name: 'Blanket Fold', feature: 'big cat', tier: 'normal',
    moves: 16, target: 250, cats: 'OGWTSK', assist: 0.4,
    board: ['#.G...#', 'T.G.K.S', 'T...KTG', '.......', '..O..KW', '..K33K.', '#..33.#'],
    deck: [],
  },
  {
    name: 'Night Lights', feature: 'big cat + grass', tier: 'normal',
    moves: 29, target: 435, cats: 'OGWTSK', assist: 0.4,
    board: ['##SSW.##', '#..33..#', '...33..T', '........', '...S.K..', '#..S.KG#', '##....##'],
    grass: ['........', '.~....~.', '~~~...~~', '......~.', '.....~~.', '........', '........'],
    deck: [],
  },
  {
    name: 'Dream Cages', feature: 'big cat + grass', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##....##', '##....##', '#33...O#', '#33.GWO#', '...K.W..', '...K....'],
    grass: ['........', '........', '........', '........', '....~~~.', '....~.~.', '~~~.....'],
    deck: [],
  },
  {
    name: 'Moonlit Maze', feature: 'big cat + metal + crates', tier: 'hard',
    moves: 20, target: 580, cats: 'OGWTSK', assist: 0.35,
    board: ['#TT...#', 'MX....X', 'MS.X.XT', 'OSX.33T', 'O...33M', '..X.TMM', '#S...M#'],
    deck: [],
  },
  {
    name: 'Nap Time', feature: 'big cat', tier: 'chill',
    moves: 15, target: 320, cats: 'OGWTS', assist: 0.45,
    board: ['#..##..#', '...22...', '.W.22...', '.W.T....', '#..T...#', '##.W..##', '###W.###'],
    deck: [],
  },
  {
    name: 'Toy Pile', feature: 'big cat + metal + crates', tier: 'normal',
    moves: 18, target: 280, cats: 'OGWTSK', assist: 0.4,
    board: ['##K.X##', '#M...G#', 'OM...G.', '..MXW..', 'X.M33G.', '#..33G#', '##.X.##'],
    deck: [],
  },
  {
    name: 'Wardrobe', feature: 'big cat + metal + grass', tier: 'normal',
    moves: 41, target: 615, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##O..M##', '##O..M##', '#O.....#', '#..MK..#', '.33MT.T.', '.33.S...'],
    grass: ['........', '..~~....', '........', '..~.....', '.~~.~~..', '.....~..', '........'],
    deck: [],
  },
  {
    name: 'Last Gate', feature: 'big cat + crates', tier: 'normal',
    moves: 19, target: 480, cats: 'OGWTSK', assist: 0.4,
    board: ['.X.X..', '...33S', '...33S', '.XX.W.', '.S..W.', '.S...W'],
    deck: [],
  },
  {
    name: 'Bedroom Fortress', feature: 'big cat + grass + crates + cages', tier: 'boss',
    moves: 37, target: 555, cats: 'OGWTSK', assist: 0.35,
    board: ['XXT.....', 'S.X.....', 'S.GXW..G', '..g.W..X', '.....X44', 'X44.w.44', '.44.W...', '....X.kX'],
    grass: ['...~~~~.', '...~~~~~', '....~~~~', '......~.', '...~....', '...~~...', '...~~...', '...~....'],
    deck: [],
  },
  // ===== Chương 5: bếp (màn 41–50) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Kitchen Door', feature: 'big cat', tier: 'normal',
    moves: 16, target: 380, cats: 'OGWTSK', assist: 0.4,
    board: ['#.S...#', 'W.S.33.', 'W..K33W', '.....KW', '.K.....', '....W..', '#...W.#'],
    deck: [],
  },
  {
    name: 'Cookie Tray', feature: 'big cat', tier: 'normal',
    moves: 16, target: 250, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##....##', '##.G..##', '#.OG...#', '#.....O#', 'G...33O.', 'G...33..'],
    deck: [],
  },
  {
    name: 'Fish Bowl', feature: 'grass + metal', tier: 'normal',
    moves: 33, target: 495, cats: 'OGWTSK', assist: 0.4,
    board: ['##..SS##', '#OW..W.#', 'SS..OW..', 'GT..M..O', '....M..O', '#....M.#', '##...M##'],
    grass: ['........', '........', '...~....', '~~~~....', '...~....', '...~....', '..~~~...'],
    deck: [],
  },
  {
    name: 'Pantry', feature: 'cages + crates', tier: 'normal',
    moves: 17, target: 340, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##X..S##', '##T...##', '#..T...#', '#..X.KG#', 'X..W.kG.', 'S..WsX..'],
    deck: [],
  },
  {
    name: 'Fridge Lock', feature: 'crates + grass + cages', tier: 'hard',
    moves: 19, target: 285, cats: 'OGWTSK', assist: 0.35,
    board: ['##.s.K##', '##.S.K##', 'XKk.....', 'SS.X..X.', 'X.G.O.XG', '..X.O...', '##...K##', '##...K##'],
    grass: ['........', '.....~..', '..~.~~~.', '.~~..~..', '..~~....', '...~~...', '...~....', '...~....'],
    deck: [],
  },
  {
    name: 'Milk Break', feature: 'crates', tier: 'chill',
    moves: 15, target: 290, cats: 'OGWTS', assist: 0.45,
    board: ['#..##T.#', 'X....T.G', '.......G', '......T.', '#.X...T#', '##.GW.##', '###GW###'],
    deck: [],
  },
  {
    name: 'Spice Rack', feature: 'grass + cages + crates', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4,
    board: ['....KX.', '..X.KX.', 'S.O.w..', 'S.o.W.K', '..WO...', '..WOSGX', '.X.....'],
    grass: ['.......', '.~.....', '~~.....', '~~.....', '~~~.~~.', '.~.....', '.......'],
    deck: [],
  },
  {
    name: 'Oven Grill', feature: 'grass + big cat', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4,
    board: ['##...##', '#.....#', '..33..G', 'W.33.TG', '.W...T.', '#.T...#', '##...##'],
    grass: ['...~~..', '.......', '.......', '.......', '....~..', '..~.~..', '..~~~..'],
    deck: [],
  },
  {
    name: 'Sink Divide', feature: 'crates + big cat', tier: 'normal',
    moves: 19, target: 460, cats: 'OGWTSK', assist: 0.4,
    board: ['X.GT.X', '...T.X', 'X..K33', '...K33', '.G....', '.G....'],
    deck: [],
  },
  {
    name: 'Kitchen Fortress', feature: 'cages + metal + grass + crates', tier: 'boss',
    moves: 30, target: 450, cats: 'OGWTSK', assist: 0.35,
    board: ['XKM.K..G', 'MKMXXsT.', 'M.OX.SW.', 'X.oK..MK', '..XO.WM.', '..S..WS.', '..S.....', '..XoX.X.'],
    grass: ['.......~', '.....~~~', '......~~', '........', '.~...~..', '.~..~~..', '~~~.~~~.', '~~...~..'],
    deck: [],
  },
  // ===== Chương 6: Attic (màn 51–60) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Dusty Trunk', feature: 'grass', tier: 'normal',
    moves: 31, target: 465, cats: 'OGWTSK', assist: 0.4,
    board: ['.O....', 'W.....', 'W.K...', '..K...', '..TW.S', 'G.TW.S'],
    grass: ['.....~', '.....~', '...~~~', '...~~.', '...~..', '......'],
    deck: [],
  },
  {
    name: 'Old Lamp', feature: 'grass', tier: 'normal',
    moves: 20, target: 300, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##..#', '..T.T...', 'W.T.T.SO', 'W.K...S.', '#..O...#', '##..KK##', '###..###'],
    grass: ['........', '........', '...~~...', '...~.~..', '....~~..', '....~~..', '....~...'],
    deck: [],
  },
  {
    name: 'Hat Box', feature: 'big cat + grass', tier: 'normal',
    moves: 24, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##.O..##', '##.G..##', '#..G33.#', '#...33.#', '.G.G..W.', '.G......'],
    grass: ['...~~...', '....~...', '........', '........', '..~.....', '.~~.....', '.....~~.'],
    deck: [],
  },
  {
    name: 'Rafters', feature: 'crates + metal', tier: 'normal',
    moves: 17, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['#.XXS.#', '.OGWS.K', '.X.S..K', '.XGSMM.', '....MM.', 'X.T.KG.', '#...K.#'],
    deck: [],
  },
  {
    name: 'Secret Map', feature: 'crates + cages + big cat', tier: 'hard',
    moves: 20, target: 570, cats: 'OGWTSK', assist: 0.35,
    board: ['##.33.##', '##.33.##', '..X...OX', 'X..t..OX', '...t....', '......X.', '##33T.##', '##33TX##'],
    deck: [],
  },
  {
    name: 'Sunny Window', feature: 'crates', tier: 'chill',
    moves: 15, target: 270, cats: 'OGWTS', assist: 0.45,
    board: ['.S...T', '.S...T', '..GG.X', 'X...O.', '..O...', '..O...'],
    deck: [],
  },
  {
    name: 'Toy Chest', feature: 'big cat + crates + metal', tier: 'normal',
    moves: 18, target: 430, cats: 'OGWTSK', assist: 0.4,
    board: ['G.X...', 'G...W.', 'XW..WX', 'M33...', 'M33TMX', '....MK'],
    deck: [],
  },
  {
    name: 'Rocking Horse', feature: 'big cat + metal + crates', tier: 'normal',
    moves: 18, target: 440, cats: 'OGWTSK', assist: 0.4,
    board: ['GM.X.X', 'GM....', '.GM.33', 'XGM.33', '....G.', '.O..GX'],
    deck: [],
  },
  {
    name: 'Cobweb Corner', feature: 'metal + crates + grass', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['#MW.TS#', 'GMW.TSK', '.T.....', 'XX..MOX', '..S.MO.', 'S...W..', '#X..WX#'],
    grass: ['.......', '.......', '.......', '...~...', '~~.~...', '~~~~~..', '...~...'],
    deck: [],
  },
  {
    name: 'Attic Fortress', feature: 'metal + crates + grass + cages + big cat', tier: 'boss',
    moves: 24, target: 360, cats: 'OGWTSK', assist: 0.35,
    board: ['##..X.##', '##.sXX##', '44.kG44M', '44.kG44M', '......M.', 'G.M..XM.', '##M.XX##', '##GX..##'],
    grass: ['..~~....', '..~~....', '..~~....', '..~~....', '..~~....', '...~~...', '...~....', '....~~..'],
    deck: [],
  },
  // ===== Chương 7: Balcony (màn 61–70) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Flower Pots', feature: 'metal', tier: 'normal',
    moves: 16, target: 300, cats: 'OGWTSK', assist: 0.4,
    board: ['###.G###', '##.MG.##', '##WMW.##', '#KW.W.G#', '#.T....#', '..T...M.', '....O.M.'],
    deck: [],
  },
  {
    name: 'Wind Chime', feature: 'grass', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['##.WK##', '#O.W..#', '.O.....', 'G......', '..K.SG.', '#.K.S.#', '##...##'],
    grass: ['.......', '.~~~.~.', '~~~..~.', '.......', '.......', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Clothesline', feature: 'crates + grass', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['#.O##WT#', '...T.W.X', '...T.XXW', '......SW', '#...S.S#', '##..S.##', '###X.###'],
    grass: ['........', '........', '.~~~....', '..~..~..', '..~~.~~.', '........', '........'],
    deck: [],
  },
  {
    name: 'Rain Drops', feature: 'grass + big cat', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['#.K##..#', '..KOS33.', '....S33.', '.....K..', '#...K..#', '##.SK.##', '###..###'],
    grass: ['..~.....', '.~~.....', '~~~.....', '~~~.....', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Tall Railing', feature: 'grass + metal + cages + crates', tier: 'hard',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.35,
    board: ['#M.##KW#', '.M..K.WG', '.MS..sMX', '.M.X.OM.', '#TO..X.#', '##X.X.##', '###sS###'],
    grass: ['........', '..~~~~..', '..~~~...', '..~.~...', '..~~~...', '........', '........'],
    deck: [],
  },
  {
    name: 'Sun Lounger', feature: 'big cat', tier: 'chill',
    moves: 15, target: 310, cats: 'OGWTS', assist: 0.45,
    board: ['#W.##..#', '........', '....22..', '...T22..', '#W..O..#', '##W.O.##', '###..###'],
    deck: [],
  },
  {
    name: 'Bird Feeder', feature: 'cages + metal + grass', tier: 'normal',
    moves: 35, target: 525, cats: 'OGWTSK', assist: 0.4,
    board: ['.Tk...', '.TKM..', '.O.M.S', '.O..KS', '..W.MW', '..w.M.'],
    grass: ['......', '.~....', '.~....', '.~...~', '..~..~', '..~..~'],
    deck: [],
  },
  {
    name: 'Ivy Wall', feature: 'big cat + cages + metal', tier: 'normal',
    moves: 18, target: 420, cats: 'OGWTSK', assist: 0.4,
    board: ['##.Kk##', '#T.T33#', 'MT..33.', 'Mw.....', '.W.....', '#..M..#', '##.M.##'],
    deck: [],
  },
  {
    name: 'Night Breeze', feature: 'metal + grass + big cat', tier: 'normal',
    moves: 16, target: 240, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##....##', '##....##', '#GG.G..#', '#S.M33K#', 'M.SM33K.', 'M.......'],
    grass: ['........', '...~....', '...~~...', '........', '........', '.~~.....', '.~..~~..'],
    deck: [],
  },
  {
    name: 'Balcony Fortress', feature: 'cages + grass + crates + metal + big cat', tier: 'boss',
    moves: 34, target: 510, cats: 'OGWTSK', assist: 0.35,
    board: ['K44.....', 'X44..X..', 'MkK...X.', 'MX.##44.', '.O.##44X', 'gOX...OM', 'sSXM..OM', '.KXM....'],
    grass: ['......~~', '......~~', '.......~', '........', '~~~.....', '~~...~..', '~...~~~.', '~...~~~.'],
    deck: [],
  },
  // ===== Chương 8: Bathroom (màn 71–80) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Bubble Bath', feature: 'cages', tier: 'normal',
    moves: 16, target: 290, cats: 'OGWTSK', assist: 0.4,
    board: ['#wO##W.#', 'KWS..W..', '..S.g.G.', '....G.G.', '#......#', '##....##', '###..###'],
    deck: [],
  },
  {
    name: 'Rubber Duck', feature: 'metal', tier: 'normal',
    moves: 16, target: 280, cats: 'OGWTSK', assist: 0.4,
    board: ['###GO###', '##..O.##', '##....##', '#G.M.O.#', '#GWM...#', 'MOWK....', 'MO......'],
    deck: [],
  },
  {
    name: 'Towel Rack', feature: 'metal + crates', tier: 'normal',
    moves: 17, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['GSKX.SG', 'G.K..S.', 'T.....T', 'T.XW.X.', 'M.M...O', 'M.MOW..', '...XW.X'],
    deck: [],
  },
  {
    name: 'Soap Slide', feature: 'grass + crates', tier: 'normal',
    moves: 28, target: 420, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##O.#', '....S..X', 'G.SKS.G.', 'G...O...', '#.XXGX.#', '##..G.##', '###.W###'],
    grass: ['.~~.....', '.~~~....', '..~..~..', '....~~..', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Steamy Mirror', feature: 'grass + crates + metal + cages', tier: 'hard',
    moves: 20, target: 300, cats: 'OGWTSK', assist: 0.35,
    board: ['##.XX.##', '##MwM.##', 'X.MWM.Wk', '..G.T..T', 'M...T.XT', 'M..GXWW.', '##WGX.##', '##....##'],
    grass: ['........', '........', '.....~~~', '.....~~.', '....~~..', '.....~~.', '...~....', '..~~~~..'],
    deck: [],
  },
  {
    name: 'Fluffy Mat', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.45,
    board: ['##...##', '#..W..#', 'O..W.G.', 'O.....O', '.......', '#TT.G.#', '##..G##'],
    deck: [],
  },
  {
    name: 'Tile Puzzle', feature: 'big cat + cages + grass', tier: 'normal',
    moves: 25, target: 375, cats: 'OGWTSK', assist: 0.4,
    board: ['##G...##', '#K.....#', '.K......', '..O.o.K.', '....oTK.', '#..33..#', '##.33.##'],
    grass: ['..~.....', '..~...~.', '......~~', '.~~~..~.', '..~.....', '........', '........'],
    deck: [],
  },
  {
    name: 'Drip Drop', feature: 'metal + grass + cages', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['.KOO...', '..SMo.S', '...M..S', '....O..', 'W..TOM.', 'w..T.M.', '....GG.'],
    grass: ['~~~..~~', '.~...~~', '.....~~', '.....~.', '.......', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Shower Curtain', feature: 'cages + big cat + crates', tier: 'normal',
    moves: 19, target: 460, cats: 'OGWTSK', assist: 0.4,
    board: ['#.S##.O#', '.TS.33..', '..g.33..', '...K...X', '#..kXX.#', '##..XT##', '###..###'],
    deck: [],
  },
  {
    name: 'Bathroom Fortress', feature: 'cages + metal + big cat + crates + grass', tier: 'boss',
    moves: 36, target: 540, cats: 'OGWTSK', assist: 0.35,
    board: ['...G..W.', '...44.WX', 'X..44...', 'XMWK.X.X', 'XM.44.MK', '.X.44.Mk', '...gX.kM', '...GX.GM'],
    grass: ['..~.....', '.~~.....', '.~~.....', '..~~....', '.....~..', '~....~..', '~~~..~~.', '~~~..~~.'],
    deck: [],
  },
  // ===== Chương 9: Rooftop (màn 81–90) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Chimney Pots', feature: 'cages', tier: 'normal',
    moves: 16, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['#.K..S#', '..K..S.', '..O..OK', 'O...tOk', '....T..', '..K....', '#.K...#'],
    deck: [],
  },
  {
    name: 'Weather Vane', feature: 'grass', tier: 'normal',
    moves: 27, target: 405, cats: 'OGWTSK', assist: 0.4,
    board: ['##.O.##', '#.....#', '...T.TS', '.....TO', 'T..TG.O', '#...G.#', '##...##'],
    grass: ['..~~...', '.......', '.~~~...', '.......', '.......', '....~..', '...~~..'],
    deck: [],
  },
  {
    name: 'Roof Tiles', feature: 'metal + cages', tier: 'normal',
    moves: 17, target: 300, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##..#', '...W....', 'G.Sw....', '.oTK.S..', '#.GMMS.#', '##GMMW##', '###..###'],
    deck: [],
  },
  {
    name: 'Pigeon Post', feature: 'big cat + crates', tier: 'normal',
    moves: 17, target: 420, cats: 'OGWTSK', assist: 0.4,
    board: ['..SO..', '.WSO..', '...X..', '.33..X', '.33GX.', '.S.X.K'],
    deck: [],
  },
  {
    name: 'Gutter Run', feature: 'metal + big cat + crates + grass', tier: 'hard',
    moves: 20, target: 300, cats: 'OGWTSK', assist: 0.35,
    board: ['#.M##.M#', '.XM.X.M.', '..33M..S', 'XX33M.WG', '#TT.W.W#', '##..WX##', '###..###'],
    grass: ['.~......', '........', '........', '........', '.~~~~~..', '..~~~...', '...~~...'],
    deck: [],
  },
  {
    name: 'Sunset Nap', feature: 'grass', tier: 'chill',
    moves: 28, target: 420, cats: 'OGWTS', assist: 0.45,
    board: ['#O....#', 'GO.G...', 'G..G...', '.....W.', '..G.OW.', '..S.O..', '#.....#'],
    grass: ['.......', '.......', '..~....', '......~', '.....~~', '....~~~', '.......'],
    deck: [],
  },
  {
    name: 'Antenna Maze', feature: 'big cat + metal + grass', tier: 'normal',
    moves: 27, target: 405, cats: 'OGWTSK', assist: 0.4,
    board: ['#..TS.#', 'O...SG.', 'O...MGT', '....M..', '.....GM', '.33..GM', '#33...#'],
    grass: ['.......', '.....~~', '...~.~~', '...~.~.', '....~~.', '.....~.', '.......'],
    deck: [],
  },
  {
    name: 'Skylight', feature: 'big cat + cages + grass', tier: 'normal',
    moves: 24, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['###.O###', '##..O.##', '##....##', '#...33.#', '#...33.#', 't..K.O.O', '...k....'],
    grass: ['........', '........', '........', '..~~....', '........', '....~~..', '.~~~.~..'],
    deck: [],
  },
  {
    name: 'Starry Gable', feature: 'big cat + crates + grass', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4,
    board: ['#.KGG.#', '..K.O..', '33..XKG', '33...XG', '..O.K..', '.....X.', '#..X.X#'],
    grass: ['....~~.', '.......', '..~....', '..~~~..', '..~.~~~', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Rooftop Fortress', feature: 'big cat + metal + grass + crates + cages', tier: 'boss',
    moves: 29, target: 435, cats: 'OGWTSK', assist: 0.35,
    board: ['##Wk.w##', '##.MXW##', '...M..M.', '.44k44M.', '.44K44XX', 'XXM.X.K.', '##MX..##', '##....##'],
    grass: ['..~.....', '..~.....', '~~~....~', '...~...~', '...~....', '...~.~~~', '....~~..', '........'],
    deck: [],
  },
  // ===== Chương 10: Moon Garden (màn 91–100) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Moon Path', feature: 'big cat', tier: 'normal',
    moves: 16, target: 340, cats: 'OGWTSK', assist: 0.4,
    board: ['.O..K.', '.O..K.', '......', 'T33...', '.33K..', '...K..'],
    deck: [],
  },
  {
    name: 'Glow Worms', feature: 'metal', tier: 'normal',
    moves: 16, target: 290, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##MS.M##', '##MSTM##', '#.O.T.G#', '#.O..W.#', '..W...G.', '......G.'],
    deck: [],
  },
  {
    name: 'Night Blooms', feature: 'metal + grass', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##..#', 'S..MTT.O', 'S.TM.WOK', '....T.OK', '#...M..#', '##..M.##', '###..###'],
    grass: ['.~......', '~~~....~', '.~~....~', '.......~', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Lantern Row', feature: 'cages + big cat', tier: 'normal',
    moves: 17, target: 390, cats: 'OGWTSK', assist: 0.4,
    board: ['##WWt.##', '#.33T..#', '..33W...', '........', '........', '#..Gw..#', '##..WO##'],
    deck: [],
  },
  {
    name: 'Owl Watch', feature: 'big cat + metal + grass + cages', tier: 'hard',
    moves: 16, target: 240, cats: 'OGWTSK', assist: 0.35,
    board: ['##..MM##', '#...33.#', '....33MM', '.k..O.MM', '.kT.O33.', '#....33#', '##....##'],
    grass: ['........', '......~.', '........', '...~~~..', '.~~~~...', '.~~~~...', '...~....'],
    deck: [],
  },
  {
    name: 'Dream Meadow', feature: 'big cat', tier: 'chill',
    moves: 15, target: 340, cats: 'OGWTS', assist: 0.45,
    board: ['#...T.#', '..O...T', '..O....', '....W..', '....W..', '.S.22..', '#S.22.#'],
    deck: [],
  },
  {
    name: 'Firefly Field', feature: 'crates + big cat + grass', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4,
    board: ['##..XO##', '#....O.#', '...G....', '.T.XX...', '.TSO..S.', '#..O33X#', '##..33##'],
    grass: ['........', '.~~.....', '..~.....', '.~~.....', '..~~~~~.', '........', '........'],
    deck: [],
  },
  {
    name: 'Midnight Maze', feature: 'metal + cages + big cat', tier: 'normal',
    moves: 18, target: 390, cats: 'OGWTSK', assist: 0.4,
    board: ['###.M###', '##..M.##', '##....##', '#oS....#', '#33k...#', 'T33KM...', 'T...MW..'],
    deck: [],
  },
  {
    name: 'Comet Trail', feature: 'big cat + crates + metal', tier: 'normal',
    moves: 19, target: 500, cats: 'OGWTSK', assist: 0.4,
    board: ['#OO.KM#', 'X33.KMM', 'T33.X.M', '.X..OG.', '....SGO', '.X.....', '#.X...#'],
    deck: [],
  },
  {
    name: 'Moon Fortress', feature: 'big cat + cages + crates + metal + grass', tier: 'boss',
    moves: 29, target: 435, cats: 'OGWTSK', assist: 0.35,
    board: ['X.G.....', '.MGMTw.K', '.MXMtW.k', 'KKX##44.', '44X##44M', '44.X...M', 'X..S...X', '.......X'],
    grass: ['.~~~~~..', '..~.~~~~', '....~~~~', '........', '........', '.....~..', '....~~~.', '.....~..'],
    deck: [],
  },
];

