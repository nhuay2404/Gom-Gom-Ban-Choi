// Test luật một ván (session.mjs) + dữ liệu 40 màn + tiến độ. Chạy: npm test
// Khi port sang Unity: dịch file này sang NUnit, chạy trên Core C# — qua hết là luật khớp bản web.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from './session.mjs';
import { LEVELS } from '../data/levels.mjs';
import { parseBoard, parseCard } from './level-rules.mjs';
import { boardSize } from './board-shapes.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE, POINTS_PER_CRATE } from './scoring.mjs';
import { recordWin, unlockedCount, levelReward, earnedCoins, levelTier, levelMechanics } from './progression.mjs';
import { HOLD } from '../data/tuning.mjs';

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
  assert.equal(LEVELS.length, 100);
  LEVELS.forEach((level, i) => {
    const board = parseBoard(level.board), { W, H } = boardSize(level.board);
    assert.ok(level.board.every(row => row.length === W), `màn ${i + 1}: các hàng cùng độ dài`);
    assert.ok(W >= 6 && W <= 8 && H >= 6 && H <= 8, `màn ${i + 1}: cỡ bàn ${W}×${H}`);
    assert.equal(clearMatches(board, W, H, MATCH_SIZE).cleared.length, 0, `màn ${i + 1} có sẵn cụm`);
    (level.deck || []).forEach(spec => assert.ok(parseCard(spec).items.every(item => item.group), `màn ${i + 1} thẻ ${spec}`));
    assert.ok(['chill', 'normal', 'hard', 'boss'].includes(levelTier(level)), `màn ${i + 1} tier`);
  });
});

