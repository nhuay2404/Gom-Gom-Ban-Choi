import { clearMatches, mergeTarget, placementIndices, placeCard, rotateOffsets } from './color-block-jam-b-logic.mjs';
import { categories, catGroups, addArt as addCatArt } from './cats.mjs';

const W = 6, H = 6, TURN_LIMIT = 20, TARGET_SCORE = 120, PREVIEW_COUNT = 3;
const $ = id => document.getElementById(id);
const MATCH_SIZE = 3, POINTS_PER_CLEARED = 10;
const shapes = {
  single: [[0, 0]],
  domino: [[0, 0], [0, 1]],
  line: [[0, 0], [0, 1], [0, 2]],
  elbow: [[0, 0], [1, 0], [1, 1]],
};

let state, cardDrag = null;
const startingBlocks = [
  [0, 0, 'orange'], [0, 5, 'gray'], [2, 2, 'white'],
  [3, 4, 'tabby'], [5, 0, 'orange'], [5, 5, 'siamese'],
];
// Tỉ lệ hình thẻ: nhiều thẻ 1 ô để dễ lấp chỗ trống và gom nhóm.
// Mỗi 12 thẻ chỉ có 1 thẻ 3 ô (xen kẽ chữ I / chữ L).
const shapeBag = ['single', 'single', 'domino', 'single', 'single', 'domino', 'single', 'triple', 'single', 'domino', 'single', 'domino'];

function item(group) {
  return { group, name: categories[group].name };
}

function randomGroup() {
  return catGroups[Math.floor(Math.random() * catGroups.length)];
}

