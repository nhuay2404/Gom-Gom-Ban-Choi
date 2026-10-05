// Khu vườn (màn 1–10): nền cỏ, hàng rào, bụi cây góc vườn, bướm bay; và bộ đồ vườn cho Deco.
// Mỗi món có chỗ đặt cố định [x, z, xoay?]; +z của món hướng vào giữa vườn (mèo đi tới từ phía đó).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';

import { ROOM_HALF } from './room-layout.mjs';
import { TOON, toonMat, markOutlineUnit } from './toon.mjs';
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
// Độ mịn kiểu subdivision, cùng mức với deco-room.mjs.
const ROUND = 3, RADIAL = 32; // bo góc 3 nấc / trụ 32 cạnh là đủ mượt dưới viền toon; cầu / trụ mặc định chia theo cỡ (mesh-detail.mjs)
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
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
// Dây: hình trụ nối đúng hai điểm a → b (dài đúng khoảng cách, không thừa không thiếu).
export function ropeBetween(a, b, r, color) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const node = cyl(r, r, len, color, 8);
  node.position.copy(a).addScaledVector(dir, .5);
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return node;
}
// Con lắc treo dưới điểm `pivot` (toạ độ món đồ); con của nó đặt theo toạ độ tính từ điểm treo (dây hướng -y).
// Lắc theo 2 trục như con lắc thật: tần số theo độ dài dây ω = √(g/L) (dây dài lắc chậm), tắt dần, gió nhẹ giữ cho
// đung đưa; swing.userData.kick(vx, vz) = cú đẩy (rad/s) khi mèo khều / nhảy vào / nhảy ra.
export function pendulum(pivot, length, ...children) {
  const swing = group(...children);
  swing.position.copy(pivot);
  const w = Math.sqrt(9.8 / length), zeta = .06, s = { ax: 0, az: 0, vx: 0, vz: 0, last: 0, phase: Math.random() * TAU };
  swing.userData.kick = (vx, vz) => { s.vx += vx; s.vz += vz; };
  swing.userData.step = t => {
    const dt = Math.min(.05, Math.max(0, t - (s.last || t))); s.last = t;
    const gust = .02 * w * w; // gió: lệch ~.02 rad
    for (const [a, v, f] of [['ax', 'vx', Math.sin(t * .7 + s.phase)], ['az', 'vz', Math.sin(t * .53 + s.phase * 2)]]) {
      s[v] += (-w * w * Math.sin(s[a]) - 2 * zeta * w * s[v] + gust * f) * dt;
      s[a] += s[v] * dt;
    }
    swing.rotation.set(s.ax, 0, s.az);
  };
  return swing;
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
      // Mỗi bông là một khối viền riêng: viền hoa nằm trên đất của bồn vẫn đậm (không bị coi là nét trong của bồn).
      const f = markOutlineUnit(flower(FLOWER_COLORS[i % FLOWER_COLORS.length], Math.cos(a) * r, Math.sin(a) * r, .22 + (i % 3) * .06));
      f.position.y = .035;
      bed.add(f);
      flowers.push(f);
    }
    return bendOnWalk(bed, flowers);
  },
  stump() {
    const stump = group(at(cyl(.38, .44, .45, '#9a6a45'), 0, .225, 0), at(cyl(.36, .36, .02, '#e6c79a'), 0, .455, 0),
      at(cyl(.2, .2, .021, '#d2ad7a'), 0, .457, 0));
    for (let i = 0; i < 3; i++) { const root = rbox(.14, .1, .3, .04, '#8a5a3a'); root.rotation.y = i * 2.1; root.translateZ(.4); root.position.y = .05; stump.add(root); }
    return stump;
  },
  catnip() {
    // Cây catnip thật: nhiều nhánh mọc thẳng toả ra từ gốc, lá hình trứng mọc đối từng cặp (cặp sau xoay 90°),
    // đầu nhánh là bông hoa tím dạng bông đuôi. Không còn là cục lá tròn.
    const LEAF = ['#8fbf6a', '#a3cf7e', '#7fb35c'], BLOOM = ['#c9a6f5', '#b48ee8'];
    const leafGeo = new THREE.SphereGeometry(1, 14, 10);
    const leaf = (side, size, color) => { // lá dẹt, chĩa ra ngoài và hơi rủ xuống
      const node = mesh(leafGeo, color);
      node.scale.set(size, size * .22, size * .62);
      node.position.x = side * size * .85; node.rotation.z = side * -.35;
      return node;
    };
    const stem = (angle, tilt, h, k) => {
      const shoot = group(at(cyl(.012, .018, h, '#6a9a48', 8), 0, h / 2, 0));
      const pairs = Math.round(h / .1);
      for (let p = 0; p < pairs; p++) {
        const y = .06 + p * (h - .1) / pairs, size = .085 - p * .009; // lá dưới to, lên ngọn nhỏ dần
        const pair = group(leaf(1, size, LEAF[(k + p) % 3]), leaf(-1, size, LEAF[(k + p + 1) % 3]));
        pair.position.y = y; pair.rotation.y = p % 2 ? Math.PI / 2 : 0;
        shoot.add(pair);
      }
      for (let b = 0; b < 4; b++) { // bông đuôi: các chùm hoa nhỏ dần lên ngọn
        const bud = at(ball(.034 - b * .005, BLOOM[(k + b) % 2]), 0, h + .02 + b * .04, 0);
        bud.scale.y = .8; shoot.add(bud);
      }
      shoot.rotation.set(0, angle, tilt, 'YXZ');
      shoot.position.y = .05; // mọc từ mặt ụ đất: nhánh nghiêng không cắm xuyên xuống sàn
      return shoot;
    };
    const bush = group(at(cyl(.24, .3, .05, '#8a6a4a', 24), 0, .025, 0)); // ụ đất gốc
    bush.add(stem(0, 0, .55, 0));
    for (let i = 0; i < 8; i++) bush.add(stem(i / 8 * TAU + (i % 2) * .2, .28 + (i % 3) * .1, .38 + ((i * 5) % 4) * .05, i));
    // Phóng to ở lớp giữa: lớp ngoài bị hiệu ứng nảy khi đặt đồ (deco-room.mjs) ghi đè scale,
    // còn `leaves` bị wiggle() (room-cats.mjs) đặt lại scale ~1 khi mèo gặm.
    mergeStatic(bush); // nhánh + lá + hoa cùng màu gộp lại; cả bụi vẫn rung như một khối
    const sized = group(bush); sized.scale.setScalar(1.4);
    const plant = group(sized);
    plant.userData.leaves = bush;
    return plant;
  },
  lantern() {
    const glow = mesh(roundedBox(.3, .36, .3, ROUND, .05), mat('#fff0b8', { emissive: '#ffcf5a', emissiveIntensity: .9 }));
    const light = new THREE.PointLight('#ffcf7a', 4, 5, 1.6);
    light.position.y = 1.3;
    return group(at(cyl(.2, .24, .08, '#5a4a3a'), 0, .04, 0), at(cyl(.04, .04, 1.1, '#5a4a3a'), 0, .6, 0), at(glow, 0, 1.3, 0),
      at(mesh(new THREE.ConeGeometry(.26, .16, 4), '#5a4a3a'), 0, 1.56, 0).rotateY(Math.PI / 4), light);
  },
  sandbox() {
    const wood = '#c9955e';
    // Lòng cát: khối cát + mặt cát gồ ghề (dồn cao sát thành gỗ, một đụn nhỏ ở góc, lõm chỗ mèo hay đào ở giữa)
    // phủ texture hạt cát + vệt cào. Mặt cát ~.18 như cũ: mèo đứng đào ở đúng độ cao này (room-cats.mjs).
    const sandM = sandMat();
    const top = new THREE.PlaneGeometry(.9, .9, 28, 28).rotateX(-Math.PI / 2), pos = top.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), edge = Math.max(Math.abs(x), Math.abs(z)) / .45;
      const dune = Math.exp(-((x + .22) ** 2 + (z + .2) ** 2) / .02) * .035, dip = -Math.exp(-(x * x + z * z) / .03) * .012;
      pos.setY(i, edge ** 6 * .02 + dune + dip + Math.sin(x * 23 + z * 7) * .003);
    }
    top.computeVertexNormals();
    const surface = at(mesh(top, sandM), 0, .175, 0);
    surface.castShadow = false;
    // Lâu đài cát nhỏ ở góc: cát ướt nén (sẫm hơn mặt cát khô) để nổi khối, thân + hai tháp có mái nhọn + cờ.
    const wet = sandMat('#d9b77a');
    const castle = group(at(cyl(.11, .13, .1, wet, 20), 0, .05, 0),
      at(cyl(.045, .05, .1, wet, 12), .06, .15, .03), at(mesh(new THREE.ConeGeometry(.055, .07, 12), wet), .06, .235, .03),
      at(cyl(.04, .045, .07, wet, 12), -.06, .135, -.03), at(mesh(new THREE.ConeGeometry(.05, .06, 12), wet), -.06, .2, -.03),
      at(cyl(.004, .004, .1, '#8a6a4a', 6), .06, .3, .03), at(box(.05, .03, .004, '#ff8fa0'), .085, .335, .03));
    castle.position.set(.2, .18, .2);
    return group(at(box(1.05, .22, .08, wood), 0, .11, .5), at(box(1.05, .22, .08, wood), 0, .11, -.5),
      at(box(.08, .22, 1.05, wood), .5, .11, 0), at(box(.08, .22, 1.05, wood), -.5, .11, 0), at(box(.9, .12, .9, sandM), 0, .115, 0), surface, castle,
      at(mesh(new THREE.ConeGeometry(.08, .14, 10), '#ff8fa0'), .25, .26, -.2), at(ball(.06, '#8fc9f2'), -.2, .23, .15));
  },
  cathouse() {
    // Nhà mèo bo tròn kiểu đồ chơi: thân bo góc lớn trên đế, đầu hồi tam giác bo mép lấp kín dưới mái (trước đây hở),
    // mái hai tấm dày chìa ra trước / sau + nóc tròn, cửa vòm có khung, cửa sổ tròn hai bên hông.
    const W = 1.1, D = 1, H = .8, BASE = .05, PITCH = .62, EAVE = .14, T = .1; // mái dốc ~35°, chìa ra EAVE, dày T
    const WALL = '#f3d5a8', ROOF = '#e8617f', TRIM = '#fff4e0';
    const top = BASE + H, rise = W / 2 * Math.tan(PITCH), apex = top + rise;
    const base = at(rbox(W + .14, BASE * 2, D + .12, .04, '#d9b07e'), 0, BASE, 0);
    const body = at(rbox(W, H, D, .13, WALL), 0, BASE + H / 2, 0);
    const extrude = (shape, depth, bevel = .025) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 24 });
    const tri = new THREE.Shape([new THREE.Vector2(-W / 2 + .06, 0), new THREE.Vector2(W / 2 - .06, 0), new THREE.Vector2(0, rise - .02)]);
    const gable = at(mesh(extrude(tri, D - .16, .05), WALL), 0, top - .06, -(D - .16) / 2);
    // Tấm mái: nằm trên đường dốc từ nóc ra mép (chìa thêm EAVE), dời ra theo pháp tuyến nửa bề dày.
    const slope = (W / 2 + EAVE) / Math.cos(PITCH);
    const roof = [1, -1].map(s => {
      const slab = rbox(slope, T, D + .26, .045, ROOF);
      slab.rotation.z = -s * PITCH;
      slab.position.set(s * (Math.cos(PITCH) * slope / 2 + Math.sin(PITCH) * T / 2), apex - Math.sin(PITCH) * slope / 2 + Math.cos(PITCH) * T / 2, 0);
      return slab;
    });
    const ridge = at(cyl(.075, .075, D + .3, '#d44d6c', 24), 0, apex + T * .9, 0);
    ridge.rotation.x = Math.PI / 2;
    // Cửa vòm: lỗ tối + khung kem bo mép bao quanh.
    const arch = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h); s.absarc(0, h, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0); return s; };
    const door = new THREE.Mesh(new THREE.ShapeGeometry(arch(.44, .26), 24), new THREE.MeshBasicMaterial({ color: '#4a2e20' }));
    door.position.set(0, BASE + .02, D / 2 + .004);
    const frameShape = arch(.56, .26); frameShape.holes.push(arch(.44, .26));
    const frame = at(mesh(extrude(frameShape, .03, .018), TRIM), 0, BASE + .02, D / 2 - .01);
    const sign = at(rbox(.36, .13, .04, .02, TRIM), 0, BASE + .66, D / 2 + .01);
    const paw = at(ball(.03, ROOF), 0, BASE + .65, D / 2 + .035); paw.scale.z = .4;
    const windows = [1, -1].map(s => {
      const glass = at(mesh(new THREE.CircleGeometry(.11, 24), '#bfe6ff'), 0, 0, 0);
      const ring = mesh(new THREE.TorusGeometry(.12, .028, 10, 28), TRIM);
      const win = group(glass, ring, at(box(.2, .022, .012, TRIM), 0, 0, .012), at(box(.022, .2, .012, TRIM), 0, 0, .012)); // chấn song cách kính 6 mm
      win.position.set(s * (W / 2 + .008), BASE + .46, 0); win.rotation.y = s * Math.PI / 2; // kính cách vách 8 mm (không z-fighting)
      return win;
    });
    return group(base, body, gable, ...roof, ridge, door, frame, sign, paw, ...windows);
  },
  pond() {
    // Ao tự nhiên, không phải hồ bơi: mép nước lượn sóng (không tròn đều), viền là đá cuội tròn to nhỏ khác nhau
    // xếp chồng mép nhau, thêm cụm cỏ lau + lá súng có hoa. Ngẫu nhiên có seed nên lần nào dựng cũng giống nhau.
    let seed = 7;
    const rnd = (lo, hi) => { seed = (seed * 16807) % 2147483647; return lo + (seed / 2147483647) * (hi - lo); };
    const edge = a => .76 * (1 + .09 * Math.sin(2 * a + .6) + .05 * Math.sin(3 * a + 1.9)); // bán kính mép nước theo góc
    const blob = (scale, n = 72) => {
      const shape = new THREE.Shape();
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = edge(a) * scale; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, -Math.sin(a) * r); }
      return shape;
    };
    const flat = (geometry, material, y) => { const m = mesh(geometry, material); m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; return m; };
    const bed = flat(new THREE.ShapeGeometry(blob(1.02)), mat('#3f8f9e'), .012); // đáy sẫm lộ ra ở mép -> có chiều sâu
    const water = flat(new THREE.ShapeGeometry(blob(.94)), mat('#6fc3e0', { roughness: .15, transparent: true, opacity: .85 }), .04);
    const STONE_COLORS = ['#c8c2b8', '#b5aea3', '#d6cfc2', '#a39b8f', '#bdb6a6'];
    const stones = group();
    // Đi quanh mép, mỗi viên cách viên trước ít hơn bề ngang của nó -> viền liền mà vẫn lổn nhổn tự nhiên.
    for (let a = 0; a < TAU - .12;) {
      const size = rnd(.09, .16), r = edge(a) + size * .55;
      const s = ball(size, STONE_COLORS[Math.floor(rnd(0, STONE_COLORS.length))]);
      s.scale.set(rnd(1.1, 1.5), rnd(.5, .75), rnd(.9, 1.2));
      s.position.set(Math.cos(a) * r, size * .35, Math.sin(a) * r); s.rotation.y = rnd(0, TAU);
      stones.add(s);
      if (rnd(0, 1) < .35) { // sỏi nhỏ lăn ra ngoài viền
        const p = ball(rnd(.04, .065), STONE_COLORS[Math.floor(rnd(0, STONE_COLORS.length))]);
        const pr = r + size * rnd(.9, 1.3), pa = a + rnd(-.08, .08);
        p.scale.y = .6; p.position.set(Math.cos(pa) * pr, .02, Math.sin(pa) * pr); stones.add(p);
      }
      a += size * 1.25 / edge(a);
    }
    // Cụm cỏ lau ở một góc ao, mọc chen giữa đá.
    const reeds = group();
    for (let i = 0; i < 9; i++) {
      const h = rnd(.28, .48), a = 2.3 + rnd(-.35, .35), r = edge(a) + rnd(-.04, .12);
      const blade = mesh(new THREE.ConeGeometry(.022, h, 6), i % 3 ? '#5fa83e' : '#7cc256');
      blade.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); blade.rotation.set(rnd(-.25, .25), 0, rnd(-.25, .25));
      reeds.add(blade);
    }
    const lily = (x, z, r, flowerColor) => {
      const leaf = flat(new THREE.CircleGeometry(r, 20, .35, TAU - .7), mat('#6fbf4a'), .052);
      leaf.position.x = x; leaf.position.z = z; leaf.rotation.z = rnd(0, TAU);
      if (!flowerColor) return leaf;
      const bloom = at(ball(.05, flowerColor), x, .08, z); bloom.scale.y = .7;
      return group(leaf, bloom, at(ball(.022, '#ffd66b'), x, .11, z));
    };
    const pad = group(lily(.3, -.25, .14, '#ff9fb8'), lily(-.38, .2, .1), lily(.05, .42, .08));
    const koi = ['#f39a45', '#fff4f0'].map((color, i) => {
      const fish = group(ball(.07, color), at(mesh(new THREE.ConeGeometry(.05, .1, 10), color), -.1, 0, 0));
      fish.children[0].scale.set(1.4, .6, .8); fish.children[1].rotation.z = Math.PI / 2;
      fish.userData.phase = i * Math.PI;
      return fish;
    });
    mergeStatic(stones); mergeStatic(reeds); mergeStatic(pad); // đá / lau / lá súng tĩnh: gộp theo màu
    const pond = group(bed, water, stones, reeds, pad, ...koi);
    pond.userData.fish = koi;
    pond.userData.sink = .07; // đá cuội viền ao chôn nửa viên xuống đất (tự nhiên), không phải lỗi lún
    pond.userData.update = t => koi.forEach(f => {
      const a = t * .5 + f.userData.phase;
      f.position.set(Math.cos(a) * .45, .03, Math.sin(a) * .45);
      f.rotation.y = -a - Math.PI / 2;
    });
    return pond;
  },
  hammock() {
    const wood = '#9a6a45';
    // Vải võng: vẫn là CylinderGeometry hở nửa ống (room-cats.mjs findTrough/holdInTrough đọc parameters để mèo nằm bó
    // theo lòng vải), nhưng uốn lại đỉnh: giữa giữ nguyên bán kính, hai đầu túm dần về điểm buộc dây -> dáng võng mềm
    // như vải bị kéo căng, không còn là ống cứng. Hệ toạ độ của ống: y = dọc võng, z+ = hướng lên (sau khi xoay).
    const LEN = 1.4, R = .34, RADIAL = 32, ROWS = 28;
    const geo = new THREE.CylinderGeometry(R, R, LEN, RADIAL, ROWS, true, Math.PI / 2, Math.PI);
    const pinch = y => Math.max(.035, 1 - Math.abs(y / (LEN / 2)) ** 2.2); // 1 ở giữa, ~0 ở hai đầu
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const STRIPES = [new THREE.Color('#8fc9f2'), new THREE.Color('#fff6e4'), new THREE.Color('#8fc9f2'), new THREE.Color('#ffd27a')];
    for (let i = 0; i < pos.count; i++) {
      const s = pinch(pos.getY(i));
      pos.setX(i, pos.getX(i) * s); pos.setZ(i, pos.getZ(i) * s);
      STRIPES[Math.floor((i % (RADIAL + 1)) / (RADIAL / 8)) % STRIPES.length].toArray(colors, i * 3); // sọc chạy dọc võng
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const clothMat = mat('#ffffff', { side: THREE.DoubleSide });
    clothMat.vertexColors = true;
    const cloth = mesh(geo, clothMat);
    // Tấm vải mỏng một lớp: viền "inverted hull" (toon.mjs) không có mặt trong để che nên phủ một mảng tối vào lòng võng.
    // Bỏ viền cho tấm vải, thay bằng đường viền mép vải (ống mảnh, có viền bình thường) ở hai mép trên.
    cloth.userData.noOutline = true;
    for (const side of [1, -1]) {
      const hem = [];
      for (let k = 0; k <= 24; k++) { const y = -LEN / 2 + k / 24 * LEN; hem.push(new THREE.Vector3(side * R * pinch(y), y, 0)); }
      cloth.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem), 48, .016, 6), '#5fa3d6'));
    }
    cloth.rotation.z = Math.PI / 2;
    cloth.rotation.x = -Math.PI / 2; // (Euler XYZ: quay z trước) nửa ống quay xuống dưới: lòng võng võng xuống (mèo nằm ở ~.42)
    const sling = at(group(cloth), 0, .72, 0);
    // Dây buộc hai đầu võng (mép trên, x = ±.7) lên gần đỉnh cột (x = ±.95 trừ bán kính cột).
    const ropes = [-1, 1].map(s => ropeBetween(new THREE.Vector3(s * .7, .72, 0), new THREE.Vector3(s * .89, 1.18, 0), .014, '#fffaf0'));
    const hammock = group(at(cyl(.06, .07, 1.3, wood), -.95, .65, 0), at(cyl(.06, .07, 1.3, wood), .95, .65, 0), sling, ...ropes);
    hammock.userData.update = t => { sling.rotation.x = Math.sin(t * 1.1) * .06; };
    hammock.userData.ride = sling; // mèo nằm trong võng đung đưa theo (deco-room.mjs rideAlong)
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
    const legs = [[.42, .38], [-.42, .38], [.42, -.38], [-.42, -.38]].map(([x, z]) => { const leg = at(ball(.12, skin), x, .06, z); leg.scale.y = .5; return leg; }); // chân bẹt chạm sàn
    return group(at(cyl(.55, .5, .2, '#4fb34a'), 0, .1, 0), at(mesh(new THREE.TorusGeometry(.53, .04, 10, 48), '#3a8f36'), 0, .2, 0).rotateX(Math.PI / 2),
      at(cyl(.5, .5, .02, sandMat()), 0, .205, 0), ...legs, at(ball(.15, skin), 0, .2, -.58), // mặt cát cao hơn miệng bồn (.2)
      at(ball(.03, '#2a2a2a'), .07, .26, -.7), at(ball(.03, '#2a2a2a'), -.07, .26, -.7),
      at(mesh(new THREE.ConeGeometry(.07, .12, 10), '#ec5b8c'), .2, .25, .1), at(ball(.05, '#3b8fe0'), -.18, .23, -.12));
  },
  // Nhà thùng gỗ (thay nhà mèo): thùng nằm ngang, miệng hướng vào vườn; mèo chui vào ngủ hoặc leo lên nóc (cao 1.2).
  'cathouse-barrel'() {
    const barrel = mesh(new THREE.CylinderGeometry(.6, .6, 1, 32, 1, true), mat('#b9854a', { side: THREE.DoubleSide }));
    barrel.rotation.x = Math.PI / 2;
    barrel.userData.noOutline = true; // vỏ thùng mỏng hở hai đầu: viền toon phủ mảng tối vào lòng thùng -> viền bằng vành gỗ hai đầu
    const back = at(mesh(new THREE.CircleGeometry(.6, 32), '#9a6a45'), 0, 0, -.5);
    const hoop = z => at(mesh(new THREE.TorusGeometry(.61, .03, 8, 48), mat('#8a8a8a', { metalness: .8, roughness: .45 })), 0, 0, z);
    // Nệm hẹp nằm đúng lòng thùng (lòng thùng cong: ở x = ±.25 đáy cao ~.05) nên không xuyên ra ngoài vỏ.
    const cushion = at(rbox(.5, .05, .82, .02, '#ec5b8c'), 0, .06, 0);
    // Biển tên dựng trên nóc thùng, hai chân chạm nóc (y = 1.2).
    const sign = group(at(rbox(.36, .16, .03, .01, '#fffaf0'), 0, 1.33, .28), at(cyl(.012, .012, .1, '#8a5a3a', 6), -.12, 1.23, .28), at(cyl(.012, .012, .1, '#8a5a3a', 6), .12, 1.23, .28));
    const rim = z => at(mesh(new THREE.TorusGeometry(.6, .025, 8, 48), '#9a6a45'), 0, 0, z);
    const node = group(at(group(barrel, back, hoop(-.35), hoop(.35), rim(-.5), rim(.5)), 0, .6, 0), cushion, sign);
    node.userData.sink = .045; // đai sắt chôn nhẹ xuống đất cho thùng nằm vững, lòng thùng vẫn sát sàn để mèo chui vào
    return node;
  },
  // Đài phun nước (thay hồ cá): bồn đá tròn có cá vàng bơi; mèo rình cá rồi khều nước.
  'pond-fountain'() {
    const water = mesh(new THREE.CylinderGeometry(.74, .74, .02, 48), mat('#6fc3e0', { roughness: .15, transparent: true, opacity: .85 }));
    water.castShadow = false;
    const jet = mat('#dff4ff', { transparent: true, opacity: .6, roughness: .1 });
    const spray = at(mesh(new THREE.SphereGeometry(.12, 16, 12), jet), 0, 1.08, 0);
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
      at(cyl(.1, .14, .55, '#d9d2c4'), 0, .55, 0), at(cyl(.3, .14, .12, '#e3ddd1'), 0, .86, 0), at(cyl(.26, .26, .02, '#8fd0ef'), 0, .92, 0),
      at(mesh(new THREE.CylinderGeometry(.035, .05, .14, 12), jet), 0, .99, 0), spray, ...koi); // tia nước nối mặt bát lên chùm bọt
    fountain.userData.fish = koi;
    fountain.userData.update = t => {
      spray.scale.setScalar(1 + Math.sin(t * 6) * .15);
      koi.forEach(f => { const a = t * .5 + f.userData.phase; f.position.set(Math.cos(a) * .5, .265, Math.sin(a) * .5); f.rotation.y = -a - Math.PI / 2; });
    };
    return fountain;
  },
  // Xích đu lốp xe (thay võng): lốp nằm ngang treo trên xà, lòng lốp cao ~.42 để mèo nhảy vào cuộn tròn.
  // Lốp treo bằng 3 dây chụm vào một móc dưới xà; cả bộ lắc quanh móc như con lắc (pendulum).
  'hammock-tire'() {
    const wood = '#8a5a3a', beamY = 1.47, hookY = beamY - .07, tireY = .36, L = hookY - tireY;
    const tire = at(mesh(new THREE.TorusGeometry(.3, .12, 16, 40), '#3a3a3a'), 0, -L, 0);
    tire.rotation.x = Math.PI / 2;
    const hook = new THREE.Vector3(0, -.04, 0);
    const ropes = [0, 2.1, 4.2].map(a => ropeBetween(new THREE.Vector3(Math.cos(a) * .3, -L + .11, Math.sin(a) * .3), hook, .012, '#e6c79a'));
    const swing = pendulum(new THREE.Vector3(0, hookY, 0), L, tire, at(cyl(.24, .24, .03, '#ec5b8c'), 0, -L + .02, 0), ...ropes,
      at(mesh(new THREE.TorusGeometry(.04, .012, 8, 16), '#9a9a9a'), 0, -.02, 0));
    const frame = group(at(cyl(.06, .07, 1.5, wood), -.9, .75, 0), at(cyl(.06, .07, 1.5, wood), .9, .75, 0),
      at(cyl(.06, .06, 1.9, wood), 0, beamY, 0).rotateZ(Math.PI / 2), swing);
    frame.userData.swing = swing; // mèo nhảy vào / ra thì đẩy lốp lắc
    frame.userData.ride = swing; // mèo ngồi trong lốp đung đưa theo (deco-room.mjs rideAlong)
    frame.userData.update = t => swing.userData.step(t);
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
  const kind = entry.style || entry.id; // style: món dùng lại kiểu nền của món khác
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = entry.color; g.fillRect(0, 0, 512, 512);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { g.fillStyle = rnd() > .5 ? '#ffffff1c' : '#2a5a1a1c'; g.fillRect(rnd() * 512, rnd() * 512, 3, 7); }
  if (kind === 'ground-clover') for (let i = 0; i < 160; i++) { g.fillStyle = '#5fa83e88'; const x = rnd() * 512, y = rnd() * 512; [0, 2.1, 4.2].forEach(a => { g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 5, 0, TAU); g.fill(); }); }
  if (kind === 'ground-meadow') for (let i = 0; i < 220; i++) { g.fillStyle = FLOWER_COLORS[i % FLOWER_COLORS.length]; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 4, 0, TAU); g.fill(); }
  if (kind === 'ground-path') {
    g.fillStyle = '#9fd46a'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 * 32; x < 512; x += 64) { g.fillStyle = rnd() > .5 ? '#e0d9cc' : '#cfc7b8'; g.beginPath(); g.ellipse(x + 30, y + 30, 26, 22, rnd(), 0, TAU); g.fill(); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; // nền vườn mở rộng lặp texture theo chiều dài (không kéo giãn)
  return texture;
}

