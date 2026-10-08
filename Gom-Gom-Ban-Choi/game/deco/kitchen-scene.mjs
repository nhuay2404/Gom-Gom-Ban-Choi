// Bếp (mở khi thắng màn 40, nằm bên phải phòng khách): bộ đồ cho Deco — tủ lạnh, bếp nấu, bồn rửa dưới cửa sổ, tủ chén,
// bàn ăn, ghế, khay ăn của mèo, xe đẩy — mỗi chỗ có 3 lựa chọn (món gốc + 2 phương án) + đồ trang trí cố định (rèm cửa sổ,
// giá treo dụng cụ, bảng thực đơn, thảm chùi chân, thùng rác). Cùng kiểu dựng với bedroom-scene.mjs: khối bo tròn, màu pastel,
// viền toon. Mỗi món có chỗ đặt cố định [x, z, xoay?] (room-layout.mjs PLACES); +z của món hướng vào giữa phòng.
// Điểm neo cho mèo ghi trong userData (toạ độ cục bộ của món): seat = chỗ ngồi / nằm, top = mặt trên, mug = vật mèo đẩy rơi,
// bowls = các chén ăn / uống.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { ROOM_HALF, KITCHEN_DOOR, KITCHEN_WINDOW_X } from './room-layout.mjs';
import { TOON, toonMat } from './toon.mjs';

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
const ring = (r, tube, color) => mesh(new THREE.TorusGeometry(r, tube, 8, Math.max(16, radialSegments(r) + 6)), color);
const cone = (r, h, color, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const glow = (color, emissive, intensity = 1) => mat(color, { emissive, emissiveIntensity: intensity });
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
const legs4 = (x, z, h, color, r = .035) => [[-x, -z], [x, -z], [-x, z], [x, z]].map(([lx, lz]) => at(cyl(r, r * .8, h, color, 10), lx, h / 2, lz));
const chrome = () => mat('#c8ccd2', { metalness: .8, roughness: .35 });
const steel = () => mat('#c8ccd2', { metalness: .8, roughness: .4 });
const glass = (color = '#bfe3ff', opacity = .55) => mat(color, { transparent: true, opacity });

// Khăn trải bàn ca-rô đỏ (vẽ canvas một lần, dùng chung).
const canvasCache = {};
function gingham() {
  if (canvasCache.gingham) return canvasCache.gingham;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(232,97,127,.55)';
  for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 16, 128); g.fillRect(0, i, 128, 16); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return (canvasCache.gingham = texture);
}

// Cốc / chén nhỏ mèo hay đẩy rơi: nằm sẵn trên mặt bàn / xe đẩy, nhớ chỗ cũ để hồi lại (room-cats.mjs knockOff / restoreToys).
function cup(color, x, y, z) {
  const c = group(at(cyl(.045, .04, .09, color, 14), 0, .045, 0), at(ring(.03, .008, color), .062, .05, 0));
  c.position.set(x, y, z);
  c.userData.home = c.position.clone();
  return c;
}

// ---------- Tủ lạnh: mèo nhảy lên nóc ngồi (seat = mặt nóc) ----------
const fridgeFeet = color => [[-.34, -.28], [.34, -.28], [-.34, .28], [.34, .28]].map(([x, z]) => at(cyl(.04, .035, .08, color, 10), x, .04, z));

// ---------- Bếp nấu: mèo nhảy lên mặt bếp ấm ngồi ngủ gật (seat = mặt bếp, chừa chỗ trống trước bếp) ----------
const burners = (color, y) => [[-.22, -.12], [.22, -.12], [-.22, .16], [.22, .16]].map(([x, z]) => at(ring(.1, .014, color), x, y, z).rotateX(Math.PI / 2));
function kettle(body, x, y, z) {
  const k = group(at(cyl(.1, .12, .12, body), 0, .06, 0), squash(at(ball(.1, body), 0, .13, 0), 1, .8, 1), at(ball(.025, '#fffaf0'), 0, .22, 0),
    at(cyl(.015, .02, .12, body, 8), .12, .15, 0).rotateZ(-.9), at(ring(.07, .01, '#3a3f4a'), 0, .16, 0));
  k.position.set(x, y, z);
  return k;
}

// ---------- Bồn rửa: dưới cửa sổ tường sau, vòi nước nhỏ giọt (seat = mặt quầy bên phải bồn) ----------
const tapBase = (chr, x, z) => group(at(cyl(.035, .04, .05, chr, 12), 0, .025, 0), at(cyl(.016, .016, .28, chr, 8), 0, .19, 0),
  at(cyl(.014, .014, .2, chr, 8), 0, .33, .1).rotateX(Math.PI / 2), at(cyl(.03, .03, .03, '#e8617f', 10), .05, .06, 0)).translateX(x).translateZ(z);

// ---------- Quầy chữ L (sink): dãy sau dọc tường sau từ x = -.78 (bồn rửa ở x ≈ 0) tới tường phải (x = L_END), dãy phải quặt về
// phía +z dọc tường phải tới z = LEG_Z. Gốc toạ độ model = tâm bồn rửa; mặt trước dãy sau hướng +z, dãy phải hướng -x.
// Mèo đi vòng quanh quầy nhờ OBSTACLE_EXTRA.sink (room-layout.mjs) khớp với hình chữ L này.
const L_END = 3.44, LEG_Z = 2.72;
function counterL({ body, top, kick, door, knob, doors = [[-.36, .66], [.36, .66], [1.0, .62], [1.65, .62], [2.3, .62]], backsplash = false }) {
  const x0 = -.78, w = L_END - x0, cx = (x0 + L_END) / 2, legMid = (.3 + LEG_Z - .02) / 2, legLen = LEG_Z - .02 - .3;
  const parts = [at(box(w - .06, .06, .56, kick), cx, .03, -.01), at(rbox(w - .1, .8, .64, .04, body), cx, .46, 0), at(rbox(w, .05, .7, .02, top), cx, .875, 0),
    at(box(.56, .06, legLen, kick), L_END - .35, .03, legMid), at(rbox(.64, .8, legLen, .04, body), L_END - .35, .46, legMid), at(rbox(.7, .05, LEG_Z - .35, .02, top), L_END - .35, .875, (.35 + LEG_Z) / 2)];
  for (const [x, dw] of doors) parts.push(at(rbox(dw, .64, .03, .015, door), x, .46, .335), at(ball(.025, knob), x - Math.sign(x || 1) * .27, .62, .36));
  for (const z of [.85, 1.5, 2.15]) parts.push(at(rbox(.03, .64, .62, .015, door), L_END - .685, .46, z), at(ball(.025, knob), L_END - .72, .62, z - .27));
  if (backsplash) parts.push(at(rbox(w, .14, .04, .015, top), cx, .97, -.33));
  return parts;
}

// ---------- Tủ chén / kệ đồ khô: mèo nhảy lên nóc ----------
const jar = (color, lid, x, y, z = 0, r = .06, h = .2) => [at(cyl(r, r, h, glass(color, .5)), x, y + h / 2, z), at(cyl(r + .008, r + .008, .03, lid), x, y + h + .015, z)];

// Biển hiệu "KITCHEN" vẽ canvas (chữ + dao nĩa nhỏ).
function signTexture() {
  if (canvasCache.sign) return canvasCache.sign;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 70;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f3d5a8'; g.fillRect(0, 0, 256, 70);
  g.fillStyle = '#7a4a2a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('KITCHEN', 128, 36);
  g.fillStyle = '#e8617f'; g.beginPath(); g.arc(24, 35, 9, 0, TAU); g.arc(232, 35, 9, 0, TAU); g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return (canvasCache.sign = texture);
}
// Ghế gỗ: chân, mặt ngồi có đệm, lưng tựa hai thanh. Mặt trước +z.
const woodChair = (frame, cushion) => group(...legs4(.17, .17, .44, frame, .022), at(rbox(.42, .05, .42, .02, frame), 0, .465, 0), at(rbox(.36, .03, .36, .014, cushion), 0, .505, .01),
  ...[-.18, .18].map(x => at(cyl(.02, .02, .46, frame, 8), x, .7, -.19)), ...[.62, .78].map(y => at(box(.32, .07, .025, frame), 0, y, -.19)));
// Bốn món (ghế) quanh tâm bàn ăn, quay mặt vào bàn (khoảng cách chừa chỗ cho gối ngồi của bàn trà thấp).
const around = make => group(...[[-1.35, 0], [1.35, 0], [0, -1.3], [0, 1.3]].map(([x, z]) => {
  const node = make();
  node.position.set(x, 0, z); node.rotation.y = Math.atan2(-x, -z);
  return node;
}));

