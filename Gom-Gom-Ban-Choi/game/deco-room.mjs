// Phòng mèo 3D (Three.js) dùng chung cho Home và Deco: kéo để xoay 360°, chụm hai ngón để zoom.
// Tường nào chắn giữa camera và phòng thì mờ đi (kiểu nhà búp bê). Đồ đạc dựng từ khối cơ bản bo tròn.
// Mèo khối 3D và hành vi của chúng nằm ở room-cats.mjs; chạm mèo để cưng.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCatLife } from './room-cats.mjs';
import { playSound } from './sound.mjs';
import { CATALOG, itemById, zoneState } from './deco-data.mjs';
import { GARDEN_PLACES, GARDEN_BUILD, groundTexture, buildFence, gardenCorners, makeButterflies } from './garden-scene.mjs';

const HALF = 3, WALL_H = 3, TAU = Math.PI * 2;
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
// Độ mịn kiểu subdivision: bo tròn nhiều nấc, trụ/cầu nhiều cạnh; vẫn nhẹ (vài chục nghìn tam giác cả phòng).
const ROUND = 5, RADIAL = 40;
const rbox = (w, h, d, r, color) => mesh(new RoundedBoxGeometry(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = RADIAL) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, 32, 24), color);
const group = (...children) => { const g = new THREE.Group(); g.add(...children); return g; };

