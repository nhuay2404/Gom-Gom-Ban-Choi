// Mèo khối 3D sống trong phòng Deco/Home.
// Mỗi con là một khối bo tròn (giống mèo trên bàn chơi) có tai, 4 chân, đuôi nhiều đốt và mặt vẽ bằng canvas.
// "Não" của mỗi con là một generator: mỗi frame chạy tiếp một nhịp, nên hành vi viết tuần tự như kịch bản
// (đi tới -> nhảy lên -> xoay vòng -> nằm ngủ ...) mà vẫn ngắt được bất cứ lúc nào (cưng mèo, AFK, dời đồ).
import * as THREE from 'three';
import { roundedBox } from './mesh-detail.mjs';
import { categories, catExpressionSrc, catBodyPlacement, CAT_EXPR_BOX, SLEEP_FACE } from '../ui/cat-art.mjs';
import { OBSTACLE_RADIUS, OBSTACLE_EXTRA, WINDOW, ZONE_OFFSET, LINKS } from './room-layout.mjs';
import { CAT_BODY, CAT_MOTION } from '../gameplay/tuning.mjs';
import { TOON, toonMat, markOutlineUnit } from './toon.mjs';
import { expressionOf, settleExpression } from './cat-face.mjs';

const { W, H, D, LEG } = CAT_BODY, ROOM = CAT_MOTION.ROOM_LIMIT, TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

// ---------- Khu nhà: mèo đi lại tự do giữa vườn, phòng khách, phòng ngủ ----------
// Toạ độ mèo = toạ độ khu nhà (tâm vườn là gốc, mỗi phòng lệch ZONE_OFFSET[khu]). Mỗi khu mèo đi trong ô
// ±ROOM quanh tâm khu; hai khu cạnh nhau nối bằng một lối hẹp qua cửa (LINKS) xuyên qua tường / cổng rào.
const zoneHome = zone => ({ x: ZONE_OFFSET[zone][0], z: ZONE_OFFSET[zone][1] });
// Mỗi lối: trục hai khu lệch nhau (x hoặc z), ô lối đi (box) giữa hai mép khu, và điểm đứng ngay trong mỗi khu (steps).
const PASSES = LINKS.map(({ a, b, at, w, open = false }) => {
  const [ax, az] = ZONE_OFFSET[a], [bx, bz] = ZONE_OFFSET[b];
  const axis = Math.abs(ax - bx) > Math.abs(az - bz) ? 'x' : 'z', side = axis === 'x' ? 'z' : 'x';
  const ca = axis === 'x' ? ax : az, cb = axis === 'x' ? bx : bz, dir = Math.sign(cb - ca);
  // lối cửa rộng vừa thân mèo; lối thông thoáng (vườn <-> phần mở rộng) rộng bằng cả ô đi lại
  const edgeA = ca + dir * ROOM, edgeB = cb - dir * ROOM, half = open ? ROOM : w / 2 - .2;
  const point = (along, across) => (axis === 'x' ? { x: along, z: across } : { x: across, z: along });
  const lo = point(Math.min(edgeA, edgeB), at - half), hi = point(Math.max(edgeA, edgeB), at + half);
  return { a, b, open, box: [lo.x, hi.x, lo.z, hi.z], steps: { [a]: point(edgeA - dir * .15, at), [b]: point(edgeB + dir * .15, at) } };
});
// Đường đi qua các khu (đồ thị nhỏ, tìm theo chiều rộng): danh sách khu từ `from` tới `to` chỉ qua các khu đã mở.
function zoneRoute(from, to, open) {
  const prev = { [from]: null }, queue = [from];
  while (queue.length) {
    const zone = queue.shift();
    if (zone === to) break;
    for (const p of PASSES) {
      const next = p.a === zone ? p.b : p.b === zone ? p.a : null;
      if (next && open.includes(next) && !(next in prev)) { prev[next] = zone; queue.push(next); }
    }
  }
  if (!(to in prev)) return [from];
  const route = [];
  for (let zone = to; zone; zone = prev[zone]) route.unshift(zone);
  return route;
}
const passBetween = (a, b) => PASSES.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));
const boxNearest = (x, z, x0, x1, z0, z1) => ({ x: clamp(x, x0, x1), z: clamp(z, z0, z1) });
// Lò xo tắt dần: obj[key] chạy về đích với độ cứng k và tỉ lệ tắt zeta (vận tốc lưu ở obj[key + 'V']).
// zeta < 1 thì hơi vọt qua rồi về, như thịt mềm; đây là thứ làm chuyển động hết "cứng".
function spring(obj, key, target, k, zeta, dt) {
  const vKey = key + 'V', v = obj[vKey] || 0;
  const accel = k * (target - obj[key]) - 2 * zeta * Math.sqrt(k) * v;
  obj[vKey] = v + accel * dt;
  obj[key] += obj[vKey] * dt;
}
// Lò xo từng tư thế, độ cao khi bị nhấc, sải bước: tuning.mjs (CAT_MOTION).
const { POSE_SPRING, CARRY_H, STRIDE_WALK, STRIDE_RUN } = CAT_MOTION;

// Bán kính vật cản của từng món + cửa sổ: room-layout.mjs.
// Chạm dồn dập: WARN lần trong WINDOW giây thì bực, ANGRY lần thì nổi giận và hờn SULK giây.
const PET_ANNOY = { WINDOW: 3, WARN: 4, ANGRY: 6, SULK: 7 };
const FURNITURE = Object.fromEntries(Object.entries(OBSTACLE_RADIUS).map(([id, r]) => [id, { r }]));

// ---------- Mặt mèo: vẽ bằng canvas, tách lớp "mặt" (bụng, mõm, miệng) và lớp "mắt" để mắt liếc được ----------
const textures = {};
// padX: lề thêm hai bên (theo đơn vị bề ngang mặt) để nét vẽ được phép thò ra ngoài khung 0..1, vd ria mép chìa qua viền thân.
function canvasTexture(key, draw, padX = 0) {
  if (textures[key]) return textures[key];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(256 * (1 + 2 * padX)); canvas.height = 230;
  const g = canvas.getContext('2d');
  g.translate(256 * padX, 0);
  g.scale(256, 230);
  g.lineCap = g.lineJoin = 'round';
  draw(g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return (textures[key] = texture);
}
// Thân + tai + mặt 3D dựng theo ảnh mèo 2D trong Figma (ui/shared/img/cats/<giống>-body.png + <giống>-<biểu cảm>.png).
// Màu lấy mẫu từ ảnh Figma (cùng bộ với HANG_COLORS trong cat-art.mjs); thân 3D cũng dùng các màu này (catLook).
// Số đo ảnh thân từng giống (px, đo từ kênh alpha; mỗi ảnh một cao khác nhau): h = cao ảnh; mặt trước khối thân nằm trong x0..x1 ×
// top..bottom (đáy gồm cả dải vát); apex = chóp tai trái; ear = [mép ngoài, mép trong] chân tai trái ở hàng top - 2.
const IMG_W = 256;
const BODY_PX = {
  orange: { h: 301, x0: 0, x1: 256, top: 60, bottom: 300, apex: [27, 0], ear: [9, 92] },
  gray: { h: 298, x0: 0, x1: 256, top: 59, bottom: 297, apex: [49, 0], ear: [6, 105] },
  white: { h: 299, x0: 1, x1: 255, top: 65, bottom: 298, apex: [30, 0], ear: [8, 94] },
  tuxedo: { h: 293, x0: 0, x1: 256, top: 57, bottom: 292, apex: [31, 0], ear: [10, 92] },
  siamese: { h: 286, x0: 0, x1: 256, top: 53, bottom: 285, apex: [51, 0], ear: [9, 103] },
  tabby: { h: 256, x0: 11, x1: 245, top: 52, bottom: 251, apex: [42, 0], ear: [19, 94] },
};
const frontPx = m => ({ w: m.x1 - m.x0, h: m.bottom - m.top + 1 });
const FIGMA_LOOK = {
  orange: { fur: '#fba33b', side: '#f0600f', belly: '#fbf2dd', paw: '#fbf2dd', stripe: '#f07a1e', ring: '#e8620f', ink: '#3b1d10',
    stripes: 'orange', muzzle: 'wide' },
  gray: { fur: '#a8aab8', side: '#575969', belly: '#fcfcfc', paw: '#f7f5f2', stripe: '#5f6170', ring: '#f5b70f', ink: '#2a2228',
    stripes: 'gray', muzzle: 'round' },
  white: { fur: '#f7f6f2', side: '#d6d0c7', belly: '#fdfcfa', paw: '#f7f5f2', stripe: '#b9b2ac', ring: '#1f7fe0', ink: '#3a2a26',
    stripes: 'white', muzzle: 'none', brows: true },
  tuxedo: { fur: '#322d30', side: '#1f1a1d', belly: '#f9f4ea', paw: '#f8f0e5', ring: '#f5b70f', ink: '#2a1d18', lidInk: '#f3e7cf',
    muzzle: 'tuxedo' },
  siamese: { fur: '#f7e5ce', side: '#d9bf9c', belly: '#f7e5ce', paw: '#6a3521', mask: '#7a4530', ring: '#1f7fe0', ink: '#2a1610', lidInk: '#f3e7cf',
    muzzle: 'mask', earInner: '#e9a48f' },
  // Mèo tam thể (calico, Figma "Tabby 1"; id giống vẫn là 'tabby'): nền trắng, mảng cam + đen, tai đen, đuôi đen khoanh cam
  tabby: { fur: '#faf6ef', side: '#d9d2c6', belly: '#faf6ef', paw: '#f3ede1', stripe: '#f2952f', patch: '#2f2b2d', ear: '#2f2b2d', ring: '#f5b70f', ink: '#2a2420',
    stripes: 'calico', muzzle: 'none', earInner: '#f6b3bf' },
};
// Bộ màu dùng cho thân 3D: giữ cấu trúc categories (tai, kiểu đuôi...), đè màu bằng màu Figma.
const catLook = breed => ({ ...categories[breed], ...FIGMA_LOOK[breed] });

// Atlas thân 3 × 2 ô (mỗi ô ATLAS_CW × ATLAS_CH): [trước | trái | phải] / [trên | sau | đáy].
// Họa tiết vẽ lại bằng vector (không dán ảnh 2D: ảnh có shading vát cạnh và bị vỡ điểm khi phóng to). Mỗi mảng màu là một
// khối elip 3D (PATTERNS) trong hệ toạ độ thân; giao của nó với từng mặt hộp là một hình elip -> vằn / mảng chạy liền qua
// cạnh và góc thân, mép mượt ở mọi mặt.
const ATLAS_CW = 512, ATLAS_CH = 470;
// [tâm x, y, z], [bán kính x, y, z], khoá màu trong catLook. Thân: x ∈ ±W/2, y ∈ ±H/2 (gốc giữa thân), mặt trước z = +D/2.
const P = (c, r, color) => ({ c, r, color });
const PATTERNS = {
  orange: [
    ...[-.075, 0, .075].map(x => P([x, .275, .3], [.022, .085, .13], 'stripe')),             // ba vằn trán chạy lên nóc
    ...[-.06, -.16, -.26].map(z => P([0, .3, z], [.42, .19, .028], 'stripe')),              // vằn ngang lưng, vòng xuống hai sườn
    ...[-1, 1].flatMap(s => [.02, -.055].map(y => P([s * .3, y, .3], [.065, .02, .17], 'stripe'))), // vằn má chạy ra sườn
    P([0, -.3, .31], [.2, .29, .05], 'belly'),                                              // yếm trắng
  ],
  gray: [],
  white: [],
  tuxedo: [
    P([0, -.33, .31], [.25, .33, .06], 'belly'),                                            // yếm trắng rộng dần xuống đáy
    P([0, -.05, .31], [.075, .2, .03], 'belly'),                                            // chóp yếm nhọn lên cằm
  ],
  siamese: [P([0, .03, .31], [.18, .12, .035], 'mask')],                                     // mảng mặt nâu bầu dục
  tabby: [
    P([-.2, .3, .24], [.17, .14, .2], 'patch'), P([.21, .3, .2], [.17, .12, .22], 'stripe'),
    P([-.32, -.02, .17], [.08, .14, .2], 'stripe'), P([.32, -.07, .24], [.07, .1, .12], 'patch'),
    P([.31, -.25, .28], [.1, .09, .12], 'stripe'), P([-.3, -.25, .3], [.08, .07, .1], 'patch'),
    P([.1, .2, -.27], [.25, .2, .2], 'patch'), P([-.26, -.02, -.2], [.15, .18, .2], 'stripe'),
    P([-.05, .3, -.02], [.13, .06, .12], 'stripe'), P([.32, .05, -.04], [.06, .14, .14], 'patch'),
  ],
};
function bodyAtlas(breed) {
  const key = `atlas:${breed}`;
  if (textures[key]) return textures[key];
  const cat = catLook(breed), canvas = document.createElement('canvas');
  canvas.width = ATLAS_CW * 3; canvas.height = ATLAS_CH * 2;
  const g = canvas.getContext('2d');
  g.fillStyle = cat.fur; g.fillRect(0, 0, canvas.width, canvas.height);
  // Mỗi mặt: [trục pháp tuyến, toạ độ mặt, ô, (điểm 3D trên mặt) -> (u, v) trong ô] — khớp atlasUvs.
  const faces = [
    ['z', D / 2, [0, 0], (x, y) => [x / W + .5, .5 - y / H], ['x', 'y']],
    ['x', -W / 2, [1, 0], (z, y) => [z / D + .5, .5 - y / H], ['z', 'y']],
    ['x', W / 2, [2, 0], (z, y) => [.5 - z / D, .5 - y / H], ['z', 'y']],
    ['y', H / 2, [0, 1], (x, z) => [x / W + .5, .5 - z / D], ['x', 'z']],
    ['z', -D / 2, [1, 1], (x, y) => [.5 - x / W, .5 - y / H], ['x', 'y']],
    ['y', -H / 2, [2, 1], (x, z) => [x / W + .5, z / D + .5], ['x', 'z']],
  ];
  const axis = { x: 0, y: 1, z: 2 };
  for (const [n, at, [col, row], toUv, [a, b]] of faces) {
    g.save();
    g.beginPath(); g.rect(col * ATLAS_CW, row * ATLAS_CH, ATLAS_CW, ATLAS_CH); g.clip();
    for (const { c, r, color } of PATTERNS[breed] || []) {
      const t = (at - c[axis[n]]) / r[axis[n]];
      if (Math.abs(t) >= 1) continue;
      const s = Math.sqrt(1 - t * t), ca = c[axis[a]], cb = c[axis[b]];
      // Tâm và hai bán trục của elip giao, đổi sang pixel của ô.
      const [u0, v0] = toUv(ca, cb), [u1, v1] = toUv(ca + r[axis[a]] * s, cb + r[axis[b]] * s);
      g.fillStyle = cat[color];
      g.beginPath();
      g.ellipse((col + u0) * ATLAS_CW, (row + v0) * ATLAS_CH, Math.abs(u1 - u0) * ATLAS_CW, Math.abs(v1 - v0) * ATLAS_CH, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return (textures[key] = texture);
}
// UV atlas cho thân bo góc (RoundedBoxGeometry: mỗi mặt một dải đỉnh liền nhau theo thứ tự phải, trái, trên, đáy, trước, sau).
// Mỗi mặt chiếu phẳng theo toạ độ gốc của đỉnh vào ô của nó trong atlas; đỉnh ở góc bo chiếu theo cùng công thức rồi kẹp vào ô.
function atlasUvs(geometry) {
  const pos = geometry.attributes.position, uv = geometry.attributes.uv, perSide = pos.count / 6;
  const cells = [[2, 0], [1, 0], [0, 1], [2, 1], [0, 0], [1, 1]]; // phải, trái, trên, đáy, trước, sau
  const clamp01 = v => Math.min(.985, Math.max(.015, v)); // chừa lề: mipmap không hút màu ô bên cạnh
  for (let i = 0; i < pos.count; i++) {
    const side = Math.floor(i / perSide), x = pos.getX(i) / W + .5, y = pos.getY(i) / H + .5, z = pos.getZ(i) / D + .5;
    let u, v; // v: hàng ô tính từ trên xuống
    switch (side) {
      case 0: u = 1 - z; v = 1 - y; break;  // phải: nhìn từ +x, mặt trước (z = 1) ở bên trái ô
      case 1: u = z; v = 1 - y; break;      // trái: mặt trước ở bên phải ô
      case 2: u = x; v = 1 - z; break;      // trên: mặt trước ở mép trên ô
      case 3: u = x; v = z; break;          // đáy
      case 4: u = x; v = 1 - y; break;      // trước
      default: u = 1 - x; v = 1 - y;        // sau
    }
    const [c, r] = cells[side];
    uv.setXY(i, (c + clamp01(u)) / 3, 1 - (r + clamp01(v)) / 2);
  }
}
// ---------- Biểu cảm: ảnh Figma (thân + biểu cảm tách riêng, ui/cat-art.mjs) dán lên mặt trước ----------
// calm mặc định · happy được cưng / vui · cute thỉnh thoảng khi rảnh · sleepy lim dim / ngáp trước khi ngủ · sleep ngủ say, chớp mắt
// angry bị nhấc lơ lửng, bị chạm quá nhiều · chew dạng bực khác (chạm dồn dập, bế lâu)
export const EXPRESSIONS = ['calm', 'happy', 'cute', 'sleepy', 'sleep', 'angry', 'chew', 'blink'];
// Khung ảnh biểu cảm trên tấm mắt, tính theo phần (0..1) của mặt trước: đúng chỗ đặt trên mèo 2D (cat-art.mjs CAT_EXPR_BOX so với
// ảnh thân đặt bằng catBodyPlacement, kể cả ảnh bị kéo riêng như tam thể).
function exprRect(breed) {
  const m = BODY_PX[breed], f = frontPx(m), b = catBodyPlacement(breed, IMG_W, m.h);
  const fx = b.x + m.x0 * b.kx, fy = b.y + m.top * b.ky, fw = f.w * b.kx, fh = f.h * b.ky;
  return { x: (CAT_EXPR_BOX.x - fx) / fw, y: (CAT_EXPR_BOX.y - fy) / fh, w: CAT_EXPR_BOX.size / fw, h: CAT_EXPR_BOX.size / fh };
}
function expressionTexture(breed, expr) {
  const key = `expr:${breed}:${expr}`;
  if (textures[key]) return textures[key];
  const canvas = document.createElement('canvas');
  const m = BODY_PX[breed], front = frontPx(m);
  canvas.width = front.w * 2; canvas.height = front.h * 2;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textures[key] = texture;
  const { x, y, w, h } = exprRect(breed);
  const image = new Image();
  image.onload = () => {
    const art = expr === 'blink' ? closeEyes(image, catLook(breed).ink) : image;
    canvas.getContext('2d').drawImage(art, x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height);
    texture.needsUpdate = true;
  };
  image.src = expr === 'sleep'
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">${SLEEP_FACE}</svg>`)}`
    : catExpressionSrc(breed, expr === 'blink' ? 'calm' : expr);
  return texture;
}
// Chớp mắt: mặt calm của chính giống đó, xoá hai mắt (vùng phía trên miệng + hai bên miệng) rồi vẽ hai nét mắt nhắm cong
// đúng chỗ mắt cũ; miệng giữ nguyên. Trước đây chớp mắt đổi sang mặt 'sleep' vẽ khác hẳn (mất miệng, khác nét) nên mỗi lần
// chớp cả khuôn mặt nháy một cái như bị giật.
function closeEyes(image, ink) {
  const c = document.createElement('canvas'), n = c.width = c.height = 256, g = c.getContext('2d');
  g.drawImage(image, 0, 0, n, n);
  const data = g.getImageData(0, 0, n, n), px = data.data, eyes = [[n, 0, n, 0, 0], [n, 0, n, 0, 0]], stack = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const o = (y * n + x) * 4, side = x < n / 2 ? 0 : 1;
    if (px[o + 3] < 30 || !(y < n * .55 || (y < n * .8 && Math.abs(x - n / 2) > n * .13))) continue;
    const e = eyes[side]; e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], y); e[3] = Math.max(e[3], y); e[4]++;
    px[o + 3] = 0; stack.push(x, y);
  }
  // Phần mắt thò xuống sát miệng (tròng mắt Xiêm / tam thể): xoá tiếp mọi điểm ảnh liền với mắt đã xoá.
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const o = (ny * n + nx) * 4;
      if (nx < 0 || nx >= n || ny < 0 || ny >= n * .85 || px[o + 3] < 30) continue;
      px[o + 3] = 0; stack.push(nx, ny);
    }
  }
  g.putImageData(data, 0, 0);
  g.strokeStyle = ink; g.lineCap = 'round'; g.lineWidth = n * .04;
  for (const [x0, x1, y0, y1, count] of eyes) {
    if (!count) continue;
    const cx = (x0 + x1) / 2, cy = y0 + (y1 - y0) * .6, half = (x1 - x0) * .36;
    g.beginPath(); g.moveTo(cx - half, cy - half * .15); g.quadraticCurveTo(cx, cy + half * .55, cx + half, cy - half * .15); g.stroke();
  }
  return c;
}
// Kiểu mắt mà "não" mèo đặt (face(eyes)) -> biểu cảm Figma: bảng nguyên tắc ở cat-face.mjs (expressionOf).

function zTexture() {
  return canvasTexture('zzz', g => {
    g.strokeStyle = '#7a8fd6'; g.lineWidth = .1;
    g.beginPath(); g.moveTo(.28, .25); g.lineTo(.72, .25); g.lineTo(.28, .75); g.lineTo(.72, .75); g.stroke();
  });
}

// Độ sâu (z, hệ toạ độ thân) của mặt dán (ảnh thân / mắt) tại (x, y): phẳng ở giữa, ôm theo góc bo của thân.
// Góc bo nhỏ (BODY_R) cho khối vuông vức như mèo 2D; tấm dán phủ trọn mặt trước nên ôm hết góc bo, không chìa ra ngoài thân.
const BODY_R = .085;
function frontSurface(x, y) {
  const dx = Math.max(0, Math.abs(x) - (W / 2 - BODY_R)), dy = Math.max(0, Math.abs(y) - (H / 2 - BODY_R));
  return D / 2 - BODY_R + Math.sqrt(Math.max(0, BODY_R * BODY_R - dx * dx - dy * dy));
}

const TAIL_TMP = { tip: new THREE.Vector3() };

// ---------- Biến dạng khi tiếp xúc đồ vật ----------
const SOFT_KEYS = ['spread', 'sag', 'squeeze', 'front'];
const NO_ROPES = [];
// Dây = hình trụ mảnh (bán kính ≤ 2 cm, dài > 15 cm) trong món đồ: dây xích đu, dây võng, dây bóng treo.
function findRopes(node) {
  const ropes = [];
  node.traverse(child => {
    const g = child.isMesh && child.geometry;
    if (g?.type === 'CylinderGeometry' && g.parameters.radiusTop <= .02 && g.parameters.height > .15) ropes.push(child);
  });
  return ropes;
}
// Võng vải = nửa ống trụ hở (openEnded, thetaLength < 2π, bán kính > 20 cm). Toạ độ của mesh: trục ống = trục y.
function findTrough(node) {
  let found = null;
  node.traverse(child => {
    const g = child.isMesh && child.geometry, pr = g?.parameters;
    if (!found && g?.type === 'CylinderGeometry' && pr.openEnded && pr.thetaLength < Math.PI * 1.5 && pr.radiusTop > .2) found = child;
  });
  return found;
}
// Điểm thân (hệ toạ độ thân) nằm ngoài mặt vải -> kéo vào đúng mặt vải (theo hướng bán kính của ống).
// Chỉ phần nằm phía lòng vải (cùng phía cung vải, xem thetaStart/thetaLength) mới bị giữ; phía miệng võng hở thì thôi.
const T_P = new THREE.Vector3();
function holdInTrough(p, t, lift = 0) {
  T_P.copy(p).applyMatrix4(t.toCloth);
  const d = Math.hypot(T_P.x, T_P.z), r = t.r - lift;
  if (d <= r) return;
  // CylinderGeometry: điểm trên cung ở góc θ có x = r·sinθ, z = r·cosθ. Giữa cung vải (t.mx, t.mz): phía ngược lại là miệng võng.
  if (T_P.x * t.mx + T_P.z * t.mz < 0) return;
  T_P.x *= r / d; T_P.z *= r / d;
  p.copy(T_P.applyMatrix4(t.toBody));
}
// Khoảng cách gần đúng từ đoạn dây tới hộp thân (lấy mẫu 9 điểm dọc dây).
const TMP_P = new THREE.Vector3();
function segToBoxGap(a, b) {
  let best = Infinity;
  for (let k = 0; k <= 8; k++) {
    TMP_P.lerpVectors(a, b, k / 8);
    const dx = Math.max(0, Math.abs(TMP_P.x) - W / 2), dy = Math.max(0, Math.abs(TMP_P.y) - H / 2), dz = Math.max(0, Math.abs(TMP_P.z) - D / 2);
    best = Math.min(best, Math.hypot(dx, dy, dz));
  }
  return best;
}
// Dây căng ấn vào thân: điểm thân nào nằm trong tiết diện dây (hoặc ngay sát, phần "vai" của rãnh) bị đẩy về phía
// tâm thân tới mép trong của dây -> thành một rãnh lõm ôm đúng sợi dây.
const ROPE_SOFT = .14, ROPE_MAX = .11; // bề rộng vùng bị dây bóp, độ lõm tối đa (m)
const R_U = new THREE.Vector3(), R_Q = new THREE.Vector3(), R_N = new THREE.Vector3(), R_C = new THREE.Vector3();
function dentByRopes(p, ropes) {
  for (const { a, b, r } of ropes) {
    R_U.subVectors(b, a);
    const len2 = R_U.lengthSq(), t = R_Q.subVectors(p, a).dot(R_U) / len2;
    if (t < 0 || t > 1) continue;
    R_C.copy(a).addScaledVector(R_U, t);             // điểm trên dây gần p nhất
    R_U.multiplyScalar(1 / Math.sqrt(len2));
    R_N.copy(R_C).multiplyScalar(-1);                 // hướng dây ép vào: từ dây về tâm thân, vuông góc với dây
    R_N.addScaledVector(R_U, -R_N.dot(R_U));
    if (R_N.lengthSq() < 1e-8) R_N.set(0, -1, 0); else R_N.normalize();
    R_Q.subVectors(p, R_C);
    const inward = R_Q.dot(R_N), side = Math.sqrt(Math.max(0, R_Q.lengthSq() - inward * inward));
    // Vùng bị bóp rộng hơn sợi dây nhiều: thân mềm bị dây thắt vào thành một chỗ lõm thoai thoải, sát dây sâu nhất.
    const shoulder = ROPE_SOFT;
    if (side >= shoulder) continue;
    const target = side < r ? Math.sqrt(r * r - side * side) : 0; // phải nằm phía trong mép dây
    if (inward >= target) continue;
    const k = side < r ? 1 : 1 - (side - r) / (shoulder - r), fall = k * k * (3 - 2 * k);
    p.addScaledVector(R_N, Math.min(ROPE_MAX, (target - inward) * fall));
  }
}


