// Test mèo béo 2×2 (board-rules.mjs wakeFatCats, level-rules.mjs parseBoard, session.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard } from './level-rules.mjs';
import { clearMatches } from './board-rules.mjs';
import { turnPoints, POINTS_PER_FAT_ROLL } from './scoring.mjs';
import { clusterEffects } from './cluster-effects.mjs';
import * as game from './session.mjs';

const W = 6, H = 6;

test('bàn: khối 2×2 chữ số = một mèo béo (fatId = ô góc trên-trái), không thuộc cụm, chữ số lẻ loi thì báo lỗi', () => {
  const board = parseBoard(['......', '..33..', '..33..', '......', '......', '......']);
  assert.deepEqual([8, 9, 14, 15].map(i => board[i].fatId), [8, 8, 8, 8]);
  assert.ok([8, 9, 14, 15].every(i => board[i].fat === 3 && !board[i].group));
  assert.throws(() => parseBoard(['3.....', '......', '......', '......', '......', '......']));
});

test('mỗi cụm chạm mèo béo = 1 lần đánh thức (chạm nhiều cạnh vẫn 1), gom đôi cùng chạm = 2', () => {
  // cụm cam chạm cạnh trên + trái của mèo béo
  let board = parseBoard(['.OOO..', '.O33..', '..33..', '......', '......', '......']);
  let match = clearMatches(board, W, H, 3);
  assert.deepEqual(match.woke, [{ id: 8, left: 2 }]);
  assert.ok([8, 9, 14, 15].every(i => match.board[i].fat === 2));
  // hai cụm (cam trên, xám dưới) cùng chạm
  board = parseBoard(['.OOO..', '..33..', '..33..', '.GGG..', '......', '......']);
  match = clearMatches(board, W, H, 3);
  assert.deepEqual(match.woke, [{ id: 8, left: 1 }]);
});

test('đủ lần đánh thức thì mèo béo lăn: rời bàn, dọn vùng 4×4 (mèo, thùng; giữ kim loại), cộng thưởng', () => {
  const board = parseBoard(['.OOO..', 'W.11X.', '.M11..', '...W..', '......', '......']);
  const match = clearMatches(board, W, H, 3);
  assert.equal(match.rolled.length, 1);
  assert.ok([8, 9, 14, 15].every(i => match.board[i] === null), 'mèo béo rời bàn');
  assert.equal(match.board[6]?.group, 'white', 'ngoài vùng 4×4: giữ');
  assert.equal(match.board[10], null, 'thùng trong vùng: vỡ');
  assert.ok(match.board[13]?.metal, 'kim loại: giữ');
  assert.equal(match.board[21], null, 'mèo trong vùng: dọn');
  assert.equal(turnPoints(match), 30 + POINTS_PER_FAT_ROLL + 20);
});

test('hiệu ứng nổ trúng mèo béo = 1 lần mỗi hiệu ứng; búa = 2 lần; còn mèo béo thì chưa thắng', () => {
  const board = parseBoard(['......', '..33..', '..33..', '......', '......', '......']);
  const yarn = clusterEffects({ clusters: [[0, 1, 2, 6, 7]], groups: ['orange'], board }, [7], W, H, null);
  assert.deepEqual(yarn.woke, [{ id: 8, left: 2 }]);
  const s = game.createSession(11);
  s.grass = null; s.W = W; s.H = H; s.tutorial = null;
  s.board = parseBoard(['......', '..22..', '..22..', '......', '......', '......']);
  s.score = 10_000;
  assert.equal(game.goalReached(s), false, 'còn mèo béo ngủ');
  const smashed = game.smash(s, 8);
  assert.ok(smashed.ok && smashed.rolled.length === 1, 'búa đánh thức 2 lần: đủ thì lăn');
  assert.equal(game.fatLeft(s), 0);
  assert.ok(smashed.win);
});