// ---------- Đồ đạc: mỗi món một hàm dựng + chỗ đặt cố định [x, z, xoay] ----------
const PLACES = {
  rug: [0, .1, 0], armchair: [-1.85, -1.95], plant: [-2.4, 2.35], yarn: [-.6, 2.4], catbed: [1.05, 2.2],
  table: [2.4, -.45], lamp: [2.35, -2.4], cattree: [-2.3, .55], shelf: [.35, -2.66, 0], tank: [2.42, 1.15, -Math.PI / 2],
};
const BUILD = {
  rug() {
    const outer = cyl(1.55, 1.55, .04, '#f4a3b6', 48), inner = cyl(1.12, 1.12, .045, '#ffc9d5', 48);
    const g = group(at(outer, 0, .02, 0), at(inner, 0, .025, 0));
    g.scale.set(1, 1, .72);
    g.traverse(node => { node.castShadow = false; });
    return g;
  },
  armchair() {
    const c = '#e98b5a', wood = '#9a6a45';
    const legs = [[-.45, -.35], [.45, -.35], [-.45, .35], [.45, .35]].map(([x, z]) => at(cyl(.05, .04, .2, wood), x, .1, z));
    return group(...legs, at(rbox(1.2, .34, 1, .1, c), 0, .36, 0), at(rbox(1.2, .95, .28, .12, c), 0, .8, -.38),
      at(rbox(.24, .56, 1, .1, c), -.56, .5, 0), at(rbox(.24, .56, 1, .1, c), .56, .5, 0), at(rbox(.84, .14, .7, .06, '#ffd9c4'), 0, .58, .08));
  },
  plant() {
    const leaves = group(at(ball(.44, '#6fbf4a'), 0, 1.05, 0), at(ball(.3, '#5fa83e'), .26, .82, .12), at(ball(.28, '#7fd05a'), -.24, .78, -.1));
    const plant = group(at(cyl(.32, .24, .55, '#e98b5a'), 0, .275, 0), at(cyl(.29, .29, .02, '#7a4a2a'), 0, .55, 0), leaves);
    plant.userData.leaves = leaves; // mèo gặm lá thì lá rung
    return plant;
  },
  yarn() {
    const yarnBall = (color, x, z, y = .42) => at(ball(.19, color), x, y, z);
    const toy = yarnBall('#ffd66b', .02, .2, .47);
    const basket = group(at(cyl(.46, .38, .34, '#d9a36a'), 0, .17, 0), at(cyl(.4, .4, .02, '#b9854a'), 0, .34, 0),
      yarnBall('#ff8fa0', -.14, .06), yarnBall('#8fc9f2', .16, -.08), toy);
    basket.userData.toy = toy; // cuộn len mèo khều ra sàn
    toy.userData.home = toy.position.clone();
    return basket;
  },
  catbed() {
    const rim = mesh(new THREE.TorusGeometry(.5, .19, 24, 64), '#a9d3f5');
    rim.rotation.x = -Math.PI / 2;
    return group(at(rim, 0, .2, 0), at(cyl(.52, .55, .12, '#e8f4ff'), 0, .08, 0), at(cyl(.36, .36, .06, '#fff7ea'), 0, .16, 0));
  },
  table() {
    const wood = '#d9a36a';
    const mug = at(cyl(.1, .09, .17, '#7fc4e8'), .15, .885, .1);
    const table = group(at(cyl(.3, .36, .05, wood), 0, .025, 0), at(cyl(.06, .06, .7, wood), 0, .38, 0), at(cyl(.55, .55, .08, wood), 0, .76, 0),
      mug, at(cyl(.16, .16, .03, '#fffaf0'), -.18, .815, -.1));
    table.userData.mug = mug; // mèo đẩy cốc rơi khỏi bàn
    mug.userData.home = mug.position.clone();
    return table;
  },
  lamp() {
    const metal = '#8a6a4a';
    const shade = mesh(new THREE.CylinderGeometry(.26, .44, .5, RADIAL, 1, true),
      mat('#ffd66b', { emissive: '#ffb938', emissiveIntensity: .55, side: THREE.DoubleSide }));
    const light = new THREE.PointLight('#ffcf7a', 5, 6, 1.6);
    light.position.set(0, 1.7, 0);
    return group(at(cyl(.3, .34, .06, metal), 0, .03, 0), at(cyl(.035, .035, 1.8, metal), 0, .93, 0), at(shade, 0, 1.9, 0),
      at(ball(.1, mat('#fff6d8', { emissive: '#fff0c0', emissiveIntensity: 1 })), 0, 1.78, 0), light);
  },
  cattree() {
    const rope = '#dcc393', pad = '#f4a3b6';
    const toy = at(ball(.1, '#ffd66b'), .45, .72, .3);
    return group(at(rbox(1, .12, 1, .05, '#e6c79a'), 0, .06, 0), at(cyl(.09, .09, 1.05, rope), -.25, .6, -.2), at(cyl(.09, .09, 1.7, rope), .22, .9, .18),
      at(rbox(.72, .1, .72, .05, pad), -.1, 1.1, -.12), at(cyl(.36, .36, .14, pad), .22, 1.8, .18), at(cyl(.01, .01, .35, '#8a6a4a'), .45, .95, .3), toy);
  },
  shelf() {
    const wood = '#b9854a', parts = [at(box(1.6, 2, .06, wood), 0, 1, -.22), at(box(.08, 2, .5, wood), -.76, 1, 0), at(box(.08, 2, .5, wood), .76, 1, 0)];
    [.04, .68, 1.32, 1.96].forEach(y => parts.push(at(box(1.6, .07, .5, wood), 0, y, 0)));
    const colors = ['#e8617f', '#8fc9f2', '#ffd66b', '#7fc45a', '#b79cf0', '#f39a45'];
    [.07, .71, 1.35].forEach((y, shelf) => {
      let x = -.66;
      for (let i = 0; x < .6; i++) {
        const w = .1 + ((i * 7 + shelf * 3) % 5) * .025, h = .36 + ((i * 5 + shelf) % 4) * .05;
        parts.push(at(box(w, h, .34, colors[(i + shelf * 2) % colors.length]), x + w / 2, y + h / 2 + .035, .02));
        x += w + .02;
      }
    });
    return group(...parts);
  },
  tank() {
    const glass = mesh(new THREE.BoxGeometry(1.1, .72, .52), mat('#dff4ff', { transparent: true, opacity: .22, roughness: .1 }));
    const water = mesh(new THREE.BoxGeometry(1.04, .56, .46), mat('#6fc3e0', { transparent: true, opacity: .5, roughness: .2 }));
    glass.castShadow = water.castShadow = false;
    const fish = ['#f39a45', '#ffd66b', '#ff8fa0'].map((color, i) => {
      const tail = mesh(new THREE.ConeGeometry(.05, .09, 20), color);
      tail.rotation.z = Math.PI / 2; tail.position.x = -.1;
      const body = ball(.07, color); body.scale.set(1.3, .8, .6);
      const f = group(body, tail);
      f.userData.phase = i * 2.1;
      return f;
    });
    const tank = group(at(rbox(1.2, .7, .62, .05, '#b9854a'), 0, .35, 0), at(glass, 0, 1.07, 0), at(water, 0, 1, 0),
      at(box(1.04, .06, .46, '#f3dfb0'), 0, .76, 0), ...fish.map(f => at(f, 0, 1, 0)));
    tank.userData.fish = fish; // mèo ngồi xem cá bơi
    tank.userData.update = t => fish.forEach(f => {
      const a = t * .8 + f.userData.phase;
      f.position.set(Math.sin(a) * .38, 1 + Math.sin(a * 1.7) * .08, Math.cos(a * .6) * .12);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    });
    return tank;
  },
};

