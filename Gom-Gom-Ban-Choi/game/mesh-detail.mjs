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
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, max));
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
export function mergeStatic(root) {
  if (!mergeEnabled) return root;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  root.traverse(node => {
    if (!node.isMesh || node.isInstancedMesh || Array.isArray(node.material) || node === root) return;
    const key = keyOf(node, node.material);
    const geo = node.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, node.matrixWorld));
    // Đồng bộ thuộc tính để gộp được: luôn có position / normal / uv, có index; màu đỉnh chỉ khi chất liệu dùng.
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', ...(node.material.vertexColors ? ['color'] : [])].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    geo.clearGroups();
    (buckets.get(key) || buckets.set(key, { mesh: node, geos: [] }).get(key)).geos.push(geo);
    victims.push(node);
  });
  let merged = 0;
  for (const { mesh, geos } of buckets.values()) {
    if (geos.length < 2) { geos.forEach(g => g.dispose()); continue; }
    const geometry = mergeGeometries(geos);
    geos.forEach(g => g.dispose());
    if (!geometry) continue;
    const out = new THREE.Mesh(geometry, mesh.material);
    out.castShadow = mesh.castShadow; out.receiveShadow = mesh.receiveShadow;
    if (mesh.userData.noOutline) out.userData.noOutline = true;
    out.matrix.copy(IDENTITY); root.add(out);
    // Gỡ các khối đã gộp (chỉ những khối thuộc bucket này).
    const key = keyOf(mesh, mesh.material);
    for (const node of victims) if (keyOf(node, node.material) === key && node.parent) { node.parent.remove(node); node.geometry.dispose(); }
    merged++;
  }
  // Nhóm con rỗng sau khi gộp: bỏ cho cây cảnh gọn.
  const empties = [];
  root.traverse(node => { if (node !== root && node.isGroup && node.children.length === 0) empties.push(node); });
  empties.forEach(node => node.parent?.remove(node));
  return root;
}
