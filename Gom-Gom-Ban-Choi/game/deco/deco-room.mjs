// Phòng mèo 3D (Three.js) dùng chung cho Home và Deco: kéo để xoay 360°, chụm hai ngón để zoom.
// Tường nào chắn giữa camera và phòng thì mờ đi (kiểu nhà búp bê). Đồ đạc dựng từ khối cơ bản bo tròn.
// Mèo khối 3D và hành vi của chúng nằm ở room-cats.mjs; chạm mèo để cưng.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './render/mesh-detail.mjs';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCatLife } from './cats/room-cats.mjs';
import { TOON, TOON_LIGHT, TOON_FOV, toonMat, toonLook, addOutlines, syncOutlineResolution, setOutlineTint, setOutlineZoom, renderOutlineIds, markOutlineUnit, OUTLINE_LAYER, DECAL_LAYER, FLOOR_OFFSET } from './render/toon.mjs';
import { playMeow } from '../ui/sound.mjs';
import { CATALOG, itemById, zoneState, slotOf } from './deco-data.mjs';
import { PLACES, WALL_H, ROOM_HALF, ZONE_OFFSET, DOOR, BEDROOM_DOOR, KITCHEN_DOOR, KITCHEN_WINDOW_X, KITCHEN_FRONT_WINDOW_U, BATHROOM_DOOR, BATHROOM_WINDOW_X, BACKYARD_DOOR, BACKYARD_EXT_X, backyardBounds, KINDER_GATE_X, kinderBounds, FLOWER_OFFSET, FLOWER_GATE_Z, OBSTACLE_RADIUS, HILL, HILL_OBSTACLE_R, groundHeight, crossingHeight, GARDEN_EXT_X, gardenBounds } from './room-layout.mjs';
import { TIMING, DRAG } from '../data/tuning.mjs';
import { BEDROOM_BUILD, bedroomDecor, decorateBedroomWall } from './scenes/bedroom.mjs';
import { KITCHEN_BUILD, kitchenDecor, decorateKitchenWall } from './scenes/kitchen.mjs';
import { BATHROOM_BUILD, bathroomDecor, decorateBathroomWall } from './scenes/bathroom.mjs';
import { BACKYARD_BUILD, buildBackyardFence, backyardDecor, buildPatio, PATIO_LOOKS } from './scenes/backyard.mjs';
import { KINDER_BUILD, kinderDecor, CLASSROOM } from './scenes/kindergarten.mjs';
import { buildMeadow } from './scenes/meadow.mjs';
import { buildFlowerGarden, flowerObstacles } from './scenes/flower-garden.mjs';
import { buildHouseExterior, buildRoof } from './scenes/house-exterior.mjs';
import { GARDEN2_BUILD, buildHill, garden2Decor, SHADOW_ONLY_LAYER } from './scenes/garden-expanded.mjs';
import { runModelQC } from './qc.mjs';
import { createDecoFx } from './render/deco-fx.mjs';
import { fitToWall, fitToFloor } from './render/wall-theme.mjs';
import { GARDEN_BUILD, groundTexture, buildFence, gardenCorners, makeButterflies, ropeBetween, pendulum } from './scenes/garden.mjs';
import { JAPAN_BUILD } from './scenes/garden-japan.mjs';

const HALF = ROOM_HALF, TAU = Math.PI * 2;
// Vật liệu đồ đạc kiểu vật lý: gỗ / sơn / vải đều nhám (roughness cao), phản xạ điện môi thấp (specularIntensity)
// nên không loé bóng như nhựa. Nước, kính, kim loại tự ghi đè roughness/metalness riêng.
const mat = (color, { smooth, ...extra } = {}) => TOON ? toonMat({ color, smooth, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
// Khối chắn đèn trong tường: vô hình với camera, chỉ dùng khi vẽ bóng của đèn đồ đạc (xem castLampShadows).
// Đèn điện: tắt / bật theo ambient (lightUp). Đồ có lửa (lửa trại, đuốc, lò sưởi, lò nướng) không nằm đây.
const ELECTRIC_LAMPS = new Set(['lamp', 'lamp-lantern', 'lantern', 'lantern-lamppost', 'campfire-tent']);
const LAMP_CASTER_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
// Độ mịn kiểu subdivision: bo tròn nhiều nấc, trụ/cầu nhiều cạnh; vẫn nhẹ (vài chục nghìn tam giác cả phòng).
const ROUND = 3, RADIAL = 32; // bo góc 3 nấc / trụ 32 cạnh là đủ mượt dưới viền toon; cầu / trụ mặc định chia theo cỡ (mesh-detail.mjs)
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
// group() rỗng thì không gọi add(): Three.js báo lỗi khi add() không có đối số.
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };

// Lá hình tim (trầu bà): gốc lá ở (0, 0), ngọn ở (0, L), mặt lá trong mặt phẳng xy (pháp tuyến +z), dày vài mm.
// droop: ngọn cong về phía -z (võng xuống khi lá ngửa lên); cup: hai mép cong về +z (lá khum).
function heartLeaf(L, W, droop, cup) {
  const s = new THREE.Shape();
  s.moveTo(0, .1 * L);
  s.bezierCurveTo(-.25 * W, -.06 * L, -1.05 * W, .02 * L, -.95 * W, .4 * L);
  s.bezierCurveTo(-.88 * W, .7 * L, -.3 * W, .9 * L, 0, L);
  s.bezierCurveTo(.3 * W, .9 * L, .88 * W, .7 * L, .95 * W, .4 * L);
  s.bezierCurveTo(1.05 * W, .02 * L, .25 * W, -.06 * L, 0, .1 * L);
  const geo = new THREE.ExtrudeGeometry(s, { depth: .01, bevelEnabled: true, bevelSize: .006, bevelThickness: .005, bevelSegments: 2, curveSegments: 14 });
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), t = Math.max(0, y / L);
    pos.setZ(i, pos.getZ(i) - droop * t * t * L + cup * (x / W) ** 2 * W);
  }
  geo.computeVertexNormals();
  return geo;
}

// ===== Đồ trang trí cố định của phòng khách (không mua, không đổi): lấp tường + chân tường cho phòng đầy đặn =====
// Đồ gắn lên tường dùng vật liệu trong suốt để mờ đi cùng tường khi tường chắn camera (xem vòng lặp tường).
const onWall = color => mat(color, { transparent: true });
function curtainPanel(w, h, color) { // tấm rèm có nếp gấp dọc
  const geo = new THREE.PlaneGeometry(w, h, 20, 1), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) / w * Math.PI * 5) * .035 + .035);
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { transparent: true, side: THREE.DoubleSide }));
}
function wallFrame(w, h, frameColor, artColor, u, y) { // khung tranh: viền gỗ + tranh màu + một vệt "hoạ tiết"
  return group(at(mesh(new THREE.BoxGeometry(w, h, .05), onWall(frameColor)), u, y, .13),
    at(new THREE.Mesh(new THREE.PlaneGeometry(w - .1, h - .1), new THREE.MeshBasicMaterial({ color: artColor, transparent: true, userData: { nightDim: true } })), u, y, .16),
    at(new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * .18, 20), new THREE.MeshBasicMaterial({ color: '#fff6e4', transparent: true, userData: { nightDim: true } })), u + w * .12, y + h * .1, .165));
}
// Trang trí cho từng bức tường (toạ độ cục bộ của tường: u = trục ngang, mặt hướng vào phòng là +z).
//   0 = tường sau (u = x phòng), 2 = tường trái (u = -z phòng), 3 = tường phải (u = z phòng).
function decorateWall(i, wall) {
  if (i === 0) {
    // Rèm hai bên cửa sổ (x = -1.6) + thanh treo có núm hai đầu.
    const rod = at(cyl(.025, .025, 2.3, onWall('#c98a55'), 12), -1.6, 2.66, .22); rod.rotation.z = Math.PI / 2;
    wall.add(rod, at(ball(.05, onWall('#c98a55')), -2.75, 2.66, .22), at(ball(.05, onWall('#c98a55')), -.45, 2.66, .22));
    for (const s of [-1, 1]) {
      wall.add(at(curtainPanel(.5, 1.95, '#ffb3c4'), -1.6 + s * .88, 1.66, .17),
        at(mesh(new THREE.BoxGeometry(.52, .06, .09), onWall('#e8617f')), -1.6 + s * .88, 1.15, .24)); // dây buộc rèm
    }
    // Dây cờ đuôi nheo võng qua phía trên kệ sách.
    const pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(.1 + t * 3.6, 2.86 - Math.sin(t * Math.PI) * .2, .2)); } // cao hơn nóc tủ quần áo (~2.3)
    const line = new THREE.CatmullRomCurve3(pts);
    wall.add(mesh(new THREE.TubeGeometry(line, 32, .008, 5), onWall('#8a6a4a')));
    const FLAGS = ['#e8617f', '#ffd66b', '#8fc9f2', '#7fc45a', '#b79cf0'];
    const flagShape = new THREE.Shape([new THREE.Vector2(-.1, 0), new THREE.Vector2(.1, 0), new THREE.Vector2(0, -.24)]);
    for (let k = 1; k < 10; k++) {
      const p = line.getPoint(k / 10), tan = line.getTangent(k / 10);
      const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshBasicMaterial({ color: FLAGS[k % FLAGS.length], transparent: true, side: THREE.DoubleSide, userData: { nightDim: true } }));
      flag.position.copy(p).setZ(.21); flag.rotation.z = Math.atan2(tan.y, tan.x);
      wall.add(flag);
    }
  }
  if (i === 2) { // tranh lớn (u .4 = z -.4, tránh chao đèn cây) + cụm tranh nhỏ trên tủ thấp (tủ ở z ≈ .5 -> u ≈ -.5; cửa phòng ngủ ở u = -2.3)
    wall.add(wallFrame(1, 1.2, '#e0b36a', '#ffc9d5', .4, 1.9),
      wallFrame(.5, .64, '#c98a55', '#bfe6ff', -1, 1.75), wallFrame(.42, .42, '#fff4e0', '#ffd66b', -.45, 1.95),
      wallFrame(.36, .46, '#e0b36a', '#c9e8b0', -.47, 1.45));
  }
  if (i === 3) { // đồng hồ tròn (dời sang u .5: u -.6 là cửa sang bếp) + kệ treo trên ổ mèo (z phòng ≈ 2.7): chậu cây rủ lá + chồng sách nhỏ
    wall.add(at(mesh(new THREE.CylinderGeometry(.34, .34, .06, 32), onWall('#ffffff')), .5, 2.2, .13).rotateX(Math.PI / 2));
    const shelfY = 1.55, u = 2.7;
    wall.add(at(mesh(roundedBox(1.2, .05, .28, ROUND, .015), onWall('#c98a55')), u, shelfY, .24));
    [[-.36, '#e98b5a'], [.12, '#8fc9f2']].forEach(([dx, potColor], n) => {
      wall.add(at(cyl(.08, .06, .14, onWall(potColor), 16), u + dx, shelfY + .095, .24));
      for (let k = 0; k < 5; k++) { // dây lá rủ xuống mép kệ
        const len = 3 + ((k + n) % 3), x = u + dx - .08 + k * .04;
        for (let j = 0; j < len; j++) wall.add(at(ball(.035, onWall(j % 2 ? '#6fbf4a' : '#5fae46')), x + Math.sin(j + k) * .02, shelfY + .14 - j * .085, .3 + (j === 0 ? 0 : .04)));
      }
    });
    ['#e8617f', '#ffd66b', '#7fc45a'].forEach((color, k) => wall.add(at(mesh(roundedBox(.24 - k * .03, .045, .17, ROUND, .01), onWall(color)), u + .42, shelfY + .05 + k * .047, .24)));
  }
}
function livingDecor() {
  // Tủ thấp sát tường trái: hai ngăn kéo, trên có bình hoa, chồng sách, khung ảnh. Mặt trước (+z cục bộ) quay vào phòng.
  const wood = '#d9a36a', body = '#e9c58f';
  const vaseFlowers = ['#ff8fa0', '#ffd66b', '#fff4f0'].map((color, k) => {
    const h = .2 + k * .05, a = k * 2.1;
    return group(at(cyl(.008, .008, h, '#5fa83e', 6), Math.cos(a) * .03, .78 + h / 2 + .1, Math.sin(a) * .03), at(ball(.045, color), Math.cos(a) * .05, .88 + h, Math.sin(a) * .05));
  });
  const sideboard = group(
    ...[[-.65, -.16], [.65, -.16], [-.65, .16], [.65, .16]].map(([x, z]) => at(cyl(.03, .025, .1, '#b9854a', 10), x, .05, z)),
    at(rbox(1.5, .6, .45, .05, body), 0, .4, 0), at(rbox(1.58, .05, .5, .02, wood), 0, .72, 0),
    ...[-.36, .36].flatMap(x => [at(rbox(.66, .42, .03, .015, '#f3d5a8'), x, .4, .23), at(ball(.03, '#b9854a'), x, .44, .26)]),
    at(cyl(.07, .09, .24, '#8fc9f2', 20), -.46, .865, 0), ...vaseFlowers.map(f => at(f, -.46, 0, 0)),
    at(rbox(.36, .06, .24, .01, '#e8617f'), .1, .775, 0), at(rbox(.32, .06, .22, .01, '#7fc45a'), .1, .835, .01), at(rbox(.28, .05, .2, .01, '#ffd66b'), .12, .89, -.01),
    at(rbox(.2, .24, .03, .015, '#c98a55'), .52, .87, -.08));
  // Tủ quay mặt (+z cục bộ) vào phòng; đặt ở z = .5 để chừa cửa sang phòng ngủ (z = BEDROOM_DOOR.z) và chỗ cánh cửa mở hé.
  sideboard.position.set(-ROOM_HALF + .28, 0, .5); sideboard.rotation.y = Math.PI / 2;
  // Gối ngồi sàn chồng nhau ở chân tường trước + thảm chùi chân phía trong cửa.
  const pouf = (r, color, x, y, z) => { const p = at(ball(r, color), x, y, z); p.scale.y = .34; return p; };
  const cushions = group(pouf(.3, '#ffd27a', .9, .1, ROOM_HALF - .5), pouf(.26, '#9fd0f0', 1.5, .09, ROOM_HALF - .7), pouf(.21, '#ffb3c4', 1.08, .25, ROOM_HALF - .55));
  const mat2 = group(at(rbox(.9, .03, .5, .015, '#c9955e'), 0, .015, 0), at(box(.7, .04, .32, '#8fc9f2'), 0, .02, 0));
  mat2.position.set(DOOR.x, 0, ROOM_HALF - .55);
  mat2.traverse(node => { node.castShadow = false; node.userData.noOutline = true; }); // thảm chùi chân: mảng màu phẳng, không viền
  return mergeStatic(group(sideboard, cushions, mat2));
}

// Quả bóng đồ chơi treo dưới tầng trên cùng của cây cho mèo (đáy tầng y = 1.73, bóng ở y = .72): dây nối đúng từ
// đáy tầng xuống đỉnh quả bóng, cả dây + bóng lắc như con lắc (garden.mjs pendulum).
function hangingToy(tree, color, ropeColor) {
  const pivot = new THREE.Vector3(.45, 1.73, .3), L = pivot.y - .72;
  const swing = pendulum(pivot, L, at(ball(.1, color), 0, -L, 0), ropeBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -L + .1, 0), .01, ropeColor));
  tree.add(swing);
  tree.userData.swing = swing; // mèo nhảy lên tầng trên thì quả bóng lắc
  tree.userData.update = t => swing.userData.step(t);
  return tree;
}

// Phần gắn bản lề (nắp thùng, nắp hộp) rung như lò xo khi bị chạm: node.userData.bump(k) đẩy lệch khỏi góc nghỉ,
// rồi dao động tắt dần về chỗ cũ. Mèo gọi bump khi nhảy vào thùng / khều đồ trong hộp (room-cats.mjs).
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

// Ghế bập bênh: cả ghế bập bênh quanh điểm chạm sàn của thanh cong (trục x), như con lắc tắt chậm.
// bump(k) = cú đẩy (mèo đi sát qua, nhảy lên, nhảy xuống — nhảy xuống đạp mạnh nhất nên ghế bập bênh lâu nhất).
function rocking(rock) {
  const chair = group(rock), s = { a: 0, v: 0, last: 0 };
  chair.userData.ride = rock; rock.userData.restPos = new THREE.Vector3(); // mèo ngồi trên ghế đung đưa theo (rideAlong)
  chair.userData.bump = (k = 1) => { s.v += k * 1.4 * (s.v >= 0 ? 1 : -1); }; // đẩy cùng chiều đang bập bênh: không hãm ghế lại
  chair.userData.update = t => {
    const dt = Math.min(.05, Math.max(0, t - (s.last || t))); s.last = t;
    s.v += (-10 * Math.sin(s.a) - .7 * s.v) * dt; // ω ≈ 3.2 rad/s (~2 giây một nhịp), tắt chậm như ghế gỗ thật
    s.a = Math.max(-.22, Math.min(.22, s.a + s.v * dt));
    rock.rotation.x = s.a;
    rock.position.y = Math.abs(s.a) * .04; // lăn trên thanh cong: nhấc nhẹ khi nghiêng, đầu thanh không lún xuống sàn
  };
  return chair;
}

