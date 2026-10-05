// Gộp game thành MỘT file HTML (JS + Three.js + CSS + ảnh nhúng sẵn) để gửi qua điện thoại / máy khác chơi thử.
// Chơi được không cần mạng; chỉ font (Google Fonts) cần mạng, offline thì dùng font dự phòng của máy.
// Chạy: npm run build:html -> dist/gom-gom-rotate.html (có nút dev trong Settings; bản cho người chơi: npm run build:html -- --no-dev)
//
// Three.js: dự án không cài thư viện (bản web nạp từ CDN qua importmap). Khi build, chép tạm game/ ra thư mục tạm của hệ
// thống, cài three@<THREE_VERSION> ở đó rồi esbuild gộp luôn vào bundle — thư mục dự án không có node_modules.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const DEV_BUILD = !process.argv.includes('--no-dev');
const THREE_VERSION = '0.170.0'; // khớp importmap trong game/index.html
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const game = join(root, 'game');
const read = file => readFileSync(join(game, file), 'utf8');
const MIME = { png: 'image/png', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const dataUri = file => {
  const type = MIME[file.split('.').pop().toLowerCase()];
  if (!type) throw new Error(`Chưa hỗ trợ nhúng ảnh: ${file}`);
  return `data:${type};base64,${readFileSync(join(game, file)).toString('base64')}`;
};

// JS: esbuild gộp mọi module (kể cả import động deco-room / map-world) + Three.js.
const work = join(tmpdir(), 'gom-gom-build');
if (!existsSync(join(work, 'node_modules', 'three', 'package.json'))
  || JSON.parse(readFileSync(join(work, 'node_modules', 'three', 'package.json'), 'utf8')).version !== THREE_VERSION) {
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'package.json'), '{"private":true}');
  execSync(`npm install --no-audit --no-fund --loglevel=error three@${THREE_VERSION}`, { cwd: work, stdio: 'inherit' });
}
rmSync(join(work, 'game'), { recursive: true, force: true });
cpSync(game, join(work, 'game'), { recursive: true, filter: src => !/\.test\.mjs$/.test(src) });
const js = execSync(
  'npx -y esbuild@0.24.0 game/gom-gom.js --bundle --format=esm --minify --log-level=warning',
  { cwd: work, encoding: 'utf8', maxBuffer: 128 << 20 },
).replace(/<\/script/gi, '<\\/script');

// CSS: nối theo đúng thứ tự trong index.html. Mỗi ảnh url('./...') (tính từ thư mục của file CSS) nhúng MỘT lần
// vào biến CSS (cùng ảnh dùng nhiều chỗ thì không bị nhân đôi dung lượng).
const images = new Map();
const css = [...read('index.html').matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)]
  .map(([, sheet]) => read(sheet).replace(/url\('\.\/([^']+)'\)/g, (_, file) => {
    const path = posix.join(posix.dirname(sheet), file);
    if (!images.has(path)) images.set(path, `--img-${images.size}`);
    return `var(${images.get(path)})`;
  }))
  .join('\n');
const imageVars = `:root{${[...images].map(([file, name]) => `${name}:url('${dataUri(file)}')`).join(';')}}`;

// Ảnh trong HTML (<img src="./...">): nhúng thẳng; ảnh trùng nhau nhúng lại (ít, nhỏ).
const html = read('index.html')
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/\s*<link rel="stylesheet" href="\.\/[^"]+">/g, '')
  .replace('href="./favicon.svg"', `href="${dataUri('favicon.svg')}"`)
  .replace(/src="\.\/(?!gom-gom\.js)([^"]+)"/g, (_, file) => `src="${dataUri(file)}"`)
  .replace(/<script type="module" src="\.\/gom-gom\.js"><\/script>/, () => `<style>\n${imageVars}\n${css}\n</style>\n  ${DEV_BUILD ? '<script>window.GOMGOM_DEV = true;</script>\n  ' : ''}<script type="module">\n${js}\n</script>`);
if (/(?:src|href)="\.\//.test(html)) throw new Error('Còn đường dẫn ./ chưa nhúng trong HTML');

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'gom-gom-rotate.html');
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1048576).toFixed(1)} MB)`);
