// Test độ khó thích ứng (adaptive.mjs): element, bản biến thể, nhận diện profile, ghi lần thử. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, parseBoard, boardSize } from './levels.mjs';
import { isPlainSquare } from './board-shapes.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE } from './scoring.mjs';
import { LAYOUTS } from './level-layouts.mjs';
import { elementCount, difficultyOf, buildVariant, planLevel, detectProfile, recordAttempt, startVisit, noteDwell, isAdaptive, tuneDealer, boosterTip } from './adaptive.mjs';

const fresh = () => ({ attempts: [], streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: 0 });
// Profile đã qua giai đoạn người mới: 10 lần thắng 2 sao ở các màn 6–15.
const veteran = () => ({ ...fresh(), attempts: Array.from({ length: 10 }, (_, i) => try_(5 + i, true, { stars: 2 })) });
function try_(level, win, extra = {}) {
  return { level, win, reason: win ? 'win' : 'moves', ratio: win ? 1 : 0.5, stars: win ? 2 : 0, boosters: 0, thinkMs: 3000, idleMs: 0, durationMs: 60000, profile: 'steady', shift: 0, mode: null, ...extra };
}
const withTries = (profile, ...tries) => ({ ...profile, attempts: [...profile.attempts, ...tries] });

test('nhãn độ khó theo số element: 0–1 Easy, 2–3 Medium, 4–5 Hard', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(difficultyOf), ['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
  assert.equal(elementCount(LEVELS[0]), 0);   // Hello, Kitty
  assert.equal(elementCount(LEVELS[8]), 5);   // Iron & Oak: lượt chật, 5 giống, thùng, kim loại, bàn 7×7
  assert.equal(elementCount(LEVELS[16]), 3);  // Divided: 6 giống, kim loại, bàn 8×7
});

test('mọi bản biến thể: bàn hợp lệ, không có sẵn cụm gom, đạt đúng số element khi tắt bớt', () => {
  LEVELS.forEach((base, i) => {
    for (let target = 0; target <= 5; target++) {
      const level = buildVariant(base, target);
      const board = parseBoard(level.board), { W, H } = boardSize(level.board);
      assert.ok(level.board.every(row => row.length === W) && W >= 6 && W <= 8 && H >= 6 && H <= 8, `màn ${i + 1} → ${target}: cỡ bàn`);
      assert.equal(clearMatches(board, W, H, MATCH_SIZE).cleared.length, 0, `màn ${i + 1} → ${target}`);
      assert.ok(level.moves > 0 && level.cats.length >= 2, `màn ${i + 1} → ${target}`);
      // Mèo trên bàn chỉ thuộc các giống của màn (bộ chia thẻ phát đúng các giống này).
      assert.ok([...level.board.join('')].every(ch => '.XM#'.includes(ch) || level.cats.includes(ch)), `màn ${i + 1} → ${target}`);
      // Hạ xuống Easy luôn ra bản cơ bản (0 element, bàn 6×6 vuông, không vật cản); các mức khác đúng số element.
      const toEasy = target <= 1 && target < elementCount(base);
      if (target <= elementCount(base)) assert.equal(elementCount(level), toEasy ? 0 : target, `màn ${i + 1} → ${target}`);
      if (toEasy) assert.ok(isPlainSquare(level.board) && !/[XM]/.test(level.board.join('')), `màn ${i + 1} → ${target}: Easy`);
    }
  });
});

test('màn có tutorial luôn chơi bản gốc, kể cả khi người chơi đang thua liên tục', () => {
  const losing = withTries(veteran(), ...Array.from({ length: 6 }, () => try_(4, false)));
  LEVELS.forEach((level, i) => {
    if (isAdaptive(level)) return;
    const plan = planLevel(losing, i);
    assert.equal(plan.level, level);
    assert.equal(plan.profile, 'tutorial');
  });
});

test('người mới: không đổi element; thua 2 lần ở cùng màn thì +2 lượt', () => {
  const plan = planLevel(fresh(), 2);
  assert.equal(plan.profile, 'onboarding');
  assert.equal(plan.level.moves, LEVELS[2].moves);
  const twice = withTries(fresh(), try_(2, false), try_(2, false));
  assert.equal(planLevel(twice, 2).level.moves, LEVELS[2].moves + 2);
});

