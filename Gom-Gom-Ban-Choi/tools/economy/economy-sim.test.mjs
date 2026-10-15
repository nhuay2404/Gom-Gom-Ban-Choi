import test from 'node:test';
import assert from 'node:assert/strict';
import * as ECO from '../../game/gameplay/economy.mjs';
import { simulatePlayer, simulateProfile, PROFILES } from './economy-sim.mjs';
import { saveEconomy, EDITABLE } from './economy-save.mjs';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cfg = Object.fromEntries(EDITABLE.map(name => [name, ECO[name]]));
const always = Array(100).fill(1);

test('mô phỏng economy: người thắng mọi màn mở đủ 7 khu đúng mốc màn; kết quả lặp lại theo seed', () => {
  const run = simulatePlayer(cfg, PROFILES[1], always, { seed: 3 });
  assert.equal(run.cleared, 100);
  assert.deepEqual(run.events.map(e => e.area), ['garden2', 'living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder']);
  for (const e of run.events) assert.ok(e.level >= cfg.AREA_UNLOCK[e.area].level);
  assert.deepEqual(simulatePlayer(cfg, PROFILES[0], Array(100).fill(.5), { seed: 9 }), simulatePlayer(cfg, PROFILES[0], Array(100).fill(.5), { seed: 9 }));
});

test('mô phỏng economy: người sưu tầm (mua mọi kiểu) vẫn để dành xu mở đủ khu; số xu thiếu không âm', () => {
  const collector = simulateProfile(cfg, PROFILES.find(p => p.buy === 'all'), always, { runs: 3 });
  for (const a of collector.areas) { assert.equal(a.opened, 1, a.area); assert.ok(a.short >= 0, a.area); }
});

test('mô phỏng economy: mốc tiêu xu không với tới thì khu không mở', () => {
  const hard = { ...cfg, AREA_UNLOCK: { ...cfg.AREA_UNLOCK, living: { level: 20, cost: 1e9 } } };
  const result = simulateProfile(hard, PROFILES[1], always, { runs: 3 });
  assert.equal(result.areas.find(a => a.area === 'living').opened, 0);
  assert.equal(result.areas.find(a => a.area === 'kitchen').opened, 0);
});

test('lưu economy từ editor: ghi lại đúng số mặc định, file giữ nguyên phần khác; tên lạ bị từ chối', async () => {
  const before = readFileSync(new URL('../../game/gameplay/economy.mjs', import.meta.url), 'utf8');
  const file = join(tmpdir(), `economy-${process.pid}.mjs`);
  writeFileSync(file, before);
  try {
    saveEconomy({ values: { REWARD_BASE: 133, AREA_UNLOCK: { ...cfg.AREA_UNLOCK, kitchen: { level: 41, cost: 1234 } } } }, file);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /remote\('REWARD_BASE', 133\)/);
    assert.match(after, /kitchen: \{ level: 41, cost: 1234 \}/);
    assert.equal(after.split('remote(').length, before.split('remote(').length);
    saveEconomy({ values: { DECO: { pool: { price: 0 }, 'yfence-wood': { price: 125 } } } }, file);
    const priced = readFileSync(file, 'utf8');
    assert.match(priced, /'yfence-wood':\s+\{ price: 125 \},\s+\/\/ Wood fence/, 'giá mới, giữ chú thích');
    assert.throws(() => saveEconomy({ values: { DECO: { 'khong-co': { price: 1 } } } }, file), /Không thấy/);
    assert.throws(() => saveEconomy({ values: { DECO: { pool: { price: -5 } } } }, file));
    assert.throws(() => saveEconomy({ values: { BOOSTER_PRICE: 1 } }, file));
  } finally {
    rmSync(file, { force: true });
  }
});

test('kết luận kinh tế: khu không mở được thì trừ nặng và gợi ý giá thấp hơn; không vấn đề thì Cân bằng', async () => {
  const { economyVerdict } = await import('./economy-verdict.mjs');
  const cfg = { AREA_UNLOCK: { kitchen: { level: 40, cost: 1200 } }, REWARD_GROWTH: .1, IDLE_RATE: .05 };
  const area = (opened, short = 0) => ({ area: 'kitchen', opened, short });
  const avg = (areas, extra = {}) => ({ profile: { name: 'Trung bình' }, areas, owned: 5, shopSize: 10, wallet: 100, idleShare: .1, ...extra });
  const ok = economyVerdict({ off: [], avg: avg([area(1)]), others: [], cfg });
  assert.equal(ok.label, 'Cân bằng');
  assert.equal(ok.score, 10);
  const bad = economyVerdict({ off: [{ s: 8, r: .7, prev: .5, kind: 'rise' }], avg: avg([area(.2)], { owned: 10, wallet: 5000 }), others: [], cfg });
  assert.equal(bad.score, 4);
  assert.equal(bad.label, 'Lệch nhiều');
  assert.ok(bad.fixes.some(f => f.includes('850')), 'gợi ý giá bếp ~70%');
});

