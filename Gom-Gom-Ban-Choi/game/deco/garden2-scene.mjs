// Phần vườn mở rộng (thắng màn 30; chung nền + hàng rào với vườn): đồi nhỏ, bộ đồ "động" cho Deco và đồ trang trí cố định (lối đá lên đồi, đá, hoa dại,
//). Đồ động đều chạy theo MỘT luồng gió chung windAt(t): cối xay quay nhanh / chậm, quần áo trên dây phơi bay
// phần phật, diều lượn, cờ phấp phới... nên cả khu chuyển động ăn khớp với nhau.
// Lớp chỉ dùng cho bóng đổ: vật trên lớp này không hiện trên màn hình nhưng vẫn đổ bóng (deco-room.mjs bật lớp này cho camera bóng nắng).
// Hiện chưa có vật nào dùng: mây trôi từng dùng lớp này nhưng bóng mây là mảng tối đa giác, nhảy hiện / mất khi mây quay vòng (đã bỏ).
export const SHADOW_ONLY_LAYER = 5;
// Mỗi món có chỗ đặt cố định [x, z, xoay?] (room-layout.mjs PLACES); +z của món hướng vào giữa khu.
// Điểm neo cho mèo trong userData (toạ độ cục bộ của món): seat / steps / chute / spot... (room-cats.mjs dùng).
// Quy tắc dựng model: CLAUDE.md (bo góc ≤ nửa cạnh mỏng, tấm phẳng cách mặt ≥ 5 mm, vỏ hở không viền, chạm sàn...).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from './mesh-detail.mjs';
import { HILL, hillProfile, groundHeight, GARDEN_EXT_X, gardenGroundUV } from './room-layout.mjs';
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
  // Đồi liền với cỏ, không có viền ở chân (CLAUDE.md): màu đỉnh = 1 ở chân (đúng màu nền) rồi đổi dần lên sườn — đỉnh sáng hơn chút,
  // sườn đón nắng (nắng từ +x +z, xem SUN_FROM) sáng / sườn khuất tối, tính so với mặt phẳng nên chân đồi (pháp tuyến ≈ thẳng đứng) = 1.
  // Texture cỏ trải theo cùng toạ độ với nền vườn (gardenGroundUV) thay cho UV của lathe, nên vân cỏ chạy liền từ nền lên đồi.
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, colors = new Float32Array(pos.count * 3);
  const sun = new THREE.Vector3(4, 9, 5).normalize(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const up = Math.max(0, pos.getY(i)) / HILL.h, lit = n.fromBufferAttribute(nor, i).dot(sun) - sun.y;
    colors.fill(1 + .1 * up + .25 * lit, i * 3, i * 3 + 3);
    uv.setXY(i, ...gardenGroundUV(pos.getX(i) + HILL.x, pos.getZ(i) + HILL.z));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  material.vertexColors = true;
  const hill = mesh(geo, material);
  hill.position.set(HILL.x, 0, HILL.z);
  hill.userData.terrain = true; // QC toon: địa hình được phép toon mượt + màu đỉnh chuyển dần
  hill.userData.closedByGround = true; // đáy hở nhưng nằm dưới mặt cỏ, không bao giờ nhìn thấy lòng
  return group(hill);
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
  const geo = new THREE.SphereGeometry(r, 20, 14), pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).divideScalar(r);
    const bump = .08 * Math.sin(5 * v.x + seed) * Math.sin(5 * v.y + seed * 2) * Math.sin(5 * v.z + seed * 3);
    pos.setXYZ(i, v.x * r * (1 + bump), v.y * r * (1 + bump), v.z * r * (1 + bump));
  }
  // Toon: giữ pháp tuyến mặt cầu trơn + một màu phẳng mỗi khối (khối to sáng hơn), như bụi góc vườn (garden-scene.mjs lumpyPuff).
  const tone = new THREE.Color(dark).lerp(new THREE.Color(light), THREE.MathUtils.clamp(.3 + (r - .6) * 1.2, .3, .7));
  return mesh(geo, `#${tone.getHexString()}`);
}
// Cây to: thân thuôn + hai cành + tán 5 khối (màu tán dark → light); tán lắc nhẹ theo gió (update trả về để món gọi).
function bigTree(dark, light) {
  const bark = '#9a6a45';
  const canopy = group(...[[0, 2.75, 0, .95], [.75, 2.45, .2, .7], [-.7, 2.5, -.1, .72], [.1, 3.3, -.1, .7], [-.2, 2.4, .6, .6]]
    .map(([x, y, z, r], k) => at(puff(r, dark, light, k * 1.7), x, y, z)));
  const trunk = group(at(cyl(.2, .3, 2.2, bark, 14), 0, 1.1, 0), at(cyl(.07, .11, 1.1, bark, 10), .45, 2.05, .1).rotateZ(-.7), at(cyl(.06, .1, 1, bark, 10), -.4, 2.05, 0).rotateZ(.75),
    ...[0, 2.1, 4.2].map(a => at(cyl(.06, .14, .35, bark, 8), Math.cos(a) * .3, .1, Math.sin(a) * .3).rotateX(Math.cos(a) * .9).rotateZ(-Math.sin(a) * .9))); // rễ nổi
  mergeStatic(canopy);
  trunk.userData.sink = .12; // rễ nổi bò rồi cắm xuống đất
  return { trunk, canopy, update: (t, w) => { canopy.rotation.z = Math.sin(t * 1.1) * .02 * w; canopy.rotation.x = Math.sin(t * .8 + 1) * .015 * w; } };
}

