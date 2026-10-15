// Ngoại thất ngôi nhà: zoom ra xa (deco-room.mjs EXTERIOR_FROM) thì mỗi phòng trong nhà đã mở được phủ một vỏ nhà — tường kem, chân tường,
// mái ngói lớn (buildRoof), cửa sổ có khung + kính + song chữ thập, cửa chính + bậc thềm phía vườn, ống khói phòng khách. Zoom vào lại thì vỏ hạ xuống,
// thấy nội thất như cũ. Toạ độ cục bộ của mỗi phần: tâm phòng ở gốc (đặt theo ZONE_OFFSET), mặt +z quay ra vườn.
import * as THREE from 'three';
import { roundedBox } from '../render/mesh-detail.mjs';
import { ROOM_HALF, WALL_H, DOOR } from '../room-layout.mjs';
import { TOON, toonMat } from '../render/toon.mjs';

const mat = color => TOON ? toonMat({ color }) : new THREE.MeshPhysicalMaterial({ color, roughness: .9 });
const mesh = (geometry, color) => { const m = new THREE.Mesh(geometry, mat(color)); m.castShadow = m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, color) => mesh(roundedBox(w, h, d, 3, r), color);
const at = (node, x, y, z) => { node.position.set(x, y, z); return node; };

const WALL = '#fbe7cc', TRIM = '#d9a77a', ROOF = '#e57f62', ROOF_EDGE = '#b9573f', FRAME = '#ffffff', GLASS = '#a5d6f2', DOOR_C = '#b9774a';
const S = ROOM_HALF + .18; // nửa cạnh vỏ: phủ kín tường trong + nửa khe giữa hai phòng
// Mỗi phòng: các mặt có cửa sổ (u = vị trí dọc mặt), cửa chính (mặt +z phòng khách), ống khói. Mặt: 'n' -z, 's' +z, 'w' -x, 'e' +x.
const ROOMS = {
  living: { windows: { s: [1.6], n: [-1.6, 1.6] }, door: DOOR.x, chimney: [2, -1.5] },
  bedroom: { windows: { s: [-1.8, 1.4], w: [-1.6, 1.6] } },
  kitchen: { windows: { s: [-1.6, 1.6], e: [-1.6, 1.6] } },
  bathroom: { windows: { n: [0], w: [0] } },
};

