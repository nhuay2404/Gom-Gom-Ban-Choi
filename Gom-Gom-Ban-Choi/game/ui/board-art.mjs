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

// Ô cỏ trên bàn: texture liên tục (assets/img/board/grass-surface.png), liền qua các ô cỏ cạnh nhau, viền + chân xanh đậm (ui/play/base.css .grass-tile);
// mỗi ô lấy đúng tọa độ --col / --row trên cùng texture phủ toàn bàn; chỉ cạnh ngoài có viền.
export const GRASS_SVG = `<span class="grass-tile" aria-hidden="true"></span>`;
// Icon cho ô Goal: cùng texture + viền với ô cỏ trên bàn (ui/play/skin.css .goal-grass).
export const GRASS_ICON_SVG = `<span class="goal-grass" aria-hidden="true"></span>`;

// Hộp thư (luật "hộp thư" '@'): ô chặn không bao giờ vỡ; gom sát bên thì một lá thư bay vào ô Goal (play/match-fx.js flyToGoal).
// Ảnh vẽ AI (nguồn gốc ở assets/img/board/generated-v2/): hộp thư béo đóng nắp; lúc gửi thư mở nắp một nhịp (MAILBOX_OPEN_SRC, match-fx.js flyToGoal).
export const MAILBOX_SVG = '<img class="mailbox" src="assets/img/board/mailbox.png" alt="" draggable="false">';
export const MAILBOX_OPEN_SRC = 'assets/img/board/mailbox-open.png';
// Lá thư: bay từ hộp thư vào ô Goal, cũng là icon mục tiêu "thư".
export const LETTER_SVG = '<img class="letter" src="assets/img/board/letter.png" alt="" draggable="false">';

// Bình hoa (luật "bình" '%'): bình sứ xanh bụng tròn béo. Gom sát bên lần đầu: nứt (cracked = ảnh có vết nứt), lần hai: vỡ, mảnh bay vào ô Goal.
export const vaseSvg = (cracked = false) => `<img class="vase" src="assets/img/board/vase${cracked ? '-cracked' : ''}.png" alt="" draggable="false">`;
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