// Trái tim (Shape): hai thuỳ trên chạm y = 0, mũi nhọn ở y = -s (rộng ≈ 1.2 s).
function heartShape(s) {
  const h = new THREE.Shape(), p = (x, y) => [x * s, y * s];
  h.moveTo(...p(0, -1));
  h.bezierCurveTo(...p(-.3, -.7), ...p(-.6, -.45), ...p(-.6, -.22));
  h.bezierCurveTo(...p(-.6, -.05), ...p(-.45, 0), ...p(-.32, 0));
  h.bezierCurveTo(...p(-.17, 0), ...p(-.05, -.08), ...p(0, -.18));
  h.bezierCurveTo(...p(.05, -.08), ...p(.17, 0), ...p(.32, 0));
  h.bezierCurveTo(...p(.45, 0), ...p(.6, -.05), ...p(.6, -.22));
  h.bezierCurveTo(...p(.6, -.45), ...p(.3, -.7), ...p(0, -1));
  return h;
}
const heartSlab = (s, depth, color) => mesh(new THREE.ExtrudeGeometry(heartShape(s), { depth, bevelEnabled: false }), color);

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
  // Cối xay chong chóng hồng: tháp kem viền hồng, mái hồng diềm bèo + chóp vàng, cửa sổ trái tim; 4 cánh chong chóng giấy gấp chéo quay theo gió.
  'windmill-pink'() {
    const tick = ticker();
    const vane = new THREE.Shape([new THREE.Vector2(0, .06), new THREE.Vector2(0, .92), new THREE.Vector2(.46, .46)]);
    const blades = group(at(ball(.08, '#f2c14e'), 0, 0, .04));
    ['#ff8fb6', '#ffe0e9', '#ffb3c8', '#e6d4ff'].forEach((c, k) => {
      const v = mesh(new THREE.ExtrudeGeometry(vane, { depth: .02, bevelEnabled: false }), c);
      // cánh gấp chéo về phía trước như chong chóng giấy
      v.rotation.y = -.18;
      const arm = group(v); arm.rotation.z = k * TAU / 4;
      blades.add(arm);
    });
    blades.position.set(0, 1.95, .55);
    const mill = group(
      at(cyl(.55, .62, .7, '#e6d4ff', 20), 0, -.1, 0),
      at(cyl(.3, .45, 1.6, '#fff6f8', 20), 0, 1, 0),
      at(cyl(.39, .395, .05, '#ffb3c8', 20), 0, .9, 0), at(cyl(.33, .335, .05, '#ffb3c8', 20), 0, 1.55, 0), // hai đai hồng quanh tháp
      at(cone(.42, .5, '#ff8fb6', 20), 0, 2.05, 0), at(ball(.06, '#f2c14e'), 0, 2.33, 0),
      ...[...Array(14)].map((_, k) => { const a = k / 14 * TAU; return at(ball(.05, '#fff6f8'), Math.cos(a) * .42, 1.8, Math.sin(a) * .42); }), // diềm bèo chân mái
      at(cyl(.03, .03, .3, '#f2c14e', 8), 0, 1.95, .4).rotateX(Math.PI / 2), // trục chong chóng
      at(rbox(.24, .38, .06, .03, '#ff8fb6'), 0, .4, .4), at(ball(.025, '#f2c14e'), .07, .4, .44), // cửa + núm
      at(heartSlab(.16, .02, '#ffc2d4'), 0, 1.33, .36), // cửa sổ trái tim (cách vách tháp ≥ 8 mm)
      blades);
    mill.userData.sink = .46;
    mill.userData.spot = [.85, 0, .62];
    mill.userData.blades = blades;
    mill.userData.update = t => { blades.rotation.z -= (.5 + 2.6 * windAt(t)) * tick(t); };
    return mill;
  },
  'windmill-turbine'() {
    const tick = ticker();
    const rotor = group(at(ball(.12, '#f5f8fb'), 0, 0, .06));
    for (let k = 0; k < 3; k++) { const b = group(at(rbox(.12, 1.25, .04, .02, '#f5f8fb'), .03, .7, 0)); b.rotation.z = k * TAU / 3; rotor.add(b); }
    rotor.position.set(0, 2.7, .34);
    // Đèn LED nhỏ trên đầu tuabin: nháy chậm như đèn báo hiệu.
    const led = at(ball(.035, glow('#3fe0ff', '#3fe0ff', 1.6)), 0, 2.86, -.1);
    const turbine = group(at(cyl(.5, .58, .7, '#c8c2b8', 20), 0, -.1, 0), at(cyl(.07, .13, 2.5, '#f5f8fb', 16), 0, 1.45, 0),
      at(rbox(.26, .26, .55, .1, '#f5f8fb'), 0, 2.7, .05), at(box(.02, .6, .02, '#e8617f'), 0, 1.6, .1), led, rotor);
    turbine.userData.sink = .46;
    turbine.userData.spot = [.85, 0, .62];
    turbine.userData.lightSource = true;
    turbine.userData.update = t => {
      rotor.rotation.z -= (.8 + 3.2 * windAt(t)) * tick(t);
      led.material.emissiveIntensity = (t * .8) % 1 < .15 ? 2.6 : .5;
    };
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
  // Bụi hoa hồng pastel: tán lá lổn nhổn điểm hoa hồng, thẻ cắm trái tim; cả bụi lắc theo gió, mèo khều thì rung.
  'sunflowers-pink'() {
    const tick = ticker();
    const crown = group(...[[0, .45, 0, .48], [.24, .29, .16, .32], [-.24, .29, .12, .32], [.1, .28, -.24, .31], [-.16, .27, -.2, .3]]
      .map(([x, y, z, r], k) => at(puff(r, '#4f8f3a', '#8fcf6a', k * 2.1), x, y, z)));
    const rose = (core, petal) => {
      const r = group(squash(ball(.045, core), 1, .8, 1));
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; r.add(squash(at(ball(.04, petal), Math.cos(a) * .045, -.01, Math.sin(a) * .045), 1, .55, 1)); }
      return mergeStatic(r);
    };
    const dir = new THREE.Vector3();
    for (let k = 0; k < 12; k++) {
      // hoa nằm trên mặt khối tán chính, quay mặt ra ngoài
      const a = k * 2.4, e = .3 + (k % 3) * .32;
      dir.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      const r = rose(k % 2 ? '#ff8fb6' : '#ffb3c8', k % 2 ? '#ffb3c8' : '#ffe0e9');
      r.position.set(dir.x * .5, .45 + dir.y * .5, dir.z * .5); r.quaternion.setFromUnitVectors(UP, dir);
      crown.add(r);
    }
    const tag = group(at(cyl(.01, .01, .35, '#f2c14e', 6), 0, .175, 0), at(heartSlab(.12, .02, '#ff8fb6'), 0, .42, -.01));
    tag.position.set(.3, 0, .38);
    const bush = group(at(cyl(.5, .54, .04, '#8a5a3a', 28), 0, .02, 0), crown, tag);
    bush.userData.sink = .04; // các khối tán dưới cùng chạm hẳn xuống đất
    let kick = 0;
    bush.userData.bump = (k = 1) => { kick += k; };
    bush.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      kick *= Math.exp(-3 * dt);
      crown.rotation.z = Math.sin(t * 1.3) * .025 * w + Math.sin(t * 13) * kick * .04;
      crown.rotation.x = Math.sin(t * 1.1 + 1) * .02 * w;
    };
    bush.userData.update(0);
    return bush;
  },
  // Hoa sợi quang: chậu tròn đen viền LED, thân mảnh, mỗi bông là chùm sợi quang đầu phát sáng (cyan / hồng / tím) nhịp sáng chậm, lắc theo gió.
  'sunflowers-modern'() {
    const tick = ticker(), heads = [];
    const COLORS = ['#3fe0ff', '#ff4fd8', '#b07cff'], glows = COLORS.map(c => glow(c, c, 1.4));
    const plant = group(at(cyl(.5, .42, .32, '#26282c', 28), 0, .16, 0), at(cyl(.46, .46, .02, '#1f2125', 28), 0, .325, 0),
      at(mesh(new THREE.TorusGeometry(.5, .012, 6, 40), glows[0]), 0, .3, 0).rotateX(Math.PI / 2));
    const spokes = [...Array(8)].map((_, k) => { const a = k / 8 * TAU, e = .45; return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)); }).concat([UP.clone()]);
    [[0, 0, 1.2], [.25, .14, 1], [-.24, .12, 1.05], [.14, -.24, 1.1], [-.15, -.22, .9], [.3, -.08, .8], [-.3, -.06, .85]].forEach(([x, z, h], i) => {
      const g = glows[i % 3], stem = group(at(cyl(.012, .016, h, '#3a3d43', 6), 0, h / 2, 0));
      const head = group(at(ball(.03, g), 0, 0, 0));
      for (const d of spokes) {
        const fiber = at(cyl(.004, .004, .14, '#c8ccd2', 4), d.x * .07, d.y * .07, d.z * .07); fiber.quaternion.setFromUnitVectors(UP, d);
        head.add(fiber, at(ball(.018, g), d.x * .14, d.y * .14, d.z * .14));
      }
      mergeStatic(head); head.position.y = h;
      stem.add(head); stem.position.set(x, .33, z);
      heads.push({ stem, phase: i * 1.3 });
      plant.add(stem);
    });
    let kick = 0;
    plant.userData.bump = (k = 1) => { kick += k; };
    plant.userData.lightSource = true;
    plant.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      kick *= Math.exp(-3 * dt);
      heads.forEach((s, i) => {
        s.stem.rotation.z = Math.sin(t * 1.5 + s.phase) * .05 * w + Math.sin(t * 12 + i) * kick * .08;
        s.stem.rotation.x = Math.sin(t * 1.2 + s.phase * 2) * .03 * w;
      });
      glows.forEach((m, i) => { m.emissiveIntensity = 1.2 + .4 * Math.sin(t * 1.5 + i * 2); });
    };
    plant.userData.update(0);
    return plant;
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
  // Dây cờ trái tim: cột trắng chóp vàng thắt nơ hồng, cờ trái tim hồng / kem / tím nhạt bay theo gió; mèo khều thì cả dây rung.
  'clothesline-flags'() {
    const L = 1.3, Y = 1.75, sag = y => Y - .16 * (1 - y * y), flags = [];
    const bow = s => group(...[-1, 1].map(k => squash(at(ball(.05, '#ff8fb6'), k * .05, 0, 0), 1.2, .8, .5)), at(ball(.025, '#ff8fb6'), 0, 0, 0)).translateX(s * L).translateY(1.72).translateZ(.04);
    const poles = [-1, 1].map(s => group(at(cyl(.035, .045, 1.85, '#fff6f8', 10), s * L, .925, 0), at(ball(.06, '#f2c14e'), s * L, 1.88, 0), bow(s)));
    const rope = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16 * 2 - 1; rope.push(new THREE.Vector3(u * L, sag(u), 0)); }
    const heart = new THREE.ShapeGeometry(heartShape(.22));
    const COLORS = ['#ff8fb6', '#ffe0e9', '#ffb3c8', '#e6d4ff', '#ffc2d4'];
    for (let k = 0; k < 9; k++) {
      const u = -.85 + k * .2125, f = new THREE.Mesh(heart, flatMat(COLORS[k % COLORS.length]));
      const g = group(f); g.position.set(u * L, sag(u) - .01, 0); flags.push(g);
    }
    const line = group(...poles, mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), 24, .008, 5), '#fff6f8'), ...flags);
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
  // Dây đèn neon: hai cột vuông đen có dải LED, dây neon hồng võng giữa, bóng đèn tròn cyan / tím đung đưa theo gió; mèo khều thì rung.
  'clothesline-modern'() {
    const L = 1.3, Y = 1.75, sag = u => Y - .18 * (1 - u * u), bulbs = [];
    const poles = [-1, 1].map(s => group(at(rbox(.07, 1.9, .07, .03, '#26282c'), s * L, .95, 0), at(rbox(.18, .04, .18, .02, '#3a3d43'), s * L, .02, 0),
      at(box(.03, .5, .02, glow('#3fe0ff', '#3fe0ff', 1.4)), s * L, 1.3, .04)));
    const rope = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16 * 2 - 1; rope.push(new THREE.Vector3(u * L, sag(u), 0)); }
    const BULBS = [glow('#3fe0ff', '#3fe0ff', 1.5), glow('#b07cff', '#b07cff', 1.5)];
    for (let k = 0; k < 8; k++) {
      const u = -.82 + k * .234, g = group(at(cyl(.005, .005, .08, '#1f2125', 4), 0, -.04, 0), at(cyl(.02, .02, .03, '#3a3d43', 10), 0, -.085, 0), at(ball(.04, BULBS[k % 2]), 0, -.13, 0));
      g.position.set(u * L, sag(u), 0); bulbs.push(g);
    }
    const line = group(...poles, mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), 24, .014, 6), glow('#ff4fd8', '#ff4fd8', 1.6)), ...bulbs);
    let kick = 0, lastT = 0;
    line.userData.bump = (k = 1) => { kick += k; };
    line.userData.lightSource = true;
    line.userData.update = t => {
      const w = windAt(t), dt = Math.min(.05, Math.max(0, t - (lastT || t))); lastT = t;
      kick *= Math.exp(-2 * dt);
      bulbs.forEach((b, i) => {
        b.rotation.x = -(.08 + .3 * w) * (.6 + .4 * Math.sin(t * 3 + i * .9)) - kick * Math.sin(t * 13 + i) * .3;
        b.rotation.z = Math.sin(t * 2.1 + i) * .06 * w;
      });
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
  // Lều hồng: vải hồng chấm bi, viền hạt kem dọc mép trước, cờ đuôi nheo hai đầu sống lều bay theo gió, đèn lồng vàng; cánh cửa đung đưa.
  'campfire-tent'() {
    const tick = ticker(), canvas = '#ffb3c8', W = .7, H = 1, D = 1.3, slope = Math.hypot(W, H);
    const side = s => {
      const g = group(at(rbox(.04, slope, D, .02, canvas), 0, 0, 0),
        ...[...Array(7)].map((_, k) => at(ball(.03, '#fff6f8'), 0, -slope / 2 + .08 + k * (slope - .16) / 6, D / 2)), // viền hạt kem mép trước
        ...[[-.25, -.4], [.1, -.15], [-.1, .15], [.25, .4], [-.3, .45], [.2, -.5]].map(([y, z]) => squash(at(ball(.035, '#fff6f8'), s * .024, y, z), .3, 1, 1))); // chấm bi
      g.position.set(s * W / 2, H / 2, 0); g.rotation.z = s * Math.atan2(W, H);
      return g;
    };
    const back = new THREE.Shape([new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(0, H)]);
    const backWall = at(mesh(new THREE.ExtrudeGeometry(back, { depth: .03, bevelEnabled: false }), '#ffc2d4'), 0, 0, -D / 2);
    // Cánh cửa lều: nửa phải của ô cửa tam giác (đỉnh (0, H), đáy (0..W, 0)) làm bằng vải, bản lề chạy dọc mép mái bên phải,
    // vén ra ngoài một góc ~65° như cánh cửa mở hé.
    const doorTri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-W, 0), new THREE.Vector2(-W, H)]); // gốc toạ độ = góc (W, 0) của ô cửa
    const flap = group(at(mesh(new THREE.ExtrudeGeometry(doorTri, { depth: .03, bevelEnabled: false }), '#ffe0e9'), 0, 0, 0));
    flap.position.set(W, 0, D / 2);
    const hinge = new THREE.Vector3(-W, H, 0).normalize(), REST_OPEN = 1.15;
    flap.quaternion.setFromAxisAngle(hinge, REST_OPEN);
    const lantern = group(at(cyl(.06, .07, .03, '#f2c14e', 12), 0, .015, 0), at(rbox(.11, .14, .11, .03, glow('#fff0b8', '#ffcf5a', .9)), 0, .1, 0), at(cone(.08, .06, '#f2c14e', 4), 0, .2, 0).rotateY(Math.PI / 4));
    lantern.position.set(-.45, 0, D / 2 + .25);
    const light = new THREE.PointLight('#ffcf7a', 2.5, 3, 1.6); light.position.set(-.45, .3, D / 2 + .25);
    const ropes = [-1, 1].flatMap(s => [ropeBetween(new THREE.Vector3(0, H, s * D / 2), new THREE.Vector3(0, 0, s * (D / 2 + .45)), .008, '#fff6f8'), at(cyl(.02, .01, .1, '#f2c14e', 6), 0, .05, s * (D / 2 + .45))]);
    // Cờ đuôi nheo trên hai đầu sống lều.
    const pennantGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, -.14), new THREE.Vector2(.3, -.07)]));
    const pennants = [-1, 1].map((s, k) => { const p = new THREE.Mesh(pennantGeo, flatMat(k ? '#ff8fb6' : '#e6d4ff')); const g = group(p); g.position.set(0, H + .4, s * .6); return g; });
    const masts = [-1, 1].flatMap(s => [at(cyl(.012, .012, .42, '#f2c14e', 6), 0, H + .2, s * .6), at(ball(.025, '#f2c14e'), 0, H + .43, s * .6)]);
    const tent = group(side(1), side(-1), backWall, flap, at(rbox(1.2, .03, D - .1, .015, '#fff6f8'), 0, .015, 0), at(cyl(.025, .025, D + .1, '#f2c14e', 8), 0, H, 0).rotateX(Math.PI / 2),
      ...ropes, ...masts, ...pennants, lantern, light);
    tent.userData.flap = flap;
    tent.userData.bump = (k = 1) => { flap.userData.v = (flap.userData.v || 0) + k * 2; };
    tent.userData.update = t => {
      const dt = tick(t), w = windAt(t), v = flap.userData.v || 0;
      flap.userData.v = v * Math.exp(-2.5 * dt);
      flap.quaternion.setFromAxisAngle(hinge, REST_OPEN + Math.sin(t * 2.2) * .07 * w + Math.sin(t * 9) * flap.userData.v * .1); // cánh cửa đung đưa theo gió
      pennants.forEach((p, i) => { p.rotation.y = -.3 + Math.sin(t * (3 + i) + i) * (.15 + .35 * w); });
    };
    tent.userData.update(0);
    tent.userData.inside = [0, 0, .1]; // chỗ mèo chui vào nằm
    return tent;
  },
  // Bếp lửa gas: hộp chữ nhật đen nhám, khay đá + dải lửa gas, lửa bập bùng + đèn như lửa trại (mèo vẫn nằm sưởi); ghế dài đen phía sau.
  'campfire-modern'() {
    const W = 1, Dp = .56, Hp = .36;
    const flameMat = (c, e) => mat(c, { emissive: e, emissiveIntensity: 1.3 });
    const flames = [-.3, -.15, 0, .15, .3].map((x, k) => {
      const h = .3 + (k % 2 ? .06 : .12) - Math.abs(x) * .2, f = at(mesh(new THREE.ConeGeometry(k % 2 ? .07 : .09, h, 10), k % 2 ? flameMat('#ffd66b', '#ffb92a') : flameMat('#ff7a3d', '#ff5a1a')), x, 0, 0);
      f.userData.h = h; f.castShadow = false; return f;
    });
    const base = Hp + .05;
    const light = new THREE.PointLight('#ff9a4a', 4, 5, 1.6); light.position.set(0, .7, 0);
    const pit = group(at(rbox(W, Hp, Dp, .04, '#26282c'), 0, Hp / 2, 0), at(rbox(W - .16, .04, Dp - .16, .02, '#1f2125'), 0, Hp + .005, 0),
      at(box(W - .3, .03, .06, glow('#5ab0ff', '#3f8fff', 1.4)), 0, Hp + .035, 0), // ngọn lửa gas xanh sát khay
      at(box(W - .1, .015, .02, glow('#3fe0ff', '#3fe0ff', 1.4)), 0, .05, Dp / 2 + .004)); // dải LED chân trước
    const bench = group(at(rbox(1.1, .06, .3, .03, '#3a3d43'), 0, .28, -.95), ...[-1, 1].map(s => at(rbox(.06, .25, .26, .02, '#1f2125'), s * .45, .125, -.95)));
    const fire = group(pit, bench, ...flames, light);
    fire.userData.update = t => {
      const w = windAt(t);
      flames.forEach((f, k) => { const s = 1 + Math.sin(t * (9 + k * 2.3)) * .12 + Math.sin(t * 17 + k) * .06; f.scale.set(1 - (s - 1) * .5, s, 1 - (s - 1) * .5); f.rotation.z = Math.sin(t * 3 + k) * .08 * w; f.position.y = base + f.userData.h * s / 2; });
      light.intensity = (light.userData.baseIntensity ?? 4) * (.85 + Math.sin(t * 11) * .08 + Math.sin(t * 23) * .05);
    };
    fire.userData.update(0);
    fire.userData.lightSource = true;
    return fire;
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
  // Bóng bay trái tim: hộp quà hồng thắt nơ giữ chùm 3 bóng trái tim, bóng nghiêng theo gió; mèo khều thì nảy.
  'kite-balloons'() {
    const tick = ticker(), COLORS = ['#ff8fb6', '#ffd0dd', '#ffb3c8'];
    const weight = group(at(rbox(.18, .14, .18, .05, '#ffb3c8'), 0, .07, 0), at(box(.185, .145, .03, '#fff6f8'), 0, .07, 0), at(box(.03, .145, .185, '#fff6f8'), 0, .07, 0),
      ...[-1, 1].map(s => squash(at(ball(.04, '#ff8fb6'), s * .04, .16, 0), 1.2, .8, .6)), at(ball(.02, '#ff8fb6'), 0, .16, 0));
    const heart = c => squash(group(at(ball(.13, c), -.085, .03, 0), at(ball(.13, c), .085, .03, 0), at(cone(.19, .26, c, 14), 0, -.1, 0).rotateZ(Math.PI), at(ball(.025, c), 0, -.25, 0)), 1, 1, .75);
    const balloons = COLORS.map((c, k) => { const b = heart(c); b.userData.base = new THREE.Vector3((k - 1) * .28, 1.7 + (k % 2) * .25, (k - 1) * .08); b.userData.v = new THREE.Vector3(); b.position.copy(b.userData.base); return b; });
    const strings = balloons.map(() => { const g = new THREE.BufferGeometry().setFromPoints([...Array(8)].map(() => new THREE.Vector3())); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff6f8' })); });
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
  // Drone: bệ đáp đen viền LED, drone 4 cánh quạt quay tít lơ lửng lượn theo gió, đèn LED cyan trước / hồng sau; mèo vồ thì drone chao đi.
  'kite-modern'() {
    const tick = ticker();
    const cyan = glow('#3fe0ff', '#3fe0ff', 1.6), pink = glow('#ff4fd8', '#ff4fd8', 1.6);
    const pad = group(at(cyl(.18, .19, .03, '#26282c', 24), 0, .015, 0), at(mesh(new THREE.TorusGeometry(.15, .008, 6, 32), cyan), 0, .032, 0).rotateX(Math.PI / 2),
      ...[-1, 1].map(s => at(box(.025, .012, .12, '#f5f8fb'), s * .045, .033, 0)), at(box(.07, .012, .025, '#f5f8fb'), 0, .033, 0)); // chữ H
    const rotors = [];
    const drone = group(at(rbox(.22, .07, .22, .03, '#26282c'), 0, 0, 0), at(ball(.035, '#1f2125'), 0, -.05, .08), at(ball(.015, cyan), 0, -.05, .113),
      ...[-1, 1].flatMap(s => [at(box(.02, .02, .2, '#3a3d43'), s * .07, -.08, 0), at(box(.015, .05, .015, '#3a3d43'), s * .07, -.055, .06), at(box(.015, .05, .015, '#3a3d43'), s * .07, -.055, -.06)])); // càng đáp
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const arm = at(box(.2, .025, .03, '#3a3d43'), sx * .1, 0, sz * .1); arm.rotation.y = Math.atan2(-sz, sx);
      const rotor = at(group(at(box(.22, .008, .03, '#c8ccd2'), 0, 0, 0)), sx * .2, .045, sz * .2);
      rotors.push(rotor);
      drone.add(arm, at(cyl(.03, .03, .04, '#3a3d43', 10), sx * .2, .02, sz * .2), at(mesh(new THREE.TorusGeometry(.12, .006, 4, 24), '#3a3d43'), sx * .2, .045, sz * .2).rotateX(Math.PI / 2),
        at(ball(.018, sz > 0 ? cyan : pink), sx * .2, -.01, sz * .2), rotor);
    }
    const node = group(pad, drone);
    let tug = 0;
    node.userData.tug = (k = 1) => { tug += k; };
    node.userData.lightSource = true;
    node.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      tug *= Math.exp(-3 * dt);
      drone.position.set(Math.sin(t * .6) * (.25 + .25 * w) + Math.sin(t * 7) * tug * .12, 1.5 + Math.sin(t * 1.1) * .12 + .15 * w - tug * .35, -.7 - .2 * w + Math.cos(t * .6) * .15);
      drone.rotation.set(.1 * w + Math.sin(t * 1.1) * .03, Math.sin(t * .3) * .4, -Math.cos(t * .6) * .12 + Math.sin(t * 9) * tug * .15);
      rotors.forEach((r, i) => { r.rotation.y += (i % 2 ? 40 : -40) * dt; });
    };
    node.userData.update(0);
    node.userData.lookAt = [0, 1.6, -.8];
    return node;
  },

  // ---------- Suối nhỏ: nước chảy (texture trôi), chiếc lá trôi theo dòng, đá + lau hai bờ ----------
  stream() { return streamBase(false); },
  'stream-pink'() { return streamBase(true); },
  // Máng nước LED: máng chữ nhật thành đen, dải LED cyan dọc hai mép, nước chảy; quả cầu LED hồng trôi theo dòng (mèo khều như chiếc lá).
  'stream-modern'() {
    const tick = ticker(), L = .95, Wd = .3, H = .14;
    const flow = flowTexture(['#2f7fa8', '#7fdcff', '#3fb4e0']); flow.repeat.set(3, .7);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * L, 2 * Wd), flatMat('#ffffff', { map: flow, side: THREE.FrontSide }));
    water.rotation.x = -Math.PI / 2; water.position.y = H - .04; water.receiveShadow = true;
    const led = glow('#3fe0ff', '#3fe0ff', 1.4);
    const curbs = group(...[-1, 1].flatMap(s => [at(rbox(2 * L + .2, H, .1, .03, '#3a3d43'), 0, H / 2, s * (Wd + .05)), at(rbox(.1, H, 2 * Wd, .03, '#3a3d43'), s * (L + .05), H / 2, 0),
      at(box(2 * L, .015, .015, led), 0, H + .004, s * (Wd + .05))]));
    const orb = at(ball(.04, glow('#ff4fd8', '#ff4fd8', 1.6)), 0, H - .02, 0);
    const node = group(water, curbs, orb);
    node.userData.leaf = orb;
    node.userData.lightSource = true;
    node.userData.update = t => {
      flow.offset.x -= tick(t) * .25;
      const p = (t * .12) % 1, u = -1 + p * 2;
      orb.position.set(u * L * .9, H - .02 + Math.sin(t * 3) * .006, Math.sin(p * 9) * .06);
      orb.visible = p > .03 && p < .97;
    };
    node.userData.update(0);
    return node;
  },

  // ---------- Cây có xích đu: xích đu đung đưa theo gió, mèo ngồi lên đu theo ----------
  swingtree() {
    const tree = bigTree('#4f9a36', '#9be06a');
    const seat = [at(rbox(.62, .05, .3, .025, '#c98a55'), 0, -SWING_L, 0), ...swingRopes('#fffaf0')];
    const node = hangSwing(group(tree.trunk, tree.canopy, swingBranch()), seat, t => tree.update(t, windAt(t)));
    node.userData.sink = tree.trunk.userData.sink;
    return node;
  },
  // Xích đu hoa anh đào: tán hoa hồng phấn, ván hồng viền hạt kem, dây quấn hoa nhỏ.
  'swingtree-pink'() {
    const tree = bigTree('#e98fb0', '#ffd6e4');
    const seat = [at(rbox(.62, .05, .3, .025, '#ffb3c8'), 0, -SWING_L, 0), ...swingRopes('#fff6f8'),
      ...[...Array(6)].map((_, k) => at(ball(.022, '#fff6f8'), -.25 + k * .1, -SWING_L, .15)), // viền hạt mép trước ván
      ...[-1, 1].flatMap(s => [.35, .75, 1.15, 1.5].map((y, k) => at(ball(.03, k % 2 ? '#ff8fb6' : '#fff6f8'), s * .26, -y, 0)))]; // hoa quấn dây
    const node = hangSwing(group(tree.trunk, tree.canopy, swingBranch()), seat, t => tree.update(t, windAt(t)));
    node.userData.sink = tree.trunk.userData.sink;
    return node;
  },
  // Xích đu neon: khung chữ A kim loại đen viền neon tím / hồng, ván đen viền LED cyan, xích thép; chậu cây vuông đen ở gốc (chỗ thân cây của món gốc).
  'swingtree-modern'() {
    const dark = '#26282c', Y = 2.27, SPLAY = .38, len = Math.hypot(Y, SPLAY);
    const purple = glow('#b07cff', '#b07cff', 1.5);
    const legs = [-1, 1].flatMap(sx => [-1, 1].map(sz => {
      const leg = group(at(rbox(.07, len, .07, .03, dark), 0, 0, 0), ...(sz > 0 ? [at(box(.015, len * .9, .02, purple), sx * .04, 0, 0)] : []));
      leg.position.set(sx * .62, Y / 2, .85 + sz * SPLAY / 2); leg.rotation.x = -sz * Math.atan2(SPLAY, Y);
      return leg;
    }));
    const frame = group(...legs, at(rbox(1.36, .08, .08, .03, dark), 0, Y + .02, .85), at(box(1.2, .015, .015, glow('#ff4fd8', '#ff4fd8', 1.5)), 0, Y + .02, .892));
    const planter = group(at(rbox(.44, .42, .44, .04, dark), 0, .21, 0), at(box(.4, .015, .015, glow('#3fe0ff', '#3fe0ff', 1.4)), 0, .39, .224), at(ball(.26, '#6f9e5a'), 0, .62, 0));
    const seat = [at(rbox(.62, .05, .3, .025, dark), 0, -SWING_L, 0), at(box(.6, .012, .012, glow('#3fe0ff', '#3fe0ff', 1.4)), 0, -SWING_L, .152), ...swingRopes('#c8ccd2')];
    const node = hangSwing(group(frame, planter), seat);
    node.userData.lightSource = true;
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
  // Bập bênh hồng: ván hồng, đệm ngồi trái tim, tay nắm vàng, chân đế hồng thắt nơ.
  'slide-seesaw'() {
    const tick = ticker(), REST = -.22;
    const cushion = s => {
      const geo = new THREE.ExtrudeGeometry(heartShape(.26), { depth: .05, bevelEnabled: false });
      geo.translate(0, .13, 0); geo.rotateX(-Math.PI / 2);
      return at(mesh(geo, '#ff8fb6'), s * .95, .033, 0);
    };
    const plank = group(at(rbox(2.4, .07, .34, .035, '#ffc2d4'), 0, 0, 0), ...[-1, 1].flatMap(s => [at(cyl(.025, .025, .3, '#f2c14e', 8), s * 1.02, .17, 0), at(box(.04, .04, .34, '#f2c14e'), s * 1.02, .32, 0)]),
      cushion(-1), cushion(1));
    plank.position.y = .5; plank.rotation.z = REST;
    const pivot = group(at(cyl(.1, .1, .4, '#f2c14e', 16), 0, .5, 0).rotateX(Math.PI / 2), at(rbox(.36, .5, .3, .06, '#ffb3c8'), 0, .25, 0),
      ...[-1, 1].map(s => squash(at(ball(.06, '#ff8fb6'), s * .06, .3, .18), 1.2, .8, .5)), at(ball(.03, '#ff8fb6'), 0, .3, .17)); // nơ trước chân đế
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
  // Cầu trượt ống neon: tháp kim loại đen, lan can dải LED cyan, máng ống nửa tròn trắng viền neon hồng / cyan (cùng đường máng với món gốc).
  'slide-modern'() {
    const dark = '#26282c', H = 1.1, R = .24;
    const towerPosts = [-1.05, -.64].flatMap(x => [-.22, .22].map(z => at(rbox(.07, H + .35, .07, .03, dark), x, (H + .35) / 2, z)));
    const rungs = [.3, .6, .9].map(y => at(cyl(.022, .022, .44, '#c8ccd2', 8), -1.05, y, 0).rotateX(Math.PI / 2));
    const cyan = glow('#3fe0ff', '#3fe0ff', 1.4);
    const deck = group(at(rbox(.44, .06, .52, .03, '#3a3d43'), -.84, H, 0), ...[-1, 1].flatMap(s => [at(box(.41, .05, .05, dark), -.845, H + .3, s * .22), at(box(.38, .012, .02, cyan), -.845, H + .33, s * .22)]));
    // Máng ống: nửa ống trụ hở phía trên (vỏ mỏng: không viền, mép là ống neon riêng), đáy ống nằm đúng đường máng.
    const shellMat = mat('#f5f8fb', { side: THREE.DoubleSide });
    const { curve, chute } = slideChute(len => {
      const geo = new THREE.CylinderGeometry(R, R, len, 14, 1, true, Math.PI, Math.PI); geo.rotateZ(Math.PI / 2);
      const shell = at(mesh(geo, shellMat), 0, R, 0); shell.userData.noOutline = true;
      return group(shell);
    });
    const rim = (side, material) => {
      const pts = [...Array(21)].map((_, k) => { const u = k / 20, p = curve.getPoint(u), d = curve.getTangent(u); return new THREE.Vector3(p.x - d.y * R, p.y + d.x * R, side * R); });
      return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, .018, 6), material);
    };
    const mid = curve.getPoint(.55);
    const node = group(...towerPosts, ...rungs, deck, chute, rim(1, glow('#ff4fd8', '#ff4fd8', 1.5)), rim(-1, cyan),
      at(rbox(.07, mid.y - .03, .07, .03, dark), mid.x, (mid.y - .03) / 2, 0), at(rbox(.06, .12, .06, .02, dark), 1.15, .06, 0));
    node.userData.steps = [[-1.05, .63, 0], [-.82, H + .03, 0]];
    node.userData.chute = curve.getPoints(16).map(p => [p.x, p.y + .04, 0]);
    node.userData.lightSource = true;
    return node;
  },

  // ---------- Nhà chim trên cột: chim đậu trên nóc, ngó quanh + mổ, đuôi rung theo gió (mèo ngước nhìn: lookAt) ----------
  // Nhà vàng mái đỏ, cột xanh, lỗ tròn + que đậu, chim xanh bụng trắng.
  birdhouse() {
    const house = group(at(gableBody(.3, .3, .12, .28, '#ffd66b'), 0, 0, 0), ...gableRoof(.3, .3, .12, .36, '#e8617f'),
      at(cyl(.045, .045, .02, '#5a3a26', 16), 0, .17, .156).rotateX(Math.PI / 2), // lỗ chim (mặt sau cách vách 6 mm)
      at(cyl(.012, .012, .1, '#9a6a45', 8), 0, .09, .185).rotateX(Math.PI / 2), // que đậu
      at(rbox(.36, .03, .34, .015, '#e8617f'), 0, -.015, 0)); // đế nhà
    return birdhouseRig(house, '#3b8fe0', '#8a5a3a', ['#5ab0e8', '#fffaf0']);
  },
  // Nhà chim hồng: thân hồng phấn, mái hồng đậm diềm bèo kem, chóp vàng, cửa trái tim, cột trắng thắt nơ, chim hồng.
  'birdhouse-pink'() {
    const gold = '#f2c14e';
    const scallops = [-1, 1].flatMap(s => [...Array(5)].map((_, k) => at(ball(.022, '#fff6f8'), s * (.19 - k * .002), .27, -.16 + k * .08)));
    const house = group(at(gableBody(.3, .3, .12, .28, '#ffc2d4'), 0, 0, 0), ...gableRoof(.3, .3, .12, .36, '#ff8fb6'), ...scallops,
      ...[-1, 1].map(s => at(ball(.03, gold), 0, .455, s * .18)), // chóp vàng hai đầu nóc
      at(heartSlab(.1, .02, '#c45a7e'), 0, .22, .146), // cửa trái tim (mặt sau cách vách 6 mm)
      at(cyl(.012, .012, .1, gold, 8), 0, .08, .185).rotateX(Math.PI / 2),
      at(rbox(.36, .03, .34, .015, gold), 0, -.015, 0));
    const bow = group(...[-1, 1].map(s => squash(at(ball(.05, '#ff8fb6'), s * .055, 0, 0), 1.2, .8, .5)), at(ball(.025, '#ff8fb6'), 0, 0, 0));
    bow.position.set(0, .95, .05);
    const node = birdhouseRig(house, '#fff6f8', gold, ['#ffb3c8', '#fff6f8']);
    node.add(bow);
    return node;
  },
  // Nhà chim thông minh: hộp đen nhám mái lệch có tấm pin mặt trời, vòng LED cyan quanh lỗ, dải LED hồng mép mái, mắt camera tím; cột thép đen dải LED.
  'birdhouse-modern'() {
    const cyan = glow('#3fe0ff', '#3fe0ff', 1.4), pink = glow('#ff4fd8', '#ff4fd8', 1.4);
    const roof = group(at(rbox(.42, .03, .38, .015, '#1f2125'), 0, 0, 0), at(rbox(.3, .012, .28, .006, '#3a3d43'), 0, .027, 0), // tấm pin trên mái (kê cách mặt mái 6 mm)
      at(box(.42, .012, .012, pink), 0, 0, .19));
    roof.position.set(0, .33, 0);
    const house = group(at(rbox(.3, .32, .28, .03, '#26282c'), 0, .16, 0), roof,
      at(cyl(.045, .045, .02, '#0d0e10', 16), 0, .17, .156).rotateX(Math.PI / 2),
      at(mesh(new THREE.TorusGeometry(.055, .008, 6, 24), cyan), 0, .17, .16),
      at(ball(.018, glow('#b07cff', '#b07cff', 1.4)), .1, .27, .145), // mắt camera
      at(cyl(.008, .008, .1, '#c8ccd2', 8), 0, .08, .185).rotateX(Math.PI / 2),
      at(rbox(.34, .03, .32, .015, '#3a3d43'), 0, -.015, 0));
    const node = birdhouseRig(house, '#3a3d43', '#26282c', ['#8fa3b8', '#f5f8fb'], .363);
    node.add(at(box(.012, .9, .012, cyan), 0, .65, .045)); // dải LED dọc cột
    node.userData.lightSource = true;
    return node;
  },

  // ---------- Bàn picnic: ghế băng hai bên, khăn ca-rô, giỏ đồ ăn; mép khăn bay theo gió; mèo nhảy lên mặt bàn (seat) ----------
  // Bàn xanh dương, khăn ca-rô đỏ, giỏ mây nắp đỏ, đĩa bánh mì kẹp + táo + cốc nước cam.
  picnic() {
    const frame = '#3b8fe0';
    const basket = picnicBasket('#d9a35a', '#b8803e', '#e5483a');
    basket.position.set(-.3, .755, -.06);
    const food = group(at(cyl(.1, .09, .015, '#fffaf0', 20), .3, .763, .14), at(rbox(.13, .04, .09, .015, '#f3d5a8'), .3, .79, .14), at(box(.135, .012, .095, '#7cc256'), .3, .79, .14),
      at(ball(.04, '#e5483a'), .08, .795, .2), at(cyl(.004, .004, .03, '#5a3a26', 4), .08, .845, .2),
      at(cyl(.035, .03, .1, '#fffaf0', 14), .43, .805, -.22), at(cyl(.03, .03, .01, '#ffb347', 14), .43, .858, -.22));
    return picnicTable({ frame, top: '#fffaf0', stripe: 'rgba(229,72,58,.6)', extras: [basket, food] });
  },
  // Bộ picnic hồng: bàn trắng ghế hồng, khăn ca-rô hồng diềm bèo kem viền vàng, đệm trái tim trên ghế, giỏ hồng thắt nơ, bánh cupcake + bình sữa dâu.
  'picnic-pink'() {
    const gold = '#f2c14e';
    const basket = picnicBasket('#ffc2d4', '#fff6f8', '#ff8fb6');
    basket.add(...[-1, 1].map(s => squash(at(ball(.035, '#ff8fb6'), s * .04, .2, .1), 1.2, .8, .5)), at(ball(.018, '#ff8fb6'), 0, .2, .1)); // nơ trên nắp
    basket.position.set(-.3, .755, -.06);
    const cupcake = (x, z, top) => group(at(cyl(.04, .03, .05, '#ff8fb6', 12), 0, .025, 0), at(ball(.042, top), 0, .065, 0), at(ball(.012, '#e8486a'), 0, .11, 0)).translateX(x).translateY(.755).translateZ(z);
    const food = group(at(cyl(.11, .1, .015, gold, 20), .3, .763, .14), cupcake(.26, .12, '#fff6f8'), cupcake(.34, .17, '#ffe0e9'),
      at(cyl(.035, .035, .12, '#ffe0e9', 14), .43, .815, -.22), at(cyl(.02, .025, .04, '#fff6f8', 10), .43, .895, -.22));
    const cushions = [-1, 1].map(s => { const geo = new THREE.ExtrudeGeometry(heartShape(.2), { depth: .03, bevelEnabled: false }); geo.translate(0, .1, 0); geo.rotateX(-Math.PI / 2); return at(mesh(geo, '#ff8fb6'), s * .25, .445, s * .45); });
    const trim = [-1, 1].map(s => at(box(1.08, .012, .012, gold), 0, .755, s * .356));
    return picnicTable({ frame: '#ffc2d4', legs: '#fff6f8', top: '#fff6f8', stripe: 'rgba(255,143,182,.6)', ruffle: '#fff6f8', extras: [basket, food, ...cushions, ...trim] });
  },
  // Bàn picnic neon: mặt + ghế đen nhám chân tấm thép, dải LED cyan quanh mép bàn, LED hồng dưới mép ghế, thùng giữ lạnh thép, đèn ống tím, lon nước.
  'picnic-modern'() {
    const dark = '#26282c', black = '#1f2125', cyan = glow('#3fe0ff', '#3fe0ff', 1.4), pink = glow('#ff4fd8', '#ff4fd8', 1.4);
    const node = group(at(rbox(1.04, .04, .64, .02, black), 0, .72, 0),
      ...[-1, 1].map(s => at(box(1.0, .012, .012, cyan), 0, .72, s * .32)), ...[-1, 1].map(s => at(box(.012, .012, .6, cyan), s * .52, .72, 0)),
      ...[-1, 1].map(s => at(rbox(.05, .71, .5, .02, dark), s * .4, .355, 0)), // chân tấm
      ...[-1, 1].flatMap(s => [at(rbox(1.04, .045, .24, .02, black), 0, .4275, s * .45), at(box(1.0, .012, .012, pink), 0, .41, s * .57),
        ...[-1, 1].map(x => at(rbox(.05, .41, .2, .02, dark), x * .4, .205, s * .45))]), // ghế + chân ghế
      at(rbox(.26, .16, .18, .03, '#c8ccd2'), -.3, .82, -.06), at(rbox(.27, .03, .19, .015, '#3a3d43'), -.3, .915, -.06), at(box(.262, .012, .012, cyan), -.3, .84, .03), // thùng giữ lạnh
      at(cyl(.04, .04, .02, black, 12), .43, .75, -.24), at(cyl(.03, .03, .14, glow('#b07cff', '#b07cff', 1.4), 12), .43, .83, -.24), at(cyl(.04, .04, .02, black, 12), .43, .91, -.24), // đèn ống
      at(cyl(.03, .03, .1, '#c8ccd2', 12), .28, .79, .16), at(cyl(.032, .032, .04, '#ff4fd8', 12), .28, .79, .16)); // lon nước
    node.userData.seat = [.12, .74, -.1];
    node.userData.top = .74;
    node.userData.lightSource = true;
    return node;
  },
};
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();

