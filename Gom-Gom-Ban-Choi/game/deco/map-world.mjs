// Bản đồ saga 3D: con đường nằm trên một "trống cỏ" khổng lồ (hình trụ nằm ngang) như thế giới cuộn của Animal Crossing.
// Lướt lên = trống lăn về phía trước, màn xa cong dần qua đường chân trời. Mỗi màn là khối đầu mèo nổi trên bệ tròn.
// Chỉ vẽ: dữ liệu màn / tiến độ do menu-controller.js truyền vào qua render(); chạm màn thì gọi onPick(index).
import * as THREE from 'three';
import { toonMat, toonLook, TOON_LIGHT, MAP_INK } from './toon.mjs';
import { roundedBox, mergeStatic } from './mesh-detail.mjs';
import { catModel, setCatFace } from './room-cats.mjs';

// R: bán kính trống; STEP: góc giữa hai màn (R * STEP = khoảng cách trên mặt cỏ, 4.4: các màn cách nhau thoáng, đủ chỗ
// trang trí giữa hai màn); SWING / FREQ: đường uốn sang hai bên.
const WORLD = { R: 11, STEP: .4, SWING: 1.55, FREQ: .95, ROAD: 1.05, EDGE: .2 };
// Khoảng cách trên mặt cỏ giữa hai màn liền nhau.
const LEVEL_GAP = WORLD.R * WORLD.STEP;
const INK = MAP_INK;
const SKY_FOG = 0x8ed4fc;
const COLORS = {
  grass: '#8fd16a', grassDark: '#79bf57',
  road: 0xfcd9a6, roadDone: 0xf9b6cb,
  body: { normal: 0xf2557f, chill: 0xf2557f, hard: 0xf2557f, boss: 0x6d2fd6, locked: 0x8a6f62 },
};
// Góc nhìn: camera đứng trên đỉnh trống nhìn chéo xuống; bề ngang thấy được ~ ±HALF_W đơn vị ở chỗ màn đang chọn.
const CAM = { height: 11.5, back: 9.5, aimAhead: -1, aimUp: 0, halfW: 3.9 };
// Màn đang chơi: bệ + khối đầu mèo phóng to hơn các màn khác.
const CURRENT_SCALE = 1.15;

const angleOf = t => t * WORLD.STEP;
const pathX = t => WORLD.SWING * Math.sin(t * WORLD.FREQ);
// Độ dốc ngang của đường (dx / quãng đi trên mặt cỏ) tại t: xoay dấu chân / hàng rào theo hướng đường.
const pathSlope = t => WORLD.SWING * WORLD.FREQ * Math.cos(t * WORLD.FREQ) / LEVEL_GAP;
// Chỗ đứng của mèo mới quanh màn `index` ([dx, dz, quay] so với tâm bệ; +dz = phía camera = t nhỏ hơn): rải ngẫu nhiên
// cả hai bên đường, mỗi con cách nhau ≥ CAT_SPREAD, cách tâm bệ ≥ `gap`, không đứng trên đường, không ra ngoài khung nhìn
// (CAM.halfW). Hạt giống theo màn nên lần nào dựng lại cũng y hệt; decorate() dùng cùng các chỗ này để chừa trống.
const CAT_SPREAD = 1.1;
// Mèo chờ nhận (Claim) đi vòng bán kính CLAIM_WALK quanh chỗ đứng; decorate() chừa trống bán kính CLAIM_CLEAR quanh chỗ đó.
const CLAIM_WALK = .45, CLAIM_CLEAR = 1.9;
function catSpots(index, count, gap) {
  let seed = 4421 + index * 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spots = [], x0 = pathX(index), limit = CAM.halfW - 1 - CLAIM_WALK;
  for (let tries = 0; spots.length < count && tries < 200; tries++) {
    const dx = (rnd() < .5 ? -1 : 1) * (gap + rnd() * 1.4), dz = -.5 + rnd() * 1.6, t = index - dz / LEVEL_GAP;
    if (Math.abs(x0 + dx) > limit || Math.hypot(dx, dz) < gap) continue;
    if (Math.abs(x0 + dx - pathX(t)) < WORLD.ROAD / 2 + WORLD.EDGE + .45) continue;
    if (spots.some(([x, z]) => Math.hypot(x - dx, z - dz) < CAT_SPREAD)) continue;
    spots.push([dx, dz, (rnd() - .5) * 1.1]);
  }
  // Không đủ chỗ (hiếm): xếp hàng phía mép màn hình như cũ.
  const side = x0 >= 0 ? 1 : -1;
  while (spots.length < count) spots.push([side * (gap + spots.length * CAT_SPREAD), .2, -side * .3]);
  return spots;
}
// Điểm trên mặt trống (toạ độ của trống, chưa xoay): góc a đi về phía xa (-z) khi tăng.
const onDrum = (x, a, lift = 0) => new THREE.Vector3(x, (WORLD.R + lift) * Math.cos(a), -(WORLD.R + lift) * Math.sin(a));
// Bọc vật trong một nhóm đứng thẳng trên mặt trống tại (x, t): trục y của nhóm = pháp tuyến mặt trống.
function onDrumAt(object, x, t, lift = 0) {
  const holder = new THREE.Group(), a = angleOf(t);
  holder.position.copy(onDrum(x, a, lift));
  holder.rotation.x = -a;
  holder.userData.angle = a;
  holder.add(object);
  return holder;
}

// ---------- Bộ nhớ đệm dùng chung giữa các lần dựng lại bản đồ ----------
// Mỗi lần thắng màn bản đồ dựng lại: texture chữ / chất liệu theo màu tạo một lần rồi dùng lại (không tạo mới, không rò bộ nhớ GPU).
const cache = new Map();
const cached = (key, make) => cache.get(key) ?? cache.set(key, make()).get(key);
const matOf = (color, rim = 0) => cached(`toon|${color}|${rim}`, () => toonMat({ color, rim }));
const seeded = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- Texture vẽ bằng canvas ----------
function canvasTexture(w, h, draw, { repeat = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
// Cỏ lặp liền mép: mảng sáng tối + hoa trắng / hồng li ti (vẽ cả bản sao lệch W/H để ghép không lộ nối).
function grassTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = COLORS.grass; g.fillRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const wrapped = (x, y, paint) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) paint(x + dx, y + dy); };
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * h, r = 18 + rnd() * 40;
      g.fillStyle = rnd() < .5 ? '#9ad974' : COLORS.grassDark;
      g.globalAlpha = .45;
      wrapped(x, y, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * .6, 0, 0, Math.PI * 2); g.fill(); });
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.strokeStyle = '#5fa843'; g.lineWidth = 2.2; g.lineCap = 'round';
      wrapped(x, y, (px, py) => { g.beginPath(); g.moveTo(px - 3, py + 4); g.lineTo(px - 4, py - 3); g.moveTo(px + 2, py + 4); g.lineTo(px + 4, py - 4); g.stroke(); });
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, pink = rnd() < .4;
      wrapped(x, y, (px, py) => {
        g.fillStyle = pink ? '#ffb3c8' : '#ffffff';
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(px + Math.cos(a) * 3.6, py + Math.sin(a) * 3.6, 2.8, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(px, py, 2.2, 0, Math.PI * 2); g.fill();
      });
    }
  }, { repeat: true });
}
const PAW_PATH = new Path2D('M12 20.6c-3 0-5.5-1.8-5.5-4.3S9 11.4 12 11.4s5.5 2.4 5.5 4.9-2.5 4.3-5.5 4.3ZM5.6 12.4a2.4 2.6 0 1 1 0-5.2 2.4 2.6 0 0 1 0 5.2Zm4-3.6a2.5 2.7 0 1 1 0-5.4 2.5 2.7 0 0 1 0 5.4Zm4.8 0a2.5 2.7 0 1 1 0-5.4 2.5 2.7 0 0 1 0 5.4Zm4 3.6a2.4 2.6 0 1 1 0-5.2 2.4 2.6 0 0 1 0 5.2Z');
const pawMat = color => cached(`paw|${color}`, () => new THREE.MeshBasicMaterial({
  map: canvasTexture(64, 64, (g) => { g.scale(64 / 24, 64 / 24); g.fillStyle = color; g.fill(PAW_PATH); }), transparent: true, depthWrite: false,
}));
// Mặt trước khối đầu mèo: số trắng viền nâu (bóng nâu nhẹ phía dưới), ổ khoá trắng nếu chưa mở.
function faceMat(number, locked, boss = false) {
  return cached(`face|${number}|${locked}|${boss}`, () => new THREE.MeshBasicMaterial({ map: faceTexture(number, locked, boss), transparent: true, fog: true }));
}
function faceTexture(number, locked, boss) {
  return canvasTexture(256, 256, (g, w) => {
    const ink = boss && !locked ? '#3a1a6e' : '#5b2e1c', y = locked ? 100 : 132;
    g.font = `900 ${locked ? 124 : 158}px "Baloo 2", Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 22; g.strokeStyle = ink; g.fillStyle = ink;
    g.strokeText(String(number), w / 2, y + 7); g.fillText(String(number), w / 2, y + 7);
    g.strokeText(String(number), w / 2, y);
    g.fillStyle = '#fff'; g.fillText(String(number), w / 2, y);
    if (locked) {
      g.lineWidth = 11; g.strokeStyle = '#fff'; g.fillStyle = '#fff';
      g.beginPath(); g.arc(w / 2, 180, 17, Math.PI, 0); g.stroke();
      g.beginPath(); g.roundRect(w / 2 - 27, 178, 54, 40, 8); g.fill();
      g.fillStyle = '#8a6f62'; g.beginPath(); g.arc(w / 2, 195, 5, 0, Math.PI * 2); g.fill();
    }
  });
}
function signTexture(text, size = 38) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#7a4a2a';
    g.font = `800 ${size}px "Baloo 2", Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
  });
}

// ---------- Khối hình ----------
// Viền nâu kiểu sticker: vẽ lại khối ở mặt sau, phình nhẹ (đủ cho khối lồi như đầu mèo, bệ, cây).
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
// pad (đơn vị thế giới): nét dày đều mọi cạnh theo kích thước thật của khối, dùng cho khối dẹt (đầu mèo, tai).
// Bản LOD xa (lowDetail): bỏ viền — ở gần chân trời viền chỉ còn 1 px mà tốn gấp đôi số tam giác.
let lowDetail = false;
function withInk(mesh, grow = .05, pad = 0) {
  if (lowDetail) return mesh;
  const hull = new THREE.Mesh(mesh.geometry, inkMat);
  if (pad) {
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3()), center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    hull.scale.set((size.x + pad * 2) / size.x, (size.y + pad * 2) / size.y, (size.z + pad) / size.z);
    hull.position.copy(center).multiply(new THREE.Vector3(1, 1, 1).sub(hull.scale));
  } else hull.scale.setScalar(1 + grow);
  hull.raycast = () => {};
  mesh.add(hull);
  return mesh;
}
// Khối đầu mèo theo design: thân vuông bo tròn lớn, viền kem dày bao lòng màu (hồng / nâu), tai tròn đầu tách riêng
// (ngoài kem, trong hồng) cắm sau hai góc trên; ngoài cùng là viền nâu. Mọi hình đặt tâm ở gốc để viền phình đều.
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// Đa giác bo góc: mỗi đỉnh thay bằng cung bậc hai bán kính r.
function roundedPolygonShape(points, r) {
  const s = new THREE.Shape(), n = points.length, v = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  points.forEach((p, i) => {
    const prev = points[(i + n - 1) % n], next = points[(i + 1) % n];
    const lenPrev = Math.hypot(p[0] - prev[0], p[1] - prev[1]), lenNext = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const a = v(p, prev, Math.min(.45, r / lenPrev)), b = v(p, next, Math.min(.45, r / lenNext));
    if (!i) s.moveTo(...a); else s.lineTo(...a);
    s.quadraticCurveTo(p[0], p[1], ...b);
  });
  s.closePath();
  return s;
}
const extrude = (shape, depth, bevel) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .9, bevelSegments: 2, curveSegments: 7 });
  g.translate(0, 0, -depth / 2);
  return g;
};
const HEAD = { w: 1.22, h: 1.14, r: .42, depth: .24, bevel: .06, inset: .13 };
// Nửa bề dày khối đầu tính cả bo cạnh + viền nâu: khoảng mép sau cách tâm đáy (nâng khối đầu khi ngả, xem frame()).
const HEAD_BACK = HEAD.depth / 2 + HEAD.bevel + .04;
const HEAD_SET_BACK = .36; // khối đầu đứng lùi về sau tâm bục (mặt bục bán kính ~.66 nên mép sau khối đầu vẫn nằm trên bục)
const headGeo = {
  rim: extrude(roundedRectShape(HEAD.w, HEAD.h, HEAD.r), HEAD.depth, HEAD.bevel),
  face: extrude(roundedRectShape(HEAD.w - HEAD.inset * 2, HEAD.h - HEAD.inset * 2, HEAD.r - HEAD.inset * .8), .05, .03),
  ear: extrude(roundedPolygonShape([[-.24, -.14], [.2, -.14], [-.06, .26]], .1), .16, .045),
  earInner: extrude(roundedPolygonShape([[-.14, -.08], [.1, -.08], [-.04, .15]], .06), .03, .015),
};
const FACE_Z = HEAD.depth / 2 + HEAD.bevel + .02, FACE_GEO = new THREE.PlaneGeometry(1.14, 1.14);

