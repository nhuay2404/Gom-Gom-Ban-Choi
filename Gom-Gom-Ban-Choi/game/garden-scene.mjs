// Khu vườn (màn 1–10): nền cỏ, hàng rào, bụi cây góc vườn, bướm bay; và bộ đồ vườn cho Deco.
// Mỗi món có chỗ đặt cố định [x, z, xoay?]; +z của món hướng vào giữa vườn (mèo đi tới từ phía đó).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const HALF = 3, TAU = Math.PI * 2;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
// Độ mịn kiểu subdivision, cùng mức với deco-room.mjs.
const ROUND = 5, RADIAL = 40;
const rbox = (w, h, d, r, color) => mesh(new RoundedBoxGeometry(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = RADIAL) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, 32, 24), color);
const group = (...children) => { const g = new THREE.Group(); g.add(...children); return g; };

export const GARDEN_PLACES = {
  flowers: [-2, 1.65], stump: [.2, 2.2], catnip: [2.2, 1.5], lantern: [1.15, 2.5], sandbox: [2.2, -.1],
  cathouse: [2, -2], pond: [-1.5, -1.4], hammock: [.35, -2.35, 0], birdbath: [-2.3, .35], bench: [-.8, 2.35],
};

const FLOWER_COLORS = ['#ff8fa0', '#ffd66b', '#b79cf0', '#fff4f0', '#ff9e6b'];
function flower(color, x, z, h = .28) {
  const stem = cyl(.015, .015, h, '#5fa83e', 6);
  stem.position.y = h / 2;
  const head = ball(.07, color); head.position.y = h; head.scale.y = .7;
  const eye = ball(.03, '#ffd66b'); eye.position.y = h + .04;
  return at(group(stem, head, eye), x, 0, z);
}

