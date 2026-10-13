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
// Đá tự nhiên: khối 20 mặt chia 1 lần, mỗi đỉnh đẩy lệch theo nhiễu (cùng vị trí -> cùng độ lệch, mặt không bị hở),
// kéo dẹt / méo không đều, đáy mài phẳng để đá nằm vững trên đất. Mặt phẳng từng mảnh (flat normal) cho ra cạnh đá góc cạnh.
// `seed` khác nhau -> mỗi viên một hình. Kích thước ~ bán kính r (trước khi caller scale thêm).
export function rock(r, color, seed = 1) {
  const geo = new THREE.IcosahedronGeometry(r, 1), pos = geo.attributes.position, v = new THREE.Vector3();
  const hash = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.3) * 43758.5453; return h - Math.floor(h); };
  const sx = .85 + hash(1, 2, 3) * .5, sz = .85 + hash(4, 5, 6) * .5, tilt = (hash(7, 8, 9) - .5) * .5;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = .78 + hash(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)) * .4; // lồi lõm từng đỉnh ±20%
    v.multiplyScalar(k);
    v.x *= sx; v.z *= sz; v.y = v.y * .8 + v.x * tilt; // méo hai chiều, nghiêng mặt trên
    v.y = Math.max(v.y, -r * .35); // đáy phẳng
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); // khối 20 mặt không dùng chung đỉnh -> pháp tuyến phẳng từng mặt
  return mesh(geo, color);
}
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

// ---------- Nước ----------
// Mặt nước toon: gợn tròn loang chậm từ tâm + đốm lấp lánh, vẽ ngay trong shader (theo toạ độ của chính mặt nước).
// Mặc định KHÔNG trong suốt: vật trong suốt bị sắp lại thứ tự vẽ mỗi khi xoay camera -> dễ chập chờn với viền.
// Gọi waterTick(t) trong userData.update của món có nước để gợn chuyển động.
const waterTime = { value: 0 };
const waterTick = t => { waterTime.value = t; };
function waterMat(color = '#8fd0ef', extra = {}) {
  if (!TOON) return mat(color, { roughness: .15, ...extra });
  const material = toonMat({ color, ...extra });
  const toonCompile = material.onBeforeCompile;
  material.onBeforeCompile = function (shader) {
    toonCompile.call(this, shader);
    shader.uniforms.waterTime = waterTime;
    shader.vertexShader = 'varying vec3 vWaterPos;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterPos = position;');
    shader.fragmentShader = 'uniform float waterTime;\nvarying vec3 vWaterPos;\n' + shader.fragmentShader
      .replace('#include <emissivemap_fragment>', `{
        float d = length(vWaterPos.xz);
        float ring = smoothstep(.86, .95, sin(d * 15.0 - waterTime * 1.8) * .5 + .5) * smoothstep(.0, .12, d);
        float glint = smoothstep(.95, .99, (sin(vWaterPos.x * 13.0 + waterTime * 1.1) * sin(vWaterPos.z * 15.0 - waterTime * .9)) * .5 + .5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), max(ring * .22, glint * .55));
      }
      #include <emissivemap_fragment>`);
  };
  return material;
}
// Mặt nước phẳng mỏng: không viền (viền toon quanh đĩa mỏng thành vệt tối ở mép bát).
const waterDisc = (radius, y, material = waterMat()) => {
  const water = at(mesh(new THREE.CylinderGeometry(radius, radius, .01, radialSegments(radius)), material), 0, y, 0);
  water.castShadow = false;
  water.userData.noOutline = true;
  return water;
};
// Texture sọc xanh–trắng cho dòng nước: cuộn offset theo thời gian là thấy nước chảy dọc ống.
function flowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 4;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, '#bfe9fb'); grad.addColorStop(.35, '#ffffff'); grad.addColorStop(.5, '#e6f7ff'); grad.addColorStop(.8, '#9fdcf6'); grad.addColorStop(1, '#bfe9fb');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
const flowMat = texture => (TOON ? toonMat({ color: '#ffffff', map: texture }) : mat('#ffffff', { map: texture, roughness: .1 }));

// Đèn LED / neon (món Hiện đại): vật liệu tự sáng — hàm dựng dùng nó phải đặt userData.lightSource = true.
const led = color => glow(color, color, 1.2);
// Khung 4 thanh ôm quanh hình chữ nhật nửa cạnh hx × hz (thanh nằm ngay ngoài mép), ở độ cao y, tiết diện t.
function ledFrame(hx, hz, y, t, material) {
  return group(...[1, -1].flatMap(s => [at(box(hx * 2 + t * 2, t, t, material), 0, y, s * (hz + t / 2)), at(box(t, t, hz * 2, material), s * (hx + t / 2), y, 0)]));
}
// Trái tim nằm phẳng (mũi tim hướng +z, đáy y = 0, dày h, rộng ~1.7a): hình vuông xoay 45° + hai trụ ở hai cạnh sau.
// Ghép khối lồi (không đùn Shape lõm) để nấc toon chia gọn. Dựng đứng quay mặt +z: rotation.x = π/2 (bề dày chạy 0 → +z).
function heart(a, h, color) {
  const d = a / Math.SQRT2, c = (a / 2 - d / 2) / 2;
  const body = at(rbox(a, h, a, Math.min(.03, h * .4, a * .2), color), 0, h / 2, c);
  body.rotation.y = Math.PI / 4;
  return group(body, ...[1, -1].map(s => at(cyl(a / 2, a / 2, h, color), s * d / 2, h / 2, c - d / 2)));
}
function standingHeart(a, t, color) {
  const h = heart(a, t, color);
  h.rotation.x = Math.PI / 2;
  h.position.z = -t / 2;
  return group(h);
}
// Nơ: hai cánh dẹt xoè theo x + nút giữa, mặt trước +z.
function bow(s, color) {
  const wing = side => { const w = at(ball(s, color), side * s * .9, 0, 0); w.scale.set(1, .7, .45); w.rotation.z = side * .35; return w; };
  const knot = at(ball(s * .45, color), 0, 0, s * .1);
  knot.scale.z = .7;
  return group(wing(1), wing(-1), knot);
}
// Cá koi: thân dẹt + đuôi nón, đầu hướng +x; khối viền riêng (viền cá đè lên bồn vẫn đậm).
function koiFish(color, r, phase) {
  const fish = group(ball(r, color), at(mesh(new THREE.ConeGeometry(r * .75, r * 1.5, 10), color), -r * 1.5, 0, 0));
  fish.children[0].scale.set(1.4, .6, .8); fish.children[1].rotation.z = Math.PI / 2;
  fish.userData.phase = phase;
  return markOutlineUnit(fish);
}
// Chim đậu (chậu tắm chim): thân + đầu + mỏ, nhìn về +z; `home` để room-cats trả chim về sau khi bay mất.
function perchBird(color, beak, x, y, z) {
  const bird = group(ball(.08, color), at(ball(.055, color), .07, .07, 0), at(mesh(new THREE.ConeGeometry(.02, .05, 8), beak), .14, .07, 0).rotateZ(-Math.PI / 2));
  bird.children[0].scale.set(1.2, .9, .9);
  bird.position.set(x, y, z);
  bird.rotation.y = -Math.PI / 2;
  bird.userData.home = bird.position.clone();
  // chim là khối viền riêng: viền chim đè lên bát nước vẫn đậm
  return markOutlineUnit(bird);
}

