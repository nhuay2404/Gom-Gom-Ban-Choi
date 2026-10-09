// Test độ khó thích ứng (adaptive.mjs): DDA không đụng thiết kế / số lượt, chỉ bố trí mèo + hàng thẻ; nhận diện profile;
// chơi lại giữ bố trí; thẻ đầu luôn gom được. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, parseBoard, boardSize } from './levels.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE } from './scoring.mjs';
import { ADAPTIVE } from './tuning.mjs';
import { createSession, matchesSomewhere, openingCard } from './session.mjs';
import { CAT_LAYOUTS } from './cat-layouts.mjs';
import {
  elementCount, difficultyOf, planLevel, detectProfile, recordAttempt, startVisit, noteDwell, isAdaptive, tuneDealer, boosterTip,
  pickCatLayout, nudgeCats, playableLayout, sameDesign, variantFor, mulberry32, SHIFT_MIN, SHIFT_MAX,
} from './adaptive.mjs';

const fresh = () => ({ attempts: [], streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: 0 });
// Profile đã qua giai đoạn người mới: 10 lần thắng 2 sao ở các màn 6–15.
const veteran = () => ({ ...fresh(), attempts: Array.from({ length: 10 }, (_, i) => try_(5 + i, true, { stars: 2 })) });
function try_(level, win, extra = {}) {
  return { level, win, reason: win ? 'win' : 'moves', ratio: win ? 1 : 0.5, stars: win ? 2 : 0, boosters: 0, thinkMs: 3000, idleMs: 0, durationMs: 60000, profile: 'steady', shift: 0, mode: null, ...extra };
}
const withTries = (profile, ...tries) => ({ ...profile, attempts: [...profile.attempts, ...tries] });
const losing = (level, n) => withTries(veteran(), ...Array.from({ length: n }, () => try_(level, false)));
const hot = () => withTries(veteran(), try_(10, true, { stars: 3 }), try_(11, true, { stars: 3 }), try_(12, true, { stars: 2 }));
const designKeys = ['name', 'tier', 'moves', 'target', 'cats', 'deck', 'tutorial', 'introduces', 'expand'];
const adaptiveLevels = LEVELS.map((level, i) => i).filter(i => isAdaptive(LEVELS[i]));

test('nhãn độ khó theo số element (tính trên thiết kế): 0–1 Easy, 2–3 Medium, 4–5 Hard', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(difficultyOf), ['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
  assert.equal(elementCount(LEVELS[0]), 0);
});

test('DDA không bao giờ đổi thiết kế: hình bàn, vật cản, chuồng, số mèo mỗi giống, lượt, mục tiêu, giống mèo', () => {
  const profiles = [fresh(), veteran(), hot(), startVisit({ ...veteran(), lastSeen: 1 }, 1 + 5 * 86400000)];
  LEVELS.forEach((base, i) => {
    for (const profile of [...profiles, losing(i, 2), losing(i, 4)]) {
      const plan = planLevel(profile, i);
      assert.ok(sameDesign(plan.level.board, base.board), `màn ${i + 1} (${plan.profile}): thiết kế bàn`);
      for (const key of designKeys) assert.deepEqual(plan.level[key], base[key], `màn ${i + 1} (${plan.profile}): ${key}`);
      const { W, H } = boardSize(plan.level.board);
      assert.equal(clearMatches(parseBoard(plan.level.board), W, H, MATCH_SIZE).cleared.length, 0, `màn ${i + 1}: có sẵn cụm gom`);
      assert.equal(plan.count, elementCount(base));
    }
  });
});

