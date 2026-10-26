// Quà đăng nhập 7 ngày (thuần logic, không đụng DOM): dạng lịch, không streak. Mỗi ngày (giờ máy, dayKey) nhận được một ô kế tiếp;
// nghỉ bao lâu cũng nhận tiếp ô kế, không reset, không ô nào hết hạn. Số liệu ở data/economy.mjs (LOGIN_CALENDAR, LOGIN_CATS).
// Trao quà (xu, booster, đồ, gem, mèo) ở menu/login.js.
import { LOGIN_CALENDAR } from '../data/economy.mjs';
import { dayKey } from './gems.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

export const loginDays = () => LOGIN_CALENDAR.length;
// Save thiếu / hỏng = chưa nhận ô nào (người chơi cũ cập nhật lên bản mới bắt đầu từ ô 1).
export function loadLogin() {
  const s = readJSON(SAVE_KEYS.login) || {};
  return { claimed: Number.isInteger(s.claimed) ? Math.max(0, Math.min(loginDays(), s.claimed)) : 0, lastDay: s.lastDay ?? null,
    lastAt: Number(s.lastAt) || 0, pendingCats: Array.isArray(s.pendingCats) ? s.pendingCats : [], seenDay: s.seenDay ?? null };
}
export function saveLogin(state) { writeJSON(SAVE_KEYS.login, state); }

export const loginDone = state => state.claimed >= loginDays();
// Nhận được khi còn ô, hôm nay chưa nhận, và đồng hồ không lùi về trước lần nhận cuối (chặn vặn đồng hồ qua lại để nhận lặp).
export const canClaimLogin = (state, now) => !loginDone(state) && state.lastDay !== dayKey(now) && now >= state.lastAt;

// Nhận ô kế tiếp: trả về { state, index } (index 0 = ô ngày 1) hoặc { error }.
export function claimLogin(state, now) {
  if (loginDone(state)) return { error: 'All gifts claimed' };
  if (!canClaimLogin(state, now)) return { error: 'Come back tomorrow for the next gift' };
  return { state: { ...state, claimed: state.claimed + 1, lastDay: dayKey(now), lastAt: now }, index: state.claimed };
}

// Xu của một ô: số cố định trong LOGIN_CALENDAR (không theo R).
export const loginCoins = cell => cell.coins ?? 0;