// ---------- Xe đẩy: khung + hai tầng khay; trên mặt có đồ mèo đẩy rơi ----------
function cartFrame(tray, post) {
  return [...[[-.36, -.2], [.36, -.2], [-.36, .2], [.36, .2]].map(([x, z]) => at(cyl(.018, .018, .78, post, 8), x, .4, z)),
    at(rbox(.8, .03, .48, .012, tray), 0, .215, 0), at(rbox(.8, .03, .48, .012, tray), 0, .78, 0),
    ...[[-.36, -.2], [.36, -.2], [-.36, .2], [.36, .2]].map(([x, z]) => at(ball(.035, '#3a3f4a'), x, .035, z)),
    ...[-1, 1].map(s => at(cyl(.016, .016, .2, post, 8), s * .36, .89, -.2)), at(cyl(.016, .016, .72, post, 8), 0, .98, -.2).rotateZ(Math.PI / 2)];
}
function finishCart(node, mug) {
  node.userData.mug = mug;
  node.userData.top = .795;
  return node;
}

// Chén ăn: thân gốm + đồ ăn / nước nhô lên trên miệng chén.
const bowl = (color, x, z, y = .02) => group(at(cyl(.15, .1, .09, color), 0, .045, 0), at(ring(.15, .012, color), 0, .09, 0).rotateX(Math.PI / 2)).translateX(x).translateZ(z).translateY(y);

