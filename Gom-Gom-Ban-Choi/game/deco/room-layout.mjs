// Bố cục phòng mèo (thuần dữ liệu, không đụng Three.js): chỗ đặt từng món, bán kính vật cản, cửa sổ.
// Dùng chung cho cảnh 3D (deco-room.mjs, garden-scene.mjs) và não mèo (room-cats.mjs).
// Khi port sang Cocos: model đặt đúng [x, z, xoay]; +z của mỗi món hướng vào giữa phòng.

export const ROOM_HALF = 4;   // sàn 8 × 8 m, tâm ở gốc toạ độ
export const WALL_H = 3;

// Các khu nối liền nhau thành một "khu nhà": vườn ở giữa, phòng khách mọc ra phía sau vườn (-z), phòng ngủ nằm bên
// trái phòng khách (-x), bếp nằm bên phải phòng khách (+x). Toạ độ trong từng khu vẫn tính từ tâm khu đó (PLACES bên dưới), ZONE_OFFSET là tâm khu trong
// hệ toạ độ của vườn. Hai khu cạnh nhau cách tâm 2 × nửa khu + .4: mỗi tường dày .2 chìa ra ngoài sàn, hai tường quay lưng vào nhau vừa khít
// (khe .3 cũ làm hai đỉnh tường chồng nhau .1 -> hai màu tường chớp z-fighting ở đỉnh tường chỗ hai phòng giáp nhau).
const ZONE_STEP = ROOM_HALF * 2 + .4;
// Vườn mở rộng (thắng màn 30): vườn nới dài thêm một ô 8 × 8 về bên phải (+x), liền một mảnh nền + một hàng rào bao quanh
// (x từ -ROOM_HALF tới GARDEN_EXT_X + ROOM_HALF). Đồ của phần mở rộng vẫn là đồ của vườn (PLACES theo toạ độ vườn).
// 'garden2' chỉ còn là ô đi lại nội bộ cho mèo (room-cats.mjs) + tâm phần mở rộng, KHÔNG phải một khu Deco riêng.
export const GARDEN_EXT_X = ROOM_HALF * 2;
export const ZONE_OFFSET = { garden: [0, 0], living: [0, -ZONE_STEP], bedroom: [-ZONE_STEP, -ZONE_STEP], kitchen: [ZONE_STEP, -ZONE_STEP], garden2: [GARDEN_EXT_X, 0] };
// Khung vườn (mặt trong hàng rào) khi chưa / đã mở rộng.
export const gardenBounds = expanded => ({ x0: -ROOM_HALF, x1: expanded ? GARDEN_EXT_X + ROOM_HALF : ROOM_HALF, z0: -ROOM_HALF, z1: ROOM_HALF });
// Cửa từ vườn vào phòng khách: trên tường +z của phòng (toạ độ phòng), cũng là cổng trên hàng rào -z của vườn.
// Mèo đi qua cửa này (room-cats.mjs); hai bên cửa (trong phòng lẫn ngoài vườn) chừa một lối trống x ≈ DOOR.x ± 0.6.
export const DOOR = { x: -1.6, w: 1, h: 2.1 };
// Cửa phòng khách <-> phòng ngủ: trên tường trái (-x) phòng khách = tường phải (+x) phòng ngủ, ở z (toạ độ phòng,
// hai phòng cùng z) = BEDROOM_DOOR.z. Hai bên cửa chừa lối trống z ≈ BEDROOM_DOOR.z ± 0.6.
export const BEDROOM_DOOR = { z: 2.3, w: 1, h: 2.1 };
// Cửa phòng khách <-> bếp: trên tường phải (+x) phòng khách = tường trái (-x) bếp, ở z (toạ độ phòng, hai phòng cùng z) =
// KITCHEN_DOOR.z. Nằm giữa bể cá (z ≈ .9) và cây cào móng (z ≈ -2.9) của phòng khách, sát bể cá hơn để cánh cửa mở hé (về phía
// -z) không chạm cây cào móng; hai bên cửa chừa lối trống z ≈ KITCHEN_DOOR.z ± 0.6.
export const KITCHEN_DOOR = { z: -.6, w: 1, h: 2.1 };
// Các lối nối hai khu cho mèo (room-cats.mjs): at = toạ độ (khu nhà) của tâm lối theo trục dọc tường, w = bề rộng.
// open: lối thông thoáng cả bề ngang (vườn <-> phần mở rộng, không có rào ngăn): mèo đi thẳng, không vòng qua cửa.
export const LINKS = [
  { a: 'garden', b: 'living', at: ZONE_OFFSET.living[0] + DOOR.x, w: DOOR.w },
  { a: 'living', b: 'bedroom', at: ZONE_OFFSET.living[1] + BEDROOM_DOOR.z, w: BEDROOM_DOOR.w },
  { a: 'living', b: 'kitchen', at: ZONE_OFFSET.living[1] + KITCHEN_DOOR.z, w: KITCHEN_DOOR.w },
  { a: 'garden', b: 'garden2', at: 0, w: ROOM_HALF * 2, open: true },
];