test('kết luận từng kiểu người chơi: mở đủ khu + tiêu hết xu là Ổn; không mở được khu / dư nhiều xu là Cần chú ý', async () => {
  const { profileVerdict } = await import('./economy-verdict.mjs');
  const cfg = { AREA_UNLOCK: { kitchen: { level: 40, cost: 1000 } } };
  const base = { cleared: 100, days: 12, owned: 10, shopSize: 10, wallet: 300, idleShare: .1, areas: [{ area: 'kitchen', opened: 1, day: 6, short: 200 }] };
  assert.equal(profileVerdict(base, cfg, 100).ok, true);
  assert.equal(profileVerdict({ ...base, areas: [{ area: 'kitchen', opened: 0, short: 0 }] }, cfg, 100).ok, false);
  assert.equal(profileVerdict({ ...base, wallet: 5000 }, cfg, 100).ok, false);
  assert.ok(profileVerdict({ ...base, areas: [{ area: 'kitchen', opened: 1, day: 6, short: 700 }] }, cfg, 100).lines.some(l => l.includes('thiếu 700')));
});

test('kết luận chung 4 kiểu: vấn đề chung (mọi kiểu thiếu nhiều xu ở một khu, hầu hết dư xu) được nêu; không có thì Ổn', async () => {
  const { profilesSummary } = await import('./economy-verdict.mjs');
  const cfg = { AREA_UNLOCK: { kitchen: { level: 40, cost: 1000 } } };
  const p = (name, days, wallet, short) => ({ profile: { name }, cleared: 100, days, owned: 10, shopSize: 10, wallet, idleShare: .1, areas: [{ area: 'kitchen', opened: 1, day: 5, short }] });
  assert.equal(profilesSummary([p('A', 30, 100, 100), p('B', 5, 200, 100)], cfg, 100).ok, true);
  const bad = profilesSummary([p('A', 30, 5000, 800), p('B', 5, 4000, 700)], cfg, 100);
  assert.equal(bad.ok, false);
  assert.ok(bad.lines.some(l => l.includes('Kitchen')));
  assert.ok(bad.lines.some(l => l.includes('dư nhiều xu')));
});

test('mô phỏng economy: thời gian chơi = giây thật sự chơi (thắng / thua) theo nhịp chơi; tính theo loại màn; mốc mua đủ đồ mặc định', () => {
  const one = { ...PROFILES[1], pace: 'mid' };
  const levelInfo = Array.from({ length: 10 }, (_, i) => ({ moves: 12, movesUsedWin: 8, movesUsedLoss: 12, secWin: { mid: 40, weak: 60 }, secLoss: { mid: 70, weak: 99 }, tier: i === 9 ? 'boss' : 'normal' }));
  const run = simulatePlayer(cfg, one, always, { seed: 1, levels: 10, levelInfo });
  assert.equal(run.playSec, 10 * 40, 'thắng mọi ván: 10 ván × 40 giây (nhịp mid)');
  assert.equal(simulatePlayer(cfg, { ...one, pace: 'weak' }, always, { seed: 1, levels: 10, levelInfo }).playSec, 10 * 60, 'nhịp weak lấy secWin.weak');
  const half = simulatePlayer(cfg, one, Array(10).fill(.5), { seed: 4, levels: 10, levelInfo });
  assert.ok(half.playSec > run.playSec, 'có ván thua (70 giây) thì lâu hơn');
  const noSec = simulatePlayer(cfg, one, always, { seed: 1, levels: 10, levelInfo: levelInfo.map(({ secWin, secLoss, ...rest }) => rest) });
  assert.equal(noSec.playSec, 10 * 8 * 5, 'thiếu số giây: số lượt × 5 giây');
  const r = simulateProfile(cfg, one, always, { runs: 2, levels: 10, levelInfo });
  assert.ok(Math.abs(r.minPerLevel - 40 / 60) < 1e-9);
  assert.ok(r.tierMin.boss != null && r.tierMin.normal != null);
  const full = simulateProfile(cfg, one, always, { runs: 2, levels: 100, maxDays: 400 });
  assert.equal(full.fullBase.rate, 1, 'người trung bình mua đủ mọi món mặc định');
});
