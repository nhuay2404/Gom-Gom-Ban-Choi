// Sinh thêm màn cho game (chạy một lần, rồi chép thẳng vào game/gameplay/levels.mjs như màn 21–50).
// Chạy: node tools/generate-levels.mjs [từ màn] [tới màn]   (mặc định 51 100)
//
// Theo nhịp tier của levels.mjs: mỗi chương 10 màn — x1–x4 normal · x5 hard · x6 chill (nghỉ) · x7–x9 normal · x0 boss.
// Nhãn độ khó (element, adaptive.mjs) tăng theo tier: normal 1–2 cơ chế, hard 3, boss đủ 4 (thùng, kim loại, chuồng, cỏ), nghỉ 0–1.
// Bố trí: hình bàn có sẵn (board-shapes.mjs), mèo đặt theo cặp / lẻ không tạo cụm gom sẵn, cỏ mọc thành từng mảng.
// Số liệu do bot giỏi (tools/bot.mjs, noise 1) định: màn thường tìm mục tiêu điểm, màn cỏ tìm số lượt, sao cho tỉ lệ thắng
// đúng chuẩn tier (cùng bảng với Level Editor): normal 95% -> 70% trong chương · hard ~33% · nghỉ 96% · boss ~22%.
// Cùng tham số luôn ra cùng màn (seed theo số màn).
import { readFileSync, writeFileSync } from 'node:fs';
import { parseBoard, LETTERS } from '../game/gameplay/levels.mjs';
import { SHAPES } from '../game/gameplay/board-shapes.mjs';
import { clearMatches } from '../game/gameplay/board-rules.mjs';
import { MATCH_SIZE } from '../game/gameplay/scoring.mjs';
import { play, mulberry32 } from './bot.mjs';

const FROM = Number(process.argv[2] ?? 51), TO = Number(process.argv[3] ?? 100);
const FILE = new URL('../game/gameplay/levels.mjs', import.meta.url);
const RUNS = 120;

const TIERS = ['normal', 'normal', 'normal', 'normal', 'hard', 'chill', 'normal', 'normal', 'normal', 'boss'];
// Chủ đề tên màn theo chương (chương 6 = màn 51–60 ...).
const THEMES = {
  6: { title: 'Attic', words: ['Dusty Trunk', 'Old Lamp', 'Hat Box', 'Rafters', 'Secret Map', 'Sunny Window', 'Toy Chest', 'Rocking Horse', 'Cobweb Corner', 'Attic Fortress'] },
  7: { title: 'Balcony', words: ['Flower Pots', 'Wind Chime', 'Clothesline', 'Rain Drops', 'Tall Railing', 'Sun Lounger', 'Bird Feeder', 'Ivy Wall', 'Night Breeze', 'Balcony Fortress'] },
  8: { title: 'Bathroom', words: ['Bubble Bath', 'Rubber Duck', 'Towel Rack', 'Soap Slide', 'Steamy Mirror', 'Fluffy Mat', 'Tile Puzzle', 'Drip Drop', 'Shower Curtain', 'Bathroom Fortress'] },
  9: { title: 'Rooftop', words: ['Chimney Pots', 'Weather Vane', 'Roof Tiles', 'Pigeon Post', 'Gutter Run', 'Sunset Nap', 'Antenna Maze', 'Skylight', 'Starry Gable', 'Rooftop Fortress'] },
  10: { title: 'Moon Garden', words: ['Moon Path', 'Glow Worms', 'Night Blooms', 'Lantern Row', 'Owl Watch', 'Dream Meadow', 'Firefly Field', 'Midnight Maze', 'Comet Trail', 'Moon Fortress'] },
};
const SHAPE_POOL = { normal: ['plain6', 'square7', 'octagon', 'diamond', 'hexagon', 'triangle', 'heart'], hard: ['square7', 'hexagon', 'heart', 'cross', 'octagon'], chill: ['plain6', 'heart', 'diamond', 'octagon'], boss: ['cross', 'ring', 'square8'] };
const MECHS = ['crate', 'metal', 'cage', 'grass'];

// Tỉ lệ thắng chuẩn của bot giỏi theo tier (cùng công thức tools/level-editor/editor.mjs tierGoal, chương sau khó hơn chút).
function tierGoal(tier, index) {
  const chapter = Math.floor(index / 10) + 1, pos = index % 10, later = Math.max(0, chapter - 5) * 0.01;
  if (tier === 'chill') return 0.96;
  if (tier === 'hard') return 0.33 - later;
  if (tier === 'boss') return 0.22 - later;
  return 0.95 - 0.25 * Math.min(1, pos / 9);
}