test('bố trí mèo đo sẵn (cat-layouts.mjs): đúng thiết kế, không có sẵn cụm gom, chọn đúng mức, lùi về 0 khi thiếu', () => {
  for (const [name, table] of Object.entries(CAT_LAYOUTS)) {
    const base = LEVELS.find(l => l.name === name);
    if (!base) continue; // màn đã đổi tên: adaptive.mjs không dùng tới
    for (const [shift, list] of Object.entries(table)) {
      assert.ok(Number(shift) >= SHIFT_MIN && Number(shift) <= SHIFT_MAX, name);
      for (const rows of list) {
        if (!sameDesign(rows, base.board)) continue; // màn bị sửa sau khi sinh: pickCatLayout bỏ qua
        assert.ok(playableLayout(rows), `${name} ${shift}`);
      }
    }
  }
  // Bảng giả: chỉ có mức -1 và 0.
  const base = LEVELS[20], alt = nudgeCats(base.board, mulberry32(5));
  CAT_LAYOUTS.__test = { '-1': [alt], 0: [alt] };
  const fake = { ...base, name: '__test' };
  assert.deepEqual(pickCatLayout(fake, -2, 1), alt); // -2 chưa có -> lùi về -1
  assert.equal(pickCatLayout(fake, 1, 1), fake.board); // +1 chưa có -> thiết kế
  assert.equal(pickCatLayout(fake, 0, 1), fake.board);
  assert.deepEqual(pickCatLayout(fake, 0, 1, { swap: true }), alt);
  assert.equal(pickCatLayout({ ...base, name: '__none' }, -2, 1), base.board);
  delete CAT_LAYOUTS.__test;
  // Ứng viên chỉ xê dịch mèo tự do.
  for (const i of adaptiveLevels) {
    const rows = nudgeCats(LEVELS[i].board, mulberry32(i));
    if (rows) assert.ok(sameDesign(rows, LEVELS[i].board) && playableLayout(rows), `màn ${i + 1}`);
  }
});

test('màn tutorial luôn chơi đúng thiết kế', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    if (isAdaptive(LEVELS[i])) continue;
    for (const profile of [fresh(), hot(), losing(i, 4)]) assert.equal(planLevel(profile, i).level, LEVELS[i], `màn ${i + 1}`);
  }
});

test('thua rồi chơi lại: giữ nguyên bố trí lần trước, chỉ hàng thẻ thay đổi; thắng rồi vào lại thì xếp mới', () => {
  let p = veteran();
  const first = planLevel(p, 14);
  const boards = [first.layout];
  for (let n = 0; n < 3; n++) {
    p = recordAttempt(p, try_(14, false, { profile: 'x', shift: planLevel(p, 14).shift, layout: planLevel(p, 14).layout })).profile;
    const plan = planLevel(p, 14);
    assert.equal(plan.retry, true);
    boards.push(plan.layout);
  }
  boards.forEach(rows => assert.deepEqual(rows, first.layout));
  // Hàng thẻ nhẹ dần theo số lần thua (hết lượt -> assist tăng).
  assert.match(planLevel(p, 14).deal, /assist/);
  // Bố trí đã lưu không còn đúng thiết kế (màn bị sửa) thì bỏ, xếp mới.
  const stale = withTries(veteran(), try_(14, false, { layout: LEVELS[15].board }));
  assert.equal(planLevel(stale, 14).retry, false);
  const won = recordAttempt(p, try_(14, true, { layout: first.layout })).profile;
  assert.equal(planLevel(won, 14).retry, false);
});

test('vật lộn: dễ hơn 1 rồi 2 mức (bố trí dễ hơn + hàng thẻ nhẹ hơn); sắp bỏ: dễ nhất, boss chỉ nới 1 mức, quà khi thắng', () => {
  const twice = losing(16, 2), plan = planLevel(withTries(veteran(), try_(15, false), try_(15, false)), 16);
  assert.equal(detectProfile(twice, 16).id, 'struggling');
  assert.equal(plan.shift, -1);
  assert.ok(sameDesign(plan.layout, LEVELS[16].board));
  assert.ok(plan.level.assist > (LEVELS[16].assist ?? 0.3));
  const frustrated = losing(14, 4);
  assert.equal(planLevel(frustrated, 14).profile, 'frustrated');
  assert.equal(planLevel(frustrated, 14).shift, -2);
  assert.equal(planLevel(frustrated, 19).shift, -1); // boss
  const won = recordAttempt(frustrated, try_(14, true, { profile: 'frustrated', shift: -2 }));
  assert.equal(won.gift, true);
  assert.equal(won.profile.cooldown, 3);
  assert.ok(planLevel(hot(), 17).shift > 0 && planLevel({ ...hot(), cooldown: 2 }, 17).shift === 0);
});

