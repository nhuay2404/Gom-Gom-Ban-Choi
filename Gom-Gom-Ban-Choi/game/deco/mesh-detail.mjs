// Giữ cảnh 3D nhẹ: (1) số cạnh cầu / trụ theo kích thước vật (viên sỏi không cần lưới mịn như quả bóng to),
// (2) gộp các khối tĩnh cùng chất liệu trong một cụm đồ trang trí thành MỘT mesh: ít lệnh vẽ hơn hẳn, vì mỗi mesh
// còn bị vẽ lại ở pass bóng đổ, pass ID viền và lớp viền mực (toon.mjs).
// (3) khối bo góc an toàn: roundedBox() chặn bán kính bo không vượt nửa cạnh mỏng nhất (xem CLAUDE.md, quy tắc model).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Bán kính bo lớn hơn nửa cạnh mỏng nhất làm RoundedBoxGeometry gập ngược mặt (sáng tối nhấp nháy, viền răng cưa) —
// lỗi nắp laptop dày 1.5 cm bo 1 cm. MỌI khối bo góc phải tạo qua hàm này: tự hạ bán kính về ≤ nửa cạnh mỏng nhất và
// ghi lại để công cụ QC (qc.mjs) báo món nào đang khai báo sai.
export const ROUND_LIMIT = .5;
export const geometryNotes = [];
export function roundedBox(w, h, d, segments, r) {
  const max = Math.min(w, h, d) * ROUND_LIMIT;
  if (r > max + 1e-9) geometryNotes.push(`roundedBox ${[w, h, d].map(n => +n.toFixed(3)).join('×')} bo ${r} > ${+max.toFixed(4)}`);
  // Số nấc bo theo bán kính: góc bo ≤ 2.5 cm nhìn từ camera Deco chỉ vài px, 1 nấc (vát) là đủ; ≤ 5 cm dùng 2 nấc. Mỗi hộp
  // 3 nấc = 588 tam giác, 1 nấc = 108: hàng rào trắng ~70 chấn song từ 40 nghìn còn ~8 nghìn tam giác (đo được), x2 vì pass viền.
  const rr = Math.min(r, max), steps = rr <= .025 ? Math.min(segments, 1) : rr <= .05 ? Math.min(segments, 2) : segments;
  return new RoundedBoxGeometry(w, h, d, steps, rr);
}

const clampRound = (value, min, max) => Math.max(min, Math.min(max, Math.round(value)));
// Số cạnh quanh / số tầng cho cầu bán kính r (m): r .03 -> 10×7, r .2 -> 22×16, r ≥ .26 -> 28×20.
export const sphereSegments = r => [clampRound(r * 110, 10, 28), clampRound(r * 80, 7, 20)];
// Số cạnh quanh cho trụ bán kính r: r .06 -> 10, r .3 -> 21, r ≥ .46 -> 32.
export const radialSegments = r => clampRound(r * 70, 10, 32);

const IDENTITY = new THREE.Matrix4();
const keyOf = (mesh, m) => [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.map?.uuid, m.transparent, m.opacity,
  m.side, m.vertexColors, m.userData.toonRim, m.userData.toonSpec, mesh.castShadow, mesh.receiveShadow, !!mesh.userData.noOutline].join('|');

// Gộp mọi mesh con (kể cả lồng sâu) của `root` theo chất liệu. Chỉ gọi cho cụm mà KHÔNG có code nào giữ tham chiếu
// tới từng khối con (để rung / lăn / xoay riêng); cả cụm vẫn di chuyển / xoay / rung được như một khối.
// Bỏ qua InstancedMesh, mesh có nhiều chất liệu và đèn; các node đó giữ nguyên chỗ.
// Công cụ QC tắt gộp để soi từng khối riêng (gộp rồi thì khung bao của cả bucket màu trùm lên nhiều món).
let mergeEnabled = true;
export function withoutMerging(build) { mergeEnabled = false; try { return build(); } finally { mergeEnabled = true; } }

// bakeColors (bản đồ màn, map-world.mjs): chất liệu toon trơn (không texture, không trong suốt, không phát sáng) chỉ khác nhau ở
// MÀU thì gộp chung: màu chất liệu ghi vào màu đỉnh, cả cụm dùng một chất liệu trắng có vertexColors. Một đoạn trang trí
// nhiều màu (cây, hoa, đá, rào...) từ ~20 lệnh vẽ còn 1–2 (x2 vì pass bóng đổ). Màu đỉnh nhân vào trước bước pastel của
// toon.mjs (PASTEL_CHUNK thay <color_fragment>) nên màu ra y hệt chất liệu riêng.
const bakeable = m => m.isMeshToonMaterial && !m.map && !m.transparent && !m.vertexColors && !m.emissiveMap && m.emissive.getHex() === 0
  && m.userData.toonRim !== undefined && m.opacity === 1;
