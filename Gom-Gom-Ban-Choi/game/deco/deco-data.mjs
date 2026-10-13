// Dữ liệu Deco: 4 khu (vườn — mở rộng thêm khi thắng màn 10, phòng khách, phòng ngủ, bếp), danh mục đồ, giá, mốc mở khoá và trạng thái đã mua/đặt (lưu trong máy).
// Thuần dữ liệu/logic, không đụng giao diện. Xu kiếm khi thắng màn lần đầu (levelReward, progression.mjs). Mèo dùng chung cả 2 khu.
import { ECONOMY } from '../gameplay/tuning.mjs';
import { DECO, ZONE_PRICE_MULT, AREA_UNLOCK } from '../gameplay/economy.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from '../gameplay/save.mjs';
export const { MAX_ROOM_CATS } = ECONOMY;

// Thứ tự mở khu: Vườn (từ đầu) -> Vườn 2 -> Phòng khách -> Phòng ngủ -> Bếp. Mốc màn + giá mở ở economy.mjs AREA_UNLOCK.
export const ZONES = {
  garden: { name: 'Garden', unlockAfter: 0, cats: { furniture: 'Garden', walls: 'Fences', floors: 'Ground', cats: 'Cats' } },
  living: { name: 'Living room', unlockAfter: AREA_UNLOCK.living.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
  bedroom: { name: 'Bedroom', unlockAfter: AREA_UNLOCK.bedroom.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
  kitchen: { name: 'Kitchen', unlockAfter: AREA_UNLOCK.kitchen.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
  bathroom: { name: 'Bathroom', unlockAfter: AREA_UNLOCK.bathroom.level, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
  backyard: { name: 'Backyard', unlockAfter: AREA_UNLOCK.backyard.level, cats: { furniture: 'Pool & veggies', walls: 'Fences', floors: 'Ground', cats: 'Cats' } },
};
export const ZONE_IDS = Object.keys(ZONES);
// Đã tới mốc màn của khu chưa (điều kiện 1 trong 2 để mở; điều kiện 2 là trả xu — xem areaState).
export const zoneOpen = (zone, cleared) => cleared >= ZONES[zone].unlockAfter;
// Vườn mở rộng (Vườn 2): mở thì vườn nới dài thêm về bên phải — CÙNG một khu vườn (chung nền,
// chung hàng rào), có thêm đồi và thêm đồ trong danh mục vườn (area: 'garden2').
export const GARDEN_EXPANSION = { unlockAfter: AREA_UNLOCK.garden2.level, name: 'Garden expansion' };
export const gardenExpanded = cleared => cleared >= GARDEN_EXPANSION.unlockAfter;

// ===== Mở khu: đủ màn + đủ xu thì mua khu (trừ xu). Mỗi khu đi qua các trạng thái =====
//   soon  : khu trước chưa mở              level : chưa thắng tới mốc màn
//   coins : đủ màn, ví chưa đủ xu (AREA_UNLOCK.cost)    ready : đủ cả hai, chạm "khánh thành" là mua + mở    open : đã mở
export const AREA_ORDER = ['garden2', 'living', 'bedroom', 'kitchen', 'bathroom', 'backyard'];
export const AREA_NAMES = { garden2: 'Garden expansion', living: 'Living room', bedroom: 'Bedroom', kitchen: 'Kitchen', bathroom: 'Bathroom', backyard: 'Backyard' };
export const areaOpen = (deco, area) => area === 'garden' || (deco.unlocked ?? []).includes(area);
const pay = (deco, price) => ({ ...deco, coins: deco.coins - price });
// table = bảng mốc mở khu (mặc định AREA_UNLOCK; Level Editor truyền bảng đang sửa để mô phỏng).
export function areaState(deco, area, cleared, table = AREA_UNLOCK) {
  if (areaOpen(deco, area)) return 'open';
  const before = AREA_ORDER[AREA_ORDER.indexOf(area) - 1];
  if (before && !areaOpen(deco, before)) return 'soon';
  if (cleared < table[area].level) return 'level';
  return deco.coins >= table[area].cost ? 'ready' : 'coins';
}
// Khu kế tiếp chưa mở (null = đã mở hết).
export const nextArea = deco => AREA_ORDER.find(area => !areaOpen(deco, area)) ?? null;
export function unlockArea(deco, area, cleared, table = AREA_UNLOCK) {
  const state = areaState(deco, area, cleared, table);
  if (state === 'open') return { error: 'Already open' };
  if (state === 'soon') return { error: `Open the ${AREA_NAMES[AREA_ORDER[AREA_ORDER.indexOf(area) - 1]].toLowerCase()} first` };
  if (state === 'level') return { error: `Beat level ${table[area].level} first` };
  if (state === 'coins') return { error: `Need ${table[area].cost - deco.coins} more coins` };
  return { ...pay(deco, table[area].cost), unlocked: [...(deco.unlocked ?? []), area] };
}

// Giá (price) và màn mở khoá (lock) của từng món KHÔNG khai ở đây: sửa ở gameplay/economy.mjs (bảng DECO), áp vào cuối danh mục.
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
  { id: 'desk', zone: 'bedroom', cat: 'furniture', name: 'Study desk', color: '#d9a36a' },
  { id: 'chair', zone: 'bedroom', cat: 'furniture', name: 'Wooden chair', color: '#ffd66b' },
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
  { id: 'sink', zone: 'kitchen', cat: 'furniture', name: 'Farmhouse sink', color: '#d9a36a' },
  { id: 'dining', zone: 'kitchen', cat: 'furniture', name: 'Pine table', color: '#e9c58f' },
  { id: 'fridge', zone: 'kitchen', cat: 'furniture', name: 'Fridge', color: '#bfe8d6' },
  { id: 'stove', zone: 'kitchen', cat: 'furniture', name: 'Wood stove', color: '#2f3238' },
  { id: 'pantry', zone: 'kitchen', cat: 'furniture', name: 'Pantry cupboard', color: '#ffe9b0' },
  { id: 'kchair', zone: 'kitchen', cat: 'furniture', name: 'Dining chairs (set of 4)', color: '#d9a36a' },
  { id: 'catfood', zone: 'kitchen', cat: 'furniture', name: 'Raised feeder', color: '#d9a36a' },
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
  // --- Phòng tắm (bên trái phòng ngủ, cửa trên tường trái phòng ngủ; mở theo AREA_UNLOCK.bathroom) ---
  { id: 'toilet', zone: 'bathroom', cat: 'furniture', name: 'Wooden-seat toilet', color: '#d9a36a' },
  { id: 'vanity', zone: 'bathroom', cat: 'furniture', name: 'Wood vanity', color: '#c98a55' },
  { id: 'bathtub', zone: 'bathroom', cat: 'furniture', name: 'Wooden tub', color: '#d9a36a' },
  { id: 'shower', zone: 'bathroom', cat: 'furniture', name: 'Shower', color: '#d4e9ff' },
  { id: 'washer', zone: 'bathroom', cat: 'furniture', name: 'Washing machine', color: '#f5f8fb' },
  { id: 'towel', zone: 'bathroom', cat: 'furniture', name: 'Towel ladder', color: '#c98a55' },
  { id: 'litter', zone: 'bathroom', cat: 'furniture', name: 'Litter cabinet', color: '#e9c58f' },
  { id: 'bathmat', zone: 'bathroom', cat: 'furniture', name: 'Bath mat', color: '#8fc9f2' },
  { id: 'jacuzzi', zone: 'bathroom', cat: 'furniture', name: 'Cedar hot tub', color: '#9a6a45' },
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
  // --- Vườn mở rộng (thắng màn 30): đồ "động" chạy theo gió chung (garden2-scene.mjs), đặt ở phần vườn mới nới ra.
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
];
// Mỗi chỗ đặt (slot) có đúng 3 món, mỗi món một theme: Gỗ (món gốc, mặc định — giữ đủ màu sắc tươi như thiết kế ban đầu, không tô lại tông gỗ), Hồng (nhẹ nhàng, điệu đà)
// và Hiện đại (công nghệ, neon, đèn LED). Món Hồng / Hiện đại đặt đúng chỗ của món gốc, cùng giá, cùng mốc mở khoá.
// Model riêng (BUILD[id] trong deco-room.mjs / *-scene.mjs) nhưng giữ khuôn khổ + điểm neo cho mèo của món gốc,
// nên mèo vẫn chơi được như cũ (ví dụ đài phun nước vẫn có cá để rình, tủ đầu giường vẫn có bình hoa để đẩy rơi).
// Mỗi slot chỉ đặt được một món: đặt món khác thì nó thay chỗ món đang ở đó.
export const THEME_IDS = ['wood', 'pink', 'modern'];
export const THEME_NAMES = { wood: 'Wood', pink: 'Pink', modern: 'Modern' };
// slot: [[id Hồng, tên, màu], [id Hiện đại, tên, màu]]
const THEMES = {
  // --- Vườn ---
  flowers: [['flowers-tulips', 'Pink tulips', '#ff8fb6'], ['flowers-modern', 'Neon planter', '#3fe0ff']],
  stump: [['stump-pink', 'Heart pouf', '#ffb3c8'], ['stump-modern', 'Glow cube seat', '#5ef0ff']],
  catnip: [['catnip-pot', 'Pink catnip pot', '#ff9fc0'], ['catnip-grass', 'Grow-light tray', '#b07cff']],
  lantern: [['lantern-pink', 'Heart lantern', '#ff9fc0'], ['lantern-lamppost', 'Neon lamp post', '#3fe0ff']],
  sandbox: [['sandbox-parasol', 'Pink parasol sandbox', '#ff8fb6'], ['sandbox-modern', 'Glow sandpit', '#3fe0ff']],
  cathouse: [['cathouse-mushroom', 'Pink mushroom house', '#ff8fb6'], ['cathouse-modern', 'Cat pod house', '#3a3d43']],
  pond: [['pond-fountain', 'Pink fountain', '#ffc2d4'], ['pond-modern', 'LED pond', '#3fe0ff']],
  hammock: [['hammock-basket', 'Pink hanging basket', '#ffb3c8'], ['hammock-modern', 'Egg pod swing', '#26282c']],
  birdbath: [['birdbath-mosaic', 'Pink mosaic bath', '#ff9fc0'], ['birdbath-modern', 'Smart bird feeder', '#3fe0ff']],
  bench: [['bench-sofa', 'Pink wicker sofa', '#ffb3c8'], ['bench-modern', 'Neon bench', '#26282c']],
  // --- Vườn mở rộng ---
  windmill: [['windmill-pink', 'Pinwheel mill', '#ffb3c8'], ['windmill-turbine', 'Wind turbine', '#f5f8fb']],
  sunflowers: [['sunflowers-pink', 'Rose bush', '#ff8fb6'], ['sunflowers-modern', 'Glow flowers', '#3fe0ff']],
  clothesline: [['clothesline-flags', 'Heart bunting', '#ff9fc0'], ['clothesline-modern', 'Neon string lights', '#b07cff']],
  campfire: [['campfire-tent', 'Pink tent', '#ff9fc0'], ['campfire-modern', 'Gas fire pit', '#26282c']],
  kite: [['kite-balloons', 'Heart balloons', '#ff8fb6'], ['kite-modern', 'Drone', '#3fe0ff']],
  stream: [['stream-pink', 'Blossom stream', '#ffc2d4'], ['stream-modern', 'LED water channel', '#3fe0ff']],
  swingtree: [['swingtree-pink', 'Blossom swing', '#ffb3c8'], ['swingtree-modern', 'Neon swing', '#b07cff']],
  birdhouse: [['birdhouse-pink', 'Pink birdhouse', '#ffb3c8'], ['birdhouse-modern', 'Smart birdhouse', '#3fe0ff']],
  picnic: [['picnic-pink', 'Pink picnic set', '#ff9fc0'], ['picnic-modern', 'Neon picnic table', '#26282c']],
  slide: [['slide-seesaw', 'Pink seesaw', '#ff8fb6'], ['slide-modern', 'Neon tube slide', '#3fe0ff']],
  // --- Phòng khách ---
  rug: [['rug-quilt', 'Pink quilt rug', '#ff9fc0'], ['rug-modern', 'Neon-edge rug', '#3a3d43']],
  armchair: [['armchair-papasan', 'Papasan chair', '#ec5b8c'], ['armchair-lounge', 'Lounge chair', '#26282c']],
  plant: [['plant-tulips', 'Tulip pot', '#ff8fb6'], ['plant-snake', 'Snake plant', '#2f3236']],
  yarn: [['yarn-ballpit', 'Pink ball pit', '#ffb3c8'], ['yarn-bin', 'Glow toy bin', '#4a4e55']],
  catbed: [['catbed-heart', 'Heart cushion', '#ff8fb8'], ['catbed-pod', 'Glow cat pod', '#3a3d43']],
  table: [['table-nightstand', 'Pink side table', '#ffc2d4'], ['table-marble', 'Black marble table', '#2b2d31']],
  lamp: [['lamp-lantern', 'Pink paper lantern', '#ffc2d4'], ['lamp-arc', 'Arc lamp', '#1f2125']],
  cattree: [['cattree-castle', 'Pink cat castle', '#ffc2d4'], ['cattree-modern', 'Modern cat tower', '#6b7078']],
  shelf: [['shelf-cubby', 'Pink cubby shelf', '#ffc2d4'], ['shelf-metal', 'Steel shelf', '#1f2125']],
  tank: [['tank-hamster', 'Hamster home', '#ff9fc0'], ['tank-aquarium', 'Black aquarium', '#26282c']],
  // --- Phòng ngủ ---
  bed: [['bed-canopy', 'Canopy bed', '#ffb3c4'], ['bed-platform', 'Platform bed', '#3a3d43']],
  bedrug: [['bedrug-cloud', 'Pink cloud rug', '#ffc2d4'], ['bedrug-mono', 'LED stripe rug', '#2b2e33']],
  laundry: [['laundry-washer', 'Pink mini washer', '#ffc2d4'], ['laundry-hamper', 'LED hamper', '#4a4e55']],
  bedside: [['bedside-drawers', 'Pink drawers', '#ffc2d4'], ['bedside-noir', 'Noir nightstand', '#26282c']],
  desk: [['desk-piano', 'Pink piano', '#ff9fc0'], ['desk-setup', 'RGB gaming desk', '#1a1c20']],
  chair: [['chair-beanbag', 'Pink beanbag', '#ffb3c8'], ['chair-office', 'Gaming chair', '#1f2125']],
  closet: [['closet-dresser', 'Vanity dresser', '#ffc9d5'], ['closet-noir', 'Noir wardrobe', '#26282c']],
  plushie: [['plushie-bunny', 'Pink bunny', '#ffc2d4'], ['plushie-shark', 'Robo shark', '#6b7078']],
  mirror: [['mirror-pink', 'Heart mirror', '#ffc2d4'], ['mirror-modern', 'LED mirror', '#26282c']],
  catsteps: [['catsteps-clouds', 'Pink cloud steps', '#ffc2d4'], ['catsteps-floating', 'LED wall shelves', '#1f2125']],
  // --- Bếp ---
  sink: [['sink-pink', 'Pink sink counter', '#ffc2d4'], ['sink-steel', 'Steel sink', '#c8ccd2']],
  dining: [['dining-pink', 'Pink dining table', '#f3c2cc'], ['dining-modern', 'Glass dining table', '#26282c']],
  fridge: [['fridge-retro', 'Retro fridge', '#ffc9d5'], ['fridge-steel', 'Steel fridge', '#c8ccd2']],
  stove: [['stove-red', 'Pink range', '#ff9fc0'], ['stove-modern', 'Induction range', '#26282c']],
  pantry: [['pantry-hutch', 'Pink dish hutch', '#ffc2d4'], ['pantry-modern', 'Smart pantry', '#26282c']],
  kchair: [['kchair-bench', 'Pink cushion bench', '#ffb3c8'], ['kchair-stool', 'Bar stools', '#26282c']],
  catfood: [['catfood-pink', 'Pink cat bowls', '#f4a3b6'], ['catfood-feeder', 'Auto feeder', '#f5f8fb']],
  cart: [['cart-coffee', 'Pink coffee cart', '#ff9fc0'], ['cart-modern', 'Steel bar cart', '#26282c']],
  bakerack: [['bakerack-pink', 'Cake stand rack', '#ffc2d4'], ['bakerack-modern', 'Smart oven tower', '#26282c']],
  kplant: [['kplant-pink', 'Pink anthurium', '#ff8fb6'], ['kplant-fig', 'Grow-light fig', '#3f8a3a']],
  // --- Phòng tắm ---
  toilet: [['toilet-kitty', 'Kitty toilet', '#ffc9d5'], ['toilet-modern', 'Smart toilet', '#f5f8fb']],
  vanity: [['vanity-pedestal', 'Pink pedestal sink', '#ffc2d4'], ['vanity-modern', 'LED mirror vanity', '#26282c']],
  bathtub: [['bathtub-bubble', 'Pink bubble tub', '#ffc2d4'], ['bathtub-modern', 'LED soaking tub', '#f5f8fb']],
  shower: [['shower-curtain', 'Curtain shower', '#ff8fb8'], ['shower-rain', 'LED rain shower', '#c8ccd2']],
  washer: [['washer-retro', 'Retro washer', '#ffc9d5'], ['washer-stack', 'Washer + dryer', '#c8ccd2']],
  towel: [['towel-pink', 'Pink towel rack', '#ffb3c8'], ['towel-heated', 'Heated rail', '#c8ccd2']],
  litter: [['litter-hood', 'Pink litter box', '#ffb3c8'], ['litter-modern', 'Self-clean litter', '#f5f8fb']],
  bathmat: [['bathmat-fluffy', 'Pink fluffy mat', '#ffc2d4'], ['bathmat-modern', 'Glow bath mat', '#3a3d43']],
  bathshelf: [['bathshelf-pink', 'Pink bath shelf', '#ffb3c8'], ['bathshelf-modern', 'LED bath cabinet', '#26282c']],
  jacuzzi: [['jacuzzi-pink', 'Pink hot tub', '#ffb3c8'], ['jacuzzi-mosaic', 'LED spa', '#3fe0ff']],
  // --- Sân sau ---
  pool: [['pool-pink', 'Heart pool', '#ff9fc0'], ['pool-modern', 'LED infinity pool', '#3fe0ff']],
  lounger: [['lounger-pink', 'Pink lounger', '#ffb3c8'], ['lounger-modern', 'Neon lounger', '#26282c']],
  parasol: [['parasol-pink', 'Pink parasol', '#ff9fc0'], ['parasol-modern', 'Solar canopy', '#26282c']],
  grill: [['grill-pink', 'Pink BBQ', '#ff9fc0'], ['grill-modern', 'Smart grill', '#26282c']],
  deckbox: [['deckbox-pink', 'Pink toy chest', '#ffb3c8'], ['deckbox-modern', 'Smart storage', '#26282c']],
  greenhouse: [['greenhouse-pink', 'Pink greenhouse', '#ffc2d4'], ['greenhouse-modern', 'Dome greenhouse', '#3fe0ff']],
  vegbed: [['vegbed-pink', 'Strawberry bed', '#ff8fb6'], ['vegbed-modern', 'Hydroponic bed', '#3fe0ff']],
  veggies: [['veggies-pink', 'Radish patch', '#ff9fc0'], ['veggies-modern', 'Grow-light patch', '#b07cff']],
  scarecrow: [['scarecrow-pink', 'Pink scarecrow', '#ffb3c8'], ['scarecrow-modern', 'Robot scarecrow', '#3fe0ff']],
  rainbarrel: [['rainbarrel-pink', 'Pink rain barrel', '#ff9fc0'], ['rainbarrel-modern', 'Smart water tank', '#26282c']],
};
// Món đã bỏ khi chia 3 theme -> chỗ của nó. Save còn giữ món này: hoàn đúng giá (giá món gốc), chỗ đang đặt quay về món gốc (loadDeco).
export const RETIRED = Object.fromEntries(Object.entries({
  flowers: ['flowers-mushroom'], stump: ['stump-hay', 'stump-crate'], lantern: ['lantern-torch'], sandbox: ['sandbox-turtle'],
  cathouse: ['cathouse-barrel'], pond: ['pond-tub'], hammock: ['hammock-tire'], birdbath: ['birdbath-feeder'], bench: ['bench-log'],
  sunflowers: ['sunflowers-scarecrow'], stream: ['stream-bridge'], swingtree: ['swingtree-treehouse'],
  rug: ['rug-fish'], armchair: ['armchair-rocker'], plant: ['plant-cactus'], yarn: ['yarn-toybox'], catbed: ['catbed-box'], table: ['table-crate'],
  lamp: ['lamp-heater'], cattree: ['cattree-cactus'], shelf: ['shelf-wardrobe'], tank: ['tank-birdcage'],
  bed: ['bed-kitty'], bedrug: ['bedrug-star'], laundry: ['laundry-box'], bedside: ['bedside-books'], desk: ['desk-study'], chair: ['chair-stool'],
  closet: ['closet-ladder'], plushie: ['plushie-dino'], catsteps: ['catsteps-bridge'],
  sink: ['sink-farm', 'sink-asian'], dining: ['dining-square', 'dining-low', 'dining-asian'], fridge: ['fridge-asian'], stove: ['stove-wood', 'stove-asian'],
  pantry: ['pantry-rack', 'pantry-asian'], kchair: ['kchair-asian'], catfood: ['catfood-stand', 'catfood-asian'], cart: ['cart-produce', 'cart-asian'],
  kplant: ['kplant-herbs', 'kplant-asian'],
  toilet: ['toilet-wood'], vanity: ['vanity-wood'], bathtub: ['bathtub-wood'], towel: ['towel-ladder'], litter: ['litter-cabinet'], bathmat: ['bathmat-duck'], jacuzzi: ['jacuzzi-cedar'],
}).flatMap(([slot, ids]) => ids.map(id => [id, slot])));
// Chèn hai món theme ngay sau món gốc (Gỗ -> Hồng -> Hiện đại); giá / khoá / khu lấy từ món gốc nên luôn đồng giá.
for (const [slot, options] of Object.entries(THEMES)) {
  const at = CATALOG.findIndex(entry => entry.id === slot), base = CATALOG[at];
  base.theme = 'wood';
  CATALOG.splice(at + 1, 0, ...options.map(([id, name, color], k) => ({ id, zone: base.zone, ...(base.area && { area: base.area }), cat: base.cat, name, color, slot, theme: THEME_IDS[k + 1] })));
}
// Giá thật = giá trong bảng DECO × hệ số khu, làm tròn 10 xu (mult = ZONE_PRICE_MULT; Level Editor truyền bảng đang sửa).
export const zonePrice = (entry, mult) => Math.round(entry.basePrice * (mult[entry.area || entry.zone] ?? 1) / 10) * 10;
// Giá + mốc mở khoá từ economy.mjs: dòng của chính món, không có thì lấy dòng của món gốc (kiểu khác đồng giá món gốc).
for (const entry of CATALOG) {
  const row = DECO[entry.id] || DECO[entry.slot] || {};
  entry.basePrice = row.price ?? 0;
  entry.price = zonePrice(entry, ZONE_PRICE_MULT);
  if (row.lock) entry.lock = row.lock;
}
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
  const free = CATALOG.filter(entry => entry.zone === zone && entry.price === 0);
  return {
    owned: free.map(entry => entry.id),
    placed: free.filter(entry => entry.cat === 'furniture' && !entry.slot).map(entry => entry.id),
    wall: free.find(entry => entry.cat === 'walls').id,
    floor: free.find(entry => entry.cat === 'floors').id,
  };
};
// Mèo có sẵn từ đầu; các giống khác phải nhận ở Map (nút Claim cạnh màn giống đó xuất hiện lần đầu, sau khi thắng màn đó).
export const STARTER_CATS = ['gray', 'orange', 'white'];
function defaults(startCoins) {
  return { coins: startCoins, cats: [...STARTER_CATS], claimedCats: [...STARTER_CATS], zone: 'garden', unlocked: [], expansionSeeded: true, zones: Object.fromEntries(ZONE_IDS.map(zone => [zone, zoneDefaults(zone)])) };
}

// Bỏ các id không còn trong danh mục (đồ đã đổi tên / bỏ khỏi game) khỏi save.
// Món đã bỏ khi chia 3 theme (RETIRED): hoàn xu đúng giá món gốc, chỗ đang đặt món đó đặt lại món gốc.
function clean(deco) {
  const known = id => !!itemById(id);
  let coins = deco.coins;
  const zones = Object.fromEntries(Object.entries(deco.zones).filter(([zone]) => ZONES[zone]).map(([zone, state]) => {
    state.owned.filter(id => RETIRED[id]).forEach(id => { coins += itemById(RETIRED[id]).price; });
    const placed = state.placed.map(id => RETIRED[id] ?? id).filter((id, i, list) => known(id) && list.indexOf(id) === i);
    return [zone, { ...state, owned: state.owned.filter(known), placed }];
  }));
  return { ...deco, coins, zones, fresh: (deco.fresh || []).filter(known) };
}

// Lần đầu có Deco: số xu = tổng thưởng các màn đã qua (progression.earnedCoins).
// Save cũ (trước khi có vườn, đồ mua cho phòng khách): phòng khách giờ khoá tới màn 10, nên hoàn lại xu
// của đồ đã mua để người chơi sắm cho vườn; phòng khách về mặc định.
// cleared = số màn đã thắng: save có từ trước khi mở khu bằng xu (chưa có `unlocked`) giữ các khu đã tới mốc màn (lúc đó mở miễn phí).
export function loadDeco(startCoins, cleared = 0) {
  const grandfather = AREA_ORDER.filter(area => cleared >= AREA_UNLOCK[area].level);
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
        const free = CATALOG.filter(e => e.area === 'garden2' && e.price === 0 && !e.slot).map(e => e.id);
        const taken = new Set(zones.garden.placed.map(id => slotOf(itemById(id) || { id })));
        zones.garden = { ...zones.garden, placed: [...zones.garden.placed, ...free.filter(id => !taken.has(id))] };
      }
      // Save có từ trước khi nhận mèo ở Map: mèo đang ở trong nhà coi như đã nhận.
      const claimedCats = saved.claimedCats ?? [...new Set([...STARTER_CATS, ...(saved.cats || [])])];
      const deco = clean({ ...base, ...saved, zones, claimedCats, expansionSeeded: true, unlocked: saved.unlocked ?? grandfather });
      // Có hoàn xu món đã bỏ: lưu ngay, không thì mỗi lần mở game lại hoàn thêm.
      if (deco.coins !== (saved.coins ?? base.coins)) saveDeco(deco);
      return deco;
    }
    if (saved && Array.isArray(saved.owned)) {
      const base = defaults(startCoins);
      const refund = saved.owned.reduce((sum, id) => sum + (itemById(id)?.zone === 'living' ? itemById(id).price : 0), 0);
      const cats = saved.cats || base.cats;
      return { ...base, coins: (saved.coins ?? 0) + refund, cats, claimedCats: [...new Set([...STARTER_CATS, ...cats])], unlocked: grandfather };
    }
  }
  return { ...defaults(startCoins), unlocked: grandfather };
}
export function saveDeco(deco) {
  writeJSON(SAVE_KEYS.deco, deco);
}
export const zoneState = (deco, zone = deco.zone) => deco.zones[zone];
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
  const owned = zone.owned.includes(entry.id) || entry.price === 0, affordable = deco.coins >= entry.price ? 'buy' : 'poor';
  if (entry.cat === 'walls') return zone.wall === entry.id ? 'using' : owned ? 'owned' : affordable;
  if (entry.cat === 'floors') return zone.floor === entry.id ? 'using' : owned ? 'owned' : affordable;
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
      if (deco.cats.length <= 1) return { error: 'Keep at least one cat' };
      return { ...deco, cats: deco.cats.filter(breed => breed !== entry.breed) };
    }
    if (deco.cats.length >= MAX_ROOM_CATS) return { error: `Up to ${MAX_ROOM_CATS} cats` };
    return { ...deco, cats: [...deco.cats, entry.breed] };
  }
  const zone = zoneState(deco, entry.zone);
  let next = deco;
  if (status === 'buy') next = withZone(pay(deco, entry.price), entry.zone, { owned: [...zone.owned, entry.id] });
  if (entry.cat === 'walls') return withZone(next, entry.zone, { wall: entry.id });
  if (entry.cat === 'floors') return withZone(next, entry.zone, { floor: entry.id });
  // Đặt vào thì thay món khác đang ở cùng chỗ.
  const placed = status === 'using' ? zone.placed.filter(id => id !== entry.id) : [...withoutSlot(zone.placed, entry), entry.id];
  return withZone(next, entry.zone, { placed });
}

