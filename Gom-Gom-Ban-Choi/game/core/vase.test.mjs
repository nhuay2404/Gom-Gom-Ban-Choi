// Test bình hoa '%' (level-rules.mjs parseBoard, board-rules.mjs removeClusters `cracked` / `shattered`, cluster-effects.mjs, session.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard } from './level-rules.mjs';
import { clearMatches } from './board-rules.mjs';
import { clusterEffects } from './cluster-effects.mjs';
import * as game from './session.mjs';

const W = 6, H = 6;

test('gom sát bình: lần 1 nứt, lần 2 vỡ; một lượt (dù 2 cụm cùng chạm) chỉ trúng 1 lần', () => {
  let match = clearMatches(parseBoard(['.OOO..', '..%GGG', '......', '......', '......', '......']), W, H, 3);
  assert.deepEqual([match.cracked, match.shattered], [[8], []]);
  assert.equal(match.board[8].vase, 1);
  const board = match.board.slice();
  [1, 2, 3].forEach(i => { board[i] = { group: 'gray' }; });
  match = clearMatches(board, W, H, 3);
  assert.deepEqual([match.cracked, match.shattered], [[], [8]]);
  assert.equal(match.board[8], null);
});

test('hiệu ứng trúng bình = 1 lần; herd vỡ hẳn', () => {
  const board = parseBoard(['......', '..%...', '......', '......', '......', '......']);
  const yarn = clusterEffects({ clusters: [[0, 1, 2, 6, 7]], groups: ['orange'], board }, [7], W, H, null);
  assert.deepEqual([yarn.cracked, yarn.shattered], [[8], []]);
  const herd = clusterEffects({ clusters: [[0, 1, 2, 3, 6, 7, 12]], groups: ['orange'], board }, [7], W, H, null);
  assert.deepEqual(herd.shattered, [8]);
});

test('còn bình thì chưa thắng; búa vỡ bình', () => {
  const s = game.createSession(11);
  s.grass = null; s.W = W; s.H = H; s.tutorial = null;
  s.board = parseBoard(['......', '..%...', '......', '......', '......', '......']);
  s.score = 10_000;
  assert.equal(game.goalReached(s), false);
  assert.ok(game.smash(s, 8).win);
  assert.equal(game.vasesLeft(s), 0);
});