// Cây kiểu Animal Crossing: thân nâu + tán tròn / tán nón; bụi cây; hoa 3D nhỏ; đá.
const decorMats = {
  trunk: toonMat({ color: 0x9a6a43 }), leaf: toonMat({ color: 0x5fb548 }), leafDark: toonMat({ color: 0x3f9a45 }), pine: toonMat({ color: 0x3e8f4a }),
  bush: toonMat({ color: 0x6cc154 }), rock: toonMat({ color: 0xb8b0a2 }), petal: toonMat({ color: 0xffffff }), petalPink: toonMat({ color: 0xff9ec0 }), heart: toonMat({ color: 0xffd23f }),
};
// Hình học dùng chung cho đồ trang trí (kích thước khác nhau thì scale mesh), không tạo lưới mới cho mỗi món.
const DECOR_GEO = {
  trunk: new THREE.CylinderGeometry(.11, .15, .7, 8), cone: [new THREE.ConeGeometry(.62, .85, 9), new THREE.ConeGeometry(.46, .85, 9)],
  crown: new THREE.SphereGeometry(.62, 14, 10), ball: new THREE.SphereGeometry(1, 12, 8), petal: new THREE.SphereGeometry(.07, 6, 4),
  heart: new THREE.SphereGeometry(.055, 6, 4), rock: new THREE.DodecahedronGeometry(1, 0),
  stem: new THREE.CylinderGeometry(.045, .06, .16, 8), cap: new THREE.SphereGeometry(.15, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
};
// Bản LOD xa: cùng hình, ít cạnh hơn (~1/3 số tam giác).
const DECOR_LOW = {
  trunk: new THREE.CylinderGeometry(.11, .15, .7, 5), cone: [new THREE.ConeGeometry(.62, .85, 6), new THREE.ConeGeometry(.46, .85, 6)],
  crown: new THREE.SphereGeometry(.62, 8, 6), ball: new THREE.SphereGeometry(1, 7, 5),
};
const dg = name => (lowDetail && DECOR_LOW[name]) || DECOR_GEO[name];
function tree(rnd) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(dg('trunk'), decorMats.trunk);
  trunk.position.y = .35; g.add(trunk);
  if (rnd() < .45) {
    for (let k = 0; k < 2; k++) {
      const cone = new THREE.Mesh(dg('cone')[k], decorMats.pine);
      cone.position.y = .85 + k * .45; g.add(withInk(cone, .04));
    }
  } else {
    const crown = new THREE.Mesh(dg('crown'), rnd() < .5 ? decorMats.leaf : decorMats.leafDark);
    crown.position.y = 1.15; crown.scale.y = .92; g.add(withInk(crown, .04));
  }
  g.scale.setScalar(.85 + rnd() * .45);
  return g;
}
function bush(rnd) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const ball = new THREE.Mesh(dg('ball'), decorMats.bush);
    ball.scale.setScalar(.28 + rnd() * .1);
    ball.position.set((k - 1) * .3, .2 + (k === 1 ? .08 : 0), rnd() * .1);
    g.add(withInk(ball, .05));
  }
  return g;
}
function flower(rnd) {
  const g = new THREE.Group(), mat = rnd() < .45 ? decorMats.petalPink : decorMats.petal;
  for (let k = 0; k < 5; k++) {
    const petal = new THREE.Mesh(DECOR_GEO.petal, mat);
    const a = k / 5 * Math.PI * 2;
    petal.position.set(Math.cos(a) * .08, .12, Math.sin(a) * .08);
    g.add(petal);
  }
  const heart = new THREE.Mesh(DECOR_GEO.heart, decorMats.heart);
  heart.position.y = .14; g.add(heart);
  return g;
}
function rock(rnd) {
  const m = new THREE.Mesh(DECOR_GEO.rock, decorMats.rock), s = .22 + rnd() * .12;
  m.scale.set(s, s * .6, s); m.position.y = .08; m.rotation.y = rnd() * 3;
  return withInk(m, .06);
}
// Trang trí thêm hai bên đường: nấm, khóm hoa, cụm cỏ, hàng rào gỗ, đèn lồng, biển chỉ đường, ao nhỏ, bướm.
// Mọi món tĩnh được gộp theo chất liệu từng đoạn đường (mergeStatic) nên thêm nhiều món mà không tăng lệnh vẽ.
const sceneryMats = {
  cap: toonMat({ color: 0xf2605a }), capPink: toonMat({ color: 0xff9ec0 }), stem: toonMat({ color: 0xfff1dc }),
  grass: toonMat({ color: 0x5fb548 }), wood: toonMat({ color: 0xc8925a }), pale: toonMat({ color: 0xf6e3c4 }),
  roof: toonMat({ color: 0xe0626f }), lamp: new THREE.MeshBasicMaterial({ color: 0xffe9a0, fog: true }),
  water: toonMat({ color: 0x7fd3f2, rim: .3 }), lily: toonMat({ color: 0x6cc154 }),
};
const DOT_GEO = new THREE.SphereGeometry(.025, 6, 5), TUFT_GEO = new THREE.ConeGeometry(.05, .2, 5);
function mushroom(rnd) {
  const g = new THREE.Group(), n = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const m = new THREE.Group(), s = k ? .65 + rnd() * .2 : 1;
    const stem = new THREE.Mesh(DECOR_GEO.stem, sceneryMats.stem);
    stem.position.y = .08; m.add(withInk(stem, .1));
    const cap = new THREE.Mesh(DECOR_GEO.cap, rnd() < .3 ? sceneryMats.capPink : sceneryMats.cap);
    cap.position.y = .14; cap.scale.y = .8; m.add(withInk(cap, .07));
    // Chấm trắng trên mũ nấm.
    for (let j = 0; j < 4; j++) {
      const a = j / 4 * Math.PI * 2 + rnd(), dot = new THREE.Mesh(DOT_GEO, sceneryMats.stem);
      dot.position.set(Math.cos(a) * .09, .23, Math.sin(a) * .09); m.add(dot);
    }
    m.scale.setScalar(s);
    m.position.set(k ? (rnd() - .5) * .4 : 0, 0, k ? (rnd() - .5) * .4 : 0);
    g.add(m);
  }
  g.scale.setScalar(1.4);
  return g;
}
function tuft() {
  const g = new THREE.Group();
  for (let j = 0; j < 3; j++) {
    const blade = new THREE.Mesh(TUFT_GEO, sceneryMats.grass);
    blade.position.set((j - 1) * .06, .09, 0); blade.rotation.z = (j - 1) * .35; g.add(blade);
  }
  return g;
}
// Khóm hoa: vài bông + cụm cỏ rải trong vòng bán kính ~.4.
function flowerPatch(rnd) {
  const g = new THREE.Group(), n = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, r = rnd() * .38, f = k % 3 === 2 ? tuft() : flower(rnd);
    f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    f.scale.setScalar(.8 + rnd() * .4);
    g.add(f);
  }
  return g;
}
// Hàng rào gỗ ngắn dọc trục z (cọc kem + hai thanh ngang), dài len.
function fence(len) {
  const g = new THREE.Group(), posts = Math.max(2, Math.round(len / .45) + 1);
  for (let k = 0; k < posts; k++) {
    const post = new THREE.Mesh(roundedBox(.1, .42, .1, 2, .03), sceneryMats.pale);
    post.position.set(0, .21, -len / 2 + k * len / (posts - 1)); g.add(withInk(post, .08));
  }
  for (const y of [.15, .3]) {
    const rail = new THREE.Mesh(roundedBox(.05, .06, len, 1, .02), sceneryMats.wood);
    rail.position.set(0, y, 0); g.add(withInk(rail, .08));
  }
  return g;
}
// Đèn lồng: cột gỗ, quả đèn tròn vàng sáng (camera nhìn từ trên vẫn thấy rõ), nắp nhỏ hồng trên đỉnh.
function lantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .055, .7, 8), sceneryMats.wood);
  post.position.y = .35; g.add(withInk(post, .1));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), sceneryMats.lamp);
  lamp.position.y = .84; lamp.scale.y = .9; g.add(withInk(lamp, .08));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .07, 12), sceneryMats.roof);
  cap.position.y = 1.01; g.add(withInk(cap, .1));
  return g;
}
// Biển chỉ đường: cột + tấm mũi tên chỉ về phía các màn sau.
function signpost() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .75, 8), sceneryMats.wood);
  post.position.y = .375; g.add(withInk(post, .1));
  const arrow = new THREE.Mesh(extrude(roundedPolygonShape([[-.28, -.1], [.14, -.1], [.14, -.17], [.3, 0], [.14, .17], [.14, .1], [-.28, .1]], .03), .05, .015), sceneryMats.pale);
  arrow.position.y = .62; arrow.rotation.y = Math.PI / 2; g.add(withInk(arrow, 0, .04));
  return g;
}
// Ao nhỏ: mặt nước bầu dục nhấc khỏi cỏ đủ để mép không chìm vào mặt trống cong, viền đá + lá súng + một bông hoa.
function pond(rnd) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(.75, 28), sceneryMats.water);
  water.rotation.x = -Math.PI / 2; water.scale.set(1.3, 1, 1); water.position.y = .04; water.receiveShadow = true;
  g.add(water);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, stone = rock(rnd);
    stone.scale.multiplyScalar(.45 + rnd() * .25);
    stone.position.set(Math.cos(a) * .98, 0, Math.sin(a) * .76);
    g.add(stone);
  }
  for (const [x, z] of [[-.35, .1], [.3, -.2]]) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .02, 14), sceneryMats.lily);
    pad.position.set(x, .055, z); g.add(pad);
  }
  const bloom = flower(rnd);
  bloom.position.set(-.35, -.04, .1); bloom.scale.setScalar(.8);
  g.add(bloom);
  return g;
}
// Bướm: thân nhỏ + hai cánh vỗ (cánh xoay quanh thân trong frame()); không gộp vì có phần cử động.
const WING_GEO = (() => { const g = new THREE.CircleGeometry(.09, 12); g.scale(1, .8, 1); g.translate(.08, 0, 0); g.rotateX(-Math.PI / 2); return g; })();
const WING_COLORS = [0xffb3d1, 0xfff07a, 0xbfe4ff, 0xffffff];
const BUG_GEO = new THREE.CylinderGeometry(.018, .018, .12, 6), BUG_MAT = new THREE.MeshBasicMaterial({ color: INK });
const WING_MATS = WING_COLORS.map(color => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true }));
function butterfly(rnd) {
  const g = new THREE.Group(), mat = WING_MATS[Math.floor(rnd() * WING_COLORS.length)];
  const body = new THREE.Mesh(BUG_GEO, BUG_MAT);
  body.rotation.x = Math.PI / 2; g.add(body);
  const wings = [-1, 1].map(side => { const w = new THREE.Mesh(WING_GEO, mat); w.scale.x = side; g.add(w); return w; });
  g.userData.wings = wings;
  g.position.y = .55;
  return g;
}

