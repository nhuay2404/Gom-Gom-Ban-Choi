// Mọi hằng số chỉnh cảm giác chơi ở một chỗ (thuần dữ liệu, không đụng giao diện).
// Khi port sang Cocos: chép nguyên file này (hoặc dùng export/data/tuning.json) để cảm giác giống hệt bản web.
// Thời gian tính bằng mili giây; kích thước 3D tính bằng mét của phòng (phòng 6 × 6).

// Kích thước bàn tuỳ màn (levels.mjs, board-shapes.mjs); W/H ở đây là bàn chuẩn 6×6 dùng làm mặc định.
export const BOARD = { W: 6, H: 6, PREVIEW_COUNT: 1 };

// Ô Hold (cất thẻ) mở từ màn UNLOCK_LEVEL (số thứ tự màn, 1 = màn đầu); màn đó có tutorial dạy dùng Hold.
// Trước đó bàn nhỏ, màn dễ nên chưa cần chỗ cất thẻ.
export const HOLD = { UNLOCK_LEVEL: 11 };
export const holdUnlocked = levelIndex => levelIndex + 1 >= HOLD.UNLOCK_LEVEL;

// Chuồng mèo (giới thiệu ở màn 15): mèo bị nhốt chiếm ô, không gom được; mỗi lần gom sát bên mất một khóa,
// hết LOCKS khóa thì chuồng vỡ, mèo được thả ra thành mèo thường tại chỗ. Búa mở chuồng ngay.
export const CAGE = { LOCKS: 1 };

// Nhịp animation màn chơi (gom mèo, xoay thẻ, thắng)
export const TIMING = {
  ROTATE_MS: 340,      // xoay thẻ đang bóc
  DROP_MS: 220,        // mèo vừa đặt rơi xuống ô
  LIFT_MS: 160,        // mèo bị nhấc bổng trước khi gom (ngắn: gom diễn ra ~.25s sau khi mèo đáp)
  MERGE_MS: 220,       // cả cụm trượt vào điểm tụ
  WIN_PAUSE_MS: 450,   // dừng một nhịp trước màn bay khi thắng
  AFK_MS: 5000,        // không chạm màn hình bấy lâu thì mèo buồn ngủ (biểu cảm sleepy)
  AFK_SLEEP_MS: 6000,  // buồn ngủ thêm bấy lâu nữa thì ngủ say (biểu cảm sleep + zzz)
  CARRY_HOLD_MS: 350,  // giữ mèo trong phòng bấy lâu thì nhấc lên
};

// Kéo thẻ trên bàn chơi / kéo mèo trong phòng
export const DRAG = {
  BOOST: 1.6,          // xa bàn thì bóng kéo phóng to gấp BOOST lần
  SHRINK_RANGE: 110,   // px: khoảng cách tới bàn mà bóng kéo co về đúng cỡ ô
  TAP_TOLERANCE: 5,    // px: dịch ít hơn thì là chạm (xoay thẻ) chứ không phải kéo
  CARRY_TOLERANCE: 8,  // px: dịch quá mức này trước khi đủ giờ giữ thì là xoay phòng
};

// Cảnh báo sắp hết lượt
export const LOW_MOVES = { MSG_AT: 3, CATS_AT: 2, WARN_RATIO: .3 };

