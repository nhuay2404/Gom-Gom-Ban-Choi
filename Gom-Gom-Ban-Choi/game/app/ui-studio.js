// UI Studio (trình duyệt): tự nạp cùng thanh nút dev (main.js), bật / tắt bằng nút "Studio" ở đó; ?studio mở sẵn.
// Máy chủ: tools/ui-studio/ui-studio.mjs. Hướng dẫn cho artist: docs/ui-studio.md.
// Chữ trên bảng viết bằng tiếng Anh, thao tác theo thói quen Photoshop:
//  - Select (V) hoặc Alt + click để chọn phần tử ("layer"), Shift + click chọn thêm. Ctrl + G liên kết nhiều layer: chọn một là chọn
//    cả nhóm (chỉ nhớ trong trình duyệt, KHÔNG đổi cấu trúc HTML / code). Ctrl + Shift + G bỏ liên kết.
//  - Kéo khung xanh / phím mũi tên để dời: đổi left / top của khối CSS đang áp; chưa có thì thêm position: relative + left / top.
//  - Align / Distribute, lưới (Ctrl + ') + hút (Ctrl + Shift + ;) theo khung thiết kế 393 px, Undo / Redo (Ctrl + Z / Ctrl + Shift + Z)
//    gồm cả thay ảnh. Ctrl + H ẩn khung / lưới.
//  - Bảng thuộc tính: các khối CSS đang áp vào phần tử; di chuột lên tên thuộc tính / ô giá trị / nút để xem giải thích (PROP_HELP).
//  - File đổi ngoài game (artist sửa CSS / xuất ảnh đè lên game/ui/...): CSS và ảnh thay tại chỗ; .js / .mjs / .html thì tải lại trang.
//  - Save (Ctrl + S) ghi thẳng vào đúng file CSS trong game/ui/ (rồi commit bằng GitHub Desktop như bình thường).
import { cssRules, declarations, norm } from '/tools/ui-studio/ui-studio-css.mjs';

const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
const FRAME_UNITS = 393;
const SNAP_PX = 6;
const VALUE_TIP = 'The setting for this property. Type to change it; the game updates live.\n' +
  '↑ / ↓ change the number under the cursor (Shift ×10, Alt ×0.1).\n' +
  'calc(N * var(--u)) = N design pixels (1 --u = 1 px of the 393 px design frame). Keep that form so the UI scales on every phone.';

// Giải thích ngắn cho từng thuộc tính CSS: [ý nghĩa, ví dụ giá trị]. So sánh với Photoshop khi có thứ tương đương.
const PROP_HELP = {
  color: ['Text color (Character panel → Color).', '#5a2d1c · rgba(0,0,0,.5)'],
  background: ['The whole fill in one value: color, image, position / size and repeat.', 'url(img/panel.png) center/100% 100% no-repeat'],
  'background-color': ['Solid fill behind the element (like a Color Fill layer).', '#ffe9a8'],
  'background-image': ['Image or gradient used as the fill.', 'url(img/btn.png) · linear-gradient(#fff, #fc0)'],
  'background-size': ['How the background image is scaled inside the box.', 'cover · contain · 100% 100% · calc(40 * var(--u))'],
  'background-position': ['Where the background image sits inside the box.', 'center · left top · 50% 20%'],
  'background-repeat': ['Whether the background image tiles.', 'no-repeat · repeat · repeat-x'],
  'font-size': ['Text size.', 'calc(16 * var(--u))'],
  'font-weight': ['Text thickness (Regular, Bold, Black…).', '400 regular · 700 bold · 900 black'],
  'font-family': ['Typeface.', '"Baloo 2", sans-serif'],
  'font-style': ['Italic or normal text.', 'normal · italic'],
  'line-height': ['Space between lines of text (Leading).', '1.2 (× font size) · calc(20 * var(--u))'],
  'letter-spacing': ['Space between letters (Tracking).', '0.02em · calc(1 * var(--u))'],
  'text-align': ['Horizontal alignment of text inside its box (paragraph align).', 'left · center · right'],
  'text-shadow': ['Shadow behind text (Drop Shadow on a text layer). Several shadows: separate with commas.', 'x y blur color — 0 calc(2 * var(--u)) 0 #7a3b12'],
  'text-transform': ['Changes letter case without editing the text.', 'none · uppercase · capitalize'],
  'text-decoration': ['Underline / strike-through.', 'none · underline'],
  '-webkit-text-stroke': ['Outline around text (Stroke layer style, centered on the edge).', 'width color — calc(2 * var(--u)) #6a3229'],
  'paint-order': ['Draws the text stroke behind the fill, so the outline looks like Stroke → Outside.', 'stroke fill'],
  'white-space': ['Whether text wraps onto new lines.', 'normal · nowrap'],
  'word-break': ['How long words break at the end of a line.', 'normal · break-word'],
  width: ['Box width.', 'calc(120 * var(--u)) · 50% · auto'],
  height: ['Box height.', 'calc(48 * var(--u)) · auto'],
  'min-width': ['The box never gets narrower than this.', 'calc(80 * var(--u))'],
  'max-width': ['The box never gets wider than this.', 'calc(300 * var(--u)) · 100%'],
  'min-height': ['The box never gets shorter than this.', 'calc(40 * var(--u))'],
  'max-height': ['The box never gets taller than this.', 'calc(400 * var(--u))'],
  'aspect-ratio': ['Locks width : height (like Constrain Proportions).', '1 · 16/9 · 1/1.1'],
  left: ['Distance from the left edge of the parent. Only works when position is relative / absolute / fixed. Dragging the blue box edits this.', 'calc(24 * var(--u)) · 50%'],
  right: ['Distance from the right edge of the parent (bigger = further left). Needs position relative / absolute / fixed.', 'calc(24 * var(--u))'],
  top: ['Distance from the top edge of the parent. Needs position relative / absolute / fixed. Dragging the blue box edits this.', 'calc(24 * var(--u)) · 10%'],
  bottom: ['Distance from the bottom edge of the parent (bigger = higher). Needs position relative / absolute / fixed.', 'calc(24 * var(--u))'],
  inset: ['top right bottom left in one value.', '0 · calc(10 * var(--u)) auto auto 0'],
  position: ['How the box is placed. static: normal flow · relative: nudged from its normal spot · absolute: placed freely inside the parent · fixed: pinned to the screen.', 'static · relative · absolute · fixed'],
  'z-index': ['Stacking order: higher sits on top (layer order in the Layers panel). Needs position other than static.', '1 · 10 · 50'],
  margin: ['Empty space OUTSIDE the box, pushing neighbours away. 1 to 4 values: top right bottom left.', 'calc(8 * var(--u)) 0'],
  padding: ['Empty space INSIDE the box, between its edge and its content. 1 to 4 values: top right bottom left.', 'calc(6 * var(--u)) calc(12 * var(--u))'],
  border: ['Line around the box (Stroke → Inside).', 'width style color — calc(3 * var(--u)) solid #73392a'],
  'border-radius': ['Rounded corners (corner radius of a Rounded Rectangle).', 'calc(12 * var(--u)) · 50% (circle) · 999px (pill)'],
  'box-shadow': ['Shadow around the box (Drop Shadow; add "inset" for Inner Shadow). Several: separate with commas.', 'x y blur spread color — 0 calc(4 * var(--u)) 0 #0003'],
  outline: ['A line drawn outside the box that does not take up space.', '2px solid #fff'],
  opacity: ['Transparency of the element and everything inside it (Layer Opacity).', '0 (invisible) … 1 (solid)'],
  transform: ['Free Transform: move, scale, rotate or skew without moving anything else.', 'scale(1.1) · rotate(-5deg) · translate(0, -4px)'],
  translate: ['Moves the element visually. Often -50% to centre it on its left / top point, so edit with care.', '-50% 0 · 0 calc(2 * var(--u))'],
  scale: ['Scales the element (Free Transform → Scale). One value = both directions.', '1.1 · 1 0.9'],
  rotate: ['Rotates the element.', '5deg · -45deg'],
  'transform-origin': ['The pivot point for scale / rotate (the reference point in Free Transform).', 'center · left top · 50% 100%'],
  filter: ['Adjustments / filters on the whole element.', 'drop-shadow(0 2px 0 #0004) · brightness(1.1) · saturate(1.2) · blur(2px) · grayscale(1)'],
  'backdrop-filter': ['Blurs / adjusts whatever is BEHIND the element (frosted glass).', 'blur(6px)'],
  'mix-blend-mode': ['Blend Mode, same as in the Layers panel.', 'normal · multiply · screen · overlay'],
  display: ['How the box lays out. block · inline · flex (children in a row / column) · grid · none (hidden).', 'block · flex · grid · none'],
  visibility: ['Hides the element but keeps its space.', 'visible · hidden'],
  overflow: ['What happens to content that sticks out of the box (like a clipping mask).', 'visible · hidden · auto'],
  gap: ['Space between children of a flex / grid box.', 'calc(8 * var(--u))'],
  'flex-direction': ['Direction children are laid out in a flex box.', 'row · column'],
  'flex-wrap': ['Whether flex children wrap onto a new line.', 'nowrap · wrap'],
  'justify-content': ['Spreads children along the main direction of a flex / grid box.', 'flex-start · center · space-between'],
  'align-items': ['Aligns children across the main direction of a flex / grid box.', 'stretch · center · flex-start · flex-end'],
  'align-self': ['Overrides align-items for this child only.', 'center · flex-end'],
  'justify-self': ['Horizontal alignment of this child inside its grid cell.', 'start · center · end'],
  'place-items': ['align-items + justify-items in one value.', 'center'],
  flex: ['How much this child grows / shrinks inside a flex box.', '1 · 0 0 auto'],
  order: ['Changes the visual order of a flex / grid child.', '0 · 1 · -1'],
  'grid-template-columns': ['Column sizes of a grid box.', 'repeat(3, 1fr) · calc(60 * var(--u)) 1fr'],
  'grid-template-rows': ['Row sizes of a grid box.', 'auto 1fr'],
  'object-fit': ['How an <img> fills its box.', 'contain · cover · fill'],
  'vertical-align': ['Vertical alignment of inline content.', 'middle · top · baseline'],
  cursor: ['Mouse cursor shape on hover (desktop only).', 'pointer · default'],
  'pointer-events': ['none = clicks pass through this element.', 'auto · none'],
  transition: ['Animates changes of other properties.', 'transform .2s ease'],
  animation: ['Plays a keyframe animation defined in the CSS file.', 'name 1s ease-in-out infinite'],
  content: ['Text / image of a ::before / ::after decoration.', '"" · "NEW"'],
};
function propHelp(name) {
  if (PROP_HELP[name]) return PROP_HELP[name];
  if (name.startsWith('--')) return [`Custom variable (a design token). Other rules read it with var(${name}), so changing it can affect many places.`, 'calc(8 * var(--u)) · #ffcf4a'];
  const side = name.match(/^(margin|padding|border|inset)-(top|right|bottom|left)/);
  if (side) return [`${PROP_HELP[side[1]]?.[0] || side[1]} (${side[2]} side only)`, PROP_HELP[side[1]]?.[1] || ''];
  if (/^border-(.+-)?radius/.test(name)) return [PROP_HELP['border-radius'][0] + ' (one corner only)', 'calc(12 * var(--u))'];
  if (/^border-(width|style|color)$/.test(name)) return [`Border ${name.slice(7)} only.`, { width: 'calc(3 * var(--u))', style: 'solid · dashed · none', color: '#73392a' }[name.slice(7)]];
  for (const prefix of ['background', 'font', 'text', 'animation', 'transition', 'grid', 'flex']) {
    if (name.startsWith(prefix + '-')) return [`Part of the ${prefix} settings (${name}).`, ''];
  }
  return [`CSS property. Search "css ${name}" on developer.mozilla.org for details.`, ''];
}