test('thua sát nút: giữ độ khó, mời booster; tới lần thứ 4 hàng thẻ nhẹ đi một mức; không bao giờ cộng lượt', () => {
  const near = n => withTries(veteran(), ...Array.from({ length: n }, () => try_(12, false, { ratio: 0.9 })));
  assert.equal(planLevel(near(2), 12).profile, 'near-miss');
  assert.equal(planLevel(near(2), 12).shift, 0);
  assert.equal(planLevel(near(2), 12).suggestBooster, true);
  assert.equal(planLevel(near(2), 12).deal, null);
  assert.equal(planLevel(near(4), 12).shift, -1);
  for (const n of [2, 4]) assert.equal(planLevel(near(n), 12).level.moves, LEVELS[12].moves);
  assert.equal(boosterTip(near(2)), true);
  assert.equal(boosterTip(withTries(veteran(), try_(13, false, { ratio: 0.9 }), try_(13, false, { ratio: 0.9, boosters: 1 }))), false);
});

test('cao thủ: khó hơn bằng bố trí rời rạc hơn + nhiều thẻ đơn, ít assist; không đổi lượt', () => {
  const plan = planLevel(hot(), 17);
  assert.equal(plan.profile, 'skilled');
  assert.equal(plan.shift, 1);
  const harder = CAT_LAYOUTS[LEVELS[17].name]?.['1'];
  if (harder?.length) assert.ok(harder.some(rows => rows.join('') === plan.layout.join('')));
  assert.ok(plan.level.assist < (LEVELS[17].assist ?? 0.3));
  assert.equal(plan.level.moves, LEVELS[17].moves);
});

test('chơi chán: đổi chỗ mèo mà giữ độ dễ; quay lại sau nghỉ: dễ hơn 1 mức; mỗi lần thử chỉ đổi tối đa 1 mức', () => {
  const bored = withTries(veteran(), ...[10, 11, 12].map(l => try_(l, true, { stars: 3, dwellMs: 9000 })));
  const plan = planLevel(bored, 13);
  assert.equal(plan.profile, 'bored');
  assert.equal(plan.mode, 'swap');
  if (CAT_LAYOUTS[LEVELS[13].name]?.['0']?.length) assert.notDeepEqual(plan.layout, LEVELS[13].board);
  const day = 86400000;
  const back = startVisit({ ...veteran(), lastSeen: 1 }, 1 + 4 * day);
  assert.equal(planLevel(back, 17).profile, 'returning');
  assert.equal(planLevel(back, 17).shift, -1);
  const p = withTries(veteran(), try_(13, false, { shift: 1 }), try_(13, false, { shift: 1 }), try_(13, false, { shift: 1 }));
  assert.equal(planLevel(p, 13).shift, 0);
});

test('hàng thẻ: lệch nhẹ có trần, không đổi bàn / lượt', () => {
  const base = LEVELS[18], a0 = base.assist ?? 0.3;
  assert.equal(tuneDealer(base, {}).deal, null);
  for (const opts of [{ shift: -2, moves: 9, stuck: 9 }, { shift: 2 }, { shift: -2 }]) {
    const { level } = tuneDealer(base, opts);
    assert.ok(Math.abs(level.assist - a0) <= ADAPTIVE.ASSIST_SPAN + 1e-9, JSON.stringify(opts));
    for (const [key, n] of Object.entries({ single: 6, domino: 5, triple: 1, ...base.shapes })) assert.ok(Math.abs(level.shapes[key] - n) <= ADAPTIVE.SHAPE_SPAN);
    assert.equal(level.board, base.board);
    assert.equal(level.moves, base.moves);
  }
  assert.match(tuneDealer(base, { stuck: 2 }).deal, /domino/);
});

test('thẻ đầu tiên luôn gom được ngay ở lượt 1 (mọi màn, mọi mức DDA, nhiều seed)', () => {
  LEVELS.forEach((base, i) => {
    for (let shift = SHIFT_MIN; shift <= SHIFT_MAX; shift++) {
      const level = isAdaptive(base) ? variantFor(base, shift, 1000 + shift) : base;
      for (let seed = 1; seed <= 12; seed++) {
        const s = createSession(i, { level, rng: mulberry32(seed * 101 + i) });
        assert.ok(matchesSomewhere(s.board, s.W, s.H, s.active), `màn ${i + 1} shift ${shift} seed ${seed}`);
      }
      if (!isAdaptive(base)) break;
    }
  });
  // Thẻ đã gom được thì giữ nguyên; không gom được thì đổi nhẹ nhất (đổi màu một mèo).
  const board = parseBoard(['OO....', '......', '......', '......', '......', '......']);
  const good = { offsets: [[0, 0]], items: [{ group: 'orange' }] };
  assert.equal(openingCard(board, 6, 6, good), good);
  const fixed = openingCard(board, 6, 6, { offsets: [[0, 0], [0, 1]], items: [{ group: 'gray' }, { group: 'white' }] });
  assert.equal(fixed.items.filter(item => item.group === 'orange').length, 1);
});

