import { categories, allCatGroups, addArt } from './cats.mjs';
import {
  TRAY_SIZE, PARKING_SIZE, mulberry32, createLevel, chooseTarget, pick, pickable, moveOut, shuffleBoard,
} from './gom-gom-solitaire-logic.mjs';

const $ = id => document.getElementById(id);
const FIELD_COLS = 10, FLY_MS = 260, LIFT_MS = 560, MERGE_MS = 420;
// Bố cục theo 挖菜菜: 10 cột úp sâu tới ~20 thẻ, bãi cỏ 3 × 10, 6 giỏ × 3 = 18 mèo mục tiêu, khay 8 ô, 16 loại mèo.
// Mèo phụ được xếp thành bộ 3 cùng tầng (xem chooseTarget); `chaos` là tỉ lệ xáo lẫn, càng cao càng khó.
function level(depth, chaos, fieldRows = 3) {
  const visible = FIELD_COLS + FIELD_COLS * fieldRows;
  let hidden = FIELD_COLS * (depth - 1);
  while ((visible + hidden - 18) % 3) hidden--;
  const units = (visible + hidden - 18) / 3, others = allCatGroups.length - 1;
  const othersTotal = Array.from({ length: others }, (_, index) => 3 * (Math.floor(units / others) + (index < units % others ? 1 : 0)));
  const depths = Array.from({ length: FIELD_COLS }, (_, index) => 1 + Math.floor(hidden / FIELD_COLS) + (index < hidden % FIELD_COLS ? 1 : 0));
  return { depths, fieldRows, targetTotal: 18, othersTotal, bury: 0.5, chaos };
}
// Bot chơi tốt (không dùng trợ giúp) thắng khoảng 99% → 87% → 67% → 49% → 26%.
const LEVELS = [level(14, 0), level(17, 0.005), level(20, 0.01), level(20, 0.02), level(20, 0.03)];
const BOOSTERS = { undo: 3, shuffle: 1, moveOut: 1 };

let game;
// Biểu cảm gắn theo id để mỗi con giữ nguyên mặt qua các lần vẽ lại.

function storedLevel() {
  try { return Math.max(0, Number(localStorage.getItem('gomgom-solitaire-level')) || 0); } catch { return 0; }
}
function storeLevel(level) {
  try { localStorage.setItem('gomgom-solitaire-level', String(level)); } catch { /* chế độ riêng tư: bỏ qua */ }
}

function newGame(level = game?.level ?? storedLevel()) {
  const config = LEVELS[Math.min(level, LEVELS.length - 1)];
  const rng = mulberry32((Date.now() ^ (level * 7919)) >>> 0);
  game = {
    level, config, rng, history: [], boosters: { ...BOOSTERS }, revived: false,
    state: createLevel({ breeds: allCatGroups, fieldCols: FIELD_COLS, ...config }, rng),
  };
  $('result-dialog').open && $('result-dialog').close();
  render('Chạm một con mèo để chọn loại bạn muốn gom.');
  fitStacks();
}

// Độ dày mỗi mép thẻ úp được tính để cả màn vừa khít chiều cao màn hình (giống 挖菜菜: chồng thẻ mỏng, xếp khít).
function fitStacks() {
  const board = document.querySelector('.board');
  const maxHidden = Math.max(1, Math.max(...game.config.depths) - 1);
  const current = parseFloat(getComputedStyle(board).getPropertyValue('--card-edge-h')) || 10;
  const boosters = document.querySelector('.boosters');
  // margin-top:auto của hàng nút = phần còn trống; chia đều cho các mép thẻ.
  const spare = boosters.getBoundingClientRect().top - document.querySelector('.tray-wrap').getBoundingClientRect().bottom - 22;
  const edge = Math.min(18, Math.max(5, current + spare / maxHidden));
  board.style.setProperty('--card-edge-h', `${edge.toFixed(2)}px`);
}
addEventListener('resize', () => game && fitStacks());

// ---------- Hành động ----------

function commit(result, message) {
  if (result.error) return render(result.error, true);
  const before = captureRects();
  game.history.push(game.state);
  game.state = result.state;
  render(message ?? describe(result.events));
  animate(result.events, before);
  if (game.state.status === 'won' || game.state.status === 'lost') setTimeout(showResult, FLY_MS + 420);
}

function describe(events) {
  const clear = events.find(event => event.type === 'clear');
  if (clear) return `Gom 3 ${categories[clear.breed].name.toLowerCase()}!`;
  const collected = events.filter(event => event.type === 'collect').length;
  if (collected) return `+${collected} ${categories[game.state.target].name.toLowerCase()} vào giỏ.`;
  const free = TRAY_SIZE - game.state.tray.length;
  return free <= 2 ? `Khay chỉ còn ${free} ô trống!` : '';
}

