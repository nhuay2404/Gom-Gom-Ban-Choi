// Độ khó thích ứng theo profile người chơi (thuần logic, không đụng giao diện).
// Thiết kế đầy đủ: tai-lieu/5-Do-kho-theo-profile-nguoi-choi.md. Ngưỡng nằm ở tuning.mjs (ADAPTIVE).
//
// Mỗi màn có 5 element: moves (lượt chật), màu mèo (nhiều giống), crate ('X'), wall ('M'), board (bàn rộng hơn
// 6×6 hoặc có hình: tim, tam giác...). Số element đang bật quyết định nhãn: Easy 0–1 · Medium 2–3 · Hard 4–5.
// Bàn theo profile: người đang vất vả được thu về 6×6 gọn, bớt vật cản; người giỏi được bàn rộng, có hình, thêm thùng.
//
// Vòng đời: startVisit lúc mở game -> planLevel trước mỗi lần vào màn (đọc lịch sử -> profile -> bản màn
// đã bật/tắt element) -> recordAttempt khi màn kết thúc (thắng, thua, bỏ ngang) -> noteDwell khi rời bảng kết quả.
// Màn có tutorial luôn chơi bản gốc.
import { LEVELS, parseBoard, DEFAULT_SHAPES, DEFAULT_ASSIST } from './levels.mjs';
import { clearMatches } from './board-rules.mjs';
import { MATCH_SIZE } from './scoring.mjs';
import { ADAPTIVE } from './tuning.mjs';
import { boardSize, isPlainSquare, compactBoard, expandBoard, playableCells, VOID } from './board-shapes.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';
import { LAYOUTS } from './level-layouts.mjs';

const A = ADAPTIVE;
const DAY_MS = 24 * 60 * 60 * 1000;
// Thứ tự thêm giống mèo khi cần nhiều màu hơn (cùng thứ tự game giới thiệu giống mới).
const BREEDS = 'OGWTSK';

// ---------- Element và nhãn độ khó ----------
export const ELEMENTS = ['moves', 'colors', 'crate', 'wall', 'board', 'cage'];
export function levelElements(level) {
  const cells = level.board.join('');
  return {
    moves: level.target / level.moves >= A.TIGHT_PPM,
    colors: level.cats.length >= A.MANY_COLORS,
    crate: cells.includes('X'),
    wall: cells.includes('M'),
    board: !isPlainSquare(level.board),
    // Mèo trong chuồng (chữ thường, có ổ khóa): element riêng — chiếm ô, phải gom sát bên CAGE.LOCKS lần mới thả ra.
    cage: /[a-z]/.test(cells),
  };
}
// Màn đầu tiên có chuồng: trước màn này không tự nhốt mèo (chưa giới thiệu cơ chế).
const CAGE_FROM = LEVELS.findIndex(l => /[a-z]/.test(l.board.join('')));
const levelIndexOf = level => LEVELS.findIndex(l => l.name === level.name);
export const elementCount = level => Object.values(levelElements(level)).filter(Boolean).length;
export const difficultyOf = count => (count <= 1 ? 'easy' : count <= 3 ? 'medium' : 'hard');
export const MAX_ELEMENTS = ELEMENTS.length;
export const isAdaptive = level => !level.tutorial;

// Bỏ giống mèo: mèo đặt sẵn của giống bị bỏ được tô lại thành giống còn giữ (giữ các cặp sẵn trên bàn),
// miễn không sinh cụm gom sẵn; không giống nào hợp thì thành ô trống.
function recolor(rows, cats) {
  const { W, H } = boardSize(rows);
  const cells = rows.join('').split('');
  cells.forEach((ch, i) => {
    if ('.XM#'.includes(ch) || cats.includes(ch.toUpperCase())) return;
    if (ch !== ch.toUpperCase()) { cells[i] = '.'; return; } // mèo trong chuồng thuộc giống bị bỏ: bỏ luôn chuồng
    cells[i] = '.';
    for (const pick of cats) {
      cells[i] = pick;
      if (!clearMatches(parseBoard([cells.join('')]), W, H, MATCH_SIZE).cleared.length) return;
    }
    cells[i] = '.';
  });
  return rows.map((_, r) => cells.slice(r * W, (r + 1) * W).join(''));
}

