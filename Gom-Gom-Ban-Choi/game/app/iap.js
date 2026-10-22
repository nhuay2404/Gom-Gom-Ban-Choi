// =====================================================================================================================
//  IAP-SDK — MUA BẰNG TIỀN THẬT ĐANG GIẢ LẬP (hộp xác nhận "Simulated purchase", không trừ tiền)
// =====================================================================================================================
//  Bàn giao dev: thay thân hàm `purchase()` bằng billing của store (Google Play Billing / StoreKit, qua plugin Capacitor).
//  product.id = product id trên store (gói gem: GEM_PACKS[].id, ưu đãi: OFFERS.<loại>.id trong data/economy.mjs). Mọi lần mua
//  đi qua đây và app/store.js phát quà khi purchase() trả về true. Giá hiển thị nên lấy từ store (giá theo vùng) thay cho usd.
//  `grep -rn "IAP-SDK" game` ra đủ chỗ.
// =====================================================================================================================
import { ask } from './shared.js';

// product: { id, usd, title }. Trả về Promise<boolean>: true = giao dịch thành công (đã xác thực), false = huỷ / lỗi.
export async function purchase(product) {
  const choice = await ask({
    title: product.title,
    body: `<p class="level-feature">Simulated purchase (test build): no real money is charged.</p>`,
    choices: [{ id: 'buy', label: `Buy $${product.usd.toFixed(2)}` }, { id: 'cancel', label: 'Cancel', style: 'ghost' }],
  });
  // IAP-SDK: gửi analytics (iap_purchase + product.id + giá) và xác thực hoá đơn ở đây.
  console.info(`[iap] ${product.id}: ${choice === 'buy' ? 'purchased' : 'cancelled'}`);
  return choice === 'buy';
}
