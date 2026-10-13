// Sân sau (phía sau phòng khách + bếp, cửa từ phòng tắm): bể bơi + vườn rau. 10 chỗ đặt cho Deco — bể bơi, ghế nằm, bàn ô dù,
// bếp nướng, hòm đồ bơi, nhà kính, luống cà chua, luống rau củ, bù nhìn, thùng nước mưa; mỗi chỗ 3 theme (gốc = Gỗ, -pink, -modern) — cùng hàng rào
// hai cạnh ngoài (sau + phải; cạnh trước là tường nhà, cạnh trái là tường phòng tắm) và lối đá từ cửa phòng tắm.
// Cùng kiểu dựng với bathroom-scene.mjs: khối bo tròn, viền toon. Mỗi món có chỗ đặt cố định [x, z, xoay?]
// (room-layout.mjs PLACES, toạ độ khu backyard); +z của món là mặt trước. Chưa có tương tác mèo (room-cats.mjs BACKYARD_TOYS rỗng).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { ROOM_HALF, BACKYARD_DOOR, backyardBounds } from './room-layout.mjs';
import { TOON, toonMat } from './toon.mjs';

const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
const ROUND = 3;
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
const ring = (r, tube, color) => mesh(new THREE.TorusGeometry(r, tube, 8, Math.max(16, radialSegments(r) + 6)), color);
const cone = (r, h, color, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
const chrome = () => mat('#c8ccd2', { metalness: .8, roughness: .35 });
// Kính nhà kính: tấm mỏng trong suốt, không viền toon (viền inverted hull phủ tối cả tấm kính).
function glassPane(w, h, d) {
  const pane = mesh(new THREE.BoxGeometry(w, h, d), mat('#d8f1f8', { transparent: true, opacity: .3 }));
  pane.castShadow = false;
  pane.userData.noOutline = true;
  return pane;
}
// Phóng to cả món: scale ở lớp group giữa (lớp ngoài cùng bị hiệu ứng nảy ghi đè scale).
const scaled = (k, ...children) => { const inner = group(...children); inner.scale.setScalar(k); return group(inner); };
const WOOD = '#c98a55', WOOD_DARK = '#9a6a45', SOIL = '#6b4a2f', LEAF = '#5fae46', LEAF_DARK = '#3f8a3a';

// ---------- Cây cà chua: cọc + tán lá + quả đỏ ----------
function tomatoPlant(x, z, seed, base = .3) {
  const g = group(at(cyl(.018, .018, 1.25, WOOD_DARK, 6), x, base + .62, z));
  [[0, .5, 0, .2], [.09, .78, .05, .17], [-.08, 1.0, -.03, .15], [.02, 1.18, .02, .11]].forEach(([dx, y, dz, r]) => g.add(at(ball(r, LEAF), x + dx, y + base, z + dz)));
  [[.15, .58, .1], [-.15, .68, .07], [.07, .9, .15], [-.11, .48, -.12], [.14, 1.02, -.06], [-.06, 1.1, .12]].forEach(([dx, y, dz], i) => {
    if ((i + seed) % 6 !== 5) g.add(at(ball(.06, i % 2 ? '#e8483a' : '#ff6b4a'), x + dx, y + base, z + dz));
  });
  return g;
}
// ---------- Hàng rau củ: cà rốt (lá xanh nhô lên khỏi đất + đỉnh củ cam), bắp cải, bí ngô ----------
const carrot = (x, z) => group(at(cyl(.045, .038, .06, '#ff8a2a', 8), x, .16, z),
  ...[-.45, 0, .45].map(a => at(cone(.032, .28, '#6fbf4a', 5), x + Math.sin(a) * .05, .32, z).rotateZ(a)));
const cabbage = (x, z) => group(squash(at(ball(.2, '#a8d880'), x, .24, z), 1, .8, 1), squash(at(ball(.14, '#c9e8a0'), x, .3, z), 1, .8, 1));
const pumpkin = (x, z) => group(...[-.09, 0, .09].map(dx => squash(at(ball(.18, '#ff9a3c'), x + dx, .27, z), .7, .85, 1)),
  at(cyl(.02, .025, .1, '#6b8a3a', 6), x, .45, z));

// ---------- Hàng rào hai cạnh ngoài của sân sau (cạnh sau -z + cạnh phải +x), kiểu theo món rào đang dùng ----------
// Cạnh trước là tường sau phòng khách + bếp, cạnh trái là tường phải phòng tắm: không dựng rào (đè lên tường).
export function buildBackyardFence(entry) {
  const kind = entry.style || entry.id, b = backyardBounds(), fence = group();
  const run = (len, horizontal) => {
    if (kind === 'fence-hedge') return group(at(rbox(len + .2, .6, .32, .14, entry.color), 0, .3, 0));
    const g = group(at(box(len, .06, .04, entry.color), 0, .42, 0), at(box(len, .06, .04, entry.color), 0, .2, 0));
    const n = Math.max(1, Math.round(len / .5)), step = len / n;
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + i * step;
      g.add(at(rbox(.12, .6, .05, .02, entry.color), x, .3, .02));
      if (kind === 'fence-white') g.add(at(mesh(new THREE.ConeGeometry(.085, .1, 4), entry.color), x, .64, .02).rotateY(Math.PI / 4));
    }
    return g;
  };
  const back = run(b.x1 - b.x0, true), right = run(b.z1 - b.z0, false);
  back.position.set((b.x0 + b.x1) / 2, 0, b.z0 - .05);
  right.position.set(b.x1 + .05, 0, (b.z0 + b.z1) / 2); right.rotation.y = -Math.PI / 2;
  fence.add(back, right);
  fence.traverse(node => { if (node.isMesh) node.castShadow = false; });
  return mergeStatic(fence);
}

// ---------- Đồ cố định: lối đá từ cửa phòng tắm sang bể bơi, thảm chùi chân ngoài cửa ----------
export function backyardDecor() {
  const g = group();
  // Lối đá: phẳng sát mặt cỏ (mèo đi qua được), không viền.
  [[-3.5, 1], [-2.8, 1.25], [-2.05, 1.1], [-1.3, 1.35], [-.5, 1.2], [.3, 1.4], [1.1, 1.25], [1.9, 1.45], [2.7, 1.3]].forEach(([x, z], i) => {
    const stone = squash(at(cyl(.24, .26, .04, i % 2 ? '#d9d2c4' : '#cfc7b8', 14), x, .02, z), 1, 1, .78);
    stone.rotation.y = i * .7;
    g.add(stone);
  });
  const doormat = group(at(rbox(.42, .03, .9, .015, '#c9955e'), 0, .015, 0), at(box(.26, .04, .7, '#8fc9f2'), 0, .02, 0));
  doormat.position.set(-ROOM_HALF + .1, 0, BACKYARD_DOOR.z);
  g.add(doormat);
  g.traverse(node => { node.castShadow = false; node.userData.noOutline = true; });
  return mergeStatic(g);
}

