// Phòng ngủ (mở khi thắng màn 15): bộ đồ cho Deco (giường, góc máy tính, tủ quần áo, bậc leo cho mèo...) + đồ trang trí
// cố định (rèm, đèn dây, tranh, dép). Cùng kiểu dựng với deco-room.mjs / garden-scene.mjs: khối bo tròn, màu pastel,
// viền toon. Mỗi món có chỗ đặt cố định [x, z, xoay?] (room-layout.mjs PLACES); +z của món hướng vào giữa phòng.
// Điểm neo cho mèo ghi trong userData (toạ độ cục bộ của món): seat = chỗ ngồi / nằm, top = mặt trên, steps = các bậc.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { ROOM_HALF, BEDROOM_DOOR, BEDROOM_WINDOW_X } from './room-layout.mjs';
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

// Phần gắn bản lề rung như lò xo khi bị chạm (bản sao gọn của springy() trong deco-room.mjs).
function springy(node, parts) {
  const state = parts.map((part, i) => ({ part, rest: part.rotation.x, v: 0, gain: 1 + (i % 2) * .6 }));
  let last = 0;
  node.userData.bump = (k = 1) => state.forEach(s => { s.v += k * 3 * s.gain; });
  node.userData.update = t => {
    const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t;
    state.forEach(s => { const off = s.part.rotation.x - s.rest; s.v += (-120 * off - 7 * s.v) * dt; s.part.rotation.x += s.v * dt; });
  };
  return node;
}

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

