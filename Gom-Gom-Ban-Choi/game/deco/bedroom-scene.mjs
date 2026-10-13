// Phòng ngủ (mở khi thắng màn 15): bộ đồ cho Deco (giường, góc máy tính, tủ quần áo, bậc leo cho mèo...) + đồ trang trí
// cố định (rèm, đèn dây, tranh, dép). Cùng kiểu dựng với deco-room.mjs / garden-scene.mjs: khối bo tròn, màu pastel,
// viền toon. Mỗi món có chỗ đặt cố định [x, z, xoay?] (room-layout.mjs PLACES); +z của món hướng vào giữa phòng.
// Điểm neo cho mèo ghi trong userData (toạ độ cục bộ của món): seat = chỗ ngồi / nằm, top = mặt trên, steps = các bậc.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { ROOM_HALF, BEDROOM_DOOR } from './room-layout.mjs';
import { TOON, toonMat } from './toon.mjs';
import { pendulum, ropeBetween } from './garden-scene.mjs';

const HALF = ROOM_HALF, TAU = Math.PI * 2;
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
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const glow = (color, emissive, intensity = 1) => mat(color, { emissive, emissiveIntensity: intensity });
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
const legs4 = (x, z, h, color, r = .035) => [[-x, -z], [x, -z], [-x, z], [x, z]].map(([lx, lz]) => at(cyl(r, r * .8, h, color, 10), lx, h / 2, lz));

// Màn hình / bàn phím phát sáng: vẽ canvas một lần, dùng chung.
const canvasCache = {};
function canvasTex(key, w, h, draw) {
  if (canvasCache[key]) return canvasCache[key];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (canvasCache[key] = texture);
}
// Màn hình game: trời chuyển màu, đồi, nhân vật mèo nhỏ + thanh máu.
const gameScreen = () => canvasTex('screen-game', 256, 144, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#7fd0ff'); sky.addColorStop(1, '#d9f2ff');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7fc45a'; g.beginPath(); g.ellipse(70, 150, 120, 50, 0, 0, TAU); g.ellipse(210, 160, 110, 55, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffd66b'; g.beginPath(); g.arc(215, 30, 16, 0, TAU); g.fill();
  g.fillStyle = '#f39a45'; g.fillRect(110, 78, 34, 26); g.beginPath(); g.moveTo(110, 78); g.lineTo(118, 66); g.lineTo(124, 78); g.moveTo(130, 78); g.lineTo(136, 66); g.lineTo(144, 78); g.fill();
  g.fillStyle = '#2b2f3a'; g.fillRect(118, 86, 4, 4); g.fillRect(132, 86, 4, 4);
  g.fillStyle = '#ffffffcc'; g.fillRect(10, 10, 80, 10); g.fillStyle = '#e8617f'; g.fillRect(12, 12, 56, 6);
});
// Màn hình laptop: tài liệu + ảnh.
const docScreen = () => canvasTex('screen-doc', 192, 128, (g, w, h) => {
  g.fillStyle = '#fdfcff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b48ee8'; g.fillRect(0, 0, w, 14);
  g.fillStyle = '#c8c2d8'; for (let y = 26; y < h - 10; y += 12) g.fillRect(14, y, 90 + (y * 7) % 40, 4);
  g.fillStyle = '#8fc9f2'; g.fillRect(126, 26, 52, 40); g.fillStyle = '#ffd66b'; g.beginPath(); g.arc(166, 36, 6, 0, TAU); g.fill();
});
// Bàn phím RGB: phím tối, viền phím đổi màu cầu vồng.
const rgbKeys = () => canvasTex('keys-rgb', 256, 80, (g, w, h) => {
  g.fillStyle = '#1f232b'; g.fillRect(0, 0, w, h);
  const hues = ['#ff6b8a', '#ffb347', '#ffe066', '#7fe08a', '#6fc3ff', '#b48ee8'];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 14; col++) {
    g.fillStyle = hues[(col + row) % hues.length]; g.fillRect(6 + col * 17.6, 6 + row * 18, 15, 15);
    g.fillStyle = '#2b2f3a'; g.fillRect(8 + col * 17.6, 8 + row * 18, 11, 11);
  }
});
// Bàn phím laptop: phím trắng trên nền xám đậm + bàn di chuột (dán phẳng lên thân máy).
const laptopKeys = () => canvasTex('keys-laptop', 256, 176, (g, w, h) => {
  g.fillStyle = '#9aa0ad'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#5d6370'; g.fillRect(8, 8, w - 16, 92);
  g.fillStyle = '#f4f5f8';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) g.fillRect(13 + col * 19.4, 13 + row * 21.5, 16, 17);
  g.fillStyle = '#c3c8d2'; g.fillRect(84, 112, 88, 54); // bàn di chuột
});
// Màn hình áp sát mặt nắp / vỏ (laptop: cách 5 mm): zoom xa thì độ chính xác depth không phân biệt nổi -> màn hình và nắp tranh
// nhau từng khung (nhấp nháy "giật"). polygonOffset kéo màn hình về phía camera trong depth test (như tấm dán mặt mèo) -> luôn nằm trên.
const screen = (w, h, texture) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({ map: texture, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));

// ---------- Giường: khung gỗ + đệm + chăn chần bông + 2 gối + đầu giường có ô trang trí ----------
function bedBase({ wood, duvet, duvetLine, pillow = '#ffffff', headboard = true }) {
  const parts = [
    ...legs4(.9, 1.1, .12, wood, .05),
    at(rbox(2, .22, 2.5, .06, wood), 0, .23, 0),
    at(rbox(1.9, .24, 2.36, .1, '#fffaf0'), 0, .44, 0),
    at(rbox(1.96, .13, 1.6, .06, duvet), 0, .56, .4),
    at(rbox(1.98, .09, .24, .045, '#ffffff'), 0, .6, -.36), // mép chăn gập lộ vỏ trắng
    // đường chần bông: dải màu mảnh sát mặt chăn, KHÔNG viền toon (viền hull biến mỗi dải thành rãnh đen đậm)
    ...[0, .45, .9].map(z => { const s = at(box(1.88, .004, .03, duvetLine), 0, .627, z); s.userData.noOutline = true; return s; }),
    ...[-.45, .45].map(x => { const p = at(rbox(.74, .16, .44, .08, pillow), x, .64, -.88); p.rotation.x = -.18; return p; }),
    at(rbox(2.06, .4, .1, .05, wood), 0, .35, 1.22), // chân giường thấp
  ];
  if (headboard) parts.push(at(rbox(2.1, 1.05, .14, .07, wood), 0, .74, -1.22), at(rbox(1.7, .62, .04, .02, '#e0a874'), 0, .86, -1.14));
  return parts;
}
// Rèm vải có nếp gấp dọc (tấm phẳng uốn sóng, hai mặt).
function drape(w, h, color, transparent = false) {
  const geo = new THREE.PlaneGeometry(w, h, 16, 1), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) / w * Math.PI * 4) * .03);
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { side: THREE.DoubleSide, transparent }));
}

