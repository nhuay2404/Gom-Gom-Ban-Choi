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
test('cụm 5 nổ 3×3 quanh điểm tụ, cụm 6 gom cả màu + mở 1 khoá chuồng gần nhất, cụm 7 dọn sạch bàn (+20 mỗi thứ)', () => {
  const board = Array(36).fill(null); board[14] = cat('b'); board[35] = cat('a');
  assert.deepEqual(clusterEffects(match([[7, 8, 9, 13, 19]], ['a'], board), [8], W, H, null).blasted, [14]);
  const withCage = board.slice(); withCage[20] = { group: 'b', cage: 2 }; withCage[33] = { block: true, metal: true };
  const cross = clusterEffects(match([[0, 1, 2, 3, 4, 5]], ['a'], withCage), [0], W, H, null);
  assert.equal(cross.effects[0].kind, 'cross');
  assert.deepEqual(cross.blasted, [35], 'chỉ mèo cùng màu a');
  assert.deepEqual(cross.caged, [20]);
  const grass = Array(36).fill(false); grass[30] = true;
  const herd = clusterEffects(match([[0, 1, 2, 3, 4, 5, 6]], ['a'], withCage), [0], W, H, grass);
  assert.ok(herd.board.every(cell => cell === null), 'cả bàn trống, kể cả kim loại + mèo trong chuồng');
  assert.equal(herd.points, 5 * 20, 'mèo b, mèo a, chuồng, kim loại, ô cỏ: mỗi thứ +20');
});
test('gom đôi: 3+3 thả 2 mèo đơn vào chỗ thành cụm (gom luôn, thùng sát cụm vỡ), 4+4 có yarn', () => {
  // mèo 'c' ở 20, 21 + thùng ở 23: thả 'c' vào 22 thành cụm 3 -> gom, thùng 23 vỡ; mèo thả thứ hai cũng phải ở ô trống
  const cats = Array(36).fill(null); cats[20] = cat('c'); cats[21] = cat('c'); cats[23] = { block: true };
  const e33 = clusterEffects(match([[0, 1, 2], [30, 31, 32]], ['a', 'b'], cats), [14, 32], W, H, null);
  assert.ok(e33.double); assert.deepEqual(e33.effects.map(x => x.kind), ['drop', 'pounce'], 'mèo thả thứ hai nối thành cụm 4 -> pounce');
  assert.equal(e33.dropped.length, 2);
  assert.deepEqual(e33.dropped[0], { index: 22, group: 'c' });
  assert.ok(e33.chain.cleared.includes(22) && e33.broken.includes(23));
  assert.ok([20, 21, 22, 23].every(i => e33.board[i] === null));
  assert.ok(e33.points >= 30 + 10);
  const e44 = clusterEffects(match([[0, 1, 2, 3], [30, 31, 32, 33]], ['a', 'b']), [3, 33], W, H, null);
  assert.deepEqual(e44.effects.map(x => x.kind), ['pounce', 'pounce', 'yarn']);
});
test('ô ngoài bàn không nằm trong vùng hiệu ứng', () => {
  const board = Array(36).fill(null); board[5] = { block: true, metal: true, void: true };
  const e = clusterEffects(match([[0, 1, 2, 3, 4, 6]], ['a'], board), [0], W, H, null);
  assert.ok(!e.effects[0].cells.includes(5));
  assert.ok(e.board[5].void);
});
test('mèo vừa ra khỏi lồng cạnh 2 mèo cùng loại: gom dây chuyền ngay trong lượt', async () => {
  const { clearMatches } = await import('./board-rules.mjs');
  const board = Array(36).fill(null);
  [0, 1, 2].forEach(i => { board[i] = cat('a'); });
  board[8] = { group: 'b', cage: 1 }; board[9] = cat('b'); board[10] = cat('b'); board[11] = { block: true };
  const m = clearMatches(board, W, H, 3);
  assert.deepEqual(m.freed, [8]);
  const e = clusterEffects(m, [2], W, H, null);
  assert.deepEqual(e.chain.cleared.sort((x, y) => x - y), [8, 9, 10]);
  assert.ok([8, 9, 10, 11].every(i => e.board[i] === null), 'cụm b gom, thùng sát cụm vỡ');
  assert.equal(e.points, 30 + 10);
});
test('cụm gom dây chuyền 4+ cũng nổ hiệu ứng cụm to (đánh dấu chain)', async () => {
  const { clearMatches } = await import('./board-rules.mjs');
  const board = Array(36).fill(null);
  [0, 1, 2].forEach(i => { board[i] = cat('a'); });
  // b ở 9, 10, 14 rời nhau; lồng 8 vỡ thì nối thành cụm 4 -> pounce
  board[8] = { group: 'b', cage: 1 }; [9, 10, 14].forEach(i => { board[i] = cat('b'); });
  const e = clusterEffects(clearMatches(board, W, H, 3), [2], W, H, null);
  assert.deepEqual(e.effects, [{ kind: 'pounce', center: 8, cells: e.effects[0].cells, points: 0, chain: true }]);
});
