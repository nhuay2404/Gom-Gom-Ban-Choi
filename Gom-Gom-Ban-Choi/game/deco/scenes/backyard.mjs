// Sân sau (phía sau phòng khách + bếp, cửa từ phòng tắm): bể bơi + vườn rau. 10 món gốc cho Deco — bể bơi, ghế nằm, bàn ô dù,
// bếp nướng, hòm đồ bơi, nhà kính, luống cà chua, luống rau củ, bù nhìn, thùng nước mưa (mỗi món thêm 2 kiểu khác ở cuối file) — cùng hàng rào
// hai cạnh ngoài (sau + phải; cạnh trước là tường nhà, cạnh trái là tường phòng tắm) và lối đá từ cửa phòng tắm.
// Cùng kiểu dựng với bathroom.mjs: khối bo tròn, màu pastel, viền toon. Mỗi món có chỗ đặt cố định [x, z, xoay?]
// (room-layout.mjs PLACES, toạ độ khu backyard); +z của món là mặt trước. Chưa có tương tác mèo (room-cats.mjs BACKYARD_TOYS rỗng).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from '../render/mesh-detail.mjs';
import { ROOM_HALF, BACKYARD_DOOR, backyardBounds } from '../room-layout.mjs';
import { TOON, toonMat } from '../render/toon.mjs';
import { rock } from './garden.mjs';
import { windAt } from './garden-expanded.mjs';

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
// Thời gian giữa hai lần update của một món (update(t) chỉ nhận t).
const ticker = () => { let last = 0; return t => { const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t; return dt; }; };
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

  // ===== Ghế nằm phơi nắng (dài 1.8 theo z, tựa lưng ở -z) =====
  lounger() {
    const frame = '#fffaf0', cushion = '#ff8fb8';
    const g = group(
      ...[-.3, .3].flatMap(x => [-.75, .75].map(z => at(cyl(.025, .025, .25, frame, 8), x, .125, z))),
      at(rbox(.7, .06, 1.25, .025, frame), 0, .28, .25), at(rbox(.62, .08, 1.15, .04, cushion), 0, .35, .25),
      ...[-.1, .1, .3, .5, .7].map(z => at(box(.63, .085, .02, '#ffd9e6'), 0, .355, z)));
    const back = group(at(rbox(.7, .06, .65, .025, frame), 0, 0, 0), at(rbox(.62, .08, .58, .04, cushion), 0, .06, 0),
      squash(at(ball(.14, '#fffaf0'), 0, .16, -.18), 1.6, .6, 1));
    back.position.set(0, .48, -.62); back.rotation.x = -.6;
    g.add(back, at(ring(.06, .02, '#ffd66b'), .38, .3, .5).rotateY(Math.PI / 2)); // khăn cuộn treo thành ghế
    g.userData.seat = [0, .4, .25];
    return g;
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

  // ===== Luống cà chua lớn: bồn gỗ nâng 3 × 1, đất, 6 cây cà chua có cọc =====
  vegbed() {
    const L = 3, Dd = 1, Hb = .4;
    const g = group(at(rbox(L, Hb, .12, .05, WOOD), 0, Hb / 2, Dd / 2 - .06), at(rbox(L, Hb, .12, .05, WOOD), 0, Hb / 2, -Dd / 2 + .06),
      at(rbox(.12, Hb, Dd - .24, .05, WOOD), L / 2 - .06, Hb / 2, 0), at(rbox(.12, Hb, Dd - .24, .05, WOOD), -L / 2 + .06, Hb / 2, 0),
      at(box(L - .25, .04, Dd - .25, SOIL), 0, Hb - .04, 0));
    [-1.15, -.7, -.25, .2, .65, 1.1].forEach((x, i) => g.add(tomatoPlant(x, i % 2 ? .15 : -.15, i, Hb - .02)));
    g.add(at(rbox(.42, .08, .04, .015, '#fffaf0'), -1.1, .62, Dd / 2 + .05), at(cyl(.014, .014, .3, WOOD_DARK, 6), -1.1, .45, Dd / 2 + .05)); // biển tên luống
    return g;
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
};

// ---------- Hai lựa chọn thêm cho mỗi chỗ ở sân sau (cùng khuôn khổ với món gốc) ----------
// Ống tròn chạy theo elip (rx × rz) ở độ cao y: phao bơm hơi, viền ao.
const ovalTube = (rx, rz, y, tube, color) => {
  const pts = [...Array(48)].map((_, k) => { const a = k / 48 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * rx, y, Math.sin(a) * rz); });
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, tube, 10, true), color);
};
// Đĩa elip phẳng (mặt nước / đáy) dày h, đỉnh ở y.
const ovalDisk = (rx, rz, h, y, color) => squash(at(cyl(1, 1, h, color, 40), 0, y - h / 2, 0), rx, 1, rz);
// Bồn gỗ nâng 3 × 1 dùng chung cho các luống (như luống cà chua gốc).
function raisedBed(color, soil = SOIL) {
  const L = 3, Dd = 1, Hb = .4;
  return [at(rbox(L, Hb, .12, .05, color), 0, Hb / 2, Dd / 2 - .06), at(rbox(L, Hb, .12, .05, color), 0, Hb / 2, -Dd / 2 + .06),
    at(rbox(.12, Hb, Dd - .24, .05, color), L / 2 - .06, Hb / 2, 0), at(rbox(.12, Hb, Dd - .24, .05, color), -L / 2 + .06, Hb / 2, 0),
    at(box(L - .25, .04, Dd - .25, soil), 0, Hb - .04, 0)];
}
const flame = (x, y, z, h, r, c, e) => { const f = at(mesh(new THREE.ConeGeometry(r, h, 10), mat(c, { emissive: e, emissiveIntensity: 1.3 })), x, y + h / 2, z); f.castShadow = false; return f; };

