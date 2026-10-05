// Bản đồ saga 3D: con đường nằm trên một "trống cỏ" khổng lồ (hình trụ nằm ngang) như thế giới cuộn của Animal Crossing.
// Lướt lên = trống lăn về phía trước, màn xa cong dần qua đường chân trời. Mỗi màn là khối đầu mèo nổi trên bệ tròn.
// Chỉ vẽ: dữ liệu màn / tiến độ do menu-controller.js truyền vào qua render(); chạm màn thì gọi onPick(index).
import * as THREE from 'three';
import { toonMat, toonLook, TOON_LIGHT, MAP_INK } from './toon.mjs';
import { roundedBox } from './mesh-detail.mjs';
import { catModel } from './room-cats.mjs';

// R: bán kính trống; STEP: góc giữa hai màn (R * STEP = khoảng cách trên mặt cỏ); SWING / FREQ: đường uốn sang hai bên.
const WORLD = { R: 11, STEP: .3, SWING: 1.55, FREQ: .95, ROAD: 1.05, EDGE: .2 };
const INK = MAP_INK;
const SKY_FOG = 0x8ed4fc;
const COLORS = {
  grass: '#8fd16a', grassDark: '#79bf57',
  road: 0xfcd9a6, roadDone: 0xf9b6cb,
  body: { normal: 0xf2557f, chill: 0xf2557f, hard: 0xf2557f, boss: 0x8f5fdc, locked: 0x8a6f62 },
};
// Góc nhìn: camera đứng trên đỉnh trống nhìn chéo xuống; bề ngang thấy được ~ ±HALF_W đơn vị ở chỗ màn đang chọn.
const CAM = { height: 11.5, back: 9.5, aimAhead: -1, aimUp: 0, halfW: 3.9 };

const angleOf = t => t * WORLD.STEP;
const pathX = t => WORLD.SWING * Math.sin(t * WORLD.FREQ);
// Điểm trên mặt trống (toạ độ của trống, chưa xoay): góc a đi về phía xa (-z) khi tăng.
const onDrum = (x, a, lift = 0) => new THREE.Vector3(x, (WORLD.R + lift) * Math.cos(a), -(WORLD.R + lift) * Math.sin(a));

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
const pawTexture = color => canvasTexture(64, 64, (g) => { g.scale(64 / 24, 64 / 24); g.fillStyle = color; g.fill(PAW_PATH); });
// Mặt trước khối đầu mèo: số trắng viền nâu (bóng nâu nhẹ phía dưới), ổ khoá trắng nếu chưa mở.
function faceTexture(number, locked) {
  return canvasTexture(256, 256, (g, w) => {
    const ink = '#5b2e1c', y = locked ? 100 : 132;
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
function signTexture(text) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#7a4a2a';
    g.font = '800 38px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
  });
}

// ---------- Khối hình ----------
// Viền nâu kiểu sticker: vẽ lại khối ở mặt sau, phình nhẹ (đủ cho khối lồi như đầu mèo, bệ, cây).
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
// pad (đơn vị thế giới): nét dày đều mọi cạnh theo kích thước thật của khối, dùng cho khối dẹt (đầu mèo, tai).
function withInk(mesh, grow = .05, pad = 0) {
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
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .9, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return g;
};
const HEAD = { w: 1.22, h: 1.14, r: .42, depth: .24, bevel: .06, inset: .13 };
const headGeo = {
  rim: extrude(roundedRectShape(HEAD.w, HEAD.h, HEAD.r), HEAD.depth, HEAD.bevel),
  face: extrude(roundedRectShape(HEAD.w - HEAD.inset * 2, HEAD.h - HEAD.inset * 2, HEAD.r - HEAD.inset * .8), .05, .03),
  ear: extrude(roundedPolygonShape([[-.24, -.14], [.2, -.14], [-.06, .26]], .1), .16, .045),
  earInner: extrude(roundedPolygonShape([[-.14, -.08], [.1, -.08], [-.04, .15]], .06), .03, .015),
};
const FACE_Z = HEAD.depth / 2 + HEAD.bevel + .02;

