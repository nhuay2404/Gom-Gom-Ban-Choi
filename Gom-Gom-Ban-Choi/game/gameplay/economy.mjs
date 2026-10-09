// ===================================================================================================================
//  KINH TẾ GAME — MỌI CON SỐ VỀ XU (nguồn vào / chỗ tiêu) NẰM Ở FILE NÀY. Sửa số ở đây là game đổi theo.
// ===================================================================================================================
//  Xem kết quả sau khi sửa:   npm run economy        (in bảng theo từng stage + ghi ra docs/economy-report.md)
//  Kiểm tra không gãy gì:     npm test
//
//  Mục lục
//    1. NGUỒN XU (source)  — xu ban đầu, xu thưởng mỗi màn, quà, gói xu
//    2. CHỖ TIÊU (sink)    — giá booster, giá đồ trang trí (DECO)
//    3. CÁCH ĐỌC BẢNG DECO — price / lock
//
//  Quy ước: "màn" đánh số từ 1 như người chơi thấy. 1 stage = 10 màn (stage 1 = màn 1–10, stage 2 = màn 11–20 ...).
//  File này chỉ chứa DỮ LIỆU (không có logic) để dễ sửa; code đọc nó ở gameplay/tuning.mjs và deco/deco-data.mjs.
//  Mỗi hằng số khai bằng remote('TÊN', mặc định): số ở đây là MẶC ĐỊNH; trên Firebase Remote Config có tham số cùng TÊN
//  thì game dùng số trên Firebase (xem docs/FIREBASE.md). Đổi mặc định ở đây xong thì `npm run firebase:template` để cập nhật template.
// ===================================================================================================================
import { remote } from './remote-config.mjs';

// -------------------------------------------------------------------------------------------------------------------
// 1. NGUỒN XU (SOURCE)
// -------------------------------------------------------------------------------------------------------------------

// Xu có sẵn khi mới vào game (trước khi thắng màn nào).
export const START_COINS = remote('START_COINS', 0);

// Xu thưởng khi thắng một màn LẦN ĐẦU (chơi lại màn đã thắng không ra xu; không phụ thuộc số sao).
// Mỗi dòng = 1 stage (10 màn). Màn ngoài bảng nhận REWARD_BEYOND.
export const LEVEL_REWARD = remote('LEVEL_REWARD', [
  /* stage 1: màn  1–10 */ 120, 125, 130, 135, 140, 143, 146, 150, 152, 154,
  /* stage 2: màn 11–20 */ 155, 157, 159, 161, 162, 164, 166, 168, 170, 172,
  /* stage 3: màn 21–30 */  90,  92,  94,  96,  97,  98, 100, 101, 103, 105,
  /* stage 4: màn 31–40 */  96,  98,  99, 100, 101, 102, 103, 104, 105, 106,
  /* stage 5: màn 41–50 */  80,  80,  80,  80,  80,  80,  80,  80,  80,  80,
  // Stage 6–10 (màn 51–100, sinh bằng tools/generate-levels.mjs): không mở khu Deco mới, xu dùng mua các kiểu khác / tường / sàn còn lại.
  // Tăng dần ~4 xu mỗi stage; màn boss (x0) +10.
  /* stage 6: màn 51–60 */ 100, 101, 102, 103, 104, 105, 106, 107, 108, 119,
  /* stage 7: màn 61–70 */ 104, 105, 106, 107, 108, 109, 110, 111, 112, 123,
  /* stage 8: màn 71–80 */ 108, 109, 110, 111, 112, 113, 114, 115, 116, 127,
  /* stage 9: màn 81–90 */ 112, 113, 114, 115, 116, 117, 118, 119, 120, 131,
  /* stage 10: màn 91–100 */ 116, 117, 118, 119, 120, 121, 122, 123, 124, 135,
]);
export const REWARD_BEYOND = remote('REWARD_BEYOND', 80); // xu mỗi màn ngoài bảng trên (từ màn 101 trở đi)

// Hướng dẫn Decoration (sau khi thắng màn 5): nếu người chơi không đủ xu mua món rẻ nhất thì bù cho đủ.
// true = bù (người chơi chắc chắn mua được món đầu tiên trong hướng dẫn), false = không bù.
export const TUTORIAL_TOP_UP = remote('TUTORIAL_TOP_UP', true);

// Quà an ủi: người chơi sắp bỏ game (thua liên tục) thì lần thắng kế tiếp được tặng bấy nhiêu booster +lượt.
export const COMEBACK_GIFT_MOVES = remote('COMEBACK_GIFT_MOVES', 1);