const pathOf = href => { try { return decodeURIComponent(new URL(href, location.href).pathname).replace(/^\/+/, ''); } catch { return ''; } };
const isColor = value => /^(#|rgb|hsl|oklch|lab\()/i.test(value.trim()) && CSS.supports('color', value.trim());
const round = (n, step = .01) => Number((Math.round(n / step) * step).toFixed(2));
const load = (key, fallback) => { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return fallback; } };
const store = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- Trạng thái ----------
// màn hẹp (điện thoại xem qua LAN): bảng thu gọn sẵn để không che game
let canWrite = false, online = false, picking = false, showHelp = false, showGridSettings = false;
let selection = [];
// Lưới kiểu Figma (layout grid): ô vuông + cột + hàng, số đo theo px thiết kế. Bảng thu về nút tròn kéo đi đâu cũng được (bubble).
const GRID_DEFAULTS = {
  square: { on: false, size: 8 },
  cols: { on: true, count: 4, gutter: 16, margin: 16 },
  rows: { on: false, count: 8, gutter: 16, margin: 16 },
};
const prefs = (() => {
  const saved = load('ui-studio-prefs', {});
  const out = { grid: false, snap: true, extras: true, open: innerWidth >= 700, bubble: null, panel: null, shown: false, ...saved };
  // ?studio: mở studio ngay (link cũ vẫn chạy)
  if (new URLSearchParams(location.search).has('studio')) out.shown = true;
  for (const k of Object.keys(GRID_DEFAULTS)) out[k] = { ...GRID_DEFAULTS[k], ...saved[k] };
  if (saved.gridSize && !saved.square) out.square = { on: true, size: saved.gridSize };
  delete out.gridSize; delete out.left;
  return out;
})();
let collapsed = !prefs.open;
let links = (() => { try { return JSON.parse(localStorage.getItem('ui-studio-links')) || []; } catch { return []; } })();
const pending = new Map(); // key -> { file, selector, index, props: {tên: giá trị}, original: {tên: [giá trị, !important]} }
const history = [], future = [];
let current = null; // token của thao tác đang chạy: mọi setProp trong cùng token gộp thành MỘT bước undo
const savePrefs = () => store('ui-studio-prefs', prefs);

// ---------- Khối CSS ----------
function* styleRules(list) {
  for (const rule of list) {
    if (rule instanceof CSSStyleRule) yield rule;
    else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || (window.CSSLayerBlockRule && rule instanceof CSSLayerBlockRule)) yield* styleRules(rule.cssRules);
  }
}
const uiSheets = () => [...document.styleSheets].filter(sheet => sheet.href && pathOf(sheet.href).startsWith('ui/') && !sheet.disabled);
function ruleActive(rule) {
  for (let p = rule.parentRule; p; p = p.parentRule) if (p instanceof CSSMediaRule && !matchMedia(p.conditionText || p.media.mediaText).matches) return false;
  return true;
}
// mỗi khối được nhận diện bằng (file, selector, thứ tự trong các khối cùng selector của file) — máy chủ đếm y hệt
function describe(sheet, rule) {
  const file = pathOf(sheet.href), key = norm(rule.selectorText);
  let index = 0;
  for (const other of styleRules(sheet.cssRules)) { if (other === rule) break; if (norm(other.selectorText) === key) index++; }
  return { file, selector: rule.selectorText, index, rule };
}
function findRule({ file, selector, index }) {
  const sheet = uiSheets().find(s => pathOf(s.href) === file);
  if (!sheet) return null;
  return [...styleRules(sheet.cssRules)].filter(r => norm(r.selectorText) === norm(selector))[index] || null;
}
function matchedRules(el) {
  const out = [];
  for (const sheet of uiSheets()) {
    let rules;
    try { rules = [...styleRules(sheet.cssRules)]; } catch { continue; }
    for (const rule of rules) {
      let hit = false;
      try { hit = el.matches(rule.selectorText); } catch {}
      if (hit && ruleActive(rule)) out.push({ ...describe(sheet, rule), weight: specificity(rule.selectorText, el) });
    }
  }
  // khối thắng lên đầu: độ ưu tiên selector cao hơn, bằng nhau thì khối viết sau (sort giữ thứ tự khi bằng nhau)
  return out.reverse().sort((a, b) => b.weight - a.weight);
}
// Độ ưu tiên (specificity) gần đúng: id · class / thuộc tính / pseudo-class · thẻ; danh sách "a, b" lấy phần khớp phần tử
function splitTop(selector) {
  const parts = [];
  let depth = 0, begin = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && !depth) { parts.push(selector.slice(begin, i)); begin = i + 1; }
  }
  return [...parts, selector.slice(begin)].map(s => s.trim()).filter(Boolean);
}
function specificity(selector, el) {
  const weigh = part => {
    const s = part.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)(?!is\(|not\(|has\()[\w-]+/g) || []).length;
    const types = (s.replace(/\[[^\]]*\]|\([^)]*\)/g, '').match(/(^|[\s>+~])[a-z][\w-]*|::[\w-]+/gi) || []).length;
    return ids * 1e6 + classes * 1e3 + types;
  };
  const parts = splitTop(selector).filter(part => { try { return el.matches(part); } catch { return false; } });
  return Math.max(0, ...parts.map(weigh));
}
// khối để thêm thuộc tính mới: bỏ khối chỉ áp lúc rê / bấm chuột (artist đang rê chuột lên đúng phần tử đó)
const editableRef = el => { const refs = matchedRules(el); return refs.find(r => !/:(hover|active|focus)/.test(r.selector)) || refs[0] || null; };
const keyOf = ref => `${ref.file}|${ref.selector}|${ref.index}`;
const countMatches = selector => { try { return document.querySelectorAll(selector).length; } catch { return 0; } };

// Ghi giá trị vào khối CSS (chưa lưu file), không ghi lịch sử undo.
function writeProp(ref, name, value) {
  const rule = findRule(ref) || ref.rule;
  if (!rule) return;
  const key = keyOf(ref);
  let edit = pending.get(key);
  if (!edit) pending.set(key, edit = { file: ref.file, selector: ref.selector, index: ref.index, props: {}, original: {} });
  if (!(name in edit.original)) edit.original[name] = [rule.style.getPropertyValue(name), rule.style.getPropertyPriority(name)];
  const important = /!important\s*$/.test(value);
  const clean = value.replace(/!important\s*$/, '').trim();
  if (clean) rule.style.setProperty(name, clean, important ? 'important' : edit.original[name][1]);
  else rule.style.removeProperty(name);
  const [ov, op] = edit.original[name];
  const finalValue = clean ? clean + ((important || op) ? ' !important' : '') : '';
  if (clean === ov && (important ? 'important' : op) === op) delete edit.props[name];
  else edit.props[name] = finalValue;
  if (!Object.keys(edit.props).length) pending.delete(key);
}
function valueNow(ref, name) {
  const edit = pending.get(keyOf(ref));
  if (edit && name in edit.props) return edit.props[name];
  const rule = findRule(ref) || ref.rule;
  const value = rule ? rule.style.getPropertyValue(name) : '';
  return value ? value + (rule.style.getPropertyPriority(name) ? ' !important' : '') : '';
}
function setProp(ref, name, value) {
  const before = valueNow(ref, name);
  writeProp(ref, name, value);
  record(ref, name, before, valueNow(ref, name));
}
function act(label, fn, token = { label }) {
  const previous = current;
  current = token;
  try { return fn(); } finally { current = previous; }
}

// ---------- Undo / Redo ----------
function record(ref, name, before, after) {
  if (before === after) { syncBar(); return; }
  const token = current || { label: 'Edit ' + name };
  let entry = history.at(-1);
  if (!entry || entry.token !== token) {
    history.push(entry = { token, label: token.label, changes: new Map() });
    if (history.length > 300) history.shift();
  }
  const k = keyOf(ref) + '|' + name;
  const change = entry.changes.get(k);
  if (change) change.after = after; else entry.changes.set(k, { ref, name, before, after });
  future.length = 0;
  syncBar();
}
async function stepHistory(from, to, back) {
  const entry = from.pop();
  if (!entry) return;
  if (entry.image) {
    if (!await sendImage(entry.image.path, back ? entry.image.before : entry.image.after)) { from.push(entry); return; }
  } else {
    const changes = [...entry.changes.values()];
    if (back) changes.reverse();
    for (const c of changes) writeProp(c.ref, c.name, back ? c.before : c.after);
  }
  to.push(entry);
  flash(`${back ? 'Undo' : 'Redo'}: ${entry.label}`);
  render();
}
const undo = () => stepHistory(history, future, true);
const redo = () => stepHistory(future, history, false);

function revertAll() {
  act('Revert unsaved changes', () => {
    for (const edit of [...pending.values()]) {
      for (const [name, [value, priority]] of Object.entries(edit.original)) setProp(edit, name, value ? value + (priority ? ' !important' : '') : '');
    }
  });
  render();
}
async function saveAll() {
  if (!canWrite) { flash('This device can only preview. Save on the computer running the server.'); return; }
  let saved = 0;
  for (const edit of [...pending.values()]) {
    try {
      const res = await fetch('/__studio/css', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edit) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pending.delete(keyOf(edit));
      saved++;
    } catch (error) { flash(`Could not save ${edit.file}: ${error.message}`); render(); return; }
  }
  flash(`Saved ${saved} style rule${saved === 1 ? '' : 's'} to file ✓`);
  render();
}

// Giá trị hiện trong bảng lấy đúng chữ trong file (#fff, calc(144 * var(--u))...) chứ không phải dạng trình duyệt chuẩn hoá (rgb(...)).
const sources = new Map(); // file -> Promise<text>
const sourceOf = file => {
  if (!sources.has(file)) sources.set(file, fetch('/' + file, { cache: 'no-store' }).then(r => r.text()).catch(() => ''));
  return sources.get(file);
};
async function sourceDecls(ref) {
  const text = await sourceOf(ref.file);
  const rule = cssRules(text).filter(r => norm(r.selector) === norm(ref.selector))[ref.index];
  if (!rule) return null;
  return declarations(text, rule.open + 1, rule.close).map(d => [d.name, text.slice(d.valueStart, d.end).trim()]);
}

