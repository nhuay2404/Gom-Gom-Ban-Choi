import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVEOPS as L } from './tuning.mjs';
import * as lo from './liveops.mjs';

// 08/10/2026 10:00 giờ máy
const T0 = new Date(2026, 9, 8, 10, 0).getTime();
const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
const LIVES_LEVEL = L.LIVES_FROM_LEVEL - 1;

test('dayKey uses local date and msToNextDay counts to midnight', () => {
  assert.equal(lo.dayKey(T0), '2026-10-08');
  assert.equal(lo.msToNextDay(T0), 14 * 60 * MIN);
});

test('lives: no loss before the lives level, loss after, regen every 30 min', () => {
  let s = lo.newLiveOps(T0);
  assert.equal(lo.loseLife(s, LIVES_LEVEL - 1, T0).lives, L.LIVES_MAX);
  s = lo.loseLife(s, LIVES_LEVEL, T0);
  s = lo.loseLife(s, LIVES_LEVEL, T0 + 10 * MIN);
  assert.equal(s.lives, L.LIVES_MAX - 2);
  assert.equal(lo.livesInfo(s, T0 + 29 * MIN).lives, L.LIVES_MAX - 2);
  assert.equal(lo.livesInfo(s, T0 + 30 * MIN).lives, L.LIVES_MAX - 1);
  assert.equal(lo.livesInfo(s, T0 + 30 * MIN).nextMs, 30 * MIN);
  assert.equal(lo.livesInfo(s, T0 + 60 * MIN).lives, L.LIVES_MAX);
  assert.equal(lo.livesInfo(s, T0 + 60 * MIN).nextMs, 0);
});

test('lives: empty blocks play on lives levels only; unlimited skips loss', () => {
  let s = lo.newLiveOps(T0);
  for (let i = 0; i < L.LIVES_MAX; i++) s = lo.loseLife(s, LIVES_LEVEL, T0);
  assert.equal(lo.canStartLevel(s, LIVES_LEVEL, T0), false);
  assert.equal(lo.canStartLevel(s, LIVES_LEVEL - 1, T0), true);
  s = lo.grantUnlimited(s, 30, T0);
  assert.equal(lo.canStartLevel(s, LIVES_LEVEL, T0), true);
  assert.equal(lo.loseLife(s, LIVES_LEVEL, T0 + MIN).lives, 0);
});

test('lives: intro grant once, refill costs gems, ad lives capped per day', () => {
  let s = lo.newLiveOps(T0);
  assert.equal(lo.introLives(s, LIVES_LEVEL - 1, T0).granted, false);
  const intro = lo.introLives(s, LIVES_LEVEL, T0);
  assert.ok(intro.granted && lo.hasUnlimited(intro.state, T0 + 59 * MIN));
  assert.equal(lo.introLives(intro.state, LIVES_LEVEL, T0).granted, false);
  s = lo.loseLife(s, LIVES_LEVEL, T0);
  assert.equal(lo.refillLives(s, T0), null);
  s = lo.refillLives({ ...s, gems: L.REFILL_GEMS }, T0);
  assert.deepEqual([s.lives, s.gems], [L.LIVES_MAX, 0]);
  for (let i = 0; i < L.AD_LIVES_PER_DAY; i++) s = lo.adLife(lo.loseLife(s, LIVES_LEVEL, T0), T0);
  assert.equal(lo.adLife(s, T0), null);
  assert.equal(lo.adLivesLeft(s, T0 + DAY), L.AD_LIVES_PER_DAY);
});

test('login: one claim per day, missed days pause instead of reset, day 7 gives gems', () => {
  let s = lo.newLiveOps(T0);
  const first = lo.claimLogin(s, T0);
  assert.deepEqual(first.reward, L.LOGIN_REWARDS[0]);
  s = first.state;
  assert.equal(lo.claimLogin(s, T0 + MIN), null);
  // bỏ 3 ngày: vẫn tới ô thứ 2
  assert.equal(lo.claimLogin(s, T0 + 4 * DAY).step, 1);
  for (let d = 1; d < 7; d++) s = lo.claimLogin(s, T0 + d * DAY).state;
  assert.equal(s.gems, L.LOGIN_REWARDS[6].gems);
  assert.equal(lo.loginStatus(s, T0 + 7 * DAY).step, 0);
});

test('clock rollback locks claims until time passes the high-water mark', () => {
  let s = lo.syncClock(lo.newLiveOps(T0), T0 + 3 * DAY).state;
  assert.equal(lo.syncClock(s, T0).tampered, true);
  assert.equal(lo.claimLogin(s, T0), null);
  assert.ok(lo.claimLogin(s, T0 + 3 * DAY));
});

test('quests: same set all day, filtered by unlocked mechanics, chest at 100 points', () => {
  let s = lo.ensureQuests(lo.newLiveOps(T0), T0, 0);
  assert.equal(s.quests.list.length, 3);
  assert.deepEqual(lo.ensureQuests({ ...s, quests: null }, T0 + 60 * MIN, 0).quests, s.quests);
  assert.equal(lo.questGoal(), 100);
  for (let day = 0; day < 30; day++) {
    const q = lo.ensureQuests(lo.newLiveOps(T0), T0 + day * DAY, 0).quests.list;
    assert.ok(q.every(item => (lo.questDef(item.id).from ?? 0) <= 0));
  }
  // hoàn thành cả 3
  for (const q of s.quests.list) s = lo.trackQuest(s, T0, lo.questDef(q.id).event, q.need).state;
  assert.equal(lo.questPoints(s), 100);
  assert.ok(lo.chestReady(s));
  const chest = lo.claimChest(s, T0, { double: true, rng: () => 0 });
  assert.deepEqual(chest.reward, { coins: L.CHEST.coins * 2, boosters: { hammer: 2 } });
  assert.equal(lo.chestReady(chest.state), false);
  // nhiệm vụ của hôm qua không nhận tiến độ hôm nay
  assert.equal(lo.trackQuest(s, T0 + DAY, 'win', 5).completed.length, 0);
});

test('streak: counts wins from the streak level, resets on loss, tiers grant bonuses', () => {
  let s = lo.newLiveOps(T0);
  const lvl = L.STREAK_FROM_LEVEL - 1;
  assert.equal(lo.recordStreak(s, lvl - 1, true).streak, 0);
  for (let i = 0; i < 5; i++) s = lo.recordStreak(s, lvl, true);
  assert.equal(lo.streakBonus(s.streak).tier, 2);
  assert.equal(lo.streakBonus(2), null);
  assert.equal(lo.recordStreak(s, lvl, false).streak, 0);
});

test('continue price escalates and caps; gem packs add gems', () => {
  assert.deepEqual([0, 1, 2, 5].map(lo.continuePrice), [60, 100, 150, 150]);
  assert.equal(lo.buyGemPack(lo.newLiveOps(T0), 'gems-m').gems, 330);
  assert.equal(lo.spendGems({ gems: 10 }, 20), null);
});
