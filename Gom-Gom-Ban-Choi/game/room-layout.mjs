// Bố cục phòng mèo (thuần dữ liệu, không đụng Three.js): chỗ đặt từng món, bán kính vật cản, cửa sổ.
// Dùng chung cho cảnh 3D (deco-room.mjs, garden-scene.mjs) và não mèo (room-cats.mjs).
// Khi port sang Cocos: model đặt đúng [x, z, xoay]; +z của mỗi món hướng vào giữa phòng.

export const ROOM_HALF = 3;   // sàn 6 × 6 m, tâm ở gốc toạ độ
export const WALL_H = 3;

// [x, z, xoay?] — thiếu xoay thì món tự quay mặt vào giữa phòng (atan2(-x, -z)).
export const PLACES = {
  // phòng khách
  rug: [0, .1, 0], armchair: [-1.85, -1.95], plant: [-2.4, 2.35], yarn: [-.6, 2.4], catbed: [1.05, 2.2],
  table: [2.4, -.45], lamp: [2.35, -2.4], cattree: [-2.3, .55], shelf: [.35, -2.66, 0], tank: [2.42, 1.15, -Math.PI / 2],
  // vườn
  flowers: [-2, 1.65], stump: [.2, 2.2], catnip: [2.2, 1.5], lantern: [1.15, 2.5], sandbox: [2.2, -.1],
  cathouse: [2, -2], pond: [-1.5, -1.4], hammock: [.35, -2.35, 0], birdbath: [-2.3, .35], bench: [-.8, 2.35],
};
export const facingOf = id => PLACES[id][2] ?? Math.atan2(-PLACES[id][0], -PLACES[id][1]);

// Bán kính vật cản khi mèo đi quanh. 0 = mặt đất đi được (thảm, bồn hoa).
export const OBSTACLE_RADIUS = {
  catbed: .75, armchair: .8, cattree: .65, table: .62, shelf: .9, yarn: .5, plant: .45, tank: .8, lamp: .38, rug: 0,
  flowers: 0, stump: .45, catnip: .45, lantern: .28, sandbox: .62, cathouse: .75, pond: 1, hammock: .7, birdbath: .36, bench: .75,
};

// Cửa sổ vòm trên tường sau (phòng khách): chỗ mèo ngồi ngắm chim.
export const WINDOW = { x: -1.6, z: -2.5 };