// ---------- Tự cập nhật khi file đổi ----------
function swapSheet(link) {
  return new Promise(done => {
    const next = link.cloneNode();
    const url = new URL(link.href, location.href);
    url.search = '?studio=' + Date.now();
    next.href = url.href;
    next.onload = next.onerror = () => { link.remove(); reapplyPending(); done(); };
    link.after(next);
  });
}
function reapplyPending() {
  for (const edit of pending.values()) {
    const rule = findRule(edit);
    if (!rule) continue;
    for (const [name, value] of Object.entries(edit.props)) {
      const important = /!important$/.test(value), clean = value.replace(/\s*!important$/, '');
      if (clean) rule.style.setProperty(name, clean, important ? 'important' : ''); else rule.style.removeProperty(name);
    }
  }
}
const uiLinks = () => [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link => pathOf(link.href).startsWith('ui/'));
async function fileChanged(file) {
  sources.delete(file);
  if (file === 'app/ui-studio.js' || /\.(m?js|html)$/.test(file)) {
    if (/\.test\.mjs$/.test(file)) return;
    if (pending.size && !confirm('Game code changed and the page needs to reload. Discard unsaved CSS edits?')) return;
    pending.clear();
    location.reload();
    return;
  }
  if (file.endsWith('.css')) {
    const link = uiLinks().find(l => pathOf(l.href) === file);
    if (link) { await swapSheet(link); flash('Updated ' + file); }
  } else if (IMAGE_RE.test(file)) {
    // ảnh dùng trong CSS: nạp lại mọi file CSS (máy chủ gắn ?v=<giờ sửa ảnh>); ảnh <img>: đổi src
    await Promise.all(uiLinks().map(swapSheet));
    for (const img of document.querySelectorAll('img')) {
      if (pathOf(img.src) === file) { const u = new URL(img.src); u.searchParams.set('v', Date.now()); img.src = u.href; }
    }
    flash('Updated image ' + file);
  } else return;
  if (selection.length) setTimeout(render, 60);
}
function connect() {
  const events = new EventSource('/__studio/events');
  events.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.hello) { online = true; canWrite = data.canWrite; render(); return; }
    fileChanged(data.file);
  };
  events.onerror = () => { if (online) { online = false; syncBar(); } };
}

// ---------- Khung thiết kế, lưới, hút ----------
// 1 --u = 1 px của khung thiết kế 393 px; đo bằng phần tử thử vì biến CSS không tự quy ra px
function unitPx(context = document.body) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:calc(100 * var(--u))';
  (context instanceof HTMLImageElement ? context.parentElement : context || document.body).append(probe);
  const px = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return px || 1;
}
let frameCache = null;
addEventListener('resize', () => { frameCache = null; });
function frame() {
  if (frameCache) return frameCache;
  const u = unitPx(document.body), width = Math.min(FRAME_UNITS * u, innerWidth), left = (innerWidth - width) / 2;
  return frameCache = { u, left, width, right: left + width, top: 0, bottom: innerHeight, height: innerHeight };
}
// Cột / hàng kiểu Figma "Stretch": lề hai đầu (margin), khe giữa (gutter), bề rộng mỗi cột tự chia đều phần còn lại.
function bands(start, length, { count, gutter, margin }, u) {
  const n = Math.max(1, Math.round(count)), g = gutter * u, m = margin * u;
  const size = (length - 2 * m - (n - 1) * g) / n;
  if (size <= 0) return [];
  return Array.from({ length: n }, (_, i) => { const a = start + m + i * (size + g); return [a, a + size]; });
}
function layoutGrid() {
  const f = frame();
  return {
    f,
    step: prefs.square.on ? prefs.square.size * f.u : 0,
    cols: prefs.cols.on ? bands(f.left, f.width, prefs.cols, f.u) : [],
    rows: prefs.rows.on ? bands(0, innerHeight, prefs.rows, f.u) : [],
  };
}
function snapLines() {
  const f = frame(), xs = [f.left, f.left + f.width / 2, f.right], ys = [0, innerHeight / 2, innerHeight];
  if (prefs.grid) {
    const { step, cols, rows } = layoutGrid();
    for (const [a, b] of cols) xs.push(a, b);
    for (const [a, b] of rows) ys.push(a, b);
    if (step >= 3) {
      for (let x = f.left; x <= f.right + .5; x += step) xs.push(x);
      for (let y = 0; y <= innerHeight; y += step) ys.push(y);
    }
  }
  return { xs, ys };
}
function snapDelta(rect, dx, dy) {
  if (!prefs.snap) return { dx, dy, guides: [] };
  const { xs, ys } = snapLines();
  const pick = (edges, lines) => {
    let best = null;
    for (const e of edges) for (const l of lines) { const d = l - e; if (Math.abs(d) <= SNAP_PX && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, l }; }
    return best;
  };
  const bx = pick([rect.left + dx, rect.left + rect.width / 2 + dx, rect.right + dx], xs);
  const by = pick([rect.top + dy, rect.top + rect.height / 2 + dy, rect.bottom + dy], ys);
  return { dx: dx + (bx?.d || 0), dy: dy + (by?.d || 0), guides: [bx && { x: bx.l }, by && { y: by.l }].filter(Boolean) };
}

// ---------- Dời vị trí ----------
// Khối CSS có left/top (hoặc right/bottom) dạng số: đổi con số đầu tiên. Tỉ lệ px ↔ đơn vị đo thật (đổi thử +10 rồi xem phần tử dịch
// bao nhiêu px), nên chạy được với calc(N * var(--u)), px, %...
// Chỉ lấy khai báo đang THẮNG của từng thuộc tính (khối ưu tiên cao nhất có khai báo nó); thắng mà không phải số (auto) thì bỏ qua.
function axisOf(el, names) {
  const refs = matchedRules(el);
  for (const [name, sign] of names) {
    const ref = refs.find(r => r.rule.style.getPropertyValue(name));
    if (!ref) continue;
    const value = ref.rule.style.getPropertyValue(name).trim();
    const m = value.match(/-?\d*\.?\d+/);
    if (m) return { ref, name, sign, value, m };
  }
  return null;
}
const AXES = { x: [['left', 1], ['right', -1]], y: [['top', 1], ['bottom', -1]] };
// Chưa có left / top: thêm vào khối đang áp (position: relative nếu đang static) để kéo được mọi phần tử
function moveAxis(el, horizontal) {
  const names = horizontal ? AXES.x : AXES.y;
  const found = axisOf(el, names);
  if (found) return found;
  const ref = editableRef(el);
  if (!ref) return null;
  const cs = getComputedStyle(el), prop = horizontal ? 'left' : 'top';
  let start = 0;
  if (cs.position === 'static') setProp(ref, 'position', 'relative');
  else if (cs.position === 'absolute' || cs.position === 'fixed') start = (parseFloat(cs[prop]) || 0) / unitPx(el.parentElement);
  setProp(ref, prop, `calc(${round(start)} * var(--u))`);
  return axisOf(el, names);
}
function measure(el, axis, coord) {
  const before = el.getBoundingClientRect()[coord];
  const test = axis.value.slice(0, axis.m.index) + (parseFloat(axis.m[0]) + 10) + axis.value.slice(axis.m.index + axis.m[0].length);
  const rule = axis.ref.rule, priority = rule.style.getPropertyPriority(axis.name);
  rule.style.setProperty(axis.name, test, priority);
  const after = el.getBoundingClientRect()[coord];
  rule.style.setProperty(axis.name, axis.value, priority);
  return (after - before) / 10 || 0;
}
const withNumber = (axis, n) => axis.value.slice(0, axis.m.index) + n + axis.value.slice(axis.m.index + axis.m[0].length) +
  (axis.ref.rule.style.getPropertyPriority(axis.name) ? ' !important' : '');
function moveBy(el, dx, dy, step = .01) {
  let moved = false;
  for (const [horizontal, delta] of [[true, dx], [false, dy]]) {
    if (Math.abs(delta) < .01) continue;
    const axis = moveAxis(el, horizontal);
    if (!axis) continue;
    const scale = measure(el, axis, horizontal ? 'left' : 'top');
    if (!scale) continue;
    setProp(axis.ref, axis.name, withNumber(axis, round(parseFloat(axis.m[0]) + delta / scale, step)));
    moved = true;
  }
  return moved;
}
const NOT_MOVABLE = 'This layer\'s position is set by game code (or a parent layout), so it cannot be moved from here. Try ⬆ Parent.';

// ---------- Chọn, liên kết (group) ----------
const primary = () => selection.at(-1) || null;
const live = () => (selection = selection.filter(el => el.isConnected));
function domPath(el) {
  const parts = [];
  for (; el && el !== document.body && el.parentElement; el = el.parentElement) {
    if (el.id) { parts.unshift('#' + CSS.escape(el.id)); return parts.join(' > '); }
    parts.unshift(`${el.tagName.toLowerCase()}:nth-child(${[...el.parentElement.children].indexOf(el) + 1})`);
  }
  return ['body', ...parts].join(' > ');
}
function linkedWith(el) {
  const path = domPath(el), group = links.find(g => g.includes(path));
  if (!group) return null;
  const els = group.map(q => { try { return document.querySelector(q); } catch { return null; } }).filter(Boolean);
  return els.length > 1 ? els : null;
}
function select(el, { add = false } = {}) {
  const group = linkedWith(el) || [el];
  if (add && selection.includes(el)) selection = selection.filter(x => !group.includes(x));
  else selection = [...(add ? selection.filter(x => !group.includes(x)) : []), ...group.filter(x => x !== el), el];
  if (!add) picking = false;
  render();
}
function linkSelection() {
  const els = live();
  if (els.length < 2) { flash('Shift + click to select 2 or more layers, then Link them.'); return; }
  const paths = els.map(domPath);
  links = links.filter(g => !g.some(p => paths.includes(p)));
  links.push(paths);
  store('ui-studio-links', links);
  flash(`Linked ${els.length} layers: clicking one now selects all of them.`);
  render();
}
function unlinkSelection() {
  const paths = live().map(domPath), before = links.length;
  links = links.filter(g => !g.some(p => paths.includes(p)));
  store('ui-studio-links', links);
  flash(before === links.length ? 'Nothing to unlink.' : 'Unlinked.');
  render();
}

