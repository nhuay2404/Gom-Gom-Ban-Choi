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

// Chuồng mèo: song sắt dày phủ lên mèo bị nhốt + MỘT ổ khóa lớn ở giữa chân chuồng (gom sát bên là bẻ khóa, luật ở board-rules.mjs).
const PADLOCK = `<g transform="translate(50 74)"><path d="M-8 -2v-7a8 8 0 0 1 16 0v7" fill="none" stroke="#5a4210" stroke-width="5.5" stroke-linecap="round"/><path d="M-8 -2v-7a8 8 0 0 1 16 0v7" fill="none" stroke="#d8dde3" stroke-width="2.5" stroke-linecap="round"/><rect x="-14" y="-3" width="28" height="22" rx="6" fill="#f2c335" stroke="#5a4210" stroke-width="3"/><rect x="-10" y="0" width="20" height="5" rx="2.5" fill="#fff" opacity=".4"/><circle cy="9" r="3.2" fill="#5a4210"/><rect x="-1.6" y="9" width="3.2" height="7" rx="1.2" fill="#5a4210"/></g>`;
export function cageSvg() {
  return `<svg class="cage-bars" viewBox="0 0 100 100" aria-hidden="true">
  <rect x="6" y="6" width="88" height="84" rx="12" fill="none" stroke="#2f3640" stroke-width="10"/>
  <rect x="6" y="6" width="88" height="84" rx="12" fill="none" stroke="#8d97a5" stroke-width="6"/>
  <g stroke="#2f3640" stroke-width="9" stroke-linecap="round"><path d="M24 10V86M42 10V86M58 10V86M76 10V86"/></g>
  <g stroke="#9aa4b1" stroke-width="5.5" stroke-linecap="round"><path d="M24 10V86M42 10V86M58 10V86M76 10V86"/></g>
  <g stroke="#e4e9ef" stroke-width="1.8" stroke-linecap="round" opacity=".85"><path d="M22.5 14V82M40.5 14V82M56.5 14V82M74.5 14V82"/></g>
  <rect x="6" y="6" width="88" height="12" rx="6" fill="#6b7480" stroke="#2f3640" stroke-width="2.5"/>
  ${PADLOCK}
</svg>`;
}
// Icon chuồng cho bảng vào màn.
export const CAGE_ICON_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="14" fill="#fff3d6"/>${cageSvg().replace(/<\/?svg[^>]*>/g, '')}</svg>`;

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
export const GRASS_SVG = `<svg class="grass-tile" viewBox="0 0 100 100" aria-hidden="true">${GRASS_BODY}</svg>`;
// Icon cho ô Goal.
export const GRASS_ICON_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">${GRASS_BODY.replaceAll('grass-face', 'grass-face-icon').replaceAll('grass-in', 'grass-in-icon')}</svg>`;
