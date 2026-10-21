// Sinh thêm màn cho game (chạy một lần, rồi chép thẳng vào game/data/levels.mjs như màn 21–50).
// Chạy: node tools/levels/generate-levels.mjs [từ màn] [tới màn]   (mặc định 51 100)
//
// Theo nhịp tier của levels.mjs: mỗi chương 10 màn — x1–x4 normal · x5 hard · x6 chill (nghỉ) · x7–x9 normal · x0 boss.
// Mỗi cơ chế (thùng, kim loại, chuồng, cỏ, mèo béo, hộp thư, bình hoa, siro dâu) là một lớp độ khó; số lớp chồng lên tăng theo tier và
// theo chương (layerCount). Lớp chính của chương (vừa giới thiệu ở boss chương trước): chương 4 mèo béo (màn 31), chương 7 hộp thư (màn 60),
// chương 8 bình hoa (màn 70), chương 9 siro dâu (màn 80) — mọi màn có lớp thì có lớp chính.
// Mục tiêu (cỏ, chuồng, mèo béo, thư, bình, siro) tối đa 3 loại mỗi màn (ô Goal chỉ có 3 ô). Số lượng mỗi mục tiêu co giãn theo số loại
// mục tiêu của màn (GOAL_SCALE): 1 loại thì nhiều hơn, 3 loại thì mỗi loại ít đi để màn không quá nặng.
// Bố trí: hình bàn có sẵn (board-shapes.mjs), mèo đặt theo cặp / lẻ không tạo cụm gom sẵn, cỏ mọc thành từng mảng.
// Số liệu do bot giỏi (tools/levels/bot.mjs, noise 1) định: màn thường tìm mục tiêu điểm, màn cỏ tìm số lượt, sao cho tỉ lệ thắng
// đúng chuẩn tier (cùng bảng với Level Editor): normal 95% -> 70% trong chương · hard ~33% · nghỉ 96% · boss ~22%.
// Cùng tham số luôn ra cùng màn (seed theo số màn).
import { readFileSync, writeFileSync } from 'node:fs';
import { LETTERS } from '../../game/data/levels.mjs';
import { parseBoard } from '../../game/core/level-rules.mjs';
import { SHAPES } from '../../game/core/board-shapes.mjs';
import { clearMatches, matchesSomewhere } from '../../game/core/board-rules.mjs';
import { parseGrass } from '../../game/core/level-rules.mjs';
import { MATCH_SIZE } from '../../game/core/scoring.mjs';
import { play, mulberry32 } from './bot.mjs';

const FROM = Number(process.argv[2] ?? 51), TO = Number(process.argv[3] ?? 100);
const FILE = new URL('../../game/data/levels.mjs', import.meta.url);
const RUNS = 120;

