// Trường mẫu giáo (bên kia đường, trước vườn): MỘT khu Deco hình chữ nhật như sân sau. Nửa phải là lớp học hở mái (sàn gỗ + tường
// sau có cửa sổ, bảng, cầu vồng — đồ cố định), nửa trái + phía trước là sân chơi. 10 chỗ đặt, mỗi chỗ 3 kiểu (món gốc + 2 kiểu ở
// cuối file). Món "kép" (bàn học, tủ ngăn, thú nhún, ghế băng): một món nhưng dựng ở HAI chỗ, gốc model nằm giữa hai chỗ
// (xoay 0; vật cản từng chỗ: room-layout.mjs OBSTACLE_EXTRA). Cùng kiểu dựng với backyard.mjs: khối bo tròn, màu pastel, viền toon.
// Toạ độ khu kinder (room-layout.mjs PLACES); mép -z của khu giáp vỉa hè, cổng rào ở KINDER_GATE_X.
import * as THREE from 'three';
import { sphereSegments, radialSegments, mergeStatic, roundedBox } from '../render/mesh-detail.mjs';
import { KINDER_GATE_X, KINDER_DOOR, KINDER_Z, ROAD_Z, SIDEWALK_Y, ROAD_Y } from '../room-layout.mjs';
import { TOON, toonMat } from '../render/toon.mjs';
import { sandMat } from './garden.mjs';

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
const ring = (r, tube, color, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(r, tube, 8, Math.max(16, radialSegments(r) + 6), arc), color);
const cone = (r, h, color, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), color);
const group = (...children) => { const g = new THREE.Group(); if (children.length) g.add(...children); return g; };
const squash = (node, sx, sy, sz) => { node.scale.set(sx, sy, sz); return node; };
const WOOD = '#c98a55', WOOD_DARK = '#9a6a45', RED = '#ff6b6b', YELLOW = '#ffd66b', BLUE = '#5fb8e8', GREEN = '#7fc45a', PINK = '#ff8fb8', PURPLE = '#b48ee8', ORANGE = '#ff9a3c';
const RAINBOW = [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE];
// Món kép: hai bản ở x = ±d (hoặc z = ±d) quanh gốc; make(s) dựng một bản (s = -1 / 1), tự xoay nếu cần. userData.pair: thumbnail Deco
// kéo hai bản lại sát nhau ở ±thumb (deco-room.mjs thumbSubject) — đặt thật cách nhau vài mét thì ảnh nhỏ chỉ còn hai chấm.
function pair(axis, d, thumb, make) {
  const g = group(...[-1, 1].map(s => { const part = make(s); part.position[axis] += s * d; return part; }));
  g.userData.pair = { axis, thumb };
  return g;
}
const pairX = (dx, thumb, make) => pair('x', dx, thumb, make), pairZ = (dz, thumb, make) => pair('z', dz, thumb, make);
// Lớp học: khung sàn + tường sau (toạ độ khu). Đồ trong lớp đặt trong khung này (room-layout.mjs PLACES).
export const CLASSROOM = { x0: 4.7, x1: 12.3, z0: -3.85, z1: .3, wallH: 2.4 };

