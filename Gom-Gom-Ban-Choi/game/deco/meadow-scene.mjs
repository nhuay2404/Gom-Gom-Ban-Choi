// Môi trường quanh khu nhà ở Deco: bãi cỏ xanh có hoa, cây tròn / cây thông, bụi cây, nấm, đá — cùng phong cách với Home (map-world.mjs).
// Không có trời / mây: sương mù cùng màu trời xanh của Home che mép bãi cỏ nên xa dần hoà vào nền trời; màu cỏ / sương đổi theo ambient (day / dusk / night).
// Cảnh dựng một lần, cố định (gộp khối bằng mergeStatic); các vật rải ngoài khung khu nhà để không chạm đồ chơi / mèo.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic } from './mesh-detail.mjs';
import { TOON, toonMat, DECAL_LAYER } from './toon.mjs';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
// Tông "chill": ngày xanh lá dịu + trời pastel (không xanh neon); chiều là giờ vàng — cỏ xanh ánh vàng, trời đào hồng (không nâu olive);
// đêm xanh lam trăng sâu (không tím đặc), cỏ / lá ngả xanh ngọc tối để đèn vàng nổi bật.
export const MEADOW_LOOKS = {
  day: { ground: '#a6c68c', fog: '#bfe2f2', leaf: '#74bf5c', leafDark: '#57a656', pine: '#4a9257', bush: '#80c565', wood: '#a8784e', rock: '#c4bcae' },
  dusk: { ground: '#aab886', fog: '#f7c6a8', leaf: '#97b45c', leafDark: '#7c9e52', pine: '#5f8a55', bush: '#a0b864', wood: '#96633f', rock: '#b8a494' },
  night: { ground: '#2e4a48', fog: '#1b2846', leaf: '#29544c', leafDark: '#214840', pine: '#1c4440', bush: '#2b5648', wood: '#3a3440', rock: '#3e4a5e' },
};