// Cây kiểu Animal Crossing: thân nâu + tán tròn / tán nón; bụi cây; hoa 3D nhỏ; đá.
const decorMats = {
  trunk: toonMat({ color: 0x9a6a43 }), leaf: toonMat({ color: 0x5fb548 }), leafDark: toonMat({ color: 0x3f9a45 }), pine: toonMat({ color: 0x3e8f4a }),
  bush: toonMat({ color: 0x6cc154 }), rock: toonMat({ color: 0xb8b0a2 }), petal: toonMat({ color: 0xffffff }), petalPink: toonMat({ color: 0xff9ec0 }), heart: toonMat({ color: 0xffd23f }),
};
function tree(rnd) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.11, .15, .7, 8), decorMats.trunk);
  trunk.position.y = .35; g.add(trunk);
  if (rnd() < .45) {
    for (let k = 0; k < 2; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.62 - k * .16, .85, 9), decorMats.pine);
      cone.position.y = .85 + k * .45; g.add(withInk(cone, .04));
    }
  } else {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(.62, 14, 10), rnd() < .5 ? decorMats.leaf : decorMats.leafDark);
    crown.position.y = 1.15; crown.scale.y = .92; g.add(withInk(crown, .04));
  }
  g.scale.setScalar(.85 + rnd() * .45);
  return g;
}
function bush(rnd) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.28 + rnd() * .1, 12, 8), decorMats.bush);
    ball.position.set((k - 1) * .3, .2 + (k === 1 ? .08 : 0), rnd() * .1);
    g.add(withInk(ball, .05));
  }
  return g;
}
function flower(rnd) {
  const g = new THREE.Group(), mat = rnd() < .45 ? decorMats.petalPink : decorMats.petal;
  for (let k = 0; k < 5; k++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), mat);
    const a = k / 5 * Math.PI * 2;
    petal.position.set(Math.cos(a) * .08, .12, Math.sin(a) * .08);
    g.add(petal);
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), decorMats.heart);
  heart.position.y = .14; g.add(heart);
  return g;
}
function rock(rnd) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(.22 + rnd() * .12, 0), decorMats.rock);
  m.scale.y = .6; m.position.y = .08; m.rotation.y = rnd() * 3;
  return withInk(m, .06);
}