test('đang vật lộn: mỗi lần thua bớt 1 element, tối đa 2', () => {
  let p = veteran();
  const counts = [];
  for (let i = 0; i < 4; i++) {
    const plan = planLevel(p, 17); // Iron Gate, 5 element
    counts.push(plan.count);
    p = recordAttempt(p, try_(17, false, { profile: plan.profile, shift: plan.shift })).profile;
  }
  assert.deepEqual(counts, [5, 5, 4, 3]);
  assert.equal(detectProfile(p, 17).id, 'frustrated'); // thua lần thứ 4 -> sắp bỏ game
});

test('sắp bỏ game: hạ về Easy, boss vẫn tối thiểu Medium, quà khi thắng, 3 màn sau tối đa Medium', () => {
  const losing = withTries(veteran(), ...Array.from({ length: 4 }, () => try_(17, false)));
  const plan = planLevel(losing, 17);
  assert.equal(plan.profile, 'frustrated');
  assert.equal(plan.difficulty, 'easy');
  assert.equal(planLevel(losing, 19).difficulty, 'medium'); // boss: không xuống dưới Medium
  assert.equal(planLevel(losing, 19).layout, '-2');        // vật cản thoáng nhất
  const won = recordAttempt(losing, try_(17, true, { profile: plan.profile, shift: plan.shift }));
  assert.equal(won.gift, true);
  assert.equal(won.profile.cooldown, 3);
  assert.ok(planLevel(won.profile, 8).count <= 2); // Iron & Oak gốc 4 element
});

test('thua sát nút: giữ độ khó, tới lần thứ 4 mới +2 lượt', () => {
  const near = n => withTries(veteran(), ...Array.from({ length: n }, () => try_(12, false, { ratio: 0.9 })));
  assert.equal(planLevel(near(2), 12).profile, 'near-miss');
  assert.equal(planLevel(near(2), 12).level.moves, LEVELS[12].moves);
  assert.equal(planLevel(near(4), 12).level.moves, LEVELS[12].moves + 2);
});

test('cao thủ: thắng 3 màn liền sạch sẽ thì +1 element, chỉ siết lượt / thêm màu', () => {
  const hot = withTries(veteran(), try_(10, true, { stars: 3 }), try_(11, true, { stars: 3 }), try_(12, true, { stars: 2 }));
  const plan = planLevel(hot, 15); // Crate Maze: 6 giống + crate + bàn tim = 3 element
  assert.equal(plan.profile, 'skilled');
  assert.equal(plan.count, 4);
  assert.ok(plan.level.moves < LEVELS[15].moves);
  // Bố trí "hiểm" sinh sẵn: nhiều thùng hơn bản gốc, giữ nguyên hình bàn và mèo đặt sẵn.
  assert.equal(plan.layout, '+1');
  assert.equal(plan.level.board.join(''), LAYOUTS[LEVELS[15].name]['+1'].join(''));
  const crates = rows => [...rows.join('')].filter(ch => ch === 'X').length;
  assert.ok(crates(plan.level.board) > crates(LEVELS[15].board));
});

test('chơi chán: đổi loại element (tắt vật cản, bật moves/màu), giữ số lượng', () => {
  const bored = withTries(veteran(), ...[10, 11, 12].map(l => try_(l, true, { stars: 3, dwellMs: 9000 })));
  const plan = planLevel(bored, 11); // Crate Scatter: màu + crate + bàn tam giác
  assert.equal(plan.profile, 'bored');
  assert.equal(plan.mode, 'swap');
  assert.equal(plan.count, elementCount(LEVELS[11]));
  assert.ok(!plan.level.board.join('').includes('X'));
});