// ---------- Đồ đạc: mỗi món một hàm dựng (chỗ đặt [x, z, xoay] ở room-layout.mjs) ----------
const BUILD = {
  rug() {
    const outer = cyl(1.55, 1.55, .04, '#f4a3b6', 48), inner = cyl(1.12, 1.12, .045, '#ffc9d5', 48);
    const g = group(at(outer, 0, .02, 0), at(inner, 0, .03, 0)); // lòng thảm nổi .01 trên viền: không chớp
    g.scale.set(1, 1, .72);
    g.traverse(node => { node.castShadow = false; });
    g.userData.top = .0525; // mặt thảm: đồ đứng trên thảm nhấc lên đúng chừng này (apply())
    return g;
  },
  armchair() {
    const c = '#e98b5a', wood = '#9a6a45';
    const legs = [[-.45, -.35], [.45, -.35], [-.45, .35], [.45, .35]].map(([x, z]) => at(cyl(.05, .04, .2, wood), x, .1, z));
    return group(...legs, at(rbox(1.2, .34, 1, .1, c), 0, .36, 0), at(rbox(1.2, .95, .28, .12, c), 0, .8, -.38),
      at(rbox(.24, .56, 1, .1, c), -.56, .5, 0), at(rbox(.24, .56, 1, .1, c), .56, .5, 0), at(rbox(.84, .14, .7, .06, '#ffd9c4'), 0, .58, .08));
  },
  plant() {
    // Cây trầu bà lá tim trong chậu đất nung: mỗi lá mọc trên một cuống cong riêng từ gốc, xoè theo vòng xoắn,
    // lá cong võng xuống ở ngọn và hơi khum hai mép. Thay cho 3 quả cầu xanh trước đây.
    let seed = 5;
    const rnd = (lo, hi) => { seed = (seed * 16807) % 2147483647; return lo + (seed / 2147483647) * (hi - lo); };
    const LEAF = ['#5fae46', '#6fbf4a', '#4f9a3a', '#7cc95a'];
    const leaves = group();
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4 + rnd(-.2, .2), h = .78 + (i % 4) * .15 + rnd(0, .08), r0 = .12 + rnd(0, .12);
      const L = rnd(.3, .42), up = rnd(.25, .65);
      const base = new THREE.Vector3(-Math.sin(a) * r0, h, -Math.cos(a) * r0);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .56, 0), new THREE.Vector3(base.x * .25, h * .75, base.z * .25), base]);
      leaves.add(mesh(new THREE.TubeGeometry(curve, 12, .014, 6), '#5a9a3e'));
      const leaf = mesh(heartLeaf(L, L * .62, rnd(.25, .5), .18), LEAF[i % LEAF.length]);
      leaf.rotation.x = -Math.PI / 2 + up; // trục y của lá chĩa ra ngoài + hơi ngóc lên, mặt lá ngửa lên trời
      const pivot = group(leaf); pivot.position.copy(base); pivot.rotation.y = a;
      leaves.add(pivot);
    }
    const pot = '#e98b5a', potDark = '#d0703f';
    const plant = group(at(cyl(.36, .36, .04, potDark), 0, .02, 0), // đĩa lót
      at(cyl(.3, .22, .46, pot), 0, .27, 0), at(cyl(.34, .32, .1, potDark), 0, .53, 0), // thân chậu + vành
      at(cyl(.29, .29, .02, '#7a4a2a'), 0, .575, 0), at(ball(.035, '#c8c2b8'), .12, .585, .08), at(ball(.03, '#b5aea3'), -.1, .585, .13), leaves);
    mergeStatic(leaves); // 10 lá + 10 cuống gộp theo màu; cả tán vẫn rung như một khối
    plant.userData.leaves = leaves; // mèo gặm lá thì lá rung
    return plant;
  },
  yarn() {
    // Cuộn len có sợi quấn: mỗi cuộn phủ 3 lớp vòng sợi (mỗi lớp 5 vòng song song, quấn theo một trục lệch nhau)
    // nổi trên mặt cầu, màu đậm / nhạt hơn nền một chút -> nhìn ra từng vòng chỉ. Sợi gộp thành một khối cho nhẹ.
    const yarnBall = (color, x, z, y = .42, axes = [[0, 0, 0], [1.1, .4, 0], [-.5, 1.3, .9]]) => {
      const r = .19, strands = [];
      axes.forEach(([rx, ry, rz]) => {
        for (let k = -2; k <= 2; k++) {
          const lat = k * .3, ring = new THREE.TorusGeometry(r * Math.cos(lat) * 1.015, .011, 6, 40);
          ring.rotateX(Math.PI / 2).translate(0, r * Math.sin(lat), 0).rotateX(rx).rotateY(ry).rotateZ(rz);
          strands.push(ring);
        }
      });
      const tone = new THREE.Color(color).offsetHSL(0, .05, -.13);
      const wraps = mesh(mergeGeometries(strands), `#${tone.getHexString()}`);
      wraps.userData.noOutline = true; // sợi mảnh: viền mực từng vòng sẽ thành mớ nét đen
      wraps.userData.toonOk = 'sợi len: các vòng xuyến mảnh gộp lại, mặt lõm là lòng xuyến thật'; // QC toon
      return at(group(ball(r, color), wraps), x, y, z);
    };
    const toy = yarnBall('#ffd66b', .02, .2, .47);
    // Đầu sợi len thả từ cuộn hồng vắt qua mép giỏ xuống sàn.
    const tail = new THREE.CatmullRomCurve3([[-.2, .5, .12], [-.38, .46, .2], [-.48, .36, .26], [-.52, .12, .34], [-.62, .01, .48]].map(p => new THREE.Vector3(...p)));
    const basket = group(at(cyl(.46, .38, .34, '#d9a36a'), 0, .17, 0), at(cyl(.4, .4, .02, '#b9854a'), 0, .34, 0),
      yarnBall('#ff8fa0', -.14, .06), yarnBall('#8fc9f2', .16, -.08, .42, [[.3, 0, .2], [1.4, .9, 0], [-1, .2, 1.2]]), toy,
      mesh(new THREE.TubeGeometry(tail, 24, .011, 6), '#f07a92'));
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
      mug, at(cyl(.16, .16, .03, '#fffaf0'), -.18, .815, -.1),
      // Bày thêm trên mặt bàn: sách mở úp + chậu sen đá nhỏ.
      at(rbox(.26, .035, .2, .01, '#b79cf0'), .2, .817, -.24).rotateY(.4),
      at(cyl(.07, .055, .09, '#fff4e0', 16), -.2, .845, .24), at(ball(.065, '#7fc45a'), -.2, .905, .24).rotateY(.6));
    table.userData.mug = mug; // mèo đẩy cốc rơi khỏi bàn
    mug.userData.home = mug.position.clone();
    return table;
  },
  lamp() {
    const metal = '#8a6a4a';
    const shade = mesh(new THREE.CylinderGeometry(.26, .44, .5, RADIAL, 1, true),
      mat('#ffd66b', { emissive: '#ffb938', emissiveIntensity: .55, side: THREE.DoubleSide }));
    shade.userData.noOutline = true; // chao đèn là vỏ mỏng hở: không viền toon (phủ mảng tối vào lòng chao), viền bằng hai vành
    const rim = (r, y) => at(mesh(new THREE.TorusGeometry(r, .014, 8, 40), '#e0a93c'), 0, y, 0).rotateX(Math.PI / 2);
    const light = new THREE.PointLight('#ffcf7a', 5, 6, 1.6);
    light.position.set(0, 1.7, 0);
    return group(at(cyl(.3, .34, .06, metal), 0, .03, 0), at(cyl(.035, .035, 1.8, metal), 0, .93, 0), at(shade, 0, 1.9, 0), rim(.26, 2.15), rim(.44, 1.65),
      at(ball(.1, mat('#fff6d8', { emissive: '#fff0c0', emissiveIntensity: 1 })), 0, 1.78, 0), light);
  },
  cattree() {
    const rope = '#dcc393', pad = '#f4a3b6';
    return hangingToy(group(at(rbox(1, .12, 1, .05, '#e6c79a'), 0, .06, 0), at(cyl(.09, .09, 1.05, rope), -.25, .6, -.2), at(cyl(.09, .09, 1.7, rope), .22, .9, .18),
      at(rbox(.72, .1, .72, .05, pad), -.1, 1.1, -.12), at(cyl(.36, .36, .14, pad), .22, 1.8, .18)), '#ffd66b', '#8a6a4a');
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
    // Nước chỉ vẽ mặt trong phía sau (BackSide): thành nền xanh PHÍA SAU cá, không phủ lên cá (trước đây hộp nước 50% + kính 22%
    // đè lên trước cá: thân cá bạc màu như bóng ma trong khi viền cá vẽ sau vẫn đậm). Kính chỉ còn một lớp sáng rất mỏng.
    // Cả hai không nhận / đổ bóng (bóng cá in lên mặt nước thành mảng xám đục) và không ghi depth (khỏi nhấp nháy khi xoay).
    const glass = mesh(new THREE.BoxGeometry(1.1, .72, .52), mat('#e8f8ff', { transparent: true, opacity: .14, roughness: .1, depthWrite: false }));
    const water = mesh(new THREE.BoxGeometry(1.04, .56, .46), mat('#7fd0ea', { transparent: true, opacity: .75, roughness: .2, side: THREE.BackSide, depthWrite: false }));
    // Mặt nước phía trước rất mỏng: bể vẫn có sắc xanh khi nhìn từ trên xuống mà cá chỉ nhạt đi chút ít.
    const waterFront = mesh(new THREE.BoxGeometry(1.04, .56, .46), mat('#7fd0ea', { transparent: true, opacity: .22, roughness: .2, depthWrite: false }));
    for (const node of [glass, water, waterFront]) node.castShadow = node.receiveShadow = false;
    const fish = ['#f39a45', '#ffd66b', '#ff8fa0'].map((color, i) => {
      const tail = mesh(new THREE.ConeGeometry(.05, .09, 20), color);
      tail.rotation.z = Math.PI / 2; tail.position.x = -.1;
      const body = ball(.07, color); body.scale.set(1.3, .8, .6);
      const f = group(body, tail);
      f.userData.phase = i * 2.1;
      return f;
    });
    const tank = group(at(rbox(1.2, .7, .62, .05, '#b9854a'), 0, .35, 0), at(glass, 0, 1.07, 0), at(water, 0, 1, 0), at(waterFront, 0, 1, 0),
      at(box(1.04, .06, .46, '#f3dfb0'), 0, .76, 0), ...fish.map(f => at(f, 0, 1, 0)));
    tank.userData.fish = fish; // mèo ngồi xem cá bơi
    tank.userData.update = t => fish.forEach(f => {
      const a = t * .8 + f.userData.phase;
      f.position.set(Math.sin(a) * .38, 1 + Math.sin(a * 1.7) * .08, Math.cos(a * .6) * .12);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    });
    return tank;
  },
  // ===== Phương án thay thế (deco-data.mjs VARIANTS): khác đồ vật, giữ khuôn khổ + điểm neo của món gốc =====
  // Chăn chắp vá (thay thảm): phẳng, mèo lăn lộn ở giữa.
  'rug-quilt'() {
    const colors = ['#ec5b8c', '#fff3d1', '#3b8fe0', '#ffd23f', '#4fb34a', '#fff3d1'];
    const quilt = group(at(box(2.5, .02, 1.9, '#fffaf0'), 0, .01, 0));
    for (let x = 0; x < 6; x++) for (let z = 0; z < 5; z++) {
      quilt.add(at(box(.38, .025, .34, colors[(x + z * 2) % colors.length]), -1.02 + x * .41, .02, -.74 + z * .37));
    }
    quilt.traverse(node => { node.castShadow = false; });
    quilt.userData.top = .0325;
    return quilt;
  },
  // Ghế bập bênh (thay ghế bành): mặt ngồi ~.66, đỉnh lưng ghế ~1.29 (mèo trèo lên ngắm cửa sổ).
  'armchair-rocker'() {
    const wood = '#b9854a';
    // thanh bập bênh: thanh dài dưới chân, hai đầu vểnh lên
    const runner = x => group(at(rbox(.06, .06, 1.1, .03, wood), x, .03, .03), at(rbox(.06, .06, .25, .03, wood), x, .07, .66).rotateX(-.4), at(rbox(.06, .06, .25, .03, wood), x, .07, -.6).rotateX(.4));
    const legs = [[-.45, -.32], [.45, -.32], [-.45, .38], [.45, .38]].map(([x, z]) => at(cyl(.04, .04, .56, wood), x, .3, z));
    const slats = [-.36, -.18, 0, .18, .36].map(x => at(rbox(.1, .72, .05, .02, wood), x, .95, -.4));
    return rocking(group(runner(-.45), runner(.45), ...legs, at(rbox(1.04, .1, .9, .03, wood), 0, .57, 0), at(rbox(.9, .08, .76, .04, '#ec5b8c'), 0, .64, .02),
      ...slats, at(rbox(1.08, .12, .1, .04, wood), 0, 1.3, -.4), at(rbox(1.08, .08, .08, .03, wood), 0, .62, -.4),
      at(rbox(.08, .07, .82, .03, wood), -.52, .86, 0), at(rbox(.08, .07, .82, .03, wood), .52, .86, 0),
      at(cyl(.03, .03, .26, wood), -.52, .72, .36), at(cyl(.03, .03, .26, wood), .52, .72, .36)));
  },
  // Chậu xương rồng (thay cây cảnh): mèo vẫn gặm thử... rồi nhăn mặt.
  'plant-cactus'() {
    const green = '#4f9f5a';
    const arm = (x, y, dir) => group(at(cyl(.08, .08, .22, green), x + dir * .12, y, 0).rotateZ(Math.PI / 2), at(cyl(.08, .08, .3, green), x + dir * .24, y + .15, 0), at(ball(.08, green), x + dir * .24, y + .3, 0));
    const leaves = group(at(cyl(.17, .17, .7, green), 0, .9, 0), at(ball(.17, green), 0, 1.25, 0), arm(0, .85, 1), arm(0, 1, -1),
      at(ball(.07, '#ec5b8c'), 0, 1.42, 0), at(ball(.05, '#ffd23f'), .06, 1.44, .04));
    for (let i = 0; i < 14; i++) { const a = i * 1.3; leaves.add(at(ball(.012, '#fffaf0'), Math.cos(a) * .172, .65 + (i % 7) * .08, Math.sin(a) * .172)); }
    const pot = group(at(cyl(.3, .22, .45, '#d9774a'), 0, .225, 0), at(cyl(.32, .32, .08, '#e89a6e'), 0, .45, 0), at(cyl(.27, .27, .02, '#7a4a2a'), 0, .5, 0), leaves);
    pot.userData.leaves = leaves;
    return pot;
  },
  // Hộp đồ chơi (thay giỏ len): quả bóng trên miệng hộp là đồ chơi mèo khều ra sàn.
  // Nắp gắn bản lề ở mép trên phía sau, mở ngửa ra sau (~110°); đồ chơi nằm TRONG hộp, chỉ ló phần trên khỏi miệng (.42).
  'yarn-toybox'() {
    const TOP = .42;
    const toy = at(ball(.15, '#ffd23f'), .14, TOP + .04, .06);
    const mouse = group(at(ball(.1, '#b3aa99'), 0, 0, 0), at(ball(.04, '#ec5b8c'), -.05, .08, 0), at(ball(.04, '#ec5b8c'), .05, .08, 0));
    const hinge = group(at(rbox(.84, .05, .64, .02, '#2461a8'), 0, .025, .32)); // nắp: mép bản lề ở gốc nhóm
    hinge.position.set(0, TOP, -.3);
    hinge.rotation.x = -1.9;
    const chest = springy(group(), [hinge]);
    chest.add(at(rbox(.8, TOP, .6, .05, '#3b8fe0'), 0, TOP / 2, 0), at(box(.7, .01, .5, '#1f4f8a'), 0, TOP + .002, 0), hinge,
      at(mouse, -.2, TOP + .02, -.08), at(mesh(new THREE.ConeGeometry(.06, .16, 5), '#ec5b8c'), .27, TOP + .04, -.14), toy,
      at(mesh(new THREE.CircleGeometry(.08, 5), '#ffd23f'), -.18, .24, .306), at(mesh(new THREE.CircleGeometry(.06, 5), '#fffaf0'), .15, .18, .306));
    chest.userData.toy = toy; // quả bóng mèo khều ra sàn
    toy.userData.home = toy.position.clone();
    return chest;
  },
  // Thùng các-tông (thay ổ mèo): mèo nào cũng mê; nhảy vào (đáy lót chăn ~.14) rồi cuộn tròn.
  // Nắp thùng: bản lề ở mép trên mỗi vách, ngả RA NGOÀI rồi rủ xuống ~50° (thùng đã mở). Xoay theo vách trước (y),
  // rồi mới gập quanh bản lề (x) — làm trong 2 nhóm lồng nhau để không gập nhầm trục như khi gộp 1 Euler.
  'catbed-box'() {
    const card = '#d9a36a', dark = '#b9854a', H = .36;
    const wall = (w, x, z, rot) => { const node = at(box(w, H, .03, card), x, H / 2, z); node.rotation.y = rot; return node; };
    const flap = (w, x, z, rot, droop, len) => {
      const fold = group(at(box(w, .02, len, dark), 0, 0, len / 2)); // mép bản lề ở gốc, nắp chìa ra +z (ra ngoài)
      fold.rotation.x = droop;
      const side = group(fold); side.position.set(x, H, z); side.rotation.y = rot; // +z cục bộ = hướng ra ngoài vách
      folds.push(fold);
      return side;
    };
    const folds = [];
    const box3 = group(at(box(1, .02, .8, dark), 0, .01, 0), wall(1, 0, -.4, 0), wall(1, 0, .4, 0), wall(.8, -.5, 0, Math.PI / 2), wall(.8, .5, 0, Math.PI / 2),
      flap(.98, 0, .415, 0, .85, .32), flap(.98, 0, -.415, Math.PI, .95, .32), flap(.78, .515, 0, Math.PI / 2, 1.05, .3), flap(.78, -.515, 0, -Math.PI / 2, .8, .3),
      at(rbox(.9, .1, .7, .04, '#8fc9f2'), 0, .08, 0), at(box(.08, .3, .006, '#c9955e'), 0, .2, .418)); // băng keo dán dọc giữa mặt trước
    return springy(box3, folds); // mèo nhảy vào: nắp thùng rung rinh
  },
  // Tủ đầu giường (thay bàn nhỏ): mặt tủ ~.81, bình hoa trên nóc là thứ mèo đẩy rơi.
  'table-nightstand'() {
    const wood = '#f5f0e6', trim = '#b3aa99';
    const vase = group(at(cyl(.06, .09, .2, '#3b8fe0'), 0, 0, 0), at(cyl(.005, .005, .18, '#4f9f2e', 6), 0, .16, 0), at(ball(.05, '#ec5b8c'), 0, .26, 0));
    vase.position.set(.15, .91, .1);
    const stand = group(at(rbox(.7, .76, .56, .04, wood), 0, .4, 0), at(rbox(.76, .04, .6, .02, '#e3ddd1'), 0, .79, 0),
      at(box(.6, .005, .01, trim), 0, .5, .281), at(box(.6, .005, .01, trim), 0, .26, .281),
      at(ball(.03, '#d9a36a'), 0, .62, .29), at(ball(.03, '#d9a36a'), 0, .38, .29),
      ...[[-.3, -.23], [.3, -.23], [-.3, .23], [.3, .23]].map(([x, z]) => at(cyl(.03, .02, .04, trim), x, .02, z)),
      vase, at(rbox(.22, .05, .16, .01, '#e5483a'), -.18, .835, -.1));
    stand.userData.mug = vase; // mèo đẩy bình hoa rơi khỏi tủ
    vase.userData.home = vase.position.clone();
    return stand;
  },
  // Máy sưởi (thay đèn đứng): thanh nhiệt đỏ rực; mèo nằm sưởi ngủ cạnh.
  'lamp-heater'() {
    const bars = [.22, .32, .42].map(y => at(cyl(.02, .02, .42, mat('#ff7a3d', { emissive: '#ff5a1a', emissiveIntensity: 1.2 })), 0, y, .16).rotateZ(Math.PI / 2));
    const light = new THREE.PointLight('#ff8a4a', 3, 3.5, 1.6);
    light.position.set(0, .35, .5);
    return group(at(rbox(.6, .56, .3, .08, '#e5483a'), 0, .34, 0), at(rbox(.5, .34, .02, .01, '#3a2a2a'), 0, .32, .145), ...bars,
      at(rbox(.66, .04, .34, .02, '#c43a2e'), 0, .06, 0), at(cyl(.04, .04, .03, '#fffaf0'), .2, .56, .1), light);
  },
  // Tháp xương rồng (thay cây cho mèo): hai tầng đúng chỗ tầng giữa (~1.16) và đỉnh (~1.88).
  'cattree-cactus'() {
    const green = '#4f9f5a', flower = '#ec5b8c';
    const spikes = (x, z, y0, h) => [...Array(8)].map((_, i) => at(ball(.014, '#fffaf0'), x + Math.cos(i * 2.2) * .115, y0 + (i / 8) * h, z + Math.sin(i * 2.2) * .115));
    return hangingToy(group(at(rbox(1, .12, 1, .05, '#f3dfb0'), 0, .06, 0), at(cyl(.11, .11, 1.05, green), -.25, .6, -.2), at(cyl(.13, .13, 1.7, green), .22, .9, .18),
      ...spikes(-.25, -.2, .2, .8), ...spikes(.22, .18, .25, 1.4),
      at(cyl(.38, .34, .1, green), -.1, 1.1, -.12), at(cyl(.36, .32, .14, flower), .22, 1.8, .18),
      ...[0, 1, 2, 3, 4].map(i => at(ball(.1, '#ff8fb6'), .22 + Math.cos(i * 1.26) * .34, 1.82, .18 + Math.sin(i * 1.26) * .34)),
      at(ball(.08, '#ffd23f'), .22, 1.9, .18)), '#ffd23f', '#4f9f2e');
  },
  // Tủ quần áo (thay kệ sách): nóc cao 2 như kệ sách, mèo nhảy lên nóc nằm canh.
  'shelf-wardrobe'() {
    const body = '#f5f0e6', door = '#8fc9f2';
    return group(at(box(1.6, 1.94, .5, body), 0, .99, 0), at(box(1.68, .06, .56, '#e3ddd1'), 0, 1.97, 0),
      at(box(.76, 1.7, .02, door), -.39, 1.05, .26), at(box(.76, 1.7, .02, door), .39, 1.05, .26),
      at(cyl(.02, .02, .22, '#b3aa99'), -.06, 1.1, .29), at(cyl(.02, .02, .22, '#b3aa99'), .06, 1.1, .29),
      at(box(1.5, .14, .02, '#e3ddd1'), 0, .12, .26), ...[[-.72, -.2], [.72, -.2], [-.72, .2], [.72, .2]].map(([x, z]) => at(box(.08, .04, .08, '#b3aa99'), x, .02, z)),
      at(rbox(.3, .2, .3, .03, '#ec5b8c'), -.45, 2.1, 0), at(rbox(.26, .12, .26, .03, '#ffd23f'), -.45, 2.26, 0));
  },
  // Lồng chim (thay bể cá): chim nhỏ bay qua lại trong lồng; mèo ngồi nhìn theo, thỉnh thoảng khều.
  'tank-birdcage'() {
    const gold = '#d9a13a';
    const bars = [...Array(14)].map((_, i) => { const a = i / 14 * TAU; return at(cyl(.008, .008, .62, gold, 6), Math.cos(a) * .34, 1.28, Math.sin(a) * .34); });
    const dome = at(mesh(new THREE.SphereGeometry(.34, 20, 10, 0, TAU, 0, Math.PI / 2), mat(gold, { wireframe: true, metalness: .7, roughness: .4 })), 0, 1.59, 0);
    const birds = ['#ffd23f', '#8fd4b8'].map((color, i) => {
      const b = group(ball(.06, color), at(ball(.04, color), .05, .05, 0), at(mesh(new THREE.ConeGeometry(.015, .04, 8), '#ff7a3d'), .1, .05, 0).rotateZ(-Math.PI / 2));
      b.children[0].scale.set(1.2, .9, .9);
      b.userData.phase = i * Math.PI;
      return b;
    });
    const cage = group(at(rbox(1.2, .7, .62, .05, '#f5f0e6'), 0, .35, 0), at(cyl(.36, .38, .06, gold), 0, .98, 0), at(cyl(.36, .36, .03, gold), 0, 1.58, 0),
      ...bars, dome, at(mesh(new THREE.TorusGeometry(.06, .012, 8, 16), gold), 0, 1.98, 0), at(cyl(.008, .008, .5, '#9a6a45', 6), 0, 1.2, 0).rotateZ(Math.PI / 2),
      at(rbox(.3, .12, .2, .03, '#ec5b8c'), -.35, .76, 0), ...birds);
    cage.userData.fish = birds; // mèo ngồi xem "cá" — ở đây là chim bay trong lồng
    cage.userData.update = t => birds.forEach(b => {
      const a = t * 1.3 + b.userData.phase;
      b.position.set(Math.sin(a) * .2, 1.25 + Math.abs(Math.sin(a * 2)) * .15, Math.cos(a * .7) * .12);
      b.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    });
    return cage;
  },
  // ===== Phương án thứ hai cho từng chỗ (lựa chọn thứ 3): cùng khuôn khổ + điểm neo của món gốc =====
  // Thảm hình cá (thay thảm): phẳng, nằm gọn trong khung thảm gốc (3.1 × 2.2); mặt thảm .0525 như thảm hồng.
  'rug-fish'() {
    const blue = '#8fc9f2', light = '#cfe9ff', fin = '#6fb3e6';
    const tri = (r, h, color, x, y) => { const t = at(cyl(r, r, h, color, 3), x, y, 0); t.rotation.y = -Math.PI / 2; return t; }; // một đỉnh chĩa về -x (vào thân cá)
    const body = at(cyl(.95, .95, .04, blue, 48), -.25, .02, 0), belly = at(cyl(.8, .8, .045, light, 40), -.25, .0225, 0);
    body.scale.set(1.15, 1, .75); belly.scale.set(1.15, 1, .72);
    const rug = group(body, belly, tri(.5, .04, blue, 1.2, .02), tri(.36, .045, light, 1.16, .0225),
      ...[-1, 1].map(s => at(cyl(.3, .3, .035, fin, 3), -.15, .0175, s * .72)), // vây lưng / vây bụng ló ra mép thân
      at(cyl(.13, .13, .0575, '#fffaf0', 20), -1.02, .02875, -.2), at(cyl(.06, .06, .0625, '#2b2f3a', 16), -1.04, .03125, -.2), // mắt
      ...[[.05, .22, .14], [.4, -.18, .11], [-.4, -.36, .09], [-.55, .3, .08]].map(([x, z, r]) => at(cyl(r, r, .0575, '#ffd66b', 20), x, .02875, z))); // đốm vảy
    rug.traverse(node => { node.castShadow = false; });
    rug.userData.top = .0525;
    return rug;
  },
  // Ghế papasan (thay ghế bành): bát mây trên chân trống, nệm tròn dày; lòng nệm ~.7 (mèo đáp .66 lún vào nệm).
  'armchair-papasan'() {
    const wicker = '#d9a36a', dark = '#b9854a';
    return group(at(cyl(.3, .36, .26, dark), 0, .13, 0), at(cyl(.56, .3, .3, wicker), 0, .43, 0),
      at(mesh(new THREE.TorusGeometry(.53, .035, 8, 48), dark), 0, .58, 0).rotateX(Math.PI / 2),
      squash(at(ball(.5, '#ec5b8c'), 0, .6, .02), 1, .24, .96), // nệm
      squash(at(ball(.2, '#ffd9c4'), 0, .78, -.3), 1.4, .8, .6), squash(at(ball(.12, '#ffd66b'), .26, .72, -.18), 1, .7, 1)); // gối tựa + gối nhỏ
  },
  // Chậu tulip (thay cây cảnh): cụm hoa là `leaves` (mèo gặm thì rung).
  'plant-tulips'() {
    let seed = 11;
    const rnd = (lo, hi) => { seed = (seed * 16807) % 2147483647; return lo + (seed / 2147483647) * (hi - lo); };
    const colors = ['#ff8fb6', '#e5483a', '#ffd23f', '#fffaf0', '#ff8fb6', '#b79cf0', '#e5483a'];
    const leaves = group();
    colors.forEach((color, i) => {
      const a = i * 2.4, r = i ? rnd(.08, .18) : 0, h = rnd(.32, .48), x = Math.sin(a) * r, z = Math.cos(a) * r;
      leaves.add(at(cyl(.012, .012, h, '#5a9a3e', 6), x, .5 + h / 2, z),
        at(cyl(.07, .045, .13, color, 12), x, .5 + h + .05, z), at(ball(.046, color), x, .5 + h - .01, z));
      const leaf = squash(at(ball(.05, '#5fae46'), x + Math.sin(a) * .05, .62, z + Math.cos(a) * .05), .45, 2.6, 1.1);
      leaf.rotation.set(Math.cos(a) * .35, 0, -Math.sin(a) * .35);
      leaves.add(leaf);
    });
    mergeStatic(leaves);
    const pot = group(at(cyl(.3, .24, .42, '#8fc9f2'), 0, .21, 0), at(cyl(.33, .33, .08, '#6fb3e6'), 0, .44, 0),
      at(cyl(.28, .28, .02, '#7a4a2a'), 0, .485, 0), ...[0, 1, 2].map(k => at(ball(.035, '#fffaf0'), Math.sin(k * 2.1) * .27, .24, Math.cos(k * 2.1) * .27)), leaves);
    pot.userData.leaves = leaves;
    return pot;
  },
  // Bể bóng (thay giỏ len): chậu tròn đầy bóng màu; quả bóng vàng trên cùng là đồ chơi mèo khều ra sàn.
  'yarn-ballpit'() {
    const colors = ['#ec5b8c', '#3b8fe0', '#ffd23f', '#4fb34a', '#ff7a3d', '#b79cf0'];
    const balls = [];
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, r = i < 6 ? .14 : .28, y = i < 6 ? .38 : .3 + (i % 3) * .02;
      balls.push(at(ball(.085, colors[i % colors.length]), Math.sin(a) * r, y, Math.cos(a) * r));
    }
    const toy = at(ball(.11, '#ffd23f'), .05, .44, .12);
    const pit = group(at(cyl(.42, .38, .32, '#fff3d1'), 0, .16, 0), at(mesh(new THREE.TorusGeometry(.42, .04, 10, 40), '#ec5b8c'), 0, .32, 0).rotateX(Math.PI / 2),
      ...[.08, .2].map(y => at(mesh(new THREE.TorusGeometry(.385 + y * .1, .018, 6, 40), '#8fc9f2'), 0, y, 0).rotateX(Math.PI / 2)), ...balls, toy);
    pit.userData.toy = toy;
    toy.userData.home = toy.position.clone();
    return pit;
  },
  // Nệm trái tim (thay ổ mèo): đế + nệm lót tròn mép + viền gối ống tròn bọc quanh, ba nút bọc vải; mèo nằm ở .14 như ổ gốc.
  // Đường tim dựng từ hai cung thùy + đoạn thẳng xuống mũi + cung lõm bo tròn ở giữa (bán kính > bán kính ống viền): hai thùy viền chạm nhau
  // ở chỗ lõm chứ không xuyên vào nhau, nệm / đế không có góc nhọn để mép bo gập ngược (lởm chởm).
  'catbed-heart'() {
    const R = .24, A = .255, TIP = .6, F = .08, TUBE = .075;
    const yF = Math.sqrt((R + F) ** 2 - A ** 2), d = Math.hypot(A, TIP);
    const a0 = Math.atan2(-TIP, -A) + Math.acos(R / d), a1 = Math.atan2(yF, -A), f0 = Math.atan2(-yF, A);
    const half = [];
    for (let k = 0; k <= 6; k++) { const u = k / 6, ex = A + R * Math.cos(a0), ey = R * Math.sin(a0); half.push([ex * u, -TIP + (ey + TIP) * u]); }
    for (let k = 1; k <= 40; k++) { const a = a0 + (a1 - a0) * k / 40; half.push([A + R * Math.cos(a), R * Math.sin(a)]); }
    for (let k = 1; k <= 10; k++) { const a = f0 + (-Math.PI / 2 - f0) * k / 10; half.push([F * Math.cos(a), yF + F * Math.sin(a)]); }
    // nửa phải (ngược kim đồng hồ từ mũi lên tới đáy cung lõm) + nửa trái đối xứng; bỏ điểm trùng ở mũi và đáy lõm
    const loop = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => new THREE.Vector2(x, y + .12));
    const scaled = k => loop.map(p => new THREE.Vector2(p.x * k, (p.y - .05) * k + .05));
    const slab = (pts, depth, bevel, color, y) => {
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 12 });
      geo.rotateX(-Math.PI / 2).translate(0, bevel, 0); // nằm phẳng, đáy ở y = 0; thùy tim quay ra sau (-z), mũi tim ra trước
      const node = at(mesh(geo, color), 0, y, 0);
      // đế / nệm lọt trong viền gối: viền toon (vỏ phồng ra) của chúng lòi qua mặt trong ống viền thành nét đen
      node.userData.noOutline = true;
      return node;
    };
    // ống chạy theo đường tim, dời ra ngoài `out` theo pháp tuyến (đường đi ngược kim đồng hồ: pháp tuyến ngoài = (dy, -dx))
    const tube = (out, y, r, color) => {
      const pts = loop.map((p, k) => {
        const a = loop[(k + loop.length - 1) % loop.length], b = loop[(k + 1) % loop.length], nx = b.y - a.y, ny = a.x - b.x, n = Math.hypot(nx, ny);
        return new THREE.Vector3(p.x + nx / n * out, y, -(p.y + ny / n * out));
      });
      return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 220, r, 16, true), color);
    };
    const rim = tube(0, .13, TUBE, '#ff8fb8');
    const buttons = [[0, .1], [-.2, -.14], [.2, -.14]].map(([x, z]) => squash(at(ball(.035, '#ff8fb8'), x, .16, z), 1, .45, 1));
    const bed = group(slab(scaled(1.04), .04, .02, '#e8668f', 0), slab(scaled(.86), .05, .04, '#f1e4ff', .03), rim, ...buttons);
    bed.userData.outlineStyle = 'outer';
    return bed;
  },
  // Bàn thùng gỗ (thay bàn nhỏ): hai thùng chồng + tấm ván; mặt bàn .81, chai sữa là thứ mèo đẩy rơi.
  'table-crate'() {
    const wood = '#c98a55', light = '#e0a874';
    const slats = (w, d, y) => [-1, 1].map(s => at(box(w + .02, .06, .03, light), 0, y, s * (d / 2 + .005)));
    const bottle = group(at(cyl(.07, .075, .16, '#fffaf0', 16), 0, 0, 0), at(cyl(.04, .07, .05, '#fffaf0', 16), 0, .1, 0), at(cyl(.042, .042, .03, '#3b8fe0', 16), 0, .14, 0),
      at(cyl(.076, .076, .05, '#8fc9f2', 16), 0, -.02, 0));
    bottle.position.set(.15, .9, .1);
    const table = group(at(rbox(.8, .38, .6, .04, wood), 0, .19, 0), ...slats(.8, .6, .2),
      at(rbox(.7, .36, .54, .04, wood), 0, .56, 0), ...slats(.7, .54, .57),
      at(rbox(.88, .04, .68, .015, light), 0, .79, 0), bottle,
      at(rbox(.24, .04, .18, .01, '#ec5b8c'), -.2, .83, -.16), at(rbox(.2, .04, .16, .01, '#ffd23f'), -.2, .87, -.16));
    table.userData.mug = bottle;
    bottle.userData.home = bottle.position.clone();
    return table;
  },
  // Đèn lồng giấy (thay đèn đứng): quả cầu giấy phát sáng treo trên cần cong; mèo nằm sưởi dưới đèn.
  'lamp-lantern'() {
    const wood = '#9a6a45', R = .28, Y = 1.62;
    const paper = at(ball(R, mat('#fff1d6', { emissive: '#ffcf7a', emissiveIntensity: .7 })), 0, Y, 0);
    const ribs = [-.6, -.2, .2, .6].map(k => {
      const rib = at(mesh(new THREE.TorusGeometry(Math.sqrt(1 - k * k) * R * 1.01, .006, 6, 36), '#e0a93c'), 0, Y + k * R, 0).rotateX(Math.PI / 2);
      rib.userData.noOutline = true;
      return rib;
    });
    const arm = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 1.7, -.15], [0, 2.02, -.13], [0, 2.06, 0], [0, 1.95, 0]].map(p => new THREE.Vector3(...p))), 16, .025, 8), wood);
    const light = new THREE.PointLight('#ffcf7a', 5, 6, 1.6);
    light.position.set(0, Y, 0);
    return group(at(cyl(.22, .26, .05, wood), 0, .025, -.15), at(cyl(.03, .03, 1.7, wood), 0, .87, -.15), arm,
      at(cyl(.06, .08, .05, '#e0a93c'), 0, Y + R + .02, 0), at(cyl(.008, .008, .07, '#e0a93c', 6), 0, Y + R + .08, 0), paper, ...ribs,
      at(cyl(.07, .05, .04, '#e0a93c'), 0, Y - R - .01, 0), at(cyl(.012, .025, .14, '#ec5b8c', 8), 0, Y - R - .1, 0), light);
  },
  // Lâu đài (thay cây cho mèo): hai tháp đá đúng chỗ hai cột, sàn gỗ tầng giữa (~1.15), đỉnh tháp có tường lỗ châu mai (~1.87).
  'cattree-castle'() {
    const stone = '#e6dfd2', flagColor = '#ec5b8c';
    const windows = (x, z, r, ys) => ys.map(y => at(rbox(.07, .12, .06, .03, '#6b5a4a'), x, y, z + r - .015));
    const crenels = [...Array(8)].map((_, k) => { const a = k / 8 * TAU; return at(box(.1, .1, .08, stone), .22 + Math.cos(a) * .32, 1.92, .18 + Math.sin(a) * .32).rotateY(-a); });
    const flag = group(at(cyl(.012, .012, .5, '#9a6a45', 6), 0, .25, 0), at(box(.2, .12, .01, flagColor), .1, .43, 0));
    flag.position.set(.22 + .3, 1.87, .18 - .1);
    return hangingToy(group(at(rbox(1, .12, 1, .05, '#c8e6a8'), 0, .06, 0),
      at(cyl(.13, .14, 1.05, stone), -.25, .6, -.2), ...windows(-.25, -.2, .13, [.45]),
      at(cyl(.15, .17, 1.7, stone), .22, .9, .18), ...windows(.22, .18, .15, [.5, 1.2]),
      at(rbox(.72, .1, .72, .04, '#c98a55'), -.1, 1.1, -.12), ...[-.3, -.1, .1].map(x => at(box(.02, .005, .7, '#a87444'), x, 1.153, -.12)),
      at(cyl(.36, .36, .14, stone), .22, 1.8, .18), ...crenels, flag), '#ffd23f', '#8a6a4a');
  },
  // Kệ ô vuông (thay kệ sách): 3 × 4 ô có giỏ vải, sách, chậu cây; nóc cao 2 như kệ sách gốc.
  'shelf-cubby'() {
    const wood = '#f5f0e6', edge = '#e3ddd1', parts = [at(box(1.6, 1.98, .04, edge), 0, .99, -.23), at(box(.06, 2, .5, wood), -.77, 1, 0), at(box(.06, 2, .5, wood), .77, 1, 0)];
    [-.26, .26].forEach(x => parts.push(at(box(.04, 1.94, .48, wood), x, 1, .01)));
    [.03, .52, 1.01, 1.49, 1.97].forEach(y => parts.push(at(box(1.6, .06, .5, wood), 0, y, 0)));
    const cols = [-.52, 0, .52], rows = [.06, .55, 1.04, 1.52];
    const bins = ['#ec5b8c', '#8fc9f2', '#ffd66b', '#7fc45a', '#b79cf0'];
    rows.forEach((y, r) => cols.forEach((x, c) => {
      const k = r * 3 + c;
      if (k % 3 === 0) parts.push(at(rbox(.42, .36, .4, .05, bins[k % bins.length]), x, y + .18, .02), at(rbox(.14, .04, .03, .015, '#fffaf0'), x, y + .28, .225));
      else if (k % 3 === 1) for (let i = 0; i < 4; i++) parts.push(at(box(.07, .3 + (i % 2) * .05, .32, bins[(k + i) % bins.length]), x - .15 + i * .085, y + .17 + (i % 2) * .025, 0));
      else parts.push(at(cyl(.1, .08, .16, '#e98b5a', 16), x, y + .08, 0), at(ball(.12, '#7fc45a'), x, y + .24, 0));
    }));
    return group(...parts);
  },
  // Nhà chuột hamster (thay bể cá): lồng có bánh xe quay + nhà gỗ; chuột chạy quanh lồng, mèo ngồi xem.
  'tank-hamster'() {
    const frame = '#ffd66b', Y0 = .78, Y1 = 1.36;
    const bars = [];
    for (let i = 0; i <= 10; i++) for (const z of [-.25, .25]) bars.push(new THREE.CylinderGeometry(.007, .007, Y1 - Y0, 6).translate(-.53 + i * .106, (Y0 + Y1) / 2, z));
    for (let i = 1; i < 5; i++) for (const x of [-.53, .53]) bars.push(new THREE.CylinderGeometry(.007, .007, Y1 - Y0, 6).translate(x, (Y0 + Y1) / 2, -.25 + i * .1));
    const cage = mesh(mergeGeometries(bars), '#c8c2b8');
    cage.userData.noOutline = true; // song lồng mảnh: viền toon sẽ thành mớ nét đen
    const wheel = group(at(mesh(new THREE.TorusGeometry(.16, .018, 8, 32), '#ec5b8c'), 0, 0, 0),
      ...[0, 1, 2].map(k => at(box(.3, .012, .012, '#ec5b8c'), 0, 0, 0).rotateZ(k * Math.PI / 3)), at(cyl(.025, .025, .06, '#fffaf0', 12), 0, 0, 0).rotateX(Math.PI / 2));
    wheel.position.set(.3, Y0 + .2, -.05);
    const hamster = group(squash(ball(.07, '#f3c08a'), 1.25, .9, 1), at(ball(.04, '#fffaf0'), .07, -.01, 0), ...[-1, 1].map(s => at(ball(.022, '#f3a6a6'), .04, .05, s * .04)));
    hamster.userData.phase = 0;
    const home = group(at(rbox(1.2, .7, .62, .05, '#b9854a'), 0, .35, 0), at(rbox(1.12, .08, .54, .03, frame), 0, .74, 0), at(box(1.06, .02, .48, '#f3dfb0'), 0, .785, 0),
      cage, at(rbox(1.12, .05, .54, .02, frame), 0, Y1 + .025, 0), wheel, at(box(.05, .2, .05, '#fffaf0'), .3, Y0 + .1, -.12),
      at(rbox(.24, .16, .2, .03, '#e98b5a'), -.32, Y0 + .09, -.08), at(cyl(.001, .17, .12, '#ec5b8c', 4), -.32, Y0 + .23, -.08).rotateY(Math.PI / 4),
      at(cyl(.035, .035, .18, '#8fc9f2', 12), -.5, 1.1, .2), at(cyl(.008, .008, .06, '#c8c2b8', 6), -.5, .98, .2), hamster);
    home.userData.fish = [hamster]; // mèo ngồi xem chuột chạy
    home.userData.update = t => {
      wheel.rotation.z = -t * 3;
      const a = t * .9;
      hamster.position.set(-.05 + Math.sin(a) * .28, Y0 + .07, .1 + Math.sin(a * 2) * .06);
      hamster.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    };
    return home;
  },
};

