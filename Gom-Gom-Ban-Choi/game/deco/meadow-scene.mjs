// Môi trường quanh khu nhà ở Deco: bãi cỏ xanh có hoa, cây tròn / cây thông, bụi cây, nấm, đá — cùng phong cách với Home (map-world.mjs).
// Không có trời / mây: sương mù cùng màu trời xanh của Home che mép bãi cỏ nên xa dần hoà vào nền trời; màu cỏ / sương đổi theo ambient (day / dusk / night).
// Cảnh dựng một lần, cố định (gộp khối bằng mergeStatic); các vật rải ngoài khung khu nhà để không chạm đồ chơi / mèo.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic } from './mesh-detail.mjs';
import { TOON, toonMat } from './toon.mjs';

const TAU = Math.PI * 2;
const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: 1, metalness: 0, specularIntensity: .2, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const cone = (r, h, color, seg = 8) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, sphereSegments(r), Math.max(5, sphereSegments(r) - 3)), color);

// Màu theo ambient: cỏ, sương / nền (xanh trời như Home), tán lá, thân cây, đá. Shader toon tăng bão hoà nên mã màu ở đây hơi nhạt.
export const MEADOW_LOOKS = {
  day: { ground: '#a2d97e', fog: '#a8dcfa', leaf: '#6cc154', leafDark: '#4aa84a', pine: '#3e8f4a', bush: '#78c85c', wood: '#a8764a', rock: '#c0b8aa' },
  dusk: { ground: '#b8b07c', fog: '#f0b88c', leaf: '#8aa84c', leafDark: '#6e9444', pine: '#58804a', bush: '#8eac54', wood: '#8a5c3c', rock: '#a89a88' },
  night: { ground: '#34503e', fog: '#1c2540', leaf: '#2c5a3e', leafDark: '#244c38', pine: '#1f4a3a', bush: '#2e5a40', wood: '#3a3038', rock: '#40485a' },
};

// Cỏ lặp liền mép: mảng sáng tối + nét cỏ + hoa trắng / hồng li ti (cùng kiểu texture cỏ của Home). Tông trắng để màu nhân theo ambient.
function groundTexture() {
  const S = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wrap = (x, y, draw) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy); };
  for (let i = 0; i < 70; i++) { // mảng sáng tối
    const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 40;
    g.fillStyle = rnd() < .5 ? '#ffffff' : '#9fc98a'; g.globalAlpha = .5;
    wrap(x, y, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * .6, 0, 0, TAU); g.fill(); });
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#7fb866'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 90; i++) { // nét cỏ
    wrap(rnd() * S, rnd() * S, (px, py) => { g.beginPath(); g.moveTo(px - 3, py + 4); g.lineTo(px - 4, py - 3); g.moveTo(px + 2, py + 4); g.lineTo(px + 4, py - 4); g.stroke(); });
  }
  for (let i = 0; i < 30; i++) { // hoa li ti
    const pink = rnd() < .4;
    wrap(rnd() * S, rnd() * S, (px, py) => {
      g.fillStyle = pink ? '#ff9ec0' : '#ffffff';
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(px + Math.cos(a) * 3.6, py + Math.sin(a) * 3.6, 2.8, 0, TAU); g.fill(); }
      g.fillStyle = '#ffc83a'; g.beginPath(); g.arc(px, py, 2.2, 0, TAU); g.fill();
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  texture.anisotropy = 4;
  return texture;
}

// Cây kiểu Home: thân nâu + tán tròn hoặc hai tầng nón.
function roundTree(m, rnd) {
  const tree = group(), height = .8 + rnd() * .5;
  tree.add(at(cyl(.11, .16, height, m.wood, 8), 0, height / 2, 0));
  if (rnd() < .4) {
    tree.add(at(cone(.7, .95, m.pine), 0, height + .25, 0), at(cone(.52, .85, m.pine), 0, height + .85, 0));
  } else {
    const crown = ball(.72 + rnd() * .15, rnd() < .5 ? m.leaf : m.leafDark);
    crown.scale.y = .92;
    tree.add(at(crown, 0, height + .55, 0));
  }
  tree.rotation.y = rnd() * TAU;
  return tree;
}
function bushClump(m, rnd) {
  const bush = group();
  for (let k = 0; k < 3; k++) bush.add(at(ball(.28 + rnd() * .1, m.bush), (k - 1) * .3, .2 + (k === 1 ? .08 : 0), rnd() * .1));
  bush.rotation.y = rnd() * TAU;
  return bush;
}
function flowerPatch(m, rnd) { // khóm hoa 5 cánh: cánh trắng / hồng, nhụy vàng
  const patch = group(), n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = rnd() * .38, flower = group(), petal = rnd() < .45 ? m.petalPink : m.petal;
    for (let k = 0; k < 5; k++) flower.add(at(ball(.07, petal), Math.cos(k / 5 * TAU) * .08, .12, Math.sin(k / 5 * TAU) * .08));
    flower.add(at(ball(.055, m.heart), 0, .14, 0));
    patch.add(at(flower, Math.cos(a) * d, 0, Math.sin(a) * d));
  }
  return patch;
}
function mushroom(m, rnd) {
  const g = group(), s = 1.3 + rnd() * .5;
  g.add(at(cyl(.045, .06, .16, m.stem, 8), 0, .08, 0));
  const cap = mesh(new THREE.SphereGeometry(.15, 12, 7, 0, TAU, 0, Math.PI / 2), rnd() < .3 ? m.capPink : m.cap);
  cap.scale.y = .8; g.add(at(cap, 0, .14, 0));
  g.scale.setScalar(s);
  return g;
}
function rockPile(m, rnd) {
  const pile = group(), n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = .22 + rnd() * .3, rock = mesh(new THREE.DodecahedronGeometry(r, 0), m.rock);
    rock.scale.set(1 + rnd() * .4, .6 + rnd() * .2, 1 + rnd() * .3);
    rock.rotation.y = rnd() * TAU;
    pile.add(at(rock, (rnd() - .5) * .7, r * .3, (rnd() - .5) * .7));
  }
  return pile;
}
function tuft(m, rnd) { // cụm cỏ xanh: vài mũi nhọn ngả nghiêng
  const t = group();
  for (let j = 0; j < 4; j++) {
    const blade = cone(.05, .2 + rnd() * .12, m.grass, 5);
    blade.position.set((j - 1.5) * .06, .1, (rnd() - .5) * .08); blade.rotation.z = (j - 1.5) * .3;
    t.add(blade);
  }
  return t;
}

