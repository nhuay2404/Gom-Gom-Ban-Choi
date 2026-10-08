// Đồ gắn trên tường (rèm, tranh, kệ, đồng hồ, khung cửa, cờ...) hoà theo màu tường đang chọn, và đồ cố định đặt trên sàn (tủ thấp, gối, thảm chùi
// chân, dép, thùng rác...) hoà theo màu sàn đang chọn: không giữ màu mặc định.
// Thuần logic (không THREE / DOM) để test được. Màu gốc của đồ treo tường được vẽ cho tường kem mặc định (DEFAULT_WALL), của đồ trên sàn cho
// sàn gỗ sồi mặc định (DEFAULT_FLOOR): fitToWall / fitToFloor (màu gốc, màu bề mặt) giữ nguyên MỐI QUAN HỆ màu của bản gốc rồi dời sang bề mặt mới:
//   1. Sắc (hue) xoay cùng góc với tường so với tường mặc định (tường bạc hà -> rèm / tranh ngả xanh lá, tường tím -> ngả tím);
//      tường gần như xám thì không xoay (không có sắc để theo), vật xám giữ xám.
//   2. Độ sáng dời theo độ sáng tường (tường tối -> đồ tối sáng lên, khỏi chìm), nhưng không bao giờ kém tương phản hơn
//      mức tối thiểu đã có ở bản gốc (tối đa MIN_CONTRAST).
//   3. Độ đậm màu (saturation) dịu bớt khi tường xám / tối.
// Bề mặt mặc định -> trả đúng màu gốc (identity), nên không đổi gì với người chơi chưa đổi tường / sàn.
export const DEFAULT_WALL = '#fff1d2';
export const DEFAULT_FLOOR = '#e4b574';
export const MIN_CONTRAST = .16;

const clamp01 = x => Math.max(0, Math.min(1, x));
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
}
export function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
const chroma = rgb => Math.max(...rgb) - Math.min(...rgb);

// refHex: màu bề mặt mà màu gốc được vẽ cho (tường / sàn mặc định); wallHex: bề mặt đang chọn.
export function fitToSurface(baseHex, wallHex, refHex) {
  if (wallHex.toLowerCase() === refHex) return baseHex.toLowerCase();
  const REF = rgbToHsl(hexToRgb(refHex));
  const wallRgb = hexToRgb(wallHex), [wh, , wl] = rgbToHsl(wallRgb);
  const [h, s, l] = rgbToHsl(hexToRgb(baseHex));
  // trọng số theo "độ có sắc" của tường: xám (concrete .05, graphite .07) = 0 (không có sắc để theo: xoay là xoay bừa, rèm hồng hoá xanh lá), pastel rõ sắc
  // (bạc hà .12, tím .14, đào .23) tăng dần tới 1
  const tint = clamp01((chroma(wallRgb) - .09) / .05);
  const neutralBase = s < .12;
  // góc xoay đi đường NGẮN nhất tới sắc tường, lấy 70% (hợp tông chứ không nhuộm hẳn một màu)
  const turn = ((wh - REF[0] + 540) % 360) - 180;
  const hue = neutralBase ? h : h + tint * turn * .7;
  const sat = neutralBase ? s : s * (.6 + .4 * tint) * (wl < .35 ? .85 : 1);
  // Tường sáng: dời nhẹ theo độ sáng tường. Tường tối: đồ sáng giữ sáng (nổi trên nền tối); đồ vốn tối hơn tường (khung đen, thanh gỗ nâu đậm)
  // sáng lên hẳn lên trên nền tường thay vì tối theo tường rồi chìm mất.
  let light = clamp01(l + (wl - REF[2]) * .55);
  if (wl < .5) light = l >= .5 ? clamp01(l - .08) : clamp01(wl + Math.min(.4, Math.max(MIN_CONTRAST, Math.abs(l - REF[2]) * .35)));
  // không kém tương phản hơn bản gốc (tối đa MIN_CONTRAST)
  const need = Math.min(Math.abs(l - REF[2]), MIN_CONTRAST);
  if (Math.abs(light - wl) < need) {
    // đẩy ra xa tường theo phía đang đứng; chạm biên (tường quá sáng / tối) thì đẩy phía kia
    const side = light >= wl ? 1 : -1;
    light = clamp01(wl + side * need);
    if (Math.abs(light - wl) < need) light = clamp01(wl - side * need);
  }
  return rgbToHex(hslToRgb([hue, clamp01(sat), light]));
}

export const fitToWall = (baseHex, wallHex) => fitToSurface(baseHex, wallHex, DEFAULT_WALL);
export const fitToFloor = (baseHex, floorHex) => fitToSurface(baseHex, floorHex, DEFAULT_FLOOR);
