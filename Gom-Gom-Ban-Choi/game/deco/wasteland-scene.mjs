// Môi trường quanh khu nhà ở Deco: không còn trời / mây / nền xanh, chỉ là một vùng đất hoang trống trải, màu xỉn và buồn —
// nền đất khô nứt nẻ, cây trơ cành, gốc cây, đá, bụi cỏ úa. Khu nhà (vườn + phòng) nằm giữa như một mảnh đất cần được "hồi sinh".
// Sương mù cùng màu nền che mép đất (không có đường chân trời), màu đất / sương đổi theo ambient (day / dusk / night).
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
const cone = (r, h, color, seg = 6) => mesh(new THREE.ConeGeometry(r, h, seg), color);

// Màu theo ambient: đất, sương / nền, đá, thân cây khô, cỏ úa. Đất vẫn xanh lá nhưng xỉn / ngả xám (xanh buồn); shader toon còn tăng
// bão hoà ×1.35 nên các mã màu ở đây cố tình nhạt hơn màu muốn thấy.
export const WASTE_LOOKS = {
  day: { ground: '#8a9772', fog: '#a9b499', rock: '#858a7c', wood: '#665a4c', grass: '#a2a56c' },
  dusk: { ground: '#80795c', fog: '#a39b7e', rock: '#77705f', wood: '#574638', grass: '#988a58' },
  night: { ground: '#2e3b3d', fog: '#141b22', rock: '#38424a', wood: '#2a2c34', grass: '#3a4a45' },
};

// Mặt đất khô: nền xỉn + vệt đất sẫm / sáng + vết nứt gấp khúc + vài viên sỏi. Lặp được (vẽ lại phần tràn mép).
function groundTexture() {
  const S = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wrap = draw => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); draw(); g.restore(); } };
  for (let i = 0; i < 90; i++) { // vệt đất loang
    const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 60, dark = rnd() > .5;
    wrap(() => { const grad = g.createRadialGradient(x, y, 0, x, y, r); grad.addColorStop(0, dark ? '#00000014' : '#ffffff18'); grad.addColorStop(1, '#00000000'); g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2); });
  }
  g.strokeStyle = '#00000038'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 26; i++) { // vết nứt
    let x = rnd() * S, y = rnd() * S, a = rnd() * TAU;
    const path = [[x, y]];
    for (let k = 0, n = 4 + Math.floor(rnd() * 5); k < n; k++) { a += (rnd() - .5) * 1.2; x += Math.cos(a) * (14 + rnd() * 22); y += Math.sin(a) * (14 + rnd() * 22); path.push([x, y]); }
    wrap(() => { g.beginPath(); path.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); });
  }
  for (let i = 0; i < 420; i++) { g.fillStyle = rnd() > .5 ? '#00000022' : '#ffffff26'; g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 3, 2 + rnd() * 2); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  texture.anisotropy = 4;
  return texture;
}