const TIERS = ['normal', 'normal', 'normal', 'normal', 'hard', 'chill', 'normal', 'normal', 'normal', 'boss'];
// Chủ đề tên màn theo chương (chương 6 = màn 51–60 ...).
const THEMES = {
  4: { title: 'Bedroom', words: ['Sleepy Giant', 'Blanket Fold', 'Night Lights', 'Dream Cages', 'Moonlit Maze', 'Nap Time', 'Toy Pile', 'Wardrobe', 'Last Gate', 'Bedroom Fortress'] },
  5: { title: 'Kitchen', words: ['Kitchen Door', 'Cookie Tray', 'Fish Bowl', 'Pantry', 'Fridge Lock', 'Milk Break', 'Spice Rack', 'Oven Grill', 'Sink Divide', 'Kitchen Fortress'] },
  6: { title: 'Attic', words: ['Dusty Trunk', 'Old Lamp', 'Hat Box', 'Rafters', 'Secret Map', 'Sunny Window', 'Toy Chest', 'Rocking Horse', 'Cobweb Corner', 'Attic Fortress'] },
  7: { title: 'Balcony', words: ['Flower Pots', 'Wind Chime', 'Clothesline', 'Rain Drops', 'Tall Railing', 'Sun Lounger', 'Bird Feeder', 'Ivy Wall', 'Night Breeze', 'Balcony Fortress'] },
  8: { title: 'Bathroom', words: ['Bubble Bath', 'Rubber Duck', 'Towel Rack', 'Soap Slide', 'Steamy Mirror', 'Fluffy Mat', 'Tile Puzzle', 'Drip Drop', 'Shower Curtain', 'Bathroom Fortress'] },
  9: { title: 'Rooftop', words: ['Chimney Pots', 'Weather Vane', 'Roof Tiles', 'Pigeon Post', 'Gutter Run', 'Sunset Nap', 'Antenna Maze', 'Skylight', 'Starry Gable', 'Rooftop Fortress'] },
  10: { title: 'Moon Garden', words: ['Moon Path', 'Glow Worms', 'Night Blooms', 'Lantern Row', 'Owl Watch', 'Dream Meadow', 'Firefly Field', 'Midnight Maze', 'Comet Trail', 'Moon Fortress'] },
};
const SHAPE_POOL = { normal: ['plain6', 'square7', 'octagon', 'diamond', 'hexagon', 'triangle', 'heart'], hard: ['square7', 'hexagon', 'heart', 'cross', 'octagon'], chill: ['plain6', 'heart', 'diamond', 'octagon'], boss: ['cross', 'ring', 'square8'] };
const MECHS = ['crate', 'metal', 'cage', 'grass', 'fat'];
// Cơ chế mới mở theo chương (màn giới thiệu là boss chương trước) và lớp chính của chương.
const LATER_MECHS = { mail: 7, vase: 8, syrup: 9 };
const MAIN_MECH = { 4: 'fat', 7: 'mail', 8: 'vase', 9: 'syrup' };
const GOALS = ['cage', 'grass', 'fat', 'mail', 'vase', 'syrup'], MAX_GOALS = 3;
// Hệ số số lượng mỗi mục tiêu theo số loại mục tiêu của màn.
const GOAL_SCALE = { 0: 1, 1: 1.35, 2: 1, 3: 0.7 };

// Tỉ lệ thắng chuẩn của bot giỏi theo tier (cùng công thức tools/levels/level-editor/editor.mjs tierGoal, chương sau khó hơn chút).
function tierGoal(tier, index) {
  const chapter = Math.floor(index / 10) + 1, pos = index % 10, later = Math.max(0, chapter - 5) * 0.01;
  if (tier === 'chill') return 0.96;
  if (tier === 'hard') return 0.33 - later;
  if (tier === 'boss') return 0.22 - later;
  return 0.95 - 0.25 * Math.min(1, pos / 9);
}

// Số lớp: nghỉ 0–1 · normal x1–x2: 1, x3–x4: 2, x7–x9: 2–3 (chương 7+: 3) · hard 3 (chương 7+: 4) · boss 4 (chương 6+: đủ 5).
function layerCount(tier, pos, chapter, rng) {
  if (tier === 'chill') return rng() < 0.5 ? 1 : 0;
  if (tier === 'hard') return chapter >= 7 ? 4 : 3;
  if (tier === 'boss') return chapter >= 6 ? 5 : 4;
  if (pos <= 2) return 1;
  if (pos <= 4) return 2;
  return chapter >= 7 || rng() < 0.5 ? 3 : 2;
}
function pickMechs(tier, pos, chapter, rng) {
  const count = layerCount(tier, pos, chapter, rng), main = MAIN_MECH[chapter];
  const later = Object.keys(LATER_MECHS).filter(m => chapter >= LATER_MECHS[m]);
  const pool = tier === 'chill' ? ['grass', 'crate', 'fat', ...(later.includes(main) ? [main] : [])] : [...MECHS, ...later];
  const out = main && count ? pool.splice(pool.indexOf(main), 1) : [];
  while (out.length < count && pool.length) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (!GOALS.includes(m) || out.filter(o => GOALS.includes(o)).length < MAX_GOALS) out.push(m);
  }
  return out;
}

