// 50 màn của Gom Gom Rotate: dữ liệu màn + bộ chia thẻ. Thuần dữ liệu/logic, không đụng giao diện
// (bộ mô phỏng tools/simulate-levels.mjs dùng chung file này để cân độ khó).
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
//   Màn 21 giới thiệu cỏ (`grass`): mục tiêu màn là dọn hết cỏ thay cho điểm.
//   Chương 3 (21–30) phòng khách, chương 4 (31–40) phòng ngủ, chương 5 (41–50) bếp; mỗi chương mở sau boss chương trước.
//   Màn 21–50 dựng bằng script một lần: đặt mèo theo cặp không tạo cụm gom sẵn, mục tiêu điểm cân bằng bot
//
// `tier` = cấp độ khó hiện ở bảng vào màn và bản đồ: chill · normal · hard · boss.
// `introduces` = cơ chế mới của màn ('crate' | 'metal' | 'hold' | 'cage'), bảng vào màn gắn nhãn NEW.
// `expand` = khuôn hình (board-shapes.mjs) khi độ khó thích ứng cần bàn to hơn cho màn 6×6 vuông.
//
// Bàn: các chuỗi cùng độ dài, 6×6 tới 8×8, hình dạng tuỳ màn (chương 1 chủ yếu 6×6, chương 2 to dần và
// nhiều hình: tim, tam giác, kim cương...). '.' ô trống, '#' ngoài bàn, 'X' thùng gỗ (chặn ô, vỡ khi gom
// mèo sát bên), 'M' khối kim loại (chặn ô, không bao giờ vỡ). Ký tự mèo:
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
    // Tutorial bằng hình, chỉ MỘT lần kéo (không chữ); các lượt sau người chơi tự chơi (ô 27 gom 3 mèo xám).
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
    moves: 12, target: 260, cats: 'OGW', assist: 0.4, shapes: { single: 4, domino: 5, triple: 2 },
    board: ['O....W', '..GG..', '......', '.W..O.', '..OW..', 'G....G'],
    deck: [],
  },
  {
    name: 'Crates', feature: 'Crates block cells', tier: 'normal', introduces: 'crate',
    moves: 12, target: 180, cats: 'OGW', assist: 0.45,
    board: ['......', '.X....', '..G.X.', 'X.G...', '...X.O', 'W.X..O'],
    deck: ['G'],
    tutorial: [{ type: 'drag', anchor: 8, free: true }],
  },
  {
    name: 'Crate Garden', feature: 'Crates + tabby cat', tier: 'normal',
    moves: 14, target: 260, cats: 'OGWT', assist: 0.4,
    board: ['#X..O.#', '.GG...X', '..X.W..', 'W...X..', '.X.T..T', 'T..X..O', '#..O..#'],
    deck: [],
  },
  {
    name: 'Tight Crates', feature: 'Crowded + crates', tier: 'hard',
    moves: 12, target: 250, cats: 'OGWT', assist: 0.35,
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
    moves: 16, target: 300, cats: 'OGWTS', assist: 0.4,
    board: ['X..M..X', '.O.M.O.', '.XGG..S', 'MM.W.MM', '.O..T..', 'X..M.X.', '..SM.T.'],
    deck: [],
  },
  {
    name: 'Garden Fortress', feature: 'Boss: cross board', tier: 'boss',
    moves: 20, target: 370, cats: 'OGWTSK', assist: 0.4,
    board: ['##..X.##', '##.OG.##', 'X.MK.MSX', '.TW..M..', '..MS.T..', 'X.M.WMOX', '##.SK.##', '##.X..##'],
    deck: [],
  },
  // ===== Chương 2: phòng khách — mở ô Hold, bàn to dần và nhiều hình; xào lại cơ chế thùng -> kim loại -> cả hai =====
  {
    // Mở ô Hold: cất thẻ -> gom -> lấy thẻ ra -> gom. Từ màn này trở đi luôn có Hold.
    // Kiêm giới thiệu chuồng mèo: mèo trắng (ô 13) sát cụm cam ô 0-6-12, mèo mướp (ô 26) sát cụm xám ô 30-31-32,
    // nên hai lần gom theo kịch bản đều chạm chuồng; bong bóng giải thích hiện sau phần Hold.
    name: 'Fresh Start', feature: 'Hold a card + cat cages', tier: 'normal', introduces: 'hold',
    moves: 14, target: 250, cats: 'OGWTS', assist: 0.45,
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
    moves: 15, target: 280, cats: 'OGWTS', assist: 0.4,
    board: ['###..###', '##.X..##', '##O..G##', '#..TX..#', '#.S..W.#', 'G..X..T.', '.X..O..X'],
    deck: [],
  },
  {
    name: 'Steel Corners', feature: 'Diamond board + metal', tier: 'normal',
    moves: 15, target: 270, cats: 'OGWTS', assist: 0.4,
    board: ['##...##', '#M.OOM#', '.G.M.G.', '..S.S..', '.M.TT.M', '#.W.MW#', '##...##'],
    deck: [],
  },
  {
    name: 'Crate & Steel', feature: 'Crates + metal', tier: 'normal',
    moves: 16, target: 320, cats: 'OGWTSK', assist: 0.4,
    board: ['##X...##', '#.O.MK.#', '.XGGM.X.', '.M.W.X..', '.K.MW..T', '#X.MS.X#', '##..O.##'],
    deck: [],
  },
  {
    // Đỉnh HARD giữa chương 2 (cổng kim loại 2 lớp): ngay sau là màn nghỉ 16.
    name: 'Iron Gate', feature: 'Crates + metal', tier: 'hard',
    moves: 18, target: 350, cats: 'OGWTSK', assist: 0.3,
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
    moves: 22, target: 210, cats: 'OGWTSK', assist: 0.4,
    board: ['K..O...S', '...O.Tk.', '.WW.o.T.', 'G..##...', 'G..##.K.', '.tS...O.', '.T...S..', 'O..wK..W'],
    deck: [],
  },
  {
    name: 'Crate Maze', feature: 'Heart board + crates', tier: 'normal',
    moves: 19, target: 310, cats: 'OGWTSK', assist: 0.4,
    board: ['#X.##.X#', '..O.G.k.', '.X.S.X..', 'XW..K..X', '#..To.X#', '##X..O##', '###..###'],
    deck: [],
  },
  {
    name: 'Divided', feature: 'A metal wall splits the board', tier: 'normal',
    moves: 15, target: 240, cats: 'OGWTSK', assist: 0.4,
    board: ['...MM...', '.O..M.G.', '..MM..S.', '.K..MM..', '.G.M..O.', '..MM.T..', 'W..M....'],
    deck: [],
  },
  {
    name: 'Steel Fortress', feature: 'Boss: cross board', tier: 'boss',
    moves: 22, target: 430, cats: 'OGWTSK', assist: 0.4,
    board: ['##.w..##', '##MOGM##', '..X..X..', '.TKMMS..', '..SMMW.T', '..W..K..', '##MX.M##', '##.Ok.##'],
    deck: [],
  },

  // ===== Chương 3: phòng khách (mở sau màn 20) — xào lại mọi cơ chế, thêm chuồng mèo vào hầu hết các màn =====
  {
    // Giới thiệu bãi cỏ: mục tiêu là dọn hết 16 ô cỏ (không tính điểm). Cỏ nằm dưới các cặp mèo có sẵn (gom cặp là dọn),
    // dưới vài mèo lẻ và trên ô trống (phải đặt mèo vào rồi gom). Bot: giỏi 95% · trung bình 90% · yếu 84% (24 lượt).
    name: "Cozy Corner", feature: "Grass: match on grass to clear it", tier: 'normal', introduces: 'grass',
    moves: 24, target: 330, cats: 'OGWTS', assist: 0.4,
    board: ['.....TT', '..G....', 'T....SS', 'T.XX...', '.GG....', 'OXOO...', 'X...T.X'],
    grass: ['....~~~', '..~~~..', '~....~~', '~......', '.~~~...', '~.~~...', '.......'],
    deck: [],
    tutorial: [{ type: 'info', text: 'Match cats on the grass to clear it. Clear all the grass to win!' }],
  },
  {
    name: "Sofa Rows", feature: "Rows of metal", tier: 'normal',
    moves: 15, target: 280, cats: 'OGWTSK', assist: 0.4,
    board: ['#MMO..#', '.......', '...MM..', 'SG.....', 'SGOOSO.', '...M...', '#WWOO.#'],
    deck: [],
  },
  {
    name: "Bookshelf", feature: "Metal shelves + crates", tier: 'normal',
    moves: 17, target: 370, cats: 'OGWTSK', assist: 0.4,
    board: ['S...S..O', 'S.MMM...', '...MMM.S', '...X.MMS', '.......X', 'X.KK....', 'KX..MW..', 'KTT..TT.'],
    deck: [],
  },
  {
    name: "Cat Nap Cages", feature: "Cages on a hexagon", tier: 'normal',
    moves: 22, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['##..tT##', '#Kk.sS.#', '.......k', '.......O', '...K..GO', '#..G...#', '##.G..##'],
    deck: [],
  },
  {
    name: "Hallway Split", feature: "Metal wall + cages", tier: 'hard',
    moves: 20, target: 400, cats: 'OGWTSK', assist: 0.4,
    board: ['..M.MWW.', '.tTWW..M', '..OM....', '.GO##..w', 'TG.##...', 'T.G.MG..', '....M...', '....M...'],
    deck: [],
  },
  {
    name: "Teacup", feature: "Heart board, take a breather", tier: 'chill',
    moves: 20, target: 360, cats: 'OGWT', assist: 0.5,
    board: ['#..##..#', '.G..O...', '.G....M.', '...MO..G', '#.O.OM.#', '##OW..##', '###W.###'],
    deck: [],
  },
  {
    name: "Rug Pattern", feature: "Diamond board + crates", tier: 'normal',
    moves: 15, target: 360, cats: 'OGWTS', assist: 0.4,
    board: ['##.X.##', '#.X.T.#', 'TTW..G.', '....XGO', 'X..WWXO', '#...SX#', '##...##'],
    deck: [],
  },
  {
    name: "Lock & Box", feature: "Crates + cages", tier: 'normal',
    moves: 17, target: 380, cats: 'OGWTSK', assist: 0.4,
    board: ['.W..XX..', 'oW......', 'O....X..', '......K.', '...TTsSX', '.K.X....', 'G...W..X', 'G..Kk...'],
    deck: [],
  },
  {
    name: "Window Bars", feature: "Metal + crates + cages", tier: 'normal',
    moves: 18, target: 380, cats: 'OGWTSK', assist: 0.3,
    board: ['.....MM.', '......XX', '..SS....', 'MM.OOXO.', 'S.T..MMW', '....SSX.', '.MM.X.TT', 'S.......'],
    deck: [],
  },
  {
    name: "Living Room Fortress", feature: "Boss: cross board", tier: 'boss',
    moves: 22, target: 540, cats: 'OGWTSK', assist: 0.4,
    board: ['##X.WX##', '##..WK##', 'OOWwMKGM', 'kKS..X..', '..S.....', 'X..gXM..', '##MT..##', '##M..M##'],
    deck: [],
  },
  // ===== Chương 4: phòng ngủ (mở sau màn 30) — bàn đông vật cản hơn, mục tiêu cao hơn =====
  {
    name: "Pillow Fort", feature: "Crates everywhere", tier: 'normal',
    moves: 15, target: 350, cats: 'OGWTSK', assist: 0.4,
    board: ['.S.....', '.SOX..X', 'SX.KWX.', '...KX..', '....X..', 'S....OO', 'SGG....'],
    deck: [],
  },
  {
    name: "Blanket Fold", feature: "Triangle board + cages", tier: 'normal',
    moves: 16, target: 310, cats: 'OGWTSK', assist: 0.4,
    board: ['###.M###', '##..kO##', '##W.SS##', '#.W....#', '#..T...#', '.MS.WWs.', '..SMM.S.'],
    deck: [],
  },
  {
    name: "Night Lights", feature: "Hexagon + crates + metal", tier: 'normal',
    moves: 16, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['##.T.X##', '#..TS.M#', '..MOS.O.', 'K..S.WW.', 'K.GG.X.X', '#......#', '##M.X.##'],
    deck: [],
  },
  {
    name: "Dream Cages", feature: "Many cages", tier: 'normal',
    moves: 16, target: 330, cats: 'OGWTSK', assist: 0.4,
    board: ['#....W#', '.Skk...', 'O.SSTG.', '.owWT..', '.o.....', '.......', '#.....#'],
    deck: [],
  },
  {
    name: "Moonlit Maze", feature: "Ring board, all obstacles", tier: 'hard',
    moves: 18, target: 400, cats: 'OGWTSK', assist: 0.4,
    board: ['.tTM..GS', '.k...SG.', '.M.M.SXM', '..K##..X', '.XK##...', '..GM.OO.', '.....S..', '..XM....'],
    deck: [],
  },
  {
    name: "Nap Time", feature: "Diamond board, take a breather", tier: 'chill',
    moves: 20, target: 370, cats: 'OGWT', assist: 0.5,
    board: ['##.W.##', '#..W..#', '...MW.T', '...M..T', '..OO...', '#..G.T#', '##.G.##'],
    deck: [],
  },
  {
    name: "Toy Pile", feature: "Heart board + many crates", tier: 'normal',
    moves: 17, target: 420, cats: 'OGWTSK', assist: 0.4,
    board: ['#.X##GG#', '.TTX.TX.', '..X..T.X', '.SS.K...', '#XTXsS.#', '##TX..##', '###X.###'],
    deck: [],
  },
  {
    name: "Wardrobe", feature: "Tall metal + cages", tier: 'normal',
    moves: 19, target: 360, cats: 'OGWTSK', assist: 0.4,
    board: ['KKMM.SS.', '..X...W.', 'W.....WT', '........', 'OoXWw..X', '....MMM.', '..MMMTW.', '....MMW.'],
    deck: [],
  },
  {
    name: "Last Gate", feature: "Metal + crates + cages", tier: 'normal',
    moves: 19, target: 380, cats: 'OGWTSK', assist: 0.3,
    board: ['..S.XT..', '.X...T.X', 'G..MMM..', 'G.wW..G.', '.MM.tT..', '....X...', '.MMMMM..', 'TSSXXT..'],
    deck: [],
  },
  {
    name: "Bedroom Fortress", feature: "Boss: cross board", tier: 'boss',
    moves: 24, target: 600, cats: 'OGWTSK', assist: 0.4,
    board: ['##.MM.##', '##WMO.##', '..WT.TM.', 'M..t.TXs', 'O.MGMMOS', 'XXX...o.', '##X.KX##', '##TTk.##'],
    deck: [],
  },
  // ===== Chương 5: bếp (mở sau màn 40) — xào lại cả bốn vật cản theo cặp =====
  {
    name: "Kitchen Door", feature: "Crates by the door", tier: 'normal',
    moves: 15, target: 370, cats: 'OGWTSK', assist: 0.4,
    board: ['T.....S', 'TXT..X.', 'WW.X...', 'XO.TT.X', 'SO.X...', '.X..GX.', '.....KK'],
    deck: [],
  },
  {
    name: "Cookie Tray", feature: "Hexagon + cages", tier: 'normal',
    moves: 16, target: 270, cats: 'OGWTSK', assist: 0.4,
    board: ['##.KO.##', '#.T..o.#', '..T.SSWK', '.O....W.', '.o......', '#....T.#', '##...T##'],
    deck: [],
  },
  {
    name: "Fish Bowl", feature: "Diamond board + metal + cages", tier: 'normal',
    moves: 16, target: 270, cats: 'OGWTSK', assist: 0.4,
    board: ['##Tw.##', '#.T.WW#', '..GM.G.', 'o.MMM..', 'O.KMS..', '#.K...#', '##...##'],
    deck: [],
  },
  {
    name: "Pantry", feature: "Crates everywhere", tier: 'normal',
    moves: 17, target: 500, cats: 'OGWTSK', assist: 0.4,
    board: ['XT.GG..X', '.TX..X..', '.X.G..X.', '.TTXX...', 'OO...S..', 'TX.XX.X.', 'WWX..X..', 'X....KKX'],
    deck: [],
  },
  {
    name: "Fridge Lock", feature: "Metal + crates + cages", tier: 'hard',
    moves: 19, target: 440, cats: 'OGWTSK', assist: 0.3,
    board: ['XT.MMw.X', '.T.....G', 'GMM..MMS', '.OOXX.KK', '.MMOOMM.', '...S..tT', 'X..MM..X', '......KK'],
    deck: [],
  },
  {
    name: "Milk Break", feature: "Heart board, take a breather", tier: 'chill',
    moves: 20, target: 360, cats: 'OGWT', assist: 0.4,
    board: ['#W.##..#', '.WG...O.', '....TT.O', '...MM...', '#WW....#', '##....##', '###TT###'],
    deck: [],
  },
  {
    name: "Spice Rack", feature: "Metal shelves + crates", tier: 'normal',
    moves: 17, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['T..WW...', 'TMMM.MMM', '..WW..SS', 'XG.X..X.', 'TT.....S', 'MMM.MMM.', 'T...G...', '..X..XKK'],
    deck: [],
  },
  {
    name: "Oven Grill", feature: "Metal grill + crates + cages", tier: 'normal',
    moves: 18, target: 380, cats: 'OGWTSK', assist: 0.4,
    board: ['..M..M..', 'X.OO.GGX', '..MT.M..', '...TO.Ss', '..M.OM..', 'X..W..TX', '.WMw.MGK', '........'],
    deck: [],
  },
  {
    name: "Sink Divide", feature: "Metal wall + cages", tier: 'normal',
    moves: 18, target: 410, cats: 'OGWTSK', assist: 0.4,
    board: ['T.WM....', 'T..M....', 'GG.M..XO', 'Oo..Kk.O', '....M..s', '.X..MTT.', '....M...', '....M.KK'],
    deck: [],
  },
  {
    name: "Kitchen Fortress", feature: "Boss: cross board", tier: 'boss',
    moves: 24, target: 590, cats: 'OGWTSK', assist: 0.4,
    board: ['##SS..##', '##.XXK##', 'SSMGGMOW', 'X..MMk.X', 'Xo.MM..X', '.OM..MSS', '##.XXG##', '##.TT.##'],
    deck: [],
  },
];

