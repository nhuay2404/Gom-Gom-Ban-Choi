// Bộ Vườn Nhật (kiểu thứ 4 của 10 chỗ trong vườn, bán bằng GEM — economy.mjs DECO): đồ hard currency nên chi tiết hơn đồ xu,
// mỗi món có một chuyển động / điểm nhấn riêng (cẩm tú cầu rạp khi mèo giẫm, tre rung, đèn đá sáng, cá koi bơi dưới cầu đỏ,
// ống tre chảy nước, anh đào đung đưa). Giữ khuôn khổ + điểm neo cho mèo của món gốc (garden.mjs, cat-brain.mjs useFurniture):
//   stump: mặt trên .46 · catnip: userData.leaves · sandbox: mặt cát .18 · cathouse: cửa +z, nóc 1.2 · pond: userData.fish
//   hammock: chỗ nằm .42 treo con lắc (swing / ride) · birdbath: userData.bird, mặt bát .92 · bench: chỗ nằm .5
// Mặt trước quay về +z cục bộ. Cánh hoa / lá lặp nhiều: InstancedMesh (CLAUDE.md Hiệu năng).
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from '../render/mesh-detail.mjs';
import { TOON, toonMat, markOutlineUnit } from '../render/toon.mjs';
import { rock, bendOnWalk, ropeBetween, pendulum, waterMat, waterTick, waterDisc, flowTexture, flowMat, lumpyPuff } from './garden.mjs';
import { GARDEN2_BUILD, windAt, streamBase, birdhouseRig, BIRD_POST_H } from './garden-expanded.mjs';

const TAU = Math.PI * 2;
const mat = (color, extra = {}) => TOON ? toonMat({ color, ...extra })
  : new THREE.MeshPhysicalMaterial({ color, roughness: .9, metalness: 0, specularIntensity: .55, ...extra });
function mesh(geometry, material) {
  const node = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : mat(material));
  node.castShadow = node.receiveShadow = true;
  return node;
}
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, 3, r), color);
const box = (w, h, d, color) => mesh(new THREE.BoxGeometry(w, h, d), color);
const cyl = (top, bottom, h, color, seg = radialSegments(Math.max(top, bottom))) => mesh(new THREE.CylinderGeometry(top, bottom, h, seg), color);
const ball = (r, color) => mesh(new THREE.SphereGeometry(r, ...sphereSegments(r)), color);
const cone = (r, h, color, seg = radialSegments(r)) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const seeded = seed => (lo = 0, hi = 1) => { seed = (seed * 16807) % 2147483647; return lo + (seed / 2147483647) * (hi - lo); };

// Nhiều bản một hình: items = { p, s (số | [x, y, z]), r ([x, y, z]), c (màu riêng) }. Không viền (hàng trăm khối nhỏ).
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
function instances(geometry, color, items, extra = {}) {
  const inst = new THREE.InstancedMesh(geometry, mat(items.some(it => it.c) ? '#ffffff' : color, extra), items.length);
  items.forEach(({ p, s = 1, r = [0, 0, 0], c }, i) => {
    inst.setMatrixAt(i, M4.compose(V.set(...p), Q.setFromEuler(E.set(...r)), Array.isArray(s) ? S.set(...s) : S.setScalar(s)));
    if (c) inst.setColorAt(i, C.set(c));
  });
  inst.castShadow = inst.receiveShadow = true;
  inst.userData.noOutline = true;
  return inst;
}
// Góc Euler xoay trục `from` của hình về hướng `dir` (lá chĩa ra ngoài, cánh hoa ngửa theo mặt tán).
const AIM_Q = new THREE.Quaternion(), AIM_E = new THREE.Euler();
const aim = (from, dir) => { AIM_E.setFromQuaternion(AIM_Q.setFromUnitVectors(from, dir.clone().normalize())); return [AIM_E.x, AIM_E.y, AIM_E.z]; };
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1), TWO_SIDED = { side: THREE.DoubleSide };

// Màu chung của bộ
const VERMILION = '#d9452f', VERMILION_DARK = '#a8321f', STONE = '#bdb6a6', STONE_DARK = '#9d968a', MOSS = '#7fa34a', MOSS_DARK = '#5f8a36',
  HINOKI = '#e8cf9f', HINOKI_DARK = '#c9a874', CHARCOAL = '#3a3330', ROOF_TILE = '#4f5b66', PLASTER = '#f6efe0', BAMBOO = '#a9c25a', BAMBOO_DARK = '#86a03e';

// Hình hoa 5 cánh dẹt (anh đào): mỗi bông một lưới nhỏ ~70 tam giác.
const blossomGeo = (() => {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 50; i++) {
    const a = i / 50 * TAU, r = .5 + .5 * Math.abs(Math.cos(a * 2.5)) ** .6; // 5 thuỳ tròn
    shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2);
  g.scale(.05, 1, .05);
  return g;
})();
const leafGeo = (() => { const g = new THREE.SphereGeometry(.05, 7, 5); g.scale(.32, .12, 1); return g; })(); // lá thuôn, dài theo z