// ---------- Vùng trong nhà: phòng khách (màn 20–29), phòng ngủ (từ màn 30) ----------
// Ranh giới nằm giữa hai màn (t = chỉ số màn): màn 20 = index 19 nên phòng khách bắt đầu từ t = 18.5.
const ZONES = [
  { id: 'garden', from: -Infinity },
  { id: 'living', from: 18.5, label: 'Living Room', fog: 0xf7dfc0, wall: 'repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 22px,transparent 22px 44px),linear-gradient(#fde9cc,#f3cfa3)' },
  { id: 'bedroom', from: 28.5, label: 'Bedroom', fog: 0xe6d6f6, wall: 'radial-gradient(circle at 12px 12px,rgba(255,255,255,.5) 0 4px,transparent 5px) 0 0/32px 32px,linear-gradient(#efe4fd,#d8c4f1)' },
  { id: 'kitchen', from: 38.5, label: 'Kitchen', fog: 0xdff1ea, wall: 'linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(#e8f7f0,#c9e8dc)' },
];
const zoneAt = t => ZONES.reduce((z, next) => (t >= next.from ? next : z), ZONES[0]).id;
function floorTexture(kind) {
  return canvasTexture(512, 512, (g, w, h) => {
    let seed = kind === 'living' ? 31 : kind === 'kitchen' ? 73 : 57;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (kind === 'living') {
      // Sàn gỗ: 8 hàng ván, mỗi ván lệch nhịp, vân gỗ mảnh.
      const rows = 8, rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -rnd() * 200;
        while (x < w) {
          const len = 160 + rnd() * 140, tone = ['#d9a56b', '#cf9a5f', '#e2b47c', '#d49f64'][Math.floor(rnd() * 4)];
          g.fillStyle = tone; g.fillRect(x, r * rh, len, rh);
          g.strokeStyle = 'rgba(140,90,50,.25)'; g.lineWidth = 2;
          for (let k = 0; k < 2; k++) { const y = r * rh + rh * (.3 + rnd() * .4); g.beginPath(); g.moveTo(x + 10, y); g.bezierCurveTo(x + len * .3, y - 4, x + len * .6, y + 4, x + len - 10, y); g.stroke(); }
          g.fillStyle = '#a8713f'; g.fillRect(x, r * rh, 3, rh);
          x += len;
        }
        g.fillStyle = '#a8713f'; g.fillRect(0, r * rh, w, 3);
      }
    } else if (kind === 'kitchen') {
      // Sàn bếp: gạch caro kem / bạc hà, ron trắng, vài viên lốm đốm.
      const n = 8, s = w / n;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        g.fillStyle = (r + c) % 2 ? '#fff4e2' : '#a9dcc8'; g.fillRect(c * s, r * s, s, s);
        if (rnd() < .2) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(c * s + 8, r * s + 8, s * .3, s * .12); }
      }
      g.strokeStyle = '#f7fbf8'; g.lineWidth = 4;
      for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, h); g.moveTo(0, k * s); g.lineTo(w, k * s); g.stroke(); }
    } else {
      // Thảm phòng ngủ: tím nhạt, sọc mờ + tim / sao nhỏ.
      g.fillStyle = '#d9c7f2'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
      for (let i = 0; i < 22; i++) {
        const x = rnd() * w, y = rnd() * h;
        g.fillStyle = rnd() < .5 ? '#ffb3d1' : '#fff6c2';
        g.beginPath(); g.arc(x - 4, y, 5, 0, Math.PI * 2); g.arc(x + 4, y, 5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(x - 9, y + 2); g.lineTo(x, y + 12); g.lineTo(x + 9, y + 2); g.fill();
      }
    }
  }, { repeat: true });
}
const furnMats = {
  wood: toonMat({ color: 0xd59a5c }), woodDark: toonMat({ color: 0x9a6a43 }), white: toonMat({ color: 0xfff6ea }),
  sofa: [toonMat({ color: 0x7ec4cf }), toonMat({ color: 0xf2a65a }), toonMat({ color: 0xf28fa8 })], cushion: toonMat({ color: 0xffe08a }),
  pot: toonMat({ color: 0xe07a50 }), leaf: toonMat({ color: 0x5fb548 }), shade: new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: true }),
  books: [toonMat({ color: 0xf2605a }), toonMat({ color: 0x6aa8f0 }), toonMat({ color: 0xffd23f }), toonMat({ color: 0x8fd16a })],
  yarn: [toonMat({ color: 0xff8fb3 }), toonMat({ color: 0x8ec5ff }), toonMat({ color: 0xffd36e })],
  blanket: [toonMat({ color: 0xa98be0 }), toonMat({ color: 0xff9ec0 }), toonMat({ color: 0x8fd0c4 })], teddy: toonMat({ color: 0xc58b5a }),
  rug: [toonMat({ color: 0xf6c8a0 }), toonMat({ color: 0xffb3c8 }), toonMat({ color: 0xc9b3f0 })],
};
const choose = (rnd, list) => list[Math.floor(rnd() * list.length)];
const box = (w, h, d, mat, x = 0, y = 0, z = 0, ink = .06) => {
  const m = new THREE.Mesh(roundedBox(w, h, d, 2, Math.min(w, h, d) * .25), mat);
  m.position.set(x, y, z);
  return ink ? withInk(m, ink) : m;
};
function sofa(rnd, seats = 2) {
  const g = new THREE.Group(), mat = choose(rnd, furnMats.sofa), w = seats * .55 + .3;
  g.add(box(w, .26, .6, mat, 0, .2, 0), box(w, .42, .16, mat, 0, .45, -.24), box(.16, .36, .6, mat, -w / 2 + .08, .34, 0), box(.16, .36, .6, mat, w / 2 - .08, .34, 0));
  for (let k = 0; k < seats; k++) g.add(box(.5, .1, .42, mat, (k - (seats - 1) / 2) * .55, .38, .04, .08));
  g.add(box(.3, .28, .1, furnMats.cushion, -w / 2 + .35, .55, -.13, .1));
  return g;
}
function coffeeTable() {
  const g = new THREE.Group();
  g.add(box(.85, .08, .55, furnMats.wood, 0, .34, 0));
  for (const [x, z] of [[-.34, -.2], [.34, -.2], [-.34, .2], [.34, .2]]) g.add(box(.07, .32, .07, furnMats.woodDark, x, .16, z, .12));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.06, .05, .1, 10), furnMats.white);
  cup.position.set(.15, .43, .05); g.add(withInk(cup, .1));
  return g;
}
function pottedPlant(rnd, big = false) {
  const g = new THREE.Group(), s = big ? 1.5 : 1;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.18, .13, .28, 12), furnMats.pot);
  pot.position.y = .14; g.add(withInk(pot, .07));
  for (let k = 0; k < 5; k++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.13 + rnd() * .06, 10, 8), furnMats.leaf);
    const a = k / 5 * Math.PI * 2;
    leaf.position.set(Math.cos(a) * .12, .38 + (k % 2) * .12, Math.sin(a) * .12); leaf.scale.y = 1.3;
    g.add(withInk(leaf, .06));
  }
  g.scale.setScalar(s);
  return g;
}
function floorLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .9, 8), furnMats.woodDark);
  pole.position.y = .45; g.add(pole);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .05, 14), furnMats.woodDark);
  foot.position.y = .025; g.add(withInk(foot, .08));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.14, .24, .26, 14), furnMats.shade);
  shade.position.y = .98; g.add(withInk(shade, .07));
  return g;
}
// Tủ lạnh nhỏ (bản đồ khu bếp): thân trắng hai ngăn, tay nắm, nam châm màu.
function fridge(rnd) {
  const g = new THREE.Group();
  g.add(box(.6, 1.15, .5, furnMats.white, 0, .575, 0, .04));
  g.add(box(.56, .02, .02, furnMats.woodDark, 0, .8, .26, 0));
  for (const y of [.55, .98]) g.add(box(.04, .2, .04, furnMats.woodDark, .22, y, .27, 0));
  for (let k = 0; k < 2; k++) g.add(box(.07, .07, .02, choose(rnd, furnMats.books), -.16 + k * .12, .9 + rnd() * .15, .26, 0));
  return g;
}
function bookshelf(rnd) {
  const g = new THREE.Group();
  g.add(box(.95, .82, .32, furnMats.woodDark, 0, .41, 0, .04));
  for (let row = 0; row < 2; row++) {
    let x = -.38;
    while (x < .34) {
      const bw = .07 + rnd() * .05, bh = .2 + rnd() * .08;
      g.add(box(bw, bh, .22, choose(rnd, furnMats.books), x + bw / 2, .14 + row * .34 + bh / 2, .06, 0));
      x += bw + .015;
    }
  }
  return g;
}
function yarnBall(rnd) {
  const g = new THREE.Group(), mat = choose(rnd, furnMats.yarn);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 10), mat);
  ball.position.y = .16; g.add(withInk(ball, .08));
  for (let k = 0; k < 3; k++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(.16, .012, 6, 24), furnMats.white);
    band.position.y = .16; band.rotation.set(k * 1.1, k * .7, 0); g.add(band);
  }
  return g;
}
function floorCushion(rnd) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), rnd() < .5 ? furnMats.cushion : choose(rnd, furnMats.sofa));
  m.scale.set(1, .35, 1); m.position.y = .1;
  return withInk(m, .06);
}
// Thảm tròn hai lớp (thay ao nhỏ ở trong nhà).
function rug(rnd) {
  const g = new THREE.Group(), [a, b] = [choose(rnd, furnMats.rug), furnMats.white];
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .02, 36), a);
  outer.scale.z = .75; outer.position.y = .02; outer.receiveShadow = true; g.add(outer);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .02, 32), b);
  inner.scale.z = .75; inner.position.y = .03; inner.receiveShadow = true; g.add(inner);
  return g;
}
function bed(rnd) {
  const g = new THREE.Group();
  g.add(box(1, .22, 1.45, furnMats.wood, 0, .13, 0), box(1, .55, .1, furnMats.woodDark, 0, .4, -.72));
  g.add(box(.92, .12, 1.35, furnMats.white, 0, .3, 0, 0), box(.95, .1, .9, choose(rnd, furnMats.blanket), 0, .37, .25, .06));
  g.add(box(.6, .12, .26, furnMats.white, 0, .41, -.48, .08));
  return g;
}
function nightstand() {
  const g = new THREE.Group();
  g.add(box(.42, .4, .36, furnMats.wood, 0, .2, 0), box(.3, .02, .02, furnMats.woodDark, 0, .25, .19, 0));
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.08, .13, .16, 12), furnMats.shade);
  lamp.position.y = .55; g.add(withInk(lamp, .08));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .1, 6), furnMats.woodDark);
  stem.position.y = .44; g.add(stem);
  return g;
}
// Tủ ngăn kéo thấp (tủ cao nhìn từ trên xuống trông như đổ nghiêng).
function dresser(rnd) {
  const g = new THREE.Group(), mat = rnd() < .5 ? furnMats.white : furnMats.wood;
  g.add(box(.9, .6, .45, mat, 0, .3, 0, .04), box(.8, .02, .02, furnMats.woodDark, 0, .3, .23, 0));
  for (const [x, y] of [[-.2, .45], [.2, .45], [-.2, .15], [.2, .15]]) g.add(box(.12, .04, .04, furnMats.woodDark, x, y, .25, 0));
  return g;
}
function teddy() {
  const g = new THREE.Group(), m = furnMats.teddy, ball = (r, x, y, z) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m); s.position.set(x, y, z); g.add(withInk(s, .08)); };
  ball(.17, 0, .17, 0); ball(.13, 0, .42, .02); ball(.05, -.1, .53, 0); ball(.05, .1, .53, 0);
  ball(.06, -.15, .1, .1); ball(.06, .15, .1, .1);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), furnMats.white);
  snout.position.set(0, .4, .13); g.add(snout);
  return g;
}
function catBed(rnd) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .11, 10, 24), choose(rnd, furnMats.blanket));
  ring.rotation.x = Math.PI / 2; ring.position.y = .11; g.add(withInk(ring, .05));
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .06, 20), furnMats.white);
  pad.position.y = .05; g.add(pad);
  return g;
}
// ---------- Đồ khu bếp (màn 40–50): tông bạc hà / trắng hợp tường gạch men bạc hà và sàn gạch của vùng bếp ----------
const kitchenMats = {
  mint: toonMat({ color: 0x8fd0c4 }), mintDark: toonMat({ color: 0x5fae9f }), top: toonMat({ color: 0xfbfaf4 }), stove: toonMat({ color: 0x5a5f66 }),
  copper: toonMat({ color: 0xe08a4a }), bowl: [toonMat({ color: 0xf28fa8 }), toonMat({ color: 0x6aa8f0 }), toonMat({ color: 0xffd36e })],
  fruit: [toonMat({ color: 0xf2605a }), toonMat({ color: 0xffb347 }), toonMat({ color: 0x8fd16a })], basket: toonMat({ color: 0xc89058 }),
  kibble: toonMat({ color: 0xa8673a }), stripe: [toonMat({ color: 0x8fd0c4 }), toonMat({ color: 0xf6c8a0 })],
};
const cylMesh = (rt, rb, h, mat, x, y, z, ink = .07, seg = 14) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return ink ? withInk(m, ink) : m;
};
// Tủ bếp có bếp nấu: thân bạc hà, mặt đá trắng, hai bếp tròn, một nồi đồng.
function kitchenCounter(rnd) {
  const g = new THREE.Group();
  g.add(box(.95, .6, .5, kitchenMats.mint, 0, .3, 0, .04), box(1, .06, .55, kitchenMats.top, 0, .63, 0, .05));
  g.add(box(.02, .5, .02, kitchenMats.mintDark, 0, .3, .26, 0));
  for (const x of [-.06, .06]) g.add(box(.03, .1, .03, kitchenMats.top, x, .42, .27, 0));
  for (const x of [-.24, .24]) g.add(cylMesh(.12, .12, .02, kitchenMats.stove, x, .67, 0, 0));
  const side = rnd() < .5 ? -.24 : .24;
  g.add(cylMesh(.13, .11, .16, kitchenMats.copper, side, .76, 0), cylMesh(.14, .14, .02, kitchenMats.copper, side, .85, 0, .1));
  return g;
}
// Bàn ăn tròn nhỏ + hai ghế đối nhau.
function diningTable(rnd) {
  const g = new THREE.Group(), seat = rnd() < .5 ? kitchenMats.mint : furnMats.white;
  g.add(cylMesh(.36, .36, .05, furnMats.wood, 0, .5, 0, .05, 24), cylMesh(.05, .06, .48, furnMats.woodDark, 0, .24, 0, .1));
  g.add(cylMesh(.2, .22, .03, furnMats.woodDark, 0, .015, 0, 0));
  for (const s of [-1, 1]) {
    g.add(box(.32, .05, .3, seat, s * .58, .3, 0, .08), box(.05, .34, .3, seat, s * .74, .5, 0, .08));
    for (const z of [-.11, .11]) g.add(box(.04, .28, .04, furnMats.woodDark, s * .58, .14, z, 0));
  }
  g.add(cylMesh(.09, .07, .05, furnMats.white, .08, .55, .05, .1));
  return g;
}
function stool() {
  const g = new THREE.Group();
  g.add(cylMesh(.17, .17, .06, kitchenMats.mint, 0, .48, 0, .08));
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2, leg = box(.04, .46, .04, furnMats.woodDark, Math.cos(a) * .1, .23, Math.sin(a) * .1, 0);
    leg.rotation.set(Math.sin(a) * .12, 0, -Math.cos(a) * .12); g.add(leg);
  }
  return g;
}
// Hai bát ăn của mèo (một bát hạt, một bát nước).
function foodBowls(rnd) {
  const g = new THREE.Group();
  for (const [x, fill] of [[-.13, kitchenMats.kibble], [.13, furnMats.shade]]) {
    g.add(cylMesh(.11, .08, .07, choose(rnd, kitchenMats.bowl), x, .035, 0, .1));
    g.add(cylMesh(.09, .09, .01, fill, x, .07, 0, 0));
  }
  return g;
}
function fruitBasket(rnd) {
  const g = new THREE.Group();
  g.add(cylMesh(.2, .15, .14, kitchenMats.basket, 0, .07, 0, .08));
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * Math.PI * 2 + rnd(), fruit = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), choose(rnd, kitchenMats.fruit));
    fruit.position.set(Math.cos(a) * .08, .16 + (k === 3 ? .07 : 0), Math.sin(a) * .08); g.add(withInk(fruit, .1));
  }
  return g;
}
// Ba chậu rau thơm nhỏ xếp hàng (thay chậu cây to ở trong bếp).
function herbPots(rnd) {
  const g = new THREE.Group();
  for (let k = -1; k <= 1; k++) {
    g.add(cylMesh(.09, .07, .14, kitchenMats.copper, k * .2, .07, 0, .1));
    for (let j = 0; j < 3; j++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(.06 + rnd() * .03, 8, 6), furnMats.leaf);
      leaf.position.set(k * .2 + (j - 1) * .04, .2 + (j % 2) * .05, (rnd() - .5) * .06); leaf.scale.y = 1.4; g.add(withInk(leaf, .1));
    }
  }
  return g;
}
// Thảm bếp dài kẻ sọc (thay thảm tròn phòng khách).
function kitchenMat() {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, .02, .2), kitchenMats.stripe[k % 2]);
    stripe.position.set(0, .02, (k - 2) * .2); stripe.receiveShadow = true; g.add(stripe);
  }
  return g;
}
// Bảng rải đồ hai bên đường theo vùng (decorate()). Mỗi đoạn thử `tries` chỗ, đặt tối đa `max` món, cách đường tới ~`spread`
// (trong nhà gom vào dải thấy được trên màn dọc để ít món mà vẫn đủ đầy). Mỗi loại: r = bán kính
// chừa chỗ, w = trọng số chọn, cap = trần số lượng trong một đoạn, minDist = chỉ đặt cách đường từ chừng này (đồ cao không che
// màn), big = đồ to không lặp ở hai đoạn liền nhau, small = món nhỏ (không đổ bóng, bản LOD xa bỏ đi).
// make(rnd, dist) trả về hàm dựng model. Trong nhà mỗi loại tối đa 1 / đoạn và ít món hẳn để phòng không rối.
const SCATTER = {
  garden: { tries: 26, max: 13, spread: 5.2, kinds: [
    { kind: 'tree', make: () => tree, r: .7, w: 3, cap: 3, minDist: 2.3 },
    { kind: 'bush', make: () => bush, r: .5, w: 2, cap: 2 },
    { kind: 'patch', make: () => flowerPatch, r: .45, w: 2, cap: 2, shadow: false },
    { kind: 'mushroom', make: () => mushroom, r: .3, w: 1, cap: 1, small: true },
    { kind: 'flower', make: () => flower, r: .12, w: 2, cap: 3, small: true },
    { kind: 'tuft', make: () => tuft, r: .1, w: 1, cap: 2, small: true },
    { kind: 'rock', make: () => rock, r: .3, w: 1, cap: 1, small: true },
  ] },
  living: { tries: 22, max: 5, spread: 2.8, kinds: [
    { kind: 'shelf', make: () => bookshelf, r: .65, w: 2, cap: 1, minDist: 2.3, big: true },
    { kind: 'sofa', make: rnd => { const seats = rnd() < .4 ? 1 : 2; return g => sofa(g, seats); }, r: .75, w: 2, cap: 1, minDist: 1.6, big: true },
    { kind: 'table', make: () => coffeeTable, r: .5, w: 1.5, cap: 1 },
    { kind: 'plant', make: (rnd, dist) => g => pottedPlant(g, dist > 2.3), r: .35, w: 1.5, cap: 1 },
    { kind: 'yarn', make: () => yarnBall, r: .2, w: 1, cap: 1, small: true },
    { kind: 'cushion', make: () => floorCushion, r: .32, w: 1, cap: 1, small: true },
  ] },
  bedroom: { tries: 22, max: 5, spread: 2.8, kinds: [
    { kind: 'dresser', make: () => dresser, r: .6, w: 2, cap: 1, minDist: 2.3, big: true },
    { kind: 'bed', make: () => bed, r: .9, w: 2, cap: 1, minDist: 1.8, big: true },
    { kind: 'nightstand', make: () => nightstand, r: .3, w: 1.5, cap: 1 },
    { kind: 'catBed', make: () => catBed, r: .45, w: 1.5, cap: 1, shadow: false },
    { kind: 'teddy', make: () => teddy, r: .25, w: 1, cap: 1, small: true },
    { kind: 'cushion', make: () => floorCushion, r: .32, w: 1, cap: 1, small: true },
    { kind: 'yarn', make: () => yarnBall, r: .2, w: 1, cap: 1, small: true },
  ] },
  kitchen: { tries: 22, max: 5, spread: 2.8, kinds: [
    { kind: 'fridge', make: () => fridge, r: .45, w: 2, cap: 1, minDist: 2.3, big: true },
    { kind: 'counter', make: () => kitchenCounter, r: .65, w: 2, cap: 1, minDist: 2.3, big: true },
    { kind: 'dining', make: () => diningTable, r: .8, w: 2, cap: 1, minDist: 1.6, big: true },
    { kind: 'stool', make: () => stool, r: .25, w: 1.5, cap: 1 },
    { kind: 'herbs', make: () => herbPots, r: .35, w: 1.5, cap: 1 },
    { kind: 'bowls', make: () => foodBowls, r: .3, w: 1, cap: 1, small: true },
    { kind: 'fruit', make: () => fruitBasket, r: .25, w: 1, cap: 1, small: true },
  ] },
};
// Cổng chuyển vùng bắc ngang đường: hai cột + xà ngang + bảng tên phòng.
function zoneGate(label) {
  const g = new THREE.Group(), half = WORLD.ROAD / 2 + WORLD.EDGE + .25;
  for (const x of [-half, half]) g.add(box(.18, 1.5, .18, furnMats.woodDark, x, .75, 0));
  g.add(box(half * 2 + .4, .18, .22, furnMats.woodDark, 0, 1.55, 0));
  const board = box(1.7, .42, .08, furnMats.white, 0, 1.92, 0);
  g.add(board);
  const text = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .5), cached(`sign|${label}`, () => new THREE.MeshBasicMaterial({ map: signTexture(label, 84), transparent: true })));
  text.position.set(0, 1.92, .05); g.add(text);
  g.traverse(n => { if (n.isMesh) n.castShadow = true; });
  return g;
}

