// Sân sau (phía sau phòng khách + bếp, cửa từ phòng tắm): bể bơi + vườn rau. 10 món gốc cho Deco — bể bơi, ghế nằm, bàn ô dù,
// bếp nướng, hòm đồ bơi, nhà kính, luống cà chua, luống rau củ, bù nhìn, thùng nước mưa (chưa có phương án thay thế) — cùng hàng rào
// hai cạnh ngoài (sau + phải; cạnh trước là tường nhà, cạnh trái là tường phòng tắm) và lối đá từ cửa phòng tắm.
// Cùng kiểu dựng với bathroom-scene.mjs: khối bo tròn, màu pastel, viền toon. Mỗi món có chỗ đặt cố định [x, z, xoay?]
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
      ...[-.1, .1, .3, .5, .7].map(z => at(box(.63, .085, .02, '#ffd9e6'), 0, .35, z)));
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