function onPick(source) {
  const { state } = game;
  if (state.status === 'choose') {
    const card = pickable(state, source);
    if (!card) return;
    const result = chooseTarget(state, card.breed, game.rng, game.config.bury, game.config.chaos);
    if (result.error) return render(result.error, true);
    const before = captureRects();
    game.state = result.state; // Không cho hoàn tác về bước chọn mục tiêu.
    render(`Mục tiêu: gom hết ${game.state.targetTotal} ${categories[card.breed].name.toLowerCase()}. Mèo khác gom 3 con giống nhau trong khay.`);
    return animate(result.events, before);
  }
  commit(pick(state, source));
}

function useBooster(kind) {
  if (!game.boosters[kind]) return render('Đã dùng hết lượt của trợ giúp này.', true);
  if (kind === 'undo') {
    if (!game.history.length) return render('Chưa có nước nào để hoàn tác.', true);
    game.state = game.history.pop();
    game.boosters.undo--;
    return render('Đã hoàn tác một nước.');
  }
  const result = kind === 'shuffle' ? shuffleBoard(game.state, game.rng) : moveOut(game.state);
  if (result.error) return render(result.error, true);
  game.boosters[kind]--;
  commit(result, kind === 'shuffle' ? 'Đã xáo lại mèo trên bàn.' : 'Đã gỡ mèo ra hàng chờ. Chạm để đưa lại vào khay.');
}

function revive() {
  const result = moveOut(game.state);
  if (result.error) return render(result.error, true);
  game.revived = true;
  $('result-dialog').close();
  commit(result, 'Hồi sinh! 3 con mèo đã ra hàng chờ.');
}

function showResult() {
  const { state } = game, dialog = $('result-dialog');
  if (dialog.open || (state.status !== 'won' && state.status !== 'lost')) return;
  const won = state.status === 'won';
  const canRevive = !won && !game.revived && state.parking.length < PARKING_SIZE;
  dialog.classList.toggle('won', won);
  $('result-title').textContent = won ? 'Qua màn!' : 'Khay đầy rồi';
  $('result-text').textContent = won
    ? `Bạn đã gom đủ ${state.targetTotal} ${categories[state.target].name.toLowerCase()}.`
    : `Mới gom được ${state.collected}/${state.targetTotal} ${categories[state.target].name.toLowerCase()}.`
      + (canRevive ? ' Hồi sinh để gỡ 3 mèo ra hàng chờ và chơi tiếp.' : '');
  $('result-revive').hidden = !canRevive;
  $('result-undo').hidden = won || !game.boosters.undo;
  $('result-next').hidden = !won;
  if (won) storeLevel(game.level + 1);
  dialog.showModal();
}

// ---------- Vẽ ----------

function catButton(card, source, { className = 'tile', label } = {}) {
  const button = document.createElement('button');
  button.className = `${className} ${card.breed}`;
  button.dataset.id = card.id;
  button.style.setProperty('--group-color', categories[card.breed].color);
  button.setAttribute('aria-label', label ?? categories[card.breed].name);
  addArt(button, card.breed);
  if (source) button.onclick = () => onPick(source);
  else button.disabled = true;
  return button;
}

function emptySlot(className) {
  const slot = document.createElement('span'); slot.className = className; return slot;
}

