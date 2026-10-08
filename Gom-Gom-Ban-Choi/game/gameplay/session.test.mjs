// Test luật một ván (session.mjs) + dữ liệu 40 màn + tiến độ. Chạy: npm test
// Khi port sang Cocos: chuyển nguyên file này sang TS, chạy trên core/ mới — qua hết là luật khớp bản web.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from './session.mjs';
import { LEVELS, parseBoard, parseCard, boardSize } from './levels.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE, POINTS_PER_CRATE } from './scoring.mjs';
import { recordWin, unlockedCount, levelReward, earnedCoins, levelTier, levelMechanics } from './progression.mjs';
import { ECONOMY, HOLD } from './tuning.mjs';

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

test('mọi màn: bàn chữ nhật 6×6 tới 8×8, không có sẵn cụm gom được, thẻ kịch bản hợp lệ, có tier hợp lệ', () => {
  assert.equal(LEVELS.length, 40);
  LEVELS.forEach((level, i) => {
    const board = parseBoard(level.board), { W, H } = boardSize(level.board);
    assert.ok(level.board.every(row => row.length === W), `màn ${i + 1}: các hàng cùng độ dài`);
    assert.ok(W >= 6 && W <= 8 && H >= 6 && H <= 8, `màn ${i + 1}: cỡ bàn ${W}×${H}`);
    assert.equal(clearMatches(board, W, H, MATCH_SIZE).cleared.length, 0, `màn ${i + 1} có sẵn cụm`);
    (level.deck || []).forEach(spec => assert.ok(parseCard(spec).items.every(item => item.group), `màn ${i + 1} thẻ ${spec}`));
    assert.ok(['chill', 'normal', 'hard', 'boss'].includes(levelTier(level)), `màn ${i + 1} tier`);
  });
});

