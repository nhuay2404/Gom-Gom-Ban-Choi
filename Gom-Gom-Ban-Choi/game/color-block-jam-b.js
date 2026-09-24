import { placementIndices, placeCard, rotateOffsets } from './color-block-jam-b-logic.mjs';

const W = 6, H = 6, TURN_LIMIT = 12, TARGET_SCORE = 180;
const $ = id => document.getElementById(id);
const artMap = {
  'Chó': 'dog', 'Mũ rơm': 'hat', 'Hành tinh nâu': 'jupiter', 'Mèo': 'cat',
  'Thỏ': 'rabbit', 'Gấu': 'hamster', 'Táo': 'apple', 'Chuối': 'banana',
  'Nho': 'grapes', 'Dâu': 'strawberry', 'Hoa': 'rose', 'Lá': 'bush',
  'Nấm': 'cactus', 'Ong': 'daisies', 'Mặt trời': 'sun', 'Mây': 'cloud',
};
const groups = {
  animal: ['Chó', 'Mèo', 'Thỏ', 'Gấu'],
  fruit: ['Táo', 'Chuối', 'Nho', 'Dâu'],
  garden: ['Hoa', 'Lá', 'Nấm', 'Ong'],
  sky: ['Hành tinh nâu', 'Mặt trời', 'Mây', 'Mũ rơm'],
};
const spriteNames = 'fork knife spoon ladle saturn mars venus jupiter apple banana grapes strawberry sun cloud rain snow cat dog rabbit hamster car bus plane boat shirt pants hat dress guitar piano drum trumpet fish whale octopus crab rose tulip cactus tree hammer wrench screwdriver saw deck paw bush daisies'.split(' ');
const spriteIndex = Object.fromEntries(spriteNames.map((name, index) => [name, index]));
const spriteRows = [30, 213, 391, 565, 737, 905];
const shapes = {
  single: [[0, 0]],
  domino: [[0, 0], [0, 1]],
  line: [[0, 0], [0, 1], [0, 2]],
  elbow: [[0, 0], [1, 0], [1, 1]],
};

let state, cardDrag = null;
const startingBlocks = [
  [0, 0, 'Táo'], [0, 5, 'Chó'], [2, 2, 'Lá'],
  [3, 4, 'Hành tinh nâu'], [5, 0, 'Dâu'], [5, 5, 'Mèo'],
];

function item(name) {
  const group = Object.entries(groups).find(([, names]) => names.includes(name))?.[0] || 'sky';
  return { name, group };
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
  const featured = { offsets: shapes.elbow.map(point => point.slice()), items: ['Chó', 'Mũ rơm', 'Hành tinh nâu'].map(item) };
  const cards = [featured];
  for (let index = 0; index < 23; index++) {
    const shapeName = index % 5 === 0 ? 'single' : index % 2 ? 'domino' : index % 3 ? 'line' : 'elbow';
    const names = shuffled(Object.values(groups).flat()).slice(0, shapes[shapeName].length);
    cards.push({ offsets: shapes[shapeName].map(point => point.slice()), items: names.map(item) });
  }
  return [featured, ...shuffled(cards.slice(1))];
}

function drawCard() {
  if (!state.deck.length) state.deck = buildDeck();
  return state.deck.shift();
}

function addArt(element, object) {
  const index = spriteIndex[artMap[object.name]];
  const art = document.createElement('span');
  art.className = `tile-art farm-sprite ${object.group}`;
  if (index !== undefined) {
    art.style.setProperty('--sprite-x', `${index % 8 * 100 / 7}%`);
    art.style.setProperty('--sprite-y', `${spriteRows[Math.floor(index / 8)] * 100 / 905}%`);
  }
  art.title = object.name;
  element.append(art);
}

function normalizePreview(offsets) {
  const maxRow = Math.max(...offsets.map(([row]) => row));
  const maxCol = Math.max(...offsets.map(([, col]) => col));
  return { rows: maxRow + 1, cols: maxCol + 1 };
}

function renderCard(container, card, compact = false) {
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
    addArt(cell, card.items[index]); grid.append(cell);
  });
  container.append(grid);
}

function rotateActive() {
  if (state.over || state.active.items.length < 2) return;
  state.active.offsets = rotateOffsets(state.active.offsets);
  state.preview = null;
  render();
}

