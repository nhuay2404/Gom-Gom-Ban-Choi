// ===================================================================================================================
//  KINH TẾ GAME — MỌI CON SỐ VỀ XU (nguồn vào / chỗ tiêu) NẰM Ở FILE NÀY. Sửa số ở đây là game đổi theo.
// ===================================================================================================================
//  Xem kết quả sau khi sửa:   npm run economy        (in bảng theo từng stage + ghi ra docs/economy-report.md)
//  Kiểm tra không gãy gì:     npm test
//
//  Mục lục
//    1. NGUỒN XU (source)  — xu ban đầu, xu thưởng mỗi màn, quà; GEM, gói IAP, ưu đãi, rewarded ads, continue
//    2. CHỖ TIÊU (sink)    — giá booster (gem), giá đồ trang trí (DECO)
//    3. CÁCH ĐỌC BẢNG DECO — price / lock
//
//  Quy ước: "màn" đánh số từ 1 như người chơi thấy. 1 stage = 10 màn (stage 1 = màn 1–10, stage 2 = màn 11–20 ...).
//  File này chỉ chứa DỮ LIỆU (không có logic) để dễ sửa; code đọc nó ở data/tuning.mjs và deco/deco-data.mjs.
//  Mỗi hằng số khai bằng remote('TÊN', mặc định): số ở đây là MẶC ĐỊNH; trên Firebase Remote Config có tham số cùng TÊN
//  thì game dùng số trên Firebase (xem docs/firebase.md). Đổi mặc định ở đây xong thì `npm run firebase:template` để cập nhật template.
// ===================================================================================================================
import { remote } from '../core/remote-config.mjs';

// -------------------------------------------------------------------------------------------------------------------
// 1. NGUỒN XU (SOURCE)
// -------------------------------------------------------------------------------------------------------------------

// Xu có sẵn khi mới vào game (trước khi thắng màn nào).
export const START_COINS = remote('START_COINS', 0);

// Xu thưởng khi thắng một màn LẦN ĐẦU (chơi lại màn đã thắng không ra xu; không phụ thuộc số sao).
// Tăng theo cụm 10 màn: trong một cụm mỗi màn cộng cùng một bước; sang cụm mới bước nhân (1 + REWARD_GROWTH) — cụm 1 (màn 1–10) bước
// REWARD_STEP, cụm 2 bước × (1 + G), cụm 3 × (1 + G)²… (progression.mjs rewardFor). Mỗi màn lệch thêm REWARD_JITTER × lệch(n) × bước,
// lệch(n) cố định theo màn trong −0.5..0.5: khó đoán mà vẫn luôn tăng (REWARD_JITTER < 1). Màn boss cũng theo công thức này.
// Mặc định (bước 50, +10% mỗi cụm): màn 1–6 ≈ 67, 82, 152, 195, 248, 305 … màn 30 ≈ 1,678, màn 50 ≈ 3,041, màn 100 ≈ 7,946; 100 màn ≈ 340,000 xu.
export const REWARD_BASE = remote('REWARD_BASE', 50);
export const REWARD_STEP = remote('REWARD_STEP', 50);
export const REWARD_GROWTH = remote('REWARD_GROWTH', .1);
export const REWARD_JITTER = remote('REWARD_JITTER', .8);
// Thưởng tăng mãi (0) để màn sau luôn đáng hơn màn trước; game còn thêm màn + khu sau màn 100, giá khu mới tự theo R (ZONE_PRICING).
// Đặt > 0 (vd. 80) thì từ màn đó thưởng thôi tăng: chỉ dùng khi lâu chưa có khu mới mà xu dư quá nhiều.
export const REWARD_FLAT_FROM = remote('REWARD_FLAT_FROM', 0);

// Hướng dẫn Decoration (sau khi thắng màn 5): nếu người chơi không đủ xu mua món rẻ nhất thì bù cho đủ.
// true = bù (người chơi chắc chắn mua được món đầu tiên trong hướng dẫn), false = không bù.
export const TUTORIAL_TOP_UP = remote('TUTORIAL_TOP_UP', true);