export const BEDROOM_BUILD = {
  bed() {
    const bed = group(...bedBase({ wood: '#c98a55', duvet: '#8fc9f2', duvetLine: '#6fb3e6' }),
      squash(at(ball(.12, '#ffb3c4'), .55, .67, .25), 1, .55, 1)); // gối ôm tròn nhỏ
    bed.userData.seat = [.15, .63, .15];
    return bed;
  },
  'bed-canopy'() {
    const wood = '#fff4e0', sheer = '#ffd9e2';
    const posts = [[-.98, -1.2], [.98, -1.2], [-.98, 1.2], [.98, 1.2]].map(([x, z]) => at(cyl(.045, .05, 2.2, wood, 12), x, 1.1, z));
    const rails = [at(box(2, .06, .06, wood), 0, 2.18, -1.2), at(box(2, .06, .06, wood), 0, 2.18, 1.2), at(box(.06, .06, 2.4, wood), -.98, 2.18, 0), at(box(.06, .06, 2.4, wood), .98, 2.18, 0)];
    const roof = at(drape(2.1, 2.5, sheer), 0, 2.24, 0); roof.rotation.x = -Math.PI / 2; // trên nóc cột (2.2) + thanh ngang (2.21)
    // Rèm treo phía trong cột (cột ở z ±1.15..1.25): z ±1.11, không xuyên qua cột.
    const curtains = [-1, 1].flatMap(s => [at(drape(.45, 1.9, sheer), s * .86, 1.25, -1.11), at(drape(.3, 1.9, sheer), s * .9, 1.25, 1.11)]);
    const ties = [-1, 1].map(s => at(box(.34, .05, .06, '#ff8fb8'), s * .88, 1.05, 1.11));
    const bed = group(...bedBase({ wood, duvet: '#ffb3c4', duvetLine: '#f58fab', pillow: '#fff6fa', headboard: false }),
      at(rbox(2, .9, .1, .05, wood), 0, .7, -1.22), ...posts, ...rails, roof, ...curtains, ...ties);
    bed.userData.seat = [.15, .63, .15];
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
    const body = '#9fd0f0', face = '#c9e8ff';
    const clock = group(at(rbox(.16, .12, .08, .03, '#ffd66b'), 0, 0, 0), at(cyl(.045, .045, .01, '#fffaf0', 16), 0, 0, .042).rotateX(Math.PI / 2));
    clock.position.set(.16, .92, .05);
    const plant = group(at(cyl(.06, .05, .1, '#fff4e0', 14), 0, .05, 0), squash(at(ball(.08, '#7fc45a'), 0, .14, 0), 1, .8, 1));
    plant.position.set(-.18, .86, -.05);
    const stand = group(...legs4(.26, .16, .06, '#c98a55', .025), at(rbox(.68, .8, .46, .04, body), 0, .46, 0), at(rbox(.72, .04, .5, .02, '#e6f4ff'), 0, .87, 0),
      ...[.22, .46, .7].flatMap(y => [at(rbox(.58, .19, .02, .01, face), 0, y, .235), at(ball(.024, '#ffffff'), 0, y, .255)]), plant, clock);
    stand.userData.mug = clock;
    clock.userData.home = clock.position.clone();
    stand.userData.top = .89;
    return stand;
  },

  // ---------- Bàn máy tính: màn hình game, bàn phím RGB, chuột, loa, case PC đèn tím dưới bàn ----------
  desk() {
    const top = '#f5f0e6', dark = '#2b2f3a', frame = '#3a3f4a';
    const monitor = group(at(rbox(.32, .02, .2, .01, dark), 0, .775, -.16), at(box(.05, .3, .04, dark), 0, .93, -.2),
      at(rbox(1, .58, .05, .025, '#1f232b'), 0, 1.2, -.2), at(screen(.92, .5, gameScreen()), 0, 1.2, -.168)); // màn hình cách viền 7 mm
    const keys = screen(.58, .17, rgbKeys()); keys.rotation.x = -Math.PI / 2; keys.position.set(0, .801, .12); // phím cách mặt bàn phím 6 mm
    const tower = group(at(rbox(.24, .5, .52, .03, dark), 0, .25, 0), at(box(.005, .38, .4, glow('#3a2a5a', '#b48ee8', .9)), .123, .27, 0),
      ...[.38, .16].map(y => at(new THREE.Mesh(new THREE.TorusGeometry(.06, .01, 6, 20), glow('#b48ee8', '#b48ee8', 1.2)), .126, y, .05).rotateY(Math.PI / 2)));
    tower.position.set(.56, 0, .02);
    const speaker = x => group(at(rbox(.1, .2, .1, .02, dark), 0, .1, 0), at(cyl(.032, .032, .01, '#5a6070', 14), 0, .13, .051).rotateX(Math.PI / 2), at(cyl(.02, .02, .01, '#5a6070', 12), 0, .05, .051).rotateX(Math.PI / 2));
    const desk = group(
      at(rbox(1.7, .05, .72, .02, top), 0, .74, 0),
      at(rbox(.06, .72, .68, .02, frame), -.8, .36, 0), at(rbox(.06, .72, .68, .02, frame), .8, .36, 0),
      at(box(1.56, .1, .03, frame), 0, .66, -.3), // thanh giằng sau
      at(box(1.6, .015, .015, glow('#b48ee8', '#b48ee8', 1.4)), 0, .71, .35), // dải LED mép bàn
      monitor, at(rbox(.62, .03, .2, .01, dark), 0, .78, .12), keys,
      at(rbox(.32, .006, .26, .003, '#b48ee8'), .5, .768, .1), squash(at(ball(.04, dark), .5, .785, .12), 1, .55, 1.4),
      at(speaker(), -.66, .765, -.18), at(speaker(), .66, .765, -.18),
      at(cyl(.045, .04, .1, '#ff8fb8', 14), -.5, .815, .16), tower);
    desk.userData.seat = [0, .77, .12]; // nằm chễm chệ lên bàn phím
    desk.userData.top = .77;
    return desk;
  },
  'desk-study'() {
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

  // ---------- Ghế gaming: chân sao 5 cánh có bánh xe, phần trên xoay được (mèo ngồi thì ghế quay chầm chậm) ----------
  chair() {
    const dark = '#2b2f3a', pink = '#e8617f';
    const spokes = [0, 1, 2, 3, 4].flatMap(k => {
      const a = k / 5 * TAU, spoke = at(box(.34, .04, .05, dark), Math.cos(a) * .17, .1, Math.sin(a) * .17);
      spoke.rotation.y = -a;
      return [spoke, at(ball(.035, '#5a6070'), Math.cos(a) * .32, .035, Math.sin(a) * .32)];
    });
    const back = group(at(rbox(.56, .82, .12, .06, dark), 0, 0, 0), at(rbox(.2, .7, .02, .01, pink), 0, 0, .065), at(rbox(.32, .12, .08, .04, pink), 0, .3, .07));
    back.position.set(0, .56, -.27); back.rotation.x = -.12;
    const arm = s => group(at(box(.04, .22, .04, dark), s * .31, .2, -.02), at(rbox(.07, .04, .3, .015, dark), s * .31, .32, 0));
    const seat = group(at(rbox(.56, .12, .56, .06, dark), 0, .06, 0), at(rbox(.4, .04, .46, .02, pink), 0, .13, .02), back, arm(1), arm(-1));
    seat.position.y = .4;
    const chair = group(...spokes, at(cyl(.035, .035, .32, '#5a6070', 12), 0, .26, 0), seat);
    // Quay ghế: mèo đáp lên thì ghế xoay một đoạn, lò xo mềm kéo về hướng cũ (đung đưa qua lại rồi đứng yên),
    // nên lúc nghỉ ghế luôn quay đúng mặt vào bàn và mèo nhảy lên không bị giật hướng (rideAlong tính từ góc nghỉ 0).
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
    return chair;
  },
  'chair-beanbag'() {
    // Ghế lười: đáy bẹt phồng, lưng tựa cao phía sau, lòng ghế lõm sáng màu, đường viền chỉ quanh hông + quai xách.
    const bag = group(squash(at(ball(.5, '#ffd27a'), 0, .27, 0), 1, .55, 1),
      squash(at(ball(.4, '#ffc85a'), 0, .55, -.26), 1.1, .95, .62), // lưng tựa
      squash(at(ball(.3, '#ffe6ae'), 0, .44, .1), 1, .28, 1), // lòng ghế
      at(new THREE.Mesh(new THREE.TorusGeometry(.49, .022, 8, 40), mat('#f0a83c')), 0, .25, 0).rotateX(Math.PI / 2),
      at(new THREE.Mesh(new THREE.TorusGeometry(.07, .018, 6, 16), mat('#f0a83c')), 0, .82, -.46));
    bag.userData.seat = [0, .5, .08];
    return bag;
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
    const body = '#ffc9d5', face = '#ffe0e8';
    const mirror = group(squash(at(cyl(.36, .36, .05, '#fff4e0', 32), 0, 0, 0).rotateX(Math.PI / 2), 1, 1.3, 1),
      squash(at(new THREE.Mesh(new THREE.CircleGeometry(.3, 32), new THREE.MeshBasicMaterial({ color: '#dff3ff', userData: { nightDim: true } })), 0, 0, .028), 1, 1.3, 1));
    mirror.position.set(0, 1.4, -.18);
    const dresser = group(...legs4(.5, .2, .08, '#c98a55', .03),
      at(rbox(1.2, .74, .5, .05, body), 0, .45, 0), at(rbox(1.26, .04, .54, .02, '#fff4e0'), 0, .84, 0),
      ...[[-.29, .62], [.29, .62], [-.29, .32], [.29, .32]].flatMap(([x, y]) => [at(rbox(.52, .24, .02, .01, face), x, y, .255), at(ball(.025, '#ffffff'), x, y, .27)]),
      at(box(.06, .5, .04, '#fff4e0'), 0, 1.05, -.18), mirror,
      at(cyl(.035, .04, .12, '#b48ee8', 12), -.42, .92, .05), at(ball(.025, '#ffd66b'), -.42, 1, .05),
      at(rbox(.2, .1, .14, .02, '#ffd66b'), .4, .91, .02));
    dresser.userData.seat = [.25, .86, .08];
    return dresser;
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
    const puffs = [[-.55, .05, .62], [.15, -.1, .78], [.8, .08, .58], [-.05, .38, .55], [.45, .4, .45]];
    const rug = group(...puffs.map(([x, z, r]) => at(cyl(r, r, .035, '#d6e8ff', 32), x, .0175, z)),
      ...puffs.map(([x, z, r]) => at(cyl(r - .07, r - .07, .04, '#f2f8ff', 28), x, .02, z)),
      ...[[-.4, 0], [.3, .05], [.85, .1], [0, .35]].map(([x, z], k) => at(cyl(.05, .05, .045, k % 2 ? '#ffd66b' : '#9fd0f0', 5), x, .025, z)));
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .04;
    return rug;
  },

  // ---------- Gấu bông khổng lồ ngồi góc phòng (mèo nhồi bột rồi rúc ngủ cạnh) ----------
  plushie() {
    const fur = '#d9a36a', light = '#f3d5a8', dark = '#4a2e20';
    const bear = group(squash(at(ball(.38, fur), 0, .38, 0), 1, 1.05, .9), squash(at(ball(.24, light), 0, .36, .26), 1, 1.1, .45),
      at(ball(.28, fur), 0, .9, .02), squash(at(ball(.12, light), 0, .84, .24), 1.1, .8, 1), at(ball(.04, dark), 0, .89, .35),
      at(ball(.033, dark), -.1, .97, .25), at(ball(.033, dark), .1, .97, .25),
      ...[-1, 1].flatMap(s => [at(ball(.1, fur), s * .2, 1.13, 0), at(ball(.06, light), s * .2, 1.13, .05),
        squash(at(ball(.14, fur), s * .36, .45, .12), .8, 1.3, .8), squash(at(ball(.16, fur), s * .2, .12, .32), 1, .8, 1.4),
        at(ball(.07, light), s * .2, .12, .5)]),
      ...[-1, 1].map(s => at(mesh(new THREE.ConeGeometry(.06, .12, 10), '#ff8fb8'), s * .07, .66, .25).rotateZ(s * Math.PI / 2)), at(ball(.035, '#ff8fb8'), 0, .66, .26));
    bear.children.forEach(part => { part.position.y += .02; }); // thân tròn ngồi chạm sàn, không lún
    bear.userData.seat = [.38, 0, .38];
    return bear;
  },
  'plushie-dino'() {
    // Khủng long bông ngồi: đầu chìa ra trước có mõm, mắt to, hàng gai cam dọc lưng xuống đuôi.
    const green = '#7fc45a', belly = '#d8f0b8', dark = '#2b2f3a';
    const spike = (y, z, tilt) => at(mesh(new THREE.ConeGeometry(.075, .17, 8), '#ffb347'), 0, y, z).rotateX(tilt);
    const dino = group(squash(at(ball(.36, green), 0, .36, 0), 1, 1.05, 1), squash(at(ball(.24, belly), 0, .35, .24), 1, 1.15, .5),
      at(ball(.25, green), 0, .82, .16), squash(at(ball(.17, green), 0, .74, .38), 1.1, .75, 1), // đầu + mõm
      at(ball(.025, dark), -.06, .78, .55), at(ball(.025, dark), .06, .78, .55), // lỗ mũi
      ...[-1, 1].flatMap(s => [at(ball(.065, '#ffffff'), s * .11, .95, .33), at(ball(.04, dark), s * .11, .955, .38), at(ball(.012, '#ffffff'), s * .1, .97, .41)]),
      spike(1.08, .1, -.3), spike(1.02, -.1, -.7), spike(.82, -.28, -1.1), spike(.58, -.38, -1.35), spike(.34, -.42, -1.5),
      at(mesh(new THREE.ConeGeometry(.15, .55, 14), green), 0, .22, -.55).rotateX(-1.3), // đuôi (đáy nón không cắm xuống sàn)
      ...[-1, 1].flatMap(s => [squash(at(ball(.12, green), s * .33, .44, .16), .8, 1.25, .8), squash(at(ball(.15, green), s * .2, .12, .3), 1, .8, 1.3),
        at(ball(.06, belly), s * .2, .12, .48)]));
    dino.children.forEach(part => { part.position.y += .02; }); // thân tròn ngồi chạm sàn, không lún
    dino.userData.seat = [.38, 0, .38];
    return dino;
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
  'laundry-box'() {
    const card = '#d9a36a', dark = '#b9854a', H = .5;
    const wall = (w, x, z, rot) => { const node = at(box(w, H, .03, card), x, H / 2, z); node.rotation.y = rot; return node; };
    const folds = [];
    const flap = (w, x, z, rot, droop, len) => {
      const fold = group(at(box(w, .02, len, dark), 0, 0, len / 2));
      fold.rotation.x = droop;
      const side = group(fold); side.position.set(x, H, z); side.rotation.y = rot;
      folds.push(fold);
      return side;
    };
    const crate = group(at(box(.7, .02, .6, dark), 0, .01, 0), wall(.7, 0, -.3, 0), wall(.7, 0, .3, 0), wall(.6, -.35, 0, Math.PI / 2), wall(.6, .35, 0, Math.PI / 2),
      flap(.68, 0, .315, 0, .9, .26), flap(.68, 0, -.315, Math.PI, 1, .26), flap(.58, .365, 0, Math.PI / 2, 1.1, .24), flap(.58, -.365, 0, -Math.PI / 2, .85, .24),
      at(box(.5, .06, .006, '#e8617f'), 0, .32, .318), at(box(.06, .5, .006, '#c9955e'), 0, .25, .319), // nhãn "dễ vỡ" + băng keo
      squash(at(ball(.26, '#e6dcff'), 0, .36, 0), 1, .3, 1)); // chăn nhỏ lót đáy
    crate.userData.seat = [0, .42, 0];
    return springy(crate, folds);
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
  'catsteps-bridge'() {
    const wood = '#b9854a', rope = '#f3e6c8';
    const platform = (x, y, w) => group(at(rbox(w, .05, .34, .02, wood), x, y, 0), at(box(.04, .16, .28, '#9a6a45'), x, y - .1, -.02));
    const parts = [platform(.6, .62, .5), platform(-.62, 1.3, .5), platform(.62, 1.3, .5)];
    // Cầu dây võng giữa hai bệ trên: ván gỗ treo trên hai dây.
    const sag = t => 1.3 - Math.sin(t * Math.PI) * .1;
    for (let k = 1; k < 8; k++) { const t = k / 8, x = -.37 + t * .74; parts.push(at(box(.07, .03, .3, '#d9a36a'), x, sag(t) - .01, 0)); }
    for (const z of [-.15, .15]) {
      const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(-.4 + t * .8, sag(t) + .05, z)); }
      parts.push(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .012, 6), rope));
    }
    const node = group(...parts, at(rbox(.42, .05, .26, .025, '#9fd0f0'), -.62, 1.35, 0));
    node.userData.wallMounted = true; // treo tường, không chạm sàn
    node.userData.steps = [[.6, .65, 0], [.62, 1.33, 0], [-.62, 1.38, 0]];
    return node;
  },

  // ===== Phương án thứ hai cho từng chỗ (lựa chọn thứ 3): cùng khuôn khổ món gốc, điểm neo ghi trong userData =====
  // Giường mèo: đầu giường hình mặt mèo (tai nhọn, mắt, mũi, ria).
  'bed-kitty'() {
    const face = '#f7c99a', pink = '#ff8fb8', dark = '#4a2e20', z = -1.22;
    const ear = s => [squash(at(mesh(new THREE.ConeGeometry(.26, .4, 20), face), s * .7, 1.38, z + .04), 1, 1, .4), squash(at(mesh(new THREE.ConeGeometry(.15, .26, 16), pink), s * .7, 1.34, z + .1), 1, 1, .4)];
    const whisker = (s, tilt) => at(box(.3, .015, .02, dark), s * .62, .86 + tilt * .2, z + .085).rotateZ(-s * tilt);
    const bed = group(...bedBase({ wood: '#f5f0e6', duvet: '#ffd27a', duvetLine: '#f0b84a', pillow: '#fffaf0', headboard: false }),
      at(rbox(2.1, 1.0, .14, .07, face), 0, .72, z), ...ear(-1), ...ear(1),
      ...[-1, 1].flatMap(s => [at(ball(.075, dark), s * .36, .98, z + .06), at(ball(.025, '#ffffff'), s * .34, 1.01, z + .13), whisker(s, .25), whisker(s, -.15)]),
      squash(at(ball(.06, pink), 0, .86, z + .07), 1.3, .8, 1),
      squash(at(ball(.13, '#ffd27a'), .6, .66, .3), 1, .5, 1), squash(at(ball(.07, '#f7c99a'), -.55, .66, .55), 1, .5, 1)); // gối tròn + gối nhỏ
    bed.userData.seat = [.15, .63, .15];
    return bed;
  },
  // Thảm ngôi sao: phẳng, nằm gọn trong khung thảm lông.
  'bedrug-star'() {
    const star = (R, r) => {
      const pts = [];
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + Math.PI / 2, d = k % 2 ? r : R; pts.push(new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d)); }
      return new THREE.Shape(pts);
    };
    const slab = (shape, h, color) => { const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); return mesh(geo, color); };
    const rug = group(slab(star(1.12, .52), .035, '#ffd66b'), slab(star(.8, .37), .04, '#fff1b8'),
      ...[0, 1, 2, 3, 4].map(k => { const a = k / 5 * TAU + Math.PI / 2; return at(cyl(.07, .07, .045, '#ff8fb8', 16), Math.cos(a) * .3, .0225, -Math.sin(a) * .3); }));
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .04;
    return rug;
  },
  // Máy giặt mini (thay giỏ đồ giặt): mèo nhảy lên nóc nằm (máy ấm).
  'laundry-washer'() {
    const body = '#f5f8fb', trim = '#c8c2b8';
    const glass = at(cyl(.15, .15, .03, mat('#9fd0f0', { transparent: true, opacity: .85 }), 28), 0, .4, .31).rotateX(Math.PI / 2);
    const washer = group(...legs4(.24, .22, .04, trim, .03), at(rbox(.62, .8, .58, .06, body), 0, .44, 0),
      at(rbox(.6, .14, .04, .02, '#e3ddd1'), 0, .74, .29), at(cyl(.04, .04, .03, '#ec5b8c', 16), .2, .74, .32).rotateX(Math.PI / 2),
      ...[-.2, -.12].map(x => at(ball(.018, '#7fc45a'), x, .74, .315)),
      at(mesh(new THREE.TorusGeometry(.17, .03, 10, 36), trim), 0, .4, .3), glass,
      squash(at(ball(.1, '#ff8fb8'), -.03, .36, .27), 1, .6, .5), squash(at(ball(.08, '#ffd66b'), .05, .44, .27), 1, .6, .5)); // quần áo trong lồng giặt
    washer.userData.seat = [0, .86, 0];
    return washer;
  },
  // Chồng sách to (thay tủ đầu giường): đồng hồ báo thức trên cùng là thứ mèo đẩy rơi.
  'bedside-books'() {
    const books = [['#e8617f', .6, .44, 0], ['#3b8fe0', .56, .42, .12], ['#7fc45a', .58, .4, -.08], ['#ffd66b', .5, .38, .18]];
    const stack = group();
    books.forEach(([color, w, d, rot], i) => {
      const book = group(at(rbox(w, .12, d, .03, color), 0, .06, 0), at(box(w - .05, .09, d - .03, '#fffaf0'), .03, .06, 0));
      book.position.y = i * .12; book.rotation.y = rot;
      stack.add(book);
    });
    const clock = group(at(cyl(.085, .085, .06, '#b79cf0', 20), 0, 0, 0).rotateX(Math.PI / 2),
      at(cyl(.065, .065, .01, '#fffaf0', 20), 0, 0, .032).rotateX(Math.PI / 2), at(box(.008, .045, .006, '#2b2f3a'), 0, .018, .04),
      at(ball(.035, '#ffd66b'), -.055, .085, 0), at(ball(.035, '#ffd66b'), .055, .085, 0));
    clock.position.set(.12, .57, .05);
    stack.add(clock, at(rbox(.2, .03, .14, .01, '#ff8fb8'), -.14, .495, -.06));
    stack.userData.mug = clock;
    clock.userData.home = clock.position.clone();
    stack.userData.top = .48;
    return stack;
  },
  // Đàn piano (thay bàn máy tính): đàn đứng kê tường; mèo nhảy lên nóc đàn nằm.
  'desk-piano'() {
    const wood = '#5a3a2e', black = '#1f1f24';
    const keys = [];
    for (let i = 0; i < 13; i++) if (i % 7 !== 2 && i % 7 !== 6) keys.push(at(box(.035, .03, .12, black), -.62 + i * .1 + .05, .8, .24));
    const piano = group(at(rbox(1.5, 1.15, .5, .05, wood), 0, .575, -.1), at(rbox(1.56, .05, .54, .02, '#7a4e3a'), 0, 1.175, -.1),
      at(rbox(1.5, .08, .32, .03, wood), 0, .72, .24), at(box(1.36, .03, .24, '#fffaf0'), 0, .775, .27), ...keys,
      ...[-1, 1].map(s => at(cyl(.04, .035, .68, wood, 12), s * .68, .34, .34)), at(rbox(1.3, .06, .1, .03, wood), 0, .06, .26),
      at(box(.5, .3, .02, '#fffaf0'), 0, .98, .17).rotateX(-.2), at(box(.6, .03, .06, wood), 0, .83, .19),
      at(cyl(.06, .07, .14, '#8fc9f2', 14), .55, 1.27, -.15), at(ball(.06, '#ff8fb8'), .55, 1.38, -.15),
      at(rbox(.22, .16, .04, .02, '#e0a874'), -.5, 1.28, -.25));
    piano.userData.seat = [-.15, 1.2, -.08];
    piano.userData.top = 1.2;
    return piano;
  },
  // Ghế nấm (thay ghế gaming): mũ nấm đỏ chấm trắng, mặt ngồi ~.55.
  'chair-stool'() {
    const R = .36, Y = .42, H = .126;
    const spot = (a, d, r) => {
      const x = Math.cos(a) * d, z = Math.sin(a) * d, y = Y + H * Math.sqrt(1 - (d / R) ** 2);
      return squash(at(ball(r, '#fffaf0'), x, y, z), 1, .4, 1);
    };
    return group(at(cyl(.13, .18, .42, '#fff4e0', 20), 0, .21, 0), squash(at(ball(R, '#e8617f'), 0, Y, 0), 1, H / R, 1),
      spot(0, 0, .07), ...[0, 1, 2, 3, 4].map(k => spot(k * 1.26 + .3, .22, .055)), ...[0, 1, 2].map(k => spot(k * 2.1 + 1, .3, .04)));
  },
  // Kệ cây cảnh (thay tủ quần áo): kệ gỗ 4 tầng bày chậu cây, sách, giỏ; dây trường xuân rủ xuống; mèo nằm trên nóc.
  'closet-ladder'() {
    const wood = '#d9a36a', parts = [...[-1, 1].map(s => at(box(.05, 1.76, .5, wood), s * .63, .88, 0))];
    [.08, .52, .96, 1.4].forEach(y => parts.push(at(rbox(1.3, .04, .48, .02, wood), 0, y, 0)));
    parts.push(at(rbox(1.36, .05, .52, .025, '#c98a55'), 0, 1.785, 0));
    const pot = (x, y, color, leaf) => [at(cyl(.09, .07, .14, color, 16), x, y + .07, 0), at(ball(.11, leaf), x, y + .2, 0)];
    parts.push(...pot(-.4, .1, '#e98b5a', '#7fc45a'), ...pot(.35, .54, '#8fc9f2', '#5fae46'), ...pot(-.15, .98, '#fff4e0', '#4f9a3a'),
      at(rbox(.36, .22, .3, .04, '#e6c79a'), .3, .21, 0), ...[0, 1, 2].map(i => at(box(.07, .3, .3, ['#ec5b8c', '#3b8fe0', '#ffd23f'][i]), -.45 + i * .08, .69, 0)),
      at(rbox(.26, .2, .04, .02, '#ffd9c4'), .35, 1.1, -.18), at(cyl(.07, .06, .1, '#b79cf0', 14), .3, 1.47, 0), at(ball(.08, '#7fc45a'), .3, 1.57, 0));
    for (let k = 0; k < 6; k++) parts.push(at(ball(.035, k % 2 ? '#5fae46' : '#7fc45a'), -.08 + k * .01, .93 - k * .09, .27 + (k % 2) * .02)); // dây trường xuân rủ từ chậu tầng 3
    const shelf = group(...parts);
    shelf.userData.seat = [.25, 1.81, .02];
    return shelf;
  },
  // Thỏ bông (thay gấu bông): tai dài, ôm củ cà rốt; mèo rúc ngủ bên cạnh.
  'plushie-bunny'() {
    const fur = '#fff4f6', pink = '#ffb3c4', dark = '#4a2e20';
    const bunny = group(squash(at(ball(.36, fur), 0, .36, 0), 1, 1.05, .92), squash(at(ball(.22, '#ffe6ec'), 0, .34, .25), 1, 1.1, .45),
      at(ball(.26, fur), 0, .86, .03), squash(at(ball(.1, '#ffffff'), 0, .8, .24), 1.2, .8, 1),
      at(ball(.03, dark), -.1, .92, .25), at(ball(.03, dark), .1, .92, .25), squash(at(ball(.035, pink), 0, .84, .3), 1.2, .8, 1),
      ...[-1, 1].flatMap(s => [squash(at(ball(.09, fur), s * .12, 1.27, -.02), .55, 2.2, .5), squash(at(ball(.06, pink), s * .12, 1.27, .015), .45, 1.9, .3),
        squash(at(ball(.13, fur), s * .32, .45, .14), .8, 1.25, .8), squash(at(ball(.15, fur), s * .19, .12, .3), 1, .8, 1.4), at(ball(.06, pink), s * .19, .12, .48)]),
      at(mesh(new THREE.ConeGeometry(.06, .26, 12), '#ff9f43'), 0, .46, .36).rotateX(Math.PI * .9), at(ball(.05, '#7fc45a'), 0, .6, .38));
    bunny.children.forEach(part => { part.position.y += .02; }); // thân tròn ngồi chạm sàn, không lún
    bunny.userData.seat = [.38, 0, .38];
    return bunny;
  },
  // Bậc mây (thay bậc leo): ba đám mây gắn tường làm bậc, đệm mặt trăng trên cùng; tấm cào móng dưới chân.
  'catsteps-clouds'() {
    const cloud = (x, y) => group(...[[-.14, 0, .13], [.14, 0, .13], [0, .03, .17]].map(([dx, dy, r]) => squash(at(ball(r, '#eaf4ff'), x + dx, y + dy, 0), 1, .45, .95)),
      at(box(.36, .14, .1, '#9fd0f0'), x, y - .06, -.22)); // tấm gắn tường (mặt sau cách tường 1 cm)
    const steps = [[-.35, .64], [.35, 1.19], [-.2, 1.77]];
    const node = group(...steps.map(([x, y]) => cloud(x, y)), squash(at(ball(.14, '#ffd66b'), -.2, 1.86, 0), 1.3, .4, 1),
      at(rbox(.7, .02, .5, .008, '#b9854a'), 0, .01, .15));
    node.userData.steps = steps.map(([x, y]) => [x, y + .08, 0]);
    return node;
  },

  // ===== Lựa chọn thứ 4 cho từng chỗ trong phòng ngủ: phong cách hiện đại, tông đen / xám (cùng điểm neo với món gốc) =====
  // Giường bọc nỉ xám đậm: đầu giường ô nệm cao, chăn than chì; mèo nằm trên chăn như giường gốc.
  'bed-platform'() {
    const z = -1.22;
    const bed = group(...bedBase({ wood: '#2b2e33', duvet: '#4a4e55', duvetLine: '#3a3d43', pillow: '#c9ccd1', headboard: false }),
      at(rbox(2.2, 1.1, .16, .07, '#3a3d43'), 0, .74, z), ...[-.72, -.24, .24, .72].map(x => at(rbox(.44, .8, .04, .02, '#45494f'), x, .8, z + .1)),
      at(box(2.24, .02, .02, mat('#c8ccd2', { metalness: .8, roughness: .35 })), 0, 1.3, z + .08),
      at(rbox(1.96, .06, .5, .03, '#6b7078'), 0, .64, .95)); // khăn phủ cuối giường
    bed.userData.seat = [.15, .63, .15];
    return bed;
  },
  // Thảm sọc đen trắng: phẳng, nằm gọn trong khung thảm lông.
  'bedrug-mono'() {
    const rug = group(at(rbox(2.4, .035, 1.9, .015, '#2b2e33'), 0, .0175, 0),
      ...[-.6, -.3, 0, .3, .6].map(z => at(box(2.1, .045, .12, '#d6d8dc'), 0, .0225, z)));
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .045;
    return rug;
  },
  // Giỏ đồ giặt nỉ xám có quai da: quần áo xám / đen bên trong; mèo chui vào nằm (.5).
  'laundry-hamper'() {
    const felt = '#4a4e55', leather = '#26282c';
    const hamper = group(at(cyl(.36, .32, .5, felt, 28), 0, .25, 0), at(mesh(new THREE.TorusGeometry(.36, .025, 8, 36), mat(leather)), 0, .5, 0).rotateX(Math.PI / 2),
      ...[-1, 1].map(s => at(rbox(.16, .05, .03, .015, leather), s * .3, .44, s * .16).rotateY(s * .5 + Math.PI / 2)),
      squash(at(ball(.3, '#6b7078'), 0, .44, 0), 1, .35, 1), squash(at(ball(.16, '#26282c'), -.1, .52, .08), 1.2, .4, 1), squash(at(ball(.14, '#d6d8dc'), .12, .53, -.06), 1, .45, 1.2),
      at(rbox(.11, .3, .07, .035, '#d6d8dc'), .33, .4, .12).rotateZ(.3));
    hamper.userData.seat = [0, .5, 0];
    return hamper;
  },
  // Tủ đầu giường đen chân crôm: loa thông minh + đồng hồ xám (mèo đẩy rơi).
  'bedside-noir'() {
    const chrome = mat('#c8ccd2', { metalness: .8, roughness: .35 });
    const clock = group(at(rbox(.18, .1, .08, .03, '#45494f'), 0, 0, 0), at(box(.12, .05, .01, glow('#1a1c20', '#7fd0ff', .9)), 0, 0, .046));
    clock.position.set(.15, .63, .06);
    const speaker = at(cyl(.07, .07, .16, '#6b7078', 20), -.16, .66, -.06);
    const stand = group(...legs4(.22, .15, .12, chrome, .015), at(rbox(.56, .42, .42, .04, '#26282c'), 0, .33, 0), at(rbox(.6, .03, .46, .015, '#3a3d43'), 0, .555, 0),
      at(box(.5, .006, .02, chrome), 0, .33, .215), speaker, at(cyl(.05, .05, .01, '#9aa0a8', 20), -.16, .745, -.06), clock);
    stand.userData.mug = clock;
    clock.userData.home = clock.position.clone();
    stand.userData.top = .58;
    return stand;
  },
  // Bàn setup tối: mặt bàn đen, hai màn hình, dải LED trắng lạnh; mèo nằm chễm chệ trên bàn phím (.77).
  'desk-setup'() {
    const top = '#26282c', dark = '#1a1c20', frame = '#3a3d43';
    const monitor = x => group(at(rbox(.22, .02, .16, .01, dark), 0, .775, -.16), at(box(.04, .26, .04, dark), 0, .9, -.2),
      at(rbox(.62, .4, .04, .02, dark), 0, 1.15, -.2), at(screen(.56, .34, docScreen()), 0, 1.15, -.174)).translateX(x);
    const keys = screen(.5, .15, rgbKeys()); keys.rotation.x = -Math.PI / 2; keys.position.set(0, .801, .12);
    const desk = group(at(rbox(1.7, .05, .72, .02, top), 0, .74, 0),
      ...[-1, 1].map(s => at(rbox(.06, .72, .62, .02, frame), s * .78, .36, 0)), at(box(1.5, .08, .03, frame), 0, .66, -.3),
      at(box(1.6, .015, .015, glow('#d6eaff', '#d6eaff', 1.2)), 0, .71, .35),
      monitor(-.34), monitor(.34), at(rbox(.56, .03, .18, .01, dark), 0, .78, .12), keys,
      at(rbox(.3, .006, .24, .003, '#45494f'), .55, .768, .1), squash(at(ball(.04, dark), .55, .785, .12), 1, .55, 1.4),
      at(cyl(.045, .04, .1, '#9aa0a8', 14), -.6, .815, .18));
    desk.userData.seat = [0, .77, .12];
    desk.userData.top = .77;
    return desk;
  },
  // Ghế văn phòng lưng lưới đen: xoay khi mèo đáp lên, mặt ngồi .55 như ghế gốc.
  'chair-office'() {
    const dark = '#1f2125', chrome = '#9aa0a8';
    const spokes = [0, 1, 2, 3, 4].flatMap(k => {
      const a = k / 5 * TAU, spoke = at(box(.34, .035, .05, chrome), Math.cos(a) * .17, .1, Math.sin(a) * .17);
      spoke.rotation.y = -a;
      return [spoke, at(ball(.035, dark), Math.cos(a) * .32, .035, Math.sin(a) * .32)];
    });
    const back = group(at(rbox(.52, .78, .06, .03, dark), 0, 0, 0), at(rbox(.42, .64, .02, .01, '#45494f'), 0, 0, .04), at(rbox(.34, .1, .08, .04, '#3a3d43'), 0, -.2, .06));
    back.position.set(0, .58, -.27); back.rotation.x = -.1;
    const arm = s => group(at(box(.035, .2, .035, dark), s * .3, .2, -.02), at(rbox(.07, .035, .28, .015, dark), s * .3, .31, 0));
    const seat = group(at(rbox(.54, .1, .54, .05, dark), 0, .06, 0), at(rbox(.44, .04, .46, .02, '#45494f'), 0, .12, .02), back, arm(1), arm(-1));
    seat.position.y = .4;
    const chair = group(...spokes, at(cyl(.035, .035, .32, chrome, 12), 0, .26, 0), seat);
    let last = 0;
    seat.userData.v = 0;
    chair.userData.spin = v => { seat.userData.v += v; };
    chair.userData.update = t => {
      const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t;
      seat.userData.v += (-5 * seat.rotation.y - 1.1 * seat.userData.v) * dt;
      seat.rotation.y += seat.userData.v * dt;
    };
    seat.userData.restPos = seat.position.clone();
    chair.userData.ride = seat;
    chair.userData.seat = [0, .55, .02];
    return chair;
  },
  // Tủ áo đen mờ tay nắm crôm: nóc cao 2.06 như tủ gốc, mèo nằm canh phòng.
  'closet-noir'() {
    const body = '#26282c', door = '#2f3236', chrome = mat('#c8ccd2', { metalness: .8, roughness: .35 });
    const closet = group(at(rbox(1.36, .1, .58, .03, '#1a1c20'), 0, .05, 0),
      at(rbox(1.3, 1.92, .6, .06, body), 0, 1.06, 0), at(rbox(1.4, .06, .66, .03, '#3a3d43'), 0, 2.03, 0),
      ...[-1, 1].flatMap(s => [at(rbox(.6, 1.78, .03, .015, door), s * .32, 1.06, .3), at(rbox(.025, .5, .03, .012, chrome), s * .06, 1.1, .335)]),
      at(rbox(.36, .26, .3, .04, '#6b7078'), -.36, 2.19, 0), at(rbox(.26, .16, .26, .03, '#9aa0a8'), -.36, 2.4, .02));
    closet.userData.seat = [.25, 2.06, .02];
    return closet;
  },
  // Cá mập bông xám: nằm sấp, vây lưng, bụng trắng; mèo rúc ngủ bên cạnh.
  'plushie-shark'() {
    const grey = '#6b7078', belly = '#e6e8eb';
    const shark = group(squash(at(ball(.3, grey), 0, .24, 0), 1.6, .8, 1), squash(at(ball(.24, belly), 0, .18, .04), 1.5, .5, .9),
      at(mesh(new THREE.ConeGeometry(.12, .24, 16), grey), -.04, .5, 0).rotateZ(.25), at(mesh(new THREE.ConeGeometry(.13, .26, 16), grey), -.44, .3, 0).rotateZ(Math.PI / 2.4),
      ...[-1, 1].map(s => squash(at(ball(.1, grey), .1, .12, s * .26), 1.4, .4, 1)),
      ...[-1, 1].map(s => at(ball(.03, '#1a1c20'), .4, .3, s * .17)), at(box(.16, .012, .02, '#1a1c20'), .44, .19, 0));
    shark.children.forEach(part => { part.position.y += .02; });
    shark.userData.seat = [.38, 0, .38];
    return shark;
  },
  // Kệ treo tường thép đen: ba bậc nỉ xám gắn giá sắt, đệm trên cùng; tấm cào móng xám dưới chân.
  'catsteps-floating'() {
    const steel = '#1f2125', felt = '#6b7078';
    const step = (x, y) => group(at(rbox(.56, .05, .32, .02, felt), x, y, 0), at(box(.52, .03, .03, steel), x, y - .04, .14),
      ...[-.2, .2].map(dx => at(box(.03, .18, .03, steel), x + dx, y - .12, -.13)));
    const steps = [[-.35, .65], [.35, 1.2], [-.2, 1.75]];
    const node = group(...steps.map(([x, y]) => step(x, y)), at(rbox(.5, .06, .28, .03, '#3a3d43'), -.2, 1.8, 0),
      at(rbox(.7, .02, .5, .008, '#45494f'), 0, .01, .15));
    node.userData.steps = [[-.35, .68, 0], [.35, 1.23, 0], [-.2, 1.84, 0]];
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
    // Rèm xanh hai bên cửa sổ + thanh treo.
    const u0 = BEDROOM_WINDOW_X;
    const rod = at(cyl(.025, .025, 2.3, onWall('#c98a55'), 12), u0, 2.66, .22); rod.rotation.z = Math.PI / 2;
    wall.add(rod, at(ball(.05, onWall('#c98a55')), u0 - 1.15, 2.66, .22), at(ball(.05, onWall('#c98a55')), u0 + 1.15, 2.66, .22));
    for (const s of [-1, 1]) {
      const panel = drape(.5, 1.95, '#9fd0f0', true); panel.position.set(u0 + s * .88, 1.66, .2);
      wall.add(panel, at(mesh(new THREE.BoxGeometry(.52, .06, .09), onWall('#3b8fe0')), u0 + s * .88, 1.15, .26));
    }
    // Đèn dây võng trên đầu giường: bóng nhỏ phát sáng vàng ấm.
    const pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(-3.6 + t * 2.6, 2.82 - Math.sin(t * Math.PI) * .2, .2)); } // cao hơn khung giường màn (2.2)
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
