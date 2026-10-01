// Gộp game thành MỘT file HTML (JS + CSS + ảnh nhúng sẵn) để gửi qua điện thoại test.
// Three.js và font vẫn tải từ CDN nên máy cần có mạng. Chạy: npm run build:html -> dist/gom-gom-rotate.html
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const game = join(root, 'game');
const read = file => readFileSync(join(game, file), 'utf8');
const MIME = { png: 'image/png', svg: 'image/svg+xml' };
const dataUri = file => `data:${MIME[file.split('.').pop()]};base64,${readFileSync(join(game, file)).toString('base64')}`;

// JS: esbuild gộp mọi module (kể cả import động deco-room), để 'three' cho importmap trỏ CDN.
const js = execSync(
  'npx -y esbuild@0.24.0 game/gom-gom.js --bundle --format=esm --minify --external:three --external:three/* --log-level=warning',
  { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 },
).replace(/<\/script/gi, '<\\/script');

// CSS: nối theo đúng thứ tự trong index.html. Mỗi ảnh url('./...') nhúng MỘT lần vào biến CSS
// (cùng ảnh dùng nhiều chỗ thì không bị nhân đôi dung lượng).
const images = new Map();
const css = [...read('index.html').matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)]
  .map(([, file]) => read(file))
  .join('\n')
  .replace(/url\('\.\/([^']+)'\)/g, (_, file) => {
    if (!images.has(file)) images.set(file, `--img-${images.size}`);
    return `var(${images.get(file)})`;
  });
const imageVars = `:root{${[...images].map(([file, name]) => `${name}:url('${dataUri(file)}')`).join(';')}}`;

const html = read('index.html')
  .replace(/\s*<link rel="stylesheet" href="\.\/[^"]+">/g, '')
  .replace('href="./favicon.svg"', `href="${dataUri('favicon.svg')}"`)
  .replace(/<script type="module" src="\.\/gom-gom\.js"><\/script>/, () => `<style>\n${imageVars}\n${css}\n</style>\n  <script type="module">\n${js}\n</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'gom-gom-rotate.html');
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1048576).toFixed(1)} MB)`);
