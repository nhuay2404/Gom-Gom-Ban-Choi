// Dữ liệu Deco: 4 khu (vườn — mở rộng thêm khi thắng màn 10, phòng khách, phòng ngủ, bếp), danh mục đồ, giá, mốc mở khoá và trạng thái đã mua/đặt (lưu trong máy).
// Thuần dữ liệu/logic, không đụng giao diện. Xu kiếm khi thắng màn lần đầu (levelReward, progression.mjs). Mèo dùng chung cả 2 khu.
import { ECONOMY } from '../data/tuning.mjs';
import { DECO, ZONE_PRICING, REWARD_BASE, REWARD_STEP, REWARD_GROWTH, LOGIN_CALENDAR } from '../data/economy.mjs';
import { rewardFor } from '../core/reward.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from '../core/save.mjs';
export const { MAX_ROOM_CATS } = ECONOMY;

// Thứ tự mở khu sau vườn gốc. Khu thứ n (vị trí trong danh sách + 1) có giá cố định theo R ở màn mốc thiết kế Lₙ — economy.mjs ZONE_PRICING.
export const AREA_ORDER = ['garden2', 'living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder'];
// R của màn L, bỏ dao động (giá khu không lệch theo từng màn).
const paceReward = L => rewardFor(L - 1, { REWARD_BASE, REWARD_STEP, REWARD_GROWTH });
// Giá mở từng khu: { level: màn mốc thiết kế Lₙ (chỉ để tính giá + nhịp cho tool mô phỏng, KHÔNG phải mốc mở khu), cost: unlockR × R(Lₙ) làm tròn 50 }.
export const AREA_UNLOCK = Object.fromEntries(AREA_ORDER.map((area, i) => {
  const { early, earlyPace, pace } = ZONE_PRICING, n = i + 1;
  const level = n <= early ? earlyPace * n : earlyPace * early + pace * (n - early);
  return [area, { level, cost: Math.round(ZONE_PRICING.unlockR * paceReward(level) / 50) * 50 }];
}));
export const ZONES = {
  garden: { name: 'Garden', unlockAfter: 0, cats: { furniture: 'Garden', walls: 'Fences', floors: 'Ground', cats: 'Pets' } },
  living: { name: 'Living room', unlockAfter: AREA_UNLOCK.living.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Pets' } },
  bedroom: { name: 'Bedroom', unlockAfter: AREA_UNLOCK.bedroom.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Pets' } },
  kitchen: { name: 'Kitchen', unlockAfter: AREA_UNLOCK.kitchen.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Pets' } },
  bathroom: { name: 'Bathroom', unlockAfter: AREA_UNLOCK.bathroom.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Pets' } },
  backyard: { name: 'Backyard', unlockAfter: AREA_UNLOCK.backyard.level, cats: { furniture: 'Pool & veggies', walls: 'Fences', floors: 'Ground', cats: 'Pets' } },
  kinder: { name: 'Kindergarten', unlockAfter: AREA_UNLOCK.kinder.level, cats: { furniture: 'Class & play', walls: 'Fences', floors: 'Ground', facade: 'School', cats: 'Pets' } },
};
export const ZONE_IDS = Object.keys(ZONES);
// Đã tới mốc màn của khu chưa (điều kiện 1 trong 2 để mở; điều kiện 2 là trả xu — xem areaState).
export const zoneOpen = (zone, cleared) => cleared >= ZONES[zone].unlockAfter;
// Vườn mở rộng (Vườn 2): mở thì vườn nới dài thêm về bên phải — CÙNG một khu vườn (chung nền,
// chung hàng rào), có thêm đồi và thêm đồ trong danh mục vườn (area: 'garden2').
export const GARDEN_EXPANSION = { unlockAfter: AREA_UNLOCK.garden2.level, name: 'Garden expansion' };
export const gardenExpanded = cleared => cleared >= GARDEN_EXPANSION.unlockAfter;

// ===== Mở khu: xây đủ món gốc của khu trước + đủ xu thì mua khu (trừ xu). Không còn mốc màn. Mỗi khu đi qua các trạng thái =====
//   soon  : khu trước chưa mở              build : khu trước còn chỗ chưa xây (món gốc chưa mua)
//   coins : đã xây đủ, ví chưa đủ xu (AREA_UNLOCK.cost)    ready : đủ cả hai, chạm "khánh thành" là mua + mở    open : đã mở
// AREA_UNLOCK.level giờ chỉ là nhịp mong muốn cho tool mô phỏng kinh tế, game không chặn theo màn.
export const AREA_NAMES = { garden: 'Garden', garden2: 'Garden expansion', living: 'Living room', bedroom: 'Bedroom', kitchen: 'Kitchen', bathroom: 'Bathroom', backyard: 'Backyard', kinder: 'Kindergarten' };
export const areaOpen = (deco, area) => area === 'garden' || (deco.unlocked ?? []).includes(area);
const pay = (deco, price) => ({ ...deco, coins: deco.coins - price });
// Khu đứng trước `area` trong thứ tự mở (khu đầu tiên đứng sau vườn gốc).
export const areaBefore = area => AREA_ORDER[AREA_ORDER.indexOf(area) - 1] ?? 'garden';
// Món gốc (chỗ đặt) của một khu, vườn gốc và vườn mở rộng tách riêng theo `area`.
export const areaBases = area => CATALOG.filter(entry => isBase(entry) && (entry.area || entry.zone) === area);
// [đã xây, tổng] món gốc của một khu.
export const areaBuilt = (deco, area) => { const bases = areaBases(area); return [bases.filter(entry => isOwned(deco, entry)).length, bases.length]; };
// table = bảng giá mở khu (mặc định AREA_UNLOCK; Level Editor truyền bảng đang sửa để mô phỏng). `cleared` giữ để tool cũ gọi được, không dùng.
export function areaState(deco, area, cleared, table = AREA_UNLOCK) {
  if (areaOpen(deco, area)) return 'open';
  const before = areaBefore(area);
  if (!areaOpen(deco, before)) return 'soon';
  const [built, total] = areaBuilt(deco, before);
  if (built < total) return 'build';
  return deco.coins >= table[area].cost ? 'ready' : 'coins';
}
// Khu kế tiếp chưa mở (null = đã mở hết); nextAreas: tối đa n khu kế tiếp (Deco luôn cho thấy 2 khu).
export const nextArea = deco => AREA_ORDER.find(area => !areaOpen(deco, area)) ?? null;
export const nextAreas = (deco, n = 2) => AREA_ORDER.filter(area => !areaOpen(deco, area)).slice(0, n);
// Số chỗ (món gốc phải mua) chưa xây ở MỌI khu, kể cả khu chưa mở (nhiệm vụ tiến trình "xây N chỗ" không vượt số này).
export const basesLeft = deco => CATALOG.filter(entry => isBase(entry) && deco.zones[entry.zone] && !isOwned(deco, entry)).length;
// Mèo còn nhận được ở Map (có mốc màn, chưa nhận) / kiểu đồ + tường / sàn bán ở Shop chưa mua, ở mọi khu (nhiệm vụ tiến trình).
export const petsLeft = deco => CATALOG.filter(entry => entry.cat === 'cats' && entry.lock && !isCatClaimed(deco, entry.breed)).length;
export const stylesLeft = deco => ZONE_IDS.reduce((sum, zone) => sum + (deco.zones[zone] ? shopCatalog(zone).filter(entry => !isOwned(deco, entry)).length : 0), 0);
// Còn khu đang mở nào chưa xây đủ món gốc không (nhiệm vụ ngày "xây 1 chỗ").
export const baseLeft = deco => ['garden', ...AREA_ORDER].some(area => { if (!areaOpen(deco, area)) return false; const [built, total] = areaBuilt(deco, area); return built < total; });
export function unlockArea(deco, area, cleared, table = AREA_UNLOCK) {
  const state = areaState(deco, area, cleared, table);
  if (state === 'open') return { error: 'Already open' };
  if (state === 'soon') return { error: `Open the ${AREA_NAMES[areaBefore(area)].toLowerCase()} first` };
  if (state === 'build') return { error: `Build every spot in the ${AREA_NAMES[areaBefore(area)].toLowerCase()} first` };
  if (state === 'coins') return { error: `Need ${table[area].cost - deco.coins} more coins` };
  return { ...pay(deco, table[area].cost), unlocked: [...(deco.unlocked ?? []), area] };
}

// Giá (price) và màn mở khoá (lock) của từng món KHÔNG khai ở đây: sửa ở data/economy.mjs (bảng DECO), áp vào cuối danh mục.
export const CATALOG = [
  // --- Vườn ---
  { id: 'flowers', zone: 'garden', cat: 'furniture', name: 'Flower bed', color: '#ff9fb6' },
  { id: 'stump', zone: 'garden', cat: 'furniture', name: 'Tree stump', color: '#9a6a45' },
  { id: 'catnip', zone: 'garden', cat: 'furniture', name: 'Catnip bush', color: '#8fd46a' },
  { id: 'lantern', zone: 'garden', cat: 'furniture', name: 'Lantern', color: '#ffd66b' },
  { id: 'sandbox', zone: 'garden', cat: 'furniture', name: 'Sandbox', color: '#f3dfb0' },
  { id: 'cathouse', zone: 'garden', cat: 'furniture', name: 'Cat house', color: '#e8617f' },
  { id: 'pond', zone: 'garden', cat: 'furniture', name: 'Koi pond', color: '#6fc3e0' },
  { id: 'hammock', zone: 'garden', cat: 'furniture', name: 'Hammock', color: '#8fc9f2' },
  { id: 'birdbath', zone: 'garden', cat: 'furniture', name: 'Bird bath', color: '#cfd8e0' },
  { id: 'bench', zone: 'garden', cat: 'furniture', name: 'Bench', color: '#b9854a' },
  { id: 'fence-white', zone: 'garden', cat: 'walls', name: 'White picket', color: '#fffaf0' },
  { id: 'fence-wood', zone: 'garden', cat: 'walls', name: 'Wood fence', color: '#c9955e' },
  { id: 'fence-hedge', zone: 'garden', cat: 'walls', name: 'Hedge', color: '#6fbf4a' },
  { id: 'fence-stone', zone: 'garden', cat: 'walls', name: 'Stone wall', color: '#c8c2b8' },
  { id: 'ground-grass', zone: 'garden', cat: 'floors', name: 'Grass', color: '#9fd46a' },
  { id: 'ground-clover', zone: 'garden', cat: 'floors', name: 'Clover', color: '#7fc45a' },
  { id: 'ground-meadow', zone: 'garden', cat: 'floors', name: 'Meadow', color: '#b5dd7a' },
  { id: 'ground-path', zone: 'garden', cat: 'floors', name: 'Stone path', color: '#d9d2c4' },
  // bộ Vườn Nhật (giá gem, economy.mjs DECO)
  { id: 'fence-bamboo', zone: 'garden', cat: 'walls', name: 'Bamboo fence', color: '#c9b46a' },
  { id: 'fence-yakisugi', zone: 'garden', cat: 'walls', name: 'Charred cedar', color: '#3a3330' },
  { id: 'fence-tile', zone: 'garden', cat: 'walls', name: 'Tiled wall', color: '#f1eadb' },
  { id: 'fence-torii', zone: 'garden', cat: 'walls', name: 'Vermilion rail', color: '#d9452f' },
  { id: 'ground-gravel', zone: 'garden', cat: 'floors', name: 'Raked gravel', color: '#e6e1d6' },
  { id: 'ground-moss', zone: 'garden', cat: 'floors', name: 'Moss', color: '#7fa34a' },
  { id: 'ground-stepping', zone: 'garden', cat: 'floors', name: 'Stepping stones', color: '#8fb85a' },
  { id: 'ground-hinoki', zone: 'garden', cat: 'floors', name: 'Hinoki deck', color: '#e8cf9f' },
  // --- Phòng khách (mở cả khu khi thắng màn 10) ---
  { id: 'rug', zone: 'living', cat: 'furniture', name: 'Pink rug', color: '#f4a3b6' },
  { id: 'armchair', zone: 'living', cat: 'furniture', name: 'Armchair', color: '#e98b5a' },
  { id: 'plant', zone: 'living', cat: 'furniture', name: 'Plant', color: '#7fc45a' },
  { id: 'yarn', zone: 'living', cat: 'furniture', name: 'Yarn basket', color: '#ff8fa0' },
  { id: 'catbed', zone: 'living', cat: 'furniture', name: 'Cat bed', color: '#a9d3f5' },
  { id: 'table', zone: 'living', cat: 'furniture', name: 'Side table', color: '#d9a36a' },
  { id: 'lamp', zone: 'living', cat: 'furniture', name: 'Floor lamp', color: '#ffd66b' },
  { id: 'cattree', zone: 'living', cat: 'furniture', name: 'Cat tree', color: '#e6c79a' },
  { id: 'shelf', zone: 'living', cat: 'furniture', name: 'Bookshelf', color: '#b9854a' },
  { id: 'tank', zone: 'living', cat: 'furniture', name: 'Fish tank', color: '#6fc3e0' },
  { id: 'wall-cream', zone: 'living', cat: 'walls', name: 'Cream', color: '#fff1d2' },
  { id: 'wall-mint', zone: 'living', cat: 'walls', name: 'Mint', color: '#d4efd0' },
  { id: 'wall-peach', zone: 'living', cat: 'walls', name: 'Peach', color: '#ffd9c4' },
  { id: 'wall-sky', zone: 'living', cat: 'walls', name: 'Sky', color: '#d4e9ff' },
  { id: 'wall-lilac', zone: 'living', cat: 'walls', name: 'Lilac', color: '#e6dcff' },
  // tông hiện đại đen / xám
  { id: 'wall-concrete', zone: 'living', cat: 'walls', name: 'Concrete', color: '#8d9196' },
  { id: 'wall-graphite', zone: 'living', cat: 'walls', name: 'Graphite', color: '#3b3f46' },
  { id: 'floor-oak', zone: 'living', cat: 'floors', name: 'Oak', color: '#e4b574' },
  { id: 'floor-walnut', zone: 'living', cat: 'floors', name: 'Walnut', color: '#a8744a' },
  { id: 'floor-carpet', zone: 'living', cat: 'floors', name: 'Pink carpet', color: '#f3c2cc' },
  { id: 'floor-tiles', zone: 'living', cat: 'floors', name: 'Mint tiles', color: '#bfe3cf' },
  { id: 'floor-concrete', zone: 'living', cat: 'floors', name: 'Polished concrete', color: '#9a9da1' },
  { id: 'floor-ebony', zone: 'living', cat: 'floors', name: 'Ebony wood', color: '#3a3330' },
  // --- Phòng ngủ (mở cả khu khi thắng màn 15; đồ mở dần ở màn 16–19) ---
  { id: 'bed', zone: 'bedroom', cat: 'furniture', name: 'Cozy bed', color: '#8fc9f2' },
  { id: 'bedrug', zone: 'bedroom', cat: 'furniture', name: 'Fluffy rug', color: '#e6dcff' },
  { id: 'laundry', zone: 'bedroom', cat: 'furniture', name: 'Laundry basket', color: '#e9c58f' },
  { id: 'bedside', zone: 'bedroom', cat: 'furniture', name: 'Bedside table', color: '#f3d5a8' },
  { id: 'desk', zone: 'bedroom', cat: 'furniture', name: 'Gaming desk', color: '#3a3f4a' },
  { id: 'chair', zone: 'bedroom', cat: 'furniture', name: 'Gaming chair', color: '#e8617f' },
  { id: 'closet', zone: 'bedroom', cat: 'furniture', name: 'Closet', color: '#fff4e0' },
  { id: 'plushie', zone: 'bedroom', cat: 'furniture', name: 'Teddy bear', color: '#d9a36a' },
  { id: 'catsteps', zone: 'bedroom', cat: 'furniture', name: 'Wall steps', color: '#c98a55' },
  { id: 'mirror', zone: 'bedroom', cat: 'furniture', name: 'Floor mirror', color: '#e0b36a' },
  { id: 'bwall-lavender', zone: 'bedroom', cat: 'walls', name: 'Lavender', color: '#ebe3f8' },
  { id: 'bwall-blush', zone: 'bedroom', cat: 'walls', name: 'Blush', color: '#ffe0e6' },
  { id: 'bwall-sage', zone: 'bedroom', cat: 'walls', name: 'Sage', color: '#dcebd6' },
  { id: 'bwall-butter', zone: 'bedroom', cat: 'walls', name: 'Butter', color: '#fff0c2' },
  { id: 'bwall-night', zone: 'bedroom', cat: 'walls', name: 'Night blue', color: '#c9d3ee' },
  // tông hiện đại đen / xám
  { id: 'bwall-slate', zone: 'bedroom', cat: 'walls', name: 'Slate', color: '#6b7280' },
  { id: 'bwall-charcoal', zone: 'bedroom', cat: 'walls', name: 'Charcoal', color: '#2f3238' },
  // Phòng trong nhà (phòng khách, phòng ngủ) đều mặc định sàn Oak miễn phí; vườn giữ nền cỏ.
  { id: 'bfloor-oak', zone: 'bedroom', cat: 'floors', name: 'Oak', color: '#e4b574' },
  { id: 'bfloor-maple', zone: 'bedroom', cat: 'floors', name: 'Maple', color: '#e9c493' },
  { id: 'bfloor-ash', zone: 'bedroom', cat: 'floors', name: 'Ash wood', color: '#cdb69a' },
  { id: 'bfloor-carpet', zone: 'bedroom', cat: 'floors', name: 'Lilac carpet', color: '#d9d4f2' },
  { id: 'bfloor-tiles', zone: 'bedroom', cat: 'floors', name: 'Peach tiles', color: '#f2d7c9' },
  { id: 'bfloor-graphite-tiles', zone: 'bedroom', cat: 'floors', name: 'Graphite tiles', color: '#4a4e55' },
  { id: 'bfloor-smoke-carpet', zone: 'bedroom', cat: 'floors', name: 'Smoke carpet', color: '#5c6068' },
  // --- Bếp (mở cả khu khi thắng màn 40, nên đồ không cần khoá thêm theo màn) ---
  { id: 'sink', zone: 'kitchen', cat: 'furniture', name: 'Sink counter', color: '#fff4e0' },
  { id: 'dining', zone: 'kitchen', cat: 'furniture', name: 'Dining table', color: '#f3c2cc' },
  { id: 'fridge', zone: 'kitchen', cat: 'furniture', name: 'Fridge', color: '#bfe8d6' },
  { id: 'stove', zone: 'kitchen', cat: 'furniture', name: 'Stove', color: '#fff4e0' },
  { id: 'pantry', zone: 'kitchen', cat: 'furniture', name: 'Pantry cupboard', color: '#ffe9b0' },
  { id: 'kchair', zone: 'kitchen', cat: 'furniture', name: 'Dining chairs (set of 4)', color: '#d9a36a' },
  { id: 'catfood', zone: 'kitchen', cat: 'furniture', name: 'Cat bowls', color: '#f4a3b6' },
  { id: 'cart', zone: 'kitchen', cat: 'furniture', name: 'Tea cart', color: '#ffd66b' },
  { id: 'kplant', zone: 'kitchen', cat: 'furniture', name: 'Monstera', color: '#5fae46' },
  { id: 'bakerack', zone: 'kitchen', cat: 'furniture', name: "Baker's rack", color: '#ffb347' },
  { id: 'kwall-butter', zone: 'kitchen', cat: 'walls', name: 'Butter', color: '#fff0c2' },
  { id: 'kwall-mint', zone: 'kitchen', cat: 'walls', name: 'Mint', color: '#d4efd0' },
  { id: 'kwall-peach', zone: 'kitchen', cat: 'walls', name: 'Peach', color: '#ffd9c4' },
  { id: 'kwall-sky', zone: 'kitchen', cat: 'walls', name: 'Sky', color: '#d4e9ff' },
  { id: 'kwall-sage', zone: 'kitchen', cat: 'walls', name: 'Sage', color: '#dcebd6' },
  { id: 'kwall-brick', zone: 'kitchen', cat: 'walls', name: 'Brick', color: '#e0a08a' },
  { id: 'kwall-slate', zone: 'kitchen', cat: 'walls', name: 'Slate', color: '#6b7280' },
  { id: 'kwall-vermilion', zone: 'kitchen', cat: 'walls', name: 'Vermilion', color: '#cf5b45' },
  { id: 'kwall-washi', zone: 'kitchen', cat: 'walls', name: 'Washi paper', color: '#efe3c4' },
  { id: 'kfloor-oak', zone: 'kitchen', cat: 'floors', name: 'Oak', color: '#e4b574' },
  { id: 'kfloor-pine', zone: 'kitchen', cat: 'floors', name: 'Pine', color: '#e9c493' },
  { id: 'kfloor-terracotta-tiles', zone: 'kitchen', cat: 'floors', name: 'Terracotta tiles', color: '#d9825b' },
  { id: 'kfloor-mint-tiles', zone: 'kitchen', cat: 'floors', name: 'Mint tiles', color: '#bfe3cf' },
  { id: 'kfloor-checker', zone: 'kitchen', cat: 'floors', name: 'Checkerboard', color: '#f4f1ea' },
  { id: 'kfloor-slate-tiles', zone: 'kitchen', cat: 'floors', name: 'Slate tiles', color: '#5c6068' },
  { id: 'kfloor-tatami', zone: 'kitchen', cat: 'floors', name: 'Tatami', color: '#cfc994' },
  { id: 'kfloor-bamboo', zone: 'kitchen', cat: 'floors', name: 'Bamboo', color: '#d9c27a' },
  // --- Sân sau: bể bơi + vườn rau (sau phòng khách + bếp, cửa từ phòng tắm; mở theo AREA_UNLOCK.backyard). Rào / nền dùng kiểu của vườn (style) ---
  { id: 'pool', zone: 'backyard', cat: 'furniture', name: 'Swimming pool', color: '#5fc8e8' },
  { id: 'lounger', zone: 'backyard', cat: 'furniture', name: 'Sun lounger', color: '#ff8fb8' },
  { id: 'parasol', zone: 'backyard', cat: 'furniture', name: 'Parasol table', color: '#ffd66b' },
  { id: 'grill', zone: 'backyard', cat: 'furniture', name: 'BBQ grill', color: '#e8483a' },
  { id: 'deckbox', zone: 'backyard', cat: 'furniture', name: 'Pool toy box', color: '#8fc9f2' },
  { id: 'greenhouse', zone: 'backyard', cat: 'furniture', name: 'Greenhouse', color: '#cfeaf6' },
  { id: 'vegbed', zone: 'backyard', cat: 'furniture', name: 'Tomato bed', color: '#e8483a' },
  { id: 'veggies', zone: 'backyard', cat: 'furniture', name: 'Veggie patch', color: '#ff9a3c' },
  { id: 'scarecrow', zone: 'backyard', cat: 'furniture', name: 'Scarecrow', color: '#f2c14e' },
  { id: 'rainbarrel', zone: 'backyard', cat: 'furniture', name: 'Rain barrel', color: '#9a6a45' },
  { id: 'yfence-white', zone: 'backyard', cat: 'walls', name: 'White picket', color: '#fffaf0', style: 'fence-white' },
  { id: 'yfence-wood', zone: 'backyard', cat: 'walls', name: 'Wood fence', color: '#c9955e', style: 'fence-wood' },
  { id: 'yfence-hedge', zone: 'backyard', cat: 'walls', name: 'Hedge', color: '#6fbf4a', style: 'fence-hedge' },
  { id: 'yground-grass', zone: 'backyard', cat: 'floors', name: 'Grass', color: '#9fd46a', style: 'ground-grass' },
  { id: 'yground-clover', zone: 'backyard', cat: 'floors', name: 'Clover', color: '#7fc45a', style: 'ground-clover' },
  { id: 'yground-meadow', zone: 'backyard', cat: 'floors', name: 'Meadow', color: '#b5dd7a', style: 'ground-meadow' },
  // --- Trường mẫu giáo: lớp học + sân chơi (bên kia đường trước vườn; mở theo AREA_UNLOCK.kinder). Món kép: kdesk, kcubby, kspring, kbench ---
  { id: 'kdesk', zone: 'kinder', cat: 'furniture', name: 'Kids desks (2 sets)', color: '#5fb8e8' },
  { id: 'kboard', zone: 'kinder', cat: 'furniture', name: 'Chalkboard', color: '#2f5d4a' },
  { id: 'kcubby', zone: 'kinder', cat: 'furniture', name: 'Toy cubbies (pair)', color: '#ffd66b' },
  { id: 'kpiano', zone: 'kinder', cat: 'furniture', name: 'Upright piano', color: '#e98b9a' },
  { id: 'kplayset', zone: 'kinder', cat: 'furniture', name: 'Slide tower', color: '#ff6b6b' },
  { id: 'kswing', zone: 'kinder', cat: 'furniture', name: 'Swing set', color: '#5fb8e8' },
  { id: 'kspring', zone: 'kinder', cat: 'furniture', name: 'Spring riders (pair)', color: '#ffd66b' },
  { id: 'ksandpit', zone: 'kinder', cat: 'furniture', name: 'Sandpit', color: '#efd8a4' },
  { id: 'kmerry', zone: 'kinder', cat: 'furniture', name: 'Merry-go-round', color: '#b48ee8' },
  { id: 'kbench', zone: 'kinder', cat: 'furniture', name: 'Benches (pair)', color: '#ff8fb8' },
  { id: 'kfence-picket', zone: 'kinder', cat: 'walls', name: 'Yellow picket', color: '#ffd66b', style: 'fence-white' },
  { id: 'kfence-rail', zone: 'kinder', cat: 'walls', name: 'Rainbow rails', color: '#ff9a3c', style: 'fence-rainbow' },
  { id: 'kfence-hedge', zone: 'kinder', cat: 'walls', name: 'Hedge', color: '#6fbf4a', style: 'fence-hedge' },
  // Tường lớp học (cả mặt trong lẫn mặt ngoài): bảng màu ở kindergarten.mjs KINDER_FACADES
  { id: 'kfacade-sunny', zone: 'kinder', cat: 'facade', name: 'Sunny cream', color: '#fff0c2' },
  { id: 'kfacade-mint', zone: 'kinder', cat: 'facade', name: 'Mint & coral', color: '#cdeee0' },
  { id: 'kfacade-lilac', zone: 'kinder', cat: 'facade', name: 'Lilac & sky', color: '#e6dcff' },
  { id: 'kground-grass', zone: 'kinder', cat: 'floors', name: 'Grass', color: '#9fd46a', style: 'ground-grass' },
  { id: 'kground-clover', zone: 'kinder', cat: 'floors', name: 'Clover', color: '#7fc45a', style: 'ground-clover' },
  { id: 'kground-path', zone: 'kinder', cat: 'floors', name: 'Stone path', color: '#d9d2c4', style: 'ground-path' },
  // --- Phòng tắm (bên trái phòng ngủ, cửa trên tường trái phòng ngủ; mở theo AREA_UNLOCK.bathroom) ---
  { id: 'toilet', zone: 'bathroom', cat: 'furniture', name: 'Toilet', color: '#ffffff' },
  { id: 'vanity', zone: 'bathroom', cat: 'furniture', name: 'Sink vanity', color: '#bfe8d6' },
  { id: 'bathtub', zone: 'bathroom', cat: 'furniture', name: 'Clawfoot tub', color: '#fffaf0' },
  { id: 'shower', zone: 'bathroom', cat: 'furniture', name: 'Shower', color: '#d4e9ff' },
  { id: 'washer', zone: 'bathroom', cat: 'furniture', name: 'Washing machine', color: '#f5f8fb' },
  { id: 'towel', zone: 'bathroom', cat: 'furniture', name: 'Towel rack', color: '#ffd66b' },
  { id: 'litter', zone: 'bathroom', cat: 'furniture', name: 'Cat litter box', color: '#f4a3b6' },
  { id: 'bathmat', zone: 'bathroom', cat: 'furniture', name: 'Bath mat', color: '#8fc9f2' },
  { id: 'jacuzzi', zone: 'bathroom', cat: 'furniture', name: 'Hot tub', color: '#7fd6f0' },
  { id: 'bathshelf', zone: 'bathroom', cat: 'furniture', name: 'Bath shelf', color: '#8fc9f2' },
  { id: 'twall-aqua', zone: 'bathroom', cat: 'walls', name: 'Aqua', color: '#d4f0ee' },
  { id: 'twall-white', zone: 'bathroom', cat: 'walls', name: 'White', color: '#f5f8fb' },
  { id: 'twall-mint', zone: 'bathroom', cat: 'walls', name: 'Mint', color: '#d4efd0' },
  { id: 'twall-blush', zone: 'bathroom', cat: 'walls', name: 'Blush', color: '#ffe0e6' },
  { id: 'twall-lemon', zone: 'bathroom', cat: 'walls', name: 'Lemon', color: '#fff3b8' },
  { id: 'twall-navy', zone: 'bathroom', cat: 'walls', name: 'Navy', color: '#3b4f7a' },
  { id: 'twall-charcoal', zone: 'bathroom', cat: 'walls', name: 'Charcoal', color: '#2f3238' },
  { id: 'tfloor-white-tiles', zone: 'bathroom', cat: 'floors', name: 'White tiles', color: '#eef2f5' },
  { id: 'tfloor-oak', zone: 'bathroom', cat: 'floors', name: 'Oak', color: '#e4b574' },
  { id: 'tfloor-aqua-tiles', zone: 'bathroom', cat: 'floors', name: 'Aqua tiles', color: '#bfe8e6' },
  { id: 'tfloor-pink-tiles', zone: 'bathroom', cat: 'floors', name: 'Pink tiles', color: '#f6cfd8' },
  { id: 'tfloor-checker', zone: 'bathroom', cat: 'floors', name: 'Checkerboard', color: '#f4f1ea' },
  { id: 'tfloor-teak', zone: 'bathroom', cat: 'floors', name: 'Teak', color: '#b9824f' },
  { id: 'tfloor-slate-tiles', zone: 'bathroom', cat: 'floors', name: 'Slate tiles', color: '#5c6068' },
  // --- Vườn mở rộng (thắng màn 30): đồ "động" chạy theo gió chung (garden-expanded.mjs), đặt ở phần vườn mới nới ra.
  { id: 'windmill', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Windmill', color: '#f3d5a8' },
  { id: 'sunflowers', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Sunflowers', color: '#ffd23f' },
  { id: 'clothesline', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Clothesline', color: '#8fc9f2' },
  { id: 'campfire', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Campfire', color: '#ff7a3d' },
  { id: 'kite', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Kite', color: '#e8617f' },
  { id: 'stream', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Little stream', color: '#6fc3e0' },
  { id: 'swingtree', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Swing tree', color: '#6fbf4a' },
  { id: 'slide', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Slide', color: '#ffb347' },
  { id: 'birdhouse', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Birdhouse', color: '#e8617f' },
  { id: 'picnic', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Picnic table', color: '#e5483a' },
  // --- Mèo (dùng chung) ---
  // lock = màn thưởng mèo đó (thắng rồi nhận ở Map, xem catRewardsAt). Mèo cam mở sẵn từ đầu (mèo dẫn đường); stage 1 thưởng
  // thêm xám (màn 7), trắng (màn 10); từ stage 2 mỗi stage 3 bé rải đều ở màn 4, 7, 10 của stage (màn cuối stage luôn có một bé).
  { id: 'cat-orange', cat: 'cats', name: 'Orange cat', breed: 'orange' },
  { id: 'cat-gray', cat: 'cats', name: 'Gray cat', breed: 'gray' },
  { id: 'cat-white', cat: 'cats', name: 'White cat', breed: 'white' },
  { id: 'cat-tabby', cat: 'cats', name: 'Calico cat', breed: 'tabby' },
  { id: 'cat-siamese', cat: 'cats', name: 'Siamese cat', breed: 'siamese' },
  { id: 'cat-tuxedo', cat: 'cats', name: 'Tuxedo cat', breed: 'tuxedo' },
  // Chó: cùng mục 'cats' (thú cưng), cùng luật nhận thưởng ở Map (rải đều màn 21–60, mốc ở economy.mjs)
  { id: 'dog-shiba', cat: 'cats', name: 'Shiba dog', breed: 'shiba' },
  { id: 'dog-golden', cat: 'cats', name: 'Golden dog', breed: 'golden' },
  { id: 'dog-pug', cat: 'cats', name: 'Pug dog', breed: 'pug' },
  { id: 'dog-dalmatian', cat: 'cats', name: 'Dalmatian dog', breed: 'dalmatian' },
  { id: 'dog-malamute', cat: 'cats', name: 'Malamute dog', breed: 'malamute' },
  { id: 'dog-rottweiler', cat: 'cats', name: 'Rottweiler dog', breed: 'rottweiler' },
];
// Phương án thay thế cho từng món đồ: một đồ vật KHÁC đặt đúng chỗ của món gốc (slot), cùng giá, cùng mốc mở khoá. Một chỗ có thể có nhiều phương án (phòng khách / phòng ngủ: 3 lựa chọn mỗi chỗ).
// Model riêng (BUILD[id] trong deco-room.mjs / garden.mjs) nhưng giữ khuôn khổ + điểm neo cho mèo của món gốc,
// nên mèo vẫn chơi được như cũ (ví dụ đài phun nước vẫn có cá để rình, tủ đầu giường vẫn có bình hoa để đẩy rơi).
// Mỗi slot chỉ đặt được một món: đặt món khác thì nó thay chỗ món đang ở đó.
const VARIANTS = [
  // --- Vườn ---
  ['flowers', 'flowers-mushroom', 'Mushroom ring', '#e5483a'],
  ['stump', 'stump-hay', 'Hay bale', '#e8c25a'],
  ['catnip', 'catnip-grass', 'Cat grass tray', '#5fb83a'],
  ['lantern', 'lantern-torch', 'Tiki torch', '#ffb347'],
  ['sandbox', 'sandbox-turtle', 'Turtle sandbox', '#4fb34a'],
  ['cathouse', 'cathouse-barrel', 'Barrel house', '#b9854a'],
  ['pond', 'pond-fountain', 'Fountain', '#d9d2c4'],
  ['hammock', 'hammock-tire', 'Tire swing', '#3a3a3a'],
  ['birdbath', 'birdbath-feeder', 'Bird feeder', '#e5483a'],
  ['bench', 'bench-log', 'Log bench', '#9a6a45'],
  // lựa chọn thứ 3 cho từng chỗ trong vườn
  ['flowers', 'flowers-tulips', 'Tulip patch', '#ff5f7e'],
  ['stump', 'stump-crate', 'Apple crate', '#c9955e'],
  ['catnip', 'catnip-pot', 'Catnip pot', '#c9693d'],
  ['lantern', 'lantern-lamppost', 'Lamp post', '#2f3a3a'],
  ['sandbox', 'sandbox-parasol', 'Parasol sandbox', '#e5483a'],
  ['cathouse', 'cathouse-mushroom', 'Mushroom house', '#e5483a'],
  ['pond', 'pond-tub', 'Wooden tub pond', '#b9854a'],
  ['hammock', 'hammock-basket', 'Hanging basket', '#d9a36a'],
  ['birdbath', 'birdbath-mosaic', 'Mosaic bath', '#3a9aa0'],
  ['bench', 'bench-sofa', 'Wicker sofa', '#8fd4c4'],
  // kiểu thứ 4: bộ Vườn Nhật, giá gem (economy.mjs DECO)
  ['flowers', 'flowers-jp', 'Hydrangea bed', '#7f9cf0'],
  ['stump', 'stump-jp', 'Taiko drum', '#a8452f'],
  ['catnip', 'catnip-jp', 'Bamboo grove', '#7fb84a'],
  ['lantern', 'lantern-jp', 'Stone lantern', '#bdb6a6'],
  ['sandbox', 'sandbox-jp', 'Zen garden', '#e6e1d6'],
  ['cathouse', 'cathouse-jp', 'Pagoda house', '#d9452f'],
  ['pond', 'pond-jp', 'Koi bridge', '#d9452f'],
  ['hammock', 'hammock-jp', 'Sakura swing', '#ffb7c9'],
  ['birdbath', 'birdbath-jp', 'Stone basin', '#9fbf5a'],
  ['bench', 'bench-jp', 'Engawa deck', '#e8cf9f'],
  ['windmill', 'windmill-jp', 'Pagoda tower', '#d9452f'],
  ['sunflowers', 'sunflowers-jp', 'Iris bed', '#7f6fd8'],
  ['clothesline', 'clothesline-jp', 'Koinobori', '#3f6fd0'],
  ['campfire', 'campfire-jp', 'Irori hearth', '#5a4a40'],
  ['kite', 'kite-jp', 'Tako kite', '#e5483a'],
  ['stream', 'stream-jp', 'Stone stream', '#bdb6a6'],
  ['swingtree', 'swingtree-jp', 'Sakura tree', '#ffb7c9'],
  ['slide', 'slide-jp', 'Shrine slide', '#d9452f'],
  ['birdhouse', 'birdhouse-jp', 'Hokora shrine', '#a8452f'],
  ['picnic', 'picnic-jp', 'Tea parasol', '#c9302c'],
  // --- Phòng khách ---
  ['rug', 'rug-quilt', 'Patchwork quilt', '#ec5b8c'],
  ['armchair', 'armchair-rocker', 'Rocking chair', '#b9854a'],
  ['plant', 'plant-cactus', 'Cactus', '#4f9f5a'],
  ['yarn', 'yarn-toybox', 'Toy box', '#3b8fe0'],
  ['catbed', 'catbed-box', 'Cardboard box', '#d9a36a'],
  ['table', 'table-nightstand', 'Nightstand', '#f5f0e6'],
  ['lamp', 'lamp-heater', 'Heater', '#e5483a'],
  ['cattree', 'cattree-cactus', 'Cactus tower', '#4f9f5a'],
  ['shelf', 'shelf-wardrobe', 'Wardrobe', '#8fc9f2'],
  ['tank', 'tank-birdcage', 'Bird cage', '#d9a13a'],
  // lựa chọn thứ 3 cho từng chỗ trong phòng khách
  ['rug', 'rug-fish', 'Fish rug', '#8fc9f2'],
  ['armchair', 'armchair-papasan', 'Papasan chair', '#ec5b8c'],
  ['plant', 'plant-tulips', 'Tulip pot', '#ff8fb6'],
  ['yarn', 'yarn-ballpit', 'Ball pit', '#ffd23f'],
  ['catbed', 'catbed-heart', 'Heart cushion', '#ff8fb8'],
  ['table', 'table-crate', 'Crate table', '#c98a55'],
  ['lamp', 'lamp-lantern', 'Paper lantern', '#fff1d6'],
  ['cattree', 'cattree-castle', 'Cat castle', '#e6dfd2'],
  ['shelf', 'shelf-cubby', 'Cubby shelf', '#f5f0e6'],
  ['tank', 'tank-hamster', 'Hamster home', '#ffd66b'],
  // --- Phòng ngủ ---
  ['bed', 'bed-canopy', 'Canopy bed', '#ffb3c4'],
  ['bedrug', 'bedrug-cloud', 'Cloud rug', '#f4f8ff'],
  ['laundry', 'laundry-box', 'Moving box', '#d9a36a'],
  ['bedside', 'bedside-drawers', 'Chest of drawers', '#9fd0f0'],
  ['desk', 'desk-study', 'Study desk', '#d9a36a'],
  ['chair', 'chair-beanbag', 'Beanbag', '#ffd27a'],
  ['closet', 'closet-dresser', 'Vanity dresser', '#ffc9d5'],
  ['plushie', 'plushie-dino', 'Dino plush', '#7fc45a'],
  ['catsteps', 'catsteps-bridge', 'Rope bridge', '#b9854a'],
  // lựa chọn thứ 3 cho từng chỗ trong phòng ngủ
  ['bed', 'bed-kitty', 'Kitty bed', '#f7c99a'],
  ['bedrug', 'bedrug-star', 'Star rug', '#ffd66b'],
  ['laundry', 'laundry-washer', 'Mini washer', '#f5f8fb'],
  ['bedside', 'bedside-books', 'Book stack', '#e8617f'],
  ['desk', 'desk-piano', 'Piano', '#5a3a2e'],
  ['chair', 'chair-stool', 'Mushroom stool', '#e8617f'],
  ['closet', 'closet-ladder', 'Plant shelf', '#d9a36a'],
  ['plushie', 'plushie-bunny', 'Bunny plush', '#fff4f6'],
  ['catsteps', 'catsteps-clouds', 'Cloud steps', '#9fd0f0'],
  // --- Bếp: 3 lựa chọn mỗi chỗ (món gốc + 2 phương án) ---
  ['sink', 'sink-farm', 'Farmhouse sink', '#d9a36a'],
  ['dining', 'dining-square', 'Pine table', '#e9c58f'],
  ['fridge', 'fridge-retro', 'Retro fridge', '#ffc9d5'],
  ['stove', 'stove-wood', 'Wood stove', '#2f3238'],
  ['pantry', 'pantry-rack', 'Pantry rack', '#d9a36a'],
  ['kchair', 'kchair-stool', 'Bar stools', '#e8617f'],
  ['catfood', 'catfood-feeder', 'Auto feeder', '#f5f8fb'],
  // --- Phòng tắm: 3 lựa chọn mỗi chỗ (món gốc + 2 phương án) ---
  ['toilet', 'toilet-wood', 'Wooden-seat toilet', '#d9a36a'],
  ['toilet', 'toilet-kitty', 'Kitty toilet', '#ffc9d5'],
  ['vanity', 'vanity-pedestal', 'Pedestal sink', '#fffaf0'],
  ['vanity', 'vanity-wood', 'Wood vanity', '#c98a55'],
  ['bathtub', 'bathtub-wood', 'Wooden tub', '#d9a36a'],
  ['bathtub', 'bathtub-bubble', 'Bubble tub', '#8fc9f2'],
  ['shower', 'shower-rain', 'Rain shower', '#c8ccd2'],
  ['shower', 'shower-curtain', 'Curtain shower', '#ff8fb8'],
  ['washer', 'washer-retro', 'Retro washer', '#ffc9d5'],
  ['washer', 'washer-stack', 'Washer + dryer', '#c8ccd2'],
  ['towel', 'towel-ladder', 'Towel ladder', '#c98a55'],
  ['towel', 'towel-heated', 'Heated rail', '#c8ccd2'],
  ['litter', 'litter-hood', 'Hooded litter box', '#b48ee8'],
  ['litter', 'litter-cabinet', 'Litter cabinet', '#e9c58f'],
  ['bathmat', 'bathmat-fluffy', 'Fluffy mat', '#fff4f6'],
  ['bathmat', 'bathmat-duck', 'Duck mat', '#ffd66b'],
  ['jacuzzi', 'jacuzzi-cedar', 'Cedar hot tub', '#9a6a45'],
  ['jacuzzi', 'jacuzzi-mosaic', 'Mosaic spa', '#5fb8d8'],
  ['cart', 'cart-produce', 'Fruit stand', '#ff6b4a'],
  ['kplant', 'kplant-fig', 'Fiddle-leaf fig', '#3f8a3a'],
  ['sink', 'sink-steel', 'Steel sink', '#c8ccd2'],
  ['dining', 'dining-low', 'Tea table', '#c98a55'],
  ['fridge', 'fridge-steel', 'Steel fridge', '#c8ccd2'],
  ['stove', 'stove-red', 'Red range', '#e8483a'],
  ['pantry', 'pantry-hutch', 'Dish hutch', '#8fc9f2'],
  ['kchair', 'kchair-bench', 'Cushion bench', '#8fc9f2'],
  ['catfood', 'catfood-stand', 'Raised feeder', '#d9a36a'],
  ['cart', 'cart-coffee', 'Coffee cart', '#e8617f'],
  ['kplant', 'kplant-herbs', 'Herb planter', '#8fd46a'],
  // --- Vườn mở rộng ---
  ['windmill', 'windmill-turbine', 'Wind turbine', '#f5f8fb'],
  ['sunflowers', 'sunflowers-scarecrow', 'Scarecrow', '#e9c25a'],
  ['clothesline', 'clothesline-flags', 'Flag line', '#ffd66b'],
  ['campfire', 'campfire-tent', 'Camping tent', '#ff9f43'],
  ['kite', 'kite-balloons', 'Balloons', '#9fd0f0'],
  ['stream', 'stream-bridge', 'Stream bridge', '#c9955e'],
  ['swingtree', 'swingtree-treehouse', 'Treehouse', '#c98a55'],
  ['slide', 'slide-seesaw', 'Seesaw', '#7fc45a'],
  // lựa chọn thứ 3 cho từng chỗ ở vườn mở rộng
  ['windmill', 'windmill-windpump', 'Farm windpump', '#e5483a'],
  ['sunflowers', 'sunflowers-lavender', 'Lavender patch', '#9a7fd8'],
  ['clothesline', 'clothesline-lanterns', 'Paper lanterns', '#ffb347'],
  ['campfire', 'campfire-firepit', 'Stone fire pit', '#b5aea3'],
  ['kite', 'kite-windsock', 'Windsock', '#ff6b4a'],
  ['stream', 'stream-wheel', 'Water wheel', '#c9955e'],
  ['swingtree', 'swingtree-bench', 'Bench swing', '#c98a55'],
  ['slide', 'slide-dome', 'Climbing dome', '#3b8fe0'],
  ['birdhouse', 'birdhouse-dovecote', 'Dovecote', '#5a8fd6'],
  ['birdhouse', 'birdhouse-gourd', 'Gourd birdhouse', '#e9c58f'],
  ['picnic', 'picnic-blanket', 'Picnic blanket', '#3b8fe0'],
  ['picnic', 'picnic-cafe', 'Garden tea table', '#ff8fb8'],
  // --- Phòng ngủ / bếp / phòng tắm: món thêm sau (gương, kệ bánh, kệ tắm) ---
  ['mirror', 'mirror-cheval', 'Cheval mirror', '#b9854a'],
  ['mirror', 'mirror-arch', 'Arched mirror', '#fffaf0'],
  ['bakerack', 'bakerack-bread', 'Bread shelf', '#e0a050'],
  ['bakerack', 'bakerack-crates', 'Crate shelf', '#c9955e'],
  ['bathshelf', 'bathshelf-ladder', 'Ladder shelf', '#c98a55'],
  ['bathshelf', 'bathshelf-baskets', 'Basket cubby', '#ffd66b'],
  // --- Sân sau ---
  ['pool', 'pool-inflatable', 'Inflatable pool', '#5fb8e8'],
  ['pool', 'pool-sunken', 'In-ground pool', '#5fc8e8'],
  ['lounger', 'lounger-hammock', 'Hammock stand', '#ffb347'],
  ['lounger', 'lounger-deckchair', 'Deck chair', '#3b8fe0'],
  ['parasol', 'parasol-canopy', 'Canopy table', '#3b8fe0'],
  ['parasol', 'parasol-tree', 'Lemon tree bench', '#ffd23f'],
  ['grill', 'grill-kettle', 'Kettle grill', '#2f3238'],
  ['grill', 'grill-pizza', 'Pizza oven', '#c9693d'],
  ['deckbox', 'deckbox-cooler', 'Cooler box', '#3b8fe0'],
  ['deckbox', 'deckbox-basket', 'Beach basket', '#d9a35a'],
  ['greenhouse', 'greenhouse-shed', 'Garden shed', '#e9c58f'],
  ['greenhouse', 'greenhouse-tunnel', 'Polytunnel', '#e8f6f0'],
  ['vegbed', 'vegbed-berries', 'Strawberry bed', '#e8483a'],
  ['vegbed', 'vegbed-corn', 'Corn bed', '#ffd23f'],
  ['veggies', 'veggies-flowers', 'Flower beds', '#ff5f7e'],
  ['veggies', 'veggies-herbs', 'Herb beds', '#9a7fd8'],
  ['scarecrow', 'scarecrow-owl', 'Owl decoy', '#9a6a45'],
  ['scarecrow', 'scarecrow-vane', 'Weathervane', '#2f3238'],
  ['rainbarrel', 'rainbarrel-well', 'Wishing well', '#e8483a'],
  ['rainbarrel', 'rainbarrel-pump', 'Hand pump', '#e8483a'],
  // --- Trường mẫu giáo ---
  ['kdesk', 'kdesk-round', 'Round tables (2 sets)', '#ffd66b'],
  ['kdesk', 'kdesk-mats', 'Floor tables (2 sets)', '#bfe6f6'],
  ['kboard', 'kboard-white', 'Whiteboard', '#ffffff'],
  ['kboard', 'kboard-felt', 'Pin-up board', '#ff8fb8'],
  ['kcubby', 'kcubby-books', 'Bookshelves (pair)', '#7fc45a'],
  ['kcubby', 'kcubby-lockers', 'Backpack lockers (pair)', '#ff6b6b'],
  ['kpiano', 'kpiano-desk', "Teacher's desk", '#c98a55'],
  ['kpiano', 'kpiano-drums', 'Xylophone & drum', '#ff9a3c'],
  ['kplayset', 'kplayset-house', 'Playhouse', '#fff0c2'],
  ['kplayset', 'kplayset-tunnel', 'Rainbow climber', '#7fc45a'],
  ['kswing', 'kswing-tire', 'Tire swing', '#2f3238'],
  ['kswing', 'kswing-nest', 'Nest swing', '#ff9a3c'],
  ['kspring', 'kspring-rocker', 'Rocking horses (pair)', '#c98a55'],
  ['kspring', 'kspring-cars', 'Pedal cars (pair)', '#ff6b6b'],
  ['ksandpit', 'ksandpit-paddling', 'Paddling pool', '#5fb8e8'],
  ['ksandpit', 'ksandpit-water', 'Water table', '#5fb8e8'],
  ['kmerry', 'kmerry-seesaw', 'Seesaw', '#ffd66b'],
  ['kmerry', 'kmerry-carousel', 'Mini carousel', '#ff8fb8'],
  ['kbench', 'kbench-picnic', 'Picnic tables (pair)', '#7fc45a'],
  ['kbench', 'kbench-planter', 'Planter benches (pair)', '#c98a55'],
];
// Món theme Hồng / Hiện đại đã bỏ (quay lại các kiểu khác ở trên) -> chỗ của nó. Save còn giữ món này: hoàn đúng giá (giá món gốc), chỗ đang đặt quay về món gốc (clean).
export const RETIRED = Object.fromEntries(Object.entries({
  flowers: ['flowers-modern'], stump: ['stump-pink', 'stump-modern'], lantern: ['lantern-pink'], sandbox: ['sandbox-modern'], cathouse: ['cathouse-modern'],
  pond: ['pond-modern'], hammock: ['hammock-modern'], birdbath: ['birdbath-modern'], bench: ['bench-modern'],
  windmill: ['windmill-pink'], sunflowers: ['sunflowers-pink', 'sunflowers-modern'], clothesline: ['clothesline-modern'], campfire: ['campfire-modern'],
  kite: ['kite-modern'], stream: ['stream-pink', 'stream-modern'], swingtree: ['swingtree-pink', 'swingtree-modern'], birdhouse: ['birdhouse-pink', 'birdhouse-modern'],
  picnic: ['picnic-pink', 'picnic-modern'], slide: ['slide-modern'], mirror: ['mirror-pink', 'mirror-modern'],
  sink: ['sink-pink'], dining: ['dining-pink', 'dining-modern'], stove: ['stove-modern'], pantry: ['pantry-modern'], catfood: ['catfood-pink'], cart: ['cart-modern'],
  bakerack: ['bakerack-pink', 'bakerack-modern'], kplant: ['kplant-pink'],
  toilet: ['toilet-modern'], vanity: ['vanity-modern'], bathtub: ['bathtub-modern'], towel: ['towel-pink'], litter: ['litter-modern'], bathmat: ['bathmat-modern'],
  bathshelf: ['bathshelf-pink', 'bathshelf-modern'], jacuzzi: ['jacuzzi-pink'],
  pool: ['pool-pink', 'pool-modern', 'pool-lily'], lounger: ['lounger-pink', 'lounger-modern'], parasol: ['parasol-pink', 'parasol-modern'], grill: ['grill-pink', 'grill-modern'],
  deckbox: ['deckbox-pink', 'deckbox-modern'], greenhouse: ['greenhouse-pink', 'greenhouse-modern'], vegbed: ['vegbed-pink', 'vegbed-modern'],
  veggies: ['veggies-pink', 'veggies-modern'], scarecrow: ['scarecrow-pink', 'scarecrow-modern'], rainbarrel: ['rainbarrel-pink', 'rainbarrel-modern'],
  // Lựa chọn thứ 4 cũ (hiện đại tông đen ở phòng khách / phòng ngủ, châu Á ở bếp): mỗi chỗ chỉ giữ 3 món.
  rug: ['rug-modern'], armchair: ['armchair-lounge'], plant: ['plant-snake'], yarn: ['yarn-bin'], catbed: ['catbed-pod'], table: ['table-marble'],
  lamp: ['lamp-arc'], cattree: ['cattree-modern'], shelf: ['shelf-metal'], tank: ['tank-aquarium'],
  bed: ['bed-platform'], bedrug: ['bedrug-mono'], laundry: ['laundry-hamper'], bedside: ['bedside-noir'], desk: ['desk-setup'], chair: ['chair-office'],
  closet: ['closet-noir'], plushie: ['plushie-shark'], catsteps: ['catsteps-floating'],
  ...Object.fromEntries(['sink', 'dining', 'fridge', 'stove', 'pantry', 'kchair', 'catfood', 'cart', 'kplant'].map(slot => [`${slot}:asian`, [`${slot}-asian`]])),
}).flatMap(([slot, ids]) => ids.map(id => [id, slot.split(':')[0]])));
// Chèn mỗi phương án sau món gốc + các phương án cùng chỗ đã chèn (giữ thứ tự khai báo); giá / khoá / khu lấy từ món gốc nên luôn đồng giá.
VARIANTS.forEach(([slot, id, name, color]) => {
  const at = CATALOG.findLastIndex(entry => entry.id === slot || entry.slot === slot), base = CATALOG.find(entry => entry.id === slot);
  CATALOG.splice(at + 1, 0, { id, zone: base.zone, ...(base.area && { area: base.area }), cat: base.cat, name, color, slot });
});
// Giá thật = giá trong bảng DECO × hệ số khu, làm tròn 10 xu (mult = ZONE_PRICE_MULT; Level Editor truyền bảng đang sửa).
export const zonePrice = (entry, mult) => Math.round(entry.basePrice * (mult[entry.area || entry.zone] ?? 1) / 10) * 10;
// Giá gốc + khoá (chỉ thú cưng) từ economy.mjs: dòng của chính món, không có thì lấy dòng của món gốc (kiểu khác đồng giá món gốc).
for (const entry of CATALOG) {
  const row = DECO[entry.id] || DECO[entry.slot] || {};
  entry.basePrice = row.price ?? 0;
  if (row.lock) entry.lock = row.lock;
  // Món giá gem (bộ Vườn Nhật): không bán bằng xu, không nhân hệ số khu.
  if (row.gems) entry.gems = row.gems;
}
// Hệ số giá mỗi khu (ZONE_PRICING): khu thứ n → tổng giá món gốc = k × R(10n), chia cho tổng giá gốc món gốc của khu trong bảng DECO.
// Lọc món gốc tại chỗ (isBase khai ở dưới, chưa có lúc file chạy tới đây).
const rawBaseSum = area => CATALOG.filter(e => e.cat === 'furniture' && !e.slot && (e.area || e.zone) === area).reduce((sum, e) => sum + e.basePrice, 0);
export const ZONE_PRICE_MULT = {
  garden: ZONE_PRICING.gardenMult,
  ...Object.fromEntries(AREA_ORDER.map((area, i) => {
    // k theo số màn người chơi ở khu này (tới màn mốc khu kế): khu cuối nhóm đầu (phòng khách) kéo dài pace màn nên giá theo tỉ lệ đó,
    // không thì cả pace màn tiêu cho một khu giá 10 màn (nhịp 20: xu dư ~1.8 lần giá món gốc ở màn mốc).
    const { early, earlyPace, pace, kEarly, kLate } = ZONE_PRICING, next = AREA_ORDER[i + 1];
    const span = (next ? AREA_UNLOCK[next].level : AREA_UNLOCK[area].level + pace) - AREA_UNLOCK[area].level;
    const k = (i < early ? kEarly / earlyPace : kLate / pace) * span;
    return [area, k * paceReward(AREA_UNLOCK[area].level) / rawBaseSum(area)];
  })),
};
for (const entry of CATALOG) entry.price = zonePrice(entry, ZONE_PRICE_MULT);
export const itemById = id => CATALOG.find(entry => entry.id === id);
// Chỗ đặt của một món (món gốc: chính nó; phương án thay thế: món gốc).
export const slotOf = entry => entry.slot || entry.id;
const withoutSlot = (placed, entry) => placed.filter(id => slotOf(itemById(id)) !== slotOf(entry));
export const catalogFor = (zone, cat) => CATALOG.filter(entry => entry.cat === cat && (!entry.zone || entry.zone === zone));
// Danh mục gom theo chỗ đặt (để giao diện xếp các món "chọn một" cạnh nhau):
// đồ = mỗi chỗ một nhóm (món gốc + phương án thay thế); tường / sàn = cả danh mục chung một chỗ; mèo = cả danh mục một nhóm.
export function slotGroups(zone, cat) {
  const list = catalogFor(zone, cat);
  if (cat !== 'furniture') return [list];
  const groups = new Map();
  list.forEach(entry => groups.set(slotOf(entry), [...(groups.get(slotOf(entry)) || []), entry]));
  return [...groups.values()];
}

const zoneDefaults = zone => {
  const free = CATALOG.filter(entry => entry.zone === zone && isFree(entry));
  return {
    owned: free.map(entry => entry.id),
    placed: free.filter(entry => entry.cat === 'furniture' && !entry.slot).map(entry => entry.id),
    wall: free.find(entry => entry.cat === 'walls').id,
    floor: free.find(entry => entry.cat === 'floors').id,
    facade: free.find(entry => entry.cat === 'facade')?.id, // chỉ khu có tường lớp học (mẫu giáo)
  };
};
// Mèo có sẵn từ đầu; các giống khác phải nhận ở Map (nút Claim cạnh màn giống đó xuất hiện lần đầu, sau khi thắng màn đó).
export const STARTER_CATS = ['gray', 'orange', 'white'];
function defaults(startCoins) {
  return { coins: startCoins, cats: [...STARTER_CATS], claimedCats: [...STARTER_CATS], zone: 'garden', unlocked: [], expansionSeeded: true, zones: Object.fromEntries(ZONE_IDS.map(zone => [zone, zoneDefaults(zone)])) };
}

// Bỏ các id không còn trong danh mục (đồ đã đổi tên / bỏ khỏi game) khỏi save.
// Món theme đã bỏ (RETIRED): hoàn xu đúng giá món gốc, chỗ đang đặt món đó đặt lại món gốc.
function clean(deco) {
  const known = id => !!itemById(id);
  let coins = deco.coins;
  const zones = Object.fromEntries(Object.entries(deco.zones).filter(([zone]) => ZONES[zone]).map(([zone, state]) => {
    state.owned.filter(id => RETIRED[id]).forEach(id => { coins += itemById(RETIRED[id]).price; });
    const placed = state.placed.map(id => RETIRED[id] ?? id).filter((id, i, list) => known(id) && list.indexOf(id) === i);
    // save có từ trước khi có tường lớp học: lấy kiểu mặc định
    return [zone, { ...state, owned: state.owned.filter(known), placed, facade: known(state.facade) ? state.facade : zoneDefaults(zone).facade }];
  }));
  return { ...deco, coins, zones, fresh: (deco.fresh || []).filter(known) };
}

// Lần đầu có Deco: số xu = tổng thưởng các màn đã qua (progression.earnedCoins).
// Save cũ (trước khi có vườn, đồ mua cho phòng khách): phòng khách giờ khoá tới màn 10, nên hoàn lại xu
// của đồ đã mua để người chơi sắm cho vườn; phòng khách về mặc định.
// Mở khu CHỈ qua unlockArea (đủ màn + trả xu). loadDeco không bao giờ tự mở khu: save thiếu `unlocked` (save mới, save cũ, save hỏng) = chưa mở khu nào.
export function loadDeco(startCoins) {
  const saved = readJSON(SAVE_KEYS.deco);
  {
    // Save có từ trước khi thêm khu mới (vd. phòng ngủ): khu thiếu lấy mặc định, khu đã có giữ nguyên.
    if (saved && saved.zones) {
      const base = defaults(startCoins), zones = { ...base.zones, ...saved.zones };
      // Bản thử nghiệm từng tách vườn mở rộng thành khu 'garden2' riêng: gộp đồ đã có / đã đặt về vườn.
      if (zones.garden2) {
        const g = zones.garden, g2 = zones.garden2;
        zones.garden = { ...g, owned: [...new Set([...g.owned, ...g2.owned])], placed: [...new Set([...g.placed, ...g2.placed.filter(id => itemById(id)?.zone === 'garden')])] };
        delete zones.garden2;
      }
      // Save có từ trước khi có phần mở rộng: đặt sẵn đồ miễn phí của nó (chỉ hiện khi vườn đã mở rộng), một lần.
      if (!saved.expansionSeeded) {
        const free = CATALOG.filter(e => e.area === 'garden2' && isFree(e) && !e.slot).map(e => e.id);
        const taken = new Set(zones.garden.placed.map(id => slotOf(itemById(id) || { id })));
        zones.garden = { ...zones.garden, placed: [...zones.garden.placed, ...free.filter(id => !taken.has(id))] };
      }
      // Save có từ trước khi nhận mèo ở Map: mèo đang ở trong nhà coi như đã nhận.
      const claimedCats = saved.claimedCats ?? [...new Set([...STARTER_CATS, ...(saved.cats || [])])];
      return clean({ ...base, ...saved, zones, claimedCats, expansionSeeded: true, unlocked: validUnlocked(saved.unlocked) });
    }
    if (saved && Array.isArray(saved.owned)) {
      const base = defaults(startCoins);
      const refund = saved.owned.reduce((sum, id) => sum + (itemById(id)?.zone === 'living' ? itemById(id).price : 0), 0);
      const cats = saved.cats || base.cats;
      return { ...base, coins: (saved.coins ?? 0) + refund, cats, claimedCats: [...new Set([...STARTER_CATS, ...cats])], unlocked: [] };
    }
  }
  // Chưa có save Deco (lần đầu mở Deco, kể cả khi đã qua màn mốc): mọi khu vẫn phải trả xu để mở.
  return defaults(startCoins);
}
// Chỉ giữ tên khu hợp lệ, không trùng, đúng thứ tự mở (khu sau chỉ mở được khi khu trước đã mở).
function validUnlocked(list) {
  const set = new Set(Array.isArray(list) ? list : []), out = [];
  for (const area of AREA_ORDER) { if (!set.has(area)) break; out.push(area); }
  return out;
}
export function saveDeco(deco) {
  writeJSON(SAVE_KEYS.deco, deco);
}
export const zoneState = (deco, zone = deco.zone) => deco.zones[zone];
// Loại trang trí phủ cả khu (chọn một): danh mục -> trường lưu trong trạng thái khu. Tường lớp học (facade) chỉ khu mẫu giáo có.
export const SURFACE_FIELD = { walls: 'wall', floors: 'floor', facade: 'facade' };
export const isSurface = key => key in SURFACE_FIELD;
const withZone = (deco, zone, change) => ({ ...deco, zones: { ...deco.zones, [zone]: { ...deco.zones[zone], ...change } } });

// Trạng thái một món với người chơi hiện tại: locked / using / owned / buy / poor.
export function itemStatus(deco, entry, unlockedLevel) {
  // Mèo: chưa nhận ở Map thì khoá (dev "mở hết" — unlockedLevel = Infinity — thì bỏ qua).
  if (entry.cat === 'cats') {
    if (!isCatClaimed(deco, entry.breed) && unlockedLevel !== Infinity) return 'locked';
    return deco.cats.includes(entry.breed) ? 'using' : 'owned';
  }
  if (entry.lock && unlockedLevel < entry.lock) return 'locked';
  const zone = zoneState(deco, entry.zone);
  // Món giá 0 (kể cả phương án thay thế của món miễn phí) luôn coi như đã có, không cần "mua".
  const owned = zone.owned.includes(entry.id) || isFree(entry), affordable = deco.coins >= entry.price ? 'buy' : 'poor';
  if (isSurface(entry.cat)) return zone[SURFACE_FIELD[entry.cat]] === entry.id ? 'using' : owned ? 'owned' : affordable;
  if (!owned) return affordable;
  return zone.placed.includes(entry.id) ? 'using' : 'owned';
}

// Giống mèo thưởng ở màn levelIndex (chỉ số từ 0).
export const catRewardsAt = levelIndex => CATALOG.filter(entry => entry.cat === 'cats' && entry.lock === levelIndex + 1).map(entry => entry.breed);
export const isCatClaimed = (deco, breed) => (deco.claimedCats ?? STARTER_CATS).includes(breed);
// Nhận mèo từ Map: ghi đã nhận, còn chỗ trong nhà thì thả vào nhà luôn.
export function claimCat(deco, breed) {
  if (isCatClaimed(deco, breed)) return deco;
  const cats = deco.cats.length < MAX_ROOM_CATS && !deco.cats.includes(breed) ? [...deco.cats, breed] : deco.cats;
  return { ...deco, claimedCats: [...(deco.claimedCats ?? STARTER_CATS), breed], cats };
}

// Món đang chiếm chỗ của `entry` (phương án khác cùng slot), nếu có.
export const occupantOf = (deco, entry) => {
  if (entry.cat !== 'furniture') return null;
  const id = zoneState(deco, entry.zone).placed.find(other => other !== entry.id && slotOf(itemById(other)) === slotOf(entry));
  return id ? itemById(id) : null;
};

// Hành động chính trên một món; trả về deco mới (không sửa bản cũ) hoặc { error }.
export function applyAction(deco, entry, unlockedLevel) {
  const status = itemStatus(deco, entry, unlockedLevel);
  if (status === 'locked') return { error: `Unlocks at level ${entry.lock}` };
  if (status === 'poor') return { error: 'Not enough coins' };
  if (entry.cat === 'cats') {
    if (status === 'using') {
      if (deco.cats.length <= 1) return { error: 'Keep at least one pet' };
      return { ...deco, cats: deco.cats.filter(breed => breed !== entry.breed) };
    }
    return { ...deco, cats: [...deco.cats, entry.breed] };
  }
  const zone = zoneState(deco, entry.zone);
  let next = deco;
  if (status === 'buy') next = withZone(pay(deco, entry.price), entry.zone, { owned: [...zone.owned, entry.id] });
  if (isSurface(entry.cat)) return withZone(next, entry.zone, { [SURFACE_FIELD[entry.cat]]: entry.id });
  // Đặt vào thì thay món khác đang ở cùng chỗ.
  const placed = status === 'using' ? zone.placed.filter(id => id !== entry.id) : [...withoutSlot(zone.placed, entry), entry.id];
  return withZone(next, entry.zone, { placed });
}

// Dev (nút Unlock): có sẵn MỌI món mặc định (món gốc của từng chỗ đặt) ở mọi khu; chỗ nào còn trống thì đặt món gốc vào, chỗ đang đặt kiểu khác thì giữ.
export function ownAllBase(deco) {
  let next = deco;
  for (const entry of CATALOG.filter(isBase)) {
    const zone = zoneState(next, entry.zone);
    if (!zone) continue;
    const taken = zone.placed.some(id => slotOf(itemById(id) ?? entry) === slotOf(entry));
    next = withZone(next, entry.zone, { owned: zone.owned.includes(entry.id) ? zone.owned : [...zone.owned, entry.id], placed: taken ? zone.placed : [...zone.placed, entry.id] });
  }
  return next;
}

// Món đã có (đã mua, hoặc miễn phí) — chưa tính đang đặt hay không.
// Miễn phí = giá xu 0 và không có giá gem.
export const isFree = entry => entry.price === 0 && !entry.gems;
export const isOwned = (deco, entry) => isFree(entry) || (entry.cat === 'cats' ? true : zoneState(deco, entry.zone).owned.includes(entry.id));

// Xem trước MỌI món đồ chưa mua của một khu cùng lúc: mỗi chỗ đặt còn món chưa mua thì hiện một món
// (ưu tiên món gốc), thay món đang ở đó. Tường / sàn / mèo mỗi lúc chỉ một nên không gộp vào đây.
// `shown(entry)` lọc món đang hiện (vd. bỏ đồ phần vườn mở rộng khi vườn chưa mở rộng).
// Trả về { deco, items } — deco để dựng phòng, items là các món đang được xem trước.
export function previewAllNew(deco, zone = deco.zone, shown = () => true) {
  const items = slotGroups(zone, 'furniture').map(group => group.find(entry => shown(entry) && !isOwned(deco, entry))).filter(Boolean);
  const placed = items.reduce((list, entry) => [...withoutSlot(list, entry), entry.id], zoneState(deco, zone).placed);
  return { deco: withZone(deco, zone, { placed }), items };
}

// Bản xem trước: deco như thể món đang chọn đã được dùng (chưa trả xu).
export function previewDeco(deco, entry) {
  if (!entry) return deco;
  if (entry.cat === 'cats') return deco.cats.includes(entry.breed) || deco.cats.length >= MAX_ROOM_CATS ? deco : { ...deco, cats: [...deco.cats, entry.breed] };
  const zone = zoneState(deco, entry.zone);
  if (isSurface(entry.cat)) return withZone(deco, entry.zone, { [SURFACE_FIELD[entry.cat]]: entry.id });
  return zone.placed.includes(entry.id) ? deco : withZone(deco, entry.zone, { placed: [...withoutSlot(zone.placed, entry), entry.id] });
}

// ===== Deco kiểu "xây chỗ" + Shop Decoration =====
// Deco chỉ bán món gốc của từng chỗ (mua = mở khoá chỗ đó). Phương án thay thế của đồ, tường / sàn khác bán ở Shop
// (mục Decoration): mua vào kho, chưa đặt, ghi vào `fresh` để Deco báo "có món mới thay được". Đổi món: chạm món trong cảnh.
export const isBase = entry => entry.cat === 'furniture' && !entry.slot;
// Món bán ở Shop: phương án thay thế của đồ + tường / sàn không miễn phí.
// Món độc quyền (quà đăng nhập): không bán ở Shop / bảng đổi món, chỉ có được qua quà.
const EXCLUSIVE = new Set(LOGIN_CALENDAR.map(cell => cell.item).filter(Boolean));
export const isExclusive = entry => EXCLUSIVE.has(entry.id);
export const shopCatalog = zone => CATALOG.filter(entry => entry.zone === zone && !isExclusive(entry) && ((entry.cat === 'furniture' && entry.slot) || (isSurface(entry.cat) && !isFree(entry))));
// Tặng một món (quà): vào kho như mua ở Shop (chưa đặt, báo "món mới"), không trừ xu. Đã có thì trả null (người gọi đổi ra xu).
export function giftItem(deco, entry) {
  if (isOwned(deco, entry)) return null;
  const zone = zoneState(deco, entry.zone);
  return { ...withZone(deco, entry.zone, { owned: [...zone.owned, entry.id] }), fresh: [...(deco.fresh || []), entry.id] };
}
// Trạng thái ở Shop: locked (chưa tới màn) / needBase (chưa xây chỗ ở Deco) / owned / buy / poor.
// gems = số gem trong ví (món giá gem so với ví gem, không so xu).
export function shopStatus(deco, entry, unlockedLevel, gems = 0) {
  if (entry.lock && unlockedLevel < entry.lock) return 'locked';
  if (isOwned(deco, entry)) return 'owned';
  if (entry.slot && !isOwned(deco, itemById(entry.slot))) return 'needBase';
  return (entry.gems ? gems >= entry.gems : deco.coins >= entry.price) ? 'buy' : 'poor';
}
// Món giá gem: chỉ kiểm đủ gem + cho vào kho; người gọi tự trừ gem ở ví (core/gems.mjs spendGems).
export function buyToStock(deco, entry, unlockedLevel, gems = 0) {
  const status = shopStatus(deco, entry, unlockedLevel, gems);
  if (status === 'locked') return { error: `Unlocks at level ${entry.lock}` };
  if (status === 'needBase') return { error: `Build the ${itemById(entry.slot).name.toLowerCase()} in Deco first` };
  if (status === 'owned') return { error: 'Already owned' };
  if (status === 'poor') return { error: entry.gems ? 'Not enough gems' : 'Not enough coins' };
  const zone = zoneState(deco, entry.zone);
  return { ...withZone(pay(deco, entry.gems ? 0 : entry.price), entry.zone, { owned: [...zone.owned, entry.id] }), fresh: [...(deco.fresh || []), entry.id] };
}
// Các món đã có của một chỗ đồ (món gốc + phương án đã mua) / của tường hoặc sàn một khu.
export const ownedOptions = (deco, zone, key) => (isSurface(key) ? catalogFor(zone, key) : CATALOG.filter(entry => slotOf(entry) === key && entry.cat === 'furniture'))
  .filter(entry => isOwned(deco, entry));
// Dùng một món đã có (đồ: thay món đang ở chỗ đó; tường / sàn: đổi cả khu). Món vừa dùng thôi là "món mới".
export function useItem(deco, entry) {
  if (!isOwned(deco, entry)) return { error: 'Not owned yet' };
  const zone = zoneState(deco, entry.zone), fresh = (deco.fresh || []).filter(id => id !== entry.id);
  if (isSurface(entry.cat)) return { ...withZone(deco, entry.zone, { [SURFACE_FIELD[entry.cat]]: entry.id }), fresh };
  return { ...withZone(deco, entry.zone, { placed: [...withoutSlot(zone.placed, entry), entry.id] }), fresh };
}
// Món mới mua ở Shop mà chưa xem: đánh dấu theo chỗ (đồ) hoặc 'walls' / 'floors' của từng khu.
export const freshKeys = (deco, zone) => new Set((deco.fresh || []).map(itemById).filter(entry => entry?.zone === zone).map(entry => entry.cat === 'furniture' ? slotOf(entry) : entry.cat));
export const clearFresh = (deco, zone, key) => ({ ...deco, fresh: (deco.fresh || []).filter(id => { const entry = itemById(id); return !(entry && entry.zone === zone && (entry.cat === 'furniture' ? slotOf(entry) : entry.cat) === key); }) });
