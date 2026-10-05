// Art vật cản trên bàn chơi (SVG thuần chuỗi, không đụng giao diện) — dùng cho bàn chơi, bảng vào màn,
// và công cụ xuất asset (tools/export-art.mjs) khi port sang Cocos.

// Thùng gỗ: ô chặn không đặt mèo lên được, vỡ khi gom mèo sát bên (luật ở board-rules.mjs).
export const CRATE_SVG = `<svg class="crate" viewBox="0 0 100 100" aria-hidden="true">
  <defs><linearGradient id="crate-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bf8556"/><stop offset="1" stop-color="#9c6438"/></linearGradient>
    <clipPath id="crate-in"><rect x="15" y="13" width="70" height="68" rx="5"/></clipPath></defs>
  <rect x="5" y="9" width="90" height="87" rx="13" fill="#6e3f22" stroke="#4e2a17" stroke-width="3.5"/>
  <rect x="5" y="4" width="90" height="86" rx="13" fill="url(#crate-face)" stroke="#4e2a17" stroke-width="3.5"/>
  <rect x="15" y="13" width="70" height="68" rx="5" fill="#93592f" stroke="#6b3c1f" stroke-width="2.4"/>
  <g clip-path="url(#crate-in)">
    <path d="M15 36H85M15 58H85" stroke="#7c4724" stroke-width="2.2" opacity=".7"/>
    <path d="M12 10L88 84M88 10L12 84" stroke="#6b3c1f" stroke-width="14" stroke-linecap="round"/>
    <path d="M12 10L88 84M88 10L12 84" stroke="#d29a68" stroke-width="9" stroke-linecap="round"/>
    <path d="M12 8.5L88 82.5M88 8.5L12 82.5" stroke="#ecc195" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>
  </g>
  <g fill="#4e2a17"><circle cx="12" cy="11" r="2.6"/><circle cx="88" cy="11" r="2.6"/><circle cx="12" cy="83" r="2.6"/><circle cx="88" cy="83" r="2.6"/></g>
  <path d="M16 8H84" stroke="#e2b083" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
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

// Chuồng mèo: song sắt phủ lên mèo bị nhốt + ổ khóa ở chân chuồng (mỗi ổ = một khóa còn lại, luật ở board-rules.mjs).
const PADLOCK = x => `<g transform="translate(${x} 78)"><path d="M-6 0v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#8a6a1c" stroke-width="3"/><rect x="-9" y="-1" width="18" height="15" rx="4" fill="#f2c335" stroke="#8a6a1c" stroke-width="2"/><circle cy="5" r="2" fill="#8a6a1c"/><rect x="-1" y="5" width="2" height="5" fill="#8a6a1c"/></g>`;
export function cageSvg(locks) {
  const pads = locks >= 2 ? PADLOCK(36) + PADLOCK(64) : PADLOCK(50);
  return `<svg class="cage-bars" viewBox="0 0 100 100" aria-hidden="true">
  <rect x="7" y="8" width="86" height="80" rx="12" fill="none" stroke="#5d6672" stroke-width="5"/>
  <g stroke="#7d8794" stroke-width="4" stroke-linecap="round"><path d="M25 12V84M42 12V84M58 12V84M75 12V84"/></g>
  <g stroke="#c9d1da" stroke-width="1.5" stroke-linecap="round" opacity=".8"><path d="M24 14V82M41 14V82M57 14V82M74 14V82"/></g>
  <rect x="7" y="8" width="86" height="9" rx="4.5" fill="#6b7480"/>
  ${pads}
</svg>`;
}
// Icon chuồng cho bảng vào màn.
export const CAGE_ICON_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="14" fill="#fff3d6"/>${cageSvg(2).replace(/<\/?svg[^>]*>/g, '')}</svg>`;