// Hash nhỏ theo tên màn: cùng màn luôn ra cùng hình bàn / cùng chỗ đặt thùng (bản màn ổn định giữa các lần chơi).
const hashOf = text => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
// Mở rộng bàn 6×6: hình ghi ở màn (`expand`), không có thì chọn theo tên màn trong các hình không làm mất mèo.
const EXPAND_SHAPES = ['octagon', 'heart', 'hexagon', 'diamond', 'triangle', 'square7'];
function widen(level) {
  const order = level.expand ? [level.expand] : EXPAND_SHAPES.map((_, k, list) => list[(hashOf(level.name) + k) % list.length]);
  for (const shape of order) {
    const board = expandBoard(level.board, shape);
    if (board !== level.board) return board;
  }
  return level.board;
}
// Thêm `want` thùng gỗ vào ô trống, không đặt sát mèo đặt sẵn hay vật cản khác để không bịt kín cặp mèo
// có sẵn. Thùng luôn vỡ được nên không làm bàn vô nghiệm.
const crateCount = rows => [...rows.join('')].filter(ch => ch === 'X').length;
function addCrates(rows, want) {
  const { W, H } = boardSize(rows), cells = rows.join('').split('');
  const near = i => [i - W, i + W, i % W ? i - 1 : -1, i % W < W - 1 ? i + 1 : -1].some(j => j >= 0 && j < W * H && cells[j] !== '.' && cells[j] !== VOID);
  const free = cells.map((ch, i) => i).filter(i => cells[i] === '.' && !near(i));
  let h = hashOf(rows.join(''));
  while (want > 0 && free.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    const i = free.splice(h % free.length, 1)[0];
    if (near(i)) continue;
    cells[i] = 'X';
    want--;
  }
  return rows.map((_, r) => cells.slice(r * W, (r + 1) * W).join(''));
}

// Tắt một element (dễ hơn).
const OFF = {
  moves: l => ({ ...l, moves: Math.max(l.moves, Math.ceil(l.target / A.LOOSE_PPM)) }),
  colors: l => {
    const cats = l.cats.slice(0, A.MANY_COLORS - 1);
    return { ...l, cats, board: recolor(l.board, cats) };
  },
  crate: l => ({ ...l, board: l.board.map(row => row.replaceAll('X', '.')) }),
  wall: l => ({ ...l, board: l.board.map(row => row.replaceAll('M', '.')) }),
  board: l => ({ ...l, board: compactBoard(l.board) }),
  cage: l => ({ ...l, board: uncage(l.board) }),
};

// Thả mèo khỏi chuồng: chữ thường -> chữ hoa; thả ra mà sinh cụm gom sẵn thì bỏ con mèo đó (ô trống).
function uncage(rows) {
  const { W, H } = boardSize(rows), cells = rows.join('').split('');
  cells.forEach((ch, i) => {
    if (ch === ch.toUpperCase()) return;
    cells[i] = ch.toUpperCase();
    if (clearMatches(parseBoard([cells.join('')]), W, H, MATCH_SIZE).cleared.length) cells[i] = '.';
  });
  return rows.map((_, r) => cells.slice(r * W, (r + 1) * W).join(''));
}
// Nhốt `want` mèo đặt sẵn vào chuồng (chọn ổn định theo bàn). Mèo trong chuồng không vào cụm nên không sinh cụm gom sẵn.
function cageCats(rows, want) {
  const { W } = boardSize(rows), cells = rows.join('').split('');
  const cats = cells.map((ch, i) => (/[A-Z]/.test(ch) && !'XM'.includes(ch) ? i : -1)).filter(i => i >= 0);
  let h = hashOf(rows.join(''));
  while (want > 0 && cats.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    const i = cats.splice(h % cats.length, 1)[0];
    cells[i] = cells[i].toLowerCase();
    want--;
  }
  return rows.map((_, r) => cells.slice(r * W, (r + 1) * W).join(''));
}
// Bật một element (khó hơn). Không tự thêm kim loại (không bao giờ vỡ nên đặt bừa dễ làm bàn bí).
const ON = {
  // Bàn rộng hơn: màn có thùng thì thêm thùng vào phần mới để giữ mật độ (bàn rộng mà thưa thùng lại dễ hơn).
  board: l => {
    const board = widen(l), crates = crateCount(l.board);
    const extra = Math.round(crates * playableCells(board) / playableCells(l.board)) - crates;
    return { ...l, board: extra > 0 ? addCrates(board, extra) : board };
  },
  // Màn chưa có thùng: khoảng 1 thùng / CRATE_PER_CELLS ô trong bàn.
  crate: l => ({ ...l, board: addCrates(l.board, Math.round(playableCells(l.board) / A.CRATE_PER_CELLS)) }),
  moves: l => ({ ...l, moves: Math.min(l.moves, Math.floor(l.target / A.TIGHTEN_PPM)) }),
  colors: l => {
    let cats = l.cats;
    for (const ch of BREEDS) if (cats.length < A.MANY_COLORS && !cats.includes(ch)) cats += ch;
    return { ...l, cats };
  },
  // Nhốt mèo: chỉ từ màn giới thiệu chuồng trở đi.
  cage: l => (CAGE_FROM >= 0 && levelIndexOf(l) >= CAGE_FROM ? { ...l, board: cageCats(l.board, A.CAGE_CATS) } : l),
};
// Tắt: ít thấy -> dễ thấy; chuồng tắt trước thùng (mèo bị nhốt chặn cả cặp sẵn), bàn và wall là bản sắc nên tắt sau cùng.
const OFF_ORDER = ['moves', 'colors', 'cage', 'crate', 'board', 'wall'];
const ON_ORDER = ['moves', 'colors', 'board', 'crate', 'cage'];

