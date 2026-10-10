// Độ khó thích ứng (DDA) theo profile người chơi (thuần logic, không đụng giao diện). Ngưỡng nằm ở tuning.mjs (ADAPTIVE).
//
// Luật cứng: DDA KHÔNG đụng vào thiết kế màn — hình bàn, vật cản (thùng, kim loại, ô ngoài bàn), chuồng, số lượt, mục tiêu,
// giống mèo giữ đúng như levels.mjs. DDA chỉ được chỉnh hai thứ, và chỉnh nhẹ để người chơi không nhận ra:
//   1. Bố trí mèo đặt sẵn lúc vào màn (pickCatLayout): thiết kế xê dịch vài con mèo tự do, giữ đúng số mèo mỗi giống. Các bố trí
//      cho từng mức được bot đo trước (tools/generate-cat-layouts.mjs -> cat-layouts.mjs): mỗi mức chỉ lệch vài điểm % tỉ lệ thắng
//      so với thiết kế. Thua rồi chơi lại thì GIỮ NGUYÊN bố trí của lần trước (đọc từ lịch sử).
//   2. Hàng thẻ (tuneDealer): tỉ lệ thẻ đơn / đôi / 3 ô và assist (xác suất thẻ ra màu đang có trên bàn), lệch tối đa
//      A.ASSIST_SPAN so với thiết kế. Chơi lại chỉ còn chỉnh được phần này.
// Ngoài ra mọi màn đều bảo đảm thẻ đầu tiên gom được ngay (session.mjs openingCard), kể cả khi không có DDA.
//
// `shift` của một lần vào màn: -2 … +2 (âm = dễ hơn, dương = khó hơn), 0 = đúng thiết kế.
// Nhãn Easy / Medium / Hard (element) chỉ còn để hiển thị, tính từ bản thiết kế và không bao giờ đổi theo DDA.
//
// Vòng đời: startVisit lúc mở game -> planLevel trước mỗi lần vào màn (đọc lịch sử -> profile -> bố trí + hàng thẻ)
// -> recordAttempt khi màn kết thúc (thắng, thua, bỏ ngang; lưu cả bố trí đã chơi) -> noteDwell khi rời bảng kết quả.
// Màn có tutorial luôn chơi đúng thiết kế.
import { LEVELS, parseBoard, DEFAULT_SHAPES, DEFAULT_ASSIST } from './levels.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE } from './scoring.mjs';
import { ADAPTIVE } from './tuning.mjs';
import { boardSize, isPlainSquare } from './board-shapes.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';
import { CAT_LAYOUTS } from './cat-layouts.mjs';

const A = ADAPTIVE;
const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round2 = x => Math.round(x * 100) / 100;

// ---------- Element và nhãn độ khó (chỉ để hiển thị, tính trên bản thiết kế) ----------
export const ELEMENTS = ['moves', 'colors', 'crate', 'wall', 'board', 'cage', 'grass'];
export function levelElements(level) {
  const cells = level.board.join('');
  return {
    moves: !level.grass && level.target / level.moves >= A.TIGHT_PPM,
    colors: level.cats.length >= A.MANY_COLORS,
    crate: cells.includes('X'),
    wall: cells.includes('M'),
    board: !isPlainSquare(level.board),
    cage: /[a-z]/.test(cells),
    // Cỏ: mục tiêu dọn cỏ thay cho điểm, làm màn khó hơn.
    grass: !!level.grass?.join('').includes('~'),
  };
}
export const elementCount = level => Object.values(levelElements(level)).filter(Boolean).length;
export const difficultyOf = count => (count <= 1 ? 'easy' : count <= 3 ? 'medium' : 'hard');
export const MAX_ELEMENTS = ELEMENTS.length;
export const isAdaptive = level => !level.tutorial;
export const SHIFT_MIN = -2, SHIFT_MAX = 2;

