// Test lò xo của mèo 3D (spring.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spring } from './spring.mjs';

// Mọi lò xo đang dùng trong mèo 3D (cat-brain.mjs, room-cats.mjs: k, zeta), kể cả lò xo tư thế ở tuning.mjs.
const SPRINGS = [[900, 1], [380, .28], [320, .55], [150, .2], [150, .85], [140, .8], [120, .35], [90, .5], [45, .28], [18, .9]];

test('lò xo ổn định ở mọi tốc độ khung hình (lỗi cũ: mí mắt nổ tới 1e164, mắt mèo nháy mỗi frame ở 30 fps)', () => {
  for (const [k, zeta] of SPRINGS) for (const dt of [1 / 120, 1 / 60, 1 / 30, .05]) {
    const s = { v: 1 };
    for (let i = 0; i < 2 / dt; i++) spring(s, 'v', 0, k, zeta, dt);
    assert.ok(Math.abs(s.v) < .05 && Number.isFinite(s.vV), `k=${k} zeta=${zeta} dt=${dt}: còn ${s.v}`);
  }
});

test('chớp mắt ở 30 fps: mí khép rồi mở lại đúng một lần, không dao động qua lại ngưỡng', () => {
  const s = { lid: 1 }, dt = 1 / 30;
  let crossings = 0, closed = false;
  for (let i = 0; i < 60; i++) {
    spring(s, 'lid', i * dt < .16 ? 0 : 1, 900, 1, dt);
    if ((s.lid < .45) !== closed) { closed = !closed; crossings++; }
  }
  assert.equal(crossings, 2);
});

test('mèo 3D (cat-brain / cat-rig / room-cats) không tự viết lại lò xo (dùng spring.mjs)', () => {
  const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const file of ['./cat-brain.mjs', './cat-rig.mjs', './room-cats.mjs']) assert.ok(!/function spring\(/.test(read(file)), file);
  assert.ok(read('./cat-brain.mjs').includes("from './spring.mjs'"));
});
