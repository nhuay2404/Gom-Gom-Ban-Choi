// Art vật cản trên bàn chơi (SVG thuần chuỗi, không đụng giao diện) — dùng cho bàn chơi, bảng vào màn,
// và công cụ xuất asset (tools/export-art.mjs) khi port sang Cocos.

// Thùng gỗ: ô chặn không đặt mèo lên được, vỡ khi gom mèo sát bên (luật ở board-rules.mjs).
export const CRATE_SVG = `<svg class="crate" viewBox="0 0 100 100" aria-hidden="true">
  <rect x="6" y="10" width="88" height="84" rx="12" fill="#8a5429"/>
  <rect x="6" y="4" width="88" height="84" rx="12" fill="#d49256"/>
  <rect x="14" y="12" width="72" height="68" rx="6" fill="#c07c40"/>
  <path d="M14 34H86M14 58H86" stroke="#a4632d" stroke-width="3"/>
  <path d="M20 18L80 74M80 18L20 74" stroke="#e7ad6e" stroke-width="10" stroke-linecap="round"/>
  <path d="M20 18L80 74M80 18L20 74" stroke="#b97237" stroke-width="3" stroke-linecap="round" opacity=".5"/>
  <g fill="#6d4020"><circle cx="16" cy="14" r="3"/><circle cx="84" cy="14" r="3"/><circle cx="16" cy="78" r="3"/><circle cx="84" cy="78" r="3"/></g>
  <rect x="10" y="7" width="80" height="6" rx="3" fill="#f2c28a" opacity=".6"/>
</svg>`;

// Khối kim loại (chương 2): ô chặn như thùng gỗ nhưng không bao giờ vỡ. Thép xám, đinh tán, vệt sáng.
export const METAL_SVG = `<svg class="crate metal-block" viewBox="0 0 100 100" aria-hidden="true">
  <defs><linearGradient id="metal-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e8ee"/><stop offset=".5" stop-color="#aab4c0"/><stop offset="1" stop-color="#8793a1"/></linearGradient></defs>
  <rect x="6" y="10" width="88" height="84" rx="12" fill="#56606c"/>
  <rect x="6" y="4" width="88" height="84" rx="12" fill="url(#metal-face)"/>
  <rect x="16" y="14" width="68" height="64" rx="6" fill="none" stroke="#7a8592" stroke-width="3"/>
  <path d="M24 70L70 22" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".45"/>
  <path d="M36 72L76 32" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>
  <g fill="#6c7784" stroke="#dfe5ec" stroke-width="1.5"><circle cx="16" cy="14" r="4"/><circle cx="84" cy="14" r="4"/><circle cx="16" cy="78" r="4"/><circle cx="84" cy="78" r="4"/></g>
  <rect x="10" y="7" width="80" height="5" rx="2.5" fill="#fff" opacity=".55"/>
</svg>`;
