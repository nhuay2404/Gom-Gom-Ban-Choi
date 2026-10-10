// Máy chủ cho Level Editor (tools/level-editor/). Phục vụ cả thư mục dự án để trang editor nạp được
// game/gameplay/*.mjs và tools/bot.mjs (bot chạy trong Web Worker ngay trên trình duyệt).
// Chạy: npm run editor [cổng]  -> mở http://127.0.0.1:4500/tools/level-editor/
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleSaveLevel } from './level-save.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const START_PORT = Number(process.argv[2] ?? process.env.PORT ?? 4500);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const full = resolve(join(ROOT, clean));
  return full === ROOT || full.startsWith(ROOT + sep) ? full : null;
}

const server = createServer(async (req, res) => {
  if (handleSaveLevel(req, res)) return;
  if (req.url === '/') { res.writeHead(302, { location: '/tools/level-editor/' }).end(); return; }
  let file = safePath(req.url);
  if (!file) { res.writeHead(403).end(); return; }
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
  if (!info?.isFile()) { res.writeHead(404).end('Not found: ' + req.url); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  createReadStream(file).pipe(res);
});

function listen(port, tries = 0) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && tries < 20) { listen(port + 1, tries + 1); return; }
    console.error('Không mở được máy chủ:', error.message); process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => console.log(`\n  Level Editor: http://127.0.0.1:${server.address().port}/tools/level-editor/\n`));
}
listen(START_PORT);
