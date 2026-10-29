// Gộp game thành MỘT file HTML (JS + Three.js + CSS + ảnh nhúng sẵn) để gửi qua điện thoại / máy khác chơi thử.
// Chơi được không cần mạng; chỉ font (Google Fonts) cần mạng, offline thì dùng font dự phòng của máy.
// Chạy: npm run build:html -> dist/cube-cat-match3-deco.html (có nút dev trong Settings; bản cho người chơi: npm run build:html -- --no-dev)
//
// Three.js: dự án không cài thư viện (bản web nạp từ CDN qua importmap). Khi build, chép tạm game/ ra thư mục tạm của hệ
// thống, cài three@<THREE_VERSION> ở đó rồi esbuild gộp luôn vào bundle — thư mục dự án không có node_modules.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const DEV_BUILD = !process.argv.includes('--no-dev');
const THREE_VERSION = '0.170.0'; // khớp importmap trong game/index.html
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const game = join(root, 'game');
const read = file => readFileSync(join(game, file), 'utf8');
const MIME = { mp3: 'audio/mpeg', png: 'image/png', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
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
const dynamicDirs = new Set();
const bundle = execSync(
  'npx -y esbuild@0.24.0 game/app/main.js --bundle --format=esm --minify --log-level=warning',
  { cwd: work, encoding: 'utf8', maxBuffer: 128 << 20 },
).replace(/<\/script/gi, '<\\/script')
  // Ảnh / tiếng JS tham chiếu theo đường dẫn (vd. mèo cam bitmap trong ui/cat-art.mjs, tiếng thắng trong ui/sound.mjs): nhúng thẳng thành data URI.
  .replace(/(["'])(assets\/(?:img|sfx)\/[^"']+\.(?:png|jpe?g|webp|mp3))\1/g, (_, q, file) => q + dataUri(file) + q)
  // Ảnh trong chuỗi HTML dựng bằng JS (vd. <img src="./assets/img/shop/coin-stack.png">): cũng nhúng thành data URI.
  // (đường dẫn ghép động như `${s}.png` thì bỏ qua: không biết trước file nào)
  .replace(/\.\/(assets\/(?:img|sfx)\/[^"'`)\s]+\.(?:png|jpe?g|webp|mp3))/g, (all, file) => (file.includes('${') ? all : dataUri(file)))
  // Tên file ghép động trong template (vd. `./assets/img/login-gift/reward-day${i}.png`): nhúng MỘT lần các file trong thư mục có cùng phần tên đứng trước ${ (vd. reward-day*) vào bảng __A
  // (đường dẫn -> data URI, khai ở đầu bundle), chỗ dùng đổi thành `${__A[`đường dẫn`]}`.
  .replace(/(?:\.\/)?(assets\/img\/(?:[\w-]+\/)+)((?:[^`"'\s)$\\]|\$\{[^}]*\})*\$\{[^}]*\}(?:[^`"'\s)$\\]|\$\{[^}]*\})*)/g, (_, dir, name) => {
    // Phần đuôi sau ${...} cuối (vd. ".webp"): chỉ nhúng file khớp đuôi đó (thư mục nền màn chơi có cả .png gốc lẫn .webp).
    dynamicDirs.add(`${dir}${name.split("${")[0]}|${name.slice(name.lastIndexOf('}') + 1)}`);
    return `\${__A[\`${dir}${name}\`]}`;
  });
const assetTable = Object.fromEntries([...dynamicDirs].flatMap(key => {
  const [prefix, suffix] = key.split('|'), dir = prefix.slice(0, prefix.lastIndexOf("/") + 1);
  return readdirSync(join(game, dir)).map(f => dir + f)
    .filter(file => file.startsWith(prefix) && file.endsWith(suffix) && MIME[file.split(".").pop().toLowerCase()]).map(file => [file, dataUri(file)]);
}));
const js = `const __A=${JSON.stringify(assetTable)};\n${bundle}`;

// CSS: nối theo đúng thứ tự trong index.html. Mỗi ảnh url('./...') (tính từ thư mục của file CSS) nhúng MỘT lần
// vào biến CSS (cùng ảnh dùng nhiều chỗ thì không bị nhân đôi dung lượng).
const images = new Map();
const css = [...read('index.html').matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)]
  // url('…'), url("…") và url(…) không nháy đều nhúng (lỗi cũ: chỉ nhận nháy đơn -> nền màn chơi ở hud.css viết nháy kép bị mất).
  .map(([, sheet]) => read(sheet).replace(/url\((['"]?)(\.{1,2}\/[^'")]+)\1\)/g, (_, q, file) => {
    const path = posix.join(posix.dirname(sheet), file);
    if (!images.has(path)) images.set(path, `--img-${images.size}`);
    return `var(${images.get(path)})`;
  }))
  .join('\n');
const imageVars = `:root{${[...images].map(([file, name]) => `${name}:url('${dataUri(file)}')`).join(';')}}`;

// Mỗi bản build mới chơi lại từ đầu ở màn onboarding (xoá save cũ một lần trên mỗi máy), cả bản dev lẫn bản người chơi.
// Bản cho người chơi (--no-dev) còn không có Starter Pack.
const BUILD_ID = Date.now();
const FRESH_START = `<script>try { if (localStorage.getItem('cubecat-build') !== '${BUILD_ID}') { localStorage.clear(); localStorage.setItem('cubecat-build', '${BUILD_ID}'); } } catch {}</script>\n  `;
const PLAYER_SETUP = `<style>#home-starter{display:none!important}</style>
  <script>window.GOMGOM_NO_STARTER = true;</script>\n  `;

// Ảnh trong HTML (<img src="./...">): nhúng thẳng; ảnh trùng nhau nhúng lại (ít, nhỏ).
const html = read('index.html')
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/\s*<link rel="stylesheet" href="\.\/[^"]+">/g, '')
  .replace('href="./favicon.svg"', `href="${dataUri('favicon.svg')}"`)
  .replace(/src="\.\/(?!app\/main\.js)([^"]+)"/g, (_, file) => `src="${dataUri(file)}"`)
  .replace(/<script type="module" src="\.\/app\/main\.js"><\/script>/, () => `<style>\n${imageVars}\n${css}\n</style>\n  ${FRESH_START}${DEV_BUILD ? '<script>window.GOMGOM_DEV = true;</script>\n  ' : PLAYER_SETUP}<script type="module">\n${js}\n</script>`);
const leftover = /(?:src|href)="\.\/[^"]*"/.exec(html);
if (leftover) throw new Error(`Còn đường dẫn ./ chưa nhúng trong HTML: ${leftover[0]}`);

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'cube-cat-match3-deco.html');
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1048576).toFixed(1)} MB)`);