function startSignTexture() {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#7a4a2a';
    g.font = '800 84px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('START', w / 2, h / 2);
    g.fillStyle = '#ef5f8b';
    for (const x of [28, w - 28 - 64]) { g.save(); g.translate(x, h / 2 - 32); g.scale(64 / 24, 64 / 24); g.fill(PAW_PATH); g.restore(); }
  });
}
// Cổng xuất phát: hai trụ gỗ đứng ngoài mép nắp đường, xà ngang, biển "START" kem có hai dấu chân hồng, bi hồng trên đỉnh trụ.
// Biển đặt trên xà (không treo dưới) để mèo đi qua không vướng; hai thanh đỡ nhỏ nối xà với biển.
function startGate() {
  const g = new THREE.Group(), half = WORLD.ROAD / 2 + WORLD.EDGE + .2;
  for (const x of [-half, half]) {
    g.add(box(.36, .12, .36, sceneryMats.pale, x, .06, 0));
    g.add(box(.2, 1.33, .2, furnMats.wood, x, .78, 0));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), sceneryMats.capPink);
    ball.position.set(x, 1.57, 0); g.add(withInk(ball, .08));
  }
  g.add(box(half * 2 + .4, .2, .22, furnMats.woodDark, 0, 1.3, 0));
  for (const x of [-.5, .5]) g.add(box(.1, .3, .1, furnMats.woodDark, x, 1.46, 0));
  // Camera nhìn từ trên xuống nên biển ngả ra sau (mặt biển hướng lên camera) mới đọc được chữ.
  const sign = new THREE.Group();
  sign.position.y = 1.78; sign.rotation.x = -.7;
  sign.add(box(1.5, .5, .08, furnMats.white, 0, 0, 0));
  // Chữ + hai dấu chân vẽ chung một tấm (một lớp trong suốt duy nhất): tách thành nhiều tấm nhỏ thì thứ tự vẽ giữa chúng và
  // viền mờ dần nhảy lung tung khi cuộn, dấu chân chớp.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .4375), cached('sign|start-paws', () => new THREE.MeshBasicMaterial({
    map: startSignTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })));
  face.position.z = .055; face.renderOrder = 2; sign.add(face);
  g.add(sign);
  g.traverse(n => { if (n.isMesh) n.castShadow = true; });
  return g;
}

// ---------- Đánh dấu màn đang chơi (thay cho icon mèo cũ) ----------
// Quầng sáng mềm trên cỏ quanh bệ, ngôi sao vàng viền nâu lơ lửng trên đầu, vài đốm lấp lánh quanh khối đầu.
function haloTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,240,170,.95)');
    grad.addColorStop(.55, 'rgba(255,214,140,.7)');
    grad.addColorStop(.8, 'rgba(255,160,195,.35)');
    grad.addColorStop(1, 'rgba(255,160,195,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}
function sparkleTexture() {
  return canvasTexture(64, 64, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#fff6c2';
    g.beginPath(); g.moveTo(c, 2);
    g.quadraticCurveTo(c, c, w - 2, c); g.quadraticCurveTo(c, c, c, w - 2);
    g.quadraticCurveTo(c, c, 2, c); g.quadraticCurveTo(c, c, c, 2);
    g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, 5, 0, Math.PI * 2); g.fill();
  });
}
const STAR_GEO = extrude(roundedPolygonShape(Array.from({ length: 10 }, (_, k) => {
  const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? .12 : .27;
  return [Math.cos(a) * r, Math.sin(a) * r];
}), .035), .07, .03);
let currentFx = null;
const currentAssets = () => currentFx ??= {
  halo: new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, fog: true }),
  sparkle: new THREE.SpriteMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false }),
  star: toonMat({ color: 0xffd23f, rim: .45 }),
};