// Cỏ lặp liền mép: mảng sáng tối + nét cỏ + hoa trắng / hồng li ti (cùng kiểu texture cỏ của Home). Tông trắng để màu nhân theo ambient.
function groundTexture() {
  const S = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wrap = (x, y, draw) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy); };
  for (let i = 0; i < 70; i++) { // mảng sáng tối
    const x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 26;
    g.fillStyle = rnd() < .5 ? '#ffffff' : '#c9e6b8'; g.globalAlpha = .35;
    wrap(x, y, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * .6, 0, 0, TAU); g.fill(); });
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#a4d48a'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < 60; i++) { // nét cỏ
    wrap(rnd() * S, rnd() * S, (px, py) => { g.beginPath(); g.moveTo(px - 3, py + 4); g.lineTo(px - 4, py - 3); g.moveTo(px + 2, py + 4); g.lineTo(px + 4, py - 4); g.stroke(); });
  }
  for (let i = 0; i < 12; i++) { // hoa li ti
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
  texture.repeat.set(110, 110);
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

// ---------- Con đường phía trước vườn ----------
// Con đường dài chạy ngang (trục x) song song hàng rào vườn, đối diện vườn: vệ cỏ, vỉa hè gạch, lề đường (bó vỉa), mặt đường nhựa với vạch
// kẻ đứt + vạch mép, vạch qua đường trước cổng vườn, cây đèn đường, ghế, chậu cây ven vỉa hè. Toàn bộ tĩnh (mergeStatic).
// Bề rộng từ gần vườn ra xa (m): vệ cỏ GAP, vỉa hè SIDEWALK, lề CURB, đường ROAD, lề, vỉa hè.
const ROAD = { gap: 1.1, sidewalk: 1.5, curb: .24, road: 3.8, length: 240, lampEvery: 9 };
export const ROAD_BAND = ROAD.gap + ROAD.sidewalk * 2 + ROAD.curb * 2 + ROAD.road;
const LAMP_GLOW = { day: '#ffe9b0', dusk: '#ffd08a', night: '#fff2b8' };
// zNear: mặt ngoài hàng rào vườn phía trước (z lớn nhất của khung khu nhà). Trả về { group, lampMat }.
function buildRoad(zNear) {
  const group_ = group();
  const m = {
    asphalt: mat('#7d8494'), curb: mat('#f4ecd8'), paver: mat('#e8cfa6'), paint: mat('#fff7e0'), pole: mat('#4a5a5c'), bench: mat('#c8925a'),
    plant: mat('#5fb548'), pot: mat('#e07a50'),
  };
  const lampMat = new THREE.MeshBasicMaterial({ color: LAMP_GLOW.day, fog: true });
  // Vạch sơn / khe gạch là lớp mỏng sát mặt đường: không nhận / đổ bóng (nhận bóng của chính tấm đường dưới nó thì thành vệt tối sọc "shadow acne").
  const flat = node => { node.userData.noOutline = true; node.castShadow = node.receiveShadow = false; return node; };
  const slab = (x0, x1, z0, z1, y0, y1, color, noOutline = false) => {
    const node = mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), color);
    node.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return noOutline ? flat(node) : node;
  };
  const X0 = -ROAD.length / 2, X1 = ROAD.length / 2, base = -.31;
  // Mốc z: vỉa hè gần, lề gần, đường, lề xa, vỉa hè xa.
  const zS0 = zNear + ROAD.gap, zS1 = zS0 + ROAD.sidewalk, zC1 = zS1 + ROAD.curb, zR1 = zC1 + ROAD.road, zC2 = zR1 + ROAD.curb, zS2 = zC2 + ROAD.sidewalk;
  group_.add(
    slab(X0, X1, zS0, zS1, base, base + .1, m.paver),
    slab(X0, X1, zS1, zC1, base, base + .16, m.curb),
    slab(X0, X1, zC1, zR1, base, base + .03, m.asphalt),
    slab(X0, X1, zR1, zC2, base, base + .16, m.curb),
    slab(X0, X1, zC2, zS2, base, base + .1, m.paver),
  );
  // Mặt đường / vỉa hè nằm sát nền: không đổ bóng lên vạch sơn phía trên; chỉ lề đường (cao hơn) và cây đèn đổ bóng.
  // Cũng không viền: lớp viền toon của tấm mỏng bị kéo lên trước mặt đường (polygonOffset) và phủ đen các vạch sơn nằm trên nó.
  for (const node of group_.children) if (node.geometry.parameters.height < .15) { node.castShadow = false; node.userData.noOutline = true; }
  // Khe gạch vỉa hè: vạch mảnh ngang mỗi 1.2 m cho đỡ trơn.
  const mid = (zC1 + zR1) / 2, topRoad = base + .03;
  for (let x = X0 + 1; x < X1; x += 1.2) for (const [a, b] of [[zS0, zS1], [zC2, zS2]]) group_.add(slab(x, x + .04, a, b, base + .1, base + .104, '#cdb487', true));
  // Vạch giữa đường (đứt), vạch mép đường liền hai bên.
  for (let x = X0; x < X1; x += 2.4) group_.add(slab(x, x + 1.2, mid - .07, mid + .07, topRoad, topRoad + .006, m.paint, true));
  for (const z of [zC1 + .22, zR1 - .22]) group_.add(slab(X0, X1, z - .04, z + .04, topRoad, topRoad + .006, m.paint, true));
  // Vạch qua đường (ngựa vằn) thẳng cổng vườn.
  const crossX = -1.6;
  for (let k = -3; k <= 3; k++) group_.add(slab(crossX + k * .5 - .17, crossX + k * .5 + .17, zC1 + .4, zR1 - .4, topRoad, topRoad + .008, m.paint, true));
  // Cây đèn đường: cột + tay đỡ hướng ra đường + chao đèn sáng. Đặt trên vỉa hè gần vườn, cách vạch qua đường.
  const lampZ = (zS0 + zS1) / 2 + .1, lampHeads = [];
  for (let x = X0 + 4; x < X1; x += ROAD.lampEvery) {
    if (Math.abs(x - crossX) < 2.5) continue;
    lampHeads.push(x); // chao đèn ở (x, 2.93 + base, lampZ + .72): tay đỡ .72 m xoay -π/2 quanh trục đứng thành +z
    const lamp = group();
    lamp.add(at(cyl(.08, .11, .22, m.pole, 8), 0, .1 + base + .0, 0), at(cyl(.045, .06, 2.9, m.pole, 8), 0, 1.55 + base, 0));
    const arm = at(slab(0, .7, -.035, .035, 0, .07, m.pole), .35, 2.98 + base, 0);
    lamp.add(arm);
    const head = mesh(new THREE.SphereGeometry(.17, 10, 8), lampMat); head.castShadow = false;
    head.scale.set(1.2, .8, 1.2);
    lamp.add(at(head, .72, 2.93 + base, 0), at(cone(.24, .16, m.pole, 10), .72, 3.06 + base, 0));
    // Tay đỡ chĩa ra phía đường (+z): xoay quanh y một góc -π/2 thì +x cục bộ thành +z.
    lamp.position.set(x, 0, lampZ); lamp.rotation.y = -Math.PI / 2;
    group_.add(lamp);
  }
  // Ghế dài và chậu cây xen giữa các cây đèn.
  for (let x = X0 + 8.5; x < X1; x += ROAD.lampEvery * 2) {
    if (Math.abs(x - crossX) < 3) continue;
    const bench = group();
    bench.add(slab(-.55, .55, -.2, .2, .22, .28, m.bench), slab(-.55, .55, -.22, -.17, .28, .62, m.bench), slab(-.5, -.42, -.18, .18, 0, .22, m.pole), slab(.42, .5, -.18, .18, 0, .22, m.pole));
    bench.position.set(x, base + .1, lampZ + .15); group_.add(bench);
    const planter = group();
    planter.add(at(cyl(.2, .16, .32, m.pot, 10), 0, .16, 0), at(ball(.3, m.plant), 0, .6, 0));
    planter.position.set(x + ROAD.lampEvery, base + .1, lampZ + .15); group_.add(planter);
  }
  mergeStatic(group_);
  const glow = lampGlow(lampHeads, lampZ + .72, base + 2.81, base + .166);
  group_.add(glow.pools, glow.beams);
  return { group: group_, lampMat, glow, zFrom: zNear + ROAD.gap * .4, zTo: zS2 + .8 };
}