// Gói xu trong Shop (tiền thật — hiện mới là "coming soon", chưa bán). coins = xu nhận, usd = giá hiển thị.
export const COIN_PACKS = remote('COIN_PACKS', [
  { coins: 500, usd: 0.99 },
  { coins: 1200, usd: 1.99 },
  { coins: 3000, usd: 4.99 },
]);
// Gói khởi đầu (Starter pack — "coming soon"): giá hiển thị.
export const STARTER_PACK = remote('STARTER_PACK', { usd: 1.99 });

// -------------------------------------------------------------------------------------------------------------------
// 2. CHỖ TIÊU (SINK)
// -------------------------------------------------------------------------------------------------------------------

// Booster: giá mua 1 cái bằng xu, số tặng sẵn mỗi loại khi mở booster, màn bắt đầu có booster.
export const BOOSTER_PRICE = remote('BOOSTER_PRICE', { hammer: 60, swap: 40, moves: 80 });
export const BOOSTER_START_STOCK = remote('BOOSTER_START_STOCK', 3);
export const BOOSTER_UNLOCK_LEVEL = remote('BOOSTER_UNLOCK_LEVEL', 3);
export const BOOSTER_EXTRA_MOVES = remote('BOOSTER_EXTRA_MOVES', 3); // booster +lượt cộng bấy nhiêu lượt