// Món đã có (đã mua, hoặc miễn phí) — chưa tính đang đặt hay không.
export const isOwned = (deco, entry) => entry.price === 0 || (entry.cat === 'cats' ? true : zoneState(deco, entry.zone).owned.includes(entry.id));

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
  if (entry.cat === 'walls') return withZone(deco, entry.zone, { wall: entry.id });
  if (entry.cat === 'floors') return withZone(deco, entry.zone, { floor: entry.id });
  return zone.placed.includes(entry.id) ? deco : withZone(deco, entry.zone, { placed: [...withoutSlot(zone.placed, entry), entry.id] });
}

// ===== Deco kiểu "xây chỗ" + Shop Decoration =====
// Deco chỉ bán món gốc của từng chỗ (mua = mở khoá chỗ đó). Phương án thay thế của đồ, tường / sàn khác bán ở Shop
// (mục Decoration): mua vào kho, chưa đặt, ghi vào `fresh` để Deco báo "có món mới thay được". Đổi món: chạm món trong cảnh.
export const isBase = entry => entry.cat === 'furniture' && !entry.slot;
// Món bán ở Shop: phương án thay thế của đồ + tường / sàn không miễn phí.
export const shopCatalog = zone => CATALOG.filter(entry => entry.zone === zone && ((entry.cat === 'furniture' && entry.slot) || ((entry.cat === 'walls' || entry.cat === 'floors') && entry.price > 0)));
// Trạng thái ở Shop: locked (chưa tới màn) / needBase (chưa xây chỗ ở Deco) / owned / buy / poor.
export function shopStatus(deco, entry, unlockedLevel) {
  if (entry.lock && unlockedLevel < entry.lock) return 'locked';
  if (isOwned(deco, entry)) return 'owned';
  if (entry.slot && !isOwned(deco, itemById(entry.slot))) return 'needBase';
  return deco.coins >= entry.price ? 'buy' : 'poor';
}
export function buyToStock(deco, entry, unlockedLevel) {
  const status = shopStatus(deco, entry, unlockedLevel);
  if (status === 'locked') return { error: `Unlocks at level ${entry.lock}` };
  if (status === 'needBase') return { error: `Build the ${itemById(entry.slot).name.toLowerCase()} in Deco first` };
  if (status === 'owned') return { error: 'Already owned' };
  if (status === 'poor') return { error: 'Not enough coins' };
  const zone = zoneState(deco, entry.zone);
  return { ...withZone(pay(deco, entry.price), entry.zone, { owned: [...zone.owned, entry.id] }), fresh: [...(deco.fresh || []), entry.id] };
}
// Các món đã có của một chỗ đồ (món gốc + phương án đã mua) / của tường hoặc sàn một khu.
export const ownedOptions = (deco, zone, key) => (key === 'walls' || key === 'floors' ? catalogFor(zone, key) : CATALOG.filter(entry => slotOf(entry) === key && entry.cat === 'furniture'))
  .filter(entry => isOwned(deco, entry));
