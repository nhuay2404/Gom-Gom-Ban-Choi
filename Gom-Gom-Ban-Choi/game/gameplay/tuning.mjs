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
export const CAGE = { LOCKS: 2 };

// Nhịp animation màn chơi (gom mèo, xoay thẻ, thắng)
export const TIMING = {
  ROTATE_MS: 340,      // xoay thẻ đang bóc
  DROP_MS: 340,        // mèo vừa đặt rơi xuống ô
  LIFT_MS: 260,        // mèo bị nhấc bổng trước khi gom (ngắn: gom diễn ra ~.25s sau khi mèo đáp)
  MERGE_MS: 340,       // cả cụm trượt vào điểm tụ
  WIN_PAUSE_MS: 450,   // dừng một nhịp trước màn bay khi thắng
  AFK_MS: 5000,        // không chạm màn hình bấy lâu thì mèo buồn ngủ
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

// Kinh tế Deco
export const ECONOMY = { COINS_PER_STAR: 50, MAX_ROOM_CATS: 6 };

// Mèo 3D trong phòng
export const CAT_BODY = { W: .6, H: .54, D: .62, LEG: .1 };
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
