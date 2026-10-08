// QC model 3D (chỉ cho dev: Settings → "Dev: QC models", hoặc mở game với ?qc). Gom mọi lỗi model từng gặp thành
// phép kiểm tra tự động; chạy lại sau MỖI lần thêm / sửa model hay đổi chỗ đặt đồ (quy tắc đầy đủ: CLAUDE.md).
//   round   : khối bo góc khai báo bán kính > nửa cạnh mỏng nhất (đã tự hạ bán kính, nhưng phải sửa số ở model)
//   decal   : tấm phẳng (màn hình, tranh, mặt đồng hồ...) cách mặt khối phía sau < 4 mm -> chớp z-fighting
//   shell   : vỏ mỏng hở (trụ hở, tấm cong) có viền toon -> lòng vật bị phủ mảng tối (lỗi võng / chao đèn)
//   floor   : món đồ lún xuống mặt đất (kể cả lún vào sườn đồi) hoặc lơ lửng — đo theo mặt đất thật (groundHeight)
//   bounds  : lấn qua tường phòng / hàng rào vườn (đồ phần vườn mở rộng: theo rào lúc đã mở rộng; đồ vườn gốc: rào vuông)
//   overlap : chạm cánh cửa (mở lẫn đóng), đồ treo tường, đồ trang trí cố định, món khác cùng khu, bụi góc vườn
//   lane    : vật cản của mèo chắn lối 1 m trước cửa / cổng (tính từ LINKS; lối thông thoáng `open` không tính)
//   zfight  : hai khối hộp của vỏ khu nhà (sàn, nền vườn, tường) có hai mặt cùng phẳng, cùng hướng và chồng lên nhau > 1 cm mỗi chiều
//             (hai đỉnh tường của hai phòng giáp nhau, mặt nền chồng nền...) -> hai màu giành nhau từng điểm ảnh, chớp thành sọc
//   glow    : model phát sáng ban đêm (vật liệu emissive hoặc MeshBasicMaterial không nhận sáng) mà không phải nguồn sáng
//             (không có đèn PointLight bên trong và không khai userData.lightSource = true). Chỉ đèn / lửa / màn hình / dải LED
//             mới được sáng; tranh, cờ, nước, bầu trời... dùng userData: { nightDim: true } để ban đêm tối lại cùng cảnh
//   preview : popup xem trước ở Shop còn bị che sau khi đã ẩn vật chắn (chạy trong cảnh thật: deco-room.mjs qcPreview,
//             menu-controller.js runQC gọi cho từng món, mọi khu mở)
// Mọi món đều dựng mới với chế độ không gộp khối (withoutMerging) để đo từng khối riêng, theo toạ độ của khu.
import * as THREE from 'three';
import { CATALOG, slotOf } from './deco-data.mjs';
import { PLACES, ROOM_HALF as H, OBSTACLE_RADIUS, ZONE_OFFSET, LINKS, groundHeight, gardenBounds } from './room-layout.mjs';
import { geometryNotes, withoutMerging } from './mesh-detail.mjs';

const DECAL_GAP = .004;          // tấm phẳng phải cách mặt khối phía sau ít nhất 4 mm
const FENCE_GAP = .11;           // mặt trong của rào dày nhất (hàng rào cây .32, tường đá .3) cách khung vườn .11
const OUTDOOR = new Set(['garden']);
// Khung đặt đồ (toạ độ khu): trong nhà là tường; vườn là mặt trong rào — đồ phần mở rộng theo khung đã mở rộng,
// đồ vườn gốc theo khung vuông (rào bên phải vẫn ở x = ROOM_HALF khi chưa mở rộng).
const innerBounds = (zone, expanded) => {
  if (!OUTDOOR.has(zone)) return { x0: -H, x1: H, z0: -H, z1: H };
  const b = gardenBounds(expanded);
  return { x0: b.x0 + FENCE_GAP, x1: b.x1 - FENCE_GAP, z0: b.z0 + FENCE_GAP, z1: b.z1 - FENCE_GAP };
};
const outside = (box, l) => box.min.x < l.x0 || box.max.x > l.x1 || box.min.z < l.z0 || box.max.z > l.z1;
const FLAT_SLOTS = new Set(['rug', 'bedrug', 'flowers']); // mặt đất đi được: không tính chạm
const FLAT_TYPES = new Set(['PlaneGeometry', 'CircleGeometry', 'ShapeGeometry', 'RingGeometry']);
// Khối có mặt phẳng lớn (chỗ tấm phẳng dán lên dễ chớp z-fighting). Cầu / ống / xuyến chỉ chạm điểm: không tính.
const FACETED = new Set(['BoxGeometry', 'RoundedBoxGeometry', 'CylinderGeometry', 'ExtrudeGeometry']);
const v = new THREE.Vector3(), w = new THREE.Vector3();

