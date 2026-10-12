import test from 'node:test';
import assert from 'node:assert/strict';
import { idleOpen, idlePerHour, idleCap, idlePending, idleFull, tickIdle, claimIdle } from './idle.mjs';
import { IDLE_FROM_LEVEL, IDLE_CAP_HOURS } from './economy.mjs';
import { levelReward } from './progression.mjs';

const HOUR = 3600 * 1000, T = Date.UTC(2026, 9, 1), at = IDLE_FROM_LEVEL;

test('idle: chưa tới mốc màn thì không tích; tới mốc thì bắt đầu từ lúc đó (không trả bù)', () => {
  assert.equal(idleOpen(at - 1), false);
  assert.equal(tickIdle({ coins: 0 }, at - 1, T).idleAt, undefined);
  const deco = tickIdle({ coins: 0 }, at, T);
  assert.equal(deco.idleAt, T);
  assert.equal(idlePending(deco, at, T), 0);
  assert.equal(tickIdle(deco, at, T + HOUR), deco, 'đã tích rồi thì không đổi');
});

test('idle: xu / giờ theo xu thưởng màn đang chơi, chặn ở trần, nhận xong tích lại từ đầu', () => {
  const deco = { coins: 100, idleAt: T };
  assert.equal(idlePerHour(at), levelReward(at) * 0.04);
  assert.equal(idlePending(deco, at, T + 2 * HOUR), Math.floor(2 * idlePerHour(at)));
  assert.equal(idlePending(deco, at, T + 100 * HOUR), idleCap(at), 'đầy trần thì ngừng');
  assert.equal(idleFull(deco, at, T + IDLE_CAP_HOURS * HOUR), true);
  const { deco: after, amount } = claimIdle(deco, at, T + 3 * HOUR);
  assert.equal(amount, Math.floor(3 * idlePerHour(at)));
  assert.equal(after.coins, 100 + amount);
  assert.equal(idlePending(after, at, T + 3 * HOUR), 0);
});

test('idle: chỉnh giờ máy lùi lại thì không cộng, tích lại từ bây giờ', () => {
  const deco = { coins: 0, idleAt: T + 5 * HOUR };
  assert.equal(idlePending(deco, at, T), 0);
  assert.equal(claimIdle(deco, at, T).amount, 0);
  assert.equal(tickIdle(deco, at, T).idleAt, T);
});
