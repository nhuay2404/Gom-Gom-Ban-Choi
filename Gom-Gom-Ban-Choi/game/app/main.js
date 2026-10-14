// Điểm vào của game: tải config từ Firebase Remote Config trước (app/remote-config.js), rồi mới nạp game (start.js).
// Phải nạp game SAU bước này: economy.mjs / tuning.mjs đọc config từ xa ngay lúc module được nạp.
import { loadRemoteConfig } from './remote-config.js';

const config = await loadRemoteConfig();
console.info('[remote-config]', config.source === 'firebase' ? `Firebase (${config.count} tham số)` : config.source === 'cache' ? 'bản lưu lần trước' : 'mặc định trong code');
await import('./start.js');

// UI Studio: bảng chỉnh giao diện trực tiếp + tự cập nhật khi file đổi (xem tools/ui-studio.mjs). Nạp cùng thanh nút dev
// (localhost / ?dev), bật / tắt bằng nút "Studio" trên thanh đó; ?studio mở sẵn.
// Đường dẫn để trong biến để build:html (esbuild) không gói studio vào bản build: studio cần máy chủ dev (bản build không có thì thôi).
const studio = './ui-studio.js';
const { DEV_MODE } = await import('./shared.js');
if ((DEV_MODE || new URLSearchParams(location.search).has('studio')) && location.protocol !== 'file:') import(studio).catch(() => {});
