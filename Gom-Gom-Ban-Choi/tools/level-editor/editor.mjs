// Level Editor có DDA: sửa màn, xem ngay DDA (adaptive.mjs) sẽ biến màn đó thành gì cho từng kiểu người chơi,
// và chạy bot (tools/bot.mjs, trong Web Worker) để đo tỉ lệ thắng của mọi biến thể. Dùng đúng code game, không chép logic.
// Màn đã sửa lưu ở localStorage của trình duyệt; muốn đưa vào game thì copy khối "Xuất" dán vào game/gameplay/levels.mjs.
import { LEVELS, LETTERS, parseBoard, parseCard, boardSize } from '../../game/gameplay/levels.mjs';
import { levelElements, elementCount, difficultyOf, variantFor, planLevel, SHIFT_MIN, SHIFT_MAX, layoutEase, isAdaptive, ELEMENTS, MAX_ELEMENTS } from '../../game/gameplay/adaptive.mjs';
import { clearMatches } from '../../game/gameplay/board-rules.mjs';
import { MATCH_SIZE } from '../../game/gameplay/scoring.mjs';
import { holdUnlocked, ADAPTIVE } from '../../game/gameplay/tuning.mjs';
import { playableCells } from '../../game/gameplay/board-shapes.mjs';

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const STORE = 'gomgom-editor-levels';
const ORIGINAL = LEVELS.map(clone);
const baseline = await fetch('../baseline.json').then(r => r.json()).catch(() => ({ levels: [] }));
const baselineWin = n => baseline.levels.find(row => row.level === n)?.winRate;

const COLORS = { O: '#f3a35a', G: '#9aa0a6', W: '#ffffff', K: '#33302c', S: '#ead9bd', T: '#c98d4f' };
// '~' / '≈' là cọ của lớp cỏ (level.grass): vẽ / xoá cỏ, không đổi ô của bàn.
const BRUSHES = ['.', '#', 'X', 'M', ...Object.keys(LETTERS), '~', '≈'];
const BRUSH_LABEL = { '.': 'Trống', '#': 'Ngoài bàn', X: 'Thùng gỗ', M: 'Kim loại', '~': 'Cỏ (lớp dưới mèo)', '≈': 'Xoá cỏ' };
const NOISES = [{ noise: 1, label: 'Bot giỏi' }, { noise: 30, label: 'Trung bình' }, { noise: 90, label: 'Người yếu' }];
const ELEMENT_LABEL = { moves: 'Lượt chật', colors: 'Nhiều màu', crate: 'Thùng gỗ', wall: 'Kim loại', board: 'Bàn rộng/hình', cage: 'Chuồng', grass: 'Cỏ' };

let edits = {};
try { edits = JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch { edits = {}; }
for (const [i, level] of Object.entries(edits)) LEVELS[i] = level;

let current = 0, brush = 'O', painting = false, botRun = 0, lastBot = null;
const level = () => LEVELS[current];

function save() {
  const dirty = JSON.stringify(level()) !== JSON.stringify(ORIGINAL[current]);
  if (dirty) edits[current] = level(); else delete edits[current];
  persist();
}
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(edits)); } catch { /* chế độ riêng tư: chỉ giữ trong phiên */ }
}