// Kinh tế Deco: mỗi màn trả một số xu cố định ở LẦN THẮNG ĐẦU (không phụ thuộc số sao; chơi lại không ra xu), tăng dần theo màn.
// Cân theo từng lô 10 màn (giá món gốc ở deco-data.mjs, chưa tính phương án thay thế):
//   màn 1–10  = 1395 xu ≥ 1380 = mọi món gốc Vườn 1 (flowers..bench)
//   màn 11–20 = 1634 xu ≥ 1620 = mọi món gốc Vườn 2 (windmill..slide)
//   màn 21+   : chỉ ~60–80% giá món gốc của khu vừa mở, chừa khoảng trống cho liveops / giữ chân:
//   màn 21–30 =  976 xu ≈ 61% của Phòng khách (1600);  màn 31–40 = 1014 xu ≈ 80% của Phòng ngủ (1270)
// Ngoài bảng (màn 41+, Bếp 1160 xu): REWARD_BEYOND xu mỗi màn ≈ 69% mỗi lô 10 màn. Đổi giá đồ thì chạy `npm test` (có test kiểm các mốc trên).
export const ECONOMY = {
  LEVEL_REWARD: [
    120, 125, 130, 135, 140, 143, 146, 150, 152, 154,
    155, 157, 159, 161, 162, 164, 166, 168, 170, 172,
    90, 92, 94, 96, 97, 98, 100, 101, 103, 105,
    96, 98, 99, 100, 101, 102, 103, 104, 105, 106,
  ],
  REWARD_BEYOND: 80,
  MAX_ROOM_CATS: 6,
};

// Mèo 3D trong phòng
export const CAT_BODY = { W: .6, H: .55, D: .62, LEG: .1 };
export const CAT_MOTION = {
  ROOM_LIMIT: 3.5,                     // mèo đi trong khoảng ±ROOM_LIMIT (sàn ±ROOM_HALF = 4, room-layout.mjs)
  CARRY_H: .95,                        // độ cao lơ lửng khi bị nhấc
  STRIDE_WALK: .34, STRIDE_RUN: .78,   // quãng đường cho một chu kỳ bước (chân không trượt)
  WALK_SPEED: .72, RUN_SPEED: 2.1,
  // [độ cứng, tỉ lệ tắt] của lò xo từng tư thế: đổi tư thế to thì chậm và êm, chân/tay thì nhanh và nảy.
  POSE_SPRING: {
    sit: [70, .8], lie: [55, .85], curl: [28, .9], stretch: [85, .7], roll: [40, .75], lean: [110, .7],
    paw: [320, .55], groom: [170, .65], knead: [130, .7], tailUp: [36, .6],
  },
};

// Booster trong màn: mở từ màn UNLOCK_LEVEL (không có tutorial), tặng START_STOCK mỗi loại, hết thì mua bằng xu.
// Dùng booster không tốn lượt.
export const BOOSTERS = {
  UNLOCK_LEVEL: 3,
  START_STOCK: 3,
  EXTRA_MOVES: 3,
  PRICE: { hammer: 60, swap: 40, moves: 80 },
};

