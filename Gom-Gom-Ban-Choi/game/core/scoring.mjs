// Tính điểm dùng chung cho game và bộ mô phỏng level. Điểm chỉ phụ thuộc cỡ cụm.
// Hệ số theo cỡ cụm: gom 3 giữ mốc 30 điểm, cụm càng to thưởng càng đậm để đáng mạo hiểm chờ.
// 3 -> 30 · 4 -> 50 · 5 -> 80 · 6+ -> 120 (cụm 7+ vẫn x2).
export const MATCH_SIZE = 3, POINTS_PER_CLEARED = 10;
const MATCH_MULTIPLIER = { 3: 1, 4: 1.25, 5: 1.6, 6: 2 };
export const clusterPoints = size => Math.round(size * POINTS_PER_CLEARED * (MATCH_MULTIPLIER[Math.min(size, 6)] ?? 1));
export const matchPoints = clusters => clusters.reduce((sum, cluster) => sum + clusterPoints(cluster.length), 0);
// Thùng gỗ vỡ (gom cạnh thùng) cũng ra điểm: mỗi thùng POINTS_PER_CRATE. Điểm một lượt = điểm các cụm + điểm thùng.
export const POINTS_PER_CRATE = 10;
export const turnPoints = match => matchPoints(match.clusters) + (match.broken?.length ?? 0) * POINTS_PER_CRATE;