// Đồ vườn dùng chung cơ chế đặt/dựng với đồ phòng khách.
Object.assign(BUILD, GARDEN_BUILD, JAPAN_BUILD, BEDROOM_BUILD, KITCHEN_BUILD, BATHROOM_BUILD, GARDEN2_BUILD, BACKYARD_BUILD, KINDER_BUILD);
// Món tự phát sáng (đèn bàn, màn hình, dải LED, lửa, nến) không có PointLight riêng: khai là nguồn sáng để QC (qc.mjs glow) và
// chế độ đêm giữ phần sáng. Món KHÁC mà có vật liệu emissive / MeshBasicMaterial không nhận sáng là lỗi (ban đêm sáng rực như đèn).
for (const id of ['bedside', 'desk', 'desk-study', 'fridge-steel', 'stove-wood', 'dining-square']) {
  const make = BUILD[id];
  BUILD[id] = (...args) => { const node = make(...args); node.userData.lightSource = true; return node; };
}

// Dựng một món trong danh mục. Phương án thay thế có model riêng (BUILD[id]) nhưng giữ khuôn khổ và các móc
// cho mèo của món gốc (userData.fish / leaves / bird / toy / mug, độ cao chỗ ngồi) — xem cat-brain.mjs useFurniture.
// Món đồ không có bộ phận nào cử động riêng (mèo / hiệu ứng không giữ tham chiếu tới khối con): gộp khối cùng màu.
const STATIC_ITEMS = new Set(['cathouse', 'shelf', 'rug', 'rug-quilt', 'sandbox', 'armchair', 'bench', 'slide',
  'bed', 'bed-canopy', 'bedrug', 'bedrug-cloud', 'desk', 'desk-study', 'chair-beanbag', 'closet', 'closet-dresser', 'plushie', 'plushie-dino', 'laundry', 'catsteps-bridge',
  'rug-fish', 'armchair-papasan', 'catbed-heart', 'shelf-cubby', 'bed-kitty', 'bedrug-star', 'laundry-washer', 'desk-piano', 'chair-stool',
  'closet-ladder', 'plushie-bunny', 'catsteps-clouds',
  // vườn: món không có bộ phận cử động riêng (đèn PointLight giữ nguyên, mergeStatic chỉ gộp mesh)
  'stump', 'stump-hay', 'stump-crate', 'lantern', 'lantern-lamppost', 'sandbox-turtle', 'sandbox-parasol',
  'cathouse-barrel', 'cathouse-mushroom', 'bench-log', 'bench-sofa',
  'stump-jp', 'lantern-jp', 'sandbox-jp', 'cathouse-jp', 'bench-jp',
  // bếp: món không có bộ phận cử động riêng (bàn ăn / xe đẩy giữ cốc cho mèo đẩy rơi nên không gộp)
  'fridge', 'fridge-retro', 'fridge-steel', 'stove', 'stove-wood', 'stove-red', 'sink', 'sink-farm', 'sink-steel', 'pantry', 'pantry-rack', 'pantry-hutch',
  'kchair', 'kchair-stool', 'kchair-bench', 'catfood', 'catfood-feeder', 'catfood-stand',
  // phòng tắm: chưa có bộ phận cử động riêng
  'toilet', 'toilet-wood', 'toilet-kitty', 'vanity', 'vanity-pedestal', 'vanity-wood', 'bathtub', 'bathtub-wood', 'bathtub-bubble',
  'shower', 'shower-rain', 'shower-curtain', 'washer', 'washer-retro', 'washer-stack', 'towel', 'towel-ladder', 'towel-heated',
  'litter', 'litter-hood', 'litter-cabinet', 'bathmat', 'bathmat-fluffy', 'bathmat-duck', 'jacuzzi', 'jacuzzi-cedar', 'jacuzzi-mosaic']);
function buildItem(entry) {
  const node = BUILD[entry.id]();
  if (STATIC_ITEMS.has(entry.id)) mergeStatic(node);
  node.userData.itemId = entry.id;
  return markOutlineUnit(node);
}
// Cho tools/export/export-models.mjs: id mọi model đồ deco (cả phương án thay thế) + dựng một món theo id.
export const modelIds = () => Object.keys(BUILD);
export const buildModel = id => buildItem({ id });

// ---------- Sàn: vân gỗ / thảm / gạch vẽ bằng canvas ----------
// k: độ phân giải gấp k lần (ảnh cận cảnh, vd. quà 7 ngày), hình vẽ y hệt.
function floorTexture(entry, k = 1) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512 * k;
  const g = canvas.getContext('2d');
  g.scale(k, k);
  g.fillStyle = entry.color; g.fillRect(0, 0, 512, 512);
  if (entry.id.endsWith('-checker')) {
    g.fillStyle = '#2f3238';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
  } else if (entry.id.endsWith('-tiles')) {
    g.fillStyle = '#ffffff55';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
    g.strokeStyle = '#ffffff99'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
  } else if (entry.id.endsWith('-tatami')) {
    // Chiếu tatami: các tấm 2:1 xếp so le, viền vải tối hai mép dài, vân đan mảnh.
    for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() > .5 ? '#ffffff16' : '#3a4a1a16'; g.fillRect(Math.random() * 512, Math.random() * 512, 1, 6); }
    g.strokeStyle = '#4a3a1a'; g.lineWidth = 5;
    const mats = [[0, 0, 256, 128], [256, 0, 256, 128], [0, 128, 128, 256], [128, 128, 128, 256], [256, 128, 256, 128], [256, 256, 256, 128], [0, 384, 256, 128], [256, 384, 256, 128]];
    mats.forEach(([x, y, w, h]) => g.strokeRect(x + 2, y + 2, w - 4, h - 4));
    g.fillStyle = '#2f3a24';
    mats.forEach(([x, y, w, h]) => { if (w > h) { g.fillRect(x + 2, y + 2, w - 4, 7); g.fillRect(x + 2, y + h - 9, w - 4, 7); } else { g.fillRect(x + 2, y + 2, 7, h - 4); g.fillRect(x + w - 9, y + 2, 7, h - 4); } });
  } else if (entry.id.endsWith('-bamboo')) {
    // Sàn tre: thanh dọc mảnh, mắt tre nằm rải rác.
    g.strokeStyle = '#8a6a2a55'; g.lineWidth = 2;
    for (let x = 0; x <= 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    g.fillStyle = '#8a6a2a66';
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(Math.random() * 16) * 32 + 4, Math.random() * 512, 24, 3);
  } else if (entry.id.endsWith('-concrete')) {
    // Bê tông mài: hạt li ti sáng / tối + mạch chia tấm lớn.
    for (let i = 0; i < 3500; i++) { g.fillStyle = Math.random() > .5 ? '#ffffff14' : '#0000001a'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    g.strokeStyle = '#00000030'; g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, 512); g.moveTo(0, i * 256); g.lineTo(512, i * 256); g.stroke(); }
  } else if (entry.id.endsWith('-carpet')) {
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
// Nhìn "vật lý" hơn: tone mapping trung tính (Khronos PBR Neutral, giữ đúng màu, vùng sáng không cháy trắng)
// + ánh sáng môi trường mềm từ một căn phòng ảo (RoomEnvironment) để bề mặt có sáng tối tự nhiên như thật.
function physicalLook(renderer, scene, envIntensity = .45) {
  if (TOON) return toonLook(renderer, scene);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = envIntensity;
  pmrem.dispose();
}

// Máy chụp: renderer + cảnh có đèn giống phòng. thumbKit chụp ảnh tĩnh (thumbnail), spinKit vẽ model sống của popup (thumbSpinner):
// tách riêng để canvas của spinKit gắn thẳng vào trang (không chép ảnh GPU -> CPU mỗi khung, không đổi cỡ bộ đệm mỗi lần vẽ).
function makeStudio(size, preserveDrawingBuffer) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  const scene = new THREE.Scene();
  physicalLook(renderer, scene);
  scene.add(new THREE.HemisphereLight('#fff8e8', '#e0b98a', TOON ? 1.15 * TOON_LIGHT.hemi : 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', TOON ? 1.7 * TOON_LIGHT.sun : 1.9); // toon: cùng ánh sáng với phòng để icon khớp màu
  sun.position.set(3, 7, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(TOON ? TOON_FOV : 28, 1, .05, 60);
  camera.layers.enable(OUTLINE_LAYER); camera.layers.enable(DECAL_LAYER);
  return { renderer, scene, camera };
}
const thumbStudio = () => (thumbKit ||= makeStudio(192, true));
let spinKit = null;
// Gỡ model chụp xong. Chất liệu nướng màu (mergeStatic bakeColors) dùng chung với bản đồ màn: không huỷ.
const disposeSubject = subject => subject.traverse(node => {
  if (node.isMesh) { node.geometry.dispose(); [].concat(node.material).forEach(m => { if (m.userData.bakedColors) return; m.map?.dispose(); m.dispose(); }); }
});
const slab = (w, d, top, edge = '#c79a5f') => {
  const node = mesh(new THREE.BoxGeometry(w, .12, d), mat(edge));
  node.material = [mat(edge), mat(edge), top, mat(edge), mat(edge), mat(edge)];
  node.position.y = -.06;
  return node;
};
const OUTDOOR = new Set(['garden', 'backyard', 'kinder']); // khu ngoài trời: nền cỏ + hàng rào thay cho sàn + tường
// Quà 7 ngày (menu/login.js) dựng 3D toon, chụp bằng thumbnail() như đồ deco. Mặt trước quay về +z.
const standing = node => { node.rotation.x = Math.PI / 2; return node; };
// Booster = đồng xu dày, mặt trước dán đúng ảnh booster (assets/img/play/booster-*.png; ảnh tròn kín khung nên khớp UV nắp trụ).
// Nạp sẵn ảnh lúc nạp module: thumbnail chụp đồng bộ, ảnh chưa xong thì thumbnail() trả null (người gọi dùng ảnh PNG).
const BOOSTER_RIM = { moves: '#5cbf78', hammer: '#e0528e', swap: '#3f8fe0' };
const BOOSTER_IMG = Object.fromEntries(Object.keys(BOOSTER_RIM).map(id => { const img = new Image(); img.src = `./assets/img/play/booster-${id}.png`; return [id, img]; }));
function boosterCoin(id) {
  const map = new THREE.Texture(BOOSTER_IMG[id]);
  // UV nắp trụ lệch 90° so với ảnh: xoay lại cho ảnh đứng thẳng.
  map.colorSpace = THREE.SRGBColorSpace; map.center.set(.5, .5); map.rotation = Math.PI / 2; map.needsUpdate = true;
  // Mặt ảnh không nhận sáng: giữ đúng màu art; viền + mặt sau tô toon theo màu vành.
  const rim = mat(BOOSTER_RIM[id]), coin = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .16, 48), [rim, new THREE.MeshBasicMaterial({ map, transparent: true }), rim]);
  return standing(group(coin));
}
// Quà 1 đồng xu (7 ngày): cùng kiểu đồng xu booster, mặt trước dán đúng ảnh xu tiền tệ (assets/img/home/coin-glossy.png, cùng icon xu ở Shop / Daily / Quests).
// Ảnh 256 × 256 có lề trong suốt: cắt sát hình tròn vào canvas vuông để khớp UV nắp trụ. Thành xu cam như vòng cam của ảnh.
const COIN_IMG = Object.assign(new Image(), { src: './assets/img/home/coin-glossy.png' });
const COIN_BOX = [1, 4, 254, 248];
const COIN_RIM = '#e8901a', COIN_GOLD = '#fdd451';
// Chất liệu [thành, mặt trên, mặt dưới] của đồng xu dán ảnh; bothFaces: mặt dưới cũng dán ảnh (xu rải nghiêng trong núi xu lộ cả mặt dưới).
function coinMats(bothFaces = false) {
  const canvas = document.createElement('canvas'), [x, y, w, h] = COIN_BOX;
  canvas.width = canvas.height = 256;
  canvas.getContext('2d').drawImage(COIN_IMG, x, y, w, h, 0, 0, 256, 256);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.center.set(.5, .5); map.rotation = Math.PI / 2; map.anisotropy = 4;
  const rim = mat(COIN_RIM), face = new THREE.MeshBasicMaterial({ map, transparent: true });
  return [rim, face, bothFaces ? face : rim];
}
const iconCoin = () => standing(group(new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .16, 48), coinMats())));
function rewardModel(kind) {
  // Xu quà (1 đồng, núi xu): không viền toon (người chơi bỏ). Cờ structure: addOutlines bỏ qua cả cụm.
  const plain = node => { node.userData.structure = true; return node; };
  if (kind === 'coin') return plain(iconCoin());
  if (kind === 'coins') {
    // Núi xu: tháp xu giữa cao nhất, các vòng ngoài thấp dần; chỉ đồng trên cùng mỗi tháp có dấu chân, rải thêm xu nằm nghiêng / dựng đứng.
    // Xu thân tháp dùng chung một lưới 16 cạnh + 2 chất liệu (nhỏ trên màn hình): dựng + gộp nhanh hơn nhiều so với lưới riêng từng đồng.
    // Đồng có dấu chân = đồng xu dán ảnh xu tiền tệ như quà 1 đồng, vẽ chung một InstancedMesh (~60 đồng, 3 lệnh vẽ). Thân tháp theo bảng màu ảnh xu.
    const pile = group(), coinGeo = new THREE.CylinderGeometry(.5, .5, .14, 16), goldMat = mat(COIN_GOLD), edgeMat = mat(COIN_RIM), faces = [];
    [[0, 0, 1, 15], [.8, .2, 6, 12], [1.55, .5, 11, 8], [2.25, .9, 15, 4], [2.9, .3, 19, 2]].forEach(([r, phase, count, tall], ring) => {
      for (let i = 0; i < count; i++) {
        const a = phase + i * Math.PI * 2 / count, x = Math.cos(a) * r, z = Math.sin(a) * r * .8, h = tall + (i % 2);
        for (let k = 0; k < h - 1; k++) pile.add(at(new THREE.Mesh(coinGeo, k % 2 ? goldMat : edgeMat), x + (k % 3 - 1) * .03, .07 + k * .15, z));
        const top = at(group(), x, .07 + (h - 1) * .15, z); top.rotation.y = a + ring; faces.push(top);
      }
    });
    for (const [x, y, z, rx, rz] of [[-.6, 2.1, .7, .9, .3], [.7, 2, .8, 1.1, -.35], [-1.4, 1.4, .6, .7, .5], [1.5, 1.3, .7, .8, -.4], [.1, 2.4, 1.1, 1.25, 0], [-2.2, .7, .8, .6, .4], [2.3, .6, .6, .7, -.3], [-.9, .4, 2.3, 1.3, .2], [.9, .4, 2.2, 1.2, -.2], [0, 2.4, -.2, .4, .1]]) {
      const coin = at(group(), x, y, z); coin.rotation.set(rx, 0, rz); faces.push(coin);
    }
    const faceCoins = new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .5, .14, 32), coinMats(true), faces.length);
    faces.forEach((node, i) => { node.updateMatrix(); faceCoins.setMatrixAt(i, node.matrix); });
    // ~300 đồng thân tháp: gộp thành vài lưới (màu nướng vào đỉnh) cho popup vẽ nhẹ khi lắc.
    return plain(group(mergeStatic(pile, { bakeColors: true }), faceCoins));
  }
  if (BOOSTER_RIM[kind]) return boosterCoin(kind);
  // mèo bí ẩn: hộp quà kraft buộc nơ
  const gift = group(rbox(1, .8, 1, .08, '#e9b97a'), at(rbox(1.08, .2, 1.08, .06, '#d9a464'), 0, .45, 0));
  gift.add(at(box(.18, .82, 1.02, '#e8457e'), 0, 0, 0), at(box(1.02, .82, .18, '#e8457e'), 0, 0, 0), at(box(.2, .22, 1.1, '#e8457e'), 0, .45, 0), at(box(1.1, .22, .2, '#e8457e'), 0, .45, 0));
  for (const s of [-1, 1]) { const loop = at(squash(ball(.2, '#ff6f9f'), 1.2, .7, .6), s * .2, .68, 0); loop.rotation.z = s * .5; gift.add(loop); }
  return gift;
}
// Quà là món deco: đúng model trong phòng, đặt trong góc phòng khách (sàn Oak + tường Cream mặc định). Phòng rộng hơn khung hình nhiều lần
// và camera chỉ ôm món (userData.frame), nên sàn + tường phủ kín ảnh, món to rõ ở giữa.
function itemDiorama(item) {
  const node = buildItem(item), bounds = new THREE.Box3().setFromObject(node), size = bounds.getSize(new THREE.Vector3()), c = bounds.getCenter(new THREE.Vector3());
  const big = Math.max(size.x, size.y, size.z), span = big * 8, half = span / 2, wallH = span * .5;
  // Tường không nhận sáng (màu cố định, tường hông tối hơn chút cho ra góc): tường toon đổi nấc sáng tối khi model lắc làm tường chớp mảng xám.
  const cream = new THREE.Color(itemById('wall-cream').color), flat = color => new THREE.MeshBasicMaterial({ color });
  const floor = itemById('floor-oak'), backWall = flat(cream), sideWall = flat(cream.clone().multiplyScalar(.93)), trim = flat('#ffffff');
  // Góc tường ngay sau món (khung hình thấy góc phòng), sàn trải về phía camera.
  // Sàn cận cảnh: texture nét gấp 4 + lặp 2 lần (ván nhỏ lại, mạch ván mảnh), không thì mạch ván phóng to thành vệt mờ đen.
  const floorMap = floorTexture(floor, 4);
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(2, 2); floorMap.anisotropy = 8;
  const room = at(group(slab(span, span, mat('#ffffff', { roughness: .9, map: floorMap })),
    at(new THREE.Mesh(new THREE.BoxGeometry(span, wallH, .08), backWall), 0, wallH / 2, -half + .04), at(new THREE.Mesh(new THREE.BoxGeometry(.08, wallH, span), sideWall), -half + .04, wallH / 2, 0),
    at(box(span, .1, .03, trim), 0, .05, -half + .095), at(box(.03, .1, span, trim), -half + .095, .05, 0)), c.x + half - big * 1.1, 0, c.z + half - big * 1.1);
  room.userData.structure = true; // kết cấu phòng: không viền (toon.mjs isStructure)
  const scene = group(room, node);
  // Ảnh phủ cả trang (tiêu đề ở trên, tên quà ở dưới đè lên): chừa lề rộng để món nằm gọn ở giữa.
  // Khung nhắm cao hơn món một chút: món rơi vào giữa phần trống giữa nhãn Day và tên quà.
  scene.userData.frame = bounds.clone().expandByScalar(big * .12).translate(new THREE.Vector3(0, big * .2, 0));
  return scene;
}
function thumbSubject(entry) {
  if (entry.reward) {
    // Quà dẹt (xu đứng, +3, mũi tên) quay thẳng mặt về camera thumbnail (THUMB_DIR) cho khỏi bị nhìn xiên.
    if (!entry.item) { const node = rewardModel(entry.reward), face = ['coin', 'moves', 'swap', 'hammer'].includes(entry.reward); if (face) { node.rotation.y += Math.atan2(THUMB_DIR.x, THUMB_DIR.z); node.rotation.x -= Math.asin(THUMB_DIR.y) * .8; node.rotation.order = 'YXZ'; } return node; }
    return itemDiorama(itemById(entry.item));
  }
  if (entry.cat === 'furniture') {
    // Món kép (kindergarten.mjs pair): hai bản đặt xa nhau, thumbnail kéo lại sát nhau, cùng quay mặt ra trước.
    const node = buildItem(entry), pair = node.userData.pair;
    if (pair) node.children.forEach(part => { part.position[pair.axis] = Math.sign(part.position[pair.axis]) * pair.thumb; part.rotation.y = 0; });
    return node;
  }
  if (entry.cat === 'floors') { // tấm sàn / nền đúng texture
    const top = mat('#ffffff', { roughness: .9, map: OUTDOOR.has(entry.zone) ? groundTexture(entry) : floorTexture(entry) });
    const tile = group(slab(1.6, 1.6, top));
    // sân sau: nửa phải lát gạch đúng kiểu sân quanh bể bơi đi theo nền này (buildPatio)
    const patio = PATIO_LOOKS[entry.id];
    if (patio) for (let i = 0; i < 2; i++) for (let k = 0; k < 4; k++) tile.add(at(box(.37, .02, .37, patio[1 + (i + k) % 2]), .2 + i * .4, .01, -.6 + k * .4));
    return tile;
  }
  if (OUTDOOR.has(entry.zone)) { // khoảnh vườn nhỏ có đúng kiểu rào
    return group(slab(1.7, 1.7, mat('#9fd46a', { roughness: .95 }), '#8a6a45'), buildFence(entry, .75));
  }
  // tường phòng khách: góc phòng nhỏ với đúng màu tường, sàn gỗ, chân tường trắng, ô cửa sổ
  const wall = mat(entry.color), trim = mat('#ffffff');
  return group(slab(1.5, 1.5, mat('#e4b574'), '#c79a5f'),
    at(box(1.5, 1.2, .08, wall), 0, .6, -.71), at(box(.08, 1.2, 1.5, wall), -.71, .6, 0),
    at(box(1.5, .1, .03, trim), 0, .05, -.66), at(box(.03, .1, 1.5, trim), -.66, .05, 0),
    at(new THREE.Mesh(new THREE.PlaneGeometry(.42, .5), new THREE.MeshBasicMaterial({ color: '#cfeaff' })), .25, .72, -.665));
}
// Hướng nhìn ảnh thumbnail (toạ độ của model: mặt trước model quay về +z). Popup xem trước ở Shop soi món theo đúng hướng này
// (xoay theo hướng món đặt trong phòng), nên món luôn hiện đúng mặt như ảnh thumbnail.
export const THUMB_DIR = new THREE.Vector3(.75, .62, 1).normalize();
// Khoảng cách camera để CẢ 8 góc hộp bao nằm trong khung ảnh (chừa lề THUMB_MARGIN), nhìn theo THUMB_DIR về tâm hộp.
// Lỗi cũ: tính theo hình cầu bao rồi nhân .82 để phóng to -> món dẹt / rộng (thảm, sàn, tường) và món cao bị cắt mép trong ảnh 192 px.
const THUMB_MARGIN = .94;
function thumbDistance(bounds, center, fov) {
  const back = THUMB_DIR, forward = back.clone().negate(), right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward), tan = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * THUMB_MARGIN;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(center), toward = corner.dot(back);
    distance = Math.max(distance, Math.abs(corner.dot(right)) / tan + toward, Math.abs(corner.dot(up)) / tan + toward);
  }
  return distance;
}
const SPIN_BACK = 1.1; // camera lùi thêm cho model quà lắc không chạm mép
export function thumbnail(entry, size = 192) {
  if (thumbCache[entry.id]) return thumbCache[entry.id];
  if (BOOSTER_IMG[entry.reward] && !BOOSTER_IMG[entry.reward].naturalWidth || ['coin', 'coins'].includes(entry.reward) && !COIN_IMG.naturalWidth) return null;
  const { renderer, scene, camera } = thumbStudio();
  renderer.setSize(size, size, false);
  const subject = thumbSubject(entry);
  subject.userData.update?.(0);
  scene.add(subject);
  addOutlines(subject);
  subject.updateMatrixWorld(true);
  const bounds = subject.userData.frame?.clone() ?? new THREE.Box3().setFromObject(subject), center = bounds.getCenter(new THREE.Vector3());
  // Quà 7 ngày: cùng khoảng lùi với thumbSpinner (SPIN_BACK) để ảnh tĩnh và model lắc khớp cỡ, đổi qua lại không nhảy.
  camera.position.copy(center).add(THUMB_DIR.clone().multiplyScalar(thumbDistance(bounds, center, camera.fov) * (entry.reward ? SPIN_BACK : 1)));
  camera.lookAt(center);
  syncOutlineResolution(renderer);
  renderer.render(scene, camera);
  thumbCache[entry.id] = renderer.domElement.toDataURL('image/png');
  if (size !== 192) renderer.setSize(192, 192, false);
  scene.remove(subject);
  disposeSubject(subject);
  return thumbCache[entry.id];
}

