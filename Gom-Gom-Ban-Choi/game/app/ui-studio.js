// UI Studio (trình duyệt): mở game với ?studio. Máy chủ: tools/ui-studio.mjs.
//  - File trong game/ đổi (artist sửa CSS / xuất ảnh đè lên game/ui/...): CSS và ảnh thay tại chỗ, không mất màn đang xem;
//    .js / .mjs / .html thì tải lại trang.
//  - Alt + click (hoặc nút "Chọn") một phần tử UI: xem các khối CSS đang áp vào nó, sửa giá trị thấy ngay
//    (↑ / ↓ trong ô giá trị: tăng giảm số, Shift = ×10, Alt = ×0.1), kéo khung xanh để dời vị trí, thay ảnh bằng cách chọn / thả file.
//  - "Lưu" ghi thẳng vào đúng file CSS trong game/ui/ (rồi commit bằng GitHub Desktop như bình thường). "Hoàn tác" bỏ mọi sửa chưa lưu.
import { cssRules, declarations, norm } from '/tools/ui-studio-css.mjs';

const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
const COMMON = ['color', 'background', 'background-color', 'background-image', 'background-size', 'background-position', 'font-size', 'font-weight',
  'font-family', 'line-height', 'letter-spacing', 'text-align', 'text-shadow', 'width', 'height', 'left', 'top', 'right', 'bottom', 'margin', 'padding',
  'border', 'border-radius', 'box-shadow', 'opacity', 'transform', 'gap', 'z-index', 'filter', '-webkit-text-stroke'];

const pathOf = href => { try { return decodeURIComponent(new URL(href, location.href).pathname).replace(/^\/+/, ''); } catch { return ''; } };
const isColor = value => /^(#|rgb|hsl|oklch|lab\()/i.test(value.trim()) && CSS.supports('color', value.trim());

// ---------- Trạng thái ----------
// màn hẹp (điện thoại xem qua LAN): bảng thu gọn sẵn để không che game
let canWrite = false, online = false, picking = false, selected = null, collapsed = innerWidth < 700, message = '';
const pending = new Map(); // key -> { file, selector, index, props: {tên: giá trị}, original: {tên: [giá trị, !important]} }

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
      if (hit && ruleActive(rule)) out.push(describe(sheet, rule));
    }
  }
  return out.reverse(); // khối sau cùng (thắng) lên đầu
}
const keyOf = ref => `${ref.file}|${ref.selector}|${ref.index}`;

function setProp(ref, name, value) {
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
  renderBar();
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
function undoAll() {
  for (const edit of pending.values()) {
    const rule = findRule(edit);
    if (!rule) continue;
    for (const [name, [value, priority]] of Object.entries(edit.original)) {
      if (value) rule.style.setProperty(name, value, priority); else rule.style.removeProperty(name);
    }
  }
  pending.clear();
  render();
}
async function saveAll() {
  if (!canWrite) { flash('Máy này chỉ xem được, hãy lưu trên máy đang chạy server'); return; }
  const edits = [...pending.values()];
  let saved = 0;
  for (const edit of edits) {
    try {
      const res = await fetch('/__studio/css', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edit) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      pending.delete(keyOf(edit));
      saved++;
    } catch (error) { flash('Lỗi lưu ' + edit.file + ': ' + error.message); render(); return; }
  }
  flash(`Đã lưu ${saved} khối CSS vào file ✓`);
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
const uiLinks = () => [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link => pathOf(link.href).startsWith('ui/'));
async function fileChanged(file) {
  sources.delete(file);
  if (file === 'app/ui-studio.js' || /\.(m?js|html)$/.test(file)) {
    if (/\.test\.mjs$/.test(file)) return;
    if (pending.size && !confirm('Code game vừa đổi, cần tải lại trang. Bỏ các sửa CSS chưa lưu?')) return;
    pending.clear();
    location.reload();
    return;
  }
  if (file.endsWith('.css')) {
    const link = uiLinks().find(l => pathOf(l.href) === file);
    if (link) { await swapSheet(link); flash('Cập nhật ' + file); }
  } else if (IMAGE_RE.test(file)) {
    // ảnh dùng trong CSS: nạp lại mọi file CSS (máy chủ gắn ?v=<giờ sửa ảnh>); ảnh <img>: đổi src
    await Promise.all(uiLinks().map(swapSheet));
    for (const img of document.querySelectorAll('img')) {
      if (pathOf(img.src) === file) { const u = new URL(img.src); u.searchParams.set('v', Date.now()); img.src = u.href; }
    }
    flash('Cập nhật ảnh ' + file);
  } else return;
  if (selected) setTimeout(render, 60);
}
function connect() {
  const events = new EventSource('/__studio/events');
  events.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.hello) { online = true; canWrite = data.canWrite; render(); return; }
    fileChanged(data.file);
  };
  events.onerror = () => { if (online) { online = false; renderBar(); } };
}