const shapeRows = name => (name === 'plain6' ? Array(6).fill('......') : SHAPES[name].slice());
const neighbors = (i, W, H) => [i - W, i + W, i % W ? i - 1 : -1, i % W < W - 1 ? i + 1 : -1].filter(j => j >= 0 && j < W * H);

// Bàn + lớp cỏ cho một màn. Trả về null nếu lần thử này không ra bàn hợp lệ (gọi lại với rng khác).
function buildBoard(shape, mechs, cats, tier, rng) {
  const rows = shapeRows(shape), W = rows[0].length, H = rows.length, cells = [...rows.join('')];
  const free = () => cells.map((ch, i) => (ch === '.' ? i : -1)).filter(i => i >= 0);
  const pick = list => list[Math.floor(rng() * list.length)];
  const playable = cells.filter(ch => ch !== '#').length;
  const heavy = { normal: 1, hard: 1.3, boss: 1.4, chill: 0.6 }[tier];
  const scale = GOAL_SCALE[mechs.filter(m => GOALS.includes(m)).length];
  const amount = (base, min = 1) => Math.max(min, Math.round(base * scale));
  const syrup = new Set();
  const rowsOf = list => Array.from({ length: H }, (_, r) => list.slice(r * W, r * W + W).join(''));
  const syrupRows = () => (syrup.size ? rowsOf(cells.map((_, i) => (syrup.has(i) ? '~' : '.'))) : undefined);
  const hasMatch = list => clearMatches(parseBoard(rowsOf(list), syrupRows()), W, H, MATCH_SIZE).cleared.length > 0;
  if (mechs.includes('fat')) {
    // Mèo béo: khối 2×2 trên ô trống, không sát mèo béo khác (hai khối chữ số liền nhau đọc sai). Số = lần phải đánh thức.
    const wakes = Math.min(5, amount({ chill: 2, normal: 3, hard: 3, boss: 4 }[tier]));
    for (let k = { chill: 1, normal: 1, hard: rng() < 0.5 ? 2 : 1, boss: 2 }[tier]; k > 0; k--) {
      const block = i => [i, i + 1, i + W, i + W + 1];
      const spots = free().filter(i => i % W < W - 1 && block(i).every(j => cells[j] === '.')
        && block(i).every(j => neighbors(j, W, H).every(n => !/[1-9]/.test(cells[n]))));
      if (!spots.length) return null;
      block(pick(spots)).forEach(j => { cells[j] = String(wakes); });
    }
  }
  if (mechs.includes('metal')) {
    // Kim loại thành vài đoạn tường ngắn (2 ô), không bịt kín vùng nào.
    for (let w = 0; w < Math.round(2 * heavy); w++) {
      const a = pick(free()), b = neighbors(a, W, H).find(j => cells[j] === '.');
      cells[a] = 'M';
      if (b !== undefined) cells[b] = 'M';
    }
  }
  if (mechs.includes('crate')) for (let k = Math.round(playable / 10 * heavy); k > 0; k--) cells[pick(free())] = 'X';
  // Hộp thư: vài hộp trên ô trống còn ≥ 2 ô trống kề (gom sát được từ nhiều phía); số thư phải gom co giãn theo số loại mục tiêu.
  let mail = 0;
  if (mechs.includes('mail')) {
    for (let k = { chill: 2, normal: 3, hard: 3, boss: 3 }[tier]; k > 0; k--) {
      const spots = free().filter(i => neighbors(i, W, H).filter(j => cells[j] === '.').length >= 2 && neighbors(i, W, H).every(j => cells[j] !== '@'));
      if (!spots.length) return null;
      cells[pick(spots)] = '@';
    }
    mail = amount({ chill: 3, normal: 4, hard: 6, boss: 7 }[tier], 3);
  }
  // Bình hoa: rải trên ô trống còn ô trống kề, không sát nhau.
  if (mechs.includes('vase')) {
    for (let k = amount({ chill: 2, normal: 3, hard: 4, boss: 5 }[tier]); k > 0; k--) {
      const spots = free().filter(i => neighbors(i, W, H).some(j => cells[j] === '.') && neighbors(i, W, H).every(j => cells[j] !== '%'));
      if (!spots.length) return null;
      cells[pick(spots)] = '%';
    }
  }
  // Siro dâu: 1–2 mảng liền (mọc từ ô hạt giống) phủ lên mèo màu ngẫu nhiên (mèo phủ siro không vào cụm nên không lo cụm sẵn).
  if (mechs.includes('syrup')) {
    const want = amount({ chill: 3, normal: 5, hard: 7, boss: 8 }[tier], 3);
    for (let patch = 0; patch < 2 && syrup.size < want; patch++) {
      const seeds = free();
      if (!seeds.length) break;
      const queue = [pick(seeds)];
      let size = patch ? want - syrup.size : Math.ceil(want * (0.5 + rng() * 0.5));
      while (queue.length && size > 0) {
        const i = queue.shift();
        if (cells[i] !== '.') continue;
        cells[i] = cats[Math.floor(rng() * cats.length)]; syrup.add(i); size--;
        neighbors(i, W, H).sort(() => rng() - 0.5).forEach(j => { if (cells[j] === '.') queue.push(j); });
      }
    }
    if (syrup.size < 3) return null;
  }
  // Mèo: khoảng 30% ô, đặt theo cặp cùng màu (một nửa) và lẻ; không được tạo cụm 3.
  // Ô mèo béo và mèo phủ siro tính vào phần mèo.
  const want = Math.round(playable * (tier === 'chill' ? 0.26 : 0.3)) - cells.filter(ch => /[1-9]/.test(ch)).length - syrup.size;
  let placed = 0, guard = 0;
  while (placed < want && guard++ < 400) {
    const a = pick(free()), cat = cats[Math.floor(rng() * cats.length)];
    const b = rng() < 0.5 ? neighbors(a, W, H).find(j => cells[j] === '.') : undefined;
    const trial = cells.slice();
    trial[a] = cat;
    if (b !== undefined) trial[b] = cat;
    if (hasMatch(trial)) continue;
    trial.forEach((ch, i) => { cells[i] = ch; });
    placed += b !== undefined ? 2 : 1;
  }
  if (mechs.includes('cage')) {
    const catCells = cells.map((ch, i) => (LETTERS[ch] && !syrup.has(i) ? i : -1)).filter(i => i >= 0);
    for (let k = amount(tier === 'boss' ? 3 : 2); k > 0 && catCells.length; k--) {
      const i = catCells.splice(Math.floor(rng() * catCells.length), 1)[0];
      cells[i] = cells[i].toLowerCase();
    }
  }
  const board = Array.from({ length: H }, (_, r) => cells.slice(r * W, r * W + W).join(''));
  let grass = null;
  if (mechs.includes('grass')) {
    // Cỏ mọc thành 2–4 mảng từ một ô hạt giống, trên ô trống và dưới mèo (không dưới vật cản / ô ngoài bàn).
    const g = Array(W * H).fill('.'), okCell = i => cells[i] === '.' || LETTERS[cells[i].toUpperCase()];
    const target = Math.round(playable * { normal: 0.22, hard: 0.3, boss: 0.32, chill: 0.16 }[tier] * scale);
    let count = 0;
    for (let patch = 0; patch < 4 && count < target; patch++) {
      const seeds = cells.map((_, i) => i).filter(i => okCell(i) && g[i] === '.');
      if (!seeds.length) break;
      const queue = [pick(seeds)];
      let size = Math.ceil(target / 3);
      while (queue.length && size > 0 && count < target) {
        const i = queue.shift();
        if (g[i] === '~' || !okCell(i)) continue;
        g[i] = '~'; count++; size--;
        neighbors(i, W, H).sort(() => rng() - 0.5).forEach(j => { if (g[j] === '.' && okCell(j)) queue.push(j); });
      }
    }
    if (count < 6) return null;
    grass = Array.from({ length: H }, (_, r) => g.slice(r * W, r * W + W).join(''));
  }
  // Hợp lệ: không có sẵn cụm gom, có mèo sát ô trống, đủ chỗ trống để chơi.
  if (hasMatch(cells)) return null;
  if (cells.filter(ch => ch === '.').length < playable * 0.4) return null;
  // Thẻ đầu phải gom được ngay (session.mjs openingCard đổi tối đa sang thẻ đôi cùng màu): cần một màu mèo tự do mà thẻ đôi gom được.
  const parsed = parseBoard(rowsOf(cells), syrupRows());
  const groups = [...new Set(parsed.filter(c => c?.group && !c.cage).map(c => c.group))];
  if (!groups.some(group => matchesSomewhere(parsed, W, H, { offsets: [[0, 0], [0, 1]], items: [{ group }, { group }] }))) return null;
  return { board, grass, mail, syrup: syrupRows() };
}

