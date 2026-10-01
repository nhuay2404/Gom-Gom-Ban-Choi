// Khu vườn (màn 1–10): nền cỏ, hàng rào, bụi cây góc vườn, bướm bay; và bộ đồ vườn cho Deco.
// Mỗi món có chỗ đặt cố định [x, z, xoay?]; +z của món hướng vào giữa vườn (mèo đi tới từ phía đó).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { ROOM_HALF } from './room-layout.mjs';
const HALF = ROOM_HALF, TAU = Math.PI * 2;
// Vật liệu đồ đạc kiểu vật lý: gỗ / sơn / vải đều nhám (roughness cao), phản xạ điện môi thấp (specularIntensity)
// nên không loé bóng như nhựa. Nước, kính, kim loại tự ghi đè roughness/metalness riêng.
const mat = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
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
// group() rỗng thì không gọi add(): Three.js báo lỗi khi add() không có đối số.
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };

// Chỗ đặt các món vườn: room-layout.mjs (PLACES).

const FLOWER_COLORS = ['#ff8fa0', '#ffd66b', '#b79cf0', '#fff4f0', '#ff9e6b'];
function flower(color, x, z, h = .28) {
  const stem = cyl(.015, .015, h, '#5fa83e', 6);
  stem.position.y = h / 2;
  const head = ball(.07, color); head.position.y = h; head.scale.y = .7;
  const eye = ball(.03, '#ffd66b'); eye.position.y = h + .04;
  return at(group(stem, head, eye), x, 0, z);
}

// Mèo giẫm qua thì từng cây rạp ra hai bên rồi bật lại (room-cats.mjs ghi vị trí mèo vào userData.walkers).
function bendOnWalk(bed, items, sway = .07) {
  items.forEach(item => { item.userData.bend = { x: 0, z: 0 }; });
  bed.userData.walkers = [];
  const local = new THREE.Vector3();
  bed.userData.update = t => {
    const walkers = bed.userData.walkers.map(p => bed.worldToLocal(local.set(p.x, 0, p.z)).clone());
    items.forEach((f, i) => {
      let bx = 0, bz = 0;
      for (const w of walkers) { // rạp ra xa mèo, càng gần càng rạp mạnh
        const dx = f.position.x - w.x, dz = f.position.z - w.z, d = Math.hypot(dx, dz);
        if (d < .4) { const k = (1 - d / .4) * 1.1; bx += dz / (d || 1) * k; bz -= dx / (d || 1) * k; }
      }
      f.userData.bend.x += (bx - f.userData.bend.x) * .25; // theo kịp nhanh, bật lại mềm
      f.userData.bend.z += (bz - f.userData.bend.z) * .25;
      f.rotation.x = f.userData.bend.x;
      f.rotation.z = Math.sin(t * 1.6 + i) * sway + f.userData.bend.z;
    });
  };
  return bed;
}
// Vật liệu phát sáng (lửa, đèn).
const glow = (color, emissive, intensity = 1) => mat(color, { emissive, emissiveIntensity: intensity });

