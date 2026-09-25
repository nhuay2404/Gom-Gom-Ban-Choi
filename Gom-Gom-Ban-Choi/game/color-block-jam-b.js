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
  state.active.offsets = rotateOffsets(state.active.offsets);
  state.preview = null;
  render();
  const card = $('active-card');
  card.classList.remove('spin'); void card.offsetWidth; card.classList.add('spin');
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
  // Hiện thẻ vừa đặt trên bàn trước, rồi mới chạy anim mèo vươn người + cụm lại.
  state.board = result.board;
  state.justPlaced = new Set(result.indices);
  state.animating = true;
  state.preview = null;
  render('');
  $('active-card').classList.add('waiting');
  const gained = match.cleared.length * POINTS_PER_CLEARED;
  const merges = match.clusters.map(cluster => ({ cluster, target: mergeTarget(cluster, result.indices, W) }));
  setTimeout(() => animateMerges(merges, gained).then(() => {
    state.animating = false;
    finishTurn(result, match);
  }), 260); // chờ anim rơi của block vừa đặt
}

function cellEl(index) {
  return document.querySelector(`.cell[data-index="${index}"]`);
}

const LIFT_MS = 560, MERGE_MS = 420, WIN_PAUSE_MS = 800;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Pha 1: mèo bị nhấc bổng lên, lộ bụng + chân sau lủng lẳng (CSS .lifted).
// Pha 2: cả cụm trượt vào mèo vừa đặt và nhỏ dần; mèo đích phồng lên rồi biến mất.
async function animateMerges(merges, gained) {
  const total = merges.reduce((n, m) => n + m.cluster.length, 0);
  merges.forEach(({ cluster }) => cluster.forEach((index, order) => {
    const cell = cellEl(index);
    if (!cell) return;
    cell.classList.add('merging', 'lifted');
    cell.style.setProperty('--lift-delay', `${order * 50}ms`);
  }));
  await wait(LIFT_MS);
  const animations = [];
  merges.forEach(({ cluster, target }) => {
    const targetCell = cellEl(target);
    if (!targetCell) return;
    cluster.forEach(index => {
      const cell = cellEl(index);
      if (!cell) return;
      if (index === target) {
        animations.push(cell.animate([
          { transform: 'none', opacity: 1 },
          { transform: 'scale(1.3)', opacity: 1, offset: .65 },
          { transform: 'scale(0)', opacity: 0 },
        ], { duration: MERGE_MS + 120, easing: 'ease-in-out', fill: 'forwards' }));
        return;
      }
      const dx = targetCell.offsetLeft - cell.offsetLeft, dy = targetCell.offsetTop - cell.offsetTop;
      animations.push(cell.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * .8}px, ${dy * .8}px) scale(.7)`, opacity: 1, offset: .75 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 },
      ], { duration: MERGE_MS, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' }));
    });
    showMergeScore(targetCell, Math.round(gained * cluster.length / total));
  });
  await Promise.all(animations.map(animation => animation.finished));
}
// Thắng: mọi mèo còn lại lần lượt bị nhấc bổng rồi bay vút lên, bàn trống trơn.
async function celebrateWin(message) {
  const cells = [...document.querySelectorAll('.cell.locked')];
  if (!reduceMotion.matches && cells.length) {
    state.animating = true;
    await wait(WIN_PAUSE_MS); // để người chơi thấy lần gom cuối + thông báo thắng trước
    cells.forEach((cell, order) => {
      cell.classList.add('merging', 'lifted');
      cell.style.setProperty('--lift-delay', `${order * 40}ms`);
    });
    await wait(LIFT_MS + cells.length * 40);
    await Promise.all(cells.map((cell, order) => cell.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(-30px) scale(1.05)', opacity: 1, offset: .3 },
      { transform: `translateY(-${260 + (order % 3) * 40}px) scale(.6) rotate(${order % 2 ? 14 : -14}deg)`, opacity: 0 },
    ], { duration: 620, delay: order * 45, easing: 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' }).finished));
    state.animating = false;
  }
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
  state.justPlaced = match.cleared.length && !reduceMotion.matches ? null : new Set(result.indices);
  $('active-card').classList.remove('waiting');
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

function cellAt(x, y) {
  const cell = document.elementFromPoint(x, y)?.closest('.cell');
  return cell ? Number(cell.dataset.index) : null;
}

// Anchor = góc trên-trái của hình, suy ra từ món đầu tiên của bóng thẻ đang nằm trên một ô.
function dragAnchorFromGhost(ghost) {
  const pieces = ghost.querySelectorAll('.piece-object');
  for (let i = 0; i < pieces.length; i++) {
    const rect = pieces[i].getBoundingClientRect();
    const cell = cellAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (cell === null) continue;
    const [rowOffset, colOffset] = state.active.offsets[i];
    const row = Math.floor(cell / W) - rowOffset, col = cell % W - colOffset;
    return { anchor: row >= 0 && col >= 0 ? row * W + col : null, hovered: cell };
  }
  return { anchor: null, hovered: null };
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
  }
  cardDrag.ghost.style.left = `${event.clientX - cardDrag.grabX}px`;
  cardDrag.ghost.style.top = `${event.clientY - cardDrag.grabY}px`;
  const { anchor, hovered } = dragAnchorFromGhost(cardDrag.ghost);
  const indices = anchor === null ? null : placementIndices(state.board, W, H, anchor, state.active.offsets);
  cardDrag.anchor = indices ? anchor : null;
  state.preview = indices;
  state.previewAnchor = hovered;
  paintPreview();
}

function finishCardDrag(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
  const { ghost, anchor } = cardDrag;
  ghost?.remove();
  cardDrag = null;
  $('active-card').classList.remove('dragging');
  state.preview = null; state.previewAnchor = null;
  paintPreview();
  if (!ghost) return event.type === 'pointerup' && rotateActive(); // chạm không kéo = xoay
  if (anchor !== null) placeAt(anchor);
  else render('Thả thẻ vào các ô sáng hợp lệ trên bàn.', true);
}

function render(message = '', error = false) {
  $('score').textContent = state.score;
  $('highscore').textContent = TARGET_SCORE;
  $('moves').textContent = state.moves;
  $('message').textContent = message || (state.over ? '' : 'Kéo thẻ lên bàn để đặt.');
  $('message').classList.toggle('error', error);
  const board = $('board'); board.replaceChildren(); state.previewKey = '';
  for (let index = 0; index < W * H; index++) {
    const cell = document.createElement('button');
    const object = state.board[index];
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}`;
    if (object && state.justPlaced?.has(index)) cell.classList.add('drop');
    cell.dataset.index = index;
    cell.setAttribute('aria-label', object ? `${object.name}, đã khóa` : `Ô ${index + 1}, trống`);
    if (object) { cell.style.setProperty('--group-color', categories[object.group].color); addArt(cell, object); }

    board.append(cell);
  }
  board.onpointerleave = () => { state.preview = null; paintPreview(); };
  state.justPlaced = null;
  renderCards();
  $('active-card').disabled = state.over;
  document.querySelector('.card-rotator').classList.toggle('can-rotate', !state.over && state.active.items.length > 1);
  $('hold').disabled = state.over || state.heldThisTurn;
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
  if (activeChanged) active.classList.remove('spin');
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
$('hold').onclick = holdActive;
$('restart').onclick = newGame;
$('help').onclick = () => $('help-dialog').showModal();
newGame();