// Bản màn có (gần nhất có thể) `target` element bật.
//   noMoves: không siết lượt khi tăng khó (người suy nghĩ kỹ)
//   swap: đổi loại element, giữ số lượng (tắt một vật cản, bật moves/màu) — cho người chơi chán
export function buildVariant(base, target, { noMoves = false, swap = false, keep = [] } = {}) {
  let level = { ...base };
  const canOn = key => !levelElements(level)[key] && !(noMoves && key === 'moves') && !keep.includes(key);
  if (swap) {
    const add = ON_ORDER.find(canOn), drop = ['cage', 'crate', 'wall'].find(key => levelElements(level)[key]);
    if (add && drop) level = OFF[drop](ON[add](level));
  }
  // Hạ xuống Easy (0–1 element): ra bản cơ bản hoàn toàn — bàn 6×6 gọn, không vật cản, lượt thoải mái, ≤4 giống.
  // Giữ lại 1 element nào cũng lệch: lượt chật / nhiều màu nặng hơn cả vật cản + bàn rộng cộng lại (đo bằng bot),
  // còn giữ vật cản / bàn rộng thì trái với "màn dễ là 6×6 không chướng ngại vật".
  if (target <= 1 && target < elementCount(base)) {
    for (const key of [...OFF_ORDER].reverse()) if (levelElements(level)[key] && !keep.includes(key)) level = OFF[key](level);
    return level;
  }
  for (const key of OFF_ORDER) {
    if (elementCount(level) <= target) break;
    if (levelElements(level)[key] && !keep.includes(key)) level = OFF[key](level);
  }
  for (const key of ON_ORDER) {
    if (elementCount(level) >= target) break;
    if (canOn(key)) level = ON[key](level);
  }
  return level;
}

// ---------- Profile người chơi (save) ----------
// attempts[]: { level, win, reason ('win'|'moves'|'stuck'|'quit'), ratio (điểm/mục tiêu), stars, count (số element bản đã chơi),
//               boosters (tổng số booster dùng), thinkMs (trung vị nghĩ mỗi lượt), idleMs, durationMs, dwellMs, profile, shift, mode, t
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