function shuffled(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function buildDeck() {
  const cards = [];
  for (let index = 0; index < 24; index++) {
    let shapeName = shapeBag[index % shapeBag.length];
    if (shapeName === 'triple') shapeName = index < shapeBag.length ? 'line' : 'elbow';
    const items = shapes[shapeName].map(() => item(randomGroup()));
    cards.push({ offsets: shapes[shapeName].map(point => point.slice()), items });
  }
  return shuffled(cards);
}

function drawCard() {
  if (state.deck.length <= PREVIEW_COUNT) state.deck.push(...buildDeck());
  return state.deck.shift();
}

function addArt(element, object) {
  addCatArt(element, object.group);
}

function normalizePreview(offsets) {
  const maxRow = Math.max(...offsets.map(([row]) => row));
  const maxCol = Math.max(...offsets.map(([, col]) => col));
  return { rows: maxRow + 1, cols: maxCol + 1 };
}

// Trả về true nếu có dựng lại; thẻ không đổi (cùng thẻ, cùng hướng) thì giữ nguyên DOM để khỏi chớp.
function renderCard(container, card, compact = false) {
  const key = card ? card.offsets.join('|') : 'empty';
  if (container.renderedCard === (card || null) && container.renderedKey === key) return false;
  container.renderedCard = card || null;
  container.renderedKey = key;
  container.replaceChildren();
  if (!card) {
    const plus = document.createElement('span'); plus.className = 'hold-plus'; plus.textContent = '+'; container.append(plus); return;
  }
  const grid = document.createElement('span');
  const size = normalizePreview(card.offsets);
  grid.className = `piece-grid ${compact ? 'compact' : ''}`;
  grid.style.setProperty('--piece-cols', size.cols);
  grid.style.setProperty('--piece-rows', size.rows);
  card.offsets.forEach(([row, col], index) => {
    const cell = document.createElement('span');
    cell.className = `piece-object ${card.items[index].group}`;
    cell.style.gridArea = `${row + 1}/${col + 1}`;
    cell.style.setProperty('--group-color', categories[card.items[index].group].color);
    addArt(cell, card.items[index]); grid.append(cell);
  });
  container.append(grid);
  return true;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const gridRect = container => container?.querySelector('.piece-grid')?.getBoundingClientRect() || null;

// FLIP: cho grid bay từ vị trí/kích thước `from` về chỗ hiện tại của nó.
function flyFrom(container, from, duration = 360) {
  const grid = container.querySelector('.piece-grid');
  if (!grid || !from || reduceMotion.matches) return;
  const to = grid.getBoundingClientRect();
  if (!to.width || !from.width) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  const rest = getComputedStyle(grid).transform;
  const end = rest === 'none' ? 'none' : rest;
  grid.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${scale}) ${end === 'none' ? '' : end}`, opacity: .7 },
    { transform: end, opacity: 1 },
  ], { duration, easing: 'cubic-bezier(.2, .9, .3, 1.12)' });
}

function popIn(container, delay = 0) {
  const grid = container.querySelector('.piece-grid');
  if (!grid || reduceMotion.matches) return;
  const rest = getComputedStyle(grid).transform;
  const end = rest === 'none' ? 'none' : rest;
  grid.animate([
    { transform: `scale(.4) ${end === 'none' ? '' : end}`, opacity: 0 },
    { transform: end, opacity: 1 },
  ], { duration: 300, delay, easing: 'cubic-bezier(.3, 1.4, .5, 1)', fill: 'backwards' });
}

function rotateActive() {
  if (state.over || state.animating || state.active.items.length < 2) return;
  // Ghi vị trí từng mèo trước khi xoay (đang giữa anim thì lấy đúng chỗ đang hiện -> bấm liên tục vẫn liền mạch).
  const before = [...$('active-card').querySelectorAll('.piece-object')].map(piece => centerOf(piece.getBoundingClientRect()));
  state.active.offsets = rotateOffsets(state.active.offsets);
  state.preview = null;
  state.animateHints = true; // render() sẽ cho mũi tên trượt theo cung thay vì nhảy
  render();
  state.animateHints = false;
  animateRotation(before);
}

// Mũi tên gợi ý xoay nằm trên quỹ đạo quanh tâm thẻ: góc 0° = mép trên (chỉ phải), 180° = mép dưới.
// Đổi ngang <-> dọc thì cả vòng quay thêm 90° thuận chiều, nên mũi tên trượt theo cung tròn và tự đổi hướng.
let hintAngle = 0;
const ROTATE_MS = 340;
function hintTransform(angle, card, arrowHeight) {
  const rad = angle * Math.PI / 180;
  const radiusY = card.height / 2 - arrowHeight / 2 - 3, radiusX = card.width / 2 - arrowHeight / 2 - 5;
  const radius = radiusY * Math.cos(rad) ** 2 + radiusX * Math.sin(rad) ** 2; // quỹ đạo dẹt theo khung chữ nhật
  return `translate(-50%, -50%) rotate(${angle.toFixed(2)}deg) translateY(${(-radius).toFixed(2)}px)`;
}
function layoutHints(vertical, animate = false) {
  const hints = [...document.querySelectorAll('.card-rotator .rotate-hint')];
  const card = $('active-card').getBoundingClientRect();
  if (!hints.length || !card.width) return;
  const from = hintAngle;
  const arrowsVertical = () => ((hintAngle % 180) + 180) % 180 === 90;
  // Bấm xoay: vòng mũi tên luôn quay thêm 90° (kể cả thẻ chữ L 3 mèo vốn không đổi ngang/dọc).
  // Thẻ mới: đặt thẳng theo hình thẻ (ngang -> trên/dưới, dọc -> hai bên).
  if (animate || arrowsVertical() !== vertical) hintAngle += 90;
  // Thẻ 3 mèo: mũi tên nhỏ lại và mèo co vào vùng bên trong vòng mũi tên, không bị đè.
  const crowded = state.active.items.length >= 3;
  hints.forEach(hint => hint.classList.toggle('small', crowded));
  const arrowHeight = hints[0].offsetHeight || card.width * .3;
  fitInsideHints(crowded && !state.over, arrowsVertical(), card, arrowHeight);
  hints.forEach((hint, index) => {
    const offset = index === 0 ? 0 : 180;
    hint.style.transform = hintTransform(hintAngle + offset, card, arrowHeight);
    if (!animate || from === hintAngle || reduceMotion.matches) return;
    const steps = 10;
    hint.animate(Array.from({ length: steps + 1 }, (_, step) =>
      ({ transform: hintTransform(from + (hintAngle - from) * step / steps + offset, card, arrowHeight) })),
    { duration: ROTATE_MS, easing: 'cubic-bezier(.35, 0, .25, 1)' });
  });
}

// Thẻ 3 mèo: một cỡ mèo CỐ ĐỊNH, là cỡ lớn nhất vẫn vừa mọi hướng thẻ sẽ gặp khi xoay (mũi tên
// chiếm 2 dải trên/dưới hoặc hai bên) -> xoay không bị to nhỏ. Thẻ chữ I: mũi tên luôn cùng hướng thẻ;
// thẻ vuông (chữ L): mũi tên đổi luân phiên nên xét cả hai.
function fitInsideHints(enabled, _vertical, card, arrowHeight) {
  const grid = $('active-card').querySelector('.piece-grid');
  if (!grid) return;
  grid.style.removeProperty('--cell');
  if (!enabled) return;
  const band = arrowHeight * .78 + 4, pad = 10, gap = 4;
  const fit = (rows, cols, arrowsOnSides) => {
    const width = card.width - (arrowsOnSides ? band * 2 : 0), height = card.height - (arrowsOnSides ? 0 : band * 2);
    return Math.min(44, (width - pad - gap * (cols - 1)) / cols, (height - pad - gap * (rows - 1)) / rows);
  };
  const { rows, cols } = normalizePreview(state.active.offsets);
  const long = Math.max(rows, cols), short = Math.min(rows, cols);
  const cell = rows === cols
    ? Math.min(fit(rows, cols, false), fit(rows, cols, true))
    : Math.min(fit(short, long, false), fit(long, short, true));
  grid.style.setProperty('--cell', `${Math.floor(cell)}px`);
}

// Mỗi mèo chạy theo cung tròn quanh tâm thẻ (như cả thẻ quay 90° thuận chiều) từ chỗ cũ tới chỗ mới;
// mèo vẫn đứng thẳng, chỉ nghiêng theo đà. Khung đầu trùng vị trí cũ nên không bị chớp.
function animateRotation(before) {
  if (reduceMotion.matches) return;
  const card = $('active-card'), pieces = [...card.querySelectorAll('.piece-object')];
  const pivot = centerOf(card.getBoundingClientRect());
  pieces.forEach((piece, index) => {
    const from = before[index];
    if (!from) return;
    const to = centerOf(piece.getBoundingClientRect());
    const v0 = { x: from.x - pivot.x, y: from.y - pivot.y }, v1 = { x: to.x - pivot.x, y: to.y - pivot.y };
    const r0 = Math.hypot(v0.x, v0.y), r1 = Math.hypot(v1.x, v1.y);
    const a0 = Math.atan2(v0.y, v0.x);
    const steps = 8, keyframes = [];
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, angle = a0 + Math.PI / 2 * t, radius = r0 + (r1 - r0) * t;
      const x = pivot.x + Math.cos(angle) * radius - to.x, y = pivot.y + Math.sin(angle) * radius - to.y;
      const tilt = Math.sin(t * Math.PI) * 14;
      keyframes.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scale(${(1 + Math.sin(t * Math.PI) * .06).toFixed(3)})` });
    }
    piece.animate(keyframes, { duration: 340, easing: 'cubic-bezier(.35, 0, .25, 1)' });
  });
}