const winRate = (level, index) => {
  let wins = 0;
  for (let r = 0; r < RUNS; r++) if (play(level, (index + 1) * 100000 + r, { noise: 1, hold: true }).win) wins++;
  return wins / RUNS;
};
// Màn thường: tìm nhị phân mục tiêu điểm (bội số 10). Màn cỏ / thư / bình / siro: số lượt nhỏ nhất đạt chuẩn (mục tiêu chính là dọn
// các thứ đó, không theo điểm).
function calibrate(level, index, goal) {
  if (level.grass || level.mail || level.syrup || level.board.join('').includes('%')) {
    let best = null;
    for (let moves = 10; moves <= 45; moves++) {
      const rate = winRate({ ...level, moves }, index);
      if (!best || Math.abs(rate - goal) < Math.abs(best.rate - goal)) best = { moves, rate };
      if (rate >= goal) break;
    }
    return { ...level, moves: best.moves, target: best.moves * 15, rate: best.rate };
  }
  let lo = 2, hi = level.moves * 6, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, rate = winRate({ ...level, target: mid * 10 }, index);
    if (!best || Math.abs(rate - goal) < Math.abs(best.rate - goal)) best = { target: mid * 10, rate };
    if (rate > goal) lo = mid + 1; else hi = mid - 1;
  }
  return { ...level, target: best.target, rate: best.rate };
}

