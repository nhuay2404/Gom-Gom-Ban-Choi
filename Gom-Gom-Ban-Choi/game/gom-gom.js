import { mergeTarget, placementIndices } from './board-rules.mjs';
import { clusterPoints } from './scoring.mjs';
import { categories, catMarkup, addArt as addCatArt, LOW_MOVE_MOODS } from './cat-art.mjs';
import { LEVELS } from './levels.mjs';
import * as game from './session.mjs';
import { loadProgress, saveProgress, unlockedCount, levelsCleared as clearedCount, totalStars as sumStars, recordWin, levelTier, levelMechanics } from './progression.mjs';
import { BOARD, TIMING, DRAG, LOW_MOVES, BOOSTERS } from './tuning.mjs';
import { loadBoosters, saveBoosters, spendBooster, buyBooster, boostersUnlocked } from './boosters.mjs';
import { CRATE_SVG, METAL_SVG } from './board-art.mjs';
import { playSound, soundOn, setSound } from './sound.mjs';
import { SAVE_KEYS, readText, writeText } from './save.mjs';
import { loadProfile, saveProfile, startVisit, planLevel, recordAttempt, noteDwell, elementCount, difficultyOf, boosterTip } from './adaptive.mjs';
import { ZONES, zoneOpen, catalogFor, itemById, loadDeco, saveDeco, itemStatus, applyAction, previewDeco, occupantOf } from './deco-data.mjs';