// Quà an ủi: người chơi sắp bỏ game (thua liên tục) thì lần thắng kế tiếp được tặng bấy nhiêu booster +lượt.
export const COMEBACK_GIFT_MOVES = remote('COMEBACK_GIFT_MOVES', 1);

// Xu tự sinh (idle): MỖI con mèo trong nhà kiếm xu theo giờ, bong bóng xu trên đầu từng con ở Deco, chạm để nhận (core/idle.mjs).
//   xu / giờ của một con = xu thưởng của màn đang chơi × IDLE_RATE · mỗi con tích tối đa IDLE_CAP_HOURS giờ (đầy thì ngừng) · mở khi thắng màn IDLE_FROM_LEVEL.
//   Nhiều mèo = nhiều xu (tối đa MAX_ROOM_CATS con trong nhà). Giữ tổng nhỏ (~5–15% xu cả game của người chơi trung bình, đủ 6 mèo)
//   để không thay gói xu / không làm người chơi bớt chơi màn.
//   0.015 (trước 0.44): mô phỏng economy-sim cho xu idle chiếm ~12% tổng xu (trung bình), 14% (casual), 7% (chơi nhiều); 0.44 là ~80%.
export const IDLE_RATE = remote('IDLE_RATE', 0.015);
export const IDLE_CAP_HOURS = remote('IDLE_CAP_HOURS', 8);
export const IDLE_FROM_LEVEL = remote('IDLE_FROM_LEVEL', 10);
// Phải tích ít nhất bấy nhiêu phút mới nhận được (bong bóng xu chỉ hiện khi đủ): không nhận lắt nhắt liên tục. Xu vẫn tính từ đầu, không mất phần đã tích.
export const IDLE_MIN_MINUTES = remote('IDLE_MIN_MINUTES', 30);

// ----- GEM (tiền cứng) — thiết kế: docs/kinh-te-va-monetization.md -----
// Gem có sẵn khi mới vào game.
export const START_GEMS = remote('START_GEMS', 0);
// Gem miễn phí (một lần mỗi mốc): thắng màn paywall lần đầu · thắng màn boss lần đầu · mở một khu deco · nhận một thú cưng mới (0 = không cho).
// Quà đăng nhập hằng ngày (Daily, Sprint 8) KHÔNG cho gem (quyết định 22/10): chỉ xu / booster / đồ. Nhiệm vụ ngày (DAILY) cũng chỉ cho xu.
// 23/10 giảm từ { 100, 25, 50, 10 } (≈785 gem / 100 màn) xuống ≈325: booster tặng sẵn + continue miễn phí ở màn 10 đã dạy cách dùng, gem mốc
// chỉ cần ít (wiki: hard currency miễn phí là lượng nhỏ để dạy, nguồn >> chỗ tiêu thì không ai mua). Paywall 50 < 1 continue (75): thiếu gem
// đúng lúc gói Starter hiện ở màn 10. Thú cưng tự nó là quà nên không kèm gem.
export const GEM_REWARDS = remote('GEM_REWARDS', { paywall: 50, boss: 15, area: 20, pet: 0 });