function holdActive() {
  if (state.over || state.animating || state.heldThisTurn) return;
  const previous = state.hold;
  state.hold = state.active;
  state.active = previous || drawCard();
  state.heldThisTurn = true;
  state.preview = null;
  render(previous ? 'Đã đổi với thẻ gửi tạm.' : 'Đã gửi tạm thẻ này.');
}

function canPlaceAnywhere(card) {
  return state.board.some((_, index) => placementIndices(state.board, W, H, index, card.offsets));
}

function placeAt(anchor) {
  if (state.over || state.animating) return;
  const result = placeCard(state.board, W, H, anchor, state.active);
  if (result.error) return render(result.error, true);
  // Chỉ gom (xóa cụm 3+) mới có điểm; đặt thẻ thôi thì không.
  const match = clearMatches(result.board, W, H, MATCH_SIZE);
  if (!match.cleared.length || reduceMotion.matches) return finishTurn(result, match);
  // State được chốt ngay (cụm biến mất, điểm cộng, rút thẻ mới) để người chơi đặt tiếp liền.
  // Anim gom chạy trên các "bóng mèo" phủ đúng chỗ cũ, không chặn thao tác.
  const gained = match.cleared.length * POINTS_PER_CLEARED;
  const merges = match.clusters.map(cluster => ({ cluster, target: mergeTarget(cluster, result.indices, W) }));
  const ghosts = spawnMergeGhosts(merges, result);
  const done = animateMerges(ghosts, merges, gained);
  pendingMerges.add(done);
  done.finally(() => pendingMerges.delete(done));
  finishTurn(result, match);
}

