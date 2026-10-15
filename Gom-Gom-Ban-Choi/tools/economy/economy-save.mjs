// Level Editor (tab Economy) lưu thẳng số mặc định vào game/gameplay/economy.mjs (máy chủ dev gọi: server.mjs và
// tools/levels/level-editor.mjs, POST /api/save-economy { values: { TÊN: giá trị } }).
// Chỉ thay phần giá trị trong `remote('TÊN', <giá trị>)` của các TÊN cho phép; chú thích và phần còn lại của file giữ nguyên.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../../game/gameplay/economy.mjs', import.meta.url);
import { EDITABLE } from './economy-sim.mjs';
export { EDITABLE };

// Giá trị -> mã JS gọn: số / object một tầng một dòng; object lồng (AREA_UNLOCK) mỗi khoá một dòng.
const isPlain = value => value && typeof value === 'object' && !Array.isArray(value);
const key = name => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`);
function toCode(value, nested = false) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Số không hợp lệ');
    return String(value);
  }
  if (!isPlain(value)) throw new Error('Chỉ nhận số hoặc object số');
  const parts = Object.entries(value).map(([k, v]) => `${key(k)}: ${toCode(v, true)}`);
  if (nested || !Object.values(value).some(isPlain)) return `{ ${parts.join(', ')} }`;
  return `{\n${parts.map(part => `  ${part},`).join('\n')}\n}`;
}

// Vị trí giá trị mặc định của remote('TÊN', ...): từ sau dấu phẩy tới trước ')' đóng (đếm ngoặc).
function valueRange(text, name) {
  const head = `remote('${name}', `, at = text.indexOf(head);
  if (at < 0) throw new Error(`Không thấy remote('${name}') trong economy.mjs`);
  const from = at + head.length;
  for (let i = from, depth = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) {
      if (depth === 0) return [from, i];
      depth--;
    } else if (ch === ',' && depth === 0) return [from, i]; // còn tham số description phía sau
  }
  throw new Error(`remote('${name}') không đóng ngoặc`);
}

// DECO (bảng giá từng món, mỗi dòng có chú thích tên món): chỉ thay con số price của từng dòng, giữ nguyên chú thích / lock / thứ tự.
function saveDecoPrices(text, rows) {
  const [from, to] = valueRange(text, 'DECO');
  let body = text.slice(from, to);
  for (const [id, row] of Object.entries(rows)) {
    const price = row?.price;
    if (!Number.isInteger(price) || price < 0) throw new Error(`Giá của ${id} phải là số nguyên ≥ 0`);
    const name = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const line = new RegExp(`^(\\s*'?${name}'?:\\s*\\{\\s*price:\\s*)\\d+`, 'm');
    if (!line.test(body)) throw new Error(`Không thấy món ${id} trong DECO`);
    body = body.replace(line, `$1${price}`);
  }
  return text.slice(0, from) + body + text.slice(to);
}

// file: mặc định economy.mjs (test truyền bản sao để không đụng file thật khi các test khác đang chạy song song).
export function saveEconomy({ values }, file = FILE) {
  let text = readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  for (const [name, value] of Object.entries(values ?? {})) {
    if (!EDITABLE.includes(name)) throw new Error(`Không cho sửa ${name} từ editor`);
    if (name === 'DECO') { text = saveDecoPrices(text, value); continue; }
    const [from, to] = valueRange(text, name);
    text = text.slice(0, from) + toCode(value).replace(/\n/g, eol) + text.slice(to);
  }
  writeFileSync(file, text);
}

// Gắn vào máy chủ http: trả về true nếu đã xử lý request.
export function handleSaveEconomy(req, res) {
  if (req.method !== 'POST' || req.url !== '/api/save-economy') return false;
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    try {
      saveEconomy(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
  return true;
}