// ----- NHIỆM VỤ NGÀY (core/daily.mjs) — mỗi ngày `count` nhiệm vụ nhẹ, cùng một mức xu; không có rương, không tặng booster -----
// R = xu thắng màn cao nhất đang mở lúc sang ngày (bỏ dao động, làm tròn chục), giữ nguyên cả ngày. Xu mỗi nhiệm vụ = share × R.
// Bắt đầu khi đã mở tới màn fromLevel (sau FTUE). Không có nhiệm vụ xem ads / tiêu gem.
export const DAILY = remote('DAILY', { fromLevel: 6, count: 5, share: .3 });
// Bảng nhiệm vụ: { id, event, n, text }. event = sự kiện game đếm (core/daily.mjs DAILY_EVENTS). Mỗi ngày bốc `count` món khác nhau, ưu tiên món hôm qua chưa có.
// need: 'boosters' (chỉ sau màn mở booster) · 'idle' (đã mở xu idle) · 'base' (khu đang mở còn món gốc chưa mua) · 'noBase' (hết món gốc: place2 thay cho build1 + place1).
// Số "n" là số tạm, chỉnh theo dữ liệu thật.
export const DAILY_POOL = remote('DAILY_POOL', [
  { id: 'play3', event: 'play', n: 3, text: 'Play 3 levels' },
  { id: 'match30', event: 'match', n: 30, text: 'Match 30 groups' },
  { id: 'score1000', event: 'score', n: 1000, text: 'Earn 1,000 points' },
  { id: 'clean1', event: 'cleanWin', n: 1, need: 'boosters', text: 'Win a level without boosters' },
  { id: 'pet3', event: 'pet', n: 3, text: 'Pet your cats 3 times' },
  { id: 'idle1', event: 'idle', n: 1, need: 'idle', text: 'Collect coins from your cats' },
  { id: 'place1', event: 'place', n: 1, need: 'base', text: 'Place or swap 1 item' },
  { id: 'build1', event: 'build', n: 1, need: 'base', text: 'Build 1 new spot' },
  { id: 'place2', event: 'place', n: 2, need: 'noBase', text: 'Place or swap 2 items' },
]);

// ----- NHIỆM VỤ TIẾN TRÌNH (core/quests.mjs) — nút Quests ở Home + Deco. Chỉ là MỐC TIẾN TRÌNH (thắng màn, mở khu, xây chỗ, nhận mèo,
// sưu tầm kiểu đồ); việc nhỏ trong phiên chơi (chơi, gom, vuốt mèo) để cho nhiệm vụ ngày. Luôn có tối đa `slots` nhiệm vụ; nhận thưởng
// xong thì nhiệm vụ kế của cùng chuỗi đẻ ra ngay, chuỗi vừa nhận xuống cuối hàng. Hết nội dung (hết màn / khu / chỗ / mèo / kiểu) thì chuỗi
// đó thôi, cuối game bảng có thể trống. Không có thưởng lớn khi làm hết. Mở từ màn fromLevel.
// Thiết kế theo wiki: thưởng theo công sức (concept-economy-building-blocks), mục tiêu có trần để không thành cày (cozydive-bycer-relaxing-progression-curve).
export const QUESTS = remote('QUESTS', { fromLevel: 6, slots: 3 });
// Chuỗi nhiệm vụ. Xu = share × R (R như nhiệm vụ ngày, lấy lúc nhiệm vụ đẻ ra).
// kind 'level': thắng tới màn bội số của step · 'area': mở khu kế tiếp · còn lại đếm sự kiện (event):
// mục tiêu = min(base + grow × số lần đã xong chuỗi, max), và không vượt số còn lại trong game (cap: tên số đếm trong ctx của quests.mjs).
// {n} = mục tiêu, {area} = tên khu, {s} = 's' khi n > 1.
export const QUEST_TRACKS = remote('QUEST_TRACKS', [
  { id: 'level', kind: 'level', step: 5, share: 1.5, text: 'Beat level {n}' },
  { id: 'area', kind: 'area', share: 2, text: 'Open the {area}' },
  { id: 'build', event: 'build', base: 3, grow: 1, max: 5, cap: 'basesLeft', share: 1.5, text: 'Build {n} new spot{s}' },
  { id: 'pets', event: 'claimPet', base: 1, grow: 0, max: 1, cap: 'petsLeft', share: 1, text: 'Welcome a new pet from the map' },
  { id: 'styles', event: 'style', base: 2, grow: 1, max: 4, cap: 'stylesLeft', share: 1, text: 'Collect {n} new style{s} in the Shop' },
]);