// ---------- Bố trí mèo đặt sẵn ----------
// Ô "tự do": ô trống hoặc mèo không bị nhốt. Vật cản, ô ngoài bàn, mèo trong chuồng là thiết kế: không bao giờ dời.
const isFreeCat = ch => /[A-Z]/.test(ch) && ch !== 'X' && ch !== 'M';
const isFreeCell = ch => ch === '.' || isFreeCat(ch);
// Thiết kế của bàn: mọi ô không tự do giữ nguyên chữ, ô tự do thành '.'. Hai bàn cùng thiết kế khi chuỗi này trùng nhau
// và cùng số mèo mỗi giống.
const designOf = rows => rows.join('').replace(/[A-Z]/g, ch => (isFreeCat(ch) ? '.' : ch));
const catBag = rows => [...rows.join('')].filter(isFreeCat).sort().join('');
export const sameDesign = (a, b) => a.length === b.length && a[0].length === b[0].length && designOf(a) === designOf(b) && catBag(a) === catBag(b);

// Số cặp mèo cùng màu nằm cạnh nhau (chỉ để xem trong editor; KHÔNG dùng để chọn bố trí: dời mèo còn ảnh hưởng phá thùng,
// mở chuồng, chỗ trống... nên độ khó thật chỉ đo được bằng bot — xem tools/generate-cat-layouts.mjs).
export function layoutEase(rows) {
  const { W, H } = boardSize(rows), cells = rows.join('');
  let pairs = 0;
  for (let i = 0; i < cells.length; i++) {
    if (!isFreeCat(cells[i])) continue;
    const x = i % W, y = (i - x) / W;
    if (x + 1 < W && cells[i + 1] === cells[i]) pairs++;
    if (y + 1 < H && cells[i + W] === cells[i]) pairs++;
  }
  return pairs;
}

export function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const hashOf = text => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// Bố trí hợp lệ: không có sẵn cụm gom, và có ít nhất một mèo tự do sát ô trống (thẻ đầu tiên luôn gom được).
export function playableLayout(rows) {
  const { W, H } = boardSize(rows), cells = rows.join('');
  if (clearMatches(parseBoard(rows), W, H, MATCH_SIZE).cleared.length) return false;
  return [...cells].some((ch, i) => isFreeCat(ch) && [i - W, i + W, i % W ? i - 1 : -1, i % W < W - 1 ? i + 1 : -1]
    .some(j => j >= 0 && j < cells.length && cells[j] === '.'));
}

// Một bố trí ứng viên: bố trí thiết kế xê dịch 1..maxMoves con mèo (dời sang ô trống, hoặc đổi chỗ hai con khác giống).
// Nhìn vẫn giống thiết kế. Trả về null nếu không ra bố trí hợp lệ khác thiết kế. Dùng cho tools/generate-cat-layouts.mjs.
export function nudgeCats(rows, rng, maxMoves = 3) {
  const { W } = boardSize(rows), flat = [...rows.join('')];
  const slots = flat.map((ch, i) => (isFreeCell(ch) ? i : -1)).filter(i => i >= 0);
  const moves = 1 + Math.floor(rng() * maxMoves);
  for (let m = 0; m < moves; m++) {
    const cats = slots.filter(i => isFreeCat(flat[i]));
    if (!cats.length) return null;
    const from = cats[Math.floor(rng() * cats.length)], to = slots[Math.floor(rng() * slots.length)];
    if (flat[to] !== flat[from]) [flat[from], flat[to]] = [flat[to], flat[from]];
  }
  const out = rows.map((_, r) => flat.slice(r * W, r * W + W).join(''));
  return out.join('') !== rows.join('') && playableLayout(out) ? out : null;
}

// Bố trí cho lần vào màn: chọn (theo seed) một bố trí đã được bot đo trước trong CAT_LAYOUTS (cat-layouts.mjs) đúng mức `shift`.
// Mức đó chưa có bố trí đo sẵn thì lùi dần về 0 (cùng chiều); shift 0 giữ thiết kế, trừ `swap` (người chơi chán: bố trí khác
// nhưng độ khó như thiết kế, mục '0'). Bố trí đã lưu mà không còn đúng thiết kế hiện tại (màn bị sửa) thì bỏ qua.
export function pickCatLayout(base, shift, seed, { swap = false } = {}) {
  const table = CAT_LAYOUTS[base.name];
  if (!table) return base.board;
  for (let s = shift; ; s -= Math.sign(s)) {
    if (s === 0 && !swap) return base.board;
    const options = (table[String(s)] || []).filter(rows => sameDesign(rows, base.board));
    if (options.length) return options[mulberry32(seed)() * options.length | 0];
    if (s === 0) return base.board;
  }
}

