// Test siro dâu phủ mèo (level-rules.mjs parseBoard `syrup`, board-rules.mjs removeClusters `syrup`, cluster-effects.mjs, session.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard } from './level-rules.mjs';
import { clearMatches } from './board-rules.mjs';
import { clusterEffects } from './cluster-effects.mjs';
import * as game from './session.mjs';

const W = 6, H = 6;
const EMPTY = ['......', '......', '......', '......', '......', '......'];

test('mèo phủ siro không vào cụm; gom sát bên thì siro vỡ, mèo ở lại thành mèo thường', () => {
  const board = parseBoard(['.OOO..', '..O...', ...EMPTY.slice(2)], ['......', '..~...', ...EMPTY.slice(2)]);
  assert.deepEqual(board[8], { group: 'orange', locked: true, starting: true, cage: 1, syrup: true });
  const match = clearMatches(board, W, H, 3);
  assert.deepEqual(match.cleared, [1, 2, 3], 'mèo phủ siro không bị gom');
  assert.deepEqual(match.syrup, [8]);
  assert.deepEqual(match.board[8], { group: 'orange', locked: true, starting: true });
});

test('hiệu ứng trúng mèo phủ siro: siro vỡ (out.syrup); siro trên ô không phải mèo thì bỏ qua', () => {
  const board = parseBoard(['......', '..O...', ...EMPTY.slice(2)], ['~.....', '..~...', ...EMPTY.slice(2)]);
  assert.equal(board[0], null);
  const yarn = clusterEffects({ clusters: [[0, 1, 2, 6, 7]], groups: ['gray'], board }, [7], W, H, null);
  assert.deepEqual(yarn.syrup, [8]);
});

test('còn siro thì chưa thắng; siro không tính là chuồng', () => {
  const s = game.createSession(11);
  s.grass = null; s.W = W; s.H = H; s.tutorial = null;
  s.board = parseBoard(['......', '..O...', ...EMPTY.slice(2)], ['......', '..~...', ...EMPTY.slice(2)]);
  s.score = 10_000;
  assert.equal(game.cagesLeft(s), 0);
  assert.equal(game.syrupLeft(s), 1);
  assert.equal(game.goalReached(s), false);
  assert.ok(game.smash(s, 8).win);
});