// Tấm vẽ canvas (biểu tượng tomoe trên mặt trống, sỏi cào…)
function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const JAPAN_BUILD = {
  // ---------- Luống cẩm tú cầu (thay bồn hoa): mặt đất đi được, 6 bụi xanh tím hồng rạp khi mèo giẫm; viền sỏi suối ----------
  'flowers-jp'() {
    const rnd = seeded(91);
    const bed = group(at(cyl(.72, .76, .035, '#5e4430', 48), 0, .0175, 0));
    const pebbles = group();
    for (let a = 0; a < TAU - .1; a += .21) {
      const p = rock(rnd(.05, .07), rnd() < .5 ? STONE : '#d6cfc2', rnd(0, 999));
      p.scale.y = .55; p.position.set(Math.cos(a) * .72, .012, Math.sin(a) * .72); p.rotation.y = rnd(0, TAU);
      pebbles.add(p);
    }
    bed.add(mergeStatic(pebbles));
    const HUES = ['#7f9cf0', '#a58cf0', '#f08cb8', '#8fb8f5', '#c49cf0', '#f0a0c8', '#9f8ff5'];
    const clumps = [[0, 0], ...[0, 1, 2, 3, 4, 5].map(i => [Math.cos(i / 6 * TAU + .3) * .44, Math.sin(i / 6 * TAU + .3) * .44])].map(([x, z], k) => {
      const tint = new THREE.Color(HUES[k % HUES.length]), leaves = [], heads = [], florets = [];
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU + rnd(-.2, .2);
        leaves.push({ p: [Math.cos(a) * .12, .06 + rnd(0, .05), Math.sin(a) * .12], r: aim(FORWARD, new THREE.Vector3(Math.cos(a), rnd(-.1, .25), Math.sin(a))), s: rnd(1.6, 2.1), c: rnd() < .5 ? '#5f8f45' : '#4f7f3a' });
      }
      const count = k ? 3 : 4;
      for (let h = 0; h < count; h++) {
        const a = h / count * TAU + k, hx = Math.cos(a) * .07, hz = Math.sin(a) * .07, hy = .2 + rnd(0, .07), hr = rnd(.075, .09);
        heads.push({ p: [hx, hy, hz], s: hr * .9, c: '#' + tint.clone().multiplyScalar(.82).getHexString() });
        for (let i = 0; i < 20; i++) { // bông nhỏ 4 cánh rải xoắn ốc trên nửa trên chùm
          const y = 1 - (i + .5) / 20 * 1.5, r = Math.sqrt(Math.max(0, 1 - y * y)), b = i * 2.39996;
          const f = tint.clone().offsetHSL(rnd(-.02, .02), 0, rnd(-.06, .08));
          florets.push({ p: [hx + Math.cos(b) * r * hr, hy + y * hr, hz + Math.sin(b) * r * hr], r: aim(UP, new THREE.Vector3(Math.cos(b) * r, y, Math.sin(b) * r)), s: rnd(.5, .65), c: '#' + f.getHexString() });
        }
      }
      const clump = group(instances(leafGeo, '#5f8f45', leaves), instances(new THREE.SphereGeometry(1, 10, 8), '#fff', heads), instances(blossomGeo, '#fff', florets, TWO_SIDED),
        at(cyl(.012, .016, .18, '#4f7f3a', 6), 0, .09, 0));
      clump.position.set(x, .035, z);
      bed.add(clump);
      return clump;
    });
    return bendOnWalk(bed, clumps, .04);
  },

  // ---------- Trống taiko (thay gốc cây): mèo cào thân trống rồi nhảy lên ngồi mặt trống (.46) ----------
  'stump-jp'() {
    const R = .3, BODY_Y = .1, H = .34, TOP = BODY_Y + H + .02; // mặt da 0.46
    // Thân trống phình giữa: trụ kín hai đầu, đẩy bán kính theo độ cao (giữ pháp tuyến ngang của trụ trơn -> nấc toon gọn)
    const bodyGeo = new THREE.CylinderGeometry(R, R, H, 40, 12), pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 1 + Math.sin((pos.getY(i) / H + .5) * Math.PI) * .045 / R;
      pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
    }
    const body = at(mesh(bodyGeo, '#a8452f'), 0, BODY_Y + H / 2, 0);
    const head = y => at(cyl(R + .012, R + .012, .02, '#efe0bf', 40), 0, y, 0);
    const tomoe = canvasTexture(256, (g, n) => { // mitsudomoe: 3 dấu phẩy xoáy quanh tâm
      g.fillStyle = '#efe0bf'; g.fillRect(0, 0, n, n);
      g.translate(n / 2, n / 2);
      for (let i = 0; i < 3; i++) {
        g.rotate(TAU / 3); g.fillStyle = '#c0392b'; g.beginPath();
        g.arc(0, -34, 26, 0, TAU); g.fill();
        g.beginPath(); g.arc(0, -10, 52, -Math.PI / 2, Math.PI * .1); g.arc(0, -34, 26, Math.PI * .1, -Math.PI / 2, true); g.fill();
      }
    });
    const emblem = at(mesh(new THREE.CircleGeometry(R * .78, 40).rotateX(-Math.PI / 2), mat('#ffffff', { map: tomoe })), 0, TOP + .006, 0);
    emblem.userData.noOutline = true;
    const tacks = rim => [...Array(26)].map((_, i) => ({ p: [Math.cos(i / 26 * TAU) * (R + .01), rim, Math.sin(i / 26 * TAU) * (R + .01)], s: 1 }));
    const nails = instances(new THREE.SphereGeometry(.012, 6, 4), '#c9a24a', [...tacks(TOP - .03), ...tacks(BODY_Y + .03)]);
    // Dây thừng đỏ quấn ngang thân + hai tua rua buông ở mặt trước
    const rope = at(mesh(new THREE.TorusGeometry(R + .052, .014, 8, 48), '#c0392b'), 0, BODY_Y + H / 2, 0).rotateX(Math.PI / 2);
    const tassel = x => group(at(ball(.025, '#c0392b'), x, BODY_Y + H / 2 - .02, R + .06), at(cone(.03, .1, '#d9452f', 10), x, BODY_Y + H / 2 - .09, R + .06).rotateX(Math.PI));
    // Giá gỗ thấp 4 chân + đôi dùi gỗ dựa thành trống
    const stand = group(at(rbox(.72, .04, .72, .02, CHARCOAL), 0, .08, 0),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => at(rbox(.07, .08, .07, .02, CHARCOAL), x * .3, .04, z * .3)));
    const stick = x => at(cyl(.014, .018, .42, HINOKI_DARK, 8), x, .27, R + .09).rotateZ(x > 0 ? -.18 : .18).rotateX(-.12);
    return group(stand, body, head(BODY_Y), head(TOP - .01), emblem, nails, rope, tassel(-.08), tassel(.08), stick(.18), stick(.24));
  },

  // ---------- Bụi tre (thay catnip): gò đất viền đá, 7 thân tre có đốt, lá thuôn; măng non dưới gốc. Mèo gặm lá -> cả bụi rung ----------
  'catnip-jp'() {
    const rnd = seeded(37);
    const mound = group(at(cyl(.3, .36, .06, '#6e4a33', 24), 0, .03, 0));
    for (let a = 0; a < TAU; a += .5) { const s = rock(rnd(.06, .08), rnd() < .5 ? STONE : STONE_DARK, rnd(0, 999)); s.scale.y = .6; s.position.set(Math.cos(a) * .35, .02, Math.sin(a) * .35); mound.add(s); }
    const plant = group(), nodes = [], leaves = [];
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + rnd(-.3, .3), d = i ? rnd(.08, .2) : 0, h = rnd(.85, 1.3), r = rnd(.026, .036);
      const culm = group(at(cyl(r, r * 1.1, h, i % 2 ? BAMBOO : BAMBOO_DARK, 10), 0, h / 2, 0));
      culm.position.set(Math.cos(a) * d, .05, Math.sin(a) * d);
      culm.rotation.set(Math.sin(a) * d * .9, 0, -Math.cos(a) * d * .9);
      // Đốt tre: vòng nhỏ trên thân, theo đúng độ nghiêng của thân
      for (let y = .16; y < h; y += rnd(.15, .2)) { const p = new THREE.Vector3(0, y, 0).applyEuler(culm.rotation).add(culm.position); nodes.push({ p: [p.x, p.y, p.z], r: [culm.rotation.x, 0, culm.rotation.z], s: r * 1.25 }); }
      plant.add(culm);
      // Lá: chùm 3–4 lá thuôn rủ xuống ở các đốt nửa trên, chĩa ra ngoài bụi
      for (let y = h * .45; y < h; y += .12) {
        const b = a + rnd(-1.2, 1.2), tip = new THREE.Vector3().copy(culm.position).add(new THREE.Vector3(0, y, 0).applyEuler(culm.rotation));
        for (let k = 0; k < 4; k++) {
          const c = b + (k - 1.5) * .45;
          leaves.push({ p: [tip.x + Math.sin(c) * .07, tip.y - .02, tip.z + Math.cos(c) * .07], r: aim(FORWARD, new THREE.Vector3(Math.sin(c), -rnd(.35, .7), Math.cos(c))), s: rnd(1.6, 2.2), c: rnd() < .5 ? '#7fb84a' : '#9fcf5f' });
        }
      }
    }
    plant.add(instances(new THREE.TorusGeometry(1, .22, 5, 12).rotateX(Math.PI / 2), '#6f8f30', nodes));
    plant.add(instances(leafGeo, '#7fb84a', leaves));
    // Măng non (takenoko) chồi lên ở gốc
    const shoot = (x, z, h) => group(at(cone(.04, h, '#c9955e', 10), x, .06 + h / 2, z), at(cone(.03, h * .7, '#a8743f', 10), x, .06 + h * .55, z).rotateY(.6));
    mound.add(shoot(.2, .14, .14), shoot(-.18, .18, .1));
    const node = group(mergeStatic(mound), plant);
    node.userData.leaves = plant; // mèo gặm: cả bụi tre rung (room-cats.mjs wiggle)
    node.userData.update = t => { plant.rotation.z = Math.sin(t * 1.3) * .025; plant.rotation.x = Math.sin(t * .9 + 1) * .02; };
    return node;
  },

  // ---------- Đèn đá Kasuga (thay đèn lồng): đế, trụ, bệ sáu cạnh, hộp lửa có ô sáng, mái cong vểnh góc phủ rêu, ngọc đỉnh ----------
  'lantern-jp'() {
    // Khối sáu cạnh xoay 30° để một MẶT (không phải cạnh) quay về +z
    const hex = (r, h, color, rTop = r) => { const m = cyl(rTop, r, h, color, 6); m.rotation.y = Math.PI / 6; return m; };
    const glass = mat('#fff0b8', { emissive: '#ffb44a', emissiveIntensity: 1 });
    const fire = group(hex(.15, .2, STONE_DARK));
    // Ô sáng hình vuông trên 2 mặt trước / sau + ô tròn mặt trăng hai bên, đặt nổi ra ngoài mặt đá 6 mm
    const apothem = .15 * Math.cos(Math.PI / 6);
    const pane = (geometry, a) => { const w = at(mesh(geometry, glass), Math.sin(a) * (apothem + .006), 0, Math.cos(a) * (apothem + .006)); w.rotation.y = a; fire.add(w); };
    [0, Math.PI].forEach(a => pane(new THREE.PlaneGeometry(.1, .1), a));
    [TAU / 3, -TAU / 6].forEach(a => pane(new THREE.CircleGeometry(.04, 20), a));
    fire.position.y = .86;
    const light = new THREE.PointLight('#ffc070', 4, 5, 1.6); light.position.y = .86;
    // Mái: chóp sáu cạnh dẹt + 6 móc cuộn (warabi) vểnh lên ở góc, chân móc cắm vào mép mái (không lơ lửng)
    const roof = group(at(hex(.36, .09, STONE, .08), 0, 0, 0), at(hex(.09, .1, STONE, .05), 0, .09, 0));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, curl = at(mesh(new THREE.TorusGeometry(.03, .014, 6, 12, Math.PI * 1.3), STONE), Math.sin(a) * .34, -.02, Math.cos(a) * .34);
      curl.rotation.y = a + Math.PI / 2; roof.add(curl);
    }
    const rnd = seeded(5);
    // rêu nằm đúng mặt dốc mái: chóp từ bán kính .36 (y -.045) lên .08 (y .045), rêu ở bán kính .2
    for (let i = 0; i < 5; i++) { const m = at(ball(rnd(.04, .06), i % 2 ? MOSS : MOSS_DARK), Math.cos(i * 1.3) * .2, -.045 + (.36 - .2) / .28 * .09, Math.sin(i * 1.3) * .2); m.scale.y = .35; roof.add(m); }
    roof.position.y = 1.0;
    const jewel = group(at(ball(.055, STONE), 0, 0, 0), at(cone(.03, .06, STONE, 10), 0, .06, 0));
    jewel.position.y = 1.2;
    const base = group(at(hex(.24, .08, STONE_DARK), 0, .04, 0), at(hex(.17, .06, STONE, .2), 0, .11, 0), at(cyl(.06, .07, .46, STONE, 12), 0, .37, 0),
      at(hex(.2, .08, STONE, .16), 0, .64, 0), at(hex(.18, .06, STONE_DARK), 0, .72, 0));
    for (let i = 0; i < 3; i++) { const m = at(ball(.05, MOSS), Math.cos(i * 2.1) * .2, .08, Math.sin(i * 2.1) * .2); m.scale.y = .4; base.add(m); }
    return group(base, fire, light, roof, jewel);
  },

  // ---------- Vườn đá Zen (thay hộp cát): khung gỗ cháy, sỏi trắng cào vân sóng vòng quanh 3 tảng đá rêu; cào gỗ dựa thành ----------
  'sandbox-jp'() {
    const ROCKS = [[-.27, -.26, .12, 11], [.29, -.22, .09, 23], [.26, .3, .07, 41]]; // [x, z, cỡ, seed] — tâm để trống cho mèo đào
    const raked = canvasTexture(512, (g, n) => {
      g.fillStyle = '#ece7dc'; g.fillRect(0, 0, n, n);
      let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 5000; i++) { const v = r(); g.fillStyle = v < .4 ? '#d6d0c2' : v < .8 ? '#fbf8f1' : '#c4bdae'; g.fillRect(r() * n, r() * n, 1.5, 1.5); }
      const toPx = v => (v / .9 + .5) * n, groove = (draw) => { g.strokeStyle = '#cfc8b8'; g.lineWidth = 4; draw(); g.strokeStyle = '#fffdf8'; g.lineWidth = 1.6; g.save(); g.translate(-2, -2); draw(); g.restore(); };
      // Sóng song song khắp mặt, trừ vùng quanh đá (vẽ vòng tròn đồng tâm ở đó)
      g.save(); g.beginPath(); g.rect(0, 0, n, n); ROCKS.forEach(([x, z, s]) => { g.moveTo(toPx(x) + s * 900, toPx(z)); g.arc(toPx(x), toPx(z), s * 900, 0, TAU, true); }); g.clip('evenodd');
      for (let y = 10; y < n; y += 20) groove(() => { g.beginPath(); for (let x = 0; x <= n; x += 8) { const yy = y + Math.sin(x / n * TAU * 2) * 6; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); });
      g.restore();
      ROCKS.forEach(([x, z, s]) => { for (let k = 1; k <= 4; k++) groove(() => { g.beginPath(); g.arc(toPx(x), toPx(z), s * 300 + k * 18, 0, TAU); g.stroke(); }); });
    });
    const surface = at(mesh(new THREE.PlaneGeometry(.9, .9).rotateX(-Math.PI / 2), mat('#ffffff', { map: raked })), 0, .18, 0);
    surface.castShadow = false; surface.userData.noOutline = true;
    const wood = CHARCOAL, frame = group(at(box(1.05, .2, .08, wood), 0, .1, .49), at(box(1.05, .2, .08, wood), 0, .1, -.49),
      at(box(.08, .2, .9, wood), .49, .1, 0), at(box(.08, .2, .9, wood), -.49, .1, 0), at(box(.9, .14, .9, '#d6d0c2'), 0, .1, 0),
      at(box(1.09, .025, .1, '#4a403b'), 0, .2125, .49), at(box(1.09, .025, .1, '#4a403b'), 0, .2125, -.49), at(box(.1, .025, .9, '#4a403b'), .49, .2125, 0), at(box(.1, .025, .9, '#4a403b'), -.49, .2125, 0));
    const rocks = ROCKS.map(([x, z, s, seed]) => {
      const r = rock(s, seed % 2 ? '#8f8a80' : '#a39b8f', seed); r.scale.y = 1.2; r.position.set(x, .18 + s * .4, z);
      const moss = at(ball(s * .7, MOSS), x - s * .3, .18 + s * .1, z + s * .5); moss.scale.y = .35;
      return group(r, moss);
    });
    // Cào gỗ dựa vào thành trước-phải
    // Cào gỗ nằm trên mặt sỏi, trong khung: cán dọc x, đầu cào ngang z, răng cào cắm nhẹ xuống sỏi
    const rake = group(at(cyl(.012, .012, .6, HINOKI_DARK, 8), 0, .013, 0).rotateZ(Math.PI / 2), at(box(.03, .025, .24, HINOKI_DARK), .31, .013, 0),
      ...[-.09, -.03, .03, .09].map(z => at(box(.03, .012, .014, HINOKI_DARK), .335, .006, z)));
    rake.position.set(.05, .18, .26); rake.rotation.y = .5;
    return group(frame, surface, ...rocks, rake);
  },

  // ---------- Nhà mèo kiểu đền (thay nhà mèo): bệ đá, cột son, vách trắng, mái ngói cong vểnh, rèm noren, đèn lồng giấy ----------
  'cathouse-jp'() {
    const W = 1.06, D = .96, BASE = .08, WALL_H = .62, TOP = BASE + WALL_H;
    const plinth = group(at(rbox(W + .16, BASE, D + .14, .03, STONE), 0, BASE / 2, 0), at(box(.4, .04, .14, STONE_DARK), 0, .02, D / 2 + .13));
    const walls = at(box(W - .04, WALL_H, D - .04, PLASTER), 0, BASE + WALL_H / 2, 0);
    const posts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => at(box(.08, WALL_H + .04, .08, VERMILION), x * (W / 2 - .02), BASE + WALL_H / 2 + .02, z * (D / 2 - .02)));
    const beams = [1, -1].map(z => at(box(W + .02, .06, .06, VERMILION_DARK), 0, TOP - .01, z * (D / 2 - .02)));
    const sideBeams = [1, -1].map(x => at(box(.06, .06, D + .02, VERMILION_DARK), x * (W / 2 - .02), TOP - .01, 0));
    // Cửa vào: ô tối (cách vách 6 mm) + khung gỗ + rèm noren chàm hai mảnh in dấu chân trắng
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.42, .4), new THREE.MeshBasicMaterial({ color: '#3a2418', userData: { nightDim: true } }));
    door.position.set(0, BASE + .2, D / 2 - .02 + .006);
    const doorFrame = group(at(box(.05, .44, .03, CHARCOAL), -.235, BASE + .22, D / 2), at(box(.05, .44, .03, CHARCOAL), .235, BASE + .22, D / 2), at(box(.52, .05, .03, CHARCOAL), 0, BASE + .44, D / 2));
    const noren = group(), paw = (x) => { const p = at(ball(.022, '#fffaf0'), x, BASE + .36, D / 2 + .042); p.scale.z = .3; return p; };
    [-.105, .105].forEach(x => noren.add(at(rbox(.2, .14, .02, .008, '#3f5a8a'), x, BASE + .37, D / 2 + .03), paw(x)));
    noren.add(at(cyl(.01, .01, .5, HINOKI_DARK, 6), 0, BASE + .445, D / 2 + .03).rotateZ(Math.PI / 2));
    // Cửa sổ tròn shoji hai bên hông
    const windows = [1, -1].map(s => {
      const pane = at(mesh(new THREE.CircleGeometry(.12, 28), '#fff6dc'), 0, 0, 0);
      const ring = mesh(new THREE.TorusGeometry(.125, .02, 8, 28), CHARCOAL);
      const win = group(pane, ring, at(box(.24, .012, .012, CHARCOAL), 0, 0, .012), at(box(.012, .24, .012, CHARCOAL), 0, 0, .012), at(box(.012, .24, .012, CHARCOAL), .07, 0, .012), at(box(.012, .24, .012, CHARCOAL), -.07, 0, .012));
      win.position.set(s * (W / 2 - .02 + .008), BASE + .36, 0); win.rotation.y = s * Math.PI / 2;
      return win;
    });
    // Mái: tiết diện cong lõm (hai mái dốc) đùn theo chiều sâu, mép vểnh lên; nóc ở y 1.2 (mèo ngồi canh vườn)
    const RIDGE = 1.2, HALF_W = W / 2 + .2, T = .07, eave = TOP + .02;
    const curveY = u => eave + (RIDGE - .06 - eave) * (1 - u) ** 1.7 + .05 * u ** 6; // u: 0 ở nóc -> 1 ở mép; vểnh nhẹ ở mép
    const shape = new THREE.Shape(), N = 16;
    // Vòng kín: mặt trên từ mép trái -> nóc -> mép phải, rồi mặt dưới quay ngược về
    for (let i = N; i >= 0; i--) { const u = i / N; shape[i === N ? 'moveTo' : 'lineTo'](-u * HALF_W, curveY(u)); }
    for (let i = 1; i <= N; i++) { const u = i / N; shape.lineTo(u * HALF_W, curveY(u)); }
    for (let i = N; i >= 0; i--) { const u = i / N; shape.lineTo(u * HALF_W, curveY(u) - T); }
    for (let i = 1; i <= N; i++) { const u = i / N; shape.lineTo(-u * HALF_W, curveY(u) - T); }
    const roofD = D + .3, roof = mesh(new THREE.ExtrudeGeometry(shape, { depth: roofD, bevelEnabled: false, curveSegments: 2 }), ROOF_TILE);
    roof.position.z = -roofD / 2;
    // Gân ngói chạy dọc dốc mái (ống mảnh theo đường cong), mỗi bên 9 gân
    const ribs = group();
    for (const s of [1, -1]) for (let k = 0; k < 9; k++) {
      const z = -roofD / 2 + .06 + k * (roofD - .12) / 8, pts = [...Array(9)].map((_, i) => new THREE.Vector3(s * i / 8 * HALF_W, curveY(i / 8) + .012, z));
      ribs.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .016, 5), '#3f4a54'));
    }
    // Đầu hồi gỗ dưới mái (lấp tam giác giữa vách và mái) ở trước / sau
    const gableShape = new THREE.Shape([new THREE.Vector2(-W / 2 + .04, 0), new THREE.Vector2(W / 2 - .04, 0), new THREE.Vector2(0, RIDGE - .14 - TOP)]);
    const gable = z => at(mesh(new THREE.ExtrudeGeometry(gableShape, { depth: .04, bevelEnabled: false }), HINOKI), 0, TOP + .02, z - .02);
    const ridge = at(rbox(.12, .08, roofD + .04, .03, '#38424b'), 0, RIDGE - .04, 0);
    const finial = z => group(at(ball(.05, '#e89a3c'), 0, RIDGE + .02, z), at(cone(.035, .09, '#e89a3c', 10), 0, RIDGE + .08, z * 1.04).rotateX(z > 0 ? .5 : -.5)); // cá shachi ở hai đầu nóc
    // Đèn lồng giấy đỏ treo mép mái trước (không phát sáng: không phải nguồn sáng)
    const chochin = group(at(cyl(.005, .005, .08, CHARCOAL, 6), 0, -.04, 0), at(cyl(.035, .035, .015, CHARCOAL, 12), 0, -.085, 0),
      (() => { const b = at(ball(.07, '#e5483a'), 0, -.16, 0); b.scale.y = 1.25; return b; })(), at(cyl(.035, .035, .015, CHARCOAL, 12), 0, -.24, 0));
    chochin.position.set(.36, eave - .02, D / 2 + .1);
    const cushion = at(rbox(.42, .05, .42, .02, '#8f6fc4'), 0, BASE + .025, .12);
    return group(plinth, walls, ...posts, ...beams, ...sideBeams, door, doorFrame, noren, ...windows, roof, mergeStatic(ribs), gable(D / 2 - .02), gable(-D / 2 + .06), ridge, finial(roofD / 2), finial(-roofD / 2), chochin, cushion);
  },

  // ---------- Hồ cá koi + cầu cong đỏ (thay hồ cá): mép đá lượn, sen hồng, 3 koi vây đuôi; cầu taiko bắc ngang ----------
  'pond-jp'() {
    const rnd = seeded(13);
    const edge = a => .78 * (1 + .1 * Math.sin(2 * a + .4) + .05 * Math.sin(3 * a + 2.2));
    const blob = (scale, n = 72) => { const sh = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = edge(a) * scale; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, -Math.sin(a) * r); } return sh; };
    const flat = (geometry, material, y) => { const m = mesh(geometry, material); m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; m.userData.noOutline = true; return m; };
    const bed = flat(new THREE.ShapeGeometry(blob(1.02)), mat('#2f6f7e'), .012);
    // Nước: xoay hình nằm ngang NGAY trong lưới (không xoay mesh): shader gợn của waterMat đọc position.xz cục bộ,
    // xoay bằng mesh thì xz của lưới là (x, 0) -> gợn thành sọc dọc loang lổ.
    const water = at(mesh(new THREE.ShapeGeometry(blob(.94)).rotateX(-Math.PI / 2), waterMat('#5fb3cf')), 0, .04, 0);
    water.castShadow = false; water.userData.noOutline = true;
    const stones = group();
    for (let a = 0; a < TAU - .1;) {
      const size = rnd(.09, .15), r = edge(a) + size * .55;
      const s = rock(size, [STONE, STONE_DARK, '#d6cfc2', '#8f8a80'][Math.floor(rnd(0, 4))], rnd(0, 999));
      s.scale.set(rnd(1.1, 1.4), rnd(.55, .85), rnd(.9, 1.15)); s.position.set(Math.cos(a) * r, size * .2, Math.sin(a) * r); s.rotation.y = rnd(0, TAU);
      stones.add(s);
      if (rnd() < .3) { const m = at(ball(size * .6, MOSS), Math.cos(a) * r, size * .45, Math.sin(a) * r); m.scale.y = .35; stones.add(m); }
      a += size * 1.25 / edge(a);
    }
    const lotus = (x, z, r, bloom) => {
      const leaf = flat(new THREE.CircleGeometry(r, 22, .3, TAU - .6), mat('#5fae46'), .052); leaf.position.x = x; leaf.position.z = z; leaf.rotation.z = rnd(0, TAU);
      if (!bloom) return leaf;
      const petals = [...Array(8)].map((_, i) => { const p = at(ball(.035, i % 2 ? '#ffb7cf' : '#ff9fbf'), x + Math.cos(i / 8 * TAU) * .03, .085, z + Math.sin(i / 8 * TAU) * .03); p.scale.set(.6, 1.3, .6); p.rotation.set(Math.sin(i / 8 * TAU) * .6, 0, -Math.cos(i / 8 * TAU) * .6); return p; });
      return group(leaf, ...petals, at(ball(.022, '#ffd66b'), x, .1, z));
    };
    const pads = group(lotus(.35, .3, .13, true), lotus(-.4, -.28, .11, true), lotus(.05, -.45, .08), lotus(-.2, .42, .07));
    // Koi: thân thuôn + đầu + vây lưng + đuôi xoè, đốm màu riêng
    const KOI = [['#fffaf0', '#f2592c'], ['#f39a2c', '#fffaf0'], ['#2f2f35', '#f2a33c']];
    const koi = KOI.map(([body, spot], i) => {
      const torso = ball(.065, body); torso.scale.set(1.6, .55, .75);
      const tail = at(mesh(new THREE.ConeGeometry(.055, .11, 10), body), -.15, 0, 0); tail.rotation.z = Math.PI / 2; tail.scale.z = .25;
      const fin = at(mesh(new THREE.ConeGeometry(.025, .06, 8), body), 0, .035, 0); fin.scale.z = .3;
      const dots = [[.03, .022, .02], [-.04, .022, -.015]].map(([x, y, z]) => { const d = at(ball(.028, spot), x, y, z); d.scale.set(1.2, .35, .9); return d; });
      const fish = group(torso, tail, fin, ...dots);
      fish.userData.phase = i * TAU / 3;
      markOutlineUnit(fish);
      return fish;
    });
    // Cầu cong (taiko-bashi): mặt cầu vòm cung đùn theo bề ngang, lan can son hai bên, núm giboshi ở 4 đầu cột
    const SPAN = .96, RISE = .34, WIDTH = .34, archY = x => RISE * (1 - (x / SPAN) ** 2);
    const deckShape = new THREE.Shape(), N = 24;
    for (let i = 0; i <= N; i++) { const x = -SPAN + i / N * 2 * SPAN; deckShape[i ? 'lineTo' : 'moveTo'](x, archY(x) + .04); }
    for (let i = N; i >= 0; i--) { const x = -SPAN + i / N * 2 * SPAN; deckShape.lineTo(x, Math.max(0, archY(x) - .03)); }
    const deck = mesh(new THREE.ExtrudeGeometry(deckShape, { depth: WIDTH, bevelEnabled: false, curveSegments: 2 }), '#9a6a45');
    deck.position.z = -WIDTH / 2;
    const planks = group();
    for (let i = 1; i < 16; i++) { const x = -SPAN + i / 16 * 2 * SPAN, slope = Math.atan(-2 * RISE * x / SPAN ** 2); planks.add(at(box(.012, .008, WIDTH + .01, '#7a5236'), x, archY(x) + .044, 0).rotateZ(slope)); }
    const rails = group();
    for (const z of [-WIDTH / 2, WIDTH / 2]) {
      const posts = [-.86, -.43, 0, .43, .86];
      posts.forEach(x => rails.add(at(box(.035, .2, .035, VERMILION), x, archY(x) + .14, z)));
      const pts = [...Array(13)].map((_, i) => { const x = -.86 + i / 12 * 1.72; return new THREE.Vector3(x, archY(x) + .23, z); });
      rails.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .018, 6), VERMILION));
      const mid = pts.map(p => p.clone().setY(p.y - .1));
      rails.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid), 24, .012, 6), VERMILION_DARK));
      for (const x of [-.86, .86]) rails.add(at(ball(.03, '#3f4a54'), x, archY(x) + .26, z), at(cone(.018, .05, '#3f4a54', 8), x, archY(x) + .3, z));
    }
    mergeStatic(stones); mergeStatic(pads); mergeStatic(rails); mergeStatic(planks);
    const pond = group(bed, water, stones, pads, ...koi, deck, planks, rails);
    pond.userData.fish = koi;
    pond.userData.sink = .07; // đá viền ao chôn nửa viên
    pond.userData.update = t => {
      waterTick(t);
      koi.forEach((f, i) => {
        const a = t * (.42 + i * .05) + f.userData.phase, r = .38 + i * .08;
        f.position.set(Math.cos(a) * r, .03, Math.sin(a) * r * .85);
        f.rotation.y = -a - Math.PI / 2;
        f.children[1].rotation.y = Math.sin(t * 6 + i) * .4; // vẫy đuôi
      });
    };
    return pond;
  },

  // ---------- Xích đu anh đào (thay võng): cây anh đào uốn cong, cành vươn ngang treo ghế gỗ + nệm zabuton (mặt .42) ----------
  'hammock-jp'() {
    const bark = '#6e4a3a', rnd = seeded(71), beamY = 1.47, hookY = beamY - .05, seatY = .36, L = hookY - seatY;
    const trunkCurve = new THREE.CatmullRomCurve3([[-.62, -.05, 0], [-.66, .5, 0], [-.56, 1.05, -.04], [-.5, 1.4, -.08], [-.42, 1.62, -.1]].map(p => new THREE.Vector3(...p)));
    const branchCurve = new THREE.CatmullRomCurve3([[-.56, 1.3, -.05], [-.25, 1.52, 0], [.05, 1.5, 0], [.32, 1.58, 0]].map(p => new THREE.Vector3(...p)));
    const trunk = group(mesh(new THREE.TubeGeometry(trunkCurve, 24, .09, 12), bark), mesh(new THREE.TubeGeometry(branchCurve, 20, .05, 10), bark),
      at(ball(.09, bark), -.42, 1.62, -.1), at(ball(.05, bark), .32, 1.58, 0),
      ...[0, 2.1, 4.2].map(a => at(cyl(.035, .08, .26, bark, 8), -.62 + Math.cos(a) * .12, .07, Math.sin(a) * .12).rotateX(Math.sin(a) * .9).rotateZ(-Math.cos(a) * .9)), // rễ nổi
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-.52, 1.2, -.05], [-.75, 1.5, -.15], [-.9, 1.7, -.2]].map(p => new THREE.Vector3(...p))), 12, .04, 8), bark));
    trunk.userData.sink = .08; // rễ nổi bò rồi cắm xuống đất
    // Tán hoa: vài khối lõi hồng nhạt + hàng trăm bông 5 cánh rải trên mặt khối; tán nằm trên + sau cành treo (không che ghế)
    const PUFFS = [[-.5, 1.9, -.22, .36], [-.05, 1.86, -.28, .3], [-.88, 1.78, -.18, .28], [-.35, 2.18, -.3, .3], [.28, 1.78, -.18, .22]];
    const canopy = group(...PUFFS.map(([x, y, z, r]) => at(lumpyPuff(r * .86, new THREE.Color('#f2a7bd'), new THREE.Color('#ffd3df'), rnd), x, y, z)));
    const PINKS = ['#ffc2d3', '#ffb0c6', '#fff0f4', '#ff9fbb', '#ffd6e1'], petals = [], dir = new THREE.Vector3();
    for (let n = 0; n < 340; n++) {
      const [px, py, pz, pr] = PUFFS[Math.floor(rnd(0, PUFFS.length))];
      do dir.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); while (dir.lengthSq() > 1 || dir.lengthSq() < .05);
      dir.normalize(); if (dir.y < -.3) dir.y = -dir.y * .5;
      petals.push({ p: [px + dir.x * pr, py + dir.y * pr, pz + dir.z * pr], r: aim(UP, dir), s: rnd(.8, 1.25), c: PINKS[n % PINKS.length] });
    }
    canopy.add(instances(blossomGeo, '#ffc2d3', petals, TWO_SIDED));
    // Ghế xích đu: tấm gỗ + nệm tím, hai dây buộc lên cành
    const seat = group(at(rbox(.62, .04, .3, .015, HINOKI_DARK), 0, -L, 0), at(rbox(.5, .04, .26, .018, '#8f6fc4'), 0, -L + .04, 0),
      ...[[-.23, -.11], [.23, -.11], [-.23, .11], [.23, .11]].map(([x, z]) => at(ball(.012, '#5a3f8f'), x, -L + .062, z)),
      ropeBetween(new THREE.Vector3(-.27, -L + .01, 0), new THREE.Vector3(-.27, 0, 0), .011, '#fffaf0'), ropeBetween(new THREE.Vector3(.27, -L + .01, 0), new THREE.Vector3(.27, 0, 0), .011, '#fffaf0'));
    const swing = pendulum(new THREE.Vector3(0, hookY, 0), L, ...seat.children);
    mergeStatic(trunk);
    const node = group(trunk, canopy, swing);
    node.userData.sink = trunk.userData.sink;
    node.userData.swing = swing; // mèo nhảy vào / ra thì đẩy xích đu
    node.userData.ride = swing; // mèo nằm trên ghế đung đưa theo
    node.userData.update = t => { swing.userData.step(t); canopy.rotation.z = Math.sin(t * 1.1) * .012; canopy.rotation.x = Math.sin(t * .8 + 1) * .01; };
    return node;
  },

  // ---------- Chậu đá có ống tre chảy nước (thay chậu tắm chim): bệ đá chồng, bát đá mặt nước .92, ống tre kakei rót nước, gáo tre ----------
  'birdbath-jp'() {
    const bird = group(ball(.08, '#7f9f5a'), at(ball(.055, '#7f9f5a'), .07, .07, 0), at(cone(.02, .05, '#ffb347', 8), .14, .07, 0).rotateZ(-Math.PI / 2),
      at(ball(.03, '#fffaf0'), .03, -.03, .05)); // chim vành khuyên (mejiro)
    bird.children[0].scale.set(1.2, .9, .9);
    bird.position.set(0, .95, .28); bird.rotation.y = -Math.PI / 2;
    bird.userData.home = bird.position.clone();
    markOutlineUnit(bird);
    const rnd = seeded(29);
    const pedestal = group(at(rock(.26, STONE_DARK, 3), 0, .12, 0), at(rock(.2, STONE, 9), .02, .38, -.02), at(rock(.17, STONE_DARK, 17), -.02, .6, .01));
    pedestal.children.forEach(r => { r.scale.y = .9; });
    for (let i = 0; i < 3; i++) { const m = at(ball(rnd(.05, .07), MOSS), Math.cos(i * 2.2) * .2, .22 + i * .2, Math.sin(i * 2.2) * .18); m.scale.y = .4; pedestal.add(m); }
    // Bát đá: miệng rộng, mặt nước .92 < vành (xuyến) che mép nước
    const bowl = group(at(cyl(.34, .24, .16, STONE, 32), 0, .83, 0), waterDisc(.3, .915, waterMat('#7fc6dc')), at(mesh(new THREE.TorusGeometry(.32, .03, 10, 48), STONE), 0, .912, 0).rotateX(Math.PI / 2));
    // Ống tre: cột tre sau bát, vòi nghiêng chĩa vào giữa bát, dòng nước chảy (sọc cuộn)
    const POST_Z = -.43, MOUTH = new THREE.Vector3(0, 1.07, 0);
    const post = group(at(cyl(.04, .045, 1.2, BAMBOO_DARK, 10), 0, .6, POST_Z), ...[.3, .62, .94].map(y => at(mesh(new THREE.TorusGeometry(.046, .01, 5, 12), '#6f8f30'), 0, y, POST_Z).rotateX(Math.PI / 2)),
      at(cyl(.042, .042, .02, '#d9c27a', 10), 0, 1.2, POST_Z));
    const spout = ropeBetween(new THREE.Vector3(0, 1.15, POST_Z), MOUTH, .022, BAMBOO);
    const flow = flowTexture(); flow.repeat.set(1, 2);
    const stream = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.07, .01), new THREE.Vector3(0, 1.03, .03), new THREE.Vector3(0, .93, .05)]), 12, .011, 6), flowMat(flow));
    stream.castShadow = false; stream.userData.noOutline = true;
    // Gáo tre (hishaku) gác ngang miệng bát
    const ladle = group(at(cyl(.008, .008, .5, BAMBOO, 6), 0, 0, 0).rotateZ(Math.PI / 2), at(cyl(.04, .04, .06, BAMBOO, 12), .24, .02, 0));
    ladle.position.set(0, .945, -.12); ladle.rotation.y = .5;
    const node = group(pedestal, bowl, post, spout, stream, ladle, bird);
    node.userData.bird = bird;
    node.userData.update = t => { waterTick(t); flow.offset.y = -t * 1.6; };
    return node;
  },

  // ---------- Hiên gỗ engawa (thay ghế băng): sàn ván hinoki trên cột, nệm zabuton giữa (chỗ nằm .5), khay trà + bonsai thông ----------
  'bench-jp'() {
    const LEN = 1.42, DEP = .6, TOP = .45;
    const planks = [...Array(5)].map((_, i) => at(rbox(LEN, .04, DEP / 5 - .012, .012, i % 2 ? HINOKI : '#efd8ab'), 0, TOP - .02, -DEP / 2 + (i + .5) * DEP / 5));
    const frame = group(at(box(LEN + .04, .08, .05, HINOKI_DARK), 0, TOP - .08, DEP / 2 - .02), at(box(LEN + .04, .08, .05, HINOKI_DARK), 0, TOP - .08, -DEP / 2 + .02),
      ...[-.62, 0, .62].flatMap(x => [at(box(.07, TOP - .04, .07, HINOKI_DARK), x, (TOP - .04) / 2, DEP / 2 - .05), at(box(.07, TOP - .04, .07, HINOKI_DARK), x, (TOP - .04) / 2, -DEP / 2 + .05)]),
      at(box(LEN - .1, .03, .03, CHARCOAL), 0, .12, DEP / 2 - .05), at(box(LEN - .1, .03, .03, CHARCOAL), 0, .12, -DEP / 2 + .05));
    const zabuton = group(at(rbox(.46, .05, .4, .022, '#8f6fc4'), 0, TOP + .025, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => at(ball(.016, '#ffd66b'), x * .22, TOP + .03, z * .19)));
    // Khay trà sơn mài (bên phải): ấm trà, hai chén, đĩa bánh dango
    const tray = group(at(rbox(.3, .02, .22, .008, '#9b2c22'), 0, .01, 0), at(rbox(.28, .015, .2, .006, '#2f2224'), 0, .025, 0));
    const pot = group(at(ball(.055, '#5f7f6a'), 0, .075, 0), at(cyl(.02, .025, .015, '#4f6a58', 10), 0, .13, 0), at(cyl(.008, .012, .05, '#5f7f6a', 6), .06, .085, 0).rotateZ(-.9),
      at(mesh(new THREE.TorusGeometry(.04, .006, 6, 16, Math.PI), CHARCOAL), 0, .12, 0));
    pot.children[0].scale.y = .8; pot.position.set(-.07, 0, -.02);
    // Chén: thân thấp hơn mặt trà 5 mm (không trùng mặt trên)
    const cup = (x, z) => group(at(cyl(.024, .018, .035, '#f6efe0', 12), x, .0505, z), at(cyl(.02, .02, .012, '#8fae5a', 12), x, .067, z));
    const dango = group(at(cyl(.003, .003, .14, HINOKI_DARK, 5), 0, .045, .06).rotateZ(Math.PI / 2), ...[['#ffb7cf', -.035], ['#fffaf0', 0], ['#9fcf6f', .035]].map(([c, x]) => at(ball(.016, c), x + .07, .045, .06)));
    tray.add(pot, cup(.06, -.05), cup(.11, .01), dango);
    tray.position.set(.48, TOP, .02);
    // Bonsai thông trong chậu nông (bên trái)
    const rnd = seeded(61);
    const bonsai = group(at(rbox(.22, .06, .15, .02, '#3f5a8a'), 0, .03, 0), at(box(.2, .01, .13, '#6e4a33'), 0, .065, 0),
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, .06, 0], [.04, .14, 0], [-.03, .22, .01], [.02, .3, 0]].map(p => new THREE.Vector3(...p))), 12, .016, 6), '#6e4a3a'));
    for (const [x, y, z, r] of [[-.07, .24, 0, .065], [.07, .2, .01, .055], [.02, .32, 0, .06]]) {
      const pad = at(lumpyPuff(r, new THREE.Color('#3f6f3a'), new THREE.Color('#6f9f4a'), rnd), x, y, z); pad.scale.y = .55; bonsai.add(pad);
    }
    bonsai.position.set(-.5, TOP, -.05);
    const step = at(rock(.16, STONE, 7), 0, .03, DEP / 2 + .14); step.scale.set(1.4, .35, .9); // đá để giày (kutsunugi-ishi)
    return group(...planks, frame, zabuton, tray, bonsai, step);
  },
};

