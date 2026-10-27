// Mua bán dùng chung cho màn chơi + menu (thiết kế: docs/kinh-te-va-monetization.md):
//   thiếu gem → mời gói gem nhỏ nhất đủ bù · mua booster bằng gem · popup hết booster (ads / gem) · phát quà gói IAP · ưu đãi có hạn giờ ·
//   quà gem một lần. Tiền thật đi qua app/iap.js (IAP-SDK), ads qua app/ads.js (ADS-SDK).
import { LEVELS } from '../data/levels.mjs';
import { GEM_PACKS, OFFERS } from '../data/economy.mjs';
import { BOOSTERS } from '../data/tuning.mjs';
import { levelReward, loadProgress, levelsCleared } from '../core/progression.mjs';
import { PACK_SIZE } from '../core/boosters.mjs';
import { addGems, spendGems, grantOnce, openOffer, offerActive, closeOffer, gemsForCoins } from '../core/gems.mjs';
import { playSound } from '../ui/sound.mjs';
import * as ob from './onboarding.js';
import { purchase } from './iap.js';
import { showRewarded, adReady } from './ads.js';
import { ask, showToast, getWallet, setWallet, getDeco, setDeco, getBoosters, storeBoosters, buyOne, BOOSTER_NAMES, priceTag, gemTag, refreshWallet } from './shared.js';

// Xu thưởng của màn đang chơi: đơn vị của túi xu / xu trong ưu đãi (xu lạm phát theo tiến độ, không có tỉ giá cố định).
export const currentReward = () => levelReward(Math.min(LEVELS.length - 1, levelsCleared(loadProgress())));

// ===== Phát quà một gói (gói gem, ưu đãi): gems, boosters (mỗi loại), coins (cố định) + coinLevels (× thưởng màn) =====
const coinsOf = product => (product.coins ?? 0) + (product.coinLevels ?? 0) * currentReward();
export function grant(product) {
  if (product.gems) setWallet(addGems(getWallet(), product.gems));
  if (product.boosters) storeBoosters(Object.fromEntries(Object.entries(getBoosters()).map(([id, n]) => [id, n + product.boosters])));
  const coins = coinsOf(product);
  if (coins) setDeco({ ...getDeco(), coins: getDeco().coins + coins });
  refreshWallet();
  playSound('reward');
}
// Dòng mô tả nội dung gói (HTML).
export const contentsOf = product => [product.gems && gemTag(product.gems), product.boosters && `${product.boosters}× every booster`,
  coinsOf(product) && `<i class="ico-coin"></i>${coinsOf(product).toLocaleString('en-US')}`].filter(Boolean).join(' · ');

export async function buyGemPack(pack) {
  if (!(await purchase({ id: pack.id, usd: pack.usd, title: `${pack.gems.toLocaleString('en-US')} gems` }))) return false; // IAP-SDK
  grant(pack);
  showToast(`+${pack.gems} gems!`);
  return true;
}

// Bảng gói gem mở đè: chỉ dùng khi Shop chưa mở (trước bước hướng dẫn Decoration, màn 5) mà người chơi đã thiếu gem.
// `short` > 0: nhắc còn thiếu bao nhiêu. Trả về true nếu đã mua một gói.
export async function openGemStore(short = 0) {
  const choice = await ask({
    title: 'Buy gems', className: 'gem-store',
    body: short > 0 ? `<p class="level-feature">You need ${gemTag(short)} more.</p>` : '',
    choices: [...GEM_PACKS.map((pack, i) => ({ id: String(i),
      label: `<span class="gs-gems">${gemTag(pack.gems.toLocaleString('en-US'))}${pack.tag ? `<small>${pack.tag}</small>` : ''}</span><span class="gs-price">$${pack.usd.toFixed(2)}</span>` })),
    { id: 'close', label: 'Close', style: 'ghost' }],
  });
  return choice !== null && choice !== 'close' && buyGemPack(GEM_PACKS[Number(choice)]);
}

// ===== Gem: đủ thì true; thiếu thì hỏi "Buy gems" → chuyển thẳng tới mục Gems của Shop (sự kiện 'gomgom:gem-shop', menu/shop.js mở) =====
// Việc đang mua dở bị huỷ (trả false). Đang trong ván thì ván kết thúc: bên gọi kiểm tookGemShopTrip() để ghi thua / bỏ ngang.
let gemShopTrip = false;
export const tookGemShopTrip = () => { const took = gemShopTrip; gemShopTrip = false; return took; };
export async function ensureGems(cost) {
  const short = cost - getWallet().gems;
  if (short <= 0) return true;
  const choice = await ask({
    title: 'Not enough gems', icon: './assets/img/shop/gem-packs/gems_200-modern.png',
    body: `<p class="level-feature">You need ${gemTag(short)} more.</p>`,
    choices: [{ id: 'buy', label: 'Buy gems' }, { id: 'no', label: 'Not now', style: 'ghost' }],
  });
  if (choice !== 'buy') return false;
  if (!ob.tabOpen('shop')) return (await openGemStore(short)) && getWallet().gems >= cost;
  gemShopTrip = true;
  dispatchEvent(new Event('gomgom:gem-shop'));
  return false;
}
// Trả gem (mời mua nếu thiếu). true = đã trừ.
export async function payGems(cost) {
  if (!(await ensureGems(cost))) return false;
  setWallet(spendGems(getWallet(), cost));
  return true;
}