// Nhận diện profile cho lần vào màn `levelIndex`. Trả về { id, shift (±element so với bản gốc), free (bỏ qua
// luật đổi tối đa 1 element), target (số element tuyệt đối), extraMoves, noMoves, swap }.
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
    // Chán: 2 màn thắng sạch gần nhất đều đứng lâu ở bảng thắng, hoặc thời gian nghĩ tăng > 1.3 lần trong chuỗi.
    const bored = (first.thinkMs > 0 && latest.thinkMs > 1.3 * first.thinkMs) || wins.slice(-2).every(a => a.dwellMs > A.DWELL_MS);
    if (bored) return recent.at(-1).mode === 'swap' ? { id: 'bored', shift: lastShift + 1 } : { id: 'bored', shift: lastShift, swap: true };
    if (hardWins >= 3 && !idleUp(latest)) return { id: 'skilled', shift: hardWins >= 6 ? 2 : 1, noMoves: thinker };
    return null;
  };

  if (profile.warmup) return { id: 'returning', shift: -1, free: true };
  // Người mới: chưa nới độ khó (chỉ +lượt khi thua 2 lần), nhưng thắng sạch liền thì vẫn được tăng khó.
  if (levelIndex < A.ONBOARD_LEVELS || profile.attempts.length < A.ONBOARD_ATTEMPTS) {
    return hot() ?? { id: 'onboarding', shift: 0, free: true, extraMoves: retries >= 2 ? A.EXTRA_MOVES : 0 };
  }
  const two = last(2), lastTry = recent.at(-1);
  // Người chơi mong manh: từng bỏ ngang gần đây. Với họ không giữ độ khó khi thua sát nút, thua 1 lần là bớt 1 element,
  // thua 2 lần là hạ về Easy.
  const fragile = last(A.FRAGILE_WINDOW).some(a => a.reason === 'quit');
  // Thua sát nút được xét trước "sắp bỏ game" (người chơi vẫn muốn thử lại), nhưng chơi lại tới lần thứ 5 thì thôi.
  if (two.length === 2 && two.every(nearMiss) && retries < 5 && !fragile) {
    let misses = 0;
    for (let i = recent.length - 1; i >= 0 && nearMiss(recent[i]); i--) misses++;
    // Giữ độ khó và mời booster +lượt; nếu lần vừa rồi đã dùng booster thì không mời lại ngay.
    return { id: 'near-miss', shift: lastShift, extraMoves: misses >= 4 ? A.EXTRA_MOVES : 0, suggestBooster: !lastTry.boosters };
  }
  // Sắp bỏ game: thua 4 lần, hoặc chơi lại 5 lần, hoặc thua 3 lần kèm dấu hiệu nản (nghĩ lâu / AFK / đứng lâu ở bảng thua),
  // hoặc 2 lần thua liền cùng dấu hiệu nản, hoặc bỏ ngang sau khi đã thua, hoặc người mong manh thua 2 lần liền.
  const tilted = a => idleUp(a) || a.dwellMs > A.DWELL_MS;
  const frustrated = loseStreak >= 4 || retries >= 5
    || (loseStreak >= 3 && tilted(lastTry))
    || (two.length === 2 && two.every(a => !a.win && idleUp(a) && a.dwellMs > A.DWELL_MS))
    || (lastTry?.reason === 'quit' && loseStreak >= 2)
    || (fragile && loseStreak >= 2);
  if (frustrated) return { id: 'frustrated', target: 1, free: true };
  const losses = Math.max(loseStreak, retries);
  if (losses >= 2 || (fragile && losses >= 1)) return { id: 'struggling', shift: -Math.max(1, Math.min(2, losses - 1)) };
  // Vừa thắng lại sau chuỗi thua: giữ mức nới thêm một màn rồi mới về bản gốc.
  if (winStreak === 1 && lastShift < 0) return { id: 'struggling', shift: lastShift };
  const heat = hot();
  if (heat) return heat;
  // Cao thủ thua một lần: giữ +1, chưa hạ hẳn.
  if (loseStreak === 1 && lastShift > 0) return { id: 'skilled', shift: Math.min(1, lastShift), noMoves: thinker };
  return { id: thinker ? 'thinker' : 'steady', shift: 0, noMoves: thinker };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = x => Math.round(x * 10) / 10;

