// Dữ liệu 150 màn của Gom Gom Rotate (thuần dữ liệu; hàm đọc màn + bộ chia thẻ ở core/level-rules.mjs). Không đụng giao diện
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
//   Màn 21–30 dựng bằng script một lần. Màn 32–150 sinh bằng tools/levels/generate-levels.mjs: mỗi cơ chế (thùng, kim loại, chuồng,
//   cỏ, mèo béo) là một lớp độ khó, số lớp tăng theo tier + chương (layerCount); chương 4 lấy mèo béo làm lớp chính
//   Chương 11–15 (101–150: thư viện, phòng nhạc, nhà kính, hiên mùa đông, lâu đài mèo) không thêm cơ chế: lấy lại thư / bình / cỏ / mèo béo / siro làm lớp chính
//
// `tier` = cấp độ khó hiện ở bảng vào màn và bản đồ: chill · normal · hard · boss.
// `introduces` = cơ chế mới của màn ('crate' | 'metal' | 'hold' | 'cage' | 'grass' | 'fat' | 'mail' | 'vase' | 'syrup'), bảng vào màn gắn nhãn NEW.
// `mail` = số thư phải gom từ hộp thư '@' (core/board-rules.mjs), từ màn 60.
// `syrup` = lớp siro dâu phủ lên mèo (các hàng cùng cỡ bàn, '~' = mèo ở ô đó bị phủ; core/level-rules.mjs parseBoard), từ màn 80.
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
    // Giới thiệu hộp thư '@' (thay 2 mèo béo cũ): không vỡ, mỗi cụm gom sát bên bay 1 thư vào Goal; đủ `mail` thư mới thắng.
    name: 'Attic Fortress', feature: 'NEW: mailbox + metal + crates + grass + cages', tier: 'boss', introduces: 'mail',
    moves: 24, target: 360, cats: 'OGWTSK', assist: 0.35, mail: 8,
    board: ['##..X.##', '##.sXX##', '...kG..M', '.@.kG.@M', '......M.', 'G.M@.XM.', '##M.XX##', '##GX..##'],
    grass: ['..~~....', '..~~....', '..~~....', '..~~....', '..~~....', '...~~...', '...~....', '....~~..'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Mailboxes never break! Match cats next to one and a letter flies out. Collect all the letters!' }],
  },
  // ===== Chương 7: Balcony (màn 61–70) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Flower Pots', feature: 'mailboxes', tier: 'normal',
    moves: 15, target: 225, cats: 'OGWTSK', assist: 0.4, mail: 5,
    board: ['#G...W#', '.G@..WK', '..W.G.G', '..W..O.', '..T..O@', '..T....', '#.O.@.#'],
    deck: [],
  },
  {
    name: 'Wind Chime', feature: 'mailboxes', tier: 'normal',
    moves: 14, target: 210, cats: 'OGWTSK', assist: 0.4, mail: 6,
    board: ['###G@###', '##KG..##', '##GO@.##', '#.G....#', '#....@.#', '..W...S.', '..WS..S.'],
    deck: [],
  },
  {
    name: 'Clothesline', feature: 'mailboxes + crates', tier: 'normal',
    moves: 16, target: 240, cats: 'OGWTSK', assist: 0.4, mail: 5,
    board: ['##.TTO##', '#.O.SOG#', '..X.W.WS', 'X@.T.S.S', '...T...@', '#...X.@#', '##..X.##'],
    deck: [],
  },
  {
    name: 'Rain Drops', feature: 'mailboxes + grass', tier: 'normal',
    moves: 42, target: 630, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['#.K##.T#', '..KO.G@.', '..SS.W..', '.W.K.W.@', '#..K..S#', '##....##', '###@.###'],
    grass: ['........', '.......~', '......~~', '~~......', '.~~.....', '..~~....', '........'],
    deck: [],
  },
  {
    name: 'Tall Railing', feature: 'mailboxes + grass + metal + cages', tier: 'hard',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.35, mail: 4,
    board: ['.K.W.MM', '.G.W.KM', '.G@K.sM', '...K.M.', '..O..MT', '..O..WS', '.@.@..S'],
    grass: ['.......', '....~~.', '...~~~.', '....~..', '.~.....', '~~~....', '.......'],
    deck: [],
  },
  {
    name: 'Sun Lounger', feature: 'mailboxes', tier: 'chill',
    moves: 12, target: 180, cats: 'OGWTS', assist: 0.45, mail: 5,
    board: ['#G....#', 'TG....T', 'T...ST@', '.....T.', '....@OT', 'O.S..O.', '#.....#'],
    deck: [],
  },
  {
    name: 'Bird Feeder', feature: 'mailboxes + cages + metal', tier: 'normal',
    moves: 24, target: 360, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['#M....#', 'KMGk.o.', 'KM.K.@S', '.M.SW..', 'O...W..', '.K.SKK@', '#...@.#'],
    deck: [],
  },
  {
    name: 'Ivy Wall', feature: 'mailboxes + big cat + cages', tier: 'normal',
    moves: 14, target: 210, cats: 'OGWTSK', assist: 0.4, mail: 3,
    board: ['##.Kk##', '#.T.@T#', '.@...T.', 'W..22..', 'W..22..', '#.....#', '##.@.##'],
    deck: [],
  },
  {
    name: 'Night Breeze', feature: 'mailboxes + big cat + grass', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4, mail: 3,
    board: ['##...S##', '#..@.S@#', 'O22.....', 'O22....@', '.....O..', '#.WG.O.#', '##W...##'],
    grass: ['........', '........', '.....~~~', '~.......', '......~~', '......~.', '........'],
    deck: [],
  },
  {
    // Giới thiệu bình hoa '%' (thay 2 mèo béo cũ): gom sát bên lần đầu nứt, lần hai vỡ, mảnh bay vào Goal; vỡ hết bình mới thắng.
    name: 'Balcony Fortress', feature: 'NEW: vases + cages + grass + crates + metal', tier: 'boss', introduces: 'vase',
    moves: 38, target: 510, cats: 'OGWTSK', assist: 0.35,
    board: ['K%......', 'X.%..X..', 'MkK...X.', 'MX.##%..', '.O.##.%X', 'gOX...OM', 'sSXM..OM', '.KXM....'],
    grass: ['......~~', '......~~', '.......~', '........', '~~~.....', '~~...~..', '~...~~~.', '~...~~~.'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Careful, vases! Match next to one to crack it, match again to break it. Break them all!' }],
  },
  // ===== Chương 8: Bathroom (màn 71–80) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Bubble Bath', feature: 'vases', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4,
    board: ['....K.', 'S%T.K.', '..T...', '%.K.%.', '.W.W.G', '.W%W.G'],
    deck: [],
  },
  {
    name: 'Rubber Duck', feature: 'vases', tier: 'normal',
    moves: 13, target: 195, cats: 'OGWTSK', assist: 0.4,
    board: ['.......', 'S...WG.', '.%S.TG.', 'G.S.T.%', 'G%.....', 'O..%O..', '..SS..G'],
    deck: [],
  },
  {
    name: 'Towel Rack', feature: 'vases + cages', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4,
    board: ['###%.###', '##G.G.##', '##G.GO##', '#....o%#', '#.....O#', '.T....oK', '...%.T.K'],
    deck: [],
  },
  {
    name: 'Soap Slide', feature: 'vases + grass', tier: 'normal',
    moves: 27, target: 405, cats: 'OGWTSK', assist: 0.4,
    board: ['.S...T', 'OST%.T', '.O.S..', '.O....', '.S%..G', 'K...%.'],
    grass: ['~~~...', '.~~...', '......', '......', '......', '.~~~..'],
    deck: [],
  },
  {
    name: 'Steamy Mirror', feature: 'vases + cages + crates + grass', tier: 'hard',
    moves: 18, target: 270, cats: 'OGWTSK', assist: 0.35,
    board: ['GTT.X%.', 'G.%...G', '.O....O', 'WXSt.%O', 'X.X..S.', 'X..K.XS', '...GG..'],
    grass: ['~~.....', '.......', '...~..~', '...~~.~', '...~.~~', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Fluffy Mat', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.45,
    board: ['##...##', '#..W..#', 'O..W.G.', 'O.....O', '.......', '#TT.G.#', '##..G##'],
    deck: [],
  },
  {
    name: 'Tile Puzzle', feature: 'vases + mailboxes + grass', tier: 'normal',
    moves: 44, target: 660, cats: 'OGWTSK', assist: 0.4, mail: 3,
    board: ['###.T###', '##..T.##', '##..SO##', '#@%.SO.#', '#.W..S.#', '.WS@....', '....%O@.'],
    grass: ['........', '........', '..~~....', '........', '........', '.......~', '..~~...~'],
    deck: [],
  },
  {
    name: 'Drip Drop', feature: 'vases + cages + big cat', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4,
    board: ['#GGTSS#', '...%G..', '.22.G..', '.22...G', '.G.....', '.gS.%..', '#.....#'],
    deck: [],
  },
  {
    name: 'Shower Curtain', feature: 'vases + cages + mailboxes', tier: 'normal',
    moves: 11, target: 165, cats: 'OGWTSK', assist: 0.4, mail: 5,
    board: ['..T..T', '.@...T', 'T....W', 'T.K.kW', '%.%...', 'GG@..@'],
    deck: [],
  },
  {
    // Giới thiệu siro dâu (thay 2 mèo béo cũ): lớp `syrup` phủ lên mèo ('~'), mèo bị phủ không gom được; gom sát bên thì siro vỡ bay vào
    // Goal, mèo ở lại thành mèo thường. Rửa hết siro mới thắng. Siro thành một vòng 3×3 bao quanh mèo Xiêm ở giữa.
    name: 'Bathroom Fortress', feature: 'NEW: strawberry syrup + cages + metal + crates + grass', tier: 'boss', introduces: 'syrup',
    moves: 38, target: 540, cats: 'OGWTSK', assist: 0.35,
    board: ['...G..W.', '...TGO.X', 'X..KSW..', 'XMWOTG.X', 'XM.O..MK', '.X..T.Mk', '...gX.kM', '...GX.GM'],
    syrup: ['........', '...~~~..', '...~.~..', '...~~~..', '........', '........', '........', '........'],
    grass: ['..~.....', '.~~.....', '.~~.....', '..~~....', '.....~..', '~....~..', '~~~..~~.', '~~~..~~.'],
    deck: [],
    tutorial: [{ type: 'info', text: "Sticky strawberry syrup! Cats under it can't be matched. Match next to them to wash it off!" }],
  },
  // ===== Chương 9: Rooftop (màn 81–90) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Chimney Pots', feature: 'syrup', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4,
    board: ['#.....#', '..G....', 'GGO..S.', 'OOG..S.', 'KST....', '.S...W.', '#...G.#'],
    syrup: ['.......', '.......', '~~.....', '~~~....', '~.~....', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Weather Vane', feature: 'syrup', tier: 'normal',
    moves: 33, target: 495, cats: 'OGWTSK', assist: 0.4,
    board: ['###.K###', '##G...##', '##....##', '#...TO.#', '#..WTG.#', '....TOG.', '....G...'],
    syrup: ['....~...', '........', '........', '....~~..', '...~~~..', '....~...', '........'],
    deck: [],
  },
  {
    name: 'Roof Tiles', feature: 'syrup + big cat', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['##...##', '#.....#', '.33....', 'W33....', '....S..', '#TKW.T#', '##T..##'],
    syrup: ['.......', '.......', '.......', '.......', '.......', '.~~~.~.', '..~....'],
    deck: [],
  },
  {
    name: 'Pigeon Post', feature: 'syrup + metal', tier: 'normal',
    moves: 35, target: 525, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##.O..##', '##.O..##', '#G.MTWW#', '#..MGOG#', 'M...TS..', 'M.......'],
    syrup: ['........', '........', '........', '.~..~...', '....~~~.', '....~~..', '........'],
    deck: [],
  },
  {
    name: 'Gutter Run', feature: 'syrup + cages + mailboxes + crates', tier: 'hard',
    moves: 14, target: 210, cats: 'OGWTSK', assist: 0.35, mail: 4,
    board: ['##..X.##', '##...@##', 'SO@..X..', 'SK...XX.', '@k.X..GT', '....O.GX', '##TTO.##', '##WS..##'],
    syrup: ['........', '........', '........', '........', '.......~', '........', '..~~....', '..~~....'],
    deck: [],
  },
  {
    name: 'Sunset Nap', feature: 'syrup', tier: 'chill',
    moves: 36, target: 540, cats: 'OGWTS', assist: 0.45,
    board: ['#..##..#', '...OW.O.', '..S.....', '.S.S....', '#S.....#', '##.OO.##', '###SG###'],
    syrup: ['........', '........', '........', '........', '........', '...~~...', '...~~...'],
    deck: [],
  },
  {
    name: 'Antenna Maze', feature: 'syrup + metal + cages', tier: 'normal',
    moves: 18, target: 270, cats: 'OGWTSK', assist: 0.4,
    board: ['##.W.O##', '#..OKOt#', '..OW.GTM', '.....G.M', '........', '#.MK...#', '##M.gT##'],
    syrup: ['...~....', '...~~...', '...~....', '........', '........', '...~....', '........'],
    deck: [],
  },
  {
    name: 'Skylight', feature: 'syrup + cages + grass', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4,
    board: ['##KW.##', '#...WO#', '.O...KO', '.O....W', '.....oK', '#.....#', '##...##'],
    syrup: ['.......', '.......', '.....~~', '......~', '......~', '.......', '.......'],
    grass: ['.......', '.~~....', '...~...', '...~...', '.......', '...~~..', '.......'],
    deck: [],
  },
  {
    name: 'Starry Gable', feature: 'syrup + vases + crates', tier: 'normal',
    moves: 19, target: 285, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##..#', '....X.S.', '.XX%ST..', '.X.O.K..', '#..TGK%#', '##.TOO##', '###G%###'],
    syrup: ['........', '........', '........', '.....~..', '....~~..', '....~~..', '........'],
    deck: [],
  },
  {
    name: 'Rooftop Fortress', feature: 'syrup + mailboxes + cages + metal + crates', tier: 'boss',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.35, mail: 5,
    board: ['OTWK@...', 'XWKK....', 'TXGMM.Ws', 't..MM..X', '...WXK.X', 'XX.WXMW.', '..G.XMW.', '.@G.K..@'],
    syrup: ['~~~.....', '.~~.....', '........', '........', '........', '........', '........', '....~...'],
    deck: [],
  },
  // ===== Chương 10: Moon Garden (màn 91–100) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Moon Path', feature: 'syrup', tier: 'normal',
    moves: 29, target: 435, cats: 'OGWTSK', assist: 0.4,
    board: ['.T....', '.T...O', 'W.....', '..W...', '..GS..', '.TGKW.'],
    syrup: ['......', '......', '......', '..~...', '..~~..', '.~~~~.'],
    deck: [],
  },
  {
    name: 'Glow Worms', feature: 'cages', tier: 'normal',
    moves: 16, target: 280, cats: 'OGWTSK', assist: 0.4,
    board: ['###.G###', '##..GO##', '##W.tO##', '#.W.t..#', '#....TW#', '......w.', '........'],
    deck: [],
  },
  {
    name: 'Night Blooms', feature: 'metal + mailboxes', tier: 'normal',
    moves: 11, target: 165, cats: 'OGWTSK', assist: 0.4, mail: 10,
    board: ['#T.##SS#', '.T.MTTO.', '.@KM..W.', '..K@T@..', '#..TM..#', '##.TM.##', '###..###'],
    deck: [],
  },
  {
    name: 'Lantern Row', feature: 'big cat + syrup', tier: 'normal',
    moves: 25, target: 375, cats: 'OGWTSK', assist: 0.4,
    board: ['##KG..##', '#.33...#', '..33....', '.....OS.', '...O.OS.', '#....O.#', '##..TK##'],
    syrup: ['..~~....', '........', '........', '........', '........', '.....~..', '....~~..'],
    deck: [],
  },
  {
    name: 'Owl Watch', feature: 'vases + metal + syrup + mailboxes', tier: 'hard',
    moves: 34, target: 510, cats: 'OGWTSK', assist: 0.35, mail: 4,
    board: ['##W.%M##', '#@W..M.#', 'MGS.....', 'MGW%.K@%', '.M@O.TTK', '#MO..K.#', '##....##'],
    syrup: ['........', '........', '........', '.....~..', '...~.~~.', '.....~..', '........'],
    deck: [],
  },
  {
    name: 'Dream Meadow', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.45,
    board: ['......', '....G.', 'G.S.GT', 'G....T', '....S.', 'G.....'],
    deck: [],
  },
  {
    name: 'Firefly Field', feature: 'crates + vases + mailboxes', tier: 'normal',
    moves: 42, target: 630, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['##G.XX##', '#.GOOWO#', 'K.@.%.O.', 'K...@.@W', '...TS%.%', '#T.....#', '##X..X##'],
    deck: [],
  },
  {
    name: 'Midnight Maze', feature: 'cages + big cat + syrup', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4,
    board: ['###..###', '##.G..##', '##....##', '#......#', '#22G...#', '.22gT...', '...TG..K'],
    syrup: ['........', '...~....', '........', '........', '........', '....~...', '...~~...'],
    deck: [],
  },
  {
    name: 'Comet Trail', feature: 'syrup + crates + metal', tier: 'normal',
    moves: 25, target: 375, cats: 'OGWTSK', assist: 0.4,
    board: ['#.M...#', 'XOM..X.', 'TOOX..O', 'GGM...O', 'SWM..GT', 'XW...S.', '#.X..S#'],
    syrup: ['.......', '.~.....', '~~~....', '~~.....', '~......', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Moon Fortress', feature: 'syrup + big cat + crates + metal + vases', tier: 'boss',
    moves: 31, target: 465, cats: 'OGWTSK', assist: 0.35,
    board: ['X....W%M', '..M...MM', 'KGM33.MS', 'GKS33X..', 'XTX..33.', '.%.%.33.', '%..X..XX', '.W.XXGW.'],
    syrup: ['........', '........', '~~......', '~~~.....', '.~......', '........', '........', '........'],
    deck: [],
  },
  // ===== Chương 11: Library (màn 101–110) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Reading Nook', feature: 'mailboxes', tier: 'normal',
    moves: 15, target: 225, cats: 'OGWTSK', assist: 0.4, mail: 5,
    board: ['##....##', '#.@..@S#', '..WG.KST', '..WG....', '..T....T', '#..T..@#', '##.T.G##'],
    deck: [],
  },
  {
    name: 'Ink Pots', feature: 'mailboxes', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4, mail: 5,
    board: ['....K@', 'S.@.K.', 'SG..W.', '..TOK.', '.S..K.', '..@...'],
    deck: [],
  },
  {
    name: 'Paper Stacks', feature: 'mailboxes + syrup', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['.@.S..', '...S@.', '.@S...', '.OWS..', 'K.GGS.', 'K.....'],
    syrup: ['......', '......', '..~...', '.~~~..', '..~...', '......'],
    deck: [],
  },
  {
    name: 'Love Letters', feature: 'mailboxes + syrup', tier: 'normal',
    moves: 19, target: 285, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['#.@##.@#', '........', '.K.K....', '.TOT@...', '#SGS..K#', '##GT.G##', '###..###'],
    syrup: ['........', '........', '.~......', '.~~.....', '.~......', '...~....', '........'],
    deck: [],
  },
  {
    name: 'Locked Archive', feature: 'mailboxes + crates + big cat + syrup', tier: 'hard',
    moves: 15, target: 225, cats: 'OGWTSK', assist: 0.35, mail: 4,
    board: ['##X...##', '#OGO22.#', 'GKKX22..', 'G..X.@..', 'XO@...X.', '#.....X#', '##T@..##'],
    syrup: ['........', '.~~~....', '.~~.....', '........', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Story Hour', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 250, cats: 'OGWTS', assist: 0.45,
    board: ['.T.WG.', '.T.W..', '..O...', '.GO.T.', '.G....', '......'],
    deck: [],
  },
  {
    name: 'Bookmark Trail', feature: 'mailboxes + grass + metal', tier: 'normal',
    moves: 32, target: 480, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['#MT##..#', 'GMTK..SM', '.K@.@..M', '@KG...KO', '#..K...#', '##.K..##', '###..###'],
    grass: ['........', '......~.', '.....~~.', '......~~', '......~.', '...~~...', '...~....'],
    deck: [],
  },
  {
    name: 'Dusty Atlas', feature: 'mailboxes + cages + grass', tier: 'normal',
    moves: 25, target: 375, cats: 'OGWTSK', assist: 0.4, mail: 3,
    board: ['#.K##GO#', '.SK.@G..', '.T@.W.@S', '....W..S', '#......#', '##...t##', '###..###'],
    grass: ['........', '~.......', '~...~...', '....~...', '........', '..~~....', '........'],
    deck: [],
  },
  {
    name: 'Quiet Aisle', feature: 'mailboxes + syrup + crates', tier: 'normal',
    moves: 26, target: 390, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['##O..##', '#TOT.@#', '@WX....', '.X@..XG', '.W.G..S', '#W..G.#', '##X..##'],
    syrup: ['..~....', '.~~~...', '.~.....', '.......', '.......', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Library Fortress', feature: 'mailboxes + syrup + big cat + crates + metal', tier: 'boss',
    moves: 26, target: 390, cats: 'OGWTSK', assist: 0.35, mail: 5,
    board: ['X@..M..G', '.G.XMXMG', 'M..@..M.', 'M...X...', 'WW.XOX..', 'TX33K...', 'TG33.@33', 'SX.X..33'],
    syrup: ['........', '........', '........', '........', '....~...', '~...~...', '~~......', '~.......'],
    deck: [],
  },
  // ===== Chương 12: Music Room (màn 111–120) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Piano Keys', feature: 'vases', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['##KK..##', '#.%..W.#', 'OO...W.S', '%....%.S', 'W.......', '#.O..WG#', '##O.%W##'],
    deck: [],
  },
  {
    name: 'Drum Roll', feature: 'vases', tier: 'normal',
    moves: 42, target: 630, cats: 'OGWTSK', assist: 0.4,
    board: ['....G%', '.ST...', '.STK.%', 'K..K%.', '....TS', '%...T.'],
    deck: [],
  },
  {
    name: 'Violin Case', feature: 'vases + mailboxes', tier: 'normal',
    moves: 36, target: 540, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['#%O##.T#', '.T..T.T@', '...%...%', '..WK.S..', '#@WG.S@#', '##.G..##', '###..###'],
    deck: [],
  },
  {
    name: 'Vase Waltz', feature: 'vases + mailboxes', tier: 'normal',
    moves: 17, target: 255, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['###T.###', '##.T..##', '##@O..##', '#.W.S.@#', '#..GS%.#', 'O..%.S..', '.%O@.S..'],
    deck: [],
  },
  {
    name: 'Grand Finale', feature: 'vases + grass + crates + cages', tier: 'hard',
    moves: 18, target: 270, cats: 'OGWTSK', assist: 0.35,
    board: ['#%.##WX#', 'X..O.W..', '.WGO.K..', '%.X.Xg.K', '#..%OX.#', '##T.O.##', '###..###'],
    grass: ['........', '..~~~~..', '.~~~~...', '........', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Lullaby', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 330, cats: 'OGWTS', assist: 0.45,
    board: ['#.W...#', 'S.W....', 'O..G...', '..W..G.', '.OW..G.', '...W...', '#.GG..#'],
    deck: [],
  },
  {
    name: 'Metronome', feature: 'vases + big cat + crates', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['..X33.', 'X.%33X', '%...WK', '.K..W.', '..%...', '.XWWS.'],
    deck: [],
  },
  {
    name: 'Music Box', feature: 'vases + grass + cages', tier: 'normal',
    moves: 34, target: 510, cats: 'OGWTSK', assist: 0.4,
    board: ['#..S..#', '%.K....', '..%...w', '.WG.S.T', '.WG...S', '.G..WO.', '#....O#'],
    grass: ['...~~~.', '.....~.', '.......', '.~~....', '..~....', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Encore', feature: 'vases + cages + crates', tier: 'normal',
    moves: 18, target: 270, cats: 'OGWTSK', assist: 0.4,
    board: ['##.o.##', '#O.OG.#', '.O..XX.', 'X...%..', 'K%.K...', '#T%KX.#', '##.wW##'],
    deck: [],
  },
  {
    name: 'Music Fortress', feature: 'vases + cages + metal + grass + crates', tier: 'boss',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.35,
    board: ['.K.%.G.X', 'X..GKgXG', 'O%..K.%X', 'O..XS%.S', 'XXM.O..K', 'M.M.o.OS', 'M....MOT', '.X.X.M.T'],
    grass: ['........', '...~~...', '..~~~...', '....~...', '...~~~..', '...~....', '.~~~....', '..~.....'],
    deck: [],
  },
  // ===== Chương 13: Greenhouse (màn 121–130) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Seed Trays', feature: 'grass', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['OK..SK', 'OK..SW', '......', '...OKO', '....K.', '......'],
    grass: ['~~.~~.', '~...~.', '~.~...', '..~~..', '..~...', '......'],
    deck: [],
  },
  {
    name: 'Watering Can', feature: 'grass', tier: 'normal',
    moves: 31, target: 465, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##..#', 'W.O.T.W.', 'W.K.T.S.', '........', '#..O..W#', '##KO..##', '###..###'],
    grass: ['......~.', '...~~~~~', '....~.~.', '..~.....', '.~~.....', '..~.....', '........'],
    deck: [],
  },
  {
    name: 'Fern Corner', feature: 'grass + crates', tier: 'normal',
    moves: 27, target: 405, cats: 'OGWTSK', assist: 0.4,
    board: ['##..G.##', '#T.....#', 'OT.S..TT', 'OX.XG...', 'T.X.....', '#.S...X#', '##S..G##'],
    grass: ['....~...', '...~~~..', '...~~~~.', '.....~..', '....~~~.', '.....~..', '........'],
    deck: [],
  },
  {
    name: 'Sprout Rows', feature: 'grass + crates', tier: 'normal',
    moves: 24, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['.XK.T..', '..T.T..', 'O.KO.G.', 'X.K....', '.....XX', 'KG.T.XG', 'K....WW'],
    grass: ['..~~~~.', '..~~...', '.~~~...', '..~....', '..~....', '.~~~...', '..~....'],
    deck: [],
  },
  {
    name: 'Jungle Glass', feature: 'grass + crates + vases + big cat', tier: 'hard',
    moves: 16, target: 240, cats: 'OGWTSK', assist: 0.35,
    board: ['#.%.GG#', 'XTXX.K.', '....OK.', 'GX22...', 'GX22..S', '.XO.%.%', '#.O...#'],
    grass: ['.~.....', '.~.....', '.~....~', '......~', '......~', '..~~...', '..~....'],
    deck: [],
  },
  {
    name: 'Sunbeam Nap', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.45,
    board: ['#T...O#', '.TO.WO.', '..O....', '.W.....', '.W.....', '.G..W..', '#G....#'],
    deck: [],
  },
  {
    name: 'Cactus Shelf', feature: 'grass + crates + mailboxes', tier: 'normal',
    moves: 20, target: 300, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['##..KT##', '#...KXT#', '.@.O.XT@', '...O....', '.@..T..K', '#X..TXW#', '##..SS##'],
    grass: ['........', '......~.', '...~..~.', '..~~~.~~', '..~~....', '........', '........'],
    deck: [],
  },
  {
    name: 'Mossy Path', feature: 'grass + crates + cages', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['...X.SX', '..GX.S.', '....X..', '..Ko.O.', 'SX.O.O.', 'T.T..T.', '..Ts.T.'],
    grass: ['.......', '.~.....', '~~~....', '~~..~~~', '~....~.', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Vine Tunnel', feature: 'grass + metal + syrup', tier: 'normal',
    moves: 23, target: 345, cats: 'OGWTSK', assist: 0.4,
    board: ['##G..G##', '#....G.#', '....OOG.', '.....TWW', 'G.M..MOG', '#.MT.M.#', '##....##'],
    syrup: ['........', '........', '......~.', '.....~~~', '......~.', '........', '........'],
    grass: ['...~....', '..~~~...', '..~~.~~~', '......~.', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Greenhouse Fortress', feature: 'grass + syrup + mailboxes + metal + crates', tier: 'boss',
    moves: 20, target: 300, cats: 'OGWTSK', assist: 0.35, mail: 5,
    board: ['.K@XM.KG', '.KTTM.WG', 'WS@...WX', 'WGM##.X.', 'K.M##XKX', 'S.@....X', 'S.XM....', '..XM.W..'],
    syrup: ['........', '........', '~~......', '~~......', '~.....~.', '........', '........', '........'],
    grass: ['.....~..', '.~~~.~~.', '...~~~~.', '........', '........', '........', '.....~..', '....~~..'],
    deck: [],
  },
  // ===== Chương 14: Winter Porch (màn 131–140) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'First Snow', feature: 'big cat', tier: 'normal',
    moves: 16, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['##..S.##', '#...S.K#', '...44T..', 'S..44...', 'S...G..G', '#...G..#', '##....##'],
    deck: [],
  },
  {
    name: 'Cozy Scarf', feature: 'big cat', tier: 'normal',
    moves: 16, target: 380, cats: 'OGWTSK', assist: 0.4,
    board: ['#..TG.#', '..44G.G', '.G44...', '...W...', '..KW...', '.......', '#TG...#'],
    deck: [],
  },
  {
    name: 'Mitten Pile', feature: 'big cat + grass', tier: 'normal',
    moves: 27, target: 405, cats: 'OGWTSK', assist: 0.4,
    board: ['##..33##', '#...33.#', '.K....O.', '.K....S.', '.O....S.', '#O.W...#', '##.W..##'],
    grass: ['........', '..~~....', '.......~', '~~~...~~', '.~.....~', '........', '........'],
    deck: [],
  },
  {
    name: 'Hot Cocoa', feature: 'big cat + cages', tier: 'normal',
    moves: 17, target: 260, cats: 'OGWTSK', assist: 0.4,
    board: ['......', '.k....', '.KW.K.', '33w...', '33..O.', '....O.'],
    deck: [],
  },
  {
    name: 'Frozen Gate', feature: 'big cat + syrup + metal + cages', tier: 'hard',
    moves: 14, target: 210, cats: 'OGWTSK', assist: 0.35,
    board: ['##STW.##', '#.....M#', '.....KM.', 'M.O..K..', 'MMO.22..', '#M.G22.#', '##.g..##'],
    syrup: ['..~~~...', '........', '.....~..', '.....~..', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Fireside Nap', feature: 'big cat', tier: 'chill',
    moves: 15, target: 340, cats: 'OGWTS', assist: 0.45,
    board: ['#.O...#', 'S.OT...', 'S33T...', '.33....', '.......', 'T......', '#G....#'],
    deck: [],
  },
  {
    name: 'Snow Boots', feature: 'big cat + crates + vases', tier: 'normal',
    moves: 39, target: 585, cats: 'OGWTSK', assist: 0.4,
    board: ['..O33..', '...33X.', '.%.X.O.', '%...GOT', '..XX.GT', '...W..W', '.%.GX.W'],
    deck: [],
  },
  {
    name: 'Icicle Row', feature: 'big cat + cages + vases', tier: 'normal',
    moves: 14, target: 210, cats: 'OGWTSK', assist: 0.4,
    board: ['##S.G.##', '#tS...T#', '.%...ST.', 'ST.22...', '..%22...', '#......#', '##...W##'],
    deck: [],
  },
  {
    name: 'Long Night', feature: 'big cat + grass + metal', tier: 'normal',
    moves: 20, target: 300, cats: 'OGWTSK', assist: 0.4,
    board: ['.....S.', '...S.S.', 'TO...K.', 'T....K.', '.33.WS.', 'K33...M', 'MM....M'],
    grass: ['.~.....', '.~~....', '.~...~.', '.....~.', '....~~.', '...~~~.', '.......'],
    deck: [],
  },
  {
    name: 'Winter Fortress', feature: 'big cat + crates + grass + cages + metal', tier: 'boss',
    moves: 28, target: 420, cats: 'OGWTSK', assist: 0.35,
    board: ['KKMTX...', '33MW..OX', '33o.....', '..O##kMX', '.X.##KMX', '.XK.....', 'MX...33.', 'M..X.33.'],
    grass: ['.....~~~', '......~.', '......~.', '~~~..~..', '~....~..', '~....~..', '........', '........'],
    deck: [],
  },
  // ===== Chương 15: Cat Castle (màn 141–150) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====
  {
    name: 'Castle Gate', feature: 'syrup', tier: 'normal',
    moves: 33, target: 495, cats: 'OGWTSK', assist: 0.4,
    board: ['#...SO#', 'S..STT.', '....G..', 'K.S....', '..G..SO', '..GO...', '#.....#'],
    syrup: ['....~~.', '...~~~.', '....~..', '~......', '.......', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Royal Cushion', feature: 'syrup', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##KT#', 'W....K..', '........', '....G...', '#G.GG..#', '##TWG.##', '###GT###'],
    syrup: ['........', '........', '........', '........', '.~.~....', '..~~~...', '...~~...'],
    deck: [],
  },
  {
    name: 'Jam Tarts', feature: 'syrup + vases', tier: 'normal',
    moves: 36, target: 540, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##.W#', '%...TT.O', 'TWT.%WKO', '.W...T..', '#......#', '##.%..##', '###..###'],
    syrup: ['........', '.....~..', '..~..~~.', '.....~..', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Tower Stairs', feature: 'syrup + crates', tier: 'normal',
    moves: 40, target: 600, cats: 'OGWTSK', assist: 0.4,
    board: ['###OK###', '##TOTK##', '##XTX.##', '#..X...#', '#.....X#', '.....W..', '...OSW..'],
    syrup: ['...~~...', '..~~~~..', '...~....', '........', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Throne Room', feature: 'syrup + vases + cages + crates', tier: 'hard',
    moves: 30, target: 450, cats: 'OGWTSK', assist: 0.35,
    board: ['##TSK.##', '#..OO.S#', '%...T.sX', '.X.XTG..', 'XW...G..', '#WX.X.%#', '##..%.##'],
    syrup: ['..~~~...', '...~~...', '........', '........', '........', '........', '........'],
    deck: [],
  },
  {
    name: 'Royal Nap', feature: 'take a breather', tier: 'chill',
    moves: 15, target: 240, cats: 'OGWTS', assist: 0.45,
    board: ['..W..W', '.....S', '.....S', 'GT....', '.T....', 'WS....'],
    deck: [],
  },
  {
    name: 'Banquet Hall', feature: 'syrup + crates + big cat', tier: 'normal',
    moves: 21, target: 315, cats: 'OGWTSK', assist: 0.4,
    board: ['......', '......', 'XX33G.', 'ST33G.', 'WW...X', '.GX...'],
    syrup: ['......', '......', '......', '~~....', '~~....', '.~....'],
    deck: [],
  },
  {
    name: 'Secret Passage', feature: 'syrup + crates + vases', tier: 'normal',
    moves: 22, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['#..##GS#', '..X..GT.', 'X..X.K%O', '...G.K.O', '#..G.S%#', '##%X..##', '###.G###'],
    syrup: ['.....~~.', '.....~~.', '........', '........', '.....~..', '........', '........'],
    deck: [],
  },
  {
    name: 'Crown Vault', feature: 'syrup + metal + mailboxes', tier: 'normal',
    moves: 31, target: 465, cats: 'OGWTSK', assist: 0.4, mail: 4,
    board: ['#GSS..#', '.OWM..W', '..WM...', '@...T..', 'K.....T', 'K..SMG@', '#.@.MG#'],
    syrup: ['.~~....', '.~~....', '..~....', '.......', '.......', '.......', '.......'],
    deck: [],
  },
  {
    name: 'Cat Castle Fortress', feature: 'syrup + metal + crates + cages + mailboxes', tier: 'boss',
    moves: 45, target: 675, cats: 'OGWTSK', assist: 0.35, mail: 5,
    board: ['M...K.X.', 'M.@.KM.K', 'KMS.TMXk', 'KMs##OX.', 'XXX##.@X', 'SGW.....', 'SK@....G', 'O.X...W.'],
    syrup: ['........', '........', '........', '........', '........', '~~~.....', '~~......', '~.......'],
    deck: [],
  },
];

