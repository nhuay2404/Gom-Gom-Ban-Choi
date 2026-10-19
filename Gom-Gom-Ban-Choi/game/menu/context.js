// Trạng thái dùng chung của các màn hình menu: cầu nối sang màn chơi (`play`, nối ở start.js), số màn đã qua.
// Sang Unity: MenuContext (service / singleton nhẹ).
import { loadProgress, levelsCleared as clearedCount } from '../core/progression.mjs';

// Luồng màn chơi (startLevel, mapTier): main.js nối vào lúc khởi động.
export let play = null;

export function connectPlay(playController) { play = playController; }

// ===== Khu: vườn (màn 1–10; mở rộng khi thắng màn 10) / phòng khách (thắng màn 20) / phòng ngủ (30) / bếp (40). Mỗi khu lưu đồ riêng, mèo dùng chung. =====
export const levelsCleared = () => clearedCount(loadProgress());