// ---------- Đồ cố định: lối qua đường (bậc + vạch sang đường), bãi cát sân chơi, sàn + bốn tường lớp học (cửa sổ thật, biển KINDERGARTEN) ----------
// Kiểu tường lớp học (Deco → School, deco-data.mjs cat 'facade'): màu tường (mặt trong + ngoài), chân tường, dải dưới mái hiên,
// cánh cửa + khung cửa, sọc dù. Cửa sổ, cột góc, biển hiệu, cầu vồng giữ nguyên ở mọi kiểu.
export const KINDER_FACADES = {
  'kfacade-sunny': { wall: '#fff0c2', skirt: PINK, band: YELLOW, door: BLUE, frame: YELLOW, awning: RED },
  'kfacade-mint': { wall: '#cdeee0', skirt: '#ff8a7a', band: '#ffd66b', door: '#ff8a7a', frame: '#fffaf0', awning: '#3fb3a0' },
  'kfacade-lilac': { wall: '#e6dcff', skirt: '#5fb8e8', band: '#8fd0f2', door: '#b48ee8', frame: '#ffd66b', awning: '#b48ee8' },
};
export function kinderDecor(facadeId = 'kfacade-sunny') {
  const g = group(), C = CLASSROOM, F = KINDER_FACADES[facadeId] || KINDER_FACADES['kfacade-sunny'];
  // Lối sang trường (toạ độ khu nhà ROAD_Z trừ KINDER_Z): bậc đá từ cổng vườn xuống vỉa hè, vạch sang đường thẳng hai cổng,
  // bậc từ vỉa hè lên cổng trường. Mặt đi đúng theo crossingHeight (mèo đi theo nó).
  const Z = ROAD_Z, K = KINDER_Z, gate = KINDER_GATE_X, PAVER = '#e8cfa6', base = -.31;
  const step = (z0, z1, top, bottom = base) => g.add(at(rbox(1.0, top - bottom, z1 - z0, .02, PAVER), gate, (top + bottom) / 2, (z0 + z1) / 2 - K));
  for (let i = 0; i < 3; i++) step(Z.verge + i * (Z.s0 - Z.verge) / 3, Z.verge + (i + 1) * (Z.s0 - Z.verge) / 3, SIDEWALK_Y * (i + .5) / 3);
  step(Z.s2 - .35, Z.s2 + .12, SIDEWALK_Y / 2, SIDEWALK_Y);
  // Vạch sang đường: các thanh trắng dài theo chiều xe chạy (x), xếp nối nhau theo chiều người đi (z), giữa hai lề đường.
  const mid = (Z.c1 + Z.r1) / 2;
  for (let k = -2; k <= 2; k++) {
    const stripe = at(box(2.4, .012, .38, '#fffaf0'), gate, ROAD_Y + .008, mid + k * .68 - K);
    stripe.userData.noOutline = true;
    g.add(stripe);
  }
  // Bãi cát lớn của sân chơi (nửa trái, cùng đồ chơi đứng trên): tấm phẳng bo góc có texture cát + viền cát ướt sẫm bên dưới (đều thấp hơn 1 cm: đồ không "chạm").
  const roundedRect = (x0, x1, y0, y1, r) => {
    const s = new THREE.Shape();
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  };
  const patch = (x0, x1, z0, z1, r, y, material) => {
    const geo = new THREE.ShapeGeometry(roundedRect(x0, x1, -z1, -z0, r), 16); // shape (x, y) -> sau xoay: z = -y
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.4, uv.getY(i) / 2.4);
    const node = new THREE.Mesh(geo, material); node.position.y = y;
    node.receiveShadow = true; node.castShadow = false; node.userData.noOutline = true;
    return node;
  };
  const sand = typeof document === 'undefined' ? mat('#efd8a4') : sandMat();
  // Texture cát của vườn dùng chung (kẹp mép, đã nạp lên GPU): đổi wrap trên bản gốc thì không chắc ăn -> sao chép riêng, lặp theo uv (uv > 1 mà kẹp mép = vệt sọc loang khi xoay camera).
  if (sand.map) { sand.map = sand.map.clone(); sand.map.wrapS = sand.map.wrapT = THREE.RepeatWrapping; sand.map.needsUpdate = true; }
  // Hai tấm phẳng chồng lên nhau + nền cỏ (đã bị đẩy lùi): kéo lên trước bằng polygonOffset để xa camera cũng không z-fighting
  const edge = mat('#cfae72');
  Object.assign(edge, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  Object.assign(sand, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  g.add(patch(-4.05, 4.4, -4.05, 4.05, 1.1, .006, edge), patch(-3.9, 4.25, -3.9, 3.9, 1.0, .013, sand));
  // Sàn lớp học (tấm phẳng sát nền: đồ trong lớp đứng trên nền, không tính chạm) + bậc thềm trước.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(C.x1 - C.x0, C.z1 - C.z0), mat('#f4e3c1'));
  floor.rotation.x = -Math.PI / 2; floor.position.set((C.x0 + C.x1) / 2, .006, (C.z0 + C.z1) / 2); floor.receiveShadow = true;
  floor.castShadow = false; floor.userData.noOutline = true; // sàn phẳng: không viền
  g.add(floor);
  // Bốn tường (dày .2, mặt trong đúng khung CLASSROOM; tường trái lùi thêm 2 cm cho lưng tủ ngăn): vàng kem, chân tường hồng + gờ đá,
  // dải vàng + mái hiên trắng nhô ra trên đỉnh, cột góc nhô. Cửa sổ và cửa ra vào là LỖ THẬT trên tường (đoạn tường chừa lỗ), có khung sâu + bậu cửa.
  const cx = (C.x0 + C.x1) / 2, wz = C.z0 - .1, W = C.x1 - C.x0, H = C.wallH;
  const lx = C.x0 - .12, rx = C.x1 + .1, fz = C.z1 + .1, D = KINDER_DOOR;
  const wall = group(), TRIM = '#fffaf0';
  // một đoạn tường dọc trục axis từ a tới b (cao y0..y1) ở vị trí p của trục còn lại; chân hồng khi sát đất, mái hiên + dải vàng khi tới đỉnh
  const seg = (axis, a, b, p, y0, y1) => {
    if (b - a < .01) return;
    const len = b - a, c = (a + b) / 2;
    const add = (h, t, color, y) => wall.add(axis === 'x' ? at(box(len, h, t, color), c, y, p) : at(box(t, h, len, color), p, y, c));
    add(y1 - y0, .2, F.wall, (y0 + y1) / 2);
    if (y0 === 0) add(.3, .22, F.skirt, .15);
    if (y1 === H) { add(.1, .38, TRIM, H + .05); add(.1, .22, F.band, H - .15); }
  };
  // cuts: các lỗ {c: tâm, w: rộng, y0, y1} trên đoạn tường
  const wallLine = (axis, a, b, p, cuts) => {
    let cur = a;
    for (const { c, w, y0, y1 } of [...cuts].sort((m, n) => m.c - n.c)) {
      seg(axis, cur, c - w / 2, p, 0, H);
      if (y0 > 0) seg(axis, c - w / 2, c + w / 2, p, 0, y0);
      seg(axis, c - w / 2, c + w / 2, p, y1, H);
      cur = c + w / 2;
    }
    seg(axis, cur, b, p, 0, H);
  };
  const win = c => ({ c, w: 1.1, y0: 1.16, y1: 2.04 });
  wallLine('x', lx, rx, wz, [win(C.x0 + 1.1), win(C.x1 - 1.3)]);
  wallLine('z', wz + .1, fz - .1, lx, [win(-1.8)]);
  wallLine('z', wz + .1, fz - .1, rx, [win(-1.8)]);
  wallLine('x', lx - .1, rx + .1, fz, [{ c: D.x, w: D.w, y0: 0, y1: D.h }, win(6.0), win(10.8)]);
  // cột góc + quả cầu trên đỉnh
  for (const x of [lx, rx]) for (const z of [wz, fz]) wall.add(at(rbox(.34, H + .2, .34, .05, TRIM), x, (H + .2) / 2, z), at(ball(.14, RAINBOW[(x > cx) * 2 + (z > 0)]), x, H + .32, z));
  // Gờ đá nền nhô ra ngoài chân tường (thấp 10 cm; bỏ trước cửa: lối của mèo)
  const ledge = (axis, a, b, p) => wall.add(axis === 'x' ? at(box(b - a, .1, .14, '#e8cfa6'), (a + b) / 2, .05, p) : at(box(.14, .1, b - a, '#e8cfa6'), p, .05, (a + b) / 2));
  ledge('x', lx - .17, rx + .17, wz - .17); ledge('z', wz - .1, fz + .17, lx - .17); ledge('z', wz - .1, fz + .17, rx + .17);
  ledge('x', lx - .17, D.x - .65, fz + .17); ledge('x', D.x + .65, rx + .17, fz + .17);
  // Cửa sổ thật: kính (vệt phản chiếu hai mặt), khung + song chữ thập xuyên hết bề dày tường, nẹp viền hai mặt, bậu cửa trong lẫn ngoài.
  // side: hướng mặt ngoài theo trục z cục bộ; planter: bồn hoa dưới bậu cửa mặt ngoài.
  const windowAt = (x, z, rotY, side, planter = true) => {
    // kính trong suốt (nhìn xuyên qua thấy trong lớp / ngoài sân), không đổ bóng
    const pane = at(mesh(new THREE.BoxGeometry(1.1, .88, .02), mat('#cfeeff', { transparent: true, opacity: .28, depthWrite: false })), 0, 1.6, 0);
    pane.castShadow = false; pane.userData.noOutline = true;
    const w = group(pane);
    w.add(at(box(.08, .88, .24, TRIM), -.51, 1.6, 0), at(box(.08, .88, .24, TRIM), .51, 1.6, 0), at(box(1.1, .08, .24, TRIM), 0, 1.2, 0), at(box(1.1, .08, .24, TRIM), 0, 2.0, 0),
      at(box(.05, .8, .22, TRIM), 0, 1.6, 0), at(box(1.0, .05, .22, TRIM), 0, 1.6, 0));
    for (const s of [-1, 1]) {
      w.add(at(box(.1, 1.0, .05, TRIM), -.62, 1.6, s * .125), at(box(.1, 1.0, .05, TRIM), .62, 1.6, s * .125), at(box(1.34, .1, .05, TRIM), 0, 2.09, s * .125),
        at(box(.07, .62, .012, '#e8f7ff'), -.27, 1.65, s * .018).rotateZ(.45), at(box(.03, .62, .012, '#e8f7ff'), -.15, 1.65, s * .018).rotateZ(.45));
    }
    w.add(at(rbox(1.38, .07, .34, .02, TRIM), 0, 1.125, side * .27), at(rbox(1.3, .06, .2, .02, TRIM), 0, 1.125, -side * .2));
    if (planter) {
      w.add(at(rbox(1.2, .18, .22, .04, WOOD), 0, .93, side * .22));
      for (let k = 0; k < 5; k++) w.add(at(ball(.08, k % 2 ? GREEN : RAINBOW[k]), -.44 + k * .22, 1.04, side * .22));
    }
    w.position.set(x, 0, z); w.rotation.y = rotY;
    wall.add(w);
  };
  // tường sau giáp vỉa hè (chỉ cách rào 15 cm): không bồn hoa ngoài
  windowAt(C.x0 + 1.1, wz, 0, -1, false); windowAt(C.x1 - 1.3, wz, 0, -1, false);
  windowAt(lx, -1.8, Math.PI / 2, -1); windowAt(rx, -1.8, Math.PI / 2, 1, false);
  windowAt(6.0, fz, 0, 1); windowAt(10.8, fz, 0, 1);
  // Biển "KINDERGARTEN" trên tường sau (mặt nhìn ra đường): khung gỗ nhô ra, chữ nhiều màu vẽ canvas, hai quả cầu hai đầu.
  const signMat = () => {
    if (typeof document === 'undefined') return mat('#fff3d6');
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const c2 = canvas.getContext('2d'), word = 'KINDERGARTEN', colors = [RED, ORANGE, '#f2b705', GREEN, BLUE, PURPLE];
    c2.fillStyle = '#fff3d6'; c2.fillRect(0, 0, 1024, 256);
    c2.font = '900 170px "Baloo 2", "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif'; c2.textBaseline = 'middle'; c2.lineJoin = 'round'; c2.lineWidth = 14; c2.strokeStyle = '#6b4a35';
    const widths = [...word].map(ch => c2.measureText(ch).width + 6), total = widths.reduce((s, v) => s + v, 0), k = Math.min(1, 960 / total);
    c2.save(); c2.translate((1024 - total * k) / 2, 134); c2.scale(k, k);
    let px = 0;
    [...word].forEach((ch, i) => { c2.fillStyle = colors[i % colors.length]; c2.strokeText(ch, px, 0); c2.fillText(ch, px, 0); px += widths[i]; });
    c2.restore();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    return mat('#ffffff', { map: texture });
  };
  const sy = 1.75, sz = wz - .1;
  wall.add(at(rbox(3.5, .94, .08, .03, WOOD), cx, sy, sz - .04), at(ball(.13, YELLOW), cx - 1.85, sy, sz - .04), at(ball(.13, PINK), cx + 1.85, sy, sz - .04));
  const signFace = (rotY, y, z) => {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.3, .82), signText);
    face.rotation.y = rotY; face.position.set(cx, y, z); face.castShadow = false; face.receiveShadow = true; face.userData.noOutline = true;
    return face;
  };
  const signText = signMat();
  wall.add(signFace(Math.PI, sy, sz - .09));
  // Biển thứ hai đứng trên đỉnh tường trước (mặt nhìn về phía camera Deco / sân chơi): hai trụ nhỏ đỡ khung.
  const ty = H + .65, tz = fz;
  wall.add(at(rbox(3.5, .94, .1, .03, WOOD), cx, ty, tz), at(ball(.13, YELLOW), cx - 1.85, ty, tz), at(ball(.13, PINK), cx + 1.85, ty, tz),
    ...[-1.2, 1.2].map(x => at(box(.1, .22, .1, WOOD_DARK), cx + x, H + .21, tz)));
  wall.add(signFace(0, ty, tz + .06));
  // Chấm bi màu sơn mặt ngoài (đĩa dẹt cách mặt tường 1 cm): tường sau nhìn ra đường, tường trái nhìn ra sân chơi.
  const dot = (r, c) => cyl(r, r, .02, c, 16);
  [[5.0, .9, .22], [7.6, .8, .18], [9.6, .9, .2], [12.0, 1.4, .24]].forEach(([x, y, r], k) =>
    wall.add(at(dot(r, RAINBOW[k % 6]), x, y, wz - .12).rotateX(Math.PI / 2)));
  [[-3.4, .9, .24], [-2.6, 2.0, .18], [-.6, 1.0, .3], [.0, 1.95, .16]].forEach(([z, y, r], k) =>
    wall.add(at(dot(r, RAINBOW[(k + 2) % 6]), lx - .12, y, z).rotateZ(Math.PI / 2)));
  // Cửa ra vào: khung bo, cánh cửa xanh mở ra ngoài sát mép trái (có ô kính tròn + tay nắm), mái hiên sọc, biển hiệu khối màu.
  wall.add(...[-1, 1].map(s => at(rbox(.14, D.h + .1, .3, .04, F.frame), D.x + s * (D.w / 2 + .03), (D.h + .1) / 2, fz)),
    at(rbox(D.w + .2, .14, .3, .04, F.frame), D.x, D.h + .05, fz));
  const leaf = group(at(rbox(.06, D.h - .06, D.w - .08, .02, F.door), 0, (D.h - .06) / 2, 0), at(ring(.16, .03, '#fffaf0'), .04, 1.35, 0).rotateY(Math.PI / 2),
    at(cyl(.15, .15, .02, '#bfe6f6', 16), .045, 1.35, 0).rotateZ(Math.PI / 2), at(ball(.04, YELLOW), .06, .95, .42));
  leaf.position.set(D.x - D.w / 2 + .04, 0, fz + .1 + (D.w - .08) / 2 + .02); wall.add(leaf);
  for (let k = 0; k < 5; k++) wall.add(at(box((D.w + .2) / 5 - .01, .05, .5, k % 2 ? '#fffaf0' : F.awning), D.x - (D.w + .2) / 2 + (k + .5) * (D.w + .2) / 5, D.h + .1, fz + .32).rotateX(.3));
  wall.add(at(rbox(1.5, .28, .05, .02, '#fffaf0'), D.x, H - .15, fz + .135),
    ...[RED, YELLOW, GREEN, BLUE, PURPLE].map((c, k) => at(rbox(.2, .2, .06, .03, c), D.x - .5 + k * .25, H - .15, fz + .19)));
  // bụi hoa hai bên cửa (ngoài, chừa lối 1 m trước cửa)
  for (const x of [5.2, 7.2, 9.7, 11.7]) wall.add(at(ball(.28, GREEN), x, .2, fz + .42), at(ball(.07, PINK), x - .1, .45, fz + .5), at(ball(.07, YELLOW), x + .12, .42, fz + .45));
  // Dù đỏ trắng chìa hẳn ra ngoài (phía đường), dốc thấp dần ra mép, thêm diềm vải ở mép ngoài
  for (let k = 0; k < 10; k++) {
    const c = k % 2 ? '#fffaf0' : F.awning;
    wall.add(at(box(W / 10 - .01, .06, .95, c), C.x0 + (k + .5) * W / 10, C.wallH - .02, wz - .5).rotateX(-.3), at(box(W / 10 - .01, .16, .04, c), C.x0 + (k + .5) * W / 10, C.wallH - .2, wz - .95));
  }
  RAINBOW.forEach((c, k) => { const arc = ring(1.9 - k * .17, .09, c, Math.PI); arc.position.set(cx, C.wallH + .05, wz - .02); wall.add(arc); });
  wall.add(at(ball(.32, '#fffaf0'), cx - 1.95, C.wallH + .14, wz - .02), at(ball(.32, '#fffaf0'), cx + 1.95, C.wallH + .14, wz - .02));
  g.add(wall);
  const out = mergeStatic(g);
  // Đèn tường hai vách lớp học (tránh cửa sổ giữa vách) chiếu sáng cả phòng: đèn thật luôn bật cả ngày lẫn đêm, không theo ambient (đồ cố định, không qua lightUp).
  for (const s of [-1, 1]) {
    const x = s < 0 ? C.x0 : C.x1, lamp = group(at(rbox(.04, .2, .12, .015, TRIM), x - s * .02, 1.85, -.6),
      at(mesh(new THREE.SphereGeometry(.09, 16, 12), mat('#ffffff', { emissive: '#eef4ff', emissiveIntensity: .6 })), x - s * .13, 1.92, -.6));
    // ánh sáng đặt ở 1/4 bề ngang lớp (không sát vách): hai đèn phủ đều cả phòng 7.6 × 4.2 m, tắt dần chậm (decay 1); ánh trắng như đèn lớp học, không vàng ấm như đèn nhà
    const light = new THREE.PointLight('#f4f8ff', 2, 6.5, 1);
    light.position.set(x - s * 1.9, 2.2, (C.z0 + C.z1) / 2);
    lamp.add(light);
    lamp.userData.lightSource = true;
    out.add(lamp);
  }
  return out;
}