// Chất cát (hộp cát, bồn rùa): nền vàng cát + vệt cào gợn sóng + hàng nghìn hạt sáng / tối + vài vỏ ốc, sỏi nhỏ.
let sandTexture = null;
function sandMat(tint = '#ffffff') { // tint nhân với texture: cát ướt / nén thì sẫm hơn
  if (!sandTexture) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const g = canvas.getContext('2d');
    g.fillStyle = '#efd8a4'; g.fillRect(0, 0, 256, 256);
    let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 8; y < 256; y += 18) [['#dcc086', 3, 0], ['#fbeac4', 1.5, -3]].forEach(([color, width, dy]) => {
      g.strokeStyle = color; g.lineWidth = width; g.beginPath();
      for (let x = 0; x <= 256; x += 8) { const yy = y + dy + Math.sin(x / 28 + y * .7) * 4; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    });
    for (let i = 0; i < 6000; i++) {
      const r = rnd(); g.fillStyle = r < .45 ? '#c9a66a' : r < .8 ? '#fff4d8' : r < .93 ? '#e2c48c' : '#a98349';
      const size = rnd() < .9 ? 1 : 2; g.fillRect(rnd() * 256, rnd() * 256, size, size);
    }
    for (let i = 0; i < 14; i++) { g.fillStyle = ['#ffffff', '#f5c6c6', '#cbbfae'][i % 3]; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 2.5, 1.5 + rnd() * 2, rnd() * 3, 0, TAU); g.fill(); }
    sandTexture = new THREE.CanvasTexture(canvas);
    sandTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return mat(tint, { map: sandTexture });
}