// ---------- Hàng thẻ ----------
// Chỉnh bộ chia thẻ (không đổi bàn, không đổi lượt). Game thắng theo điểm nên thẻ to và thẻ trùng màu trên bàn dễ hơn,
// thẻ đơn khó hơn. Mọi thay đổi nhỏ, cộng dồn không quá A.ASSIST_SPAN assist và A.SHAPE_SPAN thẻ mỗi loại.
//   shift: mức dễ/khó của lần vào màn · stuck / moves: số lần thua liền vì hết chỗ / hết lượt ở chính màn này.
// Trả về { level (có shapes/assist mới nếu đổi), deal (mô tả ngắn để QA, null nếu giữ nguyên) }.
export function tuneDealer(level, { shift = 0, stuck = 0, moves = 0 } = {}) {
  const baseShapes = { ...DEFAULT_SHAPES, ...level.shapes }, baseAssist = level.assist ?? DEFAULT_ASSIST;
  const shapes = { ...baseShapes };
  let assist = baseAssist;
  if (shift < 0) { assist += A.ASSIST_STEP * -shift; shapes.domino += -shift; }
  if (shift > 0) { assist -= A.ASSIST_STEP * shift; if (shift >= 2) shapes.single += 1; }
  // Hết chỗ khi chơi lại: thêm thẻ đôi (gọn mà vẫn đủ điểm).
  if (stuck >= A.STUCK_AFTER) shapes.domino += Math.min(2, stuck - A.STUCK_AFTER + 1);
  // Hết lượt khi chơi lại: thẻ trùng màu trên bàn nhiều hơn + một thẻ to (bàn chật thì thẻ đôi cho đỡ kẹt).
  if (moves >= A.MOVES_AFTER) {
    assist += A.ASSIST_STEP * Math.min(2, moves - A.MOVES_AFTER + 1);
    const crowded = [...level.board.join('')].filter(ch => ch === 'X' || ch === 'M').length >= A.CROWDED_BLOCKS;
    if (crowded) shapes.domino += 1; else shapes.triple += 1;
  }
  assist = round2(clamp(assist, Math.max(0.1, baseAssist - A.ASSIST_SPAN), Math.min(0.7, baseAssist + A.ASSIST_SPAN)));
  for (const key of Object.keys(shapes)) shapes[key] = clamp(shapes[key], Math.max(0, baseShapes[key] - A.SHAPE_SPAN), baseShapes[key] + A.SHAPE_SPAN);
  const notes = Object.keys(shapes).filter(key => shapes[key] !== baseShapes[key]).map(key => `${key}${shapes[key] > baseShapes[key] ? '+' : ''}${shapes[key] - baseShapes[key]}`);
  if (assist !== round2(baseAssist)) notes.push(`assist ${round2(baseAssist)}→${assist}`);
  if (!notes.length) return { level, deal: null };
  return { level: { ...level, shapes, assist }, deal: notes.join(' ') };
}

// Bản màn cho một mức `shift` (công cụ: bot, editor). Lần đầu vào màn: bố trí mới + hàng thẻ; không có lý do thua.
export function variantFor(base, shift, seed = hashOf(base.name)) {
  const level = { ...base, board: pickCatLayout(base, shift, seed) };
  return tuneDealer(level, { shift }).level;
}

// ---------- Profile người chơi (save) ----------
// attempts[]: { level, win, reason ('win'|'moves'|'stuck'|'quit'), ratio (điểm/mục tiêu), stars, count (số element bản thiết kế),
//               boosters (tổng số booster dùng), thinkMs (trung vị nghĩ mỗi lượt), idleMs, durationMs, dwellMs, profile, shift, mode,
//               layout (bố trí bàn đã chơi, mảng chuỗi — chơi lại sau khi thua dùng lại đúng bố trí này), t
//               Chỉ để thống kê, thuật toán KHÔNG đọc: boostUse { hammer, swap, moves }, bought, preBoostRatio.
//               Booster không ảnh hưởng điều kiện thắng/thua: thắng có booster vẫn là thắng, thua có booster vẫn là một lần thua. }
// streakFrom: chuỗi thắng/thua chỉ tính từ lần thử này (đặt lại khi người chơi quay lại sau thời gian nghỉ).
const EMPTY = { attempts: [], streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: 0 };
export function loadProfile() {
  const saved = readJSON(SAVE_KEYS.profile);
  return saved && Array.isArray(saved.attempts) ? { ...EMPTY, ...saved } : { ...EMPTY };
}
export function saveProfile(profile) { writeJSON(SAVE_KEYS.profile, profile); }

