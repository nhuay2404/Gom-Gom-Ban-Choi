// Bố cục phòng mèo (thuần dữ liệu, không đụng Three.js): chỗ đặt từng món, bán kính vật cản, cửa sổ.
// Dùng chung cho cảnh 3D (deco-room.mjs, garden-scene.mjs) và não mèo (room-cats.mjs).
// Khi port sang Cocos: model đặt đúng [x, z, xoay]; +z của mỗi món hướng vào giữa phòng.

export const ROOM_HALF = 4;   // sàn 8 × 8 m, tâm ở gốc toạ độ
export const WALL_H = 3;

// Các khu nối liền nhau thành một "khu nhà": vườn ở giữa, phòng khách mọc ra phía sau vườn (-z), phòng ngủ nằm bên
// trái phòng khách (-x). Toạ độ trong từng khu vẫn tính từ tâm khu đó (PLACES bên dưới), ZONE_OFFSET là tâm khu
// trong hệ toạ độ của vườn. Hai khu cạnh nhau cách tâm 2 × nửa khu + tường (.3): tường hai phòng tựa lưng nhau.
const ZONE_STEP = ROOM_HALF * 2 + .3;
export const ZONE_OFFSET = { garden: [0, 0], living: [0, -ZONE_STEP], bedroom: [-ZONE_STEP, -ZONE_STEP] };
// Cửa từ vườn vào phòng khách: trên tường +z của phòng (toạ độ phòng), cũng là cổng trên hàng rào -z của vườn.
// Mèo đi qua cửa này (room-cats.mjs); hai bên cửa (trong phòng lẫn ngoài vườn) chừa một lối trống x ≈ DOOR.x ± 0.6.
export const DOOR = { x: -1.6, w: 1, h: 2.1 };
// Cửa phòng khách <-> phòng ngủ: trên tường trái (-x) phòng khách = tường phải (+x) phòng ngủ, ở z (toạ độ phòng,
// hai phòng cùng z) = BEDROOM_DOOR.z. Hai bên cửa chừa lối trống z ≈ BEDROOM_DOOR.z ± 0.6.
export const BEDROOM_DOOR = { z: 2.3, w: 1, h: 2.1 };
// Các lối nối hai khu cho mèo (room-cats.mjs): at = toạ độ (khu nhà) của tâm lối theo trục dọc tường, w = bề rộng.
export const LINKS = [
  { a: 'garden', b: 'living', at: ZONE_OFFSET.living[0] + DOOR.x, w: DOOR.w },
  { a: 'living', b: 'bedroom', at: ZONE_OFFSET.living[1] + BEDROOM_DOOR.z, w: BEDROOM_DOOR.w },
];

// [x, z, xoay?] — thiếu xoay thì món tự quay mặt vào giữa phòng (atan2(-x, -z)).
// Xếp theo lưới 3 × 3 (cột x ≈ -2.7 / 0 / 2.7, hàng z ≈ -2.7 / 0 / 2.7) rồi xê dịch từng món một chút:
// đồ phủ đều cả khu, kể cả giữa, nhìn tự nhiên mà vẫn ngay hàng. Đồ treo / kê tường thì sát tường.
export const PLACES = {
  // phòng khách: xếp theo từng góc có công dụng thay vì rải lẻ từng món (cửa sổ tường sau x = -1.6 và cửa ra vườn
  // tường trước x = -1.6 để trống). Góc đọc sách (ghế bành + đèn) sau-trái, góc chơi (cây cào móng + giỏ len + kệ sách)
  // sau-phải, thảm + bàn trà giữa phòng, bể cá tường phải, ổ mèo trước-phải, chậu cây cạnh cửa. Đồ trang trí cố định
  // (rèm, tủ thấp, tranh, dây cờ, gối sàn) nằm sát tường: deco-room.mjs livingDecor().
  armchair: [-2.9, -2.7], lamp: [-3.5, -1.5],
  shelf: [1.3, -ROOM_HALF + .34, 0], cattree: [3.1, -2.9], yarn: [1.9, -2],
  rug: [0, .3, 0], table: [.3, -.1], tank: [ROOM_HALF - .58, .9, -Math.PI / 2],
  plant: [-3.3, 3.3], catbed: [2.6, 2.7],
  // phòng ngủ (cửa sang phòng khách ở tường phải z = 2.3, cửa sổ tường sau x = .4): góc ngủ (giường + tủ đầu giường)
  // sau-trái, góc máy tính (bàn PC + ghế) sau-phải, tủ quần áo tường trái, bậc leo cho mèo tường phải, thảm lông giữa
  // phòng, gấu bông góc trước-trái, giỏ đồ giặt phía trước. Đồ cố định (rèm, đèn dây, tranh, dép): bedroomDecor().
  bed: [-2.4, -2.7, 0], bedside: [-.85, -3.55, 0], desk: [2.3, -3.6, 0], chair: [2.3, -2.45, Math.PI],
  closet: [-3.62, .7, Math.PI / 2], catsteps: [ROOM_HALF - .28, -.5, -Math.PI / 2], bedrug: [.2, .4, 0],
  plushie: [-3, 3], laundry: [.9, 3.1],
  // vườn (cổng sang phòng khách ở hàng rào sau x = -1.6: lối trống)
  birdbath: [-3.2, -2.3], hammock: [.6, -3, 0], cathouse: [2.8, -2.5],
  pond: [-2.3, .3], flowers: [.3, -.3], sandbox: [2.6, .4],
  bench: [-2.4, 3], stump: [-.4, 2.3], lantern: [1.1, 3.2], catnip: [2.9, 2.5],
};
export const facingOf = id => PLACES[id][2] ?? Math.atan2(-PLACES[id][0], -PLACES[id][1]);

// Bán kính vật cản khi mèo đi quanh. 0 = mặt đất đi được (thảm, bồn hoa).
export const OBSTACLE_RADIUS = {
  catbed: .75, armchair: .8, cattree: .65, table: .62, shelf: .9, yarn: .5, plant: .45, tank: .8, lamp: .38, rug: 0,
  flowers: 0, stump: .45, catnip: .45, lantern: .28, sandbox: .62, cathouse: .75, pond: 1, hammock: .7, birdbath: .36, bench: .75,
  bed: 1.25, bedside: .35, desk: .8, chair: .42, closet: .75, catsteps: .32, bedrug: 0, plushie: .5, laundry: .38,
};

// Cửa sổ vòm trên tường sau (phòng khách): chỗ mèo ngồi ngắm chim. Phòng ngủ cũng có cửa sổ (tường sau, x này).
export const BEDROOM_WINDOW_X = .4;
export const WINDOW = { x: -1.6, z: -ROOM_HALF + .5 };