// Giao diện màn chơi + menu. Luật của một ván nằm ở session.mjs (thuần logic): file này chỉ gọi luật rồi vẽ/diễn.
// Mỗi màn (levels.mjs): đạt điểm mục tiêu trong giới hạn lượt. Hết lượt hoặc hết chỗ đặt là thua.
const { PREVIEW_COUNT } = BOARD;
// Kích thước bàn của màn đang chơi (mỗi màn một cỡ/hình, xem board-shapes.mjs); đặt lại ở newGame.
let W = BOARD.W, H = BOARD.H;
const $ = id => document.getElementById(id);
const DRAG_BOOST = DRAG.BOOST, DRAG_SHRINK_RANGE = DRAG.SHRINK_RANGE;
let state, cardDrag = null;
// Profile người chơi cho độ khó thích ứng (adaptive.mjs) + metric của ván đang chơi (ghi ở recordTry).
let profile = startVisit(loadProfile());
saveProfile(profile);
let track = null;
const now = () => performance.now();
function startTracking() {
  const t = now();
  track = { start: t, last: t, thinks: [], idleMs: 0, idleSince: 0, boosters: 0, boostUse: { hammer: 0, swap: 0, moves: 0 }, bought: 0, preBoostRatio: null, done: false };
}
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
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
  if (state.animating) return;
  // Ghi vị trí từng mèo trước khi xoay (đang giữa anim thì lấy đúng chỗ đang hiện -> bấm liên tục vẫn liền mạch).
  const before = [...$('active-card').querySelectorAll('.piece-object')].map(piece => centerOf(piece.getBoundingClientRect()));
  const turn = game.rotate(state);
  if (!turn.ok) return;
  playSound('pick');
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
  // Thẻ thấp (màn thấp / cửa sổ máy tính): dải mũi tên không được ăn quá 22% mỗi cạnh, không thì mèo co về 0 và biến mất.
  const band = Math.min(arrowHeight * .78 + 4, Math.min(card.width, card.height) * .22), pad = 10, gap = 4;
  const fit = (rows, cols, arrowsOnSides) => {
    const width = card.width - (arrowsOnSides ? band * 2 : 0), height = card.height - (arrowsOnSides ? 0 : band * 2);
    return Math.min(68, (width - pad - gap * (cols - 1)) / cols, (height - pad - gap * (rows - 1)) / rows);
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

function placeAt(anchor) {
  if (state.over || state.animating) return;
  const turn = game.place(state, anchor);
  if (turn.error === 'tutorial') return render('Drag onto the glowing cell!', true);
  if (turn.error) return render(turn.error, true);
  if (!turn.ok) return;
  const placedAt = now();
  track.thinks.push(placedAt - track.last);
  track.last = placedAt;
  // Chỉ gom (xóa cụm 3+) mới có điểm; đặt thẻ thôi thì không.
  const { result, match } = turn;
  if (!match.cleared.length || reduceMotion.matches) return finishTurn(turn);
  // State được chốt ngay (cụm biến mất, điểm cộng, rút thẻ mới) để người chơi đặt tiếp liền.
  // Anim gom chạy trên các "bóng mèo" phủ đúng chỗ cũ, không chặn thao tác.
  const merges = match.clusters.map(cluster => ({ cluster, target: mergeTarget(cluster, result.indices, W) }));
  const ghosts = spawnMergeGhosts(merges, result);
  const done = animateMerges(ghosts, merges);
  breakCrates(match.broken, DROP_MS + LIFT_MS + MERGE_MS * .7);
  pendingMerges.add(done);
  done.finally(() => pendingMerges.delete(done));
  finishTurn(turn);
}

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

const { LIFT_MS, MERGE_MS, WIN_PAUSE_MS, DROP_MS } = TIMING;
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
  breakCrates(state.board.map((object, index) => object?.block && !object.metal ? index : null).filter(index => index !== null), WIN_PAUSE_MS);
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

function finishTurn(turn) {
  const { result, match, gained } = turn;
  // Sau khi gom, mèo còn lại đã rơi xong rồi -> không chạy anim rơi lần nữa.
  // Mèo vừa đặt mà không bị gom thì rơi xuống ô thật; mèo bị gom đã có bóng mèo lo phần anim.
  state.justPlaced = new Set(result.indices.filter(index => match.board[index]));
  if (match.clusters.length) playSound('merge', Math.max(...match.clusters.map(cluster => cluster.length)));
  else playSound('pick');
  const crateText = match.broken?.length ? ` Broke ${match.broken.length} crate${match.broken.length > 1 ? 's' : ''}!` : '';
  const clearedText = match.groups.length ? `Matched ${match.groups.map(group => categories[group].name).join(', ')}! +${gained} points.${crateText}` : '';
  state.preview = null;
  if (turn.tutorialAdvanced) showNextTutorial(700);
  if (turn.win) {
    const message = `You win with ${state.score} points! ✨`;
    render(message);
    setTimeout(() => playSound('complete'), 380); // sau tiếng gom cuối
    return celebrateWin(message).then(() => endLevel(true));
  }
  if (turn.lose && !turn.stuck) return endLevel(false, state.outcome.reason);
  const noRoom = state.holdOn ? 'No room left — drag a card into Hold.' : 'No room left for this card!';
  render(`${turn.fit ? clearedText : `${clearedText} ${noRoom}`} ${lowMovesText()}`.trim(), !turn.fit);
  if (turn.stuck) endLevel(false, state.outcome.reason);
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
  if (hammerArmed) { hammerArmed = false; renderBoosters(); }
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
    playSound('pick');
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
  cardDrag.overHold = state.holdOn && event.clientX >= hold.left - 8 && event.clientX <= hold.right + 8
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
  $('level-title').textContent = `Level ${state.levelIndex + 1}`;
  $('moves').textContent = state.moves;
  const progress = Math.min(1, state.score / state.level.target);
  $('score-fill').style.width = `${progress * 100}%`;
  $('score-fill').parentElement.parentElement.classList.toggle('full', progress >= 1);
  $('message').textContent = message;
  $('message').classList.toggle('error', error);
  renderBoard();
  renderCards();
  $('active-card').disabled = state.over;
  document.querySelector('.card-rotator').classList.toggle('can-rotate', !state.over && state.active.items.length > 1);
  // Thẻ dọc (nhiều hàng hơn cột) -> mũi tên xoay dựng dọc hai bên.
  const shape = normalizePreview(state.active.offsets);
  layoutHints(shape.rows > shape.cols, state.animateHints);
  $('hold').disabled = state.over || !state.holdOn;
  // Ô Hold chỉ hiện từ màn HOLD.UNLOCK_LEVEL (giữ chỗ trong dock để thẻ đang bóc không bị lệch).
  document.querySelector('.hold-column').classList.toggle('locked', !state.holdOn);
  renderLowMoves();
  renderBoosters();
}

// Ô bàn được giữ cố định; chỉ ô nào đổi mèo mới dựng lại. Không xoá/dựng lại cả 36 ô mỗi lần vẽ
// nên không bị chớp hình, không reset nhịp chớp mắt và không khựng khung hình.
function renderBoard() {
  const board = $('board');
  // Dựng lại lưới khi đổi cỡ hoặc hình bàn (ô ngoài bàn cố định suốt ván).
  const layout = `${W}x${H}:${state.board.map(cell => (cell?.void ? 1 : 0)).join('')}`;
  if (board.layout !== layout) {
    board.layout = layout;
    board.style.setProperty('--cols', W);
    board.style.setProperty('--rows', H);
    // Bàn có ô ngoài bàn ('#') = bàn có hình (tim, tam giác...): bỏ nền chữ nhật, vẽ nền theo hình (board-shape).
    const shaped = state.board.some(cell => cell?.void);
    board.classList.toggle('shaped', shaped);
    const cells = Array.from({ length: W * H }, (_, index) => {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.dataset.index = index;
      cell.renderedObject = undefined;
      return cell;
    });
    // Nền bàn có hình: mỗi ô trong bàn một mảnh nền tràn ra khe giữa các ô, ghép lại thành hình của bàn.
    const underlay = document.createElement('div');
    underlay.className = 'board-shape';
    underlay.setAttribute('aria-hidden', 'true');
    state.board.forEach((cell, index) => {
      if (cell?.void) return;
      const tile = document.createElement('i');
      tile.style.gridArea = `${Math.floor(index / W) + 1}/${index % W + 1}`;
      underlay.append(tile);
    });
    board.replaceChildren(...(shaped ? [underlay] : []), ...cells);
    board.onpointerleave = () => { state.preview = null; paintPreview(); };
  }
  board.querySelectorAll(':scope > .cell').forEach((cell, index) => {
    const object = state.board[index] || null;
    if (cell.renderedObject === object) return;
    cell.renderedObject = object;
    cell.getAnimations().forEach(animation => animation.cancel()); // bỏ fill:forwards của anim gom/bay
    cell.replaceChildren();
    cell.removeAttribute('style');
    if (object?.void) {
      cell.className = 'cell void';
      cell.disabled = true;
      cell.setAttribute('aria-hidden', 'true');
      return;
    }
    if (object?.block) {
      cell.className = `cell block${object.metal ? ' metal' : ''}`;
      cell.setAttribute('aria-label', object.metal ? 'Metal block, it never breaks' : 'Crate, match cats next to it to break it');
      cell.innerHTML = object.metal ? METAL_SVG : CRATE_SVG;
      return;
    }
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}`;
    cell.setAttribute('aria-label', object ? `${object.name}, locked` : `Cell ${index + 1}, empty`);
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
  // Màn không còn cố định: bật/tắt element theo profile người chơi (adaptive.mjs); màn có tutorial giữ bản gốc.
  const plan = planLevel(profile, levelIndex), { level } = plan;
  // Luật của ván nằm trong session; các trường còn lại (preview, animating...) chỉ phục vụ hiển thị.
  state = Object.assign(game.createSession(levelIndex, { level }), { plan, preview: null, previewAnchor: null, animating: false });
  ({ W, H } = state);
  hammerArmed = false;
  startTracking();
  // Lần chơi lại sau khi thua sát nút: nút +lượt nhấp nháy mời dùng (adaptive.mjs: suggestBooster).
  $('booster-bar').querySelector('[data-boost="moves"]').classList.toggle('suggest', plan.suggestBooster && boostersUnlocked(levelIndex));
  render(`Reach ${level.target} points in ${level.moves} moves!`);
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
  if (hammerArmed) return smashAt(event.target.closest('.cell'));
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

// ===== Booster: mở từ màn BOOSTERS.UNLOCK_LEVEL, không tốn lượt; hết thì chạm là mua luôn bằng xu =====
let boosterStock = loadBoosters(), hammerArmed = false;
const BOOSTER_NAMES = { hammer: 'Hammer', swap: 'New card', moves: `+${BOOSTERS.EXTRA_MOVES} moves` };
const priceTag = id => `<i class="ico-coin"></i>${BOOSTERS.PRICE[id]}`;
function renderBoosters() {
  const bar = $('booster-bar');
  bar.hidden = !boostersUnlocked(state.levelIndex);
  const busy = state.over || !!tutorialStep();
  bar.querySelectorAll('[data-boost]').forEach(button => {
    const id = button.dataset.boost, count = boosterStock[id];
    button.disabled = busy;
    button.classList.toggle('armed', id === 'hammer' && hammerArmed);
    button.classList.toggle('empty', !count);
    button.querySelector('.boost-count').innerHTML = count || priceTag(id);
  });
  document.body.classList.toggle('hammer-armed', hammerArmed);
}
function renderShopBoosters() {
  $('shop-boosters').querySelectorAll('[data-buy]').forEach(button => {
    const id = button.dataset.buy;
    button.querySelector('small').textContent = `You have ${boosterStock[id]}`;
    button.querySelector('em').innerHTML = priceTag(id);
    button.classList.toggle('poor', deco.coins < BOOSTERS.PRICE[id]);
  });
}
function storeBoosters(stock) { boosterStock = stock; saveBoosters(stock); }
// Mua một cái bằng xu; trả về false nếu không đủ xu.
function buyOne(id) {
  const bought = buyBooster(boosterStock, deco.coins, id);
  if (bought.error) { showToast(`Need ${BOOSTERS.PRICE[id] - deco.coins} more coins for ${BOOSTER_NAMES[id]}`); return false; }
  deco = { ...deco, coins: bought.coins };
  saveDeco(deco);
  storeBoosters(bought.stock);
  refreshWallet();
  playSound('reward');
  showToast(`Bought ${BOOSTER_NAMES[id]} · −${BOOSTERS.PRICE[id]} coins`);
  return true;
}
// Booster mua ngay trong ván (hết hàng, trả bằng xu) được ghi riêng để thống kê.
const haveBooster = id => {
  if (boosterStock[id] > 0) return true;
  if (!buyOne(id)) return false;
  track.bought++;
  return true;
};
const useBooster = id => {
  track.boosters++; track.boostUse[id]++;
  storeBoosters(spendBooster(boosterStock, id));
  $('booster-bar').querySelector('.suggest')?.classList.remove('suggest');
};

$('booster-bar').addEventListener('click', event => {
  const button = event.target.closest('[data-boost]');
  if (!button || button.disabled || state.over || state.animating) return;
  const id = button.dataset.boost;
  if (id === 'hammer') {
    if (hammerArmed) { hammerArmed = false; return render(); }
    if (!haveBooster(id)) return renderBoosters();
    hammerArmed = true;
    return render('Tap a cat or a crate to smash it.');
  }
  if (!haveBooster(id)) return renderBoosters();
  hammerArmed = false;
  if (id === 'swap' && game.swapCard(state).ok) {
    useBooster(id);
    playSound('draw');
    state.preview = null;
    render('Here is a new card!');
  }
  // Tỉ lệ điểm trước lần +lượt đầu tiên (chỉ để thống kê; adaptive.mjs không dùng booster để xét thắng/thua).
  if (id === 'moves') track.preBoostRatio ??= +(state.score / state.level.target).toFixed(3);
  if (id === 'moves' && game.addMoves(state, BOOSTERS.EXTRA_MOVES).ok) {
    useBooster(id);
    playSound('reward');
    render(`+${BOOSTERS.EXTRA_MOVES} moves!`);
    if (!reduceMotion.matches) document.querySelector('.moves-box').animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
});
addEventListener('keydown', event => { if (event.key === 'Escape' && hammerArmed) { hammerArmed = false; render(); } });

// Búa: mèo co lại xoay tròn rồi biến mất trong khói; thùng thì vỡ như khi gom.
function smashAt(cell) {
  if (!cell || state.over || state.animating) return;
  const index = Number(cell.dataset.index), turn = game.smash(state, index);
  if (!turn.ok) return render(turn.error || '', !!turn.error);
  useBooster('hammer');
  hammerArmed = false;
  playSound('merge', 1);
  if (turn.object.block) breakCrates([index], 0);
  else if (!reduceMotion.matches) {
    const ghost = cell.cloneNode(true);
    ghost.classList.add('smash-ghost');
    ghost.style.cssText += `;left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    fxLayer().append(ghost);
    ghost.animate([{ scale: 1, rotate: '0deg', opacity: 1 }, { scale: 1.15, rotate: '-12deg', opacity: 1, offset: .25 }, { scale: 0, rotate: '200deg', opacity: 0 }],
      { duration: 420, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished.then(() => ghost.remove());
    spawnPuff(cell);
  }
  render(turn.object.block ? 'Crate smashed!' : `Bye, ${categories[turn.object.group].name}!`);
}

$('shop-boosters').addEventListener('click', event => {
  const button = event.target.closest('[data-buy]');
  if (button && buyOne(button.dataset.buy)) renderShopBoosters();
});
// AFK: 5 giây không thao tác thì mọi con mèo buồn ngủ (body.afk).
// Game mobile: chỉ tính là "có chơi" khi ngón tay chạm màn hình (nhấn, kéo, nhả). Rê chuột không tính.
const { AFK_MS } = TIMING;
let afkTimer = 0;
function goAfk() {
  if (state.over || state.animating || cardDrag) return armAfk();
  document.body.classList.add('afk');
  // Metric idle: tính cả khoảng chờ trước khi mèo ngủ (đã AFK_MS không chạm), chỉ khi đang trong ván.
  if (track && !track.done && !menuOpen() && $('map').hidden) track.idleSince = now() - AFK_MS;
}

// Sắp hết lượt: ô Moves đổi màu + đập nhịp, mèo lộ biểu cảm buồn/lo (mỗi con một kiểu), thông báo ở vài lượt cuối.
const { CATS_AT: LOW_CATS_AT, MSG_AT: LOW_MSG_AT } = LOW_MOVES;
function lowMovesText() {
  if (state.over || state.moves > LOW_MSG_AT || state.moves < 1) return '';
  return state.moves === 1 ? 'Last move!' : `${state.moves} moves left!`;
}
function renderLowMoves() {
  const left = state.moves, live = !state.over && left > 0;
  const box = $('moves').parentElement;
  box.classList.toggle('danger', live && left <= LOW_MSG_AT);
  box.classList.toggle('warn', live && left > LOW_MSG_AT && left <= Math.ceil(state.level.moves * 0.3));
  const low = live && left <= LOW_CATS_AT;
  document.body.classList.toggle('low-moves', low);
  if (!low) return;
  const cats = [...document.querySelectorAll('#board > .cell.locked .cat, #active-card .cat, #hold .cat, #next-cards .cat')];
  // Xáo vòng các kiểu để các con cạnh nhau hiếm khi trùng biểu cảm.
  const offset = Math.floor(Math.random() * LOW_MOVE_MOODS.length);
  cats.forEach((cat, i) => { if (!cat.dataset.low) cat.dataset.low = LOW_MOVE_MOODS[(i * 3 + offset + Math.floor(Math.random() * 2)) % LOW_MOVE_MOODS.length]; });
}function armAfk() {
  document.body.classList.remove('afk');
  if (track?.idleSince) { track.idleMs += now() - track.idleSince; track.idleSince = 0; }
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
// Luật tutorial (bước nào cho làm gì, khi nào sang bước) nằm ở session.mjs; ở đây chỉ vẽ.
const tutorialStep = () => game.tutorialStep(state);
const tutorialAllows = (action, anchor) => game.tutorialAllows(state, action, anchor);
// Chờ anim gom/đặt một nhịp rồi mới chỉ bước kế để người chơi kịp thấy kết quả.
function showNextTutorial(delay) {
  $('tutorial').hidden = true;
  setTimeout(renderTutorial, delay);
}

function tutorialHoles(step) {
  const rect = el => el.getBoundingClientRect();
  if (step.type === 'rotate') return [rect($('active-card'))];
  if (step.type === 'hold') return [rect($('active-card')), rect($('hold'))];
  if (step.type === 'tapHold') return [rect($('hold'))];
  // Bước info có `focus`: khoanh sáng phần HUD đang được giới thiệu (thanh điểm / ô Moves / ô Hold).
  if (step.focus) return [rect(document.querySelector({ moves: '.moves-box', hold: '#hold' }[step.focus] || '.progress'))];
  if (step.type === 'drag') {
    const cells = placementIndices(state.board, W, H, step.anchor, state.active.offsets) || [step.anchor];
    return [rect($('active-card')), ...cells.map(index => rect(cellEl(index)))];
  }
  return [];
}

function renderTutorial() {
  const layer = $('tutorial'), step = tutorialStep();
  layer.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  if (!step || state.over || $('intro-dialog').open || !$('map').hidden || menuOpen()) {
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
    $('tutorial-text').textContent = step.text.replace('{target}', state.level.target).replace('{moves}', state.level.moves);
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
$('tutorial-next').onclick = () => { game.continueTutorial(state); renderTutorial(); };
addEventListener('resize', () => { if (tutorialStep()) renderTutorial(); });

// ===== Tiến độ (lưu trong máy), bản đồ màn, giới thiệu màn, kết quả =====
// Nhãn độ khó ở bảng vào màn và bản đồ: Easy / Medium / Hard theo số element của bản màn sẽ chơi (adaptive.mjs),
// boss giữ nhãn Boss. `style` = kiểu màu có sẵn trong CSS (data-tier, .tier-*); 'normal' là màu mặc định.
const TIERS = {
  easy: { style: 'chill', label: 'Easy', icon: '<svg viewBox="0 0 24 24"><path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14Zm0 0 7-7"/></svg>' },
  medium: { style: 'normal', label: 'Medium', icon: '<svg viewBox="0 0 24 24"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7Z"/></svg>' },
  hard: { style: 'hard', label: 'Hard', icon: '<svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z"/></svg>' },
  boss: { style: 'boss', label: 'Boss', icon: '<svg viewBox="0 0 24 24"><path d="M4 18 3 7l5 4 4-6 4 6 5-4-1 11Z M5 21h14"/></svg>' },
};
const tierOf = (index, plan = planLevel(profile, index)) => TIERS[levelTier(LEVELS[index]) === 'boss' ? 'boss' : plan.difficulty];
// Bản đồ: chỉ màn đang mở hiện độ khó đã chỉnh; các màn khác hiện nhãn bản gốc để người chơi không thấy cả bản đồ đổi theo.
const mapTier = (index, current) => tierOf(index, current ? undefined : { difficulty: difficultyOf(elementCount(LEVELS[index])) });
// ?dda trên URL: hiện profile đang nhận diện ở bảng vào màn (để QA), người chơi thường không thấy.
const DDA_DEBUG = new URLSearchParams(location.search).has('dda');
// Vật cản có trong màn (đọc từ bàn): hiện icon ở bảng vào màn, cơ chế mới gắn NEW.

// Bản đồ saga: màn 1 ở đáy, các nút nằm trên một con đường uốn hình sin đi lên (như Candy Crush).
const MAP = { STEP: 112, TOP: 150, BOTTOM: 150, SWING: 0.3, FREQ: 0.95 };
const MAP_DECOR = ['🌸', '🌳', '🍄', '🌼', '🌷', '🌲', '🪴', '🌻'];
const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13Z"/></svg>';
const mapPoint = (index, width, height) => ({
  x: width * (0.5 + MAP.SWING * Math.sin(index * MAP.FREQ)),
  y: height - MAP.BOTTOM - index * MAP.STEP,
});
// Đường cong mượt qua các điểm: mỗi đoạn là cubic bezier với tay nắm thẳng đứng.
const mapPath = points => points.map((p, i) => {
  if (!i) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const q = points[i - 1], mid = (q.y - p.y) / 2;
  return `C${q.x.toFixed(1)} ${(q.y - mid).toFixed(1)} ${p.x.toFixed(1)} ${(p.y + mid).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}).join('');

function renderMap() {
  const list = $('map-list'), progress = loadProgress(), open = unlockedCount(progress);
  const width = Math.min(list.clientWidth, 440), height = MAP.TOP + MAP.BOTTOM + (LEVELS.length - 1) * MAP.STEP;
  const points = LEVELS.map((_, index) => mapPoint(index, width, height));
  const road = document.createElement('div');
  road.className = 'map-road';
  road.style.cssText = `width:${width}px;height:${height}px`;
  // Đoạn đã đi (tới màn đang mở) tô màu kẹo; phần còn lại là đường đất.
  road.innerHTML = `<svg width="${width}" height="${height}" aria-hidden="true">
      <path class="road-edge" d="${mapPath(points)}"/><path class="road-fill" d="${mapPath(points)}"/>
      ${open > 1 ? `<path class="road-done" d="${mapPath(points.slice(0, open))}"/>` : ''}
      <path class="road-dots" d="${mapPath(points)}"/>
    </svg>`;
  // Cây cỏ lác đác ở phía đối diện chỗ đường uốn tới.
  road.append(...points.map((p, index) => {
    const decor = document.createElement('span');
    decor.className = 'map-decor';
    decor.textContent = MAP_DECOR[index % MAP_DECOR.length];
    decor.style.cssText = `left:${width * (p.x > width / 2 ? 0.14 : 0.86)}px;top:${p.y + MAP.STEP * 0.4}px`;
    return decor;
  }));
  road.append(...LEVELS.map((level, index) => {
    const node = document.createElement('button');
    const stars = progress.stars[index] || 0, locked = index >= open, tier = levelTier(level), current = index === open - 1;
    node.className = `map-node${locked ? ' locked' : stars ? ' done' : ''}${current ? ` current${points[index].x > width / 2 ? ' avatar-left' : ''}` : ''} tier-${mapTier(index, current).style}`;
    node.style.cssText = `left:${points[index].x}px;top:${points[index].y}px`;
    node.disabled = locked;
    node.title = `${level.name} · ${mapTier(index, current).label}`;
    node.setAttribute('aria-label', `Level ${index + 1}: ${level.name}${locked ? ' (locked)' : stars ? ' (cleared)' : ''}`);
    node.innerHTML = `<b>${locked ? LOCK_SVG : index + 1}</b>`
      + (tier === 'boss' ? '<span class="map-crown" aria-hidden="true">👑</span>' : '')
      + (current ? `<span class="map-avatar" aria-hidden="true">${catMarkup.orange}</span>` : '');
    node.onclick = () => { $('map').hidden = true; startLevel(index); };
    return node;
  }));
  list.replaceChildren(road);
}

function showMap() {
  hideMenus();
  $('map').hidden = false;
  $('tutorial').hidden = true;
  renderMap();
  // Cuộn cho màn đang chơi nằm giữa màn hình (không có thì ở đáy, chỗ màn 1).
  const list = $('map-list'), current = list.querySelector('.map-node.current');
  list.scrollTop = current ? current.offsetTop - list.clientHeight / 2 : list.scrollHeight;
}
addEventListener('resize', () => { if (!$('map').hidden) renderMap(); });

// ===== Home / Deco / Shop: các tab dùng chung thanh điều hướng nổi, chỉ hiện ngoài màn chơi =====
const TABS = ['home', 'deco', 'shop'];
const menuOpen = () => TABS.some(tab => !$(tab).hidden);
const totalStars = () => sumStars(loadProgress());
let deco = loadDeco(totalStars());
let room3d = null; // phòng 3D, có sau khi nạp xong Three.js; null thì dùng phòng CSS phẳng
let decoThumbnail = null; // chụp model 3D làm ảnh cho ô đồ (có sau khi nạp Three.js)
let decoCat = 'furniture', decoPick = null;

function hideMenus() {
  TABS.forEach(tab => { $(tab).hidden = true; });
  $('tabbar').hidden = true;
  decoPick = null;
  room3d?.stop();
}
function refreshWallet() {
  ['home-coins', 'deco-coins', 'shop-coins'].forEach(id => { $(id).textContent = deco.coins.toLocaleString('en-US'); });
}
function showTab(tab) {
  TABS.forEach(name => { $(name).hidden = name !== tab; });
  $('tabbar').hidden = false;
  $('tabbar').querySelectorAll('.tab').forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('map').hidden = true;
  $('tutorial').hidden = true;
  const progress = loadProgress();
  refreshWallet();
  const next = unlockedCount(progress) - 1;
  $('home-level').textContent = `Level ${next + 1}`;
  if (tab !== 'deco') decoPick = null;
  if (tab === 'deco') renderDeco();
  if (tab === 'shop') renderShopBoosters();
  renderZoneSwitch();
  mountRoom(tab);
  $(tab).scrollTop = 0;
}
// Vườn và phòng khách nối liền thành một khu nhà; phòng khách chỉ có khi đã mở (thắng màn 10).
const applyRoom = shown => room3d?.apply(shown, { living: zoneOpen('living', levelsCleared()) });
function mountRoom(tab) {
  if (!room3d) return;
  if (tab === 'shop') return room3d.stop();
  applyRoom(previewDeco(deco, tab === 'deco' ? decoPick : null));
  // Home = khu nhà: kéo để đi qua các khu, chụm để thu nhỏ xem toàn bộ. Deco = khoá vào khu đang trang trí.
  room3d.mount($(`${tab}-room`), { mode: tab === 'home' ? 'hub' : 'room', resetView: tab === 'home', view: tab === 'home' ? HOME_VIEW : undefined });
}
// Home tràn viền: phòng phủ cả màn, thanh trên + logo + khung PLAY đè lên; camera nhắm vào phần trống giữa.
const HOME_VIEW = {
  zoomCap: 1.25, zoomFit: .8,
  insets() {
    const room = $('home-room').getBoundingClientRect();
    const top = document.querySelector('.home-logo').getBoundingClientRect().bottom - room.top + 8;
    const bottom = room.bottom - document.querySelector('.home-actions').getBoundingClientRect().top + 12;
    return { top, bottom };
  },
};
$('tabbar').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (tab) { playSound('pick'); showTab(tab.dataset.tab); }
});

// Phòng CSS phẳng (dự phòng khi không nạp được 3D): tranh, cửa sổ, chậu cây, thảm và mèo; chạm mèo để cưng.
function buildRoom(room, cats) {
  room.innerHTML = '<span class="room-frame"></span><span class="room-window"></span><span class="room-plant"></span><span class="room-rug"></span><div class="room-cats"></div>';
  room.querySelector('.room-cats').append(...cats.map(group => {
    const cat = document.createElement('button');
    cat.className = 'room-cat';
    cat.setAttribute('aria-label', `Pet the ${categories[group].name.toLowerCase()}`);
    addCatArt(cat, group);
    return cat;
  }));
}
function buildFlatRooms() {
  buildRoom($('home-room'), deco.cats.slice(0, 3));
  buildRoom($('deco-room'), deco.cats.slice(0, 3));
}
function petRoomCat(cat) {
  cat.classList.remove('petted');
  void cat.offsetWidth;
  cat.classList.add('petted');
  clearTimeout(cat.petTimer);
  cat.petTimer = setTimeout(() => cat.classList.remove('petted'), 1100);
  if (reduceMotion.matches) return;
  const room = cat.closest('.room'), box = room.getBoundingClientRect(), rect = cat.getBoundingClientRect();
  for (let i = 0; i < 4; i++) {
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = '♥';
    heart.style.left = `${rect.left - box.left + rect.width * (.3 + Math.random() * .4)}px`;
    heart.style.top = `${rect.top - box.top + rect.height * .2}px`;
    heart.style.setProperty('--dx', `${(Math.random() - .5) * 40}px`);
    heart.style.setProperty('--rot', `${(Math.random() - .5) * 40}deg`);
    heart.style.animationDelay = `${i * 110}ms`;
    heart.style.fontSize = `${14 + Math.random() * 8}px`;
    room.append(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}
document.addEventListener('click', event => {
  const cat = event.target.closest('.room-cat');
  if (cat) petRoomCat(cat);
});
const roomHint = $('deco-room').querySelector('.room-hint');
buildFlatRooms();
import('./deco-room.mjs').then(({ createRoom, thumbnail }) => {
  room3d = createRoom();
  room3d.setNight(night);
  decoThumbnail = thumbnail;
  $('home-room').replaceChildren();
  $('deco-room').replaceChildren(roomHint);
  $('home-room').classList.add('is-3d');
  $('deco-room').classList.add('is-3d');
  const open = TABS.find(tab => !$(tab).hidden);
  if (open) mountRoom(open);
  if (open === 'deco') renderDeco(); // thay quả cầu màu bằng ảnh chụp model
}).catch(error => console.warn('3D room unavailable, using the flat room.', error));

// ===== Deco: mua / đặt đồ, đổi tường, sàn, chọn mèo. Chọn món = xem trước ngay trong phòng. =====
const FURNISHING = entry => entry.cat === 'furniture' || entry.cat === 'cats';
function renderDeco() {
  const unlocked = unlockedCount(loadProgress());
  $('deco').querySelectorAll('.chip').forEach(chip => { chip.textContent = ZONES[deco.zone].cats[chip.dataset.cat]; });
  $('deco-grid').replaceChildren(...catalogFor(deco.zone, decoCat).map(entry => {
    const status = itemStatus(deco, entry, unlocked);
    const node = document.createElement('button');
    node.className = `deco-item ${status}${decoPick === entry ? ' picked' : ''}`;
    node.dataset.id = entry.id;
    const thumb = entry.breed ? `<span class="thumb cat-thumb">${catMarkup[entry.breed]}</span>`
      : decoThumbnail ? `<img class="thumb thumb-3d" src="${decoThumbnail(entry)}" alt="">`
      : `<span class="thumb" style="--c:${entry.color}"></span>`;
    const tag = status === 'locked' ? `🔒 Level ${entry.lock}` : status === 'using' ? (FURNISHING(entry) ? 'In room' : 'Using')
      : status === 'owned' ? (entry.cat === 'cats' ? 'Add' : 'Owned') : `<i class="ico-coin"></i>${entry.price}`;
    node.innerHTML = `${thumb}<span>${entry.name}</span><em>${tag}</em>`;
    return node;
  }));
  renderDecoAction(unlocked);
}
function renderDecoAction(unlocked) {
  const button = $('deco-do');
  if (!decoPick) {
    $('deco-selected').textContent = `Pick an item to preview it in your ${deco.zone === 'garden' ? 'garden' : 'room'}`;
    button.hidden = true;
    return;
  }
  const status = itemStatus(deco, decoPick, unlocked), occupant = occupantOf(deco, decoPick);
  const labels = {
    locked: `Unlocks at level ${decoPick.lock}`, poor: `<i class="ico-coin"></i> ${decoPick.price}`, buy: `Buy <i class="ico-coin"></i> ${decoPick.price}`,
    owned: decoPick.cat === 'cats' ? 'Add to room' : occupant ? 'Swap' : FURNISHING(decoPick) ? 'Place' : 'Use', using: FURNISHING(decoPick) ? 'Remove' : 'Using',
  };
  // Phương án thay thế: cho biết sẽ thay món nào đang ở cùng chỗ.
  const swapText = occupant && status !== 'locked' ? ` · replaces ${occupant.name}` : '';
  $('deco-selected').textContent = status === 'poor' ? `${decoPick.name} · need ${decoPick.price - deco.coins} more` : decoPick.name + swapText;
  button.hidden = false;
  button.innerHTML = labels[status];
  button.disabled = status === 'locked' || status === 'poor' || (status === 'using' && !FURNISHING(decoPick));
  button.classList.toggle('ghost', status === 'using');
}
function pickDeco(entry) {
  decoPick = entry;
  applyRoom(previewDeco(deco, entry));
  if (entry) room3d?.focus(entry.id);
  renderDeco();
}
// Chạm lần 1: xem trước trong phòng. Chạm lại đúng món đang xem: hộp xác nhận (mua / đặt / đổi / gỡ).
$('deco-grid').addEventListener('click', event => {
  const entry = itemById(event.target.closest('.deco-item')?.dataset.id);
  if (!entry) return;
  if (decoPick === entry) openDecoConfirm();
  else pickDeco(entry);
});
function openDecoConfirm() {
  const unlocked = unlockedCount(loadProgress()), status = itemStatus(deco, decoPick, unlocked), occupant = occupantOf(deco, decoPick);
  if (status === 'locked') return showToast(`Unlocks at level ${decoPick.lock}`);
  if (status === 'using' && !FURNISHING(decoPick)) return showToast('Already in use');
  const tile = document.querySelector(`#deco-grid .deco-item[data-id="${decoPick.id}"] .thumb`);
  $('deco-confirm-thumb').replaceChildren(...(tile ? [tile.cloneNode(true)] : []));
  $('deco-confirm-name').textContent = decoPick.name;
  const price = `<i class="ico-coin"></i> ${decoPick.price}`;
  const notes = {
    buy: `Buy for ${price}?${occupant ? ` It replaces ${occupant.name}.` : ''}`,
    poor: `You need ${price} — ${decoPick.price - deco.coins} more coins.`,
    owned: occupant ? `Swap ${occupant.name} for this?` : decoPick.cat === 'cats' ? 'Add this cat to your room?' : FURNISHING(decoPick) ? 'Place it in your room?' : 'Use this one?',
    using: 'Take it out of your room?',
  };
  $('deco-confirm-note').innerHTML = notes[status];
  const ok = $('deco-confirm-ok');
  ok.innerHTML = { buy: `Buy ${price}`, poor: 'Not enough coins', owned: occupant ? 'Swap' : decoPick.cat === 'cats' ? 'Add' : FURNISHING(decoPick) ? 'Place' : 'Use', using: 'Remove' }[status];
  ok.disabled = status === 'poor';
  $('deco-confirm').showModal();
}
$('deco-confirm-cancel').onclick = () => $('deco-confirm').close();
$('deco-confirm-ok').onclick = () => { $('deco-confirm').close(); $('deco-do').onclick(); };
$('deco-do').onclick = () => {
  if (!decoPick) return;
  const unlocked = unlockedCount(loadProgress());
  const next = applyAction(deco, decoPick, unlocked);
  if (next.error) return showToast(next.error);
  const bought = next.coins < deco.coins;
  deco = next;
  saveDeco(deco);
  refreshWallet();
  if (bought) showToast(`Bought ${decoPick.name}!`);
  playSound(bought ? 'reward' : 'pick');
  if (!room3d) buildFlatRooms();
  // Vừa gỡ ra thì bỏ chọn luôn, không thì bản xem trước lại đặt món đó vào phòng.
  pickDeco(itemStatus(deco, decoPick, unlocked) === 'using' ? decoPick : null);
};
$('deco').querySelector('.chips').addEventListener('click', event => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  chip.parentElement.querySelectorAll('.chip').forEach(other => {
    other.classList.toggle('on', other === chip);
    other.setAttribute('aria-selected', other === chip);
  });
  decoCat = chip.dataset.cat;
  pickDeco(null);
});

// ===== Khu: vườn (màn 1–10) / phòng khách (mở khi thắng màn 10). Mỗi khu lưu đồ riêng, mèo dùng chung. =====
const levelsCleared = () => clearedCount(loadProgress());
function renderZoneSwitch() {
  const cleared = levelsCleared();
  document.querySelectorAll('.zone-switch button').forEach(button => {
    const zone = button.dataset.zone, open = zoneOpen(zone, cleared);
    button.classList.toggle('on', zone === deco.zone);
    button.classList.toggle('locked', !open);
    button.setAttribute('aria-selected', zone === deco.zone);
    button.innerHTML = open ? ZONES[zone].name : `🔒 ${ZONES[zone].name}`;
  });
}
document.addEventListener('click', event => {
  const button = event.target.closest('.zone-switch button');
  if (!button) return;
  const zone = button.dataset.zone;
  if (!zoneOpen(zone, levelsCleared())) return showToast(`Beat level ${ZONES[zone].unlockAfter} to unlock the ${ZONES[zone].name.toLowerCase()}`);
  if (zone === deco.zone) return;
  deco = { ...deco, zone };
  saveDeco(deco);
  decoPick = null;
  renderZoneSwitch();
  renderDeco();
  applyRoom(deco); // camera Deco lướt sang khu vừa chọn (nút chọn khu giờ chỉ còn ở Deco)
});

let toastTimer = 0;
function showToast(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
}
// Shop (tiền thật) vẫn là khung giao diện: bấm vào chỉ báo "sắp có".
document.addEventListener('click', event => { if (event.target.closest('.soon')) showToast('Coming soon!'); });

// Icon ô Hold cho bảng vào màn (màn mở Hold).
const HOLD_SVG = '<svg viewBox="0 0 46 46"><rect x="5" y="7" width="36" height="32" rx="9" fill="#f5dc9c" stroke="#c79a4f" stroke-width="2.5"/><path d="M23 15v16M15 23h16" stroke="#d38a3a" stroke-width="4" stroke-linecap="round"/></svg>';
function startLevel(index, skipIntro = false) {
  const level = LEVELS[index];
  hideMenus();
  $('map').hidden = true;
  newGame(index);
  if (skipIntro) return renderTutorial();
  // Bảng vào màn "móc" người chơi bằng bố cục theo độ khó: nhãn cấp độ + màu nền; boss nền tối, bảng rung, nút đỏ.
  // Nhãn và vật cản lấy từ bản màn đã chỉnh theo profile (state.level), không phải bản gốc.
  const tier = tierOf(index, state.plan), dialog = $('intro-dialog'), badge = $('intro-tier');
  dialog.dataset.tier = tier.style;
  badge.hidden = false;
  badge.innerHTML = `${tier.icon}<span>${tier.label}</span>`;
  const { plan } = state;
  $('intro-number').textContent = `Level ${index + 1}${DDA_DEBUG ? ` · ${plan.profile} ${plan.shift >= 0 ? '+' : ''}${plan.shift} (${plan.baseCount}→${plan.count})${plan.deal ? ` · ${plan.deal}` : ''}` : ''}`;
  const mechanics = [...(level.introduces === 'hold' ? ['hold'] : []), ...levelMechanics(state.level)];
  const MECH = { crate: ['Crates', CRATE_SVG], metal: ['Metal blocks', METAL_SVG], hold: ['Hold slot', HOLD_SVG] };
  $('intro-mechanics').hidden = !mechanics.length;
  $('intro-mechanics').innerHTML = mechanics.map(kind => `<span class="mechanic${level.introduces === kind ? ' new' : ''}" title="${MECH[kind][0]}">${MECH[kind][1]}${level.introduces === kind ? '<b>NEW</b>' : ''}</span>`).join('');
  dialog.showModal();
  renderTutorial(); // bảng giới thiệu đang mở -> ẩn, đóng bảng thì hiện
}
$('intro-dialog').addEventListener('close', () => { startTracking(); renderTutorial(); });

// ===== Metric cho độ khó thích ứng: thời gian nghĩ mỗi lượt, AFK, booster, bỏ ngang, đứng ở bảng kết quả =====
// Ghi một lần thử vào profile (mỗi ván một lần). Trả về true nếu được tặng quà (thắng sau chuỗi "sắp bỏ game").
function recordTry(win, reason) {
  if (!track || track.done) return false;
  track.done = true;
  if (track.idleSince) track.idleMs += now() - track.idleSince;
  const { plan, level } = state;
  const result = recordAttempt(profile, {
    level: state.levelIndex, win, reason, ratio: +(state.score / level.target).toFixed(3), stars: win ? state.outcome.stars : 0,
    boosters: track.boosters, boostUse: track.boostUse, bought: track.bought, preBoostRatio: track.preBoostRatio, thinkMs: Math.round(median(track.thinks)), idleMs: Math.round(track.idleMs),
    durationMs: Math.round(now() - track.start), profile: plan.profile, shift: plan.shift, mode: plan.mode, count: plan.count,
  });
  profile = result.profile;
  saveProfile(profile);
  return result.gift;
}
// Rời ván giữa chừng (chơi lại / về Home) khi đã đặt ít nhất một thẻ = bỏ ngang.
function recordQuit() {
  if (state && !state.over && state.moves < state.level.moves) recordTry(false, 'quit');
}
let resultShownAt = 0;
function leaveResult() {
  profile = noteDwell(profile, Math.round(now() - resultShownAt));
  saveProfile(profile);
  $('result-dialog').close();
}

function endLevel(win, reason = '') {
  state.over = true;
  state.outcome ??= { win, reason, stars: 0 };
  const gift = recordTry(win, win ? 'win' : state.moves > 0 ? 'stuck' : 'moves');
  if (gift) storeBoosters({ ...boosterStock, moves: boosterStock.moves + 1 });
  // Thua sát nút mà chưa dùng booster: mời dùng +lượt ở lần sau (luật sát nút giữ nguyên độ khó).
  const tip = !win && boostersUnlocked(state.levelIndex) && boosterTip(profile);
  render(win ? '' : `${reason} You scored ${state.score}/${state.level.target} points.`, !win);
  renderTutorial();
  const index = state.levelIndex, last = index === LEVELS.length - 1;
  const stars = win ? state.outcome.stars : 0;
  let coinsEarned = 0;
  if (win) {
    const record = recordWin(loadProgress(), index, stars); // chỉ sao mới (vượt kỷ lục cũ) mới ra xu
    saveProgress(record.progress);
    coinsEarned = record.coins;
    if (coinsEarned) { deco = { ...deco, coins: deco.coins + coinsEarned }; saveDeco(deco); }
  }
  const unlockedLiving = win && index + 1 === ZONES.living.unlockAfter && coinsEarned > 0 && levelsCleared() === ZONES.living.unlockAfter;
  $('result-coins').hidden = !coinsEarned && !gift && !tip;
  if (coinsEarned || gift) setTimeout(() => playSound('reward'), 450);
  $('result-coins').innerHTML = [coinsEarned && `<i class="ico-coin"></i> +${coinsEarned} coins`, unlockedLiving && 'Living room unlocked!',
    gift && `Gift: ${BOOSTER_NAMES.moves} booster`, tip && `So close! Try ${BOOSTER_NAMES.moves} next time.`].filter(Boolean).join(' · ');
  const dialog = $('result-dialog');
  dialog.classList.toggle('win', win);
  $('result-title').textContent = win ? (last ? 'Journey complete!' : 'Level complete!') : reason;
  $('result-score').textContent = `${state.score} / ${state.level.target} points`;
  $('result-next').hidden = !win || last;
  $('result-retry').hidden = win;
  setTimeout(() => { dialog.showModal(); resultShownAt = now(); }, win ? 150 : 700);
}
$('result-next').onclick = () => { leaveResult(); startLevel(state.levelIndex + 1, true); };
$('result-retry').onclick = () => { leaveResult(); startLevel(state.levelIndex); };
$('result-map').onclick = () => { leaveResult(); showTab('home'); };
$('intro-map').onclick = () => { $('intro-dialog').close(); showMap(); };

// Mở game luôn vào Home; màn chơi dựng sẵn phía sau ở level đang mở. PLAY vào thẳng level đó.
function boot() {
  newGame(unlockedCount(loadProgress()) - 1);
  showTab('home');
}
$('tutorial-avatar').innerHTML = catMarkup.orange;

$('restart').onclick = () => { if (!state.animating) { recordQuit(); startLevel(state.levelIndex); } };
$('help').onclick = () => $('help-dialog').showModal();
// Nút cài đặt (Home: ngày/đêm, âm thanh, hướng dẫn; màn chơi: âm thanh, hướng dẫn): bánh răng xổ menu.
// Chạm ra ngoài hoặc Esc thì đóng.
function setSettingsOpen(box, open) {
  box.querySelector('.settings-menu').hidden = !open;
  box.querySelector('.settings-toggle').setAttribute('aria-expanded', open);
}
const closeAllSettings = (except = null) => document.querySelectorAll('.settings').forEach(box => { if (box !== except) setSettingsOpen(box, false); });
document.querySelectorAll('.settings').forEach(box => {
  box.querySelector('.settings-toggle').onclick = () => { playSound('pick'); setSettingsOpen(box, box.querySelector('.settings-menu').hidden); };
});
document.addEventListener('pointerdown', event => closeAllSettings(event.target.closest('.settings')));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAllSettings(); });
['home-help', 'game-help'].forEach(id => { $(id).onclick = () => { closeAllSettings(); $('help-dialog').showModal(); }; });
function renderSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach(button => {
    button.setAttribute('aria-pressed', soundOn());
    button.setAttribute('aria-label', soundOn() ? 'Sound on, tap to mute' : 'Sound off, tap to unmute');
    button.innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${soundOn() ? 'sound' : 'mute'}"/></svg>`;
  });
}
document.querySelectorAll('.sound-toggle').forEach(button => { button.onclick = () => { setSound(!soundOn()); renderSoundButtons(); }; });
renderSoundButtons();

// Ngày / đêm cho khu mèo (Home + Deco dùng chung một cảnh 3D). Lưu lại cho lần sau.
let night = readText(SAVE_KEYS.night) === 'on';
function applyNight() {
  const button = $('night-toggle');
  button.setAttribute('aria-pressed', night);
  button.setAttribute('aria-label', night ? 'Night, tap for day' : 'Day, tap for night');
  button.title = night ? 'Night' : 'Day';
  button.innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${night ? 'moon' : 'sun'}"/></svg>`;
  ['home-room', 'deco-room'].forEach(id => $(id).classList.toggle('night', night));
  room3d?.setNight(night);
}
$('night-toggle').onclick = () => { night = !night; writeText(SAVE_KEYS.night, night ? 'on' : 'off'); playSound('pick'); applyNight(); };
applyNight();
$('home-play').onclick = () => startLevel(unlockedCount(loadProgress()) - 1);
$('home-journey').onclick = showMap;
$('map-back').onclick = () => showTab('home');
$('open-map').onclick = () => { if (!state.animating) { recordQuit(); showTab('home'); } };
boot();