// Mở game: nghỉ lâu thì màn đầu phiên được khởi động nhẹ, chuỗi thắng/thua cũ bỏ qua.
export function startVisit(profile, now = Date.now()) {
  const returning = profile.lastSeen && now - profile.lastSeen >= A.RETURN_DAYS * DAY_MS;
  return { ...profile, lastSeen: now, ...(returning ? { warmup: true, streakFrom: profile.attempts.length } : {}) };
}

const median = list => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
// Mức nghĩ thường mỗi lượt của chính người chơi: trung vị các lần thắng ở màn 3–6 (chưa có thì mọi lần thắng).
export function baseThink(profile) {
  const wins = profile.attempts.filter(a => a.win && a.thinkMs > 0);
  const early = wins.filter(a => a.level >= 2 && a.level <= 5);
  return median((early.length >= 2 ? early : wins).map(a => a.thinkMs));
}

// Nhận diện profile cho lần vào màn `levelIndex`. Trả về { id, shift (-2 … +2, âm = dễ hơn), free (bỏ qua luật đổi tối đa
// 1 mức so với lần trước), swap, suggestBooster }.
// Xét theo thứ tự ưu tiên: quay lại · người mới (trừ khi thắng sạch liền) · sát nút (tới lần chơi lại thứ 5) · sắp bỏ · vật lộn ·
// chán · cao thủ · suy nghĩ kỹ · ổn định.
export function detectProfile(profile, levelIndex) {
  const recent = profile.attempts.slice(profile.streakFrom);
  const last = n => recent.slice(-n);
  const streak = win => { let n = 0; for (let i = recent.length - 1; i >= 0 && recent[i].win === win; i--) n++; return n; };
  const winStreak = streak(true), loseStreak = streak(false);
  let retries = 0;
  for (let i = recent.length - 1; i >= 0 && recent[i].level === levelIndex && !recent[i].win; i--) retries++;
  const lastShift = recent.at(-1)?.shift ?? 0;
  const think = baseThink(profile);
  const idleUp = a => (think > 0 && a.thinkMs > A.IDLE_RATIO * think) || (a.durationMs > 0 && a.idleMs > A.IDLE_SHARE * a.durationMs);
  const nearMiss = a => !a.win && a.reason !== 'quit' && a.ratio >= A.NEAR_MISS;
  const window = last(A.WINDOW);
  const thinker = think >= A.THINKER_MS && window.length >= 3 && window.filter(a => a.win).length / window.length >= 0.6;

  // Chuỗi thắng "sạch": thắng ngay lần đầu ở mỗi màn (lần thử trước không phải lần thua ở cùng màn), không booster.
  // Màn tutorial bỏ qua (ai cũng thắng nên không nói lên điều gì). Mới nhất đứng đầu.
  const cleanWins = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const a = recent[i], before = recent[i - 1];
    if (!a.win || a.boosters || (before && !before.win && before.level === a.level)) break;
    if (isAdaptive(LEVELS[a.level])) cleanWins.push(a);
  }
  // Cao thủ chỉ tính các màn thắng ở mức Medium trở lên (thắng liền mấy màn Easy chưa chứng tỏ giỏi).
  const hardWins = cleanWins.filter(a => (a.count ?? 2) >= 2).length;
  // Thắng sạch 2 màn liền mà lơ đãng dần (nghĩ lâu hơn, đứng lâu ở bảng thắng) = chơi chán; thắng sạch 3 màn Medium+ = cao thủ.
  const hot = () => {
    if (cleanWins.length < 2) return null;
    const wins = cleanWins.slice(0, 3).reverse(), first = wins[0], latest = wins.at(-1);
    const bored = (first.thinkMs > 0 && latest.thinkMs > 1.3 * first.thinkMs) || wins.slice(-2).every(a => a.dwellMs > A.DWELL_MS);
    if (bored) return recent.at(-1).mode === 'swap' ? { id: 'bored', shift: lastShift + 1 } : { id: 'bored', shift: lastShift, swap: true };
    if (hardWins >= 3 && !idleUp(latest)) return { id: 'skilled', shift: hardWins >= 6 ? 2 : 1 };
    return null;
  };

  if (profile.warmup) return { id: 'returning', shift: -1, free: true };
  // Người mới: chưa làm khó, thua 2 lần ở cùng màn thì hàng thẻ nhẹ đi một mức; thắng sạch liền thì vẫn được tăng khó.
  if (levelIndex < A.ONBOARD_LEVELS || profile.attempts.length < A.ONBOARD_ATTEMPTS) {
    return hot() ?? { id: 'onboarding', shift: retries >= 2 ? -1 : 0, free: true };
  }
  const two = last(2), lastTry = recent.at(-1);
  // Người chơi mong manh: từng bỏ ngang gần đây. Với họ không giữ độ khó khi thua sát nút.
  const fragile = last(A.FRAGILE_WINDOW).some(a => a.reason === 'quit');
  // Thua sát nút được xét trước "sắp bỏ game" (người chơi vẫn muốn thử lại), nhưng chơi lại tới lần thứ 5 thì thôi.
  if (two.length === 2 && two.every(nearMiss) && retries < 5 && !fragile) {
    let misses = 0;
    for (let i = recent.length - 1; i >= 0 && nearMiss(recent[i]); i--) misses++;
    // Giữ độ khó và mời booster +lượt; sát nút tới lần thứ 4 thì hàng thẻ nhẹ đi một mức.
    return { id: 'near-miss', shift: misses >= 4 ? lastShift - 1 : lastShift, suggestBooster: !lastTry.boosters };
  }
  // Sắp bỏ game: thua 4 lần, hoặc chơi lại 5 lần, hoặc thua 3 lần kèm dấu hiệu nản (nghĩ lâu / AFK / đứng lâu ở bảng thua),
  // hoặc 2 lần thua liền cùng dấu hiệu nản, hoặc bỏ ngang sau khi đã thua, hoặc người mong manh thua 2 lần liền.
  const tilted = a => idleUp(a) || a.dwellMs > A.DWELL_MS;
  const frustrated = loseStreak >= 4 || retries >= 5
    || (loseStreak >= 3 && tilted(lastTry))
    || (two.length === 2 && two.every(a => !a.win && idleUp(a) && a.dwellMs > A.DWELL_MS))
    || (lastTry?.reason === 'quit' && loseStreak >= 2)
    || (fragile && loseStreak >= 2);
  if (frustrated) return { id: 'frustrated', shift: SHIFT_MIN, free: true };
  const losses = Math.max(loseStreak, retries);
  if (losses >= 2 || (fragile && losses >= 1)) return { id: 'struggling', shift: -Math.max(1, Math.min(2, losses - 1)) };
  // Vừa thắng lại sau chuỗi thua: giữ mức nới thêm một màn rồi mới về thiết kế.
  if (winStreak === 1 && lastShift < 0) return { id: 'struggling', shift: lastShift };
  const heat = hot();
  if (heat) return heat;
  // Cao thủ thua một lần: giữ +1, chưa hạ hẳn.
  if (loseStreak === 1 && lastShift > 0) return { id: 'skilled', shift: Math.min(1, lastShift) };
  return { id: thinker ? 'thinker' : 'steady', shift: 0 };
}

