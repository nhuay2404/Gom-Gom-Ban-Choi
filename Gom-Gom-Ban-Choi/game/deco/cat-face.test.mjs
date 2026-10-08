// Test nguyên tắc biểu cảm mèo 3D (cat-face.mjs + mọi chỗ gọi face() trong room-cats.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FACE, EYES, MOUTHS, HOLD, expressionOf, settleExpression } from './cat-face.mjs';
import { CAT_EXPRESSIONS } from '../ui/cat-art.mjs';

const source = fs.readFileSync(new URL('./room-cats.mjs', import.meta.url), 'utf8').split(/\r?\n/);

// Mọi lời gọi `.face(...)` kèm tên hàm bao ngoài (hành vi). Dòng có nhiều lời gọi thì tách từng cái.
function faceCalls() {
  const calls = [];
  let fn = '';
  source.forEach((line, i) => {
    const def = line.match(/^  \*?([A-Za-z]+)\(.*\) \{\s*$/);
    if (def) fn = def[1];
    for (const m of line.matchAll(/\bface\(((?:'\w+')|(?:[^()]*?\?[^()]*?))(?:, '(\w+)')?\)/g)) {
      if (/^\s*(eyes|face)\b/.test(line.trim()) && !line.includes("'")) continue;
      calls.push({ line: i + 1, fn, arg: m[1], mouth: m[2] });
    }
  });
  return calls.filter(c => c.arg.includes("'"));
}

test('mỗi giá trị mắt = đúng một mặt Figma có thật, không hai giá trị trùng mặt', () => {
  const faces = EYES.map(e => FACE[e]);
  assert.equal(new Set(faces).size, faces.length, 'hai giá trị mắt cho cùng một mặt');
  faces.forEach(f => assert.ok(f === 'blink' || CAT_EXPRESSIONS.includes(f), `${f} không có ảnh biểu cảm`));
  // 7 mặt Figma đều được dùng (blink là mặt calm nhắm mắt, sleep vẽ vector)
  CAT_EXPRESSIONS.forEach(f => assert.ok(faces.includes(f), `mặt ${f} không có hành vi nào dùng được`));
});

test('expressionOf: ngáp (sleep + yawn) là sleepy, còn lại theo bảng', () => {
  assert.equal(expressionOf('sleep', 'yawn'), 'sleepy');
  assert.equal(expressionOf('sleep', 'calm'), 'sleep');
  for (const e of EYES) assert.equal(expressionOf(e, 'calm'), FACE[e]);
  assert.equal(expressionOf('lạ', 'calm'), 'calm');
});

test('mọi face() trong room-cats.mjs dùng đúng giá trị mắt / miệng của bảng nguyên tắc', () => {
  const calls = faceCalls();
  assert.ok(calls.length > 100, 'không quét được các lời gọi face()');
  const bad = [];
  for (const { line, arg, mouth } of calls) {
    const used = [...arg.matchAll(/'(\w+)'/g)].map(m => m[1]);
    if (!used.every(e => EYES.includes(e))) bad.push(`dòng ${line}: mắt ${used} không có trong bảng`);
    if (mouth && !MOUTHS.includes(mouth)) bad.push(`dòng ${line}: miệng '${mouth}' không hiện được trên mặt`);
    if (mouth === 'yawn' && arg !== "'sleep'") bad.push(`dòng ${line}: 'yawn' chỉ đi với 'sleep'`);
  }
  assert.deepEqual(bad, []);
});

// Giận (angry) là mặt mạnh nhất: chỉ khi bị nhấc / giật mình / bị đau / khè quơ vuốt. Bực nhẹ (chê, tiếc, ướt chân, hờn) dùng grumble.
test("'annoyed' (angry) chỉ xuất hiện ở hành vi giận / giật mình", () => {
  const allowed = new Set(['useFurniture', 'flee', 'tailTeased', 'beAmbushed', 'wakeStartled', 'beCarried', 'pet', 'grumpy', 'update']);
  const calls = faceCalls().filter(c => c.arg === "'annoyed'" && !allowed.has(c.fn));
  assert.deepEqual(calls.map(c => `dòng ${c.line} (${c.fn})`), [], 'hành vi bực nhẹ phải dùng face(\'grumble\')');
});

test("'half' (sleepy) chỉ là bước đệm trước khi ngủ / ngáp / choáng, không phải mặt nằm thư giãn", () => {
  const bad = [];
  source.forEach((line, i) => {
    if (!/face\('half'\)/.test(line)) return;
    // cho phép: trong nap / sleep / yawn / tailChase (choáng), hoặc ngay sau đó ngủ thật (this.sleep) / ngáp trong 2 dòng kế
    const ctx = source.slice(i - 6, i + 3).join('\n');
    if (/\*(sleep|nap|yawnStretch|tailChase)\(/.test(ctx) || /this\.sleep\(|face\('sleep'\)/.test(source.slice(i, i + 3).join('\n'))) return;
    bad.push(`dòng ${i + 1}`);
  });
  assert.deepEqual(bad, [], "nằm thư giãn dùng face('blink'), hết hờn / nhìn quanh dùng face('open')");
});

test('settleExpression: giữ mặt tối thiểu HOLD giây, mặt phản ứng người chơi đổi ngay', () => {
  const s = {};
  assert.equal(settleExpression(s, 'calm', 0), 'calm');
  assert.equal(settleExpression(s, 'cute', HOLD / 2), 'calm', 'chưa đủ HOLD thì giữ mặt cũ');
  assert.equal(settleExpression(s, 'cute', HOLD + .01), 'cute');
  assert.equal(settleExpression(s, 'calm', HOLD + .1), 'cute', 'vừa đổi xong, đổi tiếp quá sớm thì giữ');
  assert.equal(settleExpression(s, 'angry', HOLD + .2, true), 'angry', 'urgent đổi ngay');
  // 60 fps, hành vi đổi mặt mỗi 0.1 s: số lần đổi thật bị chặn theo HOLD
  const t = {}; let flips = 0, prev = null;
  for (let f = 0; f < 600; f++) {
    const now = f / 60, shown = settleExpression(t, Math.floor(now / .1) % 2 ? 'cute' : 'calm', now);
    if (prev && shown !== prev) flips++;
    prev = shown;
  }
  assert.ok(flips <= 10 / HOLD, `đổi ${flips} lần / 10 s (không giữ mặt thì ~100 lần)`);
});
