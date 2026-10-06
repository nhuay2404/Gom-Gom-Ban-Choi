// Phòng mèo 3D (Three.js) dùng chung cho Home và Deco: kéo để xoay 360°, chụm hai ngón để zoom.
// Tường nào chắn giữa camera và phòng thì mờ đi (kiểu nhà búp bê). Đồ đạc dựng từ khối cơ bản bo tròn.
// Mèo khối 3D và hành vi của chúng nằm ở room-cats.mjs; chạm mèo để cưng.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCatLife } from './room-cats.mjs';
import { TOON, TOON_LIGHT, TOON_FOV, toonMat, toonLook, addOutlines, syncOutlineResolution, renderOutlineIds, markOutlineUnit, OUTLINE_LAYER, DECAL_LAYER, FLOOR_OFFSET } from './toon.mjs';
import { playSound } from '../ui/sound.mjs';
import { CATALOG, itemById, zoneState, slotOf } from './deco-data.mjs';
import { PLACES, WALL_H, ROOM_HALF, ZONE_OFFSET, DOOR, BEDROOM_DOOR, BEDROOM_WINDOW_X, OBSTACLE_RADIUS, HILL, HILL_OBSTACLE_R, groundHeight, GARDEN_EXT_X, gardenBounds } from './room-layout.mjs';
import { TIMING, DRAG } from '../gameplay/tuning.mjs';
import { BEDROOM_BUILD, bedroomDecor, decorateBedroomWall } from './bedroom-scene.mjs';
import { GARDEN2_BUILD, buildHill, garden2Decor, SHADOW_ONLY_LAYER } from './garden2-scene.mjs';
import { runModelQC } from './qc.mjs';
import { GARDEN_BUILD, groundTexture, buildFence, gardenCorners, makeButterflies, ropeBetween, pendulum } from './garden-scene.mjs';