function holdActive() {
  if (state.over || state.heldThisTurn) return;
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
  if (state.over) return;
  const result = placeCard(state.board, W, H, anchor, state.active);
  if (result.error) return render(result.error, true);
  state.board = result.board;
  state.score += result.score;
  state.moves--;
  state.heldThisTurn = false;
  state.preview = null;
  if (state.score >= TARGET_SCORE) {
    state.over = true;
    return render(`Bạn thắng với ${state.score} điểm! ✨`);
  }
  if (state.moves === 0) {
    state.over = true;
    return render(`Hết lượt — bạn đạt ${state.score}/${TARGET_SCORE} điểm.` , true);
  }
  state.active = drawCard();
  const fit = canPlaceAnywhere(state.active);
  render(fit ? `+${result.score} điểm. Thẻ đã được khóa trên bàn.` : `+${result.score} điểm. Thẻ mới không còn chỗ đặt — hãy dùng Gửi tạm.`, !fit);
}

function dragAnchorAt(x, y) {
  const cell = document.elementFromPoint(x, y)?.closest('.cell');
  return cell ? Number(cell.dataset.index) : null;
}

function startCardDrag(event) {
  if (state.over || event.button !== 0) return;
  event.preventDefault();
  const source = $('active-card');
  source.setPointerCapture(event.pointerId);
  cardDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ghost: null, anchor: null };
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
    document.body.append(cardDrag.ghost);
  }
  cardDrag.ghost.style.left = `${event.clientX}px`;
  cardDrag.ghost.style.top = `${event.clientY}px`;
  const anchor = dragAnchorAt(event.clientX, event.clientY);
  const indices = anchor === null ? null : placementIndices(state.board, W, H, anchor, state.active.offsets);
  cardDrag.anchor = indices ? anchor : null;
  state.preview = indices;
  state.previewAnchor = anchor;
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
  if (anchor !== null) placeAt(anchor);
  else if (ghost) render('Thả thẻ vào các ô sáng hợp lệ trên bàn.', true);
}

function render(message = '', error = false) {
  $('score').textContent = state.score;
  $('highscore').textContent = TARGET_SCORE;
  $('moves').textContent = state.moves;
  $('message').textContent = message || (state.over ? '' : 'Kéo thẻ lên bàn, hoặc chạm một ô để đặt.');
  $('message').classList.toggle('error', error);
  const board = $('board'); board.replaceChildren();
  for (let index = 0; index < W * H; index++) {
    const cell = document.createElement('button');
    const object = state.board[index];
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}`;
    cell.dataset.index = index;
    cell.setAttribute('aria-label', object ? `${object.name}, đã khóa` : `Ô ${index + 1}, chạm để đặt`);
    if (object) addArt(cell, object);
    else {
      cell.onclick = () => placeAt(index);
      cell.onpointerenter = () => { state.preview = placementIndices(state.board, W, H, index, state.active.offsets); paintPreview(); };
    }
    board.append(cell);
  }
  board.onpointerleave = () => { state.preview = null; paintPreview(); };
  renderCard($('active-card'), state.active);
  renderCard($('hold'), state.hold, true);
  $('active-card').disabled = state.over || state.active.items.length < 2;
  $('rotate').disabled = state.over || state.active.items.length < 2;
  $('hold').disabled = state.over || state.heldThisTurn;
}

function paintPreview() {
  document.querySelectorAll('.cell.preview,.cell.preview-invalid').forEach(cell => cell.classList.remove('preview', 'preview-invalid'));
  state.preview?.forEach(index => document.querySelector(`.cell[data-index="${index}"]`)?.classList.add('preview'));
  if (!state.preview && state.previewAnchor !== null) document.querySelector(`.cell[data-index="${state.previewAnchor}"]`)?.classList.add('preview-invalid');
}

function newGame() {
  const board = Array(W * H).fill(null);
  startingBlocks.forEach(([row, col, name]) => { board[row * W + col] = { ...item(name), locked: true, starting: true }; });
  state = { board, deck: buildDeck(), active: null, hold: null, heldThisTurn: false, score: 0, moves: TURN_LIMIT, over: false, preview: null, previewAnchor: null };
  state.active = drawCard();
  render('Kéo thẻ chữ L lên bàn. Các block có sẵn đã được khóa.');
}

$('active-card').onpointerdown = startCardDrag;
document.addEventListener('pointermove', moveCardDrag);
document.addEventListener('pointerup', finishCardDrag);
document.addEventListener('pointercancel', finishCardDrag);
$('rotate').onclick = rotateActive;
$('hold').onclick = holdActive;
$('restart').onclick = newGame;
$('help').onclick = () => $('help-dialog').showModal();
newGame();
