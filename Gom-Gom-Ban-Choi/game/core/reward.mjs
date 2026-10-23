// Công thức xu thưởng thắng màn (R), thuần toán, không import gì: progression.mjs dùng cho xu thưởng, deco-data.mjs dùng để tính giá khu.
// rewardFor nhận hệ số rời để Level Editor (tab Economy) thử số khác mà vẫn dùng đúng công thức game.
// Lệch cố định theo màn (băm số màn, −0.5..0.5, trung bình ~0): cùng màn luôn cùng số, nhưng không đoán được từ màn trước.
const wobble = levelIndex => { const x = Math.sin((levelIndex + 1) * 12.9898) * 43758.5453; return x - Math.floor(x) - .5; };
// Tăng theo cụm 10 màn: trong cụm thứ c (màn 10c−9 … 10c) mỗi màn cộng cùng một bước d(c) = REWARD_STEP × (1 + REWARD_GROWTH)^(c − 1);
// sang cụm mới bước tăng theo tỉ lệ (đường cong thoải, không vọt như cấp số nhân theo từng màn). Tổng các bước tới màn L (dạng đóng, nhanh cả
// khi xem 300k màn): 10 × (g^(C−1) − 1) / (g − 1) − 1 + (L − 10(C − 1)) × g^(C−1) bước gốc, C = ⌈L / 10⌉, g = 1 + REWARD_GROWTH.
// Lệch mỗi màn = REWARD_JITTER × lệch(n) × d(c): REWARD_JITTER < 1 thì vẫn luôn tăng.
// REWARD_FLAT_FROM > 0: từ màn đó thưởng thôi tăng (mọi màn sau nhận đúng thưởng của màn đó). 0 = tăng mãi (mặc định).
export const rewardFor = (levelIndex, { REWARD_BASE, REWARD_STEP = 0, REWARD_GROWTH = 0, REWARD_JITTER = 0, REWARD_FLAT_FROM = 0 }) => {
  const L = REWARD_FLAT_FROM > 0 ? Math.min(levelIndex + 1, REWARD_FLAT_FROM) : levelIndex + 1, C = Math.ceil(L / 10), gc = (1 + REWARD_GROWTH) ** (C - 1);
  const steps = 10 * (REWARD_GROWTH ? (gc - 1) / REWARD_GROWTH : C - 1) - 1 + (L - 10 * (C - 1)) * gc;
  return Math.round(REWARD_BASE + REWARD_STEP * steps + REWARD_STEP * gc * REWARD_JITTER * wobble(L - 1));
};