test('quay lại sau 3 ngày: màn đầu bớt 1 element, chuỗi cũ bỏ qua', () => {
  const day = 24 * 3600 * 1000;
  const p = startVisit({ ...withTries(veteran(), try_(15, false), try_(15, false)), lastSeen: 1 }, 1 + 4 * day);
  const plan = planLevel(p, 17);
  assert.equal(plan.profile, 'returning');
  assert.equal(plan.count, elementCount(LEVELS[17]) - 1);
  const after = recordAttempt(p, try_(17, true, { profile: plan.profile, shift: plan.shift })).profile;
  assert.equal(after.warmup, false);
});

test('mỗi lần thử chỉ đổi tối đa 1 element so với lần trước', () => {
  // Lần trước +1 (cao thủ), giờ thua 3 lần: không nhảy thẳng xuống -2.
  const p = withTries(veteran(), try_(13, false, { shift: 1 }), try_(13, false, { shift: 1 }), try_(13, false, { shift: 1 }));
  assert.equal(planLevel(p, 13).shift, 0);
});

test('ghi thời gian đứng ở bảng kết quả vào lần thử vừa xong, chỉ một lần', () => {
  let p = recordAttempt(fresh(), try_(3, false)).profile;
  p = noteDwell(p, 9000);
  p = noteDwell(p, 100);
  assert.equal(p.attempts.at(-1).dwellMs, 9000);
});

test('cao thủ: chỉ cần thắng ngay lần đầu 3 màn Medium+ liền, không cần sao; thắng sau khi chơi lại thì không tính', () => {
  const easyOnly = withTries(veteran(), try_(9, false), try_(10, true, { count: 1 }), try_(11, true, { count: 1 }), try_(12, true, { count: 1 }));
  assert.equal(detectProfile(easyOnly, 13).id, 'steady');
  const oneStar = withTries(veteran(), try_(10, true, { stars: 1 }), try_(11, true, { stars: 1 }), try_(12, true, { stars: 1 }));
  assert.equal(detectProfile(oneStar, 13).id, 'skilled');
  // Màn 11 phải chơi lại mới thắng -> chuỗi sạch chỉ còn 2 (màn 11 thắng ở lần thử thứ hai không tính).
  const retried = withTries(veteran(), try_(10, false), try_(10, true), try_(11, true), try_(12, true));
  assert.equal(detectProfile(retried, 13).id, 'steady');
  const booster = withTries(veteran(), try_(10, true), try_(11, true, { boosters: 1 }), try_(12, true));
  assert.notEqual(detectProfile(booster, 13).id, 'skilled');
});

test('sắp bỏ game bật sớm: thua 3 lần kèm đứng lâu ở bảng thua, hoặc bỏ ngang sau khi đã thua', () => {
  const tilted = withTries(veteran(), try_(13, false), try_(13, false), try_(13, false, { dwellMs: 12000 }));
  assert.equal(detectProfile(tilted, 13).id, 'frustrated');
  const calm = withTries(veteran(), try_(13, false), try_(13, false), try_(13, false, { dwellMs: 2000 }));
  assert.equal(detectProfile(calm, 13).id, 'struggling');
  const quit = withTries(veteran(), try_(13, false), try_(13, false, { reason: 'quit' }));
  assert.equal(detectProfile(quit, 13).id, 'frustrated');
  // Bỏ ngang ngay lần đầu (ví dụ chơi lại vì thẻ đầu xấu) thì chưa tính.
  assert.notEqual(detectProfile(withTries(veteran(), try_(13, false, { reason: 'quit' })), 13).id, 'frustrated');
});

test('người mới thắng sạch liền vẫn được tăng khó; màn tutorial và màn Easy không tính; thua thì không bị nới', () => {
  // Màn 1, 2 là tutorial, màn 3 là Easy: chưa đủ bằng chứng là cao thủ.
  assert.equal(planLevel(withTries(fresh(), try_(0, true), try_(1, true), try_(2, true, { count: 0 })), 3).profile, 'onboarding');
  // Thắng sạch 3 màn Medium (màn 3, 4, 6; còn trong giai đoạn người mới vì mới 3 lần thử) -> tăng khó màn 7.
  const hot = withTries(fresh(), try_(2, true, { count: 2 }), try_(3, true, { count: 2 }), try_(5, true, { count: 2 }));
  assert.equal(detectProfile(hot, 6).id, 'skilled');
  const plan = planLevel(hot, 6); // Tight Crates: 2 element
  assert.equal(plan.count, 3);
  assert.equal(planLevel(withTries(fresh(), try_(3, false), try_(3, false)), 3).count, elementCount(LEVELS[3]));
});

