// Vườn hoa (quà khi đã mở hết mọi khu): mảnh đất vuông bên trái vườn, trước phòng ngủ (room-layout.mjs FLOWER_OFFSET).
// Kiểu vườn hoa Đà Lạt, nhiều loại hoa, có cao thấp (không phẳng): lối đá bước từ cổng vào, viền cúc hoạ mi hai bên lối;
// bên trái: luống oải hương (gò lá tròn, bông hai tông) + luống tulip sọc màu trong khung gỗ nâng; bên phải: bụi cẩm tú cầu (chùm hoa
// kết từ bông nhỏ), bãi sao nhái (cosmos) cao thấp nhiều màu, xe đạp chở giỏ hoa; cuối vườn: hàng hướng dương, ghế gỗ, hai cây thông.
// Cổng vòm gỗ phủ hoa + biển "Flower Garden" quay ra đường, rào gỗ mộc, chậu hoa hai bên cổng.
// Hoa / lá / cỏ lặp nhiều dùng InstancedMesh (mỗi loại hình một lưới, màu từng bông qua instanceColor): vài chục lệnh vẽ cho cả vườn.
// Chỉ để ngắm: không có chỗ đặt đồ, mèo không vào. Toạ độ cục bộ: tâm mảnh đất ở gốc, ±ROOM_HALF, cổng ở mép +z (phía đường).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from '../render/mesh-detail.mjs';
import { ROOM_HALF, FLOWER_GATE_Z } from '../room-layout.mjs';
import { TOON, toonMat, FLOOR_OFFSET } from '../render/toon.mjs';
import { spriteSheet } from '../render/sprite-sheet.mjs';

const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, 3, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color) => mesh(new THREE.CylinderGeometry(top, bottom, h, radialSegments(Math.max(top, bottom))), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };

const HALF = ROOM_HALF, GRASS = '#8fcf5e', SOIL = '#8a5a3c', SOIL_DARK = '#6e452c', PATH = '#c9a27a', LEAF = '#5f8f45', LEAF_LIGHT = '#79ad55',
  STEM = '#5a8a3c', WOOD = '#a8714a', WOOD_DARK = '#7d5236', STONE = '#d8cfc0';
export const FLOWER_GATE_W = 1.6;
const PATH_X = .55;                                                          // nửa bề rộng lối chính
const LAVENDER_X = [-1.15, -1.8, -2.45, -3.1], LAVENDER_Z = [-2.75, .25];      // luống oải hương (trái, sau)
const TULIP_BED = { x0: -3.6, x1: -.85, z0: .7, z1: 3.35 };                    // khung tulip (trái, trước)
const TULIP_COLORS = ['#ff5b6e', '#ffd23f', '#ff9ec7', '#fff4ef', '#ff9a3c', '#b07ae8'];
const HYDRANGEA = [[1.3, -2.25, 0], [1.3, -1.1, 1], [1.3, .05, 2], [1.35, 2.95, 0]]; // [x, z, hàng sprite: 0 xanh, 1 đỏ, 2 vàng] dọc lối, bên phải
const COSMOS = { x0: 1.95, x1: 3.65, z0: -2.75, z1: .7 }, COSMOS_COLORS = ['#ff8fc0', '#e0559c', '#ffffff', '#ffd1e6', '#f7a8d8'];
const SUNFLOWER_Z = -3.45, BIKE = [2.75, 3.15], BENCH_Z = -3.2, PINES = [[-3.7, -3.72, 1.05], [3.72, -3.7, .9]];

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = list => list[Math.floor(rnd() * list.length)];