// Model 3D sống cho popup (quà 7 ngày): dựng một lần như thumbnail(), draw(yaw) xoay quanh trục đứng qua tâm rồi vẽ thẳng lên canvas
// chung `canvas` (một máy vẽ cho mọi model: người gọi gắn canvas vào trang đang xem). Camera lùi thêm chút để lắc không chạm mép. null = chưa dựng được.
export function thumbSpinner(entry, size = 360) {
  if (BOOSTER_IMG[entry.reward] && !BOOSTER_IMG[entry.reward].naturalWidth || ['coin', 'coins'].includes(entry.reward) && !COIN_IMG.naturalWidth) return null;
  const { renderer, scene, camera } = spinKit ||= makeStudio(size, false);
  const subject = thumbSubject(entry), pivot = group(subject);
  subject.userData.update?.(0);
  addOutlines(subject);
  pivot.updateMatrixWorld(true);
  const bounds = subject.userData.frame?.clone() ?? new THREE.Box3().setFromObject(pivot), center = bounds.getCenter(new THREE.Vector3());
  subject.position.sub(center); pivot.position.copy(center);
  const eye = center.clone().add(THUMB_DIR.clone().multiplyScalar(thumbDistance(bounds, center, camera.fov) * SPIN_BACK));
  return {
    canvas: renderer.domElement,
    draw(yaw) {
      pivot.rotation.y = yaw;
      scene.add(pivot);
      camera.position.copy(eye); camera.lookAt(center);
      syncOutlineResolution(renderer);
      renderer.render(scene, camera);
      scene.remove(pivot);
    },
    dispose() { disposeSubject(subject); },
  };
}

