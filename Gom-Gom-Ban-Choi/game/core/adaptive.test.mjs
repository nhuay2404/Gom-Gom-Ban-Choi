// Test độ khó thích ứng (adaptive.mjs): DDA không đụng thiết kế / bàn / số lượt, chỉ hàng thẻ; mức nền không reset; nhận diện profile;
// thẻ đầu luôn gom được. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../data/levels.mjs';
import { parseBoard } from './level-rules.mjs';
import { boardSize } from './board-shapes.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE } from './scoring.mjs';
import { ADAPTIVE } from '../data/tuning.mjs';
import { createSession, matchesSomewhere, openingCard } from './session.mjs';
import { CAT_LAYOUTS } from '../data/cat-layouts.mjs';
import {
  elementCount, difficultyOf, planLevel, detectProfile, recordAttempt, startVisit, noteDwell, isAdaptive, tuneDealer, boosterTip, ratingOf, ratingShift, stepRating,
  pickCatLayout, nudgeCats, playableLayout, sameDesign, variantFor, mulberry32, SHIFT_MIN, SHIFT_MAX,
} from './adaptive.mjs';

const fresh = () => ({ attempts: [], ratingBase: 0, streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: 0 });
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
      assert.equal(clearMatches(parseBoard(plan.level.board, plan.level.syrup), W, H, MATCH_SIZE).cleared.length, 0, `màn ${i + 1}: có sẵn cụm gom`);
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

test('bàn luôn đúng thiết kế (cả bố trí mèo); độ khó chỉ ở hàng thẻ: queue = shift', () => {
  for (const profile of [veteran(), losing(14, 2), losing(14, 4)]) {
    const plan = planLevel(profile, 14);
    assert.equal(plan.level.board, LEVELS[14].board);
    assert.equal(plan.level.queue ?? 0, plan.shift);
  }
  // Chơi lại sau khi thua: đánh dấu retry, bàn vẫn y nguyên.
  assert.equal(planLevel(losing(14, 1), 14).retry, true);
  assert.equal(planLevel(veteran(), 14).retry, false);
});

test('mức nền không reset: thắng liền khó dần, thua một màn khó thì nhẹ dần từng mức, thắng lại thì leo dần', () => {
  let p = fresh();
  const shifts = [];
  const play = (level, win, extra) => { shifts.push(planLevel(p, level).shift); p = recordAttempt(p, try_(level, win, extra)).profile; };
  [11, 12, 13, 14].forEach(level => play(level, true));
  assert.deepEqual(shifts, [0, 0, 1, 1]);
  assert.equal(planLevel(p, 15).shift, 2);
  play(15, false);
  assert.equal(planLevel(p, 15).shift, 1, 'thua một lần ở +2: còn +1, không về 0');
  play(15, false);
  assert.equal(planLevel(p, 15).shift, 0);
  play(15, false);
  assert.equal(planLevel(p, 15).shift, -1);
  play(15, true);
  assert.equal(planLevel(p, 16).shift, 0, 'thắng lại: leo dần');
  // Thắng sau khi chơi lại / có booster chỉ cộng nửa bước; thua sát nút chỉ trừ nửa bước; màn tutorial không tính.
  assert.equal(stepRating(0, try_(15, true), try_(15, false)), ADAPTIVE.RATING_WIN / 2);
  assert.equal(stepRating(0, try_(15, true, { boosters: 1 })), ADAPTIVE.RATING_WIN / 2);
  assert.equal(stepRating(0, try_(15, false, { ratio: 0.9 })), -ADAPTIVE.RATING_LOSS / 2);
  assert.equal(stepRating(0, try_(10, false)), 0);
  assert.equal(ratingShift(-1.5), -1);
});

test('lịch sử bị cắt (HISTORY) thì phần bị cắt cộng vào ratingBase: điểm kỹ năng không đổi vì cắt', () => {
  let p = fresh();
  for (let n = 0; n < ADAPTIVE.HISTORY + 5; n++) {
    const attempt = try_(11 + (n % 8), n % 3 !== 0), before = ratingOf(p), last = p.attempts.at(-1);
    p = recordAttempt(p, attempt).profile;
    assert.equal(ratingOf(p), stepRating(before, attempt, last), `lần ${n}`);
  }
  assert.equal(p.attempts.length, ADAPTIVE.HISTORY);
});

test('vật lộn / sắp bỏ: sắp bỏ thì dễ nhất, boss chỉ nới 1 mức, quà khi thắng; nghỉ "sắp bỏ" thì chưa làm khó lại', () => {
  assert.equal(detectProfile(losing(16, 2), 16).id, 'struggling');
  const frustrated = losing(14, 4);
  assert.equal(planLevel(frustrated, 14).profile, 'frustrated');
  assert.equal(planLevel(frustrated, 14).shift, -2);
  assert.equal(planLevel(frustrated, 19).shift, -1); // boss
  const won = recordAttempt(frustrated, try_(14, true, { profile: 'frustrated', shift: -2 }));
  assert.equal(won.gift, true);
  assert.equal(won.profile.cooldown, 3);
  assert.ok(planLevel(hot(), 17).shift > 0 && planLevel({ ...hot(), cooldown: 2 }, 17).shift === 0);
});