// Gói gem bán bằng tiền thật (IAP). usd = giá hiển thị, gems = gem nhận, tag = nhãn nổi bật (trống = không).
export const GEM_PACKS = remote('GEM_PACKS', [
  { id: 'gems_200', usd: 1.99, gems: 200, tag: '' },
  { id: 'gems_550', usd: 4.99, gems: 550, tag: '+10%' },
  { id: 'gems_1200', usd: 9.99, gems: 1200, tag: 'Most popular' },
  { id: 'gems_2600', usd: 19.99, gems: 2600, tag: '+30%' },
  { id: 'gems_7000', usd: 49.99, gems: 7000, tag: '+40%' },
  { id: 'gems_16000', usd: 99.99, gems: 16000, tag: 'Best value' },
]);
// Thiếu xu khi mua đồ / mở khu: trả HẾT xu đang có + bù phần thiếu bằng gem (không có túi xu, không có tỉ giá hiện ra cho người chơi).
// Tỉ giá ngầm theo tiến độ: thiếu đúng 1 lần thưởng của màn đang chơi = gemsPerLevel gem (làm tròn lên, tối thiểu minGems).
//   Xu tăng theo màn nên cùng số xu thiếu, càng về sau càng ít gem; tính theo "số màn phải chơi" thì giá luôn như nhau.
export const COIN_TOP_UP = remote('COIN_TOP_UP', { gemsPerLevel: 20, minGems: 1 });
// Ưu đãi IAP có hạn giờ. coinLevels = xu tặng tính theo số màn thưởng (như túi xu); coins = xu cố định; boosters = số mỗi loại.
//   starter : một lần duy nhất, bật khi thắng màn starterLevel lần đầu.
//   rescue  : thua cùng một màn afterLosses lần liền; cách nhau ít nhất cooldownDays ngày.
//   builder : vừa mở một khu deco; cách nhau ít nhất cooldownDays ngày.
export const OFFERS = remote('OFFERS', {
  starter: { id: 'starter_pack', usd: 0.99, gems: 300, boosters: 2, coins: 2000, hours: 48, starterLevel: 10 },
  rescue: { id: 'rescue_pack', usd: 2.99, gems: 200, boosters: 3, hours: 24, afterLosses: 3, cooldownDays: 3 },
  builder: { id: 'builder_pack', usd: 4.99, gems: 500, coinLevels: 12, hours: 24, cooldownDays: 3 },
});

// Rewarded ads (đang giả lập: đếm ngược, app/ads.js). from = màn đầu tiên có ads (đã thắng from − 1 màn).
// caps = số lần tối đa MỖI NGÀY cho từng chỗ đặt (null = không giới hạn): continue (+lượt khi thua) · bonusCoins (thêm xu ở bảng thắng) ·
// booster (1 booster khi hết kho) · idle (thêm xu idle) · gems (gem miễn phí ở Shop). gems = gem mỗi lần xem ở Shop.
// coinBonus = xu thêm ở bảng thắng theo lần xem thứ 1, 2, … trong ngày (tỉ lệ xu của màn; hết danh sách thì giữ số cuối):
//   2 lần đầu +50%, từ lần 3 +20%, xem bao nhiêu cũng được. idleBonus = xu thêm khi xem ads lúc nhận xu idle (tỉ lệ số vừa nhận).
//   Mô phỏng (tools/economy/economy-sim.mjs, ads.bonus): người xem mọi màn vẫn chỉ đủ ~90–100% giá món gốc ở màn 20–70.
export const REWARDED_ADS = remote('REWARDED_ADS', { from: 6, caps: { continue: 5, bonusCoins: null, booster: 3, idle: 1, gems: 2 }, gems: 20, coinBonus: [0.5, 0.5, 0.2], idleBonus: 0.5 });

// Continue khi thua: giá gem tăng dần trong CÙNG một lần chơi (hết danh sách = không continue nữa).
//   moves = lượt cộng khi trả gem · adMoves = lượt cộng khi xem ads (chỉ ở lần continue đầu) · stuckMoves = lượt cộng khi thua vì hết chỗ
//   (kèm 1 búa tặng) · minProgress = chỉ mời khi đã đạt ≥ tỉ lệ này của mục tiêu (xa nút hơn thì vào thẳng bảng thua).
//   Màn paywall: lần continue đầu tiên của người chơi miễn phí (dạy cơ chế).
export const CONTINUE = remote('CONTINUE', { prices: [75, 130, 220], moves: 5, adMoves: 3, stuckMoves: 2, minProgress: 0.7 });

// -------------------------------------------------------------------------------------------------------------------
// 2. CHỖ TIÊU (SINK)
// -------------------------------------------------------------------------------------------------------------------