// Mỗi chỗ có 3 món theo theme (deco-data.mjs THEMES): Gỗ = món gốc (id chỗ), Hồng, Hiện đại. Ba món cùng khuôn khổ + điểm neo cho mèo.
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
  // Luống tulip hồng: viền diềm bèo trắng kem / hồng, tulip đủ sắc hồng + lilac, cắm biển trái tim vàng.
  'flowers-tulips'() {
    const bed = group(at(cyl(.72, .76, .035, '#6b4a35', 48), 0, .0175, 0));
    const tulips = [], COLORS = ['#ff8fb6', '#ffc2d4', '#fff6f8', '#e6d4ff', '#ffb3c8'];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = .12 + (i % 4) * .16, h = .26 + (i % 3) * .06, color = COLORS[i % COLORS.length];
      const cup = at(ball(.065, color), 0, h, 0); cup.scale.set(.85, 1.2, .85);
      const tip = at(mesh(new THREE.ConeGeometry(.05, .07, 8), color), 0, h + .09, 0);
      const leaf = at(mesh(new THREE.ConeGeometry(.03, .2, 6), '#7fb069'), .05, .1, 0); leaf.rotation.z = -.35;
      const tulip = markOutlineUnit(group(at(cyl(.012, .014, h, '#7fb069', 6), 0, h / 2, 0), cup, tip, leaf));
      tulip.position.set(Math.cos(a) * r, .035, Math.sin(a) * r);
      bed.add(tulip);
      tulips.push(tulip);
    }
    // Diềm bèo: hạt tròn hồng / kem xếp sát nhau quanh mép (thấp, mèo vẫn bước qua).
    const scallops = [...Array(36)].map((_, i) => at(ball(.035, i % 2 ? '#ffb3c8' : '#fff6f8'), Math.cos(i / 36 * TAU) * .75, .03, Math.sin(i / 36 * TAU) * .75));
    const sign = group(at(cyl(.008, .008, .2, '#f2c14e', 6), 0, .1, 0), at(standingHeart(.08, .025, '#f2c14e'), 0, .23, 0));
    sign.position.set(.2, .035, .55);
    bed.add(mergeStatic(group(...scallops)), sign);
    return bendOnWalk(bed, tulips, .05);
  },
  // Bồn cây hiện đại: mâm bê tông bát giác thấp (mèo vẫn bước qua), cỏ lá kiếm + cầu cây cắt tỉa, dải LED cyan quanh chân.
  'flowers-modern'() {
    const bed = group(at(cyl(.74, .76, .05, '#9a9ea6', 8), 0, .025, 0), at(cyl(.68, .68, .012, '#3a3d43', 8), 0, .056, 0),
      at(mesh(new THREE.TorusGeometry(.765, .012, 6, 8), led('#3fe0ff')), 0, .012, 0).rotateX(Math.PI / 2));
    bed.userData.lightSource = true;
    const plants = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + (i % 2) * .26, r = i % 3 ? .5 : .24;
      const plant = i % 3 === 0
        // cầu cây cắt tỉa tròn trên cuống mảnh
        ? group(at(cyl(.012, .012, .14, '#3a3d43', 6), 0, .07, 0), at(ball(.1, '#5fae46'), 0, .2, 0))
        // bụi lá kiếm thẳng đứng, đầu nhọn
        : group(...[0, 1, 2].map(k => { const blade = at(mesh(new THREE.ConeGeometry(.025, .34 + k * .06, 4), k % 2 ? '#7fb069' : '#4f8f3e'), (k - 1) * .04, (.34 + k * .06) / 2, 0); blade.rotation.z = (k - 1) * .2; return blade; }));
      plant.position.set(Math.cos(a) * r, .062, Math.sin(a) * r);
      bed.add(markOutlineUnit(plant));
      plants.push(plant);
    }
    return bendOnWalk(bed, plants, .03);
  },
  stump() {
    const stump = group(at(cyl(.38, .44, .45, '#9a6a45'), 0, .225, 0), at(cyl(.36, .36, .02, '#e6c79a'), 0, .455, 0),
      at(cyl(.2, .2, .021, '#d2ad7a'), 0, .457, 0));
    for (let i = 0; i < 3; i++) { const root = rbox(.14, .1, .3, .04, '#8a5a3a'); root.rotation.y = i * 2.1; root.translateZ(.4); root.position.y = .05; stump.add(root); }
    return stump;
  },
  // Ghế pouf trái tim bọc nhung hồng, viền diềm kem, bốn chân vàng, nơ ở mũi tim; mặt nệm cao .46 (mèo cào rồi nhảy lên ngồi như gốc cây).
  'stump-pink'() {
    const gold = '#f2c14e';
    const legs = [[-.2, -.14], [.2, -.14], [-.1, .16], [.1, .16]].map(([x, z]) => at(cyl(.03, .02, .1, gold, 10), x, .05, z));
    return group(...legs, at(heart(.5, .36, '#ffb3c8'), 0, .1, 0), at(heart(.53, .04, '#fff6f8'), 0, .1, 0),
      at(bow(.06, '#ff8fb6'), 0, .3, .41));
  },
  // Khối ghế vuông đen nhám trên đế lùi vào trong, hai vòng LED (cyan dưới, tím trên); mặt ngồi cao .46.
  'stump-modern'() {
    const seat = group(at(rbox(.46, .04, .46, .015, '#1f2125'), 0, .02, 0), at(rbox(.6, .42, .6, .05, '#26282c'), 0, .25, 0),
      ledFrame(.3, .3, .1, .02, led('#3fe0ff')), ledFrame(.3, .3, .4, .015, led('#b07cff')));
    seat.userData.lightSource = true;
    return seat;
  },
  catnip() {
    // Cây catnip thật: nhiều nhánh mọc thẳng toả ra từ gốc, lá hình trứng mọc đối từng cặp (cặp sau xoay 90°),
    // đầu nhánh là bông hoa tím dạng bông đuôi. Không còn là cục lá tròn.
    const LEAF = ['#8fbf6a', '#a3cf7e', '#7fb35c'], BLOOM = ['#c9a6f5', '#b48ee8'];
    const leafGeo = new THREE.SphereGeometry(1, 8, 6); // lá nhỏ dẹt: 8×6 cạnh đủ tròn dưới viền (14×10 làm bụi ~21 nghìn tam giác)
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
  // Chậu catnip hồng: chậu sứ hồng viền diềm bèo kem, tim vàng trước chậu, bụi lá tròn hoa hồng / lilac; mèo gặm lá (bụi rung) rồi lăn lộn.
  'catnip-pot'() {
    const leaves = group();
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, r = .06 + (i % 3) * .05, leaf = mesh(new THREE.SphereGeometry(1, 12, 8), ['#7fb35c', '#8fbf6a', '#a3cf7e'][i % 3]);
      leaf.scale.set(.13, .035, .075);
      leaf.position.set(Math.cos(a) * r, .06 + (i % 4) * .07, Math.sin(a) * r);
      leaf.rotation.set(0, -a, .5 - (i % 3) * .25);
      leaves.add(leaf);
    }
    for (let i = 0; i < 4; i++) leaves.add(at(ball(.035, i % 2 ? '#ff8fb6' : '#e6d4ff'), Math.cos(i * 1.6) * .08, .36 + (i % 2) * .04, Math.sin(i * 1.6) * .08));
    mergeStatic(leaves); // lá + hoa gộp theo màu, cả bụi vẫn rung như một khối
    leaves.position.y = .28;
    const scallops = [...Array(16)].map((_, i) => at(ball(.03, '#fff6f8'), Math.cos(i / 16 * TAU) * .3, .25, Math.sin(i / 16 * TAU) * .3));
    // Tim dán trước chậu: nghiêng theo thành chậu (côn: trên rộng hơn dưới), cách thành 6 mm.
    const badge = group(standingHeart(.09, .02, '#f2c14e'));
    badge.position.set(0, .14, .239); badge.rotation.x = .23;
    const pot = group(at(cyl(.27, .2, .3, '#ffb3c8', 24), 0, .15, 0), at(cyl(.3, .3, .06, '#ffc2d4', 24), 0, .28, 0), at(cyl(.25, .25, .02, '#5a3a2a', 24), 0, .3, 0),
      mergeStatic(group(...scallops)), badge, leaves);
    pot.userData.leaves = leaves;
    return pot;
  },
  // Khay cỏ mèo hiện đại: khay đen nhám viền thép, cỏ lúa mì mọc dày; thanh đèn grow-light tím trên hai cột thép. Mèo gặm cỏ (cỏ rung) rồi lăn lộn.
  'catnip-grass'() {
    const leaves = group();
    for (let i = 0; i < 34; i++) {
      const h = .22 + (i % 5) * .05, blade = mesh(new THREE.ConeGeometry(.022, h, 5), ['#5fb83a', '#7fcf4a', '#4f9f2e'][i % 3]);
      blade.position.set(-.32 + (i % 9) * .08, h / 2, -.14 + Math.floor(i / 9) * .09);
      blade.rotation.set(((i * 37) % 7 - 3) * .05, 0, ((i * 13) % 7 - 3) * .06);
      leaves.add(blade);
    }
    leaves.position.y = .21;
    const steel = '#c8ccd2';
    const tray = group(at(rbox(.82, .2, .48, .04, '#26282c'), 0, .1, 0), at(box(.74, .02, .4, '#4a3a30'), 0, .2, 0), ledFrame(.41, .24, .19, .015, mat(steel)),
      at(cyl(.012, .012, .9, steel, 8), -.43, .45, 0), at(cyl(.012, .012, .9, steel, 8), .43, .45, 0),
      at(rbox(.94, .04, .1, .015, '#1f2125'), 0, .92, 0), at(box(.86, .012, .05, led('#b07cff')), 0, .894, 0), leaves);
    tray.userData.leaves = leaves;
    tray.userData.lightSource = true;
    return tray;
  },
  lantern() {
    const glow = mesh(roundedBox(.3, .36, .3, ROUND, .05), mat('#fff0b8', { emissive: '#ffcf5a', emissiveIntensity: .9 }));
    const light = new THREE.PointLight('#ffcf7a', 4, 5, 1.6);
    light.position.y = 1.3;
    return group(at(cyl(.2, .24, .08, '#5a4a3a'), 0, .04, 0), at(cyl(.04, .04, 1.1, '#5a4a3a'), 0, .6, 0), at(glow, 0, 1.3, 0),
      at(mesh(new THREE.ConeGeometry(.26, .16, 4), '#5a4a3a'), 0, 1.56, 0).rotateY(Math.PI / 4), light);
  },
  // Đèn trái tim: cột kem có khoen vàng, nơ hồng; đèn hình tim sáng hồng ấm trên đỉnh, hạt vàng trên nóc. Mèo nằm sưởi ngủ cạnh.
  'lantern-pink'() {
    const gold = '#f2c14e', cream = '#fff6f8';
    const light = new THREE.PointLight('#ffc6d6', 4, 5, 1.6);
    light.position.y = 1.33;
    return group(at(cyl(.2, .24, .08, '#ffb3c8'), 0, .04, 0), at(cyl(.035, .04, 1.1, cream), 0, .6, 0),
      at(cyl(.045, .045, .025, gold), 0, .35, 0), at(cyl(.045, .045, .025, gold), 0, .8, 0), at(cyl(.05, .03, .05, gold), 0, 1.165, 0),
      at(standingHeart(.2, .12, mat('#ffe0e9', { emissive: '#ff9fc0', emissiveIntensity: .9 })), 0, 1.33, 0),
      at(ball(.03, gold), 0, 1.47, 0), at(bow(.06, '#ff8fb6'), 0, .95, .045), light);
  },
  // Cột đèn hiện đại: đế + thân vuông đen nhám, dải neon cyan dọc mặt trước, đỉnh là vòng halo sáng; vòng LED tím quanh đế.
  'lantern-lamppost'() {
    const black = '#1f2125', cyan = led('#3fe0ff');
    const light = new THREE.PointLight('#bff4ff', 4, 5, 1.6);
    light.position.y = 1.92;
    const post = group(at(rbox(.36, .06, .36, .025, '#26282c'), 0, .03, 0), ledFrame(.18, .18, .03, .012, led('#ff4fd8')),
      at(rbox(.08, 1.66, .08, .03, black), 0, .89, 0), at(box(.02, 1.4, .012, cyan), 0, .85, .046),
      at(mesh(new THREE.TorusGeometry(.2, .03, 10, 40), cyan), 0, 1.92, 0), light);
    post.userData.lightSource = true;
    return post;
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
  // Hộp cát sáu cạnh hồng có dù sọc hồng / kem (diềm bèo kem quanh mép): mặt cát cao ~.2, tâm để trống cho mèo nhảy vào đào.
  'sandbox-parasol'() {
    const bucket = group(at(cyl(.07, .05, .1, '#e6d4ff', 12), 0, .05, 0), at(mesh(new THREE.ConeGeometry(.07, .08, 12), '#f2c14e'), 0, .14, 0));
    bucket.position.set(.28, .21, -.22);
    // Tán dù: một khối nón duy nhất tô sọc hồng / kem bằng màu đỉnh theo từng múi (8 múi, 16 cạnh = 2 cạnh / múi).
    // Không chồng nón sọc lên nón nền: hai mặt gần trùng nhau gây z-fighting lộ vạch trên sọc.
    const canopyGeo = new THREE.ConeGeometry(.6, .22, 16).toNonIndexed(), cpos = canopyGeo.attributes.position, ccol = new Float32Array(cpos.count * 3);
    const PINK = new THREE.Color('#ff8fb6'), CREAM = new THREE.Color('#fff6f8');
    for (let f = 0; f < cpos.count; f += 3) {
      const cx = cpos.getX(f) + cpos.getX(f + 1) + cpos.getX(f + 2), cz = cpos.getZ(f) + cpos.getZ(f + 1) + cpos.getZ(f + 2);
      const sector = Math.floor(((Math.atan2(cx, cz) + TAU) % TAU) / (TAU / 8));
      for (let k = 0; k < 3; k++) (sector % 2 ? CREAM : PINK).toArray(ccol, (f + k) * 3);
    }
    canopyGeo.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
    const canopyMat = mat('#ffffff');
    canopyMat.vertexColors = true;
    const canopy = at(mesh(canopyGeo, canopyMat), 0, 1.35, 0);
    const parasol = group(at(cyl(.02, .02, 1.25, '#fff6f8', 8), 0, .7, 0), canopy, at(ball(.04, '#f2c14e'), 0, 1.48, 0));
    parasol.position.set(-.32, .02, -.3);
    parasol.rotation.z = .12;
    // Diềm bèo: 3 hạt kem trên mỗi cạnh của thành sáu cạnh (đỉnh trụ 6 cạnh ở góc i/6·2π, x = r·sin, z = r·cos).
    const corner = i => new THREE.Vector3(Math.sin(i / 6 * TAU) * .61, .2, Math.cos(i / 6 * TAU) * .61);
    const scallops = [];
    for (let i = 0; i < 6; i++) for (const t of [.25, .5, .75]) scallops.push(at(ball(.04, '#fff6f8'), ...corner(i).lerp(corner(i + 1), t).toArray()));
    return group(at(cyl(.62, .58, .22, '#ffb3c8', 6), 0, .11, 0), at(cyl(.52, .52, .03, sandMat(), 6), 0, .22, 0), mergeStatic(group(...scallops)),
      parasol, bucket, at(heart(.1, .04, '#ff8fb6'), .1, .235, .22));
  },
  // Hố cát hiện đại: thành vuông đen nhám, nắp thành thép trắng, dải LED cyan quanh chân, đồ chơi khối hình học; mặt cát ~.18 như hộp cát gốc.
  'sandbox-modern'() {
    const wall = '#26282c', cap = '#f5f8fb', wet = sandMat('#d9b77a');
    const pit = group(at(rbox(1.05, .2, .08, .03, wall), 0, .1, .5), at(rbox(1.05, .2, .08, .03, wall), 0, .1, -.5),
      at(rbox(.08, .2, .89, .03, wall), .5, .1, 0), at(rbox(.08, .2, .89, .03, wall), -.5, .1, 0),
      at(box(1.08, .02, .1, cap), 0, .21, .5), at(box(1.08, .02, .1, cap), 0, .21, -.5), at(box(.1, .02, .9, cap), .5, .21, 0), at(box(.1, .02, .9, cap), -.5, .21, 0),
      at(box(.9, .14, .9, sandMat()), 0, .105, 0), ledFrame(.54, .54, .03, .015, led('#3fe0ff')),
      at(rbox(.18, .1, .18, .03, wet), -.22, .225, -.2), at(rbox(.1, .08, .1, .03, wet), -.22, .315, -.2),
      at(rbox(.12, .12, .12, .03, '#ff4fd8'), .25, .235, -.18).rotateY(.5), at(ball(.06, cap), -.18, .235, .2));
    pit.userData.lightSource = true;
    return pit;
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
    const door = new THREE.Mesh(new THREE.ShapeGeometry(arch(.44, .26), 24), new THREE.MeshBasicMaterial({ color: '#4a2e20', userData: { nightDim: true } }));
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
  // Nhà nấm hồng: thân nấm kem có cửa vòm, mũ hồng chấm trắng viền diềm bèo, tim vàng trên cửa; nóc mũ cao 1.2 để mèo leo lên canh vườn.
  'cathouse-mushroom'() {
    const cream = '#fff6f8';
    const stalk = at(cyl(.42, .5, .72, cream, 28), 0, .36, 0);
    const cap = at(mesh(new THREE.SphereGeometry(.74, 32, 16, 0, TAU, 0, Math.PI / 2), '#ff8fb6'), 0, .7, 0);
    cap.scale.y = .68;
    const spots = [[0, .5, 0, .12], [.42, .37, .2, .1], [-.4, .38, .22, .11], [.2, .36, -.45, .1], [-.25, .4, -.4, .09], [.5, .2, -.1, .08]].map(([x, y, z, r]) => {
      const dir = new THREE.Vector3(x, y, z).normalize(), spot = at(ball(r, cream), dir.x * .74, .7 + dir.y * .74 * .68, dir.z * .74);
      spot.scale.set(1, .35, 1);
      spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      return spot;
    });
    const frill = [...Array(22)].map((_, i) => at(ball(.045, cream), Math.cos(i / 22 * TAU) * .74, .69, Math.sin(i / 22 * TAU) * .74));
    const archShape = new THREE.Shape(); archShape.moveTo(-.17, 0); archShape.lineTo(-.17, .22); archShape.absarc(0, .22, .17, Math.PI, 0, true); archShape.lineTo(.17, 0); archShape.lineTo(-.17, 0);
    const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 20), new THREE.MeshBasicMaterial({ color: '#4a2e20', userData: { nightDim: true } }));
    door.position.set(0, .04, .505);
    const porch = at(rbox(.46, .5, .1, .03, cream), 0, .25, .45);
    return group(at(cyl(.56, .62, .06, '#ffc2d4', 28), 0, .03, 0), stalk, cap, ...spots, mergeStatic(group(...frill)), porch, door,
      at(standingHeart(.1, .03, '#f2c14e'), 0, .6, .438));
  },
  // Pod nhà mèo: thân trụ + vòm đen nhám, tai mèo trên nóc, mặt trước phẳng có lỗ cửa tròn viền LED cyan, vòng LED tím quanh eo.
  // Nóc vòm cao 1.2 để mèo leo lên; mèo chui vào cửa như nhà gỗ.
  'cathouse-modern'() {
    const shell = '#26282c', R = .62;
    const dome = at(mesh(new THREE.SphereGeometry(R, 40, 20, 0, TAU, 0, Math.PI / 2), shell), 0, .6, 0);
    dome.scale.y = .97;
    const door = new THREE.Mesh(new THREE.CircleGeometry(.22, 32), new THREE.MeshBasicMaterial({ color: '#15161a', userData: { nightDim: true } }));
    door.position.set(0, .34, .656);
    const ears = [1, -1].map(s => { const ear = at(mesh(new THREE.ConeGeometry(.12, .2, 16), shell), s * .3, 1.21, 0); ear.rotation.z = -s * .4; return ear; });
    const pod = group(at(cyl(R - .04, R - .02, .06, '#3a3d43'), 0, .03, 0), at(cyl(R, R, .54, shell), 0, .33, 0), dome, ...ears,
      at(rbox(.72, .6, .2, .04, '#1f2125'), 0, .36, .55), door, at(mesh(new THREE.TorusGeometry(.245, .022, 10, 40), led('#3fe0ff')), 0, .34, .67),
      at(mesh(new THREE.TorusGeometry(R, .018, 8, 64), led('#b07cff')), 0, .68, 0).rotateX(Math.PI / 2));
    pod.userData.lightSource = true;
    return pod;
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
      const s = rock(size, STONE_COLORS[Math.floor(rnd(0, STONE_COLORS.length))], rnd(0, 1000));
      s.scale.set(rnd(1.1, 1.4), rnd(.6, .9), rnd(.9, 1.15));
      s.position.set(Math.cos(a) * r, size * .2, Math.sin(a) * r); s.rotation.y = rnd(0, TAU);
      stones.add(s);
      if (rnd(0, 1) < .35) { // sỏi nhỏ lăn ra ngoài viền
        const p = rock(rnd(.04, .065), STONE_COLORS[Math.floor(rnd(0, STONE_COLORS.length))], rnd(0, 1000));
        const pr = r + size * rnd(.9, 1.3), pa = a + rnd(-.08, .08);
        p.scale.y = .75; p.rotation.y = rnd(0, TAU); p.position.set(Math.cos(pa) * pr, .01, Math.sin(pa) * pr); stones.add(p);
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
    const koi = ['#f39a45', '#fff4f0'].map((color, i) => koiFish(color, .07, i * Math.PI));
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
  // Đài phun nước hồng: bồn hồng phấn có diềm bèo kem quanh chân, cá hồng / vàng bơi; mèo rình cá rồi khều nước.
  'pond-fountain'() {
    const STONE = '#ffc2d4', UPPER = '#ffe0e9', RIM = '#fff6f8';
    // Bồn dưới giữ trong suốt nhẹ để thấy cá bơi dưới mặt nước.
    const water = mesh(new THREE.CylinderGeometry(.74, .74, .02, 48), waterMat('#6fc3e0', { transparent: true, opacity: .85 }));
    water.castShadow = false;
    water.userData.noOutline = true;
    // ----- Dòng nước: tia giữa phụt lên Y0 rồi xoè ra ARCS vòi cong (parabol) rơi xuống bồn dưới ở bán kính R_LAND,
    // bay qua trên vành bát trên. Sọc trên ống cuộn theo thời gian = nước chảy; hạt nước bay theo vòi; gợn tròn nơi nước rơi.
    const ARCS = 8, Y0 = 1.16, R_LAND = .58, Y_LAND = .29, LIFT = 1.0;
    const DROP = (Y0 + LIFT * R_LAND - Y_LAND) / (R_LAND * R_LAND);
    const arcAt = (a, r, out = new THREE.Vector3()) => out.set(Math.cos(a) * r, Y0 + LIFT * r - DROP * r * r, Math.sin(a) * r);
    const flow = flowTexture(), jetFlow = flow.clone();
    flow.repeat.set(3, 1); jetFlow.repeat.set(1, 1);
    const streams = [...Array(ARCS)].map((_, i) => {
      const a = i / ARCS * TAU, points = [...Array(17)].map((__, k) => arcAt(a, k / 16 * R_LAND));
      const stream = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, .019, 8), flowMat(flow));
      stream.castShadow = false;
      stream.userData.noOutline = true; // ống nước mảnh: viền làm nó thành nét đen
      return stream;
    });
    const jetColumn = at(mesh(new THREE.CylinderGeometry(.02, .03, Y0 - .93, 12, 1, true), flowMat(jetFlow)), 0, (Y0 + .93) / 2, 0);
    jetColumn.userData.noOutline = true;
    // Bọt trắng trên đỉnh tia: vài viên nhấp nhô lệch pha.
    const foam = [...Array(5)].map((_, i) => at(ball(.03 - (i % 2) * .008, '#ffffff'), Math.cos(i * 1.26) * .035, Y0, Math.sin(i * 1.26) * .035));
    foam.forEach(f => { f.castShadow = false; f.userData.noOutline = true; });
    // Hạt nước bay dọc các vòi (một InstancedMesh, cập nhật vị trí mỗi khung).
    const DROPS = 32, dummy = new THREE.Object3D(), dropPos = new THREE.Vector3();
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.016, 8, 6), TOON ? toonMat({ color: '#e6f7ff' }) : mat('#e6f7ff'), DROPS);
    drops.castShadow = false;
    drops.frustumCulled = false;
    // Gợn tròn nơi nước rơi: vòng trắng nở ra rồi mờ dần, lệch pha từng vòi; cao hơn mặt nước 1 cm (không z-fighting).
    const ripples = [...Array(ARCS)].map((_, i) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.035, .05, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, userData: { nightDim: true } }));
      ring.rotation.x = -Math.PI / 2;
      arcAt(i / ARCS * TAU, R_LAND, ring.position).y = Y_LAND;
      return ring;
    });
    const koi = ['#ff8fb6', '#f2c14e'].map((color, i) => koiFish(color, .06, i * Math.PI));
    // Diềm bèo quanh chân bồn: hạt kem / hồng xen kẽ.
    const frill = [...Array(28)].map((_, i) => at(ball(.04, i % 2 ? '#ffb3c8' : RIM), Math.cos(i / 28 * TAU) * .855, .18, Math.sin(i / 28 * TAU) * .855));
    // Các lớp tách độ cao rõ ràng (không có hai mặt trùng nhau -> không chớp z-fighting):
    // bệ (đỉnh .26) < mặt nước (.28) < vành bồn hình xuyến (đỉnh ~.34) bao quanh mép nước.
    const fountain = group(at(cyl(.82, .9, .26, STONE), 0, .13, 0), at(water, 0, .27, 0), mergeStatic(group(...frill)),
      at(mesh(new THREE.TorusGeometry(.8, .07, 12, 56), RIM), 0, .28, 0).rotateX(Math.PI / 2),
      at(cyl(.1, .14, .55, STONE), 0, .55, 0), at(mesh(new THREE.TorusGeometry(.115, .02, 8, 24), '#f2c14e'), 0, .6, 0).rotateX(Math.PI / 2),
      at(cyl(.3, .14, .12, UPPER), 0, .86, 0),
      // bát trên: mặt bát .92 < mặt nước .935 < vành xuyến (đỉnh ~.945) che mép nước
      waterDisc(.27, .93), at(mesh(new THREE.TorusGeometry(.285, .025, 10, 40), RIM), 0, .92, 0).rotateX(Math.PI / 2),
      jetColumn, ...foam, ...streams, drops, ...ripples, ...koi);
    fountain.userData.fish = koi;
    fountain.userData.update = t => {
      waterTick(t);
      flow.offset.x = -t * 1.4; // sọc chạy từ đỉnh xuống theo vòi
      jetFlow.offset.y = -t * 2.2; // sọc chạy lên trong tia giữa
      foam.forEach((f, i) => { f.position.y = Y0 + Math.sin(t * 9 + i * 1.7) * .02; f.scale.setScalar(.85 + Math.sin(t * 7 + i) * .2); });
      for (let i = 0; i < DROPS; i++) {
        const s = (t * .55 + i * .618) % 1, a = (i % ARCS) / ARCS * TAU + Math.sin(i * 3.1) * .12;
        arcAt(a, s * R_LAND * (1.02 + (i % 3) * .03), dropPos);
        dummy.position.copy(dropPos);
        dummy.scale.setScalar(Math.sin(s * Math.PI) * .9 + .3);
        dummy.updateMatrix();
        drops.setMatrixAt(i, dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
      ripples.forEach((ring, i) => {
        const k = (t * .8 + i * .37) % 1;
        ring.scale.set(1 + k * 2.4, 1 + k * 2.4, 1); // nở trong mặt phẳng vòng, không giãn theo pháp tuyến
        ring.material.opacity = (1 - k) * .8;
      });
      koi.forEach(f => { const a = t * .5 + f.userData.phase; f.position.set(Math.cos(a) * .5, .265, Math.sin(a) * .5); f.rotation.y = -a - Math.PI / 2; });
    };
    return fountain;
  },
  // Ao LED: bể chữ nhật viền đá đen bo góc, đáy sẫm, nước trong thấy cá bơi vòng elip; dải LED cyan quanh mép trong viền,
  // hai quả cầu đèn hồng nổi trên mặt nước. Mèo rình cá rồi khều nước.
  'pond-modern'() {
    const HX = .72, HZ = .52, T = .12, H = .14, black = '#26282c';
    const rim = group(...[1, -1].flatMap(s => [at(rbox(HX * 2 + T * 2, H, T, .04, black), 0, H / 2, s * (HZ + T / 2)), at(rbox(T, H, HZ * 2, .04, black), s * (HX + T / 2), H / 2, 0)]));
    const floor = at(box(HX * 2, .02, HZ * 2, '#1f3f4a'), 0, .01, 0);
    const water = at(mesh(new THREE.BoxGeometry(HX * 2, .01, HZ * 2), waterMat('#5fc8e8', { transparent: true, opacity: .8 })), 0, .1, 0);
    for (const m of [floor, water]) { m.castShadow = false; m.userData.noOutline = true; }
    const orb = led('#ff4fd8');
    const koi = ['#ff9e3d', '#f5f8fb'].map((color, i) => koiFish(color, .06, i * Math.PI));
    const pond = group(rim, floor, water, ledFrame(HX - .012, HZ - .012, .12, .012, led('#3fe0ff')),
      at(ball(.05, orb), .45, .11, -.28), at(ball(.04, orb), -.5, .11, .26), ...koi);
    pond.userData.fish = koi;
    pond.userData.lightSource = true;
    pond.userData.update = t => {
      waterTick(t);
      koi.forEach(f => {
        // elip .45 × .28: đầu cá (+x) theo hướng bơi (dx, dz) -> rotation.y = atan2(-dz, dx)
        const a = t * .5 + f.userData.phase;
        f.position.set(Math.cos(a) * .45, .06, Math.sin(a) * .28);
        f.rotation.y = Math.atan2(-Math.cos(a) * .28, -Math.sin(a) * .45);
      });
    };
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
  // Giỏ treo hồng: giỏ đan hồng phấn đệm hồng, treo bằng ba dây dưới cần trắng kem có nơ, lắc như con lắc; lòng giỏ cao ~.42 để mèo nhảy vào.
  'hammock-basket'() {
    const post = '#fff6f8', gold = '#f2c14e', beamY = 1.47, hookY = beamY - .07, bodyY = .36, L = hookY - bodyY;
    const bowl = at(cyl(.38, .27, .24, '#ffc2d4', 32), 0, -L, 0);
    const rim = at(mesh(new THREE.TorusGeometry(.38, .05, 10, 40), '#ffb3c8'), 0, -L + .12, 0).rotateX(Math.PI / 2);
    const weave = [.04, -.04].map(y => at(mesh(new THREE.TorusGeometry(.34 - y * .4, .014, 6, 40), post), 0, -L + y, 0).rotateX(Math.PI / 2));
    const cushion = at(cyl(.32, .3, .06, '#ff8fb6', 32), 0, -L + .1, 0);
    const hook = new THREE.Vector3(0, -.04, 0);
    const ropes = [0, 2.1, 4.2].map(a => ropeBetween(new THREE.Vector3(Math.cos(a) * .36, -L + .12, Math.sin(a) * .36), hook, .012, post));
    const swing = pendulum(new THREE.Vector3(0, hookY, 0), L, ...ropes, mergeStatic(group(bowl, rim, ...weave, cushion, at(mesh(new THREE.TorusGeometry(.04, .012, 8, 16), gold), 0, -.02, 0))));
    const stand = group(at(cyl(.2, .26, .06, '#ffb3c8', 24), -.62, .03, 0), at(cyl(.06, .07, 1.5, post), -.62, .78, 0), at(cyl(.055, .055, .72, post), -.27, beamY, 0).rotateZ(Math.PI / 2),
      at(ball(.07, gold), -.62, 1.53, 0), at(ball(.06, gold), .1, beamY, 0), at(bow(.07, '#ff8fb6'), -.62, 1.3, .07), swing);
    stand.userData.swing = swing;
    stand.userData.ride = swing;
    stand.userData.update = t => swing.userData.step(t);
    return stand;
  },
  // Ghế trứng treo: vỏ trứng đen nhám khoét cửa phía trước (+z), mép cửa viền LED cyan, nệm trắng; treo bằng khoen thép dưới
  // cần chữ Γ đen (cột sau lưng ghế, dải LED tím dọc cột), lắc như con lắc như giỏ treo. Mặt nệm cao ~.42 (chỗ mèo nằm).
  'hammock-modern'() {
    const black = '#1f2125', beamY = 1.5, hookY = beamY - .06, R = .38, SY = 1.38, cy = .8, L = hookY - cy;
    // Vỏ trứng: cầu kéo cao SY; phần trên (theta 0..SEAT) khoét cửa OPEN rad quanh +z, phần đáy dưới mặt nệm kín vòng.
    const OPEN = 1.7, SEAT = 2.38, start = Math.PI / 2 + OPEN / 2, len = TAU - OPEN;
    const shellMat = mat('#26282c', { side: THREE.DoubleSide });
    const shells = [new THREE.SphereGeometry(R, 40, 20, start, len, 0, SEAT), new THREE.SphereGeometry(R, 40, 6, 0, TAU, SEAT, Math.PI - SEAT)].map(geo => {
      const m = mesh(geo, shellMat);
      // vỏ mỏng hở: viền toon phủ mảng tối vào lòng -> viền bằng ống LED theo mép cửa
      m.userData.noOutline = true;
      m.scale.y = SY;
      return m;
    });
    // Điểm trên mặt cầu (SphereGeometry: x = -R·cosφ·sinθ, y = R·cosθ, z = R·sinφ·sinθ), kéo cao SY.
    const onShell = (phi, theta) => new THREE.Vector3(-R * Math.cos(phi) * Math.sin(theta), R * Math.cos(theta) * SY, R * Math.sin(phi) * Math.sin(theta));
    const curve = f => new THREE.CatmullRomCurve3([...Array(17)].map((_, k) => f(k / 16)));
    const cyan = led('#3fe0ff');
    const edges = [start, start + len].map(phi => mesh(new THREE.TubeGeometry(curve(k => onShell(phi, .02 + k * (SEAT - .02))), 32, .018, 6), cyan));
    edges.push(mesh(new THREE.TubeGeometry(curve(k => onShell(start + len + k * OPEN, SEAT)), 24, .018, 6), cyan));
    const cushion = at(cyl(.235, .2, .05, '#f5f8fb', 24), 0, .395 - cy, 0);
    const egg = at(group(...shells, ...edges), 0, 0, 0);
    egg.add(cushion);
    egg.position.y = cy - hookY;
    const steel = '#c8ccd2';
    const swing = pendulum(new THREE.Vector3(0, hookY, 0), L, egg, ropeBetween(new THREE.Vector3(0, -.04, 0), new THREE.Vector3(0, cy + R * SY - hookY, 0), .015, steel),
      at(mesh(new THREE.TorusGeometry(.04, .012, 8, 16), steel), 0, -.02, 0));
    const stand = group(at(cyl(.42, .44, .04, '#26282c'), 0, .02, 0), at(rbox(.12, .04, .22, .015, '#26282c'), 0, .02, -.48),
      at(rbox(.07, beamY + .035, .07, .03, black), 0, (beamY + .035) / 2, -.55), at(rbox(.07, .07, .62, .03, black), 0, beamY, -.27),
      at(box(.02, 1.2, .012, led('#b07cff')), 0, .75, -.509), swing);
    stand.userData.swing = swing;
    stand.userData.ride = swing;
    stand.userData.lightSource = true;
    stand.userData.update = t => swing.userData.step(t);
    return stand;
  },
  birdbath() {
    const bird = group(ball(.08, '#8fc9f2'), at(ball(.055, '#8fc9f2'), .07, .07, 0), at(mesh(new THREE.ConeGeometry(.02, .05, 8), '#ffb347'), .14, .07, 0).rotateZ(-Math.PI / 2));
    bird.children[0].scale.set(1.2, .9, .9);
    bird.position.set(0, .95, .28);
    bird.rotation.y = -Math.PI / 2;
    bird.userData.home = bird.position.clone();
    markOutlineUnit(bird); // chim là khối viền riêng: viền chim đè lên bát nước vẫn đậm
    // Các lớp tách độ cao rõ (không hai mặt trùng nhau -> hết chớp z-fighting khi xoay): mặt bát .91 < mặt nước .925
    // < vành bát hình xuyến (đỉnh ~.94) che mép nước. Trước đây mặt nước trùng đúng mặt bát (.91) nên giật sáng tối.
    const bath = group(at(cyl(.25, .3, .08, '#cfd8e0'), 0, .04, 0), at(cyl(.09, .12, .7, '#cfd8e0'), 0, .43, 0), at(cyl(.36, .2, .14, '#dfe6ec'), 0, .84, 0),
      waterDisc(.32, .92), at(mesh(new THREE.TorusGeometry(.335, .028, 10, 48), '#dfe6ec'), 0, .912, 0).rotateX(Math.PI / 2), bird);
    bath.userData.bird = bird;
    bath.userData.update = waterTick;
    return bath;
  },
  // Bồn tắm chim khảm hồng: trụ khảm gạch hồng / kem / vàng, vành diềm bèo, chim hồng đậu mép; mèo rình chim hoặc nhảy lên uống nước.
  'birdbath-mosaic'() {
    const bird = perchBird('#ff6f9f', '#f2c14e', 0, .95, .28);
    const scallops = [...Array(14)].map((_, i) => at(ball(.034, i % 2 ? '#f2c14e' : '#fff6f8'), Math.cos(i / 14 * TAU) * .36, .915, Math.sin(i / 14 * TAU) * .36));
    const tiles = [...Array(10)].map((_, i) => at(box(.07, .07, .012, ['#f2c14e', '#fff6f8', '#e6d4ff'][i % 3]), Math.cos(i / 10 * TAU) * .135, .5 + (i % 2) * .09, Math.sin(i / 10 * TAU) * .135).rotateY(Math.PI / 2 - i / 10 * TAU));
    const bath = group(at(cyl(.24, .3, .08, '#ff8fb6'), 0, .04, 0), at(cyl(.1, .13, .72, '#ffb3c8'), 0, .44, 0), mergeStatic(group(...tiles)), at(cyl(.37, .2, .14, '#ffc2d4'), 0, .84, 0),
      waterDisc(.32, .92), mergeStatic(group(...scallops, at(ball(.09, '#ffb3c8'), .3, .09, .12), at(ball(.07, '#e6d4ff'), -.3, .07, .1))), bird);
    bath.userData.bird = bird;
    bath.userData.update = waterTick;
    return bath;
  },
  // Máng chim thông minh: trụ vuông đen, khay thép trắng mặt cao .92 (mèo nhảy lên như bát nước), hộp hạt có camera viền LED
  // phía sau khay, dải LED cyan dưới mép khay; chim xanh đậu mép trước, mèo rình doạ chim bay.
  'birdbath-modern'() {
    const bird = perchBird('#8fc9f2', '#ffb347', 0, .99, .22);
    const black = '#26282c', white = '#f5f8fb', cyan = led('#3fe0ff');
    const seeds = [...Array(7)].map((_, i) => at(ball(.02, '#c9953a'), .14 + Math.cos(i * 2.4) * .06, .925, .1 + Math.sin(i * 2.4) * .05));
    const feeder = group(at(rbox(.4, .04, .4, .015, '#1f2125'), 0, .02, 0), at(rbox(.1, .83, .1, .03, black), 0, .455, 0),
      at(rbox(.56, .05, .56, .02, white), 0, .895, 0), ledFrame(.28, .28, .864, .012, cyan),
      at(rbox(.3, .34, .16, .04, black), 0, 1.09, -.18), at(rbox(.36, .03, .22, .012, white), 0, 1.275, -.18),
      at(ball(.03, '#1f2125'), 0, 1.15, -.1), at(mesh(new THREE.TorusGeometry(.04, .008, 6, 20), cyan), 0, 1.15, -.096),
      mergeStatic(group(...seeds)), bird);
    feeder.userData.bird = bird;
    feeder.userData.lightSource = true;
    return feeder;
  },
  bench() {
    const wood = '#b9854a', legs = '#5a4a3a';
    const b = group();
    [-.12, .12].forEach(z => b.add(at(rbox(1.4, .06, .2, .02, wood), 0, .46, z)));
    [-.18, .02].forEach(y => b.add(at(rbox(1.4, .06, .08, .02, wood), 0, .7 + y, -.26)));
    [-.6, .6].forEach(x => { b.add(at(box(.07, .46, .07, legs), x, .23, .15), at(box(.07, .8, .07, legs), x, .4, -.24)); });
    return b;
  },
  // Sofa mây hồng: khung mây hồng phấn, đệm kem, gối tim hồng + gối vàng; mặt đệm cao ~.5 để mèo nhảy lên nằm.
  'bench-sofa'() {
    const wicker = '#ffb3c8', trim = '#ff8fb6', cream = '#fff6f8';
    const sofa = group(at(rbox(1.32, .3, .5, .04, wicker), 0, .25, 0), at(rbox(1.2, .1, .46, .04, cream), 0, .45, .01),
      at(rbox(1.32, .5, .12, .05, wicker), 0, .55, -.26), at(rbox(1.18, .3, .06, .03, cream), 0, .6, -.2),
      at(rbox(.1, .3, .5, .04, wicker), -.62, .5, 0), at(rbox(.1, .3, .5, .04, wicker), .62, .5, 0));
    for (const x of [-.6, .6]) sofa.add(at(cyl(.035, .03, .1, '#f2c14e', 8), x, .05, .2), at(cyl(.035, .03, .1, '#f2c14e', 8), x, .05, -.2));
    const heartPillow = at(standingHeart(.16, .08, trim), -.38, .68, -.12);
    heartPillow.rotation.z = .15;
    sofa.add(heartPillow, at(rbox(.26, .22, .08, .035, '#f2c14e'), .4, .66, -.12).rotateZ(-.15));
    return sofa;
  },
  // Ghế băng neon: tấm ngồi đen nhám trên hai chân tấm, tựa lưng mảnh; LED cyan hắt dưới mép ngồi, LED tím trên mép tựa. Mặt ngồi cao .5.
  'bench-modern'() {
    const black = '#26282c', dark = '#1f2125';
    const b = group(at(rbox(1.4, .08, .46, .03, black), 0, .46, 0),
      at(rbox(.08, .42, .44, .03, dark), -.6, .21, 0), at(rbox(.08, .42, .44, .03, dark), .6, .21, 0),
      at(rbox(.05, .14, .04, .015, dark), -.6, .56, -.21), at(rbox(.05, .14, .04, .015, dark), .6, .56, -.21),
      at(rbox(1.4, .3, .05, .02, black), 0, .76, -.22),
      at(box(1.3, .015, .015, led('#3fe0ff')), 0, .4125, .2), at(box(1.36, .012, .012, led('#b07cff')), 0, .916, -.22));
    b.userData.lightSource = true;
    return b;
  },
};

// Lối đá: lát đá phiến nhiều cạnh (Voronoi lặp liền mạch 8×8 viên), khe vữa xanh rêu mảnh, mỗi viên một sắc đá nhạt
// và hơi vát sáng ở giữa -> đọc như sân lát đá thay cho các chấm tròn rời rạc trên nền cỏ.
function paintFlagstones(g, rnd) {
  const SIZE = 512, N = 8, cell = SIZE / N, GROUT = 3.4;
  const pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + .18 + rnd() * .64) * cell, (j + .18 + rnd() * .64) * cell, rnd()]);
  const palette = [[229, 222, 207], [218, 210, 192], [236, 229, 214], [208, 200, 184], [224, 216, 198]];
  const img = g.createImageData(SIZE, SIZE), data = img.data;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
    let d1 = 1e9, d2 = 1e9, best = null;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const wi = (ci + di + N) % N, wj = (cj + dj + N) % N, p = pts[wj * N + wi];
      const px = p[0] + Math.floor((ci + di) / N) * SIZE, py = p[1] + Math.floor((cj + dj) / N) * SIZE;
      const d = Math.hypot(x - px, y - py);
      if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
    }
    const edge = d2 - d1, k = (y * SIZE + x) * 4;
    let rgb;
    if (edge < GROUT) rgb = [112, 150, 92]; // khe vữa rêu
    else {
      const base = palette[Math.floor(best[2] * palette.length)];
      const bevel = Math.min(1, (edge - GROUT) / 10); // mép viên hơi tối, giữa viên sáng
      const shade = .86 + .14 * bevel;
      rgb = base.map(c => Math.min(255, c * shade));
    }
    data[k] = rgb[0]; data[k + 1] = rgb[1]; data[k + 2] = rgb[2]; data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Vài nhúm cỏ chen trong khe + vết sờn nhẹ.
  for (let i = 0; i < 90; i++) { g.fillStyle = '#6fae4a99'; g.beginPath(); g.arc(rnd() * SIZE, rnd() * SIZE, 2 + rnd() * 2, 0, TAU); g.fill(); }
}

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
  if (kind === 'ground-path') paintFlagstones(g, rnd);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; // nền vườn mở rộng lặp texture theo chiều dài (không kéo giãn)
  return texture;
}

