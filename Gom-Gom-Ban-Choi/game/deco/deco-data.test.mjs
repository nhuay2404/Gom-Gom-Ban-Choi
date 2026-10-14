// Test Deco (deco-data.mjs): mua / đặt / gỡ đồ, khoá theo level, khoá khu, chuyển save cũ. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend, SAVE_KEYS, writeJSON } from '../gameplay/save.mjs';
import { levelReward } from '../gameplay/progression.mjs';
import { loadDeco, itemById, itemStatus, applyAction, previewDeco, zoneOpen, gardenExpanded, catalogFor, CATALOG, slotGroups, previewAllNew, claimCat, MAX_ROOM_CATS, areaOpen, areaState, nextArea, unlockArea } from './deco-data.mjs';

const memoryStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('save mới: xu khởi tạo = số truyền vào, bắt đầu ở vườn với đồ miễn phí', () => {
  setStorageBackend(memoryStore());
  const deco = loadDeco(500);
  assert.equal(deco.coins, 500);
  assert.equal(deco.zone, 'garden');
  // cối xay + hướng dương (phần vườn mở rộng) đặt sẵn nhưng chỉ hiện khi vườn đã mở rộng
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'sunflowers']);
  assert.deepEqual(Object.keys(deco.zones), ['garden', 'living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder']);
});

test('vườn mở rộng (thắng màn 10): cùng khu vườn, đồ mới nằm trong danh mục vườn, khoá từ màn 11', () => {
  assert.equal(gardenExpanded(9), false);
  assert.equal(gardenExpanded(10), true);
  const ext = CATALOG.filter(e => e.area === 'garden2');
  assert.ok(ext.length >= 16, 'đồ phần mở rộng + phương án thay thế');
  ext.forEach(e => {
    assert.equal(e.zone, 'garden', `${e.id} thuộc vườn`);
    assert.ok(e.lock >= 11, `${e.id} khoá từ màn 11`);
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
  assert.deepEqual(Object.keys(deco.zones).sort(), ['backyard', 'bathroom', 'bedroom', 'garden', 'kinder', 'kitchen', 'living']);
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'kite']);
  assert.ok(deco.zones.garden.owned.includes('kite'));
  assert.equal(deco.zones.garden.wall, 'fence-white', 'giữ rào của vườn');
});

test('save cũ (trước khi có vườn): hoàn xu đồ phòng khách đã mua', () => {
  setStorageBackend(memoryStore());
  writeJSON(SAVE_KEYS.deco, { coins: 10, owned: ['rug', 'armchair', 'tank'], placed: ['rug', 'armchair'], wall: 'wall-cream', floor: 'floor-oak', cats: ['gray'] });
  const deco = loadDeco(0);
  assert.equal(deco.coins, 10 + itemById('armchair').price + itemById('tank').price);
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
  assert.equal(zoneOpen('bedroom', 29), false);
  assert.equal(zoneOpen('bedroom', 30), true);
});

test('bếp: mở khi thắng màn 40; save cũ có khu bếp mặc định; mỗi chỗ có đúng 4 lựa chọn (món gốc + 2 phương án + 1 phương án châu Á)', () => {
  setStorageBackend(memoryStore());
  const old = loadDeco(5);
  const { kitchen, ...zones } = old.zones;
  writeJSON(SAVE_KEYS.deco, { ...old, zones });
  const deco = loadDeco(0);
  assert.deepEqual(deco.zones.kitchen.placed, ['sink', 'dining']);
  assert.equal(deco.zones.kitchen.floor, 'kfloor-oak', 'bếp mặc định sàn Oak');
  assert.equal(deco.zones.kitchen.wall, 'kwall-butter');
  assert.equal(zoneOpen('kitchen', 39), false);
  assert.equal(zoneOpen('kitchen', 40), true);
  const bases = CATALOG.filter(e => e.zone === 'kitchen' && e.cat === 'furniture' && !e.slot);
  assert.equal(bases.length, 10);
  assert.equal(slotGroups('kitchen', 'furniture').every(group => group.length === 3), true);
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
  let deco = loadDeco(200);
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
  assert.equal(zoneOpen('living', 19), false);
  assert.equal(zoneOpen('living', 20), true);
});

