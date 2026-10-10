// Điểm vào của game: tải config từ Firebase Remote Config trước (app/remote-config.js), rồi mới nạp game (start.js).
// Phải nạp game SAU bước này: economy.mjs / tuning.mjs đọc config từ xa ngay lúc module được nạp.
import { loadRemoteConfig } from './remote-config.js';

const config = await loadRemoteConfig();
console.info('[remote-config]', config.source === 'firebase' ? `Firebase (${config.count} tham số)` : config.source === 'cache' ? 'bản lưu lần trước' : 'mặc định trong code');
await import('./start.js');

// UI Studio (?studio): bảng chỉnh giao diện trực tiếp + tự cập nhật khi file đổi. Xem tools/ui-studio.mjs.
// Đường dẫn để trong biến để build:html (esbuild) không gói studio vào bản build: studio cần máy chủ dev.
const studio = './ui-studio.js';
if (new URLSearchParams(location.search).has('studio')) import(studio);
