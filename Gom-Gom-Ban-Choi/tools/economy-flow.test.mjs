import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFlow } from './economy-flow.mjs';

test('dòng xu: mở khu khi tới mốc và đủ xu, để dành khi chưa đủ, xu vào = xu ra + ví', () => {
  const steps = runFlow({
    start: 10, levels: 6, reward: () => 100, idle: i => (i >= 2 ? 5 : 0), order: ['a', 'b'],
    gates: { a: { level: 2, cost: 150 }, b: { level: 3, cost: 1000 } },
    items: [{ area: 'garden', price: 50, open: 1 }, { area: 'a', price: 60, open: 3 }],
  });
  assert.equal(steps[1].pay.garden.deco, 50); // màn 1: mua món vườn
  assert.deepEqual(steps[2].opened, ['garden', 'a']); // màn 2: 60 + 100 ≥ 150 → mở a
  assert.equal(steps[3].pay.a?.deco, undefined); // màn 3: tới mốc b mà chưa đủ 1000 → để dành
  assert.ok(!steps[6].opened.includes('b'));
  for (const s of steps) {
    const paid = Object.values(s.tot.pay).reduce((t, p) => t + p.gate + p.deco, 0);
    assert.equal(s.tot.start + s.tot.win + s.tot.idle, paid + s.wallet);
  }
});
