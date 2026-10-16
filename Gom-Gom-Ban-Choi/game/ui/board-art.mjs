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
// Lớp trước khi cửa đã mở (cùng khung với cage-bars.png): dùng lúc mèo được thả (match-fx.js openCage).
export function cageSvg() {
  return '<span class="cage-bars cage-box"><img class="cage-back" src="assets/img/board/cage-back.png" alt="" draggable="false"><img class="cage-front" src="assets/img/board/cage-bars.png" alt="" draggable="false"></span>';
}
export const CAGE_OPEN_SRC = 'assets/img/board/cage-open.png';
// Cánh cửa lồng tách riêng (cắt từ bản cửa mở của Figma; cage-open.png là phần khung còn lại): rơi rời ra lúc mở lồng.
export const CAGE_DOOR_SRC = 'assets/img/board/cage-door.png';
// Icon chuồng cho bảng vào màn.
export const CAGE_ICON_SVG = '<svg viewBox="0 0 256 234" aria-hidden="true"><image href="assets/img/board/cage.png" width="256" height="234"/></svg>';

// Ô cỏ trên bàn: texture cỏ vẽ tay (assets/img/map/grass-bg.jpg) nhuộm đậm, liền qua các ô cỏ cạnh nhau, viền + chân xanh đậm (ui/play/base.css .grass-tile);
// mỗi ô một chỗ cắt khác nhau (play/board-view.js đặt background-position theo số ô) nên bãi cỏ không lặp đều.
export const GRASS_SVG = `<span class="grass-tile" aria-hidden="true"></span>`;
// Icon cho ô Goal: cùng texture + viền với ô cỏ trên bàn (ui/play/skin.css .goal-grass).
export const GRASS_ICON_SVG = `<span class="goal-grass" aria-hidden="true"></span>`;
