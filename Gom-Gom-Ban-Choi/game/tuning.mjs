// Mọi hằng số chỉnh cảm giác chơi ở một chỗ (thuần dữ liệu, không đụng giao diện).
// Khi port sang Cocos: chép nguyên file này (hoặc dùng export/data/tuning.json) để cảm giác giống hệt bản web.
// Thời gian tính bằng mili giây; kích thước 3D tính bằng mét của phòng (phòng 6 × 6).

export const BOARD = { W: 6, H: 6, PREVIEW_COUNT: 1 };

// Nhịp animation màn chơi (gom mèo, xoay thẻ, thắng)
export const TIMING = {
  ROTATE_MS: 340,      // xoay thẻ đang bóc
  DROP_MS: 340,        // mèo vừa đặt rơi xuống ô
  LIFT_MS: 560,        // mèo bị nhấc bổng trước khi gom
  MERGE_MS: 420,       // cả cụm trượt vào điểm tụ
  WIN_PAUSE_MS: 800,   // dừng một nhịp trước màn bay khi thắng
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
  ROOM_LIMIT: 2.5,                     // mèo đi trong khoảng ±ROOM_LIMIT
  CARRY_H: .95,                        // độ cao lơ lửng khi bị nhấc
  STRIDE_WALK: .34, STRIDE_RUN: .78,   // quãng đường cho một chu kỳ bước (chân không trượt)
  WALK_SPEED: .72, RUN_SPEED: 2.1,
  // [độ cứng, tỉ lệ tắt] của lò xo từng tư thế: đổi tư thế to thì chậm và êm, chân/tay thì nhanh và nảy.
  POSE_SPRING: {
    sit: [70, .8], lie: [55, .85], curl: [28, .9], stretch: [85, .7], roll: [40, .75], lean: [110, .7],
    paw: [320, .55], groom: [170, .65], knead: [130, .7], tailUp: [36, .6],
  },
};
