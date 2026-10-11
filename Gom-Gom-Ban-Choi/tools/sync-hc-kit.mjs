// Chép hc-kit (kit Economy + LiveOps dùng chung, repo riêng) vào game/hc-kit/ và ghi phiên bản đang dùng.
// Kit phải nằm TRONG game/: server chỉ phục vụ game/, còn build:html chỉ chép game/ ra thư mục tạm rồi mới gộp.
// Bản chép được commit vào repo này, nên máy không có repo kit vẫn chạy / build được. Không sửa tay game/hc-kit/: sửa ở repo kit rồi chạy lại.
// Chạy: npm run sync:kit  (repo kit: biến môi trường HC_KIT, mặc định là thư mục LiveOps-Kit nằm cạnh repo Gom Gom)
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kit = resolve(process.env.HC_KIT || join(root, '..', '..', 'LiveOps-Kit'));
if (!existsSync(join(kit, 'src', 'index.mjs'))) {
  console.error(`Không thấy hc-kit ở ${kit}. Đặt biến môi trường HC_KIT trỏ tới repo kit.`);
  process.exit(1);
}
const out = join(root, 'game', 'hc-kit');
rmSync(out, { recursive: true, force: true });
cpSync(join(kit, 'src'), out, { recursive: true });
let commit = 'unknown', dirty = false;
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: kit, encoding: 'utf8' }).trim();
  dirty = execSync('git status --porcelain src', { cwd: kit, encoding: 'utf8' }).trim() !== '';
} catch { /* kit không phải repo git */ }
const { version } = JSON.parse(readFileSync(join(kit, 'package.json'), 'utf8'));
writeFileSync(join(out, 'VERSION.json'), JSON.stringify({ version, commit: dirty ? `${commit}-dirty` : commit }, null, 2) + '\n');
console.log(`hc-kit ${version} (${commit}${dirty ? ', có thay đổi chưa commit' : ''}) → game/hc-kit/`);
