// Đường đi của mèo giữa các khu nhà (vườn, phòng khách, phòng ngủ...): khu chứa một điểm, chuỗi khu phải qua, điểm qua
// cửa / lối (room-layout.mjs LINKS). Sang Unity: CatNavigator (hoặc NavMesh + NavMeshLink cho cửa / lối).
import { ZONE_OFFSET, LINKS } from '../room-layout.mjs';
import { ROOM, clamp } from './cat-math.mjs';

// ---------- Khu nhà: mèo đi lại tự do giữa vườn, phòng khách, phòng ngủ ----------
// Toạ độ mèo = toạ độ khu nhà (tâm vườn là gốc, mỗi phòng lệch ZONE_OFFSET[khu]). Mỗi khu mèo đi trong ô
// ±ROOM quanh tâm khu; hai khu cạnh nhau nối bằng một lối hẹp qua cửa (LINKS) xuyên qua tường / cổng rào.
export const zoneHome = zone => ({ x: ZONE_OFFSET[zone][0], z: ZONE_OFFSET[zone][1] });

// Mỗi lối: trục hai khu lệch nhau (x hoặc z), ô lối đi (box) giữa hai mép khu, và điểm đứng ngay trong mỗi khu (steps).
// via (lối qua đường sang trường): các điểm đi qua giữa hai bước cửa; mỗi chặng là một ô đi được (boxes) rộng bằng lối.
export const PASSES = LINKS.map(({ a, b, at, w, open = false, via = [] }) => {
  const [ax, az] = ZONE_OFFSET[a], [bx, bz] = ZONE_OFFSET[b];
  const axis = Math.abs(ax - bx) > Math.abs(az - bz) ? 'x' : 'z', side = axis === 'x' ? 'z' : 'x';
  const ca = axis === 'x' ? ax : az, cb = axis === 'x' ? bx : bz, dir = Math.sign(cb - ca);
  // lối cửa rộng vừa thân mèo; lối thông thoáng (vườn <-> phần mở rộng) rộng bằng cả ô đi lại
  const edgeA = ca + dir * ROOM, edgeB = cb - dir * ROOM, half = open ? ROOM : w / 2 - .2;
  const point = (along, across) => (axis === 'x' ? { x: along, z: across } : { x: across, z: along });
  const lo = point(Math.min(edgeA, edgeB), at - half), hi = point(Math.max(edgeA, edgeB), at + half);
  const steps = { [a]: point(edgeA - dir * .15, at), [b]: point(edgeB + dir * .15, at) }, path = via.map(([x, z]) => ({ x, z }));
  const chain = [steps[a], ...path, steps[b]];
  const boxes = path.length ? chain.slice(1).map((q, i) => { const p = chain[i]; return [Math.min(p.x, q.x) - half, Math.max(p.x, q.x) + half, Math.min(p.z, q.z) - half, Math.max(p.z, q.z) + half]; })
    : [[lo.x, hi.x, lo.z, hi.z]];
  return { a, b, open, boxes, steps, via: path };
});

// Đường đi qua các khu (đồ thị nhỏ, tìm theo chiều rộng): danh sách khu từ `from` tới `to` chỉ qua các khu đã mở.
export function zoneRoute(from, to, open) {
  const prev = { [from]: null }, queue = [from];
  while (queue.length) {
    const zone = queue.shift();
    if (zone === to) break;
    for (const p of PASSES) {
      const next = p.a === zone ? p.b : p.b === zone ? p.a : null;
      if (next && open.includes(next) && !(next in prev)) { prev[next] = zone; queue.push(next); }
    }
  }
  if (!(to in prev)) return [from];
  const route = [];
  for (let zone = to; zone; zone = prev[zone]) route.unshift(zone);
  return route;
}

export const passBetween = (a, b) => PASSES.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));

export const boxNearest = (x, z, x0, x1, z0, z1) => ({ x: clamp(x, x0, x1), z: clamp(z, z0, z1) });
