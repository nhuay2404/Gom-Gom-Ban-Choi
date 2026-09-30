// Test luật một ván (session.mjs) + dữ liệu 20 màn + tiến độ. Chạy: npm test
// Khi port sang Cocos: chuyển nguyên file này sang TS, chạy trên core/ mới — qua hết là luật khớp bản web.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from './session.mjs';
import { LEVELS, parseBoard, parseCard } from './levels.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE } from './scoring.mjs';
import { recordWin, unlockedCount, levelTier, levelMechanics } from './progression.mjs';
import { BOARD, ECONOMY } from './tuning.mjs';

const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// Chạy tutorial của một màn chỉ bằng API của session, như người chơi làm theo từng bước.
function playTutorial(index) {
  const s = game.createSession(index, { rng: seeded(index + 1) });
  const steps = s.tutorial.steps;
  let guard = 0;
  while (game.tutorialStep(s) && guard++ < 40) {
    const step = game.tutorialStep(s);
    if (step.type === 'info') { game.continueTutorial(s); continue; }
    if (step.type === 'rotate') { for (let i = 0; i < 4 && game.tutorialStep(s) === step; i++) assert.ok(game.rotate(s).ok, `màn ${index + 1}: xoay`); continue; }
    if (step.type === 'hold' || step.type === 'tapHold') { assert.ok(game.hold(s).ok, `màn ${index + 1}: gửi tạm`); continue; }
    const turn = game.place(s, step.anchor);
    assert.ok(turn.ok, `màn ${index + 1}: bước "${step.text}" đặt ở ô ${step.anchor} lỗi: ${turn.error}`);
  }
  return { s, steps };
}

test('mọi màn: bàn đủ 36 ô, không có sẵn cụm gom được, thẻ kịch bản hợp lệ, có tier hợp lệ', () => {
  assert.equal(LEVELS.length, 20);
  LEVELS.forEach((level, i) => {
    const board = parseBoard(level.board);
    assert.equal(board.length, BOARD.W * BOARD.H, `màn ${i + 1}`);
    assert.equal(clearMatches(board, BOARD.W, BOARD.H, MATCH_SIZE).cleared.length, 0, `màn ${i + 1} có sẵn cụm`);
    (level.deck || []).forEach(spec => assert.ok(parseCard(spec).items.every(item => item.group), `màn ${i + 1} thẻ ${spec}`));
    assert.ok(['chill', 'normal', 'hard', 'boss'].includes(levelTier(level)), `màn ${i + 1} tier`);
  });
});

test('nhịp tiến trình: tutorial chỉ ở màn 1–2 (+ bong bóng giới thiệu cơ chế), boss ở 10 và 20, nghỉ ở 8 và 19', () => {
  assert.equal(levelTier(LEVELS[9]), 'boss');
  assert.equal(levelTier(LEVELS[19]), 'boss');
  assert.equal(levelTier(LEVELS[7]), 'chill');
  assert.equal(levelTier(LEVELS[18]), 'chill');
  assert.equal(LEVELS[4].introduces, 'crate');
  assert.equal(LEVELS[7].introduces, 'metal');
  assert.deepEqual(levelMechanics(LEVELS[2]), []);            // màn 3 chưa có vật cản
  assert.deepEqual(levelMechanics(LEVELS[4]), ['crate']);     // màn 5 giới thiệu thùng
  assert.deepEqual(levelMechanics(LEVELS[8]), ['crate', 'metal']);
  const withTutorial = LEVELS.map((level, i) => (level.tutorial ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(withTutorial, [1, 2, 5, 8], 'chỉ màn 1–2 là tutorial; màn 5 và 8 chỉ có bong bóng giới thiệu cơ chế');
});

test('tutorial màn 1 và 2 chạy hết bằng session và thắng màn', () => {
  for (const index of [0, 1]) {
    const { s } = playTutorial(index);
    assert.equal(game.tutorialStep(s), null, `màn ${index + 1} kẹt ở bước tutorial`);
    assert.ok(s.over && s.outcome.win, `màn ${index + 1} phải thắng khi làm theo tutorial`);
    assert.equal(s.score, s.level.target);
  }
});

test('bước giới thiệu thùng gỗ (màn 5): gom sát thùng thì thùng vỡ', () => {
  const s = game.createSession(4, { rng: seeded(5) });
  game.continueTutorial(s); // bong bóng info
  const turn = game.place(s, 8);
  assert.ok(turn.ok);
  assert.equal(turn.gained, 30);
  assert.equal(turn.match.broken.length, 1);
});

test('tutorial chặn hành động sai bước: chưa tới bước xoay thì không cho gửi tạm', () => {
  const s = game.createSession(1, { rng: seeded(2) });
  assert.equal(game.hold(s).error, 'tutorial');
  assert.equal(game.place(s, 0).error, 'tutorial');
  assert.ok(game.rotate(s).ok);
});

test('gửi tạm: ô trống thì cất + bóc thẻ mới, ô có thẻ thì đổi chỗ', () => {
  const s = game.createSession(2, { rng: seeded(3) }); // màn 3: không tutorial
  const first = s.active;
  assert.ok(game.hold(s).ok);
  assert.equal(s.hold, first);
  const second = s.active;
  const swap = game.hold(s);
  assert.ok(swap.swapped);
  assert.equal(s.active, first);
  assert.equal(s.hold, second);
});

// Bàn dựng sẵn: 2 mèo cam ở ô 0–1, thẻ đang bóc là 1 mèo cam -> đặt ô 2 là gom 3 (+30).
function staged(levelIndex) {
  const s = game.createSession(levelIndex, { rng: seeded(9) });
  s.board = Array(BOARD.W * BOARD.H).fill(null);
  s.board[0] = { group: 'orange', locked: true }; s.board[1] = { group: 'orange', locked: true };
  s.active = { offsets: [[0, 0]], items: [{ group: 'orange', name: 'Orange cat' }] };
  return s;
}

test('đủ điểm thì thắng, số sao theo số lượt còn dư', () => {
  const s = staged(2);
  s.score = s.level.target - 30;
  const turn = game.place(s, 2);
  assert.ok(turn.win);
  assert.ok(s.over && s.outcome.win);
  assert.equal(s.outcome.stars, 3); // còn gần đủ lượt -> 3 sao
});

test('hết lượt mà chưa đủ điểm thì thua', () => {
  const s = staged(2);
  s.moves = 1;
  const turn = game.place(s, 10); // đặt chỗ không gom được
  assert.ok(turn.lose);
  assert.equal(s.outcome.reason, 'Out of moves!');
});

test('đặt vào ô đã có mèo thì báo lỗi, không mất lượt', () => {
  const s = staged(2);
  const moves = s.moves;
  const turn = game.place(s, 0);
  assert.equal(turn.ok, false);
  assert.ok(turn.error);
  assert.equal(s.moves, moves);
});

test('tiến độ: giữ sao tốt nhất, chỉ sao mới ra xu, mở khoá màn kế', () => {
  let progress = { stars: [] };
  let record = recordWin(progress, 0, 2);
  assert.equal(record.coins, 2 * ECONOMY.COINS_PER_STAR);
  progress = record.progress;
  record = recordWin(progress, 0, 1); // chơi lại được ít sao hơn
  assert.equal(record.coins, 0);
  assert.equal(record.progress.stars[0], 2);
  record = recordWin(record.progress, 0, 3);
  assert.equal(record.coins, ECONOMY.COINS_PER_STAR);
  assert.equal(unlockedCount(record.progress), 2);
});