function pickMechs(tier, pos, rng) {
  const count = { normal: pos <= 1 ? 1 : 2 + (pos >= 7 && rng() < 0.4 ? 1 : 0), hard: 3, chill: rng() < 0.5 ? 1 : 0, boss: 4 }[tier];
  const pool = tier === 'chill' ? ['grass', 'crate'] : MECHS.slice();
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
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
  if (mechs.includes('metal')) {
    // Kim loại thành vài đoạn tường ngắn (2 ô), không bịt kín vùng nào.
    for (let w = 0; w < Math.round(2 * heavy); w++) {
      const a = pick(free()), b = neighbors(a, W, H).find(j => cells[j] === '.');
      cells[a] = 'M';
      if (b !== undefined) cells[b] = 'M';
    }
  }
  if (mechs.includes('crate')) for (let k = Math.round(playable / 10 * heavy); k > 0; k--) cells[pick(free())] = 'X';
  // Mèo: khoảng 30% ô, đặt theo cặp cùng màu (một nửa) và lẻ; không được tạo cụm 3.
  const want = Math.round(playable * (tier === 'chill' ? 0.26 : 0.3));
  let placed = 0, guard = 0;
  while (placed < want && guard++ < 400) {
    const a = pick(free()), cat = cats[Math.floor(rng() * cats.length)];
    const b = rng() < 0.5 ? neighbors(a, W, H).find(j => cells[j] === '.') : undefined;
    const trial = cells.slice();
    trial[a] = cat;
    if (b !== undefined) trial[b] = cat;
    const asRows = Array.from({ length: H }, (_, r) => trial.slice(r * W, r * W + W).join(''));
    if (clearMatches(parseBoard(asRows), W, H, MATCH_SIZE).cleared.length) continue;
    trial.forEach((ch, i) => { cells[i] = ch; });
    placed += b !== undefined ? 2 : 1;
  }
  if (mechs.includes('cage')) {
    const catCells = cells.map((ch, i) => (LETTERS[ch] ? i : -1)).filter(i => i >= 0);
    for (let k = tier === 'boss' ? 3 : 2; k > 0 && catCells.length; k--) {
      const i = catCells.splice(Math.floor(rng() * catCells.length), 1)[0];
      cells[i] = cells[i].toLowerCase();
    }
  }
  const board = Array.from({ length: H }, (_, r) => cells.slice(r * W, r * W + W).join(''));
  let grass = null;
  if (mechs.includes('grass')) {
    // Cỏ mọc thành 2–4 mảng từ một ô hạt giống, trên ô trống và dưới mèo (không dưới vật cản / ô ngoài bàn).
    const g = Array(W * H).fill('.'), okCell = i => cells[i] === '.' || LETTERS[cells[i].toUpperCase()];
    const target = Math.round(playable * { normal: 0.22, hard: 0.3, boss: 0.32, chill: 0.16 }[tier]);
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
  if (clearMatches(parseBoard(board), W, H, MATCH_SIZE).cleared.length) return null;
  if (cells.filter(ch => ch === '.').length < playable * 0.4) return null;
  return { board, grass };
}

const winRate = (level, index) => {
  let wins = 0;
  for (let r = 0; r < RUNS; r++) if (play(level, (index + 1) * 100000 + r, { noise: 1, hold: true }).win) wins++;
  return wins / RUNS;
};
// Màn thường: tìm nhị phân mục tiêu điểm (bội số 10). Màn cỏ: số lượt nhỏ nhất đạt chuẩn (mục tiêu = cỏ, không theo điểm).
function calibrate(level, index, goal) {
  if (level.grass) {
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
    const rng = mulberry32(n * 7919 + attempt * 104729), tryMechs = pickMechs(tier, pos, rng);
    let built = null;
    for (let tries = 0; !built && tries < 200; tries++) built = buildBoard(SHAPE_POOL[tier][Math.floor(rng() * SHAPE_POOL[tier].length)], tryMechs, [...cats], tier, rng);
    if (!built) continue;
    const feature = tryMechs.length ? tryMechs.map(m => ({ crate: 'crates', metal: 'metal', cage: 'cages', grass: 'grass' }[m])).join(' + ') : 'take a breather';
    const tried = calibrate({ name: theme.words[pos - 1], feature, tier, moves, target: moves * 18, cats, assist, board: built.board, ...(built.grass ? { grass: built.grass } : {}), deck: [] }, index, goal);
    if (!level || Math.abs(tried.rate - goal) < Math.abs(level.rate - goal)) { level = tried; mechs = tryMechs; }
    if (Math.abs(tried.rate - goal) <= 0.08 && (!tried.grass || tried.moves <= 36)) break;
  }
  if (!level) throw new Error(`Màn ${n}: không dựng được bàn`);
  console.log(`${n}. ${level.name.padEnd(18)} ${tier.padEnd(6)} ${mechs.join('+').padEnd(24)} ${level.grass ? `${level.moves} lượt (cỏ)` : `${level.target} điểm / ${level.moves} lượt`}  bot ${Math.round(level.rate * 100)}% (chuẩn ${Math.round(tierGoal(tier, index) * 100)}%)`);
  const head = pos === 1 ? [`  // ===== Chương ${chapter}: ${theme.title} (màn ${n}–${n + 9}) — sinh bằng tools/generate-levels.mjs, số liệu do bot định =====`] : [];
  blocks.push([...head,
    '  {',
    `    name: ${q(level.name)}, feature: ${q(level.feature)}, tier: ${q(tier)},`,
    `    moves: ${level.moves}, target: ${level.target}, cats: ${q(cats)}, assist: ${assist},`,
    `    board: [${level.board.map(q).join(', ')}],`,
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
console.log(`\nĐã thêm ${blocks.length} màn (${FROM}–${TO}) vào game/gameplay/levels.mjs`);