test('danh mục: mỗi khu có đủ 4 nhóm, mèo dùng chung', () => {
  for (const zone of ['garden', 'living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder']) for (const cat of ['furniture', 'walls', 'floors', 'cats']) assert.ok(catalogFor(zone, cat).length > 0, `${zone}/${cat}`);
  assert.equal(new Set(CATALOG.map(entry => entry.id)).size, CATALOG.length, 'id trùng');
});

test('phương án thay thế: đồng giá, cùng khoá, cùng chỗ; đặt vào thì thay món cùng chỗ', async () => {
  const { slotOf, occupantOf } = await import('./deco-data.mjs');
  const { PLACES } = await import('./room-layout.mjs');
  const bases = CATALOG.filter(entry => entry.cat === 'furniture' && !entry.slot);
  bases.forEach(base => {
    // Đồ độc quyền event LiveOps (EXCLUSIVES: không bán, chỉ nhận làm thưởng) không tính vào bộ 3 món của shop.
    const alts = CATALOG.filter(entry => entry.slot === base.id && !entry.exclusive);
    // Đúng 3 món mỗi chỗ: món gốc + 2 kiểu khác (không chia theme màu).
    assert.equal(1 + alts.length, 3, `${base.id}: 3 món`);
    alts.forEach(alt => {
      assert.equal(alt.price, base.price, `${alt.id} đồng giá`);
      assert.equal(alt.lock, base.lock, `${alt.id} cùng khoá`);
      assert.equal(alt.zone, base.zone);
      assert.ok(PLACES[slotOf(alt)], `${alt.id} có chỗ đặt`);
    });
  });
  setStorageBackend(memoryStore());
  let deco = loadDeco(10);
  const shrooms = itemById('flowers-tulips');
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'sunflowers'], 'mặc định chỉ đặt món gốc');
  assert.equal(occupantOf(deco, shrooms).id, 'flowers');
  assert.deepEqual(previewDeco(deco, shrooms).zones.garden.placed, ['windmill', 'sunflowers', 'flowers-tulips']);
  deco = applyAction(deco, shrooms, 1); // giá 0: nhận luôn, đặt vào thay bồn hoa cũ
  assert.deepEqual(deco.zones.garden.placed, ['windmill', 'sunflowers', 'flowers-tulips']);
  assert.equal(itemStatus(deco, itemById('flowers'), 1), 'owned');
  deco = applyAction(deco, itemById('flowers'), 1);
  assert.deepEqual(deco.zones.garden.placed, ['windmill', 'sunflowers', 'flowers']);
});

test('slotGroups: đồ gom theo chỗ đặt (món gốc + phương án), tường / sàn / mèo là một nhóm', () => {
  const groups = slotGroups('garden', 'furniture');
  groups.forEach(group => assert.ok(group.every(e => (e.slot || e.id) === (group[0].slot || group[0].id)), 'cùng chỗ'));
  assert.deepEqual(groups[0].map(e => e.id), ['flowers', 'flowers-mushroom', 'flowers-tulips']);
  assert.equal(groups.flat().length, catalogFor('garden', 'furniture').length, 'không sót món nào');
  assert.equal(slotGroups('living', 'walls').length, 1);
  assert.equal(slotGroups('living', 'cats').length, 1);
});

test('previewAllNew: mỗi chỗ hiện một món chưa mua, không trừ xu, không đổi save', () => {
  setStorageBackend(memoryStore());
  let deco = loadDeco(5000);
  deco = applyAction(deco, itemById('stump'), 1); // đã mua gốc cây → chỗ đó hiện phương án chưa mua (kiện rơm)
  const { deco: shown, items } = previewAllNew(deco, 'garden');
  const ids = items.map(e => e.id);
  assert.ok(ids.includes('stump-hay') && !ids.includes('stump'), 'món đã mua không nằm trong danh sách');
  assert.ok(!ids.includes('flowers') && !ids.includes('flowers-tulips') && !ids.includes('flowers-mushroom'), 'món miễn phí coi như đã có');
  assert.ok(ids.includes('catnip'), 'chỗ chưa mua gì: ưu tiên món gốc');
  const slots = shown.zones.garden.placed.map(id => itemById(id).slot || id);
  assert.equal(new Set(slots).size, slots.length, 'mỗi chỗ chỉ một món');
  ids.forEach(id => assert.ok(shown.zones.garden.placed.includes(id)));
  assert.equal(shown.coins, deco.coins);
  assert.deepEqual(deco.zones.garden.placed, ['flowers', 'windmill', 'sunflowers', 'stump'], 'bản gốc không đổi');
});