// -------------------------------------------------------------------------------------------------------------------
// 3. ĐỒ TRANG TRÍ (DECO) — giá + màn mở khoá của từng món
// -------------------------------------------------------------------------------------------------------------------
//  price : giá xu. 0 = có sẵn miễn phí (không cần mua).
//  lock  : phải mở tới màn này (thắng màn lock − 1) thì mới mua được. Bỏ trống = mua được ngay khi khu đó mở.
//          Khu mở khi thắng: Vườn = từ đầu · Vườn mở rộng = màn 10 · Phòng khách = màn 20 · Phòng ngủ = màn 30 · Bếp = màn 40.
//  Mỗi món đồ có 1–2 "kiểu khác" (vd. Tree stump → Hay bale, Apple crate): kiểu khác lấy CÙNG giá / lock với món gốc.
//  Muốn kiểu khác có giá riêng thì thêm một dòng cho id của nó, vd.  'stump-hay': { price: 120 },
//  (id kiểu khác xem VARIANTS trong game/deco/deco-data.mjs). Thêm / bớt món mới: phải có dòng ở đây (npm test kiểm).
export const DECO = remote('DECO', {
  // --- Vườn — đồ ---
  flowers:               { price: 0 },                // Flower bed
  stump:                 { price: 80 },               // Tree stump
  catnip:                { price: 90 },               // Catnip bush
  lantern:               { price: 100 },              // Lantern
  sandbox:               { price: 120 },              // Sandbox
  cathouse:              { price: 150 },              // Cat house
  pond:                  { price: 200, lock: 3 },     // Koi pond
  hammock:               { price: 240, lock: 4 },     // Hammock
  birdbath:              { price: 180, lock: 6 },     // Bird bath
  bench:                 { price: 220, lock: 8 },     // Bench
  // --- Vườn — tường / rào ---
  'fence-white':         { price: 0 },                // White picket
  'fence-wood':          { price: 100 },              // Wood fence
  'fence-hedge':         { price: 100 },              // Hedge
  'fence-stone':         { price: 100, lock: 7 },     // Stone wall
  // --- Vườn — sàn / nền ---
  'ground-grass':        { price: 0 },                // Grass
  'ground-clover':       { price: 100 },              // Clover
  'ground-meadow':       { price: 100 },              // Meadow
  'ground-path':         { price: 100, lock: 5 },     // Stone path
  // --- Phòng khách — đồ ---
  rug:                   { price: 0 },                // Pink rug
  armchair:              { price: 120 },              // Armchair
  plant:                 { price: 90 },               // Plant
  yarn:                  { price: 80 },               // Yarn basket
  catbed:                { price: 150 },              // Cat bed
  table:                 { price: 180 },              // Side table
  lamp:                  { price: 200 },              // Floor lamp
  cattree:               { price: 260 },              // Cat tree
  shelf:                 { price: 220 },              // Bookshelf
  tank:                  { price: 300 },              // Fish tank
  // --- Phòng khách — tường / rào ---
  'wall-cream':          { price: 0 },                // Cream
  'wall-mint':           { price: 100 },              // Mint
  'wall-peach':          { price: 100 },              // Peach
  'wall-sky':            { price: 100 },              // Sky
  'wall-lilac':          { price: 100 },              // Lilac
  'wall-concrete':       { price: 100 },              // Concrete
  'wall-graphite':       { price: 100 },              // Graphite
  // --- Phòng khách — sàn / nền ---
  'floor-oak':           { price: 0 },                // Oak
  'floor-walnut':        { price: 100 },              // Walnut
  'floor-carpet':        { price: 100 },              // Pink carpet
  'floor-tiles':         { price: 100 },              // Mint tiles
  'floor-concrete':      { price: 100 },              // Polished concrete
  'floor-ebony':         { price: 100 },              // Ebony wood
  // --- Phòng ngủ — đồ ---
  bed:                   { price: 0 },                // Cozy bed
  bedrug:                { price: 0 },                // Fluffy rug
  laundry:               { price: 100, lock: 36 },    // Laundry basket
  bedside:               { price: 120, lock: 36 },    // Bedside table
  desk:                  { price: 260, lock: 36 },    // Gaming desk
  chair:                 { price: 180, lock: 37 },    // Gaming chair
  closet:                { price: 220, lock: 37 },    // Closet
  plushie:               { price: 150, lock: 38 },    // Teddy bear
  catsteps:              { price: 240, lock: 39 },    // Wall steps
  // --- Phòng ngủ — tường / rào ---
  'bwall-lavender':      { price: 0 },                // Lavender
  'bwall-blush':         { price: 100 },              // Blush
  'bwall-sage':          { price: 100 },              // Sage
  'bwall-butter':        { price: 100 },              // Butter
  'bwall-night':         { price: 100 },              // Night blue
  'bwall-slate':         { price: 100 },              // Slate
  'bwall-charcoal':      { price: 100 },              // Charcoal
  // --- Phòng ngủ — sàn / nền ---
  'bfloor-oak':          { price: 0 },                // Oak
  'bfloor-maple':        { price: 100 },              // Maple
  'bfloor-ash':          { price: 100 },              // Ash wood
  'bfloor-carpet':       { price: 100 },              // Lilac carpet
  'bfloor-tiles':        { price: 100 },              // Peach tiles
  'bfloor-graphite-tiles': { price: 100 },              // Graphite tiles
  'bfloor-smoke-carpet': { price: 100 },              // Smoke carpet
  // --- Bếp — đồ ---
  sink:                  { price: 0 },                // Sink counter
  dining:                { price: 0 },                // Dining table
  fridge:                { price: 220 },              // Fridge
  stove:                 { price: 240 },              // Stove
  pantry:                { price: 200 },              // Pantry cupboard
  kchair:                { price: 120 },              // Dining chairs (set of 4)
  catfood:               { price: 90 },               // Cat bowls
  cart:                  { price: 180 },              // Tea cart
  kplant:                { price: 110 },              // Monstera
  // --- Bếp — tường / rào ---
  'kwall-butter':        { price: 0 },                // Butter
  'kwall-mint':          { price: 100 },              // Mint
  'kwall-peach':         { price: 100 },              // Peach
  'kwall-sky':           { price: 100 },              // Sky
  'kwall-sage':          { price: 100 },              // Sage
  'kwall-brick':         { price: 100 },              // Brick
  'kwall-slate':         { price: 100 },              // Slate
  'kwall-vermilion':     { price: 100 },              // Vermilion
  'kwall-washi':         { price: 100 },              // Washi paper
  // --- Bếp — sàn / nền ---
  'kfloor-oak':          { price: 0 },                // Oak
  'kfloor-pine':         { price: 100 },              // Pine
  'kfloor-terracotta-tiles': { price: 100 },              // Terracotta tiles
  'kfloor-mint-tiles':   { price: 100 },              // Mint tiles
  'kfloor-checker':      { price: 100 },              // Checkerboard
  'kfloor-slate-tiles':  { price: 100 },              // Slate tiles
  'kfloor-tatami':       { price: 100 },              // Tatami
  'kfloor-bamboo':       { price: 100 },              // Bamboo
  // --- Vườn mở rộng (vườn 2: mở khi thắng màn 10) — đồ ---
  windmill:              { price: 0, lock: 11 },      // Windmill
  sunflowers:            { price: 0, lock: 11 },      // Sunflowers
  clothesline:           { price: 200, lock: 11 },    // Clothesline
  campfire:              { price: 260, lock: 12 },    // Campfire
  kite:                  { price: 220, lock: 13 },    // Kite
  stream:                { price: 280, lock: 14 },    // Little stream
  swingtree:             { price: 320, lock: 15 },    // Swing tree
  slide:                 { price: 340, lock: 17 },    // Slide
  // --- Mèo (giá 0; lock = màn thưởng, nhận ở Map; không lock = có sẵn từ đầu) ---
  'cat-orange':          { price: 0 },                // Orange cat
  'cat-gray':            { price: 0, lock: 7 },       // Gray cat
  'cat-white':           { price: 0, lock: 10 },      // White cat
  'cat-tabby':           { price: 0, lock: 14 },      // Calico cat
  'cat-siamese':         { price: 0, lock: 17 },      // Siamese cat
  'cat-tuxedo':          { price: 0, lock: 20 },      // Tuxedo cat

});
