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

// Viền toon không được giật khi kéo / xoay / pinch camera (CLAUDE.md, mục "Viền không được giật"): giữ các điểm chốt trong shader.
test('outline-rules: viền mảnh theo từng mảnh lưới và nét trong chuyển mượt theo 3 x 3 pixel ID', () => {
  const toon = fs.readFileSync(new URL('deco/toon.mjs', dir), 'utf8');
  // 1. bề dày nét bị chặn theo outlineThin của đỉnh (không phải hộp bao cả mesh)
  assert.match(toon, /attribute float outlineThin;/, 'thiếu thuộc tính outlineThin');
  assert.match(toon, /w = min\(w, max\(outlineThin \* thinScale \/ pixelWorld/, 'nét không bị chặn theo bề ngang thật của bộ phận');
  assert.match(toon, /ensureOutlineThin\(node\.geometry\)/, 'addOutlines phải tính outlineThin cho mọi khối có viền');
  assert.doesNotMatch(toon, /uniform float thinDim/, 'thinDim theo cả mesh sai với hàng rào gộp (mergeStatic)');
  // 2. nét trong: lấy mẫu 3 x 3 pixel ID và chuyển mượt (không quyết định cứng theo một pixel)
  assert.ok(toon.includes('for (int ox = -1; ox <= 1; ox++) for (int oy = -1; oy <= 1; oy++)'), 'so ID phải lấy mẫu 3 x 3 pixel');
  assert.ok(toon.includes('alpha = mix(1.0, inner, own)'), 'alpha nét trong phải chuyển mượt theo tỉ lệ pixel là khối của mình');
  assert.ok(!toon.includes('if (own) {'), 'không quyết định nét trong bằng ngưỡng cứng if (own)');
  // 3. không dùng noise theo toạ độ pixel cho nét (gl_FragCoord chỉ để đọc texture ID)
  const frag = toon.slice(toon.indexOf('fragmentShader: `\n      uniform vec3 color;') >= 0 ? toon.indexOf('fragmentShader: `\n      uniform vec3 color;') : toon.indexOf('fragmentShader: `\r\n      uniform vec3 color;'));
  assert.ok(frag.length > 100, 'không tìm thấy fragment shader của viền');
  const fragCoordUses = (frag.match(/gl_FragCoord/g) || []).length;
  assert.equal(fragCoordUses, 1, 'gl_FragCoord chỉ dùng một lần (đọc texture ID); thêm nữa dễ gây nhấp nháy theo pixel');
});

test('outline-rules: kết cấu căn phòng / vườn không có viền (isStructure bỏ pickSurface / structure)', () => {
  const toon = fs.readFileSync(new URL('deco/toon.mjs', dir), 'utf8');
  assert.ok(toon.includes('n.userData.pickSurface || n.userData.structure'), 'isStructure phải bỏ cả pickSurface lẫn structure');
  assert.ok(toon.includes('if (isStructure(node))'),'addOutlines phải bỏ qua kết cấu');
  const room = fs.readFileSync(new URL('deco/deco-room.mjs', dir), 'utf8');
  for (const key of ["key: 'floors'", "key: 'walls'"]) assert.ok(room.includes(key), `mất pickSurface ${key}: sàn / tường sẽ lại có viền`);
  assert.ok(room.includes('cornersSquare.userData.structure'), 'góc vườn phải đánh dấu structure');
});
