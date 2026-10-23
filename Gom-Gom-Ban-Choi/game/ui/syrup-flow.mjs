// Shared by the game and the frame study. 84 intervals over 1.4 seconds.
export const SUCK_MS = 1400;
export const FLOW_FPS = 60;
export const CURVE_PTS = 11, TOP_PTS = 7;
const smooth = t => t * t * (3 - 2 * t);
const beats = [
  [0, 0, 0, 100, 0, 1, 1],
  [.1, 0, 0, 100, 0, 1.05, .95],
  [.22, 0, 0, 100, 0, .98, 1.03],
  [.45, 5, .14, 30, .75, 1, 1],
  [.7, 10, .45, 25, 1, 1, 1],
  [.86, 13, .8, 0, 1, 1, 1],
  [1, 15, 1, 0, 1, 1, 1],
];
export function flowAt(t) {
  t = Math.max(0, Math.min(1, t));
  const i = Math.min(beats.length - 2, Math.max(0, beats.findIndex(b => b[0] >= t) - 1));
  const a = beats[i], b = beats[i + 1];
  const u = smooth(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))));
  const values = a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
  return [t, ...values.slice(0, 4), `${values[4]}, ${values[5]}`];
}
export const SYRUP_FLOW = Array.from({ length: SUCK_MS / 1000 * FLOW_FPS + 1 }, (_, i) => flowAt(i / (SUCK_MS / 1000 * FLOW_FPS)));
export function syrupOutline([, , drain, waist, pour], mouth, box) {
  const tailY = 100 + (mouth.y - 100) * pour;
  const half = 50 + (mouth.half - 50) * pour, mid = 50 + (mouth.x - 50) * pour;
  const top = drain * tailY, from = Math.min(Math.max(top, waist), tailY);
  const dip = 7 * Math.sin(Math.PI * drain);
  const surface = Array.from({ length: TOP_PTS }, (_, i) => {
    const t = i / (TOP_PTS - 1);
    return [box.l + (box.r - box.l) * t, Math.min(tailY, top + dip * Math.sin(Math.PI * t))];
  });
  const side = (edge, end) => Array.from({ length: CURVE_PTS }, (_, i) => {
    const t = i / (CURVE_PTS - 1);
    // The upper pool also narrows as its last volume reaches the mouth.
    const collapse = smooth(Math.max(0, (drain - .8) / .2));
    const start = edge + (end - edge) * collapse;
    return [start + (end - start) * smooth(Math.min(1, t / .65)), from + (tailY - from) * t];
  });
  const collapse = smooth(Math.max(0, (drain - .8) / .2));
  const narrowSurface = surface.map(([x, y]) => [x + (mid + (x < mid ? -half : half) - x) * collapse, y]);
  return [...narrowSurface, ...side(box.r, mid + half), ...side(box.l, mid - half).reverse()];
}
