import { categories, catGroups, addArt } from './cats.mjs';
import {
  TRAY_SIZE, PARKING_SIZE, mulberry32, createLevel, chooseTarget, pick, pickable, moveOut, shuffleBoard,
} from './gom-gom-solitaire-logic.mjs';

const $ = id => document.getElementById(id);
const FIELD_COLS = 6, FLY_MS = 260, LIFT_MS = 560, MERGE_MS = 420;
// Độ khó đã chạy thử bằng bot (bot chơi kiểu thông thường thắng khoảng 64% → 42% từ màn 2 đến màn 5).
const LEVELS = [
  { depths: [7, 8, 7, 8, 8, 7], fieldRows: 2, targetTotal: 12, othersTotal: 9, bury: 0.6 },
  { depths: [8, 8, 8, 8, 8, 8], fieldRows: 2, targetTotal: 15, othersTotal: 9, bury: 0.75 },
  { depths: [9, 9, 9, 9, 9, 9], fieldRows: 1, targetTotal: 15, othersTotal: 9, bury: 0.8 },
  { depths: [12, 12, 12, 12, 12, 12], fieldRows: 1, targetTotal: 18, othersTotal: 12, bury: 0.9 },
  { depths: [13, 13, 13, 13, 13, 13], fieldRows: 0, targetTotal: 18, othersTotal: 12, bury: 0.95 },
];
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
    state: createLevel({ breeds: catGroups, fieldCols: FIELD_COLS, ...config }, rng),
  };
  $('result-dialog').open && $('result-dialog').close();
  render('Chạm một con mèo để chọn loại bạn muốn gom.');
}

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
  if (game.animating) return; // đang chạy anim gom 3
  const { state } = game;
  if (state.status === 'choose') {
    const card = pickable(state, source);
    if (!card) return;
    const result = chooseTarget(state, card.breed, game.rng, game.config.bury);
    if (result.error) return render(result.error, true);
    const before = captureRects();
    game.state = result.state; // Không cho hoàn tác về bước chọn mục tiêu.
    render(`Mục tiêu: gom hết ${game.state.targetTotal} ${categories[card.breed].name.toLowerCase()}. Mèo khác gom 3 con giống nhau trong khay.`);
    return animate(result.events, before);
  }
  commit(pick(state, source));
}

function useBooster(kind) {
  if (game.animating) return;
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

  $('columns').replaceChildren(...state.columns.map((column, index) => {
    const wrap = document.createElement('div'); wrap.className = 'column';
    const backs = document.createElement('span'); backs.className = 'column-backs';
    backs.style.setProperty('--hidden', Math.max(0, column.length - 1));
    const count = document.createElement('span'); count.className = 'column-count';
    count.textContent = column.length > 1 ? column.length - 1 : '';
    backs.append(count);
    wrap.append(backs);
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
    const element = document.createElement('span'); element.className = 'basket';
    for (let slot = 0; slot < 3; slot++) {
      const filled = basket * 3 + slot < state.collected;
      const seat = document.createElement('span');
      seat.className = `basket-seat${filled ? ' filled' : ''}`;
      seat.dataset.seat = basket * 3 + slot;
      if (filled) addArt(seat, state.target);
      element.append(seat);
    }
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
  document.querySelectorAll('.board [data-id], #parking [data-id]').forEach(element => rects.set(element.dataset.id, element.getBoundingClientRect()));
  return rects;
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fly(card, from, toElement, onLand) {
  if (!from || !toElement || reducedMotion()) return onLand?.();
  const to = toElement.getBoundingClientRect();
  const ghost = document.createElement('span');
  ghost.className = 'fly-ghost';
  addArt(ghost, card.breed);
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = to.width / from.width;
  toElement.style.visibility = 'hidden';
  ghost.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 30}px) scale(${(1 + scale) / 2 * 1.1})`, offset: 0.55 },
    { transform: `translate(${dx}px,${dy}px) scale(${scale})` },
  ], { duration: FLY_MS, easing: 'cubic-bezier(.4,.1,.3,1)' }).onfinish = () => {
    ghost.remove();
    toElement.style.visibility = '';
    toElement.classList.add('landed');
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

// Gom 3 trong khay: vẽ tạm khay lúc còn đủ bộ 3, mèo mới bay vào chỗ của nó, cả bộ bị nhấc bổng
// (lộ bụng + chân sau), rồi 2 con kia trượt vào con vừa đặt và cùng biến mất.
function mergeInTray(card, cleared, from) {
  const previous = game.history.at(-1)?.tray ?? [];
  const staged = previous.slice();
  const last = staged.findLastIndex(other => other.breed === card.breed);
  staged.splice(last < 0 ? staged.length : last + 1, 0, card);
  const finalTray = game.state.tray;
  renderTray(staged);
  const tileOf = id => document.querySelector(`#tray [data-id="${id}"]`);
  if (reducedMotion()) return renderTray(finalTray);
  game.animating = true;
  fly(card, from, tileOf(card.id), async () => {
    const tiles = cleared.map(other => tileOf(other.id)).filter(Boolean);
    const target = tileOf(card.id);
    tiles.forEach((tile, order) => { tile.classList.add('lifted'); tile.style.setProperty('--lift-delay', `${order * 50}ms`); });
    await wait(LIFT_MS);
    const targetRect = target.getBoundingClientRect();
    const animations = tiles.map(tile => {
      if (tile === target) {
        return tile.animate([
          { transform: 'none', opacity: 1 },
          { transform: 'scale(1.3)', opacity: 1, offset: .65 },
          { transform: 'scale(0)', opacity: 0 },
        ], { duration: MERGE_MS + 120, easing: 'ease-in-out', fill: 'forwards' });
      }
      const rect = tile.getBoundingClientRect();
      const dx = targetRect.left - rect.left, dy = targetRect.top - rect.top;
      return tile.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * .8}px, ${dy * .8}px) scale(.7)`, opacity: 1, offset: .75 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 },
      ], { duration: MERGE_MS, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' });
    });
    await Promise.all(animations.map(animation => animation.finished));
    burst(target);
    game.animating = false;
    // Trong lúc chờ, state có thể đã đổi (hoàn tác...) -> luôn vẽ theo state hiện tại.
    renderTray(game.state.tray);
    $('tray').classList.remove('pop'); void $('tray').offsetWidth; $('tray').classList.add('pop');
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
      mergeInTray(event.card, clear.cards, from);
    } else if (event.type === 'reveal') {
      document.querySelectorAll('.column')[event.column]?.querySelector('.tile')?.classList.add('revealed');
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