export const GARDEN_BUILD = {
  flowers() {
    const bed = group(at(cyl(.72, .78, .1, '#8a5a3a', 32), 0, .05, 0));
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, r = .15 + (i % 4) * .15;
      bed.add(flower(FLOWER_COLORS[i % FLOWER_COLORS.length], Math.cos(a) * r, Math.sin(a) * r, .22 + (i % 3) * .06));
    }
    bed.userData.sway = bed.children.slice(1);
    bed.userData.update = t => bed.userData.sway.forEach((f, i) => { f.rotation.z = Math.sin(t * 1.6 + i) * .07; });
    return bed;
  },
  stump() {
    const stump = group(at(cyl(.38, .44, .45, '#9a6a45'), 0, .225, 0), at(cyl(.36, .36, .02, '#e6c79a'), 0, .455, 0),
      at(cyl(.2, .2, .021, '#d2ad7a'), 0, .457, 0));
    for (let i = 0; i < 3; i++) { const root = rbox(.14, .1, .3, .04, '#8a5a3a'); root.rotation.y = i * 2.1; root.translateZ(.4); root.position.y = .04; stump.add(root); }
    return stump;
  },
  catnip() {
    const bush = group();
    [[0, .32, 0, .3], [.22, .24, .12, .22], [-.22, .22, .1, .2], [.05, .22, -.2, .22], [-.1, .5, .02, .2]].forEach(([x, y, z, r], i) => bush.add(at(ball(r, i % 2 ? '#8fd46a' : '#a6e07e'), x, y, z)));
    for (let i = 0; i < 7; i++) { const a = i * .9; bush.add(at(ball(.04, '#c9a6f5'), Math.cos(a) * .3, .5 + (i % 3) * .08, Math.sin(a) * .3)); }
    bush.userData.leaves = bush;
    return bush;
  },
  lantern() {
    const glow = mesh(new RoundedBoxGeometry(.3, .36, .3, ROUND, .05), mat('#fff0b8', { emissive: '#ffcf5a', emissiveIntensity: .9 }));
    const light = new THREE.PointLight('#ffcf7a', 4, 5, 1.6);
    light.position.y = 1.3;
    return group(at(cyl(.2, .24, .08, '#5a4a3a'), 0, .04, 0), at(cyl(.04, .04, 1.1, '#5a4a3a'), 0, .6, 0), at(glow, 0, 1.3, 0),
      at(mesh(new THREE.ConeGeometry(.26, .16, 4), '#5a4a3a'), 0, 1.56, 0).rotateY(Math.PI / 4), light);
  },
  sandbox() {
    const wood = '#c9955e';
    const sand = at(box(.9, .12, .9, '#f3dfb0'), 0, .12, 0);
    return group(at(box(1.05, .22, .08, wood), 0, .11, .5), at(box(1.05, .22, .08, wood), 0, .11, -.5),
      at(box(.08, .22, 1.05, wood), .5, .11, 0), at(box(.08, .22, 1.05, wood), -.5, .11, 0), sand,
      at(mesh(new THREE.ConeGeometry(.08, .14, 10), '#ff8fa0'), .25, .24, -.2), at(ball(.06, '#8fc9f2'), -.2, .22, .15));
  },
  cathouse() {
    const body = rbox(1.1, .8, 1, .06, '#f3d5a8');
    const roofL = rbox(1.25, .08, .72, .03, '#e8617f'), roofR = roofL.clone();
    roofL.rotation.z = .62; roofL.position.set(-.29, 1.03, 0);
    roofR.rotation.z = -.62; roofR.position.set(.29, 1.03, 0);
    const door = new THREE.Mesh(new THREE.CircleGeometry(.24, 24), new THREE.MeshBasicMaterial({ color: '#4a2e20' }));
    door.position.set(0, .34, .505);
    const sign = at(box(.34, .12, .03, '#fffaf0'), 0, .66, .51);
    return group(at(body, 0, .4, 0), roofL, roofR, door, sign);
  },
  pond() {
    const water = mesh(new THREE.CylinderGeometry(.8, .8, .04, 64), mat('#6fc3e0', { roughness: .15, transparent: true, opacity: .85 }));
    water.castShadow = false;
    const stones = group();
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; const s = rbox(.24, .12, .18, .05, i % 2 ? '#c8c2b8' : '#b5aea3'); s.position.set(Math.cos(a) * .9, .06, Math.sin(a) * .9); s.rotation.y = -a; stones.add(s); }
    const pad = new THREE.Mesh(new THREE.CircleGeometry(.14, 20), mat('#6fbf4a'));
    pad.rotation.x = -Math.PI / 2; pad.position.set(.3, .052, -.25);
    const koi = ['#f39a45', '#fff4f0'].map((color, i) => {
      const fish = group(ball(.07, color), at(mesh(new THREE.ConeGeometry(.05, .1, 10), color), -.1, 0, 0));
      fish.children[0].scale.set(1.4, .6, .8); fish.children[1].rotation.z = Math.PI / 2;
      fish.userData.phase = i * Math.PI;
      return fish;
    });
    const pond = group(at(water, 0, .02, 0), stones, pad, ...koi);
    pond.userData.fish = koi;
    pond.userData.update = t => koi.forEach(f => {
      const a = t * .5 + f.userData.phase;
      f.position.set(Math.cos(a) * .45, .03, Math.sin(a) * .45);
      f.rotation.y = -a - Math.PI / 2;
    });
    return pond;
  },
  hammock() {
    const wood = '#9a6a45';
    const cloth = mesh(new THREE.CylinderGeometry(.34, .34, 1.4, 32, 1, true, Math.PI / 2, Math.PI), mat('#8fc9f2', { side: THREE.DoubleSide }));
    cloth.rotation.z = Math.PI / 2;
    const sling = at(group(cloth), 0, .72, 0);
    const hammock = group(at(cyl(.06, .07, 1.3, wood), -.95, .65, 0), at(cyl(.06, .07, 1.3, wood), .95, .65, 0), sling,
      at(cyl(.012, .012, .3, '#fffaf0', 6), -.78, .95, 0).rotateZ(1), at(cyl(.012, .012, .3, '#fffaf0', 6), .78, .95, 0).rotateZ(-1));
    hammock.userData.update = t => { sling.rotation.x = Math.sin(t * 1.1) * .06; };
    return hammock;
  },
  birdbath() {
    const bird = group(ball(.08, '#8fc9f2'), at(ball(.055, '#8fc9f2'), .07, .07, 0), at(mesh(new THREE.ConeGeometry(.02, .05, 8), '#ffb347'), .14, .07, 0).rotateZ(-Math.PI / 2));
    bird.children[0].scale.set(1.2, .9, .9);
    bird.position.set(0, .95, .28);
    bird.rotation.y = -Math.PI / 2;
    bird.userData.home = bird.position.clone();
    const bath = group(at(cyl(.25, .3, .08, '#cfd8e0'), 0, .04, 0), at(cyl(.09, .12, .7, '#cfd8e0'), 0, .43, 0), at(cyl(.36, .2, .14, '#dfe6ec'), 0, .84, 0),
      at(cyl(.3, .3, .02, '#8fd0ef'), 0, .9, 0), bird);
    bath.userData.bird = bird;
    return bath;
  },
  bench() {
    const wood = '#b9854a', legs = '#5a4a3a';
    const b = group();
    [-.12, .12].forEach(z => b.add(at(rbox(1.4, .06, .2, .02, wood), 0, .46, z)));
    [-.18, .02].forEach(y => b.add(at(rbox(1.4, .06, .08, .02, wood), 0, .7 + y, -.26)));
    [-.6, .6].forEach(x => { b.add(at(box(.07, .46, .07, legs), x, .23, .15), at(box(.07, .8, .07, legs), x, .4, -.24)); });
    return b;
  },
};