// Ô ngoài bàn ('#') chặn ô như kim loại (không đặt được, không vỡ, búa không đập được) nhưng không vẽ.
// Chữ thường ('o', 'k'...) = mèo bị nhốt trong chuồng (tuning.mjs CAGE): { group, cage: số khóa còn lại }.
export function parseBoard(rows) {
  return rows.join('').split('').map(ch => (ch === '.' ? null : ch === 'X' ? { block: true } : ch === 'M' ? { block: true, metal: true }
    : ch === '#' ? { block: true, metal: true, void: true }
      : ch !== ch.toUpperCase() ? { group: LETTERS[ch.toUpperCase()], locked: true, starting: true, cage: CAGE.LOCKS }
        : { group: LETTERS[ch], locked: true, starting: true }));
}
import { CAGE } from './tuning.mjs';
export { boardSize } from './board-shapes.mjs';

export function parseCard(spec) {
  const [kind, letters] = spec.includes(':') ? spec.split(':') : [null, spec.replace('|', '')];
  const offsets = kind ? { I: SHAPES.line, V: SHAPES.lineV, L: SHAPES.elbow }[kind]
    : spec.includes('|') ? SHAPES.dominoV : letters.length === 2 ? SHAPES.domino : SHAPES.single;
  return { offsets: offsets.map(point => point.slice()), items: [...letters].map(ch => ({ group: LETTERS[ch] })) };
}

// Cỏ (`grass`): lớp nằm DƯỚI mèo / ô trống, các hàng chuỗi cùng cỡ với `board` ('~' = ô có cỏ, '.' = sạch). Gom một cụm thì
// cỏ dưới các mèo của cụm bị phá (session.mjs). Màn có cỏ: mục tiêu là dọn hết cỏ (không cần đạt điểm `target`).
export function parseGrass(level) {
  return level.grass ? level.grass.join('').split('').map(ch => ch === '~') : null;
}
export const grassCount = level => (level.grass ? [...level.grass.join('')].filter(ch => ch === '~').length : 0);

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