// Danh sách khối (mesh) của một cụm, kèm khung bao theo toạ độ khu (trừ tâm khu `off`). InstancedMesh (cỏ, hoa, lá rời)
// tách thành từng bản: khung bao chung của cả nghìn bản sẽ trùm cả khu và báo chạm nhầm.
// Mỗi phần giữ thêm `low` = độ cao thấp nhất so với mặt đất ngay dưới nó (âm = lún), nếu truyền `zone`.
function parts(root, off = [0, 0], zone = null) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse(n => {
    if (!n.isMesh || n.userData.outline) return;
    const p = n.geometry.attributes.position, m = new THREE.Matrix4();
    const measure = mat => {
      const b = new THREE.Box3(); let low = Infinity;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mat); v.x -= off[0]; v.z -= off[1]; b.expandByPoint(v);
        if (zone) low = Math.min(low, v.y - groundHeight(zone, v.x, v.z));
      }
      return { mesh: n, b, low };
    };
    if (n.isInstancedMesh) for (let k = 0; k < n.count; k++) { n.getMatrixAt(k, m); out.push(measure(m.premultiply(n.matrixWorld))); }
    else out.push(measure(n.matrixWorld));
  });
  return out;
}
const union = list => list.reduce((acc, x) => acc.union(x.b), new THREE.Box3());
const overlapSize = (a, b) => { const i = a.clone().intersect(b); return i.isEmpty() ? null : i.getSize(new THREE.Vector3()); };
const real = s => s && s.x > .01 && s.y > .01 && s.z > .01;
// Hai cụm chạm nhau thật: có cặp khối (mesh) nào giao nhau > 1 cm mỗi chiều.
const touches = (listA, listB) => listA.some(a => listB.some(b => real(overlapSize(a.b, b.b))));
const fmt = n => +n.toFixed(2);