// ---------- Bệ màn boss: bục hoàng gia (các màn khác dùng bệ thường) ----------
// Đế bát giác vàng, thân bát giác tím (màn khoá: nâu xám) có đai vàng ở mép trên, tám viên đá quý hồng gắn quanh thân,
// hai cột vàng phía sau đỉnh đá quý; mặt bục tròn kem vàng. Hình học + vật liệu dùng chung mọi màn.
const PED = {
  base: new THREE.CylinderGeometry(.88, .95, .16, 8), body: new THREE.CylinderGeometry(.74, .8, .2, 8), plate: new THREE.CylinderGeometry(.64, .67, .07, 32),
  band: new THREE.TorusGeometry(.74, .035, 6, 8), gem: new THREE.OctahedronGeometry(.09, 0), post: new THREE.CylinderGeometry(.05, .06, .5, 8),
  petal: new THREE.SphereGeometry(.045, 8, 6),
};
const pedMat = {
  gold: toonMat({ color: 0xffc83d, rim: .4 }), goldLocked: toonMat({ color: 0xe0cdb8 }), plate: toonMat({ color: 0xfff3c9 }),
  gem: toonMat({ color: 0xff5fa8, rim: .5 }), gemLocked: toonMat({ color: 0xcdb8a6 }),
  body: { boss: toonMat({ color: 0x7b3fe4 }), locked: toonMat({ color: 0xb4a090 }) },
};
// Bệ thường (mọi màn trừ boss): đế tròn vàng đất + mặt kem, không trang trí.
const PLAIN_BASE = new THREE.CylinderGeometry(.72, .8, .26, 32), PLAIN_TOP = new THREE.CylinderGeometry(.66, .7, .08, 32);
const plainMat = { side: toonMat({ color: 0xe7c48f }), top: toonMat({ color: 0xfff1d6 }) };
function plainPedestal() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(PLAIN_BASE, plainMat.side); base.position.y = .13; base.castShadow = base.receiveShadow = true;
  const top = new THREE.Mesh(PLAIN_TOP, plainMat.top); top.position.y = .3; top.receiveShadow = true;
  g.add(withInk(base, .04), top);
  return { group: g, parts: [base, top], top: .34 };
}
function pedestal(kind) {
  const g = new THREE.Group(), locked = kind === 'locked';
  const gold = locked ? pedMat.goldLocked : pedMat.gold, gem = locked ? pedMat.gemLocked : pedMat.gem;
  const base = new THREE.Mesh(PED.base, gold); base.position.y = .08; base.rotation.y = Math.PI / 8;
  const body = new THREE.Mesh(PED.body, pedMat.body[kind]); body.position.y = .26; body.rotation.y = Math.PI / 8;
  const plate = new THREE.Mesh(PED.plate, pedMat.plate); plate.position.y = .395;
  for (const m of [base, body]) { m.castShadow = m.receiveShadow = true; g.add(withInk(m, .035)); }
  plate.receiveShadow = true; g.add(plate);
  // Đai vàng quanh mép trên thân bục.
  const band = new THREE.Mesh(PED.band, gold); band.rotation.order = 'YXZ'; band.rotation.set(Math.PI / 2, Math.PI / 8, 0); band.position.y = .355; g.add(band);
  // Tám đá quý gắn ra ngoài tám mặt thân bục.
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, m = new THREE.Mesh(PED.gem, gem);
    m.position.set(Math.sin(a) * .8, .26, Math.cos(a) * .8); m.scale.set(1, 1.3, .8); m.rotation.y = a; g.add(m);
  }
  // Hai cột vàng phía sau, đỉnh gắn đá quý.
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(PED.post, gold); post.position.set(side * .78, .41, -.5); post.castShadow = true; g.add(withInk(post, .05));
    const top = new THREE.Mesh(PED.gem, gem); top.position.set(side * .78, .72, -.5); top.scale.setScalar(1.2); g.add(top);
  }
  return { group: g, parts: [base, body, plate], top: .43 };
}
// Mèo 3D (cùng model với Home) đứng cạnh màn mở giống mới, có viền nâu kiểu sticker như khối đầu mèo.
// Mèo trên bản đồ chỉ cao vài chục px: model của Deco (thân 10 phân đoạn, đuôi / chân / bàn chân 14–20 cạnh) quá mịn.
// coarse: thay lưới bằng bản ít cạnh (cùng kích thước, dùng chung giữa các con); mặt / mắt và tai (lưới đã uốn) giữ nguyên.
function coarsen(mesh) {
  const g = mesh.geometry, p = g.parameters || {};
  let key = null, make = null;
  if (g.type === 'BoxGeometry' && g.attributes.position.count > 600) {
    // Thân hộp bo góc (RoundedBoxGeometry): đo kích thước thật từ khung bao.
    g.computeBoundingBox();
    const size = g.boundingBox.getSize(new THREE.Vector3());
    key = `box|${size.toArray().map(n => n.toFixed(3))}`;
    make = () => roundedBox(size.x, size.y, size.z, 3, Math.min(size.x, size.y, size.z) * .2);
  } else if (g.type === 'CapsuleGeometry' && p.radialSegments > 8) {
    key = `cap|${p.radius}|${p.length}`;
    make = () => new THREE.CapsuleGeometry(p.radius, p.length, 3, 8);
  } else if (g.type === 'SphereGeometry' && p.widthSegments > 8) {
    // Bỏ qua cầu đã bị uốn lại (tai): khung bao không còn khớp bán kính gốc.
    g.computeBoundingSphere();
    if (Math.abs(g.boundingSphere.radius - p.radius) > p.radius * .02) return;
    key = `sph|${p.radius}|${p.phiLength}|${p.thetaLength}`;
    make = () => new THREE.SphereGeometry(p.radius, 9, 6, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
  } else if (g.type === 'CylinderGeometry' && p.radialSegments > 10) {
    key = `cyl|${p.radiusTop}|${p.radiusBottom}|${p.height}|${p.openEnded}`;
    make = () => new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 8, 1, p.openEnded);
  }
  if (key) mesh.geometry = cached(`coarse|${key}`, make);
}
// Mèo của màn chưa mở (phía trước tiến độ): phủ lớp sương đen từ dưới lên, chưa lộ giống (nhãn "?" thay cho NEW!).
// Chân còn thấy mờ mờ ảo ảo, lên tới thân thì tối dần rồi che kín. Mỗi đỉnh mang thuộc tính `shroud` (0 = thấy, 1 = đen)
// tính theo độ cao trong toạ độ con mèo; shader trộn màu thật với màu sương theo giá trị đó.
const SHROUD_COLOR = new THREE.Color(0x0b0918);
const shroudMats = new Map();
function shroudMat(material) {
  if (!shroudMats.has(material)) {
    const mat = material.clone(), toon = material.onBeforeCompile;
    // Giữ shader toon gốc (clone() không chép onBeforeCompile), rồi mới phủ sương.
    mat.onBeforeCompile = function (shader, renderer) {
      toon?.call(this, shader, renderer);
      shader.uniforms.shroudColor = { value: SHROUD_COLOR };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float shroud;\nvarying float vShroud;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShroud = shroud;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 shroudColor;\nvarying float vShroud;')
        .replace(/}\s*$/, '  gl_FragColor.rgb = mix(gl_FragColor.rgb, shroudColor, vShroud);\n}');
    };
    mat.customProgramCacheKey = () => `shroud|${material.type}`;
    shroudMats.set(material, mat);
  }
  return shroudMats.get(material);
}
function shroudCat(cat) {
  cat.updateMatrixWorld(true);
  // Chiều cao con mèo chỉ tính theo phần đang hiện (rig có vài tấm ẩn treo cao, vd. chữ Z lúc ngủ, làm hộp bao cao vọt).
  const toCat = cat.matrixWorld.clone().invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), shown = [];
  cat.traverseVisible(node => { if (node.isMesh) shown.push(node); });
  let base = Infinity, top = -Infinity;
  for (const node of shown) {
    const pos = node.geometry.attributes.position;
    m.multiplyMatrices(toCat, node.matrixWorld);
    for (let i = 0; i < pos.count; i++) { const y = v.fromBufferAttribute(pos, i).applyMatrix4(m).y; base = Math.min(base, y); top = Math.max(top, y); }
  }
  const span = Math.max(1e-3, top - base);
  cat.traverse(node => {
    if (!node.isMesh) return;
    const geo = node.geometry = node.geometry.clone(), pos = geo.attributes.position, shroud = new Float32Array(pos.count);
    m.multiplyMatrices(toCat, node.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, Math.max(0, (v.fromBufferAttribute(pos, i).applyMatrix4(m).y - base) / span));
      // Bàn chân: sương .35 (thấy mờ mờ màu lông); từ chân lên tới ~3/4 thân tối dần, đầu che kín.
      const s = Math.min(1, Math.max(0, (k - .1) / .6));
      shroud[i] = .35 + .65 * s * s * (3 - 2 * s);
    }
    geo.setAttribute('shroud', new THREE.BufferAttribute(shroud, 1));
    node.material = Array.isArray(node.material) ? node.material.map(shroudMat) : shroudMat(node.material);
  });
}
function newCatModel(breed, { coarse = false, silhouette = false } = {}) {
  const cat = catModel(breed), solids = [];
  setCatFace(cat.userData.rig, breed, 'open'); // mặt calm mặc định, giống mèo đi lại trong Deco
  if (coarse) cat.traverse(node => { if (node.isMesh) coarsen(node); });
  if (silhouette) shroudCat(cat);
  cat.traverse(node => { if (node.isMesh && node.material?.isMeshToonMaterial && !node.material.transparent && !node.userData.noOutline) solids.push(node); });
  solids.forEach(mesh => withInk(mesh, .07));
  cat.traverse(node => { if (node.isMesh) node.castShadow = true; });
  return cat;
}
// Nút Claim (màn đã thắng, mèo chưa nhận): nền xanh lá viền xanh đậm, chữ trắng.
function claimBadgeTexture() {
  return canvasTexture(200, 72, (g, w, h) => {
    g.fillStyle = '#2e8a3e'; g.beginPath(); g.roundRect(4, 10, w - 8, h - 14, 26); g.fill();
    g.fillStyle = '#4cc35a'; g.strokeStyle = '#2e8a3e'; g.lineWidth = 5;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 14, 26); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(18, 10, w - 36, 12, 6); g.fill();
    g.font = '900 34px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText('CLAIM', w / 2, h / 2 - 2);
  });
}
// text: 'NEW!' (màn đã mở) hoặc '?' (mèo bí ẩn của màn chưa mở — cùng ô, chỉ đổi chữ).
function newBadgeTexture(text = 'NEW!') {
  return canvasTexture(160, 64, (g, w, h) => {
    g.fillStyle = '#ff5f8a'; g.strokeStyle = '#5b2e1c'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill(); g.stroke();
    g.font = '900 34px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.lineJoin = 'round'; g.strokeText(text, w / 2, h / 2 + 2); g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + 2);
  });
}

const PAW_GEO = new THREE.PlaneGeometry(.34, .34);
// Hình học khai báo một lần ở cấp module: dựng lại bản đồ không giải phóng các hình này.
const SHARED_GEO = new Set([...Object.values(headGeo), FACE_GEO, ...Object.values(PED), PLAIN_BASE, PLAIN_TOP, STAR_GEO, DOT_GEO, TUFT_GEO,
  WING_GEO, BUG_GEO, PAW_GEO, ...Object.values(DECOR_GEO).flat(), ...Object.values(DECOR_LOW).flat()]);

// ---------- Cảnh ----------
// Stage = một lô STAGE_SIZE màn liền nhau (1–10, 11–20...).
export const STAGE_SIZE = 10;
export const stageOf = index => Math.floor(index / STAGE_SIZE);

