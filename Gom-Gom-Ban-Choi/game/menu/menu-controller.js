// ===== Luồng điều khiển MENU (giao diện ngoài màn chơi): mặt tiền =====
// start.js nối hai luồng: màn chơi gọi các hàm export dưới đây (showTab, hideMenus, menuOpen, runOnboarding, sceneReady);
// phần việc thật nằm ở các module cùng thư mục menu/ (map-view, tabs, room, deco-panel, idle-coins, tours, shop, areas,
// settings, dev-tools). Sang Unity: MenuController (MonoBehaviour) giữ tham chiếu tới các screen trên.
import { startTabs } from './tabs.js';
import { startRoom, roomReady } from './room.js';
import { startSettings } from './settings.js';
import { startDevTools } from './dev-tools.js';
import { map3dReady } from './map-view.js';
import { startIdleDot } from './idle-coins.js';

// API cho màn chơi (play/play-controller.js gọi qua `menus`) và start.js.
export { connectPlay } from './context.js';
export { showTab, hideMenus, menuOpen } from './tabs.js';
export { runOnboarding } from './tours.js';

// Khởi động theo đúng thứ tự cũ (khi còn một file). Chạy ở đây, sau khi mọi module menu đã nạp xong: các module import vòng
// tròn nhau nên lệnh chạy ngay lúc nạp có thể chạm biến của module chưa nạp. Sang Unity: Start() của từng component.
startTabs();
startRoom();
startSettings();
startDevTools();
startIdleDot();

// Phòng 3D + bản đồ 3D đã dựng xong (start.js chờ cái này để tắt màn loading).
export const sceneReady = Promise.all([roomReady, map3dReady]);
