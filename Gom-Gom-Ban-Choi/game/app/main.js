// Điểm vào của game: tải config từ Firebase Remote Config trước (app/remote-config.js), rồi mới nạp game (start.js).
// Phải nạp game SAU bước này: economy.mjs / tuning.mjs đọc config từ xa ngay lúc module được nạp.
import { loadRemoteConfig } from './remote-config.js';

const config = await loadRemoteConfig();
console.info('[remote-config]', config.source === 'firebase' ? `Firebase (${config.count} tham số)` : config.source === 'cache' ? 'bản lưu lần trước' : 'mặc định trong code');
await import('./start.js');