test('ghi thời gian đứng ở bảng kết quả vào lần thử vừa xong, chỉ một lần', () => {
  let p = recordAttempt(fresh(), try_(3, false)).profile;
  p = noteDwell(p, 9000);
  p = noteDwell(p, 100);
  assert.equal(p.attempts.at(-1).dwellMs, 9000);
});

test('cao thủ: chỉ cần thắng ngay lần đầu 3 màn Medium+ liền; thắng sau khi chơi lại hoặc dùng booster thì không tính', () => {
  const easyOnly = withTries(veteran(), try_(9, false), try_(10, true, { count: 1 }), try_(11, true, { count: 1 }), try_(12, true, { count: 1 }));
  assert.equal(detectProfile(easyOnly, 13).id, 'steady');
  assert.equal(detectProfile(withTries(veteran(), try_(10, true, { stars: 1 }), try_(11, true, { stars: 1 }), try_(12, true, { stars: 1 })), 13).id, 'skilled');
  assert.equal(detectProfile(withTries(veteran(), try_(10, false), try_(10, true), try_(11, true), try_(12, true)), 13).id, 'steady');
  assert.notEqual(detectProfile(withTries(veteran(), try_(10, true), try_(11, true, { boosters: 1 }), try_(12, true)), 13).id, 'skilled');
});

test('sắp bỏ game bật sớm: thua 3 lần kèm đứng lâu ở bảng thua, hoặc bỏ ngang sau khi đã thua; người mong manh nới sớm', () => {
  assert.equal(detectProfile(withTries(veteran(), try_(13, false), try_(13, false), try_(13, false, { dwellMs: 12000 })), 13).id, 'frustrated');
  assert.equal(detectProfile(withTries(veteran(), try_(13, false), try_(13, false), try_(13, false, { dwellMs: 2000 })), 13).id, 'struggling');
  assert.equal(detectProfile(withTries(veteran(), try_(13, false), try_(13, false, { reason: 'quit' })), 13).id, 'frustrated');
  assert.notEqual(detectProfile(withTries(veteran(), try_(13, false, { reason: 'quit' })), 13).id, 'frustrated');
  const fragile = withTries(veteran(), try_(9, false, { reason: 'quit' }), try_(9, true));
  assert.equal(detectProfile(withTries(fragile, try_(13, false)), 13).id, 'struggling');
  assert.equal(detectProfile(withTries(fragile, try_(13, false, { ratio: 0.9 }), try_(13, false, { ratio: 0.9 })), 13).id, 'frustrated');
});

test('người mới: thắng sạch liền vẫn được tăng khó; thua 2 lần ở cùng màn thì hàng thẻ nhẹ đi, bố trí giữ nguyên', () => {
  const hotNew = withTries(fresh(), try_(11, true, { count: 2 }), try_(12, true, { count: 2 }), try_(13, true, { count: 2 }));
  assert.equal(detectProfile(hotNew, 15).id, 'skilled');
  const first = planLevel(fresh(), 12);
  assert.equal(first.profile, 'onboarding');
  assert.equal(first.shift, 0);
  const twice = withTries(fresh(), try_(12, false, { layout: first.layout }), try_(12, false, { layout: first.layout }));
  const plan = planLevel(twice, 12);
  assert.equal(plan.shift, -1);
  assert.deepEqual(plan.layout, first.layout);
  assert.equal(plan.level.moves, LEVELS[12].moves);
});

test('booster không đổi thắng/thua', () => {
  const carried = { boosters: 1, boostUse: { hammer: 0, swap: 0, moves: 1 }, bought: 1, preBoostRatio: 0.5 };
  assert.equal(detectProfile(withTries(veteran(), try_(12, false), try_(12, false), try_(12, true, carried)), 13).id, 'steady');
  assert.equal(detectProfile(withTries(veteran(), try_(13, false, carried)), 13).id, 'steady');
});
