// Phần vườn mở rộng (thắng màn 30; chung nền + hàng rào với vườn): đồi nhỏ, bộ đồ "động" cho Deco và đồ trang trí cố định (lối đá lên đồi, đá, hoa dại,
// mây trôi). Đồ động đều chạy theo MỘT luồng gió chung windAt(t): cối xay quay nhanh / chậm, quần áo trên dây phơi bay
// phần phật, diều lượn, cờ phấp phới... nên cả khu chuyển động ăn khớp với nhau.
// Lớp chỉ dùng cho bóng đổ: vật trên lớp này không hiện trên màn hình nhưng vẫn đổ bóng (mây: camera ở cao hơn mây nên
// nếu thấy được thì mây che mất khu vườn; chỉ để bóng mây trôi trên cỏ). deco-room.mjs bật lớp này cho camera bóng nắng.
export const SHADOW_ONLY_LAYER = 5;
// Mỗi món có chỗ đặt cố định [x, z, xoay?] (room-layout.mjs PLACES); +z của món hướng vào giữa khu.
// Điểm neo cho mèo trong userData (toạ độ cục bộ của món): seat / steps / chute / spot... (room-cats.mjs dùng).
// Quy tắc dựng model: CLAUDE.md (bo góc ≤ nửa cạnh mỏng, tấm phẳng cách mặt ≥ 5 mm, vỏ hở không viền, chạm sàn...).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { HILL, hillProfile, groundHeight, GARDEN_EXT_X } from './room-layout.mjs';
import { TOON, toonMat } from './toon.mjs';
import { pendulum, ropeBetween, rock } from './garden-scene.mjs';

const TAU = Math.PI * 2;
const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
const ROUND = 3;
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, ROUND, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
const cone = (r, h, color, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const glow = (color, emissive, intensity = 1) => mat(color, { emissive, emissiveIntensity: intensity });
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
// Vật liệu phẳng không nhận sáng: userData.nightDim để ban đêm tối lại cùng cảnh (qc.mjs glow).
const flatMat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, userData: { nightDim: true }, ...extra });
// Thời gian giữa hai lần update của một món (update(t) chỉ nhận t).
const ticker = () => { let last = 0; return t => { const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t; return dt; }; };

// ---------- Gió chung: 0.1 (lặng) .. 1 (gió mạnh), đổi chậm theo thời gian + vài cơn giật ----------
export const windAt = t => Math.max(.1, Math.min(1, .55 + .28 * Math.sin(t * .21) * Math.sin(t * .067 + 1.3) + .17 * Math.sin(t * 1.3 + Math.sin(t * .4))));