// bounds: khung khu nhà { x0, x1, z0, z1 } (toạ độ cảnh, đã cộng lề) — vật rải ngoài khung này.
export function buildMeadow(bounds) {
  const root = new THREE.Group();
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const look = MEADOW_LOOKS.day;
  const groundMat = mat('#ffffff', { map: groundTexture(), color: look.ground });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.31; ground.receiveShadow = true;
  ground.userData.noOutline = true;
  root.add(ground);

  const mats = {
    wood: mat(look.wood), leaf: mat(look.leaf), leafDark: mat(look.leafDark), pine: mat(look.pine), bush: mat(look.bush), rock: mat(look.rock),
    grass: mat('#5fb548'), petal: mat('#ffffff'), petalPink: mat('#ff9ec0'), heart: mat('#ffd23f'),
    cap: mat('#f2605a'), capPink: mat('#ff9ec0'), stem: mat('#fff1dc'),
  };
  const props = group();
  const free = (x, z, margin) => x < bounds.x0 - margin || x > bounds.x1 + margin || z < bounds.z0 - margin || z > bounds.z1 + margin;
  const cx = (bounds.x0 + bounds.x1) / 2, cz = (bounds.z0 + bounds.z1) / 2;
  const scatter = (count, minR, maxR, margin, make) => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 40; tries++) {
      const a = rnd() * TAU, d = minR + Math.sqrt(rnd()) * (maxR - minR), x = cx + Math.cos(a) * d * 1.25, z = cz + Math.sin(a) * d;
      if (!free(x, z, margin)) continue;
      const node = make(); node.position.x += x; node.position.z += z;
      props.add(node); placed++;
    }
  };
  scatter(46, 0, 56, 2.5, () => { const tree = roundTree(mats, rnd); tree.scale.setScalar(1.3 + rnd() * .7); return tree; });
  scatter(40, 0, 52, 1.8, () => { const bush = bushClump(mats, rnd); bush.scale.setScalar(1.1 + rnd() * .5); return bush; });
  scatter(70, 0, 54, 1.4, () => flowerPatch(mats, rnd));
  scatter(26, 0, 50, 1.4, () => mushroom(mats, rnd));
  scatter(30, 0, 56, 1.6, () => rockPile(mats, rnd));
  scatter(150, 0, 48, 1.2, () => tuft(mats, rnd));
  root.add(props);
  mergeStatic(props);

  const fog = new THREE.Fog(look.fog, 55, 190), background = new THREE.Color(look.fog);
  // Đổi màu theo ambient: các vật liệu dùng chung nên chỉ đổi màu cỏ, cây, đá + sương / nền (hoa / nấm giữ nguyên).
  function setAmbient(mode) {
    const l = MEADOW_LOOKS[mode] || MEADOW_LOOKS.day;
    groundMat.color.set(l.ground);
    for (const key of ['wood', 'leaf', 'leafDark', 'pine', 'bush', 'rock']) mats[key].color.set(l[key]);
    fog.color.set(l.fog); background.set(l.fog);
  }
  return { root, fog, background, setAmbient };
}