test('người mong manh (từng bỏ ngang gần đây): thua 1 lần đã nới, thua 2 lần hạ về Easy, không giữ độ khó khi sát nút', () => {
  const fragile = withTries(veteran(), try_(9, false, { reason: 'quit' }), try_(9, true));
  const once = withTries(fragile, try_(13, false));
  assert.equal(detectProfile(once, 13).id, 'struggling');
  assert.equal(planLevel(once, 13).count, elementCount(LEVELS[13]) - 1);
  const nearTwice = withTries(fragile, try_(13, false, { ratio: 0.9 }), try_(13, false, { ratio: 0.9 }));
  assert.equal(detectProfile(nearTwice, 13).id, 'frustrated');
});

test('bộ chia thẻ: hết chỗ 2 lần thì thêm thẻ đôi, hết lượt 2 lần thì thêm thẻ 3 ô + assist, cao thủ thì thêm thẻ đơn − assist', () => {
  const base = LEVELS[16]; // Divided: shapes mặc định, assist 0.4
  assert.equal(tuneDealer(base, { stuck: 1 }).deal, null);
  const small = tuneDealer(base, { stuck: 2 }).level;
  assert.deepEqual(small.shapes, { single: 6, domino: 7, triple: 1 });
  assert.equal(small.board, base.board);   // không đổi bàn
  assert.equal(small.moves, base.moves);   // không đổi lượt
  assert.equal(tuneDealer(base, { moves: 2 }).level.assist, 0.5);
  assert.equal(tuneDealer(LEVELS[14], { moves: 2 }).level.shapes.triple, 2); // Open Field: không vật cản -> thẻ 3 ô
  assert.equal(tuneDealer(LEVELS[17], { moves: 2 }).level.shapes.domino, 7); // Iron Gate: 11 ô vật cản -> thẻ đôi
  assert.equal(tuneDealer(base, { moves: 9 }).level.assist, 0.6); // tối đa
  const hard = tuneDealer(base, { skilled: true }).level;
  assert.equal(hard.assist, 0.3);
  assert.equal(hard.shapes.single, 7);
});

test('planLevel đọc lý do thua ở chính màn đang chơi lại; màn tutorial không đổi bộ thẻ', () => {
  const stuck = withTries(veteran(), try_(16, false, { reason: 'stuck', ratio: 0.5 }), try_(16, false, { reason: 'stuck', ratio: 0.5 }));
  assert.match(planLevel(stuck, 16).deal, /domino/);
  const outOfMoves = withTries(veteran(), try_(16, false), try_(16, false));
  assert.match(planLevel(outOfMoves, 16).deal, /assist/);
  // Thua ở màn khác không tính cho màn này.
  assert.equal(planLevel(withTries(veteran(), try_(15, false, { reason: 'stuck' }), try_(15, false, { reason: 'stuck' })), 16).deal ?? null, null);
  assert.equal(planLevel(stuck, 4).level, LEVELS[4]);
});

test('chơi chán nhận ra sau 2 màn thắng sạch nếu kèm dấu hiệu lơ đãng; không có dấu hiệu thì không', () => {
  // Màn 11 là tutorial (không tính), nên dùng màn 12–13.
  const base = withTries(veteran(), try_(9, false));
  assert.equal(detectProfile(withTries(base, try_(11, true, { dwellMs: 9000 }), try_(12, true, { dwellMs: 9500 })), 13).id, 'bored');
  assert.notEqual(detectProfile(withTries(base, try_(11, true, { dwellMs: 2000 }), try_(12, true, { dwellMs: 2000 })), 13).id, 'bored');
});