function render(message = '', error = false) {
  const { state } = game, choosing = state.status === 'choose', playing = state.status === 'playing';
  const interactive = choosing || playing;
  document.body.classList.toggle('choosing', choosing);
  $('level').textContent = game.level + 1;

  const goal = $('goal');
  goal.replaceChildren();
  if (state.target) {
    const icon = document.createElement('span'); icon.className = 'goal-cat'; addArt(icon, state.target);
    const text = document.createElement('span');
    text.innerHTML = `Gom hết <b>${categories[state.target].name}</b>`;
    const count = document.createElement('strong'); count.textContent = `${state.collected}/${state.targetTotal}`;
    goal.append(icon, text, count);
  } else goal.textContent = 'Chọn loại mèo bạn muốn gom';

  document.querySelector('.board').style.setProperty('--cols', state.columns.length);
  $('columns').replaceChildren(...state.columns.map((column, index) => {
    const wrap = document.createElement('div'); wrap.className = 'column';
    const backs = document.createElement('span'); backs.className = 'column-backs';
    const hidden = Math.max(0, column.length - 1);
    backs.style.setProperty('--hidden', hidden);
    // Mỗi thẻ úp là một mép thẻ cao cố định; phần đã đào thành khoảng trống phía trên (spacer)
    // để thẻ đáy các cột luôn thẳng hàng.
    const maxHidden = Math.max(1, ...game.config.depths) - 1;
    const spacer = document.createElement('span'); spacer.className = 'column-spacer';
    spacer.style.setProperty('--gap-cards', Math.max(0, maxHidden - hidden));
    const count = document.createElement('span'); count.className = 'column-count';
    count.textContent = hidden || '';
    backs.append(count);
    wrap.append(spacer, backs);
    const front = column.at(-1);
    wrap.append(front
      ? catButton(front, interactive && { zone: 'column', index }, { label: `${categories[front.breed].name}, cột ${index + 1}, còn ${column.length - 1} thẻ úp` })
      : emptySlot('tile empty'));
    return wrap;
  }));

  const field = $('field');
  field.hidden = !state.field.length;
  field.replaceChildren(...state.field.map((card, index) => card
    ? catButton(card, interactive && { zone: 'field', index })
    : emptySlot('tile empty')));

  const baskets = $('baskets');
  const basketCount = state.target ? state.targetTotal / 3 : game.config.targetTotal / 3;
  baskets.replaceChildren(...Array.from({ length: basketCount }, (_, basket) => {
    // Hộp gỗ 3D thật (CSS 3D): 5 mặt + hàng ghế mèo đặt giữa lòng hộp.
    const element = document.createElement('span'); element.className = 'basket';
    const box = document.createElement('span'); box.className = 'box3d';
    const face = name => { const side = document.createElement('span'); side.className = `box-face box-${name}`; return side; };
    const seats = document.createElement('span'); seats.className = 'box-seats';
    for (let slot = 0; slot < 3; slot++) {
      const filled = basket * 3 + slot < state.collected;
      const seat = document.createElement('span');
      seat.className = `basket-seat${filled ? ' filled' : ''}`;
      seat.dataset.seat = basket * 3 + slot;
      if (filled) addArt(seat, state.target);
      seats.append(seat);
    }
    box.append(face('bottom'), face('back'), face('left'), face('right'), seats, face('front'));
    element.append(box);
    return element;
  }));

  $('parking').replaceChildren(...Array.from({ length: PARKING_SIZE }, (_, index) => {
    const card = state.parking[index];
    return card ? catButton(card, playing && { zone: 'parking', index }, { className: 'tile mini' }) : emptySlot('tile mini empty');
  }));
  $('parking-row').classList.toggle('used', state.parking.length > 0);

  renderTray(state.tray);

  for (const kind of Object.keys(BOOSTERS)) {
    const button = $(`booster-${kind}`);
    button.querySelector('.booster-count').textContent = game.boosters[kind];
    const usable = kind === 'undo' ? game.history.length > 0 && state.status !== 'won'
      : kind === 'shuffle' ? playing : playing && state.tray.length > 0 && state.parking.length < PARKING_SIZE;
    button.disabled = !game.boosters[kind] || !usable;
  }

  $('message').textContent = message;
  $('message').classList.toggle('error', error);
}

function renderTray(cards) {
  $('tray').replaceChildren(...Array.from({ length: TRAY_SIZE }, (_, index) => {
    const card = cards[index];
    const slot = document.createElement('span'); slot.className = 'tray-slot'; slot.dataset.slot = index;
    if (card) slot.append(catButton(card, null, { className: 'tile in-tray' }));
    return slot;
  }));
  $('tray').classList.toggle('danger', cards.length >= TRAY_SIZE - 2);
}

// ---------- Hiệu ứng: bóng mèo bay từ chỗ cũ tới chỗ mới ----------

