// Máy chủ tĩnh tối giản cho Gom Gom. Chỉ cần Node.js, không cài thêm thư viện nào.
// Chạy: node server.mjs [cổng]
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const START_PORT = Number(process.argv[2] ?? process.env.PORT ?? 4400);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

/** Giữ mọi đường dẫn bên trong thư mục game, không cho đi ngược ra ngoài. */
function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const full = resolve(join(ROOT, clean));
  return full === ROOT || full.startsWith(ROOT + sep) ? full : null;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('Method Not Allowed'); return; }
    let file = safePath(req.url === '/' ? '/index.html' : req.url);
    if (!file) { res.writeHead(403).end('Forbidden'); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Khong tim thay: ' + req.url); return; }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return; }
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
  server.listen(port, '127.0.0.1');
}
listen(START_PORT);