// ---------- Phần dùng chung cho 3 theme ----------
const PINK = '#ffc2d4', PINK_HOT = '#ff8fb6', CREAM_PINK = '#fff6f8', GOLD = '#f2c14e';
const NOIR = '#26282c', NOIR_DARK = '#1f2125', GRAPHITE = '#3a3d43', STEEL = '#f5f8fb', CYAN = '#3fe0ff', MAGENTA = '#ff4fd8', VIOLET = '#b07cff';
const glow = (color, intensity = 1.1) => mat(color, { emissive: color, emissiveIntensity: intensity });
// Món có dải LED / màn hình tự sáng: khai là nguồn sáng (QC glow + chế độ đêm giữ phần sáng).
const lit = node => { node.userData.lightSource = true; return node; };
// Trái tim dày (mặt trước +z, tâm ở gốc), rộng ≈ s.
function heart(s, depth, color) {
  const h = new THREE.Shape();
  h.moveTo(0, .3);
  h.bezierCurveTo(0, .5, -.5, .55, -.5, .15);
  h.bezierCurveTo(-.5, -.15, -.1, -.3, 0, -.5);
  h.bezierCurveTo(.1, -.3, .5, -.15, .5, .15);
  h.bezierCurveTo(.5, .55, 0, .5, 0, .3);
  const b = Math.min(.3, depth / s * .4);
  const geo = new THREE.ExtrudeGeometry(h, { depth: depth / s, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 10 });
  geo.center();
  geo.scale(s, s, s);
  return mesh(geo, color);
}
// Chuỗi hạt tròn dọc một đoạn thẳng (viền lượn sóng / diềm bèo), màu xen kẽ.
const beads = (n, [x0, y0, z0], [x1, y1, z1], r, colors) => Array.from({ length: n }, (_, i) => {
  const t = n === 1 ? .5 : i / (n - 1);
  return at(ball(r, colors[i % colors.length]), x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t);
});
// Hạt xếp vòng tròn bán kính R ở độ cao y.
const beadRing = (n, R, y, r, colors) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2;
  return at(ball(r, colors[i % colors.length]), Math.cos(a) * R, y, Math.sin(a) * R);
});

// Khung bể bơi 4.6 × 2.6: thành bốn phía + viền trên + lòng bể + mặt nước (cách đáy, cách thành ≥ .005).
const POOL = { W: 4.6, D: 2.6, H: .42, T: .2 };
function poolShell(side, rim, floor, water) {
  const { W, D, H, T } = POOL;
  return group(
    at(rbox(W, H, T, .05, side), 0, H / 2, D / 2 - T / 2), at(rbox(W, H, T, .05, side), 0, H / 2, -D / 2 + T / 2),
    at(rbox(T, H, D - 2 * T, .05, side), W / 2 - T / 2, H / 2, 0), at(rbox(T, H, D - 2 * T, .05, side), -W / 2 + T / 2, H / 2, 0),
    at(rbox(W + .12, .06, T + .1, .025, rim), 0, H + .03, D / 2 - T / 2), at(rbox(W + .12, .06, T + .1, .025, rim), 0, H + .03, -D / 2 + T / 2),
    at(rbox(T + .1, .06, D - 2 * T, .025, rim), W / 2 - T / 2, H + .03, 0), at(rbox(T + .1, .06, D - 2 * T, .025, rim), -W / 2 + T / 2, H + .03, 0),
    at(box(W - 2 * T - .01, .04, D - 2 * T - .01, floor), 0, .02, 0),
    at(box(W - 2 * T - .01, .03, D - 2 * T - .01, water instanceof THREE.Material ? water : mat(water, { transparent: true, opacity: .88 })), 0, H - .08, 0));
}
// Gợn nước: vòng sáng mỏng nổi trên mặt nước.
const ripples = color => [[-1.2, -.3, .28], [.6, .35, .22], [1.5, -.45, .16]].map(([x, z, r]) => squash(at(ring(r, .012, color), x, POOL.H - .055, z).rotateX(Math.PI / 2), 1, 1, .7));
// Thang ở thành phải (tay vịn uốn qua thành bể).
function poolLadder(color) {
  const W = POOL.W, g = group();
  for (const z of [-.25, .25]) {
    g.add(at(cyl(.02, .02, .7, color, 8), W / 2 + .12, .35, z), at(cyl(.02, .02, .7, color, 8), W / 2 - .3, .35, z),
      at(cyl(.02, .02, .45, color, 8), W / 2 - .09, .72, z).rotateZ(Math.PI / 2));
  }
  g.add(...[.15, .35].map(y => at(rbox(.06, .03, .56, .012, color), W / 2 + .12, y, 0)));
  return g;
}

// Ghế nằm: chân + khung + nệm (dài 1.8 theo z, tựa lưng ngả về -z). Nệm phẳng trên cùng ở y .39 (seat .4).
function loungerFrame(frame, legColor, cushion) {
  return group(
    ...[-.3, .3].flatMap(x => [[-.75, .55], [.75, .25]].map(([z, h]) => at(box(.06, h, .06, legColor), x, h / 2, z))),
    at(rbox(.7, .06, 1.25, .025, frame), 0, .28, .25), at(rbox(.62, .08, 1.15, .04, cushion), 0, .35, .25));
}
// Tựa lưng ngả: tấm khung + nệm, đầu cao ở -z, mép thấp gặp nệm ngồi.
function loungerBack(frame, cushion, ...extra) {
  const back = group(at(rbox(.7, .06, .65, .025, frame), 0, 0, 0), at(rbox(.62, .08, .58, .04, cushion), 0, .06, 0), ...extra);
  back.position.set(0, .5, -.6); back.rotation.x = .6;
  return back;
}

// Nhà kính 3 × 2.2: nền, cột, xà, vách + mái kính hai mái, cửa trước. Kệ / cây bên trong do từng món thêm.
const GH = { W: 3, D: 2.2, H: 1.8, RISE: .8, post: .07, xs: [-1.5, -.5, .5, 1.5] };
function greenhouseShell(frame, door, finial, knob) {
  const { W, D, H, RISE, post, xs } = GH;
  const g = group(at(rbox(W + .1, .12, D + .1, .05, '#d9d2c4'), 0, .06, 0));
  for (const x of xs) for (const z of [-D / 2, D / 2]) g.add(at(box(post, H, post, frame), x, .12 + H / 2, z));
  g.add(at(box(post, H, post, frame), -W / 2, .12 + H / 2, 0), at(box(post, H, post, frame), W / 2, .12 + H / 2, 0));
  // xà ngang dưới + giữa + trên
  for (const y of [.15, .12 + H * .45, .12 + H]) {
    g.add(at(box(W + post, post, post, frame), 0, y, -D / 2), at(box(W + post, post, post, frame), 0, y, D / 2),
      at(box(post, post, D, frame), -W / 2, y, 0), at(box(post, post, D, frame), W / 2, y, 0));
  }
  // vách kính lùi vào trong khung .045 (không chạm xà / cột)
  const mid = .12 + H / 2;
  g.add(at(glassPane(W - .1, H - .1, .01), 0, mid, -D / 2 + .045), at(glassPane(W - .1, H - .1, .01), 0, mid, D / 2 - .045),
    at(glassPane(.01, H - .1, D - .1), -W / 2 + .045, mid, 0), at(glassPane(.01, H - .1, D - .1), W / 2 - .045, mid, 0));
  // mái hai mái
  const slope = Math.atan2(RISE, D / 2), len = Math.hypot(RISE, D / 2);
  for (const s of [-1, 1]) {
    const roof = group(at(glassPane(W - .1, .01, len - .1), 0, 0, 0), at(box(W + post, post, post, frame), 0, 0, s * (len / 2)));
    for (const x of xs) roof.add(at(box(post, post, len, frame), x, .04, 0));
    roof.position.set(0, .12 + H + RISE / 2, s * D / 4); roof.rotation.x = s * slope;
    g.add(roof);
  }
  g.add(at(box(W + post * 2, post, post, frame), 0, .12 + H + RISE, 0), at(ball(.06, finial), -W / 2 - .02, .12 + H + RISE + .04, 0), at(ball(.06, finial), W / 2 + .02, .12 + H + RISE + .04, 0));
  // cửa trước (giữa, khung ngoài vách kính) + tay nắm
  g.add(at(box(post, H - .05, post, door), -.4, .12 + (H - .05) / 2, D / 2 + .06), at(box(post, H - .05, post, door), .4, .12 + (H - .05) / 2, D / 2 + .06),
    at(box(.87, post, post, door), 0, .12 + H - .05, D / 2 + .06), at(ball(.035, knob), .3, .95, D / 2 + .11));
  return g;
}
// Kệ hai tầng dọc vách sau + chậu cây (màu chậu / lá / hoa theo theme).
function greenhouseShelves(g, shelf, legs, pots, leaves, blooms) {
  const z = -GH.D / 2 + .32;
  for (const y of [.55, 1.0]) g.add(at(rbox(GH.W - .5, .05, .42, .02, shelf), 0, y, z));
  g.add(...[-1.1, 0, 1.1].map(x => at(box(.05, .9, .05, legs), x, .57, z)));
  for (const [y, row] of [[.55, 0], [1.0, 1]]) pots.forEach((pot, i) => {
    const x = -1.05 + i * .52 + row * .1, k = i + row;
    g.add(at(cyl(.1, .075, .16, pot, 12), x, y + .105, z), at(ball(.11 + (k % 2) * .04, leaves[k % leaves.length]), x, y + .26, z));
    if (k % 2 === 0) g.add(at(ball(.04, blooms[(k / 2) % blooms.length]), x + .07, y + .32, z + .06));
  });
}

