// Dữ liệu Deco: 2 khu (vườn, phòng khách), danh mục đồ, giá, mốc mở khoá và trạng thái đã mua/đặt (lưu trong máy).
// Thuần dữ liệu/logic, không đụng giao diện. Xu kiếm bằng sao: mỗi sao mới = COINS_PER_STAR xu. Mèo dùng chung cả 2 khu.
export const COINS_PER_STAR = 50;
export const MAX_ROOM_CATS = 6;
const SAVE_KEY = 'gomgom-rotate-deco-v1';

// Vườn là khu của màn 1–10. Phòng khách mở khi thắng màn 10 (dành cho màn 11–20).
export const ZONES = {
  garden: { name: 'Garden', unlockAfter: 0, cats: { furniture: 'Garden', walls: 'Fences', floors: 'Ground', cats: 'Cats' } },
  living: { name: 'Living room', unlockAfter: 10, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
};
export const zoneOpen = (zone, cleared) => cleared >= ZONES[zone].unlockAfter;

// `lock` = level phải mở tới (1-based) thì mới mua được. Giá 0 = có sẵn từ đầu.
export const CATALOG = [
  // --- Vườn ---
  { id: 'flowers', zone: 'garden', cat: 'furniture', name: 'Flower bed', price: 0, color: '#ff9fb6' },
  { id: 'stump', zone: 'garden', cat: 'furniture', name: 'Tree stump', price: 80, color: '#9a6a45' },
  { id: 'catnip', zone: 'garden', cat: 'furniture', name: 'Catnip bush', price: 90, color: '#8fd46a' },
  { id: 'lantern', zone: 'garden', cat: 'furniture', name: 'Lantern', price: 100, color: '#ffd66b' },
  { id: 'sandbox', zone: 'garden', cat: 'furniture', name: 'Sandbox', price: 120, color: '#f3dfb0' },
  { id: 'cathouse', zone: 'garden', cat: 'furniture', name: 'Cat house', price: 150, color: '#e8617f' },
  { id: 'pond', zone: 'garden', cat: 'furniture', name: 'Koi pond', price: 200, color: '#6fc3e0', lock: 3 },
  { id: 'hammock', zone: 'garden', cat: 'furniture', name: 'Hammock', price: 240, color: '#8fc9f2', lock: 4 },
  { id: 'birdbath', zone: 'garden', cat: 'furniture', name: 'Bird bath', price: 180, color: '#cfd8e0', lock: 6 },
  { id: 'bench', zone: 'garden', cat: 'furniture', name: 'Bench', price: 220, color: '#b9854a', lock: 8 },
  { id: 'fence-white', zone: 'garden', cat: 'walls', name: 'White picket', price: 0, color: '#fffaf0' },
  { id: 'fence-wood', zone: 'garden', cat: 'walls', name: 'Wood fence', price: 80, color: '#c9955e' },
  { id: 'fence-hedge', zone: 'garden', cat: 'walls', name: 'Hedge', price: 120, color: '#6fbf4a' },
  { id: 'fence-stone', zone: 'garden', cat: 'walls', name: 'Stone wall', price: 150, color: '#c8c2b8', lock: 7 },
  { id: 'ground-grass', zone: 'garden', cat: 'floors', name: 'Grass', price: 0, color: '#9fd46a' },
  { id: 'ground-clover', zone: 'garden', cat: 'floors', name: 'Clover', price: 80, color: '#7fc45a' },
  { id: 'ground-meadow', zone: 'garden', cat: 'floors', name: 'Meadow', price: 120, color: '#b5dd7a' },
  { id: 'ground-path', zone: 'garden', cat: 'floors', name: 'Stone path', price: 150, color: '#d9d2c4', lock: 5 },
  // --- Phòng khách (mở cả khu khi thắng màn 10) ---
  { id: 'rug', zone: 'living', cat: 'furniture', name: 'Pink rug', price: 0, color: '#f4a3b6' },
  { id: 'armchair', zone: 'living', cat: 'furniture', name: 'Armchair', price: 120, color: '#e98b5a' },
  { id: 'plant', zone: 'living', cat: 'furniture', name: 'Plant', price: 90, color: '#7fc45a' },
  { id: 'yarn', zone: 'living', cat: 'furniture', name: 'Yarn basket', price: 80, color: '#ff8fa0' },
  { id: 'catbed', zone: 'living', cat: 'furniture', name: 'Cat bed', price: 150, color: '#a9d3f5' },
  { id: 'table', zone: 'living', cat: 'furniture', name: 'Side table', price: 180, color: '#d9a36a' },
  { id: 'lamp', zone: 'living', cat: 'furniture', name: 'Floor lamp', price: 200, color: '#ffd66b' },
  { id: 'cattree', zone: 'living', cat: 'furniture', name: 'Cat tree', price: 260, color: '#e6c79a' },
  { id: 'shelf', zone: 'living', cat: 'furniture', name: 'Bookshelf', price: 220, color: '#b9854a' },
  { id: 'tank', zone: 'living', cat: 'furniture', name: 'Fish tank', price: 300, color: '#6fc3e0' },
  { id: 'wall-cream', zone: 'living', cat: 'walls', name: 'Cream', price: 0, color: '#fff1d2' },
  { id: 'wall-mint', zone: 'living', cat: 'walls', name: 'Mint', price: 100, color: '#d4efd0' },
  { id: 'wall-peach', zone: 'living', cat: 'walls', name: 'Peach', price: 100, color: '#ffd9c4' },
  { id: 'wall-sky', zone: 'living', cat: 'walls', name: 'Sky', price: 150, color: '#d4e9ff' },
  { id: 'wall-lilac', zone: 'living', cat: 'walls', name: 'Lilac', price: 150, color: '#e6dcff' },
  { id: 'floor-oak', zone: 'living', cat: 'floors', name: 'Oak', price: 0, color: '#e4b574' },
  { id: 'floor-walnut', zone: 'living', cat: 'floors', name: 'Walnut', price: 100, color: '#a8744a' },
  { id: 'floor-carpet', zone: 'living', cat: 'floors', name: 'Pink carpet', price: 120, color: '#f3c2cc' },
  { id: 'floor-tiles', zone: 'living', cat: 'floors', name: 'Mint tiles', price: 150, color: '#bfe3cf' },
  // --- Mèo (dùng chung) ---
  { id: 'cat-orange', cat: 'cats', name: 'Orange cat', price: 0, breed: 'orange' },
  { id: 'cat-gray', cat: 'cats', name: 'Gray cat', price: 0, breed: 'gray' },
  { id: 'cat-white', cat: 'cats', name: 'White cat', price: 0, breed: 'white' },
  { id: 'cat-tabby', cat: 'cats', name: 'Tabby cat', price: 0, breed: 'tabby', lock: 6 },
  { id: 'cat-siamese', cat: 'cats', name: 'Siamese cat', price: 0, breed: 'siamese', lock: 9 },
  { id: 'cat-tuxedo', cat: 'cats', name: 'Tuxedo cat', price: 0, breed: 'tuxedo', lock: 10 },
];
export const itemById = id => CATALOG.find(entry => entry.id === id);
export const catalogFor = (zone, cat) => CATALOG.filter(entry => entry.cat === cat && (!entry.zone || entry.zone === zone));

const zoneDefaults = zone => {
  const free = CATALOG.filter(entry => entry.zone === zone && entry.price === 0);
  return {
    owned: free.map(entry => entry.id),
    placed: free.filter(entry => entry.cat === 'furniture').map(entry => entry.id),
    wall: free.find(entry => entry.cat === 'walls').id,
    floor: free.find(entry => entry.cat === 'floors').id,
  };
};
function defaults(totalStars) {
  return { coins: totalStars * COINS_PER_STAR, cats: ['gray', 'orange', 'white'], zone: 'garden', zones: { garden: zoneDefaults('garden'), living: zoneDefaults('living') } };
}

// Lần đầu có Deco: số xu = tổng sao đã có × COINS_PER_STAR.
// Save cũ (trước khi có vườn, đồ mua cho phòng khách): phòng khách giờ khoá tới màn 10, nên hoàn lại xu
// của đồ đã mua để người chơi sắm cho vườn; phòng khách về mặc định.
export function loadDeco(totalStars) {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && saved.zones) return { ...defaults(totalStars), ...saved };
    if (saved && Array.isArray(saved.owned)) {
      const base = defaults(totalStars);
      const refund = saved.owned.reduce((sum, id) => sum + (itemById(id)?.zone === 'living' ? itemById(id).price : 0), 0);
      return { ...base, coins: (saved.coins ?? 0) + refund, cats: saved.cats || base.cats };
    }
  } catch {}
  return defaults(totalStars);
}
export function saveDeco(deco) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(deco)); } catch {}
}
export const zoneState = (deco, zone = deco.zone) => deco.zones[zone];
const withZone = (deco, zone, change) => ({ ...deco, zones: { ...deco.zones, [zone]: { ...deco.zones[zone], ...change } } });

