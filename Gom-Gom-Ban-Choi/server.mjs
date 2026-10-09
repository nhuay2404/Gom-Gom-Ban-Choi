// Máy chủ tĩnh tối giản cho Gom Gom. Chỉ cần Node.js, không cài thêm thư viện nào.
// Chạy: node server.mjs [cổng]
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleSaveLevel } from './tools/level-save.mjs';
import { handleStudio, studioCss } from './tools/ui-studio.mjs';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const START_PORT = Number(process.argv.slice(2).find(arg => /^d+$/.test(arg)) ?? process.env.PORT ?? 4400);
// --lan (npm run studio): nghe cả mạng LAN để mở game trên điện thoại; lệnh ghi file của UI Studio vẫn chỉ nhận từ máy này.
const LAN = process.argv.includes('--lan');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

/** Giữ mọi đường dẫn bên trong thư mục game, không cho đi ngược ra ngoài. */
// Level Editor (tools/level-editor/, mở từ nút dev) nằm ngoài game/: /tools/... phục vụ thư mục tools, và /game/... trỏ lại
// game/ cho các import '../../game/gameplay/...' của editor và bot.
const TOOLS = resolve(fileURLToPath(new URL('./tools', import.meta.url)));
function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const [, head, rest = ''] = clean.replace(/\\/g, '/').match(/^\/?([^/]*)(\/.*)?$/) ?? [];
  const base = head === 'tools' ? TOOLS : head === 'game' ? ROOT : ROOT;
  const full = resolve(join(base, head === 'tools' || head === 'game' ? rest : clean));
  return full === base || full.startsWith(base + sep) ? full : null;
}

const server = createServer(async (req, res) => {
  try {
    // Level Editor (nút dev LEVELS) lưu màn vào game/gameplay/levels.mjs. Máy chủ chỉ nghe 127.0.0.1.
    if (handleSaveLevel(req, res)) return;
    if (handleStudio(req, res)) return;
    if (handleStudio(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('Method Not Allowed'); return; }
    let file = safePath(req.url === '/' ? '/index.html' : req.url);
    if (!file) { res.writeHead(403).end('Forbidden'); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Khong tim thay: ' + req.url); return; }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      ...(new URL(req.url, 'http://x').searchParams.has('studio') ? {} : { 'content-length': info.size }),
      'cache-control': 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    // UI Studio xin CSS kèm ?studio: gắn phiên bản vào url(ảnh) để thay ảnh là thấy ngay
    const css = studioCss(file, new URL(req.url, 'http://x'));
    if (css !== null) { res.end(css); return; }
    createReadStream(file).pipe(res);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Loi may chu: ' + error.message);
  }
});

// Bao cong da mo. Dang ky MOT lan o day, khong dat callback trong server.listen():
// moi lan retry se cong them mot listener 'listening' nua, va khi bind duoc thi TAT CA
// cung chay, in ra ca nhung cong cua nguoi khac ma minh khong he chiem duoc.
server.on('listening', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  // File khoi dong tu in thong bao tieng Viet co dau roi, nen dat GOMGOM_QUIET=1
  // de khoi in trung. Chay tay `node server.mjs` thi van thay day du.
  if (!process.env.GOMGOM_QUIET) {
    console.log('');
    console.log('  Gom Gom dang chay tai ' + url);
    console.log('  Giu cua so nay mo trong luc choi. Dong cua so hoac bam Ctrl+C de dung.');
    console.log('');
  }
  process.stdout.write('GOMGOM_URL=' + url + '\n');
});

/** Cổng đang bận thì thử cổng kế tiếp, tối đa 20 lần, để không phải sửa file. */
function listen(port, tries = 0) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && tries < 20) { listen(port + 1, tries + 1); return; }
    console.error('Khong mo duoc may chu:', error.message);
    process.exit(1);
  });
  server.listen(port, LAN ? '0.0.0.0' : '127.0.0.1');
}
listen(START_PORT);