// ---------- Đồi: vòm tròn xoay quanh trục (lathe) theo đúng hillProfile, kéo dãn thành elip ----------
// Viền sát đất kéo xuống -.03 để chân đồi cắm hẳn vào mặt cỏ (không có mép trùng mặt phẳng nền -> không chớp).
export function buildHill(material) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const d = i / 24; pts.push(new THREE.Vector2(d, hillProfile(d))); }
  pts.push(new THREE.Vector2(1.02, -.03));
  pts.reverse(); // lathe đi từ chân lên đỉnh để mặt ngoài quay ra ngoài
  const geo = new THREE.LatheGeometry(pts, 48);
  geo.scale(HILL.rx, 1, HILL.rz);
  geo.computeVertexNormals();
  // Toon gần như không đổ sáng tối: tô màu đỉnh (nhân với texture cỏ) cho đồi nổi khối — chân đồi sẫm, đỉnh sáng,
  // sườn khuất nắng (nắng từ +x +z, xem SUN_FROM) tối hơn sườn đón nắng.
  const pos = geo.attributes.position, nor = geo.attributes.normal, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  const sun = new THREE.Vector3(4, 9, 5).normalize(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const up = Math.max(0, pos.getY(i)) / HILL.h, lit = n.fromBufferAttribute(nor, i).dot(sun);
    c.setRGB(1, 1, 1).multiplyScalar(.72 + .2 * up + .14 * lit);
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  material.vertexColors = true;
  const hill = mesh(geo, material);
  hill.position.set(HILL.x, 0, HILL.z);
  hill.userData.closedByGround = true; // đáy hở nhưng nằm dưới mặt cỏ, không bao giờ nhìn thấy lòng
  // Vệt cỏ sẫm quanh chân đồi (vành elip phẳng sát đất, cao hơn nền 8 mm): tách đồi khỏi mặt cỏ phẳng.
  const ring = new THREE.Mesh(new THREE.RingGeometry(.96, 1.08, 64), new THREE.MeshBasicMaterial({ color: '#5f9a3a', transparent: true, opacity: .35, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.scale.set(HILL.rx, HILL.rz, 1); ring.position.set(HILL.x, .008, HILL.z);
  return group(hill, ring);
}
// Pháp tuyến mặt đồi tại (x, z) (toạ độ khu): để đặt đá / cỏ nghiêng theo sườn.
function slopeNormal(x, z) {
  const e = .05, hx = groundHeight('garden', x + e, z) - groundHeight('garden', x - e, z), hz = groundHeight('garden', x, z + e) - groundHeight('garden', x, z - e);
  return new THREE.Vector3(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
}
const UP = new THREE.Vector3(0, 1, 0);
const onSlope = (node, x, z, lift = 0) => { node.position.set(x, groundHeight('garden', x, z) + lift, z); node.quaternion.setFromUnitVectors(UP, slopeNormal(x, z)); return node; };

// ---------- Tán lá lổn nhổn (như bụi góc vườn) ----------
function puff(r, dark, light, seed) {
  const geo = new THREE.SphereGeometry(r, 20, 14), pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), d = new THREE.Color(dark), l = new THREE.Color(light), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).divideScalar(r);
    const bump = .08 * Math.sin(5 * v.x + seed) * Math.sin(5 * v.y + seed * 2) * Math.sin(5 * v.z + seed * 3);
    pos.setXYZ(i, v.x * r * (1 + bump), v.y * r * (1 + bump), v.z * r * (1 + bump));
    c.copy(d).lerp(l, THREE.MathUtils.smoothstep(v.y, -.6, .9)).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const material = mat('#ffffff'); material.vertexColors = true;
  return mesh(geo, material);
}
// Cây to: thân thuôn + hai cành + tán 5 khối; tán lắc nhẹ theo gió (update trả về để món gọi).
function bigTree() {
  const bark = '#9a6a45';
  const canopy = group(...[[0, 2.75, 0, .95], [.75, 2.45, .2, .7], [-.7, 2.5, -.1, .72], [.1, 3.3, -.1, .7], [-.2, 2.4, .6, .6]]
    .map(([x, y, z, r], k) => at(puff(r, '#4f9a36', '#9be06a', k * 1.7), x, y, z)));
  const trunk = group(at(cyl(.2, .3, 2.2, bark, 14), 0, 1.1, 0), at(cyl(.07, .11, 1.1, bark, 10), .45, 2.05, .1).rotateZ(-.7), at(cyl(.06, .1, 1, bark, 10), -.4, 2.05, 0).rotateZ(.75),
    ...[0, 2.1, 4.2].map(a => at(cyl(.06, .14, .35, bark, 8), Math.cos(a) * .3, .1, Math.sin(a) * .3).rotateX(Math.cos(a) * .9).rotateZ(-Math.sin(a) * .9))); // rễ nổi
  mergeStatic(canopy);
  trunk.userData.sink = .12; // rễ nổi bò rồi cắm xuống đất
  return { trunk, canopy, update: (t, w) => { canopy.rotation.z = Math.sin(t * 1.1) * .02 * w; canopy.rotation.x = Math.sin(t * .8 + 1) * .015 * w; } };
}

export const GARDEN2_BUILD = {
  // ---------- Cối xay gió trên đỉnh đồi: cánh quay theo gió ----------
  windmill() {
    const tick = ticker();
    const blades = group(at(cyl(.09, .09, .14, '#8a5a3a', 14), 0, 0, 0).rotateX(Math.PI / 2));
    for (let k = 0; k < 4; k++) {
      const arm = group(at(box(.06, 1.05, .04, '#8a5a3a'), 0, .55, 0), at(rbox(.3, .8, .03, .015, '#fffaf0'), .17, .62, .03),
        ...[.35, .62, .89].map(y => at(box(.3, .02, .02, '#c9a07a'), .17, y, .055))); // khung lưới trên cánh buồm
      arm.rotation.z = k * TAU / 4;
      blades.add(arm);
    }
    blades.position.set(0, 1.95, .42);
    const mill = group(
      at(cyl(.55, .62, .7, '#b5aea3', 20), 0, -.1, 0), // nền đá: chôn một phần vào đỉnh đồi tròn
      at(cyl(.3, .45, 1.6, '#f3d5a8', 20), 0, 1, 0), at(cone(.42, .5, '#e8617f', 20), 0, 2.05, 0),
      at(rbox(.24, .38, .06, .03, '#9a6a45'), 0, .4, .4), at(ball(.025, '#ffd66b'), .07, .4, .44), // cửa + núm
      at(rbox(.16, .16, .05, .025, '#9fd0f0'), 0, 1.25, .34), // ô cửa sổ
      blades);
    mill.userData.sink = .46; // nền đá đặt chìm vào đỉnh đồi (đỉnh tròn), không phải lơ lửng / lún lỗi
    mill.userData.spot = [.85, 0, .62]; // chỗ mèo ngồi ngắm cánh quạt, cách tâm 1.05: ngoài nền đá (.62) + nửa thân mèo
    mill.userData.blades = blades;
    mill.userData.update = t => { blades.rotation.z -= (.4 + 2.2 * windAt(t)) * tick(t); };
    return mill;
  },
  'windmill-turbine'() {
    const tick = ticker();
    const rotor = group(at(ball(.12, '#f5f8fb'), 0, 0, .06));
    for (let k = 0; k < 3; k++) { const b = group(at(rbox(.12, 1.25, .04, .02, '#f5f8fb'), .03, .7, 0)); b.rotation.z = k * TAU / 3; rotor.add(b); }
    rotor.position.set(0, 2.7, .34);
    const turbine = group(at(cyl(.5, .58, .7, '#c8c2b8', 20), 0, -.1, 0), at(cyl(.07, .13, 2.5, '#f5f8fb', 16), 0, 1.45, 0),
      at(rbox(.26, .26, .55, .1, '#f5f8fb'), 0, 2.7, .05), at(box(.02, .6, .02, '#e8617f'), 0, 1.6, .1), rotor);
    turbine.userData.sink = .46;
    turbine.userData.spot = [.85, 0, .62];
    turbine.userData.update = t => { rotor.rotation.z -= (.8 + 3.2 * windAt(t)) * tick(t); };
    return turbine;
  },

  // ---------- Hoa hướng dương: mặt hoa xoay theo con mèo gần nhất (không có mèo thì hướng về nắng, lắc theo gió) ----------
  sunflowers() {
    const tick = ticker(), heads = [];
    const plant = group(at(cyl(.62, .66, .04, '#8a5a3a', 32), 0, .02, 0));
    [[0, 0, 1.45], [.38, .2, 1.2], [-.36, .16, 1.25], [.2, -.36, 1.35], [-.22, -.32, 1.1], [.45, -.12, .95], [-.46, -.1, 1]].forEach(([x, z, h], i) => {
      const stem = group(at(cyl(.022, .03, h, '#5f9a3a', 8), 0, h / 2, 0));
      [.35, .62].forEach((y, k) => { const leaf = squash(at(ball(.1, '#6fae46'), (k ? -1 : 1) * .1, y * h, 0), 1.3, .25, .8); leaf.rotation.z = (k ? 1 : -1) * .5; stem.add(leaf); });
      const face = group(at(cyl(.12, .12, .05, '#6a4a2a', 20), 0, 0, .02).rotateX(Math.PI / 2));
      for (let p = 0; p < 12; p++) { const a = p / 12 * TAU; const petal = squash(at(ball(.07, p % 2 ? '#ffd23f' : '#ffc21a'), Math.cos(a) * .17, Math.sin(a) * .17, 0), 1, 1, .3); petal.rotation.z = a; face.add(petal); }
      mergeStatic(face);
      const head = group(face); head.position.y = h; head.userData.yaw = 0; head.userData.v = 0; head.userData.tilt = 0;
      stem.add(head); stem.position.set(x, .04, z);
      heads.push({ stem, head, phase: i * 1.3 });
      plant.add(stem);
    });
    plant.userData.watchCats = true; // room-cats.mjs ghi vị trí đàn mèo vào userData.cats mỗi frame
    plant.userData.bump = (k = 1) => heads.forEach((s, i) => { s.head.userData.v += (i % 2 ? 1 : -1) * k * 2; });
    const tmp = new THREE.Vector3();
    plant.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      plant.updateMatrixWorld(true);
      for (const s of heads) {
        s.stem.rotation.z = Math.sin(t * 1.5 + s.phase) * .05 * w;
        // Mèo gần nhất trong 3.5 m: quay mặt hoa về phía mèo (toạ độ cục bộ của khóm hoa).
        let target = .25 * Math.sin(t * .1), best = 3.5;
        for (const cat of plant.userData.cats || []) {
          tmp.set(cat.x, 0, cat.z); plant.worldToLocal(tmp);
          const d = Math.hypot(tmp.x - s.stem.position.x, tmp.z - s.stem.position.z);
          if (d < best) { best = d; target = Math.atan2(tmp.x - s.stem.position.x, tmp.z - s.stem.position.z); }
        }
        const diff = ((target - s.head.userData.yaw + Math.PI * 3) % TAU) - Math.PI;
        s.head.userData.v += (diff * 6 - s.head.userData.v * 3) * dt; // lò xo: quay theo, hơi lố rồi về
        s.head.userData.yaw += s.head.userData.v * dt;
        s.head.rotation.set(-.25 + Math.sin(t * 2 + s.phase) * .03 * w, s.head.userData.yaw, 0, 'YXZ');
      }
    };
    plant.userData.update(0);
    return plant;
  },
  'sunflowers-scarecrow'() {
    const tick = ticker();
    const crow = group(squash(ball(.09, '#2b2f3a'), 1.3, .9, .9), at(ball(.06, '#2b2f3a'), .09, .06, 0), at(cone(.02, .06, '#ffb347', 8), .16, .06, 0).rotateZ(-Math.PI / 2),
      at(ball(.012, '#ffffff'), .12, .08, .035));
    crow.position.set(.5, 1.4, 0); crow.userData.home = crow.position.clone();
    const arms = group(at(cyl(.035, .035, 1.3, '#9a6a45', 10), 0, 0, 0).rotateZ(Math.PI / 2),
      ...[-1, 1].flatMap(s => [at(rbox(.36, .2, .2, .08, '#8fc9f2'), s * .3, 0, 0), ...[0, 1, 2].map(k => at(cone(.03, .14, '#e9c25a', 6), s * (.55 + k * .02), -.04 + k * .03, (k - 1) * .04).rotateZ(s * Math.PI / 2))]));
    arms.position.y = 1.32;
    const scarecrow = group(at(cyl(.04, .05, 1.9, '#9a6a45', 10), 0, .95, 0), arms,
      at(rbox(.42, .5, .24, .1, '#8fc9f2'), 0, 1.15, 0), at(rbox(.44, .08, .26, .04, '#c98a55'), 0, .92, 0), // áo + thắt lưng
      at(ball(.17, '#e9c58f'), 0, 1.62, 0), at(ball(.025, '#2b2f3a'), -.06, 1.65, .155), at(ball(.025, '#2b2f3a'), .06, 1.65, .155), // đầu bao bố + mắt
      at(box(.1, .015, .015, '#c0392b'), 0, 1.57, .165), // miệng khâu chỉ
      at(cyl(.3, .3, .03, '#e9c25a', 24), 0, 1.75, 0), at(cyl(.12, .16, .18, '#e9c25a', 16), 0, 1.85, 0), // mũ rơm
      at(cyl(.4, .44, .04, '#8a5a3a', 24), 0, .02, 0), ...[0, 1, 2, 3].map(k => at(cone(.06, .3, '#e9c25a', 6), Math.cos(k * 1.6) * .28, .15, Math.sin(k * 1.6) * .28)), crow);
    scarecrow.userData.bird = crow; // mèo rình thì quạ bay mất (room-cats.mjs scareBird)
    scarecrow.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      arms.rotation.z = Math.sin(t * 1.4) * .06 * w; arms.rotation.y = Math.sin(t * .9) * .05 * w;
      if (!crow.userData.away && dt) crow.rotation.y = Math.sin(t * .7) * .6; // quạ ngó nghiêng
    };
    return scarecrow;
  },

  // ---------- Dây phơi đồ: áo, khăn, tất bay phần phật theo gió; mèo khều chiếc tất rơi xuống ----------
  clothesline() {
    const L = 1.3, Y = 1.75, sag = y => Y - .14 * (1 - y * y);
    const poles = [-1, 1].map(s => group(at(cyl(.035, .045, 1.85, '#9a6a45', 10), s * L, .925, 0), at(box(.04, .04, .4, '#9a6a45'), s * L, 1.78, 0)));
    const rope = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16 * 2 - 1; rope.push(new THREE.Vector3(u * L, sag(u), 0)); }
    const hang = (u, piece) => { const g = group(piece); g.position.set(u * L, sag(u), 0); return g; };
    const pegs = () => at(box(.025, .06, .02, '#ffd66b'), 0, -.01, .012); // kẹp phơi
    const shirt = hang(-.55, group(at(rbox(.42, .4, .02, .01, '#ff8fb8'), 0, -.22, 0), at(rbox(.16, .14, .02, .01, '#ff8fb8'), -.26, -.1, 0).rotateZ(.5), at(rbox(.16, .14, .02, .01, '#ff8fb8'), .26, -.1, 0).rotateZ(-.5), pegs()));
    const towel = hang(.05, group(at(rbox(.36, .52, .02, .01, '#8fc9f2'), 0, -.27, 0), at(box(.36, .03, .024, '#ffffff'), 0, -.46, 0), pegs()));
    const sock = hang(.6, group(at(rbox(.09, .22, .03, .015, '#ffd66b'), 0, -.12, 0), at(rbox(.14, .07, .03, .015, '#ffd66b'), .03, -.22, 0), at(box(.09, .03, .034, '#e8617f'), 0, -.03, 0)));
    const pieces = [shirt, towel, sock];
    const line = group(...poles, mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), 24, .008, 5), '#fffaf0'), ...pieces);
    line.userData.mug = sock; // mèo nhảy khều tất rơi (room-cats.mjs knockOff), lát sau tất về lại dây
    sock.userData.home = sock.position.clone();
    line.userData.update = t => {
      const w = windAt(t);
      pieces.forEach((p, i) => {
        if (p.userData.knocked) return;
        p.rotation.x = -(.15 + .5 * w) * (.7 + .3 * Math.sin(t * 3.1 + i * 1.7)); // gió thổi tung về phía sau
        p.rotation.z = Math.sin(t * 2.3 + i) * .08 * w;
      });
    };
    line.userData.update(0);
    return line;
  },
  'clothesline-flags'() {
    const L = 1.3, Y = 1.75, sag = y => Y - .16 * (1 - y * y), flags = [];
    const poles = [-1, 1].map(s => group(at(cyl(.035, .045, 1.85, '#9a6a45', 10), s * L, .925, 0), at(ball(.06, '#ffd66b'), s * L, 1.88, 0)));
    const rope = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16 * 2 - 1; rope.push(new THREE.Vector3(u * L, sag(u), 0)); }
    const tri = new THREE.Shape([new THREE.Vector2(-.11, 0), new THREE.Vector2(.11, 0), new THREE.Vector2(0, -.28)]);
    const COLORS = ['#e8617f', '#ffd66b', '#8fc9f2', '#7fc45a', '#b79cf0', '#ff9f43'];
    for (let k = 0; k < 9; k++) {
      const u = -.85 + k * .2125, f = new THREE.Mesh(new THREE.ShapeGeometry(tri), flatMat(COLORS[k % COLORS.length]));
      const g = group(f); g.position.set(u * L, sag(u) - .01, 0); flags.push(g);
    }
    const line = group(...poles, mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), 24, .008, 5), '#fffaf0'), ...flags);
    let kick = 0, lastT = 0;
    line.userData.bump = (k = 1) => { kick += k; };
    line.userData.update = t => {
      const w = windAt(t), dt = Math.min(.05, Math.max(0, t - (lastT || t))); lastT = t;
      kick *= Math.exp(-2 * dt);
      flags.forEach((f, i) => { f.rotation.x = -(.2 + .7 * w) * (.6 + .4 * Math.sin(t * 4 + i * .8)) - kick * Math.sin(t * 14 + i) * .4; });
    };
    line.userData.update(0);
    return line;
  },

  // ---------- Lửa trại: lửa bập bùng, tàn lửa bay lên, khói tan dần; mèo nằm sưởi ----------
  campfire() {
    const tick = ticker();
    const stones = [...Array(10)].map((_, k) => { // vòng đá: mỗi viên một hình, xoay lệch nhau
      const a = k / 10 * TAU, s = squash(at(rock(.12, k % 2 ? '#b5aea3' : '#c8c2b8', k * 7.3 + 1), Math.cos(a) * .42, .03, Math.sin(a) * .42), 1.2, .75, 1);
      s.rotation.y = -a + (k % 3) * .7; return s;
    });
    const logs = [0, 1, 2, 3].map(k => { const l = at(cyl(.05, .06, .62, '#8a5a3a', 10), 0, .14, 0); l.rotation.set(1.1, k * Math.PI / 2 + .4, 0, 'YXZ'); return l; });
    const flameMat = (c, e) => mat(c, { emissive: e, emissiveIntensity: 1.3 });
    const flames = [[0, .55, .2, '#ff7a3d', '#ff5a1a'], [.08, .4, .14, '#ffb347', '#ff8a1a'], [-.07, .36, .12, '#ffd66b', '#ffb92a']]
      .map(([x, h, r, c, e], k) => { const f = at(mesh(new THREE.ConeGeometry(r, h, 12), flameMat(c, e)), x, .16 + h / 2, (k - 1) * .05); f.userData.h = h; f.castShadow = false; return f; });
    const embers = [...Array(6)].map((_, k) => { const e = at(mesh(new THREE.SphereGeometry(.022, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffcf6a' })), 0, .3, 0); e.userData.phase = k / 6; e.castShadow = false; return e; });
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#d9d2c4', transparent: true, opacity: .4, depthWrite: false });
    const smoke = [...Array(3)].map((_, k) => { const s = mesh(new THREE.SphereGeometry(.12, 10, 8), smokeMat.clone()); s.userData.phase = k / 3; s.castShadow = false; return s; });
    const light = new THREE.PointLight('#ff9a4a', 4, 5, 1.6); light.position.set(0, .6, 0);
    const seat = at(cyl(.13, .13, 1.1, '#9a6a45', 14), 0, .13, -.95); seat.rotation.z = Math.PI / 2;
    const fire = group(...stones, ...logs, ...flames, ...embers, ...smoke, light, seat, at(cyl(.1, .1, .01, '#d9b07e', 14), .55, .26, -.95).rotateZ(Math.PI / 2), at(cyl(.1, .1, .01, '#d9b07e', 14), -.55, .26, -.95).rotateZ(Math.PI / 2));
    fire.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      flames.forEach((f, k) => { const s = 1 + Math.sin(t * (9 + k * 2.3)) * .12 + Math.sin(t * 17 + k) * .06; f.scale.set(1 - (s - 1) * .5, s, 1 - (s - 1) * .5); f.rotation.z = Math.sin(t * 3 + k) * .1 * w; f.position.y = .16 + f.userData.h * s / 2; });
      light.intensity = (light.userData.baseIntensity ?? 4) * (.85 + Math.sin(t * 11) * .08 + Math.sin(t * 23) * .05);
      embers.forEach((e, k) => { const p = (t * .45 + e.userData.phase) % 1; e.position.set(Math.sin(t * 2 + k * 2) * .12 + p * .25 * w, .3 + p * 1.3, Math.cos(t * 1.7 + k) * .1); e.scale.setScalar(1 - p); });
      smoke.forEach(s => { const p = (t * .18 + s.userData.phase) % 1; s.position.set(p * .6 * w, .7 + p * 1.6, 0); s.scale.setScalar(.6 + p * 1.6); s.material.opacity = .35 * (1 - p); });
    };
    fire.userData.update(0);
    fire.userData.sink = .06; // chân củi dựng chóp cắm xuống đất, đá vòng lửa chôn một phần
    return fire;
  },
  'campfire-tent'() {
    const tick = ticker(), canvas = '#ff9f43', W = .7, H = 1, D = 1.3, slope = Math.hypot(W, H);
    const side = s => { const p = at(rbox(.04, slope, D, .02, canvas), s * W / 2, H / 2, 0); p.rotation.z = s * Math.atan2(W, H); return p; };
    const back = new THREE.Shape([new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(0, H)]);
    const backWall = at(mesh(new THREE.ExtrudeGeometry(back, { depth: .03, bevelEnabled: false }), '#ffb36b'), 0, 0, -D / 2);
    // Cánh cửa lều: nửa phải của ô cửa tam giác (đỉnh (0, H), đáy (0..W, 0)) làm bằng vải, bản lề chạy dọc mép mái bên phải,
    // vén ra ngoài một góc ~65° như cánh cửa mở hé (trước đây là tấm ván phẳng xoay lệch, chìa ra như một tấm bảng lạ).
    const doorTri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-W, 0), new THREE.Vector2(-W, H)]); // gốc toạ độ = góc (W, 0) của ô cửa
    const flap = group(at(mesh(new THREE.ExtrudeGeometry(doorTri, { depth: .03, bevelEnabled: false }), '#ffb36b'), 0, 0, 0));
    flap.position.set(W, 0, D / 2);
    const hinge = new THREE.Vector3(-W, H, 0).normalize(), REST_OPEN = 1.15;
    flap.quaternion.setFromAxisAngle(hinge, REST_OPEN);
    const lantern = group(at(cyl(.06, .07, .03, '#8a5a3a', 12), 0, .015, 0), at(rbox(.11, .14, .11, .03, glow('#fff0b8', '#ffcf5a', .9)), 0, .1, 0), at(cone(.08, .06, '#8a5a3a', 4), 0, .2, 0).rotateY(Math.PI / 4));
    lantern.position.set(-.45, 0, D / 2 + .25);
    const light = new THREE.PointLight('#ffcf7a', 2.5, 3, 1.6); light.position.set(-.45, .3, D / 2 + .25);
    const ropes = [-1, 1].flatMap(s => [ropeBetween(new THREE.Vector3(0, H, s * D / 2), new THREE.Vector3(0, 0, s * (D / 2 + .45)), .008, '#fffaf0'), at(cyl(.02, .01, .1, '#8a5a3a', 6), 0, .05, s * (D / 2 + .45))]);
    const tent = group(side(1), side(-1), backWall, flap, at(rbox(1.2, .03, D - .1, .015, '#9fd0f0'), 0, .015, 0), at(cyl(.025, .025, D + .1, '#8a5a3a', 8), 0, H, 0).rotateX(Math.PI / 2),
      ...ropes, lantern, light);
    tent.userData.flap = flap;
    tent.userData.bump = (k = 1) => { flap.userData.v = (flap.userData.v || 0) + k * 2; };
    tent.userData.update = t => {
      const dt = tick(t), w = windAt(t), v = flap.userData.v || 0;
      flap.userData.v = v * Math.exp(-2.5 * dt);
      flap.quaternion.setFromAxisAngle(hinge, REST_OPEN + Math.sin(t * 2.2) * .07 * w + Math.sin(t * 9) * flap.userData.v * .1); // cánh cửa đung đưa theo gió
    };
    tent.userData.inside = [0, 0, .1]; // chỗ mèo chui vào nằm
    return tent;
  },

  // ---------- Diều: cọc + cuộn dây, con diều lượn hình số 8 theo gió, đuôi nơ bám theo có độ trễ ----------
  kite() {
    const tick = ticker();
    const diamond = new THREE.Shape([new THREE.Vector2(0, .42), new THREE.Vector2(.3, 0), new THREE.Vector2(0, -.55), new THREE.Vector2(-.3, 0)]);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(diamond), flatMat('#e8617f'));
    const stripe = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, .42), new THREE.Vector2(.3, 0), new THREE.Vector2(0, -.06)])), flatMat('#ffd66b'));
    stripe.position.z = .006;
    const kite = group(sail, stripe, at(cyl(.008, .008, .97, '#8a5a3a', 6), 0, -.065, -.006), at(cyl(.008, .008, .6, '#8a5a3a', 6), 0, 0, -.006).rotateZ(Math.PI / 2));
    const bows = [...Array(5)].map((_, k) => at(squash(ball(.04, k % 2 ? '#8fc9f2' : '#ffd66b'), 1.6, .7, .5), 0, 0, 0));
    const stringGeo = new THREE.BufferGeometry().setFromPoints([...Array(10)].map(() => new THREE.Vector3()));
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: '#fffaf0' }));
    const tailGeo = new THREE.BufferGeometry().setFromPoints([...Array(6)].map(() => new THREE.Vector3()));
    const tail = new THREE.Line(tailGeo, new THREE.LineBasicMaterial({ color: '#fffaf0' }));
    const stake = group(at(cyl(.025, .015, .5, '#9a6a45', 8), 0, .25, 0), at(cyl(.07, .07, .08, '#c98a55', 14), 0, .3, 0).rotateZ(Math.PI / 2),
      at(cyl(.12, .14, .02, '#8a5a3a', 14), 0, .01, 0));
    const node = group(stake, kite, ...bows, string, tail);
    const anchor = new THREE.Vector3(0, .32, 0), pos = new THREE.Vector3(), prev = [];
    let tug = 0;
    node.userData.tug = (k = 1) => { tug += k; };
    node.userData.kite = kite;
    node.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      tug *= Math.exp(-3 * dt);
      // Bay chếch về phía sau (-z) và lên cao; lượn số 8, gió mạnh thì bay cao + lượn rộng hơn.
      pos.set(Math.sin(t * .7) * (.4 + .5 * w) + Math.sin(t * 7) * tug * .15, 2.6 + .7 * w + Math.sin(t * 1.4) * .25 - tug * .3, -1.1 - .4 * w + Math.cos(t * .7) * .2);
      kite.position.copy(pos);
      kite.rotation.set(-.5, Math.sin(t * .7) * .3, Math.cos(t * .7) * .4 + Math.sin(t * 9) * tug * .2);
      // Dây diều: đường võng nhẹ từ cuộn dây lên diều.
      const p = stringGeo.attributes.position;
      for (let i = 0; i < 10; i++) { const k = i / 9; p.setXYZ(i, anchor.x + (pos.x - anchor.x) * k, anchor.y + (pos.y - .6 - anchor.y) * k - Math.sin(k * Math.PI) * .35 * (1 - w * .5), anchor.z + (pos.z - anchor.z) * k); }
      p.needsUpdate = true;
      // Đuôi: mỗi nơ đuổi theo nơ trước (trễ) -> uốn lượn mềm.
      let lead = v3.set(pos.x, pos.y - .62, pos.z);
      bows.forEach((b, i) => {
        if (!prev[i]) prev[i] = lead.clone();
        prev[i].lerp(v3b.set(lead.x + Math.sin(t * 5 + i) * .05 * w, lead.y - .2, lead.z + .05), Math.min(1, dt * 8 || 1));
        b.position.copy(prev[i]); b.rotation.z = Math.sin(t * 6 + i) * .5;
        lead = prev[i];
      });
      const tp = tailGeo.attributes.position;
      tp.setXYZ(0, pos.x, pos.y - .6, pos.z); bows.forEach((b, i) => tp.setXYZ(i + 1, b.position.x, b.position.y, b.position.z)); tp.needsUpdate = true;
      stringGeo.computeBoundingSphere(); tailGeo.computeBoundingSphere();
    };
    node.userData.update(0);
    node.userData.lookAt = [0, 3, -1.2]; // mèo ngước nhìn diều
    return node;
  },
  // Cờ cá chép koi (thay đèn lồng ở vườn; thưởng mốc cuối event Fish Festival, không bán): cột tre, chong chóng đỉnh quay theo gió,
  // 3 cá gió đen / đỏ / xanh bay theo gió chung windAt — gió lặng thì cá rủ xuống. Thân cá là khối kín (lathe) nên viền toon không
  // phủ vào lòng; vây đuôi là tấm phẳng đặt ngay sau chóp đuôi (không cắt xuyên thân). Mèo ngước nhìn rồi vồ con cá thấp nhất (tug).
  'lantern-koi'() {
    const tick = ticker(), bamboo = '#c9a15e';
    // Một con cá dài L, miệng bán kính R: trục thân là +x cục bộ, gốc toạ độ ở miệng (treo vào cột).
    const koi = (L, R, body, band, fin) => {
      const pts = [[0, 0], [R * .95, 0], [R, .012], [R * 1.12, L * .18], [R * 1.05, L * .4], [R * .8, L * .65], [R * .45, L * .85], [R * .2, L * .97], [0, L]]
        .map(([r, y]) => new THREE.Vector2(r, y));
      const geo = new THREE.LatheGeometry(pts, 20);
      geo.rotateZ(-Math.PI / 2); // trục lathe (+y) -> +x
      const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
      const MOUTH = new THREE.Color('#3a2a2a'), WHITE = new THREE.Color('#fffaf0'), BODY = new THREE.Color(body), BAND = new THREE.Color(band);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        // mặt miệng tối, vành trắng quanh miệng, thân có sọc vảy cách đều
        c.copy(x < .006 ? MOUTH : x < L * .1 ? WHITE : Math.floor((x - L * .1) / (L * .14)) % 2 ? BAND : BODY).toArray(colors, i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = mat('#ffffff'); material.vertexColors = true;
      const tail = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(L - .004, 0), new THREE.Vector2(L + .2, R * 1.3),
        new THREE.Vector2(L + .12, 0), new THREE.Vector2(L + .2, -R * 1.3)])), flatMat(fin));
      tail.userData.noOutline = true;
      // Mắt: lòng trắng + con ngươi đặt ngoài mặt thân (bán kính thân ở x = L*.1 ~ R*1.07).
      const eyes = [-1, 1].flatMap(s => [at(ball(R * .3, '#fffaf0'), L * .1, R * .32, s * R * 1.02), at(ball(R * .16, '#2a2a2a'), L * .1 + R * .05, R * .34, s * (R * 1.02 + R * .2))]);
      const fish = group(mesh(geo, material), tail, ...eyes);
      fish.rotation.order = 'YZX';
      return fish;
    };
    const kois = [[2.12, .9, .12, '#2f2f3a', '#4a4a5a', '#2f2f3a'], [1.78, .75, .1, '#e5483a', '#ff7a5c', '#c43d2a'], [1.46, .6, .085, '#3b8fe0', '#7fbff2', '#2a6fc0']]
      .map(([y, L, R, body, band, fin]) => at(koi(L, R, body, band, fin), -.1, y, 0));
    // Chong chóng đỉnh cột: trục + 6 nan, quay quanh trục cột theo gió.
    const wheel = group(at(ball(.05, '#ffd66b'), 0, 0, 0), ...[...Array(6)].map((_, k) => {
      const a = (k / 6) * TAU, spoke = at(box(.16, .012, .03, k % 2 ? '#e5483a' : '#fffaf0'), Math.cos(a) * .1, 0, Math.sin(a) * .1);
      spoke.rotation.y = -a; return spoke;
    }));
    wheel.position.y = 2.38;
    const pole = group(at(cyl(.2, .24, .12, '#9a8b7a', 16), 0, .06, 0), at(cyl(.035, .042, 2.3, bamboo, 12), 0, 1.24, 0),
      ...[.6, 1.2, 1.9].map(y => at(cyl(.045, .045, .03, '#9a7a40', 12), 0, y, 0)), at(ball(.045, '#ffd66b'), 0, 2.46, 0),
      // khoen + thanh treo cá: miệng cá cách cột .1 để cá lắc ngang không chạm cột
      ...kois.flatMap(k => [at(cyl(.05, .05, .025, '#8a5a3a', 12), 0, k.position.y, 0), at(cyl(.012, .012, .08, '#8a5a3a', 6), -.05, k.position.y, 0).rotateZ(Math.PI / 2)]));
    const node = group(pole, wheel, ...kois);
    let tug = 0;
    node.userData.tug = (k = 1) => { tug += k; };
    node.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      tug *= Math.exp(-3 * dt);
      wheel.rotation.y += (1 + 6 * w) * dt;
      kois.forEach((fish, i) => {
        // bay về -x (nhìn nghiêng từ hướng thumbnail); gió yếu thì rủ xuống, cá thấp nhất bị mèo khều thì giật mạnh
        const kick = i === kois.length - 1 ? tug : tug * .3;
        fish.rotation.set(Math.sin(t * 3.1 + i) * .25 * w + Math.sin(t * 12 + i) * kick * .3,
          Math.PI + Math.sin(t * 1.3 + i * 1.7) * .3 + Math.sin(t * 9 + i) * kick * .2,
          -(.15 + (1 - w) * .85) + Math.sin(t * 2.3 + i * 2) * .08 + kick * .15);
      });
    };
    node.userData.update(0);
    return node;
  },
  'kite-balloons'() {
    const tick = ticker(), COLORS = ['#e8617f', '#9fd0f0', '#ffd66b'];
    const weight = group(at(rbox(.18, .14, .18, .05, '#b79cf0'), 0, .07, 0), at(ball(.03, '#ffd66b'), 0, .16, 0));
    const balloons = COLORS.map((c, k) => { const b = group(squash(ball(.2, c), 1, 1.18, 1), at(cone(.04, .06, c, 8), 0, -.24, 0).rotateX(Math.PI)); b.userData.base = new THREE.Vector3((k - 1) * .28, 1.7 + (k % 2) * .25, (k - 1) * .08); b.userData.v = new THREE.Vector3(); b.position.copy(b.userData.base); return b; });
    const strings = balloons.map(() => { const g = new THREE.BufferGeometry().setFromPoints([...Array(8)].map(() => new THREE.Vector3())); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fffaf0' })); });
    const node = group(weight, ...balloons, ...strings);
    node.userData.bump = (k = 1) => balloons.forEach((b, i) => b.userData.v.set((i - 1) * k, -k * .6, k * .4));
    node.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      balloons.forEach((b, i) => {
        const goal = v3.copy(b.userData.base).add(v3b.set(Math.sin(t * .9 + i) * .15 * w + .2 * w, Math.sin(t * 1.3 + i * 2) * .06, -.15 * w));
        b.userData.v.addScaledVector(v3b.subVectors(goal, b.position), 18 * dt).multiplyScalar(Math.exp(-2.5 * dt)); // lò xo mềm: bị khều thì nảy rồi về
        b.position.addScaledVector(b.userData.v, dt);
        b.rotation.z = Math.sin(t * 1.1 + i) * .12 * w;
        const p = strings[i].geometry.attributes.position;
        for (let k = 0; k < 8; k++) { const f = k / 7; p.setXYZ(k, b.position.x * f, .17 + (b.position.y - .26 - .17) * f, b.position.z * f + Math.sin(f * Math.PI) * .04); }
        p.needsUpdate = true; strings[i].geometry.computeBoundingSphere();
      });
    };
    node.userData.update(0);
    node.userData.lookAt = [0, 1.9, 0];
    return node;
  },

  // ---------- Suối nhỏ: nước chảy (texture trôi), chiếc lá trôi theo dòng, đá + lau hai bờ ----------
  stream() { return streamBase(false); },
  'stream-bridge'() { return streamBase(true); },

  // ---------- Cây có xích đu: xích đu đung đưa theo gió, mèo ngồi lên đu theo ----------
  swingtree() {
    const tree = bigTree(), L = 1.75;
    const seat = group(at(rbox(.62, .05, .3, .025, '#c98a55'), 0, -L, 0),
      ropeBetween(new THREE.Vector3(-.26, 0, 0), new THREE.Vector3(-.26, -L + .03, 0), .012, '#fffaf0'), ropeBetween(new THREE.Vector3(.26, 0, 0), new THREE.Vector3(.26, -L + .03, 0), .012, '#fffaf0'));
    const swing = pendulum(new THREE.Vector3(0, 2.25, .85), L, ...seat.children);
    const branch = at(cyl(.06, .08, .9, '#9a6a45', 10), 0, 2.25, .55); branch.rotation.x = Math.PI / 2;
    const node = group(tree.trunk, tree.canopy, branch, swing);
    node.userData.sink = tree.trunk.userData.sink;
    node.userData.swing = swing; // mèo nhảy lên / xuống đẩy xích đu (room-cats.mjs kick)
    node.userData.ride = swing; swing.userData.restPos = swing.position.clone(); // mèo ngồi trên đu đung đưa theo
    node.userData.seat = [0, 2.25 - L + .03, .85];
    node.userData.update = t => { tree.update(t, windAt(t)); swing.userData.step(t); };
    return node;
  },
  'swingtree-treehouse'() {
    const tree = bigTree(), wood = '#c98a55';
    const deck = at(rbox(1.1, .08, 1, .04, wood), 0, 1.45, .35);
    const house = group(at(rbox(.7, .55, .6, .06, '#f3d5a8'), 0, 1.77, .25), at(cone(.6, .4, '#e8617f', 4), 0, 2.25, .25).rotateY(Math.PI / 4),
      at(rbox(.26, .34, .02, .01, '#4a2e20'), .12, 1.68, .556)); // ô cửa tối (cách vách 6 mm)
    const rails = [-.53, .53].map(x => at(box(.04, .3, 1, wood), x, 1.62, .35));
    // Thang ngả vào nhà cây: chân chạm đất ở z = FOOT, đầu tì lên mép trước sàn (z .85, y 1.49), nhô quá mép một chút.
    const TOP = 1.49, EDGE = .85, FOOT = 1.3, RUN = FOOT - EDGE, LEN = Math.hypot(TOP, RUN) + .08;
    const ladder = group(at(box(.04, LEN, .04, '#9a6a45'), -.2, LEN / 2, 0), at(box(.04, LEN, .04, '#9a6a45'), .2, LEN / 2, 0),
      ...[.2, .42, .64, .86].map(f => at(box(.4, .035, .05, '#b37444'), 0, f * (LEN - .08), 0)));
    ladder.position.set(0, 0, FOOT);
    ladder.rotation.x = -Math.atan2(RUN, TOP); // ngả đầu thang về phía sàn (-z)
    const rung = f => [0, f * TOP + .02, FOOT - f * RUN + .07]; // chỗ mèo đứng: trên bậc, nhích ra trước một chút
    const node = group(tree.trunk, tree.canopy, deck, house, ...rails, ladder);
    node.userData.sink = tree.trunk.userData.sink;
    node.userData.steps = [rung(.42), rung(.64), [0, 1.49, .62]]; // bậc thang (theo độ dốc thang) -> sàn nhà cây
    node.userData.update = t => tree.update(t, windAt(t));
    return node;
  },

  // ---------- Cầu trượt: thang leo -> sàn trên -> máng trượt cong; mèo leo lên rồi trượt xuống ----------
  slide() {
    const frame = '#3b8fe0', chuteC = '#ffb347', H = 1.1;
    const ladder = group(at(box(.05, H + .35, .05, frame), -1.05, (H + .35) / 2, -.22), at(box(.05, H + .35, .05, frame), -1.05, (H + .35) / 2, .22),
      ...[.3, .6, .9].map(y => at(box(.05, .04, .44, '#e9eef5'), -1.05, y, 0)));
    const deck = group(at(rbox(.4, .06, .5, .03, frame), -.82, H, 0), ...[-1, 1].map(s => at(box(.4, .04, .04, frame), -.82, H + .3, s * .22)),
      ...[-1, 1].flatMap(s => [at(box(.04, .34, .04, frame), -.64, H + .15, s * .22)]), at(box(.05, H, .05, frame), -.64, H / 2, .22), at(box(.05, H, .05, frame), -.64, H / 2, -.22));
    // Máng trượt: các đoạn tấm cong nối nhau theo đường cong (xuống dốc rồi thoải ở cuối).
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(-.62, H, 0), new THREE.Vector3(0, H - .1, 0), new THREE.Vector3(.5, .12, 0), new THREE.Vector3(1.25, .12, 0));
    const chute = group(), N = 10, pts = curve.getPoints(N);
    for (let k = 0; k < N; k++) {
      const a = pts[k], b = pts[k + 1], len = a.distanceTo(b) + .02, mid = a.clone().add(b).multiplyScalar(.5), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const seg = group(at(box(len, .04, .46, chuteC), 0, 0, 0), at(box(len, .14, .04, chuteC), 0, .07, .23), at(box(len, .14, .04, chuteC), 0, .07, -.23));
      seg.position.copy(mid); seg.rotation.z = ang; chute.add(seg);
    }
    const node = group(ladder, deck, chute, at(box(.05, .12, .05, frame), 1.2, .06, .2), at(box(.05, .12, .05, frame), 1.2, .06, -.2));
    node.userData.steps = [[-1.05, .63, 0], [-.82, H + .03, 0]]; // bậc thang giữa -> sàn trên
    node.userData.chute = curve.getPoints(16).map(p => [p.x, p.y + .04, 0]); // mặt máng trượt
    return node;
  },
  'slide-seesaw'() {
    const tick = ticker(), plankC = '#7fc45a', REST = -.22;
    const plank = group(at(rbox(2.4, .07, .34, .035, plankC), 0, 0, 0), ...[-1, 1].flatMap(s => [at(cyl(.025, .025, .3, '#e8617f', 8), s * 1.02, .17, 0), at(box(.04, .04, .34, '#e8617f'), s * 1.02, .32, 0)]),
      ...[-1, 1].map(s => at(rbox(.36, .05, .3, .025, '#ffd66b'), s * .95, .06, 0)));
    plank.position.y = .5; plank.rotation.z = REST;
    const pivot = group(at(cyl(.1, .1, .4, '#3b8fe0', 16), 0, .5, 0).rotateX(Math.PI / 2), at(rbox(.36, .5, .3, .06, '#3b8fe0'), 0, .25, 0));
    const node = group(pivot, plank);
    let target = REST;
    plank.userData.v = 0;
    // Mèo đáp lên đầu đang vểnh cao -> bập bênh lật xuống phía đó (target đổi dấu), lò xo nảy lại.
    node.userData.bump = (k = 1) => { target = -target; plank.userData.v += k * 1.5 * Math.sign(target - plank.rotation.z); };
    node.userData.update = t => {
      const dt = tick(t);
      plank.userData.v += ((target - plank.rotation.z) * 30 - plank.userData.v * 4) * dt;
      plank.rotation.z += plank.userData.v * dt;
    };
    node.userData.ride = plank; plank.userData.restPos = plank.position.clone();
    node.userData.plank = plank; // chỗ ngồi hai đầu: plank.localToWorld(±.95, .1, 0)
    node.userData.highEnd = () => (plank.rotation.z < 0 ? -1 : 1); // đầu đang vểnh lên (x cục bộ của tấm ván)
    return node;
  },
};
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();

