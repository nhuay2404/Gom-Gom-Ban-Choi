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

// Hộp thư (luật "hộp thư" '@'): ô chặn không bao giờ vỡ; gom sát bên thì một lá thư bay vào ô Goal (play/match-fx.js flyToGoal).
// SVG tạm (chưa có ảnh Figma): thân đỏ mái tròn trên cột gỗ, cờ vàng bên phải.
export const MAILBOX_SVG = `<svg class="mailbox" viewBox="0 0 64 64" aria-hidden="true">
<rect x="28" y="38" width="8" height="24" rx="2" fill="#a86a3a" stroke="#5a2e1c" stroke-width="2.5"/>
<path d="M10 42V24a14 14 0 0 1 14-14h16a14 14 0 0 1 14 14v18z" fill="#e8584f" stroke="#5a2e1c" stroke-width="3" stroke-linejoin="round"/>
<path d="M16 24a8 8 0 0 1 16 0" fill="none" stroke="#ffb0a0" stroke-width="3" stroke-linecap="round"/>
<rect x="17" y="28" width="14" height="4" rx="2" fill="#5a2e1c"/>
<path d="M50 34V8" stroke="#5a2e1c" stroke-width="3" stroke-linecap="round"/>
<path d="M50 8h10v8H50z" fill="#f6c43c" stroke="#5a2e1c" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;
// Lá thư: bay từ hộp thư vào ô Goal, cũng là icon mục tiêu "thư".
export const LETTER_SVG = `<svg class="letter" viewBox="0 0 48 36" aria-hidden="true">
<rect x="2" y="2" width="44" height="32" rx="4" fill="#fff8e8" stroke="#5a2e1c" stroke-width="3"/>
<path d="M4 5l20 15 20-15" fill="none" stroke="#5a2e1c" stroke-width="3" stroke-linejoin="round"/>
<path d="M24 26c-4-3-6-5-6-7a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 2-2 4-6 7z" fill="#e8584f"/>
</svg>`;

// Bình hoa (luật "bình" '%'): bình sứ xanh bụng tròn béo. Gom sát bên lần đầu: nứt (cracked = vẽ thêm vết nứt), lần hai: vỡ, mảnh bay vào ô Goal.
// SVG tạm (chưa có ảnh Figma).
export const vaseSvg = (cracked = false) => `<svg class="vase" viewBox="0 0 64 64" aria-hidden="true">
<path d="M25 13h14v6c11 3 18 11 18 23 0 12-10 19-25 19S7 54 7 42c0-12 7-20 18-23z" fill="#7cc4e8" stroke="#5a2e1c" stroke-width="3" stroke-linejoin="round"/>
<rect x="21" y="6" width="22" height="8" rx="4" fill="#7cc4e8" stroke="#5a2e1c" stroke-width="3"/>
<path d="M10 43c5-5 9-5 13 0s9 5 13 0 9-5 13 0 6 4 6 4" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
<circle cx="22" cy="32" r="3" fill="#fff"/><circle cx="32" cy="29" r="3" fill="#fff"/><circle cx="42" cy="32" r="3" fill="#fff"/>
<path d="M15 34c1-5 4-9 8-11" fill="none" stroke="#c8ecff" stroke-width="3" stroke-linecap="round"/>
${cracked ? '<path d="M33 20l-4 8 6 5-5 7 5 6-3 7M33 33l7 2 3 6" fill="none" stroke="#3a1c10" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
</svg>`;
// Mảnh bình vỡ bay vào ô Goal.
export const VASE_SHARD_SVG = `<svg class="vase-shard" viewBox="0 0 40 36" aria-hidden="true">
<path d="M4 10l14-7 18 6-5 22-17 3z" fill="#7cc4e8" stroke="#5a2e1c" stroke-width="3" stroke-linejoin="round"/>
<path d="M8 20c5-4 10-4 14 0s8 4 11 1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>`;

// Siro dâu (luật "siro", lớp `syrup` của màn): mảng siro hồng đặc che kín con vật; ô siro cạnh nhau nối thành một mảng liền
// (play/board-view.js syrupJoins -> lớp j-n / j-e / j-s / j-w, CSS ui/play/base.css .syrup-tile như ô cỏ).
export const SYRUP_TILE = '<span class="syrup-tile" aria-hidden="true"></span>';
// Giọt siro: bay vào ô Goal + icon mục tiêu "siro".
export const SYRUP_DROP_SVG = `<svg class="syrup-drop" viewBox="0 0 40 48" aria-hidden="true">
<path d="M20 3C14 14 6 22 6 31a14 14 0 0 0 28 0c0-9-8-17-14-28z" fill="#ff5c8a" stroke="#c2185b" stroke-width="3" stroke-linejoin="round"/>
<path d="M13 30c0-4 2-7 5-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>`;
