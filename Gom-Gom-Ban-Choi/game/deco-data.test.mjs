// Test Deco (deco-data.mjs): mua / đặt / gỡ đồ, khoá theo level, khoá khu, chuyển save cũ. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend, SAVE_KEYS, writeJSON } from './save.mjs';
import { loadDeco, itemById, itemStatus, applyAction, previewDeco, zoneOpen, gardenExpanded, catalogFor, CATALOG, COINS_PER_STAR } from './deco-data.mjs';

const memoryStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('save mới: xu = tổng sao × COINS_PER_STAR, bắt đầu ở vườn với đồ miễn phí', () => {
  setStorageBackend(memoryStore());
  const deco = loadDeco(10);
  assert.equal(deco.coins, 10 * COINS_PER_STAR);
  assert.equal(deco.zone, 'garden');
  // cối xay + hướng dương (phần vườn mở rộng) đặt sẵn nhưng chỉ hiện khi vườn đã mở rộng
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'sunflowers']);
  assert.deepEqual(Object.keys(deco.zones), ['garden', 'living', 'bedroom']);
});

test('vườn mở rộng (thắng màn 30): cùng khu vườn, đồ mới nằm trong danh mục vườn, khoá từ màn 31', () => {
  assert.equal(gardenExpanded(29), false);
  assert.equal(gardenExpanded(30), true);
  const ext = CATALOG.filter(e => e.area === 'garden2');
  assert.ok(ext.length >= 16, 'đồ phần mở rộng + phương án thay thế');
  ext.forEach(e => {
    assert.equal(e.zone, 'garden', `${e.id} thuộc vườn`);
    assert.ok(e.lock >= 31, `${e.id} khoá từ màn 31`);
    assert.ok(catalogFor('garden', e.cat).includes(e), `${e.id} có trong danh mục vườn`);
  });
  assert.equal(catalogFor('garden', 'walls').filter(e => e.area).length, 0, 'không có rào riêng');
  assert.equal(catalogFor('garden', 'floors').filter(e => e.area).length, 0, 'không có nền riêng');
});

test('save cũ: gộp khu "garden2" thử nghiệm vào vườn; save trước khi có phần mở rộng được đặt sẵn đồ miễn phí của nó', () => {
  setStorageBackend(memoryStore());
  const base = loadDeco(5);
  const { expansionSeeded, ...old } = base;
  writeJSON(SAVE_KEYS.deco, { ...old, zones: { ...base.zones, garden: { ...base.zones.garden, placed: ['flowers', 'stump'] } } });
  assert.deepEqual(loadDeco(0).zones.garden.placed, ['flowers', 'stump', 'windmill', 'sunflowers']);
  setStorageBackend(memoryStore());
  writeJSON(SAVE_KEYS.deco, { ...base, zones: { ...base.zones,
    garden: { ...base.zones.garden, placed: ['flowers'] },
    garden2: { owned: ['windmill', 'kite', 'g2fence-old'], placed: ['windmill', 'kite', 'g2fence-old'], wall: 'g2fence-old', floor: 'g2ground-old' } } });
  const deco = loadDeco(0);
  assert.deepEqual(Object.keys(deco.zones).sort(), ['bedroom', 'garden', 'living']);
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'kite']);
  assert.ok(deco.zones.garden.owned.includes('kite'));
  assert.equal(deco.zones.garden.wall, 'fence-white', 'giữ rào của vườn');
});

test('save cũ (trước khi có vườn): hoàn xu đồ phòng khách đã mua', () => {
  setStorageBackend(memoryStore());
  writeJSON(SAVE_KEYS.deco, { coins: 10, owned: ['rug', 'armchair', 'tank'], placed: ['rug', 'armchair'], wall: 'wall-cream', floor: 'floor-oak', cats: ['gray'] });
  const deco = loadDeco(0);
  assert.equal(deco.coins, 10 + 120 + 300);
  assert.deepEqual(deco.cats, ['gray']);
});

test('save có trước phòng ngủ: thêm khu phòng ngủ mặc định, giữ nguyên vườn / phòng khách', () => {
  setStorageBackend(memoryStore());
  const old = loadDeco(5);
  const { bedroom, ...zones } = old.zones;
  writeJSON(SAVE_KEYS.deco, { ...old, coins: 77, zones: { ...zones, garden: { ...zones.garden, placed: ['flowers', 'stump'] } } });
  const deco = loadDeco(0);
  assert.equal(deco.coins, 77);
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'stump']);
  assert.deepEqual(deco.zones.bedroom.placed, ['bed', 'bedrug']);
  assert.equal(deco.zones.bedroom.wall, 'bwall-lavender');
  assert.equal(deco.zones.bedroom.floor, 'bfloor-oak', 'phòng ngủ mặc định sàn Oak');
  assert.equal(deco.zones.living.floor, 'floor-oak', 'phòng khách mặc định sàn Oak');
  assert.equal(itemById('bfloor-oak').price, 0);
  assert.equal(zoneOpen('bedroom', 14), false);
  assert.equal(zoneOpen('bedroom', 15), true);
});

