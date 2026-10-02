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

const A = ADAPTIVE;
const DAY_MS = 24 * 60 * 60 * 1000;
// Thứ tự thêm giống mèo khi cần nhiều màu hơn (cùng thứ tự game giới thiệu giống mới).
const BREEDS = 'OGWTSK';

// ---------- Element và nhãn độ khó ----------
export const ELEMENTS = ['moves', 'colors', 'crate', 'wall', 'board'];
export function levelElements(level) {
  const cells = level.board.join('');
  return {
    moves: level.target / level.moves >= A.TIGHT_PPM,
    colors: level.cats.length >= A.MANY_COLORS,
    crate: cells.includes('X'),
    wall: cells.includes('M'),
    board: !isPlainSquare(level.board),
  };
}
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
    if ('.XM#'.includes(ch) || cats.includes(ch)) return;
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
};
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
};
// Tắt: ít thấy -> dễ thấy; bàn và wall thường là bản sắc của màn nên tắt sau cùng.
const OFF_ORDER = ['moves', 'colors', 'crate', 'board', 'wall'];
const ON_ORDER = ['moves', 'colors', 'board', 'crate'];

// Bản màn có (gần nhất có thể) `target` element bật.
//   noMoves: không siết lượt khi tăng khó (người suy nghĩ kỹ)
//   swap: đổi loại element, giữ số lượng (tắt một vật cản, bật moves/màu) — cho người chơi chán
export function buildVariant(base, target, { noMoves = false, swap = false } = {}) {
  let level = { ...base };
  const canOn = key => !levelElements(level)[key] && !(noMoves && key === 'moves');
  if (swap) {
    const add = ON_ORDER.find(canOn), drop = ['crate', 'wall'].find(key => levelElements(level)[key]);
    if (add && drop) level = OFF[drop](ON[add](level));
  }
  // Hạ xuống Easy (0–1 element): ra bản cơ bản hoàn toàn — bàn 6×6 gọn, không vật cản, lượt thoải mái, ≤4 giống.
  // Giữ lại 1 element nào cũng lệch: lượt chật / nhiều màu nặng hơn cả vật cản + bàn rộng cộng lại (đo bằng bot),
  // còn giữ vật cản / bàn rộng thì trái với "màn dễ là 6×6 không chướng ngại vật".
  if (target <= 1 && target < elementCount(base)) {
    for (const key of [...OFF_ORDER].reverse()) if (levelElements(level)[key]) level = OFF[key](level);
    return level;
  }
  for (const key of OFF_ORDER) {
    if (elementCount(level) <= target) break;
    if (levelElements(level)[key]) level = OFF[key](level);
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
  let level = buildVariant(base, target, p);
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
  return { level, profile: p.id, shift: target - baseCount, mode: p.swap ? 'swap' : null, deal: tuned.deal, suggestBooster: !!p.suggestBooster, baseCount, count, difficulty: difficultyOf(count) };
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