export const KITCHEN_BUILD = {
  // ===== Tủ lạnh =====
  fridge() {
    const body = '#bfe8d6', door = '#cdeee0', handle = '#fffaf0';
    const f = group(...fridgeFeet('#8fa89c'),
      at(rbox(.88, 1.72, .74, .06, body), 0, .94, 0),
      at(rbox(.82, .6, .03, .015, door), 0, 1.46, .385), at(rbox(.82, .98, .03, .015, door), 0, .63, .385),
      at(rbox(.04, .34, .05, .02, handle), -.32, 1.4, .425), at(rbox(.04, .5, .05, .02, handle), -.32, .86, .425),
      at(rbox(.12, .15, .012, .005, '#fffaf0'), .16, 1.0, .406), at(ball(.03, '#e8617f'), .08, 1.45, .41), at(ball(.03, '#ffd66b'), .24, 1.35, .41));
    f.userData.seat = [0, 1.83, 0];
    return f;
  },
  'fridge-retro'() {
    const body = '#ffc9d5', door = '#ffd9e2', chr = chrome();
    const f = group(...fridgeFeet('#e0a0b0'),
      at(rbox(.86, 1.66, .72, .16, body), 0, .92, 0),
      at(rbox(.78, .5, .04, .02, door), 0, 1.4, .375), at(rbox(.78, 1.04, .04, .02, door), 0, .64, .375),
      at(rbox(.035, .26, .05, .016, chr), -.3, 1.4, .42), at(rbox(.035, .6, .05, .016, chr), -.3, .85, .42),
      at(rbox(.16, .05, .012, .005, chr), .1, 1.57, .401), at(ball(.03, '#e8617f'), .3, 1.1, .4), at(ball(.03, '#7fc45a'), .22, .98, .4));
    f.userData.seat = [0, 1.78, 0];
    return f;
  },
  'fridge-steel'() {
    const dark = '#2b2e33';
    const f = group(...fridgeFeet('#6b7078'),
      at(rbox(.9, 1.74, .74, .04, steel()), 0, .95, 0),
      at(rbox(.43, 1.06, .03, .015, steel()), -.222, 1.27, .385), at(rbox(.43, 1.06, .03, .015, steel()), .222, 1.27, .385),
      at(rbox(.88, .52, .03, .015, steel()), 0, .47, .385),
      at(rbox(.025, .5, .04, .012, dark), -.04, 1.3, .42), at(rbox(.025, .5, .04, .012, dark), .04, 1.3, .42), at(rbox(.5, .03, .04, .012, dark), 0, .64, .42),
      at(rbox(.2, .09, .02, .01, '#1a1c20'), .222, 1.0, .41), at(box(.15, .04, .01, glow('#1a2a3a', '#7fd0ff', .9)), .222, 1.0, .422));
    f.userData.seat = [0, 1.85, 0];
    return f;
  },

  // ===== Bếp nấu =====
  stove() {
    const body = '#fff4e0', dark = '#3a3f4a', chr = chrome();
    const pot = group(at(cyl(.15, .14, .16, '#e8617f'), 0, .08, 0), at(cyl(.155, .155, .02, '#d9485f'), 0, .17, 0), at(ball(.03, '#fffaf0'), 0, .2, 0),
      ...[-1, 1].map(s => at(rbox(.07, .03, .04, .012, dark), s * .17, .12, 0)));
    pot.position.set(-.22, .92, -.12);
    const stove = group(at(rbox(.84, .08, .62, .02, '#c8c2b8'), 0, .04, 0), at(rbox(.9, .78, .7, .04, body), 0, .47, 0), at(rbox(.92, .05, .72, .02, '#e3ddd1'), 0, .895, 0),
      ...burners(dark, .935), pot, kettle('#8fc9f2', .22, .92, -.12),
      at(rbox(.74, .5, .03, .015, dark), 0, .45, .365), at(box(.52, .28, .012, '#9fb7c9'), 0, .47, .39), at(rbox(.62, .03, .04, .015, chr), 0, .64, .395),
      ...[-.3, -.1, .1, .3].map(x => at(cyl(.03, .03, .03, '#fffaf0', 14), x, .8, .365).rotateX(Math.PI / 2)));
    stove.userData.seat = [0, .96, .2];
    return stove;
  },
  'stove-wood'() {
    const iron = '#2f3238', chr = chrome();
    const k = group(at(cyl(.09, .12, .12, '#d98a55'), 0, .06, 0), squash(at(ball(.09, '#d98a55'), 0, .13, 0), 1, .8, 1), at(cyl(.014, .02, .12, '#d98a55', 8), .11, .14, 0).rotateZ(-.9));
    k.position.set(-.22, .91, -.05);
    const stove = group(...legs4(.34, .24, .15, '#1f2125', .03),
      at(rbox(.8, .72, .58, .05, iron), 0, .51, 0), at(rbox(.86, .04, .64, .02, '#3a3d43'), 0, .89, 0),
      at(cyl(.08, .08, .04, '#26282c'), 0, .93, -.18), at(cyl(.06, .06, .62, '#26282c'), 0, 1.22, -.18), at(cyl(.075, .075, .03, '#26282c'), 0, 1.545, -.18),
      at(rbox(.5, .4, .04, .02, '#1f2125'), 0, .52, .31), at(box(.34, .24, .014, glow('#4a2010', '#ff8a3d', 1.1)), 0, .52, .345),
      at(rbox(.03, .14, .03, .012, chr), .2, .5, .355), at(box(.46, .03, .03, '#3a3d43'), 0, .74, .3), k);
    stove.userData.seat = [.15, .93, .12];
    return stove;
  },
  'stove-red'() {
    const red = '#e8483a', dark = '#26282c', chr = chrome();
    const pan = group(at(cyl(.17, .15, .05, dark), 0, .025, 0), at(rbox(.22, .03, .04, .012, dark), .27, .03, 0));
    pan.position.set(-.22, .93, .16);
    const stove = group(at(rbox(.84, .08, .62, .02, '#9a2e24'), 0, .04, 0), at(rbox(.9, .8, .7, .1, red), 0, .48, 0), at(rbox(.94, .05, .74, .02, chr), 0, .905, 0),
      at(rbox(.94, .2, .06, .03, red), 0, 1.05, -.32), at(cyl(.06, .06, .03, '#fffaf0', 20), 0, 1.05, -.27).rotateX(Math.PI / 2),
      at(box(.006, .045, .008, dark), 0, 1.07, -.255), at(box(.035, .006, .008, dark), .012, 1.05, -.255),
      ...burners(dark, .945), pan, kettle('#ffd66b', .22, .93, -.12),
      at(rbox(.74, .46, .03, .015, dark), 0, .45, .365), at(box(.5, .26, .012, '#6a7078'), 0, .46, .39), at(rbox(.66, .03, .04, .015, chr), 0, .66, .395),
      ...[-.3, -.1, .1, .3].map(x => at(cyl(.03, .03, .03, chr, 14), x, .78, .365).rotateX(Math.PI / 2)));
    stove.userData.seat = [.22, .96, .2];
    return stove;
  },

  // ===== Quầy bếp chữ L: bồn rửa dưới cửa sổ + dãy quầy chạy dọc tường sau tới góc rồi quặt xuống dọc tường phải =====
  sink() {
    const sink = group(...counterL({ body: '#fff4e0', top: '#d9d2c4', kick: '#c8c2b8', door: '#fff9ec', knob: '#e8617f' }),
      at(rbox(.56, .03, .4, .015, '#9fb0bf'), -.25, .915, .03), at(rbox(.46, .012, .3, .006, '#6f8190'), -.25, .934, .03),
      tapBase(chrome(), -.25, -.22).translateY(.9),
      at(cyl(.03, .03, .14, '#7fc45a'), -.68, .97, -.18), at(rbox(.08, .03, .05, .012, '#ffd66b'), -.66, .915, .1),
      at(cyl(.06, .05, .1, '#e98b5a'), .65, .95, -.22), at(ball(.065, '#6fbf4a'), .65, 1.04, -.22),
      at(rbox(.3, .17, .2, .04, '#e8617f'), 1.2, .985, -.15), at(box(.2, .012, .012, '#c8ccd2'), 1.2, 1.075, -.15),
      ...[1.75, 2.0, 2.25].map((x, k) => at(cyl(.08, .08, .2 - k * .03, ['#ffd66b', '#bfe3a0', '#f3c2cc'][k], 16), x, .9 + (.2 - k * .03) / 2, -.22)),
      group(at(cyl(.15, .09, .07, '#fffaf0'), 0, .035, 0), at(ball(.055, '#ff6b4a'), -.04, .1, 0), at(ball(.055, '#ffd23f'), .05, .1, .03)).translateX(3.1).translateY(.9).translateZ(1.0),
      at(cyl(.045, .04, .09, '#8fc9f2', 12), 3.0, .945, 1.9), at(rbox(.3, .02, .2, .01, '#c98a55'), 3.1, .91, 1.5));
    sink.userData.seat = [.4, .92, .08];
    sink.userData.tap = [-.25, 1.2, -.12];
    return sink;
  },
  'sink-farm'() {
    const chr = chrome();
    const neck = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0, 0], [0, .3, 0], [0, .42, .06], [0, .38, .15], [0, .3, .17]].map(p => new THREE.Vector3(...p))), 16, .013, 6), chr);
    neck.position.set(-.25, .9, -.2);
    const pot = (x, z) => [at(cyl(.045, .04, .08, '#e98b5a', 12), x, .94, z), at(ball(.05, '#6fbf4a'), x, .995, z)];
    const sink = group(...counterL({ body: '#d9a36a', top: '#c98a55', kick: '#9a6a45', door: '#e9c58f', knob: '#c98a55', doors: [[.48, .5], [1.05, .62], [1.7, .62], [2.35, .62]] }),
      at(rbox(.64, .34, .1, .045, '#ffffff'), -.25, .7, .34),
      at(rbox(.58, .02, .4, .01, '#ffffff'), -.25, .91, .03), at(rbox(.48, .01, .3, .005, '#e6ecf2'), -.25, .926, .03),
      neck, at(cyl(.03, .035, .04, chr, 12), -.25, .92, -.2),
      at(rbox(.22, .3, .012, .005, '#e8617f'), .48, .5, .358), at(box(.22, .04, .014, '#fffaf0'), .48, .46, .36),
      ...pot(.55, -.2), ...pot(.65, -.2),
      at(rbox(.42, .22, .3, .05, '#c98a55'), 1.35, 1.01, -.15), at(box(.3, .02, .02, '#fffaf0'), 1.35, 1.0, .01),
      at(cyl(.09, .08, .18, '#e9c58f', 16), 2.05, 1.0, -.2), ...[-1, 0, 1].map(k => at(cyl(.008, .008, .18, '#9a6a45', 6), 2.05 + k * .03, 1.15, -.2)),
      at(rbox(.5, .03, .32, .012, '#e9c58f'), 3.1, .915, .9), at(ball(.05, '#ff6b4a'), 3.15, .98, .9), at(ball(.05, '#7fc45a'), 3.0, .98, .95),
      ...pot(3.1, 1.7), ...pot(3.1, 2.0));
    sink.userData.seat = [.3, .92, .1];
    sink.userData.tap = [-.25, 1.25, -.1];
    return sink;
  },
  'sink-steel'() {
    const dark = '#6f7680', chr = chrome();
    const neck = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0, 0], [0, .32, 0], [0, .42, .05], [.0, .4, .14]].map(p => new THREE.Vector3(...p))), 14, .014, 6), chr);
    neck.position.set(-.33, .9, -.22);
    const sink = group(...counterL({ body: steel(), top: steel(), kick: '#6b7078', door: steel(), knob: '#3a3f4a', backsplash: true }),
      ...[-.52, -.14].flatMap(x => [at(rbox(.34, .03, .4, .012, '#8a95a3'), x, .915, .03), at(rbox(.26, .012, .3, .006, dark), x, .934, .03)]),
      neck, at(cyl(.03, .035, .04, chr, 12), -.33, .92, -.22),
      at(rbox(.44, .03, .32, .012, '#9aa0a8'), .52, .915, .02),
      ...[.38, .46, .54, .62].map(x => at(cyl(.1, .1, .012, '#fffaf0', 20), x, 1.03, 0).rotateX(Math.PI / 2)),
      at(cyl(.035, .03, .08, '#8fc9f2', 12), .66, .97, .12), at(cyl(.03, .03, .1, '#ffd66b', 12), .3, .98, .12),
      at(rbox(.3, .34, .3, .05, '#26282c'), 1.5, 1.07, -.15), at(rbox(.3, .02, .1, .008, '#3a3f4a'), 1.5, .91, .1), at(cyl(.045, .04, .08, '#fffaf0', 12), 1.5, .95, .1),
      at(rbox(.16, .26, .1, .04, '#3a3f4a'), 2.2, 1.03, -.2), at(rbox(.4, .04, .28, .015, '#9aa0a8'), 2.55, .915, -.1),
      at(rbox(.5, .03, .32, .012, '#9aa0a8'), 3.1, .915, 1.2), ...[0, 1, 2].map(k => at(cyl(.1, .1, .02, '#fffaf0', 20), 3.1, .94 + k * .02, 1.2)));
    sink.userData.seat = [.14, .92, .1];
    sink.userData.tap = [-.33, 1.28, -.15];
    return sink;
  },

  // ===== Tủ chén =====
  pantry() {
    const body = '#ffe9b0', door = '#ffe0a0', trim = '#fff4d0';
    const pantry = group(at(rbox(1.04, .06, .54, .02, '#e0b36a'), 0, .03, 0), at(rbox(1.0, 1.9, .5, .05, body), 0, .98, 0), at(rbox(1.06, .06, .54, .03, trim), 0, 1.97, 0),
      at(rbox(1.04, .04, .56, .018, '#e0b36a'), 0, 1.07, .0),
      ...[-1, 1].flatMap(s => [at(rbox(.46, .7, .03, .015, trim), s * .245, 1.5, .265), at(box(.34, .58, .012, glass()), s * .245, 1.5, .286),
        at(rbox(.46, .8, .03, .015, door), s * .245, .6, .265), at(ball(.025, '#e8617f'), s * .06, .62, .29)]),
      ...jar('#ffd66b', '#e8617f', -.38, 2.0), ...jar('#bfe3a0', '#fffaf0', -.2, 2.0, 0, .05, .16));
    pantry.userData.seat = [.25, 2.03, 0];
    return pantry;
  },
  'pantry-rack'() {
    const wood = '#d9a36a', post = '#8a6a45';
    const shelves = [.1, .55, 1.0, 1.45, 1.9].map(y => at(rbox(.96, .03, .44, .012, wood), 0, y, 0));
    const basket = (x, y, fruit) => [at(cyl(.15, .12, .14, '#e9c58f'), x, y + .07, 0), ...[[-.05, 0], [.06, .02], [0, -.06]].map(([dx, dz]) => at(ball(.06, fruit), x + dx, y + .17, dz))];
    const rack = group(...[[-.46, -.2], [.46, -.2], [-.46, .2], [.46, .2]].map(([x, z]) => at(cyl(.02, .02, 1.92, post, 8), x, .96, z)), ...shelves,
      ...basket(-.25, .115, '#ff6b4a'), ...basket(.28, .565, '#ffd23f'),
      ...jar('#ffd66b', '#e8617f', -.3, 1.015), ...jar('#bfe3a0', '#fffaf0', -.15, 1.015, .05, .05, .16), ...jar('#f3c2cc', '#7fc45a', -.02, 1.015, -.1),
      squash(at(ball(.2, '#fffaf0'), .3, 1.1, .05), 1, .6, .8), at(rbox(.3, .2, .22, .04, '#e6c79a'), -.25, 1.57, 0), at(rbox(.26, .16, .2, .04, '#8fc9f2'), .25, 1.55, 0),
      at(rbox(.34, .06, .12, .02, '#e8617f'), .0, .15, .1));
    rack.userData.seat = [0, 1.93, 0];
    return rack;
  },
  'pantry-hutch'() {
    const blue = '#8fc9f2', cream = '#fff4e0';
    const plate = (x, y) => group(at(cyl(.12, .12, .02, '#ffffff', 24), 0, 0, 0).rotateX(Math.PI / 2), at(cyl(.08, .08, .03, blue, 20), 0, 0, 0).rotateX(Math.PI / 2)).translateX(x).translateY(y).translateZ(-.06);
    const hutch = group(at(rbox(1.0, .9, .5, .04, blue), 0, .47, 0), at(rbox(1.06, .04, .54, .02, cream), 0, .94, 0),
      ...[-1, 1].flatMap(s => [at(rbox(.44, .7, .03, .015, '#a9d9f9'), s * .245, .5, .265), at(ball(.025, '#ffffff'), s * .06, .62, .29), at(rbox(.04, 1, .3, .015, blue), s * .48, 1.46, -.1)]),
      at(box(.92, 1, .03, '#6fb3e6'), 0, 1.46, -.2), at(rbox(.92, .03, .3, .012, cream), 0, 1.2, -.08), at(rbox(.92, .03, .3, .012, cream), 0, 1.6, -.08),
      at(rbox(1.04, .06, .36, .03, cream), 0, 1.98, -.08),
      plate(-.3, 1.34), plate(0, 1.34), plate(.3, 1.34),
      ...[-.3, 0, .3].map((x, k) => at(cyl(.035, .03, .08, k % 2 ? '#e8617f' : '#ffd66b', 12), x, 1.655, -.1)),
      ...[-.3, .3].map(x => at(cyl(.03, .03, .08, '#7fc45a', 12), x, 1.255, .0)));
    hutch.userData.seat = [.2, 2.01, -.05];
    return hutch;
  },

  // ===== Bàn ăn =====
  dining() {
    const cloth = mat('#ffffff', { map: gingham(), roughness: .95 });
    const mug = cup('#e8617f', .3, .755, .25);
    const flowers = [[-.02, '#ff8fb8'], [.02, '#ffd23f'], [0, '#fffaf0']].map(([dx, color], k) => group(at(cyl(.006, .006, .14, '#5fa83e', 6), dx, .09, 0), at(ball(.04, color), dx, .17 + k * .02, 0)));
    const table = group(at(cyl(.4, .4, .05, '#c98a55'), 0, .025, 0), at(cyl(.09, .12, .66, '#c98a55', 16), 0, .38, 0), at(cyl(.74, .76, .1, '#f3c2cc'), 0, .665, 0), at(cyl(.76, .76, .04, cloth), 0, .735, 0),
      group(at(cyl(.15, .09, .07, '#fffaf0'), 0, .035, 0), at(ball(.055, '#ff6b4a'), -.04, .1, 0), at(ball(.055, '#ff6b4a'), .05, .1, .03), at(ball(.055, '#ffd23f'), 0, .12, -.05)).translateX(-.28).translateY(.755).translateZ(-.2),
      group(at(cyl(.045, .04, .14, '#8fc9f2', 12), 0, .07, 0), ...flowers).translateX(.32).translateY(.755).translateZ(-.3),
      mug);
    table.userData.mug = mug;
    table.userData.seat = [-.3, .76, .3];
    table.userData.top = .755;
    return table;
  },
  'dining-square'() {
    const wood = '#e9c58f', dark = '#c98a55';
    const mug = cup('#3b8fe0', .42, .78, 0);
    const setting = x => [at(cyl(.11, .1, .015, '#fffaf0', 20), x, .7875, .28), at(box(.015, .01, .15, '#c8ccd2'), x - .16, .785, .28), at(box(.015, .01, .15, '#c8ccd2'), x + .16, .785, .28)];
    const table = group(...legs4(.58, .48, .69, dark, .04), at(rbox(1.16, .1, .96, .02, dark), 0, .67, 0), at(rbox(1.3, .06, 1.1, .025, wood), 0, .75, 0),
      ...setting(-.32), ...setting(.32),
      at(cyl(.05, .05, .02, dark, 14), 0, .79, -.25), at(cyl(.025, .025, .14, '#fffaf0', 12), 0, .87, -.25), at(ball(.025, glow('#ffd66b', '#ffb347', 1.2)), 0, .965, -.25),
      at(cyl(.03, .03, .08, '#fffaf0', 12), -.4, .82, -.2), at(cyl(.03, .03, .08, '#7fc45a', 12), -.5, .82, -.25),
      mug);
    table.userData.mug = mug;
    table.userData.seat = [-.35, .78, -.05];
    table.userData.top = .78;
    return table;
  },
  'dining-low'() {
    const mug = cup('#8fc9f2', .2, .41, .12);
    const teapot = group(squash(at(ball(.09, '#fffaf0'), 0, .077, 0), 1, .85, 1), at(ball(.025, '#e8617f'), 0, .165, 0),
      at(cyl(.012, .018, .1, '#fffaf0', 8), .12, .11, 0).rotateZ(-.8), at(ring(.05, .01, '#fffaf0'), -.1, .1, 0));
    teapot.position.set(-.1, .41, -.08);
    const table = group(...[[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]].map(([x, z]) => at(cyl(.03, .025, .35, '#9a6a45', 10), x, .175, z)),
      at(cyl(.62, .62, .05, '#c98a55'), 0, .385, 0), at(ring(.3, .012, '#e8617f'), 0, .412, 0).rotateX(Math.PI / 2),
      at(rbox(.52, .08, .52, .035, '#e8617f'), -.82, .04, 0), at(rbox(.52, .08, .52, .035, '#8fc9f2'), .82, .04, 0),
      teapot, at(cyl(.04, .035, .08, '#fffaf0', 12), -.3, .45, .18), mug);
    table.userData.mug = mug;
    table.userData.seat = [-.2, .43, .2];
    table.userData.top = .41;
    return table;
  },

  // ===== Ghế: bốn ghế gỗ / bốn ghế đẩu / hai ghế dài + hai ghế đôn, xếp quanh bàn ăn (gốc model = tâm bàn ăn) =====
  kchair() {
    const set = around(() => woodChair('#d9a36a', '#ffd66b'));
    set.userData.seat = [-1.33, .53, 0];
    set.userData.approach = [-1.95, 0, 0];
    return set;
  },
  'kchair-stool'() {
    const stool = (seat, leg) => group(...legs4(.12, .12, .6, leg, .02), at(cyl(.2, .2, .06, seat, 24), 0, .63, 0), at(ring(.17, .01, leg), 0, .25, 0).rotateX(Math.PI / 2));
    const set = around(() => stool('#e8617f', '#3a3f4a'));
    set.userData.seat = [-1.35, .67, 0];
    set.userData.approach = [-1.95, 0, 0];
    return set;
  },
  'kchair-bench'() {
    const bench = () => group(...legs4(.58, .15, .38, '#c98a55', .035), at(rbox(1.3, .06, .4, .025, '#c98a55'), 0, .41, 0), at(rbox(1.2, .1, .34, .045, '#8fc9f2'), 0, .49, 0),
      squash(at(ball(.13, '#ffd66b'), -.4, .62, -.05), 1, .8, .6), squash(at(ball(.12, '#e8617f'), .35, .61, -.07), 1, .8, .6));
    const pouf = () => group(at(cyl(.25, .25, .34, '#ffd66b', 24), 0, .17, 0), at(cyl(.2, .2, .02, '#ffe6ae', 20), 0, .34, 0));
    const place = (node, x, z) => { node.position.set(x, 0, z); node.rotation.y = Math.atan2(-x, -z); return node; };
    const set = group(place(bench(), 0, -1.3), place(bench(), 0, 1.3), place(pouf(), -1.35, 0), place(pouf(), 1.35, 0));
    set.userData.seat = [-1.35, .37, 0];
    set.userData.approach = [-1.95, 0, 0];
    return set;
  },

  // ===== Chậu cây xanh: đứng sát tường trước (mèo gặm lá, lá rung) =====
  kplant() {
    const leaves = group(), tones = ['#4f9a3a', '#5fae46', '#6fbf4a', '#3f8a3a'];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, L = .38 + (i % 3) * .1, tilt = .35 + (i % 4) * .13, pivot = group();
      pivot.position.set(0, .38, 0); pivot.rotation.y = a;
      const tip = new THREE.Vector3(0, Math.cos(tilt) * L, Math.sin(tilt) * L);
      const leaf = squash(at(ball(.17, tones[i % tones.length]), tip.x, tip.y + .03, tip.z + .06), 1, .16, 1.45);
      leaf.rotation.x = tilt * .6;
      const stalk = at(cyl(.012, .012, L, '#5a9a3e', 6), 0, tip.y / 2, tip.z / 2);
      stalk.rotation.x = tilt;
      pivot.add(stalk, leaf);
      leaves.add(pivot);
    }
    const plant = group(at(cyl(.26, .26, .05, '#b9582f'), 0, .325, 0), at(cyl(.24, .18, .3, '#c9693d'), 0, .15, 0), at(cyl(.23, .23, .02, '#5a3a22'), 0, .345, 0), leaves);
    plant.userData.leaves = leaves;
    return plant;
  },
  'kplant-fig'() {
    const leaves = group(), tones = ['#3f8a3a', '#4f9a3a', '#5fae46'];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, h = 1.0 + (i % 4) * .14, r = .1 + (i % 3) * .06, pivot = group();
      pivot.rotation.y = a;
      const leaf = squash(at(ball(.14, tones[i % 3]), 0, h, r + .12), 1, 1.3, .22);
      leaf.rotation.x = -.5;
      pivot.add(leaf);
      leaves.add(pivot);
    }
    const plant = group(at(cyl(.27, .21, .4, '#fffaf0'), 0, .2, 0), at(cyl(.28, .28, .04, '#e8e2d4'), 0, .4, 0), at(cyl(.25, .25, .02, '#5a3a22'), 0, .415, 0),
      at(cyl(.035, .045, 1.0, '#8a6a45', 10), 0, .92, 0), leaves);
    plant.userData.leaves = leaves;
    return plant;
  },
  'kplant-herbs'() {
    const herbs = group();
    [['#6fbf4a', -.3], ['#5fae46', -.15], ['#8fd46a', 0], ['#4f9a3a', .15], ['#7fc45a', .3]].forEach(([tone, x], k) => {
      herbs.add(at(cyl(.06, .05, .1, k % 2 ? '#e98b5a' : '#fffaf0', 12), x, .38, 0), at(ball(.075, tone), x, .5, 0), at(ball(.05, tone), x + .03, .56, .02));
    });
    const can = group(at(cyl(.06, .07, .1, '#8fc9f2', 12), 0, .05, 0), at(cyl(.012, .012, .1, '#8fc9f2', 6), .09, .1, 0).rotateZ(-.9));
    can.position.set(.55, 0, .1);
    const plant = group(...legs4(.34, .1, .3, '#c98a55', .03), at(rbox(.84, .06, .3, .025, '#d9a36a'), 0, .31, 0), at(rbox(.84, .05, .3, .02, '#c98a55'), 0, .08, 0), herbs, can);
    plant.userData.leaves = herbs;
    return plant;
  },

  // ===== Khay ăn của mèo: chén thức ăn + chén nước (mèo tới ăn / uống) =====
  catfood() {
    const food = bowl('#fffaf0', -.22, .02), water = bowl('#8fc9f2', .22, .02);
    food.add(squash(at(ball(.13, '#b06a3a'), 0, .105, 0), 1, .45, 1));
    water.add(at(cyl(.12, .12, .012, '#cfeaff', 20), 0, .1, 0));
    const station = group(at(rbox(.9, .02, .55, .01, '#f4a3b6'), 0, .01, 0), food, water,
      at(cyl(.05, .05, .1, '#e8617f', 14), 0, .07, -.2), at(cyl(.052, .052, .03, '#fffaf0', 14), 0, .07, -.2),
      ...[[-.3, .2], [-.16, .24], [-.04, .2]].map(([x, z]) => at(cyl(.025, .025, .004, '#fffaf0', 10), x, .022, z)));
    station.userData.bowls = [[-.22, .13, .02], [.22, .13, .02]];
    return station;
  },
  'catfood-feeder'() {
    const hopper = group(at(rbox(.34, .1, .34, .04, '#f5f8fb'), 0, .07, 0), at(cyl(.14, .14, .4, glass('#cfe3f5', .45)), 0, .32, 0), at(cyl(.15, .15, .04, '#e8617f'), 0, .54, 0),
      ...[[-.05, .2], [.06, .26], [0, .34], [-.06, .4], [.05, .15]].map(([dx, y], k) => squash(at(ball(.04, '#b06a3a'), dx, y, k % 2 ? .03 : -.03), 1, .7, 1)));
    hopper.position.set(-.22, .0, -.08);
    const jug = group(at(rbox(.34, .1, .34, .04, '#f5f8fb'), 0, .07, 0), at(cyl(.13, .13, .36, glass('#9fd0f0', .5)), 0, .3, 0), at(cyl(.14, .14, .04, '#8fc9f2'), 0, .5, 0));
    jug.position.set(.22, .0, -.08);
    const food = bowl('#fffaf0', -.22, .2, .04), water = bowl('#8fc9f2', .22, .2, .04);
    food.scale.setScalar(.85); water.scale.setScalar(.85);
    const station = group(at(rbox(.92, .04, .66, .018, '#f5f8fb'), 0, .02, 0), hopper, jug, food, water);
    station.userData.bowls = [[-.22, .13, .2], [.22, .13, .2]];
    return station;
  },
  'catfood-stand'() {
    const wood = '#d9a36a', food = bowl('#e8617f', -.24, 0, .26), water = bowl('#8fc9f2', .24, 0, .26);
    const stand = group(...legs4(.4, .15, .2, '#9a6a45', .03), at(rbox(.95, .06, .4, .025, wood), 0, .23, 0), at(rbox(.95, .08, .04, .018, '#e9c58f'), 0, .17, .19),
      ...[-.28, 0, .28].map(x => at(cyl(.03, .03, .012, '#fffaf0', 10), x, .17, .216).rotateX(Math.PI / 2)), food, water,
      squash(at(ball(.13, '#b06a3a'), -.24, .365, 0), 1, .45, 1), at(cyl(.12, .12, .012, '#cfeaff', 20), .24, .36, 0));
    stand.userData.bowls = [[-.24, .38, 0], [.24, .38, 0]];
    return stand;
  },

  // ===== Xe đẩy =====
  cart() {
    const mug = cup('#e8617f', .1, .795, .05);
    const teapot = group(squash(at(ball(.09, '#fffaf0'), 0, .077, 0), 1, .85, 1), at(ball(.025, '#e8617f'), 0, .165, 0), at(cyl(.012, .018, .1, '#fffaf0', 8), .12, .11, 0).rotateZ(-.8), at(ring(.05, .01, '#fffaf0'), -.1, .1, 0));
    teapot.position.set(.3, .795, .05);
    const cart = group(...cartFrame('#ffd66b', '#c8ccd2'), teapot, mug,
      at(rbox(.3, .06, .22, .02, '#e8617f'), -.2, .26, 0), at(rbox(.26, .06, .2, .02, '#3b8fe0'), -.2, .32, 0), at(cyl(.07, .06, .1, '#fffaf0', 14), .2, .28, 0), at(cyl(.1, .1, .02, '#f3c2cc', 20), .22, .39, 0), squash(at(ball(.07, '#ffe6ae'), .22, .43, 0), 1, .7, 1));
    return finishCart(cart, mug);
  },
  'cart-produce'() {
    const mug = at(ball(.06, '#ff6b4a'), -.3, .855, .1);
    mug.userData.home = mug.position.clone();
    const crate = (x, y, color, fruit, n) => group(at(box(.44, .02, .34, '#c98a55'), 0, .01, 0), ...[-1, 1].map(s => at(box(.44, .12, .02, '#d9a36a'), 0, .07, s * .16)), ...[-1, 1].map(s => at(box(.02, .12, .34, '#d9a36a'), s * .21, .07, 0)),
      ...Array.from({ length: n }, (_, k) => at(ball(.055, fruit), -.15 + (k % 4) * .1, .11, -.07 + Math.floor(k / 4) * .14))).translateX(x).translateY(y);
    const cart = group(...cartFrame('#8fd4c4', '#9a6a45'), mug, crate(.17, .795, '#c98a55', '#ff6b4a', 8),
      at(cyl(.12, .1, .12, '#e9c58f'), -.27, .29, 0), ...[[-.31, 0], [-.27, .03], [-.23, -.02]].map(([x, z], k) => at(cone(.025, .16, '#ff9f43', 8), x, .42, z).rotateZ((k - 1) * .35)),
      crate(.17, .23, '#7fc45a', '#7fc45a', 8));
    return finishCart(cart, mug);
  },
  'cart-coffee'() {
    const mug = cup('#fffaf0', -.3, .795, .12);
    const machine = group(at(rbox(.34, .3, .3, .05, '#e8617f'), 0, .15, 0), at(rbox(.36, .04, .32, .015, chrome()), 0, .32, 0), at(cyl(.06, .06, .1, '#fffaf0', 14), 0, .39, -.05),
      at(rbox(.12, .05, .1, .02, '#26282c'), -.06, .2, .17), at(rbox(.12, .05, .1, .02, '#26282c'), .06, .2, .17), at(ball(.025, '#ffd66b'), 0, .27, .16), at(rbox(.3, .02, .1, .01, '#3a3f4a'), 0, .03, .18));
    machine.position.set(.22, .795, -.02);
    const cart = group(...cartFrame('#fff4e0', '#3a3f4a'), machine, mug,
      at(cyl(.07, .07, .2, glass('#d9a36a', .55)), -.25, .325, 0), at(cyl(.075, .075, .03, '#3a3f4a'), -.25, .44, 0), at(cyl(.045, .04, .14, '#fffaf0', 14), .05, .29, .04),
      ...[0, 1, 2].map(k => at(cyl(.04, .035, .06, k % 2 ? '#e8617f' : '#8fc9f2', 12), .22 + k * .02, .26 + k * .06, -.05)));
    return finishCart(cart, mug);
  },

  // ===== Phong cách châu Á (Asian): gỗ tối, sơn mài đỏ, vàng đồng, tre, gốm xanh trắng =====
  'fridge-asian'() {
    const wood = '#5a3a28', red = '#b83a2e', gold = '#e0b04a', paper = '#f3ead3';
    const f = group(...fridgeFeet('#3a2418'),
      at(rbox(.88, 1.72, .74, .05, wood), 0, .94, 0),
      at(rbox(.82, .6, .03, .015, red), 0, 1.46, .385), at(rbox(.82, .98, .03, .015, red), 0, .63, .385),
      at(rbox(.03, .3, .05, .012, gold), -.32, 1.4, .425), at(rbox(.03, .5, .05, .012, gold), -.32, .86, .425),
      at(cyl(.11, .11, .012, gold, 28), .1, .95, .408).rotateX(Math.PI / 2), at(cyl(.07, .07, .012, red, 24), .1, .95, .416).rotateX(Math.PI / 2),
      at(rbox(.18, .26, .012, .005, paper), .16, 1.46, .408), at(cyl(.045, .045, .008, red, 20), .16, 1.46, .416).rotateX(Math.PI / 2));
    f.userData.seat = [0, 1.83, 0];
    return f;
  },
  'stove-asian'() {
    const wood = '#5a3a28', dark = '#26282c', red = '#b83a2e', gold = '#e0b04a', bamboo = '#d9b66a';
    const wokMat = mat('#3a3f4a', { side: THREE.DoubleSide, metalness: .5, roughness: .45 });
    const wokBowl = squash(mesh(new THREE.SphereGeometry(.22, 24, 12, 0, TAU, Math.PI / 2, Math.PI / 2), wokMat), 1, .5, 1);
    wokBowl.userData.noOutline = true; // vỏ mỏng hở: viền mép là vòng ring riêng
    const wok = group(wokBowl, at(ring(.22, .012, dark), 0, .0, 0).rotateX(Math.PI / 2),
      at(rbox(.3, .035, .045, .015, dark), .38, .0, 0), at(rbox(.14, .045, .05, .02, '#8a5a35'), .52, .0, 0),
      ...[[-.07, .02], [.05, -.03], [0, .06], [.08, .05]].map(([x, z], k) => squash(at(ball(.04, ['#e8483a', '#7fc45a', '#ffd23f', '#ff9f43'][k]), x, -.07, z), 1, .6, 1)));
    wok.position.set(-.22, 1.04, -.12);
    const steamer = group(...[0, 1, 2].flatMap(k => [at(cyl(.15, .15, .09, bamboo), 0, .045 + k * .1, 0), at(ring(.15, .008, '#8a6a45'), 0, .07 + k * .1, 0).rotateX(Math.PI / 2)]),
      at(cone(.16, .09, bamboo, 20), 0, .35, 0), at(ball(.025, '#8a6a45'), 0, .41, 0));
    steamer.position.set(.22, .92, -.12);
    const stove = group(at(rbox(.84, .08, .62, .02, '#3a2418'), 0, .04, 0), at(rbox(.9, .78, .7, .04, wood), 0, .47, 0), at(rbox(.92, .05, .72, .02, dark), 0, .895, 0),
      ...burners('#3a3f4a', .935), wok, steamer,
      at(rbox(.74, .5, .03, .015, red), 0, .45, .365), at(box(.62, .02, .012, gold), 0, .45, .386),
      ...[-.2, 0, .2].map(x => at(box(.012, .38, .012, gold), x, .45, .386)), at(rbox(.62, .03, .04, .015, gold), 0, .66, .395),
      ...[-.3, -.1, .1, .3].map(x => at(cyl(.03, .03, .03, gold, 14), x, .8, .365).rotateX(Math.PI / 2)));
    stove.userData.seat = [0, .96, .2];
    return stove;
  },
  'sink-asian'() {
    const chr = chrome(), gold = '#e0b04a', wood = '#5a3a28';
    const neko = group(squash(at(ball(.1, '#fffaf0'), 0, .1, 0), 1, 1.05, .9), at(ball(.075, '#fffaf0'), 0, .22, .01), at(cone(.03, .05, '#fffaf0', 4), -.045, .29, .01), at(cone(.03, .05, '#fffaf0', 4), .045, .29, .01),
      at(ring(.065, .01, '#b83a2e'), 0, .165, .01).rotateX(Math.PI / 2), at(ball(.02, gold), 0, .15, .075), at(rbox(.045, .13, .04, .018, '#fffaf0'), .1, .17, .03).rotateZ(-.3),
      at(ball(.01, '#26282c'), -.025, .23, .075), at(ball(.01, '#26282c'), .025, .23, .075));
    neko.position.set(1.2, .9, -.15);
    const bamboo = group(at(cyl(.06, .05, .1, '#2f3a5a', 12), 0, .05, 0), ...[-.02, .02, .0].map((dx, k) => at(cyl(.012, .014, .22 + k * .05, '#7fb23a', 6), dx, .21 + k * .02, k * .02 - .01)));
    bamboo.position.set(-.68, .9, -.2);
    const teapot = group(squash(at(ball(.09, '#3a3f4a'), 0, .077, 0), 1, .85, 1), at(ball(.022, gold), 0, .165, 0), at(cyl(.012, .018, .1, '#3a3f4a', 8), .12, .11, 0).rotateZ(-.8), at(ring(.05, .01, '#3a3f4a'), -.1, .1, 0));
    teapot.position.set(1.75, .9, -.2);
    const rice = group(at(cyl(.1, .1, .16, '#b83a2e', 18), 0, .08, 0), at(cyl(.105, .105, .03, '#fffaf0', 18), 0, .175, 0), at(ball(.02, gold), 0, .21, 0));
    rice.position.set(2.25, .9, -.2);
    const steamer = group(...[0, 1].map(k => at(cyl(.15, .15, .08, '#d9b66a'), 0, .04 + k * .09, 0)), at(cone(.16, .08, '#d9b66a', 20), 0, .22, 0));
    steamer.position.set(3.1, .9, 1.0);
    const neck = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0, 0], [0, .3, 0], [0, .42, .06], [0, .38, .15], [0, .3, .17]].map(p => new THREE.Vector3(...p))), 16, .013, 6), chr);
    neck.position.set(-.25, .9, -.2);
    const sink = group(...counterL({ body: wood, top: '#c9b46a', kick: '#3a2418', door: '#7a4a30', knob: gold }),
      at(rbox(.56, .03, .4, .015, '#c8ccd2'), -.25, .915, .03), at(rbox(.46, .012, .3, .006, '#6f8190'), -.25, .934, .03),
      neck, at(cyl(.03, .035, .04, chr, 12), -.25, .92, -.2),
      bamboo, neko, teapot, rice, steamer,
      ...[0, 1, 2].map(k => at(cyl(.09, .06, .05, k % 2 ? '#fffaf0' : '#3b4a7a', 16), 2.75, .925 + k * .05, -.2)),
      at(cyl(.045, .04, .09, '#3b4a7a', 12), 3.0, .945, 1.9), at(rbox(.3, .02, .2, .01, '#d9b66a'), 3.1, .91, 1.5));
    sink.userData.seat = [.4, .92, .08];
    sink.userData.tap = [-.25, 1.2, -.12];
    return sink;
  },
  'pantry-asian'() {
    const dark = '#4a2f1f', wood = '#6b4630', gold = '#e0b04a';
    const drawers = [0, 1, 2, 3, 4, 5, 6].flatMap(r => [-1, 1].flatMap(s => [at(rbox(.44, .21, .03, .012, wood), s * .245, .2 + r * .25, .265), at(ball(.02, gold), s * .245, .2 + r * .25, .292)]));
    const vase = group(at(cyl(.1, .08, .22, '#f5f8fb', 18), 0, .11, 0), at(ring(.1, .012, '#3b4a7a'), 0, .17, 0).rotateX(Math.PI / 2), at(ring(.085, .01, '#3b4a7a'), 0, .06, 0).rotateX(Math.PI / 2), at(cyl(.05, .1, .05, '#f5f8fb', 18), 0, .245, 0));
    vase.position.set(-.3, 1.98, 0);
    const pantry = group(at(rbox(1.04, .06, .54, .02, '#3a2418'), 0, .03, 0), at(rbox(1.0, 1.9, .5, .04, dark), 0, .98, 0), at(rbox(1.06, .05, .54, .02, wood), 0, 1.955, 0), ...drawers, vase,
      at(rbox(.12, .1, .08, .03, '#b83a2e'), -.08, 2.0, 0));
    pantry.userData.seat = [.25, 2.0, 0];
    return pantry;
  },
  'dining-asian'() {
    const mug = cup('#3b4a7a', .2, .41, .12);
    const teapot = group(squash(at(ball(.09, '#3a3f4a'), 0, .077, 0), 1, .85, 1), at(ball(.022, '#e0b04a'), 0, .165, 0), at(cyl(.012, .018, .1, '#3a3f4a', 8), .12, .11, 0).rotateZ(-.8), at(ring(.05, .01, '#3a3f4a'), -.1, .1, 0));
    teapot.position.set(-.12, .41, -.1);
    const cushion = (x, z) => at(rbox(.52, .09, .52, .04, '#3b4a7a'), x, .045, z);
    const table = group(...legs4(.4, .4, .35, '#26282c', .03), at(rbox(1.04, .06, 1.04, .025, '#b83a2e'), 0, .38, 0), at(rbox(.84, .01, .84, .004, '#e0b04a'), 0, .413, 0),
      cushion(-.74, 0), cushion(.74, 0), cushion(0, -.74), cushion(0, .74),
      teapot, at(cyl(.045, .035, .05, '#fffaf0', 12), -.32, .435, .2), at(cyl(.06, .05, .02, '#fffaf0', 16), .28, .425, -.25), squash(at(ball(.035, '#f3c2cc'), .28, .45, -.25), 1, .8, 1), mug);
    table.userData.mug = mug;
    table.userData.seat = [-.2, .43, .22];
    table.userData.top = .41;
    return table;
  },
  'kchair-asian'() {
    const zaisu = () => group(at(rbox(.46, .07, .46, .03, '#5a3a28'), 0, .035, 0), at(rbox(.4, .07, .4, .03, '#b83a2e'), 0, .105, .01),
      at(rbox(.44, .32, .05, .02, '#5a3a28'), 0, .27, -.2), at(rbox(.36, .22, .02, .01, '#e0b04a'), 0, .27, -.165));
    const set = around(zaisu);
    set.userData.seat = [-1.35, .16, 0];
    set.userData.approach = [-1.95, 0, 0];
    return set;
  },
  'kplant-asian'() {
    const leaves = group();
    leaves.position.y = .34;
    [[-.1, .0, 1.5], [.1, .05, 1.7], [0, -.1, 1.35], [.05, .12, 1.2], [-.12, .1, 1.55]].forEach(([x, z, h], k) => {
      leaves.add(at(cyl(.02, .026, h, '#7fb23a', 8), x, h / 2, z));
      for (let n = 1; n <= 4; n++) leaves.add(at(ring(.027, .006, '#5f9a2a'), x, h * n / 5, z).rotateX(Math.PI / 2));
      [0, 1].forEach(s => leaves.add(squash(at(ball(.1, k % 2 ? '#5fae46' : '#6fbf4a'), x + (s ? .12 : -.12), h - .05 - s * .12, z), 1.5, .22, .7)));
    });
    const plant = group(at(cyl(.24, .18, .34, '#2f3a5a'), 0, .17, 0), at(ring(.24, .014, '#f5f8fb'), 0, .33, 0).rotateX(Math.PI / 2), at(cyl(.22, .22, .02, '#5a3a22'), 0, .345, 0),
      ...[[-.1, .08], [.12, -.06], [.04, .14]].map(([x, z]) => at(ball(.035, '#f5f8fb'), x, .365, z)), leaves);
    plant.userData.leaves = leaves;
    return plant;
  },
  'catfood-asian'() {
    const food = bowl('#f5f8fb', -.22, .02, .02), water = bowl('#3b4a7a', .22, .02, .02);
    food.add(squash(at(ball(.13, '#b06a3a'), 0, .105, 0), 1, .45, 1));
    water.add(at(cyl(.12, .12, .012, '#cfeaff', 20), 0, .1, 0));
    const fish = group(squash(at(ball(.07, '#8fc9f2'), 0, .02, 0), 1.5, .45, .8), at(cone(.04, .07, '#8fc9f2', 4), -.12, .02, 0).rotateZ(Math.PI / 2));
    fish.position.set(.0, .03, .2);
    const station = group(at(rbox(.92, .03, .58, .012, '#d9b66a'), 0, .015, 0), at(rbox(.88, .01, .54, .005, '#c9a04a'), 0, .035, 0), food, water, fish,
      at(cyl(.045, .04, .08, '#b83a2e', 14), -.38, .07, -.16));
    station.userData.bowls = [[-.22, .13, .02], [.22, .13, .02]];
    return station;
  },
  'cart-asian'() {
    const mug = cup('#fffaf0', .12, .795, .12);
    const teapot = group(squash(at(ball(.09, '#3a3f4a'), 0, .077, 0), 1, .85, 1), at(ball(.022, '#e0b04a'), 0, .165, 0), at(cyl(.012, .018, .1, '#3a3f4a', 8), .12, .11, 0).rotateZ(-.8), at(ring(.05, .01, '#3a3f4a'), -.1, .1, 0));
    teapot.position.set(.3, .795, -.04);
    const steamers = group(...[0, 1, 2].flatMap(k => [at(cyl(.17, .17, .09, '#d9b66a'), 0, .045 + k * .1, 0), at(ring(.17, .009, '#8a6a45'), 0, .07 + k * .1, 0).rotateX(Math.PI / 2)]),
      at(cone(.18, .09, '#d9b66a', 22), 0, .35, 0), at(ball(.025, '#b83a2e'), 0, .41, 0));
    steamers.position.set(-.2, .795, 0);
    const cart = group(...cartFrame('#b83a2e', '#26282c'), steamers, teapot, mug,
      ...[0, 1, 2].map(k => at(cyl(.1, .06, .05, k % 2 ? '#fffaf0' : '#3b4a7a', 16), -.2, .26 + k * .05, 0)), at(cyl(.07, .06, .1, '#f5f8fb', 14), .2, .28, 0), squash(at(ball(.07, '#ffe6ae'), .22, .36, 0), 1, .7, 1));
    return finishCart(cart, mug);
  },
};