// Trái tim dẹt (đùn theo +z từ 0 tới depth): s = 1 rộng ~.6 m.
function heartShape(s) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.22 * s); shape.bezierCurveTo(-.4 * s, .05 * s, -.2 * s, .32 * s, 0, .14 * s); shape.bezierCurveTo(.2 * s, .32 * s, .4 * s, .05 * s, 0, -.22 * s);
  return shape;
}
const heartMesh = (s, depth, color) => mesh(new THREE.ExtrudeGeometry(heartShape(s), { depth, bevelEnabled: false, curveSegments: 12 }), color);
// Mặt gương: tấm phẳng không nhận sáng, ban đêm tối đi cùng cảnh.
const glassMat = () => new THREE.MeshBasicMaterial({ color: '#d8f1ff', userData: { nightDim: true } });
const shine = () => new THREE.MeshBasicMaterial({ color: '#ffffff', userData: { nightDim: true } });
// Trái tim nằm phẳng trên mặt ngang (đáy ở y = 0).
const flatHeart = (s, depth, color) => { const node = heartMesh(s, depth, color); node.geometry.rotateX(-Math.PI / 2); return node; };
// Nơ: hai cánh nón chĩa vào nút giữa, mặt nơ hướng +z.
const bow = (color, s = 1) => group(...[-1, 1].map(k => at(mesh(new THREE.ConeGeometry(.06 * s, .12 * s, 10), color), k * .07 * s, 0, 0).rotateZ(k * Math.PI / 2)),
  at(ball(.035 * s, color), 0, 0, .01 * s));
// Dải LED phát sáng (món dùng phải khai userData.lightSource).
const led = color => glow(color, color, 1.3);