// Trạng thái một món với người chơi hiện tại: locked / using / owned / buy / poor.
export function itemStatus(deco, entry, unlockedLevel) {
  if (entry.lock && unlockedLevel < entry.lock) return 'locked';
  if (entry.cat === 'cats') return deco.cats.includes(entry.breed) ? 'using' : 'owned';
  const zone = zoneState(deco, entry.zone);
  const owned = zone.owned.includes(entry.id), affordable = deco.coins >= entry.price ? 'buy' : 'poor';
  if (entry.cat === 'walls') return zone.wall === entry.id ? 'using' : owned ? 'owned' : affordable;
  if (entry.cat === 'floors') return zone.floor === entry.id ? 'using' : owned ? 'owned' : affordable;
  if (!owned) return affordable;
  return zone.placed.includes(entry.id) ? 'using' : 'owned';
}

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
  if (status === 'buy') next = withZone({ ...deco, coins: deco.coins - entry.price }, entry.zone, { owned: [...zone.owned, entry.id] });
  if (entry.cat === 'walls') return withZone(next, entry.zone, { wall: entry.id });
  if (entry.cat === 'floors') return withZone(next, entry.zone, { floor: entry.id });
  const placed = status === 'using' ? zone.placed.filter(id => id !== entry.id) : [...zone.placed, entry.id];
  return withZone(next, entry.zone, { placed });
}

// Bản xem trước: deco như thể món đang chọn đã được dùng (chưa trả xu).
export function previewDeco(deco, entry) {
  if (!entry) return deco;
  if (entry.cat === 'cats') return deco.cats.includes(entry.breed) || deco.cats.length >= MAX_ROOM_CATS ? deco : { ...deco, cats: [...deco.cats, entry.breed] };
  const zone = zoneState(deco, entry.zone);
  if (entry.cat === 'walls') return withZone(deco, entry.zone, { wall: entry.id });
  if (entry.cat === 'floors') return withZone(deco, entry.zone, { floor: entry.id });
  return zone.placed.includes(entry.id) ? deco : withZone(deco, entry.zone, { placed: [...zone.placed, entry.id] });
}