// Tai: khối tam giác bo tròn mọi góc (đùn có vát mép tròn), dáng / chỗ đặt lấy theo tai trái trong ảnh thân (BODY_PX apex, ear),
// tai phải lật theo trục dọc giữa ảnh. Lòng tai là tam giác bo tròn nhỏ hơn, một màu phẳng.
// Chân tai cắm sâu EAR_SINK vào trong thân: tai giật / cụp / nghiêng (xoay quanh gốc) hay thân bị nhấc lắc lư thì chân tai
// vẫn nằm trong thân, không hở khe giữa tai và đầu.
const EAR_DEPTH = .05, EAR_BEVEL = .014, EAR_SINK = .08, EAR_BACK = .045; // EAR_BACK: mặt trước tai lùi sau mặt trước thân
function roundedPolygon(points, radius) {
  const shape = new THREE.Shape(), n = points.length;
  const corner = k => {
    const p = points[k], a = points[(k + n - 1) % n], b = points[(k + 1) % n];
    const da = p.distanceTo(a), db = p.distanceTo(b), r = Math.min(radius, da * .45, db * .45);
    return [p, p.clone().lerp(a, r / da), p.clone().lerp(b, r / db)];
  };
  points.forEach((_, k) => {
    const [p, from, to] = corner(k);
    if (k === 0) shape.moveTo(from.x, from.y); else shape.lineTo(from.x, from.y);
    shape.quadraticCurveTo(p.x, p.y, to.x, to.y);
  });
  shape.closePath();
  return shape;
}
function earGeometries(breed, side) {
  const m = BODY_PX[breed], fw = m.x1 - m.x0, scale = W / fw, mid = (m.x0 + m.x1) / 2;
  // px -> mét, gốc ở giữa đỉnh thân; chân tai ngoài kẹp vào trong góc bo của thân.
  const toM = ([x, y]) => new THREE.Vector2(side * -(x - mid) * scale, (m.top - y) * scale);
  let [outer, apex, inner] = [[m.ear[0], m.top], m.apex, [m.ear[1], m.top]].map(toM);
  apex.multiplyScalar(1.15); // tai 3D nhìn từ trên cao bị ngắn lại: nhô cao hơn ảnh 2D một chút
  const edge = W / 2 - BODY_R - EAR_BEVEL;
  outer.x = side * Math.min(Math.abs(outer.x), edge);
  const cx = (outer.x + inner.x) / 2;
  [outer, apex, inner].forEach(p => { p.x -= cx; });
  const tri = [new THREE.Vector2(outer.x, -EAR_SINK), outer, apex, inner, new THREE.Vector2(inner.x, -EAR_SINK)];
  const solid = new THREE.ExtrudeGeometry(roundedPolygon(tri, .05), {
    depth: EAR_DEPTH - 2 * EAR_BEVEL, bevelEnabled: true, bevelThickness: EAR_BEVEL, bevelSize: EAR_BEVEL, bevelSegments: 4, curveSegments: 10,
  });
  solid.translate(0, 0, -(EAR_DEPTH - EAR_BEVEL)); // mặt trước khối ở z = 0
  solid.computeVertexNormals();
  // Lòng tai: tam giác chân tai – chóp co về trọng tâm, hạ xuống một chút cho dày vành tai phía trên.
  const g = new THREE.Vector2().add(outer).add(apex).add(inner).divideScalar(3);
  const pink = [outer, apex, inner].map(p => p.clone().sub(g).multiplyScalar(.56).add(g).add(new THREE.Vector2(0, -.012)));
  const front = new THREE.ShapeGeometry(roundedPolygon(pink, .03), 8);
  front.translate(0, 0, .003);
  return { front, solid, x: cx };
}

// Đệm mèo dưới lòng bàn chân: 1 đệm lớn hình tim tròn + 4 hạt đậu ngón ở phía trước, dán theo mặt dưới của bàn chân
// (khối cầu bán kính FOOT_R trong hệ toạ độ bàn chân, trước khi bàn chân bị nén dẹt). Chỉ thấy khi nhấc chân lên:
// lúc bước, nằm ngửa lăn lộn, bị nhấc bổng, quơ vuốt.
const FOOT_R = .085, LEG_SHAFT = .13; // LEG_SHAFT: chiều cao gốc của ống chân (co giãn bằng scale.y)
const BEANS = [[0, -.02, .034, .9], [-.042, .03, .017, .8], [-.015, .045, .016, .9], [.015, .045, .016, .9], [.042, .03, .017, .8]]; // [x, z, bán kính, độ dẹt ngang]
const beanGeo = new THREE.SphereGeometry(1, 14, 10);
function toeBeans(material) {
  return BEANS.map(([x, z, r, wide]) => {
    const bean = new THREE.Mesh(beanGeo, material);
    const y = -Math.sqrt(Math.max(0, FOOT_R * FOOT_R - x * x - z * z)) + r * .35; // lún một phần vào bàn chân
    bean.position.set(x, y, z);
    bean.scale.set(r * wide, r * 1.1, r); // bàn chân nén y còn .42 -> đệm thành hạt dẹt nằm sát lòng bàn chân
    bean.userData.noOutline = true; // chỉ là mảng màu, không viền
    return bean;
  });
}

// ---------- Đuôi: mỗi giống một kiểu ----------
// n đốt dài `seg`, bán kính từ gốc r0 tới chóp r1 (fluff = phình giữa như đuôi xù); ring = màu khoanh xen kẽ;
// tipColor/tipFrom = chóp khác màu; pom/tuft = cục bông / chùm lông ở chóp; hook = chóp cong móc câu khi dựng đuôi;
// wag / speed / stiff = biên độ, nhịp vẫy, độ cứng lò xo; bend / lag = độ uốn mỗi đốt, độ trễ sóng giữa các đốt.
const TAIL_STYLES = {
  orange: { n: 6, seg: .085, r0: .047, r1: .03, ring: 'stripe', hook: .7 },                           // vằn khoanh, chóp móc dấu hỏi
  gray: { n: 2, seg: .06, r0: .05, r1: .05, pom: .1, hook: 0, wag: 1.5, speed: 1.7, stiff: 2, bend: .5, lag: .4 }, // đuôi cộc + cục bông, ngoáy tít
  white: { n: 7, seg: .085, r0: .046, r1: .056, fluff: true, tuft: .07, wag: .75, speed: .7, stiff: .7 },  // dài xù như chùm lông, phẩy chậm
  tuxedo: { n: 6, seg: .085, r0: .044, r1: .032, tipColor: 'belly', tipFrom: 5, wag: 1.1, speed: 1.25, stiff: 1.25 }, // đen chóp trắng, giật nhanh
  siamese: { n: 8, seg: .08, r0: .036, r1: .017, hook: .25, wag: 1.2, stiff: .85 },                    // roi dài mảnh màu sẫm, quất mềm
  tabby: { n: 6, seg: .088, r0: .058, r1: .064, ring: 'stripe', fluff: true, tuft: .068, tipColor: 'stripe', tipFrom: 6, wag: .85, speed: .85, stiff: .85 }, // to xù khoanh kiểu gấu mèo
};
function tailStyle(breed) {
  const style = { n: 5, seg: .1, r0: .045, r1: .025, wag: 1, speed: 1, stiff: 1, hook: .4, ...TAIL_STYLES[breed] };
  style.bend ??= 4 / Math.max(1, style.n - 1); // nhiều đốt thì mỗi đốt uốn ít lại, dáng tổng thể giữ như đuôi 5 đốt gốc
  style.lag ??= 3 / Math.max(1, style.n - 1);
  return style;
}

// ---------- Bộ khung một con mèo ----------
function buildRig(breed) {
  EXPRESSIONS.forEach(expr => expressionTexture(breed, expr)); // nạp sẵn mọi biểu cảm: lần đổi mặt đầu không bị trống
  const cat = catLook(breed);
  // Lông: nhám hoàn toàn, phản xạ thấp, thêm "sheen" (ánh mềm ở mép như lông/nhung thật) thay cho đốm bóng kiểu nhựa.
  const furMat = color => TOON ? toonMat({ color }) : new THREE.MeshPhysicalMaterial({ color, roughness: 1, metalness: 0, specularIntensity: .08,
    sheen: .25, sheenRoughness: .9, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .2) }); // dịu, không loá mép
  const fur = furMat(cat.fur);
  const accent = furMat(cat.ear || cat.mask || cat.fur); // tai / đuôi (calico: đen)
  const paw = furMat(cat.paw);
  // Đệm thịt lòng bàn chân: hồng với bàn chân sáng màu, hồng nâu với bàn chân sẫm (Xiêm).
  const beanColor = new THREE.Color(cat.paw).getHSL({}).l < .5 ? '#c27d8a' : '#f59ab0';
  const beanMat = TOON ? toonMat({ color: beanColor }) : new THREE.MeshPhysicalMaterial({ color: beanColor, roughness: .7, specularIntensity: .4 });
  // Mèo không nhận bóng đổ (kể cả bóng của chính tai/đuôi hay đồ đạc): thân luôn sạch màu kiểu tranh vẽ; vẫn đổ bóng xuống sàn.
  const mesh = (geometry, material, shadow = true) => { const m = new THREE.Mesh(geometry, material); m.castShadow = shadow; m.receiveShadow = false; return m; };

  const root = markOutlineUnit(new THREE.Group()); // vị trí + hướng; cả con mèo là một khối viền (tai/chân/đuôi đè lên thân thì nét mờ)
  root.userData.outlineStyle = 'cat'; // viền mèo dày và đậm hơn đồ vật (toon.mjs OUTLINE_STYLES.cat)
  const hopper = new THREE.Group();        // nảy / nhún / run
  const roller = new THREE.Group();        // lăn nghiêng
  const pivot = new THREE.Group();         // chúi / ngửa quanh mép sau-dưới thân
  root.add(hopper); hopper.add(roller); roller.add(pivot);
  pivot.position.set(0, LEG, -D / 2);
  const bodyGeo = roundedBox(W, H, D, 10, BODY_R); // lưới dày: đủ điểm để dây ấn thành rãnh mảnh
  atlasUvs(bodyGeo);
  const body = mesh(bodyGeo, TOON ? toonMat({ color: '#ffffff', map: bodyAtlas(breed) }) : new THREE.MeshPhysicalMaterial({ map: bodyAtlas(breed), roughness: 1, specularIntensity: .08 }));
  body.position.set(0, H / 2, D / 2);
  pivot.add(body);

  // Mặt / mắt chỉ nổi vài mm trên thân: zoom xa thì sai số depth (~3.5 mm ở khoảng cách ~77) lớn hơn khoảng nổi, thân che
  // mất mặt. polygonOffset kéo tấm dán về phía camera theo độ dốc + một lượng cố định -> luôn nằm trên thân, mọi góc / khoảng cách.
  const DECAL_OFFSET = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 };
  const eyesMat = new THREE.MeshBasicMaterial({ map: expressionTexture(breed, 'calm'), transparent: true, alphaTest: .02, depthWrite: false, ...DECAL_OFFSET });
  // Mắt là tấm lưới mịn dán ÔM lên mặt trước bo tròn của thân (không phải tấm phẳng lơ lửng), và mỗi frame
  // uốn theo đúng phép biến dạng của thân (jelly), nên nhìn nghiêng hay thân đang lắc thì mắt vẫn dính vào thân.
  // Phần còn lại của mặt (mõm, vằn, bụng) đã nằm trong texture thân (bodyAtlas).
  const eyes = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 20, 16), eyesMat);
  [[eyes, .006]].forEach(([decal, lift]) => {
    decal.position.copy(body.position); // toạ độ đỉnh tính trong hệ toạ độ thân
    decal.userData.flat = Float32Array.from(decal.geometry.attributes.position.array);
    decal.userData.lift = lift;
    decal.frustumCulled = false;
  });
  pivot.add(eyes);

  // Lòng tai hồng (Xiêm: hồng cam đất); không dán ảnh 2D (có shading vát cạnh).
  const earArtMat = TOON ? toonMat({ color: cat.earInner || '#f49aae' }) : new THREE.MeshLambertMaterial({ color: cat.earInner || '#f49aae' });
  earArtMat.polygonOffset = true; earArtMat.polygonOffsetFactor = -2; earArtMat.polygonOffsetUnits = -8;
  const ears = [-1, 1].map(side => {
    const ear = new THREE.Group(), geo = earGeometries(breed, side);
    const outer = mesh(geo.solid, accent);
    outer.userData.outlineStyle = 'catEar'; // viền tai (toon.mjs OUTLINE_STYLES)
    const art = new THREE.Mesh(geo.front, earArtMat);
    art.userData.noOutline = true; // ảnh vành tai / lòng tai: chỉ là mảng màu, không viền
    ear.add(outer, art);
    // Mặt trước tai lùi EAR_BACK sau mặt trước thân (chỗ nóc đầu đã phẳng, qua góc bo); gốc tai ở đỉnh thân, chân cắm sâu vào thân.
    ear.position.set(geo.x, H, D - EAR_BACK);
    pivot.add(ear);
    return ear;
  });

  // Đuôi: chuỗi đốt, đốt sau là con của đốt trước để uốn cong mềm. Hình dáng theo giống (TAIL_STYLES).
  const style = tailStyle(breed), tail = [], tailParts = [];
  const ringMat = style.ring && cat[style.ring] ? furMat(cat[style.ring]) : null;
  const tipMat = style.tipColor ? furMat(cat[style.tipColor] || cat.fur) : null;
  const tipFrom = style.tipFrom ?? style.n;
  let parent = pivot;
  for (let i = 0; i < style.n; i++) {
    const joint = new THREE.Group();
    const k = i / Math.max(1, style.n - 1);
    const r = (style.r0 + (style.r1 - style.r0) * k) * (style.fluff ? 1 + .3 * Math.sin(k * Math.PI) : 1);
    const material = tipMat && i >= tipFrom ? tipMat : ringMat && i % 2 ? ringMat : accent;
    const seg = mesh(new THREE.CapsuleGeometry(r, style.seg * .7, 6, 14), material);
    seg.position.y = style.seg / 2;
    joint.add(seg);
    tailParts.push(seg);
    if (i === 0) joint.position.set(0, H * .3, .02); else joint.position.y = style.seg;
    parent.add(joint);
    tail.push(joint);
    parent = joint;
  }
  if (style.pom || style.tuft) { // chóp: cục bông tròn (đuôi cộc) hoặc chùm lông thuôn dài
    const tip = mesh(new THREE.SphereGeometry(style.pom || style.tuft, 16, 12), tipMat || accent);
    tip.position.y = style.seg * (style.pom ? .7 : 1);
    if (style.tuft) tip.scale.set(1, 1.45, 1);
    parent.add(tip);
    tailParts.push(tip);
  }
  tailParts.forEach(part => { part.userData.baseScale = part.scale.clone(); });

  // Chân: khớp ở trên, khối chân thò xuống; bàn chân màu riêng.
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const hip = new THREE.Group();
    hip.position.set(sx * W * .3, LEG + .03, sz * D * .3);
    // Chân tròn mũm mĩm: ống trụ tròn (đầu trên chìm trong thân, đầu dưới bị bàn chân che) + bàn chân là "cục bông" dẹt.
    // Ống trụ kéo dài theo y vẫn tròn đều (không méo góc bo như hộp bo góc khi kéo).
    const leg = mesh(new THREE.CylinderGeometry(.066, .07, LEG_SHAFT, 20, 1, true), cat.mask ? accent : fur);
    leg.scale.y = (LEG + .03) / LEG_SHAFT; leg.position.y = .03 - (LEG + .03) / 2;
    const foot = mesh(new THREE.SphereGeometry(FOOT_R, 20, 12), paw);
    foot.scale.set(1, .42, 1.12); // bàn chân tròn dẹt, hơi dài về trước
    foot.add(...toeBeans(beanMat));
    foot.position.set(0, -(LEG + .03) + .03, .015);
    hip.add(leg, foot);
    // Gắn vào roller (cùng nhánh với thân): thân nghiêng / lắc / nảy thì chân theo, không choãi ra ngoài thân.
    roller.add(hip);
    return { hip, leg, foot, front: sz > 0 };
  });

  const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthWrite: false }));
  z.scale.set(.28, .25, 1); z.visible = false;
  root.add(z);
  root.traverse(node => { node.userData.catRoot = root; });
  // Thân mềm: giữ toạ độ gốc của từng đỉnh thân + vị trí gốc của mặt/tai để mỗi frame uốn lại theo độ lắc (Cat.jelly).
  const bodyBase = Float32Array.from(body.geometry.attributes.position.array);
  const rest = ears.map(node => [node, node.position.clone()]);
  return { bodyBase, rest, root, hopper, roller, pivot, body, eyes, eyesMat, ears, tail, tailParts, tailStyle: style, legs, z };
}

// Lò xo thân mềm theo từng trục: [độ cứng, tỉ lệ tắt, độ nhạy với gia tốc (1 = khối thật: lệch ≈ gia tốc ÷ độ cứng), độ lệch tối đa (m)].
// Tắt vừa (zeta ~.3): va chạm thì lắc 1–2 nhịp rồi đứng yên (zeta .14 cũ rung quá nhiều nhịp, trông như lắc mãi);
// trục dọc cứng hơn để không trông như bóng nước.
// SMOOTH = hằng số thời gian (s) lọc gia tốc (bỏ rung do frame dài ngắn không đều); BELLY = độ phình eo khi lún.
const JELLY = {
  x: [210, .3, .9, .08], z: [210, .3, 1, .09], y: [520, .34, .5, .05], MAX_ACC: 60, SMOOTH: .05, BELLY: .6,
  tmpPos: new THREE.Vector3(), tmpVel: new THREE.Vector3(), tmpAcc: new THREE.Vector3(), tmpQ: new THREE.Quaternion(),
  tmpV: new THREE.Vector3(), tmpM: new THREE.Matrix4(),
};

// ---------- Một con mèo: thân thể + não ----------
class Cat {
  constructor(world, breed, x, z) {
    this.world = world;
    this.breed = breed;
    this.rig = buildRig(breed);
    this.x = x; this.z = z; this.y = 0;
    this.heading = rand(0, TAU); this.yaw = this.heading; // heading = hướng logic; yaw = hướng hiển thị bám theo bằng lò xo
    this.speed = 0; this.gait = rand(0, TAU); this.running = false;
    this.pose = { sit: 0, lie: 0, curl: 0, stretch: 0, roll: 0, lean: 0, paw: 0, groom: 0, knead: 0, tailUp: .4 };
    this.goal = { ...this.pose };
    this.mouth = 'calm'; this.eyes = 'open'; this.look = 0; this.lookGoal = 0;
    this.sleeping = false; this.surface = null; this.airY = 0; this.squash = 0;
    this.nextBlink = rand(1, 4); this.nextEar = rand(1, 5); this.earTwitch = 0; this.tailSpeed = 1.6; this.tailWag = .25;
    this.petUntil = 0; this.purr = 0; this.busyWith = null;
    this.move = 0; this.lid = 1; this.earFlop = 0; this.swayF = 0; this.swayL = 0; this.lean = 0; this.lastY = 0; this.airK = null; this.hopY = 0;
    const segs = this.rig.tail.length;
    this.tailZ = new Array(segs).fill(0); this.tailX = new Array(segs).fill(0); this.phase = rand(0, TAU);
    this.soft = { spread: 0, sag: 0, squeeze: 0, front: 0 }; this.contact = {}; // biến dạng do đồ vật: hiện tại / đích
    this.jig = new THREE.Vector3(); this.bend = new THREE.Vector3(); this.jigV = new THREE.Vector3(); this.lastBodyPos = null; this.lastBodyVel = new THREE.Vector3();
    this.wrap = 0; this.wrapSide = chance(.5) ? 1 : -1; this.puff = 0; this.rub = 0; // quấn đuôi quanh chân · xù đuôi · dụi người
    this.brain = this.life();
    this.rig.root.userData.cat = this;
    world.scene.add(this.rig.root);
  }
  dispose() { this.brain?.return(); this.world.scene.remove(this.rig.root); }

  // ----- Tư thế: đặt đích, thân tự chuyển mượt tới -----
  setPose(name, extra = {}) {
    const presets = {
      stand: {}, sit: { sit: 1 }, loaf: { lie: 1 }, curl: { lie: 1, curl: 1 }, crouch: { lie: .5 },
      stretch: { stretch: 1 }, roll: { lie: 1, roll: 1 }, knead: { sit: .5, knead: 1 },
    };
    const tailUp = this.goal.tailUp;
    this.goal = { sit: 0, lie: 0, curl: 0, stretch: 0, roll: 0, lean: 0, paw: 0, groom: 0, knead: 0, tailUp, ...presets[name], ...extra };
  }
  // eyes: một trong EYES của cat-face.mjs (mỗi giá trị đúng một mặt Figma); mouth chỉ có 'yawn' (đi với 'sleep' = ngáp)
  face(eyes, mouth = 'calm') { this.eyes = eyes; this.mouth = mouth; }
  interruptible() { return !this.busyWith && !this.sleeping && !this.napping && this.y < .01 && !this.social && !this.carried; } // napping: đang trở mình giữa hai giấc AFK thì đừng rủ chơi
  interrupt(brain) { const old = this.brain; this.brain = brain; old?.return(); this.speed = 0; this.running = false; this.contact = {}; }
  // Mở màn tương tác đôi: ngắt não bạn TRƯỚC rồi mới gắn cặp (finally của não cũ xoá social/partner,
  // làm ngược thứ tự thì các vòng lặp kiểm tra other.social, như chase, thoát ngay từ đầu).
  pair(other, kind, reaction) { other.interrupt(reaction); this.social = other.social = kind; this.partner = other; other.partner = this; }

  // ----- Các nhịp cơ bản (generator, yield = chờ frame sau) -----
  *wait(seconds) { for (let t = 0; t < seconds; t += this.world.dt) yield; }
  *turnTo(heading, rate = 5) {
    while (Math.abs(angDiff(this.heading, heading)) > .04) { this.turnToward(heading, rate); this.stepGait(.45); yield; }
    // chờ thân (yaw) quay kịp rồi mới làm việc tiếp, để không vừa quay vừa làm
    for (let t = 0; t < .4 && Math.abs(angDiff(this.yaw, this.heading)) > .08; t += this.world.dt) yield;
  }
  turnToward(heading, rate) {
    const diff = angDiff(this.heading, heading);
    this.heading += clamp(diff, -rate * this.world.dt, rate * this.world.dt);
  }
  facing(x, z) { return Math.atan2(x - this.x, z - this.z); }
  // Đẩy món đồ có phần treo (con lắc: xích đu lốp, bóng treo cây cho mèo) theo hướng mèo đang nhìn.
  kick(node, speed) { node.userData.swing?.userData.kick(-Math.cos(this.heading) * speed, Math.sin(this.heading) * speed); } // quay x âm = bóng ra +z, quay z dương = ra +x
  // Tâm khu mèo đang đứng (vườn / phòng khách) và hướng nhìn về đó.
  home() { return zoneHome(this.world.zoneAt(this.x, this.z)); }
  facingHome() { const home = this.home(); return this.facing(home.x, home.z); }
  // Bước tại chỗ (lúc xoay người): nhịp chân chậm, chân nhấc thấp.
  stepGait(amount) { this.gait += this.world.dt * 7 * amount; this.shuffle = Math.max(this.shuffle || 0, amount); }