const bakedMats = new Map();
function bakedMaterial(m) {
  const key = [m.userData.toonRim, m.userData.toonSpec, m.side, m.gradientMap?.uuid, m.onBeforeCompile === undefined].join('|');
  if (!bakedMats.has(key)) {
    const out = m.clone();
    out.color.set(0xffffff);
    out.vertexColors = true;
    out.userData = { ...m.userData, bakedColors: true }; // QC: màu đỉnh ở đây là màu phẳng của từng khối, không phải gradient
    bakedMats.set(key, out);
  }
  return bakedMats.get(key);
}

export function mergeStatic(root, { bakeColors = false } = {}) {
  if (!mergeEnabled) return root;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse(node => {
    if (!node.isMesh || node.isInstancedMesh || Array.isArray(node.material) || node === root) return;
    const bake = bakeColors && bakeable(node.material);
    const material = bake ? bakedMaterial(node.material) : node.material;
    const key = (bake ? 'baked|' : '') + keyOf(node, material);
    const geo = node.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, node.matrixWorld));
    // Đồng bộ thuộc tính để gộp được: luôn có position / normal / uv, có index; màu đỉnh chỉ khi chất liệu dùng.
    // Chất liệu không có texture thì bỏ uv (bản đồ màn: ~1/5 dung lượng lưới, đỡ thời gian đẩy lên GPU).
    const needUv = !bakeColors || !!(material.map || material.alphaMap || material.normalMap || material.emissiveMap);
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', ...(needUv ? ['uv'] : []), ...(material.vertexColors && !bake ? ['color'] : [])].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (needUv && !geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (bake) {
      // màu đỉnh 16-bit chuẩn hoá (6 byte / đỉnh thay cho 12): đủ mịn cho màu tuyến tính, không lệch màu tối như 8-bit
      const q = v => Math.round(Math.min(1, Math.max(0, v)) * 65535);
      const { r, g, b } = node.material.color, n = geo.attributes.position.count, color = new Uint16Array(n * 3), rgb = [q(r), q(g), q(b)];
      for (let i = 0; i < n; i++) color.set(rgb, i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(color, 3, true));
    }
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    geo.clearGroups();
    (buckets.get(key) || buckets.set(key, { mesh: node, material, geos: [], nodes: [] }).get(key)).geos.push(geo);
    buckets.get(key).nodes.push(node);
  });
  // Bucket chỉ có một khối thì để nguyên, trừ khi cần đổi sang chất liệu nướng màu (để cả cụm chung một chất liệu).
  const merging = [...buckets.values()].filter(b => b.geos.length > 1 || b.material !== b.mesh.material);
  const gone = new Set(merging.flatMap(b => b.nodes));
  for (const { geos } of buckets.values()) if (!merging.some(b => b.geos === geos)) geos.forEach(g => g.dispose());
  for (const { mesh, material, geos, nodes } of merging) {
    const geometry = mergeGeometries(geos);
    geos.forEach(g => g.dispose());
    if (!geometry) { nodes.forEach(node => gone.delete(node)); continue; }
    const out = new THREE.Mesh(geometry, material);
    out.castShadow = mesh.castShadow; out.receiveShadow = mesh.receiveShadow;
    if (mesh.userData.noOutline) out.userData.noOutline = true;
    out.userData.mergedTypes = [...new Set(nodes.map(node => node.geometry.type))]; // QC toon: loại lưới gốc (xuyến, lưới tiện... có mặt lõm thật)
    out.matrix.copy(IDENTITY); root.add(out);
  }
  // Gỡ các khối đã gộp. Khối con KHÔNG được gộp (bucket một khối, InstancedMesh...) gắn lại vào root, giữ đúng vị trí.
  for (const node of gone) {
    for (const child of [...node.children]) if (!gone.has(child)) { child.applyMatrix4(node.matrixWorld); child.applyMatrix4(toRoot); root.add(child); }
    if (node.parent) node.parent.remove(node);
  }
  // Nhóm con rỗng sau khi gộp: bỏ cho cây cảnh gọn.
  const empties = [];
  root.traverse(node => { if (node !== root && node.isGroup && node.children.length === 0) empties.push(node); });
  empties.forEach(node => node.parent?.remove(node));
  return root;
}
