// LiveOps Phase 1 (thuần logic, không đụng giao diện): gems, mạng, continue, điểm danh 7 ngày, nhiệm vụ ngày, chuỗi thắng.
// Thiết kế: tai-lieu/6-Thiet-ke-LiveOps.html. Hằng số: tuning.mjs (LIVEOPS).
//
// Chưa có server: giờ lấy từ máy (`now` truyền vào mọi hàm để test được). Chống chỉnh lùi giờ: giữ mốc giờ lớn nhất từng thấy
// (`maxSeen`); giờ máy lùi quá CLOCK_TOLERANCE_MS thì khoá nhận quà cho tới khi giờ vượt lại mốc.
// Phần thưởng trả về dạng { coins, gems, boosters: { id: n }, unlimitedMin }: gems + mạng vô hạn ghi vào state ở đây,
// xu và booster thuộc ví / kho riêng (deco-data.mjs, boosters.mjs) nên phía app cộng.
import { LIVEOPS } from './tuning.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

const L = LIVEOPS;
const BOOSTER_IDS = ['hammer', 'swap', 'moves'];

// ---------- Ngày ----------
// Khoá ngày theo giờ địa phương của máy ('2026-10-08'): ngày mới bắt đầu lúc 00:00 giờ người chơi.
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Mili giây tới 00:00 ngày mai (đồng hồ đếm ngược nhiệm vụ ngày).
export function msToNextDay(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - ms;
}
// Số ngẫu nhiên cố định theo chuỗi (cùng ngày = cùng bộ nhiệm vụ, tải lại không đổi).
export function seeded(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// ---------- Lưu trữ ----------
export function newLiveOps(now) {
  return {
    gems: L.START_GEMS,
    lives: L.LIVES_MAX, regenFrom: null, unlimitedUntil: 0, livesIntro: false,
    maxSeen: now,
    login: { claimed: 0, lastDay: null },
    quests: null,
    streak: 0,
    ads: { day: null, lives: 0 },
  };
}
export function loadLiveOps(now) {
  const saved = readJSON(SAVE_KEYS.liveops);
  if (!saved || typeof saved !== 'object') return newLiveOps(now);
  const base = newLiveOps(now);
  return { ...base, ...saved, login: { ...base.login, ...saved.login }, ads: { ...base.ads, ...saved.ads } };
}
export function saveLiveOps(state) { writeJSON(SAVE_KEYS.liveops, state); }

// Ghi nhận giờ hiện tại. `tampered` = giờ máy đang lùi so với mốc lớn nhất từng thấy (khoá nhận quà).
export function syncClock(state, now) {
  if (now + L.CLOCK_TOLERANCE_MS < state.maxSeen) return { state, tampered: true };
  return { state: { ...state, maxSeen: Math.max(state.maxSeen, now) }, tampered: false };
}
const tampered = (state, now) => now + L.CLOCK_TOLERANCE_MS < state.maxSeen;
export const clockTampered = tampered;

// ---------- Gems ----------
export function spendGems(state, amount) {
  return state.gems >= amount ? { ...state, gems: state.gems - amount } : null;
}
// Gói gems (IAP giả lập ở Phase 1: chưa có thanh toán thật).
export function buyGemPack(state, packId) {
  const pack = L.GEM_PACKS.find(p => p.id === packId);
  return pack ? { ...state, gems: state.gems + pack.gems } : state;
}

// ---------- Mạng ----------
export const livesActive = levelIndex => levelIndex + 1 >= L.LIVES_FROM_LEVEL;
export const hasUnlimited = (state, now) => state.unlimitedUntil > now;
// Cập nhật số mạng theo thời gian đã trôi (hồi 1 mạng mỗi LIFE_REGEN_MS). Đầy thì ngừng đếm.
export function regenLives(state, now) {
  if (state.lives >= L.LIVES_MAX || state.regenFrom == null) return { ...state, lives: Math.min(state.lives, L.LIVES_MAX), regenFrom: null };
  const gained = Math.max(0, Math.floor((now - state.regenFrom) / L.LIFE_REGEN_MS));
  const lives = Math.min(L.LIVES_MAX, state.lives + gained);
  return { ...state, lives, regenFrom: lives >= L.LIVES_MAX ? null : state.regenFrom + gained * L.LIFE_REGEN_MS };
}
// Trạng thái để vẽ: số mạng, ms tới mạng kế (0 = đầy), mạng vô hạn còn bao lâu.
export function livesInfo(state, now) {
  const s = regenLives(state, now);
  const unlimitedMs = Math.max(0, s.unlimitedUntil - now);
  const nextMs = s.regenFrom == null ? 0 : Math.max(0, s.regenFrom + L.LIFE_REGEN_MS - now);
  return { lives: s.lives, max: L.LIVES_MAX, nextMs, unlimitedMs, canPlay: unlimitedMs > 0 || s.lives > 0 };
}
// Vào màn: có được chơi không (màn chưa tới mốc mạng thì luôn được).
export const canStartLevel = (state, levelIndex, now) => !livesActive(levelIndex) || livesInfo(state, now).canPlay;
// Thua / bỏ ngang: mất một mạng (mạng vô hạn hoặc màn chưa tới mốc thì không mất).
export function loseLife(state, levelIndex, now) {
  if (!livesActive(levelIndex) || hasUnlimited(state, now)) return state;
  const s = regenLives(state, now);
  if (s.lives <= 0) return s;
  return { ...s, lives: s.lives - 1, regenFrom: s.regenFrom ?? now };
}
export function addLives(state, count, now) {
  const s = regenLives(state, now);
  const lives = Math.min(L.LIVES_MAX, s.lives + count);
  return { ...s, lives, regenFrom: lives >= L.LIVES_MAX ? null : s.regenFrom };
}
export function refillLives(state, now) {
  const paid = spendGems(state, L.REFILL_GEMS);
  return paid ? { ...paid, lives: L.LIVES_MAX, regenFrom: null } : null;
}
export function grantUnlimited(state, minutes, now) {
  return { ...state, unlimitedUntil: Math.max(state.unlimitedUntil, now) + minutes * 60 * 1000 };
}
// Lần đầu tới mốc mạng: tặng mạng vô hạn để màn đầu có mạng không thấy hụt ngay.
export function introLives(state, levelIndex, now) {
  if (state.livesIntro || !livesActive(levelIndex)) return { state, granted: false };
  return { state: { ...grantUnlimited(state, L.LIVES_INTRO_UNLIMITED_MIN, now), livesIntro: true }, granted: true };
}
// Rewarded ad +1 mạng: tối đa AD_LIVES_PER_DAY lần mỗi ngày.
export function adLivesLeft(state, now) {
  return L.AD_LIVES_PER_DAY - (state.ads.day === dayKey(now) ? state.ads.lives : 0);
}
export function adLife(state, now) {
  if (adLivesLeft(state, now) <= 0) return null;
  const today = dayKey(now);
  const used = state.ads.day === today ? state.ads.lives : 0;
  return { ...addLives(state, 1, now), ads: { ...state.ads, day: today, lives: used + 1 } };
}

// ---------- Continue sau khi thua ----------
export const continueUnlocked = levelIndex => levelIndex + 1 >= L.CONTINUE_FROM_LEVEL;
// `used` = số lần continue bằng gems đã dùng trong lượt chơi này.
export const continuePrice = used => L.CONTINUE_GEMS[Math.min(used, L.CONTINUE_GEMS.length - 1)];

// ---------- Phần thưởng ----------
// Ghi phần gems + mạng vô hạn của một phần thưởng vào state (xu, booster: phía app cộng).
export function applyReward(state, reward, now) {
  let next = state;
  if (reward.gems) next = { ...next, gems: next.gems + reward.gems };
  if (reward.unlimitedMin) next = grantUnlimited(next, reward.unlimitedMin, now);
  return next;
}

// ---------- Điểm danh 7 ngày ----------
export const dailyUnlocked = cleared => cleared >= L.DAILY_FROM_CLEARED;
// step = ô đang tới lượt (0..6); bỏ lỡ ngày thì giữ nguyên ô, không reset.
export function loginStatus(state, now) {
  const step = state.login.claimed % L.LOGIN_REWARDS.length;
  const claimedToday = state.login.lastDay === dayKey(now);
  return { step, claimedToday, canClaim: !claimedToday && !tampered(state, now), rewards: L.LOGIN_REWARDS };
}
export function claimLogin(state, now) {
  const status = loginStatus(state, now);
  if (!status.canClaim) return null;
  const reward = L.LOGIN_REWARDS[status.step];
  const next = { ...applyReward(state, reward, now), login: { claimed: state.login.claimed + 1, lastDay: dayKey(now) } };
  return { state: next, reward, step: status.step };
}

// ---------- Nhiệm vụ ngày ----------
// event: tên sự kiện app báo qua trackQuest. from = số màn cần qua để nhiệm vụ có nghĩa (cơ chế đã mở).
export const QUEST_POOL = {
  easy: [
    { id: 'win2', event: 'win', need: 2, text: 'Win 2 levels' },
    { id: 'cats30', event: 'cats', need: 30, text: 'Match 30 cats' },
    { id: 'pet3', event: 'pet', need: 3, text: 'Pet your cats 3 times' },
  ],
  medium: [
    { id: 'big5', event: 'big4', need: 5, text: 'Match 5 groups of 4+ cats' },
    { id: 'crates8', event: 'crates', need: 8, text: 'Break 8 crates', from: 5 },
    { id: 'boost2', event: 'booster', need: 2, text: 'Use 2 boosters', from: 3 },
    { id: 'win3', event: 'win', need: 3, text: 'Win 3 levels' },
  ],
  hard: [
    { id: 'star3', event: 'threeStar', need: 1, text: 'Win a level with 3 stars' },
    { id: 'mega1', event: 'big6', need: 1, text: 'Match a group of 6+ cats' },
    { id: 'win5', event: 'win', need: 5, text: 'Win 5 levels' },
  ],
};
const questById = id => Object.values(QUEST_POOL).flat().find(q => q.id === id);
export const questDef = questById;

// Bốc bộ nhiệm vụ của ngày nếu chưa có (một nhiệm vụ mỗi độ khó, lọc theo cơ chế đã mở).
export function ensureQuests(state, now, cleared) {
  const day = dayKey(now);
  if (state.quests?.day === day) return state;
  const rng = seeded(`quests:${day}`);
  const list = Object.entries(L.QUEST_SLOTS).map(([tier, points]) => {
    const pool = QUEST_POOL[tier].filter(q => (q.from ?? 0) <= cleared);
    const quest = pool[Math.floor(rng() * pool.length)];
    return { id: quest.id, tier, points, have: 0, need: quest.need };
  });
  return { ...state, quests: { day, list, chest: false } };
}
export const questPoints = state => (state.quests?.list ?? []).reduce((sum, q) => sum + (q.have >= q.need ? q.points : 0), 0);
export const questGoal = () => Object.values(L.QUEST_SLOTS).reduce((a, b) => a + b, 0);
// Báo một sự kiện (thắng màn, gom mèo...). Trả về { state, completed: [nhiệm vụ vừa xong] }.
export function trackQuest(state, now, event, amount = 1) {
  if (!state.quests || state.quests.day !== dayKey(now) || amount <= 0) return { state, completed: [] };
  const completed = [];
  const list = state.quests.list.map(q => {
    if (questById(q.id).event !== event || q.have >= q.need) return q;
    const have = Math.min(q.need, q.have + amount);
    if (have >= q.need) completed.push(q);
    return { ...q, have };
  });
  return { state: { ...state, quests: { ...state.quests, list } }, completed };
}
export const chestReady = state => !!state.quests && !state.quests.chest && questPoints(state) >= questGoal();
// Mở rương ngày; `double` = đã xem rewarded ad nhân đôi.
export function claimChest(state, now, { double = false, rng = Math.random } = {}) {
  if (!chestReady(state) || tampered(state, now)) return null;
  const times = double ? 2 : 1;
  const boosters = {};
  for (let i = 0; i < L.CHEST.randomBooster * times; i++) {
    const id = BOOSTER_IDS[Math.floor(rng() * BOOSTER_IDS.length)];
    boosters[id] = (boosters[id] ?? 0) + 1;
  }
  const reward = { coins: L.CHEST.coins * times, boosters };
  return { state: { ...state, quests: { ...state.quests, chest: true } }, reward };
}

// ---------- Chuỗi thắng ----------
export const streakActive = levelIndex => levelIndex + 1 >= L.STREAK_FROM_LEVEL;
// Quà đầu màn theo chuỗi thắng hiện tại (null = chưa đủ bậc 1).
export function streakBonus(streak) {
  let tier = null;
  L.STREAK_TIERS.forEach((t, index) => { if (streak >= t.wins) tier = { ...t, tier: index + 1 }; });
  return tier;
}
// Kết thúc màn: thắng +1 chuỗi, thua / bỏ ngang về 0 (màn chưa tới mốc thì không đụng chuỗi).
export function recordStreak(state, levelIndex, win) {
  if (!streakActive(levelIndex)) return state;
  return { ...state, streak: win ? state.streak + 1 : 0 };
}