  // Thời gian đi bộ thẳng tới (x, z) (giây), cộng dư cho đoạn lách vật cản.
  travelTime(x, z, run = false, pace = 1) { return 1 + 1.6 * Math.hypot(x - this.x, z - this.z) / ((run ? 2.1 : .72) * pace); }
  // Chỗ lách khi kẹt giữa các vật cản: điểm cách 1.1 m (rồi 1.8 m) theo một hướng chếch khỏi hướng tới đích, cả đoạn đường tới
  // đó nằm trong vùng đi được (không xuyên rào / tường sang khu bên cạnh) và thoáng vật cản, gần đích nhất; tránh quay
  // lại chỗ vừa lách. null nếu không có.
  detourSpot(tx, tz, ignore) {
    const goal = Math.atan2(tx - this.x, tz - this.z), obs = this.world.obstacles(ignore);
    const clear = (x, z) => Math.min(9, ...obs.map(ob => Math.hypot(x - ob.x, z - ob.z) - ob.r));
    // Điểm đi được (cho trượt dọc rào / tường tới .3 m); ra xa hơn là xuyên rào sang khu bên cạnh.
    const walkable = (x, z) => { const b = this.world.bound(x, z); return Math.hypot(b.x - x, b.z - z) < .3 ? b : null; };
    let best = null, bestD = Infinity;
    for (const reach of [1.1, 1.8]) {
      for (const turn of [.6, -.6, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
        const a = goal + turn, p = walkable(this.x + Math.sin(a) * reach, this.z + Math.cos(a) * reach);
        const mid = p && { x: (p.x + this.x) / 2, z: (p.z + this.z) / 2 };
        if (!p || !walkable(mid.x, mid.z)) continue;
        if (clear(p.x, p.z) < .35 || clear(mid.x, mid.z) < .25) continue;
        const back = this.lastDetour && Math.hypot(p.x - this.lastDetour.x, p.z - this.lastDetour.z) < .5 ? 2 : 0;
        const d = Math.hypot(tx - p.x, tz - p.z) + back;
        if (d < bestD) { best = p; bestD = d; }
      }
      if (best) break;
    }
    return (this.lastDetour = best);
  }
  // Kẹt sát đồi (góc giữa đồi và rào, không còn chỗ lách): nhảy từng chặng ngắn qua đồi, bám theo mặt đồi, xuống phía
  // chân đồi gần đích (tx, tz). false nếu không kẹt cạnh đồi.
  *hopOverHill(tx, tz) {
    const hill = this.world.hill();
    if (!hill || Math.hypot(this.x - hill.x, this.z - hill.z) > hill.r + 1.2) return false;
    let dx = tx - hill.x, dz = tz - hill.z;
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const end = this.world.reachable(hill.x + dx * (hill.r + .45), hill.z + dz * (hill.r + .45));
    const x0 = this.x, z0 = this.z, hops = Math.max(3, Math.ceil(Math.hypot(end.x - x0, end.z - z0) / .8));
    for (let i = 1; i <= hops; i++) { // chặng ngắn: sườn đồi lồi không cao quá đường nhảy (mèo không xuyên sườn)
      const x = x0 + (end.x - x0) * i / hops, z = z0 + (end.z - z0) * i / hops;
      yield* this.jumpTo(x, this.world.groundAt(x, z), z);
    }
    this.y = this.world.groundAt(this.x, this.z);
    return true;
  }
  // pace: hệ số tốc độ; glide: không phanh về 0 khi hết maxTime (gọi nối tiếp từng đoạn ngắn để bám theo con khác mà không khựng).
  // maxTime: giới hạn chống kẹt — đi bình thường (không glide) thì ít nhất đủ thời gian tới đích (vườn mở rộng dài 16 m).
  *walkTo(tx, tz, { run = false, near = .08, ignore = null, maxTime = 8, pace = 1, glide = false, direct = false } = {}) {
    // Đích ở khu khác: đi tới cửa, qua lối cửa (có thể qua khu giữa), rồi mới tới đích (không đi xuyên tường / hàng rào).
    const from = this.world.zoneAt(this.x, this.z), to = this.world.zoneAt(tx, tz);
    if (!direct && from !== to) {
      const route = zoneRoute(from, to, this.world.zones());
      for (let i = 1; i < route.length; i++) {
        const pass = passBetween(route[i - 1], route[i]);
        if (pass.open) continue; // lối thông thoáng (vườn <-> phần mở rộng): đi thẳng, không vòng qua cửa
        for (const step of [pass.steps[route[i - 1]], pass.steps[route[i]]]) {
          yield* this.walkTo(step.x, step.z, { run, near: .2, ignore, maxTime: Math.max(6, this.travelTime(step.x, step.z, run, pace)), pace, glide: true, direct: true });
        }
      }
    }
    this.setPose('stand', { tailUp: run ? .9 : this.goal.tailUp });
    this.running = run;
    let elapsed = 0;
    const limit = glide ? maxTime : Math.max(maxTime, this.travelTime(tx, tz, run, pace));
    // Chống kẹt: mỗi 1.2 giây phải lại gần đích thêm ≥ .25 m; không thì (vd. kẹt giữa khóm hoa và chân đồi, rung rinh
    // tại chỗ) lách sang bên thoáng rồi đi tiếp. Kẹt liền hai lần mà đang sát đồi (góc giữa đồi và rào): nhảy qua đồi.
    let mark = Infinity, stall = 0, fails = 0;
    while (elapsed < limit) {
      const dt = this.world.dt;
      elapsed += dt;
      const dx = tx - this.x, dz = tz - this.z, dist = Math.hypot(dx, dz);
      if (dist < near) break;
      if ((stall += dt) > 1.2) {
        const stuck = mark - dist < .25 && dist > .6 && limit > 2;
        mark = dist; stall = 0; fails = stuck ? fails + 1 : 0;
        if (stuck) {
          const from = this.world.time; // thời gian lách / nhảy cũng tính vào giới hạn chống kẹt
          let moved = fails >= 2 && (yield* this.hopOverHill(tx, tz));
          if (!moved) {
            const spot = this.detourSpot(tx, tz, ignore);
            if (spot) { yield* this.walkTo(spot.x, spot.z, { run, near: .15, ignore, maxTime: 1.8, pace, glide: true, direct: true }); moved = true; }
            else moved = yield* this.hopOverHill(tx, tz);
          }
          if (moved) { this.setPose('stand', { tailUp: run ? .9 : this.goal.tailUp }); elapsed += this.world.time - from; mark = Infinity; }
          continue;
        }
      }
      let vx = dx / dist, vz = dz / dist;
      // Tránh đồ đạc: đẩy ra khỏi vật cản + lách vòng theo tiếp tuyến.
      for (const ob of this.world.obstacles(ignore)) {
        const ox = this.x - ob.x, oz = this.z - ob.z, d = Math.hypot(ox, oz) || .001, reach = ob.r + .42;
        if (d < reach) {
          const push = (reach - d) / reach * 2.4;
          // Lách vòng phía gần (phía mèo đang lệch so với đường thẳng qua tâm vật cản). Lách phía xa làm mèo cắt ngang
          // trước mặt vật cản, lệch qua lại quanh đường thẳng đó rồi kẹt.
          const side = -(Math.sign(vx * oz - vz * ox) || 1);
          vx += (ox / d) * push + (-oz / d) * side * push * .8;
          vz += (oz / d) * push + (ox / d) * side * push * .8;
        }
      }
      for (const other of this.world.cats) {
        if (other === this || other.y > .01) continue;
        const ox = this.x - other.x, oz = this.z - other.z, d = Math.hypot(ox, oz) || .001;
        if (d < .62 && other !== this.partner) { vx += (ox / d) * (.62 - d) * 3; vz += (oz / d) * (.62 - d) * 3; }
      }
      const want = Math.atan2(vx, vz);
      this.turnToward(want, run ? 9 : 6);
      const align = Math.max(0, Math.cos(angDiff(this.heading, want)));
      const top = (run ? 2.1 : .72) * pace, slow = clamp(dist / .5, .35, 1);
      this.speed = damp(this.speed, top * align * slow, 6, dt);
      const next = this.world.bound(this.x + Math.sin(this.heading) * this.speed * dt, this.z + Math.cos(this.heading) * this.speed * dt);
      // Đang đứng trên mặt đất thì đi theo mặt đất thật (chân đồi thoải), không xuyên vào sườn đồi.
      const onGround = Math.abs(this.y - this.world.groundAt(this.x, this.z)) < .02;
      this.x = next.x; this.z = next.z;
      if (onGround) this.y = this.world.groundAt(this.x, this.z);
      this.gait += (this.speed * dt / (run ? STRIDE_RUN : STRIDE_WALK)) * TAU;
      yield;
    }
    if (!glide) { this.speed = 0; this.running = false; }
  }

  // Nhảy: hạ người lấy đà (cao thì hạ sâu + lắc mông) -> vươn người bật lên -> bay parabol,
  // chân sau duỗi ra sau, chân trước vươn tới đón đất -> tiếp đất nhún nảy, tai cụp.
  *jumpTo(tx, ty, tz) {
    yield* this.turnTo(this.facing(tx, tz), 7);
    const x0 = this.x, y0 = this.y, z0 = this.z, rise = Math.max(0, ty - y0), drop = Math.max(0, y0 - ty);
    const dist = Math.hypot(tx - x0, tz - z0);
    this.setPose('crouch', { lie: .55 + Math.min(.3, rise * .18) });
    this.wriggle = rise > .6 ? 1 : 0;
    yield* this.wait(.24 + Math.min(.32, rise * .16));
    this.wriggle = 0;
    this.squash = -.45; this.squashV = 0; // vươn dài người lúc bật
    this.setPose('stand', { stretch: .3 });
    const duration = .36 + dist * .1 + rise * .11 + drop * .05, apex = .18 + rise * .28 + dist * .07;
    for (let t = 0; t < duration; t += this.world.dt) {
      const k = Math.min(1, t / duration), across = k * .75 + k * k * (3 - 2 * k) * .25;
      this.x = x0 + (tx - x0) * across; this.z = z0 + (tz - z0) * across;
      this.y = y0 + (ty - y0) * k + 4 * apex * k * (1 - k);
      this.airK = k;
      this.airPitch = -(.5 - k) * .95 * Math.sin(Math.PI * k); // ngửa lúc lên, chúi lúc xuống
      yield;
    }
    this.x = tx; this.y = ty; this.z = tz; this.airPitch = 0; this.airK = null;
    this.squash = .75 + Math.min(.4, drop * .2); this.squashV = 0; // tiếp đất: nhún rồi nảy lại
    this.earFlopV = (this.earFlopV || 0) + 14;
    if (drop > .6) this.world.notice(tx, tz, { except: this, radius: 2.4 });
    this.setPose('stand');
    yield* this.wait(.24);
  }
  *getDown() {
    const surface = this.surface, from = surface ? this.world.center(surface) : { x: this.x, z: this.z, r: .6 };
    // Rời món đồ đang đung đưa / xoay (ghế bập bênh, ghế xoay, võng...): lấy đúng chỗ + hướng mèo đang hiện trên màn hình
    // (đã lắc theo món đồ) làm điểm bật, rồi thôi "đi nhờ" ngay từ lúc bật. Nếu vẫn đi nhờ trong lúc bay, món đồ còn
    // đang đung đưa sẽ kéo lệch cả cú nhảy (mèo bị lắc / xoay giữa không trung trông như mắc kẹt).
    if (surface && this.world.furniture[surface]?.userData.ride) {
      const root = this.rig.root;
      this.x = root.position.x; this.y = root.position.y; this.z = root.position.z;
      this.heading = this.yaw = new THREE.Euler().setFromQuaternion(root.quaternion, 'YXZ').y;
    }
    this.surface = null;
    // Chỗ đáp: ưu tiên hướng từ tâm món đồ ra phía mèo đang ngồi, nhưng chỗ đó có thể là đồ khác (vd. tủ đầu giường
    // sát giường: hướng đó là lòng giường). Xoay dần hướng thử sang hai bên tới khi gặp chỗ trống trên sàn.
    let dx = this.x - from.x, dz = this.z - from.z;
    if (Math.hypot(dx, dz) < .05) { const home = this.home(); dx = home.x - this.x; dz = home.z - this.z; }
    const base = Math.atan2(dx, dz), out = (from.r || .6) + .45;
    const clear = p => Math.hypot(p.x - from.x, p.z - from.z) > (from.r || .6) + .2
      && !this.world.obstacles(surface).some(ob => Math.hypot(p.x - ob.x, p.z - ob.z) < ob.r + .32);
    let target = null;
    for (const turn of [0, .5, -.5, 1, -1, 1.5, -1.5, 2.1, -2.1, 2.6, -2.6, Math.PI]) {
      const p = this.world.bound(from.x + Math.sin(base + turn) * out, from.z + Math.cos(base + turn) * out);
      if (clear(p)) { target = p; break; }
    }
    target ||= this.world.reachable(from.x + Math.sin(base) * out, from.z + Math.cos(base) * out);
    this.release();
    yield* this.jumpTo(target.x, this.world.groundAt(target.x, target.z), target.z);
  }
  // ---------- Đồi ở phần vườn mở rộng (room-layout.mjs HILL) ----------
  // Trèo đồi: đi tới chân đồi phía mình đang đứng rồi nhảy từng chặng ngắn bám theo mặt đồi tới `goal` (toạ độ khu nhà,
  // mặc định gần đỉnh). Đồi là vật cản khi đi bộ nên chỉ lên được bằng hành vi này.
  *climbHill(goal = null) {
    const hill = this.world.hill();
    if (!hill) return;
    let dx = (goal ? goal.x : this.x) - hill.x, dz = (goal ? goal.z : this.z) - hill.z;
    if (Math.hypot(dx, dz) < .05) { dx = this.x - hill.x; dz = this.z - hill.z; }
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const base = this.world.reachable(hill.x + dx * (hill.r + .3), hill.z + dz * (hill.r + .3));
    yield* this.walkTo(base.x, base.z);
    // Đỉnh đồi có cối xay / tua-bin đứng giữa: dừng ngoài nền đá (bán kính vật cản + nửa thân mèo) chứ không lọt vào trong.
    const mill = this.world.furniture.windmill?.visible ? this.world.center('windmill').r + CAT_BODY.D / 2 + .08 : .3;
    const top = goal || { x: hill.x + dx * mill, z: hill.z + dz * mill };
    for (const k of [.25, .5, .75, 1]) { // chặng ngắn: sườn đồi lồi không cao quá đường nhảy (mèo không xuyên sườn)
      const x = base.x + (top.x - base.x) * k, z = base.z + (top.z - base.z) * k;
      yield* this.jumpTo(x, this.world.groundAt(x, z), z);
    }
  }
  // Xuống đồi: thường thì nhảy hai chặng; hứng lên thì nằm lăn lông lốc xuống (lăn nghiêng + xoay người theo dốc).
  *leaveHill(roll = chance(.45)) {
    const hill = this.world.hill();
    if (!hill || this.y < .01) return;
    let dx = this.x - hill.x, dz = this.z - hill.z;
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const end = this.world.reachable(hill.x + dx * (hill.r + .45), hill.z + dz * (hill.r + .45));
    if (!roll) {
      const x0 = this.x, z0 = this.z;
      for (const k of [1 / 3, 2 / 3, 1]) { // ba chặng ngắn bám theo sườn đồi
        const x = x0 + (end.x - x0) * k, z = z0 + (end.z - z0) * k;
        yield* this.jumpTo(x, this.world.groundAt(x, z), z);
      }
      return;
    }
    yield* this.turnTo(this.facing(end.x, end.z) + Math.PI / 2, 4); // nằm ngang dốc rồi lăn
    this.setPose('roll'); this.face('happy');
    const x0 = this.x, z0 = this.z, T = 1.6, h0 = this.heading;
    for (let t = 0; t < T; t += this.world.dt) {
      const k = t / T, e = k * k * (3 - 2 * k);
      this.x = x0 + (end.x - x0) * e; this.z = z0 + (end.z - z0) * e;
      this.y = this.world.groundAt(this.x, this.z);
      this.heading = h0 + Math.sin(k * Math.PI * 3) * .5; this.wriggle = 1;
      yield;
    }
    this.wriggle = 0; this.y = this.world.groundAt(this.x, this.z);
    this.setPose('stand'); this.squash = .6; this.squashV = 0;
    yield* this.wait(.4);
    this.face('happy'); this.setPose('sit');
    yield* this.groom();
  }
  // Leo đồi ngắm cảnh rồi lăn / nhảy xuống.
  *hillTop() {
    if (!this.claim('hill')) return; // mỗi lúc một con lên đỉnh đồi
    yield* this.climbHill();
    yield* this.turnTo(this.facingHome());
    this.setPose('sit'); this.goal.tailUp = .2;
    yield* this.lookAround(rand(3, 6));
    if (chance(.4)) { this.setPose('loaf'); this.contact = { spread: .4 }; yield* this.sleep(rand(3, 6)); }
    yield* this.leaveHill();
  }
  claim(key) { if (this.world.claims.get(key) && this.world.claims.get(key) !== this) return false; this.world.claims.set(key, this); this.busyWith = key; return true; }
  release() { // nhả mọi chỗ đang giữ (kể cả ghế mượn để ngắm cửa sổ)
    for (const [key, owner] of this.world.claims) if (owner === this) this.world.claims.delete(key);
    this.busyWith = null;
  }

  *lookAround(seconds) {
    for (let t = 0; t < seconds;) {
      const hold = rand(.6, 1.8);
      this.lookGoal = rand(-1, 1);
      if (chance(.3)) this.heading += rand(-.5, .5);
      yield* this.wait(hold); t += hold;
      if (chance(.2)) yield* this.slowBlink();
    }
    this.lookGoal = 0;
  }
  // Chớp mắt chậm: cách mèo nói "tớ tin cậu".
  *slowBlink() { const e = this.eyes; this.eyes = 'half'; yield* this.wait(.35); this.eyes = 'blink'; yield* this.wait(.5); this.eyes = 'half'; yield* this.wait(.3); this.eyes = e; }
  *sleep(seconds) {
    this.face('half'); yield* this.wait(1.2);
    this.face('sleep'); this.sleeping = true; this.tailWag = .05; this.tailSpeed = .5;
    try { yield* this.wait(seconds); } finally { this.sleeping = false; this.tailWag = .25; this.tailSpeed = 1.6; }
  }
  *yawnStretch() {
    this.setPose('stretch'); this.face('sleep', 'yawn');
    yield* this.wait(1.3);
    this.setPose('stand'); this.face('blink');
    yield* this.wait(.25);
    this.face('open');
  }

  // ----- Hành vi -----
  *life() {
    let last = '';
    while (true) {
      if (this.y > .01) yield* this.getDown();
      const [name, behavior] = this.world.choose(this, last);
      last = name;
      try { yield* behavior; } finally { this.release(); this.social = null; this.partner = null; this.setPose('stand'); this.face('open'); this.lookGoal = 0; this.contact = {}; }
    }
  }
  *wander(zone) { // zone: dạo sang khu đó (đi qua cửa); bỏ trống = loanh quanh khu đang đứng
    const p = this.world.freeSpot(this, zone);
    this.goal.tailUp = rand(.5, 1);
    yield* this.walkTo(p.x, p.z);
    yield* this.lookAround(rand(1, 3));
  }
  *idleSit() {
    this.setPose('sit');
    yield* this.lookAround(rand(3, 7));
  }
  *groom() {
    this.setPose('sit');
    yield* this.wait(.4);
    for (let i = 0, n = Math.floor(rand(3, 6)); i < n; i++) {
      this.goal.groom = 1; this.face('blink');
      yield* this.wait(rand(.5, .9));
      this.goal.groom = .6; this.face('blink');
      yield* this.wait(.25);
    }
    // liếm lưng: vặn người sang bên
    this.goal.groom = 0; this.goal.lean = .4; this.heading += .8; this.face('blink');
    yield* this.wait(1.2);
    this.heading -= .8; this.goal.lean = 0; this.face('open');
    yield* this.wait(.4);
  }
  *zoomies() {
    this.face('focus'); this.goal.tailUp = 1; this.tailSpeed = 5;
    for (let i = 0, n = Math.floor(rand(3, 5)); i < n; i++) {
      const p = this.world.freeSpot(this);
      yield* this.walkTo(p.x, p.z, { run: true, near: .25, maxTime: 3 });
    }
    this.tailSpeed = 1.6;
    this.setPose('sit'); this.face('open'); // thở hổn hển, rồi giả vờ như chưa có gì xảy ra
    yield* this.wait(1);
    yield* this.groom();
  }
  // Đuổi theo đuôi mình vài vòng rồi chóng mặt.
  *tailChase() {
    this.face('focus'); this.goal.tailUp = .9; this.tailSpeed = 7;
    for (let i = 0, n = Math.floor(rand(3, 5)); i < n; i++) yield* this.turnTo(this.heading + Math.PI * .9, 10);
    this.tailSpeed = 1.6; this.setPose('sit'); this.face('half'); this.wriggle = 1; // choáng
    yield* this.wait(.5); this.wriggle = 0;
    yield* this.wait(.8); this.face('open');
  }
  // Rình rồi vồ một con bọ tưởng tượng trên sàn.
  *pounceBug() {
    const a = this.heading + rand(-1, 1), d = rand(.6, 1);
    const target = this.world.reachable(this.x + Math.sin(a) * d, this.z + Math.cos(a) * d);
    yield* this.turnTo(this.facing(target.x, target.z));
    this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6; this.lookGoal = rand(-.4, .4);
    yield* this.wait(rand(.6, 1));
    this.wriggle = 1; yield* this.wait(rand(.6, 1.1)); this.wriggle = 0; // lắc mông
    yield* this.jumpTo(target.x, 0, target.z);
    this.goal.paw = 1; this.goal.lean = .7; yield* this.wait(.35); this.goal.paw = 0; this.goal.lean = 0;
    this.tailSpeed = 1.6; this.setPose('sit'); this.face(chance(.5) ? 'happy' : 'open'); // bắt được... hay hụt?
    yield* this.lookAround(rand(1, 2));
  }
  // Nằm ngửa, lăn qua lăn lại khoe bụng.
  *bellyRoll() {
    this.setPose('loaf'); yield* this.wait(.4);
    this.setPose('roll'); this.face('happy');
    for (let i = 0, n = Math.floor(rand(2, 4)); i < n; i++) { this.wriggle = 1; yield* this.wait(.5); this.wriggle = 0; yield* this.wait(.3); }
    this.face('blink'); yield* this.wait(rand(1.2, 2));
    this.setPose('loaf'); this.face('open'); yield* this.wait(.4);
    this.setPose('sit');
  }
  // Quay ra phía người chơi kêu meo meo.
  *meowAtYou() {
    const cam = this.world.cameraPos?.();
    if (cam) yield* this.turnTo(this.facing(cam.x, cam.z));
    this.setPose('sit'); this.goal.tailUp = 1;
    for (let i = 0, n = chance(.5) ? 1 : 2; i < n; i++) {
      this.face('open'); this.squash = -.15; this.world.say(this, '♪', 1); this.quiverUntil = this.world.time + 1;
      this.world.notice(this.x, this.z, { except: this });
      yield* this.wait(.45); this.face('open'); yield* this.wait(.5);
    }
    yield* this.slowBlink(); // chớp mắt chậm = "thương bạn"
  }
  *loafNap() {
    this.setPose('loaf');
    yield* this.wait(rand(1, 2));
    yield* this.sleep(rand(5, 10));
    yield* this.yawnStretch();
  }
  *lookOutWindow() {
    if (!this.claim('window')) return;
    const chair = this.world.furniture.armchair;
    const spot = this.world.windowSpot();
    if (spot) {
      yield* this.walkTo(spot.x, spot.z, { near: .1 });
    } else if (chair?.visible && !this.world.claims.has('armchair')) {
      // Ghế bành che hết sàn dưới cửa sổ: nhảy lên ghế rồi lên lưng ghế để ngắm (mèo thật hay làm vậy).
      this.world.claims.set('armchair', this);
      const local = (x, y, z) => { chair.updateMatrixWorld(true); return chair.localToWorld(new THREE.Vector3(x, y, z)); };
      const front = local(0, 0, 1.15), seat = local(0, .66, .1), back = local(0, 1.29, -.38);
      yield* this.walkTo(front.x, front.z, { ignore: 'armchair' });
      yield* this.jumpTo(seat.x, seat.y, seat.z);
      yield* this.jumpTo(back.x, back.y, back.z);
      this.surface = 'armchair';
    } else return;
    const win = this.world.window();
    yield* this.turnTo(this.facing(win.x, win.z - .6));
    this.setPose('sit'); this.goal.tailUp = .2; this.tailSpeed = 2.4;
    for (let t = 0, n = rand(5, 9); t < n; t += 1.2) {
      this.lookGoal = rand(-1, 1);
      if (chance(.3)) { this.face('focus'); yield* this.wait(.5); this.face('focus'); } // "chí chí" với chim ngoài cửa
      yield* this.wait(1.2);
    }
    this.tailSpeed = 1.6;
  }
  *rollOnRug() {
    if (!this.claim('rug')) return;
    const rug = this.world.center('rug');
    yield* this.walkTo(rug.x + rand(-.3, .3), rug.z + rand(-.2, .3));
    this.setPose('loaf'); yield* this.wait(.4);
    this.setPose('roll'); this.face('happy');
    for (let t = 0, n = rand(2, 3.5); t < n; t += .5) { this.wriggle = 1; yield* this.wait(.5); }
    this.wriggle = 0;
    this.setPose('loaf'); this.face('open'); yield* this.wait(.5);
    this.setPose('sit'); yield* this.groom();
  }

  // Dùng đồ đạc: mỗi món một kiểu, như mèo thật.
  *useFurniture(id) {
    const node = this.world.furniture[id];
    if (!node?.visible || !this.claim(id)) return;
    const kind = node.userData.itemId || id; // món cụ thể đang đặt ở chỗ này (gốc hoặc phương án thay thế)
    const local = (x, y, z) => { node.updateMatrixWorld(true); return node.localToWorld(new THREE.Vector3(x, y, z)); };
    const approach = node.userData.approach ? local(...node.userData.approach) : local(0, 0, (FURNITURE[id].r || .5) + .35);
    const center = local(0, 0, 0);
    // Món đứng trên đồi (cối xay trên đỉnh): chỗ đứng trước nó nằm trên sườn đồi (vật cản khi đi bộ) -> hành vi tự trèo đồi.
    if (node.position.y < .05) {
      yield* this.walkTo(approach.x, approach.z, { ignore: id });
      yield* this.turnTo(this.facing(center.x, center.z));
    }

    if (id === 'catbed') {
      const spot = local(0, .14, 0);
      yield* this.jumpTo(spot.x, spot.y, spot.z); this.surface = id;
      node.userData.bump?.(.9); // thùng các-tông: nắp rung khi mèo đáp vào
      // thùng các-tông: chui vừa khít, thành thùng ép hai bên nên phồng lên trên ("vừa là ngồi"); nệm: lún bẹp êm
      this.contact = kind === 'catbed-box' ? { squeeze: 1, spread: .15 } : { spread: .25, sag: .3 };
      // xoay vòng tìm chỗ nằm rồi mới cuộn tròn
      for (let i = 0; i < 2; i++) yield* this.turnTo(this.heading + Math.PI * .95, 3.5);
      this.setPose('curl');
      this.contact = kind === 'catbed-box' ? { squeeze: 1, spread: .2 } : { spread: .55, sag: .45 };
      yield* this.sleep(rand(8, 15));
      yield* this.yawnStretch();
    } else if (id === 'armchair') {
      const seat = local(0, .66, .1);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      node.userData.bump?.(.35); // ghế bập bênh: đáp lên thì ghế nhún nhẹ
      yield* this.turnTo(this.facing(approach.x, approach.z));
      this.setPose('knead'); this.face('blink'); this.purr = 1; // nhồi bột + rừ rừ
      this.contact = { spread: .25, sag: .25 }; // nệm ghế lún dưới chân
      yield* this.wait(rand(2.5, 4));
      this.purr = 0; this.setPose('loaf'); this.face('blink');
      this.contact = { spread: .6, sag: .35 }; // nằm bẹp trên nệm
      yield* this.sleep(rand(4, 8));
      node.userData.bump?.(1); // sắp đạp nhảy xuống: ghế bập bênh đung đưa một lúc
    } else if (id === 'cattree') {
      const mid = local(-.1, 1.16, -.12), top = local(.22, 1.88, .18);
      yield* this.jumpTo(mid.x, mid.y, mid.z);
      yield* this.wait(.3);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      this.kick(node, .9); // nhảy lên tầng trên: quả bóng treo bên dưới lắc
      yield* this.turnTo(this.facingHome());
      this.setPose('sit'); this.goal.tailUp = 0;
      yield* this.lookAround(rand(3, 6)); // vua của căn phòng
      this.setPose('loaf'); this.contact = { spread: .5 }; // bệ nhỏ: nằm bẹp tràn ra mép bệ
      yield* this.sleep(rand(3, 6));
    } else if (id === 'shelf') {
      const top = local(0, 2, .02);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      yield* this.turnTo(this.facingHome());
      this.setPose('loaf'); this.goal.tailUp = 0; this.tailWag = .5;
      this.contact = { spread: .45 };
      yield* this.lookAround(rand(4, 7));
      this.tailWag = .25;
    } else if (id === 'table' || id === 'dining') {
      // Bàn trà / bàn ăn: nhảy lên mặt bàn (bàn ăn có chỗ ngồi riêng: userData.seat), khều cốc rơi xuống sàn.
      const top = node.userData.seat ? local(...node.userData.seat) : local(-.2, .81, -.18);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      const mug = node.userData.mug;
      if (mug && !mug.userData.knocked) {
        const mugWorld = mug.getWorldPosition(new THREE.Vector3());
        yield* this.turnTo(this.facing(mugWorld.x, mugWorld.z));
        this.setPose('sit');
        this.lookGoal = rand(-1, 1) > 0 ? 1 : -1; this.face('open'); // nhìn thẳng vào bạn...
        yield* this.wait(1.2);
        this.lookGoal = 0;
        for (let i = 0; i < 2; i++) { this.goal.paw = 1; yield* this.wait(.3); this.world.nudge(mug, this, .03); this.goal.paw = 0; yield* this.wait(.6); }
        this.goal.paw = 1; yield* this.wait(.25);
        this.world.knockOff(node, mug, this); // ...rồi đẩy rơi
        this.goal.paw = 0; this.goal.lean = .7; this.face('focus');
        yield* this.wait(1.1);
        this.goal.lean = 0; this.face('happy');
        yield* this.wait(1);
      } else {
        this.setPose('loaf'); this.contact = { spread: .4 }; yield* this.sleep(rand(3, 5));
      }
    } else if (id === 'yarn') {
      const toy = node.userData.toy;
      this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6;
      yield* this.wait(.8);
      this.goal.paw = 1; yield* this.wait(.25); this.goal.paw = 0;
      node.userData.bump?.(.6); // hộp đồ chơi: nắp bật nảy khi bóng bị khều ra
      const landing = this.world.batToy(node, toy, this);
      yield* this.wait(.5);
      for (let i = 0; i < 2; i++) {
        // rình, lắc mông, vồ
        yield* this.walkTo(landing().x, landing().z, { near: .5, ignore: id });
        yield* this.turnTo(this.facing(landing().x, landing().z));
        this.setPose('crouch'); this.wriggle = 1; yield* this.wait(rand(.8, 1.3)); this.wriggle = 0;
        const p = landing();
        yield* this.jumpTo(p.x - Math.sin(this.heading) * .32, 0, p.z - Math.cos(this.heading) * .32);
        this.goal.paw = 1; this.world.rollToy(toy, this); yield* this.wait(.3); this.goal.paw = 0;
        yield* this.wait(.5);
      }
      this.tailSpeed = 1.6; this.face('happy');
      this.setPose('sit'); yield* this.wait(1);
      yield* this.groom();
    } else if (id === 'plant' && kind === 'plant-cactus') {
      // xương rồng: rướn tới ngửi... mặt chạm gai thì lõm vào, giật bắn lùi lại, xù đuôi
      this.goal.lean = .9; this.face('focus');
      yield* this.wait(1);
      this.contact = { front: 1 }; this.face('annoyed'); this.jigV.z -= 1.4;
      yield* this.wait(.14);
      this.contact = {}; this.world.say(this, '!', 1); this.puffUntil = this.world.time + 2; this.earFlopV = (this.earFlopV || 0) + 18;
      this.goal.lean = 0; this.squash = -.4; this.squashV = 0;
      const back = this.world.reachable(this.x - Math.sin(this.heading) * .45, this.z - Math.cos(this.heading) * .45);
      const x0 = this.x, z0 = this.z;
      for (let t = 0; t < .3; t += this.world.dt) { const k = t / .3; this.x = x0 + (back.x - x0) * k; this.z = z0 + (back.z - z0) * k; this.y = .18 * 4 * k * (1 - k); yield; }
      this.y = 0; this.squash = .6; this.squashV = 0;
      this.setPose('sit'); this.face('grumble'); this.goal.paw = 1; yield* this.wait(.2); this.goal.paw = 0; // xoa mũi
      yield* this.wait(1);
      yield* this.groom();
    } else if (id === 'plant' || id === 'kplant') {
      this.goal.lean = .8; this.face('focus');
      yield* this.wait(1); // ngửi
      for (let i = 0; i < 3; i++) { this.face('blink'); this.world.wiggle(node.userData.leaves); yield* this.wait(.45); this.face('open'); yield* this.wait(.3); }
      this.goal.lean = 0; this.face('grumble'); // lá đắng
      yield* this.wait(.8);
    } else if (id === 'tank') {
      this.setPose('sit'); this.face('focus'); this.goal.tailUp = .1; this.tailSpeed = 4;
      if (kind === 'tank') { // dí sát mặt vào kính bể cá: mặt bẹp lên kính
        const glass = local(0, 0, (FURNITURE[id].r || .5) + .2);
        yield* this.walkTo(glass.x, glass.z, { ignore: id, near: .04, pace: .5 });
        yield* this.turnTo(this.facing(center.x, center.z));
        this.contact = { front: .8 };
      }
      const base = this.heading, fish = node.userData.fish || [];
      for (let t = 0, n = rand(6, 10); t < n; t += this.world.dt) {
        const f = fish[0]?.getWorldPosition(new THREE.Vector3());
        if (f) {
          const want = this.facing(f.x, f.z);
          this.turnToward(base + clamp(angDiff(base, want), -.5, .5), 3);
          this.lookGoal = clamp(angDiff(this.heading, want) * 3, -1, 1);
        }
        if (chance(this.world.dt * .4)) { this.goal.paw = 1; this.goal.lean = .4; if (kind === 'tank') this.contact = { front: 1 }; }
        else if (this.goal.paw && chance(this.world.dt * 3)) { this.goal.paw = 0; this.goal.lean = 0; if (kind === 'tank') this.contact = { front: .8 }; }
        yield;
      }
      this.goal.paw = 0; this.goal.lean = 0; this.tailSpeed = 1.6; this.contact = {};
    } else if (id === 'lamp') {
      yield* this.turnTo(this.heading + Math.PI);
      this.setPose('loaf'); this.face('blink');
      yield* this.wait(1);
      this.contact = { spread: kind === 'lamp-heater' ? 1 : .7 }; // ấm quá nên "tan chảy" ra sàn (lò sưởi tan nhiều nhất)
      yield* this.sleep(rand(5, 8)); // sưởi ấm dưới đèn
    } else if (id === 'bed') {
      // Giường: nhảy lên chăn, nhồi bột rừ rừ, xoay vòng rồi cuộn tròn ngủ một giấc dài trên chăn êm.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      this.setPose('knead'); this.face('blink'); this.purr = 1;
      this.contact = { spread: .3, sag: .35 };
      yield* this.wait(rand(2, 3.5));
      this.purr = 0;
      for (let i = 0; i < 2; i++) yield* this.turnTo(this.heading + Math.PI * .95, 3.5);
      this.setPose(chance(.3) ? 'roll' : 'curl');
      this.contact = { spread: .55, sag: .45 };
      yield* this.sleep(rand(10, 18));
      yield* this.yawnStretch();
    } else if (id === 'desk') {
      // Bàn máy tính: nhảy lên nằm chễm chệ trên bàn phím, nhìn màn hình, đuôi phe phẩy... rồi ngủ luôn ở đó.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      yield* this.turnTo(this.facingHome());
      this.setPose('sit'); this.face('focus'); this.tailWag = .6;
      this.lookGoal = rand(-1, 1) > 0 ? 1 : -1; // liếc màn hình
      yield* this.wait(rand(2, 3));
      this.lookGoal = 0; this.tailWag = .25;
      this.setPose('loaf'); this.face('half'); this.contact = { spread: .45 };
      yield* this.sleep(rand(5, 9));
    } else if (id === 'chair' || id === 'kchair') {
      // Ghế gaming: đáp lên làm ghế xoay đung đưa, ngồi nhìn quanh rồi cuộn tròn trên đệm ghế.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      node.userData.spin?.(chance(.5) ? 2.4 : -2.4);
      this.contact = { spread: .25, sag: .2 };
      this.setPose('sit'); this.face('open');
      yield* this.lookAround(rand(2, 4));
      this.setPose('curl'); this.contact = { spread: .5, sag: .3 };
      yield* this.sleep(rand(5, 9));
      node.userData.spin?.(1.2); // đạp nhảy xuống: ghế xoay nhẹ
    } else if (id === 'bedside' || id === 'cart') {
      // Tủ đầu giường: nhảy lên, nhìn bạn, khều đồng hồ báo thức rơi khỏi tủ (như cốc trên bàn).
      const top = local(-.12, node.userData.top, -.05);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      const clock = node.userData.mug;
      if (clock && !clock.userData.knocked) {
        const clockWorld = clock.getWorldPosition(new THREE.Vector3());
        yield* this.turnTo(this.facing(clockWorld.x, clockWorld.z));
        this.setPose('sit'); this.face('open');
        yield* this.wait(1);
        for (let i = 0; i < 2; i++) { this.goal.paw = 1; yield* this.wait(.3); this.world.nudge(clock, this, .03); this.goal.paw = 0; yield* this.wait(.5); }
        this.goal.paw = 1; yield* this.wait(.25);
        this.world.knockOff(node, clock, this);
        this.goal.paw = 0; this.goal.lean = .7; this.face('focus');
        yield* this.wait(1.1);
        this.goal.lean = 0; this.face('happy');
        yield* this.wait(1);
      } else {
        this.setPose('loaf'); this.contact = { spread: .4 }; yield* this.sleep(rand(3, 5));
      }
    } else if (id === 'closet' || id === 'fridge' || id === 'pantry') {
      // Tủ quần áo / bàn trang điểm / tủ lạnh / tủ chén: nhảy phốc lên nóc, nằm canh cả phòng.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      yield* this.turnTo(this.facingHome());
      this.setPose('loaf'); this.goal.tailUp = 0; this.tailWag = .5; this.contact = { spread: .45 };
      yield* this.lookAround(rand(4, 7));
      this.tailWag = .25;
    } else if (id === 'catsteps') {
      // Bậc leo gắn tường: nhảy lần lượt từng bậc lên đệm trên cùng, khều quả bóng treo, rồi nằm nghỉ trên cao.
      for (const [x, y, z] of node.userData.steps) {
        const p = local(x, y, z);
        yield* this.jumpTo(p.x, p.y, p.z);
        yield* this.wait(.25);
      }
      this.surface = id;
      this.kick(node, .8);
      yield* this.turnTo(this.facingHome());
      this.setPose('sit'); this.goal.tailUp = 0;
      yield* this.lookAround(rand(3, 5));
      this.setPose('loaf'); this.contact = { spread: .5 };
      yield* this.sleep(rand(3, 6));
    } else if (id === 'plushie') {
      // Gấu bông: ôm nhồi bột gấu rừ rừ, rồi rúc ngủ tựa vào gấu.
      this.setPose('knead', { lean: .5 }); this.face('blink'); this.purr = 1;
      yield* this.wait(rand(2.5, 4));
      this.purr = 0;
      const side = local(...node.userData.seat);
      yield* this.walkTo(side.x, side.z, { ignore: id, near: .1, pace: .6 });
      yield* this.turnTo(this.facing(center.x, center.z) + Math.PI / 2, 3);
      this.setPose('curl'); this.contact = { spread: .45, squeeze: .2 };
      yield* this.sleep(rand(6, 10));
    } else if (id === 'laundry') {
      // Giỏ đồ giặt / thùng các-tông: chui vào nằm vừa khít trên đống quần áo.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      node.userData.bump?.(.9);
      this.contact = { squeeze: .9, spread: .15 };
      for (let i = 0; i < 2; i++) yield* this.turnTo(this.heading + Math.PI * .95, 3.5);
      this.setPose('curl'); this.contact = { squeeze: 1, spread: .2 };
      yield* this.sleep(rand(7, 12));
    } else if (id === 'windmill') {
      // Cối xay / tua-bin trên đỉnh đồi: trèo lên ngồi cạnh, ngắm cánh quay (đầu xoay theo), rồi lăn / nhảy xuống đồi.
      const spot = local(...node.userData.spot);
      yield* this.climbHill({ x: spot.x, z: spot.z });
      yield* this.turnTo(this.facing(center.x, center.z));
      this.setPose('sit'); this.face('focus'); this.tailSpeed = 4;
      for (let t = 0, n = rand(3, 5); t < n; t += this.world.dt) { this.lookGoal = Math.sin(this.world.time * 2.2); yield; } // mắt đảo theo cánh
      this.lookGoal = 0; this.tailSpeed = 1.6;
      if (chance(.5)) { this.goal.paw = 1; yield* this.wait(.3); this.goal.paw = 0; this.face('happy'); yield* this.wait(.6); }
      yield* this.leaveHill();
    } else if (id === 'sunflowers' && kind === 'sunflowers-scarecrow') {
      // Bù nhìn: rình con quạ đậu trên tay bù nhìn rồi vồ — quạ bay mất.
      const bird = node.userData.bird;
      this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6; this.wriggle = 1;
      yield* this.wait(rand(1, 1.6));
      this.wriggle = 0;
      if (bird && !bird.userData.away) this.world.scareBird(node);
      yield* this.jumpTo(this.x + Math.sin(this.heading) * .3, 0, this.z + Math.cos(this.heading) * .3);
      this.setPose('sit'); this.face('grumble'); yield* this.wait(1.2); this.tailSpeed = 1.6;
    } else if (id === 'sunflowers') {
      // Hướng dương: cả khóm quay mặt nhìn mèo; mèo đứng lên khều bông hoa, hoa lắc lư, hắt xì phấn hoa.
      this.setPose('sit'); this.face('open'); yield* this.wait(1);
      this.setPose('stretch'); this.goal.paw = 1; node.userData.bump?.(1); yield* this.wait(.35); this.goal.paw = 0;
      yield* this.wait(.4); this.goal.paw = 1; node.userData.bump?.(.8); yield* this.wait(.3); this.goal.paw = 0;
      this.setPose('sit'); this.face('blink'); this.jigV.z -= .8; yield* this.wait(.5); // hắt xì
      this.face('happy'); yield* this.wait(1);
    } else if (id === 'clothesline' && kind === 'clothesline-flags') {
      // Dây cờ: nhảy chồm khều lá cờ thấp, cả dây cờ rung phần phật.
      for (let i = 0; i < 2; i++) {
        this.setPose('crouch'); this.face('focus'); yield* this.wait(.5);
        yield* this.jumpTo(this.x, .35, this.z); this.goal.paw = 1; node.userData.bump?.(1.2);
        yield* this.jumpTo(this.x, 0, this.z); this.goal.paw = 0;
      }
      this.setPose('sit'); this.face('happy'); yield* this.wait(1);
    } else if (id === 'clothesline') {
      // Dây phơi: nhảy khều chiếc tất đang bay phần phật — tất rơi xuống, mèo vồ lấy tha đi một đoạn.
      const sock = node.userData.mug;
      if (sock && !sock.userData.knocked) {
        const sw = sock.getWorldPosition(new THREE.Vector3());
        yield* this.walkTo(sw.x + (this.x - sw.x) * .2, sw.z + (this.z - sw.z) * .2 + .25, { ignore: id, near: .15 });
        yield* this.turnTo(this.facing(sw.x, sw.z));
        this.setPose('crouch'); this.face('focus'); this.wriggle = 1; yield* this.wait(rand(.8, 1.3)); this.wriggle = 0;
        yield* this.jumpTo(this.x, .4, this.z); this.goal.paw = 1;
        this.world.knockOff(node, sock, this);
        yield* this.jumpTo(this.x, 0, this.z); this.goal.paw = 0;
        this.face('happy'); yield* this.wait(.8);
      } else { this.setPose('sit'); this.face('open'); yield* this.lookAround(rand(2, 3)); }
    } else if (id === 'campfire' && kind === 'campfire-tent') {
      // Lều: chui vào nằm cạnh đèn, vạt lều đung đưa.
      const inside = local(...node.userData.inside);
      node.userData.bump?.(1);
      this.contact = { squeeze: .6 };
      yield* this.walkTo(inside.x, inside.z, { ignore: id, near: .08, pace: .7 });
      yield* this.turnTo(this.facing(approach.x, approach.z));
      this.setPose('loaf'); this.face('half'); this.contact = { spread: .3 };
      yield* this.sleep(rand(7, 12));
      this.contact = { squeeze: .6 }; node.userData.bump?.(.8);
      yield* this.walkTo(approach.x, approach.z, { ignore: id, pace: .7 });
      this.contact = {};
    } else if (id === 'campfire') {
      // Lửa trại: nằm sưởi, tan chảy vì ấm, ngủ gà ngủ gật nhìn lửa.
      yield* this.turnTo(this.facing(center.x, center.z));
      this.setPose('loaf'); this.face('blink'); this.purr = 1;
      yield* this.wait(1.5); this.purr = 0;
      this.contact = { spread: .6 };
      yield* this.sleep(rand(5, 9));
    } else if (id === 'kite' && kind === 'kite-balloons') {
      // Bóng bay: nhảy khều dây, chùm bóng nảy tưng tưng.
      this.setPose('sit'); this.face('focus'); this.lookGoal = .5; yield* this.wait(1.2); this.lookGoal = 0;
      yield* this.jumpTo(this.x, .3, this.z); this.goal.paw = 1; node.userData.bump?.(1.2);
      yield* this.jumpTo(this.x, 0, this.z); this.goal.paw = 0;
      this.setPose('sit'); this.face('happy'); yield* this.wait(1.5);
    } else if (id === 'kite') {
      // Diều: ngồi ngước nhìn diều lượn, vồ sợi dây — diều giật mạnh một cái.
      this.setPose('sit'); this.face('focus'); this.tailSpeed = 5;
      for (let t = 0, n = rand(2.5, 4); t < n; t += this.world.dt) { this.lookGoal = Math.sin(this.world.time * .7) * .8; yield; }
      this.lookGoal = 0;
      this.setPose('crouch'); this.wriggle = 1; yield* this.wait(.6); this.wriggle = 0;
      yield* this.jumpTo(this.x + Math.sin(this.heading) * .25, .25, this.z + Math.cos(this.heading) * .25);
      this.goal.paw = 1; node.userData.tug?.(1.5);
      yield* this.jumpTo(this.x, 0, this.z); this.goal.paw = 0;
      this.setPose('sit'); this.face('happy'); this.tailSpeed = 1.6; yield* this.wait(1.2);
    } else if (id === 'stream' && kind === 'stream-bridge') {
      // Cầu suối: nhảy lên đỉnh cầu, ngồi nhìn lá trôi dưới chân.
      const top = local(...node.userData.top);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      yield* this.turnTo(this.heading + Math.PI / 2, 3);
      this.setPose('sit'); this.face('focus'); this.lookGoal = -.6;
      yield* this.wait(rand(3, 5)); this.lookGoal = 0;
      this.setPose('loaf'); this.face('half'); yield* this.sleep(rand(3, 5));
    } else if (id === 'stream') {
      // Suối: rình bên bờ, đợi chiếc lá trôi ngang qua thì khều — nước bắn tung, giũ chân.
      yield* this.turnTo(this.facing(center.x, center.z));
      this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6;
      const leaf = node.userData.leaf, lw = new THREE.Vector3();
      for (let t = 0; t < 6; t += this.world.dt) { // đợi lá trôi tới gần trước mặt
        if (leaf?.visible && leaf.getWorldPosition(lw) && Math.hypot(lw.x - this.x, lw.z - this.z) < 1) break;
        this.lookGoal = clamp(angDiff(this.heading, this.facing(lw.x, lw.z)) * 2, -1, 1);
        yield;
      }
      this.lookGoal = 0;
      this.goal.paw = 1; this.goal.lean = .7; yield* this.wait(.3);
      this.world.splash(node, this);
      this.goal.paw = 0; this.goal.lean = 0; this.face('grumble');
      this.setPose('sit');
      for (let i = 0; i < 4; i++) { this.goal.paw = i % 2; yield* this.wait(.12); } // giũ chân
      this.goal.paw = 0; this.tailSpeed = 1.6;
      yield* this.groom();
    } else if (id === 'swingtree' && kind === 'swingtree-treehouse') {
      // Nhà cây: leo thang lên sàn, ngồi trước cửa ngắm vườn rồi ngủ trong nhà cây.
      for (const [x, y, z] of node.userData.steps) { const p = local(x, y, z); yield* this.jumpTo(p.x, p.y, p.z); yield* this.wait(.2); }
      this.surface = id;
      yield* this.turnTo(this.facingHome());
      this.setPose('sit'); yield* this.lookAround(rand(3, 5));
      this.setPose('loaf'); this.contact = { spread: .4 }; yield* this.sleep(rand(4, 8));
    } else if (id === 'swingtree') {
      // Xích đu: nhảy lên ván đu (đu đưa mạnh), nằm đu theo gió.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      this.kick(node, .8);
      yield* this.turnTo(this.facingHome());
      this.setPose('loaf'); this.face('blink'); this.contact = { spread: .35, sag: .2 };
      yield* this.wait(1.5); this.face('half');
      yield* this.sleep(rand(5, 9));
      this.kick(node, .6); // đạp nhảy xuống: xích đu đung đưa tiếp
    } else if (id === 'slide' && kind === 'slide-seesaw') {
      // Bập bênh: nhảy lên đầu đang vểnh cao -> bập bênh lật xuống, mèo đi theo tấm ván; bật dậy chạy vòng.
      const side = node.userData.highEnd(), plank = node.userData.plank;
      node.updateMatrixWorld(true);
      const end = plank.localToWorld(new THREE.Vector3(side * .95, .1, 0));
      yield* this.jumpTo(end.x, end.y, end.z); this.surface = id;
      node.userData.bump?.(1);
      this.setPose('sit'); this.face('happy'); yield* this.wait(1.2);
      this.setPose('loaf'); yield* this.wait(rand(2, 4));
      node.userData.bump?.(1); // nhảy xuống: bập bênh bật trở lại
    } else if (id === 'slide') {
      // Cầu trượt: leo thang lên sàn, ngồi chuẩn bị... rồi trượt vèo xuống, chạy một vòng sung sướng.
      for (const [x, y, z] of node.userData.steps) { const p = local(x, y, z); yield* this.jumpTo(p.x, p.y, p.z); yield* this.wait(.2); }
      this.surface = id;
      const chute = node.userData.chute.map(([x, y, z]) => local(x, y, z));
      yield* this.turnTo(this.facing(chute[2].x, chute[2].z), 5);
      this.setPose('sit'); this.face('focus'); this.wriggle = 1; yield* this.wait(.8); this.wriggle = 0;
      this.setPose('loaf'); this.face('happy'); this.goal.lean = -.3;
      const T = 1.1;
      for (let t = 0; t < T; t += this.world.dt) { // trượt nhanh dần theo máng
        const k = (t / T) ** 1.6 * (chute.length - 1), i = Math.min(chute.length - 2, Math.floor(k)), f = k - i;
        this.x = chute[i].x + (chute[i + 1].x - chute[i].x) * f; this.z = chute[i].z + (chute[i + 1].z - chute[i].z) * f;
        this.y = chute[i].y + (chute[i + 1].y - chute[i].y) * f;
        yield;
      }
      this.goal.lean = 0; this.surface = null;
      const out = this.world.reachable(this.x + Math.sin(this.heading) * .6, this.z + Math.cos(this.heading) * .6);
      yield* this.jumpTo(out.x, 0, out.z);
      this.face('happy'); yield* this.zoomies();
    } else if (id === 'flowers') {
      this.goal.lean = .8; this.face('focus');
      yield* this.wait(1.2); // ngửi hoa...
      this.face('sleep', 'yawn'); this.goal.lean = .2; this.squash = .6; // ...hắt xì!
      yield* this.wait(.35);
      this.face('grumble'); this.goal.lean = 0;
      yield* this.wait(.6);
      this.setPose('sit'); this.face('open');
      yield* this.lookAround(rand(2, 3));
    } else if (id === 'stump') {
      // cào móng: chồm lên gốc cây, hai chân trước cào xen kẽ
      this.setPose('stretch', { knead: 1, lean: .6 }); this.face('blink');
      this.contact = { front: .7 }; // ngực tì phẳng vào thân cây / bó rơm
      yield* this.wait(rand(2, 3));
      this.contact = {};
      const top = local(0, .46, 0);
      yield* this.jumpTo(top.x, top.y, top.z); this.surface = id;
      yield* this.turnTo(this.facingHome());
      this.setPose('sit');
      if (kind === 'stump-hay') this.contact = { spread: .35, sag: .3 }; // rơm mềm lún dưới mông
      yield* this.lookAround(rand(3, 5));
    } else if (id === 'catnip') {
      this.goal.lean = .8; this.face('focus');
      yield* this.wait(1);
      for (let i = 0; i < 3; i++) { this.face('blink'); this.world.wiggle(node.userData.leaves); yield* this.wait(.4); }
      this.setPose('roll'); this.face('happy'); // phê cỏ mèo: lăn lộn
      for (let t = 0, n = rand(2.5, 4); t < n; t += .5) { this.wriggle = 1; yield* this.wait(.5); }
      this.wriggle = 0; this.setPose('stand');
      yield* this.zoomies();
    } else if (id === 'lantern') {
      yield* this.turnTo(this.heading + Math.PI);
      this.setPose('loaf'); this.face('blink');
      yield* this.wait(1);
      this.contact = { spread: .6 }; // sưởi ấm cạnh đèn: tan chảy nhẹ
      yield* this.sleep(rand(4, 7));
    } else if (id === 'sandbox') {
      const spot = local(0, .18, 0);
      yield* this.jumpTo(spot.x, spot.y, spot.z); this.surface = id;
      this.setPose('crouch', { knead: 1, lean: .5 }); this.face('focus'); // đào cát
      this.contact = { spread: .2 }; // cát lún dưới chân
      for (let i = 0; i < 6; i++) { this.world.sand(this); yield* this.wait(.35); }
      yield* this.turnTo(this.heading + Math.PI, 3); // quay lưng lại...
      this.setPose('sit'); this.face('blink');
      yield* this.wait(1.5);
      this.setPose('crouch', { knead: 1 }); yield* this.wait(1); // ...rồi lấp lại cho kín
      this.setPose('stand'); this.face('open');
    } else if (id === 'cathouse') {
      if (chance(.55)) { // chui vào nhà, chỉ ló mặt ra cửa rồi ngủ
        const inside = local(0, 0, .15);
        this.contact = { squeeze: .8 }; // lách qua cửa hẹp: thóp người lại
        yield* this.walkTo(inside.x, inside.z, { ignore: id, near: .05, pace: .7 });
        this.contact = { squeeze: .3, spread: .2 };
        yield* this.turnTo(this.facing(approach.x, approach.z));
        this.setPose('loaf'); this.face('blink');
        this.contact = { squeeze: .35, spread: .35 }; // nằm chật trong nhà nhỏ
        yield* this.sleep(rand(6, 10));
        this.contact = { squeeze: .8 };
        yield* this.walkTo(approach.x, approach.z, { ignore: id, pace: .7 });
        this.contact = {};
      } else { // leo lên mái ngồi canh vườn
        const roof = local(0, 1.2, 0);
        yield* this.jumpTo(roof.x, roof.y, roof.z); this.surface = id;
        yield* this.turnTo(this.facingHome());
        this.setPose('loaf'); yield* this.lookAround(rand(4, 7));
      }
    } else if (id === 'pond') {
      this.setPose('crouch'); this.face('focus'); this.tailSpeed = 5; this.goal.tailUp = .1;
      const fish = node.userData.fish || [];
      for (let t = 0, n = rand(4, 7); t < n; t += this.world.dt) {
        const f = fish[0]?.getWorldPosition(new THREE.Vector3());
        if (f) this.lookGoal = clamp(angDiff(this.heading, this.facing(f.x, f.z)) * 3, -1, 1);
        yield;
      }
      this.goal.paw = 1; this.goal.lean = .6; yield* this.wait(.3); // khều nước
      this.world.splash(node, this);
      this.goal.paw = 0; this.goal.lean = 0; this.face('grumble');
      this.setPose('sit');
      for (let i = 0; i < 4; i++) { this.goal.paw = i % 2; yield* this.wait(.12); } // vẩy chân cho khô
      this.goal.paw = 0; this.tailSpeed = 1.6;
      yield* this.groom();
    } else if (id === 'hammock') {
      const sling = local(0, .42, 0);
      yield* this.jumpTo(sling.x, sling.y, sling.z); this.surface = id;
      this.kick(node, .15); // lốp treo (xích đu) nhún nhẹ khi mèo đáp vào
      // Võng vải: thân võng xuống theo lòng võng, vải quấn ép hai bên (kiểu "burrito").
      // Lốp xe: giữa thân lún xuống lòng lốp; dây treo tì vào thân tự ấn thành rãnh (ropesTouching).
      this.contact = hangsFromBeam(kind) ? { sag: 1, squeeze: .45 } : { sag: .35, squeeze: .5 }; // võng vải: phần bó theo lòng vải do holdInTrough lo
      this.jigV.y -= 1.2; // đáp vào chỗ mềm: lún xuống rồi rung rinh
      if (hangsFromBeam(kind)) yield* this.turnTo(this.heading + Math.PI * .9, 3);
      else { // võng vải: nằm dọc theo lòng võng (nằm ngang thì đầu / chân thò qua thành vải)
        const axis = local(1, 0, 0).sub(center);
        yield* this.turnTo(Math.atan2(axis.x, axis.z) + (chance(.5) ? 0 : Math.PI), 3);
      }
      this.setPose('curl');
      yield* this.sleep(rand(8, 14));
      yield* this.yawnStretch();
      this.kick(node, .7); // đạp nhảy ra: xích đu còn lắc một lúc
    } else if (id === 'birdbath') {
      const bird = node.userData.bird;
      if (bird && !bird.userData.away) {
        this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6; this.wriggle = 1;
        yield* this.wait(rand(1, 1.6));
        this.wriggle = 0;
        this.world.scareBird(node); // chim bay mất
        this.setPose('sit'); this.lookGoal = .6;
        this.face('focus'); yield* this.wait(1.4); // nhìn theo chim bay mất
        this.face('grumble'); yield* this.wait(1); this.tailSpeed = 1.6;
      } else {
        const bowl = local(0, .92, .05);
        yield* this.jumpTo(bowl.x, bowl.y, bowl.z); this.surface = id;
        this.goal.lean = .8; this.face('blink'); yield* this.wait(2); // uống nước
        this.goal.lean = 0; this.face('open');
      }
    } else if (id === 'stove') {
      // Bếp nấu: nhảy lên mặt bếp còn ấm, nhồi bột rừ rừ rồi cuộn tròn ngủ gật.
      const seat = local(...node.userData.seat);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      this.setPose('knead'); this.face('blink'); this.purr = 1;
      this.contact = { spread: .3, sag: .2 };
      yield* this.wait(rand(2, 3));
      this.purr = 0;
      yield* this.turnTo(this.heading + Math.PI * .95, 3.5);
      this.setPose('curl'); this.contact = { spread: .5, sag: .3 };
      yield* this.sleep(rand(6, 10));
    } else if (id === 'sink') {
      // Bồn rửa: nhảy lên mặt bàn cạnh bồn, ngồi nhìn vòi nước rồi đưa chân quơ giọt nước, liếm chân.
      const seat = local(...node.userData.seat), tap = local(...node.userData.tap);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      yield* this.turnTo(this.facing(tap.x, tap.z));
      this.setPose('sit'); this.face('focus'); this.tailSpeed = 4;
      yield* this.wait(1);
      for (let i = 0; i < 3; i++) { this.goal.paw = 1; yield* this.wait(.3); this.goal.paw = 0; this.face('open'); yield* this.wait(.7); }
      this.face('happy'); this.tailSpeed = 1.6;
      yield* this.groom();
    } else if (id === 'catfood') {
      // Khay ăn: tới từng chén, cúi đầu ăn lạch cạch rồi liếm mép.
      for (const [bx, by, bz] of node.userData.bowls) {
        const spot = local(bx, 0, bz + .34), bowlAt = local(bx, by, bz);
        yield* this.walkTo(spot.x, spot.z, { ignore: id, near: .05, pace: .7 });
        yield* this.turnTo(this.facing(bowlAt.x, bowlAt.z));
        this.setPose('crouch'); this.goal.lean = .7; this.face('blink');
        yield* this.wait(rand(2.5, 4));
        this.goal.lean = 0; this.face('open');
        yield* this.wait(.4);
      }
      this.setPose('sit'); this.face('happy');
      yield* this.wait(.8);
      yield* this.groom();
    } else if (id === 'bench') {
      const seat = local(0, .5, 0);
      yield* this.jumpTo(seat.x, seat.y, seat.z); this.surface = id;
      yield* this.turnTo(this.heading + Math.PI, 3);
      this.setPose('loaf'); this.face('blink');
      this.contact = { spread: kind === 'bench-log' ? .4 : .55, sag: kind === 'bench-log' ? .25 : 0 }; // nằm ôm khúc gỗ tròn: võng nhẹ hai bên
      yield* this.sleep(rand(5, 9));
    }
  }

  // Vườn: rình và vồ bướm.
  *chaseButterfly() {
    const fly = this.world.butterflies?.[Math.floor(Math.random() * 2)];
    if (!fly) return;
    this.face('focus'); this.tailSpeed = 5; this.goal.tailUp = .3;
    for (let i = 0; i < 3; i++) {
      // Điểm tới / điểm vồ luôn dời ra khỏi đồ đạc: không bao giờ nhắm vào chỗ không tới được (trước đây gây đứng hình).
      const p = this.world.reachable(fly.position.x, fly.position.z);
      yield* this.walkTo(p.x, p.z, { near: .55, maxTime: 2.5 });
      yield* this.turnTo(this.facing(fly.position.x, fly.position.z), 8);
      this.setPose('crouch'); this.wriggle = 1; yield* this.wait(rand(.5, .9)); this.wriggle = 0;
      const q = this.world.reachable(fly.position.x - Math.sin(this.heading) * .2, fly.position.z - Math.cos(this.heading) * .2);
      yield* this.jumpTo(q.x, 0, q.z);
      this.goal.paw = 1; fly.scare(); yield* this.wait(.3); this.goal.paw = 0;
    }
    this.tailSpeed = 1.6; this.setPose('sit'); this.face('happy');
    yield* this.wait(1);
  }

  // ----- Tương tác giữa hai con -----
  *boop(other) {
    this.pair(other, 'boop', other.beBooped(this));
    const spot = { x: other.x + Math.sin(other.heading) * .7, z: other.z + Math.cos(other.heading) * .7 };
    this.goal.tailUp = 1;
    yield* this.walkTo(spot.x, spot.z, { near: .12, maxTime: 6 });
    yield* this.turnTo(this.facing(other.x, other.z));
    this.goal.lean = 1; other.goal.lean = 1;
    this.face('happy'); other.face('happy');
    this.quiverUntil = other.quiverUntil = this.world.time + 1.8; // đuôi dựng run run: lời chào thân thiện
    yield* this.wait(.5);
    this.world.hearts(this, other);
    yield* this.wait(.8);
    this.goal.lean = 0; other.goal.lean = 0;
    other.done = true;
    this.setPose('sit'); yield* this.slowBlink();
  }
  *beBooped(from) {
    this.social = 'boop'; this.partner = from; this.done = false;
    try {
      this.setPose('sit');
      for (let t = 0; !this.done && t < 8; t += this.world.dt) { this.turnToward(this.facing(from.x, from.z), 4); yield; }
      yield* this.wait(.6);
    } finally { this.social = null; this.partner = null; this.done = false; }
    yield* this.life();
  }
  *chase(other) {
    this.pair(other, 'chase', other.flee(this));
    this.face('focus'); this.goal.tailUp = 1; this.tailSpeed = 5;
    for (let t = 0; t < 4.5 && other.social === 'chase';) {
      const start = performance.now();
      yield* this.walkTo(other.x, other.z, { run: true, near: .6, maxTime: .5, glide: true });
      t += (performance.now() - start) / 1000 + this.world.dt;
    }
    other.done = true;
    this.speed = 0; this.running = false;
    this.tailSpeed = 1.6; this.setPose('sit'); this.face('happy');
    yield* this.wait(1.2);
    yield* this.groom();
  }
  *flee(from) {
    this.social = 'chase'; this.partner = from; this.done = false;
    try {
      this.face('annoyed'); this.goal.tailUp = 1; this.tailSpeed = 5; this.puffUntil = this.world.time + 1.6; // giật mình xù đuôi
      for (const until = this.world.time + 7; !this.done && this.world.time < until;) {
        let dx = this.x - from.x, dz = this.z - from.z;
        const d = Math.hypot(dx, dz) || 1;
        dx /= d; dz /= d;
        let tx = this.x + dx * 1.4 + rand(-.6, .6), tz = this.z + dz * 1.4 + rand(-.6, .6);
        const home = this.home(); // chạy trong khu đang đứng, không vọt qua cửa
        if (Math.abs(tx - home.x) > ROOM - .2 || Math.abs(tz - home.z) > ROOM - .2) { // bị dồn vào góc thì vòng ra
          tx = home.x - (this.x - home.x) * .6 + rand(-.8, .8); tz = home.z - (this.z - home.z) * .6 + rand(-.8, .8);
        }
        yield* this.walkTo(tx, tz, { run: true, near: .3, maxTime: .7, glide: true, direct: true });
      }
      this.speed = 0; this.running = false;
      this.tailSpeed = 1.6; this.setPose('sit'); this.face('grumble');
      yield* this.wait(1);
    } finally { this.social = null; this.partner = null; this.done = false; }
    yield* this.groom();
    yield* this.life();
  }
  *groomBuddy(other) {
    this.pair(other, 'groom', other.beGroomed(this));
    const side = other.heading + Math.PI / 2;
    yield* this.walkTo(other.x + Math.sin(side) * .6, other.z + Math.cos(side) * .6, { near: .12, maxTime: 6 });
    yield* this.turnTo(this.facing(other.x, other.z));
    this.setPose('loaf', { lean: .6 });
    for (let i = 0; i < 5; i++) { this.face('blink'); yield* this.wait(.5); this.face('blink'); yield* this.wait(.3); }
    this.world.hearts(this, other);
    other.done = true;
    yield* this.sleep(rand(3, 5));
  }
  *beGroomed(from) {
    this.social = 'groom'; this.partner = from; this.done = false;
    try {
      this.setPose('loaf'); this.face('happy'); this.purr = 1;
      for (let t = 0; !this.done && t < 9; t += this.world.dt) yield;
      this.purr = 0;
    } finally { this.social = null; this.partner = null; this.done = false; this.purr = 0; }
    yield* this.sleep(rand(3, 6));
    yield* this.life();
  }
  // Vật nhau đùa: rình, vồ, quơ vuốt qua lại rồi lăn lộn cùng nhau.
  *playFight(other) {
    this.pair(other, 'play', other.bePlayed(this));
    yield* this.walkTo(other.x + Math.sin(other.heading) * .8, other.z + Math.cos(other.heading) * .8, { near: .15, maxTime: 6 });
    yield* this.turnTo(this.facing(other.x, other.z));
    this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6; other.face('focus');
    this.wriggle = 1; yield* this.wait(rand(.6, 1)); this.wriggle = 0;
    const mid = this.world.reachable(this.x + (other.x - this.x) * .4, this.z + (other.z - this.z) * .4);
    yield* this.jumpTo(mid.x, 0, mid.z);
    for (let i = 0; i < 5; i++) { // quơ vuốt qua lại
      this.goal.paw = i % 2; other.goal.paw = (i + 1) % 2; this.goal.lean = other.goal.lean = .5;
      this.face('focus'); other.face('focus'); other.squash = .25;
      yield* this.wait(.26);
    }
    this.goal.paw = other.goal.paw = 0; this.goal.lean = other.goal.lean = 0;
    this.setPose('roll'); other.setPose('roll'); this.wriggle = other.wriggle = 1; // lăn lộn
    this.face('happy'); other.face('happy');
    yield* this.wait(rand(1.4, 2.2));
    this.wriggle = other.wriggle = 0;
    other.done = true;
    this.tailSpeed = 1.6; this.setPose('sit'); this.face('open');
    yield* this.groom();
  }
  *bePlayed(from) {
    this.social = 'play'; this.partner = from; this.done = false;
    try {
      this.setPose('sit');
      for (let t = 0; !this.done && t < 12; t += this.world.dt) { if (this.goal.roll < .5) this.turnToward(this.facing(from.x, from.z), 4); yield; }
    } finally { this.social = null; this.partner = null; this.done = false; this.wriggle = 0; }
    this.setPose('sit'); this.face('happy'); yield* this.wait(.6);
    if (chance(.5)) yield* this.zoomies(); else yield* this.groom(); // còn hăng thì chạy loạn
    yield* this.life();
  }
  // Nằm ngủ chung sát cạnh nhau.
  *cuddleNap(other) {
    this.pair(other, 'cuddle', other.beCuddled(this));
    const side = other.heading - Math.PI / 2;
    yield* this.walkTo(other.x + Math.sin(side) * .55, other.z + Math.cos(side) * .55, { near: .1, maxTime: 6 });
    yield* this.turnTo(other.heading);
    this.setPose('curl'); this.face('happy');
    this.contact = other.contact = { spread: .45 }; // nằm dính vào nhau, bẹp ra
    this.world.hearts(this, other);
    yield* this.sleep(rand(6, 10));
    this.contact = other.contact = {};
    other.done = true;
    yield* this.yawnStretch();
  }
  *beCuddled(from) {
    this.social = 'cuddle'; this.partner = from; this.done = false;
    try {
      this.setPose('loaf'); this.face('blink');
      for (let t = 0; !this.done && t < 16; t += this.world.dt) {
        if (from.sleeping && this.eyes !== 'sleep') { this.setPose('curl'); this.face('sleep'); this.tailWag = .05; this.tailSpeed = .5; }
        yield;
      }
    } finally { this.social = null; this.partner = null; this.done = false; this.tailWag = .25; this.tailSpeed = 1.6; }
    yield* this.yawnStretch();
    yield* this.life();
  }
  // Đi vòng ra sau ngửi đuôi bạn; bạn quay lại nhìn, khó chịu rồi bỏ đi.
  *sniffTail(other) {
    this.pair(other, 'sniff', other.beSniffed(this));
    yield* this.walkTo(other.x - Math.sin(other.heading) * .7, other.z - Math.cos(other.heading) * .7, { near: .12, maxTime: 6 });
    yield* this.turnTo(this.facing(other.x, other.z));
    this.goal.lean = .8; this.face('focus');
    yield* this.wait(1.3);
    this.goal.lean = 0; this.face('blink');
    other.done = true;
    yield* this.wait(.6);
    this.setPose('sit'); yield* this.lookAround(rand(1, 2));
  }
  *beSniffed(from) {
    this.social = 'sniff'; this.partner = from; this.done = false;
    try {
      this.setPose('stand'); this.face('open');
      for (let t = 0; !this.done && t < 8; t += this.world.dt) { this.lookGoal = t > 1 ? 1 : 0; this.tailSpeed = 4; yield; }
    } finally { this.social = null; this.partner = null; this.done = false; this.lookGoal = 0; this.tailSpeed = 1.6; }
    this.face('grumble'); this.world.say(this, '…', 1); this.puffUntil = this.world.time + .7;
    yield* this.wait(.5);
    const p = this.world.freeSpot(this);
    yield* this.walkTo(p.x, p.z, { near: .2, maxTime: 4 });
    yield* this.life();
  }
  // Đuôi bạn ngoe nguẩy thì ngứa mắt: rình từ phía sau, mắt dõi theo chóp đuôi, lắc mông rồi vồ.
  // Bạn giật bắn người, xù đuôi, quay lại: hoặc đuổi lại cho bõ tức, hoặc khè một cái rồi bỏ đi.
  *pounceTail(other) {
    this.pair(other, 'pounce', other.tailTeased(this));
    const behind = d => this.world.reachable(other.x - Math.sin(other.yaw) * d, other.z - Math.cos(other.yaw) * d);
    let p = behind(1.05);
    yield* this.walkTo(p.x, p.z, { near: .15, maxTime: 6, pace: .7 }); // rón rén
    const tailTip = () => ({ x: other.x - Math.sin(other.yaw) * .55, z: other.z - Math.cos(other.yaw) * .55 });
    yield* this.turnTo(this.facing(tailTip().x, tailTip().z));
    this.setPose('crouch'); this.face('focus'); this.tailSpeed = 6; this.goal.tailUp = .1;
    for (let t = 0; t < 1.6 && other.partner === this; t += this.world.dt) { // mắt dõi theo chóp đuôi đang quất
      const tip = tailTip(), swish = Math.sin(this.world.time * 2.6 * other.rig.tailStyle.speed) * .6;
      this.lookGoal = clamp(angDiff(this.heading, this.facing(tip.x, tip.z)) * 3 + swish, -1, 1);
      yield;
    }
    this.wriggle = 1; yield* this.wait(rand(.5, .9)); this.wriggle = 0;
    p = behind(.72);
    yield* this.jumpTo(p.x, 0, p.z);
    this.goal.paw = 1; this.goal.lean = .6; other.pounced = true;
    yield* this.wait(.3);
    this.goal.paw = 0; this.goal.lean = 0; this.lookGoal = 0; this.tailSpeed = 1.6;
    this.setPose('sit'); this.face('happy'); // mặt vô tội
    yield* this.wait(1.4);
    yield* this.slowBlink();
  }
  *tailTeased(from) {
    this.social = 'pounce'; this.partner = from; this.done = false; this.pounced = false;
    try {
      this.setPose(chance(.5) ? 'loaf' : 'sit'); this.tailWag = .6; this.tailSpeed = 2.6; // đuôi quét qua quét lại, mời gọi
      for (let t = 0; !this.pounced && t < 12 && from.partner === this; t += this.world.dt) yield;
    } finally { this.social = null; this.partner = null; this.tailWag = .25; this.tailSpeed = 1.6; }
    if (this.pounced) {
      this.pounced = false;
      // giật bắn: nảy dựng tại chỗ, tai cụp, đuôi xù
      this.face('annoyed'); this.setPose('stand', { tailUp: 1 }); this.puffUntil = this.world.time + 2.5;
      this.earFlopV = (this.earFlopV || 0) + 20; this.squash = -.5; this.squashV = 0;
      this.world.say(this, '!', 1);
      for (let t = 0; t < .34; t += this.world.dt) { const k = t / .34; this.y = .32 * 4 * k * (1 - k); yield; }
      this.y = 0; this.squash = .7; this.squashV = 0;
      yield* this.turnTo(this.facing(from.x, from.z), 10);
      if (chance(.55)) { this.face('focus'); yield* this.chase(from); } // trả đũa!
      else {
        this.face('annoyed'); this.world.say(this, '💢', 1);
        this.goal.paw = 1; yield* this.wait(.18); this.goal.paw = 0; yield* this.wait(.3);
        const p = this.world.freeSpot(this);
        yield* this.walkTo(p.x, p.z, { near: .2, maxTime: 4 });
        this.setPose('sit'); yield* this.groom();
      }
    }
    yield* this.life();
  }
  // Theo đuôi đại ca: lẽo đẽo đi sau một con khác vài vòng, đuôi dựng; con dẫn đường thỉnh thoảng ngoái lại.
  *follow(other) {
    this.pair(other, 'follow', other.leadWalk(this));
    this.goal.tailUp = 1; this.face('happy'); this.quiverUntil = this.world.time + 1;
    for (const until = this.world.time + 12; this.world.time < until && other.social === 'follow';) {
      const p = this.world.reachable(other.x - Math.sin(other.yaw) * .9, other.z - Math.cos(other.yaw) * .9);
      const far = Math.hypot(p.x - this.x, p.z - this.z);
      if (far > .25) yield* this.walkTo(p.x, p.z, { near: .2, maxTime: .4, run: far > 1.6, glide: true });
      else { // đứng chờ, nhìn theo bạn
        this.speed = damp(this.speed, 0, 8, this.world.dt);
        this.turnToward(this.facing(other.x, other.z), 3);
        yield;
      }
    }
    this.speed = 0; this.running = false;
    this.setPose('sit'); this.face('open');
    yield* this.slowBlink();
  }
  *leadWalk(from) {
    this.social = 'follow'; this.partner = from; this.done = false;
    try {
      this.goal.tailUp = 1; this.face('open');
      for (let i = 0, n = Math.floor(rand(2, 4)); i < n; i++) {
        const p = this.world.freeSpot(this);
        yield* this.walkTo(p.x, p.z, { near: .2, maxTime: 4, pace: .8 });
        this.lookGoal = clamp(angDiff(this.heading, this.facing(from.x, from.z)) * 2, -1, 1); // ngoái lại: còn theo không?
        yield* this.wait(rand(.6, 1.1));
        this.lookGoal = 0;
      }
    } finally { this.social = null; this.partner = null; this.lookGoal = 0; }
    this.setPose('sit'); yield* this.groom();
    yield* this.life();
  }
  // Dụi đầu: đi sát dọc sườn bạn, nghiêng người cọ vào, đuôi vắt qua lưng bạn (cách mèo đánh dấu "người nhà").
  *headBunt(other) {
    this.pair(other, 'bunt', other.beBunted(this));
    const side = other.yaw + (chance(.5) ? 1 : -1) * Math.PI / 2;
    const along = (fwd, off = .6) => this.world.reachable(
      other.x + Math.sin(other.yaw) * fwd + Math.sin(side) * off, other.z + Math.cos(other.yaw) * fwd + Math.cos(side) * off);
    let p = along(.8);
    this.goal.tailUp = 1;
    yield* this.walkTo(p.x, p.z, { near: .12, maxTime: 6 });
    p = along(-.7);
    yield* this.turnTo(this.facing(p.x, p.z));
    this.rubWith = other; this.face('happy'); this.goal.tailUp = .85;
    try { yield* this.walkTo(p.x, p.z, { near: .1, maxTime: 3, pace: .45 }); } // cọ chầm chậm dọc người bạn
    finally { this.rubWith = null; }
    this.world.hearts(this, other);
    other.done = true;
    yield* this.turnTo(this.facing(other.x, other.z));
    this.setPose('sit'); yield* this.slowBlink();
  }
  *beBunted(from) {
    this.social = 'bunt'; this.partner = from; this.done = false;
    try {
      this.setPose('sit'); this.face('happy'); this.purr = 1; this.quiverUntil = this.world.time + 2;
      for (let t = 0; !this.done && t < 10; t += this.world.dt) { this.lookGoal = clamp(angDiff(this.heading, this.facing(from.x, from.z)) * 2, -1, 1); yield; }
    } finally { this.social = null; this.partner = null; this.done = false; this.purr = 0; this.lookGoal = 0; }
    yield* this.slowBlink();
    yield* this.life();
  }
  // Thấy bạn được cưng thì ghen: chạy tới ngồi chen cạnh, kêu meo meo đòi phần, liếc sang con kia.
  *jealous(target) {
    this.social = 'jealous';
    try {
      const cam = this.world.cameraPos?.();
      const toCam = cam ? Math.atan2(cam.x - target.x, cam.z - target.z) : target.heading;
      const side = toCam + (chance(.5) ? 1 : -1) * .9;
      const p = this.world.reachable(target.x + Math.sin(side) * .8, target.z + Math.cos(side) * .8);
      this.goal.tailUp = 1; this.face('focus');
      yield* this.walkTo(p.x, p.z, { near: .15, maxTime: 4, run: Math.hypot(p.x - this.x, p.z - this.z) > 1.5 });
      if (cam) yield* this.turnTo(this.facing(cam.x, cam.z), 7);
      this.setPose('sit'); this.quiverUntil = this.world.time + 2.4;
      for (let i = 0; i < 2; i++) { this.face('open'); this.squash = -.18; this.world.say(this, '♪', 1); yield* this.wait(.5); this.face('open'); yield* this.wait(.35); }
      this.lookGoal = clamp(angDiff(this.heading, this.facing(target.x, target.z)) * 2, -1, 1); this.face('grumble'); // liếc xéo
      yield* this.wait(1.1);
      this.lookGoal = 0; this.face('open');
      yield* this.wait(.8);
    } finally { this.social = null; this.lookGoal = 0; }
    yield* this.life();
  }
  // AFK: buồn ngủ ở đâu ngủ ở đó, mỗi con một tư thế (cuộn tròn / nằm khoanh / nằm ngửa phơi bụng),
  // ngủ một giấc rồi có khi trở mình: tỉnh dậy vươn vai, đi vài bước tìm chỗ khác rồi ngủ tiếp.
  *nap() {
    this.napping = true;
    try {
      while (this.world.afk) {
        this.release(); this.speed = 0;
        if (chance(.5)) { this.face('half'); yield* this.wait(rand(.6, 1.2)); } // ngáp trước khi ngủ
        const onFloor = this.y < .01;
        this.setPose(!onFloor ? 'loaf' : chance(.15) ? 'roll' : chance(.55) ? 'curl' : 'loaf');
        if (!onFloor || this.goal.roll < .5) this.contact = { spread: rand(.2, .45) }; // ngủ say: thân bẹp ra
        this.face('half'); yield* this.wait(rand(.4, 1.6));
        this.face('sleep'); this.sleeping = true; this.tailWag = .05; this.tailSpeed = .5;
        const until = this.world.time + rand(18, 45);
        try { while (this.world.afk && this.world.time < until) yield; }
        finally { this.sleeping = false; this.tailWag = .25; this.tailSpeed = 1.6; this.contact = {}; }
        if (!this.world.afk) break;
        // trở mình: vươn vai, có khi đổi chỗ, rồi ngủ tiếp
        yield* this.yawnStretch();
        if (chance(.5) && onFloor) { const p = this.world.freeSpot(this); yield* this.walkTo(p.x, p.z, { near: .2, maxTime: 4, pace: .6 }); }
        if (chance(.4)) yield* this.groom();
      }
    } finally { this.napping = false; this.sleeping = false; }
    yield* this.wait(rand(0, 2.5)); // tỉnh lệch nhau
    yield* this.yawnStretch();
    yield* this.life();
  }
  // Bị người chơi nhấc lên: lơ lửng theo ngón tay, thân lắc như con lắc; thả tay thì rơi xuống chỗ trống gần nhất,
  // nhún khi chạm đất, vẩy người rồi liếm lông (mèo thật hay làm vậy sau khi bị bế).
  *beCarried() {
    this.release(); this.surface = null; this.sleeping = false; this.speed = 0; this.social = null; this.partner = null;
    this.face('annoyed'); this.setPose('stand', { tailUp: 0 }); this.tailWag = .6; this.tailSpeed = 4; this.puffUntil = this.world.time + 1;
    const lifted = this.world.time;
    let hoverToy = null;
    while (this.carried) {
      const dt = this.world.dt;
      spring(this, 'x', this.carryX, 140, .8, dt);
      spring(this, 'z', this.carryZ, 140, .8, dt);
      spring(this, 'y', CARRY_H, 90, .7, dt);
      // Đang bị nhấc: xoay người cho mặt đối diện màn hình (theo camera, kể cả khi bạn xoay khu nhà), mắt nhìn thẳng.
      const cam = this.world.cameraPos?.();
      if (cam) this.turnToward(this.facing(cam.x, cam.z), 9);
      this.lookGoal = 0;
      // Bế tới gần một món đồ chơi được: mèo tò mò (mắt mở, ♪), thả ra là chạy tới chơi.
      const near = this.world.nearToy(this.carryX, this.carryZ);
      if (near !== hoverToy) {
        hoverToy = near;
        if (near) { this.face('focus'); this.world.say(this, '♪', 1); } else this.face('annoyed');
      }
      // Bị nhấc lơ lửng: angry; bế lâu thì đổi sang chew (lầm bầm chịu trận)
      if (!hoverToy && this.world.time - lifted > 1.4 && this.eyes === 'annoyed') this.face('grumble');
      yield;
    }
    this.tailWag = .25; this.tailSpeed = 1.6;
    const toy = this.world.nearToy(this.carryX, this.carryZ);
    const land = this.world.landingSpot(this), x0 = this.x, z0 = this.z, y0 = Math.max(this.y, .01);
    let vy = 0;
    while (this.y > 0) {
      vy -= 14 * this.world.dt;
      this.y = Math.max(0, this.y + vy * this.world.dt);
      const k = 1 - this.y / y0;
      this.x = x0 + (land.x - x0) * k; this.z = z0 + (land.z - z0) * k;
      yield;
    }
    this.xV = this.zV = this.yV = 0;
    this.squash = .9; this.squashV = 0; this.earFlopV = (this.earFlopV || 0) + 16;
    if (toy) { // thả gần một món: không hờn, chạy tới dùng món đó luôn
      this.face('open'); this.setPose('stand');
      yield* this.wait(.25);
      try { yield* this.useFurniture(toy); } finally { this.release(); this.setPose('stand'); this.face('open'); this.lookGoal = 0; this.contact = {}; }
      yield* this.life();
      return;
    }
    this.face('annoyed');
    yield* this.wait(.35);
    this.wriggle = 1; yield* this.wait(.45); this.wriggle = 0; // vẩy người
    this.face('open');
    this.setPose('sit');
    yield* this.groom();
    yield* this.life();
  }
  // Người chơi chạm vào mèo. Trả về tâm trạng để giao diện chọn hiệu ứng:
  //   'happy' (tim) · 'sleepy' (ngủ say, chỉ mỉm cười) · 'warning' (chạm dồn dập: lim dim, quẫy đuôi)
  //   'grumpy' (chạm quá nhiều: nổi giận, khè, quơ vuốt rồi bỏ đi hờn; trong lúc hờn chạm vào chỉ thêm 💢)
  pet() {
    const now = this.world.time;
    if (now < (this.grumpyUntil || 0)) { this.face('annoyed'); this.earFlopV = (this.earFlopV || 0) + 10; this.puffUntil = now + .8; return 'grumpy'; }
    this.petTimes = (this.petTimes || []).filter(t => now - t < PET_ANNOY.WINDOW);
    this.petTimes.push(now);
    if (this.petTimes.length >= PET_ANNOY.ANGRY && !this.carried) {
      this.petTimes = []; this.petUntil = 0; this.grumpyUntil = now + PET_ANNOY.SULK;
      this.interrupt(this.grumpy());
      return 'grumpy';
    }
    this.petUntil = now + 1.3;
    this.jigV.y -= 1.1; this.jigV.x += rand(-.6, .6); // chọc vào: thân lún xuống rồi rung rinh
    this.petMood = this.petTimes.length >= PET_ANNOY.WARN ? 'warning' : 'happy';
    if (this.petMood === 'warning' && this.sleeping) this.interrupt(this.life()); // bị chọc mãi thì tỉnh giấc, bực bội
    else if (this.sleeping) { this.earSide = chance(.5) ? 0 : 1; this.earTwitchV = (this.earTwitchV || 0) + 16; return 'sleepy'; } // ngủ say: chỉ giật giật tai
    if (this.petMood === 'happy') {
      this.world.notice(this.x, this.z, { except: this, radius: 2.6 }); // con khác ngoái nhìn
      if (this.petTimes.length === 1 && chance(.3)) this.world.jealousy(this); // ...có khi một con chạy tới đòi được cưng
    }
    return this.petMood;
  }
  *grumpy() {
    this.release(); this.surface = null; this.sleeping = false; this.social = null; this.partner = null;
    if (this.y > .01) yield* this.getDown();
    this.setPose('crouch', { tailUp: 1 }); this.face('annoyed'); this.tailSpeed = 8; this.tailWag = .9;
    this.squash = -.35; this.earFlopV = (this.earFlopV || 0) + 18; // xù lông, cụp tai
    this.puffUntil = this.world.time + 3.5; // đuôi xù to như chổi
    this.world.say(this, '💢', 1);
    this.world.notice(this.x, this.z, { except: this, startle: true });
    yield* this.wait(.5);
    const cam = this.world.cameraPos?.();
    if (cam) yield* this.turnTo(this.facing(cam.x, cam.z), 9);
    for (let i = 0; i < 2; i++) { // quơ vuốt về phía người chơi
      this.goal.paw = 1; this.goal.lean = .6; this.face('annoyed'); yield* this.wait(.16);
      this.goal.paw = 0; this.goal.lean = 0; this.face('annoyed'); yield* this.wait(.22);
    }
    this.world.say(this, '💢', 1);
    const p = this.world.freeSpot(this); // bỏ đi chỗ khác, quay lưng lại hờn dỗi
    yield* this.walkTo(p.x, p.z, { near: .2, maxTime: 4 });
    if (cam) yield* this.turnTo(this.facing(cam.x, cam.z) + Math.PI, 4);
    this.setPose('loaf'); this.tailSpeed = 3; this.tailWag = .5;
    yield* this.wait(rand(3, 5));
    this.tailSpeed = 1.6; this.tailWag = .25; this.face('open');
    yield* this.groom();
    yield* this.life();
  }

  // ----- Thân mềm (soft body) -----
  // Đỉnh thân là một khối nặng gắn lò xo với đáy: thân tăng/giảm tốc, nảy, quay, bị nhấc... thì đỉnh trễ lại rồi
  // lắc qua lắc lại tắt dần. Gia tốc lấy từ vị trí thật của con mèo (x, y, z + cú nảy khi cưng), KHÔNG lấy từ nhịp
  // nhún bước chân (chỉ là hoạt hình, đưa vào thì thân rung liên tục và cộng hưởng nên giật). Mọi chuyển động thật (đi, nhảy,
  // đổi tư thế, bị kéo) đều tự sinh rung, không phải gắn tay từng hành vi.
  // jig = độ lệch của đỉnh thân trong hệ toạ độ thân (x ngang, y lún/giãn, z trước sau).
  jelly(dt) {
    const rig = this.rig, body = rig.body;
    body.updateWorldMatrix(true, false);
    // Trừ phần bị đẩy tách khỏi đồ đạc / mèo khác (corrX/corrZ, cộng dồn trong separate()): cú đẩy là sửa va chạm tức thời,
    // không phải chuyển động thật. Trước đây cứ đứng sát đồ là mỗi frame bị đẩy ra một chút -> gia tốc giả -> thân lắc mãi.
    const pos = JELLY.tmpPos.set(this.x - (this.corrX || 0), this.y + this.hopY, this.z - (this.corrZ || 0));
    // Frame không có thời gian trôi (dt = 0) vẫn phải co mặt theo thân, không thì mặt nhảy về cỡ đủ trong một frame (giật).
    if (!this.lastBodyPos || dt <= 0) { this.lastBodyPos = pos.clone(); rig.eyes.scale.y *= body.scale.y; return; }
    const vel = JELLY.tmpVel.subVectors(pos, this.lastBodyPos).divideScalar(dt);
    const acc = JELLY.tmpAcc.subVectors(vel, this.lastBodyVel).divideScalar(dt);
    this.lastBodyPos.copy(pos); this.lastBodyVel.copy(vel);
    if (acc.length() > JELLY.MAX_ACC) acc.setLength(JELLY.MAX_ACC); // dịch chuyển tức thời (thả mèo mới vào phòng...) không làm nổ
    this.accF ||= new THREE.Vector3();
    acc.copy(this.accF.lerp(acc, 1 - Math.exp(-dt / JELLY.SMOOTH))); // lọc thông thấp
    acc.applyQuaternion(JELLY.tmpQ.setFromRotationMatrix(body.matrixWorld).invert()); // đổi sang hệ toạ độ thân
    for (const axis of ['x', 'y', 'z']) {
      const [k, zeta, gain, max] = JELLY[axis];
      const a = -k * this.jig[axis] - 2 * zeta * Math.sqrt(k) * this.jigV[axis] - acc[axis] * gain;
      this.jigV[axis] += a * dt;
      this.jig[axis] = clamp(this.jig[axis] + this.jigV[axis] * dt, -max * 3, max * 3);
      this.bend[axis] = max * Math.tanh(this.jig[axis] / max); // chặn mềm: gần ngưỡng thì cứng dần, không khựng cái cụp
    }
    // Biến dạng do tiếp xúc với đồ vật (this.contact, đặt trong từng hành vi): chạy về đích bằng lò xo cho mềm.
    const soft = this.soft, want = this.contact;
    for (const key of SOFT_KEYS) spring(soft, key, want[key] || 0, 55, .55, dt);
    const ropes = this.ropesTouching(body), trough = this.troughHolding(body);
    rig.legs.forEach(leg => { leg.hip.visible = !trough; }); // nằm trong võng: chân xếp gọn dưới bụng, không thò qua vải
    const base = rig.bodyBase, out = body.geometry.attributes.position, arr = out.array, v = JELLY.tmpV;
    // Dáng không đổi so với lần uốn trước (đứng yên, hoặc nằm bẹp ngủ yên một tư thế): bỏ qua vòng uốn ~3000 đỉnh.
    // Có dây / võng thì luôn uốn lại (dây, vải còn đung đưa).
    const b = this.bend, f = this.soft, sig = this.shapeSig ||= new Float32Array(7);
    const now = [b.x, b.y, b.z, f.spread, f.sag, f.squeeze, f.front];
    let changed = ropes.length > 0 || !!trough || this.wasHeld;
    for (let k = 0; k < 7; k++) if (Math.abs(now[k] - sig[k]) > 1e-4) { changed = true; sig[k] = now[k]; }
    this.wasHeld = ropes.length > 0 || !!trough; // vừa rời dây / võng: uốn lại một lần nữa cho về dáng thường
    const skipBody = !changed, skipDecals = skipBody && Math.abs(this.look - (this.decalLook ?? NaN)) < 1e-4;
    this.decalLook = this.look;
    if (!skipBody) for (let i = 0; i < arr.length; i += 3) {
      this.deform(base[i], base[i + 1], base[i + 2], v);
      if (ropes.length) dentByRopes(v, ropes);
      if (trough) holdInTrough(v, trough);
      arr[i] = v.x; arr[i + 1] = v.y; arr[i + 2] = v.z;
    }
    if (!skipBody) { out.needsUpdate = true; body.geometry.boundingSphere = null; } // tính lại khối bao để raycast (bấm vào mèo) đúng hình mới
    // Mặt / mắt: dán lên mặt trước bo tròn rồi uốn cùng công thức với đỉnh thân -> luôn khít với thân.
    // Mắt liếc (this.look) = trượt dọc bề mặt, không phải dời cả tấm ra khỏi thân.
    for (const decal of [rig.eyes]) {
      const flat = decal.userData.flat, lift = decal.userData.lift, attr = decal.geometry.attributes.position, a = attr.array;
      const shift = decal === rig.eyes ? this.look * .03 : 0;
      if (!skipDecals) for (let i = 0; i < a.length; i += 3) {
        const x = flat[i] + shift, y = flat[i + 1];
        this.deform(x, y, frontSurface(x, y) + lift, v, lift);
        if (trough) holdInTrough(v, trough, lift);
        a[i] = v.x; a[i + 1] = v.y; a[i + 2] = v.z;
      }
      if (!skipDecals) attr.needsUpdate = true;
      decal.scale.y *= body.scale.y; // thân co khi nằm thì mắt co theo (nhân vào scale.y = 1 đặt lại trong update)
    }
    // Tai: gốc tai bám theo điểm đỉnh thân ngay bên dưới (cùng phép biến dạng).
    const top = H / 2 + (H / 2) * body.scale.y; // đỉnh thân thật (thân co khi nằm)
    for (const [node, home] of rig.rest) {
      const bx = home.x, bz = home.z - D / 2; // gốc tai trong hệ toạ độ thân (đỉnh thân: y = H/2)
      this.deform(bx, H / 2, bz, v);
      node.position.set(home.x + (v.x - bx), home.y - (H - top) + (v.y - H / 2) * body.scale.y, home.z + (v.z - bz));
    }
  }

  // Một điểm của thân (hệ toạ độ thân, chưa biến dạng; y = -H/2 đáy .. H/2 đỉnh) -> vị trí sau biến dạng.
  // Thứ tự: biến dạng do tiếp xúc (soft) rồi mới lắc kiểu thạch (bend) chồng lên trên.
  //   spread : nằm bẹp trên mặt êm / chỗ ấm: đỉnh lún xuống, đáy bè ra (kiểu "mèo tan chảy" / bánh mochi)
  //   sag    : nằm trên chỗ treo lõm (võng, lòng lốp): giữa thân võng xuống, hai đầu vểnh lên
  //   squeeze: bị ép hai bên (thùng các-tông, vải võng quấn, chui cửa hẹp): eo thóp lại, đỉnh phồng lên
  //   front  : áp mặt / ngực vào mặt phẳng (kính bể cá, thân cây cào móng): mặt trước bẹp phẳng, bè ra hai bên
  deform(x, y, z, out, lift = 0) {
    const { spread, sag, squeeze, front } = this.soft, { x: jx, y: jy, z: jz } = this.bend;
    const h = clamp((y + H / 2) / H, 0, 1), low = 1 - h, along = clamp(z / (D / 2), -1, 1);
    let sx = 1 + spread * .2 * Math.pow(low, .7) - squeeze * .2 * Math.pow(low, 1.4) + squeeze * .06 * h;
    const ny = y - spread * .2 * H * h + squeeze * .07 * H * h - sag * .09 * (1 - along * along) * (.55 + .45 * low);
    let nz = z * (1 + spread * .1 * low);
    if (front > 0) { // ép phẳng phần trước thân, phần bị ép bè sang ngang
      const lim = D / 2 - front * .07 + lift, over = Math.max(0, nz - lim);
      nz -= over; sx += over * 1.6;
    }
    const w = h * h, belly = 1 - jy / H * JELLY.BELLY * Math.sin(h * Math.PI);
    return out.set(x * sx * belly + jx * w, ny + jy * w, nz * belly + jz * w);
  }

  // Lòng võng vải (nửa ống trụ hở miệng) của món đồ đang nằm: trả về phép đổi toạ độ thân <-> vải để holdInTrough
  // ép mọi điểm thân lọt ra ngoài lớp vải vào đúng mặt vải -> thân bị vải bó cong theo lòng võng.
  troughHolding(body) {
    const id = this.carried || this.airK !== null ? null : this.surface;
    const node = id && this.world.furniture[id];
    if (!node?.visible) return null;
    const cloth = node.userData.catTrough !== undefined ? node.userData.catTrough : (node.userData.catTrough = findTrough(node));
    if (!cloth) return null;
    cloth.updateWorldMatrix(true, false);
    const t = this.trough ||= { toCloth: new THREE.Matrix4(), toBody: new THREE.Matrix4(), r: 0 };
    t.toCloth.copy(cloth.matrixWorld).invert().multiply(body.matrixWorld); // thân -> vải
    t.toBody.copy(t.toCloth).invert();
    const pr = cloth.geometry.parameters, mid = pr.thetaStart + pr.thetaLength / 2;
    t.r = pr.radiusTop - .012; t.mx = Math.sin(mid); t.mz = Math.cos(mid); // trừ độ dày vải; hướng giữa cung vải
    return t;
  }

  // Dây của món đồ đang nằm / ngồi / dùng (xích đu lốp, võng, bóng treo...): hình trụ mảnh trong món đồ.
  // Trả về các đoạn dây đổi sang hệ toạ độ thân, chỉ những đoạn đi sát thân (để dentByRopes ấn lõm thân).
  ropesTouching(body) {
    const id = this.carried || this.airK !== null ? null : this.surface || this.busyWith;
    const node = id && this.world.furniture[id];
    if (!node?.visible) return NO_ROPES;
    const ropes = node.userData.catRopes ||= findRopes(node);
    if (!ropes.length) return NO_ROPES;
    const inv = JELLY.tmpM.copy(body.matrixWorld).invert(), list = this.ropeList ||= [];
    list.length = 0;
    ropes.forEach((rope, i) => {
      rope.updateWorldMatrix(true, false);
      const half = rope.geometry.parameters.height / 2, seg = (this.ropeSegs ||= [])[i] ||= { a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0 };
      seg.a.set(0, -half, 0).applyMatrix4(rope.matrixWorld).applyMatrix4(inv);
      seg.b.set(0, half, 0).applyMatrix4(rope.matrixWorld).applyMatrix4(inv);
      seg.r = rope.geometry.parameters.radiusTop + .014; // + độ dày lông
      if (segToBoxGap(seg.a, seg.b) < .08) list.push(seg);
    });
    return list;
  }

  // ----- Đuôi không xuyên sàn -----
  // Sau khi lò xo đặt góc từng đốt: đốt nào có đầu mút (kể cả độ dày đốt) thụt xuống dưới mặt đang đứng thì
  // nhấc đốt đó lên vừa chạm mặt (Newton 1 chiều theo góc gập, đạo hàm tính bằng sai phân), và ghi góc đã sửa vào
  // trạng thái lò xo để đuôi nằm ÉP trên sàn thay vì nảy xuyên xuống rồi bị kéo lên mỗi frame.
  // Đang bay (nhảy) / bị nhấc thì bỏ qua: sàn thật ở xa bên dưới.
  tailFloor(puff) {
    if (this.carried || this.airK !== null) return;
    const rig = this.rig, tail = rig.tail, style = rig.tailStyle, floor = this.y + .02, tip = TAIL_TMP.tip, eps = .04;
    const tipY = joint => { joint.updateWorldMatrix(true, false); return tip.set(0, style.seg, 0).applyMatrix4(joint.matrixWorld).y; };
    for (let i = 0; i < tail.length; i++) {
      const joint = tail[i], k = i / Math.max(1, tail.length - 1);
      let r = (style.r0 + (style.r1 - style.r0) * k) * (style.fluff ? 1.3 : 1) * (1 + puff * .65);
      if (i === tail.length - 1 && (style.pom || style.tuft)) r = Math.max(r, (style.pom || style.tuft) * 1.2);
      for (let it = 0; it < 3; it++) {
        const y0 = tipY(joint), pen = floor + r - y0;
        if (pen <= 0) break;
        joint.rotation.x += eps;
        const slope = (tipY(joint) - y0) / eps;
        joint.rotation.x -= eps;
        if (Math.abs(slope) < .01) break; // đốt đang dựng đứng: gập không làm cao thêm
        joint.rotation.x += clamp(pen / slope, -.5, .5);
      }
      if (joint.rotation.x !== this.tailX[i]) { this.tailX[i] = joint.rotation.x; if (this.tailXV) this.tailXV[i] = 0; }
    }
  }

  // ----- Mỗi frame: não chạy trước, rồi thân thể đi theo bằng lò xo -----
  update(dt, t) {
    const petting = t < this.petUntil;
    if (!petting) this.brain?.next();
    const pose = this.pose, goal = this.goal, rig = this.rig;
    for (const key in goal) { const [k, z] = POSE_SPRING[key] || [80, .8]; spring(pose, key, goal[key], k, z, dt); }
    // Có động ở đâu đó (world.notice): mắt liếc + thân xoay theo; con đang rảnh đứng yên thì quay hẳn người lại nhìn.
    const att = !petting && this.attention && t < this.attention.until ? this.attention : null;
    if (att && this.interruptible() && this.speed < .05) this.turnToward(this.facing(att.x, att.z), 2.2);
    spring(this, 'look', att ? clamp(angDiff(this.yaw, this.facing(att.x, att.z)) * 1.6, -1, 1) : this.lookGoal, 90, .8, dt);
    // Dụi người: nghiêng thân về phía bạn đang cọ (rubWith), hoặc lắc lư dụi vào tay khi được cưng.
    let rubGoal = 0;
    if (this.rubWith) {
      const dx = this.rubWith.x - this.x, dz = this.rubWith.z - this.z;
      rubGoal = -Math.sign(dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw)) * .2; // nghiêng về sườn có bạn
    } else if (petting && this.petMood === 'happy' && !this.sleeping) rubGoal = Math.sin(t * 4.5) * .13;
    spring(this, 'rub', rubGoal, 70, .7, dt);
    // Xù đuôi khi giật mình / bực (puffUntil); sắp hết kiên nhẫn lúc bị cưng thì xù nhẹ.
    spring(this, 'puff', t < (this.puffUntil || 0) ? 1 : petting && this.petMood === 'warning' ? .4 : 0, 90, .5, dt);
    spring(this, 'squash', 0, 150, .2, dt);            // nhún/giãn: tắt rất ít nên nảy 2–3 nhịp như thạch
    spring(this, 'earFlop', 0, 120, .35, dt);
    spring(this, 'yaw', this.yaw + angDiff(this.yaw, this.heading), 150, .85, dt);
    const turnRate = this.yawV || 0;
    // Con lắc khi bị nhấc: vận tốc kéo (theo hướng thân) làm thân nghiêng ngược lại rồi đung đưa tắt dần.
    const vx = this.xV || 0, vz = this.zV || 0, cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const forward = this.carried ? vx * sy + vz * cy : 0, lateral = this.carried ? vx * cy - vz * sy : 0;
    spring(this, 'swayF', clamp(-forward * .16, -.5, .5), 45, .28, dt);
    spring(this, 'swayL', clamp(lateral * .16, -.5, .5), 45, .28, dt);
    const moveGoal = clamp(this.speed / .72, 0, 2.4) + (this.shuffle || 0) * .5;
    this.shuffle = 0;
    spring(this, 'move', moveGoal, 60, .95, dt);
    const accel = (this.speed - (this.lastSpeed || 0)) / Math.max(dt, 1e-3);
    this.lastSpeed = this.speed;
    this.lean = damp(this.lean, clamp(accel * .045, -.14, .14), 7, dt);
    const vy = (this.y - this.lastY) / Math.max(dt, 1e-3);
    this.lastY = this.y;

    // Cưng: 2 cú nảy parabol, mỗi lần chạm đất nhún một cái
    let hop = 0;
    if (petting && !this.sleeping) {
      const e = 1.3 - (this.petUntil - t), seg = e % .5, k = seg / .42;
      hop = e < 1 && k < 1 ? .2 * 4 * k * (1 - k) : 0;
      if (this.hopY > 0 && hop === 0) { this.squash = .55; this.squashV = 0; this.earFlopV = (this.earFlopV || 0) + 8; }
    }
    this.hopY = hop;

    // ---- Mặt: mí mắt khép dần rồi mới nhắm; tự chớp; mắt liếc ----
    let eyes = this.eyes, mouth = this.mouth;
    if (petting) {
      const warn = this.petMood === 'warning';
      // Được cưng: happy; bị chọc dồn dập (sắp nổi giận): grumble
      eyes = this.sleeping ? 'sleep' : warn ? 'grumble' : 'happy'; mouth = 'calm';
      if (warn) { this.tailSpeed = 6; this.tailWag = .8; } // quẫy đuôi = sắp hết kiên nhẫn
    } else if (this.petMood === 'warning') { this.petMood = 'happy'; this.tailSpeed = 1.6; this.tailWag = .25; }
    this.nextBlink -= dt;
    // Chỉ mặt trung tính (open) mới tự chớp; mặt cute (focus) là đang nhìn chằm chằm nên không chớp
    const canBlink = eyes === 'open';
    const blinking = canBlink && this.nextBlink < 0;
    if (this.nextBlink < -.16) this.nextBlink = chance(.2) ? rand(.15, .3) : rand(2.5, 6); // thỉnh thoảng chớp đôi
    spring(this, 'lid', blinking ? 0 : 1, 900, 1, dt);
    // Mặt đổi theo nguyên nhân (cat-face.mjs), giữ tối thiểu HOLD giây; chớp mắt là lớp phủ riêng, không tính vào lần đổi mặt
    this.faceState = this.faceState || {};
    const urgent = petting || this.carried || eyes === 'annoyed';
    let expr = settleExpression(this.faceState, expressionOf(eyes, mouth), t, urgent);
    if (canBlink && this.lid < .45) expr = 'blink';
    this.expression = expr;
    const eyesTex = expressionTexture(this.breed, expr);
    if (rig.eyesMat.map !== eyesTex) { rig.eyesMat.map = eyesTex; rig.eyesMat.needsUpdate = true; }
    // jelly() nhân scale.y của lớp biểu cảm theo thân đang co: đặt lại 1 mỗi frame, không thì mặt bị bóp dần tới mất
    rig.eyes.scale.y = 1;
    // mắt liếc ngang (this.look): cộng trong jelly() cùng với độ lắc của thân

    // ---- Tai: giật bằng xung lò xo, cụp khi tiếp đất, dỏng khi tập trung, cụp khi bực ----
    this.nextEar -= dt;
    if (this.nextEar < 0) { this.earSide = chance(.5) ? 0 : 1; this.earTwitchV = (this.earTwitchV || 0) + 22; this.nextEar = rand(2, 7); }
    spring(this, 'earTwitch', 0, 380, .28, dt);
    const annoyed = this.eyes === 'annoyed', focus = this.eyes === 'focus';
    rig.ears.forEach((ear, i) => {
      const side = i ? 1 : -1;
      ear.rotation.z = (i === this.earSide ? this.earTwitch * .045 * side : 0) + (annoyed ? side * .35 : 0);
      ear.rotation.x = -this.earFlop * .05 + (focus || att ? .18 : 0) - (this.sleeping ? .15 : 0);
      ear.rotation.y = att ? clamp(this.look * .6, -.5, .5) : 0; // xoay vành tai về phía tiếng động
    });

    // ---- Thân ----
    const move = Math.max(0, this.move), amp = Math.min(1.2, move), run = this.running;
    const g = this.gait;
    const walkBob = run ? (1 - Math.cos(g)) / 2 * .075 * amp : (1 - Math.cos(2 * g)) / 2 * .022 * amp;
    const sway = run ? 0 : Math.sin(g) * .035 * amp;
    const gaitPitch = run ? Math.sin(g) * .11 * amp : Math.sin(2 * g) * .014 * amp;
    const idle = move < .1 && !this.sleeping ? Math.sin(t * .7 + this.phase) * .018 : 0; // dồn trọng tâm khi đứng/ngồi yên
    const breathe = Math.sin(t * (this.sleeping ? 1.6 : 2.6) + this.phase) * (this.sleeping ? .03 : .011);
    const purr = (this.purr || (petting ? 1 : 0)) ? Math.sin(t * 90) * .004 : 0;

    rig.root.position.set(this.x, this.y, this.z);
    rig.root.rotation.y = this.yaw;
    rig.hopper.position.y = hop + walkBob + purr;
    const s = this.squash; // dương = nhún bẹp, âm = vươn dài
    rig.hopper.scale.set(1 + s * .12 - breathe * .3, 1 - s * .2 + breathe, 1 + s * .08 - s * (s < 0 ? .15 : 0));
    const turnLean = clamp(-turnRate * .045 * (.35 + amp), -.2, .2);
    rig.roller.rotation.z = this.swayL + pose.roll * 1.3 + (this.wriggle ? Math.sin(t * 20) * .09 : 0) + pose.curl * .12 + sway + turnLean + idle + this.rub;
    // Ngồi kiểu mèo thật: mông hạ sát sàn, ngực nhổm nhẹ -> chân trước gần như giữ độ dài, trông tròn trịa.
    rig.pivot.position.y = LEG * (1 - Math.max(clamp(pose.lie, 0, 1), clamp(pose.sit, 0, 1) * .9)) + pose.stretch * .1 - pose.lie * .02;
    rig.pivot.rotation.x = -clamp(pose.sit, 0, 1) * .24 + pose.stretch * .32 + pose.lean * .22 + (this.airPitch || 0) - pose.groom * .15 + gaitPitch + this.lean + this.swayF;
    rig.pivot.position.z = -D / 2 + pose.lean * .1;
    rig.pivot.rotation.y = 0;
    rig.roller.rotation.y = pose.curl * .35 + this.look * .12; // xoay cả thân lẫn chân theo hướng nhìn
    rig.body.scale.y = 1 - pose.lie * .1;
    // Lăn nghiêng (roll) quay thân quanh trục z tại gốc roller: nhấc roller lên vừa đủ để góc bo của mép thân đang chúi
    // xuống chạm đúng mặt sàn. Trước đây nhấc cố định .2 nên khi nằm nghiêng hẳn (~75°) nửa hông chìm xuống đất.
    // Cạnh đáy thân (trong hệ roller) ở yb; góc bo bán kính BODY_R, tâm cách mép ngoài (W/2 - BODY_R).
    {
      const tilt = Math.abs(rig.roller.rotation.z), yb = rig.pivot.position.y + H / 2 * (1 - rig.body.scale.y);
      rig.roller.position.y = Math.max(0, (W / 2 - BODY_R) * Math.sin(tilt) - (yb + BODY_R) * Math.cos(tilt) + BODY_R + .01 * clamp(pose.roll, 0, 1));
    }

    // ---- Chân: đi = chéo cặp, chạy = phi nước đại; nhấc bàn chân khi đưa về trước; trên không duỗi/đón ----
    const air = this.airK;
    const sit = clamp(pose.sit, 0, 1);
    const pitch = rig.pivot.rotation.x, pivotY = rig.pivot.position.y, pivotZ = rig.pivot.position.z;
    const bodyLift = H / 2 * (1 - rig.body.scale.y); // thân co lại khi nằm: đáy thân nhích lên
    const groundY = -rig.roller.position.y;          // mặt sàn trong hệ toạ độ roller
    rig.legs.forEach((leg, i) => {
      const diagonal = i === 0 || i === 3 ? 0 : Math.PI;
      const phase = run ? (leg.front ? 0 : Math.PI * .75) + (i % 2) * .25 : diagonal;
      const cyc = g + phase;
      let swing = Math.sin(cyc) * (run ? .85 : .55) * amp;
      let lift = Math.max(0, Math.cos(cyc)) * (run ? .05 : .035) * amp;
      if (air !== null) { // bật lên: chân sau đạp duỗi ra sau; gần đất: chân trước vươn đón
        swing = leg.front ? -.95 * air + .3 * (1 - air) : .85 * (1 - air) - .2 * air;
        lift = 0;
      }
      if (this.carried) { swing = this.swayF * 1.6 + Math.sin(t * 3 + i) * .08; lift = 0; } // chân thõng đung đưa
      if (leg.front && i === 1) { swing -= pose.paw * 1.6 + pose.groom * 1.9; lift += pose.paw * .12 + pose.groom * .18; }
      if (leg.front && pose.knead > .1) { const press = Math.max(0, Math.sin(t * 5 + i * Math.PI)); swing -= press * .6 * pose.knead; lift += press * .03 * pose.knead; }
      leg.hip.rotation.x = swing;
      // Khớp chân luôn gắn đúng đáy thân: tính điểm đáy thân nằm ngay trên chân từ TỔNG độ chúi của thân
      // (ngồi, vươn, cúi, chúi khi bay, lắc khi bị nhấc...), nên tư thế nào chân cũng không hở khỏi thân.
      // Chân và thân cùng nằm trong roller nên cùng hệ toạ độ; thân quay quanh pivot (mép sau-dưới).
      const hipZ = (leg.front ? 1 : -1) * D * .3 + (leg.front ? pose.stretch * .1 + pose.lean * .08 : 0);
      const cosP = Math.cos(pitch), along = clamp((hipZ - pivotZ) / (Math.abs(cosP) > .2 ? cosP : .2), 0, D);
      const bottomY = pivotY - Math.sin(pitch) * along + bodyLift;
      leg.hip.position.set(leg.hip.position.x, bottomY + .03 + lift, hipZ);
      // Độ dài chân: chỉ kéo ống chân, bàn chân giữ nguyên cỡ và luôn nằm ở đáy (không kéo méo góc bo).
      //   bị nhấc -> thõng dài; đang bay -> dài bình thường; trên sàn -> vừa đúng chạm đất (trừ phần co chân khi nằm/ngồi).
      const full = LEG + .03;
      const lie = clamp(pose.lie, 0, 1);
      const tuck = leg.front ? lie * (1 - clamp(pose.roll, 0, 1) * .5) : Math.max(lie, sit * .9);
      const reach = (bottomY + .03 - groundY) / full; // độ dài để bàn chân vừa chạm sàn (không tính phần nhấc chân)
      const len = this.carried ? 1.3 : air !== null ? 1 : clamp(reach * (1 - tuck * .85), .15, 2.2);
      // Ống chân chạy từ trong thân (+.03) xuống đúng TÂM bàn chân: đáy ống luôn chìm trong khối bàn chân.
      // (Trước đây ống dài hơn chân nên thò ra dưới đáy bàn chân thành một vành màu lông khi nhìn từ dưới lên.)
      const shaft = full * len;
      leg.leg.scale.y = shaft / LEG_SHAFT; leg.leg.position.y = .03 - shaft / 2;
      leg.foot.position.y = -full * len + .03;
      leg.hip.scale.y = 1;
    });

    // ---- Đuôi: mỗi đốt một lò xo, càng về chóp càng mềm; văng ngược khi quay người và khi nhảy ----
    // Dáng theo giống (rig.tailStyle). Vui (chào bạn, được cưng) thì dựng thẳng, chóp run run;
    // ngồi yên thì quấn đuôi quanh chân; giật mình / bực thì xù to (puff).
    const style = rig.tailStyle, last = rig.tail.length - 1;
    const quiver = (petting && this.petMood === 'happy' && !this.sleeping) || t < (this.quiverUntil || 0);
    const wagSpeed = this.tailSpeed * style.speed * (petting ? 2 : 1);
    const tailUp = quiver ? 1 : pose.tailUp, raised = clamp((tailUp - .5) / .4, 0, 1);
    const stream = clamp(vy * .22, -.7, .7);
    const wrapGoal = sit > .75 && move < .1 && tailUp < .55 && !this.carried && !petting ? 1 : 0;
    spring(this, 'wrap', wrapGoal, 18, .9, dt);
    rig.tail.forEach((joint, i) => {
      const along = i / Math.max(1, last); // 0 = gốc .. 1 = chóp
      const wave = Math.sin(t * wagSpeed - i * style.lag) * this.tailWag * style.wag * (1 + along) * (quiver ? .35 : 1);
      const inertia = (-turnRate * .1 * (1 + along * 1.4) - (run ? Math.sin(g) * .08 : 0)) * (i ? style.bend : 1);
      const shiver = quiver && along > .5 ? Math.sin(t * 38 + i * 1.3) * .07 : 0;
      const wrap = this.wrap * this.wrapSide * (1 - pose.curl) * (i === 0 ? .55 : 1.9 / Math.max(1, last));
      const zGoal = (i === 0 ? wave + pose.curl * 1.2 + this.rub * 3 : (wave * .6 + pose.curl * .55) * style.bend) + inertia + shiver + wrap;
      const hook = i >= last - 1 && last > 1 ? style.hook * raised * (i === last ? 1 : .45) : 0; // chóp móc câu khi dựng đuôi
      const xGoal = i === 0
        ? (this.carried ? -2.95 + this.swayF * .8 : -(2.45 - tailUp * 1.9) * (1 - pose.curl) - pose.curl * 1.5 + stream)
        : ((.12 - .2 * raised) * (1 - pose.curl) + stream * .25) * style.bend + hook;
      const k = 160 * style.stiff / (1 + along * 2.2), zeta = .42 + along * .16;
      const zs = { v: this.tailZ[i], vV: this.tailZV?.[i] || 0 }, xs = { v: this.tailX[i], vV: this.tailXV?.[i] || 0 };
      spring(zs, 'v', zGoal, k, zeta, dt); spring(xs, 'v', xGoal, k, zeta + .1, dt);
      (this.tailZV ||= [])[i] = zs.vV; (this.tailXV ||= [])[i] = xs.vV;
      this.tailZ[i] = zs.v; this.tailX[i] = xs.v;
      joint.rotation.z = zs.v; joint.rotation.x = xs.v;
    });
    const puff = Math.max(0, this.puff);
    rig.tailParts.forEach(part => { const b = part.userData.baseScale; part.scale.set(b.x * (1 + puff * .65), b.y * (1 + puff * .15), b.z * (1 + puff * .65)); });
    this.tailFloor(puff);

    this.jelly(dt);

    // Zzz
    rig.z.visible = this.sleeping;
    if (this.sleeping) {
      const k = (t * .45 + this.phase) % 1;
      rig.z.position.set(.25 + k * .15 + Math.sin(k * 6) * .03, H + .25 + k * .45, D * .6);
      rig.z.material.opacity = Math.sin(k * Math.PI);
      rig.z.scale.set(.2 + k * .12, .18 + k * .11, 1);
    }
  }
}

