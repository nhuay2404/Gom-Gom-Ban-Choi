// Lịch LiveOps là DỮ LIỆU (Phase 4 thay bằng remote config JSON, cùng hình dạng): event nào chạy ngày nào trong chu kỳ season 28 ngày.
// Chưa có server: tính từ ngày theo giờ máy (00:00 giờ người chơi), chu kỳ cố định bắt đầu từ EVENT_EPOCH. Luật ở events.mjs,
// số (thưởng, mốc, fromLevel) ở tuning.mjs → LIVEOPS.EVENTS. Thiết kế: tai-lieu/6-Thiet-ke-LiveOps.html (Event hằng tuần).

// Ngày 1 của season đầu (thứ Hai). Tuần 4 của chu kỳ đầu là 26/10 – 01/11/2026: Deco Sale rơi đúng Halloween.
export const EVENT_EPOCH = { year: 2026, month: 10, day: 5 };
export const CYCLE_DAYS = 28;

// kind: 'main' (đúng 1 event chính) · 'side' (tối đa 1 event phụ) · 'offer' (ưu đãi, không chiếm nút event ở Home).
// weekdays: 0 = thứ Hai … 6 = Chủ nhật; các ngày liền nhau gộp thành một lượt event. weeks: tuần mấy của chu kỳ (1–4), bỏ trống = mọi tuần.
// race: ngày đua là ngày được tham gia; cuộc đua kéo dài LIVEOPS.EVENTS.race.hours kể từ lúc vào.
export const EVENT_CALENDAR = [
  { id: 'yarn', kind: 'main', weekdays: [0, 1, 2, 3] },
  { id: 'fish', kind: 'main', weekdays: [4, 5, 6] },
  { id: 'race', kind: 'side', weekdays: [1, 5] },
  { id: 'decoSale', kind: 'offer', weekdays: [5, 6], weeks: [4] },
];

// Chữ hiện trên giao diện (tiếng Anh như phần còn lại của game).
export const EVENT_INFO = {
  yarn: { name: 'Yarn Climb', short: 'Climb', rule: 'Win to climb a step, lose to slip one down. Reach the top for a big prize!' },
  fish: { name: 'Fish Festival', short: 'Fish', rule: 'Every group you match gives fish, one per cat. Collect fish to unlock rewards!' },
  race: { name: 'Cat Race', short: 'Race', rule: 'First to win {goal} levels wins! Your rivals are AI cats.' },
  decoSale: { name: 'Deco Sale', short: 'Sale', rule: 'Decorations cost less this weekend!' },
};

// Tên đối thủ trong Cat Race (mèo do máy điều khiển, không ghi là người thật).
export const RACE_BOTS = ['Mochi', 'Biscuit', 'Pudding', 'Noodle', 'Tofu', 'Pepper', 'Maple', 'Sushi', 'Waffle', 'Olive'];