// ---------- Đồi nhỏ ở phần vườn mở rộng ----------
// Đồi hình elip (bán trục rx, rz) cao h, sườn thoải dạng cos² (đỉnh tròn, chân đồi hoà vào mặt cỏ). Toạ độ vườn.
// groundHeight() là độ cao mặt đất thật: model đồi (garden2-scene.mjs) dựng đúng theo công thức này, món đặt trên đồi
// nhấc lên theo nó, mèo trèo đồi / đáp xuống sườn đồi cũng dùng nó (chỉ có đồi khi vườn đã mở rộng).
export const HILL = { x: GARDEN_EXT_X + 1.3, z: -1.5, rx: 2.5, rz: 2.2, h: 1.5 };
export const hillProfile = d => d >= 1 ? 0 : HILL.h * Math.cos(d * Math.PI / 2) ** 2; // d = khoảng cách chuẩn hoá (0 = đỉnh)
export function groundHeight(zone, x, z) {
  if (zone !== 'garden') return 0;
  return hillProfile(Math.hypot((x - HILL.x) / HILL.rx, (z - HILL.z) / HILL.rz));
}
// Mèo đi vòng quanh đồi (chỉ lên đồi bằng hành vi trèo đồi): vòng vật cản phủ phần đồi cao > ~3 cm.
export const HILL_OBSTACLE_R = Math.min(HILL.rx, HILL.rz) * .92;

// [x, z, xoay?] — thiếu xoay thì món tự quay mặt vào giữa phòng (atan2(-x, -z)).
// Xếp theo lưới 3 × 3 (cột x ≈ -2.7 / 0 / 2.7, hàng z ≈ -2.7 / 0 / 2.7) rồi xê dịch từng món một chút:
// đồ phủ đều cả khu, kể cả giữa, nhìn tự nhiên mà vẫn ngay hàng. Đồ treo / kê tường thì sát tường.
export const PLACES = {
  // phòng khách: xếp theo từng góc có công dụng thay vì rải lẻ từng món (cửa sổ tường sau x = -1.6 và cửa ra vườn
  // tường trước x = -1.6 để trống). Góc đọc sách (ghế bành + đèn) sau-trái, góc chơi (cây cào móng + giỏ len + kệ sách)
  // sau-phải, thảm + bàn trà giữa phòng, bể cá tường phải, ổ mèo trước-phải, chậu cây cạnh cửa. Đồ trang trí cố định
  // (rèm, tủ thấp, tranh, dây cờ, gối sàn) nằm sát tường: deco-room.mjs livingDecor().
  armchair: [-2.9, -2.7], lamp: [-3.5, -1.4], // đèn cách ghế bành; tranh lớn tường trái ở z -.9..+.1 (không chạm chao đèn)
  shelf: [1.3, -ROOM_HALF + .34, 0], cattree: [3.1, -2.9], yarn: [1.6, -1.8],
  rug: [0, .3, 0], table: [.3, -.1], tank: [ROOM_HALF - .58, .9, -Math.PI / 2],
  plant: [-.4, 3.3], catbed: [2.6, 2.7], // cây đứng bên phải cửa ra vườn: bên trái là chỗ cánh cửa mở hé
  // phòng ngủ (cửa sang phòng khách ở tường phải z = 2.3, cửa sổ tường sau x = .2): góc ngủ (giường + tủ đầu giường)
  // sau-trái, góc máy tính (bàn PC + ghế) sau-phải, tủ quần áo tường trái, bậc leo cho mèo tường phải, thảm lông giữa
  // phòng, gấu bông góc trước-trái, giỏ đồ giặt phía trước. Đồ cố định (rèm, đèn dây, tranh, dép): bedroomDecor().
  bed: [-2.4, -2.68, 0], bedside: [-.85, -3.55, 0], desk: [2.45, -3.6, 0], chair: [2.45, -2.45, Math.PI],
  closet: [-3.62, .7, Math.PI / 2], catsteps: [ROOM_HALF - .28, -.5, -Math.PI / 2], bedrug: [.2, .4, 0],
  plushie: [-3, 3], laundry: [.9, 3.1],
  // bếp (cửa sang phòng khách ở tường trái z = -.6, cửa sổ tường sau x = .55 ngay trên bồn rửa): tủ lạnh góc sau-trái, bếp nấu cạnh
  // tủ lạnh, bồn rửa dưới cửa sổ, quầy chữ L (bồn rửa + dãy quầy dọc tường sau rồi tường phải),
  // tủ chén tường phải phía trước, bàn ăn giữa phòng, bốn ghế quanh bàn (gốc model = tâm bàn), chậu cây giữa tường trước, khay ăn của mèo góc trước-trái,
  // xe đẩy tường phải. Đồ cố định (rèm, giá treo dụng cụ, bảng thực đơn, thảm, thùng rác): kitchenDecor().
  fridge: [-3.05, -3.58, 0], stove: [-1.55, -3.62, 0], sink: [.55, -3.62, 0], pantry: [3.7, 2.95, -Math.PI / 2],
  dining: [.1, .7], kchair: [.1, .7, 0], kplant: [1.9, 3.3, 0], catfood: [-3, 2.6], cart: [3.65, 1.6, -Math.PI / 2],
  // phần vườn mở rộng (toạ độ vườn, x ≈ 4..12; đồi ở sau-phải): cối xay gió trên đỉnh đồi, cây xích đu sau-trái, dây
  // phơi đồ dọc rào sau, lửa trại bên trái, hoa hướng dương giữa, diều cắm cọc trước chân đồi, suối nhỏ trước-phải, cầu
  // trượt trước-trái. Món không có hướng riêng quay mặt vào giữa phần mở rộng. Đồ cố định (lối đá, đá, hoa dại,
  // bóng mây): garden2Decor().
  windmill: [HILL.x, HILL.z, 0], swingtree: [GARDEN_EXT_X - 2.6, -2.2, Math.atan2(2.6, 2.2)], clothesline: [GARDEN_EXT_X - 1.1, -3.55, 0],
  campfire: [GARDEN_EXT_X - 2.4, -.1, Math.atan2(2.4, .1)], sunflowers: [GARDEN_EXT_X - .2, 1.6, Math.atan2(.2, -1.6)],
  kite: [GARDEN_EXT_X + 1.6, 1.95, 0], stream: [GARDEN_EXT_X + 1.7, 2.95, 0], slide: [GARDEN_EXT_X - 1.7, 2.85, 0],
  // Lối đi quanh đồi: giữa hai vật cản (bán kính OBSTACLE_RADIUS, đồi HILL_OBSTACLE_R) hoặc để khe ≥ .8 m cho mèo lọt,
  // hoặc khép hẳn (≤ .1 m) — khe "suýt lọt" làm mèo kẹt giữa hai lực đẩy (lỗi khóm hướng dương sát chân đồi).
  // vườn (cổng sang phòng khách ở hàng rào sau x = -1.6: lối trống)
  birdbath: [-3.2, -2.3], hammock: [.6, -3, 0], cathouse: [3.1, -1.6, -Math.PI / 2], // nhà mèo áp rào phải, quay mặt vào vườn (xoay chéo thì mái va võng / bụi góc)
  pond: [-2.3, .3], flowers: [.3, -.3], sandbox: [2.4, .2],
  bench: [-2.1, 2.75], stump: [-.4, 2.3], lantern: [1.1, 3.2], catnip: [2.9, 2.5],
};
export const facingOf = id => PLACES[id][2] ?? Math.atan2(-PLACES[id][0], -PLACES[id][1]);