// LiveOps Phase 1 (liveops.mjs, tai-lieu/6-Thiet-ke-LiveOps.html): gems, mạng, continue, điểm danh, nhiệm vụ ngày, chuỗi thắng.
// Mốc màn tính theo số thứ tự màn (1 = màn đầu); 20 màn đầu không có mạng / chuỗi thắng để giữ RR1.
export const LIVEOPS = {
  START_GEMS: 0,
  LIVES_MAX: 5,
  LIFE_REGEN_MS: 30 * 60 * 1000,     // hồi 1 mạng mỗi 30 phút
  LIVES_FROM_LEVEL: 21,              // mất mạng khi thua / bỏ ngang từ màn này
  LIVES_INTRO_UNLIMITED_MIN: 60,     // lần đầu bật mạng: tặng 1 giờ mạng vô hạn
  REFILL_GEMS: 60,                   // hồi đầy mạng bằng gems
  CONTINUE_FROM_LEVEL: 11,
  CONTINUE_GEMS: [60, 100, 150],     // lần 1 / 2 / 3+ trong cùng một lượt chơi
  CONTINUE_MOVES: 5,
  CONTINUE_AD_MOVES: 3,              // continue bằng rewarded ad: 1 lần / lượt chơi
  CONTINUE_CLEAR_CELLS: 3,           // thua vì hết chỗ: continue dọn thêm bấy nhiêu ô
  AD_LIVES_PER_DAY: 3,
  DAILY_FROM_CLEARED: 5,             // điểm danh + nhiệm vụ hiện sau khi qua bấy nhiêu màn
  CLOCK_TOLERANCE_MS: 10 * 60 * 1000, // giờ máy lùi quá mức này so với mốc lớn nhất từng thấy = khoá nhận quà
  // Điểm danh 7 ngày: bỏ lỡ ngày thì dừng, không mất tiến độ. unlimitedMin = phút mạng vô hạn.
  LOGIN_REWARDS: [
    { coins: 50 },
    { boosters: { hammer: 1 } },
    { coins: 80 },
    { boosters: { swap: 1 }, unlimitedMin: 30 },
    { coins: 120 },
    { boosters: { moves: 1 } },
    { coins: 150, gems: 10, unlimitedMin: 60 },
  ],
  QUEST_SLOTS: { easy: 20, medium: 30, hard: 50 },  // mỗi ngày 1 nhiệm vụ mỗi độ khó, tổng 100 điểm = mở rương
  CHEST: { coins: 60, randomBooster: 1 },
  STREAK_FROM_LEVEL: 21,
  // Chuỗi thắng: thắng liên tiếp tối thiểu `wins` thì màn kế được quà đầu màn.
  STREAK_TIERS: [
    { wins: 3, moves: 2 },
    { wins: 5, moves: 2, hammer: 1 },
    { wins: 8, moves: 3, hammer: 1, swap: 1 },
  ],
  GEM_PACKS: [
    { id: 'gems-s', gems: 60, price: '$0.99' },
    { id: 'gems-m', gems: 330, price: '$4.99' },
    { id: 'gems-l', gems: 700, price: '$9.99', tag: 'Popular' },
    { id: 'gems-xl', gems: 1500, price: '$19.99' },
  ],
  // Event hằng tuần (events.mjs; lịch ở liveops-data.mjs). fromLevel = event hiện khi người chơi tới màn này, và chỉ thắng / gom
  // ở màn từ fromLevel trở lên mới tính (kể cả chơi lại màn đã qua; chặn cày màn dễ đầu game). Đổi mốc từng event ở đây.
  EVENTS: {
    yarn: {
      fromLevel: 11,
      steps: 7,                                       // thắng lên 1 bậc, thua / bỏ ngang lùi 1 bậc; lên đỉnh thì nhận thưởng và leo lại từ 0
      stepRewards: { 2: { coins: 20 }, 4: { boosters: { hammer: 1 } }, 6: { coins: 40 } }, // mỗi lượt leo nhận một lần
      top: { coins: 200, gems: 15, boosters: { moves: 1 } },
      repeatTop: { coins: 100, gems: 5 },             // lần lên đỉnh thứ 2 trở đi trong cùng event
    },
    fish: {
      fromLevel: 11,
      // mỗi cụm gom ra cá = số mèo trong cụm (cả ván thua); mốc tích luỹ và thưởng. deco = id món Deco độc quyền (deco-data.mjs)
      milestones: [
        { fish: 40, reward: { coins: 30 } },
        { fish: 90, reward: { boosters: { hammer: 1 } } },
        { fish: 150, reward: { coins: 50 } },
        { fish: 220, reward: { boosters: { swap: 1 } } },
        { fish: 300, reward: { gems: 5 } },
        { fish: 380, reward: { coins: 60 } },
        { fish: 460, reward: { boosters: { moves: 1 } } },
        { fish: 540, reward: { coins: 80 } },
        { fish: 620, reward: { gems: 5 } },
        { fish: 700, reward: { deco: 'lantern-koi' } },
      ],
      adDoublePerDay: 3,                              // rewarded ad nhân đôi cá của màn vừa thắng
    },
    race: {
      fromLevel: 11,
      goal: 10,                                       // ai thắng đủ bấy nhiêu màn trước thì về nhất
      hours: 24,                                      // tính từ lúc tham gia (vào màn đầu tiên trong ngày đua)
      // đối thủ do máy điều khiển: số màn thắng trong 24 giờ [ít nhất, nhiều nhất], rải ngẫu nhiên theo giờ
      bots: [[11, 14], [8, 11], [5, 8], [2, 5]],
      rewards: [{ gems: 30, coins: 300 }, { gems: 15, coins: 150 }, { gems: 5, coins: 80 }, { coins: 30 }, { coins: 30 }],
    },
    decoSale: { off: 0.3 },                           // giảm giá đồ Deco bằng xu
  },
};