// Cây trơ cành: thân nghiêng thon dần, vài cành chính xoè ra, mỗi cành mọc thêm nhánh con; không một chiếc lá.
function deadTree(wood, rnd) {
  const tree = group();
  const height = 2.4 + rnd() * 2.4, lean = (rnd() - .5) * .22, trunk = cyl(.09, .24, height, wood, 8);
  trunk.rotation.z = lean; at(trunk, -Math.sin(lean) * height / 2 * 0, height / 2, 0);
  tree.add(trunk, at(cyl(.3, .36, .1, wood, 8), 0, .04, 0)); // gốc bè ra
  const limb = (x, y, z, length, radius, yaw, pitch, depth) => {
    const arm = group(), body = cyl(radius * .45, radius, length, wood, 6);
    body.position.y = length / 2; arm.add(body);
    arm.position.set(x, y, z); arm.rotation.set(0, yaw, pitch, 'YZX');
    if (depth > 0) for (let k = 0; k < 2; k++) {
      const sub = limb(0, length * (.55 + k * .3), 0, length * (.5 - k * .1), radius * .5, (rnd() - .5) * 3, (k ? -1 : 1) * (.5 + rnd() * .5), depth - 1);
      arm.add(sub);
    }
    return arm;
  };
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) tree.add(limb(0, height * (.45 + .5 * i / n), 0, 1 + rnd() * 1.1, .07, i * 2.4 + rnd(), .5 + rnd() * .6, 1));
  tree.add(limb(0, height - .05, 0, .9 + rnd() * .5, .06, rnd() * TAU, .15 + rnd() * .3, 1)); // ngọn
  tree.rotation.y = rnd() * TAU;
  return tree;
}
const stump = (wood, rnd) => group(at(cyl(.28, .36, .4 + rnd() * .25, wood, 9), 0, .22, 0), at(cyl(.2, .2, .03, '#4a3f36', 9), 0, .5, 0));
function rockPile(color, rnd) {
  const pile = group(), n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = .25 + rnd() * .5, rock = mesh(new THREE.IcosahedronGeometry(r, 0), color);
    rock.scale.set(1 + rnd() * .5, .55 + rnd() * .35, 1 + rnd() * .4);
    rock.rotation.y = rnd() * TAU;
    pile.add(at(rock, (rnd() - .5) * .9, r * .35, (rnd() - .5) * .9));
  }
  return pile;
}
function dryGrass(color, rnd) { // bụm cỏ úa: các mũi nhọn ngả nghiêng
  const tuft = group();
  for (let i = 0; i < 7; i++) {
    const blade = cone(.03 + rnd() * .02, .3 + rnd() * .35, color, 4);
    const a = rnd() * TAU, d = rnd() * .18;
    blade.position.set(Math.cos(a) * d, .16, Math.sin(a) * d);
    blade.rotation.set((rnd() - .5) * .8, 0, (rnd() - .5) * .8);
    tuft.add(blade);
  }
  return tuft;
}
function deadBush(wood, rnd) { // bụi gai khô: những cành mảnh toả ra từ một điểm
  const bush = group();
  for (let i = 0; i < 9; i++) {
    const len = .5 + rnd() * .6, stick = cyl(.012, .025, len, wood, 4);
    stick.position.y = len / 2 * .8; stick.rotation.set((rnd() - .5) * 1.5, 0, (rnd() - .5) * 1.5);
    bush.add(stick);
  }
  return bush;
}

// bounds: khung khu nhà { x0, x1, z0, z1 } (toạ độ cảnh, đã cộng lề) — vật rải ngoài khung này.
export function buildWasteland(bounds) {
  const root = new THREE.Group();
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const look = WASTE_LOOKS.day;
  const groundMat = mat('#ffffff', { map: groundTexture(), color: look.ground });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.31; ground.receiveShadow = true;
  ground.userData.noOutline = true;
  root.add(ground);

  const mats = { rock: mat(look.rock), wood: mat(look.wood), grass: mat(look.grass) };
  const props = group();
  const free = (x, z, margin) => x < bounds.x0 - margin || x > bounds.x1 + margin || z < bounds.z0 - margin || z > bounds.z1 + margin;
  const cx = (bounds.x0 + bounds.x1) / 2, cz = (bounds.z0 + bounds.z1) / 2;
  const scatter = (count, minR, maxR, margin, make) => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 40; tries++) {
      const a = rnd() * TAU, d = minR + Math.sqrt(rnd()) * (maxR - minR), x = cx + Math.cos(a) * d * 1.25, z = cz + Math.sin(a) * d;
      if (!free(x, z, margin)) continue;
      const node = make(); node.position.x += x; node.position.z += z; node.position.y += 0;
      props.add(node); placed++;
    }
  };
  scatter(44, 0, 56, 2.5, () => { const tree = deadTree(mats.wood, rnd); tree.scale.setScalar(1.25 + rnd() * .5); return tree; });
  scatter(22, 0, 50, 2, () => stump(mats.wood, rnd));
  scatter(56, 0, 56, 1.6, () => rockPile(mats.rock, rnd));
  scatter(190, 0, 48, 1.2, () => dryGrass(mats.grass, rnd));
  scatter(46, 0, 50, 1.4, () => deadBush(mats.wood, rnd));
  root.add(props);
  mergeStatic(props);

  const fog = new THREE.Fog(look.fog, 55, 190), background = new THREE.Color(look.fog);
  // Đổi màu theo ambient: các vật liệu dùng chung nên chỉ đổi màu 5 chất liệu + sương / nền.
  function setAmbient(mode) {
    const l = WASTE_LOOKS[mode] || WASTE_LOOKS.day;
    groundMat.color.set(l.ground);
    mats.rock.color.set(l.rock); mats.wood.color.set(l.wood); mats.grass.color.set(l.grass);
    fog.color.set(l.fog); background.set(l.fog);
  }
  return { root, fog, background, setAmbient };
}