// Xích đu treo dưới cành / xà ngang: con lắc ở (0, 2.25, .85), dây dài SWING_L; các khối ván toạ độ tính từ điểm treo.
const SWING_L = 1.75;
const swingRopes = color => [-.26, .26].map(x => ropeBetween(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, -SWING_L + .03, 0), .012, color));
const swingBranch = () => { const b = at(cyl(.06, .08, .9, '#9a6a45', 10), 0, 2.25, .55); b.rotation.x = Math.PI / 2; return b; };
function hangSwing(node, seatParts, update) {
  const swing = pendulum(new THREE.Vector3(0, 2.25, .85), SWING_L, ...seatParts);
  node.add(swing);
  node.userData.swing = swing; // mèo nhảy lên / xuống đẩy xích đu (room-cats.mjs kick)
  node.userData.ride = swing; swing.userData.restPos = swing.position.clone(); // mèo ngồi trên đu đung đưa theo
  node.userData.seat = [0, 2.25 - SWING_L + .03, .85];
  node.userData.update = t => { update?.(t); swing.userData.step(t); };
  return node;
}

// Đường máng trượt chung (xuống dốc rồi thoải ở cuối) + máng ghép từ các đoạn thẳng nối nhau theo đường cong.
// makeSeg(len) dựng một đoạn dọc trục x, gốc ở giữa đoạn, mặt máng ở y = 0.
function slideChute(makeSeg) {
  const H = 1.1, curve = new THREE.CubicBezierCurve3(new THREE.Vector3(-.62, H, 0), new THREE.Vector3(0, H - .1, 0), new THREE.Vector3(.5, .12, 0), new THREE.Vector3(1.25, .12, 0));
  const chute = group(), pts = curve.getPoints(10);
  for (let k = 0; k < 10; k++) {
    const a = pts[k], b = pts[k + 1], seg = makeSeg(a.distanceTo(b) + .02);
    seg.position.copy(a).add(b).multiplyScalar(.5); seg.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    chute.add(seg);
  }
  return { curve, chute };
}