// Một loại hình lặp nhiều lần: items = { p: [x, y, z], s: số | [sx, sy, sz], r: [rx, ry, rz], c: màu }. Có màu riêng thì dùng instanceColor.
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
function instances(geometry, color, items) {
  const inst = new THREE.InstancedMesh(geometry, mat(items.some(it => it.c) ? '#ffffff' : color), items.length);
  items.forEach(({ p, s = 1, r = [0, 0, 0], c }, i) => {
    inst.setMatrixAt(i, M4.compose(V.set(...p), Q.setFromEuler(E.set(...r)), Array.isArray(s) ? S.set(...s) : S.setScalar(s)));
    if (c) inst.setColorAt(i, C.set(c));
  });
  inst.castShadow = inst.receiveShadow = true;
  inst.userData.noOutline = true; // hàng nghìn bông nhỏ: không viền (viền dày hơn cả bông)
  return inst;
}
const egg = (r, stretch, w = 8, h = 6) => { const g = new THREE.SphereGeometry(r, w, h); g.scale(1, stretch, 1); return g; };
// Cuống: trụ mảnh cao 1 m, gốc ở y 0 (scale y = chiều cao thật)
const stemGeo = (() => { const g = new THREE.CylinderGeometry(.008, .011, 1, 5); g.translate(0, .5, 0); return g; })();
// Lá dài: bầu dục dẹt, gốc ở đầu dưới
const bladeGeo = (() => { const g = new THREE.SphereGeometry(.03, 6, 4); g.scale(.7, 3.2, .25); g.translate(0, .09, 0); return g; })();

// ---------- Nền: cỏ (địa hình), lối đá bước, cụm cỏ rải ----------
function ground() {
  const g = group();
  const soil = mat(SOIL), grass = at(mesh(new THREE.BoxGeometry(HALF * 2, .3, HALF * 2), soil), 0, -.15, 0);
  grass.material = [soil, soil, Object.assign(mat(GRASS, { smooth: true }), FLOOR_OFFSET), soil, soil, soil]; // mặt trên cỏ, thành đất
  grass.userData.terrain = true; // nền cỏ = địa hình: toon mượt như nền vườn
  // Lối chính: dải đất nện + đá bước so le
  const path = at(box(PATH_X * 2, .04, HALF + 2.9, PATH), 0, .0, (HALF - 2.9) / 2);
  g.add(grass, path);
  g.userData.structure = true; // nền, lối: kết cấu, không viền
  return g;
}
function steppingStones() {
  const items = [];
  for (let z = HALF - .35, k = 0; z > -2.75; z -= .42, k++) items.push({ p: [(k % 2 ? .1 : -.1) + (rnd() - .5) * .05, .03, z], s: [1 + rnd() * .25, 1, .8 + rnd() * .2], r: [0, rnd() * 3, 0] });
  const g = new THREE.CylinderGeometry(.19, .21, .05, 10);
  return instances(g, STONE, items);
}
// Cụm cỏ: 3 lá nhọn ngả ra, rải chỗ trống (không đè luống / lối)
function grassTufts(free) {
  const g = new THREE.ConeGeometry(.025, .16, 4);
  g.translate(0, .08, 0);
  const items = [];
  for (let n = 0; n < 900 && items.length < 420; n++) {
    const x = (rnd() * 2 - 1) * (HALF - .3), z = (rnd() * 2 - 1) * (HALF - .3);
    if (!free(x, z)) continue;
    for (let b = 0; b < 3; b++) items.push({ p: [x + (rnd() - .5) * .04, 0, z + (rnd() - .5) * .04], s: [1, .7 + rnd() * .7, 1], r: [(rnd() - .5) * .7, 0, (rnd() - .5) * .7], c: rnd() < .5 ? '#6fb34a' : '#88c95a' });
  }
  return instances(g, GRASS, items);
}

