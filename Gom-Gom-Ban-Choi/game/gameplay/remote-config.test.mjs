// Test config từ xa (remote-config.mjs): Firebase ghi đè đúng phần có, sai kiểu thì giữ mặc định. Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

test('remote(): không có config từ xa -> mặc định; có -> ghi đè từng khoá, giữ khoá thiếu; sai kiểu -> bỏ qua', async () => {
  globalThis.__GAME_CONFIG__ = {
    PRICE_T: { hammer: 5 },
    REWARD_T: [1, 2, 3],
    START_T: 'nhiều',
    DECO_T: { stump: { price: 999 }, newItem: { price: 1 } },
  };
  const { remote, REMOTE_APPLIED } = await import(`./remote-config.mjs?t=${Date.now()}`);
  assert.deepEqual(remote('PRICE_T', { hammer: 60, swap: 40 }), { hammer: 5, swap: 40 });
  assert.deepEqual(remote('REWARD_T', [120, 125]), [1, 2, 3]);
  assert.equal(remote('START_T', 0), 0, 'chuỗi thay cho số: giữ mặc định');
  assert.equal(remote('NONE_T', 7), 7);
  assert.deepEqual(remote('DECO_T', { stump: { price: 80, lock: 2 } }), { stump: { price: 999, lock: 2 }, newItem: { price: 1 } });
  assert.throws(() => remote('PRICE_T', {}), /trùng tên/);
  assert.deepEqual(REMOTE_APPLIED, ['PRICE_T', 'REWARD_T', 'DECO_T']);
  delete globalThis.__GAME_CONFIG__;
});