export function createRoom() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // Pixel ratio tối đa 1.5 + PCFShadowMap (giống bản đồ màn): GPU điện thoại yếu về fill-rate, dpr 2 + PCFSoft làm cảnh Deco
  // rớt 30–50 ms/khung; xem bằng mắt ở khung 375×812 gần như không khác (viền, hàng rào, bóng mèo vẫn nét).
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = 'room-canvas';
  const scene = new THREE.Scene();  physicalLook(renderer, scene); globalThis.__DEBUG_SCENE = scene; // TEMP-DEBUG
  const FOV = TOON ? TOON_FOV : 34;
  // Đổi FOV thì lùi camera theo tỉ lệ tan(fov/2) để phòng vẫn chiếm đúng khung hình như góc 34° gốc.
  const pullBack = Math.tan(THREE.MathUtils.degToRad(17)) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  // Camera canh cho phòng 6 × 6 m gốc; phòng rộng hơn (ROOM_HALF) thì lùi xa theo cùng tỉ lệ để vẫn thấy trọn khu.
  const reach = pullBack * HALF / 3;
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 100 * reach);
  // Toon: nhìn cao hơn (~40° thay vì ~32°) như góc isometric của Cats & Soup, bớt thấy chiều sâu.
  const HOME_VIEW = (TOON ? new THREE.Vector3(7.2, 9.4, 7.2) : new THREE.Vector3(7.9, 7.1, 7.9)).multiplyScalar(reach);
  camera.position.copy(HOME_VIEW);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .8, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  // Độ trôi khi thả tay: OrbitControls giảm theo TỪNG KHUNG HÌNH, máy chạy không đều (16 / 33 ms xen kẽ) thì camera trôi giật cục.
  // frame() quy đổi lại theo thời gian thật mỗi khung (DAMPING = mức giảm của một khung 60 fps).
  const DAMPING = .06;
  controls.minDistance = 9 * reach; controls.maxDistance = 18 * reach;
  controls.minPolarAngle = .45; controls.maxPolarAngle = 1.22;
  controls.autoRotateSpeed = .7;
  // Độ nhạy cử chỉ (1 = mặc định của OrbitControls): kéo trượt, zoom (chụm / lăn chuột), xoay (kéo chuột phải / vặn 2 ngón).
  const SENS = { pan: 1.6, zoom: 1.7, rotate: 1.7, twist: 1.6 };
  controls.zoomSpeed = SENS.zoom; controls.rotateSpeed = SENS.rotate;
  controls.screenSpacePanning = false; // kéo = trượt trên mặt sàn, không bay lên xuống
  controls.update();
  // Hai kiểu điều khiển:
  //   hub  (Home): kéo 1 ngón (ở đâu cũng vậy) = trượt camera (trái/phải, xa/gần);
  //                vặn 2 ngón = xoay cả khu nhà quanh tâm nhìn (trackTouch); chuột: kéo chuột phải = xoay;
  //                góc nhìn từ trên xuống cố định (không kéo lên cao / xuống thấp được);
  //                chụm 2 ngón = zoom: phóng to vào chỗ đang chụm, thu nhỏ thì trôi dần về giữa khu nhà.
  //   room (Deco): khoá vào khu đang trang trí, kéo = xoay quanh phòng, chụm = zoom
  // HUB_MIN: Home cho zoom sát gấp đôi Deco (9) để ngắm mèo / đồ đạc cận cảnh.
  const HUB_POLAR = Math.acos(HOME_VIEW.y / HOME_VIEW.length()), HUB_MAX = 30 * reach, HUB_MIN = 4.5 * reach;
  // Trường mẫu giáo ở bên kia đường: khu nhà dài gần gấp đôi, cho thu nhỏ xa hơn để thấy trọn nhà + trường.
  const KINDER_REACH = 1.7;
  const hubMax = () => HUB_MAX * (opened.kinder ? KINDER_REACH : 1);
  let hub = false;
  // decoMode: đang ở màn Deco (khoá vào khu đang trang trí, chạm món để đổi, đồ cố định bỏ viền...). Camera Deco điều khiển
  // giống hệt Home (hub: kéo = trượt, vặn 2 ngón = xoay, chụm = zoom) — hai thứ tách riêng.
  let decoMode = false;
  function setMode(mode) {
    hub = mode === 'hub';
    controls.enablePan = hub;
    controls.zoomToCursor = hub;
    controls.minPolarAngle = hub ? HUB_POLAR : .45; controls.maxPolarAngle = hub ? HUB_POLAR : 1.22;
    controls.touches = { ONE: hub ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.mouseButtons = { LEFT: hub ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.maxDistance = hub ? hubMax() :18 * reach * zoneReach(zoneId);
    controls.minDistance = (hub ? HUB_MIN : 9 * reach);
  }
  // Deco: vườn đã mở rộng dài gấp đôi nên lùi camera xa hơn (và cho thu nhỏ xa hơn) để thấy trọn cả vườn.
  const WIDE = 1.4;
  const zoneReach = zone => (zone === 'garden' && expanded) || zone === 'backyard' || zone === 'kinder' ? WIDE : 1;
  // Giữ tâm nhìn trong khu nhà (các khu đã mở) khi kéo ở Home.
  const panBox = new THREE.Box3(), tmpCenter = new THREE.Vector3(), clampDelta = new THREE.Vector3(), itemBox = new THREE.Box3(), tmpGoal = new THREE.Vector3();
  const DECO_OVERSHOOT = 5;
  function clampPan() {
    panBox.makeEmpty();
    openZones().forEach(zone => {
      zoneCenter(zone, tmpCenter);
      // Deco: tâm nhìn được ra hẳn ngoài mép khu (thêm DECO_OVERSHOOT m) — món kê sát tường sau vẫn hạ được xuống thấp để
      // bảng đổi món phía trên không che model. Home giữ khung cũ.
      const edge = decoMode ? HALF + DECO_OVERSHOOT : HALF * .8;
      panBox.expandByPoint(tmpCenter.clone().addScalar(-edge)).expandByPoint(tmpCenter.clone().addScalar(edge));
    });
    const t = controls.target;
    clampDelta.set(THREE.MathUtils.clamp(t.x, panBox.min.x, panBox.max.x) - t.x, 0, THREE.MathUtils.clamp(t.z, panBox.min.z, panBox.max.z) - t.z);
    if (clampDelta.lengthSq()) { t.add(clampDelta); camera.position.add(clampDelta); }
  }
  // Lướt camera (tâm nhìn, độ xa, góc xoay ngang) tới đích bằng lò xo tắt dần tới hạn (SmoothDamp) hai tầng, không theo thời gian
  // cố định: "điểm ngắm" đuổi theo đích, camera đuổi theo điểm ngắm. Một tầng thì cú lướt bắt đầu bằng gia tốc lớn nhất (giật nhẹ
  // ở đầu); hai tầng cho đường cong chữ S: tăng tốc mềm, đậu êm. Vận tốc được giữ khi đổi đích giữa chừng (chạm món khác lúc đang
  // lướt, bảng đổi món cần trượt bù...) nên không khựng, không quay ngược; không phụ thuộc tốc độ khung hình. Một bộ duy nhất cho
  // cả lướt + xoay + zoom (trước đây là hai hoạt ảnh thời gian cố định chạy chồng nhau, giằng co với quán tính của OrbitControls).
  const GLIDE_KEYS = ['x', 'y', 'z', 'r', 'th'];
  const glide = { active: false, smooth: .22, goal: {}, aim: {}, vAim: {}, vCur: {} };
  // Unity SmoothDamp cho một số: trả về giá trị mới, vận tốc ghi vào box[key].
  function smoothDamp(current, goal, box, key, smooth, dt) {
    const omega = 2 / smooth, x = omega * dt, exp = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
    const change = current - goal, temp = (box[key] + omega * change) * dt;
    box[key] = (box[key] - omega * temp) * exp;
    return goal + (change + temp) * exp;
  }
  // Bỏ quán tính đang trôi của OrbitControls (thả tay khi đang kéo / chụm) để nó không đẩy ngược cú lướt.
  function stopInertia() {
    controls._sphericalDelta?.set(0, 0, 0);
    controls._panOffset?.set(0, 0, 0);
    if ('_scale' in controls) controls._scale = 1;
  }
  function stopGlide() {
    glide.active = false;
    glide.goal = {};
  }
  // Giá trị hiện tại của từng trục camera (tâm nhìn x / y / z, độ xa r, góc xoay ngang th).
  function cameraNow(key) {
    if (key === 'x' || key === 'y' || key === 'z') return controls.target[key];
    spherical.setFromVector3(camDir.subVectors(camera.position, controls.target));
    return key === 'r' ? spherical.radius : spherical.theta;
  }
  // Đặt đích cho một trục; trục chưa chạy thì điểm ngắm xuất phát đúng chỗ camera, vận tốc 0 (đang chạy thì giữ nguyên đà).
  function setGoal(key, value) {
    if (!(key in glide.goal)) { glide.aim[key] = cameraNow(key); glide.vAim[key] = 0; glide.vCur[key] = 0; }
    glide.goal[key] = value;
  }
  // Cú lướt mới (camera đang đứng yên) đợi một khung: khung ngay sau cú chạm thường nặng (món vừa hiện, bảng / thẻ vẽ lại),
  // để nó trôi qua lúc camera còn đứng yên thì chuyển động nhìn thấy bắt đầu đều, không khựng ở bước đầu.
  function startGlide(ms) {
    if (!glide.active) glide.hold = 1;
    glide.active = true;
    glide.smooth = ms / 3200;
    stopInertia();
  }
  // `radius`: độ xa camera lúc tới nơi (bỏ trống = giữ nguyên). `ms`: độ dài cảm nhận của cú lướt (≈ thời gian tới gần đích).
  function glideTo(to, ms = 700, radius) {
    startGlide(ms);
    const goal = clampGoal(tmpGlide.copy(to));
    setGoal('x', goal.x); setGoal('y', goal.y); setGoal('z', goal.z);
    if (radius != null) setGoal('r', radius);
  }
  // Xoay ngang tới góc `to` (rad) theo đường ngắn nhất, cùng nhịp với cú lướt.
  // Góc đọc từ camera (spherical.theta) luôn bị gói về (−π, π], còn đích / điểm ngắm thì liền mạch (có thể vượt π). Mọi so sánh
  // phải quy về cùng một vòng (wrapPi), nếu không thì khi camera quay qua mốc ±π (món ở nửa trước khu: gốc cây → đèn lồng...)
  // góc đọc được nhảy 2π, lò xo tưởng còn cách đích gần một vòng nên quay mãi không dừng.
  const wrapPi = a => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  function turnToward(to) {
    startGlide(glide.active ? glide.smooth * 3200 : 700);
    // Đang xoay dở: lấy điểm ngắm hiện tại làm mốc (cùng vòng với nó), không lấy góc đọc từ camera (có thể lệch 2π).
    const from = 'th' in glide.goal ? glide.aim.th : cameraNow('th');
    setGoal('th', from + wrapPi(to - from));
  }
  // Đích của cú lướt cũng nằm trong khung kéo được (clampPan): không thì tới gần mép, clampPan kéo ngược lại mỗi khung -> rung.
  const tmpGlide = new THREE.Vector3();
  function clampGoal(p) {
    if (!hub) return p;
    panBox.makeEmpty();
    openZones().forEach(zone => {
      zoneCenter(zone, tmpCenter);
      const edge = decoMode ? HALF + DECO_OVERSHOOT : HALF * .8;
      panBox.expandByPoint(tmpCenter.clone().addScalar(-edge)).expandByPoint(tmpCenter.clone().addScalar(edge));
    });
    p.x = THREE.MathUtils.clamp(p.x, panBox.min.x, panBox.max.x);
    p.z = THREE.MathUtils.clamp(p.z, panBox.min.z, panBox.max.z);
    return p;
  }
  function stepGlide(dt) {
    if (!glide.active) return;
    if (glide.hold > 0) { glide.hold--; return; }
    const half = glide.smooth * .5, t = controls.target;
    spherical.setFromVector3(camDir.subVectors(camera.position, t));
    const cur = { x: t.x, y: t.y, z: t.z, r: spherical.radius, th: spherical.theta };
    // Góc camera về cùng vòng với điểm ngắm (xem wrapPi ở turnToward).
    if ('th' in glide.goal) cur.th = glide.aim.th + wrapPi(cur.th - glide.aim.th);
    let settled = true;
    for (const key of GLIDE_KEYS) {
      if (!(key in glide.goal)) continue;
      // Xoay ngang chậm hơn chút so với trượt: quay góc lớn trên vòng xa trông nhanh hơn trượt cùng thời gian.
      const smooth = key === 'th' ? half * 1.15 : half;
      glide.aim[key] = smoothDamp(glide.aim[key], glide.goal[key], glide.vAim, key, smooth, dt);
      cur[key] = smoothDamp(cur[key], glide.aim[key], glide.vCur, key, smooth, dt);
      const eps = key === 'th' ? 1e-4 : 1e-3;
      if (Math.abs(cur[key] - glide.goal[key]) > eps || Math.abs(glide.vCur[key]) > eps || Math.abs(glide.vAim[key]) > eps) settled = false;
    }
    if (settled) for (const key of Object.keys(glide.goal)) cur[key] = glide.goal[key];
    t.set(cur.x, cur.y, cur.z);
    spherical.radius = cur.r; spherical.theta = cur.th;
    camera.position.setFromSpherical(spherical).add(t);
    if (settled) stopGlide();
  }

  const hemi = new THREE.HemisphereLight('#fff8e8', '#e0b98a', 1.15 * (TOON ? TOON_LIGHT.hemi : 1));
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 1.7 * (TOON ? TOON_LIGHT.sun : 1));
  const SUN_FROM = new THREE.Vector3(4, 9, 5); // hướng nắng; aimSun() dời theo tâm khu nhà
  sun.position.copy(SUN_FROM);
  scene.add(sun.target);
  sun.castShadow = true;
  // Vùng bóng đổ phủ cả vườn lẫn phòng khách (±9 cho phòng 6 m, nới theo ROOM_HALF); map 2048.
  // Đủ phủ cả khu nhà khi mở hết (vườn mở rộng dài sang phải + phòng ngủ chéo trái-sau): khung cũ 10.5 bị hụt, lùi camera ra
  // thấy vệt cắt chéo nửa sáng nửa tối trên nền vườn (mép khung bóng). Nới khung thì tăng mapSize để bóng vẫn nét.
  const SHADOW_SPAN = 16 * HALF / 3;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -SHADOW_SPAN, right: SHADOW_SPAN, top: SHADOW_SPAN, bottom: -SHADOW_SPAN, near: 1, far: 40 });
  sun.shadow.bias = -.0015;
  // Bản đồ bóng 4096² vẽ lại cả trăm khối mỗi khung là phần nặng nhất của cảnh (lag khi zoom xa, thấy hết mọi thứ). Bóng chỉ cần
  // cập nhật tối đa ~30 lần / giây (mèo đi chậm, camera xoay không đổi bóng): autoUpdate tắt, frame() tự bật needsUpdate theo thời gian.
  sun.shadow.autoUpdate = false;
  const SHADOW_STEP_MS = 30;
  let lastShadowAt = -1e9;
  sun.shadow.camera.layers.enable(SHADOW_ONLY_LAYER); // vật chỉ đổ bóng, không hiện (hiện chưa có)
  if (TOON) sun.shadow.intensity = TOON_LIGHT.shadow; // bóng đổ nhạt, không đen đặc
  // Đẩy điểm so bóng theo pháp tuyến: mặt đứng gần song song tia nắng (vách nhà mèo, tủ...) không bị sọc "shadow acne".
  // Toon chia nấc gắt nên sọc lộ rõ hơn PCFSoft cũ, vì vậy cần normalBias.
  sun.shadow.normalBias = .08; // thử thực tế: .05 vẫn còn sọc mờ trên vách nhà mèo, .08 sạch mà bóng mèo trên sàn vẫn dính chân
  scene.add(sun);

  // ---------- Khu nhà: vườn + phòng khách + phòng ngủ + bếp nối liền (room-layout.mjs ZONE_OFFSET) ----------
  // `site` chứa mọi khu, tâm vườn ở gốc toạ độ; mỗi phòng lệch ZONE_OFFSET[khu]. Mèo (room-cats.mjs) đi lại
  // tự do giữa các khu theo đúng toạ độ này, qua các cửa nối (LINKS).
  const site = new THREE.Group();
  // Đồ trang trí cố định (không đổi được: tủ thấp, tranh, rèm, bụi góc vườn, đá / hoa phần vườn mở rộng...): ở Deco thì bỏ viền
  // (stroke) để đồ đạc đổi được nổi bật hẳn lên. Home vẫn giữ viền như cũ. Xem frame().
  const fixedDecor = [];
  let fixedOutlineHidden = false;
  const garden = new THREE.Group();
  site.add(garden);
  scene.add(site);
  // Môi trường: bỏ trời / mây, quanh khu nhà là bãi cỏ có hoa, cây, bụi cùng phong cách Home (meadow.mjs); sương + nền cùng màu trời xanh của Home.
  // Trường mẫu giáo nằm bên kia đường: không tính vào khung khu nhà (đường chạy sát vườn), chỉ là chỗ trống không rải cây.
  const houseZones = Object.entries(ZONE_OFFSET).filter(([zone]) => !zone.startsWith('kinder')).map(([, o]) => o);
  const zoneXs = houseZones.map(o => o[0]), zoneZs = houseZones.map(o => o[1]), kb = kinderBounds(), [kx, kz] = ZONE_OFFSET.kinder;
  const meadow = buildMeadow({ x0: Math.min(...zoneXs) - HALF, x1: Math.max(...zoneXs) + HALF, z0: Math.min(...zoneZs) - HALF, z1: Math.max(...zoneZs) + HALF },
    [{ x0: kx + kb.x0, x1: kx + kb.x1, z0: kz + kb.z0, z1: kz + kb.z1 }]);
  scene.add(meadow.root);
  scene.fog = meadow.fog; scene.background = meadow.background;
  // Không còn bệ diorama (đế kem) dưới các khu: khu nhà nằm thẳng trên bãi cỏ (meadow.mjs, mặt đất ở y -.31 = đáy khối nền).

  const groundMat = Object.assign(mat('#9fd46a', { roughness: .95, smooth: true }), FLOOR_OFFSET), soil = mat('#8a6a45');
  const ground = at(mesh(new THREE.BoxGeometry(HALF * 2, .3, HALF * 2), soil), 0, -.15, 0);
  ground.material = [soil, soil, groundMat, soil, soil, soil];
  // Vườn mở rộng: MỘT mảnh nền dài (16 × 8) thay cho nền vuông; texture cỏ lặp 2 lần theo chiều dài (không kéo giãn).
  const longGeo = new THREE.BoxGeometry(HALF * 2 + GARDEN_EXT_X, .3, HALF * 2), longUv = longGeo.attributes.uv;
  for (let i = 8; i < 12; i++) longUv.setX(i, longUv.getX(i) * 2); // 4 đỉnh mặt trên (+y) của BoxGeometry: chỉ số 8..11
  const groundLong = at(mesh(longGeo, soil), GARDEN_EXT_X / 2, -.15, 0);
  groundLong.material = [soil, soil, groundMat, soil, soil, soil];
  const cornersSquare = gardenCorners(gardenBounds(false)), cornersLong = gardenCorners(gardenBounds(true));
  // Thảm chùi chân trước cổng vườn (chỉ hiện khi đã có phòng khách); phẳng nên mèo đi qua được.
  const doormat = group(at(rbox(.9, .03, .42, .015, '#c9955e'), 0, .015, 0), at(box(.7, .04, .26, '#e8617f'), 0, .02, 0));
  doormat.position.set(DOOR.x, 0, -HALF + .3);
  doormat.traverse(node => { node.castShadow = false; node.userData.noOutline = true; }); // thảm chùi chân: không viền
  garden.add(ground, groundLong, cornersSquare, cornersLong, doormat);
  cornersSquare.userData.structure = cornersLong.userData.structure = true; // góc vườn là kết cấu: không viền (toon.mjs isStructure)
  fixedDecor.push(cornersSquare, cornersLong);
  // Deco: chạm nền cỏ / sàn = đổi nền, chạm rào / tường = đổi rào (slotAt). Đồi + đồ trang trí phần mở rộng tính là nền.
  [ground, groundLong].forEach(node => { node.userData.pickSurface = { zone: 'garden', key: 'floors' }; });
  // Phần vườn mở rộng (toạ độ vườn, x ≈ 4..12): đồi (cùng texture nền cỏ) + đồ trang trí cố định (lối đá, bóng mây...).
  // Chung nền + hàng rào với vườn; bệ diorama nối dài thêm một ô.
  const gardenExt = new THREE.Group();
  garden.add(gardenExt);
  const hillMat = mat('#9fd46a', { roughness: .95, smooth: true }); // smooth: nền + đồi chiếu sáng liên tục, không chia nấc (toon.mjs)
  // Màu nhân lên texture nền vườn (cỏ / lối đá): theo ambient (LIGHTING.grass) — texture cỏ rất tươi, không nhân thì ban đêm vẫn xanh neon.
  const grassTint = new THREE.Color('#cecdb6');
  const decor2 = garden2Decor();
  gardenExt.add(buildHill(hillMat), decor2);
  fixedDecor.push(decor2);
  // Sân sau (bể bơi + vườn rau): một mảnh nền dài sau phòng khách + bếp (toạ độ khu backyard, backyardBounds), rào hai cạnh ngoài,
  // lối đá từ cửa phòng tắm. Nền / rào đổi theo món đang dùng của khu (apply()). Ẩn tới khi mở khu.
  const yard = new THREE.Group(), yb = backyardBounds();
  yard.position.set(ZONE_OFFSET.backyard[0], 0, ZONE_OFFSET.backyard[1]);
  site.add(yard);
  const yardMat = Object.assign(mat('#9fd46a', { roughness: .95, smooth: true }), FLOOR_OFFSET);
  const yardGeo = new THREE.BoxGeometry(yb.x1 - yb.x0, .3, yb.z1 - yb.z0), yardUv = yardGeo.attributes.uv;
  for (let i = 8; i < 12; i++) yardUv.setX(i, yardUv.getX(i) * 2); // texture cỏ lặp 2 lần theo chiều dài (mặt trên +y: đỉnh 8..11)
  const yardGround = at(mesh(yardGeo, soil), (yb.x0 + yb.x1) / 2, -.15, (yb.z0 + yb.z1) / 2);
  yardGround.material = [soil, soil, yardMat, soil, soil, soil];
  yardGround.userData.pickSurface = { zone: 'backyard', key: 'floors' };
  const yardDecor = backyardDecor();
  yard.add(yardGround, yardDecor);
  fixedDecor.push(yardDecor);
  let yardFence = null, yardFenceId = '', yardGroundId = '', yardPatio = null;
  // Trường mẫu giáo (bên kia đường): mảnh nền chữ nhật như sân sau (kinderBounds), rào bao quanh có cổng trước (x = KINDER_GATE_X),
  // lớp học hở mái + lối qua đường nâng (kinderDecor). Ẩn tới khi mở khu.
  const kid = new THREE.Group(), kb2 = kinderBounds();
  kid.position.set(ZONE_OFFSET.kinder[0], 0, ZONE_OFFSET.kinder[1]);
  site.add(kid);
  const kidMat = Object.assign(mat('#9fd46a', { roughness: .95, smooth: true }), FLOOR_OFFSET);
  const kidGeo = new THREE.BoxGeometry(kb2.x1 - kb2.x0, .3, kb2.z1 - kb2.z0), kidUv = kidGeo.attributes.uv;
  for (let i = 8; i < 12; i++) kidUv.setX(i, kidUv.getX(i) * 2);
  const kidGround = at(mesh(kidGeo, soil), (kb2.x0 + kb2.x1) / 2, -.15, (kb2.z0 + kb2.z1) / 2);
  kidGround.material = [soil, soil, kidMat, soil, soil, soil];
  kidGround.userData.pickSurface = { zone: 'kinder', key: 'floors' };
  const kidDecor = kinderDecor();
  kidDecor.userData.structure = true; // sàn lớp, tường lớp, lối qua đường: kết cấu, không viền
  kid.add(kidGround, kidDecor);
  fixedDecor.push(kidDecor);
  let kidFence = null, kidFenceId = '', kidGroundId = '';
  // Vườn hoa: quà miễn phí khi đã mở hết mọi khu (và vườn mở rộng). Ẩn tới lúc đó; lần đầu hiện thì mọc lên (revealPending 'flower').
  // Ngoại thất nhà (house-exterior.mjs): zoom ra gần hết cỡ (quá EXTERIOR_AT × tầm xa tối đa) thì vỏ nhà (tường, cửa sổ + MỘT mái lớn)
  // hiện dần (fade in) phủ các phòng đã mở; zoom vào thì mờ dần (fade out) thấy nội thất. Không hiện khi đang soi món (framing).
  const exterior = buildHouseExterior(), EXTERIOR_AT = .9, houseShell = new THREE.Group();
  let exteriorK = 0, roofKey = '', roofGroup = null, shellMats = [];
  for (const [zone, part] of Object.entries(exterior)) { part.position.set(ZONE_OFFSET[zone][0], 0, ZONE_OFFSET[zone][1]); houseShell.add(part); }
  houseShell.visible = false;
  site.add(houseShell);
  // Độ hiện k (0..1): vật liệu trong suốt theo k khi đang chuyển, đục hẳn ở k = 1 (lúc đó mới có viền toon: viền chỉ dành cho khối đục).
  function fadeShell(k) {
    const key = [...ROOM_ZONES, 'kinder'].filter(z => opened[z]).join();
    if (key !== roofKey) {
      roofKey = key;
      if (roofGroup) houseShell.remove(roofGroup);
      houseShell.add(roofGroup = buildRoof(key.split(','), ZONE_OFFSET));
      shellMats = [];
      houseShell.traverse(node => {
        // vỏ nhà chỉ đổ bóng khi đục hẳn (coverRooms): bóng không mờ dần được, đổ bóng lúc đang mờ thì bóng mái hiện / mất phụt
        if (node.isMesh) node.castShadow = roofCovers && !node.userData.outline;
        // vẽ sau mọi vật trong suốt khác (viền, tường mờ): vỏ ghi depth trước thì tường mờ bên dưới mất từng mẩu, vẽ sau thì viền đè lên mái
        if (node.isMesh) node.renderOrder = 10;
        // luôn trong suốt (đục ở opacity 1): đổi transparent giữa chừng bắt dịch lại shader -> khựng ngay lúc mờ / hiện xong
        if (node.isMesh && !node.userData.outline) for (const m of [].concat(node.material)) if (!shellMats.includes(m)) { m.transparent = true; m.needsUpdate = true; shellMats.push(m); }
      });
    }
    for (const [zone, part] of Object.entries(exterior)) part.visible = opened[zone];
    houseShell.visible = k > .01;
    const solid = k > .995, eased = k * k * (3 - 2 * k);
    for (const m of shellMats) m.opacity = solid ? 1 : eased;
    houseShell.traverse(node => { if (node.userData.outline) node.visible = solid; });
    if (solid !== roofCovers) coverRooms(solid);
  }
  // Mái đục hẳn che kín các phòng: tạm gỡ nội thất (phòng + đồ trong phòng) khỏi mọi lượt vẽ (layers.mask = 0, nhớ mask cũ). Zoom ra xa
  // thì vẽ cả khu nhà lẫn nội thất bên dưới mái từng ~6.800 lệnh vẽ / khung (~30 FPS); gỡ đi thì vỏ nhà đổ bóng thay (lúc đục, không mờ dần).
  let roofCovers = false;
  function coverRooms(on) {
    roofCovers = on;
    const roots = [...ROOM_ZONES.filter(z => opened[z]).map(z => interiors[z].room),
      ...Object.values(furniture).filter(node => ROOM_ZONES.includes(itemById(node.userData.itemId)?.zone))];
    for (const root of roots) root.traverse(node => {
      if (on) { node.userData.roofMask ??= node.layers.mask; node.layers.mask = 0; }
      else if (node.userData.roofMask !== undefined) { node.layers.mask = node.userData.roofMask; delete node.userData.roofMask; }
    });
    houseShell.traverse(node => { if (node.isMesh && !node.userData.outline) node.castShadow = on; });
  }
  const bloom = buildFlowerGarden(), GIFT_DELAY = 1800;
  let giftPending = false;
  // Vật cản trong vườn hoa (luống, bụi, ghế...) theo toạ độ khu nhà: mèo dạo lối đá / bãi cỏ, không giẫm luống.
  const FLOWER_BLOCK = flowerObstacles().map(({ x, z, r }, i) => ({ id: `flowerbed${i}`, x: x + FLOWER_OFFSET[0], z: z + FLOWER_OFFSET[1], r }));
  // Quà vườn hoa: camera lướt tới mảnh vườn, vườn mọc lên (grow) + pháo hoa mở khu.
  function revealGift() {
    if (!giftPending || bloom.visible) return;
    giftPending = false;
    bloom.visible = true;
    bloom.userData.grow = 0;
    glideTo(new THREE.Vector3(FLOWER_OFFSET[0], .8, FLOWER_OFFSET[1]), 1200);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) decoFx.burst('open', fxBase.set(FLOWER_OFFSET[0], 0, FLOWER_OFFSET[1]), 2.5, HALF * 2);
  }
  bloom.position.set(FLOWER_OFFSET[0], 0, FLOWER_OFFSET[1]);
  bloom.visible = false;
  site.add(bloom);
  fixedDecor.push(bloom);
  gardenExt.userData.pickSurface = { zone: 'garden', key: 'floors' };
  const butterflies2 = makeButterflies(garden);
  const sunCenter = new THREE.Vector3();
  let expanded = false;
  let fence = null, fenceKey = '', groundId = '';
  const groundTextures = {};
  const butterflies = makeButterflies(garden);
  const flowerCenter = new THREE.Vector3();

  // ---------- Phòng trong nhà: sàn + 4 bức tường (cửa ra vào, cửa sổ vòm) + đồ trang trí cố định ----------
  // 4 bức tường; `normal` hướng vào trong phòng. Tường nào camera đứng sau thì mờ đi (xem frame()).
  // Toạ độ cục bộ của tường: u = trục ngang, mặt hướng vào phòng là +z.
  //   0 = tường sau (u = x phòng), 1 = tường trước (u = -x), 2 = tường trái (u = -z), 3 = tường phải (u = z).
  // Tường có cửa: khi mờ đi vẫn để lại chân tường thấp (`stub`) để thấy ranh giới + ô cửa.
  const WALL_W = HALF * 2 + .4;
  const WALL_DEFS = [
    { normal: new THREE.Vector3(0, 0, 1), pos: [0, -HALF - .1], rot: 0 },
    { normal: new THREE.Vector3(0, 0, -1), pos: [0, HALF + .1], rot: Math.PI },
    { normal: new THREE.Vector3(1, 0, 0), pos: [-HALF - .1, 0], rot: Math.PI / 2 },
    { normal: new THREE.Vector3(-1, 0, 0), pos: [HALF + .1, 0], rot: -Math.PI / 2 },
  ];
  const windowGlass = [];
  // Cửa sổ của phòng: spec.windows = [{ wall (chỉ số tường), u, w, y0, y1, sill }]. Mặc định cửa sổ tường sau rộng 1.2, cao .95 → 2.45
  // (rèm / đồ trang trí tường bám theo cửa sổ dùng cùng số đo).
  const WIN = { w: 1.2, y0: .95, y1: 2.45 };
  const windowsOf = (spec, i) => (spec.windows || []).filter(w => w.wall === i).map(w => ({ ...WIN, ...w }));
  // Cánh cửa bản lề ở một mép ô cửa. swing = 1: bản lề mép b, mở hé vào phòng nằm dọc tường về phía +u;
  // swing = -1: bản lề mép a, mở về phía -u (chọn phía không có đồ kê sát tường). Đóng: nằm gọn trong ô cửa.
  function setLeaf(leaf, open) {
    const swing = leaf.userData.swing;
    leaf.position.set(leaf.userData.hinge, 0, open ? .16 : 0);
    leaf.rotation.y = swing > 0 ? (open ? Math.PI - .4 : 0) : (open ? .4 : Math.PI);
  }
  // spec: { doors: { [chỉ số tường]: { u, leaf, swing, threshold } }, windows (xem windowsOf), decorate(i, wall), decor() }
  function buildInterior(zone, spec) {
    const room = new THREE.Group();
    room.position.set(ZONE_OFFSET[zone][0], 0, ZONE_OFFSET[zone][1]);
    site.add(room);
    const floorMat = Object.assign(mat('#e4b574', { roughness: .9 }), FLOOR_OFFSET); // sàn lùi theo độ dốc: viền chân đồ không chập chờn
    const edge = mat('#c79a5f');
    const floor = at(mesh(new THREE.BoxGeometry(HALF * 2, .3, HALF * 2), edge), 0, -.15, 0);
    floor.material = [edge, edge, floorMat, edge, edge, edge]; // mặt trên (+y) là sàn
    const decor = spec.decor();
    room.add(floor, decor);
    fixedDecor.push(decor);
    floor.userData.pickSurface = { zone, key: 'floors' };
    const wallMats = [], stubs = [], leaves = {};
    const walls = WALL_DEFS.map(({ normal, pos, rot }, i) => {
      const wallMat = mat('#fff1d2', { transparent: true });
      wallMats.push(wallMat);
      const trim = mat('#ffffff', { transparent: true });
      const door = spec.doors[i];
      let wall;
      if (door) {
        const a = door.u - DOOR.w / 2, b = door.u + DOOR.w / 2, E = WALL_W / 2;
        const piece = (x0, x1, y0, y1, m, depth = .2, z = 0) => at(mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, depth), m), (x0 + x1) / 2, (y0 + y1) / 2, z);
        const frame = mat('#f6d88f', { transparent: true }), wood = mat('#c98a55', { transparent: true });
        // Cửa phòng này đối diện đúng cửa phòng bên cạnh (cùng u, tường giáp nhau): khung cửa hai bên chồng lên nhau, mọi mặt trùng phẳng -> chớp sọc.
        // Phòng không có bậc cửa (bên kia) làm khung nhỏ hơn 6 mm mỗi phía để mặt khung nằm gọn trong khung phòng chính.
        const k = door.threshold ? 0 : .006;
        wall = group(piece(-E, a, 0, WALL_H, wallMat), piece(b, E, 0, WALL_H, wallMat), piece(a, b, DOOR.h, WALL_H, wallMat),
          piece(-E, a, 0, .2, trim, .08, .13), piece(b, E, 0, .2, trim, .08, .13),
          // Khung nhô .02 vào lòng cửa: mặt trong khung nằm trước mép tường, không trùng mặt phẳng (trùng thì hai màu chớp giật).
          piece(a - .1 + k, a + .02 - k, 0, DOOR.h + .1 - k, frame, .28 - 2 * k), piece(b - .02 + k, b + .1 - k, 0, DOOR.h + .1 - k, frame, .28 - 2 * k), piece(a - .1 + k, b + .1 - k, DOOR.h - .02 + k, DOOR.h + .1 - k, frame, .28 - 2 * k));
        if (door.leaf) {
          const leaf = group(at(mesh(roundedBox(DOOR.w - .08, DOOR.h - .06, .07, ROUND, .02), wood), -DOOR.w / 2, DOOR.h / 2, 0),
            at(mesh(new THREE.SphereGeometry(.045, 12, 8), mat('#ffd66b', { transparent: true })), -DOOR.w + .14, 1, .05));
          leaf.userData.swing = door.swing ?? 1;
          leaf.userData.hinge = leaf.userData.swing > 0 ? b - .02 : a + .02;
          leaves[i] = leaf;
          setLeaf(leaf, true);
        }
        const stubMat = mat('#fff1d2');
        stubs.push(stubMat);
        const stub = group(piece(-E, a, 0, .32, stubMat), piece(b, E, 0, .32, stubMat), piece(a - .1 + k, a + .02 - k, 0, .36 - k, mat('#f6d88f'), .28 - 2 * k), piece(b - .02 + k, b + .1 - k, 0, .36 - k, mat('#f6d88f'), .28 - 2 * k));
        stub.position.set(pos[0], 0, pos[1]);
        stub.rotation.y = rot;
        stub.visible = false;
        stub.traverse(node => { if (node.isMesh) node.castShadow = false; });
        room.add(stub);
        if (door.threshold) { // bậc cửa: nối sàn phòng với sàn bên kia ngay dưới khung cửa (khe giữa hai sàn là bề dày tường)
          const sill = group(at(box(DOOR.w + .1, .3, .32, '#c79a5f'), door.u, -.14, -.06)); // cao hơn sàn .01: không trùng mặt sàn
          sill.position.set(pos[0], 0, pos[1]); sill.rotation.y = rot;
          sill.traverse(node => { node.castShadow = false; });
          room.add(sill);
        }
        wall.userData.stub = stub;
      } else if (windowsOf(spec, i).length) {
        // Cửa sổ THẬT: khoét lỗ trên tường, nhìn xuyên ra ngoài (sân sau / vườn). Khung gỗ dày hơn tường (nhô .03 mỗi mặt, mặt trong
        // khung lùi vào lòng lỗ .02: không trùng mặt phẳng tường -> không chớp), chấn song chữ thập, kính trong mờ giữa bề dày tường,
        // bậu ngoài + bậu trong (win.sill = false: bỏ bậu trong, vd. bếp lấy mặt bàn bồn rửa làm bậu). Một tường chỉ một cửa sổ.
        const win = windowsOf(spec, i)[0], u = win.u, W = win.w, a = u - W / 2, b = u + W / 2, E = WALL_W / 2, y0 = win.y0, y1 = win.y1;
        const piece = (x0, x1, yA, yB, m, depth = .2, z = 0) => at(mesh(new THREE.BoxGeometry(x1 - x0, yB - yA, depth), m), (x0 + x1) / 2, (yA + yB) / 2, z);
        const frame = mat('#f6d88f', { transparent: true }), bar = mat('#fffaf0', { transparent: true });
        const glass = new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide, userData: { wallKeep: true, baseOpacity: .28, noDepth: true } });
        windowGlass.push(glass); // ban đêm: kính tối lại theo cảnh
        const pane = at(new THREE.Mesh(new THREE.PlaneGeometry(W - .02, y1 - y0 - .02), glass), u, (y0 + y1) / 2, 0);
        pane.userData.noOutline = true;
        wall = group(piece(-E, a, 0, WALL_H, wallMat), piece(b, E, 0, WALL_H, wallMat), piece(a, b, 0, y0, wallMat), piece(a, b, y1, WALL_H, wallMat),
          piece(-E, E, 0, .2, trim, .08, .13),
          // khung: 4 thanh bao quanh lỗ, mặt trong lấn vào lòng lỗ .02
          piece(a - .08, a + .02, y0 - .08, y1 + .08, frame, .26), piece(b - .02, b + .08, y0 - .08, y1 + .08, frame, .26),
          piece(a - .08, b + .08, y1 - .02, y1 + .08, frame, .26), piece(a - .08, b + .08, y0 - .08, y0 + .02, frame, .26),
          // chấn song chữ thập (mảnh, nằm trước kính .03)
          piece(u - .025, u + .025, y0, y1, bar, .05, .03), piece(a, b, (y0 + y1) / 2 - .025, (y0 + y1) / 2 + .025, bar, .05, .03),
          // bậu ngoài (phía sân) luôn có; bậu trong trừ bếp
          piece(a - .14, b + .14, y0 - .14, y0 - .06, frame, .14, -.17),
          ...(win.sill !== false ? [piece(a - .14, b + .14, y0 - .1, y0 - .02, frame, .14, .17)] : []), pane);
      } else {
        wall = group(at(mesh(new THREE.BoxGeometry(WALL_W, WALL_H, .2), wallMat), 0, WALL_H / 2, 0),
          at(box(WALL_W, .2, .08, trim), 0, .1, .13));
      }
      // Khối chắn đèn: bản sao mảng tường (không gồm khung cửa / đồ treo), vô hình (không ghi màu / depth), bình thường không đổ
      // bóng; chỉ trong lượt vẽ bóng đèn (castLampShadows) nó là vật chắn DUY NHẤT. Mỏng một nửa tường, nằm giữa lòng tường: mặt
      // tường phía đèn vẫn sáng, mặt bên kia + sàn phòng bên cạnh nằm trong bóng (đèn không còn rọi xuyên tường).
      const casters = group(...wall.children.filter(node => node.isMesh && node.material === wallMat).map(piece => {
        const caster = new THREE.Mesh(piece.geometry.clone(), LAMP_CASTER_MAT);
        caster.position.copy(piece.position);
        caster.scale.z = .5;
        caster.castShadow = caster.receiveShadow = false;
        caster.raycast = () => {}; // không chặn chạm tường / món
        Object.assign(caster.userData, { noOutline: true, lampCaster: true });
        return caster;
      }));
      casters.position.set(pos[0], 0, pos[1]);
      casters.rotation.y = rot;
      room.add(casters); // gắn vào phòng, không vào tường: tường mờ / ẩn khi camera nhìn xuyên thì vẫn chắn đèn
      spec.decorate(i, wall);
      mergeStatic(wall); // mảng tường + khung + đồ treo cùng chất liệu -> ít mesh (độ mờ vẫn chỉnh theo từng chất liệu)
      if (leaves[i]) wall.add(leaves[i]); // cánh cửa cử động theo trạng thái mở khoá: gắn sau khi gộp
      wall.position.set(pos[0], 0, pos[1]);
      wall.rotation.y = rot;
      // Tường trước hướng ra ngoài (vườn): bóng của cối xay / hàng rào / bụi cây ngoài vườn đổ lên mặt ngoài tường -> không nhận bóng.
      wall.traverse(node => { if (node.isMesh) { node.castShadow = false; if (i === 1) node.receiveShadow = false; } });
      Object.assign(wall.userData, { normal, opacity: 1 });
      room.add(wall);
      wall.userData.pickSurface = { zone, key: 'walls' };
      return wall;
    });
    fixedDecor.push(...walls); // tường + đồ treo tường (tranh, kệ, rèm...) gộp chung một khối
    return { zone, room, floorMat, wallMats, stubs, walls, leaves, decor, floorId: '' };
  }
  const INTERIOR_SPECS = {
    // Phòng khách: cửa ra vườn ở tường trước (tường xoay π: x cục bộ = -x phòng nên u = -DOOR.x), cửa sang phòng ngủ
    // ở tường trái (u = -z phòng); cánh cửa này đóng khi phòng ngủ còn khoá và mở về phía góc trước (z +), không đè lên
    // tủ thấp kê sát tường phía sau cửa. Bậc cửa phủ khe giữa hai sàn.
    living: {
      doors: { 1: { u: -DOOR.x, leaf: true, threshold: true }, 2: { u: -BEDROOM_DOOR.z, leaf: true, swing: -1, threshold: true }, 3: { u: KITCHEN_DOOR.z, leaf: true, swing: -1, threshold: true } },
      windows: [{ wall: 0, u: DOOR.x }], decorate: decorateWall, decor: livingDecor,
    },
    // Phòng ngủ: cửa ở tường phải (u = z phòng) tựa lưng vào cửa phòng khách; cánh cửa + bậc cửa đã có bên phòng khách.
    // Cửa sang phòng tắm giữa tường sau (u = x phòng): cánh cửa ở phía phòng ngủ, đóng khi phòng tắm còn khoá, mở về phía bàn máy tính
    // (bên kia là tủ đầu giường).
    bedroom: {
      doors: { 3: { u: BEDROOM_DOOR.z, leaf: false, threshold: false }, 0: { u: BATHROOM_DOOR.x, leaf: true, swing: 1, threshold: true } },
      decorate: decorateBedroomWall, decor: bedroomDecor,
    },
    // Bếp: cửa ở tường trái (u = -z phòng) tựa lưng vào cửa phòng khách; cánh cửa + bậc cửa đã có bên phòng khách.
    kitchen: {
      doors: { 2: { u: -KITCHEN_DOOR.z, leaf: false, threshold: false } },
      // tường trước (mặt ngoài nhìn ra vườn, tường xoay π: u = -x phòng) có thêm cửa sổ nhỏ giữa biển hiệu và đèn lồng
      windows: [{ wall: 0, u: KITCHEN_WINDOW_X, sill: false }, { wall: 1, u: KITCHEN_FRONT_WINDOW_U, w: .7, y0: 1.45, y1: 2.25, sill: false }],
      decorate: decorateKitchenWall, decor: kitchenDecor,
    },
    // Phòng tắm: cửa ở tường trước (tường xoay π: u = -x phòng) tựa lưng vào cửa phòng ngủ; cánh cửa + bậc cửa đã có bên phòng ngủ.
    // Cửa ra sân sau ở tường phải (u = z phòng): cánh cửa mở hé về phía -z (giá khăn đã dời ra xa), đóng khi sân sau còn khoá.
    bathroom: {
      doors: { 1: { u: -BATHROOM_DOOR.x, leaf: false, threshold: false }, 3: { u: BACKYARD_DOOR.z, leaf: true, swing: -1, threshold: true } },
      windows: [{ wall: 0, u: BATHROOM_WINDOW_X }], decorate: decorateBathroomWall, decor: bathroomDecor,
    },
  };
  const interiors = Object.fromEntries(Object.entries(INTERIOR_SPECS).map(([zone, spec]) => [zone, buildInterior(zone, spec)]));

  // Đồ đạc: dựng khi cần lần đầu. `furniture` theo chỗ đặt (slot) — mèo (room-cats.mjs) gọi furniture.pond,
  // furniture.catbed... nên đổi phương án thì dựng lại đúng chỗ đó, mèo vẫn dùng như cũ.
  // Đồ của mọi khu đặt thẳng trong `site` theo toạ độ khu nhà (PLACES + tâm khu) để mèo đọc vị trí trực tiếp.
  const furniture = {};
  function piece(entry) {
    const id = slotOf(entry);
    if (furniture[id] && furniture[id].userData.itemId !== entry.id) {
      const old = furniture[id];
      old.parent?.remove(old);
      old.traverse(node => { if (node.isMesh) { node.geometry.dispose(); [].concat(node.material).forEach(m => m.dispose()); } });
      delete furniture[id];
    }
    if (!furniture[id]) {
      const node = buildItem(entry);
      const [x, z, rot] = PLACES[id];
      const [ox, oz] = ZONE_OFFSET[entry.zone];
      node.position.set(ox + x, 0, oz + z);
      node.rotation.y = rot ?? Math.atan2(-x, -z); // quay mặt vào giữa khu của nó
      node.userData.yaw = node.rotation.y; // brush() nghiêng món đồ quanh chân đế, giữ nguyên hướng quay này
      node.userData.pickSlot = id; // Deco: chạm món = mở bảng đổi món của chỗ này (slotAt)
      node.visible = false;
      node.userData.pop = 1;
      lightUp(node);
      site.add(node);
      furniture[id] = node;
    }
    return furniture[id];
  }
  // Deco: dựng sẵn (ẩn) món sắp được xem thử + tạo viền + biên dịch shader lúc trình duyệt rảnh. Không làm trước thì lần đầu chạm
  // thẻ, khung hình đầu tiên phải dựng model + biên dịch shader (đứng hình 100–400 ms ngay lúc camera bắt đầu lướt).
  const idle = globalThis.requestIdleCallback ?? (fn => setTimeout(() => fn({ timeRemaining: () => 12 }), 40));
  const warmQueue = [];
  let warmPending = false;
  function prewarm(entries) {
    for (const entry of entries) if (!warmQueue.includes(entry)) warmQueue.push(entry);
    if (warmPending || !warmQueue.length) return;
    warmPending = true;
    idle(deadline => {
      warmPending = false;
      while (warmQueue.length && deadline.timeRemaining() > 6) {
        const entry = warmQueue.shift(), current = furniture[slotOf(entry)];
        // Chỗ đang có món hiện trong cảnh, hoặc đã dựng sẵn đúng món này: bỏ qua.
        if (!PLACES[slotOf(entry)] || current?.visible || current?.userData.itemId === entry.id) continue;
        const node = piece(entry);
        addOutlines(node);
        // compileAsync chỉ duyệt vật đang hiện: bật tạm trong lúc gom chất liệu (đồng bộ), biên dịch chạy nền.
        node.visible = true;
        renderer.compileAsync(node, camera, scene).catch(() => {});
        node.visible = false;
      }
      prewarm([]);
    });
  }

  // Ánh sáng môi trường (ambient): dawn (bình minh: nắng hồng thấp phía đông) / day / dusk (buổi chiều) / night. Đêm thì trời tối, nắng thành ánh trăng xanh nhạt, đèn (lồng, đuốc,
  // đèn đứng, máy sưởi) rực hơn, bướm đi ngủ, mèo hay ngủ hơn (room-cats.mjs đọc ctx.night). Chiều: nắng cam thấp, bóng dài, tranh / cờ ngả ấm.
  let night = false, ambient = 'day';
  // Tông viền toon theo ngày / đêm (toon.mjs setOutlineTint): đêm viền tối + ngả xanh theo ánh trăng, không sáng hơn khối nó bao.
  const DAY_INK = new THREE.Color(1, 1, 1), NIGHT_INK = new THREE.Color().setRGB(.42, .46, .66);
  // Tranh / cờ / nước... ban đêm: nhân màu (setRGB nhận giá trị TUYẾN TÍNH, .13 tuyến tính ≈ .4 sRGB) cho tối bằng bề mặt có nhận sáng ở cạnh
  // (tường kem ban đêm ra khoảng sRGB .37 / .39 / .49). Số cũ .38 / .42 / .62 tuyến tính = sRGB .65+ nên tranh sáng hơn tường hẳn.
  const NIGHT_ART = new THREE.Color().setRGB(.13, .14, .23);
  const DAWN_ART = new THREE.Color().setRGB(.8, .72, .76), DAWN_INK = new THREE.Color().setRGB(.8, .76, .86); // bình minh: hồng đào nhạt, hơi lạnh
  const DUSK_ART = new THREE.Color().setRGB(.82, .58, .6), DUSK_INK = new THREE.Color().setRGB(.86, .72, .78); // chiều: ngả cam đào + hồng tím, viền hơi sẫm
  // Tông "chill" (dịu, ấm, ít gắt): ngày là nắng sớm ấm nhẹ — trời kem, nắng bớt gắt cho nấc sáng tối êm hơn; chiều là giờ vàng — ánh
  // đào hồng pha tím (trời hồng, đất hắt tím mận, nắng san hô) thay vì nâu đục; đêm là trăng xanh lam (bớt tím), đèn vàng ấm rực hơn cho cảm giác ấm cúng.
  const LIGHTING = {
    day: { sky: '#fff4e0', ground: '#dcc09a', hemi: 1.18, sun: '#ffefd2', sunI: 1.55, glass: '#d4ecff', lamps: 1, lit: 0, env: .4, grass: '#cecdb6' },
    dawn: { sky: '#ffdccc', ground: '#a29ec0', hemi: .95, sun: '#ffc6a0', sunI: 1.15, glass: '#ffd8cc', lamps: 1.2, lit: .35, env: .24, sunFrom: [-7, 4, 3], grass: '#c4c6bc' },
    dusk: { sky: '#f9bccb', ground: '#9e7aa8', hemi: 1.05, sun: '#ff9f80', sunI: 1.35, glass: '#f3b4d4', lamps: 1.45, lit: 1, env: .28, sunFrom: [7, 4, 3], grass: '#dcc0bc' },
    night: { sky: '#7f9bd2', ground: '#36405c', hemi: .44, sun: '#b4c6ff', sunI: .62, glass: '#22305a', lamps: 2.1, lit: 1, env: .1, grass: '#6e82a4' },
  };
  // Đổi ambient: màu trời / nắng / cỏ / sương / viền / cửa kính / đèn chuyển dần trong AMBIENT_FADE giây (như trời ngả chiều thật),
  // không đổi phụt. Lần đặt đầu (mở game) thì áp ngay.
  const AMBIENT_FADE = 8; // chậm cho dễ thấy trời chuyển (ambient tự đổi theo vòng, settings.js)
  const fade = { k: 1, colors: [], numbers: [] };
  const inkNow = DAY_INK.clone();
  let ambientSet = false;
  function fadeTo(colors, numbers, instant) {
    fade.colors = colors.map(([color, to]) => [color, color.clone(), new THREE.Color(to)]);
    fade.numbers = numbers.map(([obj, key, to]) => [obj, key, obj[key], to]);
    fade.k = instant ? 1 : 0;
    stepFade(0);
  }
  function stepFade(dt) {
    if (fade.k >= 1 && !fade.colors.length) return;
    fade.k = Math.min(1, fade.k + dt / AMBIENT_FADE);
    const e = fade.k * fade.k * (3 - 2 * fade.k);
    for (const [color, from, to] of fade.colors) color.lerpColors(from, to, e);
    for (const [obj, key, from, to] of fade.numbers) obj[key] = from + (to - from) * e;
    aimSun();
    if (fade.k >= 1) fade.colors = fade.numbers = [];
  }
  // Bóng của đèn đồ đạc: three.js lọc vật đổ bóng theo layer của camera CHÍNH (không theo camera bóng), nên không tách được
  // bằng layer. Thay vào đó: khung nào có đèn cần vẽ lại bóng (mới hiện, hoặc dời chỗ — kể cả lúc nảy khi vừa đặt), tạm thời chỉ
  // khối chắn tường được đổ bóng, nắng giữ bản đồ bóng cũ; vẽ xong trả lại như cũ. Đồ đạc / mèo không chắn đèn (chao đèn tự
  // che bóng đèn, bóng mèo đứng yên một chỗ khi mèo đã đi).
  const lampLights = new Set(), lampAt = new THREE.Vector3();
  const onStage = node => { for (let n = node; n; n = n.parent) if (!n.visible) return false; return true; };
  function castLampShadows() {
    // Khung nào nắng cần vẽ lại bóng thì nhường cho nắng: bóng đèn dời sang khung sau (đèn giữ needsUpdate). Không thì đèn "cần vẽ"
    // mỗi khung sẽ chặn bóng nắng mãi, bóng cũ của vật đã đi chỗ khác (mèo...) kẹt lại trên mặt đất.
    // Đèn đang chờ thì tạm tắt cờ trong lượt của nắng: three vẽ mọi bóng có needsUpdate cùng lượt, đèn sẽ lấy vật cản thường
    // (đồ đạc) thay cho khối chắn tường -> ánh đèn xuyên tường (lỗi cũ, hay gặp ngay sau khi đổi ambient).
    if (sun.shadow.needsUpdate) {
      const held = [...lampLights].filter(light => light.shadow.needsUpdate);
      held.forEach(light => { light.shadow.needsUpdate = false; });
      return held.length ? () => held.forEach(light => { light.shadow.needsUpdate = true; }) : null;
    }
    let due = false;
    for (const light of lampLights) {
      if (!light.parent) { lampLights.delete(light); continue; }
      if (!onStage(light)) continue;
      light.getWorldPosition(lampAt);
      if (!light.userData.shadowAt?.equals(lampAt)) light.shadow.needsUpdate = true;
      if (light.shadow.needsUpdate) { due = true; (light.userData.shadowAt ??= new THREE.Vector3()).copy(lampAt); }
    }
    if (!due) return null;
    const flipped = [];
    scene.traverse(node => {
      if (!node.isMesh || node.castShadow === !!node.userData.lampCaster) return;
      flipped.push(node);
      node.castShadow = !node.castShadow;
    });
    // Lượt vẽ bóng đèn đang lật castShadow của mọi vật: bản đồ bóng nắng không được vẽ lại trong lượt này.
    const sunDue = sun.shadow.needsUpdate;
    sun.shadow.needsUpdate = false;
    return () => { for (const node of flipped) node.castShadow = !node.castShadow; sun.shadow.needsUpdate = sunDue; };
  }
  // Tranh / cờ trang trí dùng vật liệu không nhận sáng: ban đêm nhân tông đêm cho khỏi sáng rực như đèn (ảnh thumbnail không đổi:
  // chỉ cảnh chính gọi). Lưu màu gốc lần đầu.
  function nightArt(node) {
    const m = node.material;
    if (!m?.userData?.nightDim) return;
    m.userData.dayColor ??= m.color.clone();
    m.color.copy(m.userData.dayColor);
    if (night) m.color.multiply(NIGHT_ART);
    else if (ambient === 'dusk') m.color.multiply(DUSK_ART);
    else if (ambient === 'dawn') m.color.multiply(DAWN_ART);
  }
  // Chốt chặn cho chế độ đêm: món không phải nguồn sáng mà lỡ có phần phát sáng (emissive / MeshBasicMaterial) thì ban đêm
  // tắt phát sáng / tối lại như tranh treo. QC (qc.mjs glow) vẫn báo lỗi để sửa model cho đúng.
  function dimNonSource(node) {
    let source = !!node.userData.lightSource;
    node.traverse(n => { if (n.isLight || n.userData.lightSource) source = true; });
    if (source) return;
    node.traverse(child => {
      if (!child.isMesh || child.userData.outline) return;
      for (const m of [].concat(child.material)) {
        if (!m || m.colorWrite === false) continue;
        if (m.isMeshBasicMaterial) (m.userData ||= {}).nightDim = true;
        else if (m.emissive && m.emissive.getHex() !== 0) {
          m.userData.dayEmissive ??= m.emissiveIntensity;
          m.emissiveIntensity = night ? 0 : m.userData.dayEmissive;
        }
      }
    });
  }
  function lightUp(node) { // đèn của đồ đạc sáng hơn ban đêm; tranh treo tối lại
    dimNonSource(node);
    // Đèn điện (ELECTRIC_LAMPS) tắt ban ngày, le lói lúc bình minh, bật chiều / đêm: cả ánh sáng lẫn bóng đèn phát sáng (emissive). Lửa thì cháy cả ngày.
    const lit = ELECTRIC_LAMPS.has(node.userData.itemId) ? LIGHTING[ambient].lit : 1;
    node.traverse(child => {
      for (const m of child.isMesh && !child.userData.outline ? [].concat(child.material) : []) {
        if (!m?.emissive || (m.userData.litEmissive ?? m.emissiveIntensity) === 0) continue;
        m.userData.litEmissive ??= m.emissiveIntensity;
        m.emissiveIntensity = m.userData.litEmissive * lit;
      }
    });
    node.traverse(child => {
      nightArt(child);
      if (!child.isPointLight) return;
      // Đèn bị tường chắn: bóng đổ chỉ tính khối chắn tường, vẽ lại khi đèn mới hiện / dời chỗ (castLampShadows), không vẽ
      // mỗi khung. Thiếu bước này đèn đứng phòng khách rọi sáng mặt tường + sàn phòng ngủ.
      if (!child.castShadow) {
        child.castShadow = true;
        child.shadow.mapSize.set(256, 256);
        Object.assign(child.shadow.camera, { near: .05, far: child.distance || 10 });
        child.shadow.bias = -.004;
        child.shadow.autoUpdate = false;
        lampLights.add(child);
      }
      child.shadow.needsUpdate = true;
      child.userData.baseIntensity ??= child.intensity;
      child.intensity = child.userData.baseIntensity * LIGHTING[ambient].lamps * lit;
    });
  }
  function setAmbient(mode) {
    ambient = LIGHTING[mode] ? mode : 'day';
    night = ambient === 'night';
    const look = LIGHTING[ambient], instant = !ambientSet;
    ambientSet = true;
    const [sx, sy, sz] = look.sunFrom || [4, 9, 5];
    // Đèn đồ đạc: lightUp() đặt ngay cường độ đích; giữ lại cường độ đang có rồi cho chạy dần tới đích cùng nhịp với trời.
    const lamps = [];
    Object.values(furniture).forEach(node => node.traverse(child => {
      if (child.isPointLight) lamps.push([child, 'intensity', child.intensity]);
      if (child.isMesh) for (const m of [].concat(child.material)) if (m?.emissive) lamps.push([m, 'emissiveIntensity', m.emissiveIntensity]);
    }));
    butterflies.forEach(b => { b.node.visible = !night; });
    Object.values(furniture).forEach(lightUp);
    scene.traverse(nightArt);
    const lampFades = lamps.filter(([obj, key, now]) => obj[key] !== now).map(([obj, key, now]) => { const to = obj[key]; obj[key] = now; return [obj, key, to]; });
    fadeTo([
      [hemi.color, look.sky], [hemi.groundColor, look.ground], [sun.color, look.sun],
      [grassTint, look.grass], [groundMat.color, look.grass], [yardMat.color, look.grass], [kidMat.color, look.grass], [hillMat.color, look.grass],
      [inkNow, night ? NIGHT_INK : ambient === 'dusk' ? DUSK_INK : ambient === 'dawn' ? DAWN_INK : DAY_INK],
      ...windowGlass.map(m => [m.color, look.glass]),
      ...meadow.ambientTargets(ambient),
    ], [
      [hemi, 'intensity', look.hemi * (TOON ? TOON_LIGHT.hemi : 1)], [sun, 'intensity', look.sunI * (TOON ? TOON_LIGHT.sun : 1)],
      [scene, 'environmentIntensity', look.env], [SUN_FROM, 'x', sx], [SUN_FROM, 'y', sy], [SUN_FROM, 'z', sz],
      ...lampFades,
    ], instant);
  }
  const setNight = on => setAmbient(on ? 'night' : 'day');

  // Mèo: đàn mèo khối 3D có "não" riêng (room-cats.mjs). Tim bay lên khi mèo cụng mũi / liếm lông nhau.
  let container = null;
  const cats = createCatLife({
    scene, furniture, butterflies,
    zones: () => openZones(),
    // Mặt đất (độ cao) tại điểm khu nhà: đồi ở phần vườn mở rộng, còn lại phẳng. Vật cản cố định: đồi (mèo chỉ lên bằng hành vi trèo đồi).
    groundAt: (x, z) => (opened.kinder ? crossingHeight(x, z) : null) ?? (expanded ? groundHeight('garden', x, z) : 0), // lối qua đường sang trường (vạch sang đường / vỉa hè); vườn ở gốc toạ độ: toạ độ vườn = toạ độ khu nhà
    staticObstacles: () => [...(expanded ? [{ id: 'hill', x: HILL.x, z: HILL.z, r: HILL_OBSTACLE_R }] : []), ...(opened.kinder ? CLASSROOM_BLOCK : []), ...(bloom.visible ? FLOWER_BLOCK : [])],
    get night() { return night; },
    get ambient() { return ambient; }, // day / dusk / night: lửa trại chiều tối có mèo quây quần
    heartsAt(position) { symbolAt(position); },
    // Ký hiệu bay lên trên đầu mèo: 💢 khi cáu, ♪ khi kêu meo, … khi bị làm phiền.
    symbolAt(position, symbol, count) { symbolAt(position, symbol, count); },
    cameraPos: () => camera.position,
  });
  function symbolAt(position, symbol = '♥', count = 4) {
    if (!container) return;
    const p = position.clone().project(camera);
    if (p.z > 1) return;
    spawnHearts((p.x + 1) / 2 * container.clientWidth, (1 - p.y) / 2 * container.clientHeight, symbol, count);
  }
  let catKey = '';

  const ROOM_ZONES = Object.keys(interiors);
  const floorTextures = {};
  // zoneId = khu đang trang trí ở Deco (camera Deco khoá vào khu này). opened = các khu đã mở khoá.
  let zoneId = 'garden', applied = false, revealPending = null;
  // Lớp học trường mẫu giáo (kindergarten.mjs CLASSROOM, toạ độ khu nhà): mèo không đi xuyên tường. Chuỗi vật cản tròn sát nhau dọc 4 tường
  // + vài vòng to phủ lòng lớp (freeSpot không chọn chỗ trong lớp, mèo không cố chui vào). Mèo chưa có tương tác với đồ trong lớp.
  const CLASSROOM_BLOCK = (() => {
    const [ox, oz] = ZONE_OFFSET.kinder, C = CLASSROOM, x0 = ox + C.x0 - .12, x1 = ox + C.x1 + .1, z0 = oz + C.z0 - .1, z1 = oz + C.z1 + .1, out = [];
    const line = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / .3); for (let i = 0; i <= n; i++) out.push({ id: 'classroom', x: ax + (bx - ax) * i / n, z: az + (bz - az) * i / n, r: .22 }); };
    line(x0, z0, x1, z0); line(x1, z0, x1, z1); line(x1, z1, x0, z1); line(x0, z1, x0, z0);
    const cz = (z0 + z1) / 2, r = (z1 - z0) / 2;
    for (let x = x0 + r; x < x1; x += r) out.push({ id: 'classroom', x: Math.min(x, x1 - r), z: cz, r: r - .15 });
    return out;
  })();
  const opened = { garden: true, living: false, bedroom: false, kitchen: false, bathroom: false, backyard: false, kinder: false };
  const OPENABLE = ['living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder'];
  const zoneGroup = zone => zone === 'garden2' ? gardenExt : zone === 'backyard' ? yard : zone === 'kinder' ? kid : interiors[zone]?.room; // nhóm "mọc lên" khi vừa mở
  // Các ô đi lại đã mở (mèo, giới hạn kéo camera, tâm khu nhà): vườn mở rộng thêm ô 'garden2' bên phải vườn.
  const openZones = () => [...Object.keys(opened).filter(zone => opened[zone]), ...(expanded ? ['garden2'] : []), ...(opened.backyard ? ['backyard2'] : []), ...(opened.kinder ? ['kinder2'] : []), ...(bloom.visible ? ['flower'] : [])];
  // Tâm một khu trong toạ độ thế giới (cao ngang tâm nhìn .8) và tâm cả khu nhà (giữa các khu đã mở).
  const zoneCenter = (zone, out = new THREE.Vector3()) => out.set(ZONE_OFFSET[zone][0] + (zone === 'garden' && expanded ? GARDEN_EXT_X / 2 : zone === 'backyard' || zone === 'kinder' ? BACKYARD_EXT_X / 2 : 0), .8, ZONE_OFFSET[zone][1]);
  const siteCenter = (out = new THREE.Vector3()) => {
    const zones = openZones(), tmp = new THREE.Vector3();
    out.set(0, 0, 0);
    zones.forEach(zone => out.add(zoneCenter(zone, tmp)));
    return out.divideScalar(zones.length);
  };
  // Nắng chiếu giữa khu nhà để bóng đổ phủ được mọi khu.
  function aimSun() {
    const mid = siteCenter().setY(0);
    sun.target.position.copy(mid);
    sun.position.copy(mid).add(SUN_FROM);
  }
  // Thảm của từng phòng: đồ đứng trong vùng thảm được nhấc lên mặt thảm (xem cuối apply()).
  const RUG_OF = { living: 'rug', bedroom: 'bedrug' }, RUG_REACH = { x: 1.2, z: .9 };
  // `open` = { living, bedroom, kitchen, bathroom, gardenExpand }: khu nào đã mở, vườn đã mở rộng chưa (màn 10).
  // Bỏ trống thì giữ như lần trước.
  // Đồ gắn trên tường (rèm, tranh, kệ, đồng hồ, cờ, khung cửa, cửa...) hoà theo màu tường, đồ cố định trên sàn (tủ thấp, gối, thảm chùi chân, dép,
  // thùng rác...) hoà theo màu sàn (wall-theme.mjs): mỗi chất liệu nhớ màu gốc (vẽ cho tường kem / sàn sồi mặc định) ở userData[baseKey] rồi
  // tính lại từ màu gốc mỗi lần đổi, nên đổi qua lại không bị trôi màu. Bỏ qua: chính mảng tường, kính / trời (wallKeep), chất liệu có texture
  // (biển hiệu), vật phát sáng (đèn dây, neon, đèn lồng).
  function retintGroup(roots, skip, surfaceColor, fit, baseKey) {
    const seen = new Set();
    const retint = node => {
      for (const m of [].concat(node.material || [])) {
        if (!m || seen.has(m) || skip.has(m) || m.userData.wallKeep || m.map || !m.color || (m.emissive && m.emissive.getHex() !== 0)) continue;
        seen.add(m);
        m.userData[baseKey] ??= '#' + m.color.getHexString();
        m.color.set(fit(m.userData[baseKey], surfaceColor));
        // tranh / cờ không nhận sáng: nightArt() nhân tông đêm từ dayColor, nên cập nhật dayColor (và nhân lại tông đêm nếu đang tối)
        if (m.userData.nightDim) { m.userData.dayColor = m.color.clone(); if (night) m.color.multiply(NIGHT_ART); else if (ambient === 'dusk') m.color.multiply(DUSK_ART); }
      }
    };
    roots.forEach(root => root.traverse(retint));
  }
  function themeWallDecor(inside, wallColor) {
    const roots = [...inside.walls, ...inside.walls.map(wall => wall.userData.stub), ...Object.values(inside.leaves)].filter(Boolean);
    retintGroup(roots, new Set([...inside.wallMats, ...inside.stubs]), wallColor, fitToWall, 'wallBase');
  }
  function themeFloorDecor(inside, floorColor) {
    retintGroup([inside.decor], new Set(), floorColor, fitToFloor, 'floorBase');
  }
  function apply(deco, open = {}) {
    const was = { ...opened }, wasExpanded = expanded, fromReach = zoneReach(zoneId);
    for (const zone of OPENABLE) opened[zone] = open[zone] ?? opened[zone];
    expanded = open.gardenExpand ?? expanded;
    opened.bedroom &&= opened.living; // phòng ngủ đi qua phòng khách
    opened.kitchen &&= opened.living; // bếp cũng đi qua phòng khách
    opened.bathroom &&= opened.bedroom; // phòng tắm đi qua phòng ngủ
    opened.backyard &&= opened.bathroom; // sân sau đi qua phòng tắm
    const zone = opened[deco.zone] ? deco.zone : 'garden';
    for (const id of ROOM_ZONES) interiors[id].room.visible = opened[id];
    gardenExt.visible = groundLong.visible = cornersLong.visible = expanded;
    yard.visible = opened.backyard;
    kid.visible = opened.kinder;
    const allOpen = OPENABLE.every(id => opened[id]) && expanded;
    // Vừa mở khu cuối cùng (đang chơi, không phải lúc nạp game): vườn hoa quà tặng ẩn, rồi mọc lên trước mắt người chơi (revealGift):
    // đang ở Deco thì chờ camera lướt tới khu vừa mở xong; chưa ở cảnh nhà thì đợi lần mở Deco tới (show()).
    if (allOpen && !bloom.visible && !giftPending && applied) {
      giftPending = true;
      if (decoMode) setTimeout(revealGift, GIFT_DELAY);
    }
    bloom.visible = allOpen && !giftPending;
    if (hub) controls.maxDistance = hubMax();
    ground.visible = cornersSquare.visible = !expanded;
    doormat.visible = opened.living;
    setLeaf(interiors.living.leaves[2], opened.bedroom); // cửa phòng khách -> phòng ngủ: đóng khi phòng ngủ còn khoá
    setLeaf(interiors.living.leaves[3], opened.kitchen); // cửa phòng khách -> bếp: đóng khi bếp còn khoá
    setLeaf(interiors.bedroom.leaves[0], opened.bathroom); // cửa phòng ngủ -> phòng tắm: đóng khi phòng tắm còn khoá
    setLeaf(interiors.bathroom.leaves[3], opened.backyard); // cửa phòng tắm -> sân sau: đóng khi sân sau còn khoá
    // Vừa mở một phòng trong lúc đang chơi: lần tới mở Home, phòng "mọc" lên (lần nạp game đầu thì hiện luôn).
    for (const id of OPENABLE) if (opened[id] && !was[id] && applied) revealPending = id;
    if (expanded && !wasExpanded && applied) revealPending = 'garden2'; // vườn vừa mở rộng: đồi + đồ trang trí mọc lên
    if (zone !== zoneId || expanded !== wasExpanded) {
      zoneId = zone;
      zoomFocus = null;
      // Deco: lướt sang khu vừa chọn, giữ độ zoom đang dùng (sang / rời vườn mở rộng: nhân / chia WIDE)
      if (decoMode) {
        const r = camera.position.distanceTo(controls.target);
        glideTo(zoneCenter(zone), 700, THREE.MathUtils.clamp(r * zoneReach(zone) / fromReach, controls.minDistance, controls.maxDistance));
      }
    }
    if (OPENABLE.some(id => opened[id] !== was[id]) || expanded !== wasExpanded || !applied) aimSun();
    applied = true;
    if (container) container.dataset.zone = zoneId;

    const gardenState = zoneState(deco, 'garden');
    const fenceEntry = itemById(gardenState.wall), groundEntry = itemById(gardenState.floor);
    // MỘT hàng rào bao cả vườn (vườn mở rộng: hình chữ nhật dài theo x, tâm dời sang phải); chừa cổng sang phòng khách
    // (cạnh -z, u = x tính từ tâm rào) khi đã có phòng khách, cổng trước sang trường mẫu giáo (cạnh +z, u = -x) khi đã mở trường.
    const key = `${fenceEntry.id}|${opened.living}|${opened.kinder}|${expanded}|${allOpen}`;
    if (fenceKey !== key) {
      fenceKey = key;
      if (fence) garden.remove(fence);
      const cx = expanded ? GARDEN_EXT_X / 2 : 0;
      const gates = [...(opened.living ? [{ side: 0, u: DOOR.x - cx, w: DOOR.w }] : []), ...(opened.kinder ? [{ side: 1, u: cx - KINDER_GATE_X, w: 1 }] : []),
        ...(allOpen ? [{ side: 2, u: -FLOWER_GATE_Z, w: 1 }] : [])]; // cổng nhỏ rào trái sang vườn hoa quà tặng (cạnh -x: u = -z)
      fence = buildFence(fenceEntry, HALF, gates, HALF + cx);
      fence.position.x = cx;
      fence.userData.pickSurface = { zone: 'garden', key: 'walls' };
      garden.add(fence);
    }
    // Sân sau: rào hai cạnh ngoài + nền theo món đang dùng của khu.
    const yardState = zoneState(deco, 'backyard'), yardFenceEntry = itemById(yardState.wall), yardGroundEntry = itemById(yardState.floor);
    if (yardFenceId !== yardFenceEntry.id) {
      yardFenceId = yardFenceEntry.id;
      if (yardFence) yard.remove(yardFence);
      yardFence = buildBackyardFence(yardFenceEntry);
      yardFence.userData.pickSurface = { zone: 'backyard', key: 'walls' };
      yard.add(yardFence);
    }
    if (yardGroundId !== yardGroundEntry.id) {
      yardGroundId = yardGroundEntry.id;
      yardMat.map = groundTextures[yardGroundId] ||= groundTexture(yardGroundEntry);
      yardMat.color.copy(grassTint); yardMat.needsUpdate = true;
      if (yardPatio) yard.remove(yardPatio);
      yard.add(yardPatio = buildPatio(yardGroundId));
    }
    // Trường mẫu giáo: rào bao quanh (cổng trước đối diện cổng vườn) + nền theo món đang dùng của khu.
    const kidState = zoneState(deco, 'kinder'), kidFenceEntry = itemById(kidState.wall), kidGroundEntry = itemById(kidState.floor);
    if (kidFenceId !== kidFenceEntry.id) {
      kidFenceId = kidFenceEntry.id;
      if (kidFence) kid.remove(kidFence);
      const kcx = (kb2.x0 + kb2.x1) / 2;
      kidFence = buildFence(kidFenceEntry, (kb2.z1 - kb2.z0) / 2, [{ side: 0, u: KINDER_GATE_X - kcx, w: 1 }], (kb2.x1 - kb2.x0) / 2);
      kidFence.position.x = kcx;
      kidFence.userData.pickSurface = { zone: 'kinder', key: 'walls' };
      kid.add(kidFence);
    }
    if (kidGroundId !== kidGroundEntry.id) {
      kidGroundId = kidGroundEntry.id;
      kidMat.map = groundTextures[kidGroundId] ||= groundTexture(kidGroundEntry);
      kidMat.color.copy(grassTint); kidMat.needsUpdate = true;
    }
    if (groundId !== groundEntry.id) {
      groundId = groundEntry.id;
      groundMat.map = groundTextures[groundId] ||= groundTexture(groundEntry);
      groundMat.color.copy(grassTint); groundMat.needsUpdate = true; // nhân tối nhẹ texture cỏ cho đỡ chói (đổi theo ambient)
      hillMat.map = groundMat.map; hillMat.color.copy(groundMat.color); hillMat.needsUpdate = true; // đồi cùng nền cỏ
    }
    // Tường / sàn riêng từng phòng.
    for (const id of ROOM_ZONES) {
      const inside = interiors[id], state = zoneState(deco, id);
      const wall = itemById(state.wall), floorEntry = itemById(state.floor);
      inside.wallMats.forEach(m => m.color.set(wall.color));
      inside.stubs.forEach(m => m.color.set(wall.color));
      themeWallDecor(inside, wall.color);
      themeFloorDecor(inside, floorEntry.color);
      if (inside.floorId !== floorEntry.id) {
        inside.floorId = floorEntry.id;
        inside.floorMat.map = floorTextures[floorEntry.id] ||= floorTexture(floorEntry);
        inside.floorMat.color.set('#ffffff');
        inside.floorMat.needsUpdate = true;
      }
    }
    const fresh = []; // chỗ vừa có món mới / đổi phương án: mèo tò mò tới xem (không tính lần dựng cảnh đầu tiên)
    CATALOG.filter(entry => entry.cat === 'furniture' && !entry.slot).forEach(base => {
      const shown = opened[base.zone] && (base.area !== 'garden2' || expanded); // đồ phần mở rộng: chỉ khi vườn đã mở rộng
      const placedId = shown && zoneState(deco, base.zone).placed.find(id => slotOf(itemById(id)) === base.id);
      if (!placedId) { if (furniture[base.id]) furniture[base.id].visible = false; return; }
      const before = furniture[base.id], node = piece(itemById(placedId));
      if (node !== before || !node.visible) { node.userData.pop = 0; fresh.push(base.id); } // vừa hiện / vừa đổi phương án: nảy lên
      node.visible = true;
    });
    // Đồ trong phòng đứng trong vùng thảm (bàn trà giữa phòng khách...) nhấc lên đúng mặt thảm: chân đồ cắm xuyên qua
    // các ô vải của thảm thì mặt cắt + viền mực răng cưa chập chờn. Không có thảm thì về lại sàn.
    for (const [id, node] of Object.entries(furniture)) {
      const roomZone = itemById(node.userData.itemId)?.zone, rugId = RUG_OF[roomZone];
      if (itemById(node.userData.itemId)?.area === 'garden2' && PLACES[id]) { node.position.y = groundHeight('garden', PLACES[id][0], PLACES[id][1]); continue; } // đứng trên mặt đồi
      if (!rugId || id === rugId || PLACES[id] === undefined) continue;
      const rug = furniture[rugId]?.visible ? furniture[rugId] : null, [rugX, rugZ] = PLACES[rugId];
      const onRug = rug && Math.abs(PLACES[id][0] - rugX) < RUG_REACH.x && Math.abs(PLACES[id][1] - rugZ) < RUG_REACH.z;
      node.position.y = onRug ? rug.userData.top ?? 0 : 0;
    }
    cats.furnitureChanged(catKey ? fresh : []); // catKey trống = lần dựng đầu: mọi món đều "mới", không cho mèo chạy tới
    if (catKey !== deco.cats.join()) { catKey = deco.cats.join(); cats.setCats(deco.cats); }
  }

  // Quay camera về phía một món đồ (camera đứng đối diện, nhìn món đồ tựa lưng vào tường).
  // Món đó cũng thành tâm zoom ở Deco (zoomFocus): zoom vào thì tâm nhìn trượt dần tới món, zoom ra thì về giữa khu.
  // focus(null) = bỏ chọn, zoom lại quanh giữa khu.
  let zoomFocus = null, userPanned = false;
  // turn = false: giữ góc xoay đang có (chạm thẳng vào món trong cảnh: người chơi đang nhìn thấy nó rồi).
  // Shop (popup xem thử): đặt camera sát món cho món vừa khít khung (margin > 1 = chừa lề). Nhảy thẳng, không lướt; bỏ giới hạn
  // zoom gần của Deco (mount() lần sau đặt lại qua setMode). Tường / sàn (không có model riêng): soi cả khu.
  const fitSphere = new THREE.Sphere();
  // Popup xem trước (Shop): camera nhìn món theo đúng hướng thumbnail (THUMB_DIR xoay theo hướng món trong phòng) — không
  // giữ hướng camera cũ (lỗi chỉ thấy mặt sau / nhìn từ dưới). Mọi thứ chắn giữa camera và món (tường, rào, món khác, đồ
  // trang trí cố định) được ẩn trong lúc xem (lỗi tường che máy giặt / đàn piano). Đóng popup (stop / mount) thì hiện lại.
  function frameItem(id, margin = 1.35) {
    const entry = itemById(id), slot = entry && slotOf(entry), node = slot && furniture[slot];
    clearPreviewHidden();
    stopGlide();
    zoomFocus = null; userPanned = false;
    let dir = camDir.subVectors(camera.position, controls.target).normalize();
    if (node?.visible) {
      fullBox(node).getBoundingSphere(fitSphere);
      dir = previewDir(node, camDir);
    } else { zoneCenter(entry?.zone || zoneId, fitSphere.center).setY(.8); fitSphere.radius = HALF * 1.1; }
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2), hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = fitSphere.radius * margin / Math.sin(Math.min(vHalf, hHalf));
    controls.minDistance = Math.min(controls.minDistance, dist * .5);
    controls.maxDistance = Math.max(controls.maxDistance, dist * 1.5); // món to: không bị kẹp lại gần hơn rồi cắt khung
    controls.target.copy(fitSphere.center);
    camera.position.copy(fitSphere.center).addScaledVector(dir, dist);
    controls.update();
    lastRadius = dist;
    if (node?.visible) { framing = true; hideOccluders(node); }
  }
  // Khung bao món ở cỡ thật: món vừa hiện đang nảy (pop) từ cỡ ~50% lên, đo lúc đó thì camera tiến quá gần, cắt mất món.
  function fullBox(node) {
    const keep = node.scale.clone();
    node.scale.set(1, 1, 1);
    node.updateMatrixWorld(true);
    itemBox.setFromObject(node);
    node.scale.copy(keep);
    node.updateMatrixWorld(true);
    return itemBox;
  }
  // Hướng thumbnail xoay theo hướng món (chỉ góc quay quanh trục đứng: món đang lắc nhẹ không làm lệch).
  const previewFwd = new THREE.Vector3(), previewQ = new THREE.Quaternion(), UP_AXIS = new THREE.Vector3(0, 1, 0);
  function previewDir(node, out) {
    previewFwd.set(0, 0, 1).applyQuaternion(node.getWorldQuaternion(previewQ));
    return out.copy(THUMB_DIR).applyAxisAngle(UP_AXIS, Math.atan2(previewFwd.x, previewFwd.z));
  }
  // Tia từ camera tới tâm + 8 góc (co vào 30%) của khung bao món: khối nào nằm trên tia trước món là vật chắn.
  // Bỏ qua: chính món, nền / sàn, bệ diorama, mèo, cỏ / hoa rải (InstancedMesh), viền toon.
  const previewHidden = [], occluderRay = new THREE.Raycaster(), samplePoint = new THREE.Vector3(), boxCenter = new THREE.Vector3();
  function previewBlockers(node) {
    const found = new Map(), walls = new Set(Object.values(interiors).flatMap(inside => inside.walls));
    const others = new Set(Object.values(furniture).filter(other => other !== node));
    const inWall = mesh => { for (let n = mesh; n; n = n.parent) if (walls.has(n)) return true; return false; };
    fullBox(node).getCenter(boxCenter);
    for (let i = 0; i < 9; i++) {
      if (i === 8) samplePoint.copy(boxCenter);
      else samplePoint.set(i & 1 ? itemBox.max.x : itemBox.min.x, i & 2 ? itemBox.max.y : itemBox.min.y, i & 4 ? itemBox.max.z : itemBox.min.z).lerp(boxCenter, .3);
      const far = camera.position.distanceTo(samplePoint);
      occluderRay.set(camera.position, samplePoint.clone().sub(camera.position).normalize());
      occluderRay.far = far - .02;
      for (const hitInfo of occluderRay.intersectObject(site, true)) {
        const mesh = hitInfo.object;
        if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.outline || !shown(mesh)) continue;
        let owner = null, skip = false;
        for (let n = mesh; n && n !== site; n = n.parent) {
          if (n === node || n.userData.catRoot || n.userData.pickSurface?.key === 'floors') { skip = true; break; }
          if (walls.has(n) || others.has(n)) { owner = n; break; }
        }
        if (!skip) found.set(owner || mesh, walls.has(owner) ? 'wall' : 'node');
      }
      // Tia chỉ bắt mặt trước của khối: camera nằm LỌT trong một món (ghế ngay trước bàn đàn) thì tia không thấy. Kiểm thêm
      // bằng khung bao: món khác / tường / đồ trang trí cố định có khung chứa camera hoặc nằm trên tia cũng là vật chắn.
      for (const other of others) if (other.visible && blocksRay(other, far)) found.set(other, 'node');
      for (const wall of walls) if (wall.visible && wall.parent?.visible && blocksRay(wall, far)) found.set(wall, 'wall');
      for (const root of fixedDecor) root.traverse(mesh => {
        if (mesh.isMesh && !mesh.isInstancedMesh && !mesh.userData.outline && shown(mesh) && !inWall(mesh) && blocksRay(mesh, far)) found.set(mesh, 'node');
      });
    }
    return found;
  }
  // Đang soi một món trong popup: tâm nhìn không trôi về giữa khu khi khoảng cách đổi chút ít (lỗi món lệch khỏi khung),
  // mèo ẩn đi (mèo đi ngang trước món che mất món).
  let framing = false;
  const blockBox = new THREE.Box3(), blockHit = new THREE.Vector3();
  function blocksRay(object, far) {
    blockBox.setFromObject(object);
    if (blockBox.isEmpty()) return false;
    if (blockBox.clone().expandByScalar(.05).containsPoint(camera.position)) return true;
    return !!occluderRay.ray.intersectBox(blockBox, blockHit) && blockHit.distanceTo(camera.position) < far - .05;
  }
  function hideOccluders(node) {
    cats.bodies().forEach(cat => { cat.rig.root.visible = false; previewHidden.push([cat.rig.root, 'node']); });
    for (const [blocker, kind] of previewBlockers(node)) {
      if (kind === 'wall') { blocker.userData.forceHide = true; blocker.userData.opacity = 0; blocker.visible = false; }
      else blocker.visible = false;
      previewHidden.push([blocker, kind]);
    }
  }
  // QC (dev): popup xem trước của một món còn bị che sau khi đã ẩn vật chắn. Trả về danh sách lỗi (chuỗi).
  function qcPreview(id) {
    const entry = itemById(id), node = entry && furniture[slotOf(entry)];
    if (!node?.visible) return [`${id}: không dựng được để xem trước`];
    frameItem(id);
    const left = previewBlockers(node).size;
    clearPreviewHidden();
    return left ? [`${id}: popup xem trước vẫn bị che (${left} khối)`] : [];
  }
  function clearPreviewHidden() {
    framing = false;
    for (const [blocker, kind] of previewHidden.splice(0)) {
      if (kind === 'wall') {
        Object.assign(blocker.userData, { forceHide: false, opacity: 1 });
        blocker.traverse(n => { const m = n.material; if (m) { m.opacity = m.userData.baseOpacity ?? 1; m.depthWrite = !m.userData.noDepth; } });
      }
      blocker.visible = true;
    }
  }
  const FOCUS_ZOOM = 12; // khoảng cách camera = cỡ món × FOCUS_ZOOM (FOV toon hẹp), kẹp trong 55%–110% độ xa mặc định
  // lift (px): món nằm thấp hơn giữa khung chừng ấy — chừa chỗ phía trên cho bảng đổi món, tính sẵn trong cú lướt.
  function focus(id, turn = true, lift = 0) {
    const slot = id && slotOf(itemById(id) || { id }), place = slot && PLACES[slot];
    zoomFocus = place ? slot : null;
    userPanned = false;
    selectedSlot = zoomFocus;
    if (!place || !id) return;
    // Đổi sang món khác: tâm nhìn lướt sang món mới, giữ độ zoom đang dùng. Vị trí tâm theo đúng tỉ lệ của zoom vào món
    // (giữa khu khi zoom ra hết, đúng món khi zoom sát hết): đang soi cận món cũ thì sang soi cận món mới.
    // Deco: tâm nhìn lướt tới món (giữ độ zoom), để món và bảng đổi món phía trên nó nằm giữa khung.
    // Deco: món ra giữa khung, camera tự zoom theo cỡ món (món to lùi xa, món nhỏ tiến gần) để món chiếm chừng 1/4 chiều cao
    // khung — còn đủ chỗ phía trên cho bảng đổi món mà không che model.
    const item = decoMode && furniture[slot];
    if (item) {
      const size = itemBox.setFromObject(item).getSize(tmpCenter), span = Math.max(size.x, size.y * 1.4, size.z, .6);
      const radius = THREE.MathUtils.clamp(span * FOCUS_ZOOM, HOME_VIEW.length() * .55, HOME_VIEW.length() * 1.1);
      const goal = itemBox.getCenter(tmpGoal).setY(.8);
      if (lift) goal.add(groundShift(lift, radius, groundFwd)); // tâm nhìn vượt qua món về phía trước: món tụt xuống dưới giữa khung
      glideTo(goal, 750, radius);
    }
    if (turn) turnToward(Math.atan2(-place[0], -place[1]));
  }

  // ---------- Deco: chạm món / bề mặt, sáng nhẹ món có đồ mới, toạ độ màn hình của món (để đặt bảng đổi món cạnh nó) ----------
  // Hiệu ứng hạt ở Deco (deco-fx.mjs): xem trước / đổi kiểu / mua món. key = chỗ đặt món, hoặc 'walls' / 'floors' (giữa khu).
  const decoFx = createDecoFx(scene), fxBase = new THREE.Vector3(), fxSize = new THREE.Vector3();
  function playFx(key, kind) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = furniture[key];
    if (node?.visible) {
      // Đo món ở cỡ thật (đang nảy thì scale chưa về 1)
      const scale = node.scale.x;
      node.scale.setScalar(1); node.updateMatrixWorld(true);
      itemBox.setFromObject(node).getSize(fxSize);
      node.scale.setScalar(scale); node.updateMatrixWorld(true);
      itemBox.getCenter(fxBase).setY(node.position.y);
      return decoFx.burst(kind, fxBase, Math.max(.3, itemBox.max.y - node.position.y), Math.max(fxSize.x, fxSize.z));
    }
    zoneCenter(zoneId, fxBase).setY(0); // đổi tường / sàn: hiệu ứng rộng giữa khu
    decoFx.burst(kind, fxBase, 1.2, 5);
  }
  // Mở khu mới (menu/areas.js buyArea): pháo giấy phủ cả mảnh đất vừa mở.
  function openFx(zone) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !ZONE_OFFSET[zone]) return;
    decoFx.burst('open', fxBase.set(ZONE_OFFSET[zone][0], 0, ZONE_OFFSET[zone][1]), 2.5, HALF * 2);
  }
  let onPick = null, onZoneView = null, onCatEvent = null, selectedSlot = null, highlights = new Set();
  // Deco: đang mở bảng đổi kiểu một món thì khoá camera ở góc vừa căn (không kéo / xoay / zoom / nhấc mèo). Chạm vẫn nhận:
  // chạm chỗ trống = đóng bảng, chạm món khác = sang món đó (camera lướt tới rồi khoá tiếp).
  let viewLocked = false;
  function lockView(on) {
    viewLocked = !!on;
    controls.enabled = !viewLocked;
    if (viewLocked) { clearTimeout(resumeTimer); controls.autoRotate = false; }
  }
  // Khung (toạ độ thế giới) của một khu: vườn theo hàng rào (đã mở rộng thì dài), phòng = sàn 8 × 8 quanh tâm khu.
  function zoneRect(zone) {
    if (zone === 'garden') return gardenBounds(expanded);
    if (zone === 'backyard' || zone === 'kinder') { const [ox, oz] = ZONE_OFFSET[zone]; return { x0: ox + yb.x0, x1: ox + yb.x1, z0: oz + yb.z0, z1: oz + yb.z1 }; } // cùng khung (kinderBounds = backyardBounds)
    const [ox, oz] = ZONE_OFFSET[zone];
    return { x0: ox - HALF, x1: ox + HALF, z0: oz - HALF, z1: oz + HALF };
  }
  const insideZone = (zone, p, margin) => { const r = zoneRect(zone); return p.x > r.x0 + margin && p.x < r.x1 - margin && p.z > r.z0 + margin && p.z < r.z1 - margin; };
  // Deco: người chơi kéo cảnh sang hẳn khu khác (tâm nhìn vào sâu trong khu đó .4 m) thì Deco đổi theo khu đang ở giữa.
  // Chỉ đổi khu khi chính người chơi kéo cảnh (userPanned) và chưa chọn món nào: camera tự lướt / zoom tới món sát rìa khu
  // (võng sát rào sau vườn, ngay cạnh phòng khách) không được làm Deco nhảy sang khu khác và bỏ chọn món đang sửa.
  function followDrag() {
    if (!decoMode || !onZoneView || !userPanned || zoomFocus || glide.active || insideZone(zoneId, controls.target, 0)) return;
    // Trường mẫu giáo zoom ra xa hơn tầm thường: tâm đã trôi về giữa khu nhà, giữ khu kinder.
    if (zoneId === 'kinder' && camera.position.distanceTo(controls.target) > HUB_MAX) return;
    const next = Object.keys(opened).find(zone => opened[zone] && zone !== zoneId && insideZone(zone, controls.target, .4));
    if (!next) return;
    zoneId = next;
    zoomFocus = null;
    if (container) container.dataset.zone = next;
    onZoneView(next);
  }

  const GLOW = new THREE.Color('#fff0c8');
  // Cộng emissive ấm lên vật liệu của món; vật liệu vốn tự phát sáng (đèn, lửa) giữ nguyên.
  function glow(node, k) {
    if ((node.userData.glow || 0) === k) return;
    node.userData.glow = k;
    if (!node.userData.glowMats) {
      const mats = new Set();
      node.traverse(child => {
        if (child.isMesh && !child.userData.outline) [].concat(child.material).forEach(m => { if (m?.emissive && !m.emissive.getHex()) mats.add(m); });
      });
      node.userData.glowMats = [...mats];
    }
    for (const m of node.userData.glowMats) { m.emissive.copy(k ? GLOW : BLACK); m.emissiveIntensity = k || 1; }
  }
  const BLACK = new THREE.Color(0);
  // Vật đang thấy được: cả chuỗi cha đều hiện, không phải tường đang mờ đi (tường chắn camera).
  const shown = node => { for (let n = node; n; n = n.parent) if (!n.visible) return false; return ([].concat(node.material)[0]?.opacity ?? 1) > .5; };
  // Món / bề mặt dưới điểm chạm (raycaster đã ngắm), chỉ trong khu đang trang trí: { zone, key } — key = chỗ đặt | 'walls' | 'floors'.
  function pickAt() {
    for (const hitInfo of raycaster.intersectObject(site, true)) {
      if (!shown(hitInfo.object)) continue;
      for (let node = hitInfo.object; node; node = node.parent) {
        if (node.userData.pickSlot) return { zone: itemById(node.userData.itemId)?.zone, key: node.userData.pickSlot };
        if (node.userData.pickSurface) return node.userData.pickSurface.zone === zoneId ? { ...node.userData.pickSurface } : null;
      }
      return null; // trúng vật khác (đồ trang trí cố định...) trước
    }
    return null;
  }
  // Toạ độ (px, theo khung chứa cảnh) của đỉnh món đồ ở một chỗ; null nếu món không hiện / ở sau camera.
  const topPoint = new THREE.Vector3();
  // Khung chữ nhật (px màn hình) bao trọn món đồ: 8 góc hộp bao chiếu lên màn hình. Để đặt bảng đổi món không đè lên model.
  const corner = new THREE.Vector3();
  function screenRectOf(slot) {
    const node = furniture[slot];
    if (!node?.visible || !container) return null;
    itemBox.setFromObject(node);
    const rect = renderer.domElement.getBoundingClientRect(), out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? itemBox.max.x : itemBox.min.x, i & 2 ? itemBox.max.y : itemBox.min.y, i & 4 ? itemBox.max.z : itemBox.min.z).project(camera);
      if (corner.z > 1) return null;
      const x = rect.left + (corner.x + 1) / 2 * rect.width, y = rect.top + (1 - corner.y) / 2 * rect.height;
      out.left = Math.min(out.left, x); out.right = Math.max(out.right, x); out.top = Math.min(out.top, y); out.bottom = Math.max(out.bottom, y);
    }
    return out;
  }
  // Trượt khung nhìn để nội dung dịch xuống dy px trên màn hình (dy < 0: dịch lên): dời tâm nhìn theo hướng nhìn trên mặt đất.
  // Mặt đất nhìn xiên góc polar nên 1 m dọc hướng nhìn chỉ chiếm cos(polar) m trên khung.
  const groundFwd = new THREE.Vector3();
  // Đoạn dời trên mặt đất (dọc hướng nhìn) để nội dung dịch dy px trên màn hình, khi camera cách tâm nhìn `dist` mét.
  function groundShift(dy, dist, out) {
    const perPx = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom / Math.max(1, viewFullH);
    out.subVectors(controls.target, camera.position).setY(0).normalize();
    const polar = Math.acos(THREE.MathUtils.clamp((camera.position.y - controls.target.y) / camera.position.distanceTo(controls.target), -1, 1));
    return out.multiplyScalar(dy * perPx / Math.max(.3, Math.cos(polar)));
  }
  // Trả về false nếu không dời được (tâm nhìn đã chạm mép khu nhà): bên gọi thôi đẩy, khỏi giằng co với giới hạn kéo.
  // Không dời phụt: bắt đầu một cú lướt ngắn tới chỗ đã dời (đang lướt thì đợi lướt xong, đo lại rồi mới bù).
  function nudge(dy) {
    if (!container || !dy || glide.active) return true;
    groundShift(dy, camera.position.distanceTo(controls.target), groundFwd);
    const goal = clampGoal(tmpGoal.copy(controls.target).add(groundFwd));
    if (goal.distanceToSquared(controls.target) < 1e-6) return false;
    glideTo(goal, 420);
    return true;
  }
  // Khung (px màn hình) bao con mèo thứ `index` / giống mèo `index` (chuỗi) (không có thì null): cho hướng dẫn chỉ vào mèo.
  const catBox = new THREE.Box3();
  function screenRectOfCat(index = 0) {
    const cat = typeof index === 'string' ? cats.bodies().find(body => body.breed === index) : cats.bodies()[index];
    if (!cat || !container) return null;
    catBox.setFromObject(cat.rig.root);
    const rect = renderer.domElement.getBoundingClientRect(), out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? catBox.max.x : catBox.min.x, i & 2 ? catBox.max.y : catBox.min.y, i & 4 ? catBox.max.z : catBox.min.z).project(camera);
      if (corner.z > 1) return null;
      const x = rect.left + (corner.x + 1) / 2 * rect.width, y = rect.top + (1 - corner.y) / 2 * rect.height;
      out.left = Math.min(out.left, x); out.right = Math.max(out.right, x); out.top = Math.min(out.top, y); out.bottom = Math.max(out.bottom, y);
    }
    return out;
  }
  // ---------- Xu 3D bay từ mèo vào thanh xu (nhận xu idle) ----------
  // Mỗi đồng xu là mô hình 3D (đĩa vàng + mặt nổi sáng, đứng nghiêng quay tròn): bật lên khỏi lưng mèo toả ra một chút rồi bay vòng cung
  // thẳng tới ĐIỂM TRONG CẢNH nằm sau thanh xu trên màn hình (tính lại mỗi khung từ toạ độ px của thanh nên camera xoay / zoom vẫn đúng).
  // Thanh xu là UI đè trên canvas nên đồng xu chui vào sau nó.
  const coinGroup = new THREE.Group();
  coinGroup.userData.structure = true;
  scene.add(coinGroup);
  const coinGeo = new THREE.CylinderGeometry(.24, .24, .06, 24).rotateX(Math.PI / 2), faceGeo = new THREE.CylinderGeometry(.165, .165, .07, 20).rotateX(Math.PI / 2);
  const coinBody = mat('#ffbe1f'), coinFace = mat('#ffe27a');
  const flying = [], coinRay = new THREE.Vector3(), coinTo = new THREE.Vector3(), coinCam = new THREE.Vector3();
  // from: giống mèo (chuỗi) hoặc vị trí; target: { x, y } px màn hình (thanh xu); count: số xu; onLand(i): mỗi đồng chạm thanh; trả Promise khi xong cả loạt.
  function flyCoins(breed, target, count = 8, onLand) {
    const cat = cats.bodies().find(body => body.breed === breed);
    if (!cat || !container) { for (let i = 0; i < count; i++) onLand?.(i); return Promise.resolve(); }
    const origin = new THREE.Vector3(); cat.rig.root.getWorldPosition(origin); origin.y += .55;
    return new Promise(done => {
      let left = count;
      for (let i = 0; i < count; i++) {
        const coin = new THREE.Group(), body = new THREE.Mesh(coinGeo, coinBody), face = new THREE.Mesh(faceGeo, coinFace);
        coin.add(body, face);
        [body, face].forEach(m => { m.castShadow = false; m.userData.noOutline = true; });
        const angle = (i / count) * Math.PI * 2 + Math.random() * .6, spread = .5 + Math.random() * .5;
        coin.position.copy(origin);
        coin.scale.setScalar(.01);
        coin.visible = false; // chờ tới lượt (so le từng đồng)
        coinGroup.add(coin);
        flying.push({ coin, t: -i * .07, burst: new THREE.Vector3(Math.cos(angle) * spread, 1 + Math.random() * .6, Math.sin(angle) * spread), spin: 6 + Math.random() * 6,
          origin: origin.clone(), target, last: new THREE.Vector3(), onLand: () => { onLand?.(i); if (--left === 0) done(); } });
      }
    });
  }
  const BURST = .38, FLY = .8; // giây: bật lên / bay vào thanh
  function updateCoins(dt) {
    if (!flying.length) return;
    const rect = renderer.domElement.getBoundingClientRect(), dist = camera.position.distanceTo(controls.target);
    for (let k = flying.length - 1; k >= 0; k--) {
      const f = flying[k];
      f.t += dt;
      if (f.t < 0) continue;
      const c = f.coin;
      c.visible = true;
      // Điểm đích trong cảnh: tia từ camera qua px của thanh xu, cách camera ~nửa khoảng nhìn (đủ gần để đồng xu to dần khi bay vào)
      coinTo.set((f.target.x - rect.left) / rect.width * 2 - 1, 1 - (f.target.y - rect.top) / rect.height * 2, .5).unproject(camera);
      coinCam.copy(camera.position);
      coinRay.copy(coinTo).sub(coinCam).normalize();
      coinTo.copy(coinCam).addScaledVector(coinRay, dist * .45);
      c.rotation.y += f.spin * dt;
      if (f.t < BURST) { // bật lên toả ra, hơi nảy
        const p = f.t / BURST, e = 1 - (1 - p) * (1 - p);
        c.position.set(f.origin.x + f.burst.x * e, f.origin.y + f.burst.y * e - 1.2 * p * p * .35, f.origin.z + f.burst.z * e);
        c.scale.setScalar(Math.min(1, .2 + p * 1.4));
        f.last.copy(c.position);
      } else {
        const p = Math.min(1, (f.t - BURST) / FLY), e = p * p * (3 - 2 * p);
        c.position.lerpVectors(f.last, coinTo, e);
        c.position.y += Math.sin(p * Math.PI) * .6; // vòng cung nhẹ
        c.scale.setScalar(1 + p * .6);
        if (p >= 1) { coinGroup.remove(c); flying.splice(k, 1); f.onLand(); }
      }
    }
  }
  // Điểm px màn hình ngay trên đầu mèo giống `breed`: chiếu GỐC mèo (+ độ cao cố định), không theo khung bao dáng mèo (đuôi / đầu cử động
  // làm khung bao đổi mỗi khung hình -> bong bóng xu bám theo bị rung). null nếu không có mèo / ở sau camera.
  const catTop = new THREE.Vector3();
  function screenOfCatHead(breed, height = .95) {
    const cat = cats.bodies().find(body => body.breed === breed);
    if (!cat || !container) return null;
    cat.rig.root.getWorldPosition(catTop); catTop.y += height; catTop.project(camera);
    if (catTop.z > 1) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (catTop.x + 1) / 2 * rect.width, y: rect.top + (1 - catTop.y) / 2 * rect.height };
  }
  // Khu kế tiếp chưa mở: mảnh đất mờ (nền nhạt trong suốt + viền nét đứt) đúng chỗ khu đó sẽ mở. menu/areas.js đặt chấm than
  // vàng lên trên (screenOfGhost) — chạm chấm than mới hiện điều kiện mở. Chỉ hiện ở Deco; không chặn chạm, không viền, không bóng.
  // Mảnh đất phủ đúng khung của khu: ô vuông 8 × 8 (phòng, vườn mở rộng), sân sau là hình chữ nhật dài (zoneRect).
  const ghost = new THREE.Group();
  ghost.userData.structure = true;
  ghost.visible = false;
  site.add(ghost);
  const ghostFill = mat('#fff3c4', { transparent: true, opacity: .5, depthWrite: false });
  const ghostEdge = mat('#ffffff', { transparent: true, opacity: .95, depthWrite: false });
  function buildGhost(hx, hz) {
    ghost.children.slice().forEach(child => { ghost.remove(child); child.geometry.dispose(); });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2 - .2, hz * 2 - .2), ghostFill);
    plane.rotation.x = -Math.PI / 2; plane.position.y = .04;
    ghost.add(plane);
    // Viền nét đứt: mỗi cạnh các gạch .5 m cách nhau .3 m.
    for (const [axis, sign] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
      const along = axis === 'x' ? hz : hx;
      for (let u = -along + .35; u < along - .3; u += .8) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? .08 : .5, .03, axis === 'x' ? .5 : .08), ghostEdge);
        dash.position.set(axis === 'x' ? sign * (hx - .15) : u + .25, .05, axis === 'x' ? u + .25 : sign * (hz - .15));
        ghost.add(dash);
      }
    }
    ghost.traverse(node => { node.raycast = () => {}; node.userData.noOutline = true; });
  }
  let ghostZone = null, ghostSize = '';
  function setGhost(zone) {
    ghostZone = zone ?? null;
    ghost.visible = !!ghostZone;
    if (!ghostZone) return;
    const [ox, oz] = ZONE_OFFSET[zone], r = zone === 'backyard' || zone === 'kinder' ? zoneRect(zone) : { x0: ox - HALF, x1: ox + HALF, z0: oz - HALF, z1: oz + HALF };
    const size = `${r.x1 - r.x0}x${r.z1 - r.z0}`;
    if (size !== ghostSize) { ghostSize = size; buildGhost((r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2); }
    ghost.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
  }
  function screenOfGhost() {
    if (!ghostZone || !container) return null;
    // Tâm mảnh đất nằm trong khung thì neo ở tâm; không thì neo ở mép phía khu đang xem (camera Deco khoá vào khu đang xem).
    const inView = () => topPoint.z <= 1 && Math.abs(topPoint.x) < .85 && Math.abs(topPoint.y) < .85;
    topPoint.set(ghost.position.x, 1.1, ghost.position.z).project(camera);
    if (!inView()) {
      const from = zoneCenter(zoneId), dx = from.x - ghost.position.x, dz = from.z - ghost.position.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1, (HALF - 1.2) / d);
      topPoint.set(ghost.position.x + dx * k, 1.1, ghost.position.z + dz * k).project(camera);
      if (topPoint.z > 1 || Math.abs(topPoint.x) > 1.1 || Math.abs(topPoint.y) > 1.1) return null;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (topPoint.x + 1) / 2 * rect.width, y: rect.top + (1 - topPoint.y) / 2 * rect.height };
  }
  function screenOf(slot) {
    const node = furniture[slot];
    if (!node?.visible || !container) return null;
    itemBox.setFromObject(node).getCenter(topPoint).setY(itemBox.max.y);
    topPoint.project(camera);
    if (topPoint.z > 1) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (topPoint.x + 1) / 2 * rect.width, y: rect.top + (1 - topPoint.y) / 2 * rect.height };
  }

  // Chạm mèo:
  //   chạm nhanh          -> cưng (mặt vui, nảy, tim bay)
  //   giữ ~0.35 s rồi kéo -> nhấc mèo lên, mèo lơ lửng ngay dưới ngón tay, thả tay thì mèo rơi xuống chỗ đó
  // Trong lúc nhấc mèo: khoá xoay/zoom camera (vẫn để OrbitControls theo dõi ngón tay cho khỏi lệch trạng thái).
  const HOLD_MS = TIMING.CARRY_HOLD_MS, MOVE_TOLERANCE = DRAG.CARRY_TOLERANCE;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), hit = new THREE.Vector3();
  const carryPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -cats.carryHeight);
  let down = null, holdTimer = 0, carrying = null, hovered = null;
  const HOVER_MEOW_MS = 2500;
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
    controls.enableRotate = false; controls.enableZoom = false; controls.enablePan = false; controls.autoRotate = false; stopGlide();
    const p = carryPoint(event);
    cats.pickUp(cat, p?.x ?? cat.x, p?.z ?? cat.z);
    // Vừa kêu lúc chuột rê vào thì nhấc lên không kêu thêm (tránh hai tiếng sát nhau).
    if (performance.now() - (cat.hoverMeowAt || 0) > HOVER_MEOW_MS) playMeow(cat.breed, 'hover');
    cat.hoverMeowAt = performance.now();
    onCatEvent?.('carry');
    navigator.vibrate?.(12);
    renderer.domElement.classList.add('carrying');
  }
  function endCarry() {
    if (!carrying) return;
    cats.drop(carrying.cat);
    // Thả mèo: im lặng (đã kêu lúc nhấc); chuột còn nằm trên mèo thì không tính là rê chuột vào mới (không kêu lần nữa).
    hovered = carrying.cat; carrying.cat.hoverMeowAt = performance.now();
    carrying = null;
    controls.enableRotate = true; controls.enableZoom = true; controls.enablePan = hub;
    renderer.domElement.classList.remove('carrying');
  }
  // Home: vặn 2 ngón = xoay khu nhà quanh trục đứng qua tâm nhìn (OrbitControls chỉ lo chụm zoom + trượt 2 ngón).
  // Góc vặn phải vượt ngưỡng mới bắt đầu xoay, để lúc chụm zoom khu nhà không lắc theo vài độ run tay.
  const TWIST_START = .07; // rad (~4°)
  const touches = new Map(), upAxis = new THREE.Vector3(0, 1, 0), twistOffset = new THREE.Vector3();
  let twistAngle = 0, twistSum = 0, twisting = false;
  const touchAngle = () => { const [a, b] = [...touches.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
  function trackTouch(event) {
    if (event.pointerType === 'mouse') return;
    if (event.type === 'pointerup' || event.type === 'pointercancel') touches.delete(event.pointerId);
    else if (event.type === 'pointerdown' || touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size !== 2) { twisting = false; return; }
    const angle = touchAngle();
    if (event.type !== 'pointermove') { twistAngle = angle; twistSum = 0; twisting = false; return; }
    const delta = ((angle - twistAngle) % TAU + TAU + Math.PI) % TAU - Math.PI;
    twistAngle = angle;
    if (!hub || carrying || viewLocked) return;
    if (!twisting) { twistSum += delta; if (Math.abs(twistSum) < TWIST_START) return; twisting = true; }
    // Vặn theo chiều kim đồng hồ trên màn hình thì khu nhà quay theo: camera quay ngược lại quanh tâm nhìn.
    twistOffset.subVectors(camera.position, controls.target).applyAxisAngle(upAxis, delta * SENS.twist);
    camera.position.copy(controls.target).add(twistOffset);
  }
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(type => renderer.domElement.addEventListener(type, trackTouch));
  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.button !== 0) return; // chỉ chuột trái / ngón tay mới nhấc mèo
    // Ngón thứ hai = đang chụm / vặn camera: cả lượt chạm này không còn là chạm (cưng mèo, chọn món) hay giữ nhấc mèo.
    if (!event.isPrimary) { clearTimeout(holdTimer); down = null; return; }
    down ={ x: event.clientX, y: event.clientY, id: event.pointerId };
    clearTimeout(holdTimer);
    aim(event);
    const cat = cats.hit(raycaster);
    if (cat && !carrying && !viewLocked) holdTimer = setTimeout(() => { if (down?.id === event.pointerId) startCarry(cat, event); }, HOLD_MS);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    // Chuột đã thả mà không có pointerup (bấm phải giữa chừng, menu chuột phải nuốt mất) → thả mèo.
    if (carrying && event.pointerType === 'mouse' && !(event.buttons & 1)) return release(event);
    if (carrying && event.pointerId === carrying.id) {
      const p = carryPoint(event);
      if (p) cats.carryTo(carrying.cat, p.x, p.z);
      return;
    }
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > MOVE_TOLERANCE) clearTimeout(holdTimer); // đang xoay phòng
    // Chuột rê qua mèo (không bấm): mèo kêu "mrrow?" (cat8), mỗi con nghỉ HOVER_MEOW_MS mới kêu lại.
    if (!down && event.pointerType === 'mouse') {
      aim(event);
      const cat = cats.hit(raycaster), t = performance.now();
      if (cat && cat !== hovered && t - (cat.hoverMeowAt || 0) > HOVER_MEOW_MS) { cat.hoverMeowAt = t; playMeow(cat.breed, 'hover'); }
      hovered = cat;
    }
  });
  const release = event => {
    clearTimeout(holdTimer);
    if (carrying && event.pointerId === carrying.id) { endCarry(); down = null; return; }
    if (event.type === 'pointerup' && down?.id === event.pointerId && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 6) {
      const rect = aim(event);
      const cat = cats.hit(raycaster);
      if (cat) { // chạm vui thì tim; chạm dồn dập thì mèo cáu dần rồi nổi giận (cat-brain.mjs pet)
        onCatEvent?.('pet');
        const mood = cat.pet(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        if (mood !== 'sleepy') playMeow(cat.breed, mood === 'grumpy' ? 'grumpy' : 'call');
        if (mood === 'grumpy') spawnHearts(x, y, '💢', 1, 'angry');
        else if (mood === 'warning') spawnHearts(x, y, '♥', 1);
        else spawnHearts(x, y);
      } else if (decoMode && onPick) { // Deco: chạm món / sàn / tường
        const pick = pickAt() || {};
        // Món ở phòng khác: phòng đó thành khu đang trang trí luôn (camera lướt thẳng tới món, không về giữa phòng trước)
        if (pick.zone && pick.zone !== zoneId) { zoneId = pick.zone; zoomFocus = null; if (container) container.dataset.zone = zoneId; }
        onPick({ ...pick, x: event.clientX, y: event.clientY });
      }
    }
    down = null;
  };
  renderer.domElement.addEventListener('pointerup', release);
  renderer.domElement.addEventListener('pointercancel', release);
  // Bấm chuột phải lúc đang bế mèo: không mở menu, thả mèo luôn.
  renderer.domElement.addEventListener('contextmenu', event => { if (!carrying) return; event.preventDefault(); release({ pointerId: carrying.id }); });
  addEventListener('blur', () => { if (carrying) release({ pointerId: carrying.id }); });
  function spawnHearts(x, y, symbol = '♥', count = 4, kind = '') {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !container) return;
    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span');
      heart.className = `pet-heart${kind ? ` ${kind}` : ''}${symbol !== '♥' ? ' symbol' : ''}`;
      heart.textContent = symbol;
      Object.assign(heart.style, { left: `${x + (Math.random() - .5) * 24}px`, top: `${y - 20}px`, animationDelay: `${i * 110}ms`, fontSize: `${14 + Math.random() * 8}px` });
      heart.style.setProperty('--dx', `${(Math.random() - .5) * 40}px`);
      heart.style.setProperty('--rot', `${(Math.random() - .5) * 40}deg`);
      container.append(heart);
      heart.addEventListener('animationend', () => heart.remove());
    }
  }

  let resumeTimer = 0, autoRotate = false;
  // Người chơi chạm kéo / chụm: dừng cú lướt ngay (giữ chỗ đang tới), quyền điều khiển về tay người chơi.
  controls.addEventListener('start', () => { userPanned = true; clearTimeout(resumeTimer); controls.autoRotate = false; stopGlide(); });
  controls.addEventListener('end', () => { resumeTimer = setTimeout(() => { controls.autoRotate = autoRotate; }, 2500); });

  // ---------- Đồ đạc rung nhẹ khi mèo đi sát qua ----------
  // Mèo đang đi / chạy trong tầm (bán kính vật cản + .6) đẩy món đồ theo hướng mèo -> món đồ, mạnh theo tốc độ và độ gần.
  // Món đồ nghiêng quanh chân đế như gắn lò xo (lệch rồi lắc tắt dần về thẳng). WOBBLE = độ "nhẹ" của từng món:
  // đồ cao, nhẹ, chân nhỏ lắc nhiều; đồ nặng, chân rộng lắc rất ít; 0 = nằm bẹt trên sàn (thảm, bồn hoa — hoa đã tự rạp).
  // Đồ có dây / bản lề thì lắc theo: bóng treo, xích đu (pendulum.kick), nắp thùng, nắp hộp (springy bump).
  const WOBBLE = {
    lamp: 1, plant: .9, lantern: 1, birdbath: .7, catnip: .9, cattree: .45, table: .6, yarn: .5, catbed: .35, armchair: .2,
    shelf: .12, tank: .15, hammock: .5, stump: .15, bench: .2, cathouse: .15, sandbox: .1, pond: 0, flowers: 0,
    rug: 0, bedrug: 0, // thảm (kể cả chăn chắp vá, thảm mây cùng chỗ đặt) nằm bẹt trên sàn: mèo đi qua không rung
  };
  const TILT = { K: 70, DAMP: 5, GAIN: 18, MAX: .15 }; // lò xo ~1.3 lần lắc/giây, nghiêng tối đa ~8.5°
  const tiltAxis = new THREE.Vector3(), tiltQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  function brush(dt) {
    if (!dt) return;
    const bodies = cats.bodies();
    for (const [id, node] of Object.entries(furniture)) {
      const weight = WOBBLE[id] ?? .4;
      if (!node.visible || !weight) continue;
      const j = node.userData.jig ||= { tx: 0, tz: 0, vx: 0, vz: 0, nextKick: 0 };
      const reach = (OBSTACLE_RADIUS[id] || .5) + .6; // mèo né đồ ở ~bán kính + .42 nên tầm phải rộng hơn thế
      let fx = 0, fz = 0;
      for (const cat of bodies) {
        if (cat.carried || cat.y > .05 || cat.speed < .08) continue; // chỉ mèo đang bước trên sàn
        const dx = node.position.x - cat.x, dz = node.position.z - cat.z, d = Math.hypot(dx, dz);
        if (d > reach || d < 1e-3) continue;
        const push = (1 - d / reach) * Math.min(cat.speed, 2.2) * weight;
        fx += dx / d * push; fz += dz / d * push;
      }
      // (tx, tz) = hướng ngọn món đồ dịch đi, độ lớn = góc nghiêng (rad).
      j.vx += (fx * TILT.GAIN - TILT.K * j.tx - TILT.DAMP * j.vx) * dt; j.tx += j.vx * dt;
      j.vz += (fz * TILT.GAIN - TILT.K * j.tz - TILT.DAMP * j.vz) * dt; j.tz += j.vz * dt;
      const angle = Math.hypot(j.tx, j.tz), max = TILT.MAX * Math.min(1, weight + .3);
      if (angle > max) { j.tx *= max / angle; j.tz *= max / angle; }
      const resting = angle < 1e-4 && Math.hypot(j.vx, j.vz) < 1e-3;
      if (!resting || j.moved) {
        // nghiêng quanh trục nằm ngang vuông góc hướng đẩy (UP × hướng) rồi mới quay theo yaw của món đồ
        tiltAxis.set(j.tz, 0, -j.tx).normalize();
        node.quaternion.setFromAxisAngle(UP, node.userData.yaw ?? 0);
        if (angle > 1e-5) node.quaternion.premultiply(tiltQ.setFromAxisAngle(tiltAxis, Math.min(angle, max)));
        j.moved = !resting;
      }
      // Phần treo / bản lề: mỗi lần mèo lướt qua đủ mạnh thì đẩy một cái (có hồi chiêu để không đẩy liên tục).
      const force = Math.hypot(fx, fz);
      if (force > .12 && clock > j.nextKick) {
        j.nextKick = clock + .8;
        node.userData.swing?.userData.kick(-fz * .8, fx * .8); // quay x âm = ra +z, quay z dương = ra +x
        node.userData.bump?.(Math.min(.5, force));
      }
    }
    clock += dt;
  }
  let clock = 0;

  // Mèo đang ngồi / nằm trên phần đung đưa của món đồ (ghế bập bênh, võng, xích đu lốp — node.userData.ride) đung đưa
  // cùng nó: lấy phép biến đổi của phần đó so với lúc đứng yên (toạ độ thế giới) áp lên thân mèo.
  // room-cats đặt lại VỊ TRÍ mèo mỗi frame nhưng chỉ đặt lại góc quay ngang (rotation.y), nên độ nghiêng áp lần trước
  // phải tự xoá trước khi áp lần mới — không thì cộng dồn từng frame tới khi mèo lộn ngược.
  const rideDelta = new THREE.Matrix4(), rideRest = new THREE.Matrix4(), rideQ = new THREE.Quaternion();
  function rideAlong() {
    for (const cat of cats.bodies()) {
      const root = cat.rig.root;
      if (root.userData.rode) { root.rotation.set(0, cat.yaw, 0); root.userData.rode = false; }
    }
    for (const [id, node] of Object.entries(furniture)) {
      const ride = node.userData.ride;
      if (!ride || !node.visible) continue;
      const riders = cats.bodies().filter(cat => cat.surface === id && !cat.carried);
      if (!riders.length) continue;
      node.updateMatrixWorld(true);
      rideRest.makeTranslation(ride.userData.restPos ?? ride.position).premultiply(ride.parent.matrixWorld); // chỗ nghỉ: đúng vị trí, không xoay
      rideDelta.copy(ride.matrixWorld).multiply(rideRest.invert());
      rideQ.setFromRotationMatrix(rideDelta);
      for (const cat of riders) {
        const root = cat.rig.root;
        root.rotation.set(0, cat.yaw, 0); // về thẳng đứng rồi mới nghiêng theo món đồ
        root.position.applyMatrix4(rideDelta); root.quaternion.premultiply(rideQ);
        root.userData.rode = true;
      }
    }
  }

  const camDir = new THREE.Vector3(), spherical = new THREE.Spherical();
  let lastFrame = 0, lastRadius = 0;
  let onFrame = null;
  // Kéo khi đã zoom sát (hub: Home / Deco): OrbitControls trượt đúng theo ngón tay ở khoảng cách hiện tại, nên zoom càng sát thì
  // mỗi cú vuốt đi được càng ít — phải vuốt nhiều lần, cảm giác nặng. Tăng dần tốc độ trượt (tới ×PAN_BOOST khi zoom sát hết) và
  // cho trôi xa hơn khi thả tay (giảm damping tới COAST_BOOST); zoom ra hết thì giữ như cũ.
  const PAN_BOOST = 1.8, COAST_BOOST = .55;
  let outlineScan = 0;
  function frame(now) {
    const zoomIn = hub ? THREE.MathUtils.clamp((controls.maxDistance - camera.position.distanceTo(controls.target)) / Math.max(1e-3, controls.maxDistance - controls.minDistance), 0, 1) : 0;
    controls.panSpeed = SENS.pan * (1 + (PAN_BOOST - 1) * zoomIn);
    const damping = DAMPING * (1 - (1 - COAST_BOOST) * zoomIn);
    controls.dampingFactor = 1 - (1 - damping) ** (Math.min(.1, (now - (lastFrame || now)) / 1000 || 1 / 60) * 60);
    const t = now / 1000;
    stepGlide(Math.min(.05, (now - (lastFrame || now)) / 1000 || 1 / 60));
    if (hub && !glide.active) clampPan();
    followDrag();
    controls.update();
    // Home: thu nhỏ thì tâm nhìn trôi dần về giữa khu nhà (thu nhỏ hết cỡ = thấy trọn khu nhà ở giữa màn hình).
    const radius = camera.position.distanceTo(controls.target);
    // Vỏ nhà: fade in / out trong ~.4 s
    exteriorK += ((radius > controls.maxDistance * EXTERIOR_AT && !framing ? 1 : 0) - exteriorK) * Math.min(1, (now - (lastFrame || now)) / 1000 * 3.5 || .1);
    if (exteriorK > .001 || houseShell.visible) fadeShell(exteriorK);
    // Sương mù đi theo camera: zoom ra xa thì khu nhà vẫn trong rõ, chỉ chân trời mờ
    if (scene.fog) { scene.fog.near = 55 + radius; scene.fog.far = 190 + radius * 1.5; }
    if (hub && !glide.active && lastRadius && radius > lastRadius + 1e-3) {
      const k = Math.min(1, (radius - lastRadius) / Math.max(.05, controls.maxDistance - lastRadius));
      // Deco ở trường mẫu giáo: zoom ra quá tầm thường thì trôi về giữa cả khu nhà + trường (thấy trọn ngoại cảnh).
      clampDelta.copy(decoMode && !(zoneId === 'kinder' && radius > HUB_MAX) ? zoneCenter(zoneId, tmpCenter) : siteCenter()).sub(controls.target).multiplyScalar(k);
      controls.target.add(clampDelta); camera.position.add(clampDelta);
    }
    // Deco: zoom vào (khoảng cách giảm) kéo tâm nhìn về món đang chọn theo đúng tỉ lệ đã zoom, nên zoom sát hết cỡ thì
    // món nằm giữa khung; zoom ra thì tâm trôi về giữa khu (zoom ra hết = thấy trọn khu như lúc đầu).
    if (!hub && !framing && !glide.active && lastRadius && Math.abs(radius - lastRadius) > 1e-3) {
      const item = zoomFocus && furniture[zoomFocus];
      const zoomIn = radius < lastRadius, goal = zoomIn && item?.visible ? itemBox.setFromObject(item).getCenter(tmpGoal) : zoneCenter(zoneId, tmpGoal);
      if (zoomIn ? item?.visible : true) {
        const k = zoomIn ? Math.min(1, (lastRadius - radius) / Math.max(.05, lastRadius - controls.minDistance))
          : Math.min(1, (radius - lastRadius) / Math.max(.05, controls.maxDistance - lastRadius));
        clampDelta.copy(goal).sub(controls.target).multiplyScalar(k);
        controls.target.add(clampDelta); camera.position.add(clampDelta);
      }
    }
    lastRadius = radius;
    for (const part of [gardenExt, yard, kid, bloom]) if (part.userData.grow !== undefined) { // vườn vừa mở rộng / sân sau vừa mở: nền + đồ trang trí mọc lên
      const g = part.userData.grow = Math.min(1, part.userData.grow + .018);
      part.scale.set(1, Math.max(.01, 1 - (1 - g) ** 3 + Math.sin(g * Math.PI) * .12), 1);
      if (g === 1) { delete part.userData.grow; part.scale.set(1, 1, 1); }
    }
    for (const { room, walls } of Object.values(interiors)) {
    // Phòng vừa mở: mọc từ sàn lên, nảy nhẹ.
    if (room.userData.grow !== undefined) {
      const g = room.userData.grow = Math.min(1, room.userData.grow + .018);
      room.scale.set(1, Math.max(.01, 1 - (1 - g) ** 3 + Math.sin(g * Math.PI) * .12), 1);
      if (g === 1) { delete room.userData.grow; room.scale.set(1, 1, 1); }
    }
    if (!room.visible) continue;
    camDir.copy(camera.position).sub(room.position).sub(site.position); // camera so với tâm phòng
    walls.forEach(wall => {
      const behind = wall.userData.forceHide || camDir.dot(wall.userData.normal) < -HALF + .2;
      wall.userData.opacity += ((behind ? 0 : 1) - wall.userData.opacity) * .18;
      const o = wall.userData.opacity;
      wall.visible = o > .03;
      // Ghi depth ngay khi tường đặc hơn 50%: viền (vẽ sau cùng, không ghi depth) của đồ phía sau tường không lộ xuyên qua
      // tường lúc đang hiện / mờ dần khi xoay. Đồ đặc phía sau vẫn mờ dần qua tường vì đã vẽ trước tường.
      // Kính cửa sổ: độ trong riêng (baseOpacity) nhân với độ mờ của tường, không bao giờ ghi depth (nhìn xuyên ra ngoài).
      wall.traverse(node => { const m = node.material; if (m) { m.opacity = o * (m.userData.baseOpacity ?? 1); m.depthWrite = o > .5 && !m.userData.noDepth; } });
      if (wall.userData.stub) wall.userData.stub.visible = o < .6;
    });
    }
    // Deco: món có đồ mới mua (ở Shop) thay được thì sáng lên nhấp nháy; món đang mở bảng đổi sáng nhẹ đứng yên.
    const pulse = (Math.sin(t * 4) + 1) / 2;
    for (const [slot, node] of Object.entries(furniture)) {
      const here = decoMode && node.visible && itemById(node.userData.itemId)?.zone === zoneId;
      glow(node, !here ? 0 : highlights.has(slot) ? .12 + pulse * .28 : slot === selectedSlot ? .18 : 0);
    }
    Object.values(furniture).forEach(node => {
      if (!node.visible) return;
      if (node.userData.pop < 1) {
        node.userData.pop = Math.min(1, node.userData.pop + .06);
        const p = node.userData.pop, s = 1 + Math.sin(p * Math.PI) * .18 - (1 - p) * .5;
        node.scale.setScalar(Math.max(.01, s));
      }
      node.userData.update?.(t);
    });
    brush(Math.min(.05, (now - (lastFrame || now)) / 1000));
    decoFx.update(Math.min(.05, (now - (lastFrame || now)) / 1000));
    updateCoins(Math.min(.05, (now - (lastFrame || now)) / 1000));
    // Bướm bay trong nhóm vườn: toạ độ theo tâm vườn, giống vị trí bồn hoa.
    if (furniture.flowers?.visible) flowerCenter.set(furniture.flowers.position.x, 0, furniture.flowers.position.z); else flowerCenter.set(0, 0, 0);
    butterflies.forEach(b => b.update(t, Math.min(.05, (now - (lastFrame || now)) / 1000), flowerCenter));
    if (gardenExt.visible) { // vườn mở rộng: bướm quanh khóm hướng dương (toạ độ vườn)
      if (furniture.sunflowers?.visible) sunCenter.set(PLACES.sunflowers[0], 0, PLACES.sunflowers[1]); else sunCenter.set(GARDEN_EXT_X - 1, 0, 1.5);
      butterflies2.forEach(b => b.update(t, Math.min(.05, (now - (lastFrame || now)) / 1000), sunCenter));
    }
    stepFade(Math.min(.05, (now - (lastFrame || now)) / 1000));
    cats.update((now - (lastFrame || now)) / 1000, t, document.body.classList.contains('afk'));
    rideAlong();
    lastFrame = now;
    // Mặt phẳng gần (near) đi theo độ xa của camera: near cố định .1 thì zoom ra xa (tới ~80 m) độ chính xác depth chỉ còn vài mm, các tấm phẳng
    // sát nhau (sàn lớp, bãi cát, vạch đường, thảm) tranh nhau chập chờn. Camera luôn cao >= ~1/3 khoảng nhìn nên near = 6% khoảng nhìn không cắt gì.
    const nearNow = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * .06, .1, 4);
    if (Math.abs(camera.near - nearNow) > camera.near * .05) { camera.near = nearNow; camera.updateProjectionMatrix(); }
    if (now - lastShadowAt >= SHADOW_STEP_MS) { sun.shadow.needsUpdate = true; lastShadowAt = now; }
    const restoreShadows = castLampShadows();
    if (TOON) {
      // Tìm vật mới cần viền: duyệt cả cảnh (~900 node) tốn ~0.6 ms nếu chạy mỗi khung (đo được). Vật mới đều nảy từ nhỏ lên
      // (pop) nên chạy mỗi 4 khung (~60 ms) không thấy thiếu viền.
      if ((outlineScan = (outlineScan + 1) % 4) === 1) addOutlines(scene);
      // Viền tạo lúc vẽ khung đầu tiên (addOutlines): bật / tắt viền đồ cố định khi chuyển giữa Home và Deco.
      if (fixedOutlineHidden !== decoMode) {
        fixedOutlineHidden = decoMode;
        fixedDecor.forEach(root => root.traverse(node => { if (node.userData.outline) node.visible = !fixedOutlineHidden; }));
      }
      syncOutlineResolution(renderer); setOutlineTint(inkNow);
      // Zoom xa thì viền mảnh lại (tới -45% ở xa nhất): chống nét đè kín nan rào / vật mỏng và nhấp nháy khi xoay.
      setOutlineZoom(1 - .45 * THREE.MathUtils.clamp((camera.position.distanceTo(controls.target) - controls.minDistance) / Math.max(1e-3, controls.maxDistance - controls.minDistance), 0, 1));
      renderOutlineIds(renderer, scene, camera);
    }
    renderer.render(scene, camera);
    restoreShadows?.();
    onFrame?.(); // UI bám theo cảnh (bảng đổi món, ghim NEW): đặt ngay sau khi vẽ, cùng khung hình, không trễ một nhịp
  }

  const resize = () => {
    if (!container) return;
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    // Khung tràn viền có UI đè trên/dưới (`view.insets`): dời tâm ống kính vào phần còn nhìn thấy bằng cách
    // vẽ một khung con (cao h) của khung lớn cao h + |lệch|, rồi zoom theo đúng phần nhìn thấy đó.
    const { top = 0, bottom = 0 } = view.insets?.() || {};
    const visibleH = Math.max(1, h - top - bottom), shift = bottom - top, fullH = h + Math.abs(shift);
    viewFullH = fullH;
    camera.aspect = w / fullH;
    if (shift) camera.setViewOffset(w, fullH, 0, Math.max(0, shift), w, h);
    else camera.clearViewOffset();
    // Khung dọc (hẹp hơn cao) thì lùi ống kính để phòng không bị cắt hai bên.
    camera.zoom = Math.min(view.zoomCap, (w / visibleH) / view.zoomFit) * visibleH / fullH;
    camera.updateProjectionMatrix();
  };
  let viewFullH = 1;
  const observer = new ResizeObserver(resize);
  let view = { zoomCap: 1, zoomFit: 1.05, insets: null };

  return {
    // Gắn canvas vào khung (Home hoặc Deco). Chỉ một khung dùng renderer tại một thời điểm.
    // options.view = { insets() -> { top, bottom } px bị UI che, zoomCap, zoomFit } cho khung tràn viền.
    // options.mode = 'hub' (Home: kéo đi khắp khu nhà) | 'room' (Deco: khoá vào khu đang trang trí, mặc định).
    mount(target, options = {}) {
      clearPreviewHidden();
      container = target;
      view = { zoomCap: 1, zoomFit: 1.05, insets: null, ...options.view };
      target.dataset.zone = zoneId;
      setMode(options.mode || 'room');
      lockView(false);
      decoMode = !!options.deco;
      autoRotate = !!options.autoRotate;
      controls.autoRotate = autoRotate;
      stopGlide();
      // Deco: tâm nhìn về đúng khu đang trang trí (giữ góc xoay / độ xa đang có). Home: bắt đầu từ vườn.
      const home = zoneCenter(hub && !decoMode ? 'garden' : zoneId);
      clampDelta.subVectors(home, controls.target);
      controls.target.add(clampDelta); camera.position.add(clampDelta);
      // Home luôn mở ở góc nhìn đẹp mặc định, dù ở Deco người chơi đã xoay/zoom tới đâu.
      if (options.resetView) { camera.position.copy(HOME_VIEW).add(home).setY(HOME_VIEW.y + home.y - .8); }
      // Deco ở vườn đã mở rộng: lùi xa hơn góc Home mặc định cho thấy trọn cả vườn.
      if (decoMode && zoneReach(zoneId) > 1) camera.position.sub(controls.target).setLength(HOME_VIEW.length() * WIDE).add(controls.target);
      controls.update();
      lastRadius = 0;
      // Phòng vừa mở: lùi ra rồi lướt tới giữa khu nhà để người chơi thấy phòng mới mọc lên.
      if (giftPending && !bloom.visible) setTimeout(revealGift, 600);
      if (hub && !decoMode && revealPending) {
        zoneGroup(revealPending).userData.grow = 0;
        revealPending = null;
        camera.position.sub(controls.target).multiplyScalar(1.45).add(controls.target);
        glideTo(siteCenter(), 1200);
      }
      if (renderer.domElement.parentElement !== target) target.prepend(renderer.domElement);
      observer.disconnect();
      observer.observe(target);
      resize();
      renderer.setAnimationLoop(frame);
    },
    qcPreview,
    stop() { clearPreviewHidden(); renderer.setAnimationLoop(null); lastFrame = 0; },
    apply,
    focus,
    frameItem,
    // Deco: fn({ zone, key, x, y }) khi chạm món (key = chỗ đặt) / sàn / tường; chạm chỗ khác: chỉ có x, y.
    onPick(fn) { onPick = fn; },
    // Deco: fn(khu) khi người chơi kéo cảnh sang khu khác (khu đang ở giữa đổi).
    onZoneView(fn) { onZoneView = fn; },
    // Deco: fn('pet' | 'carry') khi người chơi chạm cưng / nhấc một con mèo (hướng dẫn mèo dùng).
    onCatEvent(fn) { onCatEvent = fn; },
    // fn() gọi sau mỗi lần vẽ cảnh — UI bám theo món dùng cái này thay cho requestAnimationFrame riêng.
    onFrame(fn) { onFrame = fn; },
    // Deco: các chỗ có món mới mua thay được (sáng nhấp nháy).
    setHighlights(keys) { highlights = new Set(keys); },
    screenOf,
    setGhost,
    screenOfGhost,
    screenRectOf,
    screenRectOfCat,
    screenOfCatHead,
    flyCoins,
    // Hướng dẫn: giữ mèo giống `breed` ngồi yên nhìn camera (on = true) / thả ra (false). nearSlot: chỗ đặt (vườn) mà hướng dẫn
    // sắp chỉ tới — mèo ngồi sẵn cạnh đó để camera lướt tới món thì mèo vẫn trong khung.
    holdCat: (breed, on, nearSlot) => {
      const place = nearSlot && PLACES[nearSlot], [ox, oz] = ZONE_OFFSET.garden;
      cats.hold(breed, on, place ? { x: ox + place[0], z: oz + place[1] } : null);
    },
    nudge,
    refit: () => resize(),
    // Deco: khoá / mở khoá điều khiển camera (bảng đổi kiểu món đang mở).
    lockView,
    // Deco: dựng sẵn (ẩn) các món sắp xem thử lúc rảnh, để lần chạm đầu không đứng hình.
    prewarm,
    // Deco: hiệu ứng hạt tại một chỗ — kind = 'preview' | 'swap' | 'buy'.
    fx: playFx,
    openFx,
    setNight, setAmbient,
    // Dev: QC model (qc.mjs) — trả về danh sách lỗi { level, zone, what }.
    // extraScenes: cảnh phụ cho phép kiểm toon (bản đồ màn: { map: scene }).
    qc: (extraScenes = {}) => runModelQC({ toonScenes: { deco: scene, ...extraScenes }, shells: [[ground, groundLong], [yard], [kid], [bloom], ...Object.values(interiors).map(inside => inside.room)], BUILD, interiors, specs: INTERIOR_SPECS, wallDefs: WALL_DEFS, zoneOffset: ZONE_OFFSET, setLeaf, gardenCorners, outdoorDecor: { garden: garden2Decor, backyard: backyardDecor, kinder: kinderDecor } }),
  };
}
