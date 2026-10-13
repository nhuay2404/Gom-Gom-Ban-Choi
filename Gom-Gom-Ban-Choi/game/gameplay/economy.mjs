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
// Tăng đều: xu(màn n) = REWARD_BASE + REWARD_STEP × (n−1), làm tròn; màn boss (10, 20, 30…) nhân thêm REWARD_BOSS_MULT.
// Tổng N màn (chưa tính boss) = N × REWARD_BASE + REWARD_STEP × N × (N−1) ÷ 2 — vd. 50 + 50 mỗi màn: 1000 màn = 25,025,000 xu.
// Mặc định: màn 1 = 50, màn 2 = 100, màn 3 = 150 … màn 99 = 4,950, màn 100 = 7,500 (boss ×1.5). Giá deco tăng theo khu (ZONE_PRICE_MULT) để đi cùng nhịp.
export const REWARD_BASE = remote('REWARD_BASE', 50);
export const REWARD_STEP = remote('REWARD_STEP', 50);
export const REWARD_BOSS_MULT = remote('REWARD_BOSS_MULT', 1.5);

// Hướng dẫn Decoration (sau khi thắng màn 5): nếu người chơi không đủ xu mua món rẻ nhất thì bù cho đủ.
// true = bù (người chơi chắc chắn mua được món đầu tiên trong hướng dẫn), false = không bù.
export const TUTORIAL_TOP_UP = remote('TUTORIAL_TOP_UP', true);

// Quà an ủi: người chơi sắp bỏ game (thua liên tục) thì lần thắng kế tiếp được tặng bấy nhiêu booster +lượt.
export const COMEBACK_GIFT_MOVES = remote('COMEBACK_GIFT_MOVES', 1);

// Xu tự sinh (idle): MỖI con mèo trong nhà kiếm xu theo giờ, bong bóng xu trên đầu từng con ở Deco, chạm để nhận (gameplay/idle.mjs).
//   xu / giờ của một con = xu thưởng của màn đang chơi × IDLE_RATE · mỗi con tích tối đa IDLE_CAP_HOURS giờ (đầy thì ngừng) · mở khi thắng màn IDLE_FROM_LEVEL.
//   Nhiều mèo = nhiều xu (tối đa MAX_ROOM_CATS con trong nhà). Giữ tổng nhỏ (~5–15% xu cả game của người chơi trung bình, đủ 6 mèo)
//   để không thay gói xu / không làm người chơi bớt chơi màn.
export const IDLE_RATE = remote('IDLE_RATE', 0.44);
export const IDLE_CAP_HOURS = remote('IDLE_CAP_HOURS', 8);
export const IDLE_FROM_LEVEL = remote('IDLE_FROM_LEVEL', 10);

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
//  Mỗi chỗ đặt có 3 món theo theme: Gỗ (món gốc) → Hồng, Hiện đại (vd. Tree stump → Heart pouf, Glow cube seat): món theme lấy CÙNG giá / lock với món gốc.
//  Muốn kiểu khác có giá riêng thì thêm một dòng cho id của nó, vd.  'stump-pink': { price: 120 },
//  (id món theme xem THEMES trong game/deco/deco-data.mjs). Thêm / bớt món mới: phải có dòng ở đây (npm test kiểm).
// Mở khu (progression kiểu unlock): Vườn có sẵn; các khu sau mở theo thứ tự, mỗi khu cần ĐỦ CẢ HAI:
//   level : đã thắng tới màn này,
//   cost  : ví có đủ bấy nhiêu xu — mở khu là mua khu, trừ đúng số xu này. garden2 = Vườn mở rộng (cùng khu vườn, thêm đồi + đồ area 'garden2').
export const AREA_UNLOCK = remote('AREA_UNLOCK', {
  garden2: { level: 10, cost: 350 },
  living: { level: 20, cost: 550 },
  bedroom: { level: 30, cost: 800 },
  kitchen: { level: 40, cost: 1300 },
  bathroom: { level: 50, cost: 1500 },
  backyard: { level: 60, cost: 2000 },
});

