import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWallet, addGems, spendGems, gemsForCoins, grantOnce, adsLeft, noteAd, bonusCoins, openOffer, offerActive, activeOffers, closeOffer, dayKey } from './gems.mjs';
import { REWARDED_ADS, OFFERS } from '../data/economy.mjs';

const T = new Date(2026, 9, 22, 10).getTime(), H = 36e5;

test('ví gem: save hỏng = ví mới; cộng / trừ; quà một lần', () => {
  const w = normalizeWallet({ gems: -3, ads: 'x' });
  assert.equal(w.gems, 0);
  assert.equal(spendGems(w, 1), null);
  assert.equal(spendGems(addGems(w, 50), 20).gems, 30);
  const first = grantOnce(w, 'boss:19', 25);
  assert.equal(first.amount, 25);
  assert.equal(grantOnce(first.wallet, 'boss:19', 25).amount, 0, 'không nhận hai lần');
});

test('rewarded ads: đếm theo chỗ đặt, hết trần thì 0, sang ngày mới reset', () => {
  let w = normalizeWallet(null);
  const cap = REWARDED_ADS.caps.booster;
  for (let i = 0; i < cap; i++) w = noteAd(w, 'booster', T);
  assert.equal(adsLeft(w, 'booster', T), 0);
  assert.equal(adsLeft(w, 'continue', T), REWARDED_ADS.caps.continue, 'chỗ đặt khác không bị trừ');
  assert.equal(adsLeft(w, 'booster', T + 24 * H), cap);
  assert.notEqual(dayKey(T), dayKey(T + 24 * H));
});

test('xu thêm ở bảng thắng: không giới hạn lượt, 2 lần đầu trong ngày +50%, từ lần 3 +20%, sang ngày mới lại +50%', () => {
  let w = normalizeWallet(null);
  const got = [];
  for (let i = 0; i < 5; i++) {
    assert.equal(adsLeft(w, 'bonusCoins', T), Infinity);
    got.push(bonusCoins(w, 1000, T));
    w = noteAd(w, 'bonusCoins', T);
  }
  assert.deepEqual(got, [500, 500, 200, 200, 200]);
  assert.equal(bonusCoins(w, 1000, T + 24 * H), 500);
});

test('bù gem khi thiếu xu: theo số màn thưởng còn thiếu, làm tròn lên, có tối thiểu, đủ xu thì 0', () => {
  assert.equal(gemsForCoins(0, 500), 0);
  assert.equal(gemsForCoins(500, 500), 20, 'thiếu đúng 1 màn thưởng = 20 gem');
  assert.equal(gemsForCoins(1500, 500), 60);
  assert.equal(gemsForCoins(10, 5000), 1, 'thiếu rất ít vẫn tối thiểu 1 gem');
  assert.ok(gemsForCoins(3000, 3000) < gemsForCoins(3000, 500), 'cùng số xu thiếu, màn sau ít gem hơn');
});

test('ưu đãi: starter một lần, rescue có hạn giờ + thời gian chờ', () => {
  let w = openOffer(normalizeWallet(null), 'starter', T);
  assert.ok(offerActive(w, 'starter', T + H));
  assert.equal(offerActive(w, 'starter', T + (OFFERS.starter.hours + 1) * H), false, 'hết giờ');
  assert.equal(openOffer(w, 'starter', T + 100 * 24 * H), null, 'starter không bao giờ mở lại');
  w = openOffer(w, 'rescue', T);
  assert.deepEqual(activeOffers(w, T + H).sort(), ['rescue', 'starter']);
  w = closeOffer(w, 'rescue');
  assert.equal(offerActive(w, 'rescue', T + H), false);
  assert.equal(openOffer(w, 'rescue', T + 2 * H), null, 'chưa hết thời gian chờ');
  assert.ok(openOffer(w, 'rescue', T + (OFFERS.rescue.cooldownDays * 24 + 1) * H));
});