function windowOn(u) {
  const g = new THREE.Group();
  g.add(at(rbox(1.0, 1.15, .07, .03, FRAME), 0, 0, .035));
  g.add(at(rbox(.84, .99, .04, .015, GLASS), 0, 0, .085)); // kính nổi trên khung 1.5 cm (không z-fighting)
  g.add(at(rbox(.06, .99, .03, .012, FRAME), 0, 0, .12), at(rbox(.84, .06, .03, .012, FRAME), 0, 0, .12)); // song chữ thập
  g.add(at(rbox(1.15, .08, .16, .03, TRIM), 0, -.62, .08)); // bậu cửa
  g.position.set(u, WALL_H * .55, S);
  return g;
}
// MỘT mái lớn cho cả ngôi nhà: mỗi cánh nhà (dãy phòng ngủ - khách - bếp, cánh phòng tắm phía sau) một mái bốn mái kiểu có nóc dài,
// cánh sau cắm vào giữa cánh trước -> hai mái giao nhau thành một mái chữ L liền. Lợp bằng các tầng ngói thụt đều (khối chóp cụt
// chữ nhật), hai tông xen kẽ, chìa mép ra ngoài tường: nhìn từ xa vẫn thấy dáng mái + hàng ngói.
const ROOF_TIERS = 9, ROOF_SLOPE = .72, EAVE = .4, ROOF_TONES = [ROOF, '#d4694f'];
// Khối chóp cụt đáy (w0 × d0) ở y0, đỉnh (w1 × d1) ở y1, tâm ở gốc; mặt phẳng phẳng (pháp tuyến từng mặt).
function frustum(w0, d0, w1, d1, y0, y1) {
  const B = [[-w0, -d0], [w0, -d0], [w0, d0], [-w0, d0]].map(([x, z]) => [x / 2, y0, z / 2]);
  const T = [[-w1, -d1], [w1, -d1], [w1, d1], [-w1, d1]].map(([x, z]) => [x / 2, y1, z / 2]);
  const p = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; p.push(...B[i], ...T[j], ...B[j], ...B[i], ...T[i], ...T[j]); }
  p.push(...T[0], ...T[2], ...T[1], ...T[0], ...T[3], ...T[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
function hipRoof(w, d) {
  const g = new THREE.Group(), W = w + EAVE * 2, D = d + EAVE * 2, short = Math.min(W, D), h = short / 2 * ROOF_SLOPE, step = short / 2 / ROOF_TIERS;
  for (let i = 0; i < ROOF_TIERS; i++) {
    const lip = i ? .06 : 0; // mỗi tầng ngói chìa mép xuống tầng dưới một chút
    const w0 = W - 2 * step * i + lip, d0 = D - 2 * step * i + lip, w1 = Math.max(.02, W - 2 * step * (i + 1)), d1 = Math.max(.02, D - 2 * step * (i + 1));
    g.add(mesh(frustum(w0, d0, w1, d1, h * i / ROOF_TIERS, h * (i + 1) / ROOF_TIERS + .01), ROOF_TONES[i % 2]));
  }
  g.add(mesh(frustum(W + .08, D + .08, W, D, -.16, 0), ROOF_EDGE)); // viền mái
  g.traverse(node => { if (node.isMesh) node.raycast = () => {}; });
  return g;
}
// Mái cho các phòng đang mở: cánh trước = các phòng hàng trước liền nhau, cánh sau (phòng tắm) cắm tới nóc cánh trước.
export function buildRoof(open, offset) {
  const g = new THREE.Group(), front = ['bedroom', 'living', 'kitchen'].filter(z => open.includes(z));
  if (!front.length) return g;
  const xs = front.map(z => offset[z][0]), fz = offset.living[1];
  const fw = Math.max(...xs) - Math.min(...xs) + S * 2;
  g.add(at(hipRoof(fw, S * 2), (Math.max(...xs) + Math.min(...xs)) / 2, WALL_H, fz));
  if (open.includes('bathroom')) {
    const [bx, bz] = offset.bathroom, z0 = bz - S, z1 = fz;
    g.add(at(hipRoof(S * 2, z1 - z0), bx, WALL_H + .005, (z0 + z1) / 2));
  }
  return g;
}
function roomShell(spec) {
  const g = new THREE.Group();
  g.add(at(rbox(S * 2, WALL_H, S * 2, .06, WALL), 0, WALL_H / 2, 0));
  g.add(at(rbox(S * 2 + .08, .32, S * 2 + .08, .05, TRIM), 0, .16, 0)); // chân tường
  const faces = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
  for (const [face, us] of Object.entries(spec.windows)) {
    for (const u of us) { const side = new THREE.Group(); side.add(windowOn(u)); side.rotation.y = faces[face]; g.add(side); }
  }
  if (spec.door !== undefined) {
    const d = new THREE.Group();
    d.add(at(rbox(1.1, 2.05, .08, .03, FRAME), 0, 1.03, .04), at(rbox(.92, 1.92, .06, .03, DOOR_C), 0, .98, .1));
    d.add(at(new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), mat('#ffd23f')), .3, .95, .15));
    d.add(at(rbox(1.4, .14, .5, .04, TRIM), 0, .07, .25)); // bậc thềm
    d.position.set(spec.door, 0, S);
    g.add(d);
  }
  if (spec.chimney) g.add(at(rbox(.55, 1.6, .55, .05, '#c9826a'), spec.chimney[0], WALL_H + 2.4, spec.chimney[1]), at(rbox(.7, .14, .7, .04, ROOF_EDGE), spec.chimney[0], WALL_H + 3.25, spec.chimney[1]));
  g.traverse(node => { if (node.isMesh) node.raycast = () => {}; }); // không chặn chạm chọn món / sàn bên trong
  return g;
}

// { [zone]: group } cho từng phòng trong nhà; deco-room.mjs đặt theo ZONE_OFFSET và bật theo phòng đã mở.
export function buildHouseExterior() {
  return Object.fromEntries(Object.entries(ROOMS).map(([zone, spec]) => [zone, roomShell(spec)]));
}
