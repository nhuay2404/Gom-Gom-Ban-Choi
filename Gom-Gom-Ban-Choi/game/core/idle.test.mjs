import test from 'node:test';
import assert from 'node:assert/strict';
import { idleOpen, idlePerHour, idleCap, idlePending, idleFull, tickIdle, claimIdle } from './idle.mjs';
import { IDLE_FROM_LEVEL, IDLE_CAP_HOURS, IDLE_RATE, IDLE_MIN_MINUTES } from '../data/economy.mjs';
import { levelReward } from './progression.mjs';

const HOUR = 3600 * 1000, T = Date.UTC(2026, 9, 1), at = IDLE_FROM_LEVEL;

test('idle: chưa tới mốc màn thì không tích; tới mốc thì mỗi mèo trong nhà bắt đầu từ lúc đó (không trả bù)', () => {
  assert.equal(idleOpen(at - 1), false);
  assert.equal(tickIdle({ coins: 0, cats: ['orange'] }, at - 1, T).idleAt, undefined);
  const deco = tickIdle({ coins: 0, cats: ['orange', 'gray'] }, at, T);
  assert.deepEqual(deco.idleAt, { orange: T, gray: T });
  assert.equal(idlePending(deco, at, T, 'orange'), 0);
  assert.equal(tickIdle(deco, at, T + HOUR), deco, 'đã tích rồi thì không đổi');
  // Mèo mới vào nhà: bắt đầu tích từ lúc vào, các con cũ giữ mốc.
  const joined = tickIdle({ ...deco, cats: ['orange', 'gray', 'white'] }, at, T + HOUR);
  assert.deepEqual(joined.idleAt, { orange: T, gray: T, white: T + HOUR });
});

test('idle: mỗi mèo tự sinh xu theo xu thưởng màn đang chơi, chặn ở trần; nhận một con thì con khác vẫn giữ xu', () => {
  const deco = { coins: 100, cats: ['orange', 'gray'], idleAt: { orange: T, gray: T } };
  assert.equal(idlePerHour(at), levelReward(at) * IDLE_RATE);
  assert.equal(idlePending(deco, at, T + 2 * HOUR, 'orange'), Math.floor(2 * idlePerHour(at)));
  assert.equal(idlePending(deco, at, T + 100 * HOUR, 'gray'), idleCap(at), 'đầy trần thì ngừng');
  assert.equal(idleFull(deco, at, T + IDLE_CAP_HOURS * HOUR, 'orange'), true);
  // Chưa tích đủ IDLE_MIN_MINUTES phút: chưa nhận được gì; đủ thì nhận cả phần đã tích từ đầu.
  const MIN = IDLE_MIN_MINUTES * 60000;
  assert.equal(idlePending(deco, at, T + MIN - 1, 'orange'), 0);
  assert.equal(claimIdle(deco, at, T + MIN - 1, 'orange').amount, 0);
  assert.equal(idlePending(deco, at, T + MIN, 'orange'), Math.floor(MIN / HOUR * idlePerHour(at)));
  const { deco: after, amount } = claimIdle(deco, at, T + 3 * HOUR, 'orange');
  assert.equal(amount, Math.floor(3 * idlePerHour(at)));
  assert.equal(after.coins, 100 + amount);
  assert.equal(idlePending(after, at, T + 3 * HOUR, 'orange'), 0);
  assert.equal(idlePending(after, at, T + 3 * HOUR, 'gray'), amount, 'con chưa nhận vẫn giữ xu');
});

test('idle: save cũ (một mốc chung) -> mọi mèo trong nhà tích tiếp từ mốc đó', () => {
  const old = { coins: 0, cats: ['orange', 'gray'], idleAt: T };
  assert.equal(idlePending(old, at, T + 2 * HOUR, 'gray'), Math.floor(2 * idlePerHour(at)));
  assert.deepEqual(tickIdle(old, at, T + 2 * HOUR).idleAt, { orange: T, gray: T });
  const { deco } = claimIdle(old, at, T + 2 * HOUR, 'orange');
  assert.deepEqual(deco.idleAt, { orange: T + 2 * HOUR, gray: T });
});

test('idle: chỉnh giờ máy lùi lại thì không cộng, tích lại từ bây giờ', () => {
  const deco = { coins: 0, cats: ['orange'], idleAt: { orange: T + 5 * HOUR } };
  assert.equal(idlePending(deco, at, T, 'orange'), 0);
  assert.equal(claimIdle(deco, at, T, 'orange').amount, 0);
  assert.equal(tickIdle(deco, at, T).idleAt.orange, T);
});