test('thua sát nút: mời booster, mức nền chỉ nhẹ nửa bước mỗi lần; không bao giờ cộng lượt', () => {
  const near = n => withTries(veteran(), ...Array.from({ length: n }, () => try_(12, false, { ratio: 0.9 })));
  assert.equal(planLevel(near(2), 12).profile, 'near-miss');
  assert.equal(planLevel(near(2), 12).suggestBooster, true);
  assert.equal(planLevel(near(2), 12).shift, ratingShift(ratingOf(veteran())) - 1);
  for (const n of [2, 4]) assert.equal(planLevel(near(n), 12).level.moves, LEVELS[12].moves);
  assert.equal(boosterTip(near(2)), true);
  assert.equal(boosterTip(withTries(veteran(), try_(13, false, { ratio: 0.9 }), try_(13, false, { ratio: 0.9, boosters: 1 }))), false);
});

test('cao thủ: khó hơn bằng hàng thẻ (thẻ xấu, nhiều thẻ đơn, ít assist); không đổi bàn / lượt', () => {
  const plan = planLevel(hot(), 17);
  assert.equal(plan.profile, 'skilled');
  assert.equal(plan.shift, 2);
  assert.equal(plan.level.queue, 2);
  assert.ok(plan.level.assist < (LEVELS[17].assist ?? 0.3));
  assert.equal(plan.level.board, LEVELS[17].board);
  assert.equal(plan.level.moves, LEVELS[17].moves);
});

test('quay lại sau nghỉ: nhẹ hơn mức nền 1 mức (không reset mức nền)', () => {
  const day = 86400000;
  const back = startVisit({ ...veteran(), lastSeen: 1 }, 1 + 4 * day);
  assert.equal(planLevel(back, 17).profile, 'returning');
  assert.equal(planLevel(back, 17).shift, ratingShift(ratingOf(veteran())) - 1);
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
      const level = isAdaptive(base) ? variantFor(base, shift) : base;
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

test('người mới: thắng sạch liền vẫn được tăng khó; thua ở cùng màn thì hàng thẻ nhẹ đi, bàn giữ nguyên', () => {
  const hotNew = withTries(fresh(), try_(11, true, { count: 2 }), try_(12, true, { count: 2 }), try_(13, true, { count: 2 }));
  assert.equal(detectProfile(hotNew, 15).id, 'skilled');
  const first = planLevel(fresh(), 12);
  assert.equal(first.profile, 'onboarding');
  assert.equal(first.shift, 0);
  const twice = withTries(fresh(), try_(12, false), try_(12, false));
  const plan = planLevel(twice, 12);
  assert.ok(plan.shift < 0);
  assert.equal(plan.level.board, LEVELS[12].board);
  assert.equal(plan.level.moves, LEVELS[12].moves);
});

test('booster không đổi thắng/thua', () => {
  const carried = { boosters: 1, boostUse: { hammer: 0, swap: 0, moves: 1 }, bought: 1, preBoostRatio: 0.5 };
  assert.equal(detectProfile(withTries(veteran(), try_(12, false), try_(12, false), try_(12, true, carried)), 13).id, 'steady');
  assert.equal(detectProfile(withTries(veteran(), try_(13, false, carried)), 13).id, 'steady');
});

test('màn paywall (màn 10): thua bao nhiêu cũng không dễ đi; từ lần chơi lại sau khi thua thì mời booster +lượt', () => {
  const i = LEVELS.findIndex(level => level.paywall);
  assert.equal(i, 9, 'paywall ở màn 10');
  assert.equal(planLevel(veteran(), i).suggestBooster, false, 'lần đầu: không mời');
  const firstVisit = { ...veteran(), attempts: veteran().attempts.filter(a => a.level !== i) };
  assert.ok(planLevel(firstVisit, i).level.queue >= 3, 'lần đầu: hàng thẻ khó hơn');
  assert.ok((planLevel(losing(i, 1), i).level.queue ?? 0) < 3, 'chơi lại: thẻ bình thường');
  assert.ok((planLevel(firstVisit, i, { cleared: true }).level.queue ?? 0) < 3, 'đã thắng màn 10 (dù lịch sử đã trôi mất): không bao giờ thẻ xấu');
  const longAgo = recordAttempt(firstVisit, try_(i, false)).profile;
  assert.ok((planLevel({ ...longAgo, attempts: [] }, i).level.queue ?? 0) < 3, 'đã chơi rồi (lịch sử bị cắt): không thẻ xấu lại');
  for (const n of [1, 2, 4, 6]) {
    const plan = planLevel(losing(i, n), i);
    assert.ok(plan.shift >= 0, `thua ${n} lần: không hạ độ khó`);
    assert.ok(plan.level.assist <= (LEVELS[i].assist ?? 0.3) + 1e-9, `thua ${n} lần: hàng thẻ không nới`);
    assert.equal(plan.suggestBooster, true, `thua ${n} lần: mời booster`);
    assert.equal(plan.level.moves, LEVELS[i].moves);
  }
});