test('mọi món nội thất có chỗ đặt + bán kính vật cản; các khu nối liền qua cửa', async () => {
  const { PLACES, OBSTACLE_RADIUS, LINKS, ZONE_OFFSET } = await import('./room-layout.mjs');
  for (const entry of CATALOG.filter(e => e.cat === 'furniture' && !e.slot)) {
    assert.ok(PLACES[entry.id], `${entry.id} có chỗ đặt`);
    assert.ok(OBSTACLE_RADIUS[entry.id] !== undefined, `${entry.id} có bán kính vật cản`);
  }
  for (const zone of Object.keys(ZONE_OFFSET)) assert.ok(zone === 'garden' || LINKS.some(l => l.a === zone || l.b === zone), `${zone} có cửa`);
});

test('phần vườn mở rộng: khe giữa các vật cản (cả đồi) đủ cho mèo lọt (≥ .8 m) hoặc khép hẳn (≤ .1 m)', async () => {
  const { PLACES, OBSTACLE_RADIUS, HILL, HILL_OBSTACLE_R } = await import('./room-layout.mjs');
  const obs = CATALOG.filter(e => e.area === 'garden2' && !e.slot && OBSTACLE_RADIUS[e.id])
    .map(e => ({ id: e.id, x: PLACES[e.id][0], z: PLACES[e.id][1], r: OBSTACLE_RADIUS[e.id] }))
    .concat([{ id: 'hill', x: HILL.x, z: HILL.z, r: HILL_OBSTACLE_R }]);
  for (let i = 0; i < obs.length; i++) for (let j = i + 1; j < obs.length; j++) {
    const a = obs[i], b = obs[j], gap = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
    assert.ok(gap >= .8 || gap <= .1, `${a.id} - ${b.id}: khe ${gap.toFixed(2)} m (mèo kẹt)`);
  }
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
  for (const zone of ['garden', 'living', 'bedroom']) for (const cat of ['furniture', 'walls', 'floors', 'cats']) assert.ok(catalogFor(zone, cat).length > 0, `${zone}/${cat}`);
  assert.equal(new Set(CATALOG.map(entry => entry.id)).size, CATALOG.length, 'id trùng');
});

test('phương án thay thế: đồng giá, cùng khoá, cùng chỗ; đặt vào thì thay món cùng chỗ', async () => {
  const { slotOf, occupantOf } = await import('./deco-data.mjs');
  const { PLACES } = await import('./room-layout.mjs');
  const bases = CATALOG.filter(entry => entry.cat === 'furniture' && !entry.slot);
  bases.forEach(base => {
    const alts = CATALOG.filter(entry => entry.slot === base.id);
    assert.ok(alts.length >= 1, `${base.id} có phương án thay thế`);
    alts.forEach(alt => {
      assert.equal(alt.price, base.price, `${alt.id} đồng giá`);
      assert.equal(alt.lock, base.lock, `${alt.id} cùng khoá`);
      assert.equal(alt.zone, base.zone);
      assert.ok(PLACES[slotOf(alt)], `${alt.id} có chỗ đặt`);
    });
  });
  setStorageBackend(memoryStore());
  let deco = loadDeco(10);
  const shrooms = itemById('flowers-mushroom');
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'sunflowers'], 'mặc định chỉ đặt món gốc');
  assert.equal(occupantOf(deco, shrooms).id, 'flowers');
  assert.deepEqual(previewDeco(deco, shrooms).zones.garden.placed, ['windmill', 'sunflowers', 'flowers-mushroom']);
  deco = applyAction(deco, shrooms, 1); // giá 0: nhận luôn, đặt vào thay bồn hoa cũ
  assert.deepEqual(deco.zones.garden.placed, ['windmill', 'sunflowers', 'flowers-mushroom']);
  assert.equal(itemStatus(deco, itemById('flowers'), 1), 'owned');
  deco = applyAction(deco, itemById('flowers'), 1);
  assert.deepEqual(deco.zones.garden.placed, ['windmill', 'sunflowers', 'flowers']);
});