// ===== Vườn mở rộng (area garden2): 10 kiểu Nhật, cùng điểm neo với món gốc ở garden-expanded.mjs =====
//   windmill: nền đá chôn đỉnh đồi (sink .46), spot · sunflowers: bump · clothesline: userData.mug (+ home) · campfire: nằm sưởi
//   kite: kite / tug / lookAt · stream: leaf · swingtree: seat + swing / ride · slide: steps + chute · birdhouse: bird / lookAt · picnic: seat / top / mug
const ticker = () => { let last = 0; return t => { const dt = Math.min(.05, Math.max(0, t - (last || t))); last = t; return dt; }; };
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
// Mái vuông vểnh góc (chùa): chóp cụt 4 cạnh xoay 45° cho cạnh mái song song trục, 4 mũi vểnh ở góc
function squareRoof(half, h, color, tip = '#3f4a54') {
  const slab = at(cyl(half * .55, half * Math.SQRT2, h, color, 4), 0, h / 2, 0);
  slab.rotation.y = Math.PI / 4;
  const roof = group(slab);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const up = at(cone(.035, .12, tip, 8), x * half * .98, .03, z * half * .98);
    up.rotation.set(-z * .9, 0, x * .9); roof.add(up);
  }
  return roof;
}

// Mặt diều tako: võ sĩ kabuki (tô mặt kumadori đỏ), tóc búi + băng trán chàm có huy hiệu, mắt trợn, miệng gầm, râu quai nón,
// nền giấy washi có sợi, viền đen + đỏ, dải sóng seigaiha xanh ở chân diều. Canvas 384 × 576 = đúng tỉ lệ cánh diều .64 × .97.
function takoFace() {
  const W = 384, H = 576, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), cx = W / 2;
  let seed = 11; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Điểm 2 số = đoạn thẳng, 4 số = cong (điểm điều khiển + điểm tới)
  const path = (pts, close = true) => { g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) (pts[i].length === 2 ? g.lineTo : g.quadraticCurveTo).apply(g, pts[i]); if (close) g.closePath(); };
  const mirror = draw => { draw(1); g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); draw(1); g.restore(); };
  // Giấy washi: nền kem + sợi giấy mảnh
  g.fillStyle = '#fbf1dc'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { g.strokeStyle = r() < .5 ? '#e9dcc0' : '#fffaf0'; g.lineWidth = .8; g.beginPath(); const x = r() * W, y = r() * H; g.moveTo(x, y); g.quadraticCurveTo(x + r() * 20 - 10, y + r() * 20 - 10, x + r() * 30 - 15, y + r() * 30 - 15); g.stroke(); }
  // Dải sóng seigaiha ở chân diều
  const waveTop = H - 92;
  g.fillStyle = '#2f5f9e'; g.fillRect(0, waveTop, W, H - waveTop);
  for (let row = 0; row < 5; row++) for (let col = -1; col < 9; col++) {
    const x = col * 48 + (row % 2) * 24, y = waveTop + 18 + row * 18;
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#fbf1dc' : '#2f5f9e'; g.beginPath(); g.arc(x, y, 24 - k * 6, Math.PI, 0); g.fill(); }
  }
  // Tóc búi đen + mái tóc hai bên
  g.fillStyle = '#1f1a1c';
  path([[cx - 150, 250], [cx - 170, 90, cx, 70], [cx + 170, 90, cx + 150, 250], [cx + 110, 170, cx, 160], [cx - 110, 170, cx - 150, 250]]); g.fill();
  g.beginPath(); g.ellipse(cx, 58, 46, 30, 0, 0, Math.PI * 2); g.fill(); // búi tóc
  g.fillStyle = '#e5483a'; g.fillRect(cx - 40, 72, 80, 10); // dây buộc búi
  // Khuôn mặt
  g.fillStyle = '#f7d9b8';
  path([[cx - 128, 190], [cx - 140, 360, cx - 70, 420], [cx, 450, cx + 70, 420], [cx + 140, 360, cx + 128, 190], [cx, 150, cx - 128, 190]]); g.fill();
  g.strokeStyle = '#3a2a24'; g.lineWidth = 5; g.stroke();
  // Băng trán chàm có huy hiệu hoa anh đào vàng
  g.fillStyle = '#2f4f8a'; path([[cx - 132, 178], [cx, 140, cx + 132, 178], [cx + 134, 206], [cx, 170, cx - 134, 206]]); g.fill();
  g.fillStyle = '#ffd23f'; g.save(); g.translate(cx, 172);
  for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -10, 7, 11, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#e5483a'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill(); g.restore();
  // Tô mặt kumadori: vệt đỏ từ chân mày vút lên thái dương + vệt má
  g.fillStyle = '#d9302c';
  mirror(() => {
    path([[cx - 24, 236], [cx - 70, 196, cx - 124, 214], [cx - 118, 226], [cx - 70, 216, cx - 30, 250]]); g.fill();
    path([[cx - 60, 320], [cx - 110, 330, cx - 118, 290], [cx - 104, 300], [cx - 94, 320, cx - 56, 334]]); g.fill();
    path([[cx - 40, 268], [cx - 80, 300, cx - 116, 262], [cx - 108, 258], [cx - 80, 286, cx - 44, 258]]); g.fill();
  });
  // Lông mày đậm vút
  g.fillStyle = '#1f1a1c';
  mirror(() => { path([[cx - 18, 236], [cx - 60, 200, cx - 112, 206], [cx - 104, 220], [cx - 60, 216, cx - 22, 248]]); g.fill(); });
  // Mắt trợn: lòng trắng, tròng đen có ánh, viền đỏ khoé ngoài
  mirror(() => {
    g.fillStyle = '#ffffff'; path([[cx - 26, 262], [cx - 60, 240, cx - 96, 258], [cx - 60, 282, cx - 26, 262]]); g.fill();
    g.strokeStyle = '#1f1a1c'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#1f1a1c'; g.beginPath(); g.arc(cx - 56, 261, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - 59, 257, 3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d9302c'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 92, 258); g.quadraticCurveTo(cx - 104, 250, cx - 112, 240); g.stroke();
  });
  // Mũi
  g.strokeStyle = '#8a5a3a'; g.lineWidth = 4; path([[cx - 6, 262], [cx - 14, 312, cx - 22, 322], [cx, 332, cx + 22, 322]], false); g.stroke();
  // Miệng gầm: môi đỏ, răng trắng, lưỡi
  g.fillStyle = '#7a1f1c'; path([[cx - 54, 360], [cx, 338, cx + 54, 360], [cx, 410, cx - 54, 360]]); g.fill();
  g.fillStyle = '#ffffff'; path([[cx - 44, 360], [cx, 346, cx + 44, 360], [cx, 366, cx - 44, 360]]); g.fill();
  g.fillStyle = '#e57a7a'; g.beginPath(); g.ellipse(cx, 388, 20, 9, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d9302c'; g.lineWidth = 6; path([[cx - 56, 360], [cx, 336, cx + 56, 360], [cx, 414, cx - 56, 360]]); g.stroke();
  // Râu mép + quai nón
  g.fillStyle = '#1f1a1c';
  mirror(() => {
    path([[cx - 6, 340], [cx - 40, 332, cx - 78, 352], [cx - 70, 340], [cx - 40, 326, cx - 6, 334]]); g.fill();
    path([[cx - 128, 230], [cx - 150, 330, cx - 96, 420], [cx - 80, 404], [cx - 118, 330, cx - 112, 236]]); g.fill();
  });
  // Viền: đen ngoài, đỏ trong
  g.lineWidth = 14; g.strokeStyle = '#1f1a1c'; g.strokeRect(7, 7, W - 14, H - 14);
  g.lineWidth = 5; g.strokeStyle = '#d9302c'; g.strokeRect(20, 20, W - 40, H - 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

Object.assign(JAPAN_BUILD, {
  // ---------- Tháp chùa 3 tầng trên đỉnh đồi (thay cối xay gió): mái ngói vểnh góc, chuông gió fūrin ở góc mái đung đưa theo gió ----------
  'windmill-jp'() {
    const tiers = [[.34, .36], [.28, .3], [.22, .26]], bells = [];
    const tower = group(at(cyl(.55, .62, .7, STONE, 20), 0, -.1, 0), at(box(.86, .06, .86, STONE_DARK), 0, .28, 0));
    let y = .31;
    tiers.forEach(([half, h]) => {
      const body = group(at(box(half * 1.6, h, half * 1.6, PLASTER), 0, h / 2, 0),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => at(box(.05, h - .05, .05, VERMILION), x * half * .8, (h - .05) / 2, z * half * .8)), // cột thấp hơn vách: đỉnh nằm dưới xà (không trùng mặt)
        at(box(half * 1.64, .05, half * 1.64, VERMILION_DARK), 0, h - .02, 0),
        at(box(half * .5, h * .55, .012, '#3a2418'), 0, h * .4, half * .8 + .012)); // cửa tối mặt trước (mặt sau cách vách 6 mm)
      body.position.y = y; tower.add(body);
      const roof = squareRoof(half * 1.35, .1, ROOF_TILE); roof.position.y = y + h; tower.add(roof);
      // Chuông gió treo dưới 4 góc mái
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const bell = group(at(cyl(.003, .003, .06, CHARCOAL, 4), 0, -.03, 0), at(cone(.022, .035, '#c9a24a', 10), 0, -.07, 0), at(box(.012, .04, .002, '#fffaf0'), 0, -.11, 0));
        bell.position.set(x * half * 1.25, y + h + .01, z * half * 1.25); bell.userData.phase = bells.length * 1.7;
        bells.push(bell); tower.add(bell);
      }
      y += h + .1;
    });
    // Chóp sorin: cột mảnh có 5 vòng + ngọc đỉnh
    tower.add(at(cyl(.015, .02, .5, '#c9a24a', 8), 0, y + .25, 0), ...[0, 1, 2, 3, 4].map(k => at(mesh(new THREE.TorusGeometry(.05 - k * .005, .01, 6, 16), '#c9a24a'), 0, y + .08 + k * .07, 0).rotateX(Math.PI / 2)),
      at(ball(.035, '#c9a24a'), 0, y + .53, 0));
    tower.userData.sink = .46;
    tower.userData.spot = [.85, 0, .62];
    tower.userData.update = t => { const w = windAt(t); bells.forEach(b => { b.rotation.x = Math.sin(t * 2.3 + b.userData.phase) * (.1 + .35 * w); b.rotation.z = Math.sin(t * 1.7 + b.userData.phase * 2) * .2 * w; }); };
    return tower;
  },

  // ---------- Luống diên vĩ (thay hướng dương): lá kiếm xanh, hoa tím / trắng / xanh 3 cánh rủ + 3 cánh đứng; khều thì cả luống lắc ----------
  'sunflowers-jp'() {
    const tick = ticker(), clumps = [], rnd = seeded(83);
    const plant = group(at(cyl(.62, .66, .04, '#6e4a33', 32), 0, .02, 0));
    const IRIS = [['#6f5fd0', '#ffd66b'], ['#f6f3ff', '#ffd66b'], ['#4f7fd8', '#ffd66b'], ['#9a6fd8', '#fff4c2']];
    [[0, 0], [.36, .12], [-.34, .16], [.14, -.38], [-.22, -.34], [.42, -.22], [-.44, -.1], [.18, .42], [-.18, .44]].forEach(([x, z], i) => {
      const clump = group();
      for (let k = 0; k < 6; k++) { // lá kiếm: chóp dẹt cao, xoè nhẹ
        const h = rnd(.4, .62), blade = squash(at(cone(.035, h, k % 2 ? '#4f8a3a' : '#6faa4a', 6), 0, h / 2, 0), 1, 1, .25);
        blade.rotation.set(rnd(-.18, .18), k / 6 * Math.PI, rnd(-.18, .18)); clump.add(blade);
      }
      const [petal, beard] = IRIS[i % IRIS.length];
      for (let f = 0; f < (i % 3 ? 1 : 2); f++) {
        const h = rnd(.62, .78), flower = group(at(cyl(.008, .01, h, '#5f9a3a', 6), 0, h / 2, 0));
        const head = group();
        for (let p = 0; p < 3; p++) {
          const a = p / 3 * TAU;
          const fall = squash(at(ball(.05, petal), Math.sin(a) * .05, -.01, Math.cos(a) * .05), .7, .18, 1.2); fall.rotation.set(.5, a, 0, 'YXZ'); // cánh rủ
          const std = squash(at(ball(.035, petal), Math.sin(a + Math.PI / 3) * .02, .05, Math.cos(a + Math.PI / 3) * .02), .6, 1.3, .35); std.rotation.y = a + Math.PI / 3; // cánh đứng
          head.add(fall, std, at(ball(.012, beard), Math.sin(a) * .04, .008, Math.cos(a) * .04));
        }
        head.position.y = h; flower.add(head);
        flower.position.set(rnd(-.05, .05), 0, rnd(-.05, .05)); flower.rotation.z = rnd(-.12, .12);
        clump.add(flower);
      }
      clump.position.set(x, .04, z); clump.userData.phase = i * 1.3; clumps.push(clump); plant.add(clump);
    });
    let kick = 0;
    plant.userData.bump = (k = 1) => { kick += k; };
    plant.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      kick *= Math.exp(-2.5 * dt);
      clumps.forEach(c => { c.rotation.z = Math.sin(t * 1.5 + c.userData.phase) * (.03 + .05 * w) + Math.sin(t * 12 + c.userData.phase) * kick * .1; });
    };
    plant.userData.update(0);
    return plant;
  },

  // ---------- Cá chép koinobori (thay dây phơi): 2 cột tre, dây ngang treo 3 cá chép vải bay theo gió, chong chóng yaguruma trên cột phải ----------
  'clothesline-jp'() {
    const tick = ticker(), L = 1.3, Y = 1.75, sag = u => Y - .1 * (1 - u * u);
    const poles = [-1, 1].map(s => group(at(cyl(.035, .042, 1.85, BAMBOO_DARK, 10), s * L, .925, 0), ...[.4, .9, 1.4].map(y => at(mesh(new THREE.TorusGeometry(.043, .009, 5, 12), '#6f8f30'), s * L, y, 0).rotateX(Math.PI / 2)),
      at(ball(.05, '#c9a24a'), s * L, 1.88, 0)));
    const rope = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16 * 2 - 1; rope.push(new THREE.Vector3(u * L, sag(u), 0)); }
    // Một con cá: thân trụ thuôn treo dọc -y (miệng ở trên), vảy vẽ canvas, mắt to, vây đuôi xoè
    const scales = (body, belly) => canvasTexture(256, (g, n) => {
      g.fillStyle = body; g.fillRect(0, 0, n, n);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const x = col * 32 + (row % 2) * 16, y = row * 32;
        g.strokeStyle = '#ffffff99'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 15, 0, Math.PI); g.stroke();
      }
      g.fillStyle = belly; g.fillRect(0, n * .82, n, n * .18);
    });
    const carp = (len, r, body, belly) => group(at(mesh(new THREE.CylinderGeometry(r, r * .35, len, 20, 1), mat('#ffffff', { map: scales(body, belly) })), 0, -len / 2 - .03, 0),
      at(mesh(new THREE.TorusGeometry(r, .012, 6, 20), '#fffaf0'), 0, -.03, 0).rotateX(Math.PI / 2),
      ...[-1, 1].flatMap(s => [at(ball(r * .32, '#fffaf0'), s * r * .72, -.03 - r * .5, r * .55), at(ball(r * .17, '#1f1f24'), s * r * .78, -.03 - r * .5, r * .72)]),
      squash(at(cone(r * .8, r * 1.6, body, 10), 0, -len - .03 - r * .6, 0).rotateX(Math.PI), 1, 1, .25));
    const hang = (u, piece) => { const g = group(piece); g.position.set(u * L, sag(u), 0); return g; };
    // Cá nhỏ bên trái (phía cây xích đu), cá to bên phải: đuôi cá bay lên không chạm tán cây bên cạnh
    const pieces = [hang(-.62, carp(.36, .065, '#3f6fd0', '#fff1d6')), hang(.02, carp(.5, .085, '#d9452f', '#fff1d6')), hang(.62, carp(.62, .1, '#2f3a4f', '#fff1d6'))];
    // Chong chóng 8 cánh trên đỉnh cột phải, quay theo gió
    const wheel = group(at(ball(.03, '#c9a24a'), 0, 0, 0));
    for (let k = 0; k < 8; k++) { const arm = group(at(box(.03, .14, .008, ['#e5483a', '#ffd66b', '#3f6fd0', '#7fc45a'][k % 4]), 0, .08, 0)); arm.rotation.z = k / 8 * TAU; wheel.add(arm); }
    wheel.position.set(L, 1.88, .07);
    const line = group(...poles, mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), 24, .008, 5), '#fffaf0'), ...pieces, wheel);
    const small = pieces[0];
    line.userData.mug = small; // mèo nhảy khều cá chép nhỏ rơi xuống (room-cats.mjs knockOff), lát sau cá về lại dây
    small.userData.home = small.position.clone();
    line.userData.update = t => {
      const dt = tick(t), w = windAt(t);
      wheel.rotation.z -= (1 + 5 * w) * dt;
      pieces.forEach((p, i) => {
        if (p.userData.knocked) return;
        p.rotation.x = -(.25 + .7 * w) * (.75 + .25 * Math.sin(t * 2.7 + i * 1.9)); // gió thổi cá bay ngang vào giữa vườn (+z; sau lưng là rào)
        p.rotation.z = Math.sin(t * 2.1 + i) * .1 * w;
      });
    };
    line.userData.update(0);
    return line;
  },

  // ---------- Bếp lò irori (thay lửa trại): khung gỗ vuông, tro + than hồng, ấm sắt treo móc jizai-kagi có cá gỗ, hơi nước bốc lên ----------
  'campfire-jp'() {
    const frame = group(...[.44, -.44].map(z => at(box(1, .12, .12, HINOKI_DARK), 0, .06, z)), ...[.44, -.44].map(x => at(box(.12, .12, .76, HINOKI_DARK), x, .06, 0)),
      at(box(.76, .08, .76, '#b5aea3'), 0, .04, 0), at(cyl(.3, .32, .02, '#8f8a80', 24), 0, .09, 0));
    const coalMat = mat('#ff7a3d', { emissive: '#ff5a1a', emissiveIntensity: 1.2 }), rnd = seeded(19);
    const coals = [...Array(9)].map((_, k) => { const a = k / 9 * TAU, c = at(mesh(new THREE.DodecahedronGeometry(.045, 0), k % 3 ? coalMat : mat('#3a2a24')), Math.cos(a) * rnd(.05, .16), .11, Math.sin(a) * rnd(.05, .16)); c.rotation.set(rnd(0, 3), rnd(0, 3), 0); c.castShadow = false; return c; });
    const light = new THREE.PointLight('#ff9a4a', 3.5, 4.5, 1.6); light.position.set(0, .4, 0);
    // Giá treo: 3 cây tre chụm đỉnh, móc dọc + cá gỗ khoá móc, ấm sắt tetsubin
    const apex = new THREE.Vector3(0, 1.45, 0);
    const tripod = [0, 1, 2].map(k => { const a = k / 3 * TAU + .5; return ropeBetween(new THREE.Vector3(Math.cos(a) * .5, 0, Math.sin(a) * .5), apex, .025, BAMBOO_DARK); });
    const hook = group(at(cyl(.012, .012, .75, CHARCOAL, 6), 0, 1.07, 0), squash(at(ball(.06, '#8a5a3a'), .06, 1.05, 0), 1.6, .7, .45), at(cone(.03, .06, '#8a5a3a', 6), .16, 1.05, 0).rotateZ(-Math.PI / 2));
    const kettle = group(squash(at(ball(.12, '#3a3a40'), 0, 0, 0), 1, .82, 1), at(cyl(.05, .06, .03, '#2f2f35', 14), 0, .1, 0), at(ball(.018, '#2f2f35'), 0, .125, 0),
      at(cyl(.012, .022, .1, '#3a3a40', 8), .13, .02, 0).rotateZ(-1), at(mesh(new THREE.TorusGeometry(.1, .008, 6, 16, Math.PI), CHARCOAL), 0, .1, 0));
    kettle.position.y = .62;
    const steamMat = new THREE.MeshBasicMaterial({ color: '#f6f3ec', transparent: true, opacity: .4, depthWrite: false });
    const steam = [...Array(3)].map((_, k) => { const s = mesh(new THREE.SphereGeometry(.05, 10, 8), steamMat.clone()); s.userData.phase = k / 3; s.castShadow = false; return s; });
    // Tấm chiếu + nệm ngồi phía sau (như khúc gỗ ngồi của lửa trại gốc)
    const tatami = at(box(1.1, .02, .4, '#cfc994'), 0, .01, -.9); tatami.userData.noOutline = true;
    const seats = [-.3, .3].map(x => at(rbox(.34, .06, .32, .025, '#8f6fc4'), x, .05, -.9));
    const hearth = group(frame, ...coals, light, ...tripod, hook, kettle, ...steam, tatami, ...seats);
    hearth.userData.update = t => {
      light.intensity = (light.userData.baseIntensity ?? 3.5) * (.85 + Math.sin(t * 7) * .08 + Math.sin(t * 19) * .05);
      coalMat.emissiveIntensity = 1 + Math.sin(t * 3) * .25;
      kettle.rotation.z = Math.sin(t * .8) * .02;
      steam.forEach(s => { const p = (t * .25 + s.userData.phase) % 1; s.position.set(.18 + p * .15, .7 + p * .55, 0); s.scale.setScalar(.6 + p * 1.4); s.material.opacity = .35 * (1 - p); });
    };
    hearth.userData.update(0);
    return hearth;
  },

  // ---------- Diều tako (thay diều): diều chữ nhật giấy washi vẽ mặt võ sĩ, đuôi nơ đỏ trắng; dùng lại cơ chế bay / dây của diều gốc ----------
  'kite-jp'() {
    const node = GARDEN2_BUILD.kite(), kite = node.userData.kite;
    const face = takoFace();
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(.64, .97), new THREE.MeshBasicMaterial({ map: face, side: THREE.DoubleSide, userData: { nightDim: true } }));
    // Khung giấy: viền tre quanh mép diều (mặt sau cách giấy 6 mm)
    kite.add(...[[0, .42, .64, .02], [0, -.55, .64, .02], [-.32, -.065, .02, .99], [.32, -.065, .02, .99]].map(([x, y, w, h]) => at(box(w, h, .012, BAMBOO_DARK), x, y, -.012)));
    sail.position.y = -.065; // đáy diều ở -.55 như diều gốc (đuôi buộc ở đó)
    kite.children.filter(child => child.isMesh && child.geometry.type === 'ShapeGeometry').forEach(child => kite.remove(child));
    kite.add(sail, ...[1, -1].map(s => { const stick = at(cyl(.006, .006, 1.15, BAMBOO_DARK, 6), 0, -.065, -.006); stick.rotation.z = s * Math.atan2(.64, .97); return stick; }));
    // Nơ đuôi: đỏ / trắng thay xanh / vàng
    let k = 0;
    node.children.forEach(child => { if (child.isMesh && child.geometry.type === 'SphereGeometry') child.material = mat(k++ % 2 ? '#fffaf0' : '#e5483a'); });
    return node;
  },

  // ---------- Suối đá (thay suối): suối gốc + đá bước qua dòng, đèn tuyết yukimi nhỏ, khóm diên vĩ bờ, lá phong đỏ trôi ----------
  'stream-jp'() {
    const node = streamBase(false), rnd = seeded(47);
    node.userData.leaf.material = mat('#e0552f');
    const stones = [[-.45, -.2], [-.3, .02], [-.12, .2]].map(([x, z], k) => { const s = rock(rnd(.1, .12), k % 2 ? STONE : '#d6cfc2', k * 9 + 5); s.scale.set(1.3, .45, 1.1); s.position.set(x, .03, z); return s; });
    const lantern = group(...[0, 1, 2].map(k => { const a = k / 3 * TAU; const leg = at(cyl(.02, .025, .22, STONE_DARK, 6), Math.cos(a) * .1, .11, Math.sin(a) * .1); leg.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); return leg; }),
      at(cyl(.09, .09, .1, STONE, 6), 0, .26, 0), at(cyl(.08, .26, .07, STONE, 6), 0, .345, 0), at(ball(.035, STONE), 0, .4, 0),
      at(mesh(new THREE.PlaneGeometry(.06, .06), mat('#fff0b8')), 0, .26, .084));
    lantern.position.set(-.8, 0, .6);
    const iris = (x, z) => group(...[0, 1, 2, 3].map(k => { const b = squash(at(cone(.025, .36, '#5f9a3a', 6), x + (k - 1.5) * .03, .18, z), 1, 1, .3); b.rotation.set(0, k, (k - 1.5) * .12); return b; }),
      squash(at(ball(.04, '#6f5fd0'), x, .36, z), 1, .7, 1));
    node.add(mergeStatic(group(...stones)), lantern, iris(.6, .55), iris(.85, -.52), iris(-.55, -.55));
    return node;
  },

  // ---------- Cây anh đào lớn có xích đu (thay cây xích đu): thân cổ thụ uốn, tán hoa hồng dày ~760 bông, cánh hoa rơi lả tả
  // quanh gốc (người chơi yêu cầu riêng cho cây này, ngoại lệ của luật "không hạt lơ lửng"); ghế gỗ + nệm treo trên cành ----------
  'swingtree-jp'() {
    const bark = '#4f3a32', barkLight = '#6e5246', rnd = seeded(23), L = 1.75;
    const limb = (pts, r) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 20, r, 10), bark);
    const trunk = group(at(cyl(.2, .32, 1.5, bark, 16), 0, .75, 0),
      limb([[0, 1.4, 0], [.05, 1.9, -.05], [-.05, 2.5, -.1], [0, 3, -.15]], .16), limb([[0, 1.6, 0], [.5, 2.05, .1], [.95, 2.35, .2], [1.2, 2.6, .15]], .09),
      limb([[0, 1.7, 0], [-.5, 2.1, -.1], [-.95, 2.45, -.15], [-1.15, 2.7, -.2]], .09), limb([[0, 2.1, -.05], [.2, 2.6, -.4], [.3, 3.1, -.6]], .07),
      ...[0, 2.1, 4.2].map(a => at(cyl(.07, .15, .38, barkLight, 8), Math.cos(a) * .3, .1, Math.sin(a) * .3).rotateX(Math.cos(a) * .9).rotateZ(-Math.sin(a) * .9))); // rễ nổi
    trunk.userData.sink = .14; // rễ nổi to bò rồi cắm xuống đất
    // Tán: khối lõi hồng xếp thành mái vòm rộng, hơi rủ ở mép
    const PUFFS = [[0, 3.05, -.1, .85], [.85, 2.75, .1, .65], [-.85, 2.8, -.15, .66], [.35, 3.55, -.25, .6], [-.4, 3.45, -.05, .58],
      [.2, 2.65, .55, .55], [-.45, 2.6, .45, .5], [1.25, 2.45, .15, .45], [-1.25, 2.5, -.2, .45], [0, 2.7, -.75, .55]];
    const canopy = group(...PUFFS.map(([x, y, z, r]) => at(lumpyPuff(r * .84, new THREE.Color('#f29ab4'), new THREE.Color('#ffd3df'), rnd), x, y, z)));
    const PINKS = ['#ffc2d3', '#ffb0c6', '#fff0f4', '#ff9fbb', '#ffd6e1', '#ffe4ec'], petals = [], dir = new THREE.Vector3();
    for (let n = 0; n < 760; n++) {
      const [px, py, pz, pr] = PUFFS[Math.floor(rnd(0, PUFFS.length))];
      do dir.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); while (dir.lengthSq() > 1 || dir.lengthSq() < .05);
      dir.normalize(); if (dir.y < -.4) dir.y = -dir.y * .4;
      petals.push({ p: [px + dir.x * pr, py + dir.y * pr, pz + dir.z * pr], r: aim(UP, dir), s: rnd(.9, 1.35), c: PINKS[n % PINKS.length] });
    }
    canopy.add(instances(blossomGeo, '#ffc2d3', petals, TWO_SIDED));
    // Cánh hoa rơi: rơi chậm từ mép dưới tán, lắc lư + xoay, chạm đất thì nằm lại một lúc rồi bắt đầu lại từ trên
    const FALL = 44, falling = new THREE.InstancedMesh(blossomGeo, mat('#ffffff', TWO_SIDED), FALL), drift = [];
    falling.castShadow = false; falling.userData.noOutline = true; falling.frustumCulled = false;
    for (let i = 0; i < FALL; i++) {
      falling.setColorAt(i, C.set(PINKS[i % PINKS.length]));
      drift.push({ a: rnd(0, TAU), r: rnd(.3, 1.35), top: rnd(2.1, 2.6), speed: rnd(.22, .34), phase: rnd(0, 1), spin: rnd(1.5, 3.5) });
    }
    const placePetals = t => {
      drift.forEach((d, i) => {
        const k = (t * d.speed / d.top + d.phase) % 1.15, y = Math.max(.012, d.top * (1 - k)); // k > 1: đã chạm đất, nằm lại
        const sway = Math.sin(t * 1.7 + i) * .18 * Math.min(1, k * 3);
        V.set(Math.cos(d.a) * d.r + sway, y, Math.sin(d.a) * d.r + Math.cos(t * 1.3 + i) * .12);
        E.set(y > .02 ? Math.sin(t * d.spin + i) * 1.2 : 0, t * d.spin * .3 + i, y > .02 ? Math.cos(t * d.spin + i) * .8 : 0);
        falling.setMatrixAt(i, M4.compose(V, Q.setFromEuler(E), S.setScalar(.8)));
      });
      falling.instanceMatrix.needsUpdate = true;
    };
    placePetals(0);
    mergeStatic(trunk);
    const seat = group(at(rbox(.62, .05, .3, .025, HINOKI_DARK), 0, -L, 0), at(rbox(.5, .04, .24, .018, '#8f6fc4'), 0, -L + .045, 0),
      ropeBetween(new THREE.Vector3(-.26, 0, 0), new THREE.Vector3(-.26, -L + .03, 0), .012, '#fffaf0'), ropeBetween(new THREE.Vector3(.26, 0, 0), new THREE.Vector3(.26, -L + .03, 0), .012, '#fffaf0'));
    const swing = pendulum(new THREE.Vector3(0, 2.25, .85), L, ...seat.children);
    const branch = limb([[0, 1.95, .05], [0, 2.22, .5], [.05, 2.25, 1.05]], .065);
    const node = group(trunk, canopy, branch, swing, falling);
    node.userData.sink = trunk.userData.sink;
    node.userData.swing = swing;
    node.userData.ride = swing; swing.userData.restPos = swing.position.clone();
    node.userData.seat = [0, 2.25 - L + .03, .85];
    node.userData.update = t => {
      const w = windAt(t);
      swing.userData.step(t);
      canopy.rotation.z = Math.sin(t * 1.1) * .015 * w; canopy.rotation.x = Math.sin(t * .8 + 1) * .012 * w;
      placePetals(t);
    };
    return node;
  },

  // ---------- Cầu trượt kiểu đền (thay cầu trượt): khung son, thang tre, mái ngói nhỏ trên sàn + chuông suzu, máng gỗ hinoki thành son ----------
  'slide-jp'() {
    const frame = VERMILION, H = 1.1;
    const ladder = group(at(box(.05, H + .35, .05, frame), -1.05, (H + .35) / 2, -.22), at(box(.05, H + .35, .05, frame), -1.05, (H + .35) / 2, .22),
      ...[.3, .6, .9].map(y => at(cyl(.022, .022, .44, BAMBOO, 8), -1.05, y, 0).rotateX(Math.PI / 2)));
    const deck = group(at(rbox(.4, .06, .5, .03, HINOKI), -.82, H, 0), ...[-1, 1].map(s => at(box(.4, .04, .04, frame), -.82, H + .3, s * .22)),
      ...[-1, 1].map(s => at(box(.04, .34, .04, frame), -.64, H + .15, s * .22)), at(box(.05, H, .05, frame), -.64, H / 2, .22), at(box(.05, H, .05, frame), -.64, H / 2, -.22));
    const roofPosts = [[-1.05, -.22], [-1.05, .22], [-.64, -.22], [-.64, .22]].map(([x, z]) => at(box(.04, .62, .04, frame), x, H + .47, z));
    const roof = squareRoof(.34, .1, ROOF_TILE); roof.position.set(-.845, H + .78, 0);
    const bell = group(at(cyl(.004, .004, .14, '#e5483a', 4), 0, -.07, 0), at(ball(.04, '#c9a24a'), 0, -.16, 0));
    bell.position.set(-.64, H + .76, .26);
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(-.62, H, 0), new THREE.Vector3(0, H - .1, 0), new THREE.Vector3(.5, .12, 0), new THREE.Vector3(1.25, .12, 0));
    const chute = group(), N = 10, pts = curve.getPoints(N);
    for (let k = 0; k < N; k++) {
      const a = pts[k], b = pts[k + 1], len = a.distanceTo(b) + .02, mid = a.clone().add(b).multiplyScalar(.5), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const seg = group(at(box(len, .04, .46, k % 2 ? HINOKI : '#efd8ab'), 0, 0, 0), at(box(len, .14, .04, frame), 0, .07, .23), at(box(len, .14, .04, frame), 0, .07, -.23));
      seg.position.copy(mid); seg.rotation.z = ang; chute.add(seg);
    }
    const node = group(ladder, deck, ...roofPosts, roof, bell, chute, at(box(.05, .12, .05, frame), 1.2, .06, .2), at(box(.05, .12, .05, frame), 1.2, .06, -.2));
    node.userData.steps = [[-1.05, .63, 0], [-.82, H + .03, 0]];
    node.userData.chute = curve.getPoints(16).map(p => [p.x, p.y + .04, 0]);
    node.userData.update = t => { bell.rotation.x = Math.sin(t * 2.1) * .12 * windAt(t); };
    return node;
  },

  // ---------- Miếu nhỏ hokora (thay nhà chim): miếu gỗ mái dốc có chigi, cửa lưới, cổng torii tí hon trước bệ; chim vành khuyên đậu nóc ----------
  'birdhouse-jp'() {
    const house = group(at(rbox(.4, .03, .38, .012, STONE), 0, .015, 0), at(box(.24, .22, .2, HINOKI), 0, .14, -.04),
      at(box(.16, .16, .012, '#3a2418'), 0, .13, .066), ...[-.05, 0, .05].map(x => at(box(.008, .16, .008, CHARCOAL), x, .13, .08)), at(box(.16, .008, .008, CHARCOAL), 0, .13, .08));
    for (const s of [1, -1]) { const slab = at(rbox(.2, .025, .32, .012, ROOF_TILE), s * .085, .3, -.04); slab.rotation.z = -s * .55; house.add(slab); }
    house.add(at(box(.04, .03, .34, '#38424b'), 0, .355, -.04));
    for (const z of [-.2, .12]) for (const s of [1, -1]) { const c = at(box(.015, .1, .015, HINOKI_DARK), s * .02, .39, z); c.rotation.z = s * .5; house.add(c); }
    house.add(group(at(cyl(.008, .008, .14, VERMILION, 6), -.06, .1, .15), at(cyl(.008, .008, .14, VERMILION, 6), .06, .1, .15),
      at(box(.17, .014, .014, CHARCOAL), 0, .175, .15), at(box(.14, .01, .01, VERMILION), 0, .15, .15)));
    return birdhouseRig(house, VERMILION_DARK, STONE_DARK, ['#9fbf5a', '#fffaf0'], .38);
  },

  // ---------- Dù trà nodate (thay bàn picnic): ghế băng phủ dạ đỏ, dù giấy đỏ lớn cắm nghiêng phía sau, bát matcha + chổi tre + dango ----------
  'picnic-jp'() {
    const TOP = .45;
    const bench = group(at(rbox(1.2, .05, .55, .02, '#c9302c'), 0, TOP - .025, 0), at(box(1.22, .06, .57, HINOKI_DARK), 0, TOP - .08, 0),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => at(box(.06, TOP - .1, .06, HINOKI_DARK), x * .55, (TOP - .1) / 2, z * .23)),
      at(box(1.1, .04, .04, HINOKI_DARK), 0, .12, .23), at(box(1.1, .04, .04, HINOKI_DARK), 0, .12, -.23));
    const umbrella = group(at(cyl(.015, .015, 1.85, HINOKI_DARK, 8), 0, .92, 0), at(mesh(new THREE.ConeGeometry(.85, .32, 28, 1), '#c9302c'), 0, 1.8, 0),
      at(mesh(new THREE.TorusGeometry(.42, .012, 6, 40), '#fffaf0'), 0, 1.81, 0).rotateX(Math.PI / 2), at(ball(.04, HINOKI_DARK), 0, 1.98, 0));
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; umbrella.add(ropeBetween(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(Math.cos(a) * .6, 1.68, Math.sin(a) * .6), .006, HINOKI_DARK)); } // nan dưới tán
    umbrella.position.set(.35, 0, -.42); umbrella.rotation.set(-.22, 0, -.12);
    const bowl = group(at(cyl(.06, .04, .06, '#5f4a3a', 16), 0, .03, 0), at(cyl(.052, .052, .012, '#8fae5a', 16), 0, .059, 0));
    bowl.position.set(.38, TOP, .12);
    const whisk = group(at(cyl(.008, .008, .08, BAMBOO, 6), 0, .04, 0), at(cyl(.028, .012, .05, '#d9c27a', 10), 0, .1, 0));
    whisk.position.set(.48, TOP, -.02);
    const dango = group(at(cyl(.06, .06, .01, '#fffaf0', 16), 0, .005, 0), at(cyl(.003, .003, .14, HINOKI_DARK, 5), 0, .03, 0).rotateZ(Math.PI / 2),
      ...[['#ffb7cf', -.035], ['#fffaf0', 0], ['#9fcf6f', .035]].map(([c, x]) => at(ball(.017, c), x, .03, 0)));
    dango.position.set(.2, TOP, -.12);
    const node = group(bench, umbrella, bowl, whisk, dango);
    node.userData.mug = bowl; bowl.userData.home = bowl.position.clone(); // mèo khều bát trà rơi (room-cats.mjs knockOff)
    node.userData.seat = [-.2, TOP + .01, 0];
    node.userData.top = TOP;
    return node;
  },
});
