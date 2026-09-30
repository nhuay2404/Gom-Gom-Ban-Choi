import { clearMatches, mergeTarget, placementIndices, placeCard, rotateOffsets } from './board-rules.mjs';
import { MATCH_SIZE, clusterPoints, matchPoints } from './scoring.mjs';
import { categories, catMarkup, addArt as addCatArt, AFK_MOODS } from './cat-art.mjs';
import { LEVELS, parseBoard, makeDealer, starsFor } from './levels.mjs';

// Mỗi màn (levels.mjs): đạt điểm mục tiêu trong giới hạn lượt. Hết lượt hoặc hết chỗ đặt là thua.
const W = 6, H = 6, PREVIEW_COUNT = 1;
const $ = id => document.getElementById(id);
const DRAG_BOOST = 1.6, DRAG_SHRINK_RANGE = 110;
let state, cardDrag = null;
function item(group) {
  return { group, name: categories[group].name };
}

function drawCard() {
  while (state.deck.length <= PREVIEW_COUNT) {
    const card = state.deal(state.board);
    state.deck.push({ offsets: card.offsets, items: card.items.map(({ group }) => item(group)) });
  }
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
  if (!tutorialAllows('rotate')) return;
  // Ghi vị trí từng mèo trước khi xoay (đang giữa anim thì lấy đúng chỗ đang hiện -> bấm liên tục vẫn liền mạch).
  const before = [...$('active-card').querySelectorAll('.piece-object')].map(piece => centerOf(piece.getBoundingClientRect()));
  state.active.offsets = rotateOffsets(state.active.offsets);
  state.preview = null;
  state.animateHints = true; // render() sẽ cho mũi tên trượt theo cung thay vì nhảy
  render();
  tutorialDone('rotate');
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
  // Thẻ 3 mèo: mũi tên nhỏ lại. Mọi thẻ: mèo co vào vùng bên trong vòng mũi tên, không đè mũi tên.
  const crowded = state.active.items.length >= 3;
  hints.forEach(hint => hint.classList.toggle('small', crowded));
  const arrowHeight = hints[0].offsetHeight || card.width * .3;
  fitInsideHints(!state.over && state.active.items.length > 1, arrowsVertical(), card, arrowHeight);
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
    return Math.min(68, (width - pad - gap * (cols - 1)) / cols, (height - pad - gap * (rows - 1)) / rows);
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

// Thả mèo vào ô gửi tạm: mèo rơi từ trên xuống, nảy nhẹ (không co giãn), ô lún xuống rồi bật lại, khói phì ra hai bên.
let holdDropped = false;
function dropIntoHold(hold) {
  if (reduceMotion.matches) return;
  hold.querySelector('.piece-grid')?.animate([
    { translate: '0 -34px', opacity: 0 },
    { translate: '0 4px', opacity: 1, offset: .55 },
    { translate: '0 -5px', offset: .78 },
    { translate: '0 0', opacity: 1 },
  ], { duration: 420, easing: 'cubic-bezier(.5, 0, .5, 1)' });
  hold.animate([
    { translate: '0 0' }, { translate: '0 4px', offset: .5 }, { translate: '0 -2px', offset: .78 }, { translate: '0 0' },
  ], { duration: 420, delay: 120, easing: 'ease-out' });
  const puff = document.createElement('span');
  puff.className = 'hold-puff';
  for (let i = 0; i < 6; i++) {
    const blob = document.createElement('i');
    blob.style.setProperty('--dx', `${(i % 2 ? 1 : -1) * (18 + Math.random() * 22)}px`);
    blob.style.setProperty('--dy', `${-(2 + Math.random() * 12)}px`);
    blob.style.setProperty('--s', (0.9 + Math.random() * 0.6).toFixed(2));
    puff.append(blob);
  }
  hold.parentElement.append(puff);
  const box = hold.getBoundingClientRect(), parent = hold.parentElement.getBoundingClientRect();
  puff.style.cssText = `left:${box.left - parent.left}px;top:${box.top - parent.top}px;width:${box.width}px;height:${box.height}px`;
  setTimeout(() => puff.remove(), 1000);
}

function holdActive() {
  if (state.over || state.animating) return;
  if (!tutorialAllows('hold')) return render('Làm theo hướng dẫn nhé!', true);
  const previous = state.hold;
  state.hold = state.active;
  state.active = previous || drawCard();
  state.preview = null;
  render();
  tutorialDone(previous ? 'tapHold' : 'hold');
  checkStuck();
}

function canPlaceAnywhere(card) {
  let offsets = card.offsets;
  for (let turn = 0; turn < 4; turn++, offsets = rotateOffsets(offsets)) {
    if (state.board.some((_, index) => placementIndices(state.board, W, H, index, offsets))) return true;
  }
  return false;
}
// Thua vì hết chỗ: cả thẻ đang bóc lẫn thẻ gửi tạm đều không vừa bàn (ô gửi tạm trống thì vẫn còn đường rút thẻ).
function checkStuck() {
  if (state.over || canPlaceAnywhere(state.active) || !state.hold || canPlaceAnywhere(state.hold)) return false;
  endLevel(false, 'Hết chỗ đặt!');
  return true;
}

function placeAt(anchor) {
  if (state.over || state.animating) return;
  if (!tutorialAllows('place', anchor)) return render('Kéo vào ô sáng nhé!', true);
  const result = placeCard(state.board, W, H, anchor, state.active);
  if (result.error) return render(result.error, true);
  // Chỉ gom (xóa cụm 3+) mới có điểm; đặt thẻ thôi thì không.
  const match = clearMatches(result.board, W, H, MATCH_SIZE);
  if (!match.cleared.length || reduceMotion.matches) return finishTurn(result, match);
  // State được chốt ngay (cụm biến mất, điểm cộng, rút thẻ mới) để người chơi đặt tiếp liền.
  // Anim gom chạy trên các "bóng mèo" phủ đúng chỗ cũ, không chặn thao tác.
  const merges = match.clusters.map(cluster => ({ cluster, target: mergeTarget(cluster, result.indices, W) }));
  const ghosts = spawnMergeGhosts(merges, result);
  const done = animateMerges(ghosts, merges);
  breakCrates(match.broken, DROP_MS + LIFT_MS + MERGE_MS * .7);
  pendingMerges.add(done);
  done.finally(() => pendingMerges.delete(done));
  finishTurn(result, match);
}

// Thùng gỗ: ô chặn không đặt mèo lên được, vỡ khi gom mèo sát bên (luật ở board-rules.mjs).
const CRATE_SVG = `<svg class="crate" viewBox="0 0 100 100" aria-hidden="true">
  <rect x="6" y="10" width="88" height="84" rx="12" fill="#8a5429"/>
  <rect x="6" y="4" width="88" height="84" rx="12" fill="#d49256"/>
  <rect x="14" y="12" width="72" height="68" rx="6" fill="#c07c40"/>
  <path d="M14 34H86M14 58H86" stroke="#a4632d" stroke-width="3"/>
  <path d="M20 18L80 74M80 18L20 74" stroke="#e7ad6e" stroke-width="10" stroke-linecap="round"/>
  <path d="M20 18L80 74M80 18L20 74" stroke="#b97237" stroke-width="3" stroke-linecap="round" opacity=".5"/>
  <g fill="#6d4020"><circle cx="16" cy="14" r="3"/><circle cx="84" cy="14" r="3"/><circle cx="16" cy="78" r="3"/><circle cx="84" cy="78" r="3"/></g>
  <rect x="10" y="7" width="80" height="6" rx="3" fill="#f2c28a" opacity=".6"/>
</svg>`;

// Bóng thùng giữ nguyên chỗ cũ tới lúc gom xong, rung lên rồi vỡ thành mảnh gỗ văng ra + khói.
function breakCrates(indices, delay) {
  if (!indices?.length || reduceMotion.matches) return;
  const layer = fxLayer();
  indices.forEach(index => {
    const cell = cellEl(index);
    if (!cell) return;
    const ghost = document.createElement('span');
    ghost.className = 'cell block crate-ghost';
    ghost.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    ghost.innerHTML = CRATE_SVG;
    layer.append(ghost);
    setTimeout(async () => {
      await ghost.animate([
        { rotate: '0deg' }, { rotate: '-7deg' }, { rotate: '6deg' }, { rotate: '-4deg' }, { rotate: '0deg' },
      ], { duration: 180 }).finished.catch(() => {});
      for (let i = 0; i < 6; i++) {
        const shard = document.createElement('span');
        shard.className = 'crate-shard';
        shard.style.cssText = `left:${cell.offsetLeft + cell.offsetWidth / 2}px;top:${cell.offsetTop + cell.offsetHeight / 2}px`;
        layer.append(shard);
        const angle = (i / 6) * Math.PI * 2 + Math.random() * .6, dist = cell.offsetWidth * (.6 + Math.random() * .5);
        shard.animate([
          { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 18}px)) rotate(${(Math.random() - .5) * 540}deg)`, opacity: 0 },
        ], { duration: 560, easing: 'cubic-bezier(.2, .7, .4, 1)', fill: 'forwards' }).finished.then(() => shard.remove());
      }
      spawnPuff(ghost);
      ghost.remove();
    }, delay);
  });
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

// Khói phì ra khi mèo đáp xuống ô: vài cụm bụi tròn toả ra hai bên đáy ô rồi tan.
const PUFF_COUNT = 8;
function spawnPuff(cell) {
  const puff = document.createElement('span');
  puff.className = 'land-puff';
  puff.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
  for (let i = 0; i < PUFF_COUNT; i++) {
    const side = i % 2 ? 1 : -1, spread = 0.5 + Math.random() * 0.6;
    const blob = document.createElement('i');
    blob.style.setProperty('--dx', `${side * spread * cell.offsetWidth * 0.7}px`);
    blob.style.setProperty('--dy', `${-(2 + Math.random() * 18)}px`);
    blob.style.setProperty('--s', (1 + Math.random() * 0.7).toFixed(2));
    blob.style.animationDelay = `${Math.random() * 40}ms`;
    puff.append(blob);
  }
  // Khói nằm trên các ô khác nhưng dưới mèo vừa đặt (mèo được nhấc lên trục Z trong lúc khói bay).
  fxLayer().append(puff);
  cell.classList.add('puff-top');
  setTimeout(() => cell.classList.remove('puff-top'), 1000);
  setTimeout(() => puff.remove(), 1000);
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
    if (placed.has(index)) spawnPuff(ghost);
  });
  return ghosts;
}

// Pha 1: mèo bị nhấc bổng lên, lộ bụng + chân sau lủng lẳng (CSS .lifted).
// Pha 2: cả cụm trượt vào mèo vừa đặt và nhỏ dần; mèo đích phồng lên rồi biến mất.
async function animateMerges(ghosts, merges) {
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
    showMergeScore(targetGhost, clusterPoints(cluster.length));
  });
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  ghosts.forEach(ghost => ghost.remove());
}

// Thắng: chờ các anim gom còn dở xong, rồi mọi mèo còn lại bị nhấc bổng và bay vút lên, bàn trống trơn.
async function celebrateWin(message) {
  state.animating = true;
  await Promise.all([...pendingMerges]);
  const occupied = state.board.map((object, index) => object?.group ? index : null).filter(index => index !== null);
  breakCrates(state.board.map((object, index) => object?.block ? index : null).filter(index => index !== null), WIN_PAUSE_MS);
  if (!reduceMotion.matches && occupied.length) {
    await wait(WIN_PAUSE_MS); // để người chơi thấy lần gom cuối + thông báo thắng trước
    // Chỉ bóng mèo bay đi; ô grid được trả về ô trống ngay nên bàn luôn nguyên vẹn.
    const ghostMap = spawnGhosts(occupied, state.board), ghosts = [...ghostMap.values()];
    const rowOf = new Map([...ghostMap].map(([index, ghost]) => [ghost, Math.floor(index / W)]));
    state.board = state.board.map(() => null);
    render(message);
    $('board').classList.add('busy', 'flying');
    // Pha 1: sóng từ hàng trên xuống, từng hàng lần lượt bị nhấc bổng và bay vọt lên rồi lơ lửng.
    const RISE = 46, WAVE_MS = 90;
    await Promise.all(ghosts.map(ghost => {
      const delay = rowOf.get(ghost) * WAVE_MS;
      ghost.classList.add('lifted');
      ghost.style.setProperty('--lift-delay', `${delay}ms`);
      return ghost.animate([
        { translate: '0 0' },
        { translate: `0 ${-RISE * 1.25}px`, offset: .65 },
        { translate: `0 ${-RISE}px` },
      ], { duration: 460, delay, easing: 'cubic-bezier(.3, 1.2, .5, 1)', fill: 'forwards' }).finished.catch(() => {});
    }));
    await wait(160); // cả bàn lơ lửng một nhịp rồi mới chụm lại
    // Pha 2: mọi mèo cùng lúc bay vào tâm board, giữ nguyên hình dạng (không co giãn). Thân dưới lủng lẳng
    // chuyển động theo quán tính như con lắc: lấy đà thì thân lệch về phía tâm, lao đi thì thân bị kéo lùi lại,
    // tới nơi phanh gấp thì thân văng tới trước. Tới tâm các mèo chồng lên nhau, co lại và hợp nhất thành một chớp sáng.
    const cx = $('board').offsetWidth / 2, cy = $('board').offsetHeight / 2, FLY_MS = 820;
    const far = Math.max(1, ...ghosts.map(ghost => Math.abs(cx - ghost.offsetLeft - ghost.offsetWidth / 2)));
    setTimeout(() => spawnFusion(cx, cy), FLY_MS * .86);
    await Promise.all(ghosts.flatMap(ghost => {
      const dx = cx - ghost.offsetLeft - ghost.offsetWidth / 2, dy = cy - ghost.offsetTop - ghost.offsetHeight / 2 + RISE; // tính từ chỗ đang lơ lửng
      const at = (k, scale = 1) => `translate(${dx * k}px, ${dy * k}px) scale(${scale})`;
      const fly = ghost.animate([
        { transform: at(0), opacity: 1, easing: 'cubic-bezier(.3, 0, .5, 1)' },
        { transform: at(-.06), opacity: 1, offset: .25, easing: 'cubic-bezier(.55, 0, .85, .45)' },
        { transform: at(.9, .8), opacity: 1, offset: .78, easing: 'cubic-bezier(.2, .6, .4, 1)' },
        { transform: at(1, .62), opacity: 1, offset: .88 },
        { transform: at(1, .35), opacity: 0 },
      ], { duration: FLY_MS, fill: 'forwards' });
      // Con lắc: góc lệch tỉ lệ khoảng bay ngang, dấu ngược chiều gia tốc.
      const hang = ghost.querySelector('.cat .hang'), swing = 26 * (0.35 + 0.65 * Math.abs(dx) / far) * Math.sign(dx || 1);
      const body = hang?.animate([
        { rotate: '0deg' },
        { rotate: `${swing * .5}deg`, offset: .22 },
        { rotate: `${-swing}deg`, offset: .55 },
        { rotate: `${-swing * .8}deg`, offset: .76 },
        { rotate: `${swing * .9}deg`, offset: .88 },
        { rotate: `${-swing * .3}deg` },
      ], { duration: FLY_MS, easing: 'ease-in-out', fill: 'forwards' });
      return [fly.finished.catch(() => {}), body?.finished.catch(() => {})];
    }));
    ghosts.forEach(ghost => ghost.remove());
    $('board').classList.remove('busy', 'flying');
  }
  state.animating = false;
  state.board = state.board.map(() => null);
  render(message);
}
// Chớp sáng hợp nhất ở tâm board khi mọi mèo chụm lại.
function spawnFusion(x, y) {
  const flash = document.createElement('span');
  flash.className = 'win-fusion';
  flash.style.left = `${x}px`;
  flash.style.top = `${y}px`;
  fxLayer().append(flash);
  flash.addEventListener('animationend', () => flash.remove());
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
  const gained = matchPoints(match.clusters);
  state.board = match.board;
  // Sau khi gom, mèo còn lại đã rơi xong rồi -> không chạy anim rơi lần nữa.
  // Mèo vừa đặt mà không bị gom thì rơi xuống ô thật; mèo bị gom đã có bóng mèo lo phần anim.
  state.justPlaced = new Set(result.indices.filter(index => match.board[index]));
  state.score += gained;
  const crateText = match.broken?.length ? ` Phá ${match.broken.length} thùng!` : '';
  const clearedText = match.groups.length ? `Gom ${match.groups.map(group => categories[group].name).join(', ')}! +${gained} điểm.${crateText}` : '';
  state.moves--;
  state.preview = null;
  tutorialDone('place');
  if (state.score >= state.level.target) {
    state.over = true;
    state.active = drawCard(); // không để thẻ vừa đặt nằm lại trong ô đang bóc
    const message = `Bạn thắng với ${state.score} điểm! ✨`;
    render(message);
    return celebrateWin(message).then(() => endLevel(true));
  }
  if (state.moves === 0) return endLevel(false, 'Hết lượt!');
  state.active = drawCard();
  const fit = canPlaceAnywhere(state.active);
  render(fit ? clearedText : `${clearedText} Hết chỗ đặt — kéo vào Gửi tạm.`.trim(), !fit);
  checkStuck();
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
  if (!cardDrag.ghost && !tutorialAllows('drag')) return;
  document.body.classList.add('card-dragging');
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
    // Cỡ gốc của bóng kéo = cỡ mèo trên bàn (tỉ lệ ô bàn / ô trong thẻ, neo ở điểm cầm); xa bàn thì phóng to thêm.
    const boardCell = document.querySelector('.cell[data-index="14"]')?.getBoundingClientRect();
    const piece = $('active-card').querySelector('.piece-object')?.getBoundingClientRect();
    cardDrag.baseScale = boardCell && piece?.width ? boardCell.width / piece.width : 1;
    cardDrag.boardRect = $('board').getBoundingClientRect();
    cardDrag.cells = measureCells();
    cardDrag.holdRect = $('hold').getBoundingClientRect();
    cardDrag.physics = startDragPhysics(cardDrag.ghost);
  }
  // Xa bàn: mèo to DRAG_BOOST lần cho dễ nhìn; càng gần bàn càng co về đúng cỡ ô để không che grid + ô xem trước.
  const board = cardDrag.boardRect, gapY = Math.max(0, event.clientY - board.bottom, board.top - event.clientY);
  const gapX = Math.max(0, board.left - event.clientX, event.clientX - board.right);
  const far = Math.min(1, Math.hypot(gapX, gapY) / DRAG_SHRINK_RANGE);
  cardDrag.ghost.style.transform = `scale(${(cardDrag.baseScale * (1 + (DRAG_BOOST - 1) * far)).toFixed(3)})`;
  feedDragPhysics(cardDrag.physics, event.clientX);
  cardDrag.ghost.style.left = `${event.clientX - cardDrag.grabX}px`;
  cardDrag.ghost.style.top = `${event.clientY - cardDrag.grabY}px`;
  // Kéo vào ô Gửi tạm: ưu tiên hơn bàn, sáng ô lên để báo thả được.
  const hold = cardDrag.holdRect;
  cardDrag.overHold = event.clientX >= hold.left - 8 && event.clientX <= hold.right + 8
    && event.clientY >= hold.top - 8 && event.clientY <= hold.bottom + 8;
  $('hold').classList.toggle('drop-target', cardDrag.overHold);
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
  document.body.classList.remove('card-dragging');
  $('active-card').classList.remove('dragging');
  $('hold').classList.remove('drop-target');
  state.preview = null; state.previewAnchor = null;
  paintPreview();
  if (!ghost) return event.type === 'pointerup' && rotateActive(); // chạm không kéo = xoay
  if (overHold && event.type === 'pointerup') {
    holdDropped = true; // thả tay vào ô: mèo rơi xuống ô thay vì bay từ thẻ đang bóc sang
    return holdActive();
  }
  if (anchor !== null) placeAt(anchor);
  else render(); // thả ra ngoài bàn = huỷ kéo, không cần báo
}

function render(message = '', error = false) {
  $('score').textContent = state.score;
  $('highscore').textContent = state.level.target;
  $('level-title').textContent = `Màn ${state.levelIndex + 1}`;
  $('moves').textContent = state.moves;
  $('message').textContent = message;
  $('message').classList.toggle('error', error);
  renderBoard();
  renderCards();
  $('active-card').disabled = state.over;
  document.querySelector('.card-rotator').classList.toggle('can-rotate', !state.over && state.active.items.length > 1);
  // Thẻ dọc (nhiều hàng hơn cột) -> mũi tên xoay dựng dọc hai bên.
  const shape = normalizePreview(state.active.offsets);
  layoutHints(shape.rows > shape.cols, state.animateHints);
  $('hold').disabled = state.over;
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
    if (object?.block) {
      cell.className = 'cell block';
      cell.setAttribute('aria-label', 'Thùng gỗ, gom mèo sát bên để phá');
      cell.innerHTML = CRATE_SVG;
      return;
    }
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}`;
    cell.setAttribute('aria-label', object ? `${object.name}, đã khóa` : `Ô ${index + 1}, trống`);
    if (!object) return;
    cell.style.setProperty('--group-color', categories[object.group].color);
    addArt(cell, object);
    if (state.justPlaced?.has(index) && !reduceMotion.matches) {
      cell.classList.add('drop');
      cell.addEventListener('animationend', () => cell.classList.remove('drop'), { once: true });
      spawnPuff(cell);
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
  if (renderCard(hold, state.hold, true)) {
    if (holdDropped) dropIntoHold(hold);
    else if (holdFrom) flyFrom(hold, holdFrom);
  }
  holdDropped = false;
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

function newGame(levelIndex = state?.levelIndex ?? 0) {
  const level = LEVELS[levelIndex];
  state = {
    level, levelIndex, board: parseBoard(level.board), deal: makeDealer(level), deck: [], active: null, hold: null,
    score: 0, moves: level.moves, over: false, preview: null, previewAnchor: null,
    tutorial: level.tutorial ? { steps: level.tutorial, step: 0 } : null,
  };
  state.active = drawCard();
  render(`Đạt ${level.target} điểm trong ${level.moves} lượt!`);
  renderTutorial();
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
// Chạm vào mèo trên bàn: mèo cười phấn khích, nhún nhẹ (không co giãn) và vài trái tim nhỏ bay lên.
$('board').addEventListener('pointerdown', event => {
  const cell = event.target.closest('.cell.locked');
  if (!cell || cell.classList.contains('merge-ghost') || state.animating) return;
  petCat(cell);
});
function petCat(cell) {
  cell.classList.remove('petted');
  void cell.offsetWidth; // chạm liên tiếp thì chạy lại anim
  cell.classList.add('petted');
  clearTimeout(cell.petTimer);
  cell.petTimer = setTimeout(() => cell.classList.remove('petted'), 1100);
  if (reduceMotion.matches) return;
  const layer = fxLayer();
  for (let i = 0; i < 4; i++) {
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = '♥';
    heart.style.left = `${cell.offsetLeft + cell.offsetWidth * (.3 + Math.random() * .4)}px`;
    heart.style.top = `${cell.offsetTop + cell.offsetHeight * .25}px`;
    heart.style.setProperty('--dx', `${(Math.random() - .5) * 36}px`);
    heart.style.setProperty('--rot', `${(Math.random() - .5) * 40}deg`);
    heart.style.animationDelay = `${i * 110}ms`;
    heart.style.fontSize = `${12 + Math.random() * 7}px`;
    layer.append(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

// Gửi tạm không giới hạn số lần mỗi lượt. Chạm ô gửi tạm (đang có thẻ) = đổi thẻ đó về ô đang bóc.
$('hold').onclick = () => { if (state.hold) holdActive(); };
// AFK: 3 giây không thao tác thì mèo lộ biểu cảm (buồn, lo lắng, khóc, thất vọng, dỗi), mỗi con một kiểu.
// Game mobile: chỉ tính là "có chơi" khi ngón tay chạm màn hình (nhấn, kéo, nhả). Rê chuột không tính.
const AFK_MS = 3000;
let afkTimer = 0;
function goAfk() {
  if (state.over || state.animating || cardDrag) return armAfk();
  const cats = [...document.querySelectorAll('#board > .cell.locked .cat, #active-card .cat, #hold .cat, #next-cards .cat')];
  // Xáo vòng các kiểu để các con cạnh nhau hiếm khi trùng biểu cảm.
  const offset = Math.floor(Math.random() * AFK_MOODS.length);
  cats.forEach((cat, i) => { cat.dataset.afk = AFK_MOODS[(i * 3 + offset + Math.floor(Math.random() * 2)) % AFK_MOODS.length]; });
  document.body.classList.add('afk');
}
function armAfk() {
  document.body.classList.remove('afk');
  clearTimeout(afkTimer);
  afkTimer = setTimeout(goAfk, AFK_MS);
}
addEventListener('pointerdown', armAfk, { passive: true });
addEventListener('pointerup', armAfk, { passive: true });
addEventListener('pointermove', event => { if (event.buttons || event.pointerType === 'touch') armAfk(); }, { passive: true });
armAfk();

// ===== Tutorial: làm mờ màn hình, khoét sáng đúng chỗ cần chạm, bàn tay chỉ đường + bong bóng lời thoại =====
// Mỗi bước (levels.mjs): drag (kéo vào ô `anchor`; free = chỉ gợi ý), rotate (xoay tới hướng `offsets`),
// hold (kéo vào Gửi tạm), tapHold (chạm Gửi tạm), info (đọc rồi bấm Tiếp tục).
const tutorialStep = () => state.tutorial?.steps[state.tutorial.step] || null;
function tutorialAllows(action, anchor) {
  const step = tutorialStep();
  if (!step) return true;
  if (step.type === 'info') return false;
  if (step.free) return true;
  if (action === 'drag') return step.type === 'drag' || step.type === 'hold';
  if (action === 'place') return step.type === 'drag' && anchor === step.anchor;
  if (action === 'rotate') return step.type === 'rotate';
  if (action === 'hold') return step.type === 'hold' || step.type === 'tapHold';
  return false;
}
function tutorialDone(action) {
  const step = tutorialStep();
  if (!step) return;
  const matches = step.type === 'drag' ? action === 'place'
    : step.type === 'rotate' ? action === 'rotate' && JSON.stringify(state.active.offsets) === JSON.stringify(step.offsets)
      : step.type === action;
  if (!matches) return;
  state.tutorial.step++;
  // Chờ anim gom/đặt một nhịp rồi mới chỉ bước kế để người chơi kịp thấy kết quả.
  $('tutorial').hidden = true;
  setTimeout(renderTutorial, action === 'place' ? 700 : 250);
}

function tutorialHoles(step) {
  const rect = el => el.getBoundingClientRect();
  if (step.type === 'rotate') return [rect($('active-card'))];
  if (step.type === 'hold') return [rect($('active-card')), rect($('hold'))];
  if (step.type === 'tapHold') return [rect($('hold'))];
  if (step.type === 'drag') {
    const cells = placementIndices(state.board, W, H, step.anchor, state.active.offsets) || [step.anchor];
    return [rect($('active-card')), ...cells.map(index => rect(cellEl(index)))];
  }
  return [];
}

function renderTutorial() {
  const layer = $('tutorial'), step = tutorialStep();
  layer.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  if (!step || state.over || $('intro-dialog').open || !$('map').hidden) {
    layer.hidden = true;
    return;
  }
  layer.hidden = false;
  layer.classList.toggle('blocking', step.type === 'info');
  requestAnimationFrame(() => {
    const holes = tutorialHoles(step), pad = 6;
    const box = b => ({ x: b.left - pad, y: b.top - pad, width: b.width + pad * 2, height: b.height + pad * 2 });
    $('tutorial-holes').replaceChildren(...holes.map(b => {
      const hole = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      Object.entries({ ...box(b), rx: 16 }).forEach(([key, value]) => hole.setAttribute(key, value));
      return hole;
    }));
    // Viền sáng nhấp nháy quanh chỗ cần thả / cần chạm.
    const ringed = step.type === 'drag' || step.type === 'hold' ? holes.slice(1) : holes;
    $('tutorial-rings').replaceChildren(...ringed.map(b => {
      const ring = document.createElement('span'), { x, y, width, height } = box(b);
      ring.className = 'tutorial-ring';
      ring.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px`;
      return ring;
    }));
    // Bong bóng: bước info nằm giữa màn hình, các bước khác nằm ngay dưới bàn chơi.
    const bubble = $('tutorial-bubble');
    $('tutorial-text').textContent = step.text;
    $('tutorial-next').hidden = step.type !== 'info';
    bubble.classList.toggle('center', step.type === 'info');
    bubble.style.top = step.type === 'info' ? '' : `${$('board').getBoundingClientRect().bottom + 8}px`;
    bubble.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: 'ease-out' });
    animateHand(step, holes);
  });
}

// Bàn tay: kéo (từ thẻ tới ô đích, lặp lại) hoặc chạm (nhấn nhịp).
function animateHand(step, holes) {
  const hand = $('tutorial-hand');
  hand.hidden = step.type === 'info';
  if (hand.hidden) return;
  const center = b => [b.left + b.width / 2, b.top + b.height / 2];
  const [x0, y0] = center(holes[0]);
  const at = (x, y, scale) => `translate(${x}px, ${y}px) scale(${scale})`;
  if (step.type === 'drag' || step.type === 'hold') {
    const targets = holes.slice(1).map(center);
    const x1 = targets.reduce((sum, [x]) => sum + x, 0) / targets.length;
    const y1 = targets.reduce((sum, [, y]) => sum + y, 0) / targets.length;
    hand.animate([
      { transform: at(x0, y0, 1), opacity: 0 },
      { transform: at(x0, y0, .86), opacity: 1, offset: .15 },
      { transform: at(x1, y1, .86), opacity: 1, offset: .7 },
      { transform: at(x1, y1, 1), opacity: 1, offset: .82 },
      { transform: at(x1, y1, 1), opacity: 0 },
    ], { duration: 1800, iterations: Infinity, easing: 'ease-in-out' });
  } else {
    hand.animate([
      { transform: at(x0, y0, 1) }, { transform: at(x0, y0, .8), offset: .3 },
      { transform: at(x0, y0, 1), offset: .6 }, { transform: at(x0, y0, 1) },
    ], { duration: 1100, iterations: Infinity });
  }
}
$('tutorial-next').onclick = () => { state.tutorial.step++; renderTutorial(); };
addEventListener('resize', () => { if (tutorialStep()) renderTutorial(); });

// ===== Tiến độ (lưu trong máy), bản đồ màn, giới thiệu màn, kết quả =====
const SAVE_KEY = 'gomgom-rotate-progress-v1';
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && Array.isArray(saved.stars)) return saved;
  } catch {}
  return { stars: [] };
}
function saveProgress(progress) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch {}
}
const unlockedCount = progress => Math.min(LEVELS.length, progress.stars.filter(Boolean).length + 1);
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

function showMap() {
  const progress = loadProgress(), open = unlockedCount(progress);
  $('map-list').replaceChildren(...LEVELS.map((level, index) => {
    const node = document.createElement('button');
    const stars = progress.stars[index] || 0, locked = index >= open;
    node.className = `map-node${locked ? ' locked' : ''}${index === open - 1 && !stars ? ' current' : ''}${level.hard ? ' hard' : ''}`;
    node.disabled = locked;
    node.innerHTML = `<b>${locked ? '🔒' : index + 1}</b><span class="map-stars">${locked ? '' : starText(stars)}</span>`
      + `<small>${level.name}${level.hard ? ' · Khó' : ''}</small>`;
    node.onclick = () => { $('map').hidden = true; startLevel(index); };
    return node;
  }));
  $('map').hidden = false;
  $('tutorial').hidden = true;
  document.querySelector('.map-node.current')?.scrollIntoView({ block: 'center' });
}

function startLevel(index) {
  const level = LEVELS[index];
  newGame(index);
  $('intro-number').textContent = `Màn ${index + 1}${level.hard ? ' · Khó' : ''}`;
  $('intro-name').textContent = level.name;
  $('intro-feature').textContent = `Mới: ${level.feature}`;
  $('intro-target').textContent = level.target;
  $('intro-moves').textContent = level.moves;
  $('intro-dialog').classList.toggle('hard', !!level.hard);
  $('intro-dialog').showModal();
  renderTutorial(); // bảng giới thiệu đang mở -> ẩn, đóng bảng thì hiện
}
$('intro-dialog').addEventListener('close', () => renderTutorial());

function endLevel(win, reason = '') {
  state.over = true;
  render(win ? '' : `${reason} Bạn đạt ${state.score}/${state.level.target} điểm.`, !win);
  renderTutorial();
  const index = state.levelIndex, last = index === LEVELS.length - 1;
  let stars = 0;
  if (win) {
    stars = starsFor(state.level, state.moves);
    const progress = loadProgress();
    progress.stars[index] = Math.max(progress.stars[index] || 0, stars);
    saveProgress(progress);
  }
  const dialog = $('result-dialog');
  dialog.classList.toggle('win', win);
  $('result-title').textContent = win ? (last ? 'Hoàn thành hành trình!' : 'Qua màn!') : reason;
  $('result-score').textContent = `${state.score} / ${state.level.target} điểm`;
  $('result-stars').replaceChildren(...[0, 1, 2].map(i => {
    const star = document.createElement('span');
    star.textContent = '★';
    star.className = i < stars ? 'on' : '';
    star.style.animationDelay = `${250 + i * 220}ms`;
    return star;
  }));
  $('result-stars').hidden = !win;
  $('result-next').hidden = !win || last;
  $('result-retry').hidden = win;
  setTimeout(() => dialog.showModal(), win ? 150 : 700);
}
$('result-next').onclick = () => { $('result-dialog').close(); startLevel(state.levelIndex + 1); };
$('result-retry').onclick = () => { $('result-dialog').close(); startLevel(state.levelIndex); };
$('result-map').onclick = () => { $('result-dialog').close(); showMap(); };
$('intro-map').onclick = () => { $('intro-dialog').close(); showMap(); };

// Lần đầu mở game: vào thẳng màn 1 (FTUE), không bắt đọc bản đồ. Đã chơi rồi thì mở bản đồ.
function boot() {
  const progress = loadProgress();
  if (progress.stars.some(Boolean)) {
    newGame(unlockedCount(progress) - 1);
    showMap();
  } else startLevel(0);
}
$('tutorial-avatar').innerHTML = catMarkup.orange;

$('restart').onclick = () => { if (!state.animating) startLevel(state.levelIndex); };
$('help').onclick = () => $('help-dialog').showModal();
$('open-map').onclick = () => { if (!state.animating) showMap(); };
boot();