// Bố trí đã chơi ở lần thử gần nhất của màn này, nếu lần đó chưa thắng (đang chơi lại) và vẫn đúng thiết kế hiện tại.
function retryLayout(profile, levelIndex, base) {
  for (let i = profile.attempts.length - 1; i >= 0; i--) {
    const a = profile.attempts[i];
    if (a.level !== levelIndex) continue;
    return !a.win && Array.isArray(a.layout) && sameDesign(a.layout, base.board) ? a.layout : null;
  }
  return null;
}

// Bản màn cho lần vào màn kế tiếp. `level` là dữ liệu màn đã chỉnh, đưa thẳng vào createSession.
// `layout` = bố trí bàn của lần này (lưu vào lần thử để chơi lại dùng lại).
export function planLevel(profile, levelIndex) {
  const base = LEVELS[levelIndex], baseCount = elementCount(base), difficulty = difficultyOf(baseCount);
  const fixed = id => ({ level: base, profile: id, shift: 0, mode: null, layout: base.board, deal: null, suggestBooster: false, retry: false, baseCount, count: baseCount, difficulty });
  // Màn tutorial luôn chơi đúng thiết kế.
  if (!isAdaptive(base)) return fixed('tutorial');

  const p = detectProfile(profile, levelIndex);
  const lastShift = profile.attempts.slice(profile.streakFrom).at(-1)?.shift ?? 0;
  // Mỗi lần thử chỉ đổi tối đa 1 mức so với lần trước (trừ các profile `free`).
  let shift = clamp(p.free ? p.shift : clamp(p.shift, lastShift - 1, lastShift + 1), SHIFT_MIN, SHIFT_MAX);
  if (profile.cooldown > 0) shift = Math.min(shift, 0);
  if (base.tier === 'boss') shift = Math.max(shift, -1); // boss chỉ nới nhẹ

  // Bố trí: chơi lại sau khi thua thì giữ nguyên bố trí cũ; lần đầu vào màn (hoặc chơi lại sau khi thắng) thì xếp mới.
  const kept = retryLayout(profile, levelIndex, base);
  const board = kept ?? pickCatLayout(base, shift, hashOf(base.name) ^ Math.imul(profile.attempts.length + 1, 2654435761), { swap: !!p.swap });
  let level = board === base.board ? base : { ...base, board };

  // Hàng thẻ: mức shift + lý do các lần thua liên tiếp ở chính màn này (bỏ ngang không tính vào lý do nào).
  const losses = { stuck: 0, moves: 0 };
  const recent = profile.attempts.slice(profile.streakFrom);
  for (let i = recent.length - 1; i >= 0 && recent[i].level === levelIndex && !recent[i].win; i--) {
    if (recent[i].reason in losses) losses[recent[i].reason]++;
  }
  // Thua sát nút: chỉ theo mức shift (luật sát nút giữ độ khó và mời booster), không cộng thêm theo lý do thua.
  const tuned = tuneDealer(level, p.id === 'near-miss' ? { shift } : { shift, ...losses });
  level = tuned.level;
  return { level, profile: p.id, shift, mode: p.swap ? 'swap' : null, layout: level.board, deal: tuned.deal, suggestBooster: !!p.suggestBooster, retry: !!kept, baseCount, count: baseCount, difficulty };
}