// Suối (và bản có cầu): mặt nước + lòng suối là tấm phẳng (cách nhau 15 mm), nước chảy bằng cách trượt texture.
function streamBase(withBridge) {
  const tick = ticker();
  const outline = new THREE.Shape();
  const L = 1.05, Wd = .36;
  outline.moveTo(-L, -Wd);
  outline.bezierCurveTo(-.3, -Wd - .12, .3, -Wd + .1, L, -Wd + .02);
  outline.absarc(L, 0, Wd - .02, -Math.PI / 2, Math.PI / 2, false);
  outline.bezierCurveTo(.3, Wd + .1, -.3, Wd - .1, -L, Wd);
  outline.absarc(-L, 0, Wd, Math.PI / 2, Math.PI * 1.5, false);
  const flow = (() => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#6fc3e0'; g.fillRect(0, 0, 128, 64);
    for (let k = 0; k < 14; k++) { g.strokeStyle = k % 2 ? '#b8e6f5' : '#8fd4ec'; g.lineWidth = 2; g.beginPath(); const y = (k * 37) % 64; g.moveTo((k * 23) % 128, y); g.bezierCurveTo(30 + k * 5, y + 4, 60, y - 4, 90 + (k * 7) % 30, y + 2); g.stroke(); }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(1.2, 1.2);
    return tex;
  })();
  const flatShape = (color, y, extra = {}) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(outline, 24), new THREE.MeshBasicMaterial({ color, userData: { nightDim: true }, ...extra })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m; };
  const bed = flatShape('#3f8f9e', .012), water = flatShape('#ffffff', .028, { map: flow, transparent: true, opacity: .9 });
  // Đá viền hai bờ + lau.
  let seed = 3; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + seed / 2147483647 * (b - a); };
  const banks = [];
  for (let k = 0; k < 16; k++) {
    const u = -1.1 + k / 15 * 2.2, side = k % 2 ? 1 : -1, z = side * (Wd + .06 + rnd(0, .06));
    const s = squash(rock(rnd(.06, .1), k % 3 ? '#c8c2b8' : '#b5aea3', k * 3.7 + 11), 1.3, .7, 1); s.position.set(u, .01, z); s.rotation.y = k * 1.9; banks.push(s);
  }
  for (let k = 0; k < 6; k++) { const h = rnd(.25, .4); const r = at(cone(.02, h, k % 2 ? '#5fa83e' : '#7cc256', 6), .75 + rnd(-.1, .15), h / 2, -Wd - .12 + rnd(-.05, .05)); r.rotation.z = rnd(-.2, .2); banks.push(r); }
  const leaf = squash(ball(.05, '#7fc45a'), 1.4, .3, .9); leaf.position.y = .045;
  const node = group(bed, water, mergeStatic(group(...banks)), leaf); // đá + lau bờ suối tĩnh: gộp; lá trôi cử động riêng
  if (withBridge) {
    const arch = u => .32 * (1 - u * u);
    // Ván cầu cách mặt nước / lòng suối ≥ 4 cm (hai tấm đầu cầu nghiêng không cắm sát mặt nước).
    const planks = [...Array(9)].map((_, k) => { const u = k / 8 * 2 - 1, x = u * .25; const p = at(rbox(.12, .04, .62, .02, '#c9955e'), x, arch(u) + .09, 0); p.rotation.z = -Math.atan(-.32 * 2 * u / .25) * .5; return p; });
    const rails = [-1, 1].flatMap(s => [...[-1, 0, 1].map(u => at(box(.04, .3, .04, '#9a6a45'), u * .22, arch(u) + .24, s * .29)), at(box(.52, .04, .04, '#9a6a45'), 0, .49, s * .29)]);
    const feet = [-1, 1].map(s => at(rbox(.18, .1, .66, .04, '#9a6a45'), s * .33, .05, 0));
    node.add(...planks, ...rails, ...feet);
    node.userData.top = [0, .44, 0]; // mèo ngồi trên đỉnh cầu
  }
  node.userData.update = t => {
    const dt = tick(t);
    flow.offset.x -= dt * .25;
    const p = (t * .12) % 1, u = -1 + p * 2;
    leaf.position.set(u * .95, .045 + Math.sin(t * 3) * .006, Math.sin(p * 9) * .08);
    leaf.rotation.y = t * .8; leaf.visible = p > .03 && p < .97;
  };
  node.userData.leaf = leaf;
  node.userData.sink = .03; // đá viền bờ suối chôn nửa viên (tự nhiên)
  node.userData.update(0);
  return node;
}

