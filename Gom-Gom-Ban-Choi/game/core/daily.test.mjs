import test from 'node:test';
import assert from 'node:assert/strict';
import { rollDaily, noteDaily, claimMission, claimable, dailyRate, dailyOpen } from './daily.mjs';
import { DAILY, DAILY_POOL } from '../data/economy.mjs';

const DAY = 864e5, MON = new Date(2026, 9, 19, 12).getTime(); // thứ 2, 19/10/2026
const ctx = { unlocked: 40, boosters: true, idle: true, base: true };
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('nhiệm vụ ngày: DAILY.count nhiệm vụ nhẹ khác nhau, cùng một mức xu theo R; cùng ngày không đổi', () => {
  const d = rollDaily(null, ctx, MON);
  assert.equal(d.missions.length, DAILY.count);
  assert.equal(new Set(d.missions.map(m => m.id)).size, DAILY.count, 'không trùng trong ngày');
  assert.equal(d.R % 10, 0);
  assert.equal(d.R, dailyRate(40));
  d.missions.forEach(m => assert.equal(m.reward, Math.round(DAILY.share * d.R / 10) * 10));
  assert.equal(d.chest, undefined, 'không có rương');
  assert.ok(DAILY_POOL.every(m => m.event !== 'stars3'), 'game không có hệ thống 3 sao');
  assert.equal(rollDaily(d, ctx, MON + 1000), d, 'cùng ngày giữ nguyên');
  assert.equal(dailyOpen(DAILY.fromLevel - 1), false);
});

test('nhiệm vụ ngày: ưu tiên món hôm qua chưa có; điều kiện need', () => {
  for (let r = 0; r < 20; r++) {
    const rand = seq(r / 20, (r * 7 % 20) / 20, .3, .9);
    const a = rollDaily(null, ctx, MON, rand), b = rollDaily(a, ctx, MON + DAY, rand);
    const ids = new Set(a.missions.map(m => m.id)), pool = DAILY_POOL.filter(m => m.need !== 'noBase').length;
    const repeats = b.missions.filter(m => ids.has(m.id)).length;
    assert.equal(repeats, Math.max(0, 2 * DAILY.count - pool), 'chỉ lặp khi bảng không đủ món mới');
  }
  const noBase = rollDaily(null, { ...ctx, base: false, idle: false, boosters: false }, MON);
  assert.ok(noBase.missions.every(m => !['build1', 'idle1', 'clean1'].includes(m.id)));
  assert.ok(noBase.missions.filter(m => m.event === 'place').length <= 1, 'không ra hai nhiệm vụ đặt / đổi món cùng ngày');
  assert.ok(rollDaily(null, ctx, MON).missions.every(m => m.id !== 'place2'));
});

test('nhiệm vụ ngày: đếm, nhận xu từng nhiệm vụ, không nhận hai lần', () => {
  let d = rollDaily(null, ctx, MON);
  for (const m of d.missions) ({ daily: d } = noteDaily(d, m.event, m.n + 5));
  assert.ok(d.missions.every(m => m.progress === m.n), 'không vượt n');
  assert.ok(claimMission(rollDaily(null, ctx, MON), 0).error, 'chưa xong chưa nhận được');
  assert.equal(claimable(d), DAILY.count);
  const got = claimMission(d, 0);
  assert.equal(got.coins, d.missions[0].reward);
  assert.equal(got.boosters, undefined, 'không tặng booster');
  assert.ok(claimMission(got.daily, 0).error, 'không nhận hai lần');
  assert.equal(claimable(got.daily), DAILY.count - 1);
});
