// UI Studio (máy chủ): cho UI artist chỉnh giao diện 2D và thấy ngay trong game, không qua Figma / chat.
// Bên trình duyệt: game/app/ui-studio.js (mở game với ?studio). server.mjs gọi handleStudio() cho mọi request.
//   GET  /__studio/events               SSE: báo file trong game/ đổi (CSS / ảnh: thay tại chỗ, .js/.mjs/.html: tải lại trang)
//   POST /__studio/css                  {file, selector, index, props: {tên: giá trị | ''}} -> sửa đúng khối CSS đó trong file
//   POST /__studio/upload?path=ui/...   thân request = ảnh -> ghi đè / thêm ảnh trong game/ui/
// Mọi lệnh GHI chỉ nhận từ chính máy này (loopback); điện thoại trong mạng LAN (npm run studio) chỉ xem + nhận cập nhật.
// File CSS xin kèm ?studio=... thì mọi url(ảnh) bên trong được gắn ?v=<giờ sửa ảnh>, để thay ảnh xong trình duyệt nạp ảnh mới.
import { watch, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchCss } from './ui-studio-css.mjs';

const GAME = resolve(fileURLToPath(new URL('../game', import.meta.url)));
const UI = join(GAME, 'ui');
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const clients = new Set();
let watching = false;

function startWatch() {
  if (watching) return;
  watching = true;
  const timers = new Map();
  watch(GAME, { recursive: true }, (_event, name) => {
    if (!name) return;
    const file = name.split(sep).join('/');
    if (/(^|\/)\.|~$|\.tmp$/.test(file)) return;
    clearTimeout(timers.get(file));
    // gom các lần ghi liên tiếp của trình soạn thảo / Photoshop thành một thông báo
    timers.set(file, setTimeout(() => {
      timers.delete(file);
      const data = `data: ${JSON.stringify({ file, t: Date.now() })}\n\n`;
      for (const res of clients) res.write(data);
    }, 120));
  });
}

const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const inside = (base, full) => full.startsWith(base + sep);

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((ok, fail) => {
    const parts = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { fail(new Error('File quá lớn')); req.destroy(); } else parts.push(chunk);
    });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', fail);
  });
}

// ---------- Request ----------
function json(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));
}

/** Trả true nếu request thuộc UI Studio (đã trả lời xong). */
export function handleStudio(req, res, url = new URL(req.url, 'http://x')) {
  if (!url.pathname.startsWith('/__studio/')) return false;
  const route = url.pathname.slice('/__studio/'.length);
  if (route === 'events') {
    startWatch();
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ hello: true, canWrite: isLocal(req) })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clients.delete(res); clearInterval(ping); });
    return true;
  }
  if (req.method !== 'POST') { json(res, 405, { error: 'POST' }); return true; }
  if (!isLocal(req)) { json(res, 403, { error: 'Chỉ lưu được từ máy đang chạy server' }); return true; }
  (async () => {
    try {
      if (route === 'css') {
        const { file, selector, index = 0, props } = JSON.parse((await readBody(req)).toString('utf8'));
        const full = resolve(GAME, String(file));
        if (!inside(UI, full) || extname(full) !== '.css' || !existsSync(full)) throw new Error('Chỉ sửa được file .css trong game/ui/');
        if (!selector || !props || typeof props !== 'object') throw new Error('Thiếu selector / props');
        const before = readFileSync(full, 'utf8');
        const after = patchCss(before, String(selector), Number(index) || 0, props);
        if (after !== before) writeFileSync(full, after);
        json(res, 200, { ok: true, changed: after !== before });
      } else if (route === 'upload') {
        const target = resolve(GAME, url.searchParams.get('path') || '');
        if (!inside(UI, target) || !IMAGE_EXT.has(extname(target).toLowerCase())) throw new Error('Chỉ ghi được ảnh (.png .jpg .webp .gif .svg) trong game/ui/');
        if (!existsSync(dirname(target))) throw new Error('Thư mục không tồn tại: ' + relative(GAME, dirname(target)));
        const body = await readBody(req);
        if (!body.length) throw new Error('File rỗng');
        writeFileSync(target, body);
        json(res, 200, { ok: true, path: relative(GAME, target).split(sep).join('/') });
      } else json(res, 404, { error: 'Không có lệnh ' + route });
    } catch (error) {
      json(res, 400, { error: error.message });
    }
  })();
  return true;
}

/** CSS xin kèm ?studio: gắn ?v=<giờ sửa> vào url(ảnh) tương đối để thay ảnh là thấy ngay. Trả null nếu không áp dụng. */
export function studioCss(file, url) {
  if (!url.searchParams.has('studio') || extname(file) !== '.css') return null;
  const dir = dirname(file);
  return readFileSync(file, 'utf8').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q, ref) => {
    if (/^(data:|https?:|\/\/|#)/.test(ref)) return whole;
    const clean = ref.split(/[?#]/)[0];
    let v = 0;
    try { v = Math.round(statSync(resolve(dir, clean)).mtimeMs); } catch { return whole; }
    return `url(${q}${clean}?v=${v}${q})`;
  });
}
