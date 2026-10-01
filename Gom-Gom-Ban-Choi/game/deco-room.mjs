// Phòng mèo 3D (Three.js) dùng chung cho Home và Deco: kéo để xoay 360°, chụm hai ngón để zoom.
// Tường nào chắn giữa camera và phòng thì mờ đi (kiểu nhà búp bê). Đồ đạc dựng từ khối cơ bản bo tròn.
// Mèo khối 3D và hành vi của chúng nằm ở room-cats.mjs; chạm mèo để cưng.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCatLife } from './room-cats.mjs';
import { TOON, TOON_LIGHT, TOON_FOV, toonMat, toonLook, addOutlines, syncOutlineResolution, renderOutlineIds, markOutlineUnit, OUTLINE_LAYER, DECAL_LAYER } from './toon.mjs';
import { playSound } from './sound.mjs';
import { CATALOG, itemById, zoneState, slotOf } from './deco-data.mjs';
import { PLACES, WALL_H, ROOM_HALF } from './room-layout.mjs';
import { TIMING, DRAG } from './tuning.mjs';
import { GARDEN_BUILD, groundTexture, buildFence, gardenCorners, makeButterflies } from './garden-scene.mjs';

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
const ROUND = 5, RADIAL = 40;
const rbox = (w, h, d, r, color) => mesh(new RoundedBoxGeometry(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = RADIAL) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, 32, 24), color);
// group() rỗng thì không gọi add(): Three.js báo lỗi khi add() không có đối số.
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };

// ---------- Đồ đạc: mỗi món một hàm dựng (chỗ đặt [x, z, xoay] ở room-layout.mjs) ----------
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
  // ===== Phương án thay thế (deco-data.mjs VARIANTS): khác đồ vật, giữ khuôn khổ + điểm neo của món gốc =====
  // Chăn chắp vá (thay thảm): phẳng, mèo lăn lộn ở giữa.
  'rug-quilt'() {
    const colors = ['#ec5b8c', '#fff3d1', '#3b8fe0', '#ffd23f', '#4fb34a', '#fff3d1'];
    const quilt = group(at(box(2.5, .02, 1.9, '#fffaf0'), 0, .01, 0));
    for (let x = 0; x < 6; x++) for (let z = 0; z < 5; z++) {
      quilt.add(at(box(.38, .025, .34, colors[(x + z * 2) % colors.length]), -1.02 + x * .41, .02, -.74 + z * .37));
    }
    quilt.traverse(node => { node.castShadow = false; });
    return quilt;
  },
  // Ghế bập bênh (thay ghế bành): mặt ngồi ~.66, đỉnh lưng ghế ~1.29 (mèo trèo lên ngắm cửa sổ).
  'armchair-rocker'() {
    const wood = '#b9854a';
    // thanh bập bênh: thanh dài dưới chân, hai đầu vểnh lên
    const runner = x => group(at(rbox(.06, .06, 1.1, .03, wood), x, .03, .03), at(rbox(.06, .06, .25, .03, wood), x, .07, .66).rotateX(-.4), at(rbox(.06, .06, .25, .03, wood), x, .07, -.6).rotateX(.4));
    const legs = [[-.45, -.32], [.45, -.32], [-.45, .38], [.45, .38]].map(([x, z]) => at(cyl(.04, .04, .56, wood), x, .3, z));
    const slats = [-.36, -.18, 0, .18, .36].map(x => at(rbox(.1, .72, .05, .02, wood), x, .95, -.4));
    return group(runner(-.45), runner(.45), ...legs, at(rbox(1.04, .1, .9, .03, wood), 0, .57, 0), at(rbox(.9, .08, .76, .04, '#ec5b8c'), 0, .64, .02),
      ...slats, at(rbox(1.08, .12, .1, .04, wood), 0, 1.3, -.4), at(rbox(1.08, .08, .08, .03, wood), 0, .62, -.4),
      at(rbox(.08, .07, .82, .03, wood), -.52, .86, 0), at(rbox(.08, .07, .82, .03, wood), .52, .86, 0),
      at(cyl(.03, .03, .26, wood), -.52, .72, .36), at(cyl(.03, .03, .26, wood), .52, .72, .36));
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
  'yarn-toybox'() {
    const toy = at(ball(.17, '#ffd23f'), .02, .55, .08);
    const mouse = group(at(ball(.1, '#b3aa99'), 0, 0, 0), at(ball(.04, '#ec5b8c'), -.05, .08, 0), at(ball(.04, '#ec5b8c'), .05, .08, 0));
    const lid = at(rbox(.84, .06, .64, .03, '#2461a8'), 0, .62, -.42);
    lid.rotation.x = -1.1;
    const chest = group(at(rbox(.8, .42, .6, .05, '#3b8fe0'), 0, .21, 0), at(box(.7, .02, .5, '#1f4f8a'), 0, .42, 0), lid,
      at(mouse, -.2, .47, -.1), at(mesh(new THREE.ConeGeometry(.06, .16, 5), '#ec5b8c'), .25, .5, -.12), toy,
      at(mesh(new THREE.CircleGeometry(.08, 5), '#ffd23f'), -.18, .24, .301), at(mesh(new THREE.CircleGeometry(.06, 5), '#fffaf0'), .15, .18, .301));
    chest.userData.toy = toy; // quả bóng mèo khều ra sàn
    toy.userData.home = toy.position.clone();
    return chest;
  },
  // Thùng các-tông (thay ổ mèo): mèo nào cũng mê; nhảy vào (đáy lót chăn ~.14) rồi cuộn tròn.
  'catbed-box'() {
    const card = '#d9a36a', dark = '#b9854a';
    const wall = (w, x, z, rot) => { const node = at(box(w, .36, .03, card), x, .18, z); node.rotation.y = rot; return node; };
    const flap = (w, x, z, rot, tilt) => { const node = at(box(w, .02, .3, dark), x, .36, z); node.rotation.set(tilt, rot, 0); node.translateZ(.15); return node; };
    return group(at(box(1, .02, .8, dark), 0, .01, 0), wall(1, 0, -.4, 0), wall(1, 0, .4, 0), wall(.8, -.5, 0, Math.PI / 2), wall(.8, .5, 0, Math.PI / 2),
      flap(1, 0, .4, 0, .9), flap(1, 0, -.4, Math.PI, .9), flap(.8, .5, 0, Math.PI / 2, .9), flap(.8, -.5, 0, -Math.PI / 2, .9),
      at(rbox(.9, .1, .7, .04, '#8fc9f2'), 0, .08, 0), at(box(.3, .005, .1, '#3b8fe0'), .15, .19, .416));
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
    return group(at(rbox(.6, .56, .3, .08, '#e5483a'), 0, .34, 0), at(rbox(.5, .34, .02, .03, '#3a2a2a'), 0, .32, .145), ...bars,
      at(rbox(.66, .04, .34, .02, '#c43a2e'), 0, .06, 0), at(cyl(.04, .04, .03, '#fffaf0'), .2, .56, .1), light);
  },
  // Tháp xương rồng (thay cây cho mèo): hai tầng đúng chỗ tầng giữa (~1.16) và đỉnh (~1.88).
  'cattree-cactus'() {
    const green = '#4f9f5a', flower = '#ec5b8c';
    const spikes = (x, z, y0, h) => [...Array(8)].map((_, i) => at(ball(.014, '#fffaf0'), x + Math.cos(i * 2.2) * .115, y0 + (i / 8) * h, z + Math.sin(i * 2.2) * .115));
    return group(at(rbox(1, .12, 1, .05, '#f3dfb0'), 0, .06, 0), at(cyl(.11, .11, 1.05, green), -.25, .6, -.2), at(cyl(.13, .13, 1.7, green), .22, .9, .18),
      ...spikes(-.25, -.2, .2, .8), ...spikes(.22, .18, .25, 1.4),
      at(cyl(.38, .34, .1, green), -.1, 1.1, -.12), at(cyl(.36, .32, .14, flower), .22, 1.8, .18),
      ...[0, 1, 2, 3, 4].map(i => at(ball(.1, '#ff8fb6'), .22 + Math.cos(i * 1.26) * .34, 1.82, .18 + Math.sin(i * 1.26) * .34)),
      at(ball(.08, '#ffd23f'), .22, 1.9, .18), at(ball(.1, '#ffd23f'), .45, .72, .3), at(cyl(.01, .01, .35, '#4f9f2e'), .45, .95, .3));
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
};

// Đồ vườn dùng chung cơ chế đặt/dựng với đồ phòng khách.
Object.assign(BUILD, GARDEN_BUILD);

// Dựng một món trong danh mục. Phương án thay thế có model riêng (BUILD[id]) nhưng giữ khuôn khổ và các móc
// cho mèo của món gốc (userData.fish / leaves / bird / toy / mug, độ cao chỗ ngồi) — xem room-cats.mjs useFurniture.
function buildItem(entry) {
  const node = BUILD[entry.id]();
  node.userData.itemId = entry.id;
  return markOutlineUnit(node);
}

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
function thumbSubject(entry) {
  if (entry.cat === 'furniture') return buildItem(entry);
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
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 100 * pullBack);
  // Toon: nhìn cao hơn (~40° thay vì ~32°) như góc isometric của Cats & Soup, bớt thấy chiều sâu.
  const HOME_VIEW = (TOON ? new THREE.Vector3(7.2, 9.4, 7.2) : new THREE.Vector3(7.9, 7.1, 7.9)).multiplyScalar(pullBack);
  camera.position.copy(HOME_VIEW);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .8, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 9 * pullBack; controls.maxDistance = 18 * pullBack;
  controls.minPolarAngle = .45; controls.maxPolarAngle = 1.22;
  controls.autoRotateSpeed = .7;
  controls.update();

  const hemi = new THREE.HemisphereLight('#fff8e8', '#e0b98a', 1.15 * (TOON ? TOON_LIGHT.hemi : 1));
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 1.7 * (TOON ? TOON_LIGHT.sun : 1));
  sun.position.set(4, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  sun.shadow.bias = -.0015;
  if (TOON) sun.shadow.intensity = TOON_LIGHT.shadow; // bóng đổ nhạt, không đen đặc
  // Đẩy điểm so bóng theo pháp tuyến: mặt đứng gần song song tia nắng (vách nhà mèo, tủ...) không bị sọc "shadow acne".
  // Toon chia nấc gắt nên sọc lộ rõ hơn PCFSoft cũ, vì vậy cần normalBias.
  sun.shadow.normalBias = .08; // thử thực tế: .05 vẫn còn sọc mờ trên vách nhà mèo, .08 sạch mà bóng mèo trên sàn vẫn dính chân
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
  const wallMats = [], windowGlass = [];
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
      windowGlass.push(sky.material, arch.material); // ban đêm: cửa sổ tối lại
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

  // Đồ đạc: dựng khi cần lần đầu. `furniture` theo chỗ đặt (slot) — mèo (room-cats.mjs) gọi furniture.pond,
  // furniture.catbed... nên đổi phương án thì dựng lại đúng chỗ đó, mèo vẫn dùng như cũ.
  const furniture = {};
  function piece(entry) {
    const id = slotOf(entry);
    if (furniture[id] && furniture[id].userData.itemId !== entry.id) {
      const old = furniture[id];
      scene.remove(old);
      old.traverse(node => { if (node.isMesh) { node.geometry.dispose(); [].concat(node.material).forEach(m => m.dispose()); } });
      delete furniture[id];
    }
    if (!furniture[id]) {
      const node = buildItem(entry);
      const [x, z, rot] = PLACES[id];
      node.position.set(x, 0, z);
      node.rotation.y = rot ?? Math.atan2(-x, -z);
      node.visible = false;
      node.userData.pop = 1;
      lightUp(node);
      scene.add(node);
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
    butterflies.forEach(b => { b.node.visible = garden.visible && !night; });
    Object.values(furniture).forEach(lightUp);
  }

  // Mèo: đàn mèo khối 3D có "não" riêng (room-cats.mjs). Tim bay lên khi mèo cụng mũi / liếm lông nhau.
  let container = null;
  const cats = createCatLife({
    scene, furniture, butterflies,
    get zone() { return zoneId; },
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

  let floorId = '';
  const floorTextures = {};
  let zoneId = 'garden';
  function apply(deco) {
    zoneId = deco.zone;
    const state = zoneState(deco);
    living.visible = zoneId === 'living';
    garden.visible = zoneId === 'garden';
    butterflies.forEach(b => { b.node.visible = garden.visible && !night; });
    if (container) container.dataset.zone = zoneId;
    if (garden.visible) {
      const fenceEntry = itemById(state.wall), groundEntry = itemById(state.floor);
      if (fenceId !== fenceEntry.id) { fenceId = fenceEntry.id; if (fence) garden.remove(fence); fence = buildFence(fenceEntry); garden.add(fence); }
      if (groundId !== groundEntry.id) {
        groundId = groundEntry.id;
        groundMat.map = groundTextures[groundId] ||= groundTexture(groundEntry);
        groundMat.color.set('#d6dccb'); groundMat.needsUpdate = true; // nhân tối nhẹ texture cỏ cho đỡ chói
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
    CATALOG.filter(entry => entry.cat === 'furniture' && !entry.slot).forEach(base => {
      const placedId = base.zone === zoneId && state.placed.find(id => slotOf(itemById(id)) === base.id);
      if (!placedId) { if (furniture[base.id]) furniture[base.id].visible = false; return; }
      const before = furniture[base.id], node = piece(itemById(placedId));
      if (node !== before || !node.visible) node.userData.pop = 0; // vừa hiện / vừa đổi phương án: nảy lên
      node.visible = true;
    });
    cats.furnitureChanged();
    if (catKey !== deco.cats.join()) { catKey = deco.cats.join(); cats.setCats(deco.cats); }
  }

  // Quay camera về phía một món đồ (camera đứng đối diện, nhìn món đồ tựa lưng vào tường).
  let turn = null;
  function focus(id) {
    const place = id && PLACES[slotOf(itemById(id) || { id })];
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
      if (cat) { // chạm vui thì tim; chạm dồn dập thì mèo cáu dần rồi nổi giận (room-cats.mjs pet)
        const mood = cat.pet(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        if (mood === 'grumpy') spawnHearts(x, y, '💢', 1, 'angry');
        else if (mood === 'warning') spawnHearts(x, y, '♥', 1);
        else spawnHearts(x, y);
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
    if (TOON) { addOutlines(scene); syncOutlineResolution(renderer); renderOutlineIds(renderer, scene, camera); }
    renderer.render(scene, camera);
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
    camera.aspect = w / fullH;
    if (shift) camera.setViewOffset(w, fullH, 0, Math.max(0, shift), w, h);
    else camera.clearViewOffset();
    // Khung dọc (hẹp hơn cao) thì lùi ống kính để phòng không bị cắt hai bên.
    camera.zoom = Math.min(view.zoomCap, (w / visibleH) / view.zoomFit) * visibleH / fullH;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  let view = { zoomCap: 1, zoomFit: 1.05, insets: null };

  return {
    // Gắn canvas vào khung (Home hoặc Deco). Chỉ một khung dùng renderer tại một thời điểm.
    // options.view = { insets() -> { top, bottom } px bị UI che, zoomCap, zoomFit } cho khung tràn viền.
    mount(target, options = {}) {
      container = target;
      view = { zoomCap: 1, zoomFit: 1.05, insets: null, ...options.view };
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
    setNight,
  };
}