test('mèo nhận ở Map: chưa nhận thì khoá (dù đã qua màn); nhận rồi thì vào nhà nếu còn chỗ; save cũ giữ mèo đang có', () => {
  setStorageBackend(memoryStore());
  const deco = loadDeco(0), tabby = itemById('cat-tabby');
  assert.deepEqual(deco.claimedCats, ['gray', 'orange', 'white']);
  assert.equal(itemStatus(deco, tabby, 40), 'locked');
  const claimed = claimCat(deco, 'tabby');
  assert.equal(itemStatus(claimed, tabby, 1), 'using');
  assert.equal(claimCat(claimed, 'tabby'), claimed);
  // Không giới hạn số thú trong nhà: nhà đông vẫn nhận thêm (12 giống mèo + chó)
  const crowded = { ...deco, cats: ['gray', 'orange', 'white', 'siamese', 'tuxedo', 'shiba', 'pug', 'golden'] };
  assert.equal(itemStatus(claimCat(crowded, 'tabby'), tabby, 1), 'using');
  assert.equal(applyAction({ ...crowded, claimedCats: [...crowded.cats, 'rottweiler'] }, itemById('dog-rottweiler'), 99).cats.length, 9);
  const store = memoryStore();
  setStorageBackend(store);
  writeJSON(SAVE_KEYS.deco, { ...deco, claimedCats: undefined, cats: ['gray', 'tabby'] });
  assert.ok(loadDeco(0).claimedCats.includes('tabby'));
});

test('Shop Decoration: phương án thay thế cần xây chỗ trước, mua vào kho (chưa đặt), báo món mới; đổi món thì hết "mới"', async () => {
  const { shopCatalog, shopStatus, buyToStock, ownedOptions, useItem, freshKeys, clearFresh, isBase } = await import('./deco-data.mjs');
  setStorageBackend(memoryStore());
  let deco = { ...loadDeco(0), coins: 1000 };
  assert.ok(shopCatalog('garden').every(entry => !isBase(entry)), 'Shop không bán món gốc');
  assert.ok(shopCatalog('garden').some(entry => entry.id === 'fence-wood'), 'Shop bán rào khác');
  const hay = itemById('stump-hay');
  assert.equal(shopStatus(deco, hay, 99), 'needBase');
  assert.ok(buyToStock(deco, hay, 99).error);
  deco = applyAction(deco, itemById('stump'), 99); // xây chỗ ở Deco: mua + đặt món gốc
  assert.ok(deco.zones.garden.placed.includes('stump'));
  deco = buyToStock(deco, hay, 99);
  assert.equal(deco.coins, 1000 - itemById('stump').price - hay.price);
  assert.ok(!deco.zones.garden.placed.includes('stump-hay'), 'mua ở Shop chưa đặt');
  assert.deepEqual([...freshKeys(deco, 'garden')], ['stump']);
  assert.deepEqual(ownedOptions(deco, 'garden', 'stump').map(e => e.id), ['stump', 'stump-hay']);
  deco = useItem(deco, hay);
  assert.ok(deco.zones.garden.placed.includes('stump-hay') && !deco.zones.garden.placed.includes('stump'));
  assert.equal(freshKeys(deco, 'garden').size, 0);
  deco = clearFresh(buyToStock(deco, itemById('fence-wood'), 99), 'garden', 'walls');
  assert.equal(freshKeys(deco, 'garden').size, 0);
  assert.equal(useItem(deco, itemById('fence-wood')).zones.garden.wall, 'fence-wood');
});