// Chỉnh bộ chia thẻ theo lý do thua khi chơi lại một màn, và siết nhẹ với cao thủ.
//   stuck: số lần thua vì hết chỗ · moves: số lần thua vì hết lượt (cùng màn, liên tiếp tới giờ)
// Game thắng theo điểm nên thẻ TO dễ hơn (mỗi lượt đặt nhiều mèo hơn) và thẻ đơn khó hơn. Đo bằng bot (tools/bot.mjs):
//   thêm thẻ đôi: người yếu thắng 30% -> 37%, không kẹt thêm · thêm thẻ 3 ô + assist: 30% -> 43%
//   thêm thẻ nhỏ (đơn): kẹt ít hơn nhưng thắng còn 16%, nên KHÔNG dùng để chữa hết chỗ
//   thêm thẻ đơn + bớt assist: cao thủ 70% -> 60%
// Trả về { level (có shapes/assist mới nếu đổi), deal (mô tả ngắn để QA, null nếu giữ nguyên) }.
export function tuneDealer(level, { stuck = 0, moves = 0, skilled = false } = {}) {
  const crowded = [...level.board.join('')].filter(ch => ch === 'X' || ch === 'M').length >= A.CROWDED_BLOCKS;
  const shapes = { ...DEFAULT_SHAPES, ...level.shapes }, baseAssist = level.assist ?? DEFAULT_ASSIST;
  let assist = baseAssist;
  const notes = [];
  if (stuck >= A.STUCK_AFTER) {
    // Hết chỗ: thêm thẻ đôi (gọn mà vẫn đủ điểm), mỗi lần thua thêm +2, tối đa 2 mức.
    const k = Math.min(2, stuck - A.STUCK_AFTER + 1);
    shapes.domino += 2 * k;
    notes.push(`domino+${2 * k}`);
  }
  if (moves >= A.MOVES_AFTER) {
    // Hết lượt: thêm thẻ to và thẻ trùng màu mèo trên bàn, mỗi lượt ghi được nhiều điểm hơn. Màn chật thì thẻ 3 ô
    // dễ làm kẹt (bot yếu: kẹt 14% -> 21%), nên dùng thẻ đôi: thắng gần bằng (30% so với 31%) mà kẹt 12%.
    assist = Math.min(A.ASSIST_MAX, baseAssist + A.ASSIST_STEP * (moves - A.MOVES_AFTER + 1));
    if (crowded) { shapes.domino += 2; notes.push('domino+2'); } else { shapes.triple += 1; notes.push('triple+1'); }
  }
  if (skilled && !stuck && !moves) {
    assist = Math.max(A.ASSIST_MIN, baseAssist - A.ASSIST_STEP);
    shapes.single += 1;
    notes.push('single+1');
  }
  assist = round1(assist);
  if (assist !== round1(baseAssist)) notes.push(`assist ${round1(baseAssist)}→${assist}`);
  if (!notes.length) return { level, deal: null };
  return { level: { ...level, shapes, assist }, deal: notes.join(' ') };
}

// ---------- Bố trí crate/wall theo profile ----------
// Mức: '-2' thoáng · '-1' nhẹ · '0' bản gốc · '0b' đổi chỗ (giữ số lượng) · '+1' hiểm · '+2' rất hiểm.
const LAYOUT_KEYS = ['crate', 'wall', 'board'];
const LAYOUT_STEP = { '-2': -2, '-1': -1, 0: 0, '0': 0, '0b': 0, '+1': 1, '+2': 2 };
const layoutOf = step => ({ '-2': '-2', '-1': '-1', 0: '0', 1: '+1', 2: '+2' }[step]);
export function pickLayout(profile, levelIndex, p) {
  const name = LEVELS[levelIndex].name, has = tier => tier === '0' || !!LAYOUTS[name]?.[tier];
  const recent = profile.attempts.slice(profile.streakFrom), lastTry = recent.at(-1);
  // Thua sát nút: giữ đúng bố trí của lần vừa chơi ở màn này để người chơi thử lại đúng bàn đó.
  if (p.id === 'near-miss' && lastTry?.level === levelIndex && has(lastTry.layout ?? '0')) return lastTry.layout ?? '0';
  let want = { frustrated: -2, struggling: -1, returning: -1, skilled: p.shift >= 2 ? 2 : 1 }[p.id] ?? 0;
  if (p.id === 'bored') return has('0b') && lastTry?.layout !== '0b' ? '0b' : has('+1') ? '+1' : '0';
  if (profile.cooldown > 0) want = Math.min(want, 0);
  // Mỗi lần chỉ dịch một mức so với lần thử trước (trừ khi sắp bỏ game).
  const last = LAYOUT_STEP[lastTry?.layout ?? '0'] ?? 0;
  if (p.id !== 'frustrated') want = Math.max(last - 1, Math.min(last + 1, want));
  // Không có bản cho mức đó thì lùi dần về bản gốc.
  while (want !== 0 && !has(layoutOf(want))) want -= Math.sign(want);
  return layoutOf(want);
}

