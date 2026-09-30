// Xuất art của game ra file SVG độc lập (chuẩn XML) để đưa vào Cocos (đổi sang PNG / sprite atlas ở bước sau).
// Chạy: npm run export:art   ->   export/art/...
//
//   cats/<giống>/<trạng thái>.svg     mèo trên bàn chơi 2D, 200 × 212 px (khung 100 × 106 của art; lifted 200 × 280)
//       calm · blink · joy (gom / được cưng) · lifted (bị nhấc bổng) · sleepy (AFK)
//       sad · worried · crying · disappointed · sulky (sắp hết lượt)
//   cats3d/<giống>/eyes-<kiểu>.svg    lớp mắt của mèo 3D (khung mặt 80 × 72), dán lên mặt trước khối mèo
//   board/crate.svg · board/metal.svg vật cản trên bàn
//   manifest.json                      danh sách file + cỡ gợi ý
//
// Art gốc viết cho HTML (có thuộc tính lặp trong một thẻ, HTML lấy cái đầu); file xuất ra đã bỏ bản lặp
// theo đúng quy tắc đó nên hình giống hệt trong game.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catGroups, catMarkup, eyesMarkup, LOW_MOVE_MOODS } from '../game/cat-art.mjs';
import { CRATE_SVG, METAL_SVG } from '../game/board-art.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export', 'art');
const files = [];
function save(path, svg, size) {
  const full = join(OUT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  files.push({ path: `art/${path}`, size });
}

// Bỏ thuộc tính lặp trong mỗi thẻ (giữ cái đầu, như trình duyệt), thêm xmlns + cỡ.
function clean(svg, width, height) {
  svg = svg.replace(/<([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)(\s*\/?)>/g, (_, tag, attrs, end) => {
    const seen = new Set();
    const kept = [...attrs.matchAll(/\s+([\w:-]+)="([^"]*)"/g)].filter(([, name]) => !seen.has(name) && seen.add(name)).map(([all]) => all).join('');
    return `<${tag}${kept}${end}>`;
  });
  return svg.replace(/<svg\b/, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`).replace(/\s+aria-hidden="true"/, '');
}
// Sửa thẻ mở đầu tiên có class chứa `token`: thêm/đổi thuộc tính.
function setOn(svg, token, attrs) {
  const re = new RegExp(`<(\\w+)([^>]*\\bclass="(?:[^"]*\\s)?${token}(?:\\s[^"]*)?"[^>]*)>`);
  return svg.replace(re, (all, tag, rest) => {
    let next = rest;
    const selfClosing = /\/\s*$/.test(next); // thẻ tự đóng <path ... />: chèn thuộc tính trước dấu "/"
    next = next.replace(/\s*\/\s*$/, '');
    for (const [name, value] of Object.entries(attrs)) {
      next = new RegExp(`\\s${name}="[^"]*"`).test(next) ? next.replace(new RegExp(`\\s${name}="[^"]*"`), value == null ? '' : ` ${name}="${value}"`) : value == null ? next : `${next} ${name}="${value}"`;
    }
    return `<${tag}${next}${selfClosing ? '/' : ''}>`;
  });
}
const hide = (svg, token) => setOn(svg, token, { display: 'none', visibility: null });
const show = (svg, token) => setOn(svg, token, { visibility: null, display: null });
const blush = (svg, opacity) => svg.replace(/(<ellipse[^>]*class="blush"[^>]*?)(\s*\/?>)/g, `$1 opacity="${opacity}"$2`);

// Trạng thái = phép bật/tắt nhóm SVG, đúng như CSS của game làm trên bàn chơi.
const STATES = {
  calm: svg => blush(hide(svg, 'annoyed'), .45),
  blink: svg => blush(hide(setOn(svg, 'eyes', { transform: 'translate(0 57) scale(1 .08) translate(0 -57)' }), 'annoyed'), .45),
  joy: svg => show(hide(hide(svg, 'annoyed'), 'calm'), 'joy').replace(/<ellipse[^>]*class="blush"[^>]*\/>/g, ''),
  lifted: svg => blush(show(show(hide(hide(hide(svg, 'calm'), 'base'), 'ground'), 'hang'), 'annoyed'), .85),
  sleepy: svg => show(hide(hide(svg, 'annoyed'), 'calm'), 'afk-sleepy').replace(/<ellipse[^>]*class="blush"[^>]*\/>/g, ''),
  ...Object.fromEntries(LOW_MOVE_MOODS.map(mood => [mood, svg => show(hide(hide(svg, 'annoyed'), 'calm'), `afk-${mood}`).replace(/<ellipse[^>]*class="blush"[^>]*\/>/g, '')])),
};

for (const breed of catGroups) {
  for (const [state, apply] of Object.entries(STATES)) {
    // lifted: thân dưới thõng xuống tới y≈134 nên nới khung (100 × 140) cho khỏi bị cắt
    const tall = state === 'lifted';
    let svg = apply(catMarkup[breed]);
    if (tall) svg = svg.replace('viewBox="0 0 100 106"', 'viewBox="0 0 100 140"');
    save(`cats/${breed}/${state}.svg`, clean(svg, 200, tall ? 280 : 212), [200, tall ? 280 : 212]);
  }
  for (const kind of ['open', 'focus', 'blink', 'half', 'sleep', 'happy', 'annoyed']) {
    const svg = `<svg viewBox="10 20 80 72" preserveAspectRatio="none">${eyesMarkup(breed, kind)}</svg>`;
    save(`cats3d/${breed}/eyes-${kind}.svg`, clean(svg, 512, 460), [512, 460]);
  }
}
save('board/crate.svg', clean(CRATE_SVG, 200, 200), [200, 200]);
save('board/metal.svg', clean(METAL_SVG, 200, 200), [200, 200]);

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
  note: 'SVG xuất từ art của game. Đổi sang PNG @2x rồi đóng Auto Atlas trong Cocos. Mặt mèo 3D (bụng, mũi, miệng, má) vẽ bằng canvas trong room-cats.mjs (faceTexture) — cần nướng thành texture riêng.',
  files,
}, null, 2));
console.log(`Đã xuất ${files.length} file vào ${OUT}`);
