// Mọi hằng số chỉnh cảm giác chơi ở một chỗ (thuần dữ liệu, không đụng giao diện).
// Mỗi nhóm khai bằng remote('TÊN', mặc định): chỉnh được từ Firebase Remote Config (tham số cùng TÊN, xem remote-config.mjs).
// Khi port sang Cocos: chép nguyên file này (hoặc dùng export/data/tuning.json) để cảm giác giống hệt bản web.
// Thời gian tính bằng mili giây; kích thước 3D tính bằng mét của phòng (phòng 6 × 6).

// Kích thước bàn tuỳ màn (levels.mjs, board-shapes.mjs); W/H ở đây là bàn chuẩn 6×6 dùng làm mặc định.
import { LEVEL_REWARD, REWARD_BEYOND, BOOSTER_PRICE, BOOSTER_START_STOCK, BOOSTER_UNLOCK_LEVEL, BOOSTER_EXTRA_MOVES } from './economy.mjs';
import { remote } from './remote-config.mjs';

export const BOARD = remote('BOARD', { W: 6, H: 6, PREVIEW_COUNT: 1 });

// Ô Hold (cất thẻ) mở từ màn UNLOCK_LEVEL (số thứ tự màn, 1 = màn đầu); màn đó có tutorial dạy dùng Hold.
// Trước đó bàn nhỏ, màn dễ nên chưa cần chỗ cất thẻ.
export const HOLD = remote('HOLD', { UNLOCK_LEVEL: 11 });
export const holdUnlocked = levelIndex => levelIndex + 1 >= HOLD.UNLOCK_LEVEL;


// Chuồng mèo (giới thiệu ở màn 15): mèo bị nhốt chiếm ô, không gom được; mỗi lần gom sát bên mất một khóa,
// hết LOCKS khóa thì chuồng vỡ, mèo được thả ra thành mèo thường tại chỗ. Búa mở chuồng ngay.
export const CAGE = remote('CAGE', { LOCKS: 1 });

// Nhịp animation màn chơi (gom mèo, xoay thẻ, thắng)
export const TIMING = remote('TIMING', {
  ROTATE_MS: 340,      // xoay thẻ đang bóc
  DROP_MS: 220,        // mèo vừa đặt rơi xuống ô
  LIFT_MS: 160,        // mèo bị nhấc bổng trước khi gom (ngắn: gom diễn ra ~.25s sau khi mèo đáp)
  MERGE_MS: 220,       // cả cụm trượt vào điểm tụ
  WIN_PAUSE_MS: 450,   // dừng một nhịp trước màn bay khi thắng
  AFK_MS: 5000,        // không chạm màn hình bấy lâu thì mèo buồn ngủ (biểu cảm sleepy)
  AFK_SLEEP_MS: 6000,  // buồn ngủ thêm bấy lâu nữa thì ngủ say (biểu cảm sleep + zzz)
  CARRY_HOLD_MS: 350,  // giữ mèo trong phòng bấy lâu thì nhấc lên
});

// Kéo thẻ trên bàn chơi / kéo mèo trong phòng
export const DRAG = remote('DRAG', {
  BOOST: 1.6,          // xa bàn thì bóng kéo phóng to gấp BOOST lần
  SHRINK_RANGE: 110,   // px: khoảng cách tới bàn mà bóng kéo co về đúng cỡ ô
  TAP_TOLERANCE: 5,    // px: dịch ít hơn thì là chạm (xoay thẻ) chứ không phải kéo
  CARRY_TOLERANCE: 8,  // px: dịch quá mức này trước khi đủ giờ giữ thì là xoay phòng
});

// Cảnh báo sắp hết lượt
export const LOW_MOVES = remote('LOW_MOVES', { MSG_AT: 3, CATS_AT: 2, WARN_RATIO: .3 });

// Kinh tế (xu thưởng, giá booster, giá đồ ...): sửa ở gameplay/economy.mjs — ở đây chỉ gom lại cho code cũ dùng.
export const ECONOMY = { LEVEL_REWARD, REWARD_BEYOND, MAX_ROOM_CATS: 6 };

// Mèo 3D trong phòng
export const CAT_BODY = remote('CAT_BODY', { W: .6, H: .55, D: .62, LEG: .1 });
export const CAT_MOTION = remote('CAT_MOTION', {
  ROOM_LIMIT: 3.5,                     // mèo đi trong khoảng ±ROOM_LIMIT (sàn ±ROOM_HALF = 4, room-layout.mjs)
  CARRY_H: .95,                        // độ cao lơ lửng khi bị nhấc
  STRIDE_WALK: .34, STRIDE_RUN: .78,   // quãng đường cho một chu kỳ bước (chân không trượt)
  WALK_SPEED: .72, RUN_SPEED: 2.1,
  // [độ cứng, tỉ lệ tắt] của lò xo từng tư thế: đổi tư thế to thì chậm và êm, chân/tay thì nhanh và nảy.
  POSE_SPRING: {
    sit: [70, .8], lie: [55, .85], curl: [28, .9], stretch: [85, .7], roll: [40, .75], lean: [110, .7],
    paw: [320, .55], groom: [170, .65], knead: [130, .7], tailUp: [36, .6],
  },
});

// Booster trong màn: mở từ màn UNLOCK_LEVEL (không có tutorial), tặng START_STOCK mỗi loại, hết thì mua bằng xu.
// Dùng booster không tốn lượt.
export const BOOSTERS = {
  UNLOCK_LEVEL: BOOSTER_UNLOCK_LEVEL,
  START_STOCK: BOOSTER_START_STOCK,
  EXTRA_MOVES: BOOSTER_EXTRA_MOVES,
  PRICE: BOOSTER_PRICE, // giá: gameplay/economy.mjs
};

// Độ khó thích ứng theo profile người chơi (adaptive.mjs, tai-lieu/5-Do-kho-theo-profile-nguoi-choi.md).
export const ADAPTIVE = remote('ADAPTIVE', {
  // Nhãn độ khó (chỉ hiển thị, tính trên bản thiết kế — DDA không đổi lượt / màu / bàn):
  TIGHT_PPM: 18,          // điểm cần mỗi lượt (target / moves) từ mức này trở lên thì element "moves" bật
  MANY_COLORS: 5,         // từ bấy nhiêu giống mèo trở lên thì element "màu" bật
  // Nhận diện profile:
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
  CALM_LEVELS: 3,         // sau khi nhận diện "sắp bỏ game": bấy nhiêu màn thắng kế tiếp không bị làm khó
  HISTORY: 60,            // số lần thử giữ trong save
  // Hàng thẻ (không đổi bàn, không đổi lượt):
  ASSIST_STEP: 0.05,      // assist (thẻ trùng màu mèo trên bàn) đổi bấy nhiêu mỗi mức / mỗi lần thua thêm
  ASSIST_SPAN: 0.15,      // assist lệch tối đa bấy nhiêu so với thiết kế
  SHAPE_SPAN: 2,          // tỉ lệ mỗi loại thẻ lệch tối đa bấy nhiêu so với thiết kế
  STUCK_AFTER: 2,         // thua vì hết chỗ bấy nhiêu lần ở màn này -> thêm thẻ đôi
  MOVES_AFTER: 2,         // thua vì hết lượt bấy nhiêu lần ở màn này -> thêm assist + một thẻ to
  CROWDED_BLOCKS: 6,      // bàn có từ bấy nhiêu ô vật cản = màn chật: thẻ to thêm vào là thẻ đôi thay vì thẻ 3 ô (đỡ kẹt)
});
