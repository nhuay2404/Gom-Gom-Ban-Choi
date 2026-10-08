// Lò xo tắt dần dùng cho mọi cử động của mèo 3D — thuần logic (không THREE) để test được.
// obj[key] chạy về target, vận tốc nằm ở obj[key + 'V']; k = độ cứng, zeta = hệ số tắt dần (1 = vừa tới hạn).
//
// Tích phân Euler bán ẩn chỉ ổn định khi bước đủ nhỏ so với độ cứng (ω·dt nhỏ). Frame chậm trên điện thoại (30 fps, khựng tới
// 50 ms) với lò xo cứng thì giá trị nổ tung và đổi dấu mỗi frame — lỗi cũ: mí mắt (k = 900) nổ tới 1e164, mặt mèo nháy
// calm ↔ blink mỗi frame mãi mãi ("mắt giật"). Nên chia dt thành các bước con có ω·h ≤ MAX_STEP.
const MAX_STEP = .35;
export function spring(obj, key, target, k, zeta, dt) {
  const w = Math.sqrt(k), n = Math.max(1, Math.ceil(dt * w / MAX_STEP)), h = dt / n;
  let x = obj[key], v = obj[key + 'V'] || 0;
  for (let i = 0; i < n; i++) {
    v += (k * (target - x) - 2 * zeta * w * v) * h;
    x += v * h;
  }
  obj[key + 'V'] = v; obj[key] = x;
}