// Đồ vườn dùng chung cơ chế đặt/dựng với đồ phòng khách.
Object.assign(PLACES, GARDEN_PLACES);
Object.assign(BUILD, GARDEN_BUILD);

// ---------- Sàn: vân gỗ / thảm / gạch vẽ bằng canvas ----------
function floorTexture(entry) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = entry.color; g.fillRect(0, 0, 512, 512);
  if (entry.id === 'floor-tiles') {
    g.fillStyle = '#ffffff55';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
    g.strokeStyle = '#ffffff99'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
  } else if (entry.id === 'floor-carpet') {
    for (let i = 0; i < 2500; i++) { g.fillStyle = Math.random() > .5 ? '#ffffff18' : '#00000010'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  } else {
    g.strokeStyle = '#00000026'; g.lineWidth = 3;
    for (let row = 0; row < 8; row++) {
      const y = row * 64; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
      const offset = (row % 2) * 128 + 60;
      for (let x = offset; x < 512; x += 256) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------- Thumbnail cho ô đồ trong Deco: chụp chính model 3D của món đó ----------
// Renderer nhỏ riêng (192×192), mỗi món chụp một lần rồi lưu lại dạng ảnh; đồ đạc chụp góc 3/4, tự canh khung.
let thumbKit = null;
const thumbCache = {};
function thumbStudio() {
  if (thumbKit) return thumbKit;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(192, 192, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff8e8', '#e0b98a', 2.2));
  const sun = new THREE.DirectionalLight('#fff1d6', 1.9);
  sun.position.set(3, 7, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(28, 1, .05, 60);
  return (thumbKit = { renderer, scene, camera });
}
const slab = (w, d, top, edge = '#c79a5f') => {
  const node = mesh(new THREE.BoxGeometry(w, .12, d), mat(edge));
  node.material = [mat(edge), mat(edge), top, mat(edge), mat(edge), mat(edge)];
  node.position.y = -.06;
  return node;
};
function thumbSubject(entry) {
  if (entry.cat === 'furniture') return BUILD[entry.id]();
  if (entry.cat === 'floors') { // tấm sàn / nền đúng texture
    const top = mat('#ffffff', { roughness: .9, map: entry.zone === 'garden' ? groundTexture(entry) : floorTexture(entry) });
    return group(slab(1.6, 1.6, top));
  }
  if (entry.zone === 'garden') { // khoảnh vườn nhỏ có đúng kiểu rào
    return group(slab(1.7, 1.7, mat('#9fd46a', { roughness: .95 }), '#8a6a45'), buildFence(entry, .75));
  }
  // tường phòng khách: góc phòng nhỏ với đúng màu tường, sàn gỗ, chân tường trắng, ô cửa sổ
  const wall = mat(entry.color), trim = mat('#ffffff');
  return group(slab(1.5, 1.5, mat('#e4b574'), '#c79a5f'),
    at(box(1.5, 1.2, .08, wall), 0, .6, -.71), at(box(.08, 1.2, 1.5, wall), -.71, .6, 0),
    at(box(1.5, .1, .03, trim), 0, .05, -.66), at(box(.03, .1, 1.5, trim), -.66, .05, 0),
    at(new THREE.Mesh(new THREE.PlaneGeometry(.42, .5), new THREE.MeshBasicMaterial({ color: '#cfeaff' })), .25, .72, -.665));
}
export function thumbnail(entry) {
  if (thumbCache[entry.id]) return thumbCache[entry.id];
  const { renderer, scene, camera } = thumbStudio();
  const subject = thumbSubject(entry);
  subject.userData.update?.(0);
  scene.add(subject);
  subject.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(subject), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const radius = size.length() / 2, distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * .82;
  camera.position.copy(center).add(new THREE.Vector3(.75, .62, 1).normalize().multiplyScalar(distance));
  camera.lookAt(center);
  renderer.render(scene, camera);
  thumbCache[entry.id] = renderer.domElement.toDataURL('image/png');
  scene.remove(subject);
  subject.traverse(node => { if (node.isMesh) { node.geometry.dispose(); [].concat(node.material).forEach(m => { m.map?.dispose(); m.dispose(); }); } });
  return thumbCache[entry.id];
}

export function createRoom() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'room-canvas';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  const HOME_VIEW = new THREE.Vector3(7.9, 7.1, 7.9);
  camera.position.copy(HOME_VIEW);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .8, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 9; controls.maxDistance = 18;
  controls.minPolarAngle = .45; controls.maxPolarAngle = 1.22;
  controls.autoRotateSpeed = .7;
  controls.update();

  scene.add(new THREE.HemisphereLight('#fff8e8', '#e0b98a', 1.9));
  const sun = new THREE.DirectionalLight('#fff1d6', 1.9);
  sun.position.set(4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  sun.shadow.bias = -.0015;
  scene.add(sun);

  // Bệ diorama + sàn
  const floorMat = mat('#e4b574', { roughness: .9 });
  const edge = mat('#c79a5f');
  const floor = at(mesh(new THREE.BoxGeometry(HALF * 2, .3, HALF * 2), edge), 0, -.15, 0);
  floor.material = [edge, edge, floorMat, edge, edge, edge]; // mặt trên (+y) là sàn
  const living = new THREE.Group(), garden = new THREE.Group();
  living.add(floor);
  scene.add(living, garden, at(rbox(HALF * 2 + .7, .5, HALF * 2 + .7, .18, '#fff4da'), 0, -.52, 0));
  const groundMat = mat('#9fd46a', { roughness: .95 }), soil = mat('#8a6a45');
  const ground = at(mesh(new THREE.BoxGeometry(HALF * 2, .3, HALF * 2), soil), 0, -.15, 0);
  ground.material = [soil, soil, groundMat, soil, soil, soil];
  garden.add(ground, gardenCorners());
  let fence = null, fenceId = '', groundId = '';
  const groundTextures = {};
  const butterflies = makeButterflies(scene);
  const flowerCenter = new THREE.Vector3();

  // 4 bức tường; `normal` hướng vào trong phòng. Tường nào camera đứng sau thì mờ đi.
  const wallMats = [];
  const walls = [
    { normal: new THREE.Vector3(0, 0, 1), pos: [0, -HALF - .1], rot: 0 },
    { normal: new THREE.Vector3(0, 0, -1), pos: [0, HALF + .1], rot: Math.PI },
    { normal: new THREE.Vector3(1, 0, 0), pos: [-HALF - .1, 0], rot: Math.PI / 2 },
    { normal: new THREE.Vector3(-1, 0, 0), pos: [HALF + .1, 0], rot: -Math.PI / 2 },
  ].map(({ normal, pos, rot }, i) => {
    const wallMat = mat('#fff1d2', { transparent: true });
    wallMats.push(wallMat);
    const wall = group(at(mesh(new THREE.BoxGeometry(HALF * 2 + .4, WALL_H, .2), wallMat), 0, WALL_H / 2, 0),
      at(box(HALF * 2 + .4, .2, .08, mat('#ffffff', { transparent: true })), 0, .1, .13));
    if (i === 0) { // cửa sổ vòm
      const frame = mat('#f6d88f', { transparent: true });
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true }));
      const arch = new THREE.Mesh(new THREE.CircleGeometry(.6, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true }));
      wall.add(at(sky, -1.6, 1.55, .115), at(arch, -1.6, 2.2, .115), at(mesh(new THREE.BoxGeometry(.08, 1.9, .06), frame), -1.6, 1.75, .14),
        at(mesh(new THREE.BoxGeometry(1.34, .1, .12), frame), -1.6, .88, .16));
    }
    if (i === 2) { // tranh treo
      wall.add(at(mesh(new THREE.BoxGeometry(1, 1.2, .06), mat('#e0b36a', { transparent: true })), .9, 1.9, .13),
        at(new THREE.Mesh(new THREE.PlaneGeometry(.8, 1), new THREE.MeshBasicMaterial({ color: '#ffc9d5', transparent: true })), .9, 1.9, .165));
    }
    if (i === 3) { // đồng hồ tròn
      wall.add(at(mesh(new THREE.CylinderGeometry(.34, .34, .06, 32), mat('#ffffff', { transparent: true })), -1.3, 2.2, .13).rotateX(Math.PI / 2));
    }
    wall.position.set(pos[0], 0, pos[1]);
    wall.rotation.y = rot;
    wall.traverse(node => { if (node.isMesh) node.castShadow = false; });
    wall.userData = { normal, opacity: 1 };
    living.add(wall);
    return wall;
  });

  // Đồ đạc: dựng khi cần lần đầu
  const furniture = {};
  function piece(id) {
    if (!furniture[id]) {
      const node = BUILD[id]();
      const [x, z, rot] = PLACES[id];
      node.position.set(x, 0, z);
      node.rotation.y = rot ?? Math.atan2(-x, -z);
      node.visible = false;
      node.userData.pop = 1;
      scene.add(node);
      furniture[id] = node;
    }
    return furniture[id];
  }

  // Mèo: đàn mèo khối 3D có "não" riêng (room-cats.mjs). Tim bay lên khi mèo cụng mũi / liếm lông nhau.
  let container = null;
  const cats = createCatLife({
    scene, furniture, butterflies,
    get zone() { return zoneId; },
    heartsAt(position) {
      if (!container) return;
      const p = position.clone().project(camera);
      if (p.z > 1) return;
      spawnHearts((p.x + 1) / 2 * container.clientWidth, (1 - p.y) / 2 * container.clientHeight);
    },
  });
  let catKey = '';

  let floorId = '';
  const floorTextures = {};
  let zoneId = 'garden';
  function apply(deco) {
    zoneId = deco.zone;
    const state = zoneState(deco);
    living.visible = zoneId === 'living';
    garden.visible = zoneId === 'garden';
    butterflies.forEach(b => { b.node.visible = garden.visible; });
    if (container) container.dataset.zone = zoneId;
    if (garden.visible) {
      const fenceEntry = itemById(state.wall), groundEntry = itemById(state.floor);
      if (fenceId !== fenceEntry.id) { fenceId = fenceEntry.id; if (fence) garden.remove(fence); fence = buildFence(fenceEntry); garden.add(fence); }
      if (groundId !== groundEntry.id) {
        groundId = groundEntry.id;
        groundMat.map = groundTextures[groundId] ||= groundTexture(groundEntry);
        groundMat.color.set('#ffffff'); groundMat.needsUpdate = true;
      }
    }
    const wall = itemById(zoneState(deco, 'living').wall), floorEntry = itemById(zoneState(deco, 'living').floor);
    wallMats.forEach(m => m.color.set(wall.color));
    if (floorId !== floorEntry.id) {
      floorId = floorEntry.id;
      floorMat.map = floorTextures[floorId] ||= floorTexture(floorEntry);
      floorMat.color.set('#ffffff');
      floorMat.needsUpdate = true;
    }
    CATALOG.filter(entry => entry.cat === 'furniture').forEach(entry => {
      const show = entry.zone === zoneId && state.placed.includes(entry.id);
      if (!show && !furniture[entry.id]) return;
      const node = piece(entry.id);
      if (show && !node.visible) node.userData.pop = 0; // vừa hiện: nảy lên
      node.visible = show;
    });
    cats.furnitureChanged();
    if (catKey !== deco.cats.join()) { catKey = deco.cats.join(); cats.setCats(deco.cats); }
  }

  // Quay camera về phía một món đồ (camera đứng đối diện, nhìn món đồ tựa lưng vào tường).
  let turn = null;
  function focus(id) {
    const place = PLACES[id];
    if (!place || !id) return;
    const from = controls.getAzimuthalAngle();
    let to = Math.atan2(-place[0], -place[1]);
    to = from + ((((to - from) % TAU) + TAU + Math.PI) % TAU - Math.PI);
    turn = { from, to, start: performance.now() };
  }

  // Chạm mèo:
  //   chạm nhanh          -> cưng (mặt vui, nảy, tim bay)
  //   giữ ~0.35 s rồi kéo -> nhấc mèo lên, mèo lơ lửng ngay dưới ngón tay, thả tay thì mèo rơi xuống chỗ đó
  // Trong lúc nhấc mèo: khoá xoay/zoom camera (vẫn để OrbitControls theo dõi ngón tay cho khỏi lệch trạng thái).
  const HOLD_MS = 350, MOVE_TOLERANCE = 8;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), hit = new THREE.Vector3();
  const carryPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -cats.carryHeight);
  let down = null, holdTimer = 0, carrying = null;
  const aim = event => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return rect;
  };
  // Điểm trên mặt phẳng ngang ở độ cao mèo đang lơ lửng: thân mèo hiện đúng dưới ngón tay.
  const carryPoint = event => { aim(event); return raycaster.ray.intersectPlane(carryPlane, hit) ? hit : null; };
  function startCarry(cat, event) {
    carrying = { cat, id: event.pointerId };
    controls.enableRotate = false; controls.enableZoom = false; controls.autoRotate = false; turn = null;
    const p = carryPoint(event);
    cats.pickUp(cat, p?.x ?? cat.x, p?.z ?? cat.z);
    playSound('pick');
    navigator.vibrate?.(12);
    renderer.domElement.classList.add('carrying');
  }
  function endCarry() {
    if (!carrying) return;
    cats.drop(carrying.cat);
    playSound('draw');
    carrying = null;
    controls.enableRotate = true; controls.enableZoom = true;
    renderer.domElement.classList.remove('carrying');
  }
  renderer.domElement.addEventListener('pointerdown', event => {
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
    clearTimeout(holdTimer);
    aim(event);
    const cat = cats.hit(raycaster);
    if (cat && !carrying) holdTimer = setTimeout(() => { if (down?.id === event.pointerId) startCarry(cat, event); }, HOLD_MS);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (carrying && event.pointerId === carrying.id) {
      const p = carryPoint(event);
      if (p) cats.carryTo(carrying.cat, p.x, p.z);
      return;
    }
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > MOVE_TOLERANCE) clearTimeout(holdTimer); // đang xoay phòng
  });
  const release = event => {
    clearTimeout(holdTimer);
    if (carrying && event.pointerId === carrying.id) { endCarry(); down = null; return; }
    if (event.type === 'pointerup' && down && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 6) {
      const rect = aim(event);
      const cat = cats.hit(raycaster);
      if (cat) { cat.pet(); spawnHearts(event.clientX - rect.left, event.clientY - rect.top); }
    }
    down = null;
  };
  renderer.domElement.addEventListener('pointerup', release);
  renderer.domElement.addEventListener('pointercancel', release);
  function spawnHearts(x, y) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !container) return;
    for (let i = 0; i < 4; i++) {
      const heart = document.createElement('span');
      heart.className = 'pet-heart';
      heart.textContent = '♥';
      Object.assign(heart.style, { left: `${x + (Math.random() - .5) * 24}px`, top: `${y - 20}px`, animationDelay: `${i * 110}ms`, fontSize: `${14 + Math.random() * 8}px` });
      heart.style.setProperty('--dx', `${(Math.random() - .5) * 40}px`);
      heart.style.setProperty('--rot', `${(Math.random() - .5) * 40}deg`);
      container.append(heart);
      heart.addEventListener('animationend', () => heart.remove());
    }
  }

  let resumeTimer = 0, autoRotate = false;
  controls.addEventListener('start', () => { clearTimeout(resumeTimer); controls.autoRotate = false; turn = null; });
  controls.addEventListener('end', () => { resumeTimer = setTimeout(() => { controls.autoRotate = autoRotate; }, 2500); });

  const camDir = new THREE.Vector3(), spherical = new THREE.Spherical();
  let lastFrame = 0;
  function frame(now) {
    const t = now / 1000;
    if (turn) {
      const k = Math.min(1, (now - turn.start) / 650), ease = 1 - (1 - k) ** 3;
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta = turn.from + (turn.to - turn.from) * ease;
      camera.position.setFromSpherical(spherical).add(controls.target);
      if (k === 1) turn = null;
    }
    controls.update();
    camDir.copy(camera.position);
    if (living.visible) walls.forEach(wall => {
      const behind = camDir.dot(wall.userData.normal) < -HALF + .2;
      wall.userData.opacity += ((behind ? 0 : 1) - wall.userData.opacity) * .18;
      const o = wall.userData.opacity;
      wall.visible = o > .03;
      wall.traverse(node => { if (node.material) { node.material.opacity = o; node.material.depthWrite = o > .98; } });
    });
    Object.values(furniture).forEach(node => {
      if (!node.visible) return;
      if (node.userData.pop < 1) {
        node.userData.pop = Math.min(1, node.userData.pop + .06);
        const p = node.userData.pop, s = 1 + Math.sin(p * Math.PI) * .18 - (1 - p) * .5;
        node.scale.setScalar(Math.max(.01, s));
      }
      node.userData.update?.(t);
    });
    if (garden.visible) {
      if (furniture.flowers?.visible) flowerCenter.set(furniture.flowers.position.x, 0, furniture.flowers.position.z); else flowerCenter.set(0, 0, 0);
      butterflies.forEach(b => b.update(t, Math.min(.05, (now - (lastFrame || now)) / 1000), flowerCenter));
    }
    cats.update((now - (lastFrame || now)) / 1000, t, document.body.classList.contains('afk'));
    lastFrame = now;
    renderer.render(scene, camera);
  }

  const resize = () => {
    if (!container) return;
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Khung dọc (hẹp hơn cao) thì lùi ống kính để phòng không bị cắt hai bên.
    camera.zoom = Math.min(1, camera.aspect / 1.05);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);

  return {
    // Gắn canvas vào khung (Home hoặc Deco). Chỉ một khung dùng renderer tại một thời điểm.
    mount(target, options = {}) {
      container = target;
      target.dataset.zone = zoneId;
      autoRotate = !!options.autoRotate;
      controls.autoRotate = autoRotate;
      // Home luôn mở ở góc nhìn đẹp mặc định, dù ở Deco người chơi đã xoay/zoom tới đâu.
      if (options.resetView) { turn = null; camera.position.copy(HOME_VIEW); controls.update(); }
      if (renderer.domElement.parentElement !== target) target.prepend(renderer.domElement);
      observer.disconnect();
      observer.observe(target);
      resize();
      renderer.setAnimationLoop(frame);
    },
    stop() { renderer.setAnimationLoop(null); lastFrame = 0; },
    apply,
    focus,
  };
}