// Hàng rào quanh vườn, dựng lại khi đổi kiểu. Thấp nên không cần mờ đi như tường phòng.
// `half` = nửa cạnh khoảnh vườn (mặc định cả vườn; thumbnail Deco dùng khoảnh nhỏ).
// `gates` = [{ side, u, w }]: chừa cổng trên cạnh side (0 = -z, 1 = +z, 2 = -x, 3 = +x), tâm cổng ở u theo trục dọc
// cạnh đó trong toạ độ cục bộ của đoạn rào (cạnh 0: u = x, 1: u = -x, 2: u = -z, 3: u = z); hai bên cổng có cột.
// `halfX`: nửa chiều dài theo x (vườn mở rộng là hình chữ nhật dài theo x); mặc định = half (hình vuông).
export function buildFence(entry, half = HALF, gates = [], halfX = half) {
  const kind = entry.style || entry.id;
  const fence = markOutlineUnit(new THREE.Group()); // cả hàng rào là một khối: chấn song đè lên cột không có nét trong
  // Một đoạn rào chạy dọc trục x cục bộ từ x0 tới x1 (đoạn nguyên một cạnh thì nhô thêm .1 mỗi đầu để kín góc).
  const run = (x0, x1, capped) => {
    const span = x1 - x0, mid = (x0 + x1) / 2, extra = capped ? .2 : 0;
    if (kind === 'fence-hedge') return group(at(rbox(span + extra, .6, .32, .14, entry.color), mid, .3, 0));
    if (kind === 'fence-stone') {
      const g = group(), n = Math.max(1, Math.round(span / .675)), step = span / n;
      for (let i = 0; i < n; i++) g.add(at(rbox(step - .015, .34 + (i % 2) * .06, .3, .06, i % 2 ? '#c8c2b8' : '#b5aea3'), x0 + step * (i + .5), .18, 0));
      return g;
    }
    const g = group(at(box(span + extra, .06, .04, entry.color), mid, .42, 0), at(box(span + extra, .06, .04, entry.color), mid, .2, 0));
    const n = Math.max(1, Math.round(span / .5)), step = span / n;
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * step;
      g.add(at(rbox(.12, .6, .05, .02, entry.color), x, .3, .02));
      if (kind === 'fence-white') g.add(at(mesh(new THREE.ConeGeometry(.085, .1, 4), entry.color), x, .64, .02).rotateY(Math.PI / 4));
    }
    return g;
  };
  [[0, -half - .05, 0], [0, half + .05, Math.PI], [-halfX - .05, 0, Math.PI / 2], [halfX + .05, 0, -Math.PI / 2]].forEach(([x, z, rot], i) => {
    let side;
    const gate = gates.find(g => g.side === i), len = i < 2 ? halfX : half; // nửa chiều dài cạnh này
    if (gate) { // hai đoạn hai bên cổng + cột cổng
      const a = gate.u - gate.w / 2, b = gate.u + gate.w / 2, post = kind === 'fence-hedge' ? '#5fa83e' : kind === 'fence-stone' ? '#b5aea3' : entry.color;
      side = group(run(-len - .1, a, false), run(b, len + .1, false),
        at(rbox(.16, .78, .16, .04, post), a, .39, 0), at(rbox(.16, .78, .16, .04, post), b, .39, 0),
        at(ball(.09, post), a, .82, 0), at(ball(.09, post), b, .82, 0));
    } else side = run(-len, len, true);
    side.position.set(x, 0, z); side.rotation.y = rot;
    fence.add(side);
  });
  fence.traverse(node => { if (node.isMesh) node.castShadow = false; });
  return mergeStatic(fence); // hàng trăm chấn song / thanh ngang cùng màu -> vài mesh
}

