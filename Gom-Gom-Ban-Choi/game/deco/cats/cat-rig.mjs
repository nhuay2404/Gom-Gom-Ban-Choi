// Khung 3D của một con mèo (thuần hình, không có hành vi): thân bo tròn, mặt vẽ canvas + ảnh biểu cảm Figma, tai, chân, đuôi
// nhiều đốt, biến dạng khi tì / nằm lên đồ vật. Dùng cho mèo trong phòng (cat-brain.mjs) và mèo khoe ở bản đồ / màn thưởng
// (catModel, setCatFace). Sang Unity: prefab mèo (mesh + Animator / blend shape), mặt = material đổi texture.
import * as THREE from 'three';
import { roundedBox } from '../render/mesh-detail.mjs';
import { categories, catExpressionSrc, catBodyPlacement, catExprBox, SLEEP_FACE } from '../../ui/cat-art.mjs';
import { TOON, toonMat, markOutlineUnit } from '../render/toon.mjs';
import { expressionOf } from './cat-face.mjs';
import { D, W, H, TAU, LEG } from './cat-math.mjs';

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

// Thân + tai + mặt 3D dựng theo ảnh mèo 2D trong Figma (assets/img/cats/<giống>-body.png + <giống>-<biểu cảm>.png).
// Màu lấy mẫu từ ảnh Figma (cùng bộ với HANG_COLORS trong cat-art.mjs); thân 3D cũng dùng các màu này (catLook).
// Số đo ảnh thân từng giống (px, đo từ kênh alpha; mỗi ảnh một cao khác nhau): h = cao ảnh; mặt trước khối thân nằm trong x0..x1 ×
// top..bottom (đáy gồm cả dải vát); apex = chóp tai trái; ear = [mép ngoài, mép trong] chân tai trái ở hàng top - 2.
const IMG_W = 256;

// Viền tai trái của chó (px ảnh dog-<giống>-board), dò theo màu tai bằng flood fill trên ảnh Figma rồi rút gọn còn ~1 điểm / 8 px.
// Tai dựng (shiba, malamute): chân tai kéo xuống y 76, cắm vào trong thân. Tai cụp dài (golden, dalmatian), tai cụp tam giác (rottweiler, pug).
const DOG_EAR_UP = [[40, 21], [34, 26], [31, 31], [29, 41], [27, 51], [25, 61], [23, 76], [96, 76], [90, 61], [82, 51], [72, 41], [62, 31], [56, 26], [46, 21]];

const DOG_EAR_LONG = [[54, 42], [30, 50], [23, 58], [21, 66], [21, 98], [26, 106], [34, 118], [52, 118], [57, 106], [61, 90], [63, 74], [66, 58], [68, 50], [64, 42]];

const DOG_EAR_TRI = [[68, 50], [33, 55], [31, 71], [45, 86], [57, 98], [61, 96], [73, 91], [81, 76], [89, 61], [91, 55], [85, 50]];