// Dùng một món đã có (đồ: thay món đang ở chỗ đó; tường / sàn: đổi cả khu). Món vừa dùng thôi là "món mới".
export function useItem(deco, entry) {
  if (!isOwned(deco, entry)) return { error: 'Not owned yet' };
  const zone = zoneState(deco, entry.zone), fresh = (deco.fresh || []).filter(id => id !== entry.id);
  if (entry.cat === 'walls') return { ...withZone(deco, entry.zone, { wall: entry.id }), fresh };
  if (entry.cat === 'floors') return { ...withZone(deco, entry.zone, { floor: entry.id }), fresh };
  return { ...withZone(deco, entry.zone, { placed: [...withoutSlot(zone.placed, entry), entry.id] }), fresh };
}
// Món mới mua ở Shop mà chưa xem: đánh dấu theo chỗ (đồ) hoặc 'walls' / 'floors' của từng khu.
export const freshKeys = (deco, zone) => new Set((deco.fresh || []).map(itemById).filter(entry => entry?.zone === zone).map(entry => entry.cat === 'furniture' ? slotOf(entry) : entry.cat));
export const clearFresh = (deco, zone, key) => ({ ...deco, fresh: (deco.fresh || []).filter(id => { const entry = itemById(id); return !(entry && entry.zone === zone && (entry.cat === 'furniture' ? slotOf(entry) : entry.cat) === key); }) });