// Ánh đèn đường (dusk / night): vệt sáng hình nón từ chao đèn xuống + quầng sáng tròn trên vỉa hè / mặt đường. Không phải SpotLight thật
// (hàng chục đèn): lớp phủ cộng sáng (additive) — màu vật liệu chạy theo ambient, đen = tắt (ban ngày). Mỗi loại gộp một mesh cho mọi đèn.
// Nằm trên DECAL_LAYER (pass ID viền toon bỏ qua), không viền, không bóng, không chặn chạm. Quầng nằm ngay trên mặt lề đường (cao nhất).
const LAMP_POOL = { day: '#000000', dusk: '#301c0a', night: '#6a4618' };
const LAMP_BEAM = { day: '#000000', dusk: '#160e06', night: '#30220e' };
function lampGlow(xs, z, yTop, yGround) {
  const shaded = (geo, brightness) => { // nhân sáng từng đỉnh (vertex color): mờ dần ra mép
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) c.fill(brightness(p.getX(i), p.getY(i), p.getZ(i)), i * 3, i * 3 + 3);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  };
  const R = 1.5, H = yTop - yGround;
  const pool = shaded(new THREE.CircleGeometry(R, 40, 0, TAU).rotateX(-Math.PI / 2), (x, y, z) => (1 - Math.min(1, Math.hypot(x, z) / R)) ** 1.6);
  // Nón hở hai đầu, sáng ở chao rồi nhạt dần xuống đất; hai mặt cùng cộng sáng nên số nhỏ.
  const beam = shaded(new THREE.CylinderGeometry(.14, R * .8, H, 32, 6, true), (x, y) => .25 + .75 * (y / H + .5));
  const merged = (geo, y) => mergeGeometries(xs.map(x => geo.clone().translate(x, y, z)));
  const make = (geo, color) => {
    const node = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
    }));
    node.layers.set(DECAL_LAYER);
    node.userData.noOutline = true;
    node.castShadow = node.receiveShadow = false;
    node.raycast = () => {};
    node.renderOrder = 2;
    // Ban ngày màu đen (= tắt) nhưng vẫn là ~10 nghìn tam giác trong suốt vẽ mỗi khung (đo được): màu đen thì coi như ẩn.
    // Getter theo màu nên tự đúng cả lúc ambient chuyển dần (fadeTo đổi màu từng khung), không cần chỗ khác bật / tắt.
    Object.defineProperty(node, 'visible', { get: () => node.material.color.r + node.material.color.g + node.material.color.b > 1e-4, set() {} });
    return node;
  };
  return { pools: make(merged(pool, yGround), LAMP_POOL.day), beams: make(merged(beam, yGround + H / 2), LAMP_BEAM.day) };
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
  const road = buildRoad(bounds.z1 + .3);
  root.add(road.group);
  const props = group();
  // Vật rải ngoài khung khu nhà và ngoài dải đường (cây không mọc giữa đường).
  const free = (x, z, margin) => (x < bounds.x0 - margin || x > bounds.x1 + margin || z < bounds.z0 - margin || z > bounds.z1 + margin)
    && !(z > road.zFrom - margin && z < road.zTo + margin);
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
  // Trả về các cặp [màu đang dùng, màu đích] để deco-room.mjs chuyển dần (cùng nhịp với ánh sáng), không đổi phụt.
  function ambientTargets(mode) {
    const l = MEADOW_LOOKS[mode] || MEADOW_LOOKS.day;
    return [
      [groundMat.color, l.ground], [fog.color, l.fog], [background, l.fog], [road.lampMat.color, LAMP_GLOW[mode] || LAMP_GLOW.day],
      [road.glow.pools.material.color, LAMP_POOL[mode] || LAMP_POOL.day], [road.glow.beams.material.color, LAMP_BEAM[mode] || LAMP_BEAM.day],
      ...['wood', 'leaf', 'leafDark', 'pine', 'bush', 'rock'].map(key => [mats[key].color, l[key]]),
    ];
  }
  return { root, fog, background, ambientTargets };
}