// ---------- Trang trí cố định trên tường bếp (u = trục ngang của tường, +z = mặt hướng vào phòng) ----------
//   0 = tường sau (u = x phòng), 1 = tường trước (u = -x), 2 = tường trái (u = -z), 3 = tường phải (u = z).
const onWall = color => mat(color, { transparent: true });
function curtainPanel(w, h, color) {
  const geo = new THREE.PlaneGeometry(w, h, 16, 1), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) / w * Math.PI * 4) * .03);
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { side: THREE.DoubleSide, transparent: true }));
}
function wallFrame(w, h, frameColor, art, u, y) {
  return group(at(mesh(new THREE.BoxGeometry(w, h, .05), onWall(frameColor)), u, y, .13),
    at(new THREE.Mesh(new THREE.PlaneGeometry(w - .1, h - .1), new THREE.MeshBasicMaterial({ color: art, transparent: true, userData: { nightDim: true } })), u, y, .16),
    at(new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * .18, 20), new THREE.MeshBasicMaterial({ color: '#fff6e4', transparent: true, userData: { nightDim: true } })), u + w * .1, y + h * .12, .165));
}
const flat = (w, h, color) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, transparent: true, userData: { nightDim: true } }));
export function decorateKitchenWall(i, wall) {
  if (i === 0) {
    // Rèm hai bên cửa sổ trên bồn rửa + thanh treo (tấm rèm cao từ 1.48 để chừa vòi nước).
    const u0 = KITCHEN_WINDOW_X;
    const rod = at(cyl(.02, .02, 2.1, onWall('#c98a55'), 12), u0, 2.5, .2); rod.rotation.z = Math.PI / 2;
    wall.add(rod, at(ball(.045, onWall('#c98a55')), u0 - 1.05, 2.5, .2), at(ball(.045, onWall('#c98a55')), u0 + 1.05, 2.5, .2));
    for (const s of [-1, 1]) wall.add(at(curtainPanel(.45, 1, '#fffaf0'), u0 + s * .82, 1.98, .19), at(box(.47, .05, .08, onWall('#e8617f')), u0 + s * .82, 1.7, .22));
    // Giá treo dụng cụ phía trên bếp: muôi, xẻng, nồi nhỏ, phới (đáy thấp nhất 1.55).
    const u1 = -1.55, rail = at(cyl(.014, .014, 1.1, onWall('#c8ccd2'), 8), u1, 1.95, .2);
    rail.rotation.z = Math.PI / 2;
    wall.add(rail, at(box(.03, .03, .1, onWall('#c8ccd2')), u1 - .5, 1.95, .15), at(box(.03, .03, .1, onWall('#c8ccd2')), u1 + .5, 1.95, .15));
    wall.add(at(cyl(.008, .008, .34, onWall('#9aa0a8'), 6), u1 - .35, 1.78, .22), at(ball(.04, onWall('#9aa0a8')), u1 - .35, 1.6, .22),
      at(cyl(.008, .008, .26, onWall('#9a6a45'), 6), u1 - .12, 1.82, .22), at(rbox(.08, .13, .012, .005, onWall('#e8617f')), u1 - .12, 1.66, .22),
      at(cyl(.08, .07, .08, onWall('#8fc9f2'), 14), u1 + .13, 1.8, .22), at(ring(.03, .006, onWall('#8fc9f2')), u1 + .13, 1.89, .22),
      at(cyl(.008, .008, .3, onWall('#c8ccd2'), 6), u1 + .38, 1.8, .22), at(ring(.04, .006, onWall('#c8ccd2')), u1 + .38, 1.6, .22));
    // Đồng hồ tròn phía trên tủ chén (đáy tủ chén cao nhất ~2.15).
    wall.add(at(mesh(new THREE.CylinderGeometry(.24, .24, .06, 32), onWall('#ffffff')), 2.75, 2.5, .13).rotateX(Math.PI / 2),
      at(mesh(new THREE.TorusGeometry(.24, .025, 8, 32), onWall('#e8617f')), 2.75, 2.5, .16),
      at(box(.014, .15, .01, onWall('#2b2f3a')), 2.75, 2.55, .17), at(box(.1, .014, .01, onWall('#2b2f3a')), 2.79, 2.5, .17));
  }
  if (i === 1) {
    // Mặt NGOÀI tường trước (local -z, nhìn từ vườn; cao hơn hàng rào): biển hiệu "KITCHEN", cửa sổ giả có cánh cửa chớp + hộp hoa, đèn lồng.
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .27), new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, userData: { nightDim: true } }));
    sign.position.set(-1.9, 2.15, -.175); sign.rotation.y = Math.PI;
    wall.add(at(rbox(1.1, .35, .06, .02, onWall('#c98a55')), -1.9, 2.15, -.14), sign,
      ...[-.4, .4].map(dx => at(box(.04, .12, .04, onWall('#9a6a45')), -1.9 + dx, 2.4, -.12)));
    const win = 1.3;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.7, .8), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, userData: { nightDim: true } }));
    glass.position.set(win, 1.85, -.175); glass.rotation.y = Math.PI;
    wall.add(at(box(.9, 1.0, .06, onWall('#fff4e0')), win, 1.85, -.13), glass,
      ...[-1, 1].map(s => at(box(.3, 1.0, .04, onWall('#7fc4a8')), win + s * .6, 1.85, -.13)),
      at(rbox(.9, .14, .2, .04, onWall('#c98a55')), win, 1.3, -.2),
      ...[-.3, -.1, .1, .3].flatMap((dx, k) => [at(ball(.06, onWall(['#ff8fb8', '#ffd23f', '#fffaf0', '#ff6b4a'][k])), win + dx, 1.42, -.2), at(ball(.04, onWall('#5fae46')), win + dx + .03, 1.36, -.26)]));
    const lantern = u => [at(box(.03, .03, .2, onWall('#3a3f4a')), u, 2.5, -.2), at(cyl(.07, .07, .16, mat('#ffe9a8', { transparent: true, emissive: '#ffcf6a', emissiveIntensity: .7 }), 12), u, 2.32, -.3),
      at(cyl(.09, .07, .03, onWall('#3a3f4a'), 12), u, 2.43, -.3), at(cyl(.07, .09, .03, onWall('#3a3f4a'), 12), u, 2.22, -.3)];
    wall.add(...lantern(3.0), ...lantern(-3.2));
  }
  if (i === 1) {
    // Tường trước, mặt trong (u = -x phòng): kệ treo hũ + dây leo rủ phía trên chậu cây (chậu ở x ≈ 1.9 -> u ≈ -1.9), giá móc tạp dề, tranh.
    const u = -1.9, shelfY = 2.0;
    wall.add(at(mesh(roundedBox(1.3, .05, .26, ROUND, .015), onWall('#c98a55')), u, shelfY, .24));
    [['#ffd66b', '#e8617f', -.45], ['#bfe3a0', '#fffaf0', -.28], ['#f3c2cc', '#7fc45a', -.11]].forEach(([jarColor, lid, dx]) => {
      wall.add(at(cyl(.055, .055, .18, onWall(jarColor), 14), u + dx, shelfY + .115, .24), at(cyl(.06, .06, .03, onWall(lid), 14), u + dx, shelfY + .22, .24));
    });
    wall.add(at(cyl(.08, .06, .13, onWall('#e98b5a'), 14), u + .3, shelfY + .09, .24), at(ball(.09, onWall('#6fbf4a')), u + .3, shelfY + .2, .24));
    for (let k = 0; k < 6; k++) wall.add(at(ball(.035, onWall(k % 2 ? '#6fbf4a' : '#5fae46')), u + .4 + Math.sin(k) * .02, shelfY - .06 - k * .08, .3));
    wall.add(at(box(.9, .06, .04, onWall('#c98a55')), 1.3, 1.75, .15), ...[-.3, 0, .3].map(dx => at(ball(.025, onWall('#e8617f')), 1.3 + dx, 1.7, .2)));
    wall.add(at(rbox(.34, .5, .012, .005, onWall('#e8617f')), 1.0, 1.4, .2), at(box(.34, .06, .016, onWall('#fffaf0')), 1.0, 1.52, .2),
      at(rbox(.24, .36, .012, .005, onWall('#8fc9f2')), 1.55, 1.48, .2), at(box(.24, .05, .016, onWall('#fffaf0')), 1.55, 1.58, .2));
    wall.add(wallFrame(.6, .44, '#e0b36a', '#c9e8b0', -.3, 1.9), wallFrame(.4, .5, '#fff4e0', '#ffd9c4', 3.1, 1.85), wallFrame(.36, .36, '#c98a55', '#bfe6ff', -3.2, 2.0));
  }
  if (i === 2) {
    // Bảng thực đơn phấn (u = -z phòng: u -1.6 = z 1.6) + tranh trên nóc tủ lạnh (tủ lạnh ở z ≈ -3.6 -> u ≈ 3.6; cửa sang phòng khách ở u = .6).
    wall.add(at(mesh(new THREE.BoxGeometry(.9, .62, .05), onWall('#c98a55')), -1.6, 1.75, .13), at(flat(.8, .52, '#2f4a3c'), -1.6, 1.75, .16),
      at(flat(.5, .03, '#fffaf0'), -1.55, 1.9, .165), at(flat(.4, .03, '#ffd66b'), -1.6, 1.8, .165), at(flat(.46, .03, '#fffaf0'), -1.57, 1.7, .165),
      at(new THREE.Mesh(new THREE.CircleGeometry(.07, 20), new THREE.MeshBasicMaterial({ color: '#f7c99a', transparent: true, userData: { nightDim: true } })), -1.85, 1.62, .165));
    wall.add(wallFrame(.4, .5, '#fff4e0', '#ffc9d5', 3.3, 2.4), wallFrame(.5, .36, '#c98a55', '#bfe6ff', -2.9, 1.95));
  }
  if (i === 3) {
    // Kệ treo có hũ gia vị phía sau-phải (u = z phòng: u -2.4 = z -2.4) + tranh phía trên xe đẩy (xe ở z ≈ 1.6).
    const shelfY = 1.55, u = -2.4;
    wall.add(at(mesh(roundedBox(1.2, .05, .26, ROUND, .015), onWall('#c98a55')), u, shelfY, .24));
    [['#ffd66b', '#e8617f', -.4], ['#bfe3a0', '#fffaf0', -.22], ['#f3c2cc', '#7fc45a', .0], ['#ffb347', '#fffaf0', .2]].forEach(([jarColor, lid, dx]) => {
      wall.add(at(cyl(.055, .055, .18, onWall(jarColor), 14), u + dx, shelfY + .115, .24), at(cyl(.06, .06, .03, onWall(lid), 14), u + dx, shelfY + .22, .24));
    });
    wall.add(at(rbox(.22, .16, .16, .02, onWall('#8fc9f2')), u + .45, shelfY + .105, .24));
    wall.add(wallFrame(.6, .44, '#e0b36a', '#ffe2a0', 1.6, 1.9), wallFrame(.36, .36, '#fff4e0', '#c9e8b0', .6, 2.0));
  }
}

