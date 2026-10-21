import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSyrupMask, SYRUP_MASKS, syrupMaskAt, syrupAtlasStyle } from './syrup-autotile.mjs';
test('syrup atlas has exactly 47 reachable blob tiles and all 256 neighborhoods resolve', () => {
  assert.equal(SYRUP_MASKS.length, 47);
  for (let mask = 0; mask < 256; mask++) {
    assert.ok(SYRUP_MASKS.includes(canonicalSyrupMask(mask)));
    assert.equal(canonicalSyrupMask(canonicalSyrupMask(mask)), canonicalSyrupMask(mask));
    assert.ok(!syrupAtlasStyle(mask).includes('NaN'));
  }
});
test('diagonal changes distinguish filled corners from concave corners', () => {
  const ring = ['111', '101', '111'];
  const has = (r, c) => ring[r]?.[c] === '1';
  assert.equal(syrupMaskAt(0, 0, has), 6);
  assert.equal(syrupMaskAt(0, 1, has), 10);
  assert.equal(canonicalSyrupMask(16 | 1), 1);
  assert.equal(canonicalSyrupMask(16 | 3), 19);
});