test('nhịp tiến trình: tutorial ở màn 1–2 và 11 (Hold) (+ bong bóng giới thiệu cơ chế), boss ở 10 và 20, nghỉ ở 8 và 19', () => {
  assert.equal(levelTier(LEVELS[9]), 'boss');
  assert.equal(levelTier(LEVELS[19]), 'boss');
  assert.equal(levelTier(LEVELS[7]), 'chill');
  assert.equal(levelTier(LEVELS[18]), 'chill');
  [29, 39].forEach(i => assert.equal(levelTier(LEVELS[i]), 'boss', `màn ${i + 1} là boss`));
  [26, 36].forEach(i => assert.equal(levelTier(LEVELS[i]), 'chill', `màn ${i + 1} là màn nghỉ`));
  assert.equal(LEVELS[4].introduces, 'crate');
  assert.equal(LEVELS[7].introduces, 'metal');
  assert.deepEqual(levelMechanics(LEVELS[2]), []);            // màn 3 chưa có vật cản
  assert.deepEqual(levelMechanics(LEVELS[4]), ['crate']);     // màn 5 giới thiệu thùng
  assert.deepEqual(levelMechanics(LEVELS[8]), ['crate', 'metal']);
  const withTutorial = LEVELS.map((level, i) => (level.tutorial ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(withTutorial, [1, 2, 5, 8, 11, 15], 'màn 1–2 và 11 là tutorial; màn 5, 8, 15 chỉ có bong bóng giới thiệu cơ chế');
  // Chuồng mèo giới thiệu ở màn 15, các màn sau (trừ màn nghỉ 19) đều có chuồng.
  assert.equal(LEVELS[14].introduces, 'cage');
  const caged = LEVELS.map((level, i) => (levelMechanics(level).includes('cage') ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(caged.filter(n => n <= 20), [15, 16, 17, 18, 20]);
  assert.ok(caged.filter(n => n > 20).length >= 10, "chương 3–4: phần lớn màn có chuồng");
  assert.equal(LEVELS[HOLD.UNLOCK_LEVEL - 1].introduces, 'hold');
  // Màn đầu 6×6; chương 2 đa số bàn to / có hình.
  const big = LEVELS.map((level, i) => (boardSize(level.board).W > 6 ? i + 1 : null)).filter(Boolean);
  assert.ok(big.filter(n => n > 10).length >= 8 && big.filter(n => n <= 5).length === 0, `bàn to ở màn ${big}`);
});

test('tutorial màn 11 (mở Hold) chạy hết bằng session', () => {
  const { s } = playTutorial(10); // chỉ cất thẻ rồi lấy lại, sau đó người chơi tự chơi
  assert.equal(game.tutorialStep(s), null);
  assert.ok(!s.over);
});

test('tutorial màn 1 (một lần kéo) và 2 (chỉ xoay) chạy hết bằng session, phần còn lại tự chơi vẫn thắng màn', () => {
  // Các ô gom còn lại sau tutorial (trước đây là các bước tutorial cuối).
  for (const [index, anchors] of [[0, [27]], [1, [6, 27, 5]]]) {
    const { s } = playTutorial(index);
    assert.equal(game.tutorialStep(s), null, `màn ${index + 1} kẹt ở bước tutorial`);
    assert.ok(!s.over, `màn ${index + 1}: tutorial xong chưa thắng`);
    anchors.forEach(anchor => assert.ok(game.place(s, anchor).ok, `màn ${index + 1}: tự chơi ô ${anchor}`));
    assert.ok(s.over && s.outcome.win, `màn ${index + 1} phải thắng`);
    assert.equal(s.score, s.level.target);
  }
});

test('bước giới thiệu thùng gỗ (màn 5): gom sát thùng thì thùng vỡ, thùng vỡ cũng ra điểm', () => {
  const s = game.createSession(4, { rng: seeded(5) });
  const turn = game.place(s, 8);
  assert.ok(turn.ok);
  assert.equal(turn.gained, 30 + POINTS_PER_CRATE); // cụm 3 + một thùng
  assert.equal(turn.match.broken.length, 1);
});

test('tutorial chặn hành động sai bước: chưa tới bước xoay thì không cho đặt; bước info thì không cho gửi tạm', () => {
  const s = game.createSession(1, { rng: seeded(2) });
  assert.equal(game.place(s, 0).error, 'tutorial');
  assert.ok(game.rotate(s).ok);
  const hold = game.createSession(10, { rng: seeded(2) });
  assert.equal(game.place(hold, 12).error, 'tutorial'); // bước đầu của màn 11 là gửi tạm, chưa cho đặt
});

test('ô Hold chỉ mở từ màn HOLD.UNLOCK_LEVEL; trước đó thẻ không vừa bàn là kẹt luôn', () => {
  for (let i = 0; i < HOLD.UNLOCK_LEVEL - 1; i++) assert.equal(game.createSession(i).holdOn, false, `màn ${i + 1}`);
  const s = game.createSession(2, { rng: seeded(3) });
  assert.equal(game.hold(s).ok, false);
  s.board = s.board.map(() => ({ group: 'gray', locked: true }));
  assert.ok(game.checkStuck(s));
  const later = game.createSession(11, { rng: seeded(3) });
  later.board = later.board.map(cell => cell ?? { group: 'gray', locked: true });
  assert.equal(game.checkStuck(later), false, 'có Hold: ô Hold trống thì vẫn còn đường cất thẻ');
});

test('gửi tạm: ô trống thì cất + bóc thẻ mới, ô có thẻ thì đổi chỗ', () => {
  const s = game.createSession(11, { rng: seeded(3) }); // màn 12: đã mở Hold, không tutorial
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
  s.board = Array(s.W * s.H).fill(null);
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

test('tiến độ: giữ sao tốt nhất, xu chỉ ra ở lần thắng đầu, mở khoá màn kế', () => {
  let progress = { stars: [] };
  let record = recordWin(progress, 0, 2);
  assert.equal(record.coins, levelReward(0));
  progress = record.progress;
  record = recordWin(progress, 0, 1); // chơi lại được ít sao hơn
  assert.equal(record.coins, 0);
  assert.equal(record.progress.stars[0], 2);
  record = recordWin(record.progress, 0, 3); // thêm sao cũng không ra thêm xu
  assert.equal(record.coins, 0);
  assert.equal(unlockedCount(record.progress), 2);
  assert.equal(earnedCoins(record.progress), levelReward(0));
});

test('booster: búa đập mèo/thùng, không đập kim loại/ô trống; đổi thẻ giữ thẻ sắp tới; thêm lượt', () => {
  const s = game.createSession(5, { rng: seeded(7) });
  const crate = s.board.findIndex(o => o?.block && !o.metal);
  assert.ok(crate >= 0, 'màn 6 có thùng');
  assert.ok(game.smash(s, crate).ok);
  assert.equal(s.board[crate], null);
  const empty = s.board.findIndex(o => !o);
  assert.equal(game.smash(s, empty).ok, false);
  s.board[empty] = { block: true, metal: true };
  assert.equal(game.smash(s, empty).ok, false);
  assert.ok(s.board[empty].metal);

  const next = game.upcoming(s)[0], moves = s.moves;
  assert.ok(game.swapCard(s).ok);
  assert.equal(game.upcoming(s)[0], next);
  assert.ok(game.addMoves(s, 3).ok);
  assert.equal(s.moves, moves + 3);
});

test('booster: kho mặc định, dùng, mua bằng xu', async () => {
  const { loadBoosters, spendBooster, buyBooster, boostersUnlocked } = await import('./boosters.mjs');
  const { BOOSTERS } = await import('./tuning.mjs');
  const stock = loadBoosters();
  assert.deepEqual(stock, { hammer: BOOSTERS.START_STOCK, swap: BOOSTERS.START_STOCK, moves: BOOSTERS.START_STOCK });
  assert.equal(spendBooster({ ...stock, hammer: 0 }, 'hammer'), null);
  assert.equal(spendBooster(stock, 'hammer').hammer, BOOSTERS.START_STOCK - 1);
  assert.ok(buyBooster(stock, BOOSTERS.PRICE.swap - 1, 'swap').error);
  assert.deepEqual(buyBooster(stock, 100, 'swap').coins, 100 - BOOSTERS.PRICE.swap);
  assert.equal(boostersUnlocked(1), false);
  assert.equal(boostersUnlocked(2), true);
});

test('chuồng mèo: không gom được, gom sát bên một lần là bẻ khóa và thả mèo; búa mở chuồng ngay', async () => {
  const { CAGE } = await import('./tuning.mjs');
  assert.equal(CAGE.LOCKS, 1);
  // Hàng: [cam][cam][ ][cam-trong-chuồng] — đặt cam vào ô trống: chỉ 3 con ngoài chuồng được gom, chuồng vỡ ngay (1 khóa).
  const s = game.createSession(2, { rng: seeded(9) });
  s.board = parseBoard(['OO.o..', '......', '......', '......', '......', '......']);
  assert.equal(s.board[3].cage, 1);
  s.active = { offsets: [[0, 0]], items: [{ group: 'orange', name: 'Orange cat' }] };
  const turn = game.place(s, 2);
  assert.deepEqual(turn.match.cleared.sort((a, b) => a - b), [0, 1, 2]);
  assert.deepEqual(turn.match.freed, [3]);
  assert.equal(s.board[3].group, 'orange');
  assert.ok(!s.board[3].cage);
  // Không đặt thẻ lên chuồng được; búa mở chuồng.
  s.board[20] = { group: 'white', locked: true, cage: 1 };
  s.active = { offsets: [[0, 0]], items: [{ group: 'white', name: 'White cat' }] };
  assert.equal(game.place(s, 20).ok, false);
  const smashed = game.smash(s, 20);
  assert.ok(smashed.ok && smashed.freed);
  assert.equal(s.board[20].group, 'white');
  assert.ok(!s.board[20].cage);
});
