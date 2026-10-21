// Test hộp thư '@' (level-rules.mjs parseBoard, board-rules.mjs removeClusters `mail`, cluster-effects.mjs, session.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard } from './level-rules.mjs';
import { clearMatches } from './board-rules.mjs';
import { clusterEffects } from './cluster-effects.mjs';
import * as game from './session.mjs';

const W = 6, H = 6;

test('gom sát hộp thư: mỗi cụm chạm = 1 thư, hai cụm chạm cùng hộp = 2, một cụm chạm hai hộp = 2; hộp không vỡ', () => {
  let match = clearMatches(parseBoard(['.OOO..', '..@...', '......', '......', '......', '......']), W, H, 3);
  assert.deepEqual(match.mail, [8]);
  assert.ok(match.board[8].mail, 'hộp còn nguyên');
  match = clearMatches(parseBoard(['.OOO..', '..@GGG', '......', '......', '......', '......']), W, H, 3);
  assert.deepEqual(match.mail, [8, 8]);
  match = clearMatches(parseBoard(['......', '.@.@..', '.OOO..', '......', '......', '......']), W, H, 3);
  assert.deepEqual(match.mail.sort(), [7, 9]);
});

test('hiệu ứng trúng hộp thư = 1 thư mỗi hiệu ứng, herd không xoá hộp', () => {
  const board = parseBoard(['......', '..@...', '......', '......', '......', '......']);
  const yarn = clusterEffects({ clusters: [[0, 1, 2, 6, 7]], groups: ['orange'], board }, [7], W, H, null);
  assert.deepEqual(yarn.mail, [8]);
  const herd = clusterEffects({ clusters: [[0, 1, 2, 3, 6, 7, 12]], groups: ['orange'], board }, [7], W, H, null);
  assert.deepEqual(herd.mail, [8]);
  assert.ok(herd.board[8].mail);
});

test('màn có thư: chưa đủ thư thì chưa thắng; búa không phá hộp mà bay 1 thư', () => {
  const s = game.createSession(11);
  s.grass = null; s.W = W; s.H = H; s.tutorial = null;
  s.board = parseBoard(['......', '..@...', '......', '......', '......', '......']);
  s.mailTotal = 1; s.mail = 0; s.score = 10_000;
  assert.equal(game.goalReached(s), false);
  const hit = game.smash(s, 8);
  assert.ok(hit.ok && hit.win);
  assert.ok(s.board[8].mail, 'hộp còn nguyên');
  assert.equal(game.mailLeft(s), 0);
});