// ---------- Oải hương: gò lá tròn trên đất vun, bông là ảnh 2D (tấm sprite 4 × 4: mỗi hàng một tông, đậm → hồng nhạt) ----------
// Mỗi khóm = 2 tấm chữ thập (bản 3D cũ: ~1800 bông trứng, ~100 nghìn tam giác).
const SPRITE_W = .34, SPRITE_H = .34;
function lavenderRows() {
  const g = group(), [z0, z1] = LAVENDER_Z, len = z1 - z0, { quad, build } = spriteSheet('assets/img/deco/lavender.webp', 4, 4, 'oải hương');
  g.add(at(box(Math.abs(LAVENDER_X.at(-1) - LAVENDER_X[0]) + .75, .05, len + .35, SOIL_DARK), (LAVENDER_X[0] + LAVENDER_X.at(-1)) / 2, .005, (z0 + z1) / 2));
  LAVENDER_X.forEach((x, k) => {
    // Gò lá: viên nhộng nằm, ép dẹt, xanh xám như lá oải hương
    const mound = mesh(new THREE.CapsuleGeometry(.24, len - .4, 6, 12), '#6f9a5a');
    mound.rotation.x = Math.PI / 2; mound.scale.set(1, 1, .62); mound.position.set(x, .1, (z0 + z1) / 2);
    g.add(mound);
    const row = 3 - k; // luống trước (k 0) nhạt nhất = hàng dưới cùng của tấm sprite
    for (let z = z0 + .1; z < z1 - .08; z += .1) for (const dx of [-.11, 0, .11]) {
      const s = .85 + rnd() * .3, px = x + dx + (rnd() - .5) * .04, pz = z + (rnd() - .5) * .05, yaw = rnd() * Math.PI, col = Math.floor(rnd() * 4);
      const y = .12 - Math.abs(dx) * .4;
      quad(px, y, pz, yaw, SPRITE_W * s, SPRITE_H * s, col, row);
      quad(px, y, pz, yaw + Math.PI / 2, SPRITE_W * s, SPRITE_H * s, (col + 2) % 4, row);
    }
  });
  g.add(build());
  return g;
}

// ---------- Tulip: luống sọc màu trong khung gỗ nâng ----------
function tulipBed() {
  const b = TULIP_BED, g = group(), w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  g.add(at(box(w - .08, .14, d - .08, SOIL_DARK), cx, .07, cz)); // đất vun trong khung
  for (const [x, z, sw, sd] of [[cx, b.z0, w, .08], [cx, b.z1, w, .08], [b.x0, cz, .08, d], [b.x1, cz, .08, d]]) g.add(at(rbox(sw, .2, sd, .03, WOOD), x, .1, z));
  const heads = [], stems = [], leaves = [], rows = TULIP_COLORS.length;
  for (let k = 0; k < rows; k++) {
    const z = b.z0 + .22 + (d - .44) * k / (rows - 1);
    for (let x = b.x0 + .16; x < b.x1 - .12; x += .13) {
      const px = x + (rnd() - .5) * .04, pz = z + (rnd() - .5) * .05, h = .22 + rnd() * .08;
      stems.push({ p: [px, .14, pz], s: [1, h, 1], r: [(rnd() - .5) * .12, 0, (rnd() - .5) * .12] });
      heads.push({ p: [px, .14 + h + .03, pz], s: .9 + rnd() * .25, r: [0, rnd() * 3, 0], c: TULIP_COLORS[k] });
      if (rnd() < .7) leaves.push({ p: [px, .14, pz], r: [(rnd() - .5) * .5, rnd() * 3, .5 + rnd() * .3], s: 1 });
    }
  }
  // Bông tulip: chén trứng thuôn, miệng xẻ 3 cánh nhọn (chóp nón nhỏ quanh miệng)
  const cup = egg(.045, 1.35, 10, 8);
  const petalTips = heads.flatMap(({ p, s, c }) => [0, 1, 2].map(i => {
    const a = i / 3 * Math.PI * 2 + p[0] * 7;
    return { p: [p[0] + Math.cos(a) * .026 * s, p[1] + .05 * s, p[2] + Math.sin(a) * .026 * s], s: s, c };
  }));
  const tipGeo = new THREE.ConeGeometry(.022, .05, 5);
  g.add(instances(cup, '#fff', heads), instances(tipGeo, '#fff', petalTips), instances(stemGeo, STEM, stems), instances(bladeGeo, LEAF_LIGHT, leaves));
  return g;
}