function captureRects() {
  const rects = new Map();
  document.querySelectorAll('.board [data-id], #parking [data-id], #tray [data-id]').forEach(element => rects.set(element.dataset.id, element.getBoundingClientRect()));
  return rects;
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fly(card, from, toElement, onLand) {
  if (!from || !toElement || reducedMotion()) return onLand?.();
  const isRect = toElement instanceof DOMRect;
  const to = isRect ? toElement : toElement.getBoundingClientRect();
  const ghost = document.createElement('span');
  ghost.className = 'fly-ghost';
  addArt(ghost, card.breed);
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / from.width;
  if (!isRect) toElement.style.visibility = 'hidden';
  ghost.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 30}px) scale(${(1 + scale) / 2 * 1.1})`, offset: 0.55 },
    { transform: `translate(${dx}px,${dy}px) scale(${scale})` },
  ], { duration: FLY_MS, easing: 'cubic-bezier(.4,.1,.3,1)' }).onfinish = () => {
    ghost.remove();
    if (!isRect) { toElement.style.visibility = ''; toElement.classList.add('landed'); }
    onLand?.();
  };
}

function burst(element) {
  if (!element || reducedMotion()) return;
  const rect = element.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const star = document.createElement('span');
    star.className = 'spark';
    star.textContent = i % 2 ? '✦' : '★';
    Object.assign(star.style, { left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px` });
    document.body.append(star);
    const angle = (Math.PI * 2 * i) / 6, distance = 26 + Math.random() * 14;
    star.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px),calc(-50% + ${Math.sin(angle) * distance}px)) scale(1)`, opacity: 0 },
    ], { duration: 520, easing: 'ease-out' }).onfinish = () => star.remove();
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Gom 3 trong khay: khay thật vẽ ngay theo state (người chơi chọn tiếp được), còn anim chạy trên bóng mèo.
// Mèo mới bay tới cạnh 2 con cùng loại, cả bộ bị nhấc bổng (lộ bụng + chân sau), rồi cụm lại và biến mất.
function mergeInTray(card, cleared, from, before) {
  if (reducedMotion()) return;
  const others = cleared.filter(other => other.id !== card.id);
  const rects = others.map(other => before.get(String(other.id))).filter(Boolean);
  const last = rects.at(-1);
  if (!from || !last) return;
  const gap = rects.length > 1 ? rects[1].left - rects[0].left : last.width + 4;
  const landing = new DOMRect(last.left + gap, last.top, last.width, last.height);
  const ghostAt = (cat, rect) => {
    const ghost = document.createElement('span');
    ghost.className = 'tile in-tray merge-ghost';
    ghost.style.setProperty('--group-color', categories[cat.breed].color);
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    addArt(ghost, cat.breed);
    document.body.append(ghost);
    return ghost;
  };
  // Bóng 2 con cũ đứng yên tại chỗ cũ trong lúc con mới bay tới.
  const ghosts = others.map((other, index) => ghostAt(other, rects[index] ?? last));
  fly(card, from, landing, async () => {
    const target = ghostAt(card, landing);
    const all = [...ghosts, target];
    all.forEach((ghost, order) => { ghost.classList.add('lifted'); ghost.style.setProperty('--lift-delay', `${order * 50}ms`); });
    await wait(LIFT_MS);
    const animations = all.map(ghost => {
      if (ghost === target) {
        return ghost.animate([
          { transform: 'none', opacity: 1 },
          { transform: 'scale(1.3)', opacity: 1, offset: .65 },
          { transform: 'scale(0)', opacity: 0 },
        ], { duration: MERGE_MS + 120, easing: 'ease-in-out', fill: 'forwards' });
      }
      const rect = ghost.getBoundingClientRect();
      const dx = landing.left - rect.left, dy = landing.top - rect.top;
      return ghost.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * .8}px, ${dy * .8}px) scale(.7)`, opacity: 1, offset: .75 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 },
      ], { duration: MERGE_MS, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' });
    });
    await Promise.all(animations.map(animation => animation.finished));
    burst(target);
    all.forEach(ghost => ghost.remove());
  });
}
function animate(events, before) {
  let basketSeat = game.state.collected - events.filter(event => event.type === 'collect').length;
  for (const event of events) {
    const from = event.card && before.get(String(event.card.id));
    if (event.type === 'collect') {
      const seat = document.querySelector(`[data-seat="${basketSeat++}"]`);
      fly(event.card, from, seat, () => burst(seat));
    } else if (event.type === 'tray') {
      const clear = events.find(other => other.type === 'clear');
      if (!clear) { fly(event.card, from, document.querySelector(`#tray [data-id="${event.card.id}"]`)); continue; }
      mergeInTray(event.card, clear.cards, from, before);
    } else if (event.type === 'reveal') {
      // Cả chồng tụt xuống một mép thẻ: thẻ úp kế tiếp trượt xuống chỗ thẻ đáy vừa lấy.
      const column = document.querySelectorAll('.column')[event.column];
      const edge = parseFloat(getComputedStyle(document.querySelector('.board')).getPropertyValue('--card-edge-h')) || 10;
      if (column && !reducedMotion()) {
        column.querySelectorAll('.column-backs, .tile').forEach(element => element.animate(
          [{ transform: `translateY(${-edge}px)` }, { transform: 'none' }],
          { duration: 240, easing: 'cubic-bezier(.25,.8,.35,1)' },
        ));
      }
    } else if (event.type === 'shuffle') {
      document.querySelectorAll('.board .tile:not(.empty)').forEach(tile => tile.classList.add('shuffled'));
    }
  }
}

// ---------- Gắn sự kiện ----------

$('restart').onclick = () => newGame();
$('help').onclick = () => $('help-dialog').showModal();
$('booster-undo').onclick = () => useBooster('undo');
$('booster-shuffle').onclick = () => useBooster('shuffle');
$('booster-moveOut').onclick = () => useBooster('moveOut');
$('result-revive').onclick = revive;
$('result-undo').onclick = () => { $('result-dialog').close(); useBooster('undo'); };
$('result-retry').onclick = () => newGame();
$('result-next').onclick = () => newGame(game.level + 1);
$('result-dialog').addEventListener('cancel', event => event.preventDefault());
newGame();