// ---------- Cả đàn: chọn hành vi, vật cản, đồ chơi rơi/lăn ----------
// Độ thích từng món đồ (trọng số chọn hành vi), theo khu.
// Hammock variants that hang from a beam and swing like a pendulum (not a cloth sling).
const hangsFromBeam = kind => kind === 'hammock-tire' || kind === 'hammock-basket';
const GARDEN_TOYS = { flowers: .9, stump: 1.1, catnip: 1.2, lantern: .7, sandbox: 1, cathouse: 1.5, pond: 1.3, hammock: 1.4, birdbath: 1.1, bench: .9 };
const LIVING_TOYS = { catbed: 1.6, armchair: 1.3, cattree: 1.4, shelf: .9, table: 1.1, yarn: 1.3, plant: .8, tank: 1.4, lamp: .9 };
const BEDROOM_TOYS = { bed: 1.7, desk: 1.3, chair: 1, bedside: 1, closet: .8, catsteps: 1.3, plushie: 1.1, laundry: 1.4 };
const GARDEN2_TOYS = { windmill: 1.1, sunflowers: 1, clothesline: 1.1, campfire: 1.3, kite: 1.2, stream: 1.3, swingtree: 1.5, slide: 1.6 };
const KITCHEN_TOYS = { fridge: .9, stove: 1.2, sink: 1.1, pantry: .8, dining: 1.2, kchair: 1, catfood: 1.8, cart: 1.1, kplant: .8 };
const ZONE_TOYS = { garden: GARDEN_TOYS, living: LIVING_TOYS, bedroom: BEDROOM_TOYS, kitchen: KITCHEN_TOYS, garden2: GARDEN2_TOYS };
// ctx.zones() = các khu đã mở (đọc lúc chạy: mở phòng khách không cần tạo lại đàn mèo).
export function createCatLife(ctx) {
  const { scene, furniture, heartsAt, symbolAt } = ctx;
  const tweens = [];
  const world = {
    scene, furniture, butterflies: ctx.butterflies, cats: [], claims: new Map(), dt: 0, time: 0, afk: false,
    sand(cat) { // hạt cát văng ra sau lưng mèo
      const grain = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), (TOON ? toonMat : p => new THREE.MeshStandardMaterial(p))({ color: '#f3dfb0' }));
      const x0 = cat.x, z0 = cat.z, back = cat.heading + Math.PI + rand(-.6, .6);
      scene.add(grain);
      world.tween(.45, k => grain.position.set(x0 + Math.sin(back) * k * .5, cat.y + .1 + Math.sin(k * Math.PI) * .3, z0 + Math.cos(back) * k * .5), () => scene.remove(grain));
    },
    splash(pond, cat) { // vòng sóng lan ra trên mặt ao
      const ring = new THREE.Mesh(new THREE.RingGeometry(.05, .08, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cat.x + Math.sin(cat.heading) * .45, .06, cat.z + Math.cos(cat.heading) * .45);
      scene.add(ring);
      world.notice(ring.position.x, ring.position.z, { except: cat, radius: 2.4, startle: true });
      world.tween(.9, k => { ring.scale.setScalar(1 + k * 5); ring.material.opacity = 1 - k; }, () => scene.remove(ring));
    },
    scareBird(bath) {
      const bird = bath.userData.bird;
      if (!bird || bird.userData.away) return;
      bird.userData.away = true;
      const from = bird.position.clone(), seen = bird.getWorldPosition(new THREE.Vector3());
      world.notice(seen.x, seen.z, { radius: 4 });
      world.tween(1.4, k => { bird.position.set(from.x + k * 2.5, from.y + k * 3, from.z - k * 1.5); bird.rotation.z = Math.sin(k * 40) * .3; },
        () => { bird.visible = false; bird.userData.returnAt = world.time + 12; });
    },
    obstacles(ignore) {
      return Object.entries(furniture).filter(([id, node]) => node.visible && id !== ignore && FURNITURE[id]?.r)
        .flatMap(([id, node]) => [{ x: node.position.x, z: node.position.z, r: FURNITURE[id].r },
          ...(OBSTACLE_EXTRA[id] || []).map(([dx, dz, r]) => ({ x: node.position.x + dx, z: node.position.z + dz, r }))])
        .concat((ctx.staticObstacles?.() || []).filter(ob => ob.id !== ignore)); // đồi ở phần vườn mở rộng
    },
    // Độ cao mặt đất tại (x, z) khu nhà (đồi ở phần vườn mở rộng; còn lại 0) và vật cản đồi (null nếu vườn chưa mở rộng).
    groundAt(x, z) { return ctx.groundAt?.(x, z) || 0; },
    hill() { return (ctx.staticObstacles?.() || []).find(ob => ob.id === 'hill') || null; },
    // ----- Khu nhà (xem ZONE_OFFSET / DOOR) -----
    zones() { return ctx.zones?.() || ['garden']; }, // các khu đã mở
    // Khu chứa điểm (x, z): khu đã mở có ô gần điểm nhất (trong lối cửa thì thuộc khu gần hơn).
    zoneAt(x, z) {
      let best = 'garden', bestD = Infinity;
      for (const zone of world.zones()) {
        const h = zoneHome(zone), p = boxNearest(x, z, h.x - ROOM, h.x + ROOM, h.z - ROOM, h.z + ROOM), d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bestD) { best = zone; bestD = d; }
      }
      return best;
    },
    // Điểm gần (x, z) nhất mà mèo đứng được: trong ô của một khu đã mở hoặc trong lối cửa giữa hai khu.
    // Lấy điểm gần nhất (không kẹp theo khu) nên mèo bước từ khu vào lối cửa liền mạch, không bị giật.
    bound(x, z) {
      let best = null, bestD = Infinity;
      const consider = p => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bestD) { best = p; bestD = d; } };
      for (const zone of world.zones()) { const h = zoneHome(zone); consider(boxNearest(x, z, h.x - ROOM, h.x + ROOM, h.z - ROOM, h.z + ROOM)); }
      for (const p of PASSES) if (world.zones().includes(p.a) && world.zones().includes(p.b)) consider(boxNearest(x, z, ...p.box));
      return best;
    },
    // Cửa sổ vòm phòng khách theo toạ độ khu nhà.
    window() { const h = zoneHome('living'); return { x: h.x + WINDOW.x, z: h.z + WINDOW.z }; },
    // Chỗ trống trên sàn ngay dưới cửa sổ (cửa sổ rộng x -2.2..-1.0); null nếu đồ đạc che hết.
    windowSpot() {
      const win = world.window();
      for (const x of [win.x, win.x + .3, win.x - .3, win.x + .55, win.x - .5]) {
        if (!world.obstacles().some(ob => Math.hypot(x - ob.x, win.z - ob.z) < ob.r + .42)) return { x, z: win.z };
      }
      return null;
    },
    // Chỗ đáp khi thả mèo: đúng điểm thả, trừ khi trùng đồ đạc thì dời ra mép đồ gần nhất.
    landingSpot(cat) { return world.reachable(cat.x, cat.z); },
    // Điểm gần (x, z) nhất mà mèo đứng được: trong khu nhà và ngoài mọi vật cản.
    reachable(px, pz) {
      let { x, z } = world.bound(px, pz);
      for (const ob of world.obstacles()) {
        const dx = x - ob.x, dz = z - ob.z, d = Math.hypot(dx, dz) || 1e-4, reach = ob.r + W * .45;
        if (d < reach) ({ x, z } = world.bound(ob.x + dx / d * reach, ob.z + dz / d * reach));
      }
      return { x, z };
    },
    // Món mèo có thể tương tác gần điểm (x, z) nhất (trong tầm `reach` tính từ mép món), chưa có con nào đang dùng; không có thì null.
    // Người chơi thả mèo gần món nào thì mèo làm đúng hành vi của món đó (useFurniture).
    nearToy(x, z, reach = 1.1) {
      let best = null, bestGap = reach;
      for (const id of Object.keys({ ...GARDEN_TOYS, ...LIVING_TOYS, ...BEDROOM_TOYS, ...KITCHEN_TOYS, ...GARDEN2_TOYS })) {
        const node = furniture[id];
        if (!node?.visible || world.claims.has(id)) continue;
        const c = world.center(id), gap = Math.hypot(x - c.x, z - c.z) - Math.min(c.r, 1.2); // món to (cối xay + đồi) không được lấn món nhỏ ở cạnh
        if (gap < bestGap) { bestGap = gap; best = id; }
      }
      return best;
    },
    center(id) { const node = furniture[id]; return { x: node.position.x, z: node.position.z, r: FURNITURE[id]?.r || .5 }; },
    // Chỗ trống ngẫu nhiên trong một khu (mặc định khu mèo đang đứng). Bỏ chỗ khuất sau đồi (nhìn từ tâm khu bị đồi che):
    // góc giữa đồi và rào là ngõ cụt, mèo không đi tới được.
    freeSpot(cat, zone = world.zoneAt(cat.x, cat.z)) {
      const h = zoneHome(zone), hill = world.hill();
      const behindHill = (x, z) => {
        if (!hill) return false;
        const dx = x - h.x, dz = z - h.z, len = Math.hypot(dx, dz) || 1e-4, t = clamp(((hill.x - h.x) * dx + (hill.z - h.z) * dz) / len, 0, len);
        return Math.hypot(h.x + dx / len * t - hill.x, h.z + dz / len * t - hill.z) < hill.r;
      };
      for (let i = 0; i < 30; i++) {
        const x = h.x + rand(-ROOM + .3, ROOM - .3), z = h.z + rand(-ROOM + .3, ROOM - .3);
        if (Math.hypot(x - cat.x, z - cat.z) < .8 || behindHill(x, z)) continue;
        if (world.obstacles().some(ob => Math.hypot(x - ob.x, z - ob.z) < ob.r + .4)) continue;
        if (world.cats.some(other => other !== cat && Math.hypot(x - other.x, z - other.z) < .7)) continue;
        return { x, z };
      }
      return { x: h.x + rand(-1, 1), z: h.z + rand(-1, 1) };
    },
    choose(cat, last) {
      const options = [];
      const add = (name, weight, make) => { if (weight > 0 && name !== last) options.push([name, weight, make]); };
      add('wander', 3, () => cat.wander());
      add('sit', 1.4, () => cat.idleSit());
      add('groom', 1.2, () => cat.groom());
      add('stretch', .5, () => cat.yawnStretch());
      add('zoomies', .35, () => cat.zoomies());
      add('nap', ctx.night ? 2.4 : .7, () => cat.loafNap()); // ban đêm mèo hay ngủ
      add('tailchase', ctx.night ? .1 : .35, () => cat.tailChase());
      add('pounce', ctx.night ? .15 : .55, () => cat.pounceBug());
      add('bellyroll', .4, () => cat.bellyRoll());
      add('meow', .45, () => cat.meowAtYou());
      // Mèo chơi chủ yếu ở khu đang đứng; thỉnh thoảng đi qua cửa sang khu kia (dạo chơi, hoặc tới thẳng một món đồ bên đó).
      const zone = world.zoneAt(cat.x, cat.z), garden = zone === 'garden';
      const others = world.zones().filter(z => z !== zone), other = others[Math.floor(Math.random() * others.length)];
      const there = id => ZONE_TOYS[zone][id] === undefined ? .25 : 1; // món ở khu khác: ít chọn hơn
      if (other) add('roam', .6, () => cat.wander(other));
      if (zone === 'living' && !world.claims.has('window')) add('window', .8, () => cat.lookOutWindow());
      if (garden && !ctx.night) add('butterfly', 1.1, () => cat.chaseButterfly()); // đêm bướm đi ngủ
      if (furniture.rug?.visible && !world.claims.has('rug')) add('rug', .6 * (garden ? .25 : 1), () => cat.rollOnRug());
      if (zone === 'garden2' && world.hill() && !world.claims.has('hill')) add('hill', .9, () => cat.hillTop());
      for (const [id, weight] of Object.entries({ ...GARDEN_TOYS, ...LIVING_TOYS, ...BEDROOM_TOYS, ...KITCHEN_TOYS, ...GARDEN2_TOYS })) {
        if (furniture[id]?.visible && !world.claims.has(id)) add(id, weight * there(id), () => cat.useFurniture(id));
      }
      const buddies = world.cats.filter(other => other !== cat && other.interruptible() && other.y < .01 && world.zoneAt(other.x, other.z) === zone);
      if (buddies.length) {
        const other = buddies[Math.floor(Math.random() * buddies.length)];
        add('boop', 1, () => cat.boop(other));
        add('chase', .6, () => cat.chase(other));
        add('groomBuddy', .5, () => cat.groomBuddy(other));
        add('playfight', ctx.night ? .15 : .6, () => cat.playFight(other));
        add('cuddle', ctx.night ? 1.2 : .4, () => cat.cuddleNap(other));
        add('sniff', .5, () => cat.sniffTail(other));
        add('pounceTail', ctx.night ? .15 : .55, () => cat.pounceTail(other));
        add('follow', ctx.night ? .15 : .45, () => cat.follow(other));
        add('bunt', .7, () => cat.headBunt(other));
      }
      let roll = Math.random() * options.reduce((sum, [, w]) => sum + w, 0);
      for (const [name, weight, make] of options) { roll -= weight; if (roll <= 0) return [name, make()]; }
      return ['wander', cat.wander()];
    },
    tween(duration, fn, done) { tweens.push({ t: 0, duration, fn, done }); },
    // Có động (cốc rơi, chim bay, mèo kêu, khè...): con ở gần ngoái nhìn về phía đó, tai dỏng;
    // con đang ngủ chỉ giật tai; startle = ở sát thì giật mình (vươn người, cụp tai, xù đuôi).
    notice(x, z, { except = null, radius = 3.2, startle = false } = {}) {
      for (const c of world.cats) {
        if (c === except || c.carried) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d > radius) continue;
        c.earSide = chance(.5) ? 0 : 1; c.earTwitchV = (c.earTwitchV || 0) + 18;
        if (c.sleeping) continue;
        c.attention = { x, z, until: world.time + rand(1.2, 2.2) };
        if (startle && d < 1.6 && c.y < .01) { c.squash = -.35; c.squashV = 0; c.earFlopV = (c.earFlopV || 0) + 12; c.puffUntil = world.time + 1.2; }
      }
    },
    jealousy(target) {
      if (world.cats.some(c => c.social === 'jealous')) return;
      const rivals = world.cats.filter(c => c !== target && c.interruptible());
      const rival = rivals[Math.floor(Math.random() * rivals.length)];
      rival?.interrupt(rival.jealous(target));
    },
    // Ký hiệu nổi trên đầu một con (💢 / ♪ / …).
    say(cat, symbol, count = 1) { symbolAt?.(new THREE.Vector3(cat.x, cat.y + H + .25, cat.z), symbol, count); },
    cameraPos: () => ctx.cameraPos?.(),
    hearts(a, b) {
      const p = new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + H + .15, (a.z + b.z) / 2);
      heartsAt(p);
    },
    wiggle(leaves) {
      if (!leaves) return;
      world.tween(.4, k => { leaves.rotation.z = Math.sin(k * Math.PI * 4) * .08 * (1 - k); leaves.scale.setScalar(1 + Math.sin(k * Math.PI) * .05); });
    },
    nudge(mug, cat, amount) {
      const from = mug.position.clone(), dir = world.pushDir(mug, cat);
      world.tween(.18, k => { mug.position.x = from.x + dir.x * amount * k; mug.position.z = from.z + dir.z * amount * k; });
    },
    pushDir(mug, cat) { // hướng đẩy trong không gian của cái bàn
      const table = mug.parent;
      const catLocal = table.worldToLocal(new THREE.Vector3(cat.x, mug.getWorldPosition(new THREE.Vector3()).y, cat.z));
      const dir = new THREE.Vector3(mug.position.x - catLocal.x, 0, mug.position.z - catLocal.z);
      return dir.lengthSq() < 1e-4 ? new THREE.Vector3(1, 0, 0) : dir.normalize();
    },
    knockOff(table, mug, cat) {
      const dir = world.pushDir(mug, cat), from = mug.position.clone();
      const to = new THREE.Vector3(from.x + dir.x * .75, .1, from.z + dir.z * .75);
      mug.userData.knocked = true;
      world.tween(.65, k => {
        const e = k * k;
        mug.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * e + Math.sin(k * Math.PI) * .12, from.z + (to.z - from.z) * k);
        mug.rotation.set(dir.z * k * Math.PI / 2, 0, -dir.x * k * Math.PI / 2);
      }, () => {
        world.tween(.25, k => { mug.position.y = .1 + Math.sin(k * Math.PI) * .06; }); // nảy "cạch"
        const at = mug.getWorldPosition(new THREE.Vector3());
        world.notice(at.x, at.z, { except: cat, radius: 5, startle: true }); // cả nhà giật mình quay lại nhìn
        mug.userData.restoreAt = world.time + 9;
      });
    },
    batToy(basket, toy) {
      const from = toy.position.clone(), to = new THREE.Vector3(rand(-.3, .3), .19, 1.3);
      toy.userData.out = true;
      world.tween(.7, k => {
        toy.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * .35, from.z + (to.z - from.z) * k);
        toy.rotation.x += .25;
      });
      return () => { basket.updateMatrixWorld(true); return toy.getWorldPosition(new THREE.Vector3()); };
    },
    rollToy(toy, cat) {
      const basket = toy.parent, from = toy.position.clone();
      const dirWorld = new THREE.Vector3(Math.sin(cat.heading), 0, Math.cos(cat.heading)).multiplyScalar(rand(.5, .9));
      const world0 = toy.getWorldPosition(new THREE.Vector3());
      const target = world0.clone().add(dirWorld);
      ({ x: target.x, z: target.z } = world.bound(target.x, target.z)); target.y = .19;
      const to = basket.worldToLocal(target.clone());
      to.y = .19;
      world.tween(.6, k => {
        const e = 1 - (1 - k) ** 2;
        toy.position.set(from.x + (to.x - from.x) * e, .19 + Math.abs(Math.sin(k * Math.PI * 2)) * .08 * (1 - k), from.z + (to.z - from.z) * e);
        toy.rotation.x += .3;
      });
      toy.userData.restoreAt = world.time + 6;
      world.notice(target.x, target.z, { except: cat, radius: 2.2 });
    },
  };

  // Không cho mèo lồng vào nhau hay xuyên đồ đạc: sau khi di chuyển, đẩy tách mọi cặp đang chồng lên nhau.
  // Chỉ áp cho mèo đứng trên sàn (đang nhảy hoặc đang ngồi trên đồ thì bỏ qua), và bỏ qua món mèo đang dùng.
  // Theo cạnh dài nhất của thân + chừa chỗ cho tư thế nằm duỗi / đuôi: hai mèo cạnh nhau không đè lên nhau.
  const CAT_GAP = Math.max(W, D) + .14;
  const grounded = cat => cat.y < .01 && !cat.airPitch;
  function pushOutOfFurniture(cat) {
    for (const ob of world.obstacles(cat.busyWith)) {
      const dx = cat.x - ob.x, dz = cat.z - ob.z, d = Math.hypot(dx, dz) || 1e-4, reach = ob.r + W * .45;
      if (d < reach) ({ x: cat.x, z: cat.z } = world.bound(ob.x + dx / d * reach, ob.z + dz / d * reach));
    }
  }
  function separate() {
    const before = world.cats.map(cat => [cat.x, cat.z]);
    resolveOverlaps();
    world.cats.forEach((cat, i) => { cat.corrX = (cat.corrX || 0) + cat.x - before[i][0]; cat.corrZ = (cat.corrZ || 0) + cat.z - before[i][1]; });
  }
  function resolveOverlaps() {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < world.cats.length; i++) {
        const a = world.cats[i];
        if (!grounded(a)) continue;
        for (let j = i + 1; j < world.cats.length; j++) {
          const b = world.cats[j];
          if (!grounded(b)) continue;
          const d = Math.hypot(b.x - a.x, b.z - a.z);
          if (d >= CAT_GAP) continue;
          // hướng tách (vector đơn vị); trùng hẳn chỗ thì tách theo hướng nhìn của con thứ hai
          const ux = d > 1e-4 ? (b.x - a.x) / d : Math.sin(b.heading), uz = d > 1e-4 ? (b.z - a.z) / d : Math.cos(b.heading);
          const half = (CAT_GAP - d) / 2;
          ({ x: a.x, z: a.z } = world.bound(a.x - ux * half, a.z - uz * half));
          ({ x: b.x, z: b.z } = world.bound(b.x + ux * half, b.z + uz * half));
        }
        pushOutOfFurniture(a);
      }
    }
    // Lượt cuối chỉ đẩy khỏi đồ đạc: đồ đứng yên nên luôn thắng, mèo không lấn vào đồ.
    world.cats.filter(grounded).forEach(pushOutOfFurniture);
  }
  function restoreBird() {
    const bird = furniture.birdbath?.userData.bird;
    if (!bird?.userData.returnAt || world.time < bird.userData.returnAt) return;
    bird.userData.returnAt = 0; bird.userData.away = false; bird.visible = true;
    bird.position.copy(bird.userData.home); bird.rotation.z = 0;
    world.tween(.4, k => bird.scale.setScalar(Math.max(.01, k)));
  }
  function restoreToys() {
    for (const id of ['table', 'yarn', 'bedside', 'clothesline', 'dining', 'cart']) {
      const node = furniture[id];
      const item = node?.userData.mug || node?.userData.toy;
      if (!item?.userData.restoreAt || world.time < item.userData.restoreAt || world.claims.has(id)) continue;
      item.userData.restoreAt = 0; item.userData.knocked = false; item.userData.out = false;
      item.position.copy(item.userData.home); item.rotation.set(0, 0, 0);
      world.tween(.35, k => item.scale.setScalar(Math.max(.01, k + Math.sin(k * Math.PI) * .2)));
    }
  }

  return {
    carryHeight: CARRY_H,
    // Đàn mèo (chỉ đọc: x, z, y, speed, carried) để cảnh làm đồ đạc rung nhẹ khi mèo đi sát qua.
    bodies() { return world.cats; },
    pickUp(cat, x, z) {
      cat.carried = true; cat.petUntil = 0;
      ({ x: cat.carryX, z: cat.carryZ } = world.bound(x, z));
      cat.interrupt(cat.beCarried());
    },
    carryTo(cat, x, z) { ({ x: cat.carryX, z: cat.carryZ } = world.bound(x, z)); }, // bế mèo sang khu kia cũng được
    drop(cat) { cat.carried = false; },
    setCats(breeds) {
      const keep = [];
      breeds.forEach(breed => {
        const existing = world.cats.find(cat => cat.breed === breed && !keep.includes(cat));
        if (existing) keep.push(existing);
        else {
          const zones = world.zones(), spot = world.freeSpot({ x: 99, z: 99 }, zones[Math.floor(Math.random() * zones.length)]); // mèo mới: ở khu bất kỳ
          keep.push(new Cat(world, breed, spot.x, spot.z));
        }
      });
      world.cats.filter(cat => !keep.includes(cat)).forEach(cat => { cat.release(); cat.dispose(); });
      world.cats = keep;
    },
    // Món đồ bị gỡ khi mèo đang ngồi trên / đang dùng: mèo rơi xuống sàn rồi làm việc khác.
    furnitureChanged() {
      world.cats.forEach(cat => {
        if (cat.carried) return;
        const using = cat.busyWith && furniture[cat.busyWith] && !furniture[cat.busyWith].visible;
        if (!using && !(cat.surface && !furniture[cat.surface]?.visible)) return;
        cat.release();
        cat.interrupt((function* fall() {
          cat.surface = null; cat.setPose('stand'); cat.face('annoyed');
          const y0 = cat.y, floor = world.groundAt(cat.x, cat.z);
          for (let t = 0; t < .35; t += world.dt) { cat.y = floor + (y0 - floor) * (1 - (t / .35) ** 2); yield; }
          cat.y = floor; cat.squash = 1;
          yield* cat.wait(.5);
          yield* cat.life();
        })());
      });
    },
    update(dt, t, afk) {
      world.dt = Math.min(dt, .05); world.time = t;
      // AFK: không cả đàn lăn ra ngủ cùng lúc. Mỗi con buồn ngủ ở một thời điểm ngẫu nhiên (vài giây .. ~25 giây),
      // trong lúc chờ vẫn sống bình thường; hết AFK thì mỗi con tỉnh lệch nhau một chút (xem nap()).
      if (afk && !world.afk) world.cats.forEach((cat, i) => { cat.napAt = t + (i === 0 ? rand(1.5, 5) : rand(4, 26)); });
      if (!afk) world.cats.forEach(cat => { cat.napAt = null; });
      else world.cats.forEach(cat => {
        if (cat.napAt && t >= cat.napAt && !cat.carried && !cat.napping) { cat.napAt = null; cat.interrupt(cat.nap()); }
      });
      world.afk = afk;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += world.dt;
        const k = Math.min(1, tw.t / tw.duration);
        tw.fn(k);
        if (k === 1) { tweens.splice(i, 1); tw.done?.(); }
      }
      restoreToys();
      restoreBird();
      if (furniture.flowers?.visible) furniture.flowers.userData.walkers = world.cats.filter(cat => cat.y < .05); // hoa rạp khi mèo giẫm qua
      for (const node of Object.values(furniture)) if (node.visible && node.userData.watchCats) node.userData.cats = world.cats; // hướng dương nhìn theo mèo
      world.cats.forEach(cat => cat.update(world.dt, t));
      separate();
    },
    hit(raycaster) {
      const hit = raycaster.intersectObjects(world.cats.map(cat => cat.rig.root), true)[0];
      return hit?.object.userData.catRoot?.userData.cat || null;
    },
  };
}