// ---------- Từng bản của món kép ----------
// Bàn học nhỏ + 4 ghế (2 trước, 2 sau; mặt ngồi .44 × .4 đủ cho mèo ngồi), giấy + bút màu trên bàn.
function deskCluster(s) {
  const g = group(at(rbox(1.2, .05, .7, .02, '#fffaf0'), 0, .5, 0), ...[-1, 1].flatMap(x => [-1, 1].map(z => at(cyl(.025, .025, .48, s < 0 ? BLUE : GREEN, 8), x * .52, .24, z * .28))));
  [[-.29, -1], [.29, -1], [-.29, 1], [.29, 1]].forEach(([x, z], k) => {
    const c = RAINBOW[(k + (s > 0 ? 3 : 0)) % 6];
    g.add(at(rbox(.44, .05, .4, .02, c), x, .335, z * .64), at(rbox(.44, .32, .04, .015, c), x, .53, z * .86),
      ...[-1, 1].flatMap(dx => [-1, 1].map(dz => at(cyl(.02, .02, .32, '#c8ccd2', 6), x + dx * .18, .16, z * .64 + dz * .16))));
  });
  g.add(at(box(.3, .005, .22, '#ffffff'), -.2, .528, 0), at(box(.3, .005, .22, '#ffffff'), .25, .528, .05),
    ...[RED, YELLOW, BLUE].map((c, k) => at(cyl(.012, .012, .14, c, 6), .1 + k * .04, .54, -.2).rotateZ(Math.PI / 2)));
  return g;
}
// Tủ ngăn kê sát tường bên (mặt quay vào giữa lớp): 2 × 4 ô, mỗi ô một hộp đồ chơi màu.
function cubbyUnit(s, fill) {
  // khung hở: tấm lưng + nóc / đáy / kệ giữa / hai vách / ba vách ngăn (đồ trong ô nhìn thấy được)
  const W = '#fffaf0', g = group(at(box(1.6, .9, .06, W), 0, .45, -.17), ...[.02, .45, .88].map(y => at(box(1.6, .04, .34, W), 0, y, .03)),
    ...[-.78, -.4, 0, .4, .78].flatMap(x => [.235, .665].map(y => at(box(.04, .39, .34, W), x, y, .03))));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) fill(g, -.6 + c * .4, .25 + r * .42, RAINBOW[(r * 4 + c) % 6]);
  g.rotation.y = -s * Math.PI / 2; // bản trái (s -1) quay mặt sang +x, bản phải quay sang -x
  return g;
}
// Thú nhún: đế tròn, lò xo, thân thú.
function springRider(s, body) {
  const g = group(at(cyl(.28, .3, .06, '#d9d2c4', 20), 0, .03, 0));
  for (let k = 0; k < 5; k++) g.add(at(ring(.09, .02, '#c8ccd2'), 0, .1 + k * .06, 0).rotateX(Math.PI / 2));
  g.add(body(s));
  return g;
}
const duck = () => group(squash(at(ball(.25, YELLOW), 0, .55, 0), 1, .85, 1.3), at(ball(.15, YELLOW), 0, .82, .22), at(cone(.06, .12, ORANGE, 8), 0, .8, .4).rotateX(Math.PI / 2),
  ...[-1, 1].map(x => at(ball(.025, '#2b2f3a'), x * .08, .87, .33)), ...[-1, 1].map(x => at(cyl(.015, .015, .16, RED, 6), x * .1, .74, .12).rotateZ(Math.PI / 2)));