const q = s => `'${s.replace(/'/g, "\\'")}'`;
const blocks = [];
for (let n = FROM; n <= TO; n++) {
  const index = n - 1, chapter = Math.floor(index / 10) + 1, pos = index % 10 + 1, tier = TIERS[pos - 1];
  const theme = THEMES[chapter], goal = tierGoal(tier, index);
  const cats = tier === 'chill' ? 'OGWTS' : 'OGWTSK';
  const moves = { normal: 16 + Math.floor(pos / 3), hard: 20, chill: 15, boss: 22 }[tier];
  const assist = { normal: 0.4, hard: 0.35, chill: 0.45, boss: 0.35 }[tier];
  // Thử tối đa 8 bố trí; lấy bố trí đầu tiên mà bot thắng trong ±8 điểm % quanh chuẩn (màn cỏ: không quá 36 lượt).
  // Bố trí xấu (chuồng / cỏ bị vây kín) thì không bao giờ đạt nên tự bị loại.
  let level = null, mechs = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = mulberry32(n * 7919 + attempt * 104729), tryMechs = pickMechs(tier, pos, chapter, rng);
    let built = null;
    for (let tries = 0; !built && tries < 200; tries++) built = buildBoard(SHAPE_POOL[tier][Math.floor(rng() * SHAPE_POOL[tier].length)], tryMechs, [...cats], tier, rng);
    if (!built) continue;
    const feature = tryMechs.length ? tryMechs.map(m => ({ crate: 'crates', metal: 'metal', cage: 'cages', grass: 'grass', fat: 'big cat', mail: 'mailboxes', vase: 'vases', syrup: 'syrup' }[m])).join(' + ') : 'take a breather';
    const extra = { ...(built.mail ? { mail: built.mail } : {}), ...(built.syrup ? { syrup: built.syrup } : {}), ...(built.grass ? { grass: built.grass } : {}) };
    const tried = calibrate({ name: theme.words[pos - 1], feature, tier, moves, target: moves * 18, cats, assist, board: built.board, ...extra, deck: [] }, index, goal);
    if (!level || Math.abs(tried.rate - goal) < Math.abs(level.rate - goal)) { level = tried; mechs = tryMechs; }
    if (Math.abs(tried.rate - goal) <= 0.08 && tried.moves <= 36) break;
  }
  if (!level) throw new Error(`Màn ${n}: không dựng được bàn`);
  const goals = [level.grass && `${parseGrass(level).filter(Boolean).length} cỏ`, level.mail && `${level.mail} thư`, level.syrup && `${level.syrup.join('').split('~').length - 1} siro`,
    level.board.join('').includes('%') && `${level.board.join('').split('%').length - 1} bình`].filter(Boolean).join(', ');
  console.log(`${n}. ${level.name.padEnd(18)} ${tier.padEnd(6)} ${mechs.join('+').padEnd(30)} ${level.target} điểm / ${level.moves} lượt${goals ? ` (${goals})` : ''}  bot ${Math.round(level.rate * 100)}% (chuẩn ${Math.round(tierGoal(tier, index) * 100)}%)`);
  const head = pos === 1 ? [`  // ===== Chương ${chapter}: ${theme.title} (màn ${n}–${n + 9}) — sinh bằng tools/levels/generate-levels.mjs, số liệu do bot định =====`] : [];
  blocks.push([...head,
    '  {',
    `    name: ${q(level.name)}, feature: ${q(level.feature)}, tier: ${q(tier)},`,
    `    moves: ${level.moves}, target: ${level.target}, cats: ${q(cats)}, assist: ${assist},${level.mail ? ` mail: ${level.mail},` : ''}`,
    `    board: [${level.board.map(q).join(', ')}],`,
    ...(level.syrup ? [`    syrup: [${level.syrup.map(q).join(', ')}],`] : []),
    ...(level.grass ? [`    grass: [${level.grass.map(q).join(', ')}],`] : []),
    '    deck: [],',
    '  },'].join('\n'));
}