function cellEl(index) {
  return document.querySelector(`.cell[data-index="${index}"]`);
}

const LIFT_MS = 560, MERGE_MS = 420, WIN_PAUSE_MS = 800, DROP_MS = 340;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pendingMerges = new Set();

function fxLayer() {
  let layer = $('board').querySelector(':scope > .board-fx');
  if (!layer) { layer = document.createElement('div'); layer.className = 'board-fx'; $('board').append(layer); }
  return layer;
}

// Bóng mèo: bản sao mèo của cụm, đặt đúng vị trí ô (toạ độ trong board nên theo cả độ nghiêng 3D).
function spawnMergeGhosts(merges, result) {
  return spawnGhosts(merges.flatMap(({ cluster }) => cluster), result.board, new Set(result.indices));
}

function spawnGhosts(indices, board, placed = new Set()) {
  const layer = fxLayer(), ghosts = new Map();
  indices.forEach(index => {
    const cell = cellEl(index), object = board[index];
    if (!cell || !object) return;
    const ghost = document.createElement('span');
    ghost.className = `cell locked ${object.group} merge-ghost${placed.has(index) ? ' drop' : ''}`;
    ghost.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    ghost.style.setProperty('--group-color', categories[object.group].color);
    addArt(ghost, object);
    layer.append(ghost);
    ghosts.set(index, ghost);
  });
  return ghosts;
}

