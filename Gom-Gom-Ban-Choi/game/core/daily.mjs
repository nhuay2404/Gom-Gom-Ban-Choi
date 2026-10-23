// Nhiệm vụ ngày (thuần logic, không đụng DOM): DAILY.count nhiệm vụ nhẹ / ngày, mỗi nhiệm vụ thưởng xu, không có rương / booster.
// Số liệu + bảng nhiệm vụ ở data/economy.mjs (DAILY, DAILY_POOL).
//
// Save (SAVE_KEYS.daily): { day, R, missions: [{ id, event, n, text, reward, progress, claimed }] }
// Không có streak: nghỉ một ngày thì hôm sau là bộ nhiệm vụ mới.
import { DAILY, DAILY_POOL } from '../data/economy.mjs';
import { ECONOMY } from '../data/tuning.mjs';
import { rewardFor } from './progression.mjs';
import { dayKey } from './gems.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

// Sự kiện game đếm cho nhiệm vụ (event trong DAILY_POOL).
//   play: chơi xong 1 màn (thắng hay thua) · match: gom 1 cụm · score: điểm ghi được · cleanWin: thắng không dùng booster
//   pet: vuốt mèo ở Deco · idle: nhận xu idle · place: đặt / đổi 1 món · build: xây 1 chỗ (mua món gốc)
export const DAILY_EVENTS = ['play', 'match', 'score', 'cleanWin', 'pet', 'idle', 'place', 'build'];

export const loadDaily = () => readJSON(SAVE_KEYS.daily);
export function saveDaily(daily) { writeJSON(SAVE_KEYS.daily, daily); }

// `unlocked` = số màn đang mở (unlockedCount).
export const dailyOpen = unlocked => unlocked >= DAILY.fromLevel;
// R: xu thắng màn cao nhất đang mở, bỏ dao động, làm tròn chục.
export const dailyRate = unlocked => round10(rewardFor(unlocked - 1, { ...ECONOMY, REWARD_JITTER: 0 }));
const round10 = n => Math.round(n / 10) * 10;

// Xáo trộn (Fisher–Yates) bằng rand truyền vào để test lặp lại được.
const shuffle = (list, rand) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };

// Sang ngày mới thì ra bộ nhiệm vụ mới; cùng ngày trả lại nguyên save.
// ctx: { unlocked, boosters (đã mở booster), idle (đã mở xu idle), base (khu đang mở còn món gốc chưa mua) }.
export function rollDaily(saved, ctx, now, rand = Math.random) {
  const day = dayKey(now);
  if (saved?.day === day) return saved;
  const R = dailyRate(ctx.unlocked), yesterday = new Set((saved?.missions ?? []).map(m => m.id));
  const allowed = shuffle(DAILY_POOL.filter(m => !m.need || (m.need === 'noBase' ? !ctx.base : !!ctx[m.need])), rand);
  // Món hôm qua chưa có lên trước; thiếu thì mới lấy lại món hôm qua.
  const chosen = [...allowed.filter(m => !yesterday.has(m.id)), ...allowed.filter(m => yesterday.has(m.id))].slice(0, DAILY.count);
  const missions = chosen.map(m => ({ ...m, reward: round10(DAILY.share * R), progress: 0, claimed: false }));
  return { day, R, missions };
}

export const missionDone = m => m.progress >= m.n;
// Số nhiệm vụ đang chờ nhận (chấm đỏ trên nút Daily).
export const claimable = daily => daily.missions.filter(m => missionDone(m) && !m.claimed).length;

// Đếm một sự kiện; trả về save mới + các nhiệm vụ vừa xong (để báo).
export function noteDaily(daily, event, n = 1) {
  const done = [];
  const missions = daily.missions.map(m => {
    if (m.event !== event || missionDone(m)) return m;
    const next = { ...m, progress: Math.min(m.n, m.progress + n) };
    if (missionDone(next)) done.push(next);
    return next;
  });
  return { daily: done.length || missions.some((m, i) => m !== daily.missions[i]) ? { ...daily, missions } : daily, done };
}

export function claimMission(daily, index) {
  const m = daily.missions[index];
  if (!m || m.claimed) return { error: 'Already claimed' };
  if (!missionDone(m)) return { error: 'Not done yet' };
  return { daily: { ...daily, missions: daily.missions.map((x, i) => (i === index ? { ...x, claimed: true } : x)) }, coins: m.reward };
}

