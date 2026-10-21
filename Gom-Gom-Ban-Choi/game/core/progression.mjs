// Tiến độ người chơi (thuần logic): sao từng màn, mở khoá màn, xu thưởng khi thắng, cấp độ khó của màn.
import { LEVELS } from '../data/levels.mjs';
import { ECONOMY } from '../data/tuning.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

export function loadProgress() {
  const saved = readJSON(SAVE_KEYS.progress);
  return saved && Array.isArray(saved.stars) ? saved : { stars: [] };
}
export function saveProgress(progress) { writeJSON(SAVE_KEYS.progress, progress); }

// Màn mở tới: số màn đã qua + 1 (tối đa số màn có).
export const unlockedCount = progress => Math.min(LEVELS.length, progress.stars.filter(Boolean).length + 1);
export const levelsCleared = progress => progress.stars.filter(Boolean).length;

// Xu thưởng của một màn (lần thắng đầu), tăng dần theo màn — công thức + hệ số ở economy.mjs.
// rewardFor nhận hệ số rời để Level Editor (tab Economy) thử số khác mà vẫn dùng đúng công thức game.
// Lệch cố định theo màn (băm số màn, −0.5..0.5, trung bình ~0): cùng màn luôn cùng số, nhưng không đoán được từ màn trước.
const wobble = levelIndex => { const x = Math.sin((levelIndex + 1) * 12.9898) * 43758.5453; return x - Math.floor(x) - .5; };
// Tăng theo cụm 10 màn: trong cụm thứ c (màn 10c−9 … 10c) mỗi màn cộng cùng một bước d(c) = REWARD_STEP × (1 + REWARD_GROWTH)^(c − 1);
// sang cụm mới bước tăng theo tỉ lệ (đường cong thoải, không vọt như cấp số nhân theo từng màn). Tổng các bước tới màn L (dạng đóng, nhanh cả
// khi xem 300k màn): 10 × (g^(C−1) − 1) / (g − 1) − 1 + (L − 10(C − 1)) × g^(C−1) bước gốc, C = ⌈L / 10⌉, g = 1 + REWARD_GROWTH.
// Lệch mỗi màn = REWARD_JITTER × lệch(n) × d(c): REWARD_JITTER < 1 thì vẫn luôn tăng.
export const rewardFor = (levelIndex, { REWARD_BASE, REWARD_STEP = 0, REWARD_GROWTH = 0, REWARD_JITTER = 0 }) => {
  const L = levelIndex + 1, C = Math.ceil(L / 10), gc = (1 + REWARD_GROWTH) ** (C - 1);
  const steps = 10 * (REWARD_GROWTH ? (gc - 1) / REWARD_GROWTH : C - 1) - 1 + (L - 10 * (C - 1)) * gc;
  return Math.round(REWARD_BASE + REWARD_STEP * steps + REWARD_STEP * gc * REWARD_JITTER * wobble(levelIndex));
};
export const levelReward = levelIndex => rewardFor(levelIndex, ECONOMY);
// Tổng xu đã kiếm được từ các màn đã qua (khởi tạo ví cho save chưa có Deco).
export const earnedCoins = progress => progress.stars.reduce((sum, n, index) => sum + (n ? levelReward(index) : 0), 0);

// Ghi nhận một lần thắng: giữ số sao tốt nhất; xu chỉ ra ở lần thắng ĐẦU của màn (số sao không đổi số xu).
export function recordWin(progress, levelIndex, stars) {
  const before = progress.stars[levelIndex] || 0;
  const next = { ...progress, stars: progress.stars.slice() };
  next.stars[levelIndex] = Math.max(before, stars);
  return { progress: next, before, coins: before === 0 && stars > 0 ? levelReward(levelIndex) : 0 };
}

// Cấp độ khó (levels.mjs: tier) và vật cản có trên bàn — bảng vào màn và bản đồ dựa vào đây.
export const levelTier = level => level.tier || 'normal';
const MECHANIC_TEST = { crate: cells => cells.includes('X'), metal: cells => cells.includes('M'), cage: cells => /[a-z]/.test(cells), fat: cells => /[1-9]/.test(cells), mail: cells => cells.includes('@'), vase: cells => cells.includes('%') };
export const levelMechanics = level => [...Object.keys(MECHANIC_TEST).filter(kind => MECHANIC_TEST[kind](level.board.join(''))), ...(level.grass?.join('').includes('~') ? ['grass'] : []), ...(level.syrup?.join('').includes('~') ? ['syrup'] : [])];