// Luống nâng 3 × 1: bốn thành + đất.
function raisedBed(side, soil) {
  const L = 3, D = 1, H = .4;
  return group(at(rbox(L, H, .12, .05, side), 0, H / 2, D / 2 - .06), at(rbox(L, H, .12, .05, side), 0, H / 2, -D / 2 + .06),
    at(rbox(.12, H, D - .24, .05, side), L / 2 - .06, H / 2, 0), at(rbox(.12, H, D - .24, .05, side), -L / 2 + .06, H / 2, 0),
    at(box(L - .25, .04, D - .25, soil), 0, H - .04, 0));
}

// Bù nhìn (đơn vị trước khi phóng 1.35): cột chữ thập.
const scarecrowPole = color => [at(cyl(.04, .05, 1.6, color, 8), 0, .8, 0), at(cyl(.035, .035, 1.1, color, 8), 0, 1.2, 0).rotateZ(Math.PI / 2)];

export const BACKYARD_BUILD = {
  // ===== Bể bơi nổi (thành gỗ, mặt nước, thang inox, phao bơi) — 4.6 × 2.6 m =====
  pool() {
    const W = 4.6, D = 2.6, H = .42, T = .2, rim = '#f6efe2', side = '#8fc9f2';
    const g = group(
      // thành bể bốn phía (khối dày, mặt ngoài sơn xanh nhạt), viền gạch trắng trên đỉnh
      at(rbox(W, H, T, .05, side), 0, H / 2, D / 2 - T / 2), at(rbox(W, H, T, .05, side), 0, H / 2, -D / 2 + T / 2),
      at(rbox(T, H, D - 2 * T, .05, side), W / 2 - T / 2, H / 2, 0), at(rbox(T, H, D - 2 * T, .05, side), -W / 2 + T / 2, H / 2, 0),
      at(rbox(W + .12, .06, T + .1, .025, rim), 0, H + .03, D / 2 - T / 2), at(rbox(W + .12, .06, T + .1, .025, rim), 0, H + .03, -D / 2 + T / 2),
      at(rbox(T + .1, .06, D - 2 * T, .025, rim), W / 2 - T / 2, H + .03, 0), at(rbox(T + .1, .06, D - 2 * T, .025, rim), -W / 2 + T / 2, H + .03, 0),
      // lòng bể + mặt nước (cách đáy bể, cách thành .005 trở lên)
      at(box(W - 2 * T - .01, .04, D - 2 * T - .01, '#bfe8f2'), 0, .02, 0),
      at(box(W - 2 * T - .01, .03, D - 2 * T - .01, mat('#5fc8e8', { transparent: true, opacity: .88 })), 0, H - .08, 0));
    // gợn nước: vòng sáng mỏng nổi trên mặt nước
    [[-1.2, -.3, .28], [.6, .35, .22], [1.5, -.45, .16]].forEach(([x, z, r]) => g.add(squash(at(ring(r, .012, '#e8fbff'), x, H - .055, z).rotateX(Math.PI / 2), 1, 1, .7)));
    // phao bơi hồng + bóng trên mặt nước
    g.add(at(ring(.22, .08, '#ff8fb8'), -.6, H - .03, -.2).rotateX(Math.PI / 2), at(ball(.13, '#ffd66b'), 1.1, H + .05, .25));
    // thang inox ở thành phải (tay vịn uốn qua thành bể)
    const chr = chrome();
    for (const z of [-.25, .25]) {
      g.add(at(cyl(.02, .02, .7, chr, 8), W / 2 + .12, .35, z), at(cyl(.02, .02, .7, chr, 8), W / 2 - .3, .35, z),
        at(cyl(.02, .02, .45, chr, 8), W / 2 - .09, .72, z).rotateZ(Math.PI / 2));
    }
    g.add(...[.15, .35].map(y => at(rbox(.06, .03, .56, .012, chr), W / 2 + .12, y, 0)));
    return g;
  },
  // ===== Bể tim: thành hồng, viền trắng + diềm hạt lượn sóng, tim trên thành trước, phao tim =====
  'pool-pink'() {
    const { W, D, H } = POOL;
    const g = poolShell(PINK, CREAM_PINK, '#ffe0e9', '#7fd6ee');
    for (const s of [-1, 1]) g.add(...beads(17, [-W / 2, H + .01, s * (D / 2 + .05)], [W / 2, H + .01, s * (D / 2 + .05)], .055, [CREAM_PINK, PINK_HOT]));
    g.add(...beads(9, [-W / 2 - .05, H + .01, -D / 2 + .3], [-W / 2 - .05, H + .01, D / 2 - .3], .055, [PINK_HOT, CREAM_PINK]));
    g.add(...[-1.4, 0, 1.4].map(x => at(heart(.24, .03, PINK_HOT), x, H / 2, D / 2 + .02)));
    g.add(...ripples('#ffffff'), poolLadder(CREAM_PINK));
    // phao tim nằm trên mặt nước + bóng vàng
    g.add(at(heart(.5, .06, PINK_HOT), -.6, H - .02, -.2).rotateX(-Math.PI / 2), at(ball(.13, GOLD), 1.1, H + .05, .25));
    return g;
  },
  // ===== Bể vô cực LED: thành + viền đá đen, nước xanh trong, dải LED cyan quanh lòng bể dưới mặt nước, đèn đáy =====
  'pool-modern'() {
    const { W, D, H, T } = POOL;
    const g = poolShell(NOIR, NOIR_DARK, GRAPHITE, mat('#46c8e0', { transparent: true, opacity: .72 }));
    const led = glow(CYAN, 1.3);
    for (const s of [-1, 1]) {
      g.add(at(box(W - 2 * T - .04, .03, .02, led), 0, H - .16, s * (D / 2 - T - .015)),
        at(box(.02, .03, D - 2 * T - .04, led), s * (W / 2 - T - .015), H - .16, 0));
    }
    g.add(...[-1.3, 0, 1.3].map(x => at(cyl(.08, .08, .02, led, 16), x, .055, 0)));
    // dải LED tím chạy dưới viền thành trước (nhô khỏi thành .015)
    g.add(at(box(W - .2, .025, .03, glow(VIOLET)), 0, H - .03, D / 2 + .005));
    g.add(...ripples('#bff6ff'), poolLadder(chrome()));
    return lit(g);
  },

  // ===== Ghế nằm phơi nắng (dài 1.8 theo z, tựa lưng ở -z) =====
  lounger() {
    const frame = '#fffaf0', cushion = '#ff8fb8';
    const g = group(
      ...[-.3, .3].flatMap(x => [-.75, .75].map(z => at(cyl(.025, .025, .25, frame, 8), x, .125, z))),
      at(rbox(.7, .06, 1.25, .025, frame), 0, .28, .25), at(rbox(.62, .08, 1.15, .04, cushion), 0, .35, .25),
      ...[-.1, .1, .3, .5, .7].map(z => at(box(.63, .085, .02, '#ffd9e6'), 0, .35, z)));
    const back = group(at(rbox(.7, .06, .65, .025, frame), 0, 0, 0), at(rbox(.62, .08, .58, .04, cushion), 0, .06, 0),
      squash(at(ball(.14, '#fffaf0'), 0, .16, -.18), 1.6, .6, 1));
    back.position.set(0, .48, -.62); back.rotation.x = -.6;
    g.add(back, at(ring(.06, .02, '#ffd66b'), .38, .3, .5).rotateY(Math.PI / 2)); // khăn cuộn treo thành ghế
    g.userData.seat = [0, .4, .25];
    return g;
  },
  // ===== Ghế nằm hồng: khung trắng kem, nệm hồng viền hạt lượn sóng, gối tim =====
  'lounger-pink'() {
    const g = loungerFrame(CREAM_PINK, CREAM_PINK, PINK);
    for (const s of [-1, 1]) g.add(...beads(10, [s * .32, .36, -.3], [s * .32, .36, .8], .035, [PINK_HOT, CREAM_PINK]));
    g.add(...beads(5, [-.28, .36, .84], [.28, .36, .84], .035, [CREAM_PINK, PINK_HOT]));
    g.add(loungerBack(CREAM_PINK, PINK, at(heart(.3, .1, PINK_HOT), 0, .2, -.12).rotateX(-1.1)),
      at(ring(.06, .02, GOLD), .38, .3, .75).rotateY(Math.PI / 2));
    g.userData.seat = [0, .4, .25];
    return g;
  },
  // ===== Ghế nằm neon: đế khối đen liền, nệm xám, viền LED magenta quanh chân đế =====
  'lounger-modern'() {
    const g = group(at(rbox(.66, .3, 1.66, .05, NOIR), 0, .15, .02), at(rbox(.62, .1, 1.15, .04, '#c8ccd2'), 0, .35, .27));
    const back = group(at(rbox(.66, .08, .62, .04, NOIR), 0, 0, 0), at(rbox(.6, .1, .56, .04, '#c8ccd2'), 0, .085, 0));
    back.position.set(0, .45, -.55); back.rotation.x = .55;
    const led = glow(MAGENTA, 1.3);
    g.add(back, at(box(.62, .025, .03, led), 0, .05, .855), ...[-1, 1].map(s => at(box(.03, .025, 1.58, led), s * .335, .05, .02)));
    g.userData.seat = [0, .4, .25];
    return lit(g);
  },

  // ===== Bàn tròn + ô dù sọc + 2 ghế đẩu =====
  parasol() {
    const g = group(at(cyl(.08, .14, .06, '#d9d2c4'), 0, .03, 0), at(cyl(.03, .03, 2.1, '#fffaf0', 10), 0, 1.11, 0),
      at(cyl(.45, .45, .05, '#fffaf0', 28), 0, .72, 0), at(cyl(.06, .1, .66, '#fffaf0', 12), 0, .36, 0));
    // tán dù 8 múi vàng / trắng
    for (let i = 0; i < 8; i++) {
      const slice = mesh(new THREE.ConeGeometry(1.1, .4, 3, 1, false, i * Math.PI / 4, Math.PI / 4), i % 2 ? '#fffaf0' : '#ffd66b');
      g.add(at(slice, 0, 2.05, 0));
    }
    g.add(at(ball(.05, '#ffd66b'), 0, 2.28, 0));
    for (const [x, z] of [[-.75, .1], [.72, -.15]]) g.add(at(cyl(.2, .17, .44, '#8fc9f2', 18), x, .22, z), at(cyl(.21, .21, .05, '#ffffff', 18), x, .465, z));
    // ly nước chanh trên bàn
    g.add(at(cyl(.045, .04, .14, mat('#fff3a0', { transparent: true, opacity: .8 }), 12), .15, .815, .05), at(ball(.025, '#ff6b4a'), .17, .9, .05));
    return g;
  },
  // ===== Ô dù hồng: tán múi hồng / trắng có diềm bèo hạt, bàn trắng viền hạt, ghế nệm hồng, tim trên đỉnh =====
  'parasol-pink'() {
    const g = group(at(cyl(.08, .14, .06, CREAM_PINK), 0, .03, 0), at(cyl(.03, .03, 2.1, CREAM_PINK, 10), 0, 1.11, 0),
      at(cyl(.45, .45, .05, CREAM_PINK, 28), 0, .72, 0), at(cyl(.06, .1, .66, CREAM_PINK, 12), 0, .36, 0),
      ...beadRing(14, .45, .72, .035, [PINK_HOT, CREAM_PINK]));
    for (let i = 0; i < 8; i++) {
      const slice = mesh(new THREE.ConeGeometry(1.1, .4, 3, 1, false, i * Math.PI / 4, Math.PI / 4), i % 2 ? CREAM_PINK : PINK);
      g.add(at(slice, 0, 2.05, 0));
    }
    // diềm bèo quanh mép tán
    g.add(...beadRing(20, 1.03, 1.84, .07, [PINK_HOT, CREAM_PINK]), at(heart(.14, .04, GOLD), 0, 2.31, 0));
    for (const [x, z] of [[-.75, .1], [.72, -.15]]) g.add(at(cyl(.17, .19, .4, CREAM_PINK, 18), x, .2, z), squash(at(ball(.2, PINK), x, .43, z), 1, .35, 1));
    g.add(at(cyl(.045, .04, .14, mat('#ffd0e0', { transparent: true, opacity: .85 }), 12), .15, .815, .05), at(ball(.025, '#e8483a'), .17, .9, .05));
    return g;
  },
  // ===== Mái che năng lượng mặt trời: tấm pin vuông nghiêng trên cột đen, LED cyan dưới mép tấm, bàn vuông + ghế khối =====
  'parasol-modern'() {
    const g = group(at(rbox(.36, .04, .36, .02, NOIR_DARK), 0, .02, 0), at(box(.06, 2.04, .06, NOIR), 0, 1.04, 0),
      at(rbox(.9, .05, .9, .02, NOIR), 0, .72, 0), at(box(.1, .7, .1, GRAPHITE), 0, .35, 0));
    const panel = group(at(rbox(1.9, .05, 1.6, .02, '#1f2a3a'), 0, 0, 0));
    // lưới ô pin: thanh mảnh xuyên tấm, nhô .01 hai mặt
    for (const x of [-.475, 0, .475]) panel.add(at(box(.02, .07, 1.56, '#8a98aa'), x, 0, 0));
    for (const z of [-.4, 0, .4]) panel.add(at(box(1.86, .07, .02, '#8a98aa'), 0, 0, z));
    panel.add(at(box(1.86, .02, .03, glow(CYAN, 1.3)), 0, -.04, .79), at(box(1.86, .02, .03, glow(CYAN, 1.3)), 0, -.04, -.79));
    panel.position.set(0, 2.06, 0); panel.rotation.x = -.15;
    g.add(panel);
    for (const [x, z] of [[-.75, .1], [.72, -.15]]) g.add(at(rbox(.36, .44, .36, .06, GRAPHITE), x, .22, z), at(box(.37, .02, .37, glow(CYAN)), x, .03, z));
    g.add(at(cyl(.045, .04, .14, mat('#bff6ff', { transparent: true, opacity: .8 }), 12), .15, .815, .05));
    return lit(g);
  },

  // ===== Bếp nướng: thân đỏ trên chân, nắp vòm, khay phụ, xiên thịt =====
  grill() {
    const red = '#e8483a', dark = '#2f3238';
    const g = group(...[-.3, .3].flatMap(x => [-.15, .15].map(z => at(cyl(.025, .025, .55, dark, 8), x, .275, z))),
      at(rbox(.72, .04, .34, .015, dark), 0, .25, 0), at(rbox(.8, .3, .44, .06, red), 0, .7, 0),
      squash(at(mesh(new THREE.SphereGeometry(.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red), 0, .85, -.06), 1, .5, .55),
      at(rbox(.3, .04, .4, .015, WOOD), .58, .82, 0), at(cyl(.015, .015, .3, dark, 8), 0, 1.1, -.06).rotateZ(Math.PI / 2));
    // vỉ nướng + xiên rau thịt phía trước
    for (let i = 0; i < 3; i++) g.add(at(cyl(.01, .01, .34, '#c8ccd2', 6), -.2 + i * .2, .87, .14).rotateX(Math.PI / 2),
      ...['#ff6b4a', '#ffd66b', '#6fbf4a'].map((c, k) => at(ball(.035, c), -.2 + i * .2, .9, .05 + k * .08)));
    g.add(at(rbox(.7, .03, .14, .012, '#c8ccd2'), 0, .855, .12));
    return g;
  },
  // ===== Bếp nướng hồng: lò chảo tròn hồng trên ba chân trắng, vành trắng, vỉ + xiên, tay cầm vàng, tim trước =====
  'grill-pink'() {
    const bowl = mesh(new THREE.SphereGeometry(.34, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), PINK_HOT);
    bowl.userData.noOutline = true;
    const g = group(...[0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2 + Math.PI / 2; return at(cyl(.025, .025, .55, CREAM_PINK, 8), Math.cos(a) * .2, .275, Math.sin(a) * .2); }),
      at(bowl, 0, .74, 0), at(ring(.34, .025, CREAM_PINK), 0, .74, 0).rotateX(Math.PI / 2),
      at(cyl(.31, .31, .012, '#c8ccd2', 24), 0, .75, 0), at(ball(.05, GOLD), -.38, .74, 0), at(ball(.05, GOLD), .38, .74, 0),
      at(heart(.16, .03, CREAM_PINK), 0, .6, .31).rotateX(-.4));
    for (let i = 0; i < 3; i++) g.add(...['#ff6b4a', '#ffd66b', '#6fbf4a'].map((c, k) => at(ball(.035, c), -.15 + i * .15, .79, -.1 + k * .09)));
    return g;
  },
  // ===== Bếp nướng thông minh: tủ đen, mặt thép, nắp đóng tay nắm thép, màn hình LED cyan + dải LED trước =====
  'grill-modern'() {
    const g = group(at(rbox(.8, .66, .45, .04, NOIR), 0, .37, 0), ...[-1, 1].flatMap(s => [-1, 1].map(t => at(box(.06, .04, .06, NOIR_DARK), s * .34, .02, t * .17))),
      at(rbox(.82, .04, .47, .015, '#c8ccd2'), 0, .72, 0), at(rbox(.78, .18, .43, .06, NOIR_DARK), 0, .83, 0),
      at(cyl(.015, .015, .5, chrome(), 8), 0, .86, .225).rotateZ(Math.PI / 2), at(rbox(.26, .03, .4, .015, '#c8ccd2'), .53, .72, 0),
      // màn hình cách mặt tủ .005
      at(box(.3, .12, .01, glow(CYAN, 1.2)), -.15, .5, .235), at(box(.76, .02, .02, glow(CYAN)), 0, .66, .22),
      ...[.12, .26].map(x => at(cyl(.03, .03, .03, '#c8ccd2', 12), x, .5, .235).rotateX(Math.PI / 2)));
    return lit(g);
  },

  // ===== Hòm đồ bơi: hòm gỗ nắp cong, phao vịt + bóng biển trên nắp =====
  deckbox() {
    const g = group(at(rbox(.9, .45, .5, .05, '#8fc9f2'), 0, .225, 0), ...[-.3, 0, .3].map(x => at(box(.05, .43, .52, '#7ab8e0'), x, .225, 0)),
      squash(at(cyl(.25, .25, .92, '#fffaf0', 24), 0, .45, 0).rotateZ(Math.PI / 2), 1, .3, 1),
      at(rbox(.16, .06, .03, .012, '#2f3238'), 0, .34, .26));
    // phao vịt vàng
    g.add(at(ring(.17, .07, '#ffd66b'), -.18, .6, 0).rotateX(Math.PI / 2), at(ball(.08, '#ffd66b'), -.18, .72, -.16), at(cone(.04, .08, '#ff8a2a', 8), -.18, .72, -.26).rotateX(-Math.PI / 2));
    // bóng biển sọc
    const beach = ball(.15, '#ffffff');
    g.add(at(beach, .25, .69, .02), at(ring(.151, .025, '#e8483a'), .25, .69, .02), at(ring(.151, .025, '#5fc8e8'), .25, .69, .02).rotateY(Math.PI / 2));
    return g;
  },
  // ===== Hòm đồ chơi hồng: thân hồng chấm bi, nắp trắng viền hạt, tim vàng trước, phao tim + bóng =====
  'deckbox-pink'() {
    const g = group(at(rbox(.9, .45, .5, .06, PINK), 0, .225, 0), at(rbox(.94, .06, .54, .03, CREAM_PINK), 0, .48, 0),
      ...beads(8, [-.42, .46, .27], [.42, .46, .27], .03, [PINK_HOT, CREAM_PINK]),
      at(heart(.18, .03, GOLD), 0, .27, .26),
      ...[[-.3, .32], [-.22, .12], [.24, .34], [.32, .14]].map(([x, y]) => at(ball(.035, CREAM_PINK), x, y, .235)));
    g.add(at(heart(.36, .06, PINK_HOT), -.18, .56, 0).rotateX(-Math.PI / 2), at(ball(.14, CREAM_PINK), .25, .65, .02), at(ring(.141, .025, PINK_HOT), .25, .65, .02));
    return g;
  },
  // ===== Tủ thông minh: thân đen, nắp trắng phẳng, dải LED cyan dưới nắp, màn nhỏ + tay nắm âm =====
  'deckbox-modern'() {
    const g = group(at(rbox(.9, .44, .5, .04, NOIR), 0, .22, 0), at(rbox(.92, .05, .52, .02, STEEL), 0, .465, 0),
      at(box(.86, .02, .02, glow(CYAN, 1.3)), 0, .425, .245), at(box(.12, .06, .01, glow(CYAN)), .3, .3, .26),
      at(rbox(.3, .03, .03, .012, GRAPHITE), 0, .34, .255));
    // khăn gấp xám trên nắp
    g.add(at(rbox(.34, .08, .26, .03, '#c8ccd2'), -.16, .53, 0), at(rbox(.3, .06, .22, .025, GRAPHITE), -.16, .6, 0));
    return lit(g);
  },

  // ===== Nhà kính lớn: khung trắng, vách + mái kính hai mái, cửa trước, kệ hai tầng + cây to bên trong — 3 × 2.2 m =====
  greenhouse() {
    const W = 3, D = 2.2, H = 1.8, RISE = .8, frame = '#fffaf0', post = .07, xs = [-1.5, -.5, .5, 1.5];
    const g = group(at(rbox(W + .1, .12, D + .1, .05, '#d9d2c4'), 0, .06, 0));
    for (const x of xs) for (const z of [-D / 2, D / 2]) g.add(at(box(post, H, post, frame), x, .12 + H / 2, z));
    g.add(at(box(post, H, post, frame), -W / 2, .12 + H / 2, 0), at(box(post, H, post, frame), W / 2, .12 + H / 2, 0));
    // xà ngang dưới + giữa + trên
    for (const y of [.15, .12 + H * .45, .12 + H]) {
      g.add(at(box(W + post, post, post, frame), 0, y, -D / 2), at(box(W + post, post, post, frame), 0, y, D / 2),
        at(box(post, post, D, frame), -W / 2, y, 0), at(box(post, post, D, frame), W / 2, y, 0));
    }
    // vách kính lùi vào trong khung .045 (không chạm xà / cột)
    const mid = .12 + H / 2;
    g.add(at(glassPane(W - .1, H - .1, .01), 0, mid, -D / 2 + .045), at(glassPane(W - .1, H - .1, .01), 0, mid, D / 2 - .045),
      at(glassPane(.01, H - .1, D - .1), -W / 2 + .045, mid, 0), at(glassPane(.01, H - .1, D - .1), W / 2 - .045, mid, 0));
    // mái hai mái
    const slope = Math.atan2(RISE, D / 2), len = Math.hypot(RISE, D / 2);
    for (const s of [-1, 1]) {
      const roof = group(at(glassPane(W - .1, .01, len - .1), 0, 0, 0), at(box(W + post, post, post, frame), 0, 0, s * (len / 2)));
      for (const x of xs) roof.add(at(box(post, post, len, frame), x, .04, 0));
      roof.position.set(0, .12 + H + RISE / 2, s * D / 4); roof.rotation.x = s * slope;
      g.add(roof);
    }
    g.add(at(box(W + post * 2, post, post, frame), 0, .12 + H + RISE, 0), at(ball(.06, '#ff8fb8'), -W / 2 - .02, .12 + H + RISE + .04, 0), at(ball(.06, '#ff8fb8'), W / 2 + .02, .12 + H + RISE + .04, 0));
    // cửa trước (giữa, khung hồng ngoài vách kính) + tay nắm
    g.add(at(box(post, H - .05, post, '#ff8fb8'), -.4, .12 + (H - .05) / 2, D / 2 + .06), at(box(post, H - .05, post, '#ff8fb8'), .4, .12 + (H - .05) / 2, D / 2 + .06),
      at(box(.87, post, post, '#ff8fb8'), 0, .12 + H - .05, D / 2 + .06), at(ball(.035, '#ffd66b'), .3, .95, D / 2 + .11));
    // kệ gỗ hai tầng dọc vách sau, chậu cây
    for (const y of [.55, 1.0]) g.add(at(rbox(W - .5, .05, .42, .02, WOOD), 0, y, -D / 2 + .32));
    g.add(...[-1.1, 0, 1.1].map(x => at(box(.05, .9, .05, WOOD_DARK), x, .57, -D / 2 + .32)));
    const pots = ['#e98b5a', '#ffd9c4', '#c98a55', '#e98b5a', '#ffd9c4'];
    for (const [y, row] of [[.55, 0], [1.0, 1]]) pots.forEach((pot, i) => {
      const x = -1.05 + i * .52 + row * .1;
      g.add(at(cyl(.1, .075, .16, pot, 12), x, y + .105, -D / 2 + .32), at(ball(.11 + ((i + row) % 2) * .04, (i + row) % 2 ? LEAF : '#7fc45a'), x, y + .26, -D / 2 + .32));
      if ((i + row) % 2 === 0) g.add(at(ball(.04, (i + row) % 4 ? '#ffd66b' : '#ff6b4a'), x + .07, y + .32, -D / 2 + .38));
    });
    // cây to trong chậu góc trước-trái + chậu dương xỉ góc trước-phải
    g.add(at(cyl(.22, .18, .4, '#c98a55', 16), -1.05, .32, .55), at(ball(.32, LEAF), -1.05, .82, .55), at(ball(.24, LEAF_DARK), -.9, 1.1, .45), at(ball(.2, '#6fbf4a'), -1.18, 1.18, .62),
      at(cyl(.18, .15, .3, '#e98b5a', 16), 1.05, .27, .55));
    for (let k = 0; k < 5; k++) { const a = k * 1.26; g.add(at(cone(.08, .5, '#5fae46', 6), 1.05 + Math.cos(a) * .12, .62, .55 + Math.sin(a) * .12).rotateZ(Math.cos(a) * -.5)); }
    return g;
  },
  // ===== Nhà kính hồng: khung trắng kem, cửa hồng, tim trên cửa, kệ trắng chậu hồng hoa, bụi hồng to =====
  'greenhouse-pink'() {
    const g = greenhouseShell(CREAM_PINK, PINK_HOT, GOLD, GOLD);
    greenhouseShelves(g, CREAM_PINK, PINK, [PINK, CREAM_PINK, '#e6d4ff', PINK, CREAM_PINK], [LEAF, '#7fc45a'], [PINK_HOT, GOLD, '#e6d4ff']);
    g.add(at(heart(.3, .05, PINK_HOT), 0, 1.98, GH.D / 2 + .1));
    // bụi hồng to + chậu hoa tulip
    g.add(at(cyl(.22, .18, .4, PINK, 16), -1.05, .32, .55), at(ball(.32, LEAF), -1.05, .82, .55), at(ball(.22, LEAF_DARK), -.9, 1.08, .45),
      ...[[-1.25, .9, .7], [-.85, .95, .75], [-1.05, 1.12, .7], [-.8, 1.22, .5], [-1.3, 1.1, .45]].map(([x, y, z], i) => at(ball(.07, i % 2 ? PINK_HOT : CREAM_PINK), x, y, z)),
      at(cyl(.18, .15, .3, CREAM_PINK, 16), 1.05, .27, .55),
      ...[[0, 0], [.1, .06], [-.09, .07], [.04, -.1]].flatMap(([dx, dz], i) => [at(cyl(.012, .012, .3, LEAF, 6), 1.05 + dx, .55, .55 + dz),
        at(cone(.05, .1, i % 2 ? PINK_HOT : '#e6d4ff', 8), 1.05 + dx, .73, .55 + dz).rotateX(Math.PI)]));
    return g;
  },
  // ===== Nhà kính vòm: vòm kính bầu dục trên đế đen, sườn graphite, đèn trồng cây tím, bồn cây trắng =====
  'greenhouse-modern'() {
    const R = 1.45, g = group(squash(at(cyl(R + .04, R + .06, .12, NOIR, 32), 0, .06, 0), 1, 1, .74));
    const dome = mesh(new THREE.SphereGeometry(R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d8f1f8', { transparent: true, opacity: .3 }));
    dome.castShadow = false;
    dome.userData.noOutline = true;
    // vòm + sườn chung một lớp co giãn (rộng 2.9 × sâu 2.15 × cao 1.9)
    const shell = group(dome, at(ring(R, .035, GRAPHITE), 0, 0, 0).rotateX(Math.PI / 2));
    for (let k = 0; k < 4; k++) shell.add(mesh(new THREE.TorusGeometry(R, .035, 8, 32, Math.PI), GRAPHITE).rotateY(k * Math.PI / 4));
    shell.scale.set(1, 1.3, .74); shell.position.y = .12;
    g.add(shell);
    // đèn trồng cây treo dưới đỉnh vòm
    g.add(at(box(1.4, .05, .14, NOIR_DARK), 0, 1.62, 0), at(box(1.34, .02, .1, glow(VIOLET, 1.4)), 0, 1.585, 0),
      ...[-.6, .6].map(x => at(cyl(.008, .008, .18, NOIR_DARK, 6), x, 1.73, 0)));
    // bồn cây trắng hai dãy, cây xanh
    for (const z of [-.4, .3]) {
      g.add(at(rbox(1.8, .36, .4, .05, STEEL), 0, .3, z));
      for (let i = 0; i < 5; i++) g.add(at(ball(.13 + (i % 2) * .03, i % 2 ? LEAF : '#7fc45a'), -.72 + i * .36, .58, z));
    }
    // khung cửa trước
    g.add(...[-.4, .4].map(x => at(box(.06, 1.25, .06, GRAPHITE), x, .745, 1.0)), at(box(.86, .06, .06, GRAPHITE), 0, 1.37, 1.0),
      at(box(.74, .02, .02, glow(CYAN)), 0, 1.33, 1.035));
    return lit(g);
  },

  // ===== Luống cà chua lớn: bồn gỗ nâng 3 × 1, đất, 6 cây cà chua có cọc =====
  vegbed() {
    const Dd = 1, Hb = .4;
    const g = raisedBed(WOOD, SOIL);
    [-1.15, -.7, -.25, .2, .65, 1.1].forEach((x, i) => g.add(tomatoPlant(x, i % 2 ? .15 : -.15, i, Hb - .02)));
    // biển tên luống
    g.add(at(rbox(.42, .08, .04, .015, '#f3e6cc'), -1.1, .62, Dd / 2 + .05), at(cyl(.014, .014, .3, WOOD_DARK, 6), -1.1, .45, Dd / 2 + .05));
    return g;
  },
  // ===== Luống dâu: bồn hồng viền hạt trắng, bụi dâu thấp quả đỏ + hoa trắng, biển tim =====
  'vegbed-pink'() {
    const Hb = .4, g = raisedBed(PINK, SOIL);
    for (const s of [-1, 1]) g.add(...beads(15, [-1.45, Hb, s * .5], [1.45, Hb, s * .5], .045, [CREAM_PINK, PINK_HOT]));
    [-1.1, -.55, 0, .55, 1.1].forEach((x, i) => {
      for (const z of [-.18, .18]) {
        const dx = (i % 2 ? .08 : -.08) * Math.sign(z);
        g.add(squash(at(ball(.16, LEAF), x + dx, Hb + .06, z), 1, .6, 1), at(ball(.045, '#e8483a'), x + dx + .1, Hb + .08, z + .08),
          at(ball(.04, '#ff5a4a'), x + dx - .09, Hb + .1, z - .06), at(ball(.03, '#ffffff'), x + dx, Hb + .16, z));
      }
    });
    g.add(at(heart(.3, .04, PINK_HOT), -1.1, .66, .56), at(cyl(.014, .014, .3, CREAM_PINK, 6), -1.1, .45, .55));
    return g;
  },
  // ===== Luống thuỷ canh: giá đen, hai ống trắng nằm ngang có cây, bể chứa dưới, thanh đèn LED tím trên cao =====
  'vegbed-modern'() {
    const g = group(...[-1.35, 1.35].flatMap(x => [-.35, .35].map(z => at(box(.06, .55, .06, NOIR), x, .275, z))),
      ...[-1.35, 1.35].map(x => at(box(.06, .06, .76, NOIR), x, .52, 0)), at(rbox(2.4, .22, .5, .05, GRAPHITE), 0, .11, 0));
    for (const z of [-.22, .22]) {
      g.add(at(cyl(.08, .08, 2.8, STEEL, 16), 0, .6, z).rotateZ(Math.PI / 2), ...[-1.4, 1.4].map(x => at(cyl(.09, .09, .04, GRAPHITE, 16), x, .6, z).rotateZ(Math.PI / 2)));
      for (let i = 0; i < 7; i++) g.add(at(cyl(.05, .04, .05, NOIR, 10), -1.2 + i * .4, .69, z), at(ball(.11, i % 2 ? LEAF : '#7fc45a'), -1.2 + i * .4, .8, z));
    }
    // thanh đèn tím trên hai cột
    g.add(...[-1.42, 1.42].map(x => at(box(.05, 1.3, .05, NOIR), x, .65, 0)), at(box(2.9, .05, .12, NOIR_DARK), 0, 1.3, 0),
      at(box(2.8, .02, .08, glow(VIOLET, 1.4)), 0, 1.26, 0));
    return lit(g);
  },

  // ===== Luống rau củ hai bên lối đá: gốc model nằm giữa lối, mỗi bên một luống đất xới 2.8 × 1.4 (lối đá ở giữa để trống) =====
  //   bên -z (phía vườn): 2 hàng cà rốt + hàng bắp cải; bên +z (phía tường nhà): hàng xà lách + cà rốt + bí ngô to.
  veggies() {
    const g = group(), N = -1.2, S = 1.35;
    for (const z of [N, S]) g.add(at(rbox(2.8, .12, 1.4, .05, SOIL), 0, .06, z));
    for (const dz of [-.45, -.2]) for (let i = 0; i < 8; i++) g.add(carrot(-1.15 + i * .3 + (dz > -.3 ? .15 : 0), N + dz));
    [-1.0, -.35, .3, .95].forEach(x => g.add(cabbage(x, N + .32)));
    [-1.1, -.6, -.1, .4, .9].forEach(x => g.add(squash(at(ball(.12, '#c9e8a0'), x, .17, S - .38), 1, .7, 1), squash(at(ball(.08, '#e8f5c8'), x, .2, S - .38), 1, .7, 1)));
    for (let i = 0; i < 5; i++) g.add(carrot(-1.15 + i * .3, S + .05));
    g.add(pumpkin(.6, S + .1), pumpkin(1.05, S + .4), pumpkin(-.9, S + .4));
    return g;
  },
  // ===== Luống củ cải hồng: hai luống đất viền hạt trắng / hồng, hàng củ cải hồng lá xanh, tulip hồng =====
  'veggies-pink'() {
    const g = group(), N = -1.2, S = 1.35;
    const radish = (x, z) => group(at(ball(.07, PINK_HOT), x, .15, z), ...[-.4, 0, .4].map(a => at(cone(.03, .22, '#6fbf4a', 5), x + Math.sin(a) * .04, .28, z).rotateZ(a)));
    for (const z of [N, S]) {
      g.add(at(rbox(2.8, .12, 1.4, .05, SOIL), 0, .06, z));
      for (const s of [-1, 1]) g.add(...beads(12, [-1.3, .12, z + s * .7], [1.3, .12, z + s * .7], .045, [CREAM_PINK, PINK]));
      for (const dz of [-.25, .25]) for (let i = 0; i < 7; i++) g.add(radish(-1.05 + i * .35 + (dz > 0 ? .17 : 0), z + dz));
    }
    // tulip hồng / lilac rải góc luống
    g.add(...[[-1.25, N + .55], [1.25, N - .55], [1.25, S + .55], [-1.25, S - .55]].flatMap(([x, z], i) => [at(cyl(.012, .012, .3, LEAF, 6), x, .27, z),
      at(cone(.05, .1, i % 2 ? '#e6d4ff' : PINK_HOT, 8), x, .45, z).rotateX(Math.PI)]));
    return g;
  },
  // ===== Luống rau đèn: luống viền thép đen, hàng xà lách, cột đèn thấp ánh tím =====
  'veggies-modern'() {
    const g = group(), N = -1.2, S = 1.35;
    for (const z of [N, S]) {
      g.add(at(rbox(2.8, .12, 1.4, .05, '#4a3a2c'), 0, .06, z), ...[-1, 1].map(s => at(box(2.84, .16, .05, NOIR), 0, .08, z + s * .71)));
      for (const dz of [-.35, 0, .35]) for (let i = 0; i < 6; i++) g.add(squash(at(ball(.13, i % 2 ? '#7fc45a' : '#a8d880'), -1.0 + i * .4, .17, z + dz), 1, .65, 1));
      for (const x of [-1.25, 0, 1.25]) g.add(at(cyl(.04, .05, .35, NOIR, 10), x, .175, z - .6), at(cyl(.045, .045, .04, glow(VIOLET, 1.4), 10), x, .37, z - .6));
    }
    return lit(g);
  },

  // ===== Bù nhìn: cột chữ thập, áo kẻ, đầu bao bố, mũ rơm, quạ đậu trên tay =====
  scarecrow() {
    const g = scaled(1.35, at(cyl(.04, .05, 1.6, WOOD_DARK, 8), 0, .8, 0), at(cyl(.035, .035, 1.1, WOOD_DARK, 8), 0, 1.2, 0).rotateZ(Math.PI / 2),
      at(rbox(.46, .5, .26, .08, '#e8617f'), 0, 1.05, 0), at(box(.47, .04, .27, '#c94a63'), 0, .92, 0),
      at(rbox(.9, .14, .16, .06, '#e8617f'), 0, 1.2, 0),
      at(ball(.17, '#e9c58f'), 0, 1.5, 0), at(ball(.02, '#2f2b2d'), -.06, 1.52, .16), at(ball(.02, '#2f2b2d'), .06, 1.52, .16),
      at(cyl(.3, .3, .02, '#f2c14e', 20), 0, 1.62, 0), at(cyl(.12, .15, .18, '#f2c14e', 14), 0, 1.72, 0), at(cyl(.155, .155, .04, '#e8483a', 14), 0, 1.66, 0));
    // rơm thò ra ở tay áo
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.children[0].add(at(cone(.025, .12, '#f2c14e', 5), s * (.5 + k * .01), 1.2 + (k - 1) * .04, 0).rotateZ(-s * Math.PI / 2));
    // quạ nhỏ đậu tay phải
    g.children[0].add(squash(at(ball(.07, '#2f2b2d'), .42, 1.33, 0), 1.3, 1, 1), at(ball(.045, '#2f2b2d'), .5, 1.38, 0), at(cone(.02, .05, '#f2c14e', 6), .55, 1.38, 0).rotateZ(-Math.PI / 2));
    g.userData.sink = .05 * 1.35;
    return g;
  },
  // ===== Bù nhìn hồng: áo + váy xoè hồng, tim trên ngực, bím tóc rơm, mũ rơm nơ hồng, chim hồng trên tay =====
  'scarecrow-pink'() {
    const g = scaled(1.35, ...scarecrowPole(CREAM_PINK),
      at(rbox(.4, .36, .24, .08, PINK), 0, 1.12, 0), at(cone(.34, .42, PINK_HOT, 16), 0, .78, 0),
      ...beadRing(12, .33, .58, .035, [CREAM_PINK]),
      at(rbox(.9, .14, .16, .06, PINK), 0, 1.2, 0), at(heart(.12, .03, CREAM_PINK), 0, 1.1, .135),
      at(ball(.17, '#e9c58f'), 0, 1.5, 0), at(ball(.02, '#2f2b2d'), -.06, 1.52, .16), at(ball(.02, '#2f2b2d'), .06, 1.52, .16),
      at(ball(.025, PINK_HOT), -.1, 1.47, .14), at(ball(.025, PINK_HOT), .1, 1.47, .14),
      ...[-1, 1].map(s => at(cyl(.025, .02, .3, '#f2c14e', 6), s * .16, 1.38, -.02).rotateZ(s * .2)),
      at(cyl(.3, .3, .02, '#f2c14e', 20), 0, 1.62, 0), at(cyl(.12, .15, .18, '#f2c14e', 14), 0, 1.72, 0), at(cyl(.155, .155, .04, PINK_HOT, 14), 0, 1.66, 0),
      // nơ trên vành mũ
      at(cone(.06, .12, PINK_HOT, 8), .1, 1.68, .15).rotateZ(Math.PI / 2), at(cone(.06, .12, PINK_HOT, 8), -.06, 1.68, .15).rotateZ(-Math.PI / 2), at(ball(.03, GOLD), .02, 1.68, .155));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.children[0].add(at(cone(.025, .12, '#f2c14e', 5), s * (.5 + k * .01), 1.2 + (k - 1) * .04, 0).rotateZ(-s * Math.PI / 2));
    g.children[0].add(squash(at(ball(.07, '#ffe0e9'), .42, 1.33, 0), 1.3, 1, 1), at(ball(.045, '#ffe0e9'), .5, 1.38, 0), at(cone(.02, .05, GOLD, 6), .55, 1.38, 0).rotateZ(-Math.PI / 2));
    g.userData.sink = .05 * 1.35;
    return g;
  },
  // ===== Bù nhìn robot: cột + tay graphite, thân hộp đen dải LED, đầu hộp mắt LED cyan, ăng-ten đèn magenta, tấm pin ở tay =====
  'scarecrow-modern'() {
    const g = scaled(1.35, ...scarecrowPole(GRAPHITE),
      at(rbox(.44, .5, .28, .06, NOIR), 0, 1.05, 0), at(box(.3, .03, .02, glow(CYAN)), 0, 1.0, .145),
      at(rbox(.9, .1, .14, .04, GRAPHITE), 0, 1.2, 0), ...[-1, 1].map(s => at(rbox(.18, .02, .14, .01, '#1f2a3a'), s * .5, 1.27, 0)),
      at(rbox(.32, .26, .28, .06, NOIR_DARK), 0, 1.5, 0), at(box(.07, .035, .02, glow(CYAN, 1.4)), -.07, 1.52, .155), at(box(.07, .035, .02, glow(CYAN, 1.4)), .07, 1.52, .155),
      at(cyl(.012, .012, .18, GRAPHITE, 6), 0, 1.72, 0), at(ball(.035, glow(MAGENTA, 1.4)), 0, 1.82, 0));
    g.userData.sink = .05 * 1.35;
    return lit(g);
  },

  // ===== Thùng nước mưa: thùng gỗ đai sắt, nắp, vòi, bình tưới bên cạnh =====
  rainbarrel() {
    const g = scaled(1.35, at(cyl(.34, .3, .8, WOOD, 20), 0, .4, 0),
      ...[.15, .65].map(y => at(ring(.335 - (y < .4 ? .025 : 0), .02, '#6b7078'), 0, y, 0).rotateX(Math.PI / 2)),
      at(cyl(.36, .36, .04, WOOD_DARK, 20), 0, .82, 0), at(cyl(.04, .04, .06, '#6b7078', 8), 0, .87, 0),
      at(cyl(.025, .025, .12, '#c8ccd2', 8), 0, .2, .35).rotateX(Math.PI / 2), at(ball(.03, '#c8ccd2'), 0, .2, .41));
    // bình tưới xanh cạnh thùng
    g.children[0].add(at(cyl(.12, .13, .24, '#5fc8e8', 16), .5, .12, .1), at(cyl(.02, .025, .3, '#5fc8e8', 8), .68, .26, .1).rotateZ(-.9),
      at(cyl(.045, .03, .04, '#5fc8e8', 10), .8, .36, .1), at(ring(.08, .015, '#5fc8e8'), .44, .3, .1));
    return g;
  },
  // ===== Thùng nước mưa hồng: thùng hồng đai trắng, tim trước, nắp trắng có chậu hoa, bình tưới hồng =====
  'rainbarrel-pink'() {
    const g = scaled(1.35, at(cyl(.34, .3, .8, PINK, 20), 0, .4, 0),
      ...[.15, .65].map(y => at(ring(.335 - (y < .4 ? .025 : 0), .02, CREAM_PINK), 0, y, 0).rotateX(Math.PI / 2)),
      at(heart(.2, .04, PINK_HOT), 0, .42, .33),
      at(cyl(.36, .36, .04, CREAM_PINK, 20), 0, .82, 0), at(cyl(.1, .08, .1, PINK_HOT, 12), .1, .89, 0),
      ...[[.06, .02], [.14, -.03], [.1, .06]].map(([x, z], i) => at(ball(.045, i % 2 ? CREAM_PINK : '#e6d4ff'), x, .97, z)),
      at(cyl(.025, .025, .12, GOLD, 8), 0, .2, .35).rotateX(Math.PI / 2), at(ball(.03, GOLD), 0, .2, .41));
    g.children[0].add(at(cyl(.12, .13, .24, PINK_HOT, 16), .5, .12, .1), at(cyl(.02, .025, .3, PINK_HOT, 8), .68, .26, .1).rotateZ(-.9),
      at(cyl(.045, .03, .04, PINK_HOT, 10), .8, .36, .1), at(ring(.08, .015, PINK_HOT), .44, .3, .1));
    return g;
  },
  // ===== Bồn nước thông minh: bồn trắng trên đế đen, nắp graphite, cột LED báo mực nước cyan, màn nhỏ, vòi thép =====
  'rainbarrel-modern'() {
    const g = scaled(1.35, at(rbox(.66, .08, .66, .04, NOIR), 0, .04, 0), at(cyl(.3, .3, .74, STEEL, 24), 0, .45, 0),
      at(cyl(.31, .31, .06, GRAPHITE, 24), 0, .85, 0), at(box(.04, .45, .03, glow(CYAN, 1.3)), 0, .45, .305),
      at(box(.14, .07, .03, GRAPHITE), .14, .7, .28), at(box(.1, .04, .01, glow(CYAN)), .14, .7, .305),
      at(cyl(.025, .025, .12, '#c8ccd2', 8), -.14, .2, .32).rotateX(Math.PI / 2), at(ball(.03, '#c8ccd2'), -.14, .2, .38));
    // bình tưới đen dáng thẳng
    g.children[0].add(at(rbox(.2, .24, .14, .04, GRAPHITE), .5, .12, .1), at(cyl(.02, .02, .28, GRAPHITE, 8), .66, .25, .1).rotateZ(-.9));
    return lit(g);
  },
};
