// Tiến độ người chơi (thuần logic): sao từng màn, mở khoá màn, xu thưởng khi thắng, cấp độ khó của màn.
import { LEVELS } from './levels.mjs';
import { ECONOMY } from './tuning.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

export function loadProgress() {
  const saved = readJSON(SAVE_KEYS.progress);
  return saved && Array.isArray(saved.stars) ? saved : { stars: [] };
}
export function saveProgress(progress) { writeJSON(SAVE_KEYS.progress, progress); }

// Màn mở tới: số màn đã qua + 1 (tối đa số màn có).
export const unlockedCount = progress => Math.min(LEVELS.length, progress.stars.filter(Boolean).length + 1);
export const levelsCleared = progress => progress.stars.filter(Boolean).length;
export const totalStars = progress => progress.stars.reduce((sum, n) => sum + (n || 0), 0);

// Ghi nhận một lần thắng: giữ số sao tốt nhất; chỉ sao MỚI (vượt kỷ lục cũ của màn) mới ra xu.
export function recordWin(progress, levelIndex, stars) {
  const before = progress.stars[levelIndex] || 0;
  const next = { ...progress, stars: progress.stars.slice() };
  next.stars[levelIndex] = Math.max(before, stars);
  return { progress: next, before, coins: Math.max(0, stars - before) * ECONOMY.COINS_PER_STAR };
}

// Cấp độ khó (levels.mjs: tier) và vật cản có trên bàn — bảng vào màn và bản đồ dựa vào đây.
export const levelTier = level => level.tier || 'normal';
const MECHANIC_TEST = { crate: cells => cells.includes('X'), metal: cells => cells.includes('M'), cage: cells => /[a-z]/.test(cells) };
export const levelMechanics = level => Object.keys(MECHANIC_TEST).filter(kind => MECHANIC_TEST[kind](level.board.join('')));