// ---------- Nhà chim: thân nhà mái hai dốc + cột, chim đậu trên nóc ----------
// Thân nhà hình ngũ giác (vách cao wallH, đỉnh hồi nhô peak) đùn dày d, đáy ở y = 0, mặt trước ở z = d / 2.
function gableBody(w, wallH, peak, d, color) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, wallH), new THREE.Vector2(0, wallH + peak), new THREE.Vector2(-w / 2, wallH)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return mesh(geo, color);
}
// Hai tấm mái nằm trên hai dốc hồi (chìa ra mái hiên 5 cm) + thanh nóc.
function gableRoof(w, wallH, peak, depth, color) {
  const a = Math.atan2(peak, w / 2), len = Math.hypot(w / 2, peak), T = .03;
  const planks = [-1, 1].map(s => {
    // tâm tấm = giữa dốc, lùi về phía hiên nửa phần chìa, nhấc ra ngoài theo pháp tuyến nửa bề dày
    const x = s * (w / 4 + Math.cos(a) * .025 + Math.sin(a) * (T / 2 + .001)), y = wallH + peak / 2 - Math.sin(a) * .025 + Math.cos(a) * (T / 2 + .001);
    const p = at(box(len + .05, T, depth, color), x, y, 0); p.rotation.z = -s * a; return p;
  });
  return [...planks, at(cyl(.025, .025, depth + .02, color, 10), 0, wallH + peak + .02, 0).rotateX(Math.PI / 2)];
}
// Chim nhỏ (gốc = chân): thân, bụng, đầu có mỏ + mắt (nằm ngoài mặt đầu), cánh, đuôi.
function perchedBird(color, belly) {
  const head = group(ball(.035, color), at(cone(.012, .035, '#ffb347', 8), 0, 0, .045).rotateX(Math.PI / 2),
    ...[-1, 1].map(s => at(ball(.007, '#2a1d14'), s * .022, .01, .027)));
  head.position.set(0, .095, .04);
  const tail = group(at(box(.05, .008, .07, color), 0, 0, -.03));
  tail.position.set(0, .06, -.05);
  const bird = group(squash(at(ball(.05, color), 0, .05, 0), 1, .85, 1.25), at(ball(.035, belly), 0, .04, .03),
    ...[-1, 1].map(s => squash(at(ball(.035, color), s * .045, .055, -.005), .35, .7, 1.1)),
    ...[-1, 1].map(s => at(ball(.008, '#ffb347'), s * .015, .006, .01)), head, tail);
  bird.userData.head = head; bird.userData.tail = tail;
  return bird;
}
// Cột cắm đế tròn + nhà trên đỉnh cột + chim đậu (birdY = mặt nóc nhà, toạ độ nhà). Chim ngó quanh, thỉnh thoảng mổ, đuôi rung theo gió.
const BIRD_POST_H = 1.2;
function birdhouseRig(house, postColor, baseColor, [birdColor, belly], birdY = .465) {
  house.position.y = BIRD_POST_H + .03;
  const bird = perchedBird(birdColor, belly);
  bird.position.set(0, BIRD_POST_H + .03 + birdY, .08);
  const node = group(at(cyl(.12, .14, .03, baseColor, 18), 0, .015, 0), at(cyl(.035, .04, BIRD_POST_H, postColor, 12), 0, BIRD_POST_H / 2, 0), house, bird);
  node.userData.bird = bird;
  node.userData.lookAt = [0, BIRD_POST_H + .5, .1]; // mèo ngước nhìn chim
  node.userData.update = t => {
    const w = windAt(t);
    bird.rotation.y = .6 * Math.sin(t * .45) + .25 * Math.sin(t * 1.3);
    bird.userData.head.rotation.x = .7 * Math.max(0, Math.sin(t * 2.2)) ** 12; // mổ nhanh từng cú
    bird.userData.tail.rotation.x = .2 + (.1 + .25 * w) * (.5 + .5 * Math.sin(t * 9));
  };
  node.userData.update(0);
  return node;
}