export const BEDROOM_BUILD = {
  bed() {
    const bed = group(...bedBase({ wood: '#c98a55', duvet: '#8fc9f2', duvetLine: '#6fb3e6' }),
      squash(at(ball(.12, '#ffb3c4'), .55, .67, .25), 1, .55, 1)); // gối ôm tròn nhỏ
    bed.userData.seat = [.15, .63, .15];
    return bed;
  },
  'bed-canopy'() {
    const wood = '#fff6f8', sheer = '#ffe0e9';
    const posts = [[-.98, -1.2], [.98, -1.2], [-.98, 1.2], [.98, 1.2]].map(([x, z]) => at(cyl(.045, .05, 2.2, wood, 12), x, 1.1, z));
    const rails = [at(box(2, .06, .06, wood), 0, 2.18, -1.2), at(box(2, .06, .06, wood), 0, 2.18, 1.2), at(box(.06, .06, 2.4, wood), -.98, 2.18, 0), at(box(.06, .06, 2.4, wood), .98, 2.18, 0)];
    const roof = at(drape(2.1, 2.5, sheer), 0, 2.24, 0); roof.rotation.x = -Math.PI / 2; // trên nóc cột (2.2) + thanh ngang (2.21)
    // Rèm treo phía trong cột (cột ở z ±1.15..1.25): z ±1.11, không xuyên qua cột.
    const curtains = [-1, 1].flatMap(s => [at(drape(.45, 1.9, sheer), s * .86, 1.25, -1.11), at(drape(.3, 1.9, sheer), s * .9, 1.25, 1.11)]);
    // Dây buộc rèm vàng + nơ hồng phía trước rèm (rèm gợn tới z 1.14).
    const ties = [-1, 1].flatMap(s => [at(box(.34, .05, .06, '#f2c14e'), s * .88, 1.05, 1.11), at(bow('#ff8fb6', .6), s * .88, 1.05, 1.18)]);
    // Diềm bèo lượn sóng dưới thanh ngang trước.
    const frill = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(k => squash(at(ball(.06, '#ffb3c8'), k * .2, 2.13, 1.22), 1, .7, .5));
    const bed = group(...bedBase({ wood, duvet: '#ffc2d4', duvetLine: '#ff8fb6', pillow: '#fff6f8', headboard: false }),
      at(rbox(2, .9, .1, .05, wood), 0, .7, -1.22), at(heartMesh(.5, .03, '#ff8fb6'), 0, .97, -1.165),
      ...posts, ...rails, roof, ...curtains, ...ties, ...frill);
    bed.userData.seat = [.15, .63, .15];
    return bed;
  },
  'bed-platform'() {
    // Giường bọc nỉ xám đậm: đầu giường ô nệm, dải LED cyan trên đầu giường + hắt sáng dưới gầm.
    const z = -1.22, cyan = '#3fe0ff';
    const bed = group(...bedBase({ wood: '#2b2e33', duvet: '#4a4e55', duvetLine: '#3a3d43', pillow: '#c9ccd1', headboard: false }),
      at(rbox(2.2, 1.1, .16, .07, '#3a3d43'), 0, .74, z), ...[-.72, -.24, .24, .72].map(x => at(rbox(.44, .8, .04, .02, '#45494f'), x, .8, z + .1)),
      at(box(2.24, .02, .02, led(cyan)), 0, 1.3, z + .08),
      at(rbox(1.96, .06, .5, .03, '#6b7078'), 0, .64, .95),
      // LED gầm giường (dưới khung, ngoài chân giường)
      at(box(1.7, .02, .02, led(cyan)), 0, .09, 1.19), ...[-1, 1].map(s => at(box(.02, .02, 2.1, led(cyan)), s * .97, .09, 0)));
    bed.userData.seat = [.15, .63, .15];
    bed.userData.lightSource = true;
    return bed;
  },

  // ---------- Tủ đầu giường: ngăn kéo + đèn ngủ + đồng hồ báo thức (mèo đẩy rơi như cốc trên bàn) ----------
  bedside() {
    const wood = '#f3d5a8';
    const clock = group(squash(at(cyl(.085, .085, .06, '#e8617f', 20), 0, 0, 0).rotateX(Math.PI / 2), 1, 1, 1),
      at(cyl(.065, .065, .01, '#fffaf0', 20), 0, 0, .032).rotateX(Math.PI / 2),
      at(box(.008, .045, .004, '#2b2f3a'), 0, .018, .04), at(box(.035, .008, .004, '#2b2f3a'), .014, 0, .04),
      at(ball(.035, '#ffd66b'), -.055, .085, 0), at(ball(.035, '#ffd66b'), .055, .085, 0));
    clock.position.set(.15, .67, .06);
    const lamp = group(at(cyl(.07, .08, .04, '#fff4e0', 16), 0, .02, 0), at(cyl(.012, .012, .2, '#c98a55', 8), 0, .14, 0),
      at(cyl(.08, .13, .14, glow('#ffe9a8', '#ffcf6a', .7), 20), 0, .28, 0));
    lamp.position.set(-.14, .58, -.06);
    const stand = group(...legs4(.22, .15, .08, '#c98a55', .025), at(rbox(.56, .46, .42, .04, wood), 0, .31, 0), at(rbox(.62, .04, .46, .02, '#e9c58f'), 0, .56, 0),
      at(rbox(.46, .16, .02, .01, '#fff4e0'), 0, .38, .215), at(ball(.025, '#c98a55'), 0, .38, .235), lamp, clock);
    stand.userData.mug = clock; // mèo đẩy đồng hồ rơi khỏi tủ
    clock.userData.home = clock.position.clone();
    stand.userData.top = .58;
    return stand;
  },
  'bedside-drawers'() {
    // Tủ ba ngăn hồng núm vàng, diềm bèo dưới mặt tủ, bình hoa hồng + đồng hồ hồng (mèo đẩy rơi).
    const body = '#ffc2d4', face = '#fff6f8', gold = '#f2c14e';
    const clock = group(at(rbox(.16, .12, .08, .03, '#ff8fb6'), 0, 0, 0), at(cyl(.045, .045, .01, '#fff6f8', 16), 0, 0, .042).rotateX(Math.PI / 2));
    clock.position.set(.16, .92, .05);
    const vase = group(at(cyl(.05, .06, .12, '#fff6f8', 14), 0, .06, 0), at(cyl(.008, .008, .1, '#7fb069', 6), 0, .16, 0),
      ...[[0, .23, 0], [-.04, .2, .02], [.04, .2, -.02]].map(([x, y, z]) => at(ball(.04, '#ff8fb6'), x, y, z)));
    vase.position.set(-.18, .89, -.05);
    const stand = group(...legs4(.26, .16, .06, face, .025), at(rbox(.68, .8, .46, .04, body), 0, .46, 0), at(rbox(.72, .04, .5, .02, '#ffe0e9'), 0, .87, 0),
      ...[-3, -2, -1, 0, 1, 2, 3].map(k => squash(at(ball(.03, '#ffb3c8'), k * .1, .845, .25), 1, .7, .5)),
      ...[.22, .46, .7].flatMap(y => [at(rbox(.58, .19, .02, .01, face), 0, y, .235), at(ball(.024, gold), 0, y, .255)]), vase, clock);
    stand.userData.mug = clock;
    clock.userData.home = clock.position.clone();
    stand.userData.top = .89;
    return stand;
  },
  'bedside-noir'() {
    // Tủ đen chân crôm: loa thông minh, đồng hồ số cyan (mèo đẩy rơi), dải LED dưới mặt tủ.
    const chrome = mat('#c8ccd2', { metalness: .8, roughness: .35 });
    const clock = group(at(rbox(.18, .1, .08, .03, '#45494f'), 0, 0, 0), at(box(.12, .05, .01, glow('#1a1c20', '#3fe0ff', .9)), 0, 0, .046));
    clock.position.set(.15, .63, .06);
    const speaker = at(cyl(.07, .07, .16, '#3a3d43', 20), -.16, .66, -.06);
    const stand = group(...legs4(.22, .15, .12, chrome, .015), at(rbox(.56, .42, .42, .04, '#26282c'), 0, .33, 0), at(rbox(.6, .03, .46, .015, '#3a3d43'), 0, .555, 0),
      at(box(.5, .006, .02, chrome), 0, .33, .215), at(box(.5, .012, .012, led('#b07cff')), 0, .52, .216),
      speaker, at(cyl(.05, .05, .01, glow('#26282c', '#3fe0ff', .8), 20), -.16, .745, -.06), clock);
    stand.userData.mug = clock;
    clock.userData.home = clock.position.clone();
    stand.userData.top = .58;
    stand.userData.lightSource = true;
    return stand;
  },

  desk() {
    const wood = '#d9a36a';
    // Nắp dày 2.2 cm bo 1 cm (bo ≤ nửa bề dày), màn hình cách mặt nắp 5 mm: hết gập mặt + chớp z-fighting.
    // Thân máy dày 2.4 cm (đủ cho viền toon) + mặt bàn phím cách mặt thân 5 mm (QC: tấm phẳng ≥ 5 mm, không chớp z-fighting)
    const keys = screen(.38, .26, laptopKeys()); keys.rotation.x = -Math.PI / 2; keys.position.set(0, .029, .01);
    const laptop = group(at(rbox(.42, .024, .3, .008, '#b9bec9'), 0, .012, 0), keys);
    const lid = group(at(rbox(.42, .28, .022, .01, '#d0d4dc'), 0, .14, 0), at(screen(.38, .24, docScreen()), 0, .14, .016));
    lid.position.set(0, .024, -.15); lid.rotation.x = -.25; laptop.add(lid);
    laptop.position.set(-.1, .77, .02);
    const lampArm = group(at(cyl(.07, .08, .03, '#7fc4e8', 16), 0, .015, 0), at(cyl(.012, .012, .36, '#7fc4e8', 8), 0, .2, 0).rotateZ(-.3),
      at(cyl(.05, .1, .1, glow('#7fc4e8', '#fff0c0', .3), 16), .14, .38, 0).rotateZ(.9));
    lampArm.position.set(.55, .77, -.18);
    const pencils = group(at(cyl(.045, .04, .12, '#ffd66b', 14), 0, .06, 0),
      ...['#e8617f', '#3b8fe0', '#7fc45a'].map((c, k) => at(cyl(.007, .007, .18, c, 6), (k - 1) * .018, .13, (k % 2) * .015)));
    pencils.position.set(.35, .77, .18);
    const desk = group(...legs4(.7, .3, .74, wood, .035), at(rbox(1.6, .05, .7, .02, wood), 0, .765, 0),
      at(rbox(.5, .14, .6, .02, '#e9c58f'), .5, .66, 0), at(ball(.02, '#c98a55'), .5, .66, .31),
      laptop, lampArm, pencils,
      at(rbox(.26, .05, .2, .01, '#e8617f'), -.55, .815, -.1), at(rbox(.24, .05, .18, .01, '#7fc45a'), -.55, .865, -.1));
    desk.userData.seat = [-.1, .79, .08];
    desk.userData.top = .79;
    return desk;
  },
  'desk-piano'() {
    // Đàn piano đứng hồng trắng kê tường: nơ hồng trên nắp, khung ảnh vàng, bình hoa; mèo nhảy lên nóc đàn nằm.
    const wood = '#ffc2d4', white = '#fff6f8', black = '#3a2a30';
    const keys = [];
    for (let i = 0; i < 13; i++) if (i % 7 !== 2 && i % 7 !== 6) keys.push(at(box(.035, .03, .12, black), -.62 + i * .1 + .05, .8, .24));
    const piano = group(at(rbox(1.5, 1.15, .5, .05, wood), 0, .575, -.1), at(rbox(1.56, .05, .54, .02, white), 0, 1.175, -.1),
      at(rbox(1.5, .08, .32, .03, wood), 0, .72, .24), at(box(1.36, .03, .24, white), 0, .775, .27), ...keys,
      ...[-1, 1].map(s => at(cyl(.04, .035, .68, white, 12), s * .68, .34, .34)), at(rbox(1.3, .06, .1, .03, white), 0, .06, .26),
      at(box(.5, .3, .02, white), 0, .98, .17).rotateX(-.2), at(box(.6, .03, .06, white), 0, .83, .19),
      at(bow('#ff8fb6', 1), .3, 1.16, .2), at(ball(.02, '#f2c14e'), .3, 1.16, .245),
      at(cyl(.06, .07, .14, white, 14), .55, 1.27, -.15), at(ball(.06, '#ff8fb6'), .55, 1.38, -.15),
      at(rbox(.22, .16, .04, .02, '#f2c14e'), -.5, 1.28, -.25));
    piano.userData.seat = [-.15, 1.2, -.08];
    piano.userData.top = 1.2;
    return piano;
  },
  'desk-setup'() {
    // Bàn gaming RGB: mặt bàn đen nhám, màn hình game lớn + LED hắt sau màn, bàn phím RGB, lót chuột viền LED, loa,
    // case PC kính có quạt LED dưới bàn, dải LED mép bàn.
    const top = '#26282c', dark = '#1f2125', frame = '#3a3d43', cyan = '#3fe0ff', magenta = '#ff4fd8', violet = '#b07cff';
    const monitor = group(at(rbox(.32, .02, .2, .01, dark), 0, .775, -.16), at(box(.05, .3, .04, dark), 0, .93, -.2),
      at(rbox(1, .58, .05, .025, '#1a1c20'), 0, 1.2, -.2), at(screen(.92, .5, gameScreen()), 0, 1.2, -.168), // màn hình cách viền 7 mm
      at(box(.9, .015, .015, led(magenta)), 0, 1.2, -.235)); // LED hắt sau màn
    const keys = screen(.58, .17, rgbKeys()); keys.rotation.x = -Math.PI / 2; keys.position.set(0, .801, .12); // phím cách mặt bàn phím 6 mm
    // Kính hông case cách vỏ 5.5 mm, quạt LED phía trước kính.
    const tower = group(at(rbox(.24, .5, .52, .03, dark), 0, .25, 0), at(box(.005, .38, .4, glow('#2a2140', violet, .9)), .128, .27, 0),
      ...[[.38, cyan], [.16, magenta]].map(([y, c]) => at(new THREE.Mesh(new THREE.TorusGeometry(.06, .01, 6, 20), led(c)), .136, y, .05).rotateY(Math.PI / 2)));
    tower.position.set(.56, 0, .02);
    const speaker = () => group(at(rbox(.1, .2, .1, .02, dark), 0, .1, 0), at(cyl(.032, .032, .01, '#45494f', 14), 0, .13, .051).rotateX(Math.PI / 2),
      at(cyl(.02, .02, .01, glow('#26282c', cyan, .8), 12), 0, .05, .051).rotateX(Math.PI / 2));
    const desk = group(
      at(rbox(1.7, .05, .72, .02, top), 0, .74, 0),
      at(rbox(.06, .72, .68, .02, frame), -.8, .36, 0), at(rbox(.06, .72, .68, .02, frame), .8, .36, 0),
      at(box(1.56, .1, .03, frame), 0, .66, -.3), // thanh giằng sau
      at(box(1.6, .015, .015, led(cyan)), 0, .71, .35), // dải LED mép bàn
      monitor, at(rbox(.62, .03, .2, .01, dark), 0, .78, .12), keys,
      at(rbox(.32, .006, .26, .003, '#2b2e33'), .5, .768, .1), at(box(.32, .008, .008, led(violet)), .5, .768, .234), squash(at(ball(.04, dark), .5, .785, .12), 1, .55, 1.4),
      at(speaker(), -.66, .765, -.18), at(speaker(), .66, .765, -.18),
      at(cyl(.045, .04, .1, '#3a3d43', 14), -.5, .815, .16), tower);
    desk.userData.seat = [0, .77, .12]; // nằm chễm chệ lên bàn phím
    desk.userData.top = .77;
    desk.userData.lightSource = true;
    return desk;
  },

  // ---------- Ghế trước bàn (mèo ngồi mặt ghế .55) ----------
  chair() {
    // Ghế gỗ tựa nan: chân tròn có giằng, đệm ngồi vàng có nút chần, tựa lưng ba nan dọc sơn ba màu.
    const wood = '#b9854a', light = '#c98a55';
    const chair = group(...legs4(.2, .2, .42, wood, .03),
      ...[-1, 1].map(s => at(box(.03, .03, .36, '#9a6a45'), s * .2, .14, 0)), // giằng chân hai bên
      at(rbox(.52, .05, .5, .02, light), 0, .445, 0),
      at(rbox(.46, .08, .38, .04, '#ffd66b'), 0, .51, .03), squash(at(ball(.022, '#e8617f'), 0, .55, .03), 1, .6, 1),
      // trụ tựa lưng nối tiếp hai chân sau, thanh ngang + ba nan dọc
      ...[-1, 1].map(s => at(cyl(.025, .03, .6, wood, 10), s * .2, .77, -.2)),
      at(rbox(.48, .09, .04, .02, light), 0, 1.02, -.2), at(rbox(.44, .05, .03, .015, light), 0, .68, -.2),
      ...['#e8617f', '#8fc9f2', '#7fc45a'].map((color, k) => at(box(.04, .26, .02, color), (k - 1) * .1, .84, -.2)));
    chair.userData.seat = [0, .55, .02];
    return chair;
  },
  'chair-beanbag'() {
    // Ghế lười hồng: đáy bẹt phồng, lưng tựa cao, lòng ghế hồng nhạt, đường viền chỉ hồng đậm + quai xách vàng.
    const bag = group(squash(at(ball(.5, '#ffb3c8'), 0, .27, 0), 1, .55, 1),
      squash(at(ball(.4, '#ffc2d4'), 0, .55, -.26), 1.1, .95, .62), // lưng tựa
      squash(at(ball(.3, '#ffe0e9'), 0, .44, .1), 1, .28, 1), // lòng ghế
      at(new THREE.Mesh(new THREE.TorusGeometry(.49, .022, 8, 40), mat('#ff8fb6')), 0, .25, 0).rotateX(Math.PI / 2),
      at(new THREE.Mesh(new THREE.TorusGeometry(.07, .018, 6, 16), mat('#f2c14e')), 0, .82, -.46));
    bag.userData.seat = [0, .5, .08];
    return bag;
  },
  'chair-office'() {
    // Ghế gaming đen: chân sao 5 cánh có bánh xe, gối đầu, dải LED cyan dọc lưng + magenta mép đệm.
    // Phần trên xoay được: mèo đáp lên thì ghế xoay một đoạn, lò xo mềm kéo về hướng cũ (lúc nghỉ luôn quay mặt vào bàn,
    // rideAlong tính từ góc nghỉ 0).
    const dark = '#1f2125', inset = '#3a3d43', cyan = '#3fe0ff';
    const spokes = [0, 1, 2, 3, 4].flatMap(k => {
      const a = k / 5 * TAU, spoke = at(box(.34, .04, .05, '#26282c'), Math.cos(a) * .17, .1, Math.sin(a) * .17);
      spoke.rotation.y = -a;
      return [spoke, at(ball(.035, '#45494f'), Math.cos(a) * .32, .035, Math.sin(a) * .32)];
    });
    const back = group(at(rbox(.56, .82, .12, .06, dark), 0, 0, 0), at(rbox(.2, .7, .02, .01, inset), 0, 0, .065), at(rbox(.32, .12, .08, .04, inset), 0, .3, .07),
      ...[-1, 1].map(s => at(box(.015, .7, .015, led(cyan)), s * .2, 0, .068)));
    back.position.set(0, .56, -.27); back.rotation.x = -.12;
    const arm = s => group(at(box(.04, .22, .04, dark), s * .31, .2, -.02), at(rbox(.07, .04, .3, .015, dark), s * .31, .32, 0));
    const seat = group(at(rbox(.56, .12, .56, .06, dark), 0, .06, 0), at(rbox(.4, .04, .46, .02, inset), 0, .13, .02),
      at(box(.5, .015, .015, led('#ff4fd8')), 0, .06, .285), back, arm(1), arm(-1));
    seat.position.y = .4;
    const chair = group(...spokes, at(cyl(.035, .035, .32, '#9aa0a8', 12), 0, .26, 0), seat);
    let last = 0;
    seat.userData.v = 0;
    chair.userData.spin = v => { seat.userData.v += v; };
    chair.userData.update = t => {
      const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t;
      seat.userData.v += (-5 * seat.rotation.y - 1.1 * seat.userData.v) * dt;
      seat.rotation.y += seat.userData.v * dt;
    };
    seat.userData.restPos = seat.position.clone();
    chair.userData.ride = seat; // mèo ngồi trên ghế xoay theo (deco-room.mjs rideAlong)
    chair.userData.seat = [0, .55, .02];
    chair.userData.lightSource = true;
    return chair;
  },

  // ---------- Tủ quần áo: hai cánh tủ + ngăn kéo dưới + hộp đựng đồ trên nóc (mèo trèo lên nóc) ----------
  closet() {
    const body = '#fff4e0', door = '#ffe9d0', knob = '#ff8fb8';
    const closet = group(...legs4(.55, .22, .1, '#c98a55', .03),
      at(rbox(1.3, 1.9, .6, .06, body), 0, 1.05, 0), at(rbox(1.4, .08, .66, .03, '#f3d5a8'), 0, 2.02, 0),
      ...[-1, 1].flatMap(s => [at(rbox(.6, 1.36, .03, .015, door), s * .32, 1.24, .3), at(rbox(.44, 1.1, .02, .01, '#fff6e8'), s * .32, 1.24, .315),
        at(ball(.035, knob), s * .06, 1.2, .33)]),
      at(rbox(1.2, .26, .03, .015, door), 0, .3, .3), at(ball(.035, knob), 0, .3, .33),
      at(rbox(.42, .28, .36, .04, '#9fd0f0'), -.36, 2.2, 0), at(rbox(.3, .2, .3, .03, '#ffd27a'), -.36, 2.44, .02));
    closet.userData.seat = [.25, 2.06, .02];
    return closet;
  },
  'closet-dresser'() {
    // Bàn trang điểm hồng: gương bầu dục viền vàng, bốn ngăn núm vàng, lọ nước hoa lilac, hộp trang sức hồng.
    const body = '#ffc2d4', face = '#fff6f8', gold = '#f2c14e';
    const mirror = group(squash(at(cyl(.36, .36, .05, gold, 32), 0, 0, 0).rotateX(Math.PI / 2), 1, 1.3, 1),
      squash(at(new THREE.Mesh(new THREE.CircleGeometry(.3, 32), new THREE.MeshBasicMaterial({ color: '#dff3ff', userData: { nightDim: true } })), 0, 0, .028), 1, 1.3, 1));
    mirror.position.set(0, 1.4, -.18);
    const dresser = group(...legs4(.5, .2, .08, face, .03),
      at(rbox(1.2, .74, .5, .05, body), 0, .45, 0), at(rbox(1.26, .04, .54, .02, '#ffe0e9'), 0, .84, 0),
      ...[[-.29, .62], [.29, .62], [-.29, .32], [.29, .32]].flatMap(([x, y]) => [at(rbox(.52, .24, .02, .01, face), x, y, .255), at(ball(.025, gold), x, y, .27)]),
      at(box(.06, .5, .04, face), 0, 1.05, -.18), mirror, at(bow('#ff8fb6', .8), 0, 1.84, -.15),
      at(cyl(.035, .04, .12, '#e6d4ff', 12), -.42, .92, .05), at(ball(.025, gold), -.42, 1, .05),
      at(rbox(.2, .1, .14, .02, '#ff8fb6'), .4, .91, .02));
    dresser.userData.seat = [.25, .86, .08];
    return dresser;
  },
  'closet-noir'() {
    // Tủ áo đen mờ tay nắm crôm, LED cyan ở khe cửa + dưới gờ nóc, LED tím ở chân đế; nóc cao 2.06 như tủ gốc.
    const body = '#26282c', door = '#2f3236', chrome = mat('#c8ccd2', { metalness: .8, roughness: .35 }), cyan = '#3fe0ff';
    const closet = group(at(rbox(1.36, .1, .58, .03, '#1a1c20'), 0, .05, 0), at(box(1.2, .012, .012, led('#b07cff')), 0, .05, .297),
      at(rbox(1.3, 1.92, .6, .06, body), 0, 1.06, 0), at(rbox(1.4, .06, .66, .03, '#3a3d43'), 0, 2.03, 0),
      ...[-1, 1].flatMap(s => [at(rbox(.6, 1.78, .03, .015, door), s * .32, 1.06, .3), at(rbox(.025, .5, .03, .012, chrome), s * .06, 1.1, .335)]),
      at(box(.012, 1.7, .012, led(cyan)), 0, 1.06, .31), at(box(1.26, .012, .012, led(cyan)), 0, 1.975, .31),
      at(rbox(.36, .26, .3, .04, '#45494f'), -.36, 2.19, 0), at(rbox(.26, .16, .26, .03, '#9aa0a8'), -.36, 2.4, .02));
    closet.userData.seat = [.25, 2.06, .02];
    closet.userData.lightSource = true;
    return closet;
  },

  // ---------- Thảm lông giữa phòng (đi được, mèo lăn trên thảm) ----------
  bedrug() {
    const rug = group(at(cyl(1.3, 1.3, .035, '#e6dcff', 48), 0, .0175, 0), at(cyl(.95, .95, .04, '#f4efff', 40), 0, .022, 0),
      squash(at(new THREE.Mesh(new THREE.TorusGeometry(1.26, .03, 8, 64), mat('#d9ccff')), 0, .03, 0).rotateX(Math.PI / 2), 1, 1, 1),
      ...[0, 1, 2, 3, 4, 5].map(k => at(cyl(.09, .09, .045, '#cdbcff', 16), Math.cos(k * TAU / 6) * .6, .023, Math.sin(k * TAU / 6) * .6)));
    rug.scale.set(1, 1, .82);
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .045;
    return rug;
  },
  'bedrug-cloud'() {
    // Thảm đám mây hồng: viền hồng, lòng hồng nhạt, rắc tim nhỏ vàng / hồng.
    const puffs = [[-.55, .05, .62], [.15, -.1, .78], [.8, .08, .58], [-.05, .38, .55], [.45, .4, .45]];
    const rug = group(...puffs.map(([x, z, r]) => at(cyl(r, r, .035, '#ffc2d4', 32), x, .0175, z)),
      ...puffs.map(([x, z, r]) => at(cyl(r - .07, r - .07, .04, '#ffe0e9', 28), x, .02, z)),
      ...[[-.4, 0], [.3, .05], [.85, .1], [0, .35]].map(([x, z], k) => at(flatHeart(.22, .008, k % 2 ? '#f2c14e' : '#ff8fb6'), x, .04, z)));
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .045;
    return rug;
  },
  'bedrug-mono'() {
    // Thảm sọc đen trắng, viền LED cyan quanh mép.
    const cyan = '#3fe0ff';
    const rug = group(at(rbox(2.4, .035, 1.9, .015, '#2b2e33'), 0, .0175, 0),
      ...[-.6, -.3, 0, .3, .6].map(z => at(box(2.1, .045, .12, '#d6d8dc'), 0, .0225, z)),
      ...[-1, 1].flatMap(s => [at(box(2.3, .012, .03, led(cyan)), 0, .04, s * .88), at(box(.03, .012, 1.79, led(cyan)), s * 1.13, .04, 0)]));
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .045;
    rug.userData.lightSource = true;
    return rug;
  },

  // ---------- Thú bông góc phòng (mèo nhồi bột rồi rúc ngủ cạnh, seat = chỗ nằm bên cạnh) ----------
  plushie() {
    // Gấu teddy, mõm + gan bàn chân màu kem, nơ hồng. Mắt / mũi đặt ngoài mặt đầu.
    const fur = '#d9a36a', light = '#f3d5a8', dark = '#4a2e20';
    const bear = group(squash(at(ball(.38, fur), 0, .38, 0), 1, 1.05, .9), squash(at(ball(.24, light), 0, .36, .26), 1, 1.1, .45),
      at(ball(.28, fur), 0, .9, .02), squash(at(ball(.12, light), 0, .84, .24), 1.1, .8, 1), at(ball(.04, dark), 0, .89, .36),
      at(ball(.033, dark), -.11, .98, .28), at(ball(.033, dark), .11, .98, .28),
      ...[-1, 1].flatMap(s => [at(ball(.1, fur), s * .2, 1.13, 0), at(ball(.06, light), s * .2, 1.13, .05),
        squash(at(ball(.14, fur), s * .36, .45, .12), .8, 1.3, .8), squash(at(ball(.16, fur), s * .2, .12, .32), 1, .8, 1.4),
        at(ball(.07, light), s * .2, .12, .5)]),
      ...[-1, 1].map(s => at(mesh(new THREE.ConeGeometry(.06, .12, 10), '#ff8fb8'), s * .07, .66, .25).rotateZ(s * Math.PI / 2)), at(ball(.035, '#ff8fb8'), 0, .66, .26));
    bear.children.forEach(part => { part.position.y += .02; }); // thân tròn ngồi chạm sàn, không lún
    bear.userData.seat = [.38, 0, .38];
    return bear;
  },
  'plushie-bunny'() {
    // Thỏ bông hồng: tai dài lòng hồng đậm, nơ vàng ở cổ, ôm trái tim. Mắt / mũi đặt ngoài mặt đầu.
    const fur = '#ffc2d4', pink = '#ff8fb6', dark = '#4a2e20';
    const bunny = group(squash(at(ball(.36, fur), 0, .36, 0), 1, 1.05, .92), squash(at(ball(.22, '#ffe0e9'), 0, .34, .25), 1, 1.1, .45),
      at(ball(.26, fur), 0, .86, .03), squash(at(ball(.1, '#fff6f8'), 0, .8, .24), 1.2, .8, 1),
      at(ball(.03, dark), -.11, .93, .27), at(ball(.03, dark), .11, .93, .27), squash(at(ball(.035, pink), 0, .84, .335), 1.2, .8, 1),
      ...[-1, 1].flatMap(s => [squash(at(ball(.09, fur), s * .12, 1.27, -.02), .55, 2.2, .5), squash(at(ball(.06, pink), s * .12, 1.27, .015), .45, 1.9, .3),
        squash(at(ball(.13, fur), s * .32, .45, .14), .8, 1.25, .8), squash(at(ball(.15, fur), s * .19, .12, .3), 1, .8, 1.4), at(ball(.06, pink), s * .19, .12, .48)]),
      at(bow('#f2c14e', .9), 0, .66, .25), at(heartMesh(.3, .06, pink), 0, .44, .34));
    bunny.children.forEach(part => { part.position.y += .02; }); // thân tròn ngồi chạm sàn, không lún
    bunny.userData.seat = [.38, 0, .38];
    return bunny;
  },
  'plushie-shark'() {
    // Cá mập robot bông: thân xám nằm sấp, bụng trắng, mắt LED cyan, vây ngực LED tím, ăng-ten đầu đèn magenta.
    const grey = '#6b7078', belly = '#e6e8eb';
    const shark = group(squash(at(ball(.3, grey), 0, .24, 0), 1.6, .8, 1), squash(at(ball(.24, belly), 0, .18, .04), 1.5, .5, .9),
      at(mesh(new THREE.ConeGeometry(.12, .24, 16), '#3a3d43'), -.04, .5, 0).rotateZ(.25), at(mesh(new THREE.ConeGeometry(.13, .26, 16), grey), -.44, .3, 0).rotateZ(Math.PI / 2.4),
      ...[-1, 1].map(s => squash(at(ball(.1, led('#b07cff')), .1, .12, s * .26), 1.4, .4, 1)),
      ...[-1, 1].map(s => at(ball(.03, led('#3fe0ff')), .4, .3, s * .17)), at(box(.16, .012, .02, '#1a1c20'), .44, .19, 0),
      at(cyl(.008, .008, .12, '#3a3d43', 6), .3, .48, 0), at(ball(.025, led('#ff4fd8')), .3, .55, 0));
    shark.children.forEach(part => { part.position.y += .02; });
    shark.userData.seat = [.38, 0, .38];
    shark.userData.lightSource = true;
    return shark;
  },

  // ---------- Giỏ đồ giặt (mèo chui vào nằm trên đống quần áo) ----------
  laundry() {
    const wicker = '#e9c58f', band = '#d9b07e';
    const basket = group(at(cyl(.36, .3, .5, wicker, 28), 0, .25, 0),
      ...[.1, .25, .4].map(y => at(new THREE.Mesh(new THREE.TorusGeometry(.33 + y * .07, .015, 6, 32), mat(band)), 0, y, 0).rotateX(Math.PI / 2)),
      at(new THREE.Mesh(new THREE.TorusGeometry(.36, .03, 8, 36), mat(band)), 0, .5, 0).rotateX(Math.PI / 2),
      squash(at(ball(.3, '#9fd0f0'), 0, .44, 0), 1, .35, 1), squash(at(ball(.18, '#ff8fb8'), -.1, .52, .08), 1.2, .4, 1), squash(at(ball(.15, '#fffaf0'), .12, .54, -.06), 1, .45, 1.2),
      at(rbox(.12, .32, .08, .04, '#ff8fb8'), .33, .4, .12).rotateZ(.3), // tay áo vắt qua mép giỏ
      at(rbox(.07, .2, .06, .03, '#ffd66b'), -.3, .42, -.16).rotateZ(-.4)); // chiếc tất
    basket.userData.seat = [0, .5, 0];
    return basket;
  },
  'laundry-washer'() {
    // Máy giặt mini hồng trắng: viền cửa vàng, núm vàng, tim hồng trước chân máy; mèo nhảy lên nóc nằm (máy ấm).
    const body = '#fff6f8', trim = '#ffc2d4', gold = '#f2c14e';
    const glass = at(cyl(.15, .15, .03, mat('#ffe0e9', { transparent: true, opacity: .85 }), 28), 0, .4, .31).rotateX(Math.PI / 2);
    const washer = group(...legs4(.24, .22, .04, trim, .03), at(rbox(.62, .8, .58, .06, body), 0, .44, 0),
      at(rbox(.6, .14, .04, .02, trim), 0, .74, .29), at(cyl(.04, .04, .03, gold, 16), .2, .74, .32).rotateX(Math.PI / 2),
      ...[-.2, -.12].map(x => at(ball(.018, '#ff8fb6'), x, .74, .315)),
      at(mesh(new THREE.TorusGeometry(.17, .03, 10, 36), gold), 0, .4, .3), glass,
      at(heartMesh(.2, .02, '#ff8fb6'), 0, .13, .295),
      squash(at(ball(.1, '#ff8fb6'), -.03, .36, .27), 1, .6, .5), squash(at(ball(.08, '#fff6f8'), .05, .44, .27), 1, .6, .5)); // quần áo trong lồng giặt
    washer.userData.seat = [0, .86, 0];
    return washer;
  },
  'laundry-hamper'() {
    // Giỏ nỉ xám quai da, vành miệng giỏ LED cyan; quần áo xám / đen bên trong.
    const felt = '#4a4e55', leather = '#26282c';
    const hamper = group(at(cyl(.36, .32, .5, felt, 28), 0, .25, 0), at(mesh(new THREE.TorusGeometry(.36, .025, 8, 36), led('#3fe0ff')), 0, .5, 0).rotateX(Math.PI / 2),
      ...[-1, 1].map(s => at(rbox(.16, .05, .03, .015, leather), s * .3, .44, s * .16).rotateY(s * .5 + Math.PI / 2)),
      squash(at(ball(.3, '#6b7078'), 0, .44, 0), 1, .35, 1), squash(at(ball(.16, '#26282c'), -.1, .52, .08), 1.2, .4, 1), squash(at(ball(.14, '#d6d8dc'), .12, .53, -.06), 1, .45, 1.2),
      at(rbox(.11, .3, .07, .035, '#d6d8dc'), .33, .4, .12).rotateZ(.3));
    hamper.userData.seat = [0, .5, 0];
    hamper.userData.lightSource = true;
    return hamper;
  },

  // ---------- Bậc leo gắn tường cho mèo (ba bậc so le + đệm trên cùng + bóng treo lắc lư) ----------
  catsteps() {
    const wood = '#c98a55';
    const step = (x, y) => group(at(rbox(.56, .05, .32, .02, wood), x, y, 0), at(box(.04, .16, .26, '#b37444'), x - .2, y - .1, -.02), at(box(.04, .16, .26, '#b37444'), x + .2, y - .1, -.02));
    const steps = [[-.35, .65], [.35, 1.2], [-.2, 1.75]];
    const L = .5, pivot = new THREE.Vector3(.35, 1.17, .1);
    const swing = pendulum(pivot, L, at(ball(.08, '#ffd66b'), 0, -L, 0), ropeBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L + .08, 0), .008, '#fffaf0'));
    const node = group(...steps.map(([x, y]) => step(x, y)), at(rbox(.5, .06, .28, .03, '#e8617f'), -.2, 1.8, 0),
      at(rbox(.7, .02, .5, .008, '#b9854a'), 0, .01, .15), swing); // tấm cào móng dưới chân
    node.userData.steps = [[-.35, .68, 0], [.35, 1.23, 0], [-.2, 1.84, 0]]; // mặt bậc (bậc trên cùng có đệm)
    node.userData.swing = swing;
    node.userData.update = t => swing.userData.step(t);
    return node;
  },
  'catsteps-clouds'() {
    // Ba đám mây hồng gắn tường làm bậc, đệm mặt trăng vàng trên cùng; tấm cào móng hồng dưới chân.
    const cloud = (x, y) => group(...[[-.14, 0, .13], [.14, 0, .13], [0, .03, .17]].map(([dx, dy, r]) => squash(at(ball(r, '#ffe0e9'), x + dx, y + dy, 0), 1, .45, .95)),
      at(box(.36, .14, .1, '#ffb3c8'), x, y - .06, -.22)); // tấm gắn tường (mặt sau cách tường 1 cm)
    const steps = [[-.35, .64], [.35, 1.19], [-.2, 1.77]];
    const node = group(...steps.map(([x, y]) => cloud(x, y)), squash(at(ball(.14, '#f2c14e'), -.2, 1.86, 0), 1.3, .4, 1),
      at(rbox(.7, .02, .5, .008, '#ff8fb6'), 0, .01, .15));
    node.userData.steps = steps.map(([x, y]) => [x, y + .08, 0]);
    return node;
  },
  'catsteps-floating'() {
    // Kệ treo thép đen: bậc nỉ xám, thanh đỡ trước là dải LED cyan, đệm trên cùng viền LED magenta; tấm cào móng xám.
    const steel = '#1f2125', felt = '#6b7078';
    const step = (x, y) => group(at(rbox(.56, .05, .32, .02, felt), x, y, 0), at(box(.52, .03, .03, led('#3fe0ff')), x, y - .04, .14),
      ...[-.2, .2].map(dx => at(box(.03, .18, .03, steel), x + dx, y - .12, -.13)));
    const steps = [[-.35, .65], [.35, 1.2], [-.2, 1.75]];
    const node = group(...steps.map(([x, y]) => step(x, y)), at(rbox(.5, .06, .28, .03, '#3a3d43'), -.2, 1.8, 0),
      at(box(.46, .012, .012, led('#ff4fd8')), -.2, 1.8, .148),
      at(rbox(.7, .02, .5, .008, '#45494f'), 0, .01, .15));
    node.userData.steps = [[-.35, .68, 0], [.35, 1.23, 0], [-.2, 1.84, 0]];
    node.userData.lightSource = true;
    return node;
  },

  // ---------- Gương đứng kê tường trái (mèo ngồi trước gương ngắm mình: approach = chỗ đứng trước gương) ----------
  // Mặt gương cách mặt khung 6 mm, vệt sáng cách mặt gương 6 mm; đỉnh < 1.7 m (kệ treo tường phía trên, đáy ở 1.72).
  mirror() {
    // Khung cam bo tròn, chân đế xanh ngọc, hoa hồng nhỏ góc trên.
    const frame = '#ffa94d', teal = '#4fc1b0';
    const streak = (w, h, x, y) => at(new THREE.Mesh(new THREE.PlaneGeometry(w, h), shine()), x, y, .042).rotateZ(.5);
    const node = group(at(rbox(.7, .06, .36, .03, teal), 0, .03, 0), ...[-1, 1].map(s => at(rbox(.07, .2, .07, .03, teal), s * .22, .15, 0)),
      at(rbox(.62, 1.36, .06, .03, frame), 0, .86, 0), at(new THREE.Mesh(new THREE.PlaneGeometry(.5, 1.24), glassMat()), 0, .86, .036),
      streak(.05, .5, -.1, 1.05), streak(.025, .3, .03, 1.08),
      // hoa trên mép khung, ngoài mặt gương (gương tới y 1.48)
      ...[0, 1, 2, 3, 4].map(k => at(ball(.035, '#ff8fb8'), .24 + Math.cos(k / 5 * TAU) * .045, 1.58 + Math.sin(k / 5 * TAU) * .045, .05)),
      at(ball(.03, '#ffd66b'), .24, 1.58, .065));
    node.userData.approach = [0, 0, .75];
    return node;
  },
  'mirror-pink'() {
    // Gương trái tim hồng viền vàng trên chân trụ trắng, nơ hồng ở mũi tim, diềm bèo quanh đế.
    const pink = '#ffb3c8', white = '#fff6f8', gold = '#f2c14e', y = 1.13;
    const glass = at(new THREE.Mesh(new THREE.ShapeGeometry(heartShape(1.4), 12), glassMat()), 0, y, .036);
    const node = group(at(cyl(.24, .27, .07, white, 28), 0, .035, 0), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => squash(at(ball(.04, pink), Math.cos(k / 10 * TAU) * .26, .06, Math.sin(k / 10 * TAU) * .26), 1, .7, 1)),
      at(cyl(.035, .04, .72, white, 12), 0, .43, -.06), at(ball(.05, gold), 0, .78, -.06),
      at(heartMesh(1.85, .04, gold), 0, y, -.05), at(heartMesh(1.7, .06, pink), 0, y, -.03), glass,
      at(new THREE.Mesh(new THREE.PlaneGeometry(.035, .22), shine()), -.12, y + .12, .042).rotateZ(.5),
      at(bow('#ff8fb6', 1), 0, y - .37, .06), at(ball(.02, gold), 0, y - .37, .1));
    node.userData.approach = [0, 0, .75];
    return node;
  },
  'mirror-modern'() {
    // Gương khung đen nhám bo góc, viền LED cyan quanh mặt gương, chân đế thép + dải LED tím hắt sàn.
    const dark = '#1f2125', steel = '#3a3d43', cyan = '#3fe0ff';
    const node = group(at(rbox(.66, .05, .34, .02, steel), 0, .025, 0), at(box(.6, .012, .012, led('#b07cff')), 0, .025, .17),
      ...[-1, 1].map(s => at(box(.04, .1, .04, '#c8ccd2'), s * .22, .1, 0)),
      at(rbox(.6, 1.46, .05, .025, dark), 0, .87, 0), at(new THREE.Mesh(new THREE.PlaneGeometry(.48, 1.34), glassMat()), 0, .87, .031),
      ...[-1, 1].flatMap(s => [at(box(.012, 1.36, .012, led(cyan)), s * .27, .87, .025), at(box(.55, .012, .012, led(cyan)), 0, .87 + s * .7, .025)]),
      at(new THREE.Mesh(new THREE.PlaneGeometry(.04, .45), shine()), -.1, 1.05, .037).rotateZ(.5));
    node.userData.approach = [0, 0, .75];
    node.userData.lightSource = true;
    return node;
  },
};