const HALF = ROOM_HALF, TAU = Math.PI * 2;
// Vật liệu đồ đạc kiểu vật lý: gỗ / sơn / vải đều nhám (roughness cao), phản xạ điện môi thấp (specularIntensity)
// nên không loé bóng như nhựa. Nước, kính, kim loại tự ghi đè roughness/metalness riêng.
const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
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
    at(new THREE.Mesh(new THREE.PlaneGeometry(w - .1, h - .1), new THREE.MeshBasicMaterial({ color: artColor, transparent: true })), u, y, .16),
    at(new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * .18, 20), new THREE.MeshBasicMaterial({ color: '#fff6e4', transparent: true })), u + w * .12, y + h * .1, .165));
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
      const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshBasicMaterial({ color: FLAGS[k % FLAGS.length], transparent: true, side: THREE.DoubleSide }));
      flag.position.copy(p).setZ(.21); flag.rotation.z = Math.atan2(tan.y, tan.x);
      wall.add(flag);
    }
  }
  if (i === 2) { // tranh lớn (u .4 = z -.4, tránh chao đèn cây) + cụm tranh nhỏ trên tủ thấp (tủ ở z ≈ .5 -> u ≈ -.5; cửa phòng ngủ ở u = -2.3)
    wall.add(wallFrame(1, 1.2, '#e0b36a', '#ffc9d5', .4, 1.9),
      wallFrame(.5, .64, '#c98a55', '#bfe6ff', -1, 1.75), wallFrame(.42, .42, '#fff4e0', '#ffd66b', -.45, 1.95),
      wallFrame(.36, .46, '#e0b36a', '#c9e8b0', -.47, 1.45));
  }
  if (i === 3) { // đồng hồ tròn + kệ treo trên ổ mèo (z phòng ≈ 2.7): chậu cây rủ lá + chồng sách nhỏ
    wall.add(at(mesh(new THREE.CylinderGeometry(.34, .34, .06, 32), onWall('#ffffff')), -1.3, 2.2, .13).rotateX(Math.PI / 2));
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
// đáy tầng xuống đỉnh quả bóng, cả dây + bóng lắc như con lắc (garden-scene.mjs pendulum).
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
  // Nệm trái tim (thay ổ mèo): viền tim phồng + nệm lót; mèo nằm ở .14 như ổ gốc.
  'catbed-heart'() {
    const heart = s => {
      const pts = [];
      for (let k = 0; k < 64; k++) {
        const t = k / 64 * TAU;
        pts.push(new THREE.Vector2(16 * Math.sin(t) ** 3 / 17 * s, ((13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + .15) * s));
      }
      return new THREE.Shape(pts);
    };
    const slab = (shape, depth, bevel, color, y) => {
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24 });
      geo.rotateX(-Math.PI / 2).translate(0, bevel, 0); // nằm phẳng, đáy ở y = 0; đỉnh tim quay ra sau (-z), mũi tim ra trước
      return at(mesh(geo, color), 0, y, 0);
    };
    const ring = heart(.62); ring.holes.push(new THREE.Path(heart(.44).getPoints()));
    return group(slab(heart(.5), .06, .03, '#ffc9d5', 0), slab(heart(.4), .04, .03, '#fff7ea', .07), slab(ring, .16, .05, '#ff8fb8', 0));
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
    const wood = '#f5f0e6', edge = '#e3ddd1', parts = [at(box(1.6, 2, .04, edge), 0, 1, -.23), at(box(.06, 2, .5, wood), -.77, 1, 0), at(box(.06, 2, .5, wood), .77, 1, 0)];
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
Object.assign(BUILD, GARDEN_BUILD, BEDROOM_BUILD, GARDEN2_BUILD);

// Dựng một món trong danh mục. Phương án thay thế có model riêng (BUILD[id]) nhưng giữ khuôn khổ và các móc
// cho mèo của món gốc (userData.fish / leaves / bird / toy / mug, độ cao chỗ ngồi) — xem room-cats.mjs useFurniture.
// Món đồ không có bộ phận nào cử động riêng (mèo / hiệu ứng không giữ tham chiếu tới khối con): gộp khối cùng màu.
const STATIC_ITEMS = new Set(['cathouse', 'shelf', 'rug', 'rug-quilt', 'sandbox', 'armchair', 'bench', 'slide',
  'bed', 'bed-canopy', 'bedrug', 'bedrug-cloud', 'desk', 'desk-study', 'chair-beanbag', 'closet', 'closet-dresser', 'plushie', 'plushie-dino', 'laundry', 'catsteps-bridge',
  'rug-fish', 'armchair-papasan', 'catbed-heart', 'shelf-cubby', 'bed-kitty', 'bedrug-star', 'laundry-washer', 'desk-piano', 'chair-stool',
  'closet-ladder', 'plushie-bunny', 'catsteps-clouds']);
function buildItem(entry) {
  const node = BUILD[entry.id]();
  if (STATIC_ITEMS.has(entry.id)) mergeStatic(node);
  node.userData.itemId = entry.id;
  return markOutlineUnit(node);
}

// ---------- Sàn: vân gỗ / thảm / gạch vẽ bằng canvas ----------
function floorTexture(entry) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = entry.color; g.fillRect(0, 0, 512, 512);
  if (entry.id.endsWith('-tiles')) {
    g.fillStyle = '#ffffff55';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
    g.strokeStyle = '#ffffff99'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
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

function thumbStudio() {
  if (thumbKit) return thumbKit;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(192, 192, false);
  const scene = new THREE.Scene();
  physicalLook(renderer, scene);
  scene.add(new THREE.HemisphereLight('#fff8e8', '#e0b98a', TOON ? 1.15 * TOON_LIGHT.hemi : 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', TOON ? 1.7 * TOON_LIGHT.sun : 1.9); // toon: cùng ánh sáng với phòng để icon khớp màu
  sun.position.set(3, 7, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(TOON ? TOON_FOV : 28, 1, .05, 60);
  camera.layers.enable(OUTLINE_LAYER); camera.layers.enable(DECAL_LAYER);
  return (thumbKit = { renderer, scene, camera });
}
const slab = (w, d, top, edge = '#c79a5f') => {
  const node = mesh(new THREE.BoxGeometry(w, .12, d), mat(edge));
  node.material = [mat(edge), mat(edge), top, mat(edge), mat(edge), mat(edge)];
  node.position.y = -.06;
  return node;
};
const OUTDOOR = new Set(['garden']); // khu ngoài trời: nền cỏ + hàng rào thay cho sàn + tường
function thumbSubject(entry) {
  if (entry.cat === 'furniture') return buildItem(entry);
  if (entry.cat === 'floors') { // tấm sàn / nền đúng texture
    const top = mat('#ffffff', { roughness: .9, map: OUTDOOR.has(entry.zone) ? groundTexture(entry) : floorTexture(entry) });
    return group(slab(1.6, 1.6, top));
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
export function thumbnail(entry) {
  if (thumbCache[entry.id]) return thumbCache[entry.id];
  const { renderer, scene, camera } = thumbStudio();
  const subject = thumbSubject(entry);
  subject.userData.update?.(0);
  scene.add(subject);
  addOutlines(subject);
  subject.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(subject), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const radius = size.length() / 2, distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * .82;
  camera.position.copy(center).add(new THREE.Vector3(.75, .62, 1).normalize().multiplyScalar(distance));
  camera.lookAt(center);
  syncOutlineResolution(renderer);
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
  physicalLook(renderer, scene);
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
    controls.maxDistance = hub ? HUB_MAX : 18 * reach * zoneReach(zoneId);
    controls.minDistance = (hub ? HUB_MIN : 9 * reach);
  }
  // Deco: vườn đã mở rộng dài gấp đôi nên lùi camera xa hơn (và cho thu nhỏ xa hơn) để thấy trọn cả vườn.
  const WIDE = 1.4;
  const zoneReach = zone => zone === 'garden' && expanded ? WIDE : 1;
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
  // Lướt tâm nhìn (và camera theo cùng) tới một điểm.
  let glide = null;
  // `radius`: độ xa camera lúc tới nơi (bỏ trống = giữ nguyên).
  function glideTo(to, ms = 700, radius) {
    const r = camera.position.distanceTo(controls.target);
    glide = { from: controls.target.clone(), to: to.clone(), start: performance.now(), ms, fromR: r, toR: radius ?? r };
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
  sun.shadow.camera.layers.enable(SHADOW_ONLY_LAYER); // mây vườn mở rộng: chỉ đổ bóng, không hiện
  if (TOON) sun.shadow.intensity = TOON_LIGHT.shadow; // bóng đổ nhạt, không đen đặc
  // Đẩy điểm so bóng theo pháp tuyến: mặt đứng gần song song tia nắng (vách nhà mèo, tủ...) không bị sọc "shadow acne".
  // Toon chia nấc gắt nên sọc lộ rõ hơn PCFSoft cũ, vì vậy cần normalBias.
  sun.shadow.normalBias = .08; // thử thực tế: .05 vẫn còn sọc mờ trên vách nhà mèo, .08 sạch mà bóng mèo trên sàn vẫn dính chân
  scene.add(sun);

  // ---------- Khu nhà: vườn + phòng khách + phòng ngủ nối liền (room-layout.mjs ZONE_OFFSET) ----------
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
  // Bệ diorama: chỉ vườn, hoặc một bệ dài đỡ cả vườn lẫn phòng khách khi đã mở phòng; phòng ngủ có bệ riêng
  // chồng mép lên bệ dài (hai bệ liền nhau thành chữ L).
  const LZ = ZONE_OFFSET.living[1], BASE_W = HALF * 2 + .7;
  const gardenBase = at(rbox(BASE_W, .5, BASE_W, .18, '#fff4da'), 0, -.52, 0);
  const siteBase = at(rbox(BASE_W, .5, BASE_W - LZ, .18, '#fff4da'), 0, -.52, LZ / 2);
  const bedroomBase = at(rbox(BASE_W + .6, .5, BASE_W, .18, '#fff4da'), ZONE_OFFSET.bedroom[0] + .3, -.52, ZONE_OFFSET.bedroom[1]);
  site.add(gardenBase, siteBase, bedroomBase);
  // Nền cỏ / sàn lùi theo độ dốc (FLOOR_OFFSET). Lùi camera ra xa thì mặt cỏ nhìn xiên bị đẩy lùi hơn 27 cm, khối đế kem nằm
  // bên dưới đè lên cỏ thành mảng kem cắt chéo. Đế lùi cùng mức nên luôn nằm sau mặt cỏ / sàn.
  [gardenBase, siteBase, bedroomBase].forEach(base => base.traverse(node => { if (node.material) Object.assign(node.material, FLOOR_OFFSET); }));

  const groundMat = Object.assign(mat('#9fd46a', { roughness: .95 }), FLOOR_OFFSET), soil = mat('#8a6a45');
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
  fixedDecor.push(cornersSquare, cornersLong);
  // Deco: chạm nền cỏ / sàn = đổi nền, chạm rào / tường = đổi rào (slotAt). Đồi + đồ trang trí phần mở rộng tính là nền.
  [ground, groundLong].forEach(node => { node.userData.pickSurface = { zone: 'garden', key: 'floors' }; });
  // Phần vườn mở rộng (toạ độ vườn, x ≈ 4..12): đồi (cùng texture nền cỏ) + đồ trang trí cố định (lối đá, bóng mây...).
  // Chung nền + hàng rào với vườn; bệ diorama nối dài thêm một ô.
  const gardenExt = new THREE.Group();
  garden.add(gardenExt);
  const extBase = at(rbox(BASE_W, .5, BASE_W, .18, '#fff4da'), GARDEN_EXT_X, -.52, 0);
  site.add(extBase);
  extBase.traverse(node => { if (node.material) Object.assign(node.material, FLOOR_OFFSET); }); // như các đế khác (xem trên)
  const hillMat = mat('#9fd46a', { roughness: .95 });
  const decor2 = garden2Decor();
  gardenExt.add(buildHill(hillMat), decor2);
  fixedDecor.push(decor2);
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
  // Cánh cửa bản lề ở một mép ô cửa. swing = 1: bản lề mép b, mở hé vào phòng nằm dọc tường về phía +u;
  // swing = -1: bản lề mép a, mở về phía -u (chọn phía không có đồ kê sát tường). Đóng: nằm gọn trong ô cửa.
  function setLeaf(leaf, open) {
    const swing = leaf.userData.swing;
    leaf.position.set(leaf.userData.hinge, 0, open ? .16 : 0);
    leaf.rotation.y = swing > 0 ? (open ? Math.PI - .4 : 0) : (open ? .4 : Math.PI);
  }
  // spec: { doors: { [chỉ số tường]: { u, leaf, swing, threshold } }, windowU (cửa sổ tường sau), decorate(i, wall), decor() }
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
        wall = group(piece(-E, a, 0, WALL_H, wallMat), piece(b, E, 0, WALL_H, wallMat), piece(a, b, DOOR.h, WALL_H, wallMat),
          piece(-E, a, 0, .2, trim, .08, .13), piece(b, E, 0, .2, trim, .08, .13),
          // Khung nhô .02 vào lòng cửa: mặt trong khung nằm trước mép tường, không trùng mặt phẳng (trùng thì hai màu chớp giật).
          piece(a - .1, a + .02, 0, DOOR.h + .1, frame, .28), piece(b - .02, b + .1, 0, DOOR.h + .1, frame, .28), piece(a - .1, b + .1, DOOR.h - .02, DOOR.h + .1, frame, .28));
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
        const stub = group(piece(-E, a, 0, .32, stubMat), piece(b, E, 0, .32, stubMat), piece(a - .1, a + .02, 0, .36, mat('#f6d88f'), .28), piece(b - .02, b + .1, 0, .36, mat('#f6d88f'), .28));
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
      } else {
        wall = group(at(mesh(new THREE.BoxGeometry(WALL_W, WALL_H, .2), wallMat), 0, WALL_H / 2, 0),
          at(box(WALL_W, .2, .08, trim), 0, .1, .13));
      }
      if (i === 0) { // cửa sổ vòm
        const frame = mat('#f6d88f', { transparent: true }), u = spec.windowU;
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true }));
        const arch = new THREE.Mesh(new THREE.CircleGeometry(.6, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true }));
        windowGlass.push(sky.material, arch.material); // ban đêm: cửa sổ tối lại
        wall.add(at(sky, u, 1.55, .125), at(arch, u, 2.2, .125), // kính cách mặt tường .025: nhìn xa không chớp
          at(mesh(new THREE.BoxGeometry(1.34, .1, .12), frame), u, .88, .16));
      }
      spec.decorate(i, wall);
      mergeStatic(wall); // mảng tường + khung + đồ treo cùng chất liệu -> ít mesh (độ mờ vẫn chỉnh theo từng chất liệu)
      if (leaves[i]) wall.add(leaves[i]); // cánh cửa cử động theo trạng thái mở khoá: gắn sau khi gộp
      wall.position.set(pos[0], 0, pos[1]);
      wall.rotation.y = rot;
      wall.traverse(node => { if (node.isMesh) node.castShadow = false; });
      Object.assign(wall.userData, { normal, opacity: 1 });
      room.add(wall);
      wall.userData.pickSurface = { zone, key: 'walls' };
      return wall;
    });
    fixedDecor.push(...walls); // tường + đồ treo tường (tranh, kệ, rèm...) gộp chung một khối
    return { zone, room, floorMat, wallMats, stubs, walls, leaves, floorId: '' };
  }
  const INTERIOR_SPECS = {
    // Phòng khách: cửa ra vườn ở tường trước (tường xoay π: x cục bộ = -x phòng nên u = -DOOR.x), cửa sang phòng ngủ
    // ở tường trái (u = -z phòng); cánh cửa này đóng khi phòng ngủ còn khoá và mở về phía góc trước (z +), không đè lên
    // tủ thấp kê sát tường phía sau cửa. Bậc cửa phủ khe giữa hai sàn.
    living: {
      doors: { 1: { u: -DOOR.x, leaf: true, threshold: true }, 2: { u: -BEDROOM_DOOR.z, leaf: true, swing: -1, threshold: true } },
      windowU: DOOR.x, decorate: decorateWall, decor: livingDecor,
    },
    // Phòng ngủ: cửa ở tường phải (u = z phòng) tựa lưng vào cửa phòng khách; cánh cửa + bậc cửa đã có bên phòng khách.
    bedroom: {
      doors: { 3: { u: BEDROOM_DOOR.z, leaf: false, threshold: false } },
      windowU: BEDROOM_WINDOW_X, decorate: decorateBedroomWall, decor: bedroomDecor,
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

  // Ngày / đêm: đêm thì trời tối, nắng thành ánh trăng xanh nhạt, đèn (lồng, đuốc, đèn đứng, máy sưởi) rực hơn,
  // bướm đi ngủ, mèo hay ngủ hơn (room-cats.mjs đọc ctx.night).
  let night = false;
  const LIGHTING = {
    day: { sky: '#fff8e8', ground: '#e0b98a', hemi: 1.15, sun: '#fff1d6', sunI: 1.7, glass: '#cfeaff', lamps: 1, env: .4 },
    night: { sky: '#7f8fd0', ground: '#3a3550', hemi: .4, sun: '#a9bcff', sunI: .6, glass: '#1e2747', lamps: 1.8, env: .1 },
  };
  function lightUp(node) { // đèn của đồ đạc sáng hơn ban đêm
    node.traverse(child => {
      if (!child.isPointLight) return;
      child.userData.baseIntensity ??= child.intensity;
      child.intensity = child.userData.baseIntensity * LIGHTING[night ? 'night' : 'day'].lamps;
    });
  }
  function setNight(on) {
    night = !!on;
    const look = LIGHTING[night ? 'night' : 'day'];
    hemi.color.set(look.sky); hemi.groundColor.set(look.ground); hemi.intensity = look.hemi * (TOON ? TOON_LIGHT.hemi : 1);
    sun.color.set(look.sun); sun.intensity = look.sunI * (TOON ? TOON_LIGHT.sun : 1);
    scene.environmentIntensity = look.env;
    windowGlass.forEach(m => m.color.set(look.glass));
    butterflies.forEach(b => { b.node.visible = !night; });
    Object.values(furniture).forEach(lightUp);
  }

  // Mèo: đàn mèo khối 3D có "não" riêng (room-cats.mjs). Tim bay lên khi mèo cụng mũi / liếm lông nhau.
  let container = null;
  const cats = createCatLife({
    scene, furniture, butterflies,
    zones: () => openZones(),
    // Mặt đất (độ cao) tại điểm khu nhà: đồi ở phần vườn mở rộng, còn lại phẳng. Vật cản cố định: đồi (mèo chỉ lên bằng hành vi trèo đồi).
    groundAt: (x, z) => expanded ? groundHeight('garden', x, z) : 0, // vườn ở gốc toạ độ: toạ độ vườn = toạ độ khu nhà
    staticObstacles: () => expanded ? [{ id: 'hill', x: HILL.x, z: HILL.z, r: HILL_OBSTACLE_R }] : [],
    get night() { return night; },
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
  const opened = { garden: true, living: false, bedroom: false };
  const OPENABLE = ['living', 'bedroom'];
  const zoneGroup = zone => zone === 'garden2' ? gardenExt : interiors[zone]?.room; // nhóm "mọc lên" khi vừa mở
  // Các ô đi lại đã mở (mèo, giới hạn kéo camera, tâm khu nhà): vườn mở rộng thêm ô 'garden2' bên phải vườn.
  const openZones = () => [...Object.keys(opened).filter(zone => opened[zone]), ...(expanded ? ['garden2'] : [])];
  // Tâm một khu trong toạ độ thế giới (cao ngang tâm nhìn .8) và tâm cả khu nhà (giữa các khu đã mở).
  const zoneCenter = (zone, out = new THREE.Vector3()) => out.set(ZONE_OFFSET[zone][0] + (zone === 'garden' && expanded ? GARDEN_EXT_X / 2 : 0), .8, ZONE_OFFSET[zone][1]);
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
  // `open` = { living, bedroom, gardenExpand }: khu nào đã mở (thắng màn 10 / 15), vườn đã mở rộng chưa (màn 30).
  // Bỏ trống thì giữ như lần trước.
  function apply(deco, open = {}) {
    const was = { ...opened }, wasExpanded = expanded, fromReach = zoneReach(zoneId);
    for (const zone of OPENABLE) opened[zone] = open[zone] ?? opened[zone];
    expanded = open.gardenExpand ?? expanded;
    opened.bedroom &&= opened.living; // phòng ngủ đi qua phòng khách
    const zone = opened[deco.zone] ? deco.zone : 'garden';
    for (const id of ROOM_ZONES) interiors[id].room.visible = opened[id];
    gardenExt.visible = extBase.visible = groundLong.visible = cornersLong.visible = expanded;
    ground.visible = cornersSquare.visible = !expanded;
    siteBase.visible = opened.living; gardenBase.visible = !opened.living; bedroomBase.visible = opened.bedroom;
    doormat.visible = opened.living;
    setLeaf(interiors.living.leaves[2], opened.bedroom); // cửa phòng khách -> phòng ngủ: đóng khi phòng ngủ còn khoá
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
    // (cạnh -z, u = x tính từ tâm rào) khi đã có phòng khách.
    const key = `${fenceEntry.id}|${opened.living}|${expanded}`;
    if (fenceKey !== key) {
      fenceKey = key;
      if (fence) garden.remove(fence);
      const cx = expanded ? GARDEN_EXT_X / 2 : 0;
      fence = buildFence(fenceEntry, HALF, opened.living ? [{ side: 0, u: DOOR.x - cx, w: DOOR.w }] : [], HALF + cx);
      fence.position.x = cx;
      fence.userData.pickSurface = { zone: 'garden', key: 'walls' };
      garden.add(fence);
    }
    if (groundId !== groundEntry.id) {
      groundId = groundEntry.id;
      groundMat.map = groundTextures[groundId] ||= groundTexture(groundEntry);
      groundMat.color.set('#d6dccb'); groundMat.needsUpdate = true; // nhân tối nhẹ texture cỏ cho đỡ chói
      hillMat.map = groundMat.map; hillMat.color.copy(groundMat.color); hillMat.needsUpdate = true; // đồi cùng nền cỏ
    }
    // Tường / sàn riêng từng phòng.
    for (const id of ROOM_ZONES) {
      const inside = interiors[id], state = zoneState(deco, id);
      const wall = itemById(state.wall), floorEntry = itemById(state.floor);
      inside.wallMats.forEach(m => m.color.set(wall.color));
      inside.stubs.forEach(m => m.color.set(wall.color));
      if (inside.floorId !== floorEntry.id) {
        inside.floorId = floorEntry.id;
        inside.floorMat.map = floorTextures[floorEntry.id] ||= floorTexture(floorEntry);
        inside.floorMat.color.set('#ffffff');
        inside.floorMat.needsUpdate = true;
      }
    }
    CATALOG.filter(entry => entry.cat === 'furniture' && !entry.slot).forEach(base => {
      const shown = opened[base.zone] && (base.area !== 'garden2' || expanded); // đồ phần mở rộng: chỉ khi vườn đã mở rộng
      const placedId = shown && zoneState(deco, base.zone).placed.find(id => slotOf(itemById(id)) === base.id);
      if (!placedId) { if (furniture[base.id]) furniture[base.id].visible = false; return; }
      const before = furniture[base.id], node = piece(itemById(placedId));
      if (node !== before || !node.visible) node.userData.pop = 0; // vừa hiện / vừa đổi phương án: nảy lên
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
    cats.furnitureChanged();
    if (catKey !== deco.cats.join()) { catKey = deco.cats.join(); cats.setCats(deco.cats); }
  }

  // Quay camera về phía một món đồ (camera đứng đối diện, nhìn món đồ tựa lưng vào tường).
  // Món đó cũng thành tâm zoom ở Deco (zoomFocus): zoom vào thì tâm nhìn trượt dần tới món, zoom ra thì về giữa khu.
  // focus(null) = bỏ chọn, zoom lại quanh giữa khu.
  let turn = null, zoomFocus = null;
  // turnTo = false: giữ góc xoay đang có (chạm thẳng vào món trong cảnh: người chơi đang nhìn thấy nó rồi).
  const FOCUS_ZOOM = 12; // khoảng cách camera = cỡ món × FOCUS_ZOOM (FOV toon hẹp), kẹp trong 55%–110% độ xa mặc định
  // lift (px): món nằm thấp hơn giữa khung chừng ấy — chừa chỗ phía trên cho bảng đổi món, tính sẵn trong cú lướt.
  function focus(id, turnTo = true, lift = 0) {
    const slot = id && slotOf(itemById(id) || { id }), place = slot && PLACES[slot];
    zoomFocus = place ? slot : null;
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
    if (!turnTo) return;
    const from = controls.getAzimuthalAngle();
    let to = Math.atan2(-place[0], -place[1]);
    to = from + ((((to - from) % TAU) + TAU + Math.PI) % TAU - Math.PI);
    turn = { from, to, start: performance.now() };
  }

  // ---------- Deco: chạm món / bề mặt, sáng nhẹ món có đồ mới, toạ độ màn hình của món (để đặt bảng đổi món cạnh nó) ----------
  let onPick = null, onZoneView = null, selectedSlot = null, highlights = new Set();
  // Khung (toạ độ thế giới) của một khu: vườn theo hàng rào (đã mở rộng thì dài), phòng = sàn 8 × 8 quanh tâm khu.
  function zoneRect(zone) {
    if (zone === 'garden') return gardenBounds(expanded);
    const [ox, oz] = ZONE_OFFSET[zone];
    return { x0: ox - HALF, x1: ox + HALF, z0: oz - HALF, z1: oz + HALF };
  }
  const insideZone = (zone, p, margin) => { const r = zoneRect(zone); return p.x > r.x0 + margin && p.x < r.x1 - margin && p.z > r.z0 + margin && p.z < r.z1 - margin; };
  // Deco: người chơi kéo cảnh sang hẳn khu khác (tâm nhìn vào sâu trong khu đó .4 m) thì Deco đổi theo khu đang ở giữa.
  function followDrag() {
    if (!decoMode || !onZoneView || glide || turn || insideZone(zoneId, controls.target, 0)) return;
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
  function nudge(dy) {
    if (!container || !dy || glide) return true; // đang lướt tới món: đợi lướt xong
    groundShift(dy, camera.position.distanceTo(controls.target), groundFwd);
    const before = controls.target.clone();
    controls.target.add(groundFwd); camera.position.add(groundFwd);
    if (hub) clampPan();
    return before.distanceToSquared(controls.target) > 1e-6;
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
    controls.enableRotate = false; controls.enableZoom = false; controls.enablePan = false; controls.autoRotate = false; turn = null; glide = null;
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
    controls.enableRotate = true; controls.enableZoom = true; controls.enablePan = hub;
    renderer.domElement.classList.remove('carrying');
  }
  // Home: vặn 2 ngón = xoay khu nhà quanh trục đứng qua tâm nhìn (OrbitControls chỉ lo chụm zoom + trượt 2 ngón).
  // Góc vặn phải vượt ngưỡng mới bắt đầu xoay, để lúc chụm zoom khu nhà không lắc theo vài độ run tay.
  const TWIST_START = .12; // rad (~7°)
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
    if (!hub || carrying) return;
    if (!twisting) { twistSum += delta; if (Math.abs(twistSum) < TWIST_START) return; twisting = true; }
    // Vặn theo chiều kim đồng hồ trên màn hình thì khu nhà quay theo: camera quay ngược lại quanh tâm nhìn.
    twistOffset.subVectors(camera.position, controls.target).applyAxisAngle(upAxis, delta);
    camera.position.copy(controls.target).add(twistOffset);
  }
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(type => renderer.domElement.addEventListener(type, trackTouch));
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
      if (cat) { // chạm vui thì tim; chạm dồn dập thì mèo cáu dần rồi nổi giận (room-cats.mjs pet)
        const mood = cat.pet(), x = event.clientX - rect.left, y = event.clientY - rect.top;
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
  controls.addEventListener('start', () => { clearTimeout(resumeTimer); controls.autoRotate = false; turn = null; if (hub) glide = null; });
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
  function frame(now) {
    controls.dampingFactor = 1 - (1 - DAMPING) ** (Math.min(.1, (now - (lastFrame || now)) / 1000 || 1 / 60) * 60);
    const t = now / 1000;
    if (turn) {
      const k = Math.min(1, (now - turn.start) / 650), ease = 1 - (1 - k) ** 3;
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta = turn.from + (turn.to - turn.from) * ease;
      camera.position.setFromSpherical(spherical).add(controls.target);
      if (k === 1) turn = null;
    }
    if (glide) {
      // ease-out bậc 4: bắt đầu ngay theo tay chạm, chậm dần và đậu êm vào chỗ (không khựng ở đầu như ease-in-out)
      const k = Math.min(1, (now - glide.start) / glide.ms), ease = 1 - (1 - k) ** 4;
      clampDelta.lerpVectors(glide.from, glide.to, ease).sub(controls.target);
      controls.target.add(clampDelta); camera.position.add(clampDelta);
      if (glide.toR !== glide.fromR) camera.position.sub(controls.target).setLength(glide.fromR + (glide.toR - glide.fromR) * ease).add(controls.target);
      if (k === 1) glide = null;
    }
    if (hub) clampPan();
    followDrag();
    controls.update();
    // Home: thu nhỏ thì tâm nhìn trôi dần về giữa khu nhà (thu nhỏ hết cỡ = thấy trọn khu nhà ở giữa màn hình).
    const radius = camera.position.distanceTo(controls.target);
    if (hub && !glide && lastRadius && radius > lastRadius + 1e-3) {
      const k = Math.min(1, (radius - lastRadius) / Math.max(.05, HUB_MAX - lastRadius));
      clampDelta.copy(decoMode ? zoneCenter(zoneId, tmpCenter) : siteCenter()).sub(controls.target).multiplyScalar(k);
      controls.target.add(clampDelta); camera.position.add(clampDelta);
    }
    // Deco: zoom vào (khoảng cách giảm) kéo tâm nhìn về món đang chọn theo đúng tỉ lệ đã zoom, nên zoom sát hết cỡ thì
    // món nằm giữa khung; zoom ra thì tâm trôi về giữa khu (zoom ra hết = thấy trọn khu như lúc đầu).
    if (!hub && !glide && !turn && lastRadius && Math.abs(radius - lastRadius) > 1e-3) {
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
    if (gardenExt.userData.grow !== undefined) { // vườn vừa mở rộng: đồi + đồ trang trí mọc lên
      const g = gardenExt.userData.grow = Math.min(1, gardenExt.userData.grow + .018);
      gardenExt.scale.set(1, Math.max(.01, 1 - (1 - g) ** 3 + Math.sin(g * Math.PI) * .12), 1);
      if (g === 1) { delete gardenExt.userData.grow; gardenExt.scale.set(1, 1, 1); }
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
      const behind = camDir.dot(wall.userData.normal) < -HALF + .2;
      wall.userData.opacity += ((behind ? 0 : 1) - wall.userData.opacity) * .18;
      const o = wall.userData.opacity;
      wall.visible = o > .03;
      // Ghi depth ngay khi tường đặc hơn 50%: viền (vẽ sau cùng, không ghi depth) của đồ phía sau tường không lộ xuyên qua
      // tường lúc đang hiện / mờ dần khi xoay. Đồ đặc phía sau vẫn mờ dần qua tường vì đã vẽ trước tường.
      wall.traverse(node => { if (node.material) { node.material.opacity = o; node.material.depthWrite = o > .5; } });
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
    // Bướm bay trong nhóm vườn: toạ độ theo tâm vườn, giống vị trí bồn hoa.
    if (furniture.flowers?.visible) flowerCenter.set(furniture.flowers.position.x, 0, furniture.flowers.position.z); else flowerCenter.set(0, 0, 0);
    butterflies.forEach(b => b.update(t, Math.min(.05, (now - (lastFrame || now)) / 1000), flowerCenter));
    if (gardenExt.visible) { // vườn mở rộng: bóng mây trôi + bướm quanh khóm hướng dương (toạ độ vườn)
      decor2.userData.update(t);
      if (furniture.sunflowers?.visible) sunCenter.set(PLACES.sunflowers[0], 0, PLACES.sunflowers[1]); else sunCenter.set(GARDEN_EXT_X - 1, 0, 1.5);
      butterflies2.forEach(b => b.update(t, Math.min(.05, (now - (lastFrame || now)) / 1000), sunCenter));
    }
    cats.update((now - (lastFrame || now)) / 1000, t, document.body.classList.contains('afk'));
    rideAlong();
    lastFrame = now;
    if (TOON) {
      addOutlines(scene);
      // Viền tạo lúc vẽ khung đầu tiên (addOutlines): bật / tắt viền đồ cố định khi chuyển giữa Home và Deco.
      if (fixedOutlineHidden !== decoMode) {
        fixedOutlineHidden = decoMode;
        fixedDecor.forEach(root => root.traverse(node => { if (node.userData.outline) node.visible = !fixedOutlineHidden; }));
      }
      syncOutlineResolution(renderer); renderOutlineIds(renderer, scene, camera);
    }
    renderer.render(scene, camera);
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
      container = target;
      view = { zoomCap: 1, zoomFit: 1.05, insets: null, ...options.view };
      target.dataset.zone = zoneId;
      setMode(options.mode || 'room');
      decoMode = !!options.deco;
      autoRotate = !!options.autoRotate;
      controls.autoRotate = autoRotate;
      glide = null;
      // Deco: tâm nhìn về đúng khu đang trang trí (giữ góc xoay / độ xa đang có). Home: bắt đầu từ vườn.
      const home = zoneCenter(hub && !decoMode ? 'garden' : zoneId);
      clampDelta.subVectors(home, controls.target);
      controls.target.add(clampDelta); camera.position.add(clampDelta);
      // Home luôn mở ở góc nhìn đẹp mặc định, dù ở Deco người chơi đã xoay/zoom tới đâu.
      if (options.resetView) { turn = null; camera.position.copy(HOME_VIEW).add(home).setY(HOME_VIEW.y + home.y - .8); }
      // Deco ở vườn đã mở rộng: lùi xa hơn góc Home mặc định cho thấy trọn cả vườn.
      if (decoMode && zoneReach(zoneId) > 1) camera.position.sub(controls.target).setLength(HOME_VIEW.length() * WIDE).add(controls.target);
      controls.update();
      lastRadius = 0;
      // Phòng vừa mở: lùi ra rồi lướt tới giữa khu nhà để người chơi thấy phòng mới mọc lên.
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
    stop() { renderer.setAnimationLoop(null); lastFrame = 0; },
    apply,
    focus,
    // Deco: fn({ zone, key, x, y }) khi chạm món (key = chỗ đặt) / sàn / tường; chạm chỗ khác: chỉ có x, y.
    onPick(fn) { onPick = fn; },
    // Deco: fn(khu) khi người chơi kéo cảnh sang khu khác (khu đang ở giữa đổi).
    onZoneView(fn) { onZoneView = fn; },
    // fn() gọi sau mỗi lần vẽ cảnh — UI bám theo món dùng cái này thay cho requestAnimationFrame riêng.
    onFrame(fn) { onFrame = fn; },
    // Deco: các chỗ có món mới mua thay được (sáng nhấp nháy).
    setHighlights(keys) { highlights = new Set(keys); },
    screenOf,
    screenRectOf,
    nudge,
    refit: () => resize(),
    setNight,
    // Dev: QC model (qc.mjs) — trả về danh sách lỗi { level, zone, what }.
    qc: () => runModelQC({ BUILD, interiors, specs: INTERIOR_SPECS, wallDefs: WALL_DEFS, zoneOffset: ZONE_OFFSET, setLeaf, gardenCorners, outdoorDecor: { garden: garden2Decor } }),
  };
}