// Chất cát (hộp cát): nền vàng cát + vệt cào gợn sóng + hàng nghìn hạt sáng / tối + vài vỏ ốc, sỏi nhỏ.
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
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const k1 = rnd(0, TAU), k2 = rnd(0, TAU), k3 = rnd(0, TAU), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).divideScalar(r); // hướng từ tâm (theo vị trí -> đỉnh trùng ở đường nối vẫn khớp)
    const bump = .09 * Math.sin(5 * v.x + k1) * Math.sin(5 * v.y + k2) * Math.sin(5 * v.z + k3) + .05 * Math.sin(9 * v.x + 7 * v.z + k1);
    const flatBottom = v.y < -.3 ? .75 + (v.y + 1) / .7 * .25 : 1; // đáy bẹt xuống đất
    pos.setXYZ(i, v.x * r * (1 + bump), v.y * r * (1 + bump) * flatBottom, v.z * r * (1 + bump));
  }
  // Toon (QC toon): viền ngoài lổn nhổn nhưng pháp tuyến GIỮ của mặt cầu trơn (không computeVertexNormals) -> nấc sáng tối
  // chia gọn như khối tròn; một màu phẳng mỗi khối (khối to sáng hơn) thay cho màu đỉnh chuyển dần. Lỗi cũ: pháp tuyến gồ ghề +
  // gradient làm nấc toon vỡ thành đốm loang, bụi trông như render 3D thường.
  nor.needsUpdate = true;
  const tone = dark.clone().lerp(light, THREE.MathUtils.clamp(.35 + (r - .19) * 2.2, .3, .7));
  return mesh(geo, `#${tone.getHexString()}`);
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
    const a = inward + rnd(-.6, .6), pebble = at(rock(rnd(.035, .06), i % 2 ? '#c8c2b8' : '#b5aea3', rnd(0, 1000)), Math.cos(a) * .5, .01, Math.sin(a) * .5);
    pebble.scale.y = .75; pebble.rotation.y = rnd(0, TAU); bush.add(pebble);
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
