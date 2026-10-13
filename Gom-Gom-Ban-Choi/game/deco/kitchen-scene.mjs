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

// Trái tim (mặt trước +z): hai cầu + nón úp, ép dẹt theo z.
const heart = (r, color) => squash(group(at(ball(r, color), -.55 * r, 0, 0), at(ball(r, color), .55 * r, 0, 0),
  at(cone(r * 1.12, r * 1.5, color, 12), 0, -.75 * r, 0).rotateZ(Math.PI)), 1, 1, .45);
// Viền lượn sóng (scallop): hàng hạt tròn dẹt từ điểm a tới điểm b / quanh một vòng tròn bán kính radius.
const scallops = ([x0, y0, z0], [x1, y1, z1], color, r = .03) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / (r * 2.2)));
  return Array.from({ length: n + 1 }, (_, k) => squash(at(ball(r, color), x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, z0 + (z1 - z0) * k / n), 1, .75, 1));
};
const ringScallops = (radius, y, color, r = .035) => {
  const n = Math.round(TAU * radius / (r * 2.2));
  return Array.from({ length: n }, (_, k) => squash(at(ball(r, color), Math.cos(k / n * TAU) * radius, y, Math.sin(k / n * TAU) * radius), 1, .75, 1));
};
// Dải LED phát sáng: món nào dùng phải khai userData.lightSource = true.
const led = (w, h, d, color) => box(w, h, d, glow(color, color, 1.2));

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
  // Hồng: tủ lạnh bo tròn hồng pastel, tay nắm vàng, nơ trên cửa, viền lượn sóng giữa hai cửa, nam châm trái tim.
  'fridge-retro'() {
    const body = '#ffc2d4', door = '#ffe0e9', gold = '#f2c14e', rose = '#ff8fb6';
    const bow = group(squash(at(ball(.06, rose), -.065, 0, 0), 1, .7, .6), squash(at(ball(.06, rose), .065, 0, 0), 1, .7, .6), at(ball(.032, gold), 0, 0, 0));
    bow.position.set(.22, 1.58, .425);
    const f = group(...fridgeFeet(rose),
      at(rbox(.86, 1.66, .72, .16, body), 0, .92, 0),
      at(rbox(.78, .5, .04, .02, door), 0, 1.4, .375), at(rbox(.78, 1.04, .04, .02, door), 0, .64, .375),
      at(rbox(.035, .26, .05, .016, gold), -.3, 1.4, .42), at(rbox(.035, .6, .05, .016, gold), -.3, .85, .42),
      ...scallops([-.36, 1.14, .4], [.36, 1.14, .4], rose, .022),
      bow, at(heart(.04, rose), .2, 1.0, .405), at(ball(.03, '#e6d4ff'), .26, .86, .4), at(heart(.03, gold), .1, .8, .405));
    f.userData.seat = [0, 1.78, 0];
    return f;
  },
  // Hiện đại: tủ lạnh hai cánh đen nhám, tay nắm thép, màn hình cyan, dải LED giữa hai cánh + chân ngăn kéo.
  'fridge-steel'() {
    const panel = '#3a3d43', bar = '#c8ccd2';
    const f = group(...fridgeFeet('#1f2125'),
      at(rbox(.9, 1.74, .74, .04, '#26282c'), 0, .95, 0),
      at(rbox(.43, 1.06, .03, .015, panel), -.222, 1.27, .385), at(rbox(.43, 1.06, .03, .015, panel), .222, 1.27, .385),
      at(rbox(.88, .52, .03, .015, panel), 0, .47, .385),
      at(rbox(.025, .5, .04, .012, bar), -.04, 1.3, .42), at(rbox(.025, .5, .04, .012, bar), .04, 1.3, .42), at(rbox(.5, .03, .04, .012, bar), 0, .64, .42),
      at(rbox(.22, .12, .02, .01, '#111316'), .222, 1.0, .41), at(box(.17, .07, .01, glow('#0a1a2a', '#3fe0ff', 1)), .222, 1.0, .431),
      at(led(.012, 1.0, .012, '#3fe0ff'), 0, 1.27, .41), at(led(.84, .012, .012, '#b07cff'), 0, .2, .412));
    f.userData.seat = [0, 1.85, 0];
    f.userData.lightSource = true;
    return f;
  },

  stove() {
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
  // Hồng: bếp ga hồng pastel, mặt kem, viền lượn sóng, núm vàng, đồng hồ trên tấm chắn, nồi kem + ấm lilac.
  'stove-red'() {
    const pink = '#ffb3c8', cream = '#fff6f8', gold = '#f2c14e', rose = '#ff8fb6', dark = '#3a3d43';
    const pot = group(at(cyl(.15, .14, .14, cream), 0, .07, 0), at(cyl(.155, .155, .02, rose), 0, .15, 0), at(ball(.03, gold), 0, .18, 0));
    pot.position.set(-.22, .93, .16);
    const stove = group(at(rbox(.84, .08, .62, .02, rose), 0, .04, 0), at(rbox(.9, .8, .7, .1, pink), 0, .48, 0), at(rbox(.94, .05, .74, .02, cream), 0, .905, 0),
      ...scallops([-.44, .875, .37], [.44, .875, .37], cream, .025),
      at(rbox(.94, .2, .06, .03, pink), 0, 1.05, -.32), ...scallops([-.44, 1.155, -.32], [.44, 1.155, -.32], cream, .025),
      at(cyl(.06, .06, .03, cream, 20), 0, 1.05, -.27).rotateX(Math.PI / 2),
      at(box(.006, .045, .008, dark), 0, 1.07, -.255), at(box(.035, .006, .008, dark), .012, 1.05, -.255),
      ...burners(dark, .945), pot, kettle('#e6d4ff', .22, .93, -.12),
      at(rbox(.74, .46, .03, .015, '#ffe0e9'), 0, .45, .365), at(box(.5, .26, .012, '#c9a7b6'), 0, .46, .392), at(rbox(.66, .03, .04, .015, gold), 0, .66, .395),
      at(heart(.035, rose), 0, .27, .395),
      ...[-.3, -.1, .1, .3].map(x => at(cyl(.03, .03, .03, gold, 14), x, .78, .365).rotateX(Math.PI / 2)));
    stove.userData.seat = [.22, .96, .2];
    return stove;
  },
  // Hiện đại: bếp từ đen, mặt kính đen với vòng LED (cyan / tím đang nấu, xám đang tắt), màn hình cảm ứng, LED chân bếp.
  'stove-modern'() {
    const body = '#26282c', black = '#1a1c20';
    const pot = group(at(cyl(.13, .12, .12, steel()), 0, .06, 0), at(cyl(.135, .135, .015, black), 0, .127, 0), at(rbox(.06, .025, .03, .012, black), 0, .145, 0));
    pot.position.set(-.22, .93, .16);
    const zone = (x, z, color) => at(ring(.11, .006, color ? glow(color, color, 1.2) : mat('#3a3d43')), x, .937, z).rotateX(Math.PI / 2);
    const stove = group(at(rbox(.84, .06, .6, .02, '#1f2125'), 0, .03, 0), at(rbox(.9, .86, .68, .03, body), 0, .47, 0),
      at(rbox(.92, .03, .72, .012, '#111316'), 0, .915, 0),
      zone(-.22, .16, '#3fe0ff'), zone(.22, -.12, '#b07cff'), zone(-.22, -.12), zone(.22, .16),
      pot, kettle(black, .22, .93, -.12),
      at(rbox(.78, .5, .03, .015, black), 0, .42, .355), at(box(.62, .3, .012, '#3a3d43'), 0, .43, .381),
      at(rbox(.66, .025, .04, .012, '#c8ccd2'), 0, .72, .39),
      at(rbox(.3, .06, .02, .01, '#111316'), 0, .8, .35), at(box(.24, .035, .008, glow('#0a1a2a', '#3fe0ff', 1)), 0, .8, .369),
      at(led(.8, .012, .012, '#3fe0ff'), 0, .085, .352));
    stove.userData.seat = [.2, .93, .18];
    stove.userData.lightSource = true;
    return stove;
  },

  sink() {
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
  // Hồng: tủ hồng pastel, mặt kem, viền lượn sóng dưới mép quầy, vòi vàng, hộp bánh có trái tim, hũ pastel nắp vàng.
  'sink-pink'() {
    const pink = '#ffb3c8', rose = '#ff8fb6', cream = '#fff6f8', gold = '#f2c14e', legX = L_END - .7;
    const sink = group(...counterL({ body: '#ffe0e9', top: cream, kick: pink, door: '#ffc2d4', knob: gold, backsplash: true }),
      ...scallops([-.76, .84, .36], [legX - .02, .84, .36], pink), ...scallops([legX - .01, .84, .38], [legX - .01, .84, LEG_Z - .03], pink),
      at(rbox(.56, .03, .4, .015, '#ffc2d4'), -.25, .915, .03), at(rbox(.46, .012, .3, .006, '#ffe0e9'), -.25, .934, .03),
      tapBase(mat(gold, { metalness: .6, roughness: .35 }), -.25, -.22).translateY(.9),
      at(cyl(.03, .03, .14, rose), -.68, .97, -.18), at(rbox(.08, .03, .05, .012, gold), -.66, .915, .1),
      at(cyl(.06, .05, .1, cream), .65, .95, -.22), at(ball(.065, rose), .65, 1.04, -.22),
      at(rbox(.3, .17, .2, .04, rose), 1.2, .985, -.15), at(box(.2, .012, .012, gold), 1.2, 1.075, -.15), at(heart(.035, cream), 1.2, .99, -.04),
      ...[1.75, 2.0, 2.25].flatMap((x, k) => { const h = .2 - k * .03; return [at(cyl(.08, .08, h, ['#ffc2d4', '#e6d4ff', '#ffe0e9'][k], 16), x, .9 + h / 2, -.22), at(cyl(.085, .085, .02, gold, 16), x, .91 + h, -.22)]; }),
      group(at(cyl(.15, .09, .07, cream), 0, .035, 0), at(ball(.055, '#ff6b8a'), -.04, .1, 0), at(ball(.055, '#ffc2a0'), .05, .1, .03)).translateX(3.1).translateY(.9).translateZ(1.0),
      at(cyl(.045, .04, .09, '#e6d4ff', 12), 3.0, .945, 1.9), at(rbox(.3, .02, .2, .01, pink), 3.1, .91, 1.5));
    sink.userData.seat = [.4, .92, .08];
    sink.userData.tap = [-.25, 1.2, -.12];
    return sink;
  },
  // Hiện đại: quầy thép hai hộc, máy pha cà phê đen, dải LED cyan dưới mép quầy.
  'sink-steel'() {
    const dark = '#6f7680', chr = chrome(), legX = L_END - .7;
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
      at(rbox(.5, .03, .32, .012, '#9aa0a8'), 3.1, .915, 1.2), ...[0, 1, 2].map(k => at(cyl(.1, .1, .02, '#fffaf0', 20), 3.1, .94 + k * .02, 1.2)),
      at(led(legX + .76, .012, .012, '#3fe0ff'), (legX - .76) / 2, .84, .345), at(led(.012, .012, LEG_Z - .37, '#3fe0ff'), legX + .005, .84, (LEG_Z + .35) / 2));
    sink.userData.seat = [.14, .92, .1];
    sink.userData.tap = [-.33, 1.28, -.15];
    sink.userData.lightSource = true;
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
  // Hồng: tủ bát hồng, giá đĩa phía trên, viền lượn sóng ở mũ tủ + mặt tủ dưới, trái tim trên cửa, núm vàng.
  'pantry-hutch'() {
    const pink = '#ffc2d4', cream = '#fff6f8', rose = '#ff8fb6', gold = '#f2c14e';
    const plate = (x, y) => group(at(cyl(.12, .12, .02, '#ffffff', 24), 0, 0, 0).rotateX(Math.PI / 2), at(cyl(.08, .08, .03, rose, 20), 0, 0, 0).rotateX(Math.PI / 2)).translateX(x).translateY(y).translateZ(-.06);
    const hutch = group(at(rbox(1.0, .9, .5, .04, pink), 0, .47, 0), at(rbox(1.06, .04, .54, .02, cream), 0, .94, 0),
      ...scallops([-.5, .91, .275], [.5, .91, .275], rose, .022),
      ...[-1, 1].flatMap(s => [at(rbox(.44, .7, .03, .015, '#ffe0e9'), s * .245, .5, .265), at(ball(.025, gold), s * .06, .62, .29), at(heart(.05, rose), s * .245, .52, .29),
        at(rbox(.04, 1, .3, .015, pink), s * .48, 1.46, -.1)]),
      at(box(.92, 1, .03, '#ffb3c8'), 0, 1.46, -.2), at(rbox(.92, .03, .3, .012, cream), 0, 1.2, -.08), at(rbox(.92, .03, .3, .012, cream), 0, 1.6, -.08),
      at(rbox(1.04, .06, .36, .03, cream), 0, 1.98, -.08), ...scallops([-.5, 1.94, .1], [.5, 1.94, .1], rose, .025),
      plate(-.3, 1.34), plate(0, 1.34), plate(.3, 1.34),
      ...[-.3, 0, .3].map((x, k) => at(cyl(.035, .03, .08, k % 2 ? '#e6d4ff' : gold, 12), x, 1.655, -.1)),
      ...[-.3, .3].map(x => at(cyl(.03, .03, .08, '#e6d4ff', 12), x, 1.255, .0)));
    hutch.userData.seat = [.2, 2.01, -.05];
    return hutch;
  },
  // Hiện đại: tủ thông minh đen nhám, cửa trên kính khói, màn hình cảm ứng, dải LED cyan giữa hai cánh.
  'pantry-modern'() {
    const body = '#26282c', panel = '#3a3d43', bar = '#c8ccd2';
    const pantry = group(at(rbox(.96, .06, .46, .02, '#1f2125'), 0, .03, 0), at(rbox(1.0, 1.9, .5, .03, body), 0, .98, 0), at(rbox(1.04, .05, .54, .02, '#1f2125'), 0, 1.955, 0),
      ...[-1, 1].flatMap(s => [at(rbox(.47, .9, .03, .015, panel), s * .245, 1.45, .265), at(box(.4, .8, .012, glass('#6f8190', .5)), s * .245, 1.45, .292),
        at(rbox(.47, .85, .03, .015, panel), s * .245, .5, .265), at(rbox(.025, .4, .04, .012, bar), s * .04, .6, .3)]),
      at(led(.012, .9, .012, '#3fe0ff'), 0, 1.45, .29),
      at(rbox(.16, .22, .02, .008, '#111316'), .3, 1.2, .309), at(box(.12, .16, .006, glow('#0a1a2a', '#3fe0ff', 1)), .3, 1.2, .328),
      at(rbox(.14, .2, .14, .03, '#3a3d43'), -.3, 2.08, 0));
    pantry.userData.seat = [.25, 1.98, 0];
    pantry.userData.lightSource = true;
    return pantry;
  },

  dining() {
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
  // Hồng: bàn tròn chân trụ, khăn ca-rô hồng, diềm lượn sóng, nơ trái tim, bánh kem trên đĩa chân cao, bình hoa lilac.
  'dining-pink'() {
    const cloth = mat('#fff0f4', { map: gingham(), roughness: .95 }), gold = '#f2c14e', cream = '#fff6f8', rose = '#ff8fb6';
    const mug = cup(rose, .3, .755, .25);
    const flowers = [[-.02, rose], [.02, '#e6d4ff'], [0, cream]].map(([dx, color], k) => group(at(cyl(.006, .006, .14, '#5fa83e', 6), dx, .09, 0), at(ball(.04, color), dx, .17 + k * .02, 0)));
    const cake = group(at(cyl(.02, .03, .08, gold, 10), 0, .04, 0), at(cyl(.1, .1, .015, gold, 20), 0, .0875, 0), at(cyl(.08, .08, .08, '#ffc2d4', 20), 0, .135, 0),
      ...ringScallops(.075, .177, cream, .018), at(ball(.025, '#e8486a'), 0, .2, 0)).translateX(-.28).translateY(.755).translateZ(-.2);
    const table = group(at(cyl(.4, .4, .05, cream), 0, .025, 0), at(ring(.4, .012, gold), 0, .05, 0).rotateX(Math.PI / 2), at(cyl(.09, .12, .66, '#ffc2d4', 16), 0, .38, 0),
      at(cyl(.74, .76, .1, '#ffb3c8'), 0, .665, 0), ...ringScallops(.76, .615, cream, .04), at(cyl(.76, .76, .04, cloth), 0, .735, 0),
      at(heart(.05, rose), 0, .665, .78), cake,
      group(at(cyl(.045, .04, .14, '#e6d4ff', 12), 0, .07, 0), ...flowers).translateX(.32).translateY(.755).translateZ(-.3),
      mug);
    table.userData.mug = mug;
    table.userData.seat = [-.3, .76, .3];
    table.userData.top = .755;
    return table;
  },
  // Hiện đại: mặt kính trên khung đen, dải LED cyan / magenta dưới mép khung, bát chanh đen, bình hoa trắng.
  'dining-modern'() {
    const black = '#1f2125';
    const mug = cup('#f5f8fb', .3, .755, .25);
    const table = group(...[[-.55, -.35], [.55, -.35], [-.55, .35], [.55, .35]].map(([x, z]) => at(rbox(.05, .69, .05, .02, black), x, .345, z)),
      at(rbox(1.16, .04, .76, .015, black), 0, .7, 0), at(rbox(1.36, .03, .96, .012, glass('#bfe3f2', .45)), 0, .74, 0),
      at(led(1.08, .012, .012, '#3fe0ff'), 0, .7, .392), at(led(1.08, .012, .012, '#ff4fd8'), 0, .7, -.392),
      at(cyl(.13, .08, .06, '#26282c', 20), -.28, .785, -.2), ...[[-.04, 0], [.05, .03], [0, -.05]].map(([dx, dz]) => at(ball(.05, '#ffe066'), -.28 + dx, .83, -.2 + dz)),
      at(cyl(.035, .045, .22, '#f5f8fb', 14), .32, .865, -.3), ...[-.02, .02].map((dx, k) => group(at(cyl(.005, .005, .14, '#5fa83e', 6), 0, 0, 0), at(ball(.03, '#f5f8fb'), 0, .07, 0)).translateX(.32 + dx).translateY(1.02 + k * .03).translateZ(-.3)),
      mug);
    table.userData.mug = mug;
    table.userData.seat = [-.3, .755, .3];
    table.userData.top = .755;
    table.userData.lightSource = true;
    return table;
  },

  // ===== Ghế: bốn ghế gỗ / bốn ghế đẩu / hai ghế dài + hai ghế đôn, xếp quanh bàn ăn (gốc model = tâm bàn ăn) =====
  kchair() {
    const set = around(() => woodChair('#d9a36a', '#ffd66b'));
    set.userData.seat = [-1.33, .53, 0];
    set.userData.approach = [-1.95, 0, 0];
    return set;
  },
  // Hiện đại: ghế bar đen, vòng gác chân là dải LED cyan.
  'kchair-stool'() {
    const stool = () => group(...legs4(.12, .12, .6, '#1f2125', .02), at(cyl(.2, .2, .06, '#26282c', 24), 0, .63, 0),
      at(ring(.17, .01, glow('#3fe0ff', '#3fe0ff', 1.2)), 0, .25, 0).rotateX(Math.PI / 2));
    const set = around(stool);
    set.userData.seat = [-1.35, .67, 0];
    set.userData.approach = [-1.95, 0, 0];
    set.userData.lightSource = true;
    return set;
  },
  // Hồng: ghế dài khung kem đệm hồng, gối trái tim; hai đôn hồng viền lượn sóng.
  'kchair-bench'() {
    const bench = () => group(...legs4(.58, .15, .38, '#fff6f8', .035), at(rbox(1.3, .06, .4, .025, '#fff6f8'), 0, .41, 0), at(rbox(1.2, .1, .34, .045, '#ffb3c8'), 0, .49, 0),
      at(heart(.11, '#ff8fb6'), -.4, .66, -.08), at(heart(.1, '#e6d4ff'), .35, .64, -.1));
    const pouf = () => group(at(cyl(.25, .25, .34, '#ffc2d4', 24), 0, .17, 0), at(cyl(.2, .2, .02, '#ffe0e9', 20), 0, .34, 0), ...ringScallops(.25, .03, '#fff6f8', .03));
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
  // Hồng: hồng môn (anthurium) — mo hoa hồng hình trái tim có nhụy vàng, lá xanh bóng, chậu hồng chấm bi viền vàng.
  'kplant-pink'() {
    const leaves = group(), tones = ['#3f8a3a', '#4f9a3a', '#5fae46'];
    leaves.position.y = .34;
    for (let i = 0; i < 9; i++) {
      const flower = i % 2 === 1, a = i * 2.4, L = flower ? .5 + (i % 3) * .06 : .3 + (i % 3) * .08, tilt = flower ? .3 + (i % 3) * .1 : .55 + (i % 4) * .12, pivot = group();
      pivot.rotation.y = a;
      const tip = new THREE.Vector3(0, Math.cos(tilt) * L, Math.sin(tilt) * L);
      const stalk = at(cyl(.008, .01, L, '#5a9a3e', 6), 0, tip.y / 2, tip.z / 2);
      stalk.rotation.x = tilt;
      if (flower) {
        const spathe = group(heart(.065, i % 4 === 1 ? '#ff8fb6' : '#ffb3c8'), at(cone(.014, .1, '#f2c14e', 8), 0, .02, .05).rotateX(1.1));
        spathe.position.set(0, tip.y + .05, tip.z + .02); spathe.rotation.x = -.5;
        pivot.add(stalk, spathe);
      } else {
        const leaf = squash(at(ball(.13, tones[i % 3]), 0, tip.y + .02, tip.z + .05), 1, .16, 1.35);
        leaf.rotation.x = tilt * .6;
        pivot.add(stalk, leaf);
      }
      leaves.add(pivot);
    }
    const dots = Array.from({ length: 8 }, (_, k) => at(ball(.022, '#fff6f8'), Math.cos(k / 8 * TAU) * .2, k % 2 ? .1 : .2, Math.sin(k / 8 * TAU) * .2));
    const plant = group(at(cyl(.22, .17, .32, '#ffc2d4'), 0, .16, 0), ...dots, at(cyl(.235, .235, .04, '#f2c14e'), 0, .32, 0), at(cyl(.2, .2, .02, '#5a3a22'), 0, .335, 0), leaves);
    plant.userData.leaves = leaves;
    return plant;
  },
  // Hiện đại: cây sung lá to trong chậu đen, đèn grow-light tím treo trên cần đen cắm trong chậu.
  'kplant-fig'() {
    const leaves = group(), tones = ['#3f8a3a', '#4f9a3a', '#5fae46'], black = '#1f2125';
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, h = 1.0 + (i % 4) * .14, r = .1 + (i % 3) * .06, pivot = group();
      pivot.rotation.y = a;
      const leaf = squash(at(ball(.14, tones[i % 3]), 0, h, r + .12), 1, 1.3, .22);
      leaf.rotation.x = -.5;
      pivot.add(leaf);
      leaves.add(pivot);
    }
    const plant = group(at(cyl(.27, .21, .4, '#26282c'), 0, .2, 0), at(cyl(.28, .28, .04, '#3a3d43'), 0, .4, 0), at(cyl(.25, .25, .02, '#5a3a22'), 0, .415, 0),
      at(cyl(.035, .045, 1.0, '#8a6a45', 10), 0, .92, 0), leaves,
      at(cyl(.012, .012, 1.5, black, 8), .18, 1.17, -.16), at(box(.22, .02, .02, black), .08, 1.92, -.16),
      at(rbox(.34, .03, .1, .012, black), -.04, 1.92, -.16), at(led(.3, .01, .06, '#b07cff'), -.04, 1.895, -.16));
    plant.userData.leaves = leaves;
    plant.userData.lightSource = true;
    return plant;
  },

  catfood() {
    const wood = '#d9a36a', food = bowl('#e8617f', -.24, 0, .26), water = bowl('#8fc9f2', .24, 0, .26);
    const stand = group(...legs4(.4, .15, .2, '#9a6a45', .03), at(rbox(.95, .06, .4, .025, wood), 0, .23, 0), at(rbox(.95, .08, .04, .018, '#e9c58f'), 0, .17, .19),
      ...[-.28, 0, .28].map(x => at(cyl(.03, .03, .012, '#fffaf0', 10), x, .17, .216).rotateX(Math.PI / 2)), food, water,
      squash(at(ball(.13, '#b06a3a'), -.24, .365, 0), 1, .45, 1), at(cyl(.12, .12, .012, '#cfeaff', 20), .24, .36, 0));
    stand.userData.bowls = [[-.24, .38, 0], [.24, .38, 0]];
    return stand;
  },
  // Hồng: thảm hồng viền lượn sóng, chén hồng + chén kem, hũ bánh thưởng lilac nắp vàng có trái tim.
  'catfood-pink'() {
    const rose = '#ff8fb6', food = bowl('#ffb3c8', -.22, .02), water = bowl('#fff6f8', .22, .02);
    food.add(squash(at(ball(.13, '#b06a3a'), 0, .105, 0), 1, .45, 1));
    water.add(at(cyl(.12, .12, .012, '#cfeaff', 20), 0, .1, 0));
    const station = group(at(rbox(.9, .02, .55, .01, '#ffc2d4'), 0, .01, 0), ...scallops([-.44, .018, .28], [.44, .018, .28], rose, .025), ...scallops([-.44, .018, -.28], [.44, .018, -.28], rose, .025),
      food, water,
      at(cyl(.05, .05, .1, '#e6d4ff', 14), 0, .07, -.2), at(cyl(.052, .052, .03, '#f2c14e', 14), 0, .135, -.2), at(heart(.025, rose), 0, .07, -.145),
      ...[[-.3, .2], [-.16, .24], [-.04, .2]].map(([x, z]) => at(cyl(.025, .025, .004, rose, 10), x, .022, z)));
    station.userData.bowls = [[-.22, .13, .02], [.22, .13, .02]];
    return station;
  },
  // Hiện đại: máy cho ăn tự động — bình kính trên đế trắng, vòng LED cyan quanh đế, màn hình nhỏ.
  'catfood-feeder'() {
    const ledRing = () => at(ring(.15, .008, glow('#3fe0ff', '#3fe0ff', 1.2)), 0, .127, 0).rotateX(Math.PI / 2);
    const hopper = group(at(rbox(.34, .1, .34, .04, '#f5f8fb'), 0, .07, 0), at(cyl(.14, .14, .4, glass('#cfe3f5', .45)), 0, .32, 0), at(cyl(.15, .15, .04, '#26282c'), 0, .54, 0),
      ...[[-.05, .2], [.06, .26], [0, .34], [-.06, .4], [.05, .15]].map(([dx, y], k) => squash(at(ball(.04, '#b06a3a'), dx, y, k % 2 ? .03 : -.03), 1, .7, 1)),
      ledRing(), at(led(.1, .03, .008, '#3fe0ff'), 0, .07, .179));
    hopper.position.set(-.22, .0, -.08);
    const jug = group(at(rbox(.34, .1, .34, .04, '#f5f8fb'), 0, .07, 0), at(cyl(.13, .13, .36, glass('#9fd0f0', .5)), 0, .3, 0), at(cyl(.14, .14, .04, '#26282c'), 0, .5, 0), ledRing());
    jug.position.set(.22, .0, -.08);
    const food = bowl('#fffaf0', -.22, .2, .04), water = bowl('#8fc9f2', .22, .2, .04);
    food.scale.setScalar(.85); water.scale.setScalar(.85);
    const station = group(at(rbox(.92, .04, .66, .018, '#f5f8fb'), 0, .02, 0), hopper, jug, food, water);
    station.userData.bowls = [[-.22, .13, .2], [.22, .13, .2]];
    station.userData.lightSource = true;
    return station;
  },

  // ===== Xe đẩy =====
  // Gỗ: xe trà gỗ, ấm trà kem, cốc xanh sage, hộp + bánh ở tầng dưới.
  cart() {
    const mug = cup('#e8617f', .1, .795, .05);
    const teapot = group(squash(at(ball(.09, '#fffaf0'), 0, .077, 0), 1, .85, 1), at(ball(.025, '#e8617f'), 0, .165, 0), at(cyl(.012, .018, .1, '#fffaf0', 8), .12, .11, 0).rotateZ(-.8), at(ring(.05, .01, '#fffaf0'), -.1, .1, 0));
    teapot.position.set(.3, .795, .05);
    const cart = group(...cartFrame('#ffd66b', '#c8ccd2'), teapot, mug,
      at(rbox(.3, .06, .22, .02, '#e8617f'), -.2, .26, 0), at(rbox(.26, .06, .2, .02, '#3b8fe0'), -.2, .32, 0), at(cyl(.07, .06, .1, '#fffaf0', 14), .2, .28, 0), at(cyl(.1, .1, .02, '#f3c2cc', 20), .22, .34, 0), squash(at(ball(.07, '#ffe6ae'), .22, .38, 0), 1, .7, 1));
    return finishCart(cart, mug);
  },
  // Hồng: xe cà phê khay hồng nhạt, cột vàng, máy pha hồng, nơ trên tay đẩy.
  'cart-coffee'() {
    const rose = '#ff8fb6', gold = '#f2c14e';
    const mug = cup('#fff6f8', -.3, .795, .12);
    const machine = group(at(rbox(.34, .3, .3, .05, '#ffb3c8'), 0, .15, 0), at(rbox(.36, .04, .32, .015, '#fff6f8'), 0, .32, 0), at(cyl(.06, .06, .1, '#fff6f8', 14), 0, .39, -.05),
      at(rbox(.12, .05, .1, .02, '#3a3d43'), -.06, .2, .17), at(rbox(.12, .05, .1, .02, '#3a3d43'), .06, .2, .17), at(ball(.025, gold), 0, .27, .16), at(rbox(.3, .02, .1, .01, gold), 0, .03, .18));
    machine.position.set(.22, .795, -.02);
    const bow = group(squash(at(ball(.05, rose), -.055, 0, 0), 1, .7, .6), squash(at(ball(.05, rose), .055, 0, 0), 1, .7, .6), at(ball(.026, gold), 0, 0, 0));
    bow.position.set(0, .98, -.2);
    const cart = group(...cartFrame('#ffe0e9', gold), machine, mug, bow,
      at(cyl(.07, .07, .2, glass('#ffc2d4', .55)), -.25, .325, 0), at(cyl(.075, .075, .03, gold), -.25, .44, 0), at(cyl(.045, .04, .14, '#fff6f8', 14), .05, .29, .04),
      ...[0, 1, 2].map(k => at(cyl(.04, .035, .06, k % 2 ? rose : '#e6d4ff', 12), .22 + k * .02, .26 + k * .06, -.05)));
    return finishCart(cart, mug);
  },
  // Hiện đại: xe bar khung đen, chai rượu + bình lắc thép, dải LED cyan / magenta dưới mép hai khay.
  'cart-modern'() {
    const mug = cup('#f5f8fb', .1, .795, .05);
    const bottle = (x, z, color) => [at(cyl(.04, .04, .2, color, 12), x, .895, z), at(cyl(.015, .02, .07, color, 8), x, 1.03, z), at(cyl(.018, .018, .02, '#c8ccd2', 8), x, 1.075, z)];
    const cart = group(...cartFrame('#3a3d43', '#1f2125'), mug,
      ...bottle(.32, -.12, '#26282c'), ...bottle(.2, -.15, '#3a5a4a'),
      at(cyl(.035, .03, .16, steel(), 12), .34, .875, .1), at(cyl(.025, .035, .03, steel(), 12), .34, .97, .1),
      at(cyl(.1, .09, .14, steel(), 18), -.2, .3, 0), ...[.12, .26].map(x => at(cyl(.035, .03, .08, glass('#cfe3f5', .5), 12), x, .27, .05)),
      at(led(.74, .012, .012, '#3fe0ff'), 0, .755, .236), at(led(.74, .012, .012, '#ff4fd8'), 0, .19, .236));
    cart.userData.lightSource = true;
    return finishCart(cart, mug);
  },

  // ===== Kệ bánh (tường trái, cạnh cửa sang phòng khách): rộng .94, sâu .46, nóc cao ~1.32 — mèo nhảy lên nóc (seat) =====
  // Gốc: kệ bốn tầng khung xanh dương, mặt kệ vàng, nóc cam: giỏ trái cây + nồi đỏ tầng dưới, bánh mì + lọ tầng giữa,
  // chồng đĩa + cốc tầng trên, chậu rau thơm trên nóc.
  bakerack() {
    const post = '#3b8fe0', shelf = '#ffd66b';
    const loaf = (x, y, color) => squash(at(ball(.09, color), x, y, 0), 1.5, .65, 1);
    const fruit = [[-.29, '#e8463a'], [-.2, '#ffa53a'], [-.11, '#7fc45a'], [-.24, '#ffd23f'], [-.15, '#e8463a']];
    const rack = group(...[[-.43, -.18], [.43, -.18], [-.43, .18], [.43, .18]].flatMap(([x, z]) => [at(cyl(.022, .022, 1.3, post, 10), x, .65, z), at(ball(.03, '#e8617f'), x, .03, z)]),
      ...[.12, .5, .9].map(y => at(rbox(.92, .035, .42, .015, shelf), 0, y, 0)), at(rbox(.96, .04, .46, .02, '#ff6b4a'), 0, 1.3, 0),
      ...[-1, 1].map(s => at(ball(.03, '#e8617f'), s * .45, 1.35, .2)),
      at(cyl(.17, .13, .12, '#e0a050'), -.2, .2, 0), at(ring(.17, .012, '#c98a55'), -.2, .26, 0).rotateX(Math.PI / 2),
      ...fruit.map(([x, color], k) => at(ball(.05, color), x, k < 3 ? .28 : .32, k < 3 ? -.03 : .04)),
      at(cyl(.13, .12, .14, '#e8617f'), .22, .21, 0), at(cyl(.135, .135, .025, '#e8617f'), .22, .29, 0), at(ball(.025, '#fffaf0'), .22, .315, 0),
      loaf(-.27, .57, '#e0a050'), loaf(-.02, .57, '#d08a40'), ...jar('#ffd66b', '#e8617f', .22, .5175), ...jar('#bfe3a0', '#3b8fe0', .36, .5175, 0, .05, .16),
      ...[0, 1, 2].map(k => at(cyl(.13, .12, .02, ['#fffaf0', '#8fc9f2', '#fffaf0'][k], 20), -.2, .93 + k * .025, 0)),
      ...[[.12, '#3b8fe0'], [.27, '#7fc45a']].map(([x, color]) => at(cyl(.045, .04, .09, color, 14), x, .9625, .05)),
      at(cyl(.08, .065, .12, '#c9693d'), -.3, 1.38, -.05), ...[[-.33, 0], [-.27, .02], [-.3, -.04]].map(([x, dz], k) => at(ball(.05, k % 2 ? '#5fae46' : '#6fbf4a'), x, 1.46 + k * .02, -.05 + dz)));
    rack.userData.seat = [.15, 1.32, 0];
    return rack;
  },
  // Hồng: kệ khung hồng, mặt kem viền lượn sóng, núm vàng: bánh kem trên chân đế + hộp quà, cupcake, macaron trên giá hai tầng, tim trên nóc.
  'bakerack-pink'() {
    const pink = '#ffc2d4', rose = '#ff8fb6', cream = '#fff6f8', gold = '#f2c14e';
    const cupcake = (x, liner, frost) => [at(cyl(.045, .035, .06, liner, 12), x, .5475, 0), squash(at(ball(.05, frost), x, .59, 0), 1, .75, 1), at(ball(.014, '#e8463a'), x, .635, 0)];
    const macarons = (y, r) => ['#e6d4ff', '#bfe3a0', '#ffb3c8', '#ffe39a'].map((color, k) => squash(at(ball(.032, color), .2 + Math.cos(k / 4 * TAU) * r, y, Math.sin(k / 4 * TAU) * r), 1, .55, 1));
    const rack = group(...[[-.43, -.18], [.43, -.18], [-.43, .18], [.43, .18]].flatMap(([x, z]) => [at(cyl(.022, .022, 1.3, rose, 10), x, .65, z), at(ball(.03, gold), x, .03, z)]),
      ...[.12, .5, .9].flatMap(y => [at(rbox(.92, .035, .42, .015, cream), 0, y, 0), ...scallops([-.44, y - .035, .215], [.44, y - .035, .215], '#ffb3c8', .03)]),
      at(rbox(.96, .04, .46, .02, pink), 0, 1.3, 0), ...scallops([-.46, 1.265, .235], [.46, 1.265, .235], rose, .03),
      ...[-1, 1].map(s => at(ball(.032, gold), s * .45, 1.35, .2)), at(heart(.07, rose), .3, 1.43, -.17), at(ball(.02, gold), .3, 1.49, -.15),
      at(cyl(.07, .09, .02, gold, 16), -.2, .1475, 0), at(cyl(.02, .02, .1, gold, 8), -.2, .2075, 0), at(cyl(.16, .16, .02, cream, 24), -.2, .2675, 0),
      at(cyl(.12, .12, .1, '#ffb3c8', 24), -.2, .3275, 0), at(cyl(.125, .125, .025, cream, 24), -.2, .39, 0), ...ringScallops(.11, .405, rose, .018), at(ball(.025, '#e8463a'), -.2, .43, 0),
      at(rbox(.2, .16, .18, .02, '#ff8fb6'), .22, .2175, 0), at(box(.04, .162, .182, gold), .22, .2175, 0), squash(at(ball(.035, gold), .22, .31, 0), 1.4, .7, 1),
      ...cupcake(-.32, rose, cream), ...cupcake(-.14, '#e6d4ff', '#ffb3c8'), ...cupcake(.04, gold, cream), ...jar('#ffb3c8', gold, .3, .5175),
      at(cyl(.015, .015, .26, gold, 8), .2, 1.05, 0), at(cyl(.13, .13, .015, cream, 20), .2, .945, 0), at(cyl(.09, .09, .015, cream, 20), .2, 1.08, 0),
      ...macarons(.97, .08), ...macarons(1.1, .05),
      at(cyl(.06, .05, .1, cream, 14), -.25, .9675, 0), at(ring(.03, .008, rose), -.18, .975, 0), at(heart(.025, rose), -.25, .97, .062));
    rack.userData.seat = [-.15, 1.32, 0];
    return rack;
  },
  // Hiện đại: tháp lò nướng âm tủ đen nhám — hai lò cửa kính hắt cam, tay nắm thép, màn hình cảm ứng cyan, dải LED cyan hai bên + magenta dưới nóc.
  'bakerack-modern'() {
    const body = '#26282c', panel = '#3a3d43', black = '#1f2125';
    const oven = y => [at(rbox(.72, .4, .03, .012, panel), 0, y, .24), at(box(.54, .2, .012, glow('#3a2418', '#ff9a4a', .7)), 0, y - .03, .267),
      at(rbox(.5, .025, .04, .012, '#c8ccd2'), 0, y + .14, .275)];
    const tower = group(at(rbox(.86, .06, .42, .02, black), 0, .03, 0), at(rbox(.9, 1.24, .45, .03, body), 0, .68, 0), at(rbox(.94, .04, .48, .02, black), 0, 1.32, 0),
      ...oven(.96), ...oven(.5), at(rbox(.72, .14, .03, .012, panel), 0, .17, .24), at(rbox(.3, .02, .03, .01, '#c8ccd2'), 0, .2, .265),
      at(rbox(.22, .06, .02, .008, '#111316'), .2, 1.235, .235), at(box(.18, .035, .006, glow('#0a1a2a', '#3fe0ff', 1)), .2, 1.235, .256),
      ...[-.25, -.12].map(x => at(cyl(.022, .022, .03, steel(), 12), x, 1.235, .24).rotateX(Math.PI / 2)),
      ...[-1, 1].map(s => at(led(.012, 1.1, .012, '#3fe0ff'), s * .405, .7, .232)), at(led(.86, .012, .012, '#ff4fd8'), 0, 1.285, .236));
    tower.userData.seat = [0, 1.34, 0];
    tower.userData.lightSource = true;
    return tower;
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
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.7, .8), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, userData: { nightDim: true, wallKeep: true } }));
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