Object.assign(BACKYARD_BUILD, {
  // ===== Bể bơi phao: ba vòng phao bơm hơi xanh / trắng hình elip, nước trong, vịt + phao tròn + bóng =====
  'pool-inflatable'() {
    const RX = 2.05, RZ = 1.08, T = .17;
    const g = group(ovalDisk(RX + .05, RZ + .05, .03, .03, '#8fc9f2'), ovalTube(RX, RZ, T, T, '#5fb8e8'), ovalTube(RX, RZ, T * 3, T, '#ffffff'), ovalTube(RX, RZ, T * 5, T, '#5fb8e8'),
      ovalDisk(RX - T * .9, RZ - T * .9, .03, T * 5 - .06, mat('#5fc8e8', { transparent: true, opacity: .88 })),
      at(ring(.22, .08, '#ffd66b'), .9, T * 5 - .02, .1).rotateX(Math.PI / 2), at(ball(.14, '#ff6b4a'), -.9, T * 5 + .06, -.2),
      squash(at(ball(.1, '#ffd23f'), -.2, T * 5 - .02, .35), 1.2, .8, 1), at(ball(.065, '#ffd23f'), -.12, T * 5 + .07, .35));
    return g;
  },
  // ===== Ao sen: bờ đá tảng, mặt nước xanh, lá sen + hoa hồng, ếch xanh trên lá, lau sậy một góc =====
  'pool-lily'() {
    const RX = 2.1, RZ = 1.15;
    const g = group(ovalDisk(RX, RZ, .04, .04, '#3f8f9e'), ovalDisk(RX - .05, RZ - .05, .03, .1, mat('#5fb8c8', { transparent: true, opacity: .85 })));
    for (let k = 0; k < 26; k++) {
      const a = k / 26 * Math.PI * 2, s = squash(rock(.17 + (k % 3) * .04, k % 2 ? '#b5aea3' : '#c8c2b8', k * 5.1 + 2), 1.3, .7, 1);
      s.position.set(Math.cos(a) * (RX + .05), .06, Math.sin(a) * (RZ + .05)); s.rotation.y = -a; g.add(s);
    }
    [[-1.0, -.3, .26], [-.3, .4, .22], [.6, -.2, .28], [1.2, .35, .2], [.1, -.55, .18]].forEach(([x, z, r], k) => {
      g.add(at(cyl(r, r, .015, k % 2 ? '#5fae46' : '#6fbf4a', 18), x, .115, z));
      if (k % 2 === 0) g.add(...[0, 1, 2, 3, 4].map(p => at(cone(.04, .1, '#ff8fb8', 6), x + Math.cos(p * 1.26) * .04, .17, z + Math.sin(p * 1.26) * .04).rotateZ(Math.cos(p * 1.26) * -.5)), at(ball(.03, '#ffd66b'), x, .15, z));
    });
    // ếch trên lá sen giữa
    g.add(squash(at(ball(.08, '#7fc45a'), -.3, .17, .4), 1.2, .8, 1), ...[-1, 1].map(s => at(ball(.03, '#7fc45a'), -.3 + s * .04, .23, .44)), ...[-1, 1].map(s => at(ball(.015, '#2b2f3a'), -.3 + s * .04, .24, .467)));
    for (let k = 0; k < 7; k++) { const h = .55 + (k % 3) * .15; g.add(at(cone(.025, h, k % 2 ? '#5fa83e' : '#7cc256', 5), 1.75 + (k % 3) * .1, h / 2 + .06, -.6 + (k % 4) * .1).rotateZ((k % 3 - 1) * .12)); }
    g.userData.sink = .02;
    return g;
  },

  // ===== Võng trên khung gỗ chữ A hai đầu: vải sọc võng xuống giữa, gối nằm; dài 1.9 theo z =====
  'lounger-hammock'() {
    const wood = '#b9854a', L = .9, TOP = 1.05, tilt = Math.atan2(.3, TOP), len = Math.hypot(.3, TOP);
    const g = group(at(rbox(.1, .08, 2 * L + .1, .04, wood), 0, .04, 0));
    for (const s of [-1, 1]) {
      g.add(...[-1, 1].map(sx => { const leg = at(box(.06, len, .06, wood), sx * .15, TOP / 2, s * L); leg.rotation.z = sx * tilt; return leg; }),
        at(rbox(.7, .06, .1, .03, wood), 0, .03, s * L), at(ball(.05, '#9a6a45'), 0, TOP + .02, s * L));
    }
    // vải võng: dải tấm ngắn theo đường võng (cao .95 ở hai đầu sát khung, thấp .45 ở giữa); thanh căng gỗ hai đầu
    const E = L - .08, sag = u => .95 - .5 * (1 - u * u), N = 12;
    for (let k = 0; k < N; k++) {
      const u0 = k / N * 2 - 1, u1 = (k + 1) / N * 2 - 1, z0 = u0 * E, z1 = u1 * E, y0 = sag(u0), y1 = sag(u1);
      const seg = at(box(.6, .025, Math.hypot(z1 - z0, y1 - y0) + .01, k % 2 ? '#ffb347' : '#fffaf0'), 0, (y0 + y1) / 2, (z0 + z1) / 2);
      seg.rotation.x = -Math.atan2(y1 - y0, z1 - z0); g.add(seg);
    }
    g.add(...[-1, 1].map(s => at(cyl(.02, .02, .66, '#9a6a45', 8), 0, .96, s * E).rotateZ(Math.PI / 2)), squash(at(ball(.13, '#8fc9f2'), 0, .66, -.5), 1.6, .5, 1));
    g.userData.seat = [0, .47, .05];
    return g;
  },
  // ===== Ghế xếp bãi biển sọc + đôn gác chân + khăn tắm =====
  'lounger-deckchair'() {
    const wood = '#c98a55';
    const chair = group(...[-1, 1].flatMap(s => [at(box(.04, .05, .9, wood), s * .28, .18, 0).rotateX(-.35), at(box(.04, .9, .04, wood), s * .3, .42, -.2).rotateX(-.45)]),
      at(box(.6, .04, .04, wood), 0, .32, .38), at(box(.6, .04, .04, wood), 0, .82, -.42));
    const sling = new THREE.CatmullRomCurve3([[0, .82, -.4], [0, .5, -.2], [0, .3, .05], [0, .32, .36]].map(p => new THREE.Vector3(...p)));
    const pts = sling.getPoints(9);
    for (let k = 0; k < 9; k++) {
      const a = pts[k], b = pts[k + 1], seg = at(box(.54, .02, a.distanceTo(b) + .01, k % 2 ? '#3b8fe0' : '#fffaf0'), 0, (a.y + b.y) / 2, (a.z + b.z) / 2);
      seg.rotation.x = -Math.atan2(b.y - a.y, b.z - a.z); chair.add(seg);
    }
    chair.position.z = -.35;
    const stool = group(...[-1, 1].flatMap(s => [-1, 1].map(z => at(box(.04, .3, .04, wood), s * .22, .15, z * .18))), at(rbox(.5, .04, .42, .02, wood), 0, .3, 0),
      at(rbox(.42, .06, .36, .03, '#3b8fe0'), 0, .35, 0));
    stool.position.z = .6;
    const g = group(chair, stool, at(rbox(.32, .05, .22, .025, '#ffd66b'), .02, .405, .62), at(cyl(.035, .035, .16, '#ff8fb8', 12), .45, .08, -.1));
    g.userData.seat = [0, .38, .6];
    return g;
  },

  // ===== Mái che vải 4 cột: bàn gỗ vuông + hai ghế đôn, mái chóp sọc có diềm =====
  'parasol-canopy'() {
    const post = '#fffaf0', P = .58, H = 1.9;
    const g = group(...[-1, 1].flatMap(sx => [-1, 1].map(sz => at(cyl(.035, .035, H, post, 10), sx * P, H / 2, sz * P))),
      ...[-1, 1].flatMap(s => [at(box(2 * P + .07, .05, .05, post), 0, H, s * P), at(box(.05, .05, 2 * P + .07, post), s * P, H, 0)]),
      at(cone(.95, .55, '#3b8fe0', 4), 0, H + .3, 0).rotateY(Math.PI / 4));
    for (let k = 0; k < 4; k++) {
      const side = group(...[...Array(7)].map((_, i) => at(rbox(.17, .14, .02, .01, i % 2 ? '#fffaf0' : '#3b8fe0'), -.51 + i * .17, -.07, 0)));
      side.position.set(Math.sin(k * Math.PI / 2) * (P + .04), H - .02, Math.cos(k * Math.PI / 2) * (P + .04)); side.rotation.y = k * Math.PI / 2; g.add(side);
    }
    g.add(at(rbox(.6, .04, .6, .02, '#c98a55'), 0, .72, 0), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => at(box(.05, .7, .05, '#9a6a45'), sx * .25, .35, sz * .25))),
      ...[-1, 1].map(s => group(at(cyl(.18, .16, .42, '#ffd66b', 16), s * .48, .21, -.42), at(cyl(.19, .19, .05, '#fffaf0', 16), s * .48, .445, -.42))),
      at(cyl(.11, .1, .015, '#fffaf0', 16), .05, .748, .05), squash(at(ball(.07, '#ff6b4a'), .05, .78, .05), 1, .7, 1), at(cyl(.04, .035, .12, '#8fc9f2', 12), -.15, .8, -.1));
    return g;
  },
  // ===== Ghế băng tròn quanh cây chanh: bồn cây gạch, cây chanh tán tròn có quả vàng, ghế gỗ vòng quanh =====
  'parasol-tree'() {
    const g = group(at(cyl(.32, .36, .45, '#e98b5a', 20), 0, .225, 0), at(cyl(.3, .3, .02, SOIL, 20), 0, .45, 0), at(cyl(.06, .09, 1.1, '#8a5a3a', 10), 0, 1.0, 0),
      at(ball(.5, LEAF), 0, 1.75, 0), at(ball(.36, LEAF_DARK), .3, 1.6, .2), at(ball(.34, '#6fbf4a'), -.3, 1.95, -.1));
    for (let k = 0; k < 9; k++) { const a = k * 2.3, r = .48 + (k % 2) * .06; g.add(squash(at(ball(.06, '#ffd23f'), Math.cos(a) * r, 1.55 + (k % 3) * .18, Math.sin(a) * r), 1, 1.2, 1)); }
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, seat = at(rbox(.28, .04, .26, .02, '#c98a55'), Math.sin(a) * .62, .44, Math.cos(a) * .62); seat.rotation.y = a; g.add(seat);
      if (k % 3 === 0) { const leg = at(box(.05, .42, .2, '#9a6a45'), Math.sin(a) * .62, .21, Math.cos(a) * .62); leg.rotation.y = a; g.add(leg); }
    }
    return g;
  },

  // ===== Bếp nướng tròn kiểu ấm đun: thân cầu đen trên ba chân + bánh xe, nắp mở dựng phía sau, xúc xích trên vỉ =====
  'grill-kettle'() {
    const black = '#2f3238', chr = chrome();
    // nửa cầu (vỏ hở): theta0 = 0 nửa trên, π/2 nửa dưới
    const shell = (r, theta0, y, sy) => { const s = squash(at(mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, theta0, Math.PI / 2), mat(black, { side: THREE.DoubleSide })), 0, y, 0), 1, sy, 1); s.userData.noOutline = true; return s; };
    const g = group(...[0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2 + .5; const leg = at(cyl(.02, .02, .6, chr, 8), Math.sin(a) * .2, .3, Math.cos(a) * .2); leg.rotation.set(Math.cos(a) * .3, 0, -Math.sin(a) * .3); return leg; }),
      at(ring(.06, .025, black), -.29, .09, .15).rotateY(Math.PI / 2), at(ring(.06, .025, black), -.29, .09, -.15).rotateY(Math.PI / 2),
      shell(.32, Math.PI / 2, .78, .9), at(ring(.32, .02, black), 0, .78, 0).rotateX(Math.PI / 2), at(cyl(.3, .3, .01, '#8d9196', 24), 0, .79, 0));
    const lid = group(shell(.32, 0, 0, .7), at(ring(.32, .02, black), 0, 0, 0).rotateX(Math.PI / 2), at(cyl(.06, .06, .04, '#9a6a45', 12), 0, .245, 0));
    lid.position.set(0, .82, -.36); lid.rotation.x = -1.35;
    g.add(lid, ...[-.12, 0, .12].map(x => at(cyl(.025, .025, .22, '#c9693d', 10), x, .83, .02).rotateX(Math.PI / 2)), at(rbox(.3, .03, .22, .012, '#c98a55'), .42, .62, 0), at(box(.04, .62, .04, chr), .42, .31, 0));
    return g;
  },
  // ===== Lò nướng bánh pizza gạch: bệ gạch, mái vòm, cửa lò có lửa (đèn thật), ống khói, xẻng gỗ dựng bên =====
  'grill-pizza'() {
    const brick = '#c9693d', g = group(at(rbox(.8, .6, .56, .04, '#d9d2c4'), 0, .3, 0), at(rbox(.84, .05, .6, .025, '#b5aea3'), 0, .625, 0),
      squash(at(ball(.38, brick), 0, .65, -.02), 1, .85, 1), at(cyl(.06, .07, .3, '#8a837a', 12), .12, 1.1, -.15),
      at(rbox(.26, .2, .04, .02, '#3a2a24'), 0, .76, .36), at(rbox(.32, .04, .1, .02, '#b5aea3'), 0, .66, .38),
      flame(-.05, .68, .4, .12, .045, '#ff7a3d', '#ff5a1a'), flame(.05, .68, .4, .09, .035, '#ffd66b', '#ffb92a'),
      at(box(.05, .9, .02, '#c98a55'), .5, .45, .1).rotateZ(-.15), at(cyl(.1, .1, .015, '#c98a55', 16), .57, .9, .1).rotateZ(-.15).rotateX(Math.PI / 2));
    const light = new THREE.PointLight('#ff9a4a', 2.5, 3, 1.6); light.position.set(0, .8, .55);
    g.add(light);
    return g;
  },

  // ===== Thùng đá giữ lạnh xanh trắng: nắp mở hé, lon nước + dưa hấu trên nắp, chồng khăn bên cạnh =====
  'deckbox-cooler'() {
    const g = group(at(rbox(.6, .4, .4, .06, '#3b8fe0'), -.12, .2, 0), at(rbox(.62, .08, .42, .04, '#ffffff'), -.12, .44, 0), at(rbox(.3, .05, .06, .025, '#ffffff'), -.12, .3, .21),
      ...['#e8483a', '#7fc45a', '#ffd66b'].map((c, k) => at(cyl(.035, .035, .12, c, 12), -.3 + k * .1, .54, .05)),
      squash(at(ball(.12, '#4fb34a'), .02, .55, -.05), 1.3, .85, 1),
      ...['#ff8fb8', '#ffd66b', '#8fc9f2'].map((c, k) => at(rbox(.3, .08, .3, .04, c), .3, .04 + k * .08, .02)));
    return g;
  },
  // ===== Giỏ mây đi biển: khăn cuộn, mũ rơm vành rộng trên nắp, dép tông dưới đất =====
  'deckbox-basket'() {
    const g = group(at(rbox(.7, .38, .42, .08, '#d9a35a'), 0, .19, 0), ...[.1, .2, .3].map(y => at(box(.71, .02, .43, '#b8803e'), 0, y, 0)),
      at(mesh(new THREE.TorusGeometry(.22, .02, 6, 16, Math.PI), '#b8803e'), 0, .38, 0),
      ...['#ff8fb8', '#8fc9f2'].map((c, k) => at(cyl(.07, .07, .3, c, 14), -.15 + k * .16, .42, -.05).rotateZ(Math.PI / 2)),
      at(cyl(.3, .3, .015, '#f2c14e', 24), .18, .5, .05), at(cyl(.12, .14, .1, '#f2c14e', 18), .18, .555, .05), at(cyl(.145, .145, .03, '#e8617f', 18), .18, .525, .05),
      ...[-1, 1].map(s => at(rbox(.1, .02, .24, .01, '#ffd66b'), .38 + s * .07, .01, .3)));
    return g;
  },

  // ===== Nhà kho gỗ làm vườn: vách ván, mái hai dốc xanh, cửa đôi, cửa sổ hoa, dụng cụ dựng ngoài — 2.6 × 2 m =====
  'greenhouse-shed'() {
    const W = 2.6, D = 2, H = 1.9, RISE = .7, wall = '#e9c58f', trim = '#fffaf0';
    const g = group(at(rbox(W + .1, .1, D + .1, .04, '#b5aea3'), 0, .05, 0), at(box(W, H, D, wall), 0, .1 + H / 2, 0));
    for (let k = 0; k < 12; k++) g.add(at(box(.02, H - .02, D + .02, '#d9b07e'), -W / 2 + .1 + k * .22, .09 + H / 2, 0));
    const gable = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, RISE)]);
    for (const s of [-1, 1]) { const gEnd = mesh(new THREE.ExtrudeGeometry(gable, { depth: .02, bevelEnabled: false }), wall); gEnd.position.set(0, .1 + H, s * D / 2 - .01); g.add(gEnd); }
    const slope = Math.atan2(RISE, W / 2), len = Math.hypot(RISE, W / 2) + .15;
    for (const s of [-1, 1]) { const roof = at(box(len, .06, D + .3, '#5a8fd6'), s * (W / 4 + .02), .1 + H + RISE / 2 + .03, 0); roof.rotation.z = -s * slope; g.add(roof); }
    g.add(at(box(1.0, 1.5, .03, '#8fc9f2'), -.5, .85, D / 2 + .03), at(box(.02, 1.5, .02, trim), -.5, .85, D / 2 + .055), at(box(1.06, .05, .05, trim), -.5, 1.63, D / 2 + .045),
      ...[-1, 1].map(s => at(ball(.03, '#ffd66b'), -.5 + s * .08, .85, D / 2 + .075)),
      at(box(.5, .4, .02, '#d8f1f8'), .7, 1.3, D / 2 + .025), at(box(.56, .04, .05, trim), .7, 1.52, D / 2 + .045), at(box(.56, .04, .05, trim), .7, 1.08, D / 2 + .045),
      at(rbox(.6, .14, .18, .04, '#c98a55'), .7, .98, D / 2 + .13), ...[-.2, -.07, .07, .2].map((x, k) => at(ball(.06, ['#ff8fb8', '#ffd66b', '#ff6b4a', '#b48ee8'][k]), .7 + x, 1.08, D / 2 + .13)),
      at(box(.04, 1.2, .04, '#9a6a45'), 1.45, .6, .3).rotateZ(.12), at(rbox(.2, .25, .03, .012, '#8d9196'), 1.52, .14, .3).rotateZ(.12),
      at(box(.04, 1.1, .04, '#9a6a45'), 1.45, .55, -.2).rotateZ(.15), ...[-1, 0, 1].map(k => at(box(.02, .14, .02, '#8d9196'), 1.53 + k * .03, .08, -.2)));
    return g;
  },
  // ===== Nhà màng vòm (polytunnel): vòm nilon trong mờ trên khung cung, hai luống rau bên trong, cửa đầu hồi =====
  'greenhouse-tunnel'() {
    const R = 1.05, LEN = 2.8;
    const skin = mesh(new THREE.CylinderGeometry(R, R, LEN, 28, 1, true, 0, Math.PI), mat('#e8f6f0', { transparent: true, opacity: .32, side: THREE.DoubleSide }));
    skin.rotation.z = Math.PI / 2; skin.position.y = .08; skin.castShadow = false; skin.userData.noOutline = true;
    const g = group(at(rbox(LEN + .2, .08, 2 * R + .12, .04, '#b5aea3'), 0, .04, 0), skin);
    for (let k = 0; k <= 4; k++) { const hoop = at(mesh(new THREE.TorusGeometry(R + .01, .025, 6, 28, Math.PI), '#fffaf0'), -LEN / 2 + k * LEN / 4, .08, 0); hoop.rotation.y = Math.PI / 2; g.add(hoop); }
    for (const s of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.CircleGeometry(R, 28, 0, Math.PI), mat('#e8f6f0', { transparent: true, opacity: .32, side: THREE.DoubleSide }));
      end.position.set(s * LEN / 2, .08, 0); end.rotation.y = Math.PI / 2; end.castShadow = false; end.userData.noOutline = true; g.add(end);
    }
    g.add(at(box(.04, 1.0, .04, '#ff8fb8'), LEN / 2 + .03, .58, -.3), at(box(.04, 1.0, .04, '#ff8fb8'), LEN / 2 + .03, .58, .3), at(box(.04, .04, .64, '#ff8fb8'), LEN / 2 + .03, 1.08, 0));
    for (const z of [-.5, .5]) {
      g.add(at(rbox(LEN - .3, .16, .55, .05, WOOD), 0, .16, z), at(box(LEN - .4, .03, .45, SOIL), 0, .245, z));
      for (let i = 0; i < 6; i++) { const x = -1.1 + i * .44; g.add(at(ball(.12 + (i % 2) * .03, i % 2 ? LEAF : '#7fc45a'), x, .37, z)); if (i % 2 === 0) g.add(at(ball(.04, z < 0 ? '#ff6b4a' : '#ffd66b'), x + .06, .45, z + .06)); }
    }
    return g;
  },

  // ===== Luống dâu tây: bồn gỗ sơn trắng, rơm phủ đất, khóm dâu lá xanh quả đỏ =====
  'vegbed-berries'() {
    const g = group(...raisedBed('#fffaf0', '#e9c25a'));
    for (let i = 0; i < 10; i++) for (const z of [-.18, .18]) {
      const x = -1.25 + i * .28 + (z > 0 ? .14 : 0);
      g.add(squash(at(ball(.12, i % 2 ? LEAF : '#6fbf4a'), x, .44, z), 1, .55, 1));
      if ((i + (z > 0)) % 2 === 0) g.add(squash(at(ball(.035, '#e8483a'), x + .07, .43, z + .08), 1, 1.2, 1), at(cone(.02, .02, '#5fae46', 5), x + .07, .47, z + .08));
    }
    g.add(at(rbox(.42, .08, .04, .015, '#e8483a'), -1.1, .62, .55), at(cyl(.014, .014, .3, WOOD_DARK, 6), -1.1, .45, .55));
    return g;
  },
  // ===== Luống ngô: bồn gỗ, hàng cây ngô cao lá dài, bắp vàng =====
  'vegbed-corn'() {
    const g = group(...raisedBed(WOOD));
    for (let i = 0; i < 7; i++) for (const z of [-.2, .2]) {
      const x = -1.2 + i * .4 + (z > 0 ? .2 : 0), h = 1.2 + ((i + (z > 0)) % 3) * .15;
      if (x > 1.3) continue;
      g.add(at(cyl(.022, .03, h, '#7fae46', 6), x, .38 + h / 2, z));
      for (let k = 0; k < 4; k++) { const a = k * 1.9 + i, leaf = at(cone(.05, .55, k % 2 ? '#6fbf4a' : '#8fc95a', 4), x + Math.cos(a) * .12, .65 + k * .25, z + Math.sin(a) * .12); leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); squash(leaf, 1, 1, .3); g.add(leaf); }
      g.add(squash(at(ball(.05, '#ffd23f'), x + .05, .38 + h * .55, z + .04), 1, 2.2, 1), at(cone(.03, .12, '#e9c25a', 5), x, .38 + h + .05, z));
    }
    return g;
  },

  // ===== Vườn hoa cắt cành hai bên lối đá: tulip nhiều màu (bên vườn) + cúc trắng, hướng dương lùn (bên nhà) =====
  'veggies-flowers'() {
    const g = group(), N = -1.2, S = 1.35, COLORS = ['#ff5f7e', '#ffd23f', '#ff9f43', '#b48ee8', '#ff8fb8'];
    for (const z of [N, S]) g.add(at(rbox(2.8, .12, 1.4, .05, SOIL), 0, .06, z));
    for (const dz of [-.45, -.15, .15, .42]) for (let i = 0; i < 8; i++) {
      const x = -1.2 + i * .33 + (dz > 0 ? .1 : 0), c = COLORS[(i + Math.round(dz * 10)) % COLORS.length];
      g.add(at(cyl(.008, .01, .3, '#5fa83e', 5), x, .27, N + dz), squash(at(ball(.045, c), x, .44, N + dz), 1, 1.3, 1), at(cone(.03, .14, '#6fbf4a', 4), x + .03, .2, N + dz).rotateZ(-.4));
    }
    for (let i = 0; i < 9; i++) for (const dz of [-.35, .3]) {
      const x = -1.2 + i * .3 + (dz > 0 ? .12 : 0);
      if (dz < 0) g.add(at(cyl(.008, .01, .25, '#5fa83e', 5), x, .245, S + dz), at(cyl(.06, .06, .012, '#ffffff', 10), x, .38, S + dz), at(ball(.025, '#ffd23f'), x, .39, S + dz));
      else g.add(at(cyl(.015, .02, .5, '#5fa83e', 6), x, .37, S + dz), at(cyl(.1, .1, .02, '#ffc21a', 12), x, .63, S + dz + .02).rotateX(-.4), at(cyl(.045, .045, .03, '#6a4a2a', 10), x, .64, S + dz + .03).rotateX(-.4));
    }
    return g;
  },
  // ===== Vườn thảo mộc hai bên lối đá: hàng oải hương, bụi hương thảo, khóm húng quế, biển tên nhỏ =====
  'veggies-herbs'() {
    const g = group(), N = -1.2, S = 1.35;
    for (const z of [N, S]) g.add(at(rbox(2.8, .12, 1.4, .05, SOIL), 0, .06, z));
    for (const dz of [-.4, .05]) for (let i = 0; i < 7; i++) {
      const x = -1.15 + i * .38;
      g.add(squash(at(ball(.16, '#8fa98a'), x, .17, N + dz), 1.1, .6, 1.1));
      for (let k = 0; k < 5; k++) { const a = k * 1.26 + i; g.add(squash(at(ball(.028, '#9a7fd8'), x + Math.cos(a) * .08, .38 + (k % 2) * .05, N + dz + Math.sin(a) * .08), 1, 2.2, 1)); }
    }
    for (let i = 0; i < 6; i++) {
      const x = -1.1 + i * .44;
      g.add(...[-.04, .04].map(d => at(cone(.08, .4, '#4f7f4a', 6), x + d, .32, S - .35)), squash(at(ball(.15, '#7fc45a'), x + .1, .22, S + .25), 1, .7, 1));
    }
    [[-1.25, N + .55, '#ffd66b'], [-1.25, S + .55, '#8fc9f2']].forEach(([x, z, c]) => g.add(at(rbox(.26, .08, .03, .012, c), x, .4, z), at(cyl(.012, .012, .3, WOOD_DARK, 6), x, .26, z)));
    return g;
  },

  // ===== Cú mồi đuổi chim trên cọc gỗ + chong chóng đỏ quay theo gió =====
  'scarecrow-owl'() {
    const tick = ticker(), blades = group(at(ball(.03, '#ffd66b'), 0, 0, 0));
    for (let k = 0; k < 4; k++) { const b = at(rbox(.04, .16, .012, .006, k % 2 ? '#e8483a' : '#fffaf0'), 0, .08, 0); const arm = group(b); arm.rotation.z = k * Math.PI / 2; b.rotation.y = .5; blades.add(arm); }
    blades.position.set(.32, 1.25, .1);
    const owl = group(squash(at(ball(.18, '#9a6a45'), 0, .2, 0), 1, 1.25, .9), at(ball(.13, '#b9854a'), 0, .44, 0), squash(at(ball(.12, '#e9c58f'), 0, .18, .08), 1, 1.2, .5),
      ...[-1, 1].flatMap(s => [at(cyl(.05, .05, .02, '#fffaf0', 14), s * .055, .46, .118).rotateX(Math.PI / 2), at(cyl(.028, .028, .02, '#2b2f3a', 12), s * .055, .46, .126).rotateX(Math.PI / 2),
        at(cone(.03, .08, '#9a6a45', 4), s * .08, .58, 0)]),
      at(cone(.02, .05, '#ffb347', 6), 0, .41, .135).rotateX(Math.PI / 2 + .3));
    owl.position.y = 1.0;
    const g = scaled(1.35, at(cyl(.05, .06, 1.0, WOOD_DARK, 8), 0, .5, 0), at(cyl(.12, .14, .04, WOOD_DARK, 12), 0, 1.0, 0), owl,
      at(cyl(.012, .012, .5, '#c8ccd2', 6), .32, 1.0, .1), blades);
    g.userData.sink = .05 * 1.35;
    g.userData.update = t => { blades.rotation.z -= (1 + 5 * windAt(t)) * tick(t); };
    return g;
  },
  // ===== Chong chóng chỉ hướng gió hình gà trống trên cột, chữ N S E W; gà quay theo hướng gió =====
  'scarecrow-vane'() {
    const rooster = new THREE.Shape();
    rooster.moveTo(-.28, 0); rooster.lineTo(.18, 0); rooster.quadraticCurveTo(.3, .1, .26, .24); rooster.lineTo(.32, .3); rooster.lineTo(.26, .34);
    rooster.quadraticCurveTo(.22, .4, .16, .34); rooster.quadraticCurveTo(.08, .18, -.05, .2); rooster.quadraticCurveTo(-.2, .45, -.32, .3); rooster.quadraticCurveTo(-.26, .12, -.28, 0);
    const bird = mesh(new THREE.ExtrudeGeometry(rooster, { depth: .02, bevelEnabled: false }), '#2f3238');
    bird.position.set(0, .05, -.01);
    const vane = group(bird, at(box(.7, .02, .02, '#2f3238'), 0, .02, 0), at(cone(.04, .1, '#2f3238', 4), .39, .02, 0).rotateZ(-Math.PI / 2));
    vane.position.y = 1.75;
    const letters = group(at(box(.9, .02, .02, '#c8ccd2'), 0, 0, 0), at(box(.02, .02, .9, '#c8ccd2'), 0, 0, 0), ...[[.45, 0], [-.45, 0], [0, .45], [0, -.45]].map(([x, z]) => at(ball(.035, '#e8483a'), x, 0, z)));
    letters.position.y = 1.5;
    const g = scaled(1.2, at(cyl(.035, .05, 1.75, '#fffaf0', 10), 0, .875, 0), at(cyl(.15, .17, .05, '#b5aea3', 14), 0, .025, 0), letters, vane, at(ball(.04, '#ffd66b'), 0, 1.74, 0));
    let last = 0;
    g.userData.update = t => { const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t; vane.rotation.y += ((Math.sin(t * .13) * 1.5 + Math.sin(t * .7) * .2) - vane.rotation.y) * Math.min(1, dt * 2); };
    return g;
  },

  // ===== Giếng ước nhỏ: thành đá tròn, mái gỗ trên hai cột, tay quay + gàu treo dây =====
  'rainbarrel-well'() {
    const g = scaled(1.0, at(cyl(.42, .45, .55, '#c8c2b8', 20), 0, .275, 0), at(ring(.41, .05, '#b5aea3'), 0, .58, 0).rotateX(Math.PI / 2), at(cyl(.36, .36, .01, '#3f8f9e', 20), 0, .556, 0),
      ...[-1, 1].map(s => at(box(.07, 1.1, .07, WOOD_DARK), s * .4, 1.05, 0)), at(cyl(.03, .03, .9, WOOD, 8), 0, 1.25, 0).rotateZ(Math.PI / 2),
      at(box(.03, .2, .03, '#6b7078'), .5, 1.18, 0), at(cyl(.015, .015, .45, '#e9c58f', 6), 0, 1.0, 0), at(cyl(.08, .07, .12, WOOD_DARK, 12), 0, .72, 0),
      ...[-1, 1].map(s => { const r = at(box(1.0, .04, .5, '#e8483a'), 0, 1.75, s * .17); r.rotation.x = s * .55; return r; }), at(box(1.0, .05, .05, '#c93a2e'), 0, 1.86, 0));
    return g;
  },
  // ===== Vòi bơm tay gang đỏ + máng gỗ hứng nước, bình tưới bên cạnh =====
  'rainbarrel-pump'() {
    const red = '#e8483a';
    const handle = at(box(.4, .04, .04, red), -.18, 1.08, 0); handle.rotation.z = .3;
    const g = scaled(1.2, at(rbox(.3, .08, .3, .03, '#b5aea3'), 0, .04, -.2), at(cyl(.07, .08, .9, red, 14), 0, .53, -.2), at(cyl(.09, .09, .06, red, 14), 0, 1.0, -.2),
      at(cyl(.03, .03, .25, red, 8), 0, .82, -.06).rotateX(Math.PI / 2 + .3), handle, at(ball(.04, red), 0, 1.06, -.2),
      at(rbox(.7, .24, .3, .04, WOOD), 0, .12, .2), at(box(.6, .02, .22, mat('#5fc8e8', { transparent: true, opacity: .85 })), 0, .25, .2),
      at(cyl(.1, .11, .2, '#5fc8e8', 16), .5, .1, -.1), at(cyl(.015, .02, .22, '#5fc8e8', 8), .64, .2, -.1).rotateZ(-.9));
    handle.position.z = -.2;
    return g;
  },
});
