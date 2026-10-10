// Level Editor lưu thẳng vào game/gameplay/levels.mjs (máy chủ dev gọi: server.mjs và tools/level-editor.mjs, POST /api/save-level).
// Thay khối `  { ... },` thứ `index` trong mảng LEVELS bằng `code` do editor sinh, giữ lại:
//   - các dòng chú thích `    // ...` của khối cũ (đặt lên đầu khối mới)
//   - đoạn `tutorial: [...]` của khối cũ nếu editor báo tutorial không đổi (giữ tham chiếu SHAPES.* thay vì mảng số).
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../game/gameplay/levels.mjs', import.meta.url);

function blocks(lines) {
  const start = lines.findIndex(line => line.startsWith('export const LEVELS = ['));
  const out = [];
  for (let i = start + 1, open = -1; i < lines.length && !lines[i].startsWith('];'); i++) {
    if (lines[i] === '  {') open = i;
    else if (/^  \},?$/.test(lines[i]) && open >= 0) { out.push([open, i]); open = -1; }
  }
  return out;
}

function tutorialLines(block) {
  const from = block.findIndex(line => line.startsWith('    tutorial:'));
  if (from < 0) return null;
  let depth = 0;
  for (let i = from; i < block.length; i++) {
    for (const ch of block[i].replace(/\/\/.*$/, '')) depth += ch === '[' ? 1 : ch === ']' ? -1 : 0;
    if (depth <= 0) return block.slice(from, i + 1);
  }
  return null;
}

export function saveLevel({ index, code, keepTutorial }) {
  const text = readFileSync(FILE, 'utf8'), eol = text.includes('\r\n') ? '\r\n' : '\n', lines = text.split(/\r?\n/);
  const list = blocks(lines);
  if (!Number.isInteger(index) || !list[index]) throw new Error(`Không tìm thấy màn ${index + 1} trong levels.mjs`);
  const [from, to] = list[index], old = lines.slice(from, to + 1);
  let body = code.replace(/\r/g, '').split('\n');
  if (body[0] !== '  {' || !/^  \},?$/.test(body.at(-1))) throw new Error('Khối màn không đúng định dạng');
  body = body.filter(line => !line.startsWith('    tutorial:'));
  const tutorial = keepTutorial ? tutorialLines(old) : null;
  const newTutorial = !keepTutorial && code.split('\n').find(line => line.startsWith('    tutorial:'));
  const comments = old.filter(line => line.startsWith('    //'));
  const result = ['  {', ...comments, ...body.slice(1, -1), ...(tutorial ?? (newTutorial ? [newTutorial] : [])), lines[to]];
  lines.splice(from, to - from + 1, ...result);
  writeFileSync(FILE, lines.join(eol));
}

// Gắn vào máy chủ http: trả về true nếu đã xử lý request.
export function handleSaveLevel(req, res) {
  if (req.method !== 'POST' || req.url !== '/api/save-level') return false;
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    try {
      saveLevel(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
  return true;
}
