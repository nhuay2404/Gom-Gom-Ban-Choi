// Xu tự sinh (idle) — thuần logic, không đụng DOM. Số chỉnh ở economy.mjs (IDLE_RATE, IDLE_CAP_HOURS, IDLE_FROM_LEVEL).
// MỖI con mèo trong nhà tự tích xu riêng (bong bóng xu trên đầu từng con): nhiều mèo = nhiều xu. IDLE_RATE là tỉ lệ của MỘT con.
// Trạng thái lưu trong ví Deco: deco.idleAt = { [giống mèo]: mốc thời gian (ms) bắt đầu tích lần này (lần nhận gần nhất / lúc vào nhà) }.
//   - Chưa thắng tới IDLE_FROM_LEVEL màn: không tích.
//   - Tới mốc lần đầu / mèo mới vào nhà: bắt đầu tích từ lúc đó (không trả bù thời gian trước).
//   - Giờ máy lùi lại (chỉnh giờ): bắt đầu tích lại từ bây giờ, không cộng gì.
//   - Save cũ (idleAt là một số, chung cả nhà): mọi con trong nhà tích tiếp từ mốc đó.
// cfg: mặc định là số trong game; tab Kinh tế của Level Editor truyền bộ số đang sửa (cùng công thức).
import { IDLE_RATE, IDLE_CAP_HOURS, IDLE_FROM_LEVEL, IDLE_MIN_MINUTES } from '../data/economy.mjs';
import { rewardFor } from './progression.mjs';
import { ECONOMY } from '../data/tuning.mjs';

const HOUR = 3600 * 1000;
const GAME = { IDLE_RATE, IDLE_CAP_HOURS, IDLE_FROM_LEVEL, IDLE_MIN_MINUTES, ...ECONOMY };

export const idleOpen = (cleared, cfg = GAME) => cleared >= cfg.IDLE_FROM_LEVEL;
// Xu mỗi giờ của MỘT con mèo: theo xu thưởng của màn đang chơi (màn thứ cleared + 1), nên idle tăng cùng nhịp với công thức xu thưởng.
export const idlePerHour = (cleared, cfg = GAME) => (idleOpen(cleared, cfg) ? rewardFor(cleared, cfg) * cfg.IDLE_RATE : 0);
export const idleCap = (cleared, cfg = GAME) => Math.floor(idlePerHour(cleared, cfg) * cfg.IDLE_CAP_HOURS);

const startOf = (deco, breed) => (typeof deco.idleAt === 'number' ? deco.idleAt : deco.idleAt?.[breed]);

// Số xu con `breed` đang chờ nhận (đã chặn ở trần). Chưa tích đủ IDLE_MIN_MINUTES phút thì 0 (chưa nhận được, bong bóng ẩn).
export function idlePending(deco, cleared, now, breed, cfg = GAME) {
  const from = startOf(deco, breed);
  if (!idleOpen(cleared, cfg) || from == null || now - from < (cfg.IDLE_MIN_MINUTES ?? 0) * 60000 || now <= from) return 0;
  const hours = Math.min(cfg.IDLE_CAP_HOURS, (now - from) / HOUR);
  return Math.floor(hours * idlePerHour(cleared, cfg));
}
export const idleFull = (deco, cleared, now, breed, cfg = GAME) => idleOpen(cleared, cfg) && idlePending(deco, cleared, now, breed, cfg) >= idleCap(cleared, cfg);

// Gọi khi mở game / vào Deco: mỗi con trong nhà (deco.cats) chưa tích thì bắt đầu tích, giờ máy lùi thì đặt lại; save cũ đổi sang mốc riêng từng con.
// Không đổi gì thì trả lại đúng deco cũ.
export function tickIdle(deco, cleared, now) {
  if (!idleOpen(cleared)) return deco;
  let changed = typeof deco.idleAt !== 'object' || deco.idleAt === null;
  const idleAt = {};
  for (const breed of deco.cats ?? []) {
    const from = startOf(deco, breed);
    idleAt[breed] = from == null || now < from ? now : from;
    if (idleAt[breed] !== from) changed = true;
  }
  // Giữ mốc của mèo đang ở ngoài nhà (vào lại nhà thì tích tiếp, vẫn chặn ở trần).
  if (!changed) return deco;
  return { ...deco, idleAt: { ...(typeof deco.idleAt === 'object' ? deco.idleAt : {}), ...idleAt } };
}

// Nhận xu của một con: cộng vào ví, con đó tích lại từ bây giờ. Trả về { deco, amount }.
export function claimIdle(deco, cleared, now, breed) {
  const amount = idlePending(deco, cleared, now, breed);
  if (!amount) return { deco, amount: 0 };
  const base = typeof deco.idleAt === 'object' && deco.idleAt ? deco.idleAt : Object.fromEntries((deco.cats ?? []).map(b => [b, deco.idleAt]));
  return { deco: { ...deco, coins: deco.coins + amount, idleAt: { ...base, [breed]: now } }, amount };
}