// ---------- Lưu vào game (POST /api/save-level -> tools/level-save.mjs ghi game/gameplay/levels.mjs) ----------
const saveTimers = {};
function scheduleSave(index) {
  if (!$('autoSave').checked) return;
  clearTimeout(saveTimers[index]);
  saveTimers[index] = setTimeout(() => saveToGame(index), 900);
}
async function saveToGame(index) {
  const l = LEVELS[index];
  if (!edits[index]) { $('saveStatus').textContent = `Màn ${index + 1} không có gì mới để lưu`; return; }
  const problems = issues(l);
  if (problems.length) { $('saveStatus').innerHTML = `<span class="warn">Chưa lưu màn ${index + 1}: ${problems[0]}</span>`; return; }
  const keepTutorial = JSON.stringify(l.tutorial) === JSON.stringify(ORIGINAL[index].tutorial);
  $('saveStatus').textContent = `Đang lưu màn ${index + 1}…`;
  try {
    const res = await fetch('/api/save-level', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ index, code: toCode(l), keepTutorial }) });
    const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!out.ok) throw new Error(out.error);
    // Đã lưu: bản này thành bản gốc mới (chỉ xoá khỏi danh sách chưa lưu nếu không bị sửa tiếp trong lúc gửi).
    ORIGINAL[index] = clone(l);
    if (LEVELS[index] === l) delete edits[index];
    persist();
    renderList();
    renderStatus();
    $('saveStatus').innerHTML = `<span class="ok">✓ Đã lưu màn ${index + 1} vào levels.mjs</span> · ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    $('saveStatus').innerHTML = `<span class="warn">Không lưu được: ${error.message}. Mở editor qua npm start / npm run editor.</span>`;
  }
}

// Sửa màn đang chọn. Mọi thay đổi đi qua đây để DDA / xuất / danh sách cập nhật và kết quả bot cũ bị bỏ.
function update(change) {
  LEVELS[current] = { ...level(), ...change };
  save();
  scheduleSave(current);
  lastBot = null;
  renderAll();
}

// ---------- Danh sách màn ----------
function renderList() {
  $('levelList').innerHTML = LEVELS.map((l, i) => `<button data-i="${i}" class="${i === current ? 'on' : ''} ${edits[i] ? 'dirty' : ''}">
    <span class="n">${i + 1}</span><span>${l.name}</span><span class="tier ${l.tier || 'normal'}">${l.tier || 'normal'}</span></button>`).join('');
}
$('levelList').addEventListener('click', event => {
  const button = event.target.closest('button[data-i]');
  if (!button) return;
  current = Number(button.dataset.i);
  lastBot = null;
  renderAll();
});

// ---------- Form ----------
const FIELDS = [
  { key: 'name', label: 'Tên', cls: 'wide' },
  { key: 'tier', label: 'Tier', type: 'select', options: ['normal', 'hard', 'chill', 'boss'] },
  { key: 'introduces', label: 'Giới thiệu', type: 'select', options: ['', 'crate', 'metal', 'hold', 'cage'] },
  { key: 'moves', label: 'Lượt', type: 'number' },
  { key: 'target', label: 'Mục tiêu điểm', type: 'number' },
  { key: 'cats', label: 'Giống mèo (OGWKST)' },
  { key: 'assist', label: 'Assist (0–1)', type: 'number', step: 0.05, optional: true },
  { key: 'shapes.single', label: 'Tỉ lệ thẻ đơn', type: 'number', optional: true },
  { key: 'shapes.domino', label: 'Tỉ lệ thẻ đôi', type: 'number', optional: true },
  { key: 'shapes.triple', label: 'Tỉ lệ thẻ 3', type: 'number', optional: true },
  { key: 'feature', label: 'Feature (mô tả)' },
  { key: 'deck', label: 'Bộ thẻ kịch bản (cách nhau bởi dấu cách: O OG O|G I:OGW)', cls: 'full' },
];
function fieldValue(key) {
  const [a, b] = key.split('.');
  if (b) return level()[a]?.[b] ?? '';
  if (key === 'deck') return (level().deck || []).join(' ');
  return level()[key] ?? '';
}
function renderForm() {
  $('form').innerHTML = FIELDS.map(f => {
    const value = fieldValue(f.key);
    const input = f.type === 'select'
      ? `<select data-k="${f.key}">${f.options.map(o => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input data-k="${f.key}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} value="${String(value).replace(/"/g, '&quot;')}" ${f.optional ? 'placeholder="mặc định"' : ''}>`;
    return `<label class="${f.cls || ''}">${f.label}${input}</label>`;
  }).join('');
}
$('form').addEventListener('change', event => {
  const key = event.target.dataset.k, raw = event.target.value.trim();
  if (!key) return;
  const [a, b] = key.split('.');
  const num = event.target.type === 'number';
  const value = num ? (raw === '' ? undefined : Number(raw)) : raw;
  if (b) {
    const shapes = { ...(level().shapes || { single: 6, domino: 5, triple: 1 }), [b]: value ?? 0 };
    update({ shapes });
  } else if (key === 'deck') update({ deck: raw ? raw.split(/\s+/) : [] });
  else if (key === 'tier') { update({ tier: raw }); if ($('autoTune').checked) tuneToTier(); }
  else if (key === 'cats') update({ cats: [...new Set(raw.toUpperCase())].filter(ch => LETTERS[ch]).join('') });
  else {
    const next = { ...level() };
    if (value === undefined || value === '') delete next[key]; else next[key] = value;
    LEVELS[current] = next;
    update({});
  }
});

// ---------- Bàn ----------
function boardHtml(rows, interactive = false, grass = null) {
  const { W } = boardSize(rows), grassCells = grass ? grass.join('') : '';
  const cells = [...rows.join('')].map((ch, index) => {
    const up = ch.toUpperCase(), cat = LETTERS[up];
    const cls = ch === '#' ? 'void' : ch === 'X' || ch === 'M' ? ch : '';
    const grassy = grassCells[index] === '~';
    const style = `${cat ? `background:${COLORS[up]};color:${up === 'K' ? '#fff' : '#333'};` : ''}${grassy ? 'box-shadow:inset 0 0 0 4px #8a5a33;' : ''}${grassy && !cat ? 'background:#c49a6c;' : ''}`;
    return `<div class="cell ${cls} ${cat && ch !== up ? 'cage' : ''}" ${interactive ? `data-c="${index}"` : ''} style="${style}">${ch === '.' || ch === '#' ? '' : up}</div>`;
  }).join('');
  return `<div class="board" style="grid-template-columns:repeat(${W},auto)">${cells}</div>`;
}
function renderBoard() {
  const rows = level().board, { W, H } = boardSize(rows);
  $('bw').value = W; $('bh').value = H;
  $('boardInfo').textContent = `${W}×${H} · ${playableCells(rows)} ô chơi`;
  $('board').innerHTML = boardHtml(rows, true, level().grass);
  $('palette').innerHTML = BRUSHES.map(b => `<button data-b="${b}" title="${BRUSH_LABEL[b] || LETTERS[b]}" class="${b === brush ? 'on' : ''}"
    style="background:${COLORS[b] || (b === 'X' ? '#b98a52' : b === 'M' ? '#7d8790' : b === '#' ? '#ddd' : b === '~' ? '#8a5a33' : '#f4ecdf')};color:${b === 'K' || b === 'X' || b === 'M' || b === '~' ? '#fff' : '#333'}">${b === '.' ? '·' : b}</button>`).join('');
}
// Lớp cỏ: chỉ nằm dưới ô trống / mèo; không còn ô cỏ nào thì bỏ hẳn trường grass.
function withGrass(board, grass) {
  const { W } = boardSize(board), cells = board.join('');
  const flat = [...(grass ? grass.join('') : '.'.repeat(cells.length))].map((ch, k) => (ch === '~' && !'XM#'.includes(cells[k]) ? '~' : '.'));
  if (!flat.includes('~')) return undefined;
  return board.map((_, r) => flat.slice(r * W, r * W + W).join(''));
}
function paint(index, cage) {
  const rows = level().board, { W } = boardSize(rows), flat = [...rows.join('')];
  if (brush === '~' || brush === '≈') {
    const grass = [...(level().grass ? level().grass.join('') : '.'.repeat(flat.length))];
    if (grass[index] === (brush === '~' ? '~' : '.')) return;
    grass[index] = brush === '~' ? '~' : '.';
    const next = withGrass(rows, rows.map((_, r) => grass.slice(r * W, r * W + W).join('')));
    if (JSON.stringify(next) === JSON.stringify(level().grass)) return;
    update({ grass: next });
    return;
  }
  let ch = brush;
  if (cage && LETTERS[flat[index].toUpperCase()]) ch = flat[index] === flat[index].toUpperCase() ? flat[index].toLowerCase() : flat[index].toUpperCase();
  if (flat[index] === ch) return;
  flat[index] = ch;
  const board = [];
  for (let r = 0; r < flat.length / W; r++) board.push(flat.slice(r * W, r * W + W).join(''));
  update({ board, grass: withGrass(board, level().grass) });
}
$('palette').addEventListener('click', event => { const b = event.target.closest('[data-b]'); if (b) { brush = b.dataset.b; renderBoard(); } });
$('board').addEventListener('mousedown', event => { const c = event.target.closest('[data-c]'); if (!c) return; painting = !event.shiftKey; paint(Number(c.dataset.c), event.shiftKey); });
$('board').addEventListener('mouseover', event => { const c = event.target.closest('[data-c]'); if (painting && c) paint(Number(c.dataset.c), false); });
window.addEventListener('mouseup', () => { painting = false; });
$('btnResize').onclick = () => {
  const W = Math.max(4, Math.min(9, Number($('bw').value))), H = Math.max(4, Math.min(9, Number($('bh').value)));
  const old = level().board;
  const board = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => old[r]?.[c] ?? '.').join(''));
  const grass = level().grass && Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => level().grass[r]?.[c] ?? '.').join(''));
  update({ board, grass: withGrass(board, grass) });
};
$('btnClear').onclick = () => update({ board: level().board.map(row => row.replace(/[A-Za-z]/g, ch => (ch === 'X' || ch === 'M' ? ch : '.'))) });

// ---------- Kiểm tra ----------
function issues(l) {
  const out = [];
  const { W, H } = boardSize(l.board);
  if (l.board.some(row => row.length !== W)) out.push('Các hàng của bàn không cùng độ dài');
  try {
    if (clearMatches(parseBoard(l.board), W, H, MATCH_SIZE).cleared.length) out.push('Bàn đầu đã có cụm gom được (≥ 3 mèo liền nhau)');
  } catch (error) { out.push('Bàn lỗi: ' + error.message); }
  const onBoard = new Set([...l.board.join('')].filter(ch => LETTERS[ch.toUpperCase()]).map(ch => ch.toUpperCase()));
  const missing = [...onBoard].filter(ch => !l.cats.includes(ch));
  if (missing.length) out.push(`Mèo trên bàn không có trong "Giống mèo": ${missing.join(', ')}`);
  (l.deck || []).forEach(spec => { try { if (parseCard(spec).items.some(item => !item.group)) throw 0; } catch { out.push(`Thẻ lỗi: ${spec}`); } });
  if (!l.moves || l.moves < 1) out.push('Số lượt phải ≥ 1');
  const ppm = l.target / l.moves;
  if (ppm > 30) out.push(`Mục tiêu/lượt = ${ppm.toFixed(1)}: rất chật (ngưỡng "Lượt chật" là ${ADAPTIVE.TIGHT_PPM})`);
  if (level().tier === 'boss' && elementCount(l) < 2) out.push('Boss nên có ≥ 2 element (DDA không cho boss xuống dưới Medium)');
  return out;
}

// ---------- DDA ----------
function chipsHtml(l) {
  const on = levelElements(l), count = elementCount(l), diff = difficultyOf(count);
  return `<div class="chips">${ELEMENTS.map(k => `<span class="chip ${on[k] ? 'on' : ''}">${ELEMENT_LABEL[k]}</span>`).join('')}</div>
    <div><span class="diff ${diff}">${diff.toUpperCase()}</span> <span class="muted">${count}/${MAX_ELEMENTS} element · ${l.moves} lượt · ${l.target} điểm · ${l.cats.length} giống</span></div>`;
}

// Lịch sử giả cho từng kiểu người chơi (khớp các nhánh của detectProfile).
function attempt(levelIndex, extra = {}) {
  return { level: levelIndex, win: true, reason: 'win', ratio: 1.1, stars: 2, count: 2, boosters: 0, thinkMs: 3000, idleMs: 0, durationMs: 60000, dwellMs: 2000, shift: 0, ...extra };
}
function history(i, tail, { pad = 6, ...rest } = {}) {
  const prev = Math.max(0, i - 1);
  // Phần đệm: thắng có dùng booster để không bị coi là chuỗi thắng sạch.
  const padding = Array.from({ length: pad }, () => attempt(prev, { boosters: 1 }));
  return { attempts: [...padding, ...tail], streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: Date.now(), ...rest };
}
const PROFILES = [
  { label: 'Người mới', make: () => ({ attempts: [], streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: 0 }) },
  { label: 'Ổn định', make: i => history(i, [attempt(i - 1, { boosters: 1 })]) },
  { label: 'Cao thủ (3 thắng sạch)', make: i => history(i, [0, 1, 2].map(() => attempt(i - 1, { count: 3 }))) },
  { label: 'Cao thủ (6 thắng sạch)', make: i => history(i, [0, 1, 2, 3, 4, 5].map(() => attempt(i - 1, { count: 3 }))) },
  { label: 'Sát nút (thua 2 lần ~90%)', make: i => history(i, [0, 1].map(() => attempt(i, { win: false, reason: 'moves', ratio: 0.9 }))) },
  { label: 'Vật lộn (thua 2 lần)', make: i => history(i, [0, 1].map(() => attempt(i, { win: false, reason: 'moves', ratio: 0.5 }))) },
  { label: 'Kẹt bàn (hết chỗ 2 lần)', make: i => history(i, [0, 1].map(() => attempt(i, { win: false, reason: 'stuck', ratio: 0.5 }))) },
  { label: 'Sắp bỏ (thua 4 lần)', make: i => history(i, [0, 1, 2, 3].map(() => attempt(i, { win: false, reason: 'moves', ratio: 0.4 }))) },
  { label: 'Quay lại sau nghỉ', make: i => history(i, [attempt(i - 1, { boosters: 1 })], { warmup: true }) },
];
function renderDDA() {
  const l = level();
  $('elements').innerHTML = chipsHtml(l) + (isAdaptive(l) ? '' : '<div class="muted">Màn tutorial: DDA không áp dụng.</div>')
    + `<div class="muted">Hold: ${holdUnlocked(current) ? 'có' : 'chưa mở'}</div>`;

  const rows = PROFILES.map(p => {
    let plan;
    try { plan = planLevel(p.make(current), current); } catch (error) { return `<tr><td>${p.label}</td><td colspan="5" class="warn">${error.message}</td></tr>`; }
    const shift = plan.shift > 0 ? `+${plan.shift}` : plan.shift;
    const extra = [plan.retry ? 'giữ bố trí lần trước' : plan.layout !== l.board ? 'bố trí đo sẵn cho mức này' : '', plan.deal || '', plan.suggestBooster ? 'mời booster' : ''].filter(Boolean).join(' · ');
    return `<tr><td>${p.label}</td><td>${plan.profile}</td><td>${shift}</td><td><span class="diff ${plan.difficulty}">${plan.difficulty}</span> ${plan.count}</td>
      <td>${plan.level.moves}</td><td class="muted" style="text-align:left">${extra}</td></tr>`;
  }).join('');
  $('profiles').innerHTML = `<tr><th>Hồ sơ</th><th>DDA nhận diện</th><th>Shift</th><th>Độ khó</th><th>Lượt</th><th style="text-align:left">Ghi chú</th></tr>${rows}`;

  $('variants').innerHTML = variants().map(v => `<div class="variant ${v.base ? 'base' : ''}">
    <div><b>${v.label}</b></div>
    <div class="mini">${boardHtml(v.level.board, false, v.level.grass)}</div>
    <div class="muted">${v.shift && !v.moved ? 'chưa có bố trí đo sẵn (npm run cat-layouts) · ' : v.moved ? `${v.moved} ô đổi · ` : ''}${v.ease} cặp cạnh nhau · assist ${v.level.assist ?? 0.3} · thẻ ${['single', 'domino', 'triple'].map(k => (v.level.shapes || { single: 6, domino: 5, triple: 1 })[k]).join('/')}</div></div>`).join('');
}
// Mỗi mức DDA (shift âm = dễ hơn): bố trí mèo lần đầu vào màn + hàng thẻ. Bàn, vật cản, lượt luôn đúng thiết kế.
const shiftLabel = shift => (shift ? `${shift > 0 ? '+' : ''}${shift} ${shift < 0 ? 'dễ hơn' : 'khó hơn'}` : '0 thiết kế');
function variants() {
  const base = level(), out = [];
  const adaptive = isAdaptive(base);
  for (let shift = SHIFT_MIN; shift <= SHIFT_MAX; shift++) {
    if (!adaptive && shift) continue;
    const l = shift ? variantFor(base, shift) : base;
    out.push({ level: l, shift, label: shiftLabel(shift), base: shift === 0, ease: layoutEase(l.board), moved: l.board === base.board ? 0 : [...l.board.join('')].filter((ch, k) => ch !== base.board.join('')[k]).length });
  }
  return out;
}

// ---------- Bot ----------
const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
$('btnRun').onclick = () => {
  const runs = Math.max(20, Number($('runs').value) || 200), id = ++botRun, list = variants();
  const jobs = list.flatMap((v, vi) => NOISES.map((n, ni) => ({
    key: `${vi}:${ni}`, level: v.level, runs, noise: n.noise, hold: holdUnlocked(current), seed: (current + 1) * 100000,
  })));
  lastBot = { id, list, results: {}, total: jobs.length, level: current };
  $('btnRun').disabled = true;
  $('botStatus').textContent = `0/${jobs.length}`;
  worker.postMessage({ id, jobs });
  renderBot();
};
worker.onmessage = ({ data }) => {
  if (!lastBot || data.id !== lastBot.id) return;
  if (data.done) { $('btnRun').disabled = false; $('botStatus').textContent = 'Xong'; renderCurve(); return; }
  lastBot.results[data.key] = data;
  $('botStatus').textContent = `${Object.keys(lastBot.results).length}/${lastBot.total}`;
  renderBot();
};
worker.onerror = event => { $('btnRun').disabled = false; $('botStatus').textContent = 'Lỗi worker: ' + event.message; };
const pct = x => `${Math.round(x * 100)}%`;

// ---------- Đổi tier = đổi độ khó thật ----------
// Tỉ lệ thắng bot giỏi cần đạt theo tier (đường cong ghi ở đầu levels.mjs): normal 95% -> 70% trong chương (theo vị trí x1..x9),
// hard 45% -> 33%, chill ≥ 95%, boss 30% -> 22% (chương sau khó hơn chương trước: chương 2 -> 5).
function tierGoal(tier, index) {
  const t = Math.min(1, Math.max(0, (Math.floor(index / 10) - 1) / 3)), pos = index % 10;
  if (tier === 'chill') return 0.96;
  if (tier === 'hard') return 0.45 - 0.12 * t;
  if (tier === 'boss') return 0.30 - 0.08 * t;
  return 0.95 - 0.25 * Math.min(1, pos / 9);
}
let tuneId = 0;
function tuneToTier() {
  const index = current, l = level(), tier = l.tier || 'normal', goal = tierGoal(tier, index);
  if (l.grass) { $('tuneStatus').textContent = 'Màn có cỏ: mục tiêu là dọn hết cỏ (không theo điểm), nên không tự cân mục tiêu điểm. Chỉnh số lượt / số ô cỏ rồi chạy bot.'; return; }
  const id = ++tuneId, before = l.target;
  $('btnTune').disabled = true;
  $('tuneStatus').textContent = `Đang cân mục tiêu điểm cho tier ${tier} (bot giỏi thắng ~${pct(goal)})…`;
  const tuner = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  tuner.onmessage = ({ data }) => {
    if (id !== tuneId) { tuner.terminate(); return; }
    if (data.progress) { $('tuneStatus').textContent = `Đang cân cho tier ${tier}: thử ${data.progress.target} điểm -> ${pct(data.progress.winRate)}`; return; }
    tuner.terminate();
    $('btnTune').disabled = false;
    const { target, winRate } = data.tuned;
    if (current === index) update({ target }); else { LEVELS[index] = { ...LEVELS[index], target }; edits[index] = LEVELS[index]; persist(); scheduleSave(index); renderList(); }
    const warn = tier === 'boss' && elementCount(LEVELS[index]) < 2 ? ' · ⚠ boss nên có ≥ 2 element (thêm vật cản / màu)' : '';
    $('tuneStatus').innerHTML = `Tier <b>${tier}</b>: mục tiêu ${before} -> <b>${target}</b> điểm, bot giỏi thắng ${pct(winRate)} (chuẩn ${pct(goal)})${warn}`;
  };
  tuner.onerror = event => { $('btnTune').disabled = false; $('tuneStatus').textContent = 'Lỗi khi cân: ' + event.message; };
  tuner.postMessage({ id, tune: { level: l, goal, runs: 150, hold: holdUnlocked(index), seed: (index + 1) * 100000 } });
}
$('btnTune').onclick = tuneToTier;
function renderBot() {
  if (!lastBot || lastBot.level !== current) { $('botTable').innerHTML = ''; $('botNote').textContent = 'Chưa chạy cho bản hiện tại.'; return; }
  const head = `<tr><th>Biến thể</th>${NOISES.map(n => `<th>${n.label}</th>`).join('')}<th>Kẹt (giỏi)</th><th>Lượt dư</th></tr>`;
  const body = lastBot.list.map((v, vi) => {
    const cells = NOISES.map((_, ni) => {
      const r = lastBot.results[`${vi}:${ni}`];
      return r ? `<td>${pct(r.winRate)}<div class="bar"><i style="width:${r.winRate * 100}%"></i></div></td>` : '<td class="muted">…</td>';
    }).join('');
    const best = lastBot.results[`${vi}:0`];
    return `<tr><td>${v.label}${v.base ? ' ★' : ''}</td>${cells}
      <td>${best ? pct(best.stuckRate) : ''}</td><td>${best ? best.avgMovesLeft.toFixed(1) : ''}</td></tr>`;
  }).join('');
  $('botTable').innerHTML = head + body;

  // Nhận xét: bản ít element phải thắng nhiều hơn; bản gốc so với baseline.
  const notes = [];
  const wins = lastBot.list.map((_, vi) => lastBot.results[`${vi}:0`]?.winRate);
  if (wins.every(w => w !== undefined)) {
    wins.forEach((w, k) => { if (k && w > wins[k - 1] + 0.05) notes.push(`<span class="warn">Đảo thứ tự: mức ${lastBot.list[k].label} thắng nhiều hơn mức ${lastBot.list[k - 1].label}</span>`); });
    const baseIndex = lastBot.list.findIndex(v => v.base), was = baselineWin(current + 1);
    if (was !== undefined && baseIndex >= 0) {
      const delta = wins[baseIndex] - was;
      const row = baseline.levels.find(r => r.level === current + 1), o = ORIGINAL[current];
      const stale = row.name !== o.name || row.moves !== o.moves || row.target !== o.target;
      notes.push(`Bản gốc: ${pct(wins[baseIndex])} so với baseline ${pct(was)} <span class="${Math.abs(delta) > 0.1 ? 'warn' : 'ok'}">(${delta >= 0 ? '+' : ''}${Math.round(delta * 100)} điểm)</span>`
        + (stale ? ` <span class="muted">· baseline.json đo bản cũ (${row.moves} lượt / ${row.target} điểm); chạy npm run baseline để cập nhật</span>` : ''));
    }
  }
  $('botNote').innerHTML = notes.join('<br>') || 'Bot tham lam nhìn 1 nước: tỉ lệ thắng là cận dưới của người thật.';
}

// ---------- Đường cong ----------
function renderCurve() {
  const n = LEVELS.length, w = 560, h = 140, bw = w / n;
  const mine = lastBot?.level === current ? lastBot.results[`${lastBot.list.findIndex(v => v.base)}:0`]?.winRate : undefined;
  const bars = LEVELS.map((l, i) => {
    const rate = baselineWin(i + 1) ?? 0, x = i * bw, y = h - 20 - rate * (h - 30);
    const color = l.tier === 'boss' ? '#c8443a' : l.tier === 'hard' ? '#e09a6a' : l.tier === 'chill' ? '#7cc093' : '#bdb3a6';
    const sel = i === current ? `<rect x="${x}" y="0" width="${bw}" height="${h - 20}" fill="#fde6d3"/>` : '';
    const me = i === current && mine !== undefined ? `<circle cx="${x + bw / 2}" cy="${h - 20 - mine * (h - 30)}" r="4" fill="#e07a2e"/>` : '';
    return `${sel}<rect x="${x + 1}" y="${y}" width="${bw - 2}" height="${h - 20 - y}" fill="${color}" data-i="${i}"><title>${i + 1}. ${l.name}: ${pct(rate)}</title></rect>${me}${(i + 1) % 5 === 0 ? `<text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle">${i + 1}</text>` : ''}`;
  }).join('');
  $('curve').innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%">${bars}<line x1="0" x2="${w}" y1="${h - 20}" y2="${h - 20}" stroke="#ccc"/></svg>`;
}
$('curve').addEventListener('click', event => { const i = event.target.dataset?.i; if (i !== undefined) { current = Number(i); lastBot = null; renderAll(); } });

// ---------- Xuất ----------
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
function toCode(l) {
  const head = [`name: ${q(l.name)}`, l.feature !== undefined && `feature: ${q(l.feature)}`, `tier: ${q(l.tier || 'normal')}`, l.introduces && `introduces: ${q(l.introduces)}`].filter(Boolean);
  const play = [`moves: ${l.moves}`, `target: ${l.target}`, `cats: ${q(l.cats)}`, l.assist !== undefined && `assist: ${l.assist}`,
    l.shapes && `shapes: { single: ${l.shapes.single}, domino: ${l.shapes.domino}, triple: ${l.shapes.triple} }`, l.expand && `expand: ${q(l.expand)}`].filter(Boolean);
  const lines = [`  {`, `    ${head.join(', ')},`, `    ${play.join(', ')},`, `    board: [${l.board.map(q).join(', ')}],`, ...(l.grass ? [`    grass: [${l.grass.map(q).join(', ')}],`] : []), `    deck: [${(l.deck || []).map(q).join(', ')}],`];
  const known = new Set(['name', 'feature', 'tier', 'introduces', 'moves', 'target', 'cats', 'assist', 'shapes', 'expand', 'board', 'grass', 'deck']);
  for (const [k, v] of Object.entries(l)) if (!known.has(k) && v !== undefined) lines.push(`    ${k}: ${JSON.stringify(v)},`);
  return [...lines, `  },`].join('\n');
}
$('btnCopy').onclick = async () => { await navigator.clipboard.writeText($('code').textContent); $('copied').textContent = 'Đã copy'; setTimeout(() => { $('copied').textContent = ''; }, 1500); };
$('btnSave').onclick = () => { const dirty = Object.keys(edits).map(Number); if (!dirty.length) $('saveStatus').textContent = 'Không có màn nào chưa lưu'; dirty.forEach(saveToGame); };
$('autoSave').onchange = () => { if ($('autoSave').checked) Object.keys(edits).map(Number).forEach(scheduleSave); };
$('btnRevert').onclick = () => { LEVELS[current] = clone(ORIGINAL[current]); save(); lastBot = null; renderAll(); };
$('btnExportAll').onclick = () => {
  const blob = new Blob([JSON.stringify(Object.fromEntries(Object.entries(edits).map(([i, l]) => [Number(i) + 1, l])), null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'edited-levels.json' });
  a.click();
  URL.revokeObjectURL(a.href);
};

function renderAll() {
  renderList(); renderForm(); renderBoard(); renderDDA(); renderBot(); renderCurve();
  const list = issues(level());
  $('issues').innerHTML = list.map(t => `<li class="warn">⚠ ${t}</li>`).join('') || '<li class="ok">✓ Màn hợp lệ</li>';
  $('code').textContent = toCode(level());
  renderStatus();
}
function renderStatus() {
  $('status').textContent = `Màn ${current + 1}/${LEVELS.length} · ${Object.keys(edits).length} màn đã sửa chưa lưu vào game`;
}
renderAll();