// Booster: chỉ mua bằng GEM (không bằng xu). Giá 1 cái, giá gói ×3, số tặng sẵn mỗi loại khi mở booster, màn bắt đầu có booster.
export const BOOSTER_GEM_PRICE = remote('BOOSTER_GEM_PRICE', { moves: 25, hammer: 45, swap: 60 });
export const BOOSTER_PACK_PRICE = remote('BOOSTER_PACK_PRICE', { moves: 65, hammer: 115, swap: 155 });
export const BOOSTER_START_STOCK = remote('BOOSTER_START_STOCK', 2);
export const BOOSTER_UNLOCK_LEVEL = remote('BOOSTER_UNLOCK_LEVEL', 3);
export const BOOSTER_EXTRA_MOVES = remote('BOOSTER_EXTRA_MOVES', 3); // booster +lượt cộng bấy nhiêu lượt

// -------------------------------------------------------------------------------------------------------------------
// 3. ĐỒ TRANG TRÍ (DECO) — giá + màn mở khoá của từng món
// -------------------------------------------------------------------------------------------------------------------
//  price : giá xu. 0 = có sẵn miễn phí (không cần mua).
//  price thật = price × hệ số của khu (ZONE_PRICING ở trên). Đồ không khoá theo màn (23/10): khu mở là mua được mọi món, chỉ cần đủ xu.
//  lock  : CHỈ cho thú cưng = màn thưởng, nhận ở Map.
//  Mỗi món đồ có 1–2 "kiểu khác" (vd. Tree stump → Hay bale, Apple crate): kiểu khác lấy CÙNG giá với món gốc.
//  Muốn kiểu khác có giá riêng thì thêm một dòng cho id của nó, vd.  'stump-hay': { price: 120 },
//  (id kiểu khác xem VARIANTS trong game/deco/deco-data.mjs). Thêm / bớt món mới: phải có dòng ở đây (npm test kiểm).
// Giá khu theo công thức (23/10, một bản, không qua Remote Config). Mở khu KHÔNG theo màn: xây đủ món gốc khu trước + trả xu (deco-data.mjs
// unlockArea); người chơi thấy trước giá ở bảng "2 khu kế tiếp". Khu thứ n (vườn 2 = 1, phòng khách = 2 … theo AREA_ORDER ở deco-data.mjs) có giá
// CỐ ĐỊNH tính từ R(10n) = xu thắng màn 10n (bỏ dao động). 10n chỉ là nhịp thiết kế (mỗi khu ~pace màn) và nhịp cho tool mô phỏng, game không khoá:
//   giá mở khu        = unlockR × R(10n), làm tròn 50 xu
//   tổng giá món gốc  = k × R(10n): k = kEarly cho `early` khu đầu (mở nhanh, làm quen deco), kLate từ khu sau. Từng món (và tường / sàn của khu)
//                       nhân cùng hệ số nên giữ tỉ lệ giá trong bảng DECO.
//   Vườn gốc (khu hướng dẫn) = giá DECO × gardenMult.
// Thêm khu mới: thêm id vào AREA_ORDER + món ở DECO, giá tự ra. Bảng giá đã tính: deco-data.mjs AREA_UNLOCK / ZONE_PRICE_MULT, `npm run economy`.
export const ZONE_PRICING = { pace: 10, unlockR: 1.3, kEarly: 13, early: 2, kLate: 30, gardenMult: 1.6 };