// Bụi cây trang trí 4 góc vườn (ngoài lối đi của mèo).
// Mỗi bụi: vài khối tán lá lổn nhổn (đỉnh cầu bị đẩy lồi lõm theo nhiễu, tối dưới sáng trên), lá rời mọc chìa ra khỏi
// tán cho viền bụi lởm chởm, thêm hoa / quả mọng tuỳ góc, cỏ con + sỏi ở gốc. Ngẫu nhiên có seed: lần nào dựng cũng giống.
function lumpyPuff(r, dark, light, rnd) {
  const geo = new THREE.SphereGeometry(r, 22, 16);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  const k1 = rnd(0, TAU), k2 = rnd(0, TAU), k3 = rnd(0, TAU), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).divideScalar(r); // hướng từ tâm (theo vị trí -> đỉnh trùng ở đường nối vẫn khớp)
    const bump = .09 * Math.sin(5 * v.x + k1) * Math.sin(5 * v.y + k2) * Math.sin(5 * v.z + k3) + .05 * Math.sin(9 * v.x + 7 * v.z + k1);
    const flatBottom = v.y < -.3 ? .75 + (v.y + 1) / .7 * .25 : 1; // đáy bẹt xuống đất
    pos.setXYZ(i, v.x * r * (1 + bump), v.y * r * (1 + bump) * flatBottom, v.z * r * (1 + bump));
    c.copy(dark).lerp(light, THREE.MathUtils.smoothstep(v.y, -.6, .9)).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const material = mat('#ffffff'); material.vertexColors = true;
  return mesh(geo, material);
}
// Rải `count` bản của `geometry` lên mặt các khối tán (InstancedMesh: một lần vẽ cho cả chùm lá / hoa).
function scatterOn(puffs, geometry, color, count, rnd, { minUp = -.2, out = 1, scale = [1, 1] } = {}) {
  const inst = new THREE.InstancedMesh(geometry, mat(color), count), dummy = new THREE.Object3D(), dir = new THREE.Vector3();
  inst.castShadow = true;
  for (let n = 0; n < count; n++) {
    const [px, py, pz, pr] = puffs[Math.floor(rnd(0, puffs.length))];
    do dir.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); while (dir.lengthSq() > 1 || dir.lengthSq() < .05);
    dir.normalize(); if (dir.y < minUp) dir.y = -dir.y;
    dummy.position.set(px + dir.x * pr * out, py + dir.y * pr * out, pz + dir.z * pr * out);
    dummy.lookAt(dummy.position.x + dir.x, dummy.position.y + dir.y, dummy.position.z + dir.z); // trục z hướng ra ngoài tán
    dummy.rotateZ(rnd(0, TAU));
    dummy.scale.setScalar(rnd(scale[0], scale[1]));
    dummy.updateMatrix();
    inst.setMatrixAt(n, dummy.matrix);
  }
  return inst;
}
const CORNER_BUSHES = [ // điểm nhấn từng góc: hoa hồng / quả mọng đỏ / hoa trắng / cỏ lau cao
  { seed: 11, accent: 'flowers', color: '#ff8fa0' }, { seed: 23, accent: 'berries', color: '#e5483a' },
  { seed: 37, accent: 'flowers', color: '#fff4f0' }, { seed: 51, accent: 'reeds' },
];
const leafGeo = new THREE.SphereGeometry(.06, 8, 6).scale(.55, .22, 1); // lá dẹt, dài theo trục z (chìa ra ngoài tán)
const blossomGeo = new THREE.SphereGeometry(.045, 10, 8).scale(1, 1, .55);
const berryGeo = new THREE.SphereGeometry(.03, 10, 8);
function cornerBush(sx, sz, { seed, accent, color }) {
  const rnd = (lo, hi) => { seed = (seed * 16807) % 2147483647; return lo + (seed / 2147483647) * (hi - lo); };
  const dark = new THREE.Color('#4f9a36'), light = new THREE.Color('#9be06a');
  // Khối tán: một khối chính + các khối phụ dồn về phía trong vườn / hai bên hàng rào, cao thấp so le.
  const puffs = [[0, .32, 0, .34], [.24 * sx, .22, -.12 * sz, .25], [-.16 * sx, .2, .22 * sz, .23], [.06 * sx, .5, .08 * sz, .22], [-.24 * sx, .18, -.16 * sz, .19]];
  const bush = group(...puffs.map(([x, y, z, r]) => at(lumpyPuff(r, dark, light, rnd), x, y, z)));
  bush.add(scatterOn(puffs, leafGeo, '#6fbf4a', 70, rnd, { out: .98, scale: [.8, 1.3] }));
  bush.add(scatterOn(puffs, leafGeo, '#8fd46a', 50, rnd, { minUp: .1, out: 1, scale: [.7, 1.1] }));
  if (accent === 'flowers') {
    bush.add(scatterOn(puffs, blossomGeo, color, 16, rnd, { minUp: 0, out: 1.04 }));
    bush.add(scatterOn(puffs, berryGeo, '#ffd66b', 16, rnd, { minUp: .2, out: 1.08, scale: [.6, .8] }));
  } else if (accent === 'berries') bush.add(scatterOn(puffs, berryGeo, color, 22, rnd, { minUp: -.1, out: 1.03 }));
  else for (let i = 0; i < 7; i++) { // cỏ lau cao mọc xuyên lên từ sau bụi
    const h = rnd(.55, .85), blade = mesh(new THREE.ConeGeometry(.02, h, 6), i % 2 ? '#5fa83e' : '#7cc256');
    blade.position.set(-.1 * sx + rnd(-.15, .15), h / 2, -.1 * sz + rnd(-.15, .15)); blade.rotation.set(rnd(-.2, .2), 0, rnd(-.2, .2));
    const tip = at(ball(.03, '#c9a36a'), 0, h / 2, 0); tip.scale.y = 2.4; blade.add(tip);
    bush.add(blade);
  }
  // Gốc: vài viên sỏi, chỉ ở phía trong vườn (bụi sát góc hàng rào, rải đều quanh gốc sẽ lọt ra ngoài rào lên viền đế).
  const inward = Math.atan2(-sz, -sx);
  for (let i = 0; i < 3; i++) {
    const a = inward + rnd(-.6, .6), pebble = at(ball(rnd(.035, .06), i % 2 ? '#c8c2b8' : '#b5aea3'), Math.cos(a) * .5, .02, Math.sin(a) * .5);
    pebble.scale.y = .55; bush.add(pebble);
  }
  return markOutlineUnit(mergeStatic(bush)); // lá rời / hoa là InstancedMesh, giữ nguyên
}
// `bounds` = khung vườn { x0, x1, z0, z1 } (room-layout.mjs gardenBounds): bụi ở 4 góc khung (vườn mở rộng: 4 góc mới).
export function gardenCorners(bounds = { x0: -HALF, x1: HALF, z0: -HALF, z1: HALF }) {
  const corners = new THREE.Group();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    const bush = cornerBush(sx, sz, { ...CORNER_BUSHES[i] });
    // Nằm hẳn trong rào (tán ~.48 m sau khi thu .9): mép ngoài cách khung .13, trong cả tường đá / hàng rào cây (dày nhất, mặt trong cách khung .1).
    bush.position.set(sx < 0 ? bounds.x0 + .65 : bounds.x1 - .65, 0, sz < 0 ? bounds.z0 + .65 : bounds.z1 - .65); bush.scale.setScalar(.9);
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