// Ghi một lần thử. `attempt` gồm metric lần chơi + { profile, shift, mode, layout } của plan đã dùng.
// Trả về { profile, gift }: gift = true khi đây là màn thắng đầu tiên sau khi bị nhận diện "sắp bỏ game".
export function recordAttempt(profile, attempt, now = Date.now()) {
  const attempts = [...profile.attempts, { ...attempt, t: now }].slice(-A.HISTORY);
  const dropped = profile.attempts.length + 1 - attempts.length;
  const frustrated = attempt.profile === 'frustrated';
  let { cooldown, giftPending } = profile, gift = false;
  if (frustrated) { cooldown = A.CALM_LEVELS; giftPending = true; }
  if (attempt.win) {
    if (giftPending) { gift = true; giftPending = false; }
    if (!frustrated && cooldown > 0) cooldown--;
  }
  const next = { ...profile, attempts, streakFrom: Math.max(0, profile.streakFrom - dropped), cooldown, giftPending, warmup: false, lastSeen: now };
  return { profile: next, gift };
}

// Bảng thua: mời dùng booster +lượt ở lần sau khi vừa thua sát nút (điểm tự đạt) mà chưa dùng booster nào.
export function boosterTip(profile) {
  const lastTry = profile.attempts.at(-1);
  return !!lastTry && !lastTry.win && lastTry.reason !== 'quit' && !lastTry.boosters && lastTry.ratio >= A.NEAR_MISS;
}

// Thời gian đứng ở bảng kết quả trước khi bấm Retry / Next / Home: ghi vào lần thử vừa xong.
export function noteDwell(profile, dwellMs) {
  const lastAttempt = profile.attempts.at(-1);
  if (!lastAttempt || lastAttempt.dwellMs != null) return profile;
  return { ...profile, attempts: [...profile.attempts.slice(0, -1), { ...lastAttempt, dwellMs }] };
}