test('booster không đổi thắng/thua; thua sát nút mà chưa dùng booster thì mời booster và giữ nguyên bộ thẻ', () => {
  const carried = { boosters: 1, boostUse: { hammer: 0, swap: 0, moves: 1 }, bought: 1, preBoostRatio: 0.5 };
  // Thắng nhờ +lượt vẫn là thắng: xoá chuỗi thua như mọi lần thắng.
  assert.equal(detectProfile(withTries(veteran(), try_(12, false), try_(12, false), try_(12, true, carried)), 13).id, 'steady');
  // Thua có dùng (và mua) booster vẫn chỉ là một lần thua.
  assert.equal(detectProfile(withTries(veteran(), try_(13, false, carried)), 13).id, 'steady');
  const near = withTries(veteran(), try_(13, false, { ratio: 0.9 }), try_(13, false, { ratio: 0.9 }));
  assert.equal(planLevel(near, 13).suggestBooster, true);
  assert.equal(planLevel(near, 13).deal, null);
  assert.deepEqual(planLevel(near, 13).level, { ...LEVELS[13] });
  assert.equal(boosterTip(near), true);
  const nearUsed = withTries(veteran(), try_(13, false, { ratio: 0.9 }), try_(13, false, { ratio: 0.9, boosters: 1 }));
  assert.equal(boosterTip(nearUsed), false);
});

test('bàn theo profile: Easy thu về 6×6 gọn không vật cản; cao thủ được bàn rộng có hình và thêm thùng', () => {
  // Màn 17 Divided (bàn 8×7 có tường kim loại): sắp bỏ game -> bàn 6×6 vuông, hết vật cản.
  const losing = withTries(veteran(), ...Array.from({ length: 4 }, () => try_(16, false)));
  const easy = planLevel(losing, 16);
  assert.equal(easy.difficulty, 'easy');
  assert.ok(isPlainSquare(easy.level.board));
  assert.ok(!/[XM]/.test(easy.level.board.join('')));
  // Màn 4 Triple Cards (6×6 vuông, không vật cản): biến thể khó nhất có bàn to hơn và thùng gỗ.
  const hard = buildVariant(LEVELS[3], 5);
  assert.ok(!isPlainSquare(hard.board));
  assert.ok(hard.board.join('').includes('X'));
  // Mở rộng bàn không làm mất mèo đặt sẵn.
  const cats = rows => [...rows.join('')].filter(ch => /[OGWKST]/.test(ch)).length;
  assert.equal(cats(buildVariant(LEVELS[3], 3).board), cats(LEVELS[3].board));
});

test('bố trí crate/wall theo profile: vật lộn -> nhẹ, sát nút giữ đúng bàn, mỗi lần dịch một mức', () => {
  const struggling = withTries(veteran(), try_(9, false), try_(9, false));
  const easier = planLevel(struggling, 9); // Garden Fortress (boss)
  assert.equal(easier.layout, '-1');
  const count = rows => [...rows.join('')].filter(c => c === 'X' || c === 'M').length;
  assert.ok(count(easier.level.board) < count(LEVELS[9].board));
  // Hình bàn và mèo đặt sẵn không đổi.
  const shape = rows => rows.join('').replace(/[XM]/g, '.');
  assert.equal(shape(easier.level.board), shape(LEVELS[9].board));
  // Sát nút sau khi chơi bản '-1': giữ bản '-1'.
  const near = withTries(veteran(), try_(9, false, { ratio: 0.9, layout: '-1' }), try_(9, false, { ratio: 0.9, layout: '-1' }));
  assert.equal(planLevel(near, 9).layout, '-1');
  // Lần trước '+1', giờ vật lộn -> về '0' chứ chưa xuống '-1'.
  assert.equal(planLevel(withTries(veteran(), try_(9, false, { layout: '+1' }), try_(9, false, { layout: '+1' })), 9).layout, '0');
  // Mọi bản sinh sẵn: không có cụm gom sẵn, giữ hình bàn và mèo.
  for (const [name, tiers] of Object.entries(LAYOUTS)) {
    const base = LEVELS.find(l => l.name === name);
    for (const rows of Object.values(tiers)) {
      const { W, H } = boardSize(rows);
      assert.equal(clearMatches(parseBoard(rows), W, H, MATCH_SIZE).cleared.length, 0, name);
      assert.equal(shape(rows), shape(base.board), name);
    }
  }
});
