// 47 blob tiles: N/E/S/W = 1/2/4/8; NE/SE/SW/NW = 16/32/64/128.
export function canonicalSyrupMask(mask) {
  let result = mask & 15;
  for (const [corner, sides] of [[16, 3], [32, 6], [64, 12], [128, 9]]) {
    if ((mask & sides) === sides && (mask & corner)) result |= corner;
  }
  return result;
}
export const SYRUP_MASKS = [...new Set(Array.from({ length: 256 }, (_, mask) => canonicalSyrupMask(mask)))].sort((a, b) => a - b);
export function syrupMaskAt(row, col, hasSyrup) {
  const offsets = [[-1, 0], [0, 1], [1, 0], [0, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]];
  return canonicalSyrupMask(offsets.reduce((mask, [dr, dc], bit) => mask | (hasSyrup(row + dr, col + dc) ? 1 << bit : 0), 0));
}
export function syrupAtlasStyle(mask) {
  const slot = SYRUP_MASKS.indexOf(canonicalSyrupMask(mask));
  return `--sx:${(2 + slot % 8 * 132) * 100 / 928}%;--sy:${(2 + Math.floor(slot / 8) * 132) * 100 / 664}%`;
}