// Độ khó thích ứng theo profile người chơi (adaptive.mjs, tai-lieu/5-Do-kho-theo-profile-nguoi-choi.md).
export const ADAPTIVE = {
  TIGHT_PPM: 18,          // điểm cần mỗi lượt (target / moves) từ mức này trở lên thì element "moves" bật
  LOOSE_PPM: 16,          // tắt moves: moves = ceil(target / LOOSE_PPM)
  TIGHTEN_PPM: 18,        // bật moves: moves = floor(target / TIGHTEN_PPM) (vừa chạm ngưỡng; 19 làm vài màn rớt quá mạnh)
  MANY_COLORS: 5,         // từ bấy nhiêu giống mèo trở lên thì element "màu" bật
  WINDOW: 5,              // cửa sổ lần thử gần nhất để tính tỉ lệ thắng
  ONBOARD_LEVELS: 4,      // người mới: đang ở 4 màn đầu ...
  ONBOARD_ATTEMPTS: 6,    // ... hoặc chưa đủ bấy nhiêu lần thử (chỉ chặn việc nới; thắng sạch liền vẫn được tăng khó)
  NEAR_MISS: 0.85,        // thua mà đạt từ tỉ lệ điểm này trở lên = sát nút
  IDLE_RATIO: 1.5,        // nghĩ mỗi lượt lâu hơn bấy nhiêu lần mức thường của chính người đó = lưỡng lự
  IDLE_SHARE: 0.25,       // hoặc thời gian AFK chiếm hơn bấy nhiêu phần thời gian màn
  FRAGILE_WINDOW: 10,     // từng bỏ ngang trong bấy nhiêu lần thử gần nhất = người chơi mong manh
  DWELL_MS: 8000,         // đứng ở bảng kết quả lâu hơn mức này = nản / mất hứng
  THINKER_MS: 6000,       // mức nghĩ thường mỗi lượt từ đây trở lên (mà vẫn thắng) = người suy nghĩ kỹ
  RETURN_DAYS: 3,         // nghỉ bấy nhiêu ngày thì màn đầu phiên được khởi động nhẹ
  CALM_LEVELS: 3,         // sau khi nhận diện "sắp bỏ game": bấy nhiêu màn thắng kế tiếp tối đa Medium
  EXTRA_MOVES: 2,         // số lượt cộng thêm (người mới thua 2 lần, sát nút lần thứ 4)
  HISTORY: 60,            // số lần thử giữ trong save
  // Chỉnh bộ chia thẻ theo lý do thua ở màn đang chơi lại (không đổi bàn, không đổi lượt):
  STUCK_AFTER: 2,         // thua vì hết chỗ bấy nhiêu lần ở màn này -> thêm thẻ đôi
  MOVES_AFTER: 2,         // thua vì hết lượt bấy nhiêu lần ở màn này -> thêm thẻ 3 ô + tăng assist (thẻ trùng màu mèo trên bàn)
  ASSIST_STEP: 0.1,       // mỗi lần thua thêm / mỗi mức cao thủ
  ASSIST_MAX: 0.6,
  ASSIST_MIN: 0.2,
  CRATE_PER_CELLS: 10,    // bật element crate cho màn chưa có thùng: khoảng 1 thùng / bấy nhiêu ô trong bàn
  CAGE_CATS: 2,           // bật element chuồng (cao thủ): nhốt bấy nhiêu mèo đặt sẵn
  CROWDED_BLOCKS: 6,      // bàn có từ bấy nhiêu ô vật cản = màn chật: hết lượt thì thêm thẻ đôi thay vì thẻ 3 ô (đỡ kẹt)
};
