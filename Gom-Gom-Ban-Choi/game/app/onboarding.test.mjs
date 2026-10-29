// Test chuyển bước onboarding (onboarding.js): mới chơi, hộp quà Deco (hai thứ tự, tắt game khi hộp chưa mở), save cũ. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEYS, setStorageBackend, writeText, readText } from '../core/save.mjs';
import * as ob from './onboarding.js';
import { itemById, applyAction } from '../deco/deco-data.mjs';
import { levelReward } from '../core/progression.mjs';

const memory = () => {
  const data = new Map();
  return { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
};
// Mở game với save có sẵn (bước onboarding + sao các màn).
function boot({ stage = null, stars = [] } = {}) {
  setStorageBackend(memory());
  if (stage) writeText(SAVE_KEYS.onboarding, stage);
  if (stars.length) win(stars.length - 1, stars);
  return ob.reloadStage();
}
function win(index, stars = null) {
  const progress = { stars: stars ?? JSON.parse(readText(SAVE_KEYS.progress) ?? '{"stars":[]}').stars };
  progress.stars[index] ||= 3;
  writeText(SAVE_KEYS.progress, JSON.stringify(progress));
  return ob.unlockOnWin(index);
}
const emptyGarden = { coins: 0, zones: { garden: { owned: [], placed: [] } } };

test('quà: hộp món đồ = bồn hoa, món dạy mua = Tree stump, hộp xu = xu màn 1 + 2 + 3 (đủ mua)', () => {
  assert.equal(ob.itemGift(emptyGarden).id, 'flowers');
  const withFlowers = { ...emptyGarden, zones: { garden: { owned: [], placed: ['flowers-tulips'] } } };
  assert.ok(ob.giftPlaced(withFlowers) && ob.itemGift(withFlowers).id === 'stump', 'save cũ đã có bồn hoa: quà là món gốc rẻ nhất');
  const after = applyAction(emptyGarden, itemById('flowers'), 1);
  assert.ok(ob.giftPlaced(after) && after.coins === 0, 'bồn hoa miễn phí, đặt luôn');
  const buy = ob.nextBase(after);
  assert.equal(buy.id, 'stump');
  const coins = ob.coinGift(after);
  assert.equal(coins, levelReward(0) + levelReward(1) + levelReward(2));
  assert.ok(coins >= buy.price);
  assert.equal(ob.coinGift({ ...after, zones: { garden: { owned: ['stump', 'catnip', 'lantern', 'sandbox', 'cathouse', 'birdbath', 'bench'], placed: [] } } }), Math.max(coins, itemById('pond').price), 'bù thêm cho đủ món còn lại');
});

test('mới chơi: L1 -> mèo, hộp món màn 2, hộp xu màn 3, màn 5 mở tính năng', () => {
  assert.equal(boot(), 'L1');
  assert.ok(!ob.tabOpen('deco') && !ob.walletShown() && !ob.featuresOpen());
  assert.equal(win(0), 'cat');
  assert.equal(readText(SAVE_KEYS.onboarding), 'gifts', 'lưu ngay lúc thắng');
  assert.ok(ob.tabOpen('deco') && !ob.tabOpen('shop'));
  assert.ok(ob.coinsDeferred(0) && ob.coinsDeferred(2) && !ob.coinsDeferred(3), 'màn 1–3 dồn xu vào hộp');
  assert.equal(ob.giftsWaiting(), 0);
  assert.equal(win(1), 'gift');
  assert.equal(ob.giftsWaiting(), 1);
  assert.equal(ob.unlockOnWin(1, false), null, 'thắng lại màn 2: không báo hộp mới');
  assert.ok(!ob.buildOpen(itemById('stump'), emptyGarden), 'chưa mở hộp: chưa chạm được món');
  assert.equal(ob.openGift(), 'item');
  assert.equal(ob.tourPending(), 'item');
  assert.equal(ob.openGift(), null, 'hết hộp');
  writeText(SAVE_KEYS.decoTour, 'styles');
  assert.equal(ob.tourPending(), null);
  assert.ok(!ob.buildOpen(itemById('catnip'), emptyGarden) && !ob.walletShown());
  assert.equal(win(2), 'gift');
  assert.equal(ob.openGift(), 'coins');
  assert.ok(ob.walletShown() && ob.tourPending() === 'coins');
  assert.ok(ob.buildOpen(itemById('catnip'), emptyGarden) && !ob.buildOpen(itemById('stump-hay'), emptyGarden), 'mua được món gốc, chưa mua được kiểu');
  assert.ok(!ob.coinsDeferred(2), 'đã có hộp xu: thắng lại / màn sau trả xu bình thường');
  assert.equal(win(3), null);
  assert.equal(win(4), 'features');
  assert.ok(ob.featuresOpen() && ob.tabOpen('shop') && !ob.active());
});

test('hai hộp cùng lúc: hộp mở trước luôn là món đồ, hộp sau luôn là xu (thứ tự chạm không quan trọng)', () => {
  boot();
  win(0); win(1); win(2);
  assert.equal(ob.giftsWaiting(), 2);
  assert.deepEqual([ob.openGift(), ob.openGift(), ob.openGift()], ['item', 'coins', null]);
});

test('tắt game khi hộp chưa mở / giữa hướng dẫn: mở lại vẫn còn đúng hộp và hướng dẫn', () => {
  boot();
  win(0); win(1); win(2);
  assert.equal(ob.reloadStage(), 'gifts');
  assert.equal(ob.giftsWaiting(), 2);
  ob.openGift();
  assert.equal(ob.reloadStage(), 'gifts');
  assert.equal(ob.giftsWaiting(), 1);
  assert.equal(ob.tourPending(), 'item');
});

test('save cũ: theo bước cũ, không mất xu / đồ, không kẹt', () => {
  for (const stage of ['basics', 'build', 'L2']) {
    assert.equal(boot({ stage, stars: [3] }), 'gifts', stage);
    assert.ok(ob.opened() === 0 && ob.tabOpen('deco') && !ob.walletShown(), stage);
  }
  assert.equal(boot({ stage: 'L2', stars: [3, 3] }), 'gifts');
  assert.equal(ob.giftsWaiting(), 1);
  for (const stage of ['cats', 'free']) {
    assert.equal(boot({ stage, stars: [3, 3, 3] }), 'gifts', stage);
    assert.ok(ob.walletShown() && ob.giftsWaiting() === 0 && !ob.featuresOpen() && !ob.coinsDeferred(2) && !ob.tourPending(), stage);
  }
  for (const stage of ['decor', 'done']) {
    assert.equal(boot({ stage, stars: [3, 3, 3, 3, 3] }), 'done', stage);
    assert.ok(ob.walletShown() && ob.featuresOpen() && ob.giftsWaiting() === 0 && !ob.tourPending(), stage);
  }
  assert.equal(boot({ stars: [3, 2] }), 'done', 'người chơi cũ chưa có bước');
  assert.ok(ob.walletShown() && ob.giftsWaiting() === 0);
  assert.equal(boot({ stage: 'nonsense' }), 'L1');
});

test('người mới còn sót khoá hộp cũ (Dev: Reset trước đây không xoá): bắt đầu lại từ 0 hộp, không ví, xu dồn hộp', () => {
  setStorageBackend(memory());
  writeText(SAVE_KEYS.gifts, '2');
  writeText(SAVE_KEYS.decoTour, 'done');
  assert.equal(ob.reloadStage(), 'L1');
  assert.ok(ob.opened() === 0 && !ob.walletShown() && ob.coinsDeferred(0));
});

test('thắng màn 5 mà chưa mở hộp nào: ví vẫn hiện, hộp vẫn chờ', () => {
  boot();
  [0, 1, 2, 3].forEach(i => win(i));
  assert.equal(win(4), 'features');
  assert.ok(ob.walletShown() && ob.giftsWaiting() === 2);
});

test('thùng thú cưng: thắng màn 1 có thùng mèo cam chờ mở, mốc ở Map thêm thùng, mở thì bỏ khỏi hàng, mở lại game vẫn còn', () => {
  boot();
  assert.deepEqual(ob.petBoxes(), []);
  win(0);
  assert.deepEqual(ob.petBoxes(), ['orange']);
  ob.addPetBox('gray'); ob.addPetBox('gray');
  ob.reloadStage();
  assert.deepEqual(ob.petBoxes(), ['orange', 'gray'], 'lưu ngay, không trùng');
  ob.removePetBox('orange');
  assert.deepEqual(ob.petBoxes(), ['gray']);
});
