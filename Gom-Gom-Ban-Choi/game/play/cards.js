// Thẻ ở dock dưới bàn: thẻ đang bóc (vẽ, xoay + mũi tên gợi ý), ô Hold (cất / đổi thẻ), các thẻ kế tiếp; anim bay giữa các ô.
// Sang Unity: CardDock (MonoBehaviour) + prefab CardView.
import * as game from '../core/session.mjs';
import { TIMING } from '../data/tuning.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { look, addArt, state, PREVIEW_COUNT } from './context.js';
import { centerOf } from './card-drag.js';
import { render } from './hud.js';
import { showNextTutorial } from './tutorial.js';
import { endLevel } from './result.js';

export function normalizePreview(offsets) {
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
    cell.style.setProperty('--group-color', look(card.items[index].group).color);
    addArt(cell, card.items[index]); grid.append(cell);
  });
  container.append(grid);
  return true;
}

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

export function rotateActive() {
  if (state.animating) return;
  // Ghi vị trí từng mèo trước khi xoay (đang giữa anim thì lấy đúng chỗ đang hiện -> bấm liên tục vẫn liền mạch).
  const before = [...$('active-card').querySelectorAll('.piece-object')].map(piece => centerOf(piece.getBoundingClientRect()));
  const turn = game.rotate(state);
  if (!turn.ok) return;
  playSound('rotate');
  state.preview = null;
  state.animateHints = true; // render() sẽ cho mũi tên trượt theo cung thay vì nhảy
  render();
  if (turn.tutorialAdvanced) showNextTutorial(250);
  state.animateHints = false;
  animateRotation(before);
}

// Mũi tên gợi ý xoay nằm trên quỹ đạo quanh tâm thẻ: góc 0° = mép trên (chỉ phải), 180° = mép dưới.
// Đổi ngang <-> dọc thì cả vòng quay thêm 90° thuận chiều, nên mũi tên trượt theo cung tròn và tự đổi hướng.
let hintAngle = 0;

const ROTATE_MS = TIMING.ROTATE_MS;

function hintTransform(angle, card, arrowHeight) {
  const rad = angle * Math.PI / 180;
  const radiusY = card.height / 2 - arrowHeight / 2 - 3, radiusX = card.width / 2 - arrowHeight / 2 - 5;
  const radius = radiusY * Math.cos(rad) ** 2 + radiusX * Math.sin(rad) ** 2; // quỹ đạo dẹt theo khung chữ nhật
  return `translate(-50%, -50%) rotate(${angle.toFixed(2)}deg) translateY(${(-radius).toFixed(2)}px)`;
}

export function layoutHints(vertical, animate = false) {
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
  // Thẻ thấp (màn thấp / cửa sổ máy tính): dải mũi tên không được ăn quá 22% mỗi cạnh, không thì mèo co về 0 và biến mất.
  const band = Math.min(arrowHeight * .78 + 4, Math.min(card.width, card.height) * .22), pad = 10, gap = 1;
  // Tai mèo nhô lên trên ô: chừa thêm chiều cao để thẻ dọc không tràn khay.
  const ears = 16;
  const fit = (rows, cols, arrowsOnSides) => {
    const width = card.width - (arrowsOnSides ? band * 2 : 0), height = card.height - (arrowsOnSides ? 0 : band * 2);
    return Math.min(68, (width - pad - gap * (cols - 1)) / cols, (height - pad - ears - gap * (rows - 1)) / rows);
  };
  const { rows, cols } = normalizePreview(state.active.offsets);
  const long = Math.max(rows, cols), short = Math.min(rows, cols);
  const cell = rows === cols
    ? Math.min(fit(rows, cols, false), fit(rows, cols, true))
    : Math.min(fit(short, long, false), fit(long, short, true));
  grid.style.setProperty('--cell', `${Math.max(22, Math.floor(cell))}px`); // luôn đủ to để nhìn thấy mèo
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

// Kéo thẻ thả vào ô Hold (card-drag): lần vẽ tới mèo rơi xuống ô thay vì bay từ thẻ đang bóc sang.
export function markHoldDrop() { holdDropped = true; }

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

export function holdActive() {
  if (state.animating) return;
  const turn = game.hold(state);
  if (turn.error === 'tutorial') return render('Follow the tutorial!', true);
  if (!turn.ok) return;
  playSound('draw');
  state.preview = null;
  render();
  if (turn.tutorialAdvanced) showNextTutorial(250);
  if (turn.stuck) endLevel(false, state.outcome.reason);
}

function nextSlots() {
  const list = $('next-cards');
  while (list.children.length < PREVIEW_COUNT) {
    const slot = document.createElement('span'); slot.className = 'next-slot'; list.append(slot);
  }
  return [...list.children];
}

export function renderCards() {
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

$('active-card').onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); rotateActive(); }
};

// Gửi tạm bằng cách kéo thẻ thả vào ô; bàn phím vẫn dùng Enter/Space để không mất khả năng truy cập.
$('hold').onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); holdActive(); }
};

// Gửi tạm không giới hạn số lần mỗi lượt. Chạm ô gửi tạm: trống = cất thẻ đang bóc vào, có thẻ = đổi về ô đang bóc.
$('hold').onclick = () => { if (state.holdOn && !state.over) holdActive(); };