// ---------- Cẩm tú cầu (đặc sản Đà Lạt): ảnh 2D cả bụi lá + chùm hoa (tấm sprite 3 × 3: hàng xanh / đỏ / vàng, cột = 3 dáng) ----------
// Như luống oải hương: gò lá 3D giữ nguyên, chùm hoa tròn ghép từ nhiều khóm sprite nhỏ (2 tấm chữ thập) rải trên mặt 4 chùm cầu.
// Cả 4 bụi gộp một lưới, một lệnh vẽ (bản 3D cũ: ~460 khối cầu mỗi bụi).
function hydrangeas() {
  const leaves = [], { quad, build } = spriteSheet('assets/img/deco/hydrangea.webp', 3, 3, 'cẩm tú cầu');
  for (const [x, z, row] of HYDRANGEA) {
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      leaves.push({ p: [x + Math.cos(a) * .22, .16 + rnd() * .08, z + Math.sin(a) * .22], s: [1.1, .7, 1.1], c: rnd() < .5 ? LEAF : '#4f7f3a' });
    }
    leaves.push({ p: [x, .26, z], s: [1.4, .9, 1.4], c: LEAF });
    for (const [hx, hy, hz, hr] of [[x - .14, .42, z + .06, .15], [x + .15, .38, z - .05, .14], [x, .48, z - .12, .13], [x + .02, .4, z + .17, .12]]) {
      const n = 9;
      for (let i = 0; i < n; i++) { // khóm rải đều nửa trên chùm cầu (xoắn ốc Fibonacci)
        const y = 1 - (i + .5) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996, s = (.2 + rnd() * .05) * (hr / .14);
        const px = hx + Math.cos(a) * r * hr, py = hy + y * hr - s * .45, pz = hz + Math.sin(a) * r * hr, yaw = rnd() * Math.PI, col = Math.floor(rnd() * 3);
        quad(px, py, pz, yaw, s * 1.26, s, col, row);
        quad(px, py, pz, yaw + Math.PI / 2, s * 1.26, s, (col + 1) % 3, row);
      }
    }
  }
  return group(instances(new THREE.SphereGeometry(.17, 10, 8), LEAF, leaves), build());
}

// ---------- Sao nhái (cosmos) + cúc hoạ mi: hoa 5 cánh trên cuống, cao thấp lệch nhau ----------
function daisyField(spots) {
  const petals = [], centers = [], stems = [];
  for (const { x, z, h, c, size = 1 } of spots) {
    const tilt = (rnd() - .5) * .5;
    stems.push({ p: [x, 0, z], s: [1, h, 1], r: [tilt * .3, 0, tilt * .3] });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + rnd();
      petals.push({ p: [x + Math.cos(a) * .035 * size, h + .005, z + Math.sin(a) * .035 * size], s: size, r: [0, -a, 0], c });
    }
    centers.push({ p: [x, h + .012, z], s: size, c: '#ffc93c' });
  }
  const petal = new THREE.SphereGeometry(.03, 6, 4);
  petal.scale(1.2, .25, .6);
  return group(instances(stemGeo, STEM, stems), instances(petal, '#fff', petals), instances(egg(.016, .7, 6, 4), '#fff', centers));
}
function cosmosPatch() {
  const b = COSMOS, spots = [];
  for (let i = 0; i < 95; i++) spots.push({ x: b.x0 + rnd() * (b.x1 - b.x0), z: b.z0 + rnd() * (b.z1 - b.z0), h: .22 + rnd() * .32, c: pick(COSMOS_COLORS), size: 1.2 + rnd() * .5 });
  return daisyField(spots);
}
function pathBorders() {
  const spots = [];
  for (const side of [-1, 1]) for (let z = HALF - .7; z > -2.6; z -= .13) spots.push({ x: side * (PATH_X + .1 + rnd() * .08), z: z + (rnd() - .5) * .05, h: .07 + rnd() * .06, c: rnd() < .8 ? '#ffffff' : '#ffe27a', size: .8 });
  return daisyField(spots);
}

