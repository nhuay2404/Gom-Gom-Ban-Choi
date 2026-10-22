// Ví gem + bộ đếm rewarded ads theo ngày + quà gem một lần + ưu đãi IAP có hạn giờ (thuần logic, không đụng DOM).
// Số liệu ở data/economy.mjs; thiết kế: docs/kinh-te-va-monetization.md. Sang Unity: class GemWallet.
//
// Save (SAVE_KEYS.gems): { gems, ads: { day, counts: { <chỗ đặt>: n } }, granted: [khoá quà đã nhận], continues: số lần continue
//   paywall miễn phí đã dùng, offers: { <loại>: { until, last, done } } }
import { START_GEMS, REWARDED_ADS, OFFERS, COIN_TOP_UP } from '../data/economy.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

const DAY = 864e5;
// Ngày theo giờ máy người chơi: giới hạn ads reset lúc 0h địa phương.
export const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function normalizeWallet(saved) {
  const w = saved && typeof saved === 'object' ? saved : {};
  return {
    gems: Number.isInteger(w.gems) && w.gems >= 0 ? w.gems : START_GEMS,
    ads: w.ads && typeof w.ads.day === 'string' && w.ads.counts && typeof w.ads.counts === 'object' ? w.ads : { day: '', counts: {} },
    granted: Array.isArray(w.granted) ? w.granted : [],
    freeContinueUsed: !!w.freeContinueUsed,
    offers: w.offers && typeof w.offers === 'object' ? w.offers : {},
  };
}
export const loadWallet = () => normalizeWallet(readJSON(SAVE_KEYS.gems));
export function saveWallet(wallet) { writeJSON(SAVE_KEYS.gems, wallet); }

// Gem để bù `short` xu đang thiếu, khi thưởng của màn đang chơi là `reward` xu (COIN_TOP_UP).
export const gemsForCoins = (short, reward) => (short <= 0 ? 0 : Math.max(COIN_TOP_UP.minGems, Math.ceil(short / Math.max(1, reward) * COIN_TOP_UP.gemsPerLevel)));
export const addGems = (w, n) => ({ ...w, gems: w.gems + Math.max(0, Math.round(n)) });
// Trừ gem; không đủ thì null.
export const spendGems = (w, n) => (w.gems >= n ? { ...w, gems: w.gems - n } : null);
// Quà gem chỉ nhận một lần theo khoá (vd. 'boss:19', 'area:living', 'pet:cat-gray'): trả về { wallet, amount } (amount 0 = đã nhận rồi).
export function grantOnce(w, key, n) {
  if (!n || w.granted.includes(key)) return { wallet: w, amount: 0 };
  return { wallet: { ...addGems(w, n), granted: [...w.granted, key] }, amount: n };
}

// ===== Rewarded ads: số lần còn xem được hôm nay ở một chỗ đặt =====
export const adsUsed = (w, placement, now) => (w.ads.day === dayKey(now) ? w.ads.counts[placement] || 0 : 0);
// Trần null = không giới hạn (Infinity); chỗ đặt không khai trần = 0.
export const adsLeft = (w, placement, now) => {
  const cap = REWARDED_ADS.caps[placement];
  return cap === null ? Infinity : Math.max(0, (cap ?? 0) - adsUsed(w, placement, now));
};
// Xu thêm khi xem ads ở bảng thắng: tỉ lệ theo lần xem thứ mấy hôm nay (REWARDED_ADS.coinBonus), làm tròn.
export const bonusCoins = (w, coins, now) => {
  const list = REWARDED_ADS.coinBonus;
  return Math.round(coins * list[Math.min(adsUsed(w, 'bonusCoins', now), list.length - 1)]);
};
export function noteAd(w, placement, now) {
  const day = dayKey(now), counts = w.ads.day === day ? { ...w.ads.counts } : {};
  counts[placement] = (counts[placement] || 0) + 1;
  return { ...w, ads: { day, counts } };
}

// ===== Ưu đãi có hạn giờ (OFFERS): mở (nếu được), đang chạy, đã mua =====
// starter: một lần trong đời. rescue / builder: lần mở sau cách lần trước ≥ cooldownDays ngày. Đang chạy thì không mở lại.
export function openOffer(w, kind, now) {
  const cfg = OFFERS[kind], o = w.offers[kind] || {};
  if (!cfg || o.done || (o.until && o.until > now)) return null;
  if (kind === 'starter' && o.until) return null;
  if (cfg.cooldownDays && o.last && now - o.last < cfg.cooldownDays * DAY) return null;
  return { ...w, offers: { ...w.offers, [kind]: { ...o, until: now + cfg.hours * 36e5, last: now } } };
}
export const offerActive = (w, kind, now) => { const o = w.offers[kind]; return !!o && !o.done && o.until > now; };
export const activeOffers = (w, now) => Object.keys(OFFERS).filter(kind => offerActive(w, kind, now));
// Mua xong: starter khoá vĩnh viễn, loại khác chỉ đóng lượt đang chạy.
export const closeOffer = (w, kind) => ({ ...w, offers: { ...w.offers, [kind]: { ...w.offers[kind], until: 0, done: kind === 'starter' } } });