export const DECO = remote('DECO', {
  // --- Vườn — đồ ---
  flowers:               { price: 0 },                // Flower bed
  stump:                 { price: 80 },               // Tree stump
  catnip:                { price: 90 },               // Catnip bush
  lantern:               { price: 100 },              // Lantern
  sandbox:               { price: 120 },              // Sandbox
  cathouse:              { price: 150 },              // Cat house
  pond:                  { price: 200 },     // Koi pond
  hammock:               { price: 240 },     // Hammock
  birdbath:              { price: 180 },     // Bird bath
  bench:                 { price: 220 },     // Bench
  // --- Vườn — tường / rào ---
  'fence-white':         { price: 0 },                // White picket
  'fence-wood':          { price: 100 },              // Wood fence
  'fence-hedge':         { price: 100 },              // Hedge
  'fence-stone':         { price: 100 },     // Stone wall
  // --- Vườn — sàn / nền ---
  'ground-grass':        { price: 0 },                // Grass
  'ground-clover':       { price: 100 },              // Clover
  'ground-meadow':       { price: 100 },              // Meadow
  'ground-path':         { price: 100 },     // Stone path
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
  laundry:               { price: 100 },    // Laundry basket
  bedside:               { price: 120 },    // Bedside table
  desk:                  { price: 260 },    // Gaming desk
  chair:                 { price: 180 },    // Gaming chair
  closet:                { price: 220 },    // Closet
  plushie:               { price: 150 },    // Teddy bear
  catsteps:              { price: 240 },    // Wall steps
  mirror:                { price: 200 },    // Floor mirror
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
  // --- Sân sau (khu thứ 6; giá theo ZONE_PRICING) — đồ ---
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
  // --- Trường mẫu giáo (khu thứ 7; giá theo ZONE_PRICING) — đồ ---
  kdesk:                 { price: 0 },                // Kids desks (lớp có sẵn bàn khi mở khu)
  kplayset:              { price: 0 },                // Slide tower
  kboard:                { price: 160 },              // Chalkboard
  kcubby:                { price: 180 },              // Toy cubbies
  kpiano:                { price: 240 },              // Upright piano
  kswing:                { price: 220 },              // Swing set
  kspring:               { price: 150 },              // Spring riders
  ksandpit:              { price: 140 },              // Sandpit
  kmerry:                { price: 260 },              // Merry-go-round
  kbench:                { price: 120 },              // Benches
  // --- Trường mẫu giáo — rào / nền ---
  'kfence-picket':       { price: 0 },                // Yellow picket
  'kfence-rail':         { price: 100 },              // Blue rails
  'kfence-hedge':        { price: 100 },              // Hedge
  'kground-grass':       { price: 0 },                // Grass
  'kground-clover':      { price: 100 },              // Clover
  'kground-path':        { price: 100 },              // Stone path
  // --- Phòng tắm (khu thứ 5; giá theo ZONE_PRICING) — đồ ---
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
  // --- Vườn mở rộng (vườn 2, khu thứ 1) — đồ ---
  windmill:              { price: 0 },      // Windmill
  sunflowers:            { price: 0 },      // Sunflowers
  clothesline:           { price: 200 },    // Clothesline
  campfire:              { price: 260 },    // Campfire
  kite:                  { price: 220 },    // Kite
  stream:                { price: 280 },    // Little stream
  swingtree:             { price: 320 },    // Swing tree
  slide:                 { price: 340 },    // Slide
  birdhouse:             { price: 240 },    // Birdhouse
  picnic:                { price: 300 },    // Picnic table
  // --- Mèo (giá 0; lock = màn thưởng, nhận ở Map; không lock = có sẵn từ đầu) ---
  'cat-orange':          { price: 0 },                // Orange cat
  'cat-gray':            { price: 0, lock: 7 },       // Gray cat
  'cat-white':           { price: 0, lock: 10 },      // White cat
  'cat-tabby':           { price: 0, lock: 14 },      // Calico cat
  'cat-siamese':         { price: 0, lock: 17 },      // Siamese cat
  'cat-tuxedo':          { price: 0, lock: 20 },      // Tuxedo cat
  // --- Chó (như mèo; stage 3 + 4: màn 4, 7, 10 của stage) ---
  'dog-shiba':           { price: 0, lock: 24 },      // Shiba dog
  'dog-golden':          { price: 0, lock: 27 },      // Golden dog
  'dog-pug':             { price: 0, lock: 30 },      // Pug dog
  'dog-dalmatian':       { price: 0, lock: 34 },      // Dalmatian dog
  'dog-malamute':        { price: 0, lock: 37 },      // Malamute dog
  'dog-rottweiler':      { price: 0, lock: 40 },      // Rottweiler dog

});