// Tấm phẳng quá sát mặt khối khác trong cùng cụm (z-fighting): xét từng TAM GIÁC của khối có mặt phẳng — mặt phẳng
// lớn của khối bo góc chỉ có đỉnh ở 4 góc, đếm đỉnh nằm dưới tấm phẳng sẽ bỏ sót (lỗi màn hình laptop cách nắp 1.5 mm).
// Đổi tam giác sang toạ độ của tấm phẳng (tấm nằm trong mặt z = 0): song song (|nz| > .95), cách < DECAL_GAP và hình
// chiếu chồng lên tấm (thu nhỏ 10%) thì báo lỗi.
function decalIssues(list) {
  const issues = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3(), m = new THREE.Matrix4();
  const meshes = [...new Set(list.map(x => x.mesh))].filter(mesh => !mesh.isInstancedMesh);
  for (const d of meshes) {
    if (!FLAT_TYPES.has(d.geometry.type)) continue;
    d.geometry.computeBoundingBox();
    const fb = d.geometry.boundingBox, mx = (fb.max.x - fb.min.x) * .05, my = (fb.max.y - fb.min.y) * .05;
    const inv = new THREE.Matrix4().copy(d.matrixWorld).invert();
    for (const o of meshes) {
      if (o === d || !FACETED.has(o.geometry.type)) continue;
      m.multiplyMatrices(inv, o.matrixWorld);
      const g = o.geometry, p = g.attributes.position, idx = g.index, tris = (idx ? idx.count : p.count) / 3;
      let hit = false;
      for (let t = 0; t < tris && !hit; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(p, i0).applyMatrix4(m); b.fromBufferAttribute(p, i1).applyMatrix4(m); c.fromBufferAttribute(p, i2).applyMatrix4(m);
        nrm.subVectors(b, a).cross(w.subVectors(c, a));
        const len = nrm.length(); if (len < 1e-12 || Math.abs(nrm.z / len) < .95) continue;
        if (Math.abs((a.z + b.z + c.z) / 3) >= DECAL_GAP) continue;
        const x0 = Math.min(a.x, b.x, c.x), x1 = Math.max(a.x, b.x, c.x), y0 = Math.min(a.y, b.y, c.y), y1 = Math.max(a.y, b.y, c.y);
        hit = x1 > fb.min.x + mx && x0 < fb.max.x - mx && y1 > fb.min.y + my && y0 < fb.max.y - my;
      }
      if (hit) { issues.push(`tấm phẳng #${d.material.color?.getHexString()} cách mặt khối #${o.material.color?.getHexString()} < ${DECAL_GAP * 1000} mm (z-fighting)`); break; }
    }
  }
  return issues;
}
// Vỏ mỏng hở có viền toon: viền "inverted hull" phủ mảng tối vào lòng vật. (Vòm đồi đặt `closedByGround`: đáy nằm dưới đất.)
const shellIssues = list => [...new Set(list.map(x => x.mesh))].filter(mesh => {
  const g = mesh.geometry, pr = g.parameters || {};
  const open = (g.type === 'CylinderGeometry' && pr.openEnded) || g.type === 'LatheGeometry' || (mesh.material.side === THREE.DoubleSide && !FLAT_TYPES.has(g.type) && g.type !== 'ExtrudeGeometry');
  return open && !mesh.userData.noOutline && !mesh.userData.closedByGround && mesh.material.isMeshToonMaterial && !mesh.material.transparent;
}).map(mesh => `vỏ mỏng hở ${mesh.geometry.type} #${mesh.material.color?.getHexString()} có viền toon (đặt userData.noOutline + viền mép riêng)`);

// Model có phần phát sáng nhưng không phải nguồn sáng: ban đêm cảnh tối đi còn phần đó vẫn sáng rực (emissive, hoặc
// MeshBasicMaterial vốn không nhận sáng). Nguồn sáng thật = có PointLight bên trong hoặc userData.lightSource (màn hình, dải LED).
export function glowIssues(node) {
  let source = !!node.userData.lightSource;
  node.traverse(n => { if (n.isLight || n.userData.lightSource) source = true; });
  if (source) return [];
  const seen = new Set(), out = [];
  node.traverse(n => {
    if (!n.isMesh || n.userData.outline || n.userData.lightSource) return;
    for (const m of [].concat(n.material)) {
      if (!m || seen.has(m) || m.colorWrite === false) continue;
      const emits = m.emissive && m.emissive.getHex() !== 0 && (m.emissiveIntensity ?? 1) > .05;
      const unlit = m.isMeshBasicMaterial && !m.userData?.nightDim && !n.userData.nightDim;
      if (!emits && !unlit) continue;
      seen.add(m);
      out.push(`phát sáng ban đêm nhưng không phải nguồn sáng: ${emits ? 'emissive' : 'MeshBasicMaterial'} #${m.color?.getHexString?.() ?? ''} (thêm đèn / userData.lightSource, hoặc đổi vật liệu / userData.nightDim)`);
    }
  });
  return out;
}

