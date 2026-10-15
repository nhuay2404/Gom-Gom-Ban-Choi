// Test hiệu ứng cụm to / gom đôi. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterEffects } from './cluster-effects.mjs';

const W = 6, H = 6, cat = group => ({ group });
const match = (clusters, groups, board = Array(36).fill(null)) => ({ clusters, groups, board });

test('cụm 4 phá thùng kề, không xoá mèo', () => {
  const board = Array(36).fill(null); board[4] = { block: true }; board[6] = cat('b');
  const e = clusterEffects(match([[0, 1, 2, 3]], ['a'], board), [3], W, H, null);
  assert.deepEqual(e.effects.map(x => x.kind), ['pounce']);
  assert.deepEqual(e.broken, [4]);
  assert.equal(e.board[6]?.group, 'b');
});
test('cụm 5 nổ 3×3 quanh điểm tụ, cụm 6 xoá hàng + cột, cụm 7 gom cả màu', () => {
  const board = Array(36).fill(null); board[14] = cat('b'); board[35] = cat('a');
  assert.deepEqual(clusterEffects(match([[7, 8, 9, 13, 19]], ['a'], board), [8], W, H, null).blasted, [14]);
  assert.deepEqual(clusterEffects(match([[0, 1, 2, 3, 4, 5]], ['a'], board), [0], W, H, null).effects[0].kind, 'cross');
  assert.deepEqual(clusterEffects(match([[0, 1, 2, 3, 4, 5, 6]], ['a'], board), [0], W, H, null).blasted, [35]);
});
test('gom đôi: 3+3 mèo vồ vật cản gần nhất (không có thì xoá 2 mèo lẻ), 4+4 có yarn', () => {
  const board = Array(36).fill(null); board[20] = { block: true }; board[35] = { block: true }; board[12] = { block: true, metal: true };
  const e33 = clusterEffects(match([[0, 1, 2], [30, 31, 32]], ['a', 'b'], board), [14, 32], W, H, null);
  assert.ok(e33.double); assert.deepEqual(e33.broken, [20]);
  const cats = Array(36).fill(null); cats[15] = cat('a'); cats[16] = cat('a'); cats[17] = cat('b'); cats[5] = cat('c'); cats[35] = cat('d');
  const lone = clusterEffects(match([[0, 1, 2], [30, 31, 32]], ['a', 'b'], cats), [14, 32], W, H, null);
  assert.deepEqual(lone.blasted.sort((a, b) => a - b), [5, 17]);
  const e44 = clusterEffects(match([[0, 1, 2, 3], [30, 31, 32, 33]], ['a', 'b']), [3, 33], W, H, null);
  assert.deepEqual(e44.effects.map(x => x.kind), ['pounce', 'pounce', 'yarn']);
});
test('ô ngoài bàn không nằm trong vùng hiệu ứng', () => {
  const board = Array(36).fill(null); board[5] = { block: true, metal: true, void: true };
  const e = clusterEffects(match([[0, 1, 2, 3, 4, 6]], ['a'], board), [0], W, H, null);
  assert.ok(!e.effects[0].cells.includes(5));
  assert.ok(e.board[5].void);
});