// ---------- Trang trí cố định trên tường phòng ngủ (u = trục ngang của tường, +z = mặt hướng vào phòng) ----------
//   0 = tường sau (u = x phòng), 1 = tường trước (u = -x), 2 = tường trái (u = -z), 3 = tường phải (u = z).
const onWall = color => mat(color, { transparent: true });
function wallFrame(w, h, frameColor, art, u, y) {
  return group(at(mesh(new THREE.BoxGeometry(w, h, .05), onWall(frameColor)), u, y, .13),
    at(new THREE.Mesh(new THREE.PlaneGeometry(w - .1, h - .1), new THREE.MeshBasicMaterial({ color: art, transparent: true, userData: { nightDim: true } })), u, y, .16),
    at(new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * .18, 20), new THREE.MeshBasicMaterial({ color: '#fff6e4', transparent: true, userData: { nightDim: true } })), u - w * .1, y + h * .12, .165));
}
export function decorateBedroomWall(i, wall) {
  if (i === 0) {
    // Không còn cửa sổ (giữa tường sau là cửa sang phòng tắm). Đèn dây võng phía trên góc máy tính: bóng nhỏ phát sáng vàng ấm.
    const pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(1 + t * 2.6, 2.82 - Math.sin(t * Math.PI) * .2, .2)); } // cao hơn poster (đỉnh ~2.35) và khung cửa phòng tắm (2.2)
    const line = new THREE.CatmullRomCurve3(pts);
    wall.add(mesh(new THREE.TubeGeometry(line, 32, .007, 5), onWall('#6a5a4a')));
    for (let k = 1; k < 12; k++) {
      const p = line.getPoint(k / 12);
      wall.add(at(mesh(new THREE.SphereGeometry(.035, 10, 7), mat('#fff3c4', { transparent: true, emissive: '#ffcf6a', emissiveIntensity: 1.1 })), p.x, p.y - .05, .22));
    }
    // Hai poster game phía trên bàn máy tính (x ≈ 2.45).
    wall.add(wallFrame(.62, .82, '#2b2f3a', '#b48ee8', 2, 1.95), wallFrame(.56, .56, '#2b2f3a', '#7fd0ff', 2.95, 2.05),
      at(new THREE.Mesh(new THREE.CircleGeometry(.12, 5), new THREE.MeshBasicMaterial({ color: '#ffd66b', transparent: true, userData: { nightDim: true } })), 2, 1.85, .17));
  }
  if (i === 2) { // ảnh dán cạnh giường (giường ở z ≈ -2.7 -> u ≈ 2.7) + kệ treo nhỏ có cây (tủ quần áo ở u ≈ -.7)
    wall.add(wallFrame(.4, .5, '#fff4e0', '#ffc9d5', 2.2, 1.7), wallFrame(.36, .36, '#fff4e0', '#c9e8b0', 2.75, 1.95), wallFrame(.32, .42, '#fff4e0', '#ffe2a0', 3.2, 1.6));
    wall.add(at(mesh(roundedBox(.9, .05, .26, ROUND, .015), onWall('#c98a55')), 1, 1.75, .23),
      at(cyl(.07, .055, .12, onWall('#e8617f'), 14), .75, 1.84, .23), at(ball(.09, onWall('#6fbf4a')), .75, 1.95, .23),
      at(rbox(.18, .14, .14, .02, onWall('#ffd66b')), 1.15, 1.85, .23));
  }
  if (i === 3) { // đồng hồ tròn góc trên bàn máy tính (cửa phòng khách ở u = 2.3, bậc leo ở u ≈ -.5)
    wall.add(at(mesh(new THREE.CylinderGeometry(.3, .3, .06, 32), onWall('#ffffff')), -2.6, 2.25, .13).rotateX(Math.PI / 2),
      at(mesh(new THREE.TorusGeometry(.3, .03, 8, 32), onWall('#b48ee8')), -2.6, 2.25, .16));
  }
  if (i === 1) { // biển đèn neon trái tim trên tường trước
    const heart = new THREE.Shape();
    heart.moveTo(0, -.22); heart.bezierCurveTo(-.4, .05, -.2, .32, 0, .14); heart.bezierCurveTo(.2, .32, .4, .05, 0, -.22);
    wall.add(at(mesh(new THREE.ExtrudeGeometry(heart, { depth: .03, bevelEnabled: false, curveSegments: 16 }),
      mat('#ff8fb8', { transparent: true, emissive: '#ff6fa0', emissiveIntensity: 1 })), .6, 2, .13));
  }
}