// Đổi mắt / miệng của một con mèo dựng bằng catModel (eyes: open | focus | blink | half | sleep | happy | grumble | annoyed; mouth: calm | yawn).
// eyes / mouth: như face() của mèo trong phòng (cat-face.mjs), hoặc tên biểu cảm EXPRESSIONS.
export function setCatFace(rig, breed, eyes, mouth = 'calm') {
  const expr = EXPRESSIONS.includes(eyes) ? eyes : expressionOf(eyes, mouth);
  const eyesTex = expressionTexture(breed, expr);
  if (rig.eyesMat.map !== eyesTex) { rig.eyesMat.map = eyesTex; rig.eyesMat.needsUpdate = true; }
}

// Mèo 3D đứng yên (không có "não" / hoạt hình) cho cảnh khác dùng, vd. bản đồ màn (map-world.mjs) khoe giống mèo mới mở.
// Mặt / mắt dán ôm lên mặt trước bo tròn một lần (trong phòng việc này làm mỗi frame theo thân đang biến dạng).
export function catModel(breed) {
  const rig = buildRig(breed);
  for (const decal of [rig.eyes]) {
    const flat = decal.userData.flat, attr = decal.geometry.attributes.position, a = attr.array;
    for (let i = 0; i < a.length; i += 3) a[i + 2] = frontSurface(flat[i], flat[i + 1]) + decal.userData.lift;
    attr.needsUpdate = true;
  }
  rig.root.userData.rig = rig; // cho cảnh khoe mèo (catShowcase) cử động chân
  return rig.root;
}