test('kinh tế: thưởng không giảm giữa các màn thường; xu luỹ kế đã trừ tiền mở khu / giá món gốc đã mở giảm dần qua từng lô 10 màn tới khu cuối (khu sau khó mua đủ hơn)', async () => {
  const { AREA_UNLOCK } = await import('../gameplay/economy.mjs');
  const sum = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => levelReward(from - 1 + i)).reduce((a, b) => a + b, 0);
  const base = (zone, area) => CATALOG.filter(e => e.zone === zone && e.cat === 'furniture' && !e.slot && e.area === area).reduce((a, e) => a + e.price, 0);
  for (let n = 1; n < 100; n++) assert.ok(levelReward(n) >= levelReward(n - 1), `màn ${n + 1} không thấp hơn màn ${n}`);
  let cost = 0, paid = 0, prev = Infinity;
  for (const [to, zone, area] of [[10, 'garden'], [20, 'garden', 'garden2'], [30, 'living'], [40, 'bedroom'], [50, 'kitchen'], [60, 'bathroom']]) {
    cost += base(zone, area);
    // Khu có mốc màn trong lô này đã được mua (trừ xu) trước khi hết lô.
    paid += Object.values(AREA_UNLOCK).filter(({ level }) => level > to - 10 && level <= to).reduce((t, { cost: c }) => t + c, 0);
    const ratio = (sum(1, to) - paid) / cost;
    // Hai lô đầu (vườn, vườn mở rộng) mua đủ ~100%; từ khu thứ ba giảm dần nhưng không dưới 50%.
    const ok = to <= 20 ? Math.abs(ratio - 1) <= .05 : ratio >= .5 && ratio < prev;
    assert.ok(ok, `hết màn ${to}: còn ${ratio.toFixed(2)} giá món gốc tới ${area || zone} sau khi trả tiền mở khu (lô trước ${prev.toFixed(2)})`);
    prev = ratio;
  }
});

test('event exclusives: not for sale, granted as a reward and placed right away; every event deco reward exists', async () => {
  const { LIVEOPS_CONFIG } = await import('../liveops/config.mjs');
  const { EXCLUSIVES, grantItem, shopStatus, buyToStock, zoneState, isOwned } = await import('./deco-data.mjs');
  // Phần thưởng event là vật phẩm (items); vật phẩm không phải booster là đồ Deco độc quyền
  const rewards = Object.values(LIVEOPS_CONFIG.events.defs).flatMap(def => def.milestones ?? [])
    .flatMap(m => Object.keys(m.reward.items ?? {})).filter(id => !['hammer', 'swap', 'moves'].includes(id));
  assert.ok(rewards.length >= 1);
  rewards.forEach(id => assert.ok(itemById(id)?.exclusive, `${id} is an exclusive catalog item`));
  EXCLUSIVES.forEach(([slot, id]) => assert.equal(itemById(id).slot, slot));
  let deco = loadDeco(99999);
  const koi = itemById('lantern-koi');
  assert.equal(shopStatus(deco, koi, 99), 'exclusive');
  assert.ok(buyToStock(deco, koi, 99).error);
  deco = grantItem(deco, 'lantern-koi');
  assert.ok(isOwned(deco, koi));
  assert.ok(zoneState(deco, 'garden').placed.includes('lantern-koi'));
  assert.equal(deco.coins, 99999, 'reward costs nothing');
  assert.equal(grantItem(deco, 'lantern-koi'), deco, 'granting twice does nothing');
});

test('deco sale discounts buying with coins, then returns to full price', async () => {
  const { setDecoSale, costOf, buyToStock } = await import('./deco-data.mjs');
  const alt = CATALOG.find(e => e.slot && !e.exclusive && e.price > 0 && !e.lock);
  let deco = loadDeco(0);
  deco = { ...deco, zones: { ...deco.zones, [alt.zone]: { ...deco.zones[alt.zone], owned: [...deco.zones[alt.zone].owned, alt.slot] } } };
  setDecoSale(.3);
  try {
    assert.equal(costOf(alt), Math.round(alt.price * .7));
    const bought = buyToStock({ ...deco, coins: costOf(alt) }, alt, 99);
    assert.equal(bought.coins, 0);
  } finally { setDecoSale(0); }
  assert.equal(costOf(alt), alt.price);
});