// Z-fighting của vỏ khu nhà: `shells` là danh sách NHÓM (mỗi nhóm = một khu: nền vườn, hoặc phòng), duyệt mọi khối hộp (BoxGeometry)
// rồi so từng cặp mặt cùng hướng GIỮA HAI NHÓM KHÁC NHAU (chồng nhau trong một nhóm là cấu tạo của chính nhóm: trụ cửa, ốp chân tường...).
// Mặt đáy (y-) không tính: camera luôn nhìn từ trên xuống. Tính theo khung bao thế giới (khối hộp không xoay nghiêng nên khung bao =
// chính khối). Hai khối chỉ chạm mép (diện tích 0) không tính.
export function zFightIssues(shells) {
  const boxes = [];
  shells.forEach((roots, group) => {
    for (const root of [].concat(roots)) {
      root.updateMatrixWorld(true);
      root.traverse(n => {
        if (!n.isMesh || n.userData.outline || n.geometry?.type !== 'BoxGeometry') return;
        boxes.push({ mesh: n, group, b: new THREE.Box3().setFromObject(n) });
      });
    }
  });
  const out = [], axes = ['x', 'y', 'z'], MIN = .01, SAME = .003;
  const dim = bx => `[x ${bx.min.x.toFixed(2)}..${bx.max.x.toFixed(2)} y ${bx.min.y.toFixed(2)}..${bx.max.y.toFixed(2)} z ${bx.min.z.toFixed(2)}..${bx.max.z.toFixed(2)}]`;
  const color = m => [].concat(m.material)[0]?.color?.getHexString?.() ?? '';
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (boxes[i].group === boxes[j].group) continue;
    const a = boxes[i].b, b = boxes[j].b;
    if (a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y || a.max.z < b.min.z || b.max.z < a.min.z) continue;
    for (const axis of axes) {
      const others = axes.filter(k => k !== axis);
      const overlaps = others.every(k => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > MIN);
      if (!overlaps) continue;
      for (const face of ['max', 'min']) {
        if (axis === 'y' && face === 'min') continue;
        if (Math.abs(a[face][axis] - b[face][axis]) >= SAME) continue;
        out.push(`mặt ${axis}${face === 'max' ? '+' : '-'} của hai khối (#${color(boxes[i].mesh)} / #${color(boxes[j].mesh)}) trùng nhau tại ${axis} = ${a[face][axis].toFixed(2)} [x ${Math.max(a.min.x, b.min.x).toFixed(1)}, z ${Math.max(a.min.z, b.min.z).toFixed(1)}] -> z-fighting; khối A ${dim(a)} khối B ${dim(b)}`);
      }
    }
  }
  return out;
}

// Kiểm tra MỘT model (dùng khi vừa tạo / sửa model): build() trả về node đã đặt đúng vị trí + xoay (+ độ cao mặt đất).
// zone: khu đặt món (đo lún / lơ lửng theo mặt đất thật của khu, vd. sườn đồi ở phần vườn mở rộng).
// Trả về { node, list (từng khối), box, issues: [chuỗi lỗi] } — bo góc sai, tấm phẳng sát mặt, vỏ hở có viền, lún / lơ lửng.
export function checkModel(build, zone = 'garden') {
  geometryNotes.length = 0;
  const node = withoutMerging(build);
  node.userData.update?.(0); // bộ phận cử động (cá, chim, bóng treo) về đúng tư thế khung hình đầu
  const list = parts(node, [0, 0], zone), box = union(list), issues = [...geometryNotes, ...decalIssues(list), ...shellIssues(list), ...glowIssues(node)];
  const sink = node.userData.sink || 0, low = Math.min(...list.map(p => p.low)); // sink: phần chôn xuống đất có chủ đích
  if (low < -.01 - sink) issues.push(`lún xuống mặt đất ${fmt(-low * 100)} cm (cho phép ${fmt(sink * 100)} cm qua userData.sink)`);
  if (low > .05 && !node.userData.wallMounted) issues.push(`lơ lửng ${fmt(low * 100)} cm trên mặt đất (đồ treo tường: userData.wallMounted)`);
  return { node, list, box, issues };
}

