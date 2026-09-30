// Test Deco (deco-data.mjs): mua / đặt / gỡ đồ, khoá theo level, khoá khu, chuyển save cũ. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend, SAVE_KEYS, writeJSON } from './save.mjs';
import { loadDeco, itemById, itemStatus, applyAction, previewDeco, zoneOpen, catalogFor, CATALOG, COINS_PER_STAR } from './deco-data.mjs';

const memoryStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('save mới: xu = tổng sao × COINS_PER_STAR, bắt đầu ở vườn với đồ miễn phí', () => {
  setStorageBackend(memoryStore());
  const deco = loadDeco(10);
  assert.equal(deco.coins, 10 * COINS_PER_STAR);
  assert.equal(deco.zone, 'garden');
  assert.deepEqual(deco.zones.garden.placed, ['flowers']);
});

test('save cũ (trước khi có vườn): hoàn xu đồ phòng khách đã mua', () => {
  setStorageBackend(memoryStore());
  writeJSON(SAVE_KEYS.deco, { coins: 10, owned: ['rug', 'armchair', 'tank'], placed: ['rug', 'armchair'], wall: 'wall-cream', floor: 'floor-oak', cats: ['gray'] });
  const deco = loadDeco(0);
  assert.equal(deco.coins, 10 + 120 + 300);
  assert.deepEqual(deco.cats, ['gray']);
});

test('mua -> đặt -> gỡ; thiếu xu và khoá level báo lỗi', () => {
  setStorageBackend(memoryStore());
  let deco = loadDeco(4); // 200 xu
  const stump = itemById('stump');
  assert.equal(itemStatus(deco, stump, 1), 'buy');
  deco = applyAction(deco, stump, 1);
  assert.equal(deco.coins, 200 - stump.price);
  assert.equal(itemStatus(deco, stump, 1), 'using');
  deco = applyAction(deco, stump, 1);
  assert.equal(itemStatus(deco, stump, 1), 'owned');
  assert.match(applyAction(deco, itemById('pond'), 1).error, /level 3/);
  assert.equal(applyAction({ ...deco, coins: 0 }, itemById('bench'), 10).error, 'Not enough coins');
});

test('xem trước không trừ xu; khu phòng khách mở khi thắng màn 10', () => {
  setStorageBackend(memoryStore());
  const deco = loadDeco(2);
  const preview = previewDeco(deco, itemById('catnip'));
  assert.equal(preview.coins, deco.coins);
  assert.ok(preview.zones.garden.placed.includes('catnip'));
  assert.equal(zoneOpen('living', 9), false);
  assert.equal(zoneOpen('living', 10), true);
});

test('danh mục: mỗi khu có đủ 4 nhóm, mèo dùng chung', () => {
  for (const zone of ['garden', 'living']) for (const cat of ['furniture', 'walls', 'floors', 'cats']) assert.ok(catalogFor(zone, cat).length > 0, `${zone}/${cat}`);
  assert.equal(new Set(CATALOG.map(entry => entry.id)).size, CATALOG.length, 'id trùng');
});