// ---------- Hướng dương: hàng cuối vườn, mặt quay ra cổng ----------
function sunflowers() {
  const stems = [], leaves = [], discs = [], petals = [], g = group();
  for (let x = -3.15; x <= 3.16; x += .33) {
    if (Math.abs(x) < .8) continue; // chừa chỗ ghế cuối lối
    const h = .85 + rnd() * .3, px = x + (rnd() - .5) * .08, pz = SUNFLOWER_Z + (rnd() - .5) * .12, tilt = .35;
    stems.push({ p: [px, 0, pz], s: [2.2, h, 2.2] });
    for (const y of [.35, .6]) leaves.push({ p: [px, h * y, pz], r: [0, rnd() * 6, 1.1], s: 1.6 });
    const cx = px, cy = h + .02, cz = pz + .03;
    discs.push({ p: [cx, cy, cz + .02], r: [Math.PI / 2 - tilt, 0, 0], s: 1, c: '#6b3f1e' });
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * Math.PI * 2, r = .155;
      // cánh quanh đĩa, nằm trên mặt đĩa nghiêng về trước
      petals.push({ p: [cx + Math.cos(a) * r, cy + Math.sin(a) * r * Math.cos(tilt), cz + Math.sin(a) * r * Math.sin(tilt)], r: [-tilt, 0, a - Math.PI / 2], s: 1.45, c: i % 2 ? '#ffc21a' : '#ffd84a' });
    }
  }
  const disc = new THREE.CylinderGeometry(.1, .1, .04, 16);
  const petal = new THREE.SphereGeometry(.035, 6, 4);
  petal.scale(.7, 1.6, .3);
  g.add(instances(stemGeo, STEM, stems), instances(bladeGeo, LEAF, leaves), instances(disc, '#fff', discs), instances(petal, '#fff', petals));
  return g;
}

// ---------- Đồ trang trí: ghế gỗ, xe đạp chở giỏ hoa (Đà Lạt), cây thông ----------
function bench() {
  const g = group();
  for (const s of [-1, 1]) g.add(at(rbox(.08, .3, .36, .02, WOOD_DARK), s * .5, .15, 0));
  for (const z of [-.11, 0, .11]) g.add(at(rbox(1.2, .05, .1, .02, WOOD), 0, .32, z));
  for (const y of [.5, .64]) g.add(at(rbox(1.2, .09, .04, .02, WOOD), 0, y, -.17));
  for (const s of [-1, 1]) g.add(at(rbox(.06, .5, .05, .02, WOOD_DARK), s * .5, .45, -.18));
  return g;
}
function flowerBike() {
  const g = group(), frame = '#3f8f8a', tire = '#3a3330';
  for (const x of [-.36, .36]) {
    const wheel = mesh(new THREE.TorusGeometry(.2, .025, 8, 24), tire);
    wheel.position.set(x, .225, 0);
    g.add(wheel, at(cyl(.02, .02, .06, '#d9d9d9'), x, .225, 0).rotateX(Math.PI / 2));
  }
  const bar = (x0, y0, x1, y1, r = .018) => {
    const len = Math.hypot(x1 - x0, y1 - y0), b = cyl(r, r, len, frame);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); b.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    g.add(b);
  };
  bar(-.36, .225, -.05, .24); bar(-.05, .24, .3, .5); bar(-.36, .225, -.12, .52); bar(-.12, .52, .3, .5); bar(.36, .225, .3, .58); bar(-.05, .24, -.12, .55);
  g.add(at(rbox(.16, .04, .08, .02, '#5a3a2a'), -.13, .57, 0), at(cyl(.014, .014, .34, frame), .3, .6, 0).rotateX(Math.PI / 2));
  // Giỏ mây trước + sau, đầy hoa
  for (const [x, w] of [[.47, .26], [-.5, .32]]) {
    g.add(at(rbox(w, .16, .26, .03, '#c99a5b'), x, .52, 0));
    for (let i = 0; i < 14; i++) g.add(at(ball(.045, pick(['#ff8fb8', '#ffd23f', '#ffffff', '#c99ae8', '#ff5b6e'])), x + (rnd() - .5) * (w - .08), .62 + rnd() * .05, (rnd() - .5) * .18));
  }
  g.rotation.z = .06; // dựng chân chống, hơi nghiêng
  return g;
}
function pine(scale) {
  const t = group(at(cyl(.08, .12, .9, WOOD_DARK), 0, .45, 0));
  [[.62, .9, .75], [.5, .8, 1.25], [.36, .7, 1.7], [.2, .5, 2.05]].forEach(([r, h, y], i) => t.add(at(mesh(new THREE.ConeGeometry(r, h, 10), i % 2 ? '#3f7a4a' : '#356a40'), 0, y, 0)));
  t.scale.setScalar(scale);
  return t;
}
function fence() {
  const g = group(), h = HALF - .12, post = WOOD_DARK, rail = WOOD;
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / .95)), a = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) g.add(at(rbox(.1, .62, .1, .03, post), x0 + (x1 - x0) * i / n, .31, z0 + (z1 - z0) * i / n));
    for (const y of [.22, .46]) {
      const bar = at(rbox(.05, .07, len, .02, rail), (x0 + x1) / 2, y, (z0 + z1) / 2);
      bar.rotation.y = a;
      g.add(bar);
    }
  };
  const gx = FLOWER_GATE_W / 2;
  run(-h, -h, h, -h); run(-h, -h, -h, h);
  run(h, -h, h, FLOWER_GATE_Z - .55); run(h, FLOWER_GATE_Z + .55, h, h); // cổng nhỏ sang vườn (mèo đi qua)
  run(-h, h, -gx, h); run(gx, h, h, h);
  mergeStatic(g);
  g.userData.structure = true; // rào: kết cấu, không viền (như rào vườn)
  return g;
}