// ===== Thiếu xu: trả hết xu đang có + bù phần thiếu bằng gem (COIN_TOP_UP), không có túi xu =====
// Đủ xu thì true ngay. Thiếu thì hỏi; đồng ý = trừ gem (thiếu gem thì mời gói gem) rồi cộng đúng phần thiếu vào ví xu,
// để chỗ gọi mua như bình thường (trừ hết xu). true = ví đã đủ `cost` xu.
export async function coverCoins(cost, what = 'this') {
  const coins = getDeco().coins, short = cost - coins;
  if (short <= 0) return true;
  const gems = gemsForCoins(short, currentReward());
  const choice = await ask({
    title: 'Not enough coins', icon: './assets/img/idle-reward/coin-stack.png',
    body: `<p class="level-feature">You need <i class="ico-coin"></i>${short.toLocaleString('en-US')} more for ${what}. Use all your coins and pay the rest with gems?</p>`,
    choices: [{ id: 'pay', label: `Buy · ${gemTag(gems)}` }, { id: 'no', label: 'Not now', style: 'ghost' }],
  });
  if (choice !== 'pay' || !(await payGems(gems))) return false;
  setDeco({ ...getDeco(), coins: getDeco().coins + short });
  refreshWallet();
  console.info(`[analytics] coin top-up ${short} coins for ${gems} gems`);
  return true;
}

// ===== Booster =====
// Mua 1 cái / gói ×3 bằng gem, thiếu gem thì mời gói gem rồi mua tiếp. true = đã mua.
export async function buyBooster(id, pack = false) {
  let result = buyOne(id, pack);
  if (result.short && (await ensureGems((pack ? BOOSTERS.PACK_PRICE : BOOSTERS.PRICE)[id]))) result = buyOne(id, pack);
  return !!result.ok;
}
// Popup khi chạm booster đã hết trong ván: xem ads nhận 1 · mua 1 · mua gói ×3. true = kho đã có booster.
export async function offerBooster(id) {
  const choices = [
    adReady('booster') && { id: 'ad', label: '▶ Watch ad: +1', style: 'ad' },
    { id: 'one', label: `+1 · ${priceTag(id)}` },
    { id: 'pack', label: `+${PACK_SIZE} · ${priceTag(id, true)}` },
    { id: 'no', label: 'Not now', style: 'ghost' },
  ].filter(Boolean);
  const choice = await ask({ title: BOOSTER_NAMES[id], icon: `./assets/img/play/booster-${id}.png`, body: `<p class="level-feature">None left! You have ${gemTag(getWallet().gems)}</p>`, choices });
  if (choice === 'ad') {
    if (!(await showRewarded('booster'))) return false; // ADS-SDK: chỗ đặt "booster"
    storeBoosters({ ...getBoosters(), [id]: getBoosters()[id] + 1 });
    playSound('reward');
    return true;
  }
  if (choice === 'one' || choice === 'pack') return buyBooster(id, choice === 'pack');
  return false;
}

// ===== Quà gem một lần (paywall / boss / mở khu / thú cưng mới): trả về số gem nhận (0 = đã nhận trước đó) =====
export function grantGems(key, amount) {
  const { wallet, amount: got } = grantOnce(getWallet(), key, amount);
  if (got) setWallet(wallet);
  return got;
}

// ===== Ưu đãi có hạn giờ (OFFERS) =====
export const OFFER_NAMES = { starter: 'Starter Pack', rescue: 'Rescue Pack', builder: 'Builder Pack' };
// Bật một ưu đãi (đúng điều kiện thời gian chờ / một lần). true = vừa bật.
export function triggerOffer(kind) {
  const next = openOffer(getWallet(), kind, Date.now());
  if (next) setWallet(next);
  return !!next;
}
export const timeLeft = kind => {
  const ms = Math.max(0, (getWallet().offers[kind]?.until ?? 0) - Date.now()), h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};
export async function buyOffer(kind) {
  const offer = OFFERS[kind];
  if (!offerActive(getWallet(), kind, Date.now())) return false;
  if (!(await purchase({ id: offer.id, usd: offer.usd, title: OFFER_NAMES[kind] }))) return false; // IAP-SDK
  grant(offer);
  setWallet(closeOffer(getWallet(), kind));
  showToast(`${OFFER_NAMES[kind]} unlocked!`);
  return true;
}
// Popup ưu đãi (bật lên một lần lúc kích hoạt; sau đó vẫn ở đầu Shop tới khi hết giờ).
export async function showOffer(kind) {
  const offer = OFFERS[kind];
  const choice = await ask({
    title: OFFER_NAMES[kind], className: 'offer', icon: './assets/img/home/icon-starter-matte.png',
    body: `<p class="offer-contents">${contentsOf(offer)}</p><p class="level-feature">Ends in ${timeLeft(kind)}</p>`,
    choices: [{ id: 'buy', label: `$${offer.usd.toFixed(2)}` }, { id: 'no', label: 'Later', style: 'ghost' }],
  });
  return choice === 'buy' && buyOffer(kind);
}
