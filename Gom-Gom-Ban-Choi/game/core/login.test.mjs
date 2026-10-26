import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLogin, claimLogin, canClaimLogin, loginDone, loginDays, loginCoins } from './login.mjs';
import { setStorageBackend } from './save.mjs';
import { LOGIN_CALENDAR } from '../data/economy.mjs';
import { shopCatalog, isExclusive, itemById, giftItem, loadDeco } from '../deco/deco-data.mjs';

const DAY = 864e5, T = new Date(2026, 9, 26, 9).getTime();
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

test('quà đăng nhập: ngày 1 nhận ngay; hai lần trong một ngày chỉ nhận một', () => {
  setStorageBackend(mem());
  let s = loadLogin();
  assert.equal(s.claimed, 0, 'save trống = bắt đầu từ ô 1');
  const a = claimLogin(s, T);
  assert.equal(a.index, 0);
  s = a.state;
  assert.equal(canClaimLogin(s, T + 3600e3), false);
  assert.ok(claimLogin(s, T + 3600e3).error, 'cùng ngày không nhận lần hai');
});

test('quà đăng nhập: nghỉ nhiều ngày thì nhận ô kế (không reset, không bỏ ô); đủ 7 ô thì hết', () => {
  let s = claimLogin(loadLogin(), T).state;
  const b = claimLogin(s, T + 9 * DAY);
  assert.equal(b.index, 1, 'nghỉ 9 ngày vẫn là ô 2');
  s = b.state;
  for (let d = 10; s.claimed < loginDays(); d++) s = claimLogin(s, T + d * DAY).state;
  assert.equal(loginDone(s), true);
  assert.ok(claimLogin(s, T + 99 * DAY).error);
});

test('quà đăng nhập: đồng hồ lùi về trước lần nhận cuối thì chưa cho nhận', () => {
  const s = claimLogin(loadLogin(), T).state;
  assert.equal(canClaimLogin(s, T - 2 * DAY), false);
  assert.equal(canClaimLogin(s, T + DAY), true);
});

test('quà đăng nhập: xu cố định; món quà độc quyền không bán ở Shop; tặng món đã có thì trả null', () => {
  const coinCell = LOGIN_CALENDAR.find(c => c.coins);
  assert.equal(loginCoins(coinCell), coinCell.coins, 'xu không đổi theo màn');
  const gift = itemById(LOGIN_CALENDAR.find(c => c.item).item);
  assert.ok(isExclusive(gift));
  assert.ok(!shopCatalog(gift.zone).includes(gift), 'rút khỏi Shop');
  const deco = loadDeco(0), got = giftItem(deco, gift);
  assert.ok(got.zones[gift.zone].owned.includes(gift.id) && got.fresh.includes(gift.id));
  assert.equal(got.coins, deco.coins, 'tặng không trừ xu');
  assert.equal(giftItem(got, gift), null);
});