const horse = () => group(squash(at(ball(.24, PINK), 0, .55, 0), .85, .8, 1.35), at(rbox(.16, .3, .2, .06, PINK), 0, .78, .25), at(rbox(.16, .14, .22, .06, PINK), 0, .9, .36),
  at(rbox(.06, .22, .2, .03, PURPLE), 0, .9, .18), ...[-1, 1].map(x => at(ball(.02, '#2b2f3a'), x * .08, .93, .42)), at(cyl(.012, .012, .26, YELLOW, 6), 0, .74, .2).rotateZ(Math.PI / 2));
// Ghế băng nhỏ: mặt ngồi + tựa lưng sọc, chân sắt.
function bench(s) {
  const c = s < 0 ? BLUE : PINK, g = group(at(rbox(1.3, .06, .38, .02, c), 0, .4, 0), at(rbox(1.3, .3, .05, .02, c), 0, .66, -.17));
  for (const x of [-.55, .55]) g.add(at(box(.05, .4, .32, '#6b7078'), x, .2, 0), at(box(.05, .32, .05, '#6b7078'), x, .55, -.17));
  return g;
}

export const KINDER_BUILD = {
  // ===== Bàn học (kép): hai cụm bàn + ghế, mỗi cụm 1.2 × 1.5 =====
  kdesk: () => pairX(1.7, .85, deskCluster),

  // ===== Bảng đen treo tường sau: khung gỗ, mặt xanh có chữ ABC + hình vẽ phấn, khay phấn =====
  kboard() {
    const g = group(at(rbox(2.4, 1.2, .08, .03, WOOD), 0, 1.45, 0), at(box(2.2, 1.0, .02, '#2f5d4a'), 0, 1.45, .045), at(rbox(2.2, .04, .1, .015, WOOD_DARK), 0, .9, .06));
    [RED, YELLOW, BLUE].forEach((c, k) => g.add(at(box(.18, .24, .005, c), -.75 + k * .26, 1.65, .058)));
    g.add(at(ring(.14, .012, '#fffaf0'), .55, 1.6, .058), at(box(.5, .012, .005, '#fffaf0'), .2, 1.2, .058), ...[0, 1, 2].map(k => at(cyl(.01, .01, .08, ['#fffaf0', PINK, YELLOW][k], 6), -.4 + k * .1, .93, .06).rotateZ(Math.PI / 2)));
    return g;
  },

  // ===== Tủ ngăn đồ chơi (kép): hai tủ áp hai vách bên lớp, mỗi ô một hộp màu =====
  kcubby: () => pairX(3.5, .82, s => cubbyUnit(s, (g, x, y, c) => g.add(at(rbox(.32, .3, .3, .04, c), x, y, .06)))),

  // ===== Đàn piano đứng + ghế đôn =====
  kpiano() {
    const g = group(at(rbox(1.2, 1.0, .42, .04, '#e98b9a'), 0, .5, -.04), at(rbox(1.24, .06, .46, .02, '#fffaf0'), 0, 1.03, -.04),
      at(rbox(1.1, .06, .2, .02, '#fffaf0'), 0, .72, .26), at(box(1.1, .2, .02, '#fffaf0'), 0, .86, .19));
    for (let k = 0; k < 8; k++) if (k % 7 !== 2 && k % 7 !== 6) g.add(at(box(.06, .03, .1, '#2b2f3a'), -.47 + k * .135, .765, .22));
    g.add(at(cyl(.2, .2, .06, YELLOW, 18), 0, .45, .6), at(cyl(.05, .07, .42, '#fffaf0', 10), 0, .21, .6), at(ball(.06, RED), .4, 1.12, -.04), at(box(.2, .26, .02, '#fffaf0'), -.2, 1.0, .2).rotateX(-.2));
    return g;
  },

  // ===== Tháp cầu trượt: bục 1 × 1 trên 4 cột, mái chóp, thang bên trái, máng trượt sang phải =====
  kplayset() {
    const P = .45, H = 1.0, g = group(at(rbox(1, .08, 1, .03, BLUE), -.5, H, 0));
    for (const x of [-P, P]) for (const z of [-P, P]) g.add(at(cyl(.05, .05, 1.9, YELLOW, 10), -.5 + x, .95, z));
    g.add(at(cone(.8, .5, RED, 4), -.5, 2.15, 0).rotateY(Math.PI / 4), ...[-P, P].map(z => at(box(.9, .3, .04, GREEN), -.5, H + .25, z)));
    for (let k = 0; k < 4; k++) g.add(at(cyl(.025, .025, .6, '#fffaf0', 8), -1.05, .2 + k * .24, 0).rotateX(Math.PI / 2));
    g.add(at(box(.05, 1.15, .05, YELLOW), -1.05, .575, -.3), at(box(.05, 1.15, .05, YELLOW), -1.05, .575, .3));
    const slide = group(at(box(1.5, .04, .55, PINK), 0, 0, 0), at(box(1.5, .14, .04, PINK), 0, .07, -.27), at(box(1.5, .14, .04, PINK), 0, .07, .27));
    slide.position.set(.62, .55, 0); slide.rotation.z = -Math.atan2(H - .1, 1.25);
    g.add(slide);
    return g;
  },

  // ===== Xích đu khung chữ A: xà ngang 2.4, hai ghế treo =====
  // khung chữ A (cả 3 kiểu): hai chân chụm ở xà trên (y 1.95, z 0), xoè ra ở đất (z ±.65)
  kswing() {
    const g = group(at(cyl(.05, .05, 2.5, RED, 10), 0, 1.95, 0).rotateZ(Math.PI / 2));
    for (const x of [-1.2, 1.2]) for (const s of [-1, 1]) { const leg = at(cyl(.045, .045, 2.05, BLUE, 10), x, .98, s * .33); leg.rotation.x = -s * .32; g.add(leg); }
    for (const [x, c] of [[-.5, YELLOW], [.5, GREEN]]) g.add(at(rbox(.45, .05, .2, .02, c), x, .45, 0), ...[-.18, .18].map(dx => at(cyl(.01, .01, 1.45, '#6b7078', 6), x + dx, 1.2, 0)));
    return g;
  },

  // ===== Thú nhún lò xo (kép): vịt vàng + ngựa hồng =====
  kspring: () => pairZ(1.3, .5, s => springRider(s, s < 0 ? duck : horse)),

  // ===== Hố cát 1.8 × 1.8: viền gỗ, cát, lâu đài cát, xô + xẻng =====
  ksandpit() {
    const g = group(at(box(1.6, .1, 1.6, '#efd8a4'), 0, .12, 0));
    for (const s of [-1, 1]) g.add(at(rbox(1.8, .25, .12, .04, WOOD), 0, .125, s * .84), at(rbox(.12, .25, 1.56, .04, WOOD), s * .84, .125, 0));
    g.add(at(cyl(.2, .24, .2, '#e9c58f', 14), -.3, .27, -.2), at(cone(.1, .18, RED, 4), -.3, .46, -.2), ...[-1, 1].map(s => at(cyl(.07, .08, .22, '#e9c58f', 10), -.3 + s * .25, .28, -.2)),
      at(cyl(.12, .09, .18, BLUE, 14), .35, .26, .3), at(ring(.1, .01, BLUE, Math.PI), .35, .35, .3), at(box(.05, .03, .3, YELLOW), .5, .19, -.25).rotateY(.6));
    return g;
  },

  // ===== Đu quay đẩy tay: đĩa tròn 6 múi màu, trục giữa, vòng tay vịn =====
  kmerry() {
    const g = group(at(cyl(.92, .92, .1, '#c8ccd2', 30), 0, .2, 0), at(cyl(.12, .16, .15, '#6b7078', 12), 0, .075, 0), at(cyl(.06, .06, .9, YELLOW, 10), 0, .7, 0));
    RAINBOW.forEach((c, k) => g.add(at(mesh(new THREE.CylinderGeometry(.9, .9, .03, 8, 1, false, k * Math.PI / 3, Math.PI / 3), c), 0, .265, 0)));
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add(at(cyl(.025, .025, .78, '#fffaf0', 8), Math.sin(a) * .4, .7, Math.cos(a) * .4).rotateY(a).rotateX(-.75)); }
    g.add(at(ring(.4, .025, '#fffaf0'), 0, .95, 0).rotateX(Math.PI / 2));
    return g;
  },

  // ===== Ghế băng (kép): hai ghế trước lớp, xanh + hồng =====
  kbench: () => pairX(1.9, .72, bench),
};

