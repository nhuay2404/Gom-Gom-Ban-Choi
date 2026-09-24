import { clearMatches, placementIndices, placeCard, rotateOffsets } from './color-block-jam-b-logic.mjs';

const W = 6, H = 6, TURN_LIMIT = 20, TARGET_SCORE = 120, PREVIEW_COUNT = 3;
const $ = id => document.getElementById(id);
const MATCH_SIZE = 4, POINTS_PER_CLEARED = 10;
// Chủ đề lấy theo bản gốc: mỗi nhóm có 4 món và màu đại diện riêng.
const categories = {
  animals: { name: 'Thú cưng', color: '#c9adf5', items: [['Mèo', 'cat'], ['Chó', 'dog'], ['Thỏ', 'rabbit'], ['Hamster', 'hamster']] },
  fruit: { name: 'Trái cây', color: '#ffc19b', items: [['Táo', 'apple'], ['Chuối', 'banana'], ['Nho', 'grapes'], ['Dâu tây', 'strawberry']] },
  planets: { name: 'Hành tinh', color: '#82dceb', items: [['Sao Thổ', 'saturn'], ['Sao Hỏa', 'mars'], ['Sao Kim', 'venus'], ['Sao Mộc', 'jupiter']] },
  weather: { name: 'Thời tiết', color: '#ffe16e', items: [['Nắng', 'sun'], ['Mây', 'cloud'], ['Mưa', 'rain'], ['Tuyết', 'snow']] },
  clothes: { name: 'Trang phục', color: '#f4b8ca', items: [['Áo', 'shirt'], ['Quần', 'pants'], ['Mũ', 'hat'], ['Váy', 'dress']] },
  garden: { name: 'Cây trong vườn', color: '#c5dea1', items: [['Hoa hồng', 'rose'], ['Tulip', 'tulip'], ['Xương rồng', 'cactus'], ['Cây táo', 'tree']] },
};
const catalog = Object.fromEntries(Object.entries(categories).flatMap(([group, category]) =>
  category.items.map(([name, glyph]) => [name, { name, glyph, group }])));
const allNames = Object.keys(catalog);
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
  [0, 0, 'Táo'], [0, 5, 'Chó'], [2, 2, 'Hoa hồng'],
  [3, 4, 'Sao Mộc'], [5, 0, 'Dâu tây'], [5, 5, 'Mèo'],
];
// Tỉ lệ hình thẻ: nhiều thẻ 1 ô để dễ lấp chỗ trống và gom nhóm.
// Mỗi 12 thẻ chỉ có 1 thẻ 3 ô (xen kẽ chữ I / chữ L).
const shapeBag = ['single', 'single', 'domino', 'single', 'single', 'domino', 'single', 'triple', 'single', 'domino', 'single', 'domino'];

function item(name) {
  return { ...catalog[name] };
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
    const names = shuffled(allNames).slice(0, shapes[shapeName].length);
    cards.push({ offsets: shapes[shapeName].map(point => point.slice()), items: names.map(item) });
  }
  return shuffled(cards);
}

function drawCard() {
  if (state.deck.length <= PREVIEW_COUNT) state.deck.push(...buildDeck());
  return state.deck.shift();
}

function addArt(element, object) {
  const index = spriteIndex[object.glyph];
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
    cell.style.setProperty('--group-color', categories[card.items[index].group].color);
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
  // Chỉ gom (xóa cụm 4+) mới có điểm; đặt thẻ thôi thì không.
  const match = clearMatches(result.board, W, H, MATCH_SIZE);
  const gained = match.cleared.length * POINTS_PER_CLEARED;
  state.board = match.board;
  state.score += gained;
  const clearedText = match.groups.length ? `Gom ${match.groups.map(group => categories[group].name).join(', ')}! +${gained} điểm.` : '';
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
  render(fit ? clearedText || 'Đã đặt thẻ. Gom 4 món cùng chủ đề để ghi điểm.' : `${clearedText} Thẻ mới không còn chỗ đặt — hãy dùng Gửi tạm.`.trim(), !fit);
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
  if (state.over || event.button !== 0) return;
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
  if (anchor !== null) placeAt(anchor);
  else if (ghost) render('Thả thẻ vào các ô sáng hợp lệ trên bàn.', true);
}

function hasSameGroupNeighbor(index) {
  const group = state.board[index]?.group, row = Math.floor(index / W), col = index % W;
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .some(([r, c]) => r >= 0 && r < H && c >= 0 && c < W && state.board[r * W + c]?.group === group);
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
    cell.className = `cell ${object ? `locked ${object.group}${hasSameGroupNeighbor(index) ? ' linked' : ''}` : 'empty'}`;
    cell.dataset.index = index;
    cell.setAttribute('aria-label', object ? `${object.name}, đã khóa` : `Ô ${index + 1}, chạm để đặt`);
    if (object) { cell.style.setProperty('--group-color', categories[object.group].color); addArt(cell, object); }
    else {
      cell.onclick = () => placeAt(index);
      cell.onpointerenter = () => { state.preview = placementIndices(state.board, W, H, index, state.active.offsets); paintPreview(); };
    }
    board.append(cell);
  }
  board.onpointerleave = () => { state.preview = null; paintPreview(); };
  renderCard($('active-card'), state.active);
  renderCard($('hold'), state.hold, true);
  $('next-cards').replaceChildren(...state.deck.slice(0, PREVIEW_COUNT).map(card => {
    const slot = document.createElement('span'); slot.className = 'next-slot';
    renderCard(slot, card, true); return slot;
  }));
  $('active-card').disabled = state.over;
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
  render('Gom 4 món cùng nhóm liền kề để xóa chúng khỏi bàn.');
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