// Pha 1: mèo bị nhấc bổng lên, lộ bụng + chân sau lủng lẳng (CSS .lifted).
// Pha 2: cả cụm trượt vào mèo vừa đặt và nhỏ dần; mèo đích phồng lên rồi biến mất.
async function animateMerges(ghosts, merges, gained) {
  const total = merges.reduce((n, m) => n + m.cluster.length, 0);
  await wait(DROP_MS); // mèo vừa đặt rơi xong đã
  merges.forEach(({ cluster }) => cluster.forEach((index, order) => {
    const ghost = ghosts.get(index);
    if (!ghost) return;
    ghost.classList.add('lifted');
    ghost.style.setProperty('--lift-delay', `${order * 50}ms`);
  }));
  await wait(LIFT_MS);
  const animations = [];
  merges.forEach(({ cluster, target }) => {
    const targetGhost = ghosts.get(target);
    if (!targetGhost) return;
    cluster.forEach(index => {
      const ghost = ghosts.get(index);
      if (!ghost) return;
      if (index === target) {
        animations.push(ghost.animate([
          { transform: 'none', opacity: 1 },
          { transform: 'scale(1.3)', opacity: 1, offset: .65 },
          { transform: 'scale(0)', opacity: 0 },
        ], { duration: MERGE_MS + 120, easing: 'ease-in-out', fill: 'forwards' }));
        return;
      }
      const dx = targetGhost.offsetLeft - ghost.offsetLeft, dy = targetGhost.offsetTop - ghost.offsetTop;
      animations.push(ghost.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * .8}px, ${dy * .8}px) scale(.7)`, opacity: 1, offset: .75 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 },
      ], { duration: MERGE_MS, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' }));
    });
    showMergeScore(targetGhost, Math.round(gained * cluster.length / total));
  });
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  ghosts.forEach(ghost => ghost.remove());
}

// Thắng: chờ các anim gom còn dở xong, rồi mọi mèo còn lại bị nhấc bổng và bay vút lên, bàn trống trơn.
async function celebrateWin(message) {
  state.animating = true;
  await Promise.all([...pendingMerges]);
  const occupied = state.board.map((object, index) => object && index).filter(index => index !== null && index !== false);
  if (!reduceMotion.matches && occupied.length) {
    await wait(WIN_PAUSE_MS); // để người chơi thấy lần gom cuối + thông báo thắng trước
    // Chỉ bóng mèo bay đi; ô grid được trả về ô trống ngay nên bàn luôn nguyên vẹn.
    const ghosts = [...spawnGhosts(occupied, state.board).values()];
    state.board = state.board.map(() => null);
    render(message);
    $('board').classList.add('busy', 'flying');
    ghosts.forEach((ghost, order) => {
      ghost.classList.add('lifted');
      ghost.style.setProperty('--lift-delay', `${order * 40}ms`);
    });
    await wait(LIFT_MS + ghosts.length * 40);
    await Promise.all(ghosts.map((ghost, order) => ghost.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(-30px) scale(1.05)', opacity: 1, offset: .3 },
      { transform: `translateY(-${260 + (order % 3) * 40}px) scale(.6) rotate(${order % 2 ? 14 : -14}deg)`, opacity: 0 },
    ], { duration: 620, delay: order * 45, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' }).finished.catch(() => {})));
    ghosts.forEach(ghost => ghost.remove());
    $('board').classList.remove('busy', 'flying');
  }
  state.animating = false;
  state.board = state.board.map(() => null);
  render(message);
}
function showMergeScore(cell, points) {
  const wrap = document.querySelector('.board-wrap');
  const box = wrap.getBoundingClientRect(), rect = cell.getBoundingClientRect();
  const pop = document.createElement('span');
  pop.className = 'merge-pop';
  pop.textContent = `+${points}`;
  pop.style.left = `${rect.left + rect.width / 2 - box.left}px`;
  pop.style.top = `${rect.top + rect.height / 2 - box.top}px`;
  wrap.append(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

function finishTurn(result, match) {
  const gained = match.cleared.length * POINTS_PER_CLEARED;
  state.board = match.board;
  // Sau khi gom, mèo còn lại đã rơi xong rồi -> không chạy anim rơi lần nữa.
  // Mèo vừa đặt mà không bị gom thì rơi xuống ô thật; mèo bị gom đã có bóng mèo lo phần anim.
  state.justPlaced = new Set(result.indices.filter(index => match.board[index]));
  state.score += gained;
  const clearedText = match.groups.length ? `Gom ${match.groups.map(group => categories[group].name).join(', ')}! +${gained} điểm.` : '';
  state.moves--;
  state.heldThisTurn = false;
  state.preview = null;
  if (state.score >= TARGET_SCORE) {
    state.over = true;
    const message = `Bạn thắng với ${state.score} điểm! ✨`;
    render(message);
    return celebrateWin(message);
  }
  if (state.moves === 0) {
    state.over = true;
    return render(`Hết lượt — bạn đạt ${state.score}/${TARGET_SCORE} điểm.` , true);
  }
  state.active = drawCard();
  const fit = canPlaceAnywhere(state.active);
  render(fit ? clearedText || 'Đã đặt thẻ. Gom 3 mèo cùng loại để ghi điểm.' : `${clearedText} Thẻ mới không còn chỗ đặt — hãy dùng Gửi tạm.`.trim(), !fit);
}

const centerOf = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

// Tâm các ô bàn (chụp một lần lúc bắt đầu kéo; bàn không dịch chuyển trong lúc kéo).
function measureCells() {
  const rects = [...$('board').querySelectorAll(':scope > .cell')].map(cell => cell.getBoundingClientRect());
  return { centers: rects.map(centerOf), size: Math.max(...rects.map(rect => rect.width)) };
}

// Ô gần nhất với một điểm, kể cả khi điểm rơi vào khe giữa các ô; quá xa bàn thì trả null.
function nearestCell(point, cells) {
  let best = null, bestDistance = Infinity;
  cells.centers.forEach((center, index) => {
    const distance = Math.hypot(center.x - point.x, center.y - point.y);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return bestDistance <= cells.size * .75 ? best : null;
}

// Anchor = góc trên-trái của hình, suy ra từ con mèo đang được cầm: lấy ô gần nhất với
// chỗ con mèo đó đang hiện (tâm hình mèo, không phải tâm khung vì mèo bị nhấc cao lên).
function dragAnchorFromGhost(ghost) {
  const piece = ghost.querySelectorAll('.piece-object')[cardDrag.grabbed];
  const art = piece?.querySelector('.cat') || piece;
  if (!art) return { anchor: null, hovered: null };
  const hovered = nearestCell(centerOf(art.getBoundingClientRect()), cardDrag.cells);
  if (hovered === null) return { anchor: null, hovered: null };
  const [rowOffset, colOffset] = state.active.offsets[cardDrag.grabbed];
  const row = Math.floor(hovered / W) - rowOffset, col = hovered % W - colOffset;
  return { anchor: row >= 0 && col >= 0 ? row * W + col : null, hovered };
}

// Vật lý bóng kéo: thân mèo (bị xách gáy) là lò xo nghiêng theo vận tốc kéo; chân sau + đuôi là
// con lắc, bị gia tốc của tay "hất" rồi tự đung đưa tắt dần. Không có anim lặp sẵn nào.
function startDragPhysics(ghost) {
  const cats = [...ghost.querySelectorAll('.cat')].map((cat, index) => ({
    cat, hang: cat.querySelector('.hang'), k: 1 + index * .12, tilt: 0, tiltV: 0, swing: 0, swingV: 0,
  }));
  const phys = { cats, vx: 0, lastVx: 0, lastX: null, lastT: 0, frame: 0, time: performance.now() };
  const step = now => {
    const dt = Math.min(.05, (now - phys.time) / 1000) || .016;
    phys.time = now;
    phys.vx *= Math.exp(-dt * 9); // tay dừng -> vận tốc về 0
    const ax = (phys.vx - phys.lastVx) / dt;
    phys.lastVx = phys.vx;
    cats.forEach(item => {
      const target = Math.max(-26, Math.min(26, phys.vx * .028 * item.k));
      item.tiltV += (-150 * (item.tilt - target) - 13 * item.tiltV) * dt;
      item.tilt += item.tiltV * dt;
      const swing = item.swing * Math.PI / 180;
      item.swingV += (-70 * Math.sin(swing) * 180 / Math.PI - 2.6 * item.swingV + ax * .045 * item.k) * dt;
      item.swingV = Math.max(-900, Math.min(900, item.swingV));
      item.swing = Math.max(-55, Math.min(55, item.swing + item.swingV * dt));
      item.cat.style.transform = `translateY(-38%) scale(1.05, 1.1) rotate(${item.tilt.toFixed(2)}deg)`;
      if (item.hang) item.hang.style.transform = `rotate(${(item.swing - item.tilt * .6).toFixed(2)}deg)`;
    });
    phys.frame = requestAnimationFrame(step);
  };
  if (!reduceMotion.matches) phys.frame = requestAnimationFrame(step);
  return phys;
}

function feedDragPhysics(phys, x) {
  const now = performance.now();
  if (phys.lastX !== null && now > phys.lastT) {
    const raw = (x - phys.lastX) / ((now - phys.lastT) / 1000);
    phys.vx = phys.vx * .55 + Math.max(-4000, Math.min(4000, raw)) * .45;
  }
  phys.lastX = x; phys.lastT = now;
}

// Con mèo trong thẻ gần điểm chạm nhất = con đang được cầm.
function grabbedPiece(x, y) {
  let best = 0, bestDistance = Infinity;
  $('active-card').querySelectorAll('.piece-object').forEach((piece, index) => {
    const center = centerOf(piece.getBoundingClientRect());
    const distance = Math.hypot(center.x - x, center.y - y);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return best;
}

function startCardDrag(event) {
  if (state.over || state.animating || event.button !== 0) return;
  event.preventDefault();
  const source = $('active-card');
  source.setPointerCapture(event.pointerId);
  const rect = source.getBoundingClientRect();
  cardDrag = {
    pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ghost: null, anchor: null,
    grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, width: rect.width, height: rect.height,
    grabbed: grabbedPiece(event.clientX, event.clientY), cells: null,
  };
  source.classList.add('dragging');
}

function moveCardDrag(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
  if (!cardDrag.ghost && Math.hypot(event.clientX - cardDrag.startX, event.clientY - cardDrag.startY) < 5) return;
  if (!cardDrag.ghost) {
    cardDrag.ghost = $('active-card').cloneNode(true);
    cardDrag.ghost.removeAttribute('id');
    cardDrag.ghost.className = 'piece-card drag-ghost';
    cardDrag.ghost.disabled = true;
    Object.assign(cardDrag.ghost.style, {
      width: `${cardDrag.width}px`, height: `${cardDrag.height}px`,
      transformOrigin: `${cardDrag.grabX}px ${cardDrag.grabY}px`,
    });
    document.body.append(cardDrag.ghost);
    // Mèo trong bóng kéo có cùng cỡ với mèo trên bàn: scale theo tỉ lệ ô bàn / ô trong thẻ (neo ở điểm cầm).
    const boardCell = document.querySelector('.cell[data-index="14"]')?.getBoundingClientRect();
    const piece = $('active-card').querySelector('.piece-object')?.getBoundingClientRect();
    if (boardCell && piece?.width) cardDrag.ghost.style.transform = `scale(${(boardCell.width / piece.width).toFixed(3)})`;
    cardDrag.cells = measureCells();
    cardDrag.holdRect = $('hold').getBoundingClientRect();
    cardDrag.physics = startDragPhysics(cardDrag.ghost);
  }
  feedDragPhysics(cardDrag.physics, event.clientX);
  cardDrag.ghost.style.left = `${event.clientX - cardDrag.grabX}px`;
  cardDrag.ghost.style.top = `${event.clientY - cardDrag.grabY}px`;
  // Kéo vào ô Gửi tạm: ưu tiên hơn bàn, sáng ô lên để báo thả được.
  const hold = cardDrag.holdRect;
  cardDrag.overHold = event.clientX >= hold.left - 8 && event.clientX <= hold.right + 8
    && event.clientY >= hold.top - 8 && event.clientY <= hold.bottom + 8;
  $('hold').classList.toggle('drop-target', cardDrag.overHold && !state.heldThisTurn);
  $('hold').classList.toggle('drop-blocked', cardDrag.overHold && state.heldThisTurn);
  if (cardDrag.overHold) {
    cardDrag.anchor = null; state.preview = null; state.previewAnchor = null;
    return paintPreview();
  }
  const { anchor, hovered } = dragAnchorFromGhost(cardDrag.ghost);
  const indices = anchor === null ? null : placementIndices(state.board, W, H, anchor, state.active.offsets);
  cardDrag.anchor = indices ? anchor : null;
  state.preview = indices;
  state.previewAnchor = hovered;
  paintPreview();
}

function finishCardDrag(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
  const { ghost, anchor, physics, overHold } = cardDrag;
  if (physics) cancelAnimationFrame(physics.frame);
  ghost?.remove();
  cardDrag = null;
  $('active-card').classList.remove('dragging');
  $('hold').classList.remove('drop-target', 'drop-blocked');
  state.preview = null; state.previewAnchor = null;
  paintPreview();
  if (!ghost) return event.type === 'pointerup' && rotateActive(); // chạm không kéo = xoay
  if (overHold && event.type === 'pointerup') {
    return state.heldThisTurn ? render('Mỗi lượt chỉ gửi tạm một lần.', true) : holdActive();
  }
  if (anchor !== null) placeAt(anchor);
  else render('Thả thẻ vào các ô sáng hợp lệ trên bàn.', true);
}

function render(message = '', error = false) {
  $('score').textContent = state.score;
  $('highscore').textContent = TARGET_SCORE;
  $('moves').textContent = state.moves;
  $('message').textContent = message || (state.over ? '' : 'Kéo thẻ lên bàn để đặt.');
  $('message').classList.toggle('error', error);
  renderBoard();
  renderCards();
  $('active-card').disabled = state.over;
  document.querySelector('.card-rotator').classList.toggle('can-rotate', !state.over && state.active.items.length > 1);
  // Thẻ dọc (nhiều hàng hơn cột) -> mũi tên xoay dựng dọc hai bên.
  const shape = normalizePreview(state.active.offsets);
  layoutHints(shape.rows > shape.cols, state.animateHints);
  $('hold').disabled = state.over || state.heldThisTurn;
}

// Ô bàn được giữ cố định; chỉ ô nào đổi mèo mới dựng lại. Không xoá/dựng lại cả 36 ô mỗi lần vẽ
// nên không bị chớp hình, không reset nhịp chớp mắt và không khựng khung hình.
function renderBoard() {
  const board = $('board');
  if (board.querySelectorAll(':scope > .cell').length !== W * H) {
    board.replaceChildren(...Array.from({ length: W * H }, (_, index) => {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.dataset.index = index;
      cell.renderedObject = undefined;
      return cell;
    }));
    board.onpointerleave = () => { state.preview = null; paintPreview(); };
  }
  board.querySelectorAll(':scope > .cell').forEach((cell, index) => {
    const object = state.board[index] || null;
    if (cell.renderedObject === object) return;
    cell.renderedObject = object;
    cell.getAnimations().forEach(animation => animation.cancel()); // bỏ fill:forwards của anim gom/bay
    cell.replaceChildren();
    cell.removeAttribute('style');
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}`;
    cell.setAttribute('aria-label', object ? `${object.name}, đã khóa` : `Ô ${index + 1}, trống`);
    if (!object) return;
    cell.style.setProperty('--group-color', categories[object.group].color);
    addArt(cell, object);
    if (state.justPlaced?.has(index) && !reduceMotion.matches) {
      cell.classList.add('drop');
      cell.addEventListener('animationend', () => cell.classList.remove('drop'), { once: true });
    }
  });
  state.previewKey = '';
  state.justPlaced = null;
}

function nextSlots() {
  const list = $('next-cards');
  while (list.children.length < PREVIEW_COUNT) {
    const slot = document.createElement('span'); slot.className = 'next-slot'; list.append(slot);
  }
  return [...list.children];
}

function renderCards() {
  const active = $('active-card'), hold = $('hold'), slots = nextSlots();
  const upcoming = state.deck.slice(0, PREVIEW_COUNT);
  const activeChanged = active.renderedCard !== state.active;
  const holdChanged = hold.renderedCard !== (state.hold || null);
  // Đo vị trí cũ trước khi đổi DOM.
  const cameFromHold = activeChanged && hold.renderedCard === state.active;
  const queueShifted = activeChanged && !cameFromHold && slots[0].renderedCard === state.active;
  const activeFrom = cameFromHold ? gridRect(hold) : queueShifted ? gridRect(slots[0]) : null;
  const holdFrom = holdChanged && state.hold === active.renderedCard ? gridRect(active) : null;
  const slotFrom = queueShifted ? slots.map((_, i) => gridRect(slots[i + 1])) : [];

  if (renderCard(active, state.active)) {
    if (activeFrom) flyFrom(active, activeFrom);
    else if (activeChanged) popIn(active);
  }
  if (renderCard(hold, state.hold, true) && holdFrom) flyFrom(hold, holdFrom);
  slots.forEach((slot, i) => {
    if (!renderCard(slot, upcoming[i], true)) return;
    if (slotFrom[i]) flyFrom(slot, slotFrom[i], 300);
    else popIn(slot, queueShifted ? 120 : 0);
  });
}

function paintPreview() {
  document.querySelectorAll('.cell.preview,.cell.preview-invalid').forEach(cell => cell.classList.remove('preview', 'preview-invalid'));
  // Chỉ tô ô trống; ô đã có mèo không bao giờ nhận hiệu ứng xem trước.
  state.preview?.forEach(index => document.querySelector(`.cell.empty[data-index="${index}"]`)?.classList.add('preview'));
  // Xem trước: hiện mờ đúng con mèo sẽ nằm ở từng ô (thứ tự indices = thứ tự món trong thẻ).
  const key = state.preview ? state.preview.join(',') + '|' + state.active.items.map(i => i.group).join(',') : '';
  if (key === state.previewKey) return paintInvalid();
  state.previewKey = key;
  document.querySelectorAll('.cell .preview-cat').forEach(el => el.remove());
  state.preview?.forEach((index, i) => {
    const cell = document.querySelector(`.cell.empty[data-index="${index}"]`);
    const item = state.active.items[i];
    if (!cell || !item) return;
    const holder = document.createElement('span'); holder.className = 'preview-cat';
    addArt(holder, item); cell.append(holder);
  });
  paintInvalid();
}

function paintInvalid() {
  if (!state.preview && state.previewAnchor !== null) document.querySelector(`.cell[data-index="${state.previewAnchor}"]`)?.classList.add('preview-invalid');
}

function newGame() {
  const board = Array(W * H).fill(null);
  startingBlocks.forEach(([row, col, name]) => { board[row * W + col] = { ...item(name), locked: true, starting: true }; });
  state = { board, deck: buildDeck(), active: null, hold: null, heldThisTurn: false, score: 0, moves: TURN_LIMIT, over: false, preview: null, previewAnchor: null };
  state.active = drawCard();
  render('Gom 3 mèo cùng loại liền kề để xóa chúng khỏi bàn.');
}

$('active-card').onpointerdown = startCardDrag;
document.addEventListener('pointermove', moveCardDrag);
document.addEventListener('pointerup', finishCardDrag);
document.addEventListener('pointercancel', finishCardDrag);
$('active-card').onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); rotateActive(); }
};
// Gửi tạm bằng cách kéo thẻ thả vào ô; bàn phím vẫn dùng Enter/Space để không mất khả năng truy cập.
$('hold').onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); holdActive(); }
};
$('restart').onclick = newGame;
$('help').onclick = () => $('help-dialog').showModal();
newGame();