// ---------- Hai kiểu khác cho mỗi chỗ (cùng khuôn khổ / cùng vật cản với món gốc) ----------
Object.assign(KINDER_BUILD, {
  // Bàn tròn + 4 đôn nấm (kép)
  'kdesk-round': () => pairX(1.7, .85, s => {
    const g = group(at(cyl(.5, .5, .05, s < 0 ? YELLOW : PINK, 24), 0, .48, 0), at(cyl(.06, .1, .46, '#fffaf0', 10), 0, .23, 0));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.add(at(cyl(.07, .09, .22, '#fffaf0', 10), Math.sin(a) * .68, .11, Math.cos(a) * .68), squash(at(ball(.15, RAINBOW[k + (s > 0 ? 2 : 0)]), Math.sin(a) * .68, .24, Math.cos(a) * .68), 1, .5, 1)); }
    g.add(at(cyl(.08, .06, .1, BLUE, 12), 0, .55, 0), ...[RED, GREEN, YELLOW].map((c, k) => at(cyl(.01, .01, .14, c, 6), -.02 + k * .02, .65, 0)));
    return g;
  }),
  // Thảm + bàn thấp ngồi bệt + gối (kép)
  'kdesk-mats': () => pairX(1.7, .85, s => group(at(rbox(1.3, .03, 1.3, .015, s < 0 ? '#bfe6f6' : '#ffd9e6'), 0, .015, 0),
    at(rbox(.9, .05, .5, .02, WOOD), 0, .3, 0), ...[-1, 1].flatMap(x => [-1, 1].map(z => at(cyl(.03, .03, .27, WOOD_DARK, 8), x * .38, .15, z * .18))),
    ...[-1, 1].flatMap(z => [-.25, .25].map((x, k) => squash(at(ball(.16, RAINBOW[k * 2 + (z > 0) + (s > 0 ? 1 : 0)]), x, .09, z * .45), 1, .45, 1))),
    at(box(.3, .005, .22, '#ffffff'), 0, .328, 0))),

  // Bảng trắng: viền bạc, nam châm tròn, hình mặt trời + nhà vẽ bút màu
  'kboard-white'() {
    const g = group(at(rbox(2.4, 1.2, .06, .03, '#c8ccd2'), 0, 1.45, 0), at(box(2.24, 1.04, .02, '#ffffff'), 0, 1.45, .035), at(rbox(1.6, .04, .1, .015, '#c8ccd2'), 0, .89, .05));
    g.add(at(ring(.16, .02, YELLOW), -.6, 1.6, .05), at(box(.4, .3, .005, BLUE), .4, 1.3, .047), squash(at(cone(.3, .22, RED, 3), .4, 1.56, .055).rotateZ(Math.PI / 6), 1, 1, .02),
      ...[RED, GREEN, BLUE, YELLOW].map((c, k) => at(cyl(.035, .035, .025, c, 12), -.95 + k * .12, 1.86, .055).rotateX(Math.PI / 2)),
      ...[RED, BLUE].map((c, k) => at(cyl(.015, .015, .14, c, 8), -.2 + k * .2, .925, .05).rotateZ(Math.PI / 2)));
    return g;
  },
  // Bảng dạ ghim tranh: khung hồng, mặt bần, các tờ tranh màu + chữ cái
  'kboard-felt'() {
    const g = group(at(rbox(2.4, 1.2, .06, .03, PINK), 0, 1.45, 0), at(box(2.2, 1.0, .02, '#d9a86a'), 0, 1.45, .035));
    [[-.8, 1.7, BLUE], [-.3, 1.65, YELLOW], [.25, 1.7, GREEN], [.75, 1.62, PURPLE], [-.6, 1.2, ORANGE], [0, 1.2, '#ffffff'], [.6, 1.22, RED]].forEach(([x, y, c], k) => {
      g.add(at(box(.36, .3, .005, c), x, y, .047).rotateZ((k % 3 - 1) * .08), at(ball(.025, RED), x, y + .12, .055));
    });
    return g;
  },

  // Kệ sách (kép): ngăn xếp sách màu đứng nghiêng
  'kcubby-books': () => pairX(3.5, .82, s => cubbyUnit(s, (g, x, y) => {
    for (let k = 0; k < 5; k++) g.add(at(box(.05, .26 - (k % 2) * .04, .24, RAINBOW[(k + Math.round(x * 5)) % 6]), x - .12 + k * .06, y - .02 - (k % 2) * .02, .02));
  })),
  // Tủ móc treo balo (kép): mỗi ô một móc + balo màu
  'kcubby-lockers': () => pairX(3.5, .82, s => cubbyUnit(s, (g, x, y, c) => g.add(at(rbox(.26, .28, .14, .06, c), x, y, .08), at(rbox(.18, .1, .05, .02, '#fffaf0'), x, y - .05, .17)))),

  // Bàn cô giáo: bàn gỗ, ghế, quả táo, quả địa cầu, chồng sách
  'kpiano-desk'() {
    const g = group(at(rbox(1.2, .06, .55, .02, WOOD), 0, .75, 0), at(rbox(.06, .72, .5, .02, WOOD_DARK), -.55, .36, 0), at(rbox(.06, .72, .5, .02, WOOD_DARK), .55, .36, 0),
      at(rbox(.45, .05, .42, .02, BLUE), 0, .45, .55), at(rbox(.45, .4, .05, .02, BLUE), 0, .67, .74), ...[-1, 1].map(x => at(cyl(.02, .02, .44, '#6b7078', 6), x * .18, .22, .55)));
    g.add(at(ball(.07, RED), -.35, .85, .1), at(cyl(.008, .008, .05, WOOD_DARK, 5), -.35, .93, .1), at(ball(.13, BLUE), .3, .97, -.05), at(cyl(.06, .08, .1, YELLOW, 10), .3, .83, -.05),
      ...[RED, GREEN, YELLOW].map((c, k) => at(box(.26, .05, .18, c), -.05, .805 + k * .05, -.1)));
    return g;
  },
  // Góc nhạc cụ: đàn mộc cầm cầu vồng trên giá + trống con
  'kpiano-drums'() {
    const g = group(...[-1, 1].map(x => at(box(.05, .55, .05, WOOD_DARK), x * .5, .28, 0)), at(rbox(1.1, .05, .4, .02, WOOD), 0, .56, 0));
    RAINBOW.forEach((c, k) => g.add(at(rbox(.13, .03, .34 - k * .03, .01, c), -.4 + k * .16, .6, 0)));
    g.add(at(cyl(.24, .24, .32, RED, 20), .1, .16, .55), at(cyl(.25, .25, .02, '#fffaf0', 20), .1, .33, .55), ...[-1, 1].map(s => at(cyl(.012, .012, .3, WOOD, 6), .1 + s * .08, .36, .7).rotateZ(s * .4)));
    return g;
  },

  // Nhà chơi: tường kem, mái đỏ, cửa + cửa sổ, hộp hoa
  'kplayset-house'() {
    const g = group(at(rbox(1.6, 1.1, 1.3, .05, '#fff0c2'), -.1, .55, 0));
    for (const s of [-1, 1]) { const roof = at(box(1.0, .06, 1.5, RED), -.1 + s * .42, 1.32, 0); roof.rotation.z = -s * .62; g.add(roof); }
    g.add(at(rbox(.42, .75, .04, .02, BLUE), -.3, .38, .66), at(ball(.03, YELLOW), -.15, .4, .69), at(box(.36, .3, .02, '#bfe6f6'), .35, .7, .66),
      at(rbox(.44, .1, .14, .03, WOOD), .35, .5, .72), ...[RED, PINK, YELLOW].map((c, k) => at(ball(.05, c), .23 + k * .12, .58, .72)));
    return g;
  },
  // Cổng leo cầu vồng: các vòm ống màu nối thanh ngang
  'kplayset-tunnel'() {
    const g = group();
    RAINBOW.slice(0, 5).forEach((c, k) => { const arc = ring(.9, .045, c, Math.PI); arc.position.set(-.9 + k * .45, 0, 0); arc.rotation.y = Math.PI / 2; g.add(arc); });
    for (const a of [.5, 1.0, 1.57, 2.14, 2.64]) g.add(at(cyl(.025, .025, 1.85, '#fffaf0', 8), 0, Math.sin(a) * .9, Math.cos(a) * .9).rotateZ(Math.PI / 2));
    return g;
  },

  // Xích đu lốp xe: một lốp treo ba dây
  'kswing-tire'() {
    const g = group(at(cyl(.05, .05, 2.5, GREEN, 10), 0, 1.95, 0).rotateZ(Math.PI / 2));
    for (const x of [-1.2, 1.2]) for (const s of [-1, 1]) { const leg = at(cyl(.045, .045, 2.05, WOOD, 10), x, .98, s * .33); leg.rotation.x = -s * .32; g.add(leg); }
    g.add(at(ring(.3, .1, '#2f3238'), 0, .55, 0).rotateX(Math.PI / 2), ...[0, 1, 2].map(k => { const a = k * Math.PI * 2 / 3; return at(cyl(.01, .01, 1.4, '#6b7078', 6), Math.sin(a) * .25, 1.25, Math.cos(a) * .25); }));
    return g;
  },
  // Xích đu tổ chim: vòng đệm tròn + lưới, treo bốn dây
  'kswing-nest'() {
    const g = group(at(cyl(.05, .05, 2.5, PURPLE, 10), 0, 1.95, 0).rotateZ(Math.PI / 2));
    for (const x of [-1.2, 1.2]) for (const s of [-1, 1]) { const leg = at(cyl(.045, .045, 2.05, '#fffaf0', 10), x, .98, s * .33); leg.rotation.x = -s * .32; g.add(leg); }
    g.add(at(ring(.45, .06, ORANGE), 0, .5, 0).rotateX(Math.PI / 2), at(cyl(.43, .43, .02, '#fff0c2', 24), 0, .48, 0),
      ...[-1, 1].flatMap(x => [-1, 1].map(z => at(cyl(.01, .01, 1.5, '#6b7078', 6), x * .3, 1.22, z * .3))));
    return g;
  },

  // Ngựa gỗ bập bênh (kép)
  'kspring-rocker': () => pairZ(1.3, .5, s => group(...[-1, 1].map(x => at(ring(.42, .03, WOOD_DARK, Math.PI * .6), x * .14, .45, 0).rotateY(Math.PI / 2).rotateZ(Math.PI * 1.2)),
    squash(at(ball(.22, s < 0 ? WOOD : '#fffaf0'), 0, .5, 0), .8, .7, 1.4), at(rbox(.14, .28, .18, .05, s < 0 ? WOOD : '#fffaf0'), 0, .72, .26),
    at(rbox(.06, .2, .16, .03, s < 0 ? '#2f3238' : PINK), 0, .765, .17), at(rbox(.26, .04, .2, .015, RED), 0, .66, 0),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => at(cyl(.025, .025, .26, WOOD_DARK, 6), x * .14, .25, z * .2))))),
  // Xe đạp chân trẻ con (kép): thân xe, bốn bánh, vô lăng
  'kspring-cars': () => pairZ(1.3, .5, s => {
    const c = s < 0 ? RED : BLUE, g = group(at(rbox(.42, .22, .7, .08, c), 0, .26, 0), at(rbox(.36, .2, .2, .06, '#fffaf0'), 0, .44, -.15), at(rbox(.34, .12, .2, .05, c), 0, .4, .22));
    for (const x of [-.22, .22]) for (const z of [-.24, .24]) g.add(at(cyl(.1, .1, .06, '#2f3238', 14), x, .1, z).rotateZ(Math.PI / 2));
    g.add(at(ring(.08, .015, '#2f3238'), 0, .58, .08).rotateX(-.6), at(ball(.05, YELLOW), 0, .38, .36));
    return g;
  }),

  // Bể phao trẻ con: vòng phao hai tầng, nước, vịt cao su
  'ksandpit-paddling'() {
    return group(at(cyl(.82, .82, .03, '#8fc9f2', 30), 0, .015, 0), at(ring(.78, .1, BLUE), 0, .1, 0).rotateX(Math.PI / 2), at(ring(.78, .1, '#fffaf0'), 0, .3, 0).rotateX(Math.PI / 2),
      at(cyl(.72, .72, .03, mat('#5fc8e8', { transparent: true, opacity: .85 }), 30), 0, .3, 0), squash(at(ball(.08, YELLOW), .2, .35, .1), 1.2, .8, 1), at(ball(.05, YELLOW), .26, .42, .1),
      at(ball(.12, RED), -.3, .38, -.2));
  },
  // Bàn chơi nước: chậu nhựa hai ngăn trên chân, cối xay nước + xô
  'ksandpit-water'() {
    const g = group(at(rbox(1.3, .25, .8, .06, BLUE), 0, .55, 0), at(box(1.15, .02, .65, mat('#9fdcf0', { transparent: true, opacity: .85 })), 0, .66, 0),
      ...[-1, 1].flatMap(x => [-1, 1].map(z => at(cyl(.04, .04, .45, YELLOW, 8), x * .55, .22, z * .32))));
    g.add(at(cyl(.15, .15, .05, RED, 12), .3, .82, 0).rotateX(Math.PI / 2), at(box(.04, .3, .04, GREEN), .3, .72, -.05), at(cyl(.08, .06, .12, PINK, 12), -.35, .73, .1));
    return g;
  },

  // Bập bênh dọc: ván dài 2.2, trụ giữa, tay nắm + ghế hai đầu
  'kmerry-seesaw'() {
    const g = group(at(cone(.2, .4, '#6b7078', 4), 0, .2, 0).rotateY(Math.PI / 4), at(rbox(.3, .06, 2.2, .02, YELLOW), 0, .44, 0).rotateX(.12));
    for (const s of [-1, 1]) g.add(at(rbox(.3, .06, .3, .02, s < 0 ? RED : BLUE), 0, .5 - s * .11, s * .85), at(cyl(.02, .02, .3, '#fffaf0', 8), 0, .62 - s * .1, s * .65), at(cyl(.02, .02, .3, '#fffaf0', 8), 0, .77 - s * .1, s * .65).rotateZ(Math.PI / 2));
    return g;
  },
  // Vòng ngựa gỗ mini: đế, cột giữa, mái sọc, 4 ngựa trên cột
  'kmerry-carousel'() {
    const g = group(at(cyl(.88, .9, .15, '#fffaf0', 30), 0, .075, 0), at(cyl(.1, .1, 1.6, YELLOW, 12), 0, .9, 0));
    for (let k = 0; k < 8; k++) g.add(at(mesh(new THREE.ConeGeometry(.95, .4, 8, 1, false, k * Math.PI / 4, Math.PI / 4), k % 2 ? '#fffaf0' : PINK), 0, 1.85, 0));
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, x = Math.sin(a) * .58, z = Math.cos(a) * .58;
      const h = group(squash(at(ball(.15, RAINBOW[k + 1]), 0, 0, 0), .8, .75, 1.4), at(rbox(.1, .2, .12, .04, RAINBOW[k + 1]), 0, .15, .16));
      h.position.set(x, .55 + (k % 2) * .12, z); h.rotation.y = a + Math.PI / 2;
      g.add(h, at(cyl(.015, .015, 1.5, '#c8ccd2', 6), x, .9, z));
    }
    return g;
  },

  // Bàn picnic trẻ con (kép): bàn + hai băng ghế liền khung
  'kbench-picnic': () => pairX(1.9, .72, s => {
    const c = s < 0 ? GREEN : YELLOW, g = group(at(rbox(1.2, .05, .55, .02, c), 0, .52, 0));
    for (const z of [-1, 1]) g.add(at(rbox(1.2, .04, .22, .015, c), 0, .3, z * .45));
    for (const x of [-.48, .48]) g.add(at(box(.05, .05, 1.12, '#6b7078'), x, .28, 0), at(box(.05, .5, .05, '#6b7078'), x, .27, 0));
    return g;
  }),
  // Ghế bồn hoa (kép): bồn gỗ trồng hoa, mặt ngồi hai bên
  'kbench-planter': () => pairX(1.9, .72, s => {
    const g = group(at(rbox(1.3, .42, .42, .04, WOOD), 0, .21, 0), at(box(1.2, .03, .34, '#6b4a2f'), 0, .41, 0));
    for (let k = 0; k < 6; k++) g.add(at(cyl(.012, .012, .2, '#5fae46', 5), -.5 + k * .2, .5, 0), at(ball(.07, RAINBOW[(k + (s > 0 ? 2 : 0)) % 6]), -.5 + k * .2, .62, 0));
    return g;
  }),
});

// Bảng treo tường sau lớp học (đáy cách sàn ~.85): không tính lơ lửng.
for (const id of ['kboard', 'kboard-white', 'kboard-felt']) {
  const make = KINDER_BUILD[id];
  KINDER_BUILD[id] = () => { const node = make(); node.userData.wallMounted = true; return node; };
}