const BODY_PX = {
  orange: { h: 301, x0: 0, x1: 256, top: 60, bottom: 300, apex: [27, 0], ear: [9, 92] },
  gray: { h: 298, x0: 0, x1: 256, top: 59, bottom: 297, apex: [49, 0], ear: [6, 105] },
  white: { h: 299, x0: 1, x1: 255, top: 65, bottom: 298, apex: [30, 0], ear: [8, 94] },
  tuxedo: { h: 293, x0: 0, x1: 256, top: 57, bottom: 292, apex: [31, 0], ear: [10, 92] },
  siamese: { h: 286, x0: 0, x1: 256, top: 53, bottom: 285, apex: [51, 0], ear: [9, 103] },
  tabby: { h: 256, x0: 11, x1: 245, top: 52, bottom: 251, apex: [42, 0], ear: [19, 94] },
  // Chó: dogEar = viền tai trái dò từ ảnh thân (px ảnh); flop = tai cụp rủ trước mặt (không thì tai dựng sau mép trước như mèo).
  // paw = hàng px nơi bắt đầu hai bàn chân vẽ trên mặt trước (3D có chân thật nên mặt trước xoá chân, xem dogFront).
  shiba: { h: 291, x0: 14, x1: 242, top: 70, bottom: 278, paw: 228, dogEar: DOG_EAR_UP },
  malamute: { h: 291, x0: 14, x1: 242, top: 70, bottom: 278, paw: 228, dogEar: DOG_EAR_UP },
  dalmatian: { h: 226, x0: 28, x1: 228, top: 49, bottom: 225, paw: 185, dogEar: DOG_EAR_LONG, flop: true },
  golden: { h: 226, x0: 28, x1: 228, top: 49, bottom: 225, paw: 185, dogEar: DOG_EAR_LONG, flop: true },
  rottweiler: { h: 242, x0: 28, x1: 228, top: 60, bottom: 238, paw: 193, dogEar: DOG_EAR_TRI, flop: true },
  pug: { h: 242, x0: 28, x1: 228, top: 60, bottom: 238, paw: 193, dogEar: DOG_EAR_TRI, flop: true },
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
  // Chó (màu lấy mẫu từ ảnh dog-<giống>-board): ear = màu vạt tai / tai dựng, earInner = lòng tai dựng.
  shiba: { fur: '#de7d3a', side: '#bc5e22', belly: '#faf0e2', paw: '#faf0e2', ink: '#2a1d18', earInner: '#faf0e2', tail: '#de7d3a' },
  malamute: { fur: '#7b828d', side: '#5f6670', belly: '#f8f7f4', paw: '#f8f7f4', ink: '#2a2a30', earInner: '#f8f7f4', tail: '#7b828d' },
  dalmatian: { fur: '#f7f5f0', side: '#dcd8cf', belly: '#ffffff', paw: '#ffffff', patch: '#1e1e22', ear: '#1e1e22', ink: '#2a2a30', tail: '#f7f5f0' },
  golden: { fur: '#fbc02d', side: '#dd9a12', belly: '#fff0be', paw: '#fce9bc', ear: '#e0950c', ink: '#2a1d18', tail: '#fbc02d' },
  rottweiler: { fur: '#2a2a30', side: '#0b0b0d', belly: '#b8642b', paw: '#b8642b', ear: '#1c1c21', ink: '#1c1c21' },
  pug: { fur: '#e8c08a', side: '#a87c44', belly: '#f6e3c4', paw: '#f6e3c4', ear: '#2a2420', mask: '#2a2420', ink: '#2a2420', tail: '#e8c08a' },
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
  shiba: [P([0, -.3, .31], [.26, .3, .06], 'belly'), ...[-1, 1].map(s => P([s * .14, -.02, .31], [.11, .08, .04], 'belly'))], // yếm + má kem
  malamute: [P([0, -.08, .31], [.34, .32, .06], 'belly'), P([0, .2, .31], [.012, .08, .03], 'belly')],                    // mặt nạ trắng + vạch trán
  dalmatian: [
    [-.3, .2, .3], [.28, -.05, .29], [-.12, -.28, .31], [.2, .3, .1], [-.25, .3, -.15], [.1, .31, -.25], [.36, .1, -.1], [-.36, -.1, .05],
    [.36, -.25, .2], [-.36, .15, -.25], [0, .1, -.31], [.25, -.2, -.31], [-.2, -.15, -.31], [.05, -.31, .1],
  ].map(c => P(c, [.04, .04, .04], 'patch')),                                                                          // đốm đen khắp thân
  golden: [P([0, -.3, .31], [.22, .26, .06], 'belly')],
  rottweiler: [P([0, -.26, .31], [.2, .24, .06], 'belly'), ...[-1, 1].map(s => P([s * .12, .17, .31], [.035, .02, .03], 'belly'))], // mõm + chấm mày vàng nâu
  pug: [P([0, -.32, .31], [.24, .24, .06], 'belly'), P([0, -.02, .31], [.15, .08, .04], 'mask')],                       // yếm kem + mõm đen
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
  // Chó: mặt trước là chính ảnh thân Figma (đúng từng mảng màu: yếm, mõm, đốm, chấm mày, tai vẽ). Từ hàng bàn chân xuống thì kéo dài
  // hàng ngay trên chân: 3D đã có chân thật, không vẽ chân lần nữa. Các mặt khác vẫn theo PATTERNS.
  const m = BODY_PX[breed];
  if (m.paw) {
    const image = new Image();
    image.onload = () => {
      const w = m.x1 - m.x0, h = m.bottom - m.top + 1, cut = ATLAS_CH * (m.paw - m.top) / h;
      g.drawImage(image, m.x0, m.top, w, m.paw - m.top, 0, 0, ATLAS_CW, cut);
      g.drawImage(image, m.x0, m.paw - 1, w, 1, 0, cut, ATLAS_CW, ATLAS_CH - cut);
      texture.needsUpdate = true;
    };
    image.src = catExpressionSrc(breed, 'body');
  }
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

// Khung ảnh biểu cảm trên tấm mắt, tính theo phần (0..1) của mặt trước: đúng chỗ đặt trên mèo 2D (cat-art.mjs catExprBox so với
// ảnh thân đặt bằng catBodyPlacement, kể cả ảnh bị kéo riêng như tam thể).
function exprRect(breed) {
  const m = BODY_PX[breed], f = frontPx(m), b = catBodyPlacement(breed, IMG_W, m.h);
  const fx = b.x + m.x0 * b.kx, fy = b.y + m.top * b.ky, fw = f.w * b.kx, fh = f.h * b.ky;
  const e = catExprBox(breed);
  return { x: (e.x - fx) / fw, y: (e.y - fy) / fh, w: e.w / fw, h: e.h / fh };
}

export function expressionTexture(breed, expr) {
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
  image.src = expr === 'sleep' && !catExpressionSrc(breed, 'sleep')
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
export const BODY_R = .085;

export function frontSurface(x, y) {
  const dx = Math.max(0, Math.abs(x) - (W / 2 - BODY_R)), dy = Math.max(0, Math.abs(y) - (H / 2 - BODY_R));
  return D / 2 - BODY_R + Math.sqrt(Math.max(0, BODY_R * BODY_R - dx * dx - dy * dy));
}

export const TAIL_TMP = { tip: new THREE.Vector3() };

// ---------- Biến dạng khi tiếp xúc đồ vật ----------
export const SOFT_KEYS = ['spread', 'sag', 'squeeze', 'front'];

export const NO_ROPES = [];

// Dây = hình trụ mảnh (bán kính ≤ 2 cm, dài > 15 cm) trong món đồ: dây xích đu, dây võng, dây bóng treo.
export function findRopes(node) {
  const ropes = [];
  node.traverse(child => {
    const g = child.isMesh && child.geometry;
    if (g?.type === 'CylinderGeometry' && g.parameters.radiusTop <= .02 && g.parameters.height > .15) ropes.push(child);
  });
  return ropes;
}

// Võng vải = nửa ống trụ hở (openEnded, thetaLength < 2π, bán kính > 20 cm). Toạ độ của mesh: trục ống = trục y.
export function findTrough(node) {
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

export function holdInTrough(p, t, lift = 0) {
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

export function segToBoxGap(a, b) {
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

export function dentByRopes(p, ropes) {
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
const EAR_LEAN_IN = .45, EAR_HEIGHT = .8, EAR_ROUND = .085; // chóp tai: kéo vào giữa chân tai / độ cao so với ảnh / bán kính bo góc

const EAR_DEPTH = .05, EAR_BEVEL = .014, EAR_SINK = .08, EAR_BACK = .045, EAR_TIP_SINK = .015; // EAR_BACK: mặt trước tai lùi sau mặt trước thân

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
  // Tai tròn trịa, không nhọn hoắc: chóp kéo vào giữa chân tai (ít chĩa ra ngoài) và thấp hơn ảnh 2D một chút
  apex.x += ((outer.x + inner.x) / 2 - apex.x) * EAR_LEAN_IN; apex.y *= EAR_HEIGHT;
  const edge = W / 2 - BODY_R - EAR_BEVEL;
  outer.x = side * Math.min(Math.abs(outer.x), edge);
  const cx = (outer.x + inner.x) / 2;
  [outer, apex, inner].forEach(p => { p.x -= cx; });
  // Khối tai màu tai chỉ cắm nông (EAR_TIP_SINK); phần chân cắm sâu là khối màu lông riêng (root). Thân lún / co khi nằm đệm,
  // bị nhấc... thì chân tai lộ ra ở góc mặt trước: cùng màu lông thì không thấy (lỗi cũ: Xiêm lộ 2 mảng nâu ở góc trên).
  const tri = [new THREE.Vector2(outer.x, -EAR_TIP_SINK), outer, apex, inner, new THREE.Vector2(inner.x, -EAR_TIP_SINK)];
  const solid = new THREE.ExtrudeGeometry(roundedPolygon(tri, EAR_ROUND), {
    depth: EAR_DEPTH - 2 * EAR_BEVEL, bevelEnabled: true, bevelThickness: EAR_BEVEL, bevelSize: EAR_BEVEL, bevelSegments: 4, curveSegments: 10,
  });
  solid.translate(0, 0, -(EAR_DEPTH - EAR_BEVEL)); // mặt trước khối ở z = 0
  solid.computeVertexNormals();
  // Lòng tai: tam giác chân tai – chóp co về trọng tâm, hạ xuống một chút cho dày vành tai phía trên.
  const g = new THREE.Vector2().add(outer).add(apex).add(inner).divideScalar(3);
  const pink = [outer, apex, inner].map(p => p.clone().sub(g).multiplyScalar(.56).add(g).add(new THREE.Vector2(0, -.012)));
  const front = new THREE.ShapeGeometry(roundedPolygon(pink, .03), 8);
  front.translate(0, 0, .003);
  const root = new THREE.BoxGeometry(Math.abs(inner.x - outer.x) - .008, EAR_SINK, EAR_DEPTH - .008);
  root.translate((outer.x + inner.x) / 2, -EAR_SINK / 2, -EAR_DEPTH / 2);
  return { front, solid, root, x: cx };
}

// Tai chó: khối đùn đúng viền tai trong ảnh (BODY_PX dogEar), mặt trước dán chính ảnh thân (UV = vị trí px của từng đỉnh, tai phải lấy
// tai phải của ảnh) nên màu / vành / lòng tai khớp Figma; thành bên lấy màu mép tai. Tai cụp: vạt rủ trước mặt, mặt sau cách mặt trước thân
// FLOP_GAP (≥ 5 mm, không z-fighting), nắp nhỏ vắt qua nóc đầu cho vạt dính liền đầu. Gốc toạ độ = mép trên thân, giữa tai.
const FLOP_DEPTH = .02, FLOP_BEVEL = .007, FLOP_GAP = .006;

function dogEarGeometries(breed, side) {
  const m = BODY_PX[breed], scale = W / (m.x1 - m.x0), mid = (m.x0 + m.x1) / 2;
  const pts = m.dogEar.map(([x, y]) => new THREE.Vector2(side * -(x - mid) * scale, (m.top - y) * scale));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const depth = m.flop ? FLOP_DEPTH : EAR_DEPTH, bevel = m.flop ? FLOP_BEVEL : EAR_BEVEL;
  const solid = new THREE.ExtrudeGeometry(roundedPolygon(pts.map(p => new THREE.Vector2(p.x - cx, p.y)), .012), {
    depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
  });
  solid.translate(0, 0, -(depth - bevel)); // mặt trước ở z = 0
  solid.computeVertexNormals();
  const pos = solid.attributes.position, uv = solid.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (mid + (pos.getX(i) + cx) / scale) / IMG_W, 1 - (m.top - pos.getY(i) / scale) / m.h);
  if (!m.flop) return { solid, x: cx };
  // Nắp = gốc tai vắt qua nóc đầu: cao tới đúng mép trên vạt, kéo từ trong đầu ra tới sát mặt trước vạt -> nhìn góc nào vạt cũng
  // liền với đầu (lỗi cũ: nắp thấp + lùi sau nên nhìn nghiêng thấy vạt tai và nắp là hai tấm rời, hở khe).
  const xs = pts.map(p => p.x - cx), top = Math.max(...pts.map(p => p.y)), capW = (Math.max(...xs) - Math.min(...xs)) * .8;
  const capH = top + .025, back = FLOP_DEPTH + FLOP_GAP + .06, capD = back - .004;
  const cap = roundedBox(capW, capH, capD, 2, Math.min(.012, capH / 2 - .001));
  cap.translate(0, top - .004 - capH / 2, -back + capD / 2 - .004); // mặt trên / trước nằm lọt trong vạt, không trùng mặt vạt
  return { solid, cap, x: cx };
}

// Ảnh thân chó làm texture (tai + mặt trước), nạp một lần mỗi giống.
function dogBodyTexture(breed) {
  const key = `dogbody:${breed}`;
  if (textures[key]) return textures[key];
  const texture = new THREE.TextureLoader().load(catExpressionSrc(breed, 'body'));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return (textures[key] = texture);
}

// Đệm mèo dưới lòng bàn chân: 1 đệm lớn hình tim tròn + 4 hạt đậu ngón ở phía trước, dán theo mặt dưới của bàn chân
// (khối cầu bán kính FOOT_R trong hệ toạ độ bàn chân, trước khi bàn chân bị nén dẹt). Chỉ thấy khi nhấc chân lên:
// lúc bước, nằm ngửa lăn lộn, bị nhấc bổng, quơ vuốt.
export const FOOT_R = .085, LEG_SHAFT = .13; // LEG_SHAFT: chiều cao gốc của ống chân (co giãn bằng scale.y)

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
// n đốt dài `seg`, bán kính từ gốc r0 tới chóp r1 (fluff = độ phình giữa đuôi, đuôi xù); flat = tiết diện bầu dục (bề ngang / bề dày,
// đuôi chùm lông dẹt như lông vũ); ring = màu khoanh xen kẽ; tipColor/tipFrom = chóp khác màu; hook = chóp cong móc câu khi dựng đuôi;
// wag / speed / stiff = biên độ, nhịp vẫy, độ cứng lò xo; bend / lag = độ uốn mỗi đốt, độ trễ sóng giữa các đốt.
const TAIL_STYLES = {
  orange: { n: 6, seg: .085, r0: .048, r1: .026, ring: 'stripe', hook: .7 },                                                // thon dần, vằn khoanh, chóp móc dấu hỏi
  gray: { n: 2, seg: .05, r0: .056, r1: .05, fluff: .35, hook: 0, wag: 1.5, speed: 1.7, stiff: 2, bend: .5, lag: .4 },      // cộc bông xù, ngoáy tít
  white: { n: 7, seg: .085, r0: .04, r1: .03, fluff: .7, flat: 1.15, wag: .75, speed: .7, stiff: .7 },           // chùm lông dài xù, phẩy chậm
  tuxedo: { n: 6, seg: .085, r0: .045, r1: .024, tipColor: 'belly', tipFrom: 5, wag: 1.1, speed: 1.25, stiff: 1.25 },      // đen thon, chóp trắng, giật nhanh
  siamese: { n: 8, seg: .08, r0: .036, r1: .011, hook: .25, wag: 1.2, stiff: .85 },                                        // roi dài mảnh nhọn dần, quất mềm
  tabby: { n: 6, seg: .088, r0: .05, r1: .045, ring: 'stripe', fluff: .45, flat: 1.1, tipColor: 'stripe', tipFrom: 6, wag: .85, speed: .85, stiff: .85 }, // to xù khoanh kiểu gấu mèo
  // Chó: vẫy nhanh, rộng hơn mèo
  shiba: { n: 5, seg: .06, r0: .046, r1: .04, fluff: .55, flat: 1.2, hook: 1.4, wag: 1.4, speed: 2.2, stiff: 1.6 },          // bông dày cuộn lên lưng
  malamute: { n: 6, seg: .075, r0: .045, r1: .04, fluff: .7, flat: 1.3, hook: 1, tipColor: 'belly', tipFrom: 5, wag: 1.3, speed: 1.8, stiff: 1.3 }, // chùm lông cong, chóp trắng
  dalmatian: { n: 6, seg: .08, r0: .04, r1: .012, hook: .1, wag: 1.6, speed: 2.4, stiff: 1.4 },                            // roi thon nhọn, vẫy tít
  golden: { n: 6, seg: .085, r0: .042, r1: .028, fluff: .6, flat: 1.45, hook: .15, wag: 1.6, speed: 2.2, stiff: 1.2 }, // lông vũ dẹt, vẫy rộng
  rottweiler: { n: 1, seg: .045, r0: .042, r1: .036, hook: 0, wag: 1.8, speed: 2.8, stiff: 2 },                             // cộc tròn, ngoáy
  pug: { n: 4, seg: .04, r0: .042, r1: .036, hook: 1.6, wag: 1.2, speed: 2.4, stiff: 2 },                                   // xoắn tròn chặt
};

// Đuôi là MỘT khối liền (ống tròn xoay theo bán kính dọc thân đuôi), không ghép từng đốt. Trả về bán kính tại độ cao y (m) tính từ
// gốc đuôi, và chiều dài cả đuôi. Chóp LUÔN thon nhọn mềm như đầu chổi lông (đoạn thon dài 2.2 lần bán kính chóp), không bo tròn đầu
// và không có cục bông / chùm phình ở chóp: chóp phình sau một đoạn thắt nhìn rất phản cảm (lỗi cũ, người chơi chê).
function tailProfile(style) {
  const L = style.n * style.seg, fluff = style.fluff === true ? .3 : style.fluff || 0;
  const core = y => { const t = Math.min(1, y / L); return (style.r0 + (style.r1 - style.r0) * t) * (1 + fluff * Math.sin(t * Math.PI) * Math.min(1, t * 3)); };
  const rt = core(L), taper = rt * 2.2;
  return { length: L + taper, radius: y => y <= L ? core(y) : rt * Math.pow(Math.max(0, 1 - (y - L) / taper), .55) };
}

const TAIL_RADIAL = 18;

// Lưới đuôi trong hệ toạ độ gốc đuôi (trục y), kèm trọng số uốn theo các đốt (xem poseTail) và nhóm màu (khoanh / chóp).
function tailGeometry(style) {
  const { length, radius } = tailProfile(style), rows = Math.max(24, Math.round(length / .007)), flat = style.flat || 1;
  const pos = [], bone = [], weight = [], index = [];
  let thinning = false, lastR = 0;
  for (let j = 0; j <= rows; j++) {
    const y = length * j / rows;
    let r = j === rows ? 0 : radius(y);
    // Qua chỗ to nhất rồi thì chỉ nhỏ dần, không bao giờ phình lại (không có "cổ thắt" trước chóp)
    if (r < lastR) thinning = true;
    if (thinning) r = Math.min(r, lastR);
    lastR = r;
    // Đốt chi phối: nội suy giữa tâm hai đốt kề (tâm đốt k ở (k + .5)·seg), mượt bằng smoothstep -> khớp uốn tròn, không gãy.
    const s = Math.min(style.n - 1, Math.max(0, y / style.seg - .5)), k0 = Math.floor(s), f = s - k0, w = f * f * (3 - 2 * f);
    for (let i = 0; i <= TAIL_RADIAL; i++) {
      const a = i / TAIL_RADIAL * TAU;
      pos.push(Math.cos(a) * r * flat, y, Math.sin(a) * r);
      bone.push(k0, Math.min(style.n - 1, k0 + 1)); weight.push(1 - w, w);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  // Nhóm màu theo từng hàng: 0 = lông, 1 = khoanh (đốt lẻ), 2 = chóp (từ đốt tipFrom)
  const band = y => style.tipColor && y >= (style.tipFrom ?? style.n) * style.seg ? 2 : style.ring && Math.floor(y / style.seg) % 2 ? 1 : 0;
  let start = 0, cur = -1;
  for (let j = 0; j < rows; j++) {
    const b = band(length * (j + .5) / rows);
    if (b !== cur) { if (cur >= 0) geo.addGroup(start, index.length - start, cur); start = index.length; cur = b; }
    for (let i = 0; i < TAIL_RADIAL; i++) {
      const p = j * (TAIL_RADIAL + 1) + i, q = p + TAIL_RADIAL + 1;
      index.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  geo.addGroup(start, index.length - start, cur);
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Đường nối vòng (đỉnh đầu = đỉnh cuối mỗi hàng) lấy chung pháp tuyến, chóp nhọn hướng thẳng ra: toon không lộ vệt nối
  const nrm = geo.attributes.normal;
  for (let j = 0; j <= rows; j++) {
    const a = j * (TAIL_RADIAL + 1), b = a + TAIL_RADIAL;
    const v = j === rows ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3().fromBufferAttribute(nrm, a).add(new THREE.Vector3().fromBufferAttribute(nrm, b)).normalize();
    nrm.setXYZ(a, v.x, v.y, v.z); nrm.setXYZ(b, v.x, v.y, v.z);
    if (j === rows) for (let i = 1; i < TAIL_RADIAL; i++) nrm.setXYZ(a + i, 0, 1, 0);
  }
  geo.userData.tail = { bone: Uint8Array.from(bone), weight: Float32Array.from(weight), rest: Float32Array.from(pos), restN: Float32Array.from(geo.attributes.normal.array) };
  return geo;
}

// Uốn lưới đuôi theo góc các đốt (rig.tail): mỗi đỉnh = trung bình có trọng số vị trí của nó gắn theo hai đốt chi phối
// (skinning làm trên CPU, ~600 đỉnh). Lưới thường (không SkinnedMesh) nên viền toon / viền mực bản đồ dùng chung lưới vẫn uốn theo.
// Gọi sau mỗi lần đặt góc đốt.
const TAIL_M = [], TAIL_V = new THREE.Vector3(), TAIL_A = new THREE.Vector3(), TAIL_N3 = new THREE.Matrix3();

export function poseTail(rig) {
  const mesh = rig.tailMesh, geo = mesh.geometry, { bone, weight, rest, restN } = mesh.userData.tail, seg = rig.tailStyle.seg;
  rig.tail.forEach((joint, k) => {
    joint.updateMatrix();
    const m = (TAIL_M[k] ||= new THREE.Matrix4());
    if (k) m.multiplyMatrices(TAIL_M[k - 1], joint.matrix); else m.copy(joint.matrix);
  });
  const p = geo.attributes.position, n = geo.attributes.normal, outline = geo.attributes.outlineNormal;
  for (let i = 0; i < p.count; i++) {
    TAIL_A.set(0, 0, 0);
    let nx = 0, ny = 0, nz = 0;
    for (let b = 0; b < 2; b++) {
      const w = weight[i * 2 + b];
      if (!w) continue;
      const k = bone[i * 2 + b], m = TAIL_M[k];
      TAIL_V.set(rest[i * 3], rest[i * 3 + 1] - k * seg, rest[i * 3 + 2]).applyMatrix4(m);
      TAIL_A.addScaledVector(TAIL_V, w);
      TAIL_V.set(restN[i * 3], restN[i * 3 + 1], restN[i * 3 + 2]).applyMatrix3(TAIL_N3.setFromMatrix4(m));
      nx += TAIL_V.x * w; ny += TAIL_V.y * w; nz += TAIL_V.z * w;
    }
    p.setXYZ(i, TAIL_A.x, TAIL_A.y, TAIL_A.z);
    TAIL_V.set(nx, ny, nz).normalize();
    n.setXYZ(i, TAIL_V.x, TAIL_V.y, TAIL_V.z);
    if (outline) outline.setXYZ(i, TAIL_V.x, TAIL_V.y, TAIL_V.z);
  }
  p.needsUpdate = n.needsUpdate = true;
  if (outline) outline.needsUpdate = true;
}

function tailStyle(breed) {
  const style = { n: 5, seg: .1, r0: .045, r1: .025, wag: 1, speed: 1, stiff: 1, hook: .4, ...TAIL_STYLES[breed] };
  style.bend ??= 4 / Math.max(1, style.n - 1); // nhiều đốt thì mỗi đốt uốn ít lại, dáng tổng thể giữ như đuôi 5 đốt gốc
  style.lag ??= 3 / Math.max(1, style.n - 1);
  return style;
}

// ---------- Bộ khung một con mèo ----------
export function buildRig(breed) {
  EXPRESSIONS.forEach(expr => expressionTexture(breed, expr)); // nạp sẵn mọi biểu cảm: lần đổi mặt đầu không bị trống
  const cat = catLook(breed);
  // Lông: nhám hoàn toàn, phản xạ thấp, thêm "sheen" (ánh mềm ở mép như lông/nhung thật) thay cho đốm bóng kiểu nhựa.
  const furMat = color => TOON ? toonMat({ color }) : new THREE.MeshPhysicalMaterial({ color, roughness: 1, metalness: 0, specularIntensity: .08,
    sheen: .25, sheenRoughness: .9, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .2) }); // dịu, không loá mép
  const fur = furMat(cat.fur);
  const accent = furMat(cat.ear || cat.mask || cat.fur); // tai / đuôi (calico: đen)
  const tailMat = cat.tail ? furMat(cat.tail) : accent; // chó: đuôi màu lông, khác màu vạt tai
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
  const dogEarMat = BODY_PX[breed].dogEar && (TOON ? toonMat({ color: '#ffffff', map: dogBodyTexture(breed) }) : new THREE.MeshLambertMaterial({ map: dogBodyTexture(breed) }));
  const ears = [-1, 1].map(side => {
    const m = BODY_PX[breed];
    if (m.dogEar) {
      const ear = new THREE.Group(), geo = dogEarGeometries(breed, side);
      const flap = mesh(geo.solid, dogEarMat);
      flap.userData.outlineStyle = 'catEar';
      ear.add(flap);
      if (geo.cap) ear.add(mesh(geo.cap, accent));
      ear.position.set(geo.x, H, m.flop ? D + FLOP_DEPTH + FLOP_GAP : D - EAR_BACK);
      ear.userData.flop = !!m.flop;
      pivot.add(ear);
      return ear;
    }
    const ear = new THREE.Group(), geo = earGeometries(breed, side);
    const outer = mesh(geo.solid, accent);
    outer.userData.outlineStyle = 'catEar'; // viền tai (toon.mjs OUTLINE_STYLES)
    const art = new THREE.Mesh(geo.front, earArtMat);
    art.userData.noOutline = true; // ảnh vành tai / lòng tai: chỉ là mảng màu, không viền
    const root = mesh(geo.root, fur);
    root.userData.noOutline = true; // nằm trong thân
    ear.add(outer, root, art);
    // Mặt trước tai lùi EAR_BACK sau mặt trước thân (chỗ nóc đầu đã phẳng, qua góc bo); gốc tai ở đỉnh thân, chân cắm sâu vào thân.
    ear.position.set(geo.x, H, D - EAR_BACK);
    pivot.add(ear);
    return ear;
  });

  // Đuôi: chuỗi đốt (khung xương vô hình, đốt sau là con của đốt trước) + MỘT lưới đuôi liền uốn theo khung (poseTail).
  // Hình dáng theo giống (TAIL_STYLES / tailProfile). Lỗi cũ: mỗi đốt một viên nhộng riêng -> đuôi lổn nhổn từng cục.
  const style = tailStyle(breed), tail = [];
  const ringMat = style.ring && cat[style.ring] ? furMat(cat[style.ring]) : tailMat;
  const tipMat = style.tipColor ? furMat(cat[style.tipColor] || cat.fur) : tailMat;
  let parent = pivot;
  for (let i = 0; i < style.n; i++) {
    const joint = new THREE.Group();
    if (i === 0) joint.position.set(0, H * .3, .02); else joint.position.y = style.seg;
    parent.add(joint);
    tail.push(joint);
    parent = joint;
  }
  const tailGeo = tailGeometry(style);
  const tailMesh = mesh(tailGeo, [tailMat, ringMat, tipMat]);
  tailMesh.userData.tail = tailGeo.userData.tail;
  tailMesh.frustumCulled = false; // lưới bị uốn lại mỗi frame, khung bao gốc không còn đúng
  pivot.add(tailMesh);

  // Chân: khớp ở trên, khối chân thò xuống; bàn chân màu riêng.
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const hip = new THREE.Group();
    hip.position.set(sx * W * .3, LEG + .03, sz * D * .3);
    // Chân tròn mũm mĩm: ống trụ tròn (đầu trên chìm trong thân, đầu dưới bị bàn chân che) + bàn chân là "cục bông" dẹt.
    // Ống trụ kéo dài theo y vẫn tròn đều (không méo góc bo như hộp bo góc khi kéo).
    // Ống chân màu lông (kể cả Xiêm): đầu ống cắm trong thân, thân lún / co thì lộ ra ở góc dưới mặt trước — màu nâu thành mảng lạ.
    const leg = mesh(new THREE.CylinderGeometry(.066, .07, LEG_SHAFT, 20, 1, true), fur);
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
  return { bodyBase, rest, root, hopper, roller, pivot, body, eyes, eyesMat, ears, tail, tailMesh, tailStyle: style, legs, z };
}

// Lò xo thân mềm theo từng trục: [độ cứng, tỉ lệ tắt, độ nhạy với gia tốc (1 = khối thật: lệch ≈ gia tốc ÷ độ cứng), độ lệch tối đa (m)].
// Tắt vừa (zeta ~.3): va chạm thì lắc 1–2 nhịp rồi đứng yên (zeta .14 cũ rung quá nhiều nhịp, trông như lắc mãi);
// trục dọc cứng hơn để không trông như bóng nước.
// SMOOTH = hằng số thời gian (s) lọc gia tốc (bỏ rung do frame dài ngắn không đều); BELLY = độ phình eo khi lún.
export const JELLY = {
  x: [210, .3, .9, .08], z: [210, .3, 1, .09], y: [520, .34, .5, .05], MAX_ACC: 60, SMOOTH: .05, BELLY: .6,
  tmpPos: new THREE.Vector3(), tmpVel: new THREE.Vector3(), tmpAcc: new THREE.Vector3(), tmpQ: new THREE.Quaternion(),
  tmpV: new THREE.Vector3(), tmpM: new THREE.Matrix4(),
};

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
  poseTail(rig);
  rig.root.userData.rig = rig; // cho cảnh khoe mèo (catShowcase) cử động chân
  return rig.root;
}