// ---------- Bàn picnic: bàn + hai ghế băng (khung chữ A), khăn ca-rô có hai mép buông bay theo gió ----------
// Texture ca-rô (sọc màu stripe trên nền kem), mỗi màu vẽ một lần; repeat riêng cho mặt khăn và mép buông.
const ginghamCache = {};
function ginghamMat(stripe, rx, ry) {
  if (!ginghamCache[stripe]) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = stripe; g.fillRect(0, 0, 32, 64); g.fillRect(0, 0, 64, 32);
    ginghamCache[stripe] = canvas;
  }
  const tex = new THREE.CanvasTexture(ginghamCache[stripe]);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(rx, ry);
  return mat('#ffffff', { map: tex });
}
// Giỏ mây (gốc = đáy giỏ): thân + hai đai + nắp + quai cong.
function picnicBasket(body, band, lid) {
  return group(at(rbox(.3, .16, .2, .03, body), 0, .08, 0), ...[.05, .11].map(y => at(box(.31, .02, .21, band), 0, y, 0)),
    at(rbox(.32, .03, .22, .015, lid), 0, .175, 0), at(mesh(new THREE.TorusGeometry(.1, .012, 6, 16, Math.PI), band), 0, .18, 0));
}
// Mặt bàn cao .74, khăn dày 2 cm phủ trên (mặt khăn .755); mép khăn buông trước / sau quay quanh mép bàn, gió hất ra ngoài.
// stripe: màu sọc khăn; ruffle: màu diềm bèo dưới mép khăn (tuỳ chọn).
function picnicTable({ frame, legs = frame, top, stripe, ruffle, extras = [] }) {
  const L = Math.hypot(.7, .3), tilt = Math.atan2(.3, .7);
  const aFrames = [-1, 1].flatMap(x => [
    ...[-1, 1].map(s => { const leg = at(box(.06, L, .08, legs), x * .4, .35 + .016, s * .3); leg.rotation.x = -s * tilt; return leg; }), // chân chữ A: chân chạm đất
    at(box(.05, .05, 1.14, legs), x * .4, .3825, 0)]); // xà đỡ ghế
  const benches = [-1, 1].map(s => at(rbox(1.04, .045, .24, .02, frame), 0, .4275, s * .45));
  const flaps = [-1, 1].map(s => {
    const flap = group(at(box(1.06, .17, .012, ginghamMat(stripe, 4, 1)), 0, -.085, 0),
      ...(ruffle ? [...Array(11)].map((_, k) => at(ball(.022, ruffle), -.5 + k * .1, -.17, 0)) : []));
    flap.position.set(0, .75, s * .356); flap.userData.side = s;
    return flap;
  });
  const node = group(at(rbox(1.0, .04, .62, .02, top), 0, .72, 0), at(box(1.06, .02, .7, ginghamMat(stripe, 4, 3)), 0, .745, 0),
    ...aFrames, ...benches, ...flaps, ...extras);
  node.userData.seat = [.12, .755, -.1]; // mèo nhảy lên mặt bàn (chỗ trống giữa giỏ và đĩa)
  node.userData.top = .755;
  node.userData.update = t => {
    const w = windAt(t);
    // mép buông bị gió hất ra ngoài (trước: +z, sau: -z), không bao giờ quặt vào gầm bàn
    flaps.forEach((f, i) => { f.rotation.x = -f.userData.side * (.05 + .3 * w * (.6 + .4 * Math.sin(t * 3.3 + i * 1.7))); });
  };
  node.userData.update(0);
  return node;
}