// ---------- Giao diện bảng ----------
const host = document.createElement('div');
host.id = 'ui-studio';
host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646';
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>
  :host { all: initial; }
  * { box-sizing: border-box; font: 12px/1.35 ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
  .box { position: fixed; border: 2px solid #2f8cff; background: rgba(47,140,255,.08); pointer-events: none; border-radius: 3px; display: none; }
  .box.sel { cursor: move; pointer-events: auto; }
  .box.hover { border-style: dashed; border-color: #ff7a2f; background: rgba(255,122,47,.06); }
  .tag { position: absolute; left: -2px; top: -20px; background: #2f8cff; color: #fff; padding: 1px 6px; border-radius: 3px 3px 0 0; white-space: nowrap; font-size: 11px; }
  .panel { position: fixed; right: 10px; top: 10px; width: min(340px, calc(100vw - 20px)); max-height: calc(100vh - 20px); display: flex; flex-direction: column;
    background: #1d1f24; color: #e8e8ea; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.45); pointer-events: auto; overflow: hidden; }
  .panel.left { right: auto; left: 10px; }
  .bar { display: flex; gap: 6px; align-items: center; padding: 8px; background: #26292f; flex-wrap: wrap; }
  .title { font-weight: 700; margin-right: auto; display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #e04848; }
  .dot.on { background: #3fcf6a; }
  button { background: #3a3e47; color: #fff; border: 0; border-radius: 6px; padding: 5px 9px; cursor: pointer; }
  button:hover { background: #4a4f5a; }
  button.on { background: #2f8cff; }
  button.save { background: #2f9e55; } button.save:disabled { background: #3a3e47; color: #888; cursor: default; }
  .body { overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .hint { color: #9aa0aa; }
  .msg { color: #ffd479; padding: 0 8px 6px; background: #26292f; }
  .el { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .el code { color: #8fc3ff; word-break: break-all; }
  .card { background: #26292f; border-radius: 8px; padding: 6px 8px; }
  .card.dirty { outline: 1px solid #ffb347; }
  .head { color: #9aa0aa; margin-bottom: 4px; display: flex; gap: 6px; }
  .head b { color: #ffd479; font-weight: 600; word-break: break-all; }
  .row { display: grid; grid-template-columns: 112px 1fr auto; gap: 4px; align-items: center; margin: 2px 0; }
  .row label { color: #c9a8ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.changed label { color: #ffb347; }
  input { width: 100%; background: #15171b; color: #fff; border: 1px solid #3a3e47; border-radius: 4px; padding: 3px 5px; font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; }
  input:focus { outline: none; border-color: #2f8cff; }
  input[type=color] { width: 26px; height: 22px; padding: 0; border: 0; background: none; cursor: pointer; }
  .x { background: none; color: #777; padding: 0 4px; } .x:hover { color: #ff6b6b; background: none; }
  .add { display: grid; grid-template-columns: 112px 1fr auto; gap: 4px; margin-top: 4px; }
  .img { display: flex; gap: 8px; align-items: center; background: #26292f; border-radius: 8px; padding: 6px; border: 1px dashed transparent; }
  .img.drag { border-color: #2f8cff; }
  .img img { width: 56px; height: 56px; object-fit: contain; background: repeating-conic-gradient(#3a3e47 0 25%, #2c2f36 0 50%) 0 0/12px 12px; border-radius: 4px; }
  .img .p { word-break: break-all; color: #c8ccd4; flex: 1; }
</style>
<div class="box hover"></div><div class="box sel"><span class="tag"></span></div>
<div class="panel"><div class="bar"></div><div class="msg" hidden></div><div class="body"></div></div>
<datalist id="props">${COMMON.map(p => `<option value="${p}">`).join('')}</datalist>`;
const [hoverBox, selBox] = root.querySelectorAll('.box');
const panel = root.querySelector('.panel'), bar = root.querySelector('.bar'), body = root.querySelector('.body'), msg = root.querySelector('.msg');
document.body.append(host);

let flashTimer = 0;
function flash(text) {
  message = text; msg.textContent = text; msg.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { msg.hidden = true; }, 3500);
}

function renderBar() {
  const n = [...pending.values()].reduce((sum, e) => sum + Object.keys(e.props).length, 0);
  bar.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = `<span class="dot ${online ? 'on' : ''}" title="${online ? 'Đang kết nối máy chủ' : 'Mất kết nối máy chủ'}"></span>UI Studio${canWrite ? '' : ' <span class="hint">(chỉ xem)</span>'}`;
  bar.append(title);
  const button = (label, onClick, cls = '', tip = '') => {
    const b = document.createElement('button');
    b.textContent = label; b.className = cls; b.title = tip; b.onclick = onClick; bar.append(b); return b;
  };
  button('🎯 Chọn', () => { picking = !picking; renderBar(); }, picking ? 'on' : '', 'Bấm vào phần tử UI để chỉnh (hoặc Alt + click bất cứ lúc nào)');
  const save = button(n ? `Lưu (${n})` : 'Lưu', saveAll, 'save', 'Ghi các thay đổi vào file CSS');
  save.disabled = !n;
  button('↶', () => { if (n && confirm('Bỏ mọi sửa chưa lưu?')) undoAll(); }, '', 'Hoàn tác mọi sửa chưa lưu');
  button('⇆', () => panel.classList.toggle('left'), '', 'Chuyển bảng sang bên kia màn hình');
  button(collapsed ? '▾' : '▴', () => { collapsed = !collapsed; render(); }, '', 'Thu gọn / mở bảng');
}

function propRow(ref, name, value, changed) {
  const row = document.createElement('div');
  row.className = 'row' + (changed ? ' changed' : '');
  row.innerHTML = '<label></label><input class="v"><span style="display:flex;gap:2px"></span>';
  row.querySelector('label').textContent = row.querySelector('label').title = name;
  const input = row.querySelector('.v');
  input.value = value;
  const tools = row.querySelector('span');
  const apply = () => { setProp(ref, name, input.value); markRow(); };
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
    const next = String(Math.round((parseFloat(hit[0]) + step) * 100) / 100);
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
    picker.oninput = () => { input.value = withAlpha(picker.value, input.value); apply(); };
    tools.append(picker);
  }
  const del = document.createElement('button');
  del.className = 'x'; del.textContent = '✕'; del.title = 'Xoá thuộc tính này';
  del.onclick = () => { setProp(ref, name, ''); row.remove(); };
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

function imagesOf(el) {
  const out = new Set();
  const add = url => { const p = pathOf(url); if (p.startsWith('ui/') && IMAGE_RE.test(p)) out.add(p); };
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
  card.innerHTML = `<img alt=""><div class="p"></div><button>Thay ảnh…</button><input type="file" accept="image/*" hidden>`;
  card.querySelector('img').src = '/' + path + '?t=' + Date.now();
  const info = card.querySelector('.p');
  info.textContent = path;
  card.querySelector('img').onload = function () { info.textContent = `${path}\n${this.naturalWidth}×${this.naturalHeight}`; info.style.whiteSpace = 'pre-line'; };
  const file = card.querySelector('input');
  card.querySelector('button').onclick = () => file.click();
  file.onchange = () => file.files[0] && upload(path, file.files[0]);
  card.addEventListener('dragover', event => { event.preventDefault(); card.classList.add('drag'); });
  card.addEventListener('dragleave', () => card.classList.remove('drag'));
  card.addEventListener('drop', event => { event.preventDefault(); card.classList.remove('drag'); const f = event.dataTransfer.files[0]; if (f) upload(path, f); });
  return card;
}
async function upload(path, file) {
  if (!canWrite) { flash('Máy này chỉ xem được'); return; }
  if (!IMAGE_RE.test(file.name)) { flash('Chỉ nhận file ảnh'); return; }
  const want = path.split('.').pop().toLowerCase(), got = file.name.split('.').pop().toLowerCase();
  if (want !== got && !confirm(`Ảnh gốc là .${want} nhưng file chọn là .${got}. Vẫn ghi đè (giữ tên ${path})?`)) return;
  const res = await fetch('/__studio/upload?path=' + encodeURIComponent(path), { method: 'POST', body: file });
  const data = await res.json().catch(() => ({}));
  flash(res.ok ? `Đã thay ${path} ✓` : 'Lỗi: ' + data.error);
}

let renderId = 0;
async function render() {
  const id = ++renderId;
  renderBar();
  body.innerHTML = '';
  body.hidden = collapsed;
  if (collapsed) return;
  if (!selected || !selected.isConnected) {
    selected = null;
    body.innerHTML = `<div class="hint">Bấm <b>🎯 Chọn</b> rồi bấm vào nút / bảng / chữ trong game (hoặc giữ <b>Alt</b> + click).<br><br>
      Artist cũng có thể sửa thẳng file trong <code>game/ui/</code> (CSS, ảnh PNG) bằng bất kỳ phần mềm nào — lưu file là game tự cập nhật.<br><br>
      Trong ô giá trị: ↑ / ↓ tăng giảm số (Shift ×10, Alt ×0.1). Kéo khung xanh để dời vị trí.</div>`;
    return;
  }
  const el = selected;
  const head = document.createElement('div');
  head.className = 'el';
  const rect = el.getBoundingClientRect();
  head.innerHTML = `<code></code><span class="hint">${Math.round(rect.width)}×${Math.round(rect.height)}</span>`;
  head.querySelector('code').textContent = label(el);
  const up = document.createElement('button');
  up.textContent = '⬆ Cha'; up.title = 'Chọn phần tử chứa nó';
  up.onclick = () => { if (el.parentElement && el.parentElement !== document.body) select(el.parentElement); };
  head.append(up);
  body.append(head);
  for (const path of imagesOf(el)) body.append(imageCard(path));
  const refs = matchedRules(el);
  const lists = await Promise.all(refs.map(sourceDecls));
  if (id !== renderId) return;
  if (!refs.length) body.insertAdjacentHTML('beforeend', '<div class="hint">Không có khối CSS nào trong game/ui/ áp vào phần tử này. Thử ⬆ Cha.</div>');
  refs.forEach((ref, i) => {
    const card = document.createElement('div');
    const edit = pending.get(keyOf(ref));
    card.className = 'card' + (edit ? ' dirty' : '');
    card.innerHTML = '<div class="head"><span></span><b></b></div>';
    card.querySelector('span').textContent = ref.file.replace(/^ui\//, '');
    card.querySelector('b').textContent = ref.selector;
    // đọc theo cssText để giữ thuộc tính viết gọn (background, border-radius...) thay vì tách thành hàng chục thuộc tính con
    const list = (lists[i] || decls(ref.rule.style.cssText)).map(([name, value]) => [name, edit && name in edit.props ? edit.props[name] : value]);
    if (edit) for (const name of Object.keys(edit.props)) if (!list.some(([n]) => n === name)) list.push([name, edit.props[name]]);
    for (const [name, value] of list) if (value !== '') card.append(propRow(ref, name, value, !!(edit && name in edit.props)));
    const add = document.createElement('div');
    add.className = 'add';
    add.innerHTML = '<input placeholder="+ thuộc tính" list="props"><input placeholder="giá trị"><button>+</button>';
    const [n, v] = add.querySelectorAll('input');
    const commit = () => {
      const name = n.value.trim().toLowerCase();
      if (!name || !v.value.trim()) return;
      setProp(ref, name, v.value.trim());
      add.before(propRow(ref, name, v.value.trim(), true));
      card.classList.add('dirty');
      n.value = v.value = ''; n.focus();
    };
    add.querySelector('button').onclick = commit;
    v.addEventListener('keydown', event => { if (event.key === 'Enter') commit(); });
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
const label = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('');

function select(el) {
  selected = el; picking = false; collapsed = false;
  render();
}

// ---------- Chọn phần tử ----------
const ours = event => event.composedPath().includes(host);
const shouldPick = event => (picking || event.altKey) && !ours(event);
for (const type of ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'click']) {
  window.addEventListener(type, event => {
    if (!shouldPick(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (type === 'click') select(event.target);
  }, { capture: true, passive: false });
}
window.addEventListener('pointermove', event => {
  hoverTarget = (picking || event.altKey) && !ours(event) ? event.target : null;
}, true);
let hoverTarget = null;

// ---------- Kéo để dời vị trí ----------
// Khối CSS thắng có left/top (hoặc right/bottom) dạng số: kéo khung = đổi con số đầu tiên. Tỉ lệ px ↔ đơn vị đo thật
// (đổi thử +10 rồi xem phần tử dịch bao nhiêu px), nên chạy được với calc(N * var(--u)), px, %...
function axisOf(el, names) {
  for (const ref of matchedRules(el)) {
    for (const [name, sign] of names) {
      const value = ref.rule.style.getPropertyValue(name).trim();
      const m = value && value.match(/-?\d*\.?\d+/);
      if (m) return { ref, name, sign, value, m };
    }
  }
  return null;
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
let drag = null;
selBox.addEventListener('pointerdown', event => {
  if (!selected) return;
  event.preventDefault(); event.stopPropagation();
  const x = axisOf(selected, [['left', 1], ['right', -1]]), y = axisOf(selected, [['top', 1], ['bottom', -1]]);
  if (!x && !y) { flash('Phần tử này không có left / top để kéo — sửa margin / transform trong bảng'); return; }
  drag = { x0: event.clientX, y0: event.clientY, axes: [] };
  if (x) drag.axes.push({ ...x, scale: measure(selected, x, 'left'), d: 'clientX', o: 'x0' });
  if (y) drag.axes.push({ ...y, scale: measure(selected, y, 'top'), d: 'clientY', o: 'y0' });
  selBox.setPointerCapture(event.pointerId);
});
selBox.addEventListener('pointermove', event => {
  if (!drag) return;
  for (const a of drag.axes) {
    if (!a.scale) continue;
    const delta = Math.round((event[a.d] - drag[a.o]) / a.scale * 2) / 2;
    const n = Math.round((parseFloat(a.m[0]) + delta) * 100) / 100;
    a.next = a.value.slice(0, a.m.index) + n + a.value.slice(a.m.index + a.m[0].length);
    const priority = a.ref.rule.style.getPropertyPriority(a.name);
    setProp(a.ref, a.name, a.next + (priority ? ' !important' : ''));
  }
});
selBox.addEventListener('pointerup', () => { if (drag) { drag = null; render(); } });

// ---------- Khung đánh dấu ----------
function place(box, el, text) {
  if (!el || !el.isConnected) { box.style.display = 'none'; return; }
  const r = el.getBoundingClientRect();
  Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const tag = box.querySelector('.tag');
  if (tag && tag.textContent !== text) tag.textContent = text;
}
(function loop() {
  place(selBox, collapsed ? null : selected, selected ? label(selected) : '');
  place(hoverBox, hoverTarget !== selected ? hoverTarget : null);
  requestAnimationFrame(loop);
})();

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (picking) { picking = false; renderBar(); } else if (selected) { selected = null; render(); } }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && pending.size) { event.preventDefault(); saveAll(); }
});
window.addEventListener('beforeunload', event => { if (pending.size) { event.preventDefault(); event.returnValue = ''; } });

render();
connect();