// Bố trí sinh sẵn (level-layouts.mjs) có trước khi có chuồng mèo: chép chuồng của bản gốc sang những ô còn trống của
// bản sinh sẵn. Bản nhẹ / thoáng ('-1', '-2') bỏ chuồng cho dễ hơn.
function withCages(rows, baseRows, layout) {
  if (layout === '-1' || layout === '-2' || rows.length !== baseRows.length || rows[0].length !== baseRows[0].length) return rows;
  return rows.map((row, r) => [...row].map((ch, c) => (ch === '.' && /[a-z]/.test(baseRows[r][c]) ? baseRows[r][c] : ch)).join(''));
}

// Bản màn cho lần vào màn kế tiếp. `level` là dữ liệu màn đã chỉnh, đưa thẳng vào createSession.
export function planLevel(profile, levelIndex) {
  const base = LEVELS[levelIndex], baseCount = elementCount(base);
  if (!isAdaptive(base)) {
    return { level: base, profile: 'tutorial', shift: 0, baseCount, count: baseCount, difficulty: difficultyOf(baseCount) };
  }
  const p = detectProfile(profile, levelIndex);
  const lastShift = profile.attempts.slice(profile.streakFrom).at(-1)?.shift ?? 0;
  // Mỗi lần thử chỉ đổi tối đa 1 element so với lần trước (trừ các profile `free`).
  const shift = p.free ? p.shift ?? 0 : clamp(p.shift, lastShift - 1, lastShift + 1);
  let target = clamp(p.target ?? baseCount + shift, 0, MAX_ELEMENTS);
  if (profile.cooldown > 0) target = Math.min(target, 2);
  if (base.tier === 'boss') target = Math.max(target, 2); // boss không xuống dưới Medium
  // Bố trí crate/wall sinh sẵn (level-layouts.mjs) theo profile: có bản cho mức đó thì dùng, và khi ấy số lượng / vị trí
  // vật cản và hình bàn do bản sinh sẵn quyết định; buildVariant chỉ còn chỉnh lượt và màu.
  // Hạ hẳn về Easy thì giữ luật "màn dễ là 6×6 gọn không vật cản" của buildVariant, không dùng bố trí sinh sẵn.
  const layout = target <= 1 ? '0' : pickLayout(profile, levelIndex, p);
  const fromLayout = layout !== '0' ? { ...base, board: withCages(LAYOUTS[base.name][layout], base.board, layout) } : base;
  let level = buildVariant(fromLayout, target, layout !== '0' ? { ...p, keep: LAYOUT_KEYS } : p);
  if (p.extraMoves) level = { ...level, moves: level.moves + p.extraMoves };
  // Lý do các lần thua liên tiếp ở chính màn này (bỏ ngang không tính vào lý do nào).
  const losses = { stuck: 0, moves: 0 };
  const recent = profile.attempts.slice(profile.streakFrom);
  for (let i = recent.length - 1; i >= 0 && recent[i].level === levelIndex && !recent[i].win; i--) {
    if (recent[i].reason in losses) losses[recent[i].reason]++;
  }
  // Thua sát nút: giữ nguyên cả bộ thẻ (luật sát nút giữ độ khó và mời booster), tới lần thứ 4 mới nới bằng +lượt.
  const keepDeal = p.id === 'near-miss' && !p.extraMoves;
  const tuned = keepDeal ? { level, deal: null } : tuneDealer(level, { ...losses, skilled: p.id === 'skilled' });
  level = tuned.level;
  const count = elementCount(level);
  return { level, profile: p.id, shift: target - baseCount, mode: p.swap ? 'swap' : null, layout, deal: tuned.deal, suggestBooster: !!p.suggestBooster, baseCount, count, difficulty: difficultyOf(count) };
}

// Ghi một lần thử. `attempt` gồm metric lần chơi + { profile, shift, mode } của plan đã dùng.
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