// ---------- Căn lề ----------
const union = rects => {
  const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right)), bottom = Math.max(...rects.map(r => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};
function containerRect(el) {
  const parent = el.parentElement;
  if (!parent || parent === document.body || parent === document.documentElement) return frame();
  const r = parent.getBoundingClientRect();
  return r.width && r.height ? r : frame();
}
// nhiều layer cùng dùng MỘT khối CSS để định vị: dời từng cái là dời cả nhóm, căn lề sẽ sai
function sharedRule(els) {
  const seen = new Map();
  for (const el of els) {
    const axis = axisOf(el, AXES.x) || axisOf(el, AXES.y), ref = axis ? axis.ref : editableRef(el);
    if (!ref) continue;
    const k = keyOf(ref);
    if (seen.has(k)) return `${label(seen.get(k))} and ${label(el)} are positioned by the same style rule (${ref.selector}), so moving one moves both. Align them one at a time, or ask a dev to give them separate classes.`;
    seen.set(k, el);
  }
  return '';
}
const ALIGN = {
  left: ['Align left edges', (r, b) => [b.left - r.left, 0]],
  hcenter: ['Align horizontal centers', (r, b) => [b.left + b.width / 2 - (r.left + r.width / 2), 0]],
  right: ['Align right edges', (r, b) => [b.right - r.right, 0]],
  top: ['Align top edges', (r, b) => [0, b.top - r.top]],
  vcenter: ['Align vertical centers', (r, b) => [0, b.top + b.height / 2 - (r.top + r.height / 2)]],
  bottom: ['Align bottom edges', (r, b) => [0, b.bottom - r.bottom]],
};
function align(kind) {
  const els = live();
  if (!els.length) { flash('Select a layer first.'); return; }
  const problem = els.length > 1 && sharedRule(els);
  if (problem) { flash(problem); return; }
  const rects = els.map(el => el.getBoundingClientRect());
  const box = els.length > 1 ? union(rects) : containerRect(els[0]);
  let failed = 0;
  act(ALIGN[kind][0], () => els.forEach((el, i) => {
    const [dx, dy] = ALIGN[kind][1](rects[i], box);
    if ((Math.abs(dx) > .5 || Math.abs(dy) > .5) && !moveBy(el, dx, dy)) failed++;
  }));
  if (failed) flash(NOT_MOVABLE);
  render();
}
function distribute(horizontal) {
  const els = live();
  if (els.length < 3) { flash('Select 3 or more layers to distribute.'); return; }
  const problem = sharedRule(els);
  if (problem) { flash(problem); return; }
  const [start, size] = horizontal ? ['left', 'width'] : ['top', 'height'];
  const items = els.map(el => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r[start] - b.r[start]);
  const first = items[0].r, last = items.at(-1).r;
  const gap = (last[start] + last[size] - first[start] - items.reduce((sum, it) => sum + it.r[size], 0)) / (items.length - 1);
  let at = first[start];
  act(horizontal ? 'Distribute horizontally' : 'Distribute vertically', () => {
    for (const { el, r } of items) {
      const delta = at - r[start];
      if (Math.abs(delta) > .5) moveBy(el, horizontal ? delta : 0, horizontal ? 0 : delta);
      at += r[size] + gap;
    }
  });
  render();
}
function nudge(dx, dy) {
  const els = live();
  if (!els.length) return;
  const u = frame().u;
  let failed = 0;
  act('Nudge', () => els.forEach(el => { if (!moveBy(el, dx * u, dy * u)) failed++; }));
  if (failed) flash(NOT_MOVABLE);
  render();
}

// ---------- Giao diện ----------
const svg = d => `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${d}</svg>`;
const ICON = {
  select: svg('<path d="M3 1.5l10 6.2-4.4 1.1L11 13.6l-2 1-2.4-4.8L3 12.5z"/>'),
  studio: svg('<path d="M2 4h7M13 4h1M2 8h2M8 8h6M2 12h8M14 12h0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><circle cx="11" cy="4" r="1.9"/><circle cx="6" cy="8" r="1.9"/><circle cx="12" cy="12" r="1.9"/>'),
  left: svg('<rect x="1" y="1" width="1.5" height="14"/><rect x="4" y="3" width="10" height="3.5" rx=".6"/><rect x="4" y="9.5" width="6" height="3.5" rx=".6"/>'),
  hcenter: svg('<rect x="7.25" y="1" width="1.5" height="14"/><rect x="2" y="3" width="12" height="3.5" rx=".6" opacity=".85"/><rect x="4.5" y="9.5" width="7" height="3.5" rx=".6" opacity=".85"/>'),
  right: svg('<rect x="13.5" y="1" width="1.5" height="14"/><rect x="2" y="3" width="10" height="3.5" rx=".6"/><rect x="6" y="9.5" width="6" height="3.5" rx=".6"/>'),
  top: svg('<rect x="1" y="1" width="14" height="1.5"/><rect x="3" y="4" width="3.5" height="10" rx=".6"/><rect x="9.5" y="4" width="3.5" height="6" rx=".6"/>'),
  vcenter: svg('<rect x="1" y="7.25" width="14" height="1.5"/><rect x="3" y="2" width="3.5" height="12" rx=".6" opacity=".85"/><rect x="9.5" y="4.5" width="3.5" height="7" rx=".6" opacity=".85"/>'),
  bottom: svg('<rect x="1" y="13.5" width="14" height="1.5"/><rect x="3" y="2" width="3.5" height="10" rx=".6"/><rect x="9.5" y="6" width="3.5" height="6" rx=".6"/>'),
  distH: svg('<rect x="1" y="1" width="1.5" height="14"/><rect x="13.5" y="1" width="1.5" height="14"/><rect x="6" y="4" width="4" height="8" rx=".6"/>'),
  distV: svg('<rect x="1" y="1" width="14" height="1.5"/><rect x="1" y="13.5" width="14" height="1.5"/><rect x="4" y="6" width="8" height="4" rx=".6"/>'),
  grid: svg('<path d="M1.6 5.5h12.8M1.6 10.5h12.8M5.5 1.6v12.8M10.5 1.6v12.8" stroke="currentColor" stroke-width="1.2" fill="none"/><rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>'),
  snap: svg('<path d="M2.5 2h3.5v6a2 2 0 0 0 4 0V2h3.5v6a5.5 5.5 0 0 1-11 0z"/><rect x="2.5" y="2" width="3.5" height="2.2" fill="#ff6b6b"/><rect x="10" y="2" width="3.5" height="2.2" fill="#ff6b6b"/>'),
  link: svg('<path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.6-2.6a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.1 9.2a2.6 2.6 0 0 0 3.7 3.7l.9-.9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>'),
  unlink: svg('<path d="M9.2 3.8l.6-.6a2.6 2.6 0 0 1 3.7 3.7l-1.7 1.7M6.8 12.2l-.6.6a2.6 2.6 0 0 1-3.7-3.7l1.7-1.7M2 2l12 12" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>'),
};

const host = document.createElement('div');
host.id = 'ui-studio';
host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>
  :host { all: initial; }
  * { box-sizing: border-box; font: 12px/1.35 ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
  canvas.grid { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; display: none; }
  .guide { position: fixed; background: #ff2fb4; pointer-events: none; }
  .guide.x { top: 0; bottom: 0; width: 1px; } .guide.y { left: 0; right: 0; height: 1px; }
  .box { position: fixed; border: 1.5px solid #2f8cff; background: rgba(47,140,255,.06); pointer-events: none; border-radius: 2px; display: none; }
  .box.sel { cursor: move; pointer-events: auto; }
  .box.sel.primary { border-width: 2px; background: rgba(47,140,255,.1); }
  .box.hover { border-style: dashed; border-color: #ff7a2f; background: rgba(255,122,47,.06); }
  .tag { position: absolute; left: -2px; top: -20px; background: #2f8cff; color: #fff; padding: 1px 6px; border-radius: 3px 3px 0 0; white-space: nowrap; font-size: 11px; }
  .tag:empty { display: none; }
  .panel { position: fixed; left: 10px; top: 10px; width: min(404px, calc(100vw - 20px)); max-height: calc(100vh - 20px); display: flex; flex-direction: column;
    background: #1d1f24; color: #e8e8ea; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.45); pointer-events: auto; overflow: hidden; }
  .panel[hidden], .bubble[hidden] { display: none; }
  .bubble { position: fixed; width: 48px; height: 48px; border-radius: 14px; padding: 0; justify-content: center; pointer-events: auto; touch-action: none;
    background: rgba(29,31,36,.86); color: #8fc3ff; box-shadow: 0 4px 16px rgba(0,0,0,.45), inset 0 0 0 1.5px rgba(255,255,255,.12); cursor: grab;
    transition: left .22s cubic-bezier(.3,1.3,.5,1), top .22s cubic-bezier(.3,1.3,.5,1), opacity .2s; opacity: .82; }
  .bubble:hover { background: rgba(38,41,47,.95); opacity: 1; }
  .bubble.dragging { transition: none; cursor: grabbing; opacity: 1; }
  .bubble svg { width: 24px; height: 24px; }
  .bubble .badge { position: absolute; right: -3px; top: -3px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #ff8a2f; color: #fff;
    font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; }
  .bubble .badge:empty { display: none; }
  .bar { display: flex; gap: 3px; align-items: center; padding: 6px 8px; background: #26292f; flex-wrap: wrap; }
  .bar.head { cursor: grab; touch-action: none; }
  .bar.head.dragging { cursor: grabbing; }
  .bar.tools { background: #22252b; border-top: 1px solid #1a1c20; }
  .title { font-weight: 700; margin-right: auto; display: flex; align-items: center; gap: 6px; user-select: none; }
  .grip { color: #5d626c; letter-spacing: -2px; margin-right: 2px; }
  button.mini { padding: 2px 6px; font-size: 11px; }
  .gridset { display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 4px 6px; align-items: center; }
  .gridset label { display: flex; align-items: center; gap: 5px; color: #e8e8ea; white-space: nowrap; cursor: pointer; }
  .gridset .h { color: #9aa0aa; font-size: 10.5px; text-align: center; }
  .gridset input[type=number] { text-align: center; padding: 2px 4px; }
  .gridset input[type=checkbox] { width: auto; accent-color: #2f8cff; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #e04848; }
  .dot.on { background: #3fcf6a; }
  .sep { width: 1px; align-self: stretch; background: #3a3e47; margin: 0 3px; }
  button { background: #3a3e47; color: #fff; border: 0; border-radius: 6px; padding: 5px 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
  button:hover { background: #4a4f5a; }
  button:disabled { color: #6b707a; background: #30333a; cursor: default; }
  button.icon { padding: 4px 5px; background: transparent; }
  button.icon:hover:not(:disabled) { background: #3a3e47; }
  button.icon:disabled { background: transparent; }
  button.on, button.icon.on { background: #2f8cff; }
  button.save { background: #2f9e55; } button.save:disabled { background: #3a3e47; color: #888; }
  .num { width: 38px; padding: 2px 4px; text-align: center; }
  .body { overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .hint { color: #9aa0aa; }
  .msg { color: #ffd479; padding: 4px 8px 6px; background: #26292f; }
  .el { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .el code { color: #8fc3ff; word-break: break-all; }
  .section { background: #26292f; border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; }
  .section h4 { margin: 0; color: #9aa0aa; font-weight: 600; text-transform: uppercase; font-size: 10.5px; letter-spacing: .04em; }
  .chips { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
  .chip { background: #32363e; color: #c8ccd4; border-radius: 4px; padding: 1px 6px; cursor: pointer; font-family: ui-monospace, Consolas, monospace; font-size: 11px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip:hover { background: #2f8cff; color: #fff; }
  .chip.cur { background: #2f8cff33; color: #8fc3ff; }
  .chip .x { padding: 0 0 0 4px; color: #888; }
  .crumb-sep { color: #5d626c; }
  .card { background: #26292f; border-radius: 8px; padding: 6px 8px; }
  .card.dirty { outline: 1px solid #ffb347; }
  .head { color: #9aa0aa; margin-bottom: 4px; display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .head b { color: #ffd479; font-weight: 600; word-break: break-all; }
  .count { color: #9aa0aa; background: #32363e; border-radius: 4px; padding: 0 5px; font-size: 10.5px; }
  .count.many { color: #ffb347; }
  .row { display: grid; grid-template-columns: 118px 1fr auto; gap: 4px; align-items: center; margin: 2px 0; }
  .row label { color: #c9a8ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help; }
  .row.changed label { color: #ffb347; }
  input { width: 100%; background: #15171b; color: #fff; border: 1px solid #3a3e47; border-radius: 4px; padding: 3px 5px; font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; }
  input:focus { outline: none; border-color: #2f8cff; }
  input[type=color] { width: 26px; height: 22px; padding: 0; border: 0; background: none; cursor: pointer; }
  .x { background: none; color: #777; padding: 0 4px; } .x:hover { color: #ff6b6b; background: none; }
  .add { display: grid; grid-template-columns: 118px 1fr auto; gap: 4px; margin-top: 4px; }
  .img { display: flex; gap: 8px; align-items: center; background: #26292f; border-radius: 8px; padding: 6px; border: 1px dashed transparent; }
  .img.drag { border-color: #2f8cff; }
  .img img { width: 56px; height: 56px; object-fit: contain; background: repeating-conic-gradient(#3a3e47 0 25%, #2c2f36 0 50%) 0 0/12px 12px; border-radius: 4px; }
  .img .p { word-break: break-all; color: #c8ccd4; flex: 1; white-space: pre-line; }
  .help { background: #26292f; border-radius: 8px; padding: 8px 10px; color: #c8ccd4; }
  .help h4 { margin: 6px 0 3px; color: #ffd479; font-weight: 700; }
  .help h4:first-child { margin-top: 0; }
  .help dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
  .help dt { color: #8fc3ff; white-space: nowrap; } .help dd { margin: 0; }
  .help p { margin: 0 0 4px; }
  kbd { background: #32363e; border-radius: 3px; padding: 0 4px; font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: #e8e8ea; }
  .tip { position: fixed; max-width: 300px; background: #0f1013; color: #e8e8ea; border: 1px solid #3a3e47; border-radius: 6px; padding: 6px 8px;
    box-shadow: 0 6px 18px rgba(0,0,0,.5); pointer-events: none; white-space: pre-line; z-index: 2; }
  .tip b { display: block; color: #fff; margin-bottom: 2px; }
  .tip b:empty { display: none; }
  .tip i { display: block; margin-top: 4px; color: #8fc3ff; font-style: normal; font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
  .tip i:empty { display: none; }
</style>
<canvas class="grid"></canvas><div class="guides"></div>
<div class="box hover"></div><div class="sels"></div>
<button class="bubble" hidden>${ICON.studio}<span class="badge"></span></button>
<div class="panel"><div class="bar head"></div><div class="bar tools"></div><div class="msg" hidden></div><div class="body"></div></div>
<div class="tip" hidden><b></b><span></span><i></i></div>
<datalist id="props">${Object.keys(PROP_HELP).map(p => `<option value="${p}" label="${esc(PROP_HELP[p][0].slice(0, 48))}">`).join('')}</datalist>`;
const hoverBox = root.querySelector('.box.hover'), sels = root.querySelector('.sels'), guides = root.querySelector('.guides');
const gridCanvas = root.querySelector('canvas.grid');
const panel = root.querySelector('.panel'), headBar = root.querySelector('.bar.head'), toolBar = root.querySelector('.bar.tools');
const body = root.querySelector('.body'), msg = root.querySelector('.msg'), tip = root.querySelector('.tip');
const bubble = root.querySelector('.bubble');
document.body.append(host);

let flashTimer = 0;
function flash(text) {
  msg.textContent = text; msg.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { msg.hidden = true; }, Math.max(3500, text.length * 55));
}

// ---------- Chú thích khi rê chuột ----------
// data-tip-title (đậm) + data-tip (giải thích) + data-tip-eg (ví dụ giá trị)
function setTip(node, title, text, example = '') {
  node.dataset.tipTitle = title; node.dataset.tip = text; node.dataset.tipEg = example;
  return node;
}
let tipFor = null, tipTimer = 0;
function hideTip() { clearTimeout(tipTimer); tipFor = null; tip.hidden = true; }
root.addEventListener('pointerover', event => {
  const target = event.target.closest?.('[data-tip]') || null;
  if (target === tipFor) return;
  hideTip();
  tipFor = target;
  if (target) tipTimer = setTimeout(() => showTip(target), 350);
});
panel.addEventListener('pointerleave', hideTip);
root.addEventListener('pointerdown', hideTip, true);
function showTip(target) {
  if (!target.isConnected) return;
  const [b, span, i] = tip.children;
  b.textContent = target.dataset.tipTitle || '';
  span.textContent = target.dataset.tip || '';
  i.textContent = target.dataset.tipEg ? 'e.g. ' + target.dataset.tipEg : '';
  tip.hidden = false;
  const r = target.getBoundingClientRect(), t = tip.getBoundingClientRect();
  let top = r.bottom + 6;
  if (top + t.height > innerHeight - 6) top = Math.max(6, r.top - t.height - 6);
  tip.style.left = Math.max(6, Math.min(r.left, innerWidth - t.width - 6)) + 'px';
  tip.style.top = top + 'px';
}

// ---------- Thanh công cụ ----------
const ui = {};
function tool(parent, name, { text = '', icon = '', title, tip: help, eg = '', cls = '', onClick }) {
  const b = document.createElement('button');
  b.innerHTML = (icon ? ICON[icon] : '') + (text ? `<span>${esc(text)}</span>` : '');
  b.className = (icon && !text ? 'icon ' : '') + cls;
  b.onclick = onClick;
  setTip(b, title, help, eg);
  parent.append(b);
  if (name) ui[name] = b;
  return b;
}
const sep = parent => parent.append(Object.assign(document.createElement('span'), { className: 'sep' }));
function buildBars() {
  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = '<span class="grip">⋮⋮</span><span class="dot"></span>UI Studio <span class="hint ro"></span>';
  ui.dot = title.querySelector('.dot'); ui.ro = title.querySelector('.ro');
  setTip(title.querySelector('.grip'), 'Move panel', 'Drag this bar to put the panel anywhere on the screen.');
  headBar.append(title);
  tool(headBar, 'save', { text: 'Save', cls: 'save', title: 'Save  (Ctrl + S)', tip: 'Writes every unsaved change (orange) into the CSS files in game/ui/. Then commit them in GitHub Desktop with the "UI:" prefix.', onClick: saveAll });
  tool(headBar, 'revert', { text: 'Revert', title: 'Revert', tip: 'Throws away every change that is not saved yet and goes back to what is in the files (like File → Revert). You can still Undo it.', onClick: () => { if (confirm('Discard every unsaved change?')) revertAll(); } });
  tool(headBar, 'collapse', { text: '–', title: 'Collapse to icon', tip: 'Shrinks the panel into a small floating icon (like collapsing a Photoshop panel to an icon). Click the icon to open it again; drag the icon anywhere.', onClick: () => setOpen(false) });

  tool(toolBar, 'select', { icon: 'select', text: 'Select', title: 'Select tool  (V)', tip: 'Then click a layer (button, panel, text, image) in the game. Shift + click adds or removes layers. Alt + click selects at any time, even with this tool off. Esc: stop selecting.', onClick: () => { picking = !picking; syncBar(); } });
  tool(toolBar, 'undo', { text: '↶', title: 'Undo  (Ctrl + Z)', tip: 'Nothing to undo', onClick: undo });
  tool(toolBar, 'redo', { text: '↷', title: 'Redo  (Ctrl + Shift + Z / Ctrl + Y)', tip: 'Nothing to redo', onClick: redo });
  sep(toolBar);
  const alignTip = 'With one layer selected it aligns to its parent box; with several selected it aligns them to each other.';
  for (const kind of Object.keys(ALIGN)) tool(toolBar, 'a-' + kind, { icon: kind, title: ALIGN[kind][0], tip: alignTip, onClick: () => align(kind) });
  tool(toolBar, 'distH', { icon: 'distH', title: 'Distribute horizontally', tip: 'Makes the gaps between 3 or more selected layers equal, left to right. The outer two stay put.', onClick: () => distribute(true) });
  tool(toolBar, 'distV', { icon: 'distV', title: 'Distribute vertically', tip: 'Makes the gaps between 3 or more selected layers equal, top to bottom. The outer two stay put.', onClick: () => distribute(false) });
  sep(toolBar);
  tool(toolBar, 'grid', { icon: 'grid', title: 'Show layout grid  (Ctrl + \')', tip: 'Shows the layout grid over the 393 px design frame, like Figma: red = columns, blue = rows, thin lines = square grid. Pink lines = frame edges and center.', onClick: () => { prefs.grid = !prefs.grid; savePrefs(); syncBar(); } });
  tool(toolBar, 'gridSet', { text: '▾', cls: 'mini', title: 'Layout grid settings', tip: 'Set up columns, rows and the square grid (count, gutter, margin, size).', onClick: () => { showGridSettings = !showGridSettings; if (showGridSettings) prefs.grid = true; savePrefs(); render(); } });
  tool(toolBar, 'snap', { icon: 'snap', title: 'Snap  (Ctrl + Shift + ;)', tip: 'While dragging, edges and centers stick to the frame edges / center and, when the grid is shown, to column, row and grid lines.', onClick: () => { prefs.snap = !prefs.snap; savePrefs(); syncBar(); } });
  sep(toolBar);
  tool(toolBar, 'link', { icon: 'link', title: 'Link layers  (Ctrl + G)', tip: 'Groups the selected layers so clicking one selects all of them and they move together. Only remembered in this browser; it does not change the game files.', onClick: linkSelection });
  tool(toolBar, 'unlink', { icon: 'unlink', title: 'Unlink layers  (Ctrl + Shift + G)', tip: 'Removes the link from the selected layers.', onClick: unlinkSelection });
  sep(toolBar);
  tool(toolBar, 'help', { text: '?', title: 'Help', tip: 'What the words in this panel mean, plus every keyboard shortcut.', onClick: () => { showHelp = !showHelp; render(); } });
}
function syncBar() {
  const n = [...pending.values()].reduce((sum, e) => sum + Object.keys(e.props).length, 0);
  const count = live().length, linked = selection.some(el => linkedWith(el));
  ui.dot.classList.toggle('on', online);
  setTip(ui.dot, online ? 'Connected' : 'Disconnected', online ? 'Connected to the studio server: file changes show up live.' : 'Lost the studio server. Is the server window still running?');
  ui.ro.textContent = canWrite ? '' : '(view only)';
  setTip(ui.ro, 'View only', 'This device can only preview. Edit and save on the computer running the server.');
  ui.save.querySelector('span').textContent = n ? `Save (${n})` : 'Save';
  ui.save.disabled = !n;
  ui.revert.disabled = !n;
  ui.undo.disabled = !history.length;
  ui.undo.dataset.tip = history.length ? 'Undo: ' + history.at(-1).label : 'Nothing to undo';
  ui.redo.disabled = !future.length;
  ui.redo.dataset.tip = future.length ? 'Redo: ' + future.at(-1).label : 'Nothing to redo';
  ui.select.classList.toggle('on', picking);
  for (const kind of Object.keys(ALIGN)) ui['a-' + kind].disabled = !count;
  ui.distH.disabled = ui.distV.disabled = count < 3;
  ui.grid.classList.toggle('on', prefs.grid);
  ui.snap.classList.toggle('on', prefs.snap);
  ui.link.disabled = count < 2;
  ui.unlink.disabled = !linked;
  ui.help.classList.toggle('on', showHelp);
  ui.gridSet.classList.toggle('on', showGridSettings);
  bubble.querySelector('.badge').textContent = n ? String(n) : '';
  setTip(bubble, 'UI Studio', `Click to open the panel. Drag to move it anywhere; it sticks to the nearest side.${n ? `\n${n} unsaved change${n === 1 ? '' : 's'}.` : ''}`);
}

// ---------- Bảng nổi + nút tròn (kéo đi đâu cũng được, như nút AssistiveTouch của iPhone) ----------
const clampPos = (x, y, w, h) => [Math.max(4, Math.min(x, innerWidth - w - 4)), Math.max(4, Math.min(y, innerHeight - h - 4))];
function placeFloating() {
  const b = prefs.bubble || { x: innerWidth - 60, y: 90 };
  const [bx, by] = clampPos(b.x, b.y, 48, 48);
  bubble.style.left = bx + 'px'; bubble.style.top = by + 'px';
  if (collapsed) return;
  const w = panel.offsetWidth || Math.min(404, innerWidth - 20);
  const p = prefs.panel || { x: innerWidth - w - 10, y: 10 };
  const [px, py] = clampPos(p.x, p.y, w, 80);
  panel.style.left = px + 'px'; panel.style.top = py + 'px';
  panel.style.maxHeight = `calc(100vh - ${py + 10}px)`;
}
addEventListener('resize', placeFloating);
function setOpen(open) {
  if (open) {
    // mở ngay cạnh nút tròn, về phía còn nhiều chỗ (như panel Photoshop bung ra từ icon)
    const w = Math.min(404, innerWidth - 20), b = bubble.getBoundingClientRect();
    if (b.width) prefs.panel = { x: b.left + 24 > innerWidth / 2 ? b.left - w - 8 : b.right + 8, y: b.top };
  }
  collapsed = !open;
  prefs.open = open;
  savePrefs();
  render();
}
// Kéo bằng pointer capture; nhích < 4 px coi là bấm
function draggable(handle, { start, move, end, click }) {
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (handle !== bubble && event.target.closest('button, input'))) return;
    event.preventDefault();
    const x0 = event.clientX, y0 = event.clientY, origin = start();
    let moved = false;
    const onMove = e => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      move(origin, dx, dy);
    };
    const onUp = e => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      if (moved) end(); else if (e.type === 'pointerup') click?.();
    };
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}
draggable(bubble, {
  start: () => { hideTip(); const r = bubble.getBoundingClientRect(); return { x: r.left, y: r.top }; },
  move: (o, dx, dy) => {
    bubble.classList.add('dragging');
    const [x, y] = clampPos(o.x + dx, o.y + dy, 48, 48);
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
  },
  end: () => {
    // thả ra thì dính vào cạnh trái / phải gần nhất
    const r = bubble.getBoundingClientRect();
    bubble.classList.remove('dragging');
    prefs.bubble = { x: r.left + r.width / 2 < innerWidth / 2 ? 8 : innerWidth - 56, y: r.top };
    savePrefs();
    placeFloating();
  },
  click: () => setOpen(true),
});
draggable(headBar, {
  start: () => { hideTip(); const r = panel.getBoundingClientRect(); return { x: r.left, y: r.top }; },
  move: (o, dx, dy) => { headBar.classList.add('dragging'); prefs.panel = { x: o.x + dx, y: o.y + dy }; placeFloating(); },
  end: () => { headBar.classList.remove('dragging'); savePrefs(); },
});

// ---------- Cài đặt lưới kiểu Figma ----------
function gridBlock() {
  const s = section('Layout grid', 'Like Figma layout grids, in design pixels over the 393 px frame. Columns and rows stretch to fill the frame: Margin = space at both ends, Gutter = space between them. Shown with the grid button (Ctrl + \'), and Snap sticks to their edges.');
  const g = document.createElement('div');
  g.className = 'gridset';
  g.innerHTML = '<span></span><span class="h">Count / Size</span><span class="h">Gutter</span><span class="h">Margin</span>';
  const number = (key, field, help, min = 0) => {
    const input = document.createElement('input');
    input.type = 'number'; input.min = min; input.max = 400; input.value = prefs[key][field];
    setTip(input, help[0], help[1], help[2]);
    input.oninput = () => { const v = Number(input.value); if (input.value !== '' && v >= min) { prefs[key][field] = v; savePrefs(); } };
    return input;
  };
  const rowOf = (key, name, color, help) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox"${prefs[key].on ? ' checked' : ''}><span class="sw" style="background:${color}"></span>${name}`;
    label.querySelector('input').onchange = event => { prefs[key].on = event.target.checked; prefs.grid = true; savePrefs(); syncBar(); };
    setTip(label, name, help);
    g.append(label);
  };
  rowOf('cols', 'Columns', 'rgba(255,72,72,.7)', 'Vertical columns across the frame (red).');
  g.append(number('cols', 'count', ['Columns', 'How many columns.', '4 · 6 · 12'], 1),
    number('cols', 'gutter', ['Column gutter', 'Space between two columns, in design px.', '16']),
    number('cols', 'margin', ['Column margin', 'Space between the frame edge and the first / last column, in design px.', '16']));
  rowOf('rows', 'Rows', 'rgba(47,140,255,.7)', 'Horizontal rows down the screen (blue).');
  g.append(number('rows', 'count', ['Rows', 'How many rows.', '6 · 8 · 12'], 1),
    number('rows', 'gutter', ['Row gutter', 'Space between two rows, in design px.', '16']),
    number('rows', 'margin', ['Row margin', 'Space at the top and bottom of the screen, in design px.', '16']));
  rowOf('square', 'Grid', 'rgba(0,170,255,.5)', 'A uniform square grid (thin lines; every 4th line is darker).');
  g.append(number('square', 'size', ['Grid size', 'Size of each square, in design px.', '4 · 8 · 16'], 2));
  s.append(g);
  return s;
}

// ---------- Bảng thuộc tính ----------
function propRow(ref, name, value, changed) {
  const row = document.createElement('div');
  row.className = 'row' + (changed ? ' changed' : '');
  row.innerHTML = '<label></label><input class="v"><span style="display:flex;gap:2px"></span>';
  const [meaning, example] = propHelp(name);
  setTip(row.querySelector('label'), name, meaning, example).textContent = name;
  const input = row.querySelector('.v');
  input.value = value;
  setTip(input, `Value of ${name}`, VALUE_TIP, example);
  const tools = row.querySelector('span');
  // mỗi lần vào ô = một bước undo, gõ bao nhiêu ký tự cũng vậy
  let token = null;
  input.addEventListener('focus', () => { token = { label: 'Edit ' + name }; });
  const apply = () => { act(null, () => setProp(ref, name, input.value), token || { label: 'Edit ' + name }); markRow(); };
  const markRow = () => { const e = pending.get(keyOf(ref)); row.classList.toggle('changed', !!(e && name in e.props)); row.closest('.card')?.classList.toggle('dirty', !!e); };
  input.addEventListener('input', apply);
  input.addEventListener('keydown', event => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    // tăng / giảm con số dưới con trỏ (hoặc số đầu tiên)
    const step = (event.shiftKey ? 10 : event.altKey ? .1 : 1) * (event.key === 'ArrowUp' ? 1 : -1);
    const text = input.value, caret = input.selectionStart ?? 0;
    const numbers = [...text.matchAll(/-?\d*\.?\d+/g)];
    if (!numbers.length) return;
    event.preventDefault();
    const hit = numbers.find(m => caret >= m.index && caret <= m.index + m[0].length) || numbers[0];
    const next = String(round(parseFloat(hit[0]) + step));
    input.value = text.slice(0, hit.index) + next + text.slice(hit.index + hit[0].length);
    input.setSelectionRange(hit.index, hit.index + next.length);
    apply();
    if (picker) picker.value = toHex(input.value);
  });
  let picker = null;
  if (isColor(value)) {
    picker = document.createElement('input');
    picker.type = 'color';
    picker.value = toHex(value);
    setTip(picker, 'Color picker', 'Opens the color picker. The transparency (alpha) of an rgba() value is kept.');
    let pickToken = null;
    picker.onfocus = () => { pickToken = { label: 'Edit ' + name }; };
    picker.oninput = () => { input.value = withAlpha(picker.value, input.value); act(null, () => setProp(ref, name, input.value), pickToken || { label: 'Edit ' + name }); markRow(); };
    tools.append(picker);
  }
  const del = document.createElement('button');
  del.className = 'x'; del.textContent = '✕';
  setTip(del, 'Remove property', `Deletes ${name} from this style rule. Undo brings it back.`);
  del.onclick = () => { act('Remove ' + name, () => setProp(ref, name, '')); row.remove(); };
  tools.append(del);
  return row;
}
const probe = document.createElement('canvas').getContext('2d');
function toHex(value) {
  probe.fillStyle = '#000'; probe.fillStyle = value.replace(/\s*!important$/, '');
  const c = probe.fillStyle;
  if (c.startsWith('#')) return c;
  const m = c.match(/[\d.]+/g);
  return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : '#000000';
}
function withAlpha(hex, old) {
  const a = old.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
  if (!a || +a[1] === 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a[1]})`;
}

// ---------- Ảnh ----------
function imagesOf(el) {
  const out = new Set();
  const add = url => { const p = pathOf(url); if ((p.startsWith('ui/') || p.startsWith('assets/')) && IMAGE_RE.test(p)) out.add(p); };
  if (el instanceof HTMLImageElement) add(el.currentSrc || el.src);
  for (const pseudo of [null, '::before', '::after']) {
    const bg = getComputedStyle(el, pseudo).backgroundImage;
    for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) add(m[1]);
  }
  return [...out];
}
function imageCard(path) {
  const card = document.createElement('div');
  card.className = 'img';
  card.innerHTML = `<img alt=""><div class="p"></div><button>Replace…</button><input type="file" accept="image/*" hidden>`;
  setTip(card, 'Image', 'An image file used by this layer. Click Replace… or drop a file here to overwrite it (the file name stays the same). Undo puts the old image back.');
  card.querySelector('img').src = '/' + path + '?t=' + Date.now();
  const info = card.querySelector('.p');
  info.textContent = path;
  card.querySelector('img').onload = function () { info.textContent = `${path}\n${this.naturalWidth}×${this.naturalHeight} px`; };
  const file = card.querySelector('input');
  card.querySelector('button').onclick = () => file.click();
  file.onchange = () => file.files[0] && replaceImage(path, file.files[0]);
  card.addEventListener('dragover', event => { event.preventDefault(); card.classList.add('drag'); });
  card.addEventListener('dragleave', () => card.classList.remove('drag'));
  card.addEventListener('drop', event => { event.preventDefault(); card.classList.remove('drag'); const f = event.dataTransfer.files[0]; if (f) replaceImage(path, f); });
  return card;
}
async function sendImage(path, blob) {
  if (!canWrite) { flash('This device can only preview.'); return false; }
  const res = await fetch('/__studio/upload?path=' + encodeURIComponent(path), { method: 'POST', body: blob });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) flash('Error: ' + data.error);
  return res.ok;
}
async function replaceImage(path, file) {
  if (!IMAGE_RE.test(file.name)) { flash('Images only (.png .jpg .webp .gif .svg).'); return; }
  const want = path.split('.').pop().toLowerCase(), got = file.name.split('.').pop().toLowerCase();
  if (want !== got && !confirm(`The original is .${want} but you picked a .${got} file. Overwrite anyway (keeping the name ${path})?`)) return;
  // giữ ảnh cũ để Undo ghi trả lại
  const before = await fetch('/' + path, { cache: 'no-store' }).then(r => (r.ok ? r.blob() : null)).catch(() => null);
  if (!await sendImage(path, file)) return;
  if (before) { history.push({ label: 'Replace ' + path.split('/').pop(), image: { path, before, after: file } }); future.length = 0; }
  flash(`Replaced ${path} ✓`);
  syncBar();
}

// ---------- Vẽ bảng ----------
const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('');
let chipHover = null;
function chip(el, text, cls = '') {
  const c = document.createElement('span');
  c.className = 'chip ' + cls;
  c.textContent = text;
  setTip(c, label(el), 'Click to select this layer.');
  c.onclick = event => select(el, { add: event.shiftKey });
  c.onpointerenter = () => { chipHover = el; };
  c.onpointerleave = () => { chipHover = null; };
  return c;
}
function section(title, help) {
  const s = document.createElement('div');
  s.className = 'section';
  const h = document.createElement('h4');
  h.textContent = title;
  setTip(h, title, help);
  s.append(h);
  return s;
}
function layersSection(el) {
  const out = [];
  if (selection.length > 1) {
    const s = section(`${selection.length} layers selected`, 'All selected layers move / align together. The properties below belong to the highlighted one; click another to show its properties.');
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const item of selection) {
      const c = chip(item, label(item), item === el ? 'cur' : '');
      c.onclick = () => { selection = [...selection.filter(x => x !== item), item]; render(); };
      const x = document.createElement('span');
      x.className = 'x'; x.textContent = '✕';
      x.onclick = event => { event.stopPropagation(); selection = selection.filter(s2 => s2 !== item); render(); };
      c.append(x);
      chips.append(c);
    }
    s.append(chips);
    out.push(s);
  }
  const s = section('Layers', 'Where this layer sits: its parents (left) and the layers inside it (below). Click one to select it; Shift + click adds it.');
  const crumbs = document.createElement('div');
  crumbs.className = 'chips';
  const chain = [];
  for (let p = el; p && p !== document.body; p = p.parentElement) chain.unshift(p);
  chain.slice(-6).forEach((p, i, list) => {
    crumbs.append(chip(p, label(p).split('.').slice(0, 2).join('.'), p === el ? 'cur' : ''));
    if (i < list.length - 1) crumbs.append(Object.assign(document.createElement('span'), { className: 'crumb-sep', textContent: '›' }));
  });
  s.append(crumbs);
  const kids = [...el.children].filter(k => !(k instanceof HTMLScriptElement || k instanceof HTMLStyleElement));
  if (kids.length) {
    const inner = document.createElement('div');
    inner.className = 'chips';
    inner.append(Object.assign(document.createElement('span'), { className: 'hint', textContent: 'Inside: ' }));
    for (const k of kids.slice(0, 30)) inner.append(chip(k, label(k).split('.').slice(0, 2).join('.')));
    if (kids.length > 30) inner.append(Object.assign(document.createElement('span'), { className: 'hint', textContent: `+${kids.length - 30} more` }));
    s.append(inner);
  }
  out.push(s);
  return out;
}
function helpBlock() {
  const h = document.createElement('div');
  h.className = 'help';
  h.innerHTML = `<h4>Words used here</h4><dl>
    <dt>Layer</dt><dd>Anything on screen: a button, panel, text or image. Select it with the Select tool.</dd>
    <dt>Style rule</dt><dd>Each card below. It lives in a .css file (shown in grey) and styles every layer that matches its <b>selector</b> (yellow). ×N shows how many layers use it right now: editing it changes all of them.</dd>
    <dt>Property</dt><dd>Which setting: color, opacity, width, font-size… (purple). Hover the name to see what it does.</dd>
    <dt>Value</dt><dd>What that setting is set to: #ff7a2f, 0.5, calc(24 * var(--u))… (the white box).</dd>
    <dt>var(--u)</dt><dd>1 design pixel of the 393 px-wide frame. calc(24 * var(--u)) = 24 px in the design. Keep this form so the UI scales on every phone.</dd>
    <dt>Orange</dt><dd>Changed but not saved yet. Save (Ctrl + S) writes it into the files.</dd>
  </dl>
  <h4>Shortcuts</h4><dl>
    <dt><kbd>V</kbd></dt><dd>Select tool</dd>
    <dt><kbd>Alt</kbd> + click</dt><dd>Select a layer at any time</dd>
    <dt><kbd>Shift</kbd> + click</dt><dd>Add / remove a layer from the selection</dd>
    <dt><kbd>Esc</kbd> · <kbd>Ctrl</kbd>+<kbd>D</kbd></dt><dd>Stop selecting · deselect all</dd>
    <dt>Arrows</dt><dd>Nudge 1 design px (<kbd>Shift</kbd> = 10)</dd>
    <dt>Drag blue box</dt><dd>Move the selected layers</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>Z</kbd></dt><dd>Undo</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> · <kbd>Ctrl</kbd>+<kbd>Y</kbd></dt><dd>Redo</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>S</kbd></dt><dd>Save to files</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>G</kbd> · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd></dt><dd>Link · unlink layers</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>'</kbd></dt><dd>Show / hide grid</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>;</kbd></dt><dd>Snap on / off</dd>
    <dt><kbd>Ctrl</kbd>+<kbd>H</kbd></dt><dd>Hide / show boxes and grid</dd>
    <dt>Panel</dt><dd>Drag the top bar to move it. <b>–</b> shrinks it to a floating icon; drag the icon anywhere, click it to open the panel again.</dd>
    <dt>In a value box</dt><dd><kbd>↑</kbd> / <kbd>↓</kbd> change the number (<kbd>Shift</kbd> ×10, <kbd>Alt</kbd> ×0.1)</dd>
  </dl>
  <h4>Link vs. Photoshop Group</h4><p>Link works like Photoshop's <b>Link Layers</b> (the chain icon): linked layers get selected and moved together. It is not a real Group (a folder that wraps layers): that would change the game's HTML, which is code. Links are only remembered in this browser.</p>
  <h4>Limits</h4><p>Only the 2D UI (CSS and images in game/ui/). Linking does not change the game files. The 3D rooms, cats and outlines are code: ask a dev.</p>`;
  return h;
}

let renderId = 0;
async function render() {
  const id = ++renderId;
  hideTip();
  syncBar();
  panel.hidden = collapsed;
  bubble.hidden = !collapsed;
  placeFloating();
  body.innerHTML = '';
  if (collapsed) return;
  if (showGridSettings) body.append(gridBlock());
  if (showHelp) body.append(helpBlock());
  live();
  const el = primary();
  if (!el) {
    if (!showHelp) body.insertAdjacentHTML('beforeend', `<div class="hint">Click <b>Select (V)</b>, then click a button / panel / text in the game (or hold <b>Alt</b> + click at any time). <b>Shift</b> + click adds more layers.<br><br>
      You can also edit the files in <code>game/ui/</code> (CSS, PNG) in any app: save the file and the game updates.<br><br>
      Hover any button, property name or value box for a short explanation. <b>?</b> lists every shortcut.</div>`);
    return;
  }
  const head = document.createElement('div');
  head.className = 'el';
  const rect = el.getBoundingClientRect(), u = frame().u;
  head.innerHTML = `<code></code><span class="hint"></span>`;
  head.querySelector('code').textContent = label(el);
  setTip(head.querySelector('.hint'), 'Size', 'Width × height in design pixels (screen pixels in brackets).').textContent =
    `${round(rect.width / u, .1)}×${round(rect.height / u, .1)} (${Math.round(rect.width)}×${Math.round(rect.height)} px)`;
  const up = document.createElement('button');
  up.textContent = '⬆ Parent';
  setTip(up, 'Select parent', 'Selects the layer that contains this one, e.g. the whole button instead of its label.');
  up.onclick = () => { if (el.parentElement && el.parentElement !== document.body) select(el.parentElement); };
  head.append(up);
  body.append(head, ...layersSection(el));
  for (const path of imagesOf(el)) body.append(imageCard(path));
  const refs = matchedRules(el);
  const lists = await Promise.all(refs.map(sourceDecls));
  if (id !== renderId) return;
  if (!refs.length) body.insertAdjacentHTML('beforeend', '<div class="hint">No style rule in game/ui/ applies to this layer. Try ⬆ Parent.</div>');
  refs.forEach((ref, i) => {
    const card = document.createElement('div');
    const edit = pending.get(keyOf(ref));
    card.className = 'card' + (edit ? ' dirty' : '');
    card.innerHTML = '<div class="head"><span></span><b></b><span class="count"></span></div>';
    const [file, selector, count] = card.querySelectorAll('.head > *');
    setTip(file, 'File', 'The CSS file this style rule lives in. Save writes your changes here.').textContent = ref.file.replace(/^ui\//, '');
    setTip(selector, 'Selector', `Which layers this rule styles.${i === 0 ? ' This card wins when two rules set the same property (it is listed first).' : ' Rules higher up win when they set the same property.'}`).textContent = ref.selector;
    const n = countMatches(ref.selector);
    count.textContent = '×' + n;
    count.classList.toggle('many', n > 1);
    setTip(count, `Used by ${n} layer${n === 1 ? '' : 's'}`, n > 1 ? `Editing this rule changes all ${n} layers that match it right now (more may appear on other screens).` : 'Only this layer uses this rule on the current screen (others may on other screens).');
    // đọc theo cssText để giữ thuộc tính viết gọn (background, border-radius...) thay vì tách thành hàng chục thuộc tính con
    const list = (lists[i] || decls(ref.rule.style.cssText)).map(([name, value]) => [name, edit && name in edit.props ? edit.props[name] : value]);
    if (edit) for (const name of Object.keys(edit.props)) if (!list.some(([nm]) => nm === name)) list.push([name, edit.props[name]]);
    for (const [name, value] of list) if (value !== '') card.append(propRow(ref, name, value, !!(edit && name in edit.props)));
    const add = document.createElement('div');
    add.className = 'add';
    add.innerHTML = '<input placeholder="+ property" list="props"><input placeholder="value"><button>+</button>';
    const [nameIn, valueIn] = add.querySelectorAll('input');
    setTip(nameIn, 'Add a property', 'Type the setting you want to add to this rule (e.g. opacity, color, font-size). Suggestions appear as you type.');
    setTip(valueIn, 'Value', VALUE_TIP);
    setTip(add.querySelector('button'), 'Add', 'Adds the property to this style rule (or press Enter).');
    nameIn.addEventListener('input', () => { const [meaning, example] = propHelp(nameIn.value.trim().toLowerCase()); setTip(valueIn, 'Value', meaning + '\n\n' + VALUE_TIP, example); valueIn.placeholder = example.split(' · ')[0] || 'value'; });
    const commit = () => {
      const name = nameIn.value.trim().toLowerCase();
      if (!name || !valueIn.value.trim()) return;
      act('Add ' + name, () => setProp(ref, name, valueIn.value.trim()));
      add.before(propRow(ref, name, valueIn.value.trim(), true));
      card.classList.add('dirty');
      nameIn.value = valueIn.value = ''; nameIn.focus();
    };
    add.querySelector('button').onclick = commit;
    valueIn.addEventListener('keydown', event => { if (event.key === 'Enter') commit(); });
    card.append(add);
    body.append(card);
  });
}
function decls(text) {
  const out = [];
  let begin = 0, depth = 0, quote = '';
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (i === text.length || (ch === ';' && !depth)) {
      const part = text.slice(begin, i), colon = part.indexOf(':');
      if (colon > 0) out.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim()]);
      begin = i + 1;
    }
  }
  return out;
}

// ---------- Chọn phần tử trong game ----------
const ours = event => event.composedPath().includes(host);
const shouldPick = event => prefs.shown && (picking || event.altKey) && !ours(event);
for (const type of ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'click']) {
  window.addEventListener(type, event => {
    if (!shouldPick(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (type === 'click') select(event.target, { add: event.shiftKey });
  }, { capture: true, passive: false });
}
let hoverTarget = null;
window.addEventListener('pointermove', event => {
  hoverTarget = prefs.shown && (picking || event.altKey) && !ours(event) ? event.target : null;
}, true);

// ---------- Kéo khung xanh ----------
let drag = null;
sels.addEventListener('pointerdown', event => {
  if (!event.target.closest('.box.sel') || !live().length) return;
  event.preventDefault(); event.stopPropagation();
  drag = { x0: event.clientX, y0: event.clientY, items: null, token: { label: `Move ${selection.length > 1 ? selection.length + ' layers' : label(primary())}` } };
  event.target.closest('.box.sel').setPointerCapture(event.pointerId);
});
sels.addEventListener('pointermove', event => {
  if (!drag) return;
  let dx = event.clientX - drag.x0, dy = event.clientY - drag.y0;
  // chỉ thêm left / top khi thật sự kéo (bấm nhầm không làm bẩn file)
  if (!drag.items) {
    if (Math.hypot(dx, dy) < 3) return;
    act(null, () => {
      drag.items = live().map(el => {
        const axes = [];
        for (const [horizontal, coord] of [[true, 'left'], [false, 'top']]) {
          const axis = moveAxis(el, horizontal);
          if (axis) axes.push({ ...axis, horizontal, scale: measure(el, axis, coord) });
        }
        return { el, axes };
      });
    }, drag.token);
    drag.rect = union(selection.map(el => el.getBoundingClientRect()));
    if (!drag.items.some(it => it.axes.some(a => a.scale))) flash(NOT_MOVABLE);
  }
  const snapped = snapDelta(drag.rect, dx, dy);
  dx = snapped.dx; dy = snapped.dy;
  showGuides(snapped.guides);
  act(null, () => {
    for (const { axes } of drag.items) {
      for (const a of axes) {
        if (!a.scale) continue;
        const delta = (a.horizontal ? dx : dy) / a.scale;
        setProp(a.ref, a.name, withNumber(a, round(parseFloat(a.m[0]) + delta, snapped.guides.length ? .01 : .5)));
      }
    }
  }, drag.token);
});
sels.addEventListener('pointerup', () => { if (drag) { const moved = !!drag.items; drag = null; showGuides([]); if (moved) render(); } });
function showGuides(list) {
  guides.innerHTML = '';
  for (const g of list) {
    const line = document.createElement('div');
    line.className = 'guide ' + ('x' in g ? 'x' : 'y');
    line.style['x' in g ? 'left' : 'top'] = ('x' in g ? g.x : g.y) + 'px';
    guides.append(line);
  }
}

// ---------- Khung đánh dấu + lưới (mỗi frame) ----------
function place(box, el, text) {
  if (!el || !el.isConnected) { box.style.display = 'none'; return; }
  const r = el.getBoundingClientRect();
  Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const tag = box.querySelector('.tag');
  if (tag && tag.textContent !== text) tag.textContent = text;
}
const selBoxes = [];
function placeSelection() {
  const els = prefs.extras ? selection : [];
  while (selBoxes.length < els.length) {
    const b = document.createElement('div');
    b.className = 'box sel';
    b.innerHTML = '<span class="tag"></span>';
    sels.append(b);
    selBoxes.push(b);
  }
  selBoxes.forEach((b, i) => {
    const el = els[i], main = i === els.length - 1;
    b.classList.toggle('primary', main);
    place(b, el, el && main ? label(el) : '');
  });
}
let gridKey = '';
function drawGrid() {
  const show = prefs.grid && prefs.extras, dpr = devicePixelRatio || 1;
  const { f, step, cols, rows } = layoutGrid();
  const key = JSON.stringify([show, innerWidth, innerHeight, f.left, f.u, prefs.square, prefs.cols, prefs.rows, dpr]);
  if (key === gridKey) return;
  gridKey = key;
  gridCanvas.style.display = show ? 'block' : 'none';
  if (!show) return;
  gridCanvas.width = innerWidth * dpr; gridCanvas.height = innerHeight * dpr;
  const ctx = gridCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  // cột đỏ nhạt, hàng xanh nhạt như layout grid của Figma; mép đậm hơn để thấy rõ chỗ hút
  for (const [a, b] of cols) {
    ctx.fillStyle = 'rgba(255,72,72,.1)'; ctx.fillRect(a, 0, b - a, innerHeight);
    ctx.fillStyle = 'rgba(255,72,72,.35)'; ctx.fillRect(Math.round(a), 0, 1, innerHeight); ctx.fillRect(Math.round(b) - 1, 0, 1, innerHeight);
  }
  for (const [a, b] of rows) {
    ctx.fillStyle = 'rgba(47,140,255,.09)'; ctx.fillRect(f.left, a, f.width, b - a);
    ctx.fillStyle = 'rgba(47,140,255,.35)'; ctx.fillRect(f.left, Math.round(a), f.width, 1); ctx.fillRect(f.left, Math.round(b) - 1, f.width, 1);
  }
  if (step >= 3) {
    let k = 0;
    for (let x = f.left; x <= f.right + .5; x += step, k++) { ctx.fillStyle = k % 4 ? 'rgba(0,170,255,.16)' : 'rgba(0,170,255,.34)'; ctx.fillRect(Math.round(x), 0, 1, innerHeight); }
    k = 0;
    for (let y = 0; y <= innerHeight; y += step, k++) { ctx.fillStyle = k % 4 ? 'rgba(0,170,255,.16)' : 'rgba(0,170,255,.34)'; ctx.fillRect(f.left, Math.round(y), f.width, 1); }
  }
  ctx.fillStyle = 'rgba(255,47,180,.6)';
  ctx.fillRect(Math.round(f.left), 0, 1, innerHeight);
  ctx.fillRect(Math.round(f.right) - 1, 0, 1, innerHeight);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(255,47,180,.5)';
  ctx.beginPath();
  ctx.moveTo(Math.round(f.left + f.width / 2) + .5, 0); ctx.lineTo(Math.round(f.left + f.width / 2) + .5, innerHeight);
  ctx.moveTo(f.left, Math.round(innerHeight / 2) + .5); ctx.lineTo(f.right, Math.round(innerHeight / 2) + .5);
  ctx.stroke();
}
(function loop() {
  requestAnimationFrame(loop);
  if (!prefs.shown) return;
  placeSelection();
  const hovering = chipHover || hoverTarget;
  place(hoverBox, prefs.extras && !selection.includes(hovering) ? hovering : null);
  drawGrid();
})();

// ---------- Phím tắt ----------
const typing = event => { const t = event.composedPath()[0]; return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
window.addEventListener('keydown', event => {
  const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  const handled = () => { event.preventDefault(); event.stopImmediatePropagation(); };
  if (!prefs.shown) return;
  if (ctrl && key === 's') { if (pending.size) { handled(); saveAll(); } return; }
  if (typing(event)) { if (event.key === 'Escape') event.composedPath()[0].blur(); return; }
  if (ctrl && key === 'z') { handled(); if (event.shiftKey) redo(); else undo(); return; }
  if (ctrl && key === 'y') { handled(); redo(); return; }
  if (ctrl && event.code === 'Quote') { handled(); prefs.grid = !prefs.grid; savePrefs(); syncBar(); return; }
  if (ctrl && event.shiftKey && event.code === 'Semicolon') { handled(); prefs.snap = !prefs.snap; savePrefs(); syncBar(); flash(prefs.snap ? 'Snap on' : 'Snap off'); return; }
  if (ctrl && key === 'g') { handled(); if (event.shiftKey) unlinkSelection(); else linkSelection(); return; }
  if (ctrl && key === 'h') { handled(); prefs.extras = !prefs.extras; savePrefs(); return; }
  if (ctrl && key === 'd' && selection.length) { handled(); selection = []; render(); return; }
  if (ctrl || event.altKey) return;
  if (key === 'v') { handled(); picking = !picking; syncBar(); return; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (arrows && selection.length) { handled(); const m = event.shiftKey ? 10 : 1; nudge(arrows[0] * m, arrows[1] * m); return; }
  if (event.key === 'Escape') {
    if (showHelp || showGridSettings) { showHelp = showGridSettings = false; render(); } else if (picking) { picking = false; syncBar(); } else if (selection.length) { selection = []; render(); }
  }
}, true);
window.addEventListener('beforeunload', event => { if (pending.size) { event.preventDefault(); event.returnValue = ''; } });

// Bật / tắt cả studio từ nút "Studio" ở thanh nút dev (menu/dev-tools.js): hai bên chỉ nói chuyện qua sự kiện của window.
// Tắt thì ẩn hết (bảng, icon, khung, lưới) và không bắt click / phím; sửa chưa lưu vẫn giữ. Chỉ nối máy chủ khi bật lần đầu.
let connected = false;
function setShown(shown) {
  prefs.shown = shown;
  savePrefs();
  host.style.display = shown ? '' : 'none';
  if (!shown) { picking = false; hoverTarget = null; hideTip(); }
  if (shown && !connected) { connected = true; connect(); }
  render();
  dispatchEvent(new CustomEvent('ui-studio:state', { detail: { shown } }));
}
addEventListener('ui-studio:toggle', () => setShown(!prefs.shown));

buildBars();
setShown(prefs.shown);