test('mở khu: theo thứ tự, cần đủ màn + đủ xu, mở là trừ xu', async () => {
  const { AREA_UNLOCK } = await import('../gameplay/economy.mjs');
  setStorageBackend(memoryStore());
  const { level, cost } = AREA_UNLOCK.garden2;
  const fresh = { ...loadDeco(0), coins: cost };
  assert.equal(areaOpen(fresh, 'garden'), true);
  assert.equal(nextArea(fresh), 'garden2');
  assert.equal(areaState(fresh, 'garden2', level - 1), 'level');
  assert.equal(areaState({ ...fresh, coins: cost - 1 }, 'garden2', level), 'coins');
  assert.ok(unlockArea({ ...fresh, coins: cost - 1 }, 'garden2', level).error, 'thiếu 1 xu thì chưa mở');
  assert.equal(areaState(fresh, 'living', 99), 'soon', 'khu trước chưa mở');
  const opened = unlockArea(fresh, 'garden2', level);
  assert.equal(opened.coins, 0, 'mở khu trừ đúng giá');
  assert.equal(areaOpen(opened, 'garden2'), true);
  assert.equal(areaState(opened, 'living', AREA_UNLOCK.living.level), 'coins');
});

test('khu KHÔNG BAO GIỜ tự mở khi nạp save (chỉ mở bằng trả xu), dù đã qua màn mốc', () => {
  const states = [
    null, // chưa có save Deco (lần đầu mở Deco ở màn 20+)
    { ...loadDeco(0), unlocked: undefined }, // save thiếu `unlocked`
    { ...loadDeco(0), unlocked: 'living' }, // save hỏng
    { ...loadDeco(0), unlocked: ['living', 'kitchen', 'nope'] }, // nhảy cóc: chưa mở vườn mở rộng
    { owned: ['sofa'], coins: 0 }, // save kiểu rất cũ
  ];
  for (const saved of states) {
    setStorageBackend(memoryStore());
    if (saved) writeJSON(SAVE_KEYS.deco, saved);
    assert.deepEqual(loadDeco(0).unlocked, [], JSON.stringify(saved));
  }
  setStorageBackend(memoryStore());
  writeJSON(SAVE_KEYS.deco, { ...loadDeco(0), unlocked: ['garden2', 'garden2', 'living'] });
  assert.deepEqual(loadDeco(0).unlocked, ['garden2', 'living'], 'khu đã trả xu thì giữ');
});

test('economy.mjs: mọi món gốc có đúng một dòng giá trong DECO, không có dòng thừa', async () => {
  const { DECO } = await import('../gameplay/economy.mjs');
  const ids = new Set(CATALOG.map(entry => entry.id));
  for (const entry of CATALOG) if (!entry.slot) assert.ok(DECO[entry.id], `thiếu giá cho "${entry.id}" trong game/gameplay/economy.mjs DECO`);
  for (const id of Object.keys(DECO)) assert.ok(ids.has(id), `DECO có "${id}" nhưng danh mục không có món này`);
});

test('món đã bỏ (theme Hồng / Hiện đại, lựa chọn thứ 4 cũ): hoàn xu đúng giá, chỗ đang đặt về món gốc, lưu ngay (mở lại không hoàn thêm)', async () => {
  const { RETIRED } = await import('./deco-data.mjs');
  assert.ok(Object.keys(RETIRED).every(id => !itemById(id) && itemById(RETIRED[id])), 'món đã bỏ không còn trong danh mục, chỗ của nó còn');
  setStorageBackend(memoryStore());
  const deco = loadDeco(0), garden = deco.zones.garden;
  writeJSON(SAVE_KEYS.deco, { ...deco, coins: 10, zones: { ...deco.zones, garden: { ...garden, owned: [...garden.owned, 'stump', 'stump-pink'], placed: [...garden.placed, 'stump-pink'] } } });
  const loaded = loadDeco(0);
  assert.equal(loaded.coins, 10 + itemById('stump').price);
  assert.ok(loaded.zones.garden.placed.includes('stump') && !loaded.zones.garden.owned.includes('stump-pink'));
  assert.equal(loadDeco(0).coins, loaded.coins, 'không hoàn hai lần');
});

test('mỗi khu (kể cả vườn mở rộng) có đúng 10 món mặc định (10 chỗ đặt đồ)', () => {
  const area = e => e.area || e.zone;
  for (const a of ['garden', 'garden2', 'living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder'])
    assert.equal(CATALOG.filter(e => e.cat === 'furniture' && !e.slot && area(e) === a).length, 10, a);
});