// ---------- Bệ màn boss: bánh kem hai tầng (các màn khác dùng bệ thường) ----------
// Tầng đế vàng bánh quy có hạt ngọc trai viền mép, tầng trên phủ kem (hồng màn đã mở / kem nâu màn khoá / tím boss) có
// viền kem gợn sóng, mặt bánh kem trắng; quanh chân bệ là cụm cỏ + hoa nhỏ. Hình học + vật liệu dùng chung mọi màn.
const PED = {
  base: new THREE.CylinderGeometry(.8, .86, .2, 36), tier: new THREE.CylinderGeometry(.7, .74, .17, 36), plate: new THREE.CylinderGeometry(.64, .67, .06, 36),
  pearl: new THREE.SphereGeometry(.05, 10, 8), scallop: new THREE.SphereGeometry(.085, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  tuft: new THREE.ConeGeometry(.06, .2, 5), petal: new THREE.SphereGeometry(.045, 8, 6),
};
const pedMat = {
  biscuit: toonMat({ color: 0xf0c27a }), pearl: toonMat({ color: 0xfffaf0, rim: .4 }), cream: toonMat({ color: 0xfff6ea }),
  leaf: toonMat({ color: 0x5fb548 }), petalPink: toonMat({ color: 0xff9ec0 }), petalWhite: toonMat({ color: 0xffffff }), heart: toonMat({ color: 0xffd23f }),
  tier: { open: toonMat({ color: 0xff9ab8 }), locked: toonMat({ color: 0xd9c2b0 }), boss: toonMat({ color: 0xc4a3f2 }) },
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
  const g = new THREE.Group(), parts = [];
  const base = new THREE.Mesh(PED.base, pedMat.biscuit); base.position.y = .1;
  const tier = new THREE.Mesh(PED.tier, pedMat.tier[kind]); tier.position.y = .285;
  const plate = new THREE.Mesh(PED.plate, pedMat.cream); plate.position.y = .395;
  for (const m of [base, tier]) { m.castShadow = m.receiveShadow = true; g.add(withInk(m, .035)); }
  plate.receiveShadow = true; g.add(plate);
  parts.push(base, tier, plate);
  // Ngọc trai quanh mép đế, viền kem gợn sóng quanh mép tầng trên.
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2, pearl = new THREE.Mesh(PED.pearl, pedMat.pearl);
    pearl.position.set(Math.cos(a) * .8, .2, Math.sin(a) * .8); g.add(pearl);
  }
  for (let k = 0; k < 14; k++) {
    const a = (k + .5) / 14 * Math.PI * 2, scallop = new THREE.Mesh(PED.scallop, pedMat.cream);
    scallop.position.set(Math.cos(a) * .69, .355, Math.sin(a) * .69); scallop.scale.set(1, .8, 1); g.add(scallop);
  }
  // Cụm cỏ + hoa quanh chân bệ (lệch nhịp cho tự nhiên, chừa phía trước để không che mặt bệ).
  [[-.95, .25], [-.78, -.55], [.9, .35], [.62, -.72], [-.2, -.95], [.25, -.92]].forEach(([x, z], k) => {
    const tuft = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const blade = new THREE.Mesh(PED.tuft, pedMat.leaf);
      blade.position.set((j - 1) * .06, .09, 0); blade.rotation.z = (j - 1) * .35; tuft.add(blade);
    }
    if (k % 2 === 0) {
      const mat = k % 4 ? pedMat.petalWhite : pedMat.petalPink;
      for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2, petal = new THREE.Mesh(PED.petal, mat); petal.position.set(Math.cos(a) * .05, .22, Math.sin(a) * .05); tuft.add(petal); }
      const heart = new THREE.Mesh(PED.petal, pedMat.heart); heart.position.y = .24; heart.scale.setScalar(.8); tuft.add(heart);
    }
    tuft.position.set(x, 0, z); tuft.rotation.y = k * 1.3;
    g.add(tuft);
  });
  return { group: g, parts, top: .43 };
}
// Mèo 3D (cùng model với Home) đứng cạnh màn mở giống mới, có viền nâu kiểu sticker như khối đầu mèo.
function newCatModel(breed) {
  const cat = catModel(breed), solids = [];
  cat.traverse(node => { if (node.isMesh && node.material?.isMeshToonMaterial && !node.material.transparent && !node.userData.noOutline) solids.push(node); });
  solids.forEach(mesh => withInk(mesh, .07));
  cat.traverse(node => { if (node.isMesh) node.castShadow = true; });
  return cat;
}
function newBadgeTexture() {
  return canvasTexture(160, 64, (g, w, h) => {
    g.fillStyle = '#ff5f8a'; g.strokeStyle = '#5b2e1c'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill(); g.stroke();
    g.font = '900 34px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.lineJoin = 'round'; g.strokeText('NEW!', w / 2, h / 2 + 2); g.fillStyle = '#fff'; g.fillText('NEW!', w / 2, h / 2 + 2);
  });
}