// Màn đã có (cùng số thứ tự) thì thay khối cũ, giữ dòng tiêu đề chương; màn chưa có thì chèn vào cuối mảng LEVELS.
const text = readFileSync(FILE, 'utf8'), eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/), start = lines.findIndex(l => l.startsWith('export const LEVELS = ['));
const spans = [];
for (let i = start + 1, open = -1; i < lines.length && !lines[i].startsWith('];'); i++) {
  if (lines[i] === '  {') open = i;
  else if (/^  \},?$/.test(lines[i]) && open >= 0) { spans.push([open, i]); open = -1; }
}
const fresh = [];
blocks.forEach((block, k) => { if (!spans[FROM - 1 + k]) fresh.push(block); });
// Thay từ dưới lên để chỉ số dòng phía trên không bị lệch.
for (let k = blocks.length - 1; k >= 0; k--) {
  const span = spans[FROM - 1 + k];
  if (span) lines.splice(span[0], span[1] - span[0] + 1, ...blocks[k].split('\n').filter(l => !l.startsWith('  // ===== Chương')));
}
if (fresh.length) lines.splice(lines.findIndex((l, i) => i > start && l.startsWith('];')), 0, ...fresh.join('\n').split('\n'));
writeFileSync(FILE, lines.join(eol));
console.log(`\nĐã thêm ${blocks.length} màn (${FROM}–${TO}) vào game/data/levels.mjs`);
