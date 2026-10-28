// Test chuyển bước onboarding (onboarding.js): mới chơi, save cũ ở từng bước, tắt game giữa bước xây món. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEYS, setStorageBackend, writeText, readText } from '../core/save.mjs';
import * as ob from './onboarding.js';
import { CATALOG, isBase } from '../deco/deco-data.mjs';

const memory = () => {
  const data = new Map();
  return { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
};
// Mở game với save có sẵn (bước onboarding + sao các màn).
function boot({ stage = null, stars = [] } = {}) {
  setStorageBackend(memory());
  if (stage) writeText(SAVE_KEYS.onboarding, stage);
  if (stars.length) writeText(SAVE_KEYS.progress, JSON.stringify({ stars }));
  return ob.reloadStage();
}

test('món xây đầu tiên = món gốc rẻ nhất (có giá) của vườn gốc', () => {
  const first = ob.firstBuild();
  const cheapest = Math.min(...CATALOG.filter(e => isBase(e) && e.zone === 'garden' && !e.area && e.price > 0).map(e => e.price));
  assert.ok(isBase(first) && first.zone === 'garden' && first.price === cheapest);
});

test('mới chơi: L1 -> thắng màn 1 mở Garden, sang build (chờ hướng dẫn xây) -> L2 -> free -> màn 5 mở decor', () => {
  assert.equal(boot(), 'L1');
  assert.ok(!ob.tabOpen('deco') && !ob.pending());
  assert.equal(ob.unlockOnWin(0), 'garden');
  assert.equal(ob.stage(), 'build');
  assert.equal(readText(SAVE_KEYS.onboarding), 'build', 'lưu ngay lúc thắng');
  assert.ok(ob.pending() && ob.tabOpen('deco') && !ob.tabOpen('shop'));
  // Bước build: chỉ mua được đúng món đầu tiên.
  const other = CATALOG.find(e => isBase(e) && e.zone === 'garden' && e.price > 0 && e.id !== ob.firstBuild().id);
  assert.ok(ob.buildOpen(ob.firstBuild()));
  assert.ok(!ob.buildOpen(other) && !ob.buildOpen());
  ob.setStage('L2'); // hướng dẫn xây xong (tours.js) -> vào thẳng màn 2
  assert.ok(!ob.pending() && !ob.buildOpen(ob.firstBuild()), 'sau bước build lại khoá mua cho tới màn 5');
  assert.equal(ob.unlockOnWin(1), null);
  assert.equal(ob.stage(), 'free');
  assert.equal(ob.unlockOnWin(4), 'decor');
  assert.ok(ob.pending() && ob.buildOpen(other) && ob.tabOpen('shop'));
});

test('tắt game giữa bước xây món: mở lại vẫn ở build và tiếp tục hướng dẫn', () => {
  boot();
  ob.unlockOnWin(0);
  const saved = readText(SAVE_KEYS.onboarding);
  assert.equal(ob.reloadStage(), 'build');
  assert.equal(saved, 'build');
  assert.ok(ob.pending());
});

test('save cũ: basics -> build, cats -> free, các bước khác giữ nguyên, người chơi cũ không có bước -> done', () => {
  assert.equal(boot({ stage: 'basics', stars: [3] }), 'build');
  assert.ok(ob.pending() && ob.tabOpen('deco'));
  assert.equal(boot({ stage: 'cats', stars: [3, 3] }), 'free');
  for (const stage of ['L2', 'free', 'decor', 'done']) assert.equal(boot({ stage, stars: [3] }), stage);
  assert.equal(boot({ stars: [3, 2] }), 'done');
  assert.equal(boot({ stage: 'nonsense' }), 'L1');
});

test('màn 5 luôn mở Decoration nếu chưa xem hướng dẫn đó, kể cả save đi lệch bước', () => {
  boot({ stage: 'build', stars: [3, 3, 3, 3] });
  assert.equal(ob.unlockOnWin(4), 'decor');
  assert.equal(ob.stage(), 'decor');
});