// ---------- Cảnh ----------
export function createMapWorld(container, { onPick, avatarSvg } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.className = 'map-canvas';

  const scene = new THREE.Scene();
  toonLook(renderer, scene);
  // Trời: canvas trong suốt, nền là ảnh trời mây của Home (.map.is-3d trong ui-portrait.css); sương chân trời cùng màu trời ở ảnh.
  scene.background = null;
  scene.fog = new THREE.Fog(SKY_FOG, 17, 29);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 120);
  camera.position.set(0, WORLD.R + CAM.height, CAM.back);
  camera.lookAt(0, WORLD.R + CAM.aimUp, -CAM.aimAhead);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe8b8, TOON_LIGHT.hemi));
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
  const pickables = [];
  // Trống nhỏ (cong mạnh) nên cả con đường quấn gần trọn một vòng: chỉ hiện vật gần camera, phần đã qua chân trời
  // hoặc sau lưng camera ẩn đi, không thì đầu đường (màn 1) lộ ra ngay sau màn cuối.
  const culled = [];
  const VISIBLE = { behind: -1.25, ahead: 1.45 };
  let nodes = [], levelCount = 0, scroll = 0, target = 0, velocity = 0, focusIndex = 0, running = false, lastFrame = 0;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const avatarTexture = (() => {
    if (!avatarSvg) return null;
    // SVG mèo viết cho HTML (có thuộc tính lặp, không width / height): cho trình phân tích HTML sửa, xuất lại thành XML hợp lệ
    // có kích thước rồi vẽ ra canvas. Nạp thẳng thì ảnh lỗi / rỗng.
    const tex = canvasTexture(256, 272, () => {});
    const img = new Image(), holder = document.createElement('div');
    holder.innerHTML = avatarSvg;
    const el = holder.firstElementChild;
    el.setAttribute('width', 256); el.setAttribute('height', 272);
    const svg = new XMLSerializer().serializeToString(el);
    img.onload = () => { tex.image.getContext('2d').drawImage(img, 0, 0, 256, 272); tex.needsUpdate = true; };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return tex;
  })();

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
    const holder = new THREE.Group(), a = angleOf(t);
    holder.position.copy(onDrum(x, a, lift));
    holder.rotation.x = -a;
    holder.add(object);
    holder.userData.angle = a;
    culled.push(holder);
    content.add(holder);
    return holder;
  }

  function levelNode(index, { locked, tier, current, newCats = [] }) {
    const g = new THREE.Group();
    // Màn boss: bệ bánh kem (pedestal()), còn lại bệ thường; màn đang chơi có vòng sáng hồng nhấp nháy quanh bệ.
    const ped = tier === 'boss' ? pedestal(locked ? 'locked' : 'boss') : plainPedestal();
    g.add(ped.group);
    let ring = null;
    if (current) {
      ring = new THREE.Mesh(new THREE.TorusGeometry(.86, .06, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff7fa6, transparent: true, opacity: .8 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = .06;
      g.add(ring);
    }
    // Đầu mèo đứng trên bệ, ngả nhẹ ra sau cho mặt hướng về camera.
    const head = new THREE.Group();
    head.position.y = ped.top;
    const tilt = new THREE.Group();
    tilt.rotation.x = -.42;
    head.add(tilt);
    const bodyColor = locked ? COLORS.body.locked : (COLORS.body[tier] ?? COLORS.body.normal);
    const cream = toonMat({ color: locked ? 0xf1e7e1 : 0xfff3ee, rim: .3 });
    const cat = new THREE.Group();
    cat.position.y = HEAD.h / 2 + .02;
    tilt.add(cat);
    const rim = new THREE.Mesh(headGeo.rim, cream);
    rim.castShadow = true;
    cat.add(withInk(rim, 0, .075));
    const bodyMat = toonMat({ color: bodyColor, rim: .35 });
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
      const inner = new THREE.Mesh(headGeo.earInner, toonMat({ color: 0xff8fb3 }));
      inner.position.set(-.02, .01, .11);
      ear.add(inner);
      cat.add(ear);
    }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.14), new THREE.MeshBasicMaterial({ map: faceTexture(index + 1, locked), transparent: true, fog: true }));
    face.position.z = FACE_Z + .03;
    cat.add(face);
    if (tier === 'boss' && !locked) {
      const crown = new THREE.Group(), gold = toonMat({ color: 0xffc83d, rim: .4 });
      crown.add(withInk(new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .14, 16), gold), .06));
      for (let k = 0; k < 5; k++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 6), gold);
        const a = k / 5 * Math.PI * 2;
        spike.position.set(Math.cos(a) * .22, .16, Math.sin(a) * .22);
        crown.add(spike);
      }
      crown.position.y = 1.5; crown.rotation.z = .2;
      tilt.add(crown);
    }
    let avatar = null;
    if (current && avatarTexture) {
      avatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: avatarTexture, depthTest: true }));
      avatar.scale.setScalar(.95);
      avatar.position.set(pathX(index) > 0 ? -1.05 : 1.05, 1.05, .2);
      g.add(avatar);
    }
    g.add(head);
    // Màn mở giống mèo mới: mèo 3D đứng phía ngoài đường (phía mép màn hình), mèo đại diện đứng phía trong; có nhãn NEW!.
    // Mèo đứng trong một nhóm ngả về camera như khối đầu mèo (catTilt, chỉnh mỗi frame), không thì từ trên cao chỉ thấy đỉnh thân.
    const side = pathX(index) >= 0 ? 1 : -1, cats = [], catTilt = new THREE.Group();
    g.add(catTilt);
    newCats.forEach((breed, k) => {
      const cat = newCatModel(breed);
      cat.scale.setScalar(1.35);
      cat.position.set(side * (1.08 + k * .8), 0, .2 - k * .2);
      cat.rotation.y = -side * .3;
      catTilt.add(cat);
      cats.push(cat);
    });
    if (newCats.length) {
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: newBadgeTexture() }));
      badge.scale.set(.78, .31, 1);
      badge.position.set(side * (1.08 + (newCats.length - 1) * .4), 1.25, .3);
      g.add(badge);
      cats.push(badge);
    }
    if (avatar && newCats.length) avatar.position.x = -side * 1.05;
    for (const mesh of [...ped.parts, rim, body, face]) { mesh.userData.level = index; mesh.userData.locked = locked; pickables.push(mesh); }
    const holder = plant(g, pathX(index), index, 0);
    return { holder, head, tilt, catTilt, ring, avatar, cats, baseY: ped.top, index, locked, phase: index * .7 };
  }

  function sign(t) {
    const g = new THREE.Group(), wood = toonMat({ color: 0xc8925a });
    for (const x of [-.9, .9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, 1.1, 8), wood);
      post.position.set(x, .55, 0); g.add(withInk(post, .1));
    }
    const board = new THREE.Mesh(roundedBox(2.3, .72, .12, 2, .05), toonMat({ color: 0xf3d5a4 }));
    board.position.y = 1.05; board.castShadow = true;
    g.add(withInk(board, .03));
    const text = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .69), new THREE.MeshBasicMaterial({ map: signTexture('More levels coming soon!'), transparent: true }));
    text.position.set(0, 1.05, .07);
    g.add(text);
    g.rotation.x = -.25;
    plant(g, pathX(t), t);
  }

  function scatterDecor(count) {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const t0 = -3, t1 = count + 3;
    for (let i = 0; i < 150; i++) {
      const t = t0 + rnd() * (t1 - t0), side = rnd() < .5 ? -1 : 1;
      const clear = Math.abs(pathX(t)) + 1.4;
      const x = side * (clear + rnd() * 4.5);
      // Chừa chỗ quanh mỗi màn cho bệ + mèo mới đứng cạnh (cây / bụi không che).
      if (Math.abs(x - pathX(t)) < (Math.abs(t - Math.round(t)) < .6 ? 2.6 : 1.3)) continue;
      const roll = rnd(), far = Math.abs(x) > 3.2;
      const obj = far && roll < .55 ? tree(rnd) : roll < .3 ? bush(rnd) : roll < .8 ? flower(rnd) : rock(rnd);
      obj.rotation.y = rnd() * Math.PI * 2;
      obj.traverse(n => { if (n.isMesh && n.material !== inkMat) n.castShadow = true; });
      plant(obj, x, t);
    }
  }

  // Vẽ lại toàn bộ đường + màn theo tiến độ hiện tại. levels: [{ locked, tier, current }].
  function render(levels) {
    content.clear();
    pickables.length = 0;
    culled.length = 0;
    levelCount = levels.length;
    const open = levels.filter(l => !l.locked).length;
    const end = levelCount - 1;
    ribbon(-.8, end + .9, WORLD.ROAD + WORLD.EDGE * 2, .015, toonMat({ color: INK }));
    const doneTo = Math.max(-.8, open - 1);
    if (open > 0) ribbon(-.8, doneTo, WORLD.ROAD, .03, toonMat({ color: COLORS.roadDone }));
    ribbon(doneTo, end + .9, WORLD.ROAD, .03, toonMat({ color: COLORS.road }));
    // Dấu chân mèo: 2 dấu giữa mỗi hai màn, hồng đậm trên đoạn đã đi.
    const pawDone = new THREE.MeshBasicMaterial({ map: pawTexture('#ef5f8b'), transparent: true, depthWrite: false });
    const pawTodo = new THREE.MeshBasicMaterial({ map: pawTexture('#f7a3bd'), transparent: true, depthWrite: false });
    const pawGeo = new THREE.PlaneGeometry(.34, .34);
    for (let i = 0; i < end; i++) [.36, .64].forEach((f, k) => {
      const t = i + f, paw = new THREE.Mesh(pawGeo, i + 1 < open ? pawDone : pawTodo);
      paw.rotation.set(-Math.PI / 2, 0, (k ? -1 : 1) * .3 - Math.atan(WORLD.SWING * WORLD.FREQ * Math.cos(t * WORLD.FREQ) / (WORLD.R * WORLD.STEP)));
      plant(paw, pathX(t) + (k ? .16 : -.16), t, .045);
    });
    nodes = levels.map((l, i) => levelNode(i, l));
    sign(end + .95);
    scatterDecor(levelCount);
  }

  // ---------- Cuộn / chạm ----------
  const minScroll = () => -.15 * WORLD.STEP, maxScroll = () => (levelCount - .4) * WORLD.STEP;
  const clamp = v => Math.min(maxScroll(), Math.max(minScroll(), v));
  let pxPerLevel = 150;
  function focus(index, animate = true) {
    focusIndex = index;
    target = clamp(angleOf(index));
    if (!animate || reduceMotion) scroll = target;
    else scroll = clamp(target - WORLD.STEP * 1.5);
    velocity = 0;
  }
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    drag = { id: e.pointerId, y: e.clientY, x: e.clientX, moved: 0, t: performance.now() };
    velocity = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* sự kiện giả / con trỏ đã nhả */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) { hover(e); return; }
    const dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.moved += Math.abs(dy) + Math.abs(e.clientX - drag.x);
    drag.y = e.clientY; drag.x = e.clientX; drag.t = now;
    const delta = -dy / pxPerLevel * WORLD.STEP;
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
  function hover(e) { const h = hit(e); canvas.style.cursor = h && !h.locked ? 'pointer' : 'grab'; }
  function pick(e) {
    const h = hit(e);
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
    const dist = Math.hypot(CAM.height - CAM.aimUp, CAM.back + CAM.aimAhead);
    const fov = 2 * Math.atan(CAM.halfW / (dist * camera.aspect)) * 180 / Math.PI;
    camera.fov = Math.min(62, Math.max(34, fov));
    camera.updateProjectionMatrix();
    pxPerLevel = h / 5.2;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function frame(now) {
    const dt = lastFrame ? Math.min(50, now - lastFrame) / 1000 : 0;
    lastFrame = now;
    if (!drag) {
      if (Math.abs(velocity) > 1e-5) { target = clamp(target + velocity); velocity *= Math.pow(.86, dt * 60); }
      scroll += (target - scroll) * Math.min(1, dt * 7);
    }
    drum.rotation.x = scroll;
    const time = now / 1000;
    for (const object of culled) {
      const rel = object.userData.angle - scroll;
      object.visible = rel > VISIBLE.behind && rel < VISIBLE.ahead;
    }
    for (const node of nodes) {
      if (!node.holder.visible) continue;
      // Ngả mặt về phía camera: màn càng gần (đã lăn về phía camera) càng ngả ra sau, không bị nhìn dẹt từ trên xuống.
      node.tilt.rotation.x = Math.max(-1.25, Math.min(-.2, -.62 + (angleOf(node.index) - scroll) * 1.1));
      node.catTilt.rotation.x = node.tilt.rotation.x * .75;
      const bob = node.locked || reduceMotion ? 0 : Math.sin(time * 2.2 + node.phase) * .04;
      node.press = Math.max(0, (node.press || 0) - dt * 4);
      node.head.position.y = node.baseY + bob + (node.ring ? Math.abs(Math.sin(time * 3)) * .12 : 0) - node.press * .1;
      node.head.scale.set(1 + node.press * .08, 1 - node.press * .1, 1);
      if (node.ring) { const p = (time * 1.2) % 1; node.ring.scale.setScalar(1 + p * .35); node.ring.material.opacity = .85 * (1 - p); }
      if (node.avatar) node.avatar.position.y = 1.05 + (reduceMotion ? 0 : Math.sin(time * 3.4) * .08);
      // Mèo mới nhún nhẹ lệch nhịp, nhãn NEW! bập bềnh.
      if (!reduceMotion) node.cats.forEach((c, k) => { if (c.isSprite) c.position.y = 1.25 + Math.sin(time * 2.6) * .06; else c.scale.y = 1.35 * (1 + Math.sin(time * 3 + k * 1.7) * .03); });
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