// Texture nước chảy: nền + các vệt gợn sóng (trượt offset để chảy); petals: thêm cánh hoa hồng trôi cùng dòng.
function flowTexture([base, a, b], petals = false) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 64);
  for (let k = 0; k < 14; k++) { g.strokeStyle = k % 2 ? a : b; g.lineWidth = 2; g.beginPath(); const y = (k * 37) % 64; g.moveTo((k * 23) % 128, y); g.bezierCurveTo(30 + k * 5, y + 4, 60, y - 4, 90 + (k * 7) % 30, y + 2); g.stroke(); }
  if (petals) for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? '#ffb3c8' : '#ffe0e9'; g.beginPath(); g.ellipse((k * 41) % 128, (k * 23 + 9) % 64, 3.5, 2, k, 0, TAU); g.fill(); }
  const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(1.2, 1.2);
  return tex;
}

// Suối: mặt nước + lòng suối là tấm phẳng (cách nhau 15 mm), nước chảy bằng cách trượt texture.
// Gỗ: đá xám + lau + khúc gỗ nằm bờ sau, lá xanh trôi. Hồng (pink): đá hồng / tím nhạt, bụi hoa anh đào, cánh hoa trôi trên nước, bông anh đào trôi.
function streamBase(pink) {
  const tick = ticker();
  const outline = new THREE.Shape();
  const L = 1.05, Wd = .36;
  outline.moveTo(-L, -Wd);
  outline.bezierCurveTo(-.3, -Wd - .12, .3, -Wd + .1, L, -Wd + .02);
  outline.absarc(L, 0, Wd - .02, -Math.PI / 2, Math.PI / 2, false);
  outline.bezierCurveTo(.3, Wd + .1, -.3, Wd - .1, -L, Wd);
  outline.absarc(-L, 0, Wd, Math.PI / 2, Math.PI * 1.5, false);
  const flow = flowTexture(pink ? ['#86cfe3', '#d6f1fa', '#a8def0'] : ['#6fc3e0', '#b8e6f5', '#8fd4ec'], pink);
  const flatShape = (color, y, extra = {}) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(outline, 24), new THREE.MeshBasicMaterial({ color, userData: { nightDim: true }, ...extra })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m; };
  const bed = flatShape(pink ? '#5aa3b5' : '#3f8f9e', .012), water = flatShape('#ffffff', .028, { map: flow, transparent: true, opacity: .9 });
  // Đá viền hai bờ + lau (Hồng: bụi hoa anh đào).
  let seed = 3; const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + seed / 2147483647 * (b - a); };
  const STONES = pink ? ['#ffc2d4', '#ffe0e9', '#e6d4ff'] : ['#c8c2b8', '#c8c2b8', '#b5aea3'];
  const banks = [];
  for (let k = 0; k < 16; k++) {
    const u = -1.1 + k / 15 * 2.2, side = k % 2 ? 1 : -1, z = side * (Wd + .06 + rnd(0, .06));
    const s = squash(rock(rnd(.06, .1), STONES[k % 3], k * 3.7 + 11), 1.3, .7, 1); s.position.set(u, .01, z); s.rotation.y = k * 1.9; banks.push(s);
  }
  if (pink) {
    for (let k = 0; k < 3; k++) {
      const x = .62 + k * .18, z = -Wd - .14 + rnd(-.04, .04), h = rnd(.22, .32);
      banks.push(at(cyl(.012, .018, h, '#9a6a45', 6), x, h / 2, z), ...[[0, 0], [.05, .03], [-.05, .02], [.02, -.05]].map(([dx, dz], i) => at(ball(.045, i % 2 ? '#ffb3c8' : '#ffe0e9'), x + dx, h + (i ? -.02 : .02), z + dz)));
    }
  } else {
    for (let k = 0; k < 6; k++) { const h = rnd(.25, .4); const r = at(cone(.02, h, k % 2 ? '#5fa83e' : '#7cc256', 6), .75 + rnd(-.1, .15), h / 2, -Wd - .12 + rnd(-.05, .05)); r.rotation.z = rnd(-.2, .2); banks.push(r); }
    // Khúc gỗ nằm bờ sau, hai đầu cắt lộ vân sáng (đĩa nhô 6 mm khỏi mặt cắt).
    banks.push(at(cyl(.07, .07, .5, '#9a6a45', 12), -.55, .055, -Wd - .22).rotateZ(Math.PI / 2),
      ...[-1, 1].map(s => at(cyl(.06, .06, .012, '#e9c58f', 12), -.55 + s * .253, .055, -Wd - .22).rotateZ(Math.PI / 2)));
  }
  // Vật trôi theo dòng (mèo rình khều): lá xanh / bông anh đào.
  const leaf = pink ? mergeStatic(group(...[...Array(5)].map((_, k) => { const a = k / 5 * TAU; return squash(at(ball(.03, '#ffc2d4'), Math.cos(a) * .03, 0, Math.sin(a) * .03), 1, .35, 1); }), at(ball(.015, '#f2c14e'), 0, .008, 0)))
    : squash(ball(.05, '#7fc45a'), 1.4, .3, .9);
  leaf.position.y = .045;
  const node = group(bed, water, mergeStatic(group(...banks)), leaf); // đá + lau bờ suối tĩnh: gộp; lá trôi cử động riêng
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
// Lối đá bậc từ chân đồi (phía cổng) lên đỉnh, vài tảng đá + cỏ trên sườn, hoa dại
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
  return decor;
}