// ---------- Đồ cố định trên sàn bếp: thảm chùi chân trong cửa, thảm lối đi trước bồn rửa, thùng rác ----------
export function kitchenDecor() {
  const doormat = group(at(rbox(.9, .03, .5, .015, '#c9955e'), 0, .015, 0), at(box(.7, .04, .32, '#ffd66b'), 0, .02, 0));
  doormat.position.set(-HALF + .55, 0, KITCHEN_DOOR.z); doormat.rotation.y = Math.PI / 2;
  const runner = group(at(rbox(1.3, .03, .55, .012, '#e8617f'), 0, .015, 0), at(box(1.1, .04, .35, '#fffaf0'), 0, .02, 0), at(box(.9, .05, .15, '#e8617f'), 0, .025, 0));
  runner.position.set(.55, 0, -2.72);
  [doormat, runner].forEach(rug => rug.traverse(node => { node.castShadow = false; node.userData.noOutline = true; }));
  const bin = group(at(cyl(.17, .14, .5, '#c8ccd2', 20), 0, .25, 0), at(cyl(.18, .18, .05, '#e8617f', 20), 0, .525, 0), at(ball(.03, '#fffaf0'), 0, .575, 0), at(box(.12, .04, .05, '#3a3f4a'), 0, .03, .15));
  bin.position.set(-3.6, 0, 3.5);
  return mergeStatic(group(doormat, runner, bin));
}
