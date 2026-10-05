// Quy tắc code (CLAUDE.md): kiểm tra tĩnh trên mã nguồn game. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
// Quét cả thư mục con (ui/, gameplay/, deco/); tên file kèm thư mục, vd. 'deco/qc.mjs'.
const sources = fs.readdirSync(dir, { recursive: true }).map(f => f.split('\\').join('/'))
  .filter(f => /\.(mjs|js)$/.test(f) && !f.endsWith('.test.mjs'));

// Chú thích `//` chèn giữa dòng làm câu lệnh phía sau biến thành chú thích (lỗi thật: `sideboard.rotation.y = ...` bị
// nuốt làm tủ quay ngang xuyên tường; `p.rotation.z = ...` của ván cầu suối). Dấu hiệu: phần chú thích ở cuối một dòng
// code lại chứa câu lệnh gán / gọi hàm kết thúc bằng `;`.
const SWALLOWED = /(?:;\s*[A-Za-z_$][\w$]*(?:\.[\w$]+)+\s*=[^=]|\)\s*;\s*[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*[=(]|\breturn\s+[\w$]+;\s*\}\);?\s*$|[A-Za-z_$][\w$]*(?:\.[\w$]+)+\s*=\s*[^=;]+;\s*$)/;
export function swallowedStatement(line) {
  const at = line.indexOf('//');
  if (at < 0) return false;
  const code = line.slice(0, at);
  if (!code.trim() || /['`"][^'`"]*$/.test(code)) return false; // dòng chỉ có chú thích, hoặc `//` nằm trong chuỗi
  return SWALLOWED.test(line.slice(at));
}

test('bộ dò bắt đúng các lỗi chú thích nuốt câu lệnh từng gặp', () => {
  assert.ok(swallowedStatement('  sideboard.position.set(-4 + .28, 0, .5); // chừa cửa phòng ngủ sideboard.rotation.y = Math.PI / 2;'));
  assert.ok(swallowedStatement('    const p = at(rbox(.12), x, arch(u) + .09, 0); // ván cách mặt nước p.rotation.z = -Math.atan(u) * .5; return p; });'));
  assert.ok(!swallowedStatement('  mergeStatic(leaves); // 10 lá + 10 cuống gộp theo màu; cả tán vẫn rung như một khối'));
  assert.ok(!swallowedStatement('// SMOOTH = hằng số; BELLY = độ phình eo khi lún.'));
});

test('không có câu lệnh nào bị chú thích nuốt mất', () => {
  const hits = [];
  for (const file of sources) fs.readFileSync(new URL(file, dir), 'utf8').split(/\r?\n/).forEach((line, i) => { if (swallowedStatement(line)) hits.push(`${file}:${i + 1}`); });
  assert.deepEqual(hits, [], `chú thích nuốt câu lệnh ở: ${hits.join(', ')} — đưa chú thích lên dòng riêng`);
});

test('khối bo góc chỉ tạo qua roundedBox() (tự chặn bán kính bo)', () => {
  const direct = [];
  for (const file of sources) {
    if (file.endsWith('mesh-detail.mjs')) continue;
    fs.readFileSync(new URL(file, dir), 'utf8').split(/\r?\n/).forEach((line, i) => { if (/new RoundedBoxGeometry\(/.test(line) && !/room-cats\.mjs/.test(file)) direct.push(`${file}:${i + 1}`); });
  }
  assert.deepEqual(direct, [], `dùng roundedBox() thay cho new RoundedBoxGeometry: ${direct.join(', ')}`);
});
