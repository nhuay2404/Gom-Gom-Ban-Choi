// Dữ liệu Deco: 4 khu (vườn — mở rộng thêm khi thắng màn 10, phòng khách, phòng ngủ, bếp), danh mục đồ, giá, mốc mở khoá và trạng thái đã mua/đặt (lưu trong máy).
// Thuần dữ liệu/logic, không đụng giao diện. Xu kiếm khi thắng màn lần đầu (ECONOMY.LEVEL_REWARD). Mèo dùng chung cả 2 khu.
import { ECONOMY } from '../gameplay/tuning.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from '../gameplay/save.mjs';
export const { MAX_ROOM_CATS } = ECONOMY;

// Thứ tự mở khu: Vườn (từ đầu) -> Vườn 2 (thắng màn 10) -> Phòng khách (thắng màn 20) -> Phòng ngủ (thắng màn 30) -> Bếp (thắng màn 40).
export const ZONES = {
  garden: { name: 'Garden', unlockAfter: 0, cats: { furniture: 'Garden', walls: 'Fences', floors: 'Ground', cats: 'Cats' } },
  living: { name: 'Living room', unlockAfter: 20, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
  bedroom: { name: 'Bedroom', unlockAfter: 30, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
  kitchen: { name: 'Kitchen', unlockAfter: 40, cats: { furniture: 'Furniture', walls: 'Walls', floors: 'Floors', cats: 'Cats' } },
};
export const ZONE_IDS = Object.keys(ZONES);
export const zoneOpen = (zone, cleared) => cleared >= ZONES[zone].unlockAfter;
// Vườn mở rộng (Vườn 2): thắng màn 10 thì vườn nới dài thêm về bên phải — CÙNG một khu vườn (chung nền,
// chung hàng rào), có thêm đồi và thêm đồ trong danh mục vườn (area: 'garden2', mở dần từ màn 11).
export const GARDEN_EXPANSION = { unlockAfter: 10, name: 'Garden expansion' };
export const gardenExpanded = cleared => cleared >= GARDEN_EXPANSION.unlockAfter;

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
  { id: 'fence-wood', zone: 'garden', cat: 'walls', name: 'Wood fence', price: 100, color: '#c9955e' },
  { id: 'fence-hedge', zone: 'garden', cat: 'walls', name: 'Hedge', price: 100, color: '#6fbf4a' },
  { id: 'fence-stone', zone: 'garden', cat: 'walls', name: 'Stone wall', price: 100, color: '#c8c2b8', lock: 7 },
  { id: 'ground-grass', zone: 'garden', cat: 'floors', name: 'Grass', price: 0, color: '#9fd46a' },
  { id: 'ground-clover', zone: 'garden', cat: 'floors', name: 'Clover', price: 100, color: '#7fc45a' },
  { id: 'ground-meadow', zone: 'garden', cat: 'floors', name: 'Meadow', price: 100, color: '#b5dd7a' },
  { id: 'ground-path', zone: 'garden', cat: 'floors', name: 'Stone path', price: 100, color: '#d9d2c4', lock: 5 },
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
  { id: 'wall-sky', zone: 'living', cat: 'walls', name: 'Sky', price: 100, color: '#d4e9ff' },
  { id: 'wall-lilac', zone: 'living', cat: 'walls', name: 'Lilac', price: 100, color: '#e6dcff' },
  // tông hiện đại đen / xám
  { id: 'wall-concrete', zone: 'living', cat: 'walls', name: 'Concrete', price: 100, color: '#8d9196' },
  { id: 'wall-graphite', zone: 'living', cat: 'walls', name: 'Graphite', price: 100, color: '#3b3f46' },
  { id: 'floor-oak', zone: 'living', cat: 'floors', name: 'Oak', price: 0, color: '#e4b574' },
  { id: 'floor-walnut', zone: 'living', cat: 'floors', name: 'Walnut', price: 100, color: '#a8744a' },
  { id: 'floor-carpet', zone: 'living', cat: 'floors', name: 'Pink carpet', price: 100, color: '#f3c2cc' },
  { id: 'floor-tiles', zone: 'living', cat: 'floors', name: 'Mint tiles', price: 100, color: '#bfe3cf' },
  { id: 'floor-concrete', zone: 'living', cat: 'floors', name: 'Polished concrete', price: 100, color: '#9a9da1' },
  { id: 'floor-ebony', zone: 'living', cat: 'floors', name: 'Ebony wood', price: 100, color: '#3a3330' },
  // --- Phòng ngủ (mở cả khu khi thắng màn 15; đồ mở dần ở màn 16–19) ---
  { id: 'bed', zone: 'bedroom', cat: 'furniture', name: 'Cozy bed', price: 0, color: '#8fc9f2' },
  { id: 'bedrug', zone: 'bedroom', cat: 'furniture', name: 'Fluffy rug', price: 0, color: '#e6dcff' },
  { id: 'laundry', zone: 'bedroom', cat: 'furniture', name: 'Laundry basket', price: 100, color: '#e9c58f', lock: 36 },
  { id: 'bedside', zone: 'bedroom', cat: 'furniture', name: 'Bedside table', price: 120, color: '#f3d5a8', lock: 36 },
  { id: 'desk', zone: 'bedroom', cat: 'furniture', name: 'Gaming desk', price: 260, color: '#3a3f4a', lock: 36 },
  { id: 'chair', zone: 'bedroom', cat: 'furniture', name: 'Gaming chair', price: 180, color: '#e8617f', lock: 37 },
  { id: 'closet', zone: 'bedroom', cat: 'furniture', name: 'Closet', price: 220, color: '#fff4e0', lock: 37 },
  { id: 'plushie', zone: 'bedroom', cat: 'furniture', name: 'Teddy bear', price: 150, color: '#d9a36a', lock: 38 },
  { id: 'catsteps', zone: 'bedroom', cat: 'furniture', name: 'Wall steps', price: 240, color: '#c98a55', lock: 39 },
  { id: 'bwall-lavender', zone: 'bedroom', cat: 'walls', name: 'Lavender', price: 0, color: '#ebe3f8' },
  { id: 'bwall-blush', zone: 'bedroom', cat: 'walls', name: 'Blush', price: 100, color: '#ffe0e6' },
  { id: 'bwall-sage', zone: 'bedroom', cat: 'walls', name: 'Sage', price: 100, color: '#dcebd6' },
  { id: 'bwall-butter', zone: 'bedroom', cat: 'walls', name: 'Butter', price: 100, color: '#fff0c2' },
  { id: 'bwall-night', zone: 'bedroom', cat: 'walls', name: 'Night blue', price: 100, color: '#c9d3ee' },
  // tông hiện đại đen / xám
  { id: 'bwall-slate', zone: 'bedroom', cat: 'walls', name: 'Slate', price: 100, color: '#6b7280' },
  { id: 'bwall-charcoal', zone: 'bedroom', cat: 'walls', name: 'Charcoal', price: 100, color: '#2f3238' },
  // Phòng trong nhà (phòng khách, phòng ngủ) đều mặc định sàn Oak miễn phí; vườn giữ nền cỏ.
  { id: 'bfloor-oak', zone: 'bedroom', cat: 'floors', name: 'Oak', price: 0, color: '#e4b574' },
  { id: 'bfloor-maple', zone: 'bedroom', cat: 'floors', name: 'Maple', price: 100, color: '#e9c493' },
  { id: 'bfloor-ash', zone: 'bedroom', cat: 'floors', name: 'Ash wood', price: 100, color: '#cdb69a' },
  { id: 'bfloor-carpet', zone: 'bedroom', cat: 'floors', name: 'Lilac carpet', price: 100, color: '#d9d4f2' },
  { id: 'bfloor-tiles', zone: 'bedroom', cat: 'floors', name: 'Peach tiles', price: 100, color: '#f2d7c9' },
  { id: 'bfloor-graphite-tiles', zone: 'bedroom', cat: 'floors', name: 'Graphite tiles', price: 100, color: '#4a4e55' },
  { id: 'bfloor-smoke-carpet', zone: 'bedroom', cat: 'floors', name: 'Smoke carpet', price: 100, color: '#5c6068' },
  // --- Bếp (mở cả khu khi thắng màn 40, nên đồ không cần khoá thêm theo màn) ---
  { id: 'sink', zone: 'kitchen', cat: 'furniture', name: 'Sink counter', price: 0, color: '#fff4e0' },
  { id: 'dining', zone: 'kitchen', cat: 'furniture', name: 'Dining table', price: 0, color: '#f3c2cc' },
  { id: 'fridge', zone: 'kitchen', cat: 'furniture', name: 'Fridge', price: 220, color: '#bfe8d6' },
  { id: 'stove', zone: 'kitchen', cat: 'furniture', name: 'Stove', price: 240, color: '#fff4e0' },
  { id: 'pantry', zone: 'kitchen', cat: 'furniture', name: 'Pantry cupboard', price: 200, color: '#ffe9b0' },
  { id: 'kchair', zone: 'kitchen', cat: 'furniture', name: 'Dining chairs (set of 4)', price: 120, color: '#d9a36a' },
  { id: 'catfood', zone: 'kitchen', cat: 'furniture', name: 'Cat bowls', price: 90, color: '#f4a3b6' },
  { id: 'cart', zone: 'kitchen', cat: 'furniture', name: 'Tea cart', price: 180, color: '#ffd66b' },
  { id: 'kplant', zone: 'kitchen', cat: 'furniture', name: 'Monstera', price: 110, color: '#5fae46' },
  { id: 'kwall-butter', zone: 'kitchen', cat: 'walls', name: 'Butter', price: 0, color: '#fff0c2' },
  { id: 'kwall-mint', zone: 'kitchen', cat: 'walls', name: 'Mint', price: 100, color: '#d4efd0' },
  { id: 'kwall-peach', zone: 'kitchen', cat: 'walls', name: 'Peach', price: 100, color: '#ffd9c4' },
  { id: 'kwall-sky', zone: 'kitchen', cat: 'walls', name: 'Sky', price: 100, color: '#d4e9ff' },
  { id: 'kwall-sage', zone: 'kitchen', cat: 'walls', name: 'Sage', price: 100, color: '#dcebd6' },
  { id: 'kwall-brick', zone: 'kitchen', cat: 'walls', name: 'Brick', price: 100, color: '#e0a08a' },
  { id: 'kwall-slate', zone: 'kitchen', cat: 'walls', name: 'Slate', price: 100, color: '#6b7280' },
  { id: 'kwall-vermilion', zone: 'kitchen', cat: 'walls', name: 'Vermilion', price: 100, color: '#cf5b45' },
  { id: 'kwall-washi', zone: 'kitchen', cat: 'walls', name: 'Washi paper', price: 100, color: '#efe3c4' },
  { id: 'kfloor-oak', zone: 'kitchen', cat: 'floors', name: 'Oak', price: 0, color: '#e4b574' },
  { id: 'kfloor-pine', zone: 'kitchen', cat: 'floors', name: 'Pine', price: 100, color: '#e9c493' },
  { id: 'kfloor-terracotta-tiles', zone: 'kitchen', cat: 'floors', name: 'Terracotta tiles', price: 100, color: '#d9825b' },
  { id: 'kfloor-mint-tiles', zone: 'kitchen', cat: 'floors', name: 'Mint tiles', price: 100, color: '#bfe3cf' },
  { id: 'kfloor-checker', zone: 'kitchen', cat: 'floors', name: 'Checkerboard', price: 100, color: '#f4f1ea' },
  { id: 'kfloor-slate-tiles', zone: 'kitchen', cat: 'floors', name: 'Slate tiles', price: 100, color: '#5c6068' },
  { id: 'kfloor-tatami', zone: 'kitchen', cat: 'floors', name: 'Tatami', price: 100, color: '#cfc994' },
  { id: 'kfloor-bamboo', zone: 'kitchen', cat: 'floors', name: 'Bamboo', price: 100, color: '#d9c27a' },
  // --- Vườn mở rộng (thắng màn 30): đồ "động" chạy theo gió chung (garden2-scene.mjs), đặt ở phần vườn mới nới ra.
  { id: 'windmill', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Windmill', price: 0, color: '#f3d5a8', lock: 11 },
  { id: 'sunflowers', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Sunflowers', price: 0, color: '#ffd23f', lock: 11 },
  { id: 'clothesline', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Clothesline', price: 200, color: '#8fc9f2', lock: 11 },
  { id: 'campfire', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Campfire', price: 260, color: '#ff7a3d', lock: 12 },
  { id: 'kite', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Kite', price: 220, color: '#e8617f', lock: 13 },
  { id: 'stream', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Little stream', price: 280, color: '#6fc3e0', lock: 14 },
  { id: 'swingtree', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Swing tree', price: 320, color: '#6fbf4a', lock: 15 },
  { id: 'slide', zone: 'garden', area: 'garden2', cat: 'furniture', name: 'Slide', price: 340, color: '#ffb347', lock: 17 },
  // --- Mèo (dùng chung) ---
  { id: 'cat-orange', cat: 'cats', name: 'Orange cat', price: 0, breed: 'orange' },
  { id: 'cat-gray', cat: 'cats', name: 'Gray cat', price: 0, breed: 'gray' },
  { id: 'cat-white', cat: 'cats', name: 'White cat', price: 0, breed: 'white' },
  { id: 'cat-tabby', cat: 'cats', name: 'Calico cat', price: 0, breed: 'tabby', lock: 6 },
  { id: 'cat-siamese', cat: 'cats', name: 'Siamese cat', price: 0, breed: 'siamese', lock: 9 },
  { id: 'cat-tuxedo', cat: 'cats', name: 'Tuxedo cat', price: 0, breed: 'tuxedo', lock: 10 },
];
// Phương án thay thế cho từng món đồ: một đồ vật KHÁC đặt đúng chỗ của món gốc (slot), cùng giá, cùng mốc mở khoá. Một chỗ có thể có nhiều phương án (phòng khách / phòng ngủ: 3 lựa chọn mỗi chỗ).
// Model riêng (BUILD[id] trong deco-room.mjs / garden-scene.mjs) nhưng giữ khuôn khổ + điểm neo cho mèo của món gốc,
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
  // lựa chọn thứ 4: phong cách hiện đại, tông đen / xám (phòng khách)
  ['rug', 'rug-modern', 'Graphite rug', '#3a3d43'],
  ['armchair', 'armchair-lounge', 'Lounge chair', '#26282c'],
  ['plant', 'plant-snake', 'Snake plant', '#2f3236'],
  ['yarn', 'yarn-bin', 'Felt toy bin', '#4a4e55'],
  ['catbed', 'catbed-pod', 'Cat pod', '#3a3d43'],
  ['table', 'table-marble', 'Black marble table', '#2b2d31'],
  ['lamp', 'lamp-arc', 'Arc lamp', '#1f2125'],
  ['cattree', 'cattree-modern', 'Modern cat tower', '#6b7078'],
  ['shelf', 'shelf-metal', 'Steel shelf', '#1f2125'],
  ['tank', 'tank-aquarium', 'Black aquarium', '#26282c'],
  // lựa chọn thứ 4: phong cách hiện đại, tông đen / xám (phòng ngủ)
  ['bed', 'bed-platform', 'Platform bed', '#3a3d43'],
  ['bedrug', 'bedrug-mono', 'Mono stripe rug', '#2b2e33'],
  ['laundry', 'laundry-hamper', 'Felt hamper', '#4a4e55'],
  ['bedside', 'bedside-noir', 'Noir nightstand', '#26282c'],
  ['desk', 'desk-setup', 'Dark setup desk', '#1a1c20'],
  ['chair', 'chair-office', 'Mesh office chair', '#1f2125'],
  ['closet', 'closet-noir', 'Noir wardrobe', '#26282c'],
  ['plushie', 'plushie-shark', 'Shark plush', '#6b7078'],
  ['catsteps', 'catsteps-floating', 'Steel wall shelves', '#1f2125'],
  // --- Bếp: 4 lựa chọn mỗi chỗ (món gốc + 2 phương án + 1 phong cách châu Á) ---
  ['sink', 'sink-farm', 'Farmhouse sink', '#d9a36a'],
  ['dining', 'dining-square', 'Pine table', '#e9c58f'],
  ['fridge', 'fridge-retro', 'Retro fridge', '#ffc9d5'],
  ['stove', 'stove-wood', 'Wood stove', '#2f3238'],
  ['pantry', 'pantry-rack', 'Pantry rack', '#d9a36a'],
  ['kchair', 'kchair-stool', 'Bar stools', '#e8617f'],
  ['catfood', 'catfood-feeder', 'Auto feeder', '#f5f8fb'],
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
  ['sink', 'sink-asian', 'Asian counter', '#5a3a28'],
  ['dining', 'dining-asian', 'Chabudai table', '#b83a2e'],
  ['fridge', 'fridge-asian', 'Lacquer fridge', '#b83a2e'],
  ['stove', 'stove-asian', 'Wok range', '#26282c'],
  ['pantry', 'pantry-asian', 'Tansu chest', '#6b4630'],
  ['kchair', 'kchair-asian', 'Zaisu floor chairs', '#b83a2e'],
  ['catfood', 'catfood-asian', 'Porcelain bowls', '#3b4a7a'],
  ['cart', 'cart-asian', 'Dim sum cart', '#b83a2e'],
  ['kplant', 'kplant-asian', 'Bamboo pot', '#7fb23a'],
  // --- Vườn mở rộng ---
  ['windmill', 'windmill-turbine', 'Wind turbine', '#f5f8fb'],
  ['sunflowers', 'sunflowers-scarecrow', 'Scarecrow', '#e9c25a'],
  ['clothesline', 'clothesline-flags', 'Flag line', '#ffd66b'],
  ['campfire', 'campfire-tent', 'Camping tent', '#ff9f43'],
  ['kite', 'kite-balloons', 'Balloons', '#9fd0f0'],
  ['stream', 'stream-bridge', 'Stream bridge', '#c9955e'],
  ['swingtree', 'swingtree-treehouse', 'Treehouse', '#c98a55'],
  ['slide', 'slide-seesaw', 'Seesaw', '#7fc45a'],
];
// Chèn mỗi phương án sau món gốc + các phương án cùng chỗ đã chèn (giữ thứ tự khai báo); giá / khoá / khu lấy từ món gốc nên luôn đồng giá.
VARIANTS.forEach(([slot, id, name, color]) => {
  const at = CATALOG.findLastIndex(entry => entry.id === slot || entry.slot === slot), base = CATALOG.find(entry => entry.id === slot);
  CATALOG.splice(at + 1, 0, { id, zone: base.zone, ...(base.area && { area: base.area }), cat: base.cat, name, price: base.price, color, ...(base.lock && { lock: base.lock }), slot });
});
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
  return { coins: startCoins, cats: [...STARTER_CATS], claimedCats: [...STARTER_CATS], zone: 'garden', expansionSeeded: true, zones: Object.fromEntries(ZONE_IDS.map(zone => [zone, zoneDefaults(zone)])) };
}

// Bỏ các id không còn trong danh mục (đồ đã đổi tên / bỏ khỏi game) khỏi save.
function clean(deco) {
  const known = id => !!itemById(id);
  const zones = Object.fromEntries(Object.entries(deco.zones).filter(([zone]) => ZONES[zone]).map(([zone, state]) => [zone, { ...state, owned: state.owned.filter(known), placed: state.placed.filter(known) }]));
  return { ...deco, zones };
}

// Lần đầu có Deco: số xu = tổng thưởng các màn đã qua (progression.earnedCoins).
// Save cũ (trước khi có vườn, đồ mua cho phòng khách): phòng khách giờ khoá tới màn 10, nên hoàn lại xu
// của đồ đã mua để người chơi sắm cho vườn; phòng khách về mặc định.
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
        const free = CATALOG.filter(e => e.area === 'garden2' && e.price === 0 && !e.slot).map(e => e.id);
        const taken = new Set(zones.garden.placed.map(id => slotOf(itemById(id) || { id })));
        zones.garden = { ...zones.garden, placed: [...zones.garden.placed, ...free.filter(id => !taken.has(id))] };
      }
      // Save có từ trước khi nhận mèo ở Map: mèo đang ở trong nhà coi như đã nhận.
      const claimedCats = saved.claimedCats ?? [...new Set([...STARTER_CATS, ...(saved.cats || [])])];
      return clean({ ...base, ...saved, zones, claimedCats, expansionSeeded: true });
    }
    if (saved && Array.isArray(saved.owned)) {
      const base = defaults(startCoins);
      const refund = saved.owned.reduce((sum, id) => sum + (itemById(id)?.zone === 'living' ? itemById(id).price : 0), 0);
      const cats = saved.cats || base.cats;
      return { ...base, coins: (saved.coins ?? 0) + refund, cats, claimedCats: [...new Set([...STARTER_CATS, ...cats])] };
    }
  }
  return defaults(startCoins);
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
  if (status === 'buy') next = withZone({ ...deco, coins: deco.coins - entry.price }, entry.zone, { owned: [...zone.owned, entry.id] });
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
  return { ...withZone({ ...deco, coins: deco.coins - entry.price }, entry.zone, { owned: [...zone.owned, entry.id] }), fresh: [...(deco.fresh || []), entry.id] };
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