export function createMapWorld(container, { onPick, onClaim } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Điện thoại DPR 3: vẽ ở 1.5 là đủ nét cho cảnh toon (ít điểm ảnh hơn ~1.8 lần so với 2).
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Tường giấy dán của phòng khách / phòng ngủ phủ lên ảnh trời phía sau canvas, hiện dần khi lướt vào vùng đó.
  const walls = Object.fromEntries(ZONES.filter(z => z.wall).map(z => {
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;inset:0;pointer-events:none;opacity:0;background:${z.wall}`;
    container.append(div);
    return [z.id, div];
  }));
  container.append(renderer.domElement);
  // Nút về màn đang chơi: hiện khi người chơi lướt xa khỏi màn hiện tại (mũi tên chỉ hướng của màn đó), chạm là lăn về.
  const jump = document.createElement('button');
  jump.type = 'button';
  jump.className = 'map-jump';
  jump.hidden = true;
  jump.innerHTML = '<i aria-hidden="true"></i><span></span>';
  container.append(jump);
  const canvas = renderer.domElement;
  canvas.style.position = 'relative';
  canvas.className = 'map-canvas';

  const scene = new THREE.Scene();
  toonLook(renderer, scene);
  // Trời: canvas trong suốt, nền là ảnh trời mây của Home (.map.is-3d trong ui-portrait.css); sương chân trời cùng màu trời ở ảnh.
  scene.background = null;
  scene.fog = new THREE.Fog(SKY_FOG, 17, 29);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 120);
  camera.position.set(0, WORLD.R + CAM.height, CAM.back);
  camera.lookAt(0, WORLD.R + CAM.aimUp, -CAM.aimAhead);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfe8b8, TOON_LIGHT.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, TOON_LIGHT.sun);
  sun.position.set(-6, WORLD.R + 14, 8);
  sun.target.position.set(0, WORLD.R, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -10, near: 1, far: 50 });
  sun.shadow.bias = -.0008;
  sun.shadow.intensity = TOON_LIGHT.shadow;
  scene.add(sun, sun.target);

  // Trống cỏ: xoay quanh trục X; mọi thứ trên đường (màn, đường, cây) là con của trống.
  const drum = new THREE.Group();
  scene.add(drum);
  const grass = grassTexture();
  grass.repeat.set(17, 9);
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.R, WORLD.R, 40, 160, 1, true), toonMat({ color: 0xffffff, map: grass }));
  ground.rotation.z = Math.PI / 2;
  ground.receiveShadow = true;
  drum.add(ground);

  const content = new THREE.Group();
  drum.add(content);
  // Sàn trong nhà: dải trống phủ ngay trên cỏ từng đoạn một màn (θ của CylinderGeometry = π/2 + góc trống).
  const floorMats = {};
  for (const id of ['living', 'bedroom', 'kitchen']) {
    const tex = floorTexture(id);
    tex.repeat.set(LEVEL_GAP / 2.2, 40 / 2.2);
    floorMats[id] = toonMat({ color: 0xffffff, map: tex });
  }
  function floorPiece(i, zone) {
    const a0 = angleOf(i - .5);
    const geo = new THREE.CylinderGeometry(WORLD.R + .004, WORLD.R + .004, 40, 24, 1, true, Math.PI / 2 + a0, WORLD.STEP);
    const mesh = new THREE.Mesh(geo, floorMats[zone]);
    mesh.rotation.z = Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.userData.angle = angleOf(i);
    culled.push(mesh);
    content.add(mesh);
  }
  const pickables = [];
  // Trống nhỏ (cong mạnh) nên cả con đường quấn gần trọn một vòng: chỉ hiện vật gần camera, phần đã qua chân trời
  // hoặc sau lưng camera ẩn đi, không thì đầu đường (màn 1) lộ ra ngay sau màn cuối.
  const culled = [], unbuilt = [];
  const VISIBLE = { behind: -1.25, ahead: 1.45 };
  // LOD theo góc so với chỗ đang xem (rel; càng lớn càng gần chân trời). Không tắt / đổi phụt: viền mực mờ dần từ INK_FADE[0]
  // tới INK_FADE[1] (dải dài sát chân trời, nơi viền vốn đã mảnh), hết hẳn viền rồi mới đổi sang bản xa (LOD_FAR: bỏ món nhỏ, lưới ít cạnh) — lúc đó
  // vật đã nhỏ, không viền, nên đổi lưới gần như không thấy.
  const INK_FADE = [.42, .95], LOD_FAR = 1;
  const inkOpacity = rel => { const k = (INK_FADE[1] - rel) / (INK_FADE[1] - INK_FADE[0]); return k >= 1 ? 1 : k <= 0 ? 0 : k * k * (3 - 2 * k); };
  // Mỗi cụm (một đoạn trang trí / một màn) có chất liệu viền riêng để mờ theo khoảng cách của chính nó.
  const fadeMats = [];
  function fadeInk(root) {
    const meshes = [];
    root.traverse(n => { if (n.material === inkMat) meshes.push(n); });
    const mat = inkMat.clone();
    mat.transparent = true;
    meshes.forEach(m => { m.material = mat; });
    fadeMats.push(mat);
    return { mat, meshes, opacity: 1 };
  }
  function setInk(ink, opacity) {
    if (!ink || Math.abs(ink.opacity - opacity) < .01) return;
    ink.opacity = opacity;
    ink.mat.opacity = opacity;
    ink.meshes.forEach(m => { m.visible = opacity > .01; });
  }
  let nodes = [], levelCount = 0, scroll = 0, target = 0, velocity = 0, focusIndex = 0, running = false, lastFrame = 0;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Bướm bay quanh chỗ đậu (cử động trong frame()).
  let flyers = [];

  // Dải băng nằm trên mặt trống dọc theo đường, từ t0 tới t1 (t = chỉ số màn, số thực).
  function ribbon(t0, t1, width, lift, material) {
    for (let a = t0; a < t1 - 1e-6; a += 1) {
      const piece = ribbonPiece(a, Math.min(t1, a + 1), width, lift, material);
      piece.userData.angle = angleOf((a + Math.min(t1, a + 1)) / 2);
      culled.push(piece);
      content.add(piece);
    }
  }
  function ribbonPiece(t0, t1, width, lift, material) {
    const steps = Math.max(2, Math.ceil((t1 - t0) * 28)), pos = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * i / steps;
      const c = onDrum(pathX(t), angleOf(t), lift), ahead = onDrum(pathX(t + .01), angleOf(t + .01), lift);
      const tangent = ahead.sub(c).normalize(), up = c.clone().setX(0).normalize();
      const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(width / 2);
      pos.push(c.x - side.x, c.y - side.y, c.z - side.z, c.x + side.x, c.y + side.y, c.z + side.z);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.receiveShadow = true;
    return mesh;
  }
  // Đặt vật đứng thẳng trên mặt trống tại (x, t): trục y của vật = pháp tuyến mặt trống.
  function plant(object, x, t, lift = 0) {
    const holder = onDrumAt(object, x, t, lift);
    culled.push(holder);
    content.add(holder);
    return holder;
  }

  function levelNode(index, { locked, tier, current, newCats = [], claimable = false }) {
    const g = new THREE.Group();
    // Màn boss: bệ bánh kem (pedestal()), còn lại bệ thường. Màn đang chơi: bệ + đầu mèo to hơn (lớp grow ở giữa, vì
    // scale của head bị hiệu ứng nhấn ghi đè), quầng sáng trên cỏ, vòng hồng lan ra, sao vàng lơ lửng, đốm lấp lánh.
    const ped = tier === 'boss' ? pedestal(locked ? 'locked' : 'boss') : plainPedestal();
    const grow = new THREE.Group();
    if (current) grow.scale.setScalar(CURRENT_SCALE);
    grow.add(ped.group);
    g.add(grow);
    let ring = null, halo = null, star = null;
    const sparkles = [];
    if (current) {
      const fx = currentAssets();
      halo = new THREE.Mesh(new THREE.CircleGeometry(1.55, 40), fx.halo);
      halo.rotation.x = -Math.PI / 2; halo.position.y = .07; halo.renderOrder = 1;
      g.add(halo);
      ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, .06, 8, 44), new THREE.MeshBasicMaterial({ color: 0xff7fa6, transparent: true, opacity: .8 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = .08;
      g.add(ring);
    }
    // Đầu mèo đứng trên bệ, ngả nhẹ ra sau cho mặt hướng về camera.
    const head = new THREE.Group();
    head.position.y = ped.top;
    // Đứng lùi về phía sau mặt bục (−z = xa camera): đứng giữa bục thì nhìn từ trên xuống khối đầu che gần hết mặt bục, như cắm vào bục.
    head.position.z = -HEAD_SET_BACK;
    const tilt = new THREE.Group();
    tilt.rotation.x = -.42;
    head.add(tilt);
    const bodyColor = locked ? COLORS.body.locked : (COLORS.body[tier] ?? COLORS.body.normal);
    const isBoss = tier === 'boss', royal = isBoss && !locked;
    const cream = matOf(locked ? 0xf1e7e1 : royal ? 0xffd86b : 0xfff3ee, .3);
    const cat = new THREE.Group();
    cat.position.y = HEAD.h / 2 + .02;
    tilt.add(cat);
    const rim = new THREE.Mesh(headGeo.rim, cream);
    rim.castShadow = true;
    cat.add(withInk(rim, 0, .075));
    const bodyMat = matOf(bodyColor, .35);
    const body = new THREE.Mesh(headGeo.face, bodyMat);
    body.position.z = HEAD.depth / 2 + HEAD.bevel - .02;
    cat.add(body);
    // Tai: cắm sau hai góc trên, nghiêng ra ngoài; lòng tai hồng nổi ở mặt trước.
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * .36, HEAD.h / 2 - .02, -.04);
      ear.rotation.z = -side * .32;
      ear.scale.x = -side;
      const outer = new THREE.Mesh(headGeo.ear, cream);
      outer.castShadow = true;
      ear.add(withInk(outer, 0, .065));
      const inner = new THREE.Mesh(headGeo.earInner, matOf(royal ? 0xff5fa8 : 0xff8fb3));
      inner.position.set(-.02, .01, .11);
      ear.add(inner);
      cat.add(ear);
    }
    const face = new THREE.Mesh(FACE_GEO, faceMat(index + 1, locked, isBoss));
    face.position.z = FACE_Z + .03;
    cat.add(face);
    if (royal) {
      const crown = new THREE.Group(), gold = matOf(0xffc83d, .4), jewel = matOf(0xff5fa8, .5), pearl = matOf(0xffffff, .4);
      crown.add(withInk(new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .14, 16), gold), .06));
      for (let k = 0; k < 5; k++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 6), gold);
        const a = k / 5 * Math.PI * 2;
        spike.position.set(Math.cos(a) * .22, .16, Math.sin(a) * .22);
        crown.add(spike);
        const tip = new THREE.Mesh(PED.petal, pearl);
        tip.position.set(Math.cos(a) * .22, .28, Math.sin(a) * .22); tip.scale.setScalar(.9);
        crown.add(tip);
      }
      const gem = new THREE.Mesh(PED.gem, jewel);
      gem.position.set(0, 0, .32); gem.scale.set(.8, 1.1, .6);
      crown.add(gem);
      crown.position.y = 1.5; crown.rotation.z = .2;
      tilt.add(crown);
    }
    if (current) {
      const fx = currentAssets();
      // Sao vàng như huy hiệu ở góc trên bên phải đầu mèo, nhô ra phía trước: bay cao trên đỉnh đầu thì nhìn chéo từ
      // camera sao chồng lên màn kế tiếp phía sau (tưởng sao của màn đó). Cùng ngả theo khối đầu nên luôn quay mặt về camera.
      star = new THREE.Mesh(STAR_GEO, fx.star);
      star.castShadow = true;
      star.userData.baseY = tier === 'boss' ? 1.42 : 1.3;
      star.position.set(.66, star.userData.baseY, .32);
      star.scale.setScalar(.85);
      tilt.add(withInk(star, 0, .05));
      [[-.82, .75], [.86, 1.05], [-.55, 1.55], [.6, 1.7]].forEach(([x, y], k) => {
        const s = new THREE.Sprite(fx.sparkle);
        s.position.set(x, ped.top + y, .25);
        s.userData.phase = k * 1.6;
        grow.add(s);
        sparkles.push(s);
      });
    }
    grow.add(head);
    // Màn mở giống mèo mới: mèo 3D đứng rải rác quanh bệ (catSpots: ngẫu nhiên hai bên đường, tách nhau ra), nhãn NEW!
    // trên đầu con đầu tiên. Mèo đứng thẳng trên cỏ đúng như mèo trong Deco (không ngả về camera như khối đầu mèo: ngả thì mèo
    // trông dẹt như đang nằm, khác hẳn model ở Deco). Màn đang chơi có bệ to hơn: mèo mới đứng lùi ra một chút cho khỏi chạm bệ.
    const cats = [], catTilt = new THREE.Group(), spots = catSpots(index, newCats.length, current ? 1.3 : 1.12);
    g.add(catTilt);
    newCats.forEach((breed, k) => {
      const cat = newCatModel(breed, { coarse: true, silhouette: locked }), [dx, dz, turn] = spots[k];
      cat.scale.setScalar(1.35);
      cat.position.set(dx, 0, dz);
      cat.rotation.y = turn;
      cat.userData.spot = [dx, dz];
      catTilt.add(cat);
      cats.push(cat);
    });
    if (newCats.length) {
      const badge = new THREE.Sprite(claimable ? cached('badge|claim', () => new THREE.SpriteMaterial({ map: claimBadgeTexture() }))
        : locked ? cached('badge|mystery', () => new THREE.SpriteMaterial({ map: newBadgeTexture('?') }))
          : cached('badge|new', () => new THREE.SpriteMaterial({ map: newBadgeTexture() })));
      // Nút Claim to hơn, nổi cao hơn đầu mèo cho dễ bấm.
      badge.scale.set(...(claimable ? [1.75, .63, 1] : [.78, .31, 1]));
      badge.userData.baseY = claimable ? 2 : 1.25;
      badge.renderOrder = 5;
      // Chạm nút Claim hoặc chạm mèo đều nhận (nhận lần lượt từng con nếu màn có nhiều giống mới).
      if (claimable) {
        Object.assign(badge.userData, { claim: newCats[0], level: index });
        pickables.push(badge);
        cats.forEach((cat, k) => cat.traverse(n => { if (n.isMesh) { n.userData.claim = newCats[k]; n.userData.level = index; pickables.push(n); } }));
      }
      badge.position.set(spots[0][0], badge.userData.baseY, spots[0][1] + .1);
      g.add(badge);
      cats.push(badge);
    }
    for (const mesh of [...ped.parts, rim, body, face]) { mesh.userData.level = index; mesh.userData.locked = locked; pickables.push(mesh); }
    const holder = plant(g, pathX(index), index, 0);
    // LOD: màn ở xa (gần chân trời) mờ dần viền mực của khối đầu, bệ và mèo mới.
    const ink = fadeInk(g);
    return { holder, ink, head, tilt, catTilt, ring, halo, star, sparkles, current: !!current, cats, claimable: claimable && newCats.length > 0, baseY: ped.top, index, locked, phase: index * .7 };
  }

  function sign(t) {
    const g = new THREE.Group(), wood = sceneryMats.wood;
    for (const x of [-.9, .9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, 1.1, 8), wood);
      post.position.set(x, .55, 0); g.add(withInk(post, .1));
    }
    const board = new THREE.Mesh(roundedBox(2.3, .72, .12, 2, .05), matOf(0xf3d5a4));
    board.position.y = 1.05; board.castShadow = true;
    g.add(withInk(board, .03));
    const text = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .69), cached('sign|end', () => new THREE.MeshBasicMaterial({ map: signTexture('More levels coming soon!'), transparent: true })));
    text.position.set(0, 1.05, .07);
    g.add(text);
    g.rotation.x = -.25;
    plant(g, pathX(t), t);
  }

  // Điểm xuất phát (đầu đường, trước màn 1): cổng xuất phát bắc ngang, nắp nửa tròn cho viền + mặt đường thay cho vết cắt thẳng, dấu chân to giữa nắp,
  // vòng hoa ôm quanh nắp, khóm hoa hai bên, bụi cây + đèn lồng phía sau. Màu mặt nắp = màu đoạn đầu đường (đã đi: hồng, chưa: kem).
  const START_T = -.8;
  function startCap(color) {
    const x = pathX(START_T), turn = -Math.atan(pathSlope(START_T));
    // Nửa đĩa phẳng hướng về phía camera (+z = t nhỏ hơn), quay theo hướng đường cho khớp mép dải băng.
    const half = (r, lift, material) => {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 36, Math.PI, Math.PI).rotateX(-Math.PI / 2), material);
      cap.rotation.y = turn;
      cap.receiveShadow = true;
      plant(cap, x, START_T, lift);
    };
    half(WORLD.ROAD / 2 + WORLD.EDGE, .015, matOf(INK));
    half(WORLD.ROAD / 2, .03, matOf(color));
    let seed = 777;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const side = (WORLD.ROAD / 2 + WORLD.EDGE + .45) * Math.hypot(1, pathSlope(START_T));
    // Mọi món trang trí ở điểm xuất phát gộp chung một cụm (mergeStatic): vài chục khối nhỏ thành vài lệnh vẽ.
    const decor = new THREE.Group();
    const deco = (object, dx, dt) => {
      object.traverse(n => { if (n.isMesh && n.material !== inkMat) n.castShadow = true; });
      decor.add(onDrumAt(object, x + dx, START_T + dt));
    };
    deco(flowerPatch(rnd), -side, .05);
    deco(flowerPatch(rnd), side, .05);
    deco(lantern(), -side - .15, -.35);
    deco(bush(rnd), side + .25, -.4);
    deco(bush(rnd), .35, -.95);
    // Vòng hoa ôm sát mép nắp (nửa vòng phía camera), cách đều nhau; hai đầu vòng nhường chỗ cho hai trụ cổng xuất phát
    const ring = WORLD.ROAD / 2 + WORLD.EDGE + .2;
    for (let k = 1; k < 8; k++) {
      const a = Math.PI * k / 8, dx = Math.cos(a) * ring, dz = Math.sin(a) * ring;
      deco(flower(rnd), dx, -dz / LEVEL_GAP);
    }
    mergeStatic(decor);
    decor.userData.angle = angleOf(START_T);
    culled.push(decor);
    content.add(decor);
    // Dấu chân to ở giữa nắp: chỗ mèo bắt đầu hành trình
    const paw = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), pawMat(color === COLORS.roadDone ? '#ef5f8b' : '#f7a3bd'));
    paw.rotation.set(-Math.PI / 2, 0, turn);
    plant(paw, x, START_T - .12, .045);
    // Cổng xuất phát bắc ngang nắp, ngay trên dấu chân (nghiêng ra sau như cổng phòng).
    const gate = startGate();
    gate.rotation.set(-.2, turn, 0, 'YXZ');
    plant(gate, x, START_T - .1);
  }

  // Trang trí hai bên đường, chia theo đoạn: mỗi đoạn quanh một màn (t từ i - .5 tới i + .5) là một nhóm gộp chất liệu
  // (mergeStatic) và ẩn / hiện như một khối theo góc trống. Phủ hết phần cỏ thấy được ở mọi vị trí cuộn (cả trước màn 1
  // và sau biển "coming soon"); mỗi đoạn có hạt giống riêng nên dựng lại vẫn y hệt.
  // Chọn chỗ (rẻ) làm ngay cho mọi đoạn; dựng model + gộp (đắt) thì lười: đoạn nào sắp hiện mới dựng (frame()), phần còn
  // lại dựng dần lúc rảnh (buildIdle), nên mở bản đồ không bị khựng. Mỗi món có hạt giống riêng nên dựng lúc nào cũng y hệt.
  function decorate(levels) {
    const end = levels.length - 1, placed = [];
    // Vùng chừa quanh mỗi màn: bằng bệ (màn đang chơi rộng hơn vì bệ to + quầng sáng); mèo mới chừa riêng theo đúng
    // chỗ đứng của từng con (catSpots, cùng hạt giống với levelNode).
    const keepOut = i => levels[i].current ? 1.6 : 1.05;
    const catsAt = levels.map((level, i) => catSpots(i, level.newCats?.length || 0, level.current ? 1.3 : 1.12)
      .map(([dx, dz]) => ({ x: pathX(i) + dx, t: i - dz / LEVEL_GAP, clear: level.claimable ? CLAIM_CLEAR : .7 })));
    // Chỗ trống cho món bán kính r tại (x, t): không lấn đường, không lấn bệ + mèo mới cạnh màn, không lấn biển cuối
    // đường, không chồng lên món đã đặt. dz: quãng trên mặt cỏ.
    const free = (x, t, r) => {
      const fromRoad = Math.abs(x - pathX(t)) / Math.hypot(1, pathSlope(t));
      if (fromRoad < WORLD.ROAD / 2 + WORLD.EDGE + r + .1) return false;
      const i = Math.round(t);
      if (i >= 0 && i <= end && Math.abs(t - i) * LEVEL_GAP < (levels[i].current ? 1.6 : 1.2) + r && Math.abs(x - pathX(i)) < keepOut(i) + r) return false;
      for (let j = Math.max(0, i - 2); j <= Math.min(end, i + 2); j++) {
        if (catsAt[j].some(c => Math.hypot(c.x - x, (c.t - t) * LEVEL_GAP) < c.clear + r)) return false;
      }
      const signT = end + .95;
      if (Math.abs(t - signT) * LEVEL_GAP < .8 + r && Math.abs(x - pathX(signT)) < 1.6 + r) return false;
      // Cổng chuyển vùng bắc ngang đường.
      for (const z of ZONES) if (z.label && Math.abs(t - z.from) * LEVEL_GAP < .5 + r && Math.abs(x - pathX(z.from)) < 1.3 + r) return false;
      return placed.every(p => Math.hypot(p.x - x, (p.t - t) * LEVEL_GAP) > p.r + r);
    };
    const first = Math.floor(VISIBLE.behind / WORLD.STEP) - 1, last = Math.ceil(end + VISIBLE.ahead / WORLD.STEP) + 1;
    let prevKinds = new Set();
    for (let i = first; i <= last; i++) {
      const rnd = seeded(1000 + (i - first) * 7919), items = [], count = {};
      // Ghi món sẽ dựng: make(rnd) tạo model; shadow: món đủ to mới đổ bóng (hoa, cỏ, đá nhỏ bỏ qua pass bóng);
      // small: món nhỏ, bản LOD xa bỏ hẳn.
      const put = (make, x, t, r, turn, { shadow = true, small = false, kind = '' } = {}) => {
        items.push({ make, x, t, turn, shadow, small, seed: 1 + Math.floor(rnd() * 2147483645) });
        placed.push({ x, t, r });
        if (kind) count[kind] = (count[kind] || 0) + 1;
      };
      const chunk = new THREE.Group(), mid = i + .5, onRoad = i >= -1 && i < end, zone = zoneAt(i), indoor = zone !== 'garden';
      if (indoor) floorPiece(i, zone);
      // Đèn giữa hai màn, đổi bên mỗi đoạn (trong nhà: đèn cây cách một đoạn, bếp: ghế đẩu); hàng rào / chậu cây (bếp: chậu rau thơm) phía bên kia mỗi 3 đoạn.
      const lampSide = i % 2 ? 1 : -1, edge = (WORLD.ROAD / 2 + WORLD.EDGE + .35) * Math.hypot(1, pathSlope(mid));
      if (onRoad && (!indoor || i % 2 === 0) && free(pathX(mid) + lampSide * edge, mid, .2)) put(zone === 'kitchen' ? stool : indoor ? floorLamp : lantern, pathX(mid) + lampSide * edge, mid, .2, 0);
      if (onRoad && i % 3 === 0 && free(pathX(mid) - lampSide * edge, mid, .5)) {
        put(zone === 'kitchen' ? herbPots : indoor ? pottedPlant : () => fence(1.2), pathX(mid) - lampSide * edge, mid, .5, -Math.atan(pathSlope(mid)), { kind: zone === 'kitchen' ? 'herbs' : indoor ? 'plant' : '' });
      }
      // Biển chỉ đường mỗi 5 đoạn, ao nhỏ / thảm mỗi 4 đoạn ở phía rộng (phía đường đang uốn ra xa).
      if (onRoad && !indoor && i % 5 === 2) {
        const t = i + .25, x = pathX(t) - lampSide * edge;
        if (free(x, t, .3)) put(signpost, x, t, .3, -Math.atan(pathSlope(t)));
      }
      if (i % 4 === 1) {
        const t = mid + (rnd() - .5) * .3, wide = pathX(t) > 0 ? -1 : 1, x = pathX(t) + wide * (2.5 + rnd() * .8);
        if (free(x, t, 1.15)) put(zone === 'kitchen' ? kitchenMat : indoor ? rug : pond, x, t, 1.15, (rnd() - .5) * .6, { shadow: false });
      }
      // Rải theo bảng SCATTER của vùng: chọn ngẫu nhiên có trọng số, mỗi loại có trần số lượng trong đoạn; loại đã có ở
      // đoạn trước bị giảm trọng số (món to không lặp ở hai đoạn liền nhau) để hai bên đường đa dạng mà không rối.
      const plan = SCATTER[zone], fixed = items.length;
      for (let k = 0; k < plan.tries && items.length - fixed < plan.max; k++) {
        const t = i - .5 + rnd(), side = rnd() < .5 ? -1 : 1, dist = .95 + Math.pow(rnd(), 1.4) * plan.spread, x = pathX(t) + side * dist;
        if (Math.abs(x) > 8) continue;
        const options = plan.kinds.filter(o => dist >= (o.minDist || 0) && (count[o.kind] || 0) < o.cap && !(o.big && prevKinds.has(o.kind)));
        const weight = o => o.w * (prevKinds.has(o.kind) ? .3 : 1);
        let roll = rnd() * options.reduce((sum, o) => sum + weight(o), 0), pick = null;
        for (const o of options) if ((roll -= weight(o)) <= 0) { pick = o; break; }
        if (!pick || !free(x, t, pick.r)) continue;
        const make = pick.make(rnd, dist);
        put(make, x, t, pick.r, rnd() * Math.PI * 2, { shadow: !pick.small && pick.shadow !== false, small: pick.small, kind: pick.kind });
      }
      prevKinds = new Set(Object.keys(count));
      chunk.userData.angle = angleOf(i);
      // Hai bản: gần (đủ chi tiết, viền mực, đổ bóng) và xa (LOD: bỏ món nhỏ + viền, lưới ít cạnh, không đổ bóng).
      chunk.userData.build = () => {
        delete chunk.userData.build;
        const hi = new THREE.Group(), lo = new THREE.Group();
        for (const { make, x, t, turn, shadow, seed } of items) {
          const object = make(seeded(seed));
          object.rotation.y = turn;
          if (shadow) object.traverse(n => { if (n.isMesh && n.material !== inkMat) n.castShadow = true; });
          hi.add(onDrumAt(object, x, t));
        }
        lowDetail = true;
        try {
          for (const { make, x, t, turn, small, seed } of items) {
            if (small) continue;
            const object = make(seeded(seed));
            object.rotation.y = turn;
            lo.add(onDrumAt(object, x, t));
          }
        } finally { lowDetail = false; }
        mergeStatic(hi);
        mergeStatic(lo);
        chunk.add(hi, lo);
        chunk.userData.lod = { hi, lo, ink: fadeInk(hi) };
      };
      culled.push(chunk);
      unbuilt.push(chunk);
      content.add(chunk);
      // Bướm bay quanh một chỗ trống gần đường (một con mỗi hai đoạn, không gộp vì cánh vỗ).
      const t = i - .5 + rnd(), x = pathX(t) + (rnd() < .5 ? -1 : 1) * (1.2 + rnd() * 2.5);
      if (!indoor && i % 2 === 0 && free(x, t, .3)) {
        const fly = butterfly(rnd), holder = plant(fly, x, t);
        flyers.push({ fly, holder, phase: rnd() * 10, radius: .25 + rnd() * .25 });
      }
    }
  }
  // Dựng dần các đoạn trang trí chưa dựng lúc trình duyệt rảnh, đoạn gần chỗ đang xem trước.
  const idle = window.requestIdleCallback ?? (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 30));
  let idleQueued = false;
  function buildIdle() {
    if (idleQueued) return;
    idleQueued = true;
    idle(deadline => {
      idleQueued = false;
      for (let i = unbuilt.length - 1; i >= 0; i--) if (!unbuilt[i].userData.build) unbuilt.splice(i, 1);
      if (!unbuilt.length) return;
      unbuilt.sort((a, b) => Math.abs(a.userData.angle - scroll) - Math.abs(b.userData.angle - scroll));
      do unbuilt.shift().userData.build(); while (unbuilt.length && deadline.timeRemaining() > 6);
      if (unbuilt.length) buildIdle();
    });
  }

  // Vẽ lại toàn bộ đường + màn theo tiến độ hiện tại. levels: [{ locked, tier, current }].
  // Tiến độ không đổi (mở lại bản đồ) thì giữ nguyên cảnh, không dựng lại.
  let builtKey = '';
  function render(levels) {
    const cur = levels.findIndex(l => l.current);
    curIndex = cur >= 0 ? cur : Math.max(0, levels.length - 1);
    const key = JSON.stringify(levels);
    if (key === builtKey) return;
    builtKey = key;
    // Trả bộ nhớ GPU của cảnh cũ (hình học dùng chung giữ lại; chất liệu / texture nằm trong cache dùng chung).
    content.traverse(n => { if (n.geometry && !SHARED_GEO.has(n.geometry)) n.geometry.dispose(); });
    fadeMats.splice(0).forEach(m => m.dispose());
    content.clear();
    pickables.length = 0;
    culled.length = 0;
    unbuilt.length = 0;
    flyers = [];
    levelCount = levels.length;
    const open = levels.filter(l => !l.locked).length;
    const end = levelCount - 1;
    ribbon(START_T, end + .9, WORLD.ROAD + WORLD.EDGE * 2, .015, matOf(INK));
    const doneTo = Math.max(START_T, open - 1);
    if (open > 0) ribbon(START_T, doneTo, WORLD.ROAD, .03, matOf(COLORS.roadDone));
    ribbon(doneTo, end + .9, WORLD.ROAD, .03, matOf(COLORS.road));
    startCap(doneTo > START_T ? COLORS.roadDone : COLORS.road);
    // Dấu chân mèo: 3 dấu trái / phải xen kẽ giữa mỗi hai màn, hồng đậm trên đoạn đã đi (gộp 3 dấu một đoạn thành một mesh).
    for (let i = 0; i < end; i++) {
      const group = new THREE.Group(), mat = pawMat(i + 1 < open ? '#ef5f8b' : '#6b4226');
      [.32, .5, .68].forEach((f, k) => {
        const t = i + f, paw = new THREE.Mesh(PAW_GEO, mat), right = k % 2;
        paw.rotation.set(-Math.PI / 2, 0, (right ? -1 : 1) * .3 - Math.atan(pathSlope(t)));
        group.add(onDrumAt(paw, pathX(t) + (right ? .16 : -.16), t, .045));
      });
      mergeStatic(group);
      group.userData.angle = angleOf(i + .5);
      culled.push(group);
      content.add(group);
    }
    nodes = levels.map((l, i) => levelNode(i, l));
    sign(end + .95);
    for (const z of ZONES) if (z.label && z.from < end) {
      const gate = zoneGate(z.label);
      gate.rotation.set(-.2, -Math.atan(pathSlope(z.from)), 0, 'YXZ');
      plant(gate, pathX(z.from), z.from);
    }
    decorate(levels);
    // Các món lẻ còn viền (cổng phòng, biển cuối đường, cụm điểm xuất phát, đèn...): mỗi cụm một chất liệu viền mờ theo khoảng cách.
    for (const object of culled) {
      if (object.userData.lod || object.userData.build) continue;
      const ink = fadeInk(object);
      if (ink.meshes.length) object.userData.ink = ink; else fadeMats.pop().dispose();
    }
    buildIdle();
  }

  // ---------- Cuộn / chạm ----------
  const minScroll = () => -.15 * WORLD.STEP, maxScroll = () => (levelCount - .4) * WORLD.STEP;
  const clamp = v => Math.min(maxScroll(), Math.max(minScroll(), v));
  // Số px kéo tay để lăn qua một màn (resize() tính theo chiều cao khung, tỉ lệ với WORLD.STEP).
  let pxPerLevel = 200;
  function focus(index, animate = true) {
    focusIndex = index;
    target = clamp(angleOf(index));
    if (!animate || reduceMotion) scroll = target;
    // Lăn tới màn đang chơi từ một góc cố định phía trước (không phụ thuộc khoảng cách giữa hai màn).
    else scroll = clamp(target - .45);
    velocity = 0;
  }
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    drag = { id: e.pointerId, y: e.clientY, x: e.clientX, moved: 0, t: performance.now() };
    velocity = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* sự kiện giả / con trỏ đã nhả */ }
  });
  canvas.addEventListener('pointermove', e => {
    // Đổi con trỏ khi rê chuột qua màn (chỉ chuột: cảm ứng không có hover, khỏi raycast mỗi lần chạm di chuyển).
    if (!drag) { if (e.pointerType === 'mouse') hover(e); return; }
    const dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.moved += Math.abs(dy) + Math.abs(e.clientX - drag.x);
    drag.y = e.clientY; drag.x = e.clientX; drag.t = now;
    // Vuốt xuống = kéo mặt đất về phía mình = tiến lên các màn cao hơn (như Animal Crossing).
    const delta = dy / pxPerLevel * WORLD.STEP;
    target = scroll = clamp(scroll + delta);
    velocity = Math.max(-WORLD.STEP * .35, Math.min(WORLD.STEP * .35, delta / dt * 16));
  });
  const endDrag = e => {
    if (!drag) return;
    const tap = drag.moved < 8;
    drag = null;
    if (tap) { velocity = 0; pick(e); }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    target = clamp(target - e.deltaY / pxPerLevel * WORLD.STEP * .8);
    velocity = 0;
  }, { passive: false });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickables, false)[0]?.object.userData;
  }
  function hover(e) { const h = hit(e); canvas.style.cursor = h && (h.claim || !h.locked) ? 'pointer' : 'grab'; }
  function pick(e) {
    const h = hit(e);
    if (h?.claim) { onClaim?.(h.claim, h.level); return; }
    if (!h || h.locked) return;
    const node = nodes[h.level];
    if (node) node.press = 1;
    setTimeout(() => onPick?.(h.level), 140);
  }

  // ---------- Khung hình ----------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Giữ bề ngang thấy được cố định (màn dọc hẹp thì mở FOV dọc ra), tránh đường uốn bị cắt mép.
    // Canh theo bề rộng khung UI (--frame-w trong gom-gom.css), không theo cả màn: màn ngang / desktop thì nút màn
    // vẫn to đúng tỉ lệ với UI như trên điện thoại, chỉ thấy thêm cỏ hai bên.
    const frameW = Math.min(w, 480, h * 393 / 700);
    const dist = Math.hypot(CAM.height - CAM.aimUp, CAM.back + CAM.aimAhead);
    const fov = 2 * Math.atan(CAM.halfW / (dist * frameW / h)) * 180 / Math.PI;
    camera.fov = Math.min(62, Math.max(34, fov));
    camera.updateProjectionMatrix();
    // Giữ cảm giác kéo như cũ theo góc lăn của trống (h / 1.56 px mỗi radian): màn cách xa hơn thì kéo dài hơn để qua một màn.
    pxPerLevel = h / 1.56 * WORLD.STEP;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // Sương + tường đổi theo vùng của màn đang ở giữa khung (pha trộn mượt quanh ranh giới, ±.6 màn).
  const gardenFog = new THREE.Color(SKY_FOG), fogMix = new THREE.Color(), zoneFog = Object.fromEntries(ZONES.filter(z => z.fog).map(z => [z.id, new THREE.Color(z.fog)]));
  // Màn đang chơi (render() ghi lại): đích của nút về màn hiện tại.
  let curIndex = 0;
  const JUMP_AWAY = 2.5;
  jump.onclick = () => { target = clamp(angleOf(curIndex)); velocity = 0; };
  function updateZone(t) {
    fogMix.copy(gardenFog);
    for (const z of ZONES) if (z.wall) {
      const k = Math.min(1, Math.max(0, (t - z.from + .6) / 1.2));
      walls[z.id].style.opacity = String(k);
      fogMix.lerp(zoneFog[z.id], k);
    }
    scene.fog.color.copy(fogMix);
    // Lướt xa màn đang chơi hơn JUMP_AWAY màn: hiện nút về, mũi tên lên / xuống theo hướng màn đó trên màn hình.
    const away = t - curIndex, show = Math.abs(away) > JUMP_AWAY;
    if (jump.hidden === show) jump.hidden = !show;
    if (show) {
      jump.classList.toggle('up', away < 0);
      const label = `Level ${curIndex + 1}`;
      if (jump.lastChild.textContent !== label) jump.lastChild.textContent = label;
    }
  }
  function frame(now) {
    // Đứng yên (không kéo, trống đã lăn tới chỗ): chỉ còn anim nhún / bướm nên vẽ 30 hình/giây cho đỡ tốn pin.
    const settled = !drag && Math.abs(velocity) < 1e-5 && Math.abs(target - scroll) < 1e-4;
    if (settled && lastFrame && now - lastFrame < 30) return;
    const dt = lastFrame ? Math.min(50, now - lastFrame) / 1000 : 0;
    lastFrame = now;
    if (!drag) {
      if (Math.abs(velocity) > 1e-5) { target = clamp(target + velocity); velocity *= Math.pow(.86, dt * 60); }
      scroll += (target - scroll) * Math.min(1, dt * 7);
    }
    drum.rotation.x = scroll;
    const time = now / 1000;
    updateZone(scroll / WORLD.STEP);
    for (const object of culled) {
      const rel = object.userData.angle - scroll;
      object.visible = rel > VISIBLE.behind && rel < VISIBLE.ahead;
      // Đoạn trang trí sắp hiện mà lúc rảnh chưa kịp dựng: dựng ngay.
      if (object.visible && object.userData.build) object.userData.build();
      const lod = object.userData.lod;
      if (lod && object.visible) { const far = rel > LOD_FAR; lod.hi.visible = !far; lod.lo.visible = far; if (!far) setInk(lod.ink, inkOpacity(rel)); }
      if (object.userData.ink && object.visible) setInk(object.userData.ink, inkOpacity(rel));
    }
    for (const node of nodes) {
      if (!node.holder.visible) continue;
      setInk(node.ink, inkOpacity(angleOf(node.index) - scroll));
      // Ngả mặt về phía camera: màn càng gần (đã lăn về phía camera) càng ngả ra sau, không bị nhìn dẹt từ trên xuống.
      node.tilt.rotation.x = Math.max(-1.25, Math.min(-.2, -.62 + (angleOf(node.index) - scroll) * 1.1));
      // Ngả quanh tâm đáy thì mép đáy phía sau (dày HEAD_BACK) chúi xuống dưới mặt bục (tới ~.17 khi ngả hết cỡ): nâng khối đầu
      // lên đúng phần đó để đáy luôn đặt trên mặt bục, không cắm vào bục.
      node.tilt.position.y = HEAD_BACK * Math.sin(-node.tilt.rotation.x);
      const bob = node.locked || reduceMotion ? 0 : Math.sin(time * 2.2 + node.phase) * .04;
      node.press = Math.max(0, (node.press || 0) - dt * 4);
      node.head.position.y = node.baseY + bob + (node.current && !reduceMotion ? Math.abs(Math.sin(time * 3)) * .12 : 0) - node.press * .1;
      node.head.scale.set(1 + node.press * .08, 1 - node.press * .1, 1);
      if (node.ring) { const p = (time * 1.2) % 1; node.ring.scale.setScalar(1 + p * .35); node.ring.material.opacity = .85 * (1 - p); }
      if (node.current) {
        // Quầng sáng thở nhẹ, sao xoay chậm + bập bềnh, đốm lấp lánh nhấp nháy lệch nhịp.
        const calm = reduceMotion ? 0 : 1;
        node.halo.material.opacity = .75 + calm * Math.sin(time * 2.4) * .2;
        node.halo.scale.setScalar(1 + calm * Math.sin(time * 2.4) * .05);
        node.star.rotation.y = calm * Math.sin(time * 1.4) * .6;
        node.star.position.y = node.star.userData.baseY + calm * Math.sin(time * 3.4) * .08;
        node.sparkles.forEach(s => { const k = Math.max(0, Math.sin(time * 2.8 + s.userData.phase)); s.scale.setScalar(.12 + (reduceMotion ? .1 : k * .22)); });
      }
      // Mèo mới nhún nhẹ lệch nhịp, nhãn NEW! bập bềnh.
      if (!reduceMotion) node.cats.forEach((c, k) => { if (c.isSprite) { c.position.y = c.userData.baseY + Math.sin(time * 2.6) * .06; if (node.claimable) c.material.rotation = Math.sin(time * 5) * .06; } else c.scale.y = 1.35 * (1 + Math.sin(time * 3 + k * 1.7) * .03); });
      // Mèo chờ nhận: đi lon ton vòng tròn quanh chỗ đứng (vùng trống CLAIM_CLEAR, decorate()) cho người chơi chú ý; nút Claim bay theo con đầu.
      if (node.claimable && !reduceMotion) node.cats.forEach((c, k) => {
        if (c.isSprite) { const lead = node.cats[0]; c.position.x = lead.position.x; c.position.z = lead.position.z + .1; return; }
        const [x, z] = c.userData.spot, a = time * 1.3 + k * 2.1;
        c.position.set(x + Math.cos(a) * CLAIM_WALK, Math.abs(Math.sin(time * 9 + k)) * .05, z + Math.sin(a) * CLAIM_WALK);
        c.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
      });
    }
    for (const { fly, holder } of flyers) if (holder.visible) fly.visible = holder.userData.angle - scroll <= LOD_FAR;
    if (!reduceMotion) for (const { fly, holder, phase, radius } of flyers) {
      if (!holder.visible || !fly.visible) continue;
      // Bướm lượn vòng quanh chỗ đậu, nhấp nhô, cánh vỗ nhanh; đầu bướm hướng theo chiều bay.
      const a = time * .9 + phase;
      fly.position.set(Math.cos(a) * radius, .55 + Math.sin(time * 2.1 + phase) * .15, Math.sin(a) * radius);
      fly.rotation.y = -a;
      const flap = Math.sin(time * 18 + phase) * .9;
      fly.userData.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * flap; });
    }
    renderer.render(scene, camera);
  }

  return {
    render, focus, resize,
    start() { if (running) return; running = true; lastFrame = 0; resize(); renderer.setAnimationLoop(frame); },
    stop() { running = false; renderer.setAnimationLoop(null); },
    get focusIndex() { return focusIndex; },
  };
}

// ---------- Mèo 3D cho màn nhận thưởng ("You got") ----------
// Canvas trong suốt riêng: mèo 3D (cùng model + viền nâu với mèo trên Map) xoay vào, nhún nhẹ, lắc qua lại cho thấy dáng 3D.
// Trả về { stop() } để huỷ khi đóng màn thưởng.
const RUN = 3.2, REST = 1.8; // giây: chạy vòng / nghỉ nhún nhảy
export function catShowcase(container, breed, { reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  toonLook(renderer, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd9c4, TOON_LIGHT.hemi));
  const sun = new THREE.DirectionalLight(0xffffff, TOON_LIGHT.sun);
  sun.position.set(-2, 4, 5);
  scene.add(sun);
  const cat = newCatModel(breed), turn = new THREE.Group(), rig = cat.userData.rig;
  turn.add(cat);
  scene.add(turn);
  // Khung hình theo kích thước thật của model: tâm khối ở giữa, camera lùi đủ xa cho cả con mèo (kể cả tai, đuôi).
  const box = new THREE.Box3().setFromObject(cat), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  cat.position.sub(center);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100), radius = Math.max(size.x, size.y, size.z) * .62;
  camera.position.set(0, radius * .55, radius / Math.tan(15 * Math.PI / 180) * 1.5); // lùi xa hơn để còn chỗ cho mèo chạy vòng
  camera.lookAt(0, 0, 0);
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const start = performance.now();
  renderer.setAnimationLoop(now => {
    const t = (now - start) / 1000;
    if (reduceMotion) turn.rotation.y = -.35;
    else {
      // Xoay một vòng khi xuất hiện (mắt tròn xoe, miệng há "wow"), rồi lặp: chạy vòng vòng (mặt cười, nảy theo nhịp chân)
      // -> về giữa quay mặt ra khách, nhún nhảy hai nhịp, vẫy tai vẫy đuôi, nghiêng đầu (biểu cảm luân phiên theo từng pha).
      const spin = Math.min(1, t / 1.1), ease = 1 - Math.pow(1 - spin, 3);
      const u = Math.max(0, t - 1.1) % (RUN + REST), running = t > 1.1 && u < RUN, resting = t > 1.1 && !running, r = running ? u / RUN : 0;
      const lap = Math.PI * 4 * (r * r * (3 - 2 * r)), blend = Math.min(1, r / .12, (1 - r) / .12) * (running ? 1 : 0), e = blend * blend * (3 - 2 * blend);
      const R = size.x * .62, step = t * 15, rest = resting ? u - RUN : 0;
      turn.position.set(Math.cos(lap) * R * e, 0, Math.sin(lap) * R * .8 * e);
      turn.rotation.y = t <= 1.1 ? (1 - ease) * Math.PI * 2 : running ? -lap * e : Math.sin(rest * 2.2) * .35 * Math.min(1, rest * 3);
      const hop = running ? Math.abs(Math.sin(step * .5)) * .1 * e : resting ? Math.abs(Math.sin(rest * 6.2)) * .22 * Math.min(1, rest * 4) * Math.max(0, 1 - Math.max(0, rest - 1.1) * 4) : Math.abs(Math.sin(t * 3.2)) * .06;
      turn.position.y = hop * size.y * ease;
      // Vươn dài lúc bật lên, bẹp xuống lúc chạm đất.
      const air = resting ? Math.sin(rest * 6.2) : 0;
      turn.scale.set(1 + (resting ? -air * .06 : 0), 1 + (resting ? air * .12 : -Math.max(0, Math.cos(t * 6.4)) * .03 * ease), 1);
      turn.rotation.z = resting ? Math.sin(rest * 3) * .1 : 0; // nghiêng đầu
      const legSwing = running ? e : 0;
      rig?.legs.forEach((leg, i) => { leg.hip.rotation.x = Math.sin(step + (i === 0 || i === 3 ? 0 : Math.PI)) * .9 * legSwing; });
      rig?.tail.forEach((joint, i) => { joint.rotation.y = Math.sin(t * (resting ? 14 : 9) - i) * (resting ? .6 : .3); });
      rig?.ears.forEach((ear, i) => { ear.rotation.z = (i ? 1 : -1) * -.18 + Math.sin(t * 12 + i * 2) * (resting ? .22 : .06); });
      // Mặt: ngạc nhiên -> cười hí mắt khi chạy (thỉnh thoảng mở to mắt) -> sung sướng khi nhún nhảy.
      if (rig) setCatFace(rig, breed, t <= 1.1 ? 'focus' : resting ? (rest < .35 ? 'focus' : 'happy') : (Math.floor(t * 1.2) % 3 === 2 ? 'open' : 'happy'), 'open');
    }
    renderer.render(scene, camera);
  });
  return {
    stop() { renderer.setAnimationLoop(null); observer.disconnect(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