export const GARDEN_BUILD = {
  // Bồn hoa là mặt đất đi được (mép thấp, mèo không lún chân). Mèo giẫm qua thì hoa rạp ra hai bên rồi bật lại.
  // room-cats.mjs ghi vị trí mèo vào userData.walkers mỗi frame.
  flowers() {
    const bed = group(at(cyl(.72, .76, .035, '#8a5a3a', 48), 0, .0175, 0));
    const flowers = [];
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, r = .15 + (i % 4) * .15;
      const f = flower(FLOWER_COLORS[i % FLOWER_COLORS.length], Math.cos(a) * r, Math.sin(a) * r, .22 + (i % 3) * .06);
      f.position.y = .035;
      bed.add(f);
      flowers.push(f);
    }
    return bendOnWalk(bed, flowers);
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
  // ===== Phương án thay thế (deco-data.mjs VARIANTS): khác đồ vật, giữ khuôn khổ + điểm neo của món gốc =====
  // Vòng nấm (thay bồn hoa): mặt đất đi được, nấm rạp khi mèo giẫm qua; mèo ngửi rồi hắt xì như với hoa.
  'flowers-mushroom'() {
    const ring = group(at(cyl(.72, .76, .035, '#6b8f3e', 48), 0, .0175, 0));
    const shrooms = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + (i % 2) * .2, r = i % 3 ? .55 : .28, h = .1 + (i % 3) * .06, capR = .09 + (i % 2) * .04;
      const cap = mesh(new THREE.SphereGeometry(capR, 24, 12, 0, TAU, 0, Math.PI / 2), i % 2 ? '#e5483a' : '#f07b3c');
      const shroom = group(at(cyl(.03, .04, h, '#fff4e0', 12), 0, h / 2, 0), at(cap, 0, h, 0),
        at(ball(.018, '#fffaf0'), capR * .45, h + capR * .7, 0), at(ball(.015, '#fffaf0'), -capR * .4, h + capR * .75, capR * .3));
      shroom.position.set(Math.cos(a) * r, .035, Math.sin(a) * r);
      ring.add(shroom);
      shrooms.push(shroom);
    }
    return bendOnWalk(ring, shrooms, .03);
  },
  // Bó rơm vuông (thay gốc cây): nóc cao .46 như gốc cây để mèo cào rồi nhảy lên ngồi.
  'stump-hay'() {
    const twine = x => group(at(box(.03, .47, .52, '#b3542e'), x, .23, 0), at(box(.03, .01, .52, '#b3542e'), x, .465, 0));
    const bale = group(at(rbox(.8, .46, .5, .06, '#e8c25a'), 0, .23, 0), twine(-.2), twine(.2)); // vừa bán kính vật cản .45 của gốc cây
    for (let i = 0; i < 14; i++) { // rơm lởm chởm trên nóc và hai đầu
      const a = i * 2.3, straw = at(box(.012, .012, .2, i % 2 ? '#f3d77a' : '#d9ab3c'), Math.cos(a) * .3, .47, Math.sin(a) * .15);
      straw.rotation.set(0, a, .2);
      bale.add(straw);
    }
    return bale;
  },
  // Chậu cỏ mèo (thay bụi catnip): khay gỗ trồng cỏ, mèo gặm cỏ (cỏ rung) rồi lăn lộn.
  'catnip-grass'() {
    const leaves = group();
    for (let i = 0; i < 34; i++) {
      const h = .22 + (i % 5) * .05, blade = mesh(new THREE.ConeGeometry(.022, h, 5), ['#5fb83a', '#7fcf4a', '#4f9f2e'][i % 3]);
      blade.position.set(-.32 + (i % 9) * .08, h / 2, -.14 + Math.floor(i / 9) * .09);
      blade.rotation.set(((i * 37) % 7 - 3) * .05, 0, ((i * 13) % 7 - 3) * .06);
      leaves.add(blade);
    }
    leaves.position.y = .3;
    const tray = group(at(rbox(.82, .3, .48, .04, '#c9955e'), 0, .15, 0), at(box(.74, .02, .4, '#6b4a35'), 0, .3, 0), leaves);
    tray.userData.leaves = leaves;
    return tray;
  },
  // Đuốc tiki (thay đèn lồng): cột tre, lửa lập loè; mèo nằm sưởi ngủ cạnh.
  'lantern-torch'() {
    const flame = at(mesh(new THREE.ConeGeometry(.08, .22, 16), glow('#ffb347', '#ff7a1a', 1.4)), 0, 1.56, 0);
    const light = new THREE.PointLight('#ff9a4a', 4, 5, 1.6);
    light.position.y = 1.5;
    const torch = group(at(cyl(.22, .26, .08, '#9a8b7a'), 0, .04, 0), at(cyl(.035, .04, 1.3, '#c9a15e'), 0, .7, 0),
      ...[.4, .8, 1.15].map(y => at(cyl(.045, .045, .03, '#9a7a40'), 0, y, 0)),
      at(cyl(.1, .07, .18, '#8a5a3a'), 0, 1.4, 0), flame, light);
    torch.userData.update = t => { flame.scale.set(1, 1 + Math.sin(t * 11) * .12 + Math.sin(t * 7) * .06, 1); };
    return torch;
  },
  // Hộp cát hình rùa (thay hộp cát): mặt cát cao ~.18 để mèo nhảy vào đào.
  'sandbox-turtle'() {
    const skin = '#8fd46a';
    const legs = [[.42, .38], [-.42, .38], [.42, -.38], [-.42, -.38]].map(([x, z]) => at(ball(.12, skin), x, .06, z));
    return group(at(cyl(.55, .5, .2, '#4fb34a'), 0, .1, 0), at(mesh(new THREE.TorusGeometry(.53, .04, 10, 48), '#3a8f36'), 0, .2, 0).rotateX(Math.PI / 2),
      at(cyl(.5, .5, .02, '#f3dfb0'), 0, .205, 0), ...legs, at(ball(.15, skin), 0, .2, -.58), // mặt cát cao hơn miệng bồn (.2)
      at(ball(.03, '#2a2a2a'), .07, .26, -.7), at(ball(.03, '#2a2a2a'), -.07, .26, -.7),
      at(mesh(new THREE.ConeGeometry(.07, .12, 10), '#ec5b8c'), .2, .25, .1), at(ball(.05, '#3b8fe0'), -.18, .23, -.12));
  },
  // Nhà thùng gỗ (thay nhà mèo): thùng nằm ngang, miệng hướng vào vườn; mèo chui vào ngủ hoặc leo lên nóc (cao 1.2).
  'cathouse-barrel'() {
    const barrel = mesh(new THREE.CylinderGeometry(.6, .6, 1, 32, 1, true), mat('#b9854a', { side: THREE.DoubleSide }));
    barrel.rotation.x = Math.PI / 2;
    const back = at(mesh(new THREE.CircleGeometry(.6, 32), '#9a6a45'), 0, 0, -.5);
    const hoop = z => at(mesh(new THREE.TorusGeometry(.61, .03, 8, 48), mat('#8a8a8a', { metalness: .8, roughness: .45 })), 0, 0, z);
    const cushion = at(cyl(.42, .42, .06, '#ec5b8c'), 0, .05, 0);
    cushion.scale.z = 1.05;
    return group(at(group(barrel, back, hoop(-.35), hoop(.35)), 0, .6, 0), cushion, at(box(.3, .2, .04, '#fffaf0'), 0, 1.02, .5));
  },
  // Đài phun nước (thay hồ cá): bồn đá tròn có cá vàng bơi; mèo rình cá rồi khều nước.
  'pond-fountain'() {
    const water = mesh(new THREE.CylinderGeometry(.74, .74, .02, 48), mat('#6fc3e0', { roughness: .15, transparent: true, opacity: .85 }));
    water.castShadow = false;
    const spray = at(mesh(new THREE.SphereGeometry(.12, 16, 12), mat('#dff4ff', { transparent: true, opacity: .6, roughness: .1 })), 0, 1.02, 0);
    const koi = ['#f39a45', '#ffd23f'].map((color, i) => {
      const fish = group(ball(.06, color), at(mesh(new THREE.ConeGeometry(.045, .09, 10), color), -.09, 0, 0));
      fish.children[0].scale.set(1.4, .6, .8); fish.children[1].rotation.z = Math.PI / 2;
      fish.userData.phase = i * Math.PI;
      return fish;
    });
    // Các lớp tách độ cao rõ ràng (không có hai mặt trùng nhau -> không chớp z-fighting):
    // bệ đá (đỉnh .26) < mặt nước (.28) < vành bồn hình xuyến (đỉnh ~.34) bao quanh mép nước.
    const fountain = group(at(cyl(.82, .9, .26, '#d9d2c4'), 0, .13, 0), at(water, 0, .27, 0),
      at(mesh(new THREE.TorusGeometry(.8, .07, 12, 56), '#d9d2c4'), 0, .28, 0).rotateX(Math.PI / 2),
      at(cyl(.1, .14, .55, '#d9d2c4'), 0, .55, 0), at(cyl(.3, .14, .12, '#e3ddd1'), 0, .86, 0), at(cyl(.26, .26, .02, '#8fd0ef'), 0, .92, 0), spray, ...koi);
    fountain.userData.fish = koi;
    fountain.userData.update = t => {
      spray.scale.setScalar(1 + Math.sin(t * 6) * .15);
      koi.forEach(f => { const a = t * .5 + f.userData.phase; f.position.set(Math.cos(a) * .5, .265, Math.sin(a) * .5); f.rotation.y = -a - Math.PI / 2; });
    };
    return fountain;
  },
  // Xích đu lốp xe (thay võng): lốp nằm ngang treo trên xà, lòng lốp cao ~.42 để mèo nhảy vào cuộn tròn.
  'hammock-tire'() {
    const wood = '#8a5a3a';
    const tire = at(mesh(new THREE.TorusGeometry(.3, .12, 16, 40), '#3a3a3a'), 0, .36, 0);
    tire.rotation.x = Math.PI / 2;
    const ropes = [0, 2.1, 4.2].map(a => at(cyl(.012, .012, 1.02, '#e6c79a', 6), Math.cos(a) * .3, .95, Math.sin(a) * .3));
    const swing = group(tire, at(cyl(.24, .24, .03, '#ec5b8c'), 0, .38, 0), ...ropes);
    const frame = group(at(cyl(.06, .07, 1.5, wood), -.9, .75, 0), at(cyl(.06, .07, 1.5, wood), .9, .75, 0),
      at(cyl(.06, .06, 1.9, wood), 0, 1.47, 0).rotateZ(Math.PI / 2), swing);
    frame.userData.update = t => { swing.rotation.x = Math.sin(t * 1.1) * .05; };
    return frame;
  },
  // Máng ăn cho chim (thay chậu tắm chim): khay hạt cao ~.9 có chim đậu; mèo doạ chim bay hoặc nhảy lên khay.
  'birdbath-feeder'() {
    const bird = group(ball(.08, '#ffd23f'), at(ball(.055, '#ffd23f'), .07, .07, 0), at(mesh(new THREE.ConeGeometry(.02, .05, 8), '#ff7a3d'), .14, .07, 0).rotateZ(-Math.PI / 2));
    bird.children[0].scale.set(1.2, .9, .9);
    bird.position.set(0, .98, .22);
    bird.rotation.y = -Math.PI / 2;
    bird.userData.home = bird.position.clone();
    const seeds = [...Array(8)].map((_, i) => at(ball(.025, '#c9953a'), Math.cos(i * 2.4) * .12, .92, Math.sin(i * 2.4) * .1 - .05));
    const posts = [[-.27, -.24], [.27, -.24], [-.27, .24], [.27, .24]].map(([x, z]) => at(cyl(.015, .015, .6, '#8a5a3a', 6), x, 1.18, z));
    const feeder = group(at(cyl(.22, .26, .06, '#6b4a35'), 0, .03, 0), at(cyl(.045, .05, .85, '#8a5a3a'), 0, .45, 0),
      at(rbox(.62, .05, .56, .02, '#c9955e'), 0, .88, 0), ...posts,
      at(rbox(.72, .05, .4, .02, '#e5483a'), 0, 1.55, -.16).rotateX(-.55), at(rbox(.72, .05, .4, .02, '#e5483a'), 0, 1.55, .16).rotateX(.55), ...seeds, bird);
    feeder.userData.bird = bird;
    return feeder;
  },
  // Ghế khúc gỗ (thay ghế băng): khúc gỗ đặt trên hai gốc cây, mặt ngồi cao ~.5.
  'bench-log'() {
    const log = at(cyl(.17, .17, 1.4, '#9a6a45'), 0, .33, 0);
    log.rotation.z = Math.PI / 2;
    const end = x => at(cyl(.15, .15, .01, '#e6c79a'), x, .33, 0).rotateZ(Math.PI / 2);
    return group(at(cyl(.16, .19, .2, '#8a5a3a'), -.5, .1, 0), at(cyl(.16, .19, .2, '#8a5a3a'), .5, .1, 0), log, end(-.705), end(.705),
      at(ball(.06, '#6fbf4a'), .3, .5, .05), at(ball(.04, '#8fd46a'), .36, .52, .02));
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
// `half` = nửa cạnh khoảnh vườn (mặc định cả vườn; thumbnail Deco dùng khoảnh nhỏ).
export function buildFence(entry, half = HALF) {
  const fence = new THREE.Group();
  const span = half * 2;
  const side = (build) => [[0, -half - .05, 0], [0, half + .05, Math.PI], [-half - .05, 0, Math.PI / 2], [half + .05, 0, -Math.PI / 2]]
    .forEach(([x, z, rot]) => { const g = build(); g.position.set(x, 0, z); g.rotation.y = rot; fence.add(g); });
  if (entry.id === 'fence-hedge') side(() => group(at(rbox(span + .2, .6, .32, .14, entry.color), 0, .3, 0)));
  else if (entry.id === 'fence-stone') side(() => {
    const g = group(), n = Math.max(2, Math.round(span / .675)), step = span / n;
    for (let i = 0; i < n; i++) g.add(at(rbox(step - .015, .34 + (i % 2) * .06, .3, .06, i % 2 ? '#c8c2b8' : '#b5aea3'), -half + step * (i + .5), .18, 0));
    return g;
  });
  else side(() => {
    const g = group(at(box(span + .2, .06, .04, entry.color), 0, .42, 0), at(box(span + .2, .06, .04, entry.color), 0, .2, 0));
    const n = Math.max(2, Math.round(span / .5)), step = span / n;
    for (let i = 0; i <= n; i++) {
      const x = -half + i * step;
      g.add(at(rbox(.12, .6, .05, .02, entry.color), x, .3, .02));
      if (entry.id === 'fence-white') g.add(at(mesh(new THREE.ConeGeometry(.085, .1, 4), entry.color), x, .64, .02).rotateY(Math.PI / 4));
    }
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