test('nhịp tiến trình: tutorial ở màn 1–2 và 11 (Hold) (+ bong bóng giới thiệu cơ chế); từ màn 11 mỗi chương: hard x5, nghỉ x6, boss x0; màn đầu chương giới thiệu cơ chế mới là chill', () => {
  assert.equal(levelTier(LEVELS[9]), 'boss');
  assert.equal(levelTier(LEVELS[19]), 'boss');
  assert.equal(levelTier(LEVELS[7]), 'chill');
  for (let start = 10; start < LEVELS.length; start += 10) {
    const tiers = LEVELS.slice(start, start + 10).map(levelTier);
    // Màn x1 giới thiệu cơ chế mới (Hold ở màn 11, cỏ ở màn 21) là màn nghỉ để người chơi làm quen; còn lại là normal.
    const first = LEVELS[start].introduces ? 'chill' : 'normal';
    assert.deepEqual(tiers, [first, 'normal', 'normal', 'normal', 'hard', 'chill', 'normal', 'normal', 'normal', 'boss'], `chương màn ${start + 1}–${start + 10}`);
  }
  assert.equal(LEVELS[4].introduces, 'crate');
  assert.equal(LEVELS[7].introduces, 'metal');
  assert.deepEqual(levelMechanics(LEVELS[2]), []);            // màn 3 chưa có vật cản
  assert.deepEqual(levelMechanics(LEVELS[4]), ['crate']);     // màn 5 giới thiệu thùng
  assert.deepEqual(levelMechanics(LEVELS[8]), ['crate', 'metal']);
  const withTutorial = LEVELS.map((level, i) => (level.tutorial ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(withTutorial, [1, 2, 5, 8, 11, 21], 'màn 1–2 và 11 là tutorial; màn 5, 8, 21 chỉ có bong bóng giới thiệu cơ chế');
  // Cỏ giới thiệu ở màn 21 (đầu chương 3).
  assert.equal(LEVELS[20].introduces, 'grass');
  assert.equal(LEVELS.findIndex(level => levelMechanics(level).includes('grass')), 20);
  // Chuồng mèo giới thiệu ở màn 11 (cùng màn mở Hold), bong bóng giải thích sau phần Hold.
  assert.ok(LEVELS[10].tutorial.some(step => step.type === 'info' && /cage/i.test(step.text)));
  const caged = LEVELS.map((level, i) => (levelMechanics(level).includes('cage') ? i + 1 : null)).filter(Boolean);
  assert.equal(caged[0], 11);
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
  const s = staged(11);
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

test('booster: búa đập sạch 3×3 (mèo, chuồng, thùng, kim loại), điểm như gom; đổi thẻ cho 3 thẻ có lợi nhất, giữ thẻ sắp tới; thêm lượt', () => {
  const s = game.createSession(5, { rng: seeded(7) });
  s.grass = null; s.W = 6; s.H = 6; // bàn thử 6×6 (màn 6 có thể khác cỡ)
  s.board = parseBoard(['OO....', 'XM....', '......', '......', '......', '......']);
  s.board[2] = { group: 'white', locked: true, cage: 1 };
  s.board[6 * 6 - 1] = { block: true, metal: true, void: true };
  const score = s.score, hit = game.smash(s, 1);
  assert.ok(hit.ok);
  assert.deepEqual([0, 1, 2, 6, 7, 8].map(i => s.board[i]), Array(6).fill(null));
  assert.equal(hit.points, 20 + 10 * 3); // 2 mèo cam = cụm 2 (20) + thùng + kim loại + chuồng
  assert.equal(s.score, score + hit.points);
  assert.equal(game.smash(s, 30).ok, false, 'vùng trống thì không đập');
  assert.equal(game.smash(s, 35).ok, false, 'ô ngoài bàn không đập');

  // Đổi thẻ: thẻ mới gom được ngay; 2 thẻ bóc sau cũng là thẻ may mắn; thẻ "sắp tới" giữ nguyên rồi ra sau.
  s.board = parseBoard(['OO....', '......', '......', '......', '.GG...', '......']);
  const next = game.upcoming(s)[0], moves = s.moves;
  assert.ok(game.swapCard(s).ok);
  assert.ok(game.matchesSomewhere(s.board, s.W, s.H, s.active));
  assert.equal(s.lucky, 2);
  assert.equal(game.upcoming(s)[0], next);
  game.drawCard(s); game.drawCard(s);
  assert.equal(s.lucky, 0);
  assert.equal(game.drawCard(s), next);
  assert.ok(game.addMoves(s, 3).ok);
  assert.equal(s.moves, moves + 3);
});

test('booster: kho mặc định, dùng, mua bằng xu', async () => {
  const { loadBoosters, spendBooster, buyBooster, boostersUnlocked } = await import('./boosters.mjs');
  const { BOOSTERS } = await import('../data/tuning.mjs');
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
  const { CAGE } = await import('../data/tuning.mjs');
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
  // Không đặt thẻ lên chuồng được; búa đập luôn cả mèo trong chuồng.
  s.board[20] = { group: 'white', locked: true, cage: 1 };
  s.active = { offsets: [[0, 0]], items: [{ group: 'white', name: 'White cat' }] };
  assert.equal(game.place(s, 20).ok, false);
  const smashed = game.smash(s, 20);
  assert.ok(smashed.ok);
  assert.equal(s.board[20], null);
});

test('màn có chuồng: đủ điểm mà còn mèo bị nhốt thì chưa thắng; bẻ hết khóa mới qua màn', () => {
  const s = game.createSession(2, { rng: seeded(9) });
  s.board = parseBoard(['OO.o..', '......', '......', '......', '......', '......']);
  s.board[20] = { group: 'white', locked: true, cage: 1 };
  s.level = { ...s.level, target: 1 };
  s.active = { offsets: [[0, 0]], items: [{ group: 'orange', name: 'Orange cat' }] };
  const turn = game.place(s, 2); // gom cam: đủ điểm, chuồng cam vỡ nhưng chuồng trắng còn
  assert.ok(s.score >= 1);
  assert.equal(turn.win, false);
  assert.equal(s.over, false);
  const smashed = game.smash(s, 20); // búa đập nốt chuồng cuối: thắng ngay
  assert.ok(smashed.win);
  assert.equal(s.outcome.win, true);
});

test('cỏ: cùng cỡ bàn, chỉ nằm dưới mèo / ô trống; gom trên cỏ thì dọn cỏ; màn có cỏ thắng khi hết cỏ VÀ đủ điểm', () => {
  LEVELS.forEach((level, i) => {
    if (!level.grass) return;
    const { W, H } = boardSize(level.board);
    assert.ok(level.grass.length === H && level.grass.every(row => row.length === W && /^[.~]+$/.test(row)), `màn ${i + 1}: cỡ lớp cỏ`);
    [...level.grass.join('')].forEach((ch, k) => { if (ch === '~') assert.ok(!'XM#'.includes(level.board.join('')[k]), `màn ${i + 1}: cỏ dưới vật cản ô ${k}`); });
  });
  const s = staged(20);
  s.tutorial = null; // bỏ bong bóng giới thiệu của màn 21
  s.grass = Array(s.W * s.H).fill(false);
  s.grass[0] = s.grass[1] = s.grass[2] = s.grass[9] = true;
  s.grassTotal = 4;
  s.score = 0;
  const turn = game.place(s, 2);
  assert.deepEqual([...turn.cleaned].sort((a, b) => a - b), [0, 1, 2]);
  assert.equal(game.grassLeft(s), 1);
  assert.ok(!turn.win);
  s.grass[9] = false;
  assert.ok(!game.goalReached(s), 'hết cỏ mà chưa đủ điểm thì chưa thắng');
  s.score = s.level.target;
  assert.ok(game.goalReached(s), 'hết cỏ + đủ điểm là thắng');
  s.grass[9] = true;
  assert.ok(!game.goalReached(s), 'đủ điểm mà còn cỏ thì chưa thắng');
  s.grass[9] = false;
  // Màn không có cỏ: vẫn theo điểm.
  const plain = staged(3);
  assert.equal(plain.grass, null);
  assert.ok(!game.goalReached(plain));
});

test('xả lượt: còn N lượt thì bàn mọc câu đố, AI giải đúng N lượt là sạch mèo; hết lượt mà còn mèo thì chơi tiếp tới sạch', () => {
  const run = (rows, moves, seed) => {
    const s = game.createSession(5, { rng: seeded(seed) });
    s.grass = null; s.W = 6; s.H = 6;
    s.board = parseBoard(rows);
    s.outcome = { win: true, stars: 2 }; s.over = true; s.moves = moves;
    let turns = 0, extra = 0;
    for (let turn = game.finaleTurn(s); turn.ok; turn = game.finaleTurn(s)) { turns++; if (turn.extra) extra++; assert.ok(turn.gained > 0); assert.ok(turns < 100); }
    assert.ok(!s.board.some(o => o?.group && !o.cage), 'sạch mèo');
    assert.equal(s.outcome.stars, 2);
    return { turns, extra, moves: s.moves };
  };
  assert.equal(game.finaleTurn({ ...game.createSession(5), outcome: null }).ok, false, 'chưa thắng thì không xả');
  for (const seed of [1, 2, 3]) {
    const few = run(['O.....', '......', '..G...', '......', '....W.', '......'], 12, seed);
    assert.deepEqual([few.turns, few.extra, few.moves], [12, 0, 0], 'bàn ít mèo: mọc thêm, đúng 12 lượt');
    const many = run(['O.O.O.', '......', 'G.G.G.', '......', 'W.W.W.', '......'], 1, seed);
    assert.equal(many.moves, 0);
    assert.ok(many.extra >= 1, 'hết lượt vẫn chơi tiếp tới sạch');
  }
  const tight = run(['MMMMMM', 'MMMMMM', 'MM..MM', 'MMMMMM', 'MMMMMM', 'MMMMMM'], 5, 1);
  assert.deepEqual([tight.turns, tight.moves], [5, 0], 'bàn kín vật cản chỉ còn 2 ô: vẫn xả đủ lượt (mèo lẻ tự nổ)');
});
