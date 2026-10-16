// Art vật cản trên bàn chơi (chuỗi HTML, không đụng giao diện) — dùng cho bàn chơi, bảng vào màn,
// và công cụ xuất asset (tools/export/export-art.mjs) khi port sang Unity.

// Hộp cardboard (luật "thùng"): ô chặn không đặt mèo lên được, vỡ khi gom mèo sát bên (luật ở board-rules.mjs). Ảnh Figma.
export const CRATE_SVG = '<img class="crate" src="assets/img/board/crate.png" alt="" draggable="false">';
// Hộp đã bật nắp: hiện một nhịp lúc hộp vỡ (match-fx.js breakCrates) rồi mới biến mất.
export const CRATE_OPEN_SRC = 'assets/img/board/crate-open.png';

// Hộp thiếc (luật "kim loại"): ô chặn như hộp cardboard nhưng không bao giờ vỡ. Ảnh Figma (bản 1 trong 3).
export const METAL_SVG = '<img class="crate metal-block" src="assets/img/board/tin-can.png" alt="" draggable="false">';

// Lồng mèo (ảnh Figma): thân lồng nằm SAU mèo (thấy mèo bên trong), song sắt + ổ khoá đè TRƯỚC (gom sát bên là bẻ khoá, luật ở board-rules.mjs).
// Một khung lồng dựng đứng phẳng chứa: thân lồng, (mèo được board-view.js cageUp chuyển vào giữa), song sắt — thứ tự trong khung là thứ tự DOM.
// Lồng mở cửa: hiện một nhịp lúc mèo được thả (match-fx.js openCage).
export function cageSvg() {
  return '<span class="cage-bars cage-box"><img class="cage-back" src="assets/img/board/cage-back.png" alt="" draggable="false"><img class="cage-front" src="assets/img/board/cage-bars.png" alt="" draggable="false"></span>';
}
export const CAGE_OPEN_SRC = 'assets/img/board/cage-open.png';
// Icon chuồng cho bảng vào màn.
export const CAGE_ICON_SVG = '<svg viewBox="0 0 256 234" aria-hidden="true"><image href="assets/img/board/cage.png" width="256" height="234"/></svg>';

// Bãi cỏ (lớp dưới mèo / ô trống, luật ở session.mjs): ô cỏ vuông cùng kiểu với thùng gỗ / kim loại — khối bo góc viền đậm,
// mép dưới tối, mặt phẳng có vệt cắt cỏ sáng / tối xen kẽ, vài khóm cỏ nhỏ và vệt sáng mép trên. Vẽ to hơn ô một chút (CSS
// .grass-tile) để mèo đứng đè lên vẫn thấy viền cỏ.
const GRASS_BODY = `
  <defs><linearGradient id="grass-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6dc72"/><stop offset="1" stop-color="#84c556"/></linearGradient>
    <clipPath id="grass-in"><rect x="5" y="4" width="90" height="86" rx="13"/></clipPath></defs>
  <rect x="5" y="9" width="90" height="87" rx="13" fill="#4f8a32" stroke="#2f5a1e" stroke-width="3.5"/>
  <rect x="5" y="4" width="90" height="86" rx="13" fill="url(#grass-face)" stroke="#2f5a1e" stroke-width="3.5"/>
  <g clip-path="url(#grass-in)"><path d="M5 26H95M5 62H95" stroke="#b9e68a" stroke-width="16" opacity=".55"/></g>
  <g fill="#5f9f3e" stroke="#3d7327" stroke-width="1.6" stroke-linejoin="round">
    <path d="M20 40l3-9 3 7 3-8 2 10z"/><path d="M66 30l3-9 3 7 3-8 2 10z"/><path d="M44 72l3-9 3 7 3-8 2 10z"/><path d="M74 70l2-7 3 5 2-6 2 8z"/>
  </g>
  <path d="M16 8H84" stroke="#d4f2ae" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>`;
// Ô cỏ trên bàn: texture cỏ vẽ tay (assets/img/map/grass-bg.jpg) nhuộm đậm, liền qua các ô cỏ cạnh nhau, viền + chân xanh đậm (ui/play/base.css .grass-tile);
// mỗi ô một chỗ cắt khác nhau (play/board-view.js đặt background-position theo số ô) nên bãi cỏ không lặp đều.
export const GRASS_SVG = `<span class="grass-tile" aria-hidden="true"></span>`;
// Icon cho ô Goal.
export const GRASS_ICON_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">${GRASS_BODY.replaceAll('grass-face', 'grass-face-icon').replaceAll('grass-in', 'grass-in-icon')}</svg>`;