// ---------- Đồ cố định trên sàn phòng ngủ: thảm chùi chân trong cửa, dép cạnh giường, thùng rác cạnh bàn ----------
export function bedroomDecor() {
  const mat2 = group(at(rbox(.9, .03, .5, .015, '#c9955e'), 0, .015, 0), at(box(.7, .04, .32, '#b48ee8'), 0, .02, 0));
  mat2.position.set(HALF - .55, 0, BEDROOM_DOOR.z); mat2.rotation.y = Math.PI / 2;
  mat2.traverse(node => { node.castShadow = false; node.userData.noOutline = true; }); // thảm chùi chân: không viền
  const slipper = (x, z, rot) => { const s = group(squash(at(ball(.08, '#ffb3c4'), 0, .04, 0), 1, .45, 2), squash(at(ball(.05, '#ffffff'), 0, .07, .06), 1.3, .5, 1)); s.position.set(x, 0, z); s.rotation.y = rot; return s; };
  const bin = group(at(cyl(.14, .11, .3, '#9fd0f0', 20), 0, .15, 0), squash(at(ball(.06, '#fffaf0'), .02, .31, 0), 1, .7, 1));
  bin.position.set(3.45, 0, -2.75);
  return mergeStatic(group(mat2, slipper(-1.05, -1.05, .2), slipper(-.85, -1.1, -.1), bin));
}