// ---------- Đồ trang trí cố định của phần vườn mở rộng (toạ độ vườn) ----------
// Lối đá bậc từ chân đồi (phía cổng) lên đỉnh, vài tảng đá + cỏ trên sườn, hoa dại; mây trôi trên trời (có bóng đổ chạy
// trên cỏ). Trả về group có userData.update(t) (deco-room.mjs gọi mỗi frame khi vườn đã mở rộng).
export function garden2Decor() {
  const decor = group();
  // Lối đá: đi từ chân đồi phía trước-trái (hướng cổng) lên gần đỉnh, mỗi viên nằm nghiêng theo sườn.
  const dir = new THREE.Vector2(-.75, .66).normalize();
  for (let k = 0; k < 5; k++) { // dừng ở d ≈ .5: đỉnh đồi dành cho cối xay
    const d = 1.02 - k * .12, ex = dir.x * HILL.rx * d, ez = dir.y * HILL.rz * d, x = HILL.x + ex + Math.sin(k * 1.3) * .08, z = HILL.z + ez;
    decor.add(onSlope(squash(mesh(new THREE.CylinderGeometry(.16, .18, .06, 10), k % 2 ? '#d9d2c4' : '#c8c2b8'), 1.2, 1, 1), x, z, .02));
  }
  // Đá tảng chôn nửa trên sườn đồi (u = toạ độ x tính từ GARDEN_EXT_X, đồi nằm ở phần mở rộng) + cỏ lún phún (instanced) + hoa dại.
  [[2.9, -.6, .22], [-.2, -2.3, .18], [2.4, -3.1, .16]].forEach(([u, z, r]) => { const x = GARDEN_EXT_X + u; decor.add(onSlope(squash(rock(r, '#b5aea3', u * 13 + z * 7), 1.2, .85, 1), x, z, 0)); }); // đá tảng: hình góc cạnh ngẫu nhiên
  let seed = 11; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + seed / 2147483647 * (b - a); };
  const tuftGeo = new THREE.ConeGeometry(.025, .14, 5), flowerGeo = new THREE.SphereGeometry(.035, 8, 6);
  const tufts = new THREE.InstancedMesh(tuftGeo, mat('#6fae46'), 70), flowers = new THREE.InstancedMesh(flowerGeo, mat('#ffffff'), 36);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const FL = ['#ff8fa0', '#ffd66b', '#b79cf0', '#fff4f0'];
  const onHill = () => { const a = rnd(0, TAU), d = Math.sqrt(rnd(.2, .85)); return [HILL.x + Math.cos(a) * HILL.rx * d, HILL.z + Math.sin(a) * HILL.rz * d]; };
  for (let i = 0; i < 70; i++) { const [x, z] = onHill(); p.set(x, groundHeight('garden', x, z) + .05, z); q.setFromUnitVectors(UP, slopeNormal(x, z)); m.compose(p, q, sc.setScalar(rnd(.7, 1.3))); tufts.setMatrixAt(i, m); }
  for (let i = 0; i < 36; i++) { const [x, z] = onHill(); p.set(x, groundHeight('garden', x, z) + .06, z); m.compose(p, q.identity(), sc.setScalar(rnd(.8, 1.2))); flowers.setMatrixAt(i, m); flowers.setColorAt(i, c.set(FL[i % FL.length])); }
  tufts.castShadow = flowers.castShadow = false;
  decor.add(tufts, flowers);
  // Mây: 3 đám mây trôi chậm theo gió từ trái sang phải trên phần vườn mở rộng, ra khỏi vườn thì vòng lại. Chỉ thấy BÓNG mây trên cỏ.
  const clouds = [[-1, 5.6, -1.5, 1], [2.5, 6.3, 1.8, .8], [6, 5.9, -.2, 1.15]].map(([x, y, z, s]) => { x += GARDEN_EXT_X; // quanh phần vườn mở rộng
    const cl = group(...[[0, 0, 0, .7], [.65, -.1, .1, .5], [-.6, -.12, -.05, .52], [.2, .25, -.1, .5], [-.25, .18, .15, .45]].map(([a, b, d, r]) => at(ball(r, '#ffffff'), a, b, d)));
    mergeStatic(cl); cl.scale.setScalar(s); cl.position.set(x, y, z);
    cl.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = false; n.userData.noOutline = true; } n.layers.set(SHADOW_ONLY_LAYER); });
    return cl;
  });
  decor.add(...clouds);
  const tick = ticker();
  decor.userData.update = t => {
    const dt = tick(t), w = windAt(t);
    clouds.forEach((cl, i) => { cl.position.x += dt * (.12 + .25 * w); if (cl.position.x > GARDEN_EXT_X + 7.5) cl.position.x = GARDEN_EXT_X - 7.5; cl.position.y += Math.sin(t * .3 + i) * .0008; });
  };
  return decor;
}