// Lối 1 m trước mỗi cửa / cổng (toạ độ khu), suy từ LINKS: trục nối hai khu + vị trí cửa dọc tường.
function doorLanes() {
  const lanes = {};
  for (const { a, b, at, w: width, open } of LINKS) {
    if (open) continue; // lối thông thoáng cả bề ngang (vườn <-> phần mở rộng): không có cửa để chắn
    const [ax, az] = ZONE_OFFSET[a], [bx, bz] = ZONE_OFFSET[b], alongX = Math.abs(ax - bx) > Math.abs(az - bz);
    for (const [zone, other] of [[a, b], [b, a]]) {
      const [zx, zz] = ZONE_OFFSET[zone], [ox, oz] = ZONE_OFFSET[other], half = width / 2 + .1;
      const lane = alongX
        ? { x0: ox > zx ? H - 1 : -H, x1: ox > zx ? H : -H + 1, z0: at - zz - half, z1: at - zz + half }
        : { x0: at - zx - half, x1: at - zx + half, z0: oz > zz ? H - 1 : -H, z1: oz > zz ? H : -H + 1 };
      (lanes[zone] ||= []).push({ name: `lối sang ${other}`, ...lane });
    }
  }
  return lanes;
}

// ctx: { BUILD, interiors, specs, wallDefs, zoneOffset, setLeaf, gardenCorners(bounds), outdoorDecor: { [khu ngoài trời]: () => group } }
export function runModelQC(ctx) {
  const report = [];
  const add = (level, zone, what) => report.push({ level, zone, what });
  const items = [];
  for (const entry of CATALOG.filter(e => e.cat === 'furniture')) {
    const slot = slotOf(entry), [x, z, rot] = PLACES[slot];
    const { list, box, issues } = checkModel(() => {
      const node = ctx.BUILD[entry.id]();
      node.position.set(x, groundHeight(entry.zone, x, z), z); node.rotation.y = rot ?? Math.atan2(-x, -z);
      return node;
    }, entry.zone);
    issues.forEach(m => add('error', entry.zone, `${entry.id}: ${m}`));
    if (outside(box, innerBounds(entry.zone, entry.area === 'garden2')))
      add('error', entry.zone, `${entry.id}: lấn ${OUTDOOR.has(entry.zone) ? 'hàng rào' : 'tường'} [x ${fmt(box.min.x)}..${fmt(box.max.x)}, z ${fmt(box.min.z)}..${fmt(box.max.z)}]`);
    items.push({ entry, slot, box, list });
  }

  // Vật cố định theo khu (toạ độ khu): đồ trang trí sàn, đồ treo tường, gờ cửa sổ, cánh cửa (mở + đóng), đồ trang trí phần vườn mở rộng.
  const fixed = [];
  withoutMerging(() => {
    for (const [zone, spec] of Object.entries(ctx.specs)) {
      geometryNotes.length = 0;
      const decor = parts(spec.decor());
      decor.forEach(p => fixed.push({ zone, name: `đồ trang trí sàn #${p.mesh.material.color?.getHexString()}`, b: p.b }));
      decalIssues(decor).forEach(m => add('error', zone, `đồ trang trí sàn: ${m}`));
      ctx.wallDefs.forEach(({ pos, rot }, i) => {
        const g = new THREE.Group(); spec.decorate(i, g);
        if (i === 0 && spec.sill !== false) { const sill = new THREE.Mesh(new THREE.BoxGeometry(1.34, .1, .12)); sill.position.set(spec.windowU, .88, .16); g.add(sill); } // gờ cửa sổ
        g.position.set(pos[0], 0, pos[1]); g.rotation.y = rot;
        const list = parts(g);
        list.forEach(p => fixed.push({ zone, name: `đồ treo tường ${i} #${p.mesh.material.color?.getHexString?.() ?? ''}`, b: p.b }));
        decalIssues(list).forEach(m => add('error', zone, `đồ treo tường ${i}: ${m}`));
        shellIssues(list).forEach(m => add('error', zone, `đồ treo tường ${i}: ${m}`));
      });
      geometryNotes.forEach(note => add('error', zone, `đồ trang trí: ${note}`));
      const inside = ctx.interiors[zone], off = ctx.zoneOffset[zone];
      for (const [i, leaf] of Object.entries(inside.leaves)) {
        const keep = { p: leaf.position.clone(), r: leaf.rotation.y };
        for (const open of [true, false]) { ctx.setLeaf(leaf, open); fixed.push({ zone, name: `cánh cửa tường ${i} (${open ? 'mở' : 'đóng'})`, b: union(parts(leaf, off)), door: true }); }
        leaf.position.copy(keep.p); leaf.rotation.y = keep.r;
      }
    }
    for (const [zone, build] of Object.entries(ctx.outdoorDecor || {})) {
      geometryNotes.length = 0;
      const list = parts(build(), [0, 0], zone).filter(p => p.b.min.y < 4); // bỏ mây trên trời
      list.forEach(p => fixed.push({ zone, name: `đồ trang trí cố định #${p.mesh.material.color?.getHexString?.() ?? ''}`, b: p.b }));
      geometryNotes.forEach(note => add('error', zone, `đồ trang trí: ${note}`));
      shellIssues(list).forEach(m => add('error', zone, `đồ trang trí: ${m}`));
    }
  });
  if (ctx.shells) zFightIssues(ctx.shells).forEach(m => add('error', 'site', `vỏ khu nhà: ${m}`));
  // Đồ trang trí cố định chạm cánh cửa (lỗi tủ thấp + cửa phòng ngủ).
  for (const f of fixed.filter(f => !f.door)) for (const d of fixed.filter(d => d.door && d.zone === f.zone)) {
    if (real(overlapSize(f.b, d.b))) add('error', f.zone, `${f.name} chạm ${d.name}`);
  }
  // Đồ nội thất chạm vật cố định / chạm nhau.
  for (const it of items) {
    if (FLAT_SLOTS.has(it.slot)) continue;
    for (const f of fixed) if (f.zone === it.entry.zone && touches(it.list, [f])) add('error', f.zone, `${it.entry.id} chạm ${f.name}`);
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.entry.zone !== b.entry.zone || a.slot === b.slot || FLAT_SLOTS.has(a.slot) || FLAT_SLOTS.has(b.slot)) continue;
    if (real(overlapSize(a.box, b.box)) && touches(a.list, b.list)) add('error', a.entry.zone, `${a.entry.id} chạm ${b.entry.id}`);
  }
  // Vườn: bụi góc nằm trong rào, đồ không chạm bụi — cả lúc chưa mở rộng (bụi ở 4 góc khung vuông, chỉ có đồ vườn gốc)
  // lẫn lúc đã mở rộng (bụi ở 4 góc khung dài, có cả đồ phần mở rộng).
  withoutMerging(() => {
    for (const expanded of [false, true]) {
      const corners = ctx.gardenCorners(gardenBounds(expanded)), lim = innerBounds('garden', expanded), tag = expanded ? ' (vườn mở rộng)' : '';
      corners.updateMatrixWorld(true);
      corners.children.forEach((bush, k) => {
        const list = parts(bush), b = union(list);
        if (outside(b, lim)) add('error', 'garden', `bụi góc ${k}${tag} lấn hàng rào [x ${fmt(b.min.x)}..${fmt(b.max.x)}, z ${fmt(b.min.z)}..${fmt(b.max.z)}]`);
        for (const it of items) {
          if (!OUTDOOR.has(it.entry.zone) || FLAT_SLOTS.has(it.slot) || (!expanded && it.entry.area === 'garden2')) continue;
          if (touches(it.list, list)) add('error', it.entry.zone, `${it.entry.id} chạm bụi góc ${k}${tag}`);
        }
      });
    }
  });
  // Lối 1 m trước cửa / cổng: không có vật cản của mèo.
  const lanes = doorLanes();
  for (const it of items) for (const lane of lanes[it.entry.zone] || []) {
    const r = OBSTACLE_RADIUS[it.slot], [x, z] = PLACES[it.slot];
    if (r && Math.hypot(Math.max(lane.x0 - x, 0, x - lane.x1), Math.max(lane.z0 - z, 0, z - lane.z1)) < r) add('error', it.entry.zone, `${it.entry.id} chắn ${lane.name}`);
  }
  const seen = new Set();
  return report.filter(r => { const k = r.zone + r.what; if (seen.has(k)) return false; seen.add(k); return true; });
}