// Hệ số giá theo khu: giá thật = price trong bảng DECO × hệ số khu (làm tròn tới 10 xu). Khu mở sau đắt hơn để chỗ tiêu xu
// tăng cùng nhịp với xu thưởng. garden2 = phần vườn mở rộng (món có area 'garden2'). 1 = giữ nguyên giá trong bảng.
export const ZONE_PRICE_MULT = remote('ZONE_PRICE_MULT', { garden: 1, garden2: 1, living: 1.1, bedroom: 1.2, kitchen: 1.3, bathroom: 1.4, backyard: 1.5 });

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
  mirror:                { price: 200, lock: 39 },    // Floor mirror
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
  bakerack:              { price: 160 },              // Baker's rack
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
  // --- Sân sau (mở theo AREA_UNLOCK.backyard; giá nhân ZONE_PRICE_MULT.backyard) — đồ ---
  pool:                  { price: 0 },                // Swimming pool (bể có sẵn khi mở khu)
  greenhouse:            { price: 0 },                // Greenhouse
  lounger:               { price: 180 },              // Sun lounger
  parasol:               { price: 220 },              // Parasol table
  grill:                 { price: 260 },              // BBQ grill
  deckbox:               { price: 140 },              // Pool toy box
  vegbed:                { price: 200 },              // Tomato bed
  veggies:               { price: 160 },              // Veggie patch
  scarecrow:             { price: 150 },              // Scarecrow
  rainbarrel:            { price: 120 },              // Rain barrel
  // --- Sân sau — rào / nền ---
  'yfence-white':        { price: 0 },                // White picket
  'yfence-wood':         { price: 100 },              // Wood fence
  'yfence-hedge':        { price: 100 },              // Hedge
  'yground-grass':       { price: 0 },                // Grass
  'yground-clover':      { price: 100 },              // Clover
  'yground-meadow':      { price: 100 },              // Meadow
  // --- Phòng tắm (mở theo AREA_UNLOCK.bathroom; giá nhân ZONE_PRICE_MULT.bathroom) — đồ ---
  toilet:                { price: 0 },                // Toilet
  vanity:                { price: 0 },                // Sink vanity
  bathtub:               { price: 300 },              // Clawfoot tub
  shower:                { price: 260 },              // Shower
  washer:                { price: 240 },              // Washing machine
  towel:                 { price: 120 },              // Towel rack
  litter:                { price: 160 },              // Cat litter box
  bathmat:               { price: 100 },              // Bath mat
  jacuzzi:               { price: 400 },              // Hot tub (bồn sục giữa phòng)
  bathshelf:             { price: 140 },              // Bath shelf
  // --- Phòng tắm — tường ---
  'twall-aqua':          { price: 0 },                // Aqua
  'twall-white':         { price: 100 },              // White
  'twall-mint':          { price: 100 },              // Mint
  'twall-blush':         { price: 100 },              // Blush
  'twall-lemon':         { price: 100 },              // Lemon
  'twall-navy':          { price: 100 },              // Navy
  'twall-charcoal':      { price: 100 },              // Charcoal
  // --- Phòng tắm — sàn ---
  'tfloor-white-tiles':  { price: 0 },                // White tiles (sàn mặc định: gạch nhà tắm)
  'tfloor-oak':          { price: 100 },              // Oak
  'tfloor-aqua-tiles':   { price: 100 },              // Aqua tiles
  'tfloor-pink-tiles':   { price: 100 },              // Pink tiles
  'tfloor-checker':      { price: 100 },              // Checkerboard
  'tfloor-teak':         { price: 100 },              // Teak
  'tfloor-slate-tiles':  { price: 100 },              // Slate tiles
  // --- Vườn mở rộng (vườn 2: mở khi thắng màn 10) — đồ ---
  windmill:              { price: 0, lock: 11 },      // Windmill
  sunflowers:            { price: 0, lock: 11 },      // Sunflowers
  clothesline:           { price: 200, lock: 11 },    // Clothesline
  campfire:              { price: 260, lock: 12 },    // Campfire
  kite:                  { price: 220, lock: 13 },    // Kite
  stream:                { price: 280, lock: 14 },    // Little stream
  swingtree:             { price: 320, lock: 15 },    // Swing tree
  slide:                 { price: 340, lock: 17 },    // Slide
  birdhouse:             { price: 240, lock: 16 },    // Birdhouse
  picnic:                { price: 300, lock: 18 },    // Picnic table
  // --- Mèo (giá 0; lock = màn thưởng, nhận ở Map; không lock = có sẵn từ đầu) ---
  'cat-orange':          { price: 0 },                // Orange cat
  'cat-gray':            { price: 0, lock: 7 },       // Gray cat
  'cat-white':           { price: 0, lock: 10 },      // White cat
  'cat-tabby':           { price: 0, lock: 14 },      // Calico cat
  'cat-siamese':         { price: 0, lock: 17 },      // Siamese cat
  'cat-tuxedo':          { price: 0, lock: 20 },      // Tuxedo cat

});
