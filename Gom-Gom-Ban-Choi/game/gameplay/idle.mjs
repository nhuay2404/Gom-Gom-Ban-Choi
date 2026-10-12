// Xu tự sinh (idle) — thuần logic, không đụng DOM. Số chỉnh ở economy.mjs (IDLE_RATE, IDLE_CAP_HOURS, IDLE_FROM_LEVEL).
// Trạng thái lưu trong ví Deco: deco.idleAt = mốc thời gian (ms) bắt đầu tích lần này (lần nhận gần nhất / lúc mở tính năng).
//   - Chưa thắng tới IDLE_FROM_LEVEL màn: không tích.
//   - Tới mốc lần đầu: bắt đầu tích từ lúc đó (không trả bù thời gian trước).
//   - Giờ máy lùi lại (chỉnh giờ): bắt đầu tích lại từ bây giờ, không cộng gì.
// cfg: mặc định là số trong game; tab Kinh tế của Level Editor truyền bộ số đang sửa (cùng công thức).
import { IDLE_RATE, IDLE_CAP_HOURS, IDLE_FROM_LEVEL } from './economy.mjs';
import { rewardFor } from './progression.mjs';
import { ECONOMY } from './tuning.mjs';

const HOUR = 3600 * 1000;
const GAME = { IDLE_RATE, IDLE_CAP_HOURS, IDLE_FROM_LEVEL, ...ECONOMY };

export const idleOpen = (cleared, cfg = GAME) => cleared >= cfg.IDLE_FROM_LEVEL;
// Xu mỗi giờ: theo xu thưởng của màn đang chơi (màn thứ cleared + 1), nên idle tăng cùng nhịp với công thức xu thưởng.
export const idlePerHour = (cleared, cfg = GAME) => (idleOpen(cleared, cfg) ? rewardFor(cleared, cfg) * cfg.IDLE_RATE : 0);
export const idleCap = (cleared, cfg = GAME) => Math.floor(idlePerHour(cleared, cfg) * cfg.IDLE_CAP_HOURS);

// Số xu đang chờ nhận (đã chặn ở trần).
export function idlePending(deco, cleared, now, cfg = GAME) {
  if (!idleOpen(cleared, cfg) || deco.idleAt == null || now <= deco.idleAt) return 0;
  const hours = Math.min(cfg.IDLE_CAP_HOURS, (now - deco.idleAt) / HOUR);
  return Math.floor(hours * idlePerHour(cleared, cfg));
}
export const idleFull = (deco, cleared, now, cfg = GAME) => idleOpen(cleared, cfg) && idlePending(deco, cleared, now, cfg) >= idleCap(cleared, cfg);

// Gọi khi mở game / vào Deco: bắt đầu tích lần đầu, hoặc đặt lại khi giờ máy lùi. Không đổi gì thì trả lại đúng deco cũ.
export function tickIdle(deco, cleared, now) {
  if (!idleOpen(cleared)) return deco;
  if (deco.idleAt == null || now < deco.idleAt) return { ...deco, idleAt: now };
  return deco;
}

// Nhận xu: cộng vào ví, tích lại từ bây giờ. Trả về { deco, amount }.
export function claimIdle(deco, cleared, now) {
  const amount = idlePending(deco, cleared, now);
  if (!amount) return { deco, amount: 0 };
  return { deco: { ...deco, coins: deco.coins + amount, idleAt: now }, amount };
}