// Biển tên vẽ bằng canvas, dán trên tấm gỗ (cách mặt gỗ 6 mm, không z-fighting).
function signTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f7e3c3'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = WOOD_DARK; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118);
  g.font = '900 64px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#7445c4'; g.fillText('Flower Garden', 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cổng vòm gỗ kiểu vườn hoa Đà Lạt: hai cột, vòm cong phủ kín hoa, biển tên treo dưới đỉnh vòm.
function gate() {
  const g = group(), r = FLOWER_GATE_W / 2 + .08, postH = 1.85;
  for (const s of [-1, 1]) g.add(at(rbox(.18, postH, .18, .05, WOOD), s * r, postH / 2, 0));
  const arch = mesh(new THREE.TorusGeometry(r, .075, 10, 40, Math.PI), WOOD);
  arch.position.y = postH;
  g.add(arch);
  // Hoa leo phủ vòm + quấn hai cột
  const blooms = [];
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI * i / 26;
    blooms.push([Math.cos(a) * r, postH + Math.sin(a) * r, (rnd() - .5) * .14]);
  }
  for (const s of [-1, 1]) for (let y = .5; y < postH; y += .16) blooms.push([s * r + (rnd() - .5) * .16, y, (rnd() - .5) * .18]);
  const colors = ['#ff8fb8', '#ffffff', '#c99ae8', '#ff6b9a'], m = new THREE.Matrix4();
  colors.forEach((color, k) => {
    const mine = blooms.filter((_, i) => i % colors.length === k);
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), mat(color), mine.length);
    mine.forEach(([x, y, z], i) => inst.setMatrixAt(i, m.makeScale(.8 + rnd() * .5, .8 + rnd() * .5, .8 + rnd() * .5).setPosition(x, y, z)));
    inst.castShadow = true;
    g.add(inst);
  });
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(.08, 8, 6), mat(LEAF), blooms.length);
  blooms.forEach(([x, y, z], i) => leaves.setMatrixAt(i, m.makeScale(1.1, .7, 1.1).setPosition(x + (rnd() - .5) * .1, y - .05, z - .04)));
  g.add(leaves);
  // Biển tên
  const plank = at(rbox(1.3, .34, .06, .025, WOOD_DARK), 0, postH + .38, .06);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .28), mat('#ffffff', { map: signTexture() }));
  face.position.set(0, postH + .38, .06 + .03 + .006);
  face.userData.noOutline = true;
  for (const s of [-1, 1]) g.add(at(cyl(.008, .008, .2, WOOD_DARK), s * .5, postH + .6, .06));
  g.add(plank, face);
  return g;
}


