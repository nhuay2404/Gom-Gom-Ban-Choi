import test from 'node:test';
import assert from 'node:assert/strict';
import * as ECO from '../game/gameplay/economy.mjs';
import { simulatePlayer, simulateProfile, PROFILES } from './economy-sim.mjs';
import { saveEconomy, EDITABLE } from './economy-save.mjs';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cfg = Object.fromEntries(EDITABLE.map(name => [name, ECO[name]]));
const always = Array(100).fill(1);

test('mô phỏng economy: người thắng mọi màn mở đủ 5 khu đúng mốc màn; kết quả lặp lại theo seed', () => {
  const run = simulatePlayer(cfg, PROFILES[1], always, { seed: 3 });
  assert.equal(run.cleared, 100);
  assert.deepEqual(run.events.map(e => e.area), ['garden2', 'living', 'bedroom', 'kitchen', 'bathroom']);
  for (const e of run.events) assert.ok(e.level >= cfg.AREA_UNLOCK[e.area].level);
  assert.deepEqual(simulatePlayer(cfg, PROFILES[0], Array(100).fill(.5), { seed: 9 }), simulatePlayer(cfg, PROFILES[0], Array(100).fill(.5), { seed: 9 }));
});

test('mô phỏng economy: mốc tiêu xu không với tới thì khu không mở', () => {
  const hard = { ...cfg, AREA_UNLOCK: { ...cfg.AREA_UNLOCK, living: { level: 20, spend: 1e9 } } };
  const result = simulateProfile(hard, PROFILES[1], always, { runs: 3 });
  assert.equal(result.areas.find(a => a.area === 'living').opened, 0);
  assert.equal(result.areas.find(a => a.area === 'kitchen').opened, 0);
});

test('lưu economy từ editor: ghi lại đúng số mặc định, file giữ nguyên phần khác; tên lạ bị từ chối', async () => {
  const before = readFileSync(new URL('../game/gameplay/economy.mjs', import.meta.url), 'utf8');
  const file = join(tmpdir(), `economy-${process.pid}.mjs`);
  writeFileSync(file, before);
  try {
    saveEconomy({ values: { REWARD_BASE: 133, AREA_UNLOCK: { ...cfg.AREA_UNLOCK, kitchen: { level: 41, spend: 1234 } } } }, file);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /remote\('REWARD_BASE', 133\)/);
    assert.match(after, /kitchen: \{ level: 41, spend: 1234 \}/);
    assert.equal(after.split('remote(').length, before.split('remote(').length);
    assert.throws(() => saveEconomy({ values: { DECO: {} } }, file));
  } finally {
    rmSync(file, { force: true });
  }
});