// Bán kính vật cản khi mèo đi quanh. 0 = mặt đất đi được (thảm, bồn hoa).
export const OBSTACLE_RADIUS = {
  catbed: .75, armchair: .8, cattree: .65, table: .62, shelf: .9, yarn: .5, plant: .45, tank: .8, lamp: .38, rug: 0,
  flowers: 0, stump: .45, catnip: .45, lantern: .28, sandbox: .62, cathouse: .75, pond: 1, hammock: .7, birdbath: .36, bench: .75,
  bed: 1.25, bedside: .35, desk: .8, chair: .42, closet: .75, catsteps: .32, bedrug: 0, plushie: .5, laundry: .38,
  fridge: .6, stove: .55, sink: .78, pantry: .6, dining: .95, kchair: .01, kplant: .42, catfood: .5, cart: .55,
  windmill: .65, swingtree: .55, clothesline: .3, campfire: .7, sunflowers: .55, kite: .2, stream: .75, slide: .6,
};

// Vật cản phụ của món dài / chữ L (xoay 0): [dx, dz, bán kính] so với gốc món. Quầy bếp chữ L (sink): dãy sau dọc tường sau,
// góc, dãy phải dọc tường phải (xem counterL trong kitchen-scene.mjs).
export const OBSTACLE_EXTRA = {
  kchair: [[-1.35, 0, .3], [1.35, 0, .3], [0, -1.3, .3], [0, 1.3, .3]],
  sink: [[1.0, 0, .35], [1.7, 0, .35], [2.4, 0, .35], [3.1, .1, .4], [3.1, .8, .35], [3.1, 1.5, .35], [3.1, 2.2, .35], [3.1, 2.7, .35]],
};

// Cửa sổ vòm trên tường sau (phòng khách): chỗ mèo ngồi ngắm chim. Phòng ngủ cũng có cửa sổ (tường sau, x này).
export const BEDROOM_WINDOW_X = .2;
// Cửa sổ bếp (tường sau): ngay trên bồn rửa, không có gờ riêng (mặt bàn bồn rửa làm gờ).
export const KITCHEN_WINDOW_X = .55;
export const WINDOW = { x: -1.6, z: -ROOM_HALF + .5 };