// Nền cỏ vẽ bằng canvas: cỏ thường / cỏ ba lá / đồng hoa / lối đá.
export function groundTexture(entry) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = entry.color; g.fillRect(0, 0, 512, 512);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { g.fillStyle = rnd() > .5 ? '#ffffff1c' : '#2a5a1a1c'; g.fillRect(rnd() * 512, rnd() * 512, 3, 7); }
  if (entry.id === 'ground-clover') for (let i = 0; i < 160; i++) { g.fillStyle = '#5fa83e88'; const x = rnd() * 512, y = rnd() * 512; [0, 2.1, 4.2].forEach(a => { g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 5, 0, TAU); g.fill(); }); }
  if (entry.id === 'ground-meadow') for (let i = 0; i < 220; i++) { g.fillStyle = FLOWER_COLORS[i % FLOWER_COLORS.length]; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 4, 0, TAU); g.fill(); }
  if (entry.id === 'ground-path') {
    g.fillStyle = '#9fd46a'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 * 32; x < 512; x += 64) { g.fillStyle = rnd() > .5 ? '#e0d9cc' : '#cfc7b8'; g.beginPath(); g.ellipse(x + 30, y + 30, 26, 22, rnd(), 0, TAU); g.fill(); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Hàng rào quanh vườn, dựng lại khi đổi kiểu. Thấp nên không cần mờ đi như tường phòng.
export function buildFence(entry) {
  const fence = new THREE.Group();
  const side = (build) => [[0, -HALF - .05, 0], [0, HALF + .05, Math.PI], [-HALF - .05, 0, Math.PI / 2], [HALF + .05, 0, -Math.PI / 2]]
    .forEach(([x, z, rot]) => { const g = build(); g.position.set(x, 0, z); g.rotation.y = rot; fence.add(g); });
  if (entry.id === 'fence-hedge') side(() => group(at(rbox(HALF * 2 + .2, .6, .32, .14, entry.color), 0, .3, 0)));
  else if (entry.id === 'fence-stone') side(() => { const g = group(); for (let i = 0; i < 9; i++) g.add(at(rbox(.66, .34 + (i % 2) * .06, .3, .06, i % 2 ? '#c8c2b8' : '#b5aea3'), -2.7 + i * .675, .18, 0)); return g; });
  else side(() => {
    const g = group(at(box(HALF * 2 + .2, .06, .04, entry.color), 0, .42, 0), at(box(HALF * 2 + .2, .06, .04, entry.color), 0, .2, 0));
    for (let i = 0; i <= 12; i++) { const post = at(rbox(.12, .6, .05, .02, entry.color), -3 + i * .5, .3, .02); g.add(post); if (entry.id === 'fence-white') g.add(at(mesh(new THREE.ConeGeometry(.085, .1, 4), entry.color), -3 + i * .5, .64, .02).rotateY(Math.PI / 4)); }
    return g;
  });
  fence.traverse(node => { if (node.isMesh) node.castShadow = false; });
  return fence;
}

// Bụi cây trang trí 4 góc vườn (ngoài lối đi của mèo).
export function gardenCorners() {
  const corners = new THREE.Group();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    const bush = group(at(ball(.34, '#6fbf4a'), 0, .3, 0), at(ball(.24, '#86d05e'), .2 * sx, .22, -.15 * sz), at(ball(.2, '#5fa83e'), -.18 * sx, .2, .18 * sz));
    if (i % 2) bush.add(flower('#ff8fa0', .1, .1, .5));
    bush.position.set(sx * 2.85, 0, sz * 2.85);
    corners.add(bush);
  });
  return corners;
}

// Bướm: bay lượn quanh bồn hoa (hoặc giữa vườn), mèo rình vồ. Trả về danh sách để room-cats đọc vị trí.
export function makeButterflies(scene) {
  return ['#ffd66b', '#ff9fb6'].map((color, i) => {
    const wingMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const wing = () => { const w = new THREE.Mesh(new THREE.CircleGeometry(.08, 12), wingMat); w.scale.set(1, 1.3, 1); return w; };
    const left = wing(), right = wing();
    left.position.x = -.07; right.position.x = .07;
    const pivotL = group(left), pivotR = group(right);
    const fly = group(pivotL, pivotR, at(new THREE.Mesh(new THREE.CapsuleGeometry(.015, .08, 3, 6), new THREE.MeshBasicMaterial({ color: '#5a3a26' })), 0, 0, 0));
    fly.children[2].rotation.x = Math.PI / 2;
    scene.add(fly);
    const self = {
      node: fly, phase: i * 3, center: new THREE.Vector3(), scared: 0,
      update(t, dt, center) {
        self.center.copy(center);
        self.scared = Math.max(0, self.scared - dt);
        const a = t * (.5 + i * .12) + self.phase, r = .5 + Math.sin(t * .3 + i) * .25 + self.scared * .8;
        fly.position.set(center.x + Math.cos(a) * r, .7 + Math.sin(t * 1.7 + i) * .2 + self.scared * .6, center.z + Math.sin(a) * r);
        fly.rotation.y = -a;
        const flap = Math.sin(t * 22 + i) * .9;
        pivotL.rotation.y = flap; pivotR.rotation.y = -flap;
      },
      get position() { return fly.position; },
      scare() { self.scared = 1.5; },
    };
    return self;
  });
}