// Chậu hoa hai bên cổng
function pot() {
  const p = group(at(cyl(.2, .15, .3, '#d9774f'), 0, .15, 0), at(cyl(.21, .21, .05, '#c4653f'), 0, .3, 0));
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    p.add(at(ball(.07, i % 2 ? '#ff8fb8' : '#c99ae8'), Math.cos(a) * .12, .38 + rnd() * .06, Math.sin(a) * .12));
  }
  p.add(at(ball(.12, LEAF), 0, .34, 0));
  return p;
}


export function buildFlowerGarden() {
  seed = 11;
  // Chỗ đã có luống / đồ: cỏ rải không mọc đè lên
  const taken = [
    [-3.5, -.75, -3, .5], [TULIP_BED.x0 - .1, TULIP_BED.x1 + .1, TULIP_BED.z0 - .1, TULIP_BED.z1 + .1], [.9, 1.8, -2.6, 3.4],
    [-4, 4, -4, -3.05], [2.2, 3.3, 2.6, 3.7], [-1.6, 1.6, 3.55, 4.2],
  ];
  const free = (x, z) => Math.abs(x) > PATH_X + .3 && !taken.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const root = group(ground(), steppingStones(), pathBorders(), lavenderRows(), tulipBed(), hydrangeas(), cosmosPatch(), sunflowers(), grassTufts(free), fence());
  const front = HALF - .12;
  root.add(at(gate(), 0, 0, front));
  for (const s of [-1, 1]) root.add(at(pot(), s * 1.2, 0, front - .4));
  root.add(at(bench(), 0, 0, BENCH_Z));
  const bike = at(flowerBike(), BIKE[0], 0, BIKE[1]);
  bike.rotation.y = -.6;
  root.add(bike, ...PINES.map(([x, z, k]) => at(pine(k), x, 0, z)));
  return root;
}

// Vật cản cho mèo đi trong vườn hoa (toạ độ cục bộ, vòng tròn { x, z, r }): luống, bụi, hàng hướng dương, ghế, xe, thông, chậu, cột cổng.
// Mèo chỉ dạo trên lối đá, bãi cỏ và lối cổng nhỏ sang vườn; không giẫm qua luống.
export function flowerObstacles() {
  const out = [], line = (x0, z0, x1, z1, r) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / r));
    for (let i = 0; i <= n; i++) out.push({ x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, r });
  };
  LAVENDER_X.forEach(x => line(x, LAVENDER_Z[0], x, LAVENDER_Z[1], .27));
  const t = TULIP_BED;
  for (let z = t.z0 + .25; z < t.z1; z += .5) line(t.x0 + .25, z, t.x1 - .25, z, .3);
  HYDRANGEA.forEach(([x, z]) => out.push({ x, z, r: .45 }));
  for (let z = COSMOS.z0 + .3; z < COSMOS.z1; z += .55) line(COSMOS.x0 + .25, z, COSMOS.x1 - .2, z, .3);
  line(-3.15, SUNFLOWER_Z, -.8, SUNFLOWER_Z, .22); line(.8, SUNFLOWER_Z, 3.15, SUNFLOWER_Z, .22);
  out.push({ x: 0, z: BENCH_Z, r: .62 }, { x: BIKE[0], z: BIKE[1], r: .5 }, ...PINES.map(([x, z]) => ({ x, z, r: .55 })));
  const front = HALF - .12;
  for (const s of [-1, 1]) out.push({ x: s * 1.2, z: front - .4, r: .3 }, { x: s * (FLOWER_GATE_W / 2 + .08), z: front, r: .15 });
  return out;
}
