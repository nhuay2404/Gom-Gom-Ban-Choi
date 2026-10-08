// ===== Luồng điều khiển MÀN CHƠI (gameplay) =====
// Một ván từ lúc vào màn tới bảng kết quả: kéo / xoay / đặt thẻ, Hold, anim gom, booster trong ván, AFK, sắp hết lượt,
// tutorial, bảng vào màn, kết quả và metric cho độ khó thích ứng. Luật nằm ở gameplay/session.mjs; file này gọi luật rồi vẽ.
// Không đụng Home / Deco / Shop / Map: cần chuyển màn hình thì gọi qua `menus` (menu-controller.js, nối ở main.js).
import { mergeTarget, placementIndices } from '../gameplay/board-rules.mjs';
import { clusterPoints, POINTS_PER_CRATE } from '../gameplay/scoring.mjs';
import { categories, catMarkup, addArt as addCatArt, LOW_MOVE_MOODS } from '../ui/cat-art.mjs';
import { LEVELS } from '../gameplay/levels.mjs';
import * as game from '../gameplay/session.mjs';
import { loadProgress, saveProgress, levelsCleared as clearedCount, recordWin, levelTier } from '../gameplay/progression.mjs';
import { BOARD, TIMING, DRAG, LOW_MOVES, BOOSTERS, LIVEOPS } from '../gameplay/tuning.mjs';
import { spendBooster, boostersUnlocked } from '../gameplay/boosters.mjs';
import { CRATE_SVG, METAL_SVG, cageSvg } from '../ui/board-art.mjs';
import * as ob from './onboarding.js';
import { playSound } from '../ui/sound.mjs';
import { loadProfile, saveProfile, startVisit, planLevel, recordAttempt, noteDwell, elementCount, difficultyOf, boosterTip } from '../gameplay/adaptive.mjs';
import { ZONES, GARDEN_EXPANSION } from '../deco/deco-data.mjs';
import { $, reduceMotion, DEV_MODE, showToast, getDeco, setDeco, getBoosters, storeBoosters, buyOne, priceTag, BOOSTER_NAMES, getLiveOps, setLiveOps } from './shared.js';
import * as lo from '../gameplay/liveops.mjs';
import { openLives, offerContinue, questEvent, eventLevelStart, eventMatch, eventLevelEnd, offerFishDouble } from './liveops-ui.js';

// Luồng menu (showTab, showMap, hideMenus, menuOpen): main.js nối vào lúc khởi động.
let menus = null;
export function connectMenus(menuController) { menus = menuController; }

// Giao diện màn chơi + menu. Luật của một ván nằm ở session.mjs (thuần logic): file này chỉ gọi luật rồi vẽ/diễn.
// Mỗi màn (levels.mjs): đạt điểm mục tiêu trong giới hạn lượt. Hết lượt hoặc hết chỗ đặt là thua.
const { PREVIEW_COUNT } = BOARD;
// Kích thước bàn của màn đang chơi (mỗi màn một cỡ/hình, xem board-shapes.mjs); đặt lại ở newGame.
let W = BOARD.W, H = BOARD.H;
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
  if (turn.error) playSound('invalid');
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
  pendingFlights += merges.length + (match.broken?.length || 0); // điểm giữ lại tới khi đốm bay vào thanh
  const ghosts = spawnMergeGhosts(merges, result);
  const done = animateMerges(ghosts, merges);
  breakCrates(match.broken, DROP_MS + LIFT_MS + MERGE_MS * .7);
  match.broken?.forEach(index => { const cell = cellEl(index); if (cell) showMergeScore(cell, POINTS_PER_CRATE, DROP_MS + LIFT_MS + MERGE_MS * .7 + 120, 'crate'); else releaseScoreSlot(); });
  rattleCages(match, DROP_MS + LIFT_MS + MERGE_MS * .7);
  pendingMerges.add(done);
  done.finally(() => pendingMerges.delete(done));
  finishTurn(turn);
}

// Chuồng mèo khi có gom sát bên: chuồng còn khóa thì rung + một ổ khóa bật ra; chuồng vỡ thì song sắt văng ra, mèo được thả.
// Ô chuồng đã được vẽ lại theo trạng thái mới (bớt ổ khóa / hết chuồng), anim chạy chồng lên sau khi cụm gom xong.
function rattleCages(match, delay) {
  if (reduceMotion.matches || (!match.caged?.length && !match.freed?.length)) return;
  setTimeout(() => {
    const layer = fxLayer();
    match.caged.forEach(index => {
      const cell = cellEl(index);
      if (!cell) return;
      cell.classList.add('cage-hit');
      cell.addEventListener('animationend', () => cell.classList.remove('cage-hit'), { once: true });
      flyBits(layer, cell, 'cage-lock', 1);
    });
    match.freed.forEach(index => {
      const cell = cellEl(index);
      if (!cell) return;
      flyBits(layer, cell, 'cage-bar', 6);
      flyBits(layer, cell, 'cage-lock', 1);
      spawnPuff(cell);
    });
  }, delay);
}
function flyBits(layer, cell, className, count) {
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    bit.className = className;
    bit.style.cssText = `left:${cell.offsetLeft + cell.offsetWidth / 2}px;top:${cell.offsetTop + cell.offsetHeight / 2}px`;
    layer.append(bit);
    const angle = count > 1 ? (i / count) * Math.PI * 2 + Math.random() * .5 : -Math.PI / 2 + (Math.random() - .5), dist = cell.offsetWidth * (.6 + Math.random() * .5);
    bit.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 22}px)) rotate(${(Math.random() - .5) * 540}deg)`, opacity: 0 },
    ], { duration: 620, easing: 'cubic-bezier(.2, .7, .4, 1)', fill: 'forwards' }).finished.then(() => bit.remove());
  }
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
    if (!targetGhost) return releaseScoreSlot();
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
    showMergeScore(targetGhost, clusterPoints(cluster.length), MERGE_MS * .6, scoreTier(cluster.length)); // điểm bật ra ngay lúc cụm chụm lại
  });
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  ghosts.forEach(ghost => ghost.remove());
}

// Thắng: chờ các anim gom còn dở xong, rồi mọi mèo còn lại bị nhấc bổng và bay vút lên, bàn trống trơn.
// Bàn trống sau khi thắng: giữ ô ngoài bàn ('#') để lưới không bị dựng lại thành hình chữ nhật giữa anim.
const emptiedBoard = () => state.board.map(cell => (cell?.void ? cell : null));
async function celebrateWin(message) {
  state.animating = true;
  await Promise.all([...pendingMerges]);
  await scoreSettled(); // lượt gom cuối: đợi điểm bay hết vào thanh + thanh chạy đầy tới nóc rồi mèo mới bay lên
  document.body.classList.add('level-over'); // thanh điểm vừa đầy: ẩn ngay UI chơi (xem endLevel)
  const occupied = state.board.map((object, index) => object?.group ? index : null).filter(index => index !== null);
  breakCrates(state.board.map((object, index) => object?.block && !object.metal ? index : null).filter(index => index !== null), WIN_PAUSE_MS);
  if (!reduceMotion.matches && occupied.length) {
    await wait(WIN_PAUSE_MS); // để người chơi thấy lần gom cuối + thông báo thắng trước
    // Chỉ bóng mèo bay đi; ô grid được trả về ô trống ngay nên bàn luôn nguyên vẹn.
    const ghostMap = spawnGhosts(occupied, state.board), ghosts = [...ghostMap.values()];
    const rowOf = new Map([...ghostMap].map(([index, ghost]) => [ghost, Math.floor(index / W)]));
    state.board = emptiedBoard();
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
    await wait(80); // cả bàn lơ lửng một nhịp rồi mới chụm lại
    // Pha 2: mọi mèo cùng lúc bay vào tâm board, giữ nguyên hình dạng (không co giãn). Thân dưới lủng lẳng
    // chuyển động theo quán tính như con lắc: lấy đà thì thân lệch về phía tâm, lao đi thì thân bị kéo lùi lại,
    // tới nơi phanh gấp thì thân văng tới trước. Tới tâm các mèo chồng lên nhau, co lại và hợp nhất thành một chớp sáng.
    const cx = $('board').offsetWidth / 2, cy = $('board').offsetHeight / 2, FLY_MS = 640;
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
  state.board = emptiedBoard();
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
// Điểm cộng: số "+N" bật to ở chỗ gom (nảy quá cỡ rồi về), rồi vỡ thành các đốm sao vàng bay vòng cung vào đầu thanh điểm.
// Thanh điểm / số điểm chỉ tăng khi đốm cuối cùng tới nơi (shownScore), đốm đầu tới thì thanh nảy + loé sáng.
// Giảm chuyển động: không có pop / bay, thanh cập nhật ngay.
// pendingFlights = điểm đã được tính vào state nhưng đốm chưa bật ra (cụm còn đang chụm lại): giữ thanh điểm đứng yên cho tới khi đốm bay tới.
let shownScore = 0, scoreFlights = 0, pendingFlights = 0, flightGen = 0;
const releaseScoreSlot = () => { pendingFlights = Math.max(0, pendingFlights - 1); };
// Mỗi loại điểm một màu + một cỡ hiệu ứng (màu / cỡ chữ / đốm ở CSS .score-pop.t-* / .score-orb.t-*):
//   crate (thùng vỡ, +10) · m3 · m4 · m5 · m6 · m7 (cụm 7 trở lên). Cụm càng to: chữ càng to, nảy càng mạnh, càng nhiều đốm bay.
const SCORE_TIERS = {
  crate: { orbs: 3, punch: 1.35 },
  m3: { orbs: 5, punch: 1.5 },
  m4: { orbs: 7, punch: 1.65 },
  m5: { orbs: 9, punch: 1.8 },
  m6: { orbs: 12, punch: 1.95 },
  m7: { orbs: 16, punch: 2.15 },
};
const scoreTier = size => `m${Math.min(7, Math.max(3, size))}`;
function showMergeScore(cell, points, delay = 300, tier = 'm3') {
  const { orbs, punch } = SCORE_TIERS[tier];
  if (reduceMotion.matches) return releaseScoreSlot();
  const rect = cell.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2, gen = flightGen;
  scoreFlights++;
  releaseScoreSlot();
  const pop = document.createElement('span');
  pop.className = `score-pop t-${tier}`;
  pop.textContent = `+${points}`;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.append(pop);
  const at = (dy, scale) => `translate(-50%, -50%) translateY(${dy}px) scale(${scale})`;
  pop.animate([
    { transform: at(0, .2), opacity: 0 },
    { transform: at(-26, punch), opacity: 1, offset: .22 },
    { transform: at(-30, .92), offset: .36 },
    { transform: at(-32, 1.05), offset: .46 },
    { transform: at(-34, 1), offset: .82 },
    { transform: at(-34, .4), opacity: .2 },
  ], { duration: 420, delay, easing: 'ease-out', fill: 'both' }).finished.catch(() => {}).then(() => pop.remove());
  // Hạt bay vào thanh gần như cùng lúc số điểm bật ra (không đợi số điểm tan).
  setTimeout(() => { if (gen === flightGen) flyToBar(x, y - 34, points, gen, tier, orbs); }, delay + 110);
}
function flyToBar(x, y, points, gen, tier, count) {
  const track = $('score-fill').parentElement, bar = track.getBoundingClientRect();
  const tip = Math.min(1, (shownScore + points) / state.level.target);
  const tx = bar.left + Math.max(bar.height / 2, bar.width * tip - bar.height / 2), ty = bar.top + bar.height / 2;
  let landed = 0;
  for (let i = 0; i < count; i++) {
    const orb = document.createElement('span');
    orb.className = `score-orb t-${tier}`;
    orb.style.left = `${x}px`;
    orb.style.top = `${y}px`;
    document.body.append(orb);
    // Toả ra quanh số rồi bay vòng cung (lệch sang một bên) vào đầu thanh, nhỏ dần
    const angle = (i / count) * Math.PI * 2 + Math.random() * .5, spread = 26 + Math.random() * 14;
    const sx = Math.cos(angle) * spread, sy = Math.sin(angle) * spread, dx = tx - x, dy = ty - y;
    const bend = (i % 2 ? 1 : -1) * (40 + Math.random() * 30);
    const at = (px, py, scale) => `translate(-50%, -50%) translate(${px}px, ${py}px) scale(${scale})`;
    orb.animate([
      { transform: at(0, 0, .3), opacity: 0 },
      { transform: at(sx, sy, 1.2), opacity: 1, offset: .2 },
      { transform: at(sx + (dx - sx) * .5 + bend, sy + (dy - sy) * .45, .95), offset: .6 },
      { transform: at(dx, dy, .45), opacity: 1 },
    ], { duration: 240 + i * 12, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' }).finished.catch(() => {}).then(() => {
      orb.remove();
      if (gen !== flightGen) return;
      playSound('fill', count > 1 ? (i / (count - 1)) * 10 : 5);
      if (++landed === 1) bumpScoreBar();
      if (landed < count) return;
      shownScore = Math.min(state.score, shownScore + points);
      if (--scoreFlights <= 0) { scoreFlights = Math.max(0, scoreFlights); if (!pendingFlights) shownScore = state.score; }
      renderScore();
    });
  }
}
// Đợi mọi điểm đang bay chạm thanh, rồi đợi thanh chạy xong (transition width .45s) + nghỉ một nhịp ngắn khi đã đầy.
const SCORE_FILL_MS = 450, FULL_HOLD_MS = 350;
async function scoreSettled() {
  if (reduceMotion.matches) return;
  const gen = flightGen;
  while ((scoreFlights > 0 || pendingFlights > 0) && gen === flightGen) await wait(50);
  await wait(SCORE_FILL_MS + FULL_HOLD_MS);
}
function bumpScoreBar() {
  const box = $('score-fill').closest('.progress');
  box.animate([{ scale: '1' }, { scale: '1.12 1.25' }, { scale: '.97' }, { scale: '1' }], { duration: 380, easing: 'ease-out' });
  box.classList.remove('gain'); void box.offsetWidth; box.classList.add('gain');
}
// Số điểm + thanh: đang có điểm bay thì giữ số đã hiện (shownScore), bay xong mới tăng.
function renderScore() {
  if (!scoreFlights && !pendingFlights) shownScore = state.score;
  $('score').textContent = shownScore;
  const progress = Math.min(1, shownScore / state.level.target);
  $('score-fill').style.width = `${progress * 100}%`;
  $('score-fill').parentElement.parentElement.classList.toggle('full', progress >= 1);
}

function finishTurn(turn) {
  const { result, match, gained } = turn;
  // Nhiệm vụ ngày: số mèo gom, cụm to, thùng vỡ
  const sizes = match.clusters.map(cluster => cluster.length);
  questEvent('cats', sizes.reduce((sum, n) => sum + n, 0));
  questEvent('big4', sizes.filter(n => n >= 4).length);
  questEvent('big6', sizes.filter(n => n >= 6).length);
  questEvent('crates', match.broken?.length ?? 0);
  // Fish Festival: mỗi cụm gom ra cá = số mèo trong cụm (đếm cả ván thua); giữ tổng của ván để mời nhân đôi lúc thắng
  if (!state.tutorial) state.fish += eventMatch(state.levelIndex, sizes.reduce((sum, n) => sum + n, 0));
  // Sau khi gom, mèo còn lại đã rơi xong rồi -> không chạy anim rơi lần nữa.
  // Mèo vừa đặt mà không bị gom thì rơi xuống ô thật; mèo bị gom đã có bóng mèo lo phần anim.
  state.justPlaced = new Set(result.indices.filter(index => match.board[index]));
  if (match.clusters.length) playSound('merge', Math.max(...match.clusters.map(cluster => cluster.length)));
  else playSound('place');
  const crateText = match.broken?.length ? ` Broke ${match.broken.length} crate${match.broken.length > 1 ? 's' : ''}!` : '';
  const cageText = match.freed?.length ? ` Freed ${match.freed.length} caged cat${match.freed.length > 1 ? 's' : ''}!` : match.caged?.length ? ' A cage lock broke!' : '';
  const goalText = !turn.win && state.score >= state.level.target && state.board.some(object => object?.cage) ? ' Free every caged cat to win!' : '';
  const clearedText = match.groups.length ? `Matched ${match.groups.map(group => categories[group].name).join(', ')}! +${gained} points.${crateText}${cageText}${goalText}` : goalText.trim();
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
  try { source.setPointerCapture(event.pointerId); } catch { /* con trỏ giả (test) / đã nhả */ }
  const rect = source.getBoundingClientRect();
  cardDrag = {
    pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ghost: null, anchor: null,
    grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, width: rect.width, height: rect.height,
    grabbed: grabbedPiece(event.clientX, event.clientY), cells: null,
  };
  source.classList.add('dragging');
  // Đang giữ thẻ: tắt cử chỉ của trình duyệt (chụm phóng to / cuộn) để ngón thứ hai chạm = xoay thẻ.
  document.body.classList.add('card-holding');
}

function moveCardDrag(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
  cardDrag.lastX = event.clientX; cardDrag.lastY = event.clientY;
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
  document.body.classList.remove('card-dragging', 'card-holding');
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
  $('highscore').textContent = state.level.target;
  $('level-title').textContent = `Level ${state.levelIndex + 1}`;
  $('level-title').dataset.digits = String(state.levelIndex + 1).length; // số 2 chữ số: chữ nhỏ lại cho lọt giữa hai lá trên badge
  $('moves').textContent = state.moves;
  renderScore();
  $('booster-bar').querySelector('[data-boost="moves"]').classList.toggle('low-moves', !state.over && state.moves < 3 && boostersUnlocked(state.levelIndex));
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
    cell.dataset.alt = (Math.floor(index / W) + index % W) % 2; // ô xen kẽ hai tông (bàn kiểu bàn cờ)
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
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}${object?.cage ? ` caged cage-${object.cage}` : ''}`;
    cell.setAttribute('aria-label', !object ? `Cell ${index + 1}, empty`
      : object.cage ? `Caged ${categories[object.group].name}. Match next to it to break the lock` : `${object.name}, locked`);
    if (!object) return;
    cell.style.setProperty('--group-color', categories[object.group].color);
    addArt(cell, object);
    if (object.cage) cell.insertAdjacentHTML('beforeend', cageSvg());
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

export function newGame(levelIndex = state?.levelIndex ?? 0) {
  // Màn không còn cố định: bật/tắt element theo profile người chơi (adaptive.mjs); màn có tutorial giữ bản gốc.
  const plan = planLevel(profile, levelIndex), { level } = plan;
  // Luật của ván nằm trong session; các trường còn lại (preview, animating...) chỉ phục vụ hiển thị.
  state = Object.assign(game.createSession(levelIndex, { level }), { plan, preview: null, previewAnchor: null, animating: false });
  ({ W, H } = state);
  hammerArmed = false;
  startTracking();
  // LiveOps: lượt ban đầu (bỏ ngang = đã dùng ít nhất một lượt), booster miễn phí của ván, số lần continue trong lượt chơi.
  state.free = { hammer: 0, swap: 0 };
  state.continues = { gems: 0, ad: false };
  state.fish = 0;
  const streak = !state.tutorial && lo.streakActive(levelIndex) && lo.streakBonus(getLiveOps().streak);
  if (streak) {
    state.moves += streak.moves;
    state.free = { hammer: streak.hammer ?? 0, swap: streak.swap ?? 0 };
    // quà chuỗi thắng = có trợ giúp: tính như đã dùng booster để độ khó thích ứng không đọc thành người chơi giỏi lên
    track.boosters++;
  }
  state.startMoves = state.moves;
  // Lần chơi lại sau khi thua sát nút: nút +lượt nhấp nháy mời dùng (adaptive.mjs: suggestBooster).
  $('booster-bar').querySelector('[data-boost="moves"]').classList.toggle('suggest', plan.suggestBooster && boostersUnlocked(levelIndex));
  // Ván mới: thanh điểm về 0 ngay, không tụt dần từ ván trước.
  const fill = $('score-fill');
  flightGen++; scoreFlights = 0; pendingFlights = 0; // điểm còn bay từ ván trước: bỏ
  document.querySelectorAll('.score-pop, .score-orb').forEach(node => node.remove());
  fill.style.transition = 'none';
  const streakText = streak ? ` Win streak ×${getLiveOps().streak}: +${streak.moves} moves${streak.hammer ? ' & free boosters' : ''}!` : '';
  render(`Reach ${level.target} points in ${state.moves} moves!${state.board.some(object => object?.cage) ? " Free every caged cat too!" : ""}${streakText}`);
  void fill.offsetWidth;
  fill.style.transition = '';
  renderTutorial();
}

// Điện thoại: một ngón giữ + kéo thẻ, chạm ngón thứ hai (ở đâu cũng được) = xoay thẻ ngay trong tay. Bóng kéo đổi
// theo hình mới, con mèo đang cầm đổi sang con nằm dưới ngón tay, ô xem trước trên bàn tính lại.
function rotateWhileDragging(event) {
  if (!cardDrag || event.pointerId === cardDrag.pointerId || state.animating || state.over) return;
  event.preventDefault();
  event.stopPropagation();
  const turn = game.rotate(state);
  if (!turn.ok) return;
  playSound('rotate');
  state.preview = null;
  render();
  if (turn.tutorialAdvanced) showNextTutorial(250);
  const source = $('active-card');
  source.classList.add('dragging');
  if (!cardDrag.ghost) return; // chưa kịp kéo: thẻ ở dock đã xoay, kéo tiếp là bóng mới
  const card = source.getBoundingClientRect();
  let best = 0, bestDistance = Infinity;
  source.querySelectorAll('.piece-object').forEach((piece, index) => {
    const c = centerOf(piece.getBoundingClientRect());
    const distance = Math.hypot(c.x - card.left - cardDrag.grabX, c.y - card.top - cardDrag.grabY);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  cardDrag.grabbed = best;
  cardDrag.ghost.innerHTML = source.innerHTML;
  cardDrag.ghost.animate([{ rotate: '-90deg', scale: .85 }, { rotate: '0deg', scale: 1 }], { duration: 180, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  if (cardDrag.lastX !== undefined) moveCardDrag({ pointerId: cardDrag.pointerId, clientX: cardDrag.lastX, clientY: cardDrag.lastY });
}
document.addEventListener('pointerdown', rotateWhileDragging, { capture: true });

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
// Chạm (hoặc rê chuột vào) dồn dập trong PET_ANNOY.WINDOW: từ CHEW lần thì mèo bực (biểu cảm chew), từ ANGRY lần thì nổi giận (angry)
// một lúc, trong lúc giận chạm vào không vui lên. Cùng nhịp với mèo 3D ở Deco (room-cats.mjs PET_ANNOY).
const PET_ANNOY = { WINDOW: 3000, CHEW: 4, ANGRY: 6, MOOD_MS: 2200 };
function annoyCat(cell) {
  const t = performance.now();
  cell.pokes = (cell.pokes || []).filter(at => t - at < PET_ANNOY.WINDOW);
  cell.pokes.push(t);
  const level = cell.pokes.length >= PET_ANNOY.ANGRY ? 'grumpy' : cell.pokes.length >= PET_ANNOY.CHEW ? 'grumpy-chew' : '';
  if (!level) return cell.classList.contains('grumpy');
  cell.classList.remove('petted', 'idle-cute', level === 'grumpy' ? 'grumpy-chew' : 'grumpy');
  cell.classList.add(level);
  clearTimeout(cell.grumpyTimer);
  cell.grumpyTimer = setTimeout(() => { cell.classList.remove('grumpy', 'grumpy-chew'); cell.pokes = []; }, PET_ANNOY.MOOD_MS);
  return true;
}
$('board').addEventListener('pointerover', event => {
  if (event.pointerType !== 'mouse' || state.animating) return;
  const cell = event.target.closest('.cell.locked');
  if (cell && !cell.contains(event.relatedTarget)) annoyCat(cell);
});
function petCat(cell) {
  if (annoyCat(cell)) { playSound('grumpy'); return; }
  cell.classList.remove('petted', 'idle-cute');
  void cell.offsetWidth; // chạm liên tiếp thì chạy lại anim
  cell.classList.add('petted');
  clearTimeout(cell.petTimer);
  cell.petTimer = setTimeout(() => cell.classList.remove('petted'), 1100);
  playSound('pet');
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

// Gửi tạm không giới hạn số lần mỗi lượt. Chạm ô gửi tạm: trống = cất thẻ đang bóc vào, có thẻ = đổi về ô đang bóc.
$('hold').onclick = () => { if (state.holdOn && !state.over) holdActive(); };

// ===== Booster: mở từ màn BOOSTERS.UNLOCK_LEVEL, không tốn lượt; hết thì chạm là mua luôn bằng xu =====
// Búa đang giơ: chạm một ô trên bàn để đập (kho booster + mua bằng xu ở shared.js).
let hammerArmed = false;
function renderBoosters() {
  const bar = $('booster-bar');
  bar.hidden = !boostersUnlocked(state.levelIndex);
  const busy = state.over || !!tutorialStep();
  bar.querySelectorAll('[data-boost]').forEach(button => {
    const id = button.dataset.boost, free = state.free?.[id] ?? 0, count = getBoosters()[id] + free;
    button.disabled = busy;
    button.classList.toggle('has-free', free > 0);
    button.classList.toggle('armed', id === 'hammer' && hammerArmed);
    button.classList.toggle('empty', !count);
    button.querySelector('.boost-count').innerHTML = count || priceTag(id);
  });
  document.body.classList.toggle('hammer-armed', hammerArmed);
}
// Booster mua ngay trong ván (hết hàng, trả bằng xu) được ghi riêng để thống kê.
const haveBooster = id => {
  if (state.free?.[id] > 0 || getBoosters()[id] > 0) return true;
  if (!buyOne(id)) return false;
  track.bought++;
  return true;
};
const useBooster = id => {
  track.boosters++; track.boostUse[id]++;
  // booster miễn phí của chuỗi thắng dùng trước, không trừ kho
  if (state.free?.[id] > 0) state.free[id]--;
  else storeBoosters(spendBooster(getBoosters(), id));
  questEvent('booster');
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
  playSound('smash');
  if (turn.object.block) breakCrates([index], 0);
  else if (turn.freed) rattleCages({ caged: [], freed: [index] }, 0);
  else if (!reduceMotion.matches) {
    const ghost = cell.cloneNode(true);
    ghost.classList.add('smash-ghost');
    ghost.style.cssText += `;left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    fxLayer().append(ghost);
    ghost.animate([{ scale: 1, rotate: '0deg', opacity: 1 }, { scale: 1.15, rotate: '-12deg', opacity: 1, offset: .25 }, { scale: 0, rotate: '200deg', opacity: 0 }],
      { duration: 420, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished.then(() => ghost.remove());
    spawnPuff(cell);
  }
  if (turn.win) {
    const message = `You win with ${state.score} points! ✨`;
    render(message);
    setTimeout(() => playSound('complete'), 380);
    return celebrateWin(message).then(() => endLevel(true));
  }
  render(turn.object.block ? 'Crate smashed!' : turn.freed ? `The ${categories[turn.object.group].name} is free!` : `Bye, ${categories[turn.object.group].name}!`);
}

// AFK: 5 giây không thao tác thì mọi con mèo buồn ngủ (body.afk).
// Game mobile: chỉ tính là "có chơi" khi ngón tay chạm màn hình (nhấn, kéo, nhả). Rê chuột không tính.
const { AFK_MS, AFK_SLEEP_MS } = TIMING;
let afkTimer = 0, deepTimer = 0;
function goAfk() {
  if (state.over || state.animating || cardDrag) return armAfk();
  if (document.body.classList.contains('low-moves')) return armAfk(); // sắp hết lượt: mèo lo lắng, không ngủ
  document.body.classList.add('afk');
  // Lim dim (sleepy) một lúc rồi ngủ say (sleep + zzz)
  clearTimeout(deepTimer);
  deepTimer = setTimeout(() => { if (document.body.classList.contains('afk')) document.body.classList.add('afk-deep'); }, AFK_SLEEP_MS);
  // Metric idle: tính cả khoảng chờ trước khi mèo ngủ (đã AFK_MS không chạm), chỉ khi đang trong ván.
  if (track && !track.done && !menus.menuOpen() && $('map').hidden) track.idleSince = now() - AFK_MS;
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
  // Vừa chuyển sang "sắp hết lượt": mèo kêu lo lắng một tiếng (không kêu lại mỗi lượt)
  if (low && !document.body.classList.contains('low-moves')) playSound('worried');
  document.body.classList.toggle('low-moves', low);
  if (low) document.body.classList.remove('afk', 'afk-deep');
  if (!low) return;
  const cats = [...document.querySelectorAll('#board > .cell.locked .cat, #active-card .cat, #hold .cat, #next-cards .cat')];
  // Xáo vòng các kiểu để các con cạnh nhau hiếm khi trùng biểu cảm.
  const offset = Math.floor(Math.random() * LOW_MOVE_MOODS.length);
  cats.forEach((cat, i) => { if (!cat.dataset.low) cat.dataset.low = LOW_MOVE_MOODS[(i * 3 + offset + Math.floor(Math.random() * 2)) % LOW_MOVE_MOODS.length]; });
}

function armAfk() {
  document.body.classList.remove('afk', 'afk-deep');
  clearTimeout(deepTimer);
  if (track?.idleSince) { track.idleMs += now() - track.idleSince; track.idleSince = 0; }
  clearTimeout(afkTimer);
  afkTimer = setTimeout(goAfk, AFK_MS);
}
addEventListener('pointerdown', armAfk, { passive: true });
addEventListener('pointerup', armAfk, { passive: true });

// Mèo đứng yên trên bàn thỉnh thoảng đổi sang mặt cute (mắt long lanh) trong chốc lát, mỗi lần một con ngẫu nhiên.
// Không chạy khi AFK (đang ngủ), sắp hết lượt (mặt lo), hết ván, đang có anim hay đang kéo thẻ.
const IDLE_FACE = { EVERY: [1400, 3200], HOLD: 1500 };
function idleFace() {
  setTimeout(idleFace, IDLE_FACE.EVERY[0] + Math.random() * (IDLE_FACE.EVERY[1] - IDLE_FACE.EVERY[0]));
  const body = document.body.classList;
  if (!state || state.over || state.animating || cardDrag || body.contains('afk') || body.contains('low-moves') || !$('map').hidden) return;
  const cells = [...document.querySelectorAll('#board > .cell .cat.bitmap')].map(cat => cat.closest('.cell'))
    .filter(cell => !['petted', 'lifted', 'idle-cute', 'grumpy', 'grumpy-chew'].some(name => cell.classList.contains(name)));
  const cell = cells[Math.floor(Math.random() * cells.length)];
  if (!cell) return;
  cell.classList.add('idle-cute');
  setTimeout(() => cell.classList.remove('idle-cute'), IDLE_FACE.HOLD);
}
setTimeout(idleFace, 2000);
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
  if (!step || state.over || !$('map').hidden || menus.menuOpen()) {
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
    // Không có text (hầu hết bước) thì không hiện bong bóng: chỉ có bàn tay + viền sáng.
    bubble.hidden = !step.text;
    $('tutorial-text').textContent = (step.text || '').replace('{target}', state.level.target).replace('{moves}', state.level.moves);
    $('tutorial-next').hidden = step.type !== 'info';
    bubble.classList.toggle('center', step.type === 'info');
    bubble.style.top = step.type === 'info' ? '' : `${$('board').getBoundingClientRect().bottom + 8}px`;
    if (step.text) bubble.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    animateHand(step, holes);
  });
}

// Bàn tay: kéo (từ thẻ tới ô đích, lặp lại) hoặc chạm (nhấn nhịp).
function animateHand(step, holes) {
  const hand = $('tutorial-hand');
  hand.hidden = step.type === 'info';
  if (hand.hidden) return;
  // Kéo dùng ảnh tay "giữ" (có tia), chạm dùng ảnh tay "nhấn" (có sóng).
  $('tutorial-hand-img').src = `./ui/shared/img/tutorial/hand-${step.type === 'drag' || step.type === 'hold' ? 'drag' : 'tap'}.png`;
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
// Nhãn độ khó trên bản đồ (kiểu màu nút màn): Easy / Medium / Hard theo số element của bản màn gốc (adaptive.mjs),
// boss giữ nhãn Boss. `style` = kiểu màu có sẵn trong CSS (.tier-*); 'normal' là màu mặc định.
const TIERS = {
  easy: { style: 'chill', label: 'Easy' }, medium: { style: 'normal', label: 'Medium' },
  hard: { style: 'hard', label: 'Hard' }, boss: { style: 'boss', label: 'Boss' },
};
export const mapTier = index => TIERS[levelTier(LEVELS[index]) === 'boss' ? 'boss' : difficultyOf(elementCount(LEVELS[index]))];
// ?dda trên URL: ghi profile đang nhận diện ra console mỗi lần vào màn (để QA), người chơi thường không thấy.
const DDA_DEBUG = new URLSearchParams(location.search).has('dda');

// Vào thẳng màn chơi (không có bảng giới thiệu màn); newGame() bắt đầu đo metric độ khó.
export function startLevel(index) {
  // LiveOps: lần đầu tới màn có mạng thì tặng mạng vô hạn; hết mạng thì mở hộp mạng (vào màn khi có lại mạng).
  const intro = lo.introLives(getLiveOps(), index, Date.now());
  if (intro.granted) { setLiveOps(intro.state); showToast(`Lives unlocked! ${LIVEOPS.LIVES_INTRO_UNLIMITED_MIN} min of unlimited lives`); }
  if (!lo.canStartLevel(getLiveOps(), index, Date.now())) return openLives({ onReady: () => startLevel(index) });
  // Event: ngày đua thì vào màn = vào cuộc đua
  eventLevelStart(index);
  menus.hideMenus();
  document.body.classList.remove('level-over');
  $('map').hidden = true;
  newGame(index);
  const { plan } = state;
  if (DDA_DEBUG) console.info(`Level ${index + 1} · ${plan.profile} ${plan.shift >= 0 ? '+' : ''}${plan.shift} (${plan.baseCount}→${plan.count})${plan.deal ? ` · ${plan.deal}` : ''}`);
  renderTutorial();
}

const levelsCleared = () => clearedCount(loadProgress());

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
    durationMs: Math.round(now() - track.start), profile: plan.profile, shift: plan.shift, mode: plan.mode, layout: plan.layout, count: plan.count,
  });
  profile = result.profile;
  saveProfile(profile);
  return result.gift;
}
// Rời ván giữa chừng (chơi lại / về Home) khi đã đặt ít nhất một thẻ = bỏ ngang.
function recordQuit() {
  if (!state || state.over || state.moves >= state.startMoves) return;
  recordTry(false, 'quit');
  setLiveOps(lo.recordStreak(lo.loseLife(getLiveOps(), state.levelIndex, Date.now()), state.levelIndex, false));
  // bỏ ngang = thua với event (thang len lùi một bậc)
  if (!state.tutorial) eventLevelEnd(state.levelIndex, false);
}
let resultShownAt = 0;
function leaveResult() {
  profile = noteDwell(profile, Math.round(now() - resultShownAt));
  saveProfile(profile);
  $('result-dialog').close();
}

// Thua: mời continue trước (từ màn CONTINUE_FROM_LEVEL, không ở màn tutorial); bỏ cuộc mới thật sự kết thúc ván.
function endLevel(win, reason = '') {
  if (win || state.tutorial || !lo.continueUnlocked(state.levelIndex)) return finalizeLevel(win, reason);
  state.over = true;
  const run = state, stuck = state.moves > 0, t = Date.now(), live = getLiveOps();
  const losing = [lo.livesActive(state.levelIndex) && !lo.hasUnlimited(live, t) && '1 life', lo.streakActive(state.levelIndex) && live.streak > 0 && `Win streak ×${live.streak}`].filter(Boolean);
  setTimeout(() => {
    // người chơi đã rời ván trong lúc chờ: không mời nữa
    if (state !== run) return;
    offerContinue({
      price: lo.continuePrice(state.continues.gems), adAvailable: !state.continues.ad, stuck, losing,
      onGems: () => { state.continues.gems++; resumeLevel(LIVEOPS.CONTINUE_MOVES, stuck); },
      onAd: () => { state.continues.ad = true; resumeLevel(LIVEOPS.CONTINUE_AD_MOVES, stuck); },
      onGiveUp: () => finalizeLevel(false, reason),
    });
  }, 600);
}
// Chơi tiếp sau continue: cộng lượt; thua vì hết chỗ thì dọn thêm vài ô (mèo / thùng, không đụng kim loại và chuồng).
function resumeLevel(moves, stuck) {
  state.over = false;
  state.outcome = null;
  state.moves += moves;
  track.boosters++;
  if (stuck) {
    const cells = state.board.map((object, index) => (object && !object.metal && !object.cage ? index : -1)).filter(index => index >= 0);
    state.board = state.board.slice();
    for (let i = 0; i < LIVEOPS.CONTINUE_CLEAR_CELLS && cells.length; i++) state.board[cells.splice(Math.floor(Math.random() * cells.length), 1)[0]] = null;
  }
  document.body.classList.remove('level-over');
  playSound('reward');
  render(`+${moves} moves! Keep going!`);
  if (game.checkStuck(state)) endLevel(false, state.outcome.reason);
}

function finalizeLevel(win, reason = '') {
  state.over = true;
  state.outcome ??= { win, reason, stars: 0 };
  // Hết ván (thắng: đã ẩn từ lúc thanh điểm đầy, celebrateWin; thua: hết lượt / kẹt): ẩn mọi UI chơi (level / move / thanh
  // điểm, booster, dock xoay / next / hold), chỉ còn bàn + bảng kết quả
  document.body.classList.add('level-over');
  if (!win) playSound('lose');
  const gift = recordTry(win, win ? 'win' : state.moves > 0 ? 'stuck' : 'moves');
  if (gift) storeBoosters({ ...getBoosters(), moves: getBoosters().moves + 1 });
  // LiveOps: thua mất mạng, chuỗi thắng tăng / về 0, nhiệm vụ thắng màn
  const before = lo.regenLives(getLiveOps(), Date.now());
  const after = lo.recordStreak(win ? before : lo.loseLife(before, state.levelIndex, Date.now()), state.levelIndex, win);
  setLiveOps(after);
  const lifeLost = after.lives < before.lives;
  const streakNote = win && after.streak > before.streak ? `Win streak ×${after.streak}` : !win && before.streak >= LIVEOPS.STREAK_TIERS[0].wins && after.streak === 0 ? 'Win streak lost' : '';
  if (win) { questEvent('win'); if (state.outcome.stars >= 3) questEvent('threeStar'); }
  // Event hằng tuần: thang len, cuộc đua, cá của ván (ghi chú ở bảng kết quả); thắng có cá thì mời nhân đôi bằng quảng cáo
  const eventNotes = state.tutorial ? [] : eventLevelEnd(state.levelIndex, win, state.fish);
  offerFishDouble(state.levelIndex, win && !state.tutorial ? state.fish : 0);
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
    if (coinsEarned) setDeco({ ...getDeco(), coins: getDeco().coins + coinsEarned });
  }
  const unlock = win ? ob.unlockOnWin(index) : null; // onboarding: màn này vừa mở khoá thứ gì ('garden' | 'cats' | 'decor')
  // Vừa mở một khu mới (thắng đúng màn mốc lần đầu): báo trong hộp kết quả.
  const unlockedZone = win && coinsEarned > 0 && Object.values(ZONES).find(z => z.unlockAfter > 0 && index + 1 === z.unlockAfter && levelsCleared() === z.unlockAfter);
  const expandedNow = win && coinsEarned > 0 && index + 1 === GARDEN_EXPANSION.unlockAfter && levelsCleared() === GARDEN_EXPANSION.unlockAfter;
  if (coinsEarned || gift) setTimeout(() => playSound('reward'), 450);
  // Bảng kết quả (Figma): xu thưởng là dòng to có đồng xu; các ghi chú khác (mở khu, quà, mẹo, lý do thua) là dòng nhỏ.
  $('result-coins').innerHTML = `<i class="ico-coin"></i><b>+${coinsEarned}</b><small>coins</small>`;
  const notes = [unlockedZone && `${unlockedZone.name} unlocked!`, expandedNow && 'Garden expanded!', gift && `Gift: ${BOOSTER_NAMES.moves} booster`, streakNote, lifeLost && '−1 life', ...eventNotes,
    tip && `So close! Try ${BOOSTER_NAMES.moves} next time.`, !win && !tip && reason].filter(Boolean);
  $('result-note').hidden = !notes.length;
  $('result-note').textContent = notes.join(' · ');
  const dialog = $('result-dialog');
  dialog.classList.toggle('win', win);
  dialog.classList.toggle('lose', !win);
  // Mèo ló đầu: mèo cam vẽ sẵn (cat-art.mjs), thắng thì mặt vui (.joy), thua thì khóc (.afk-crying) — CSS chọn mặt theo class.
  if (!$('result-cat').firstChild) $('result-cat').innerHTML = catMarkup.orange;
  $('result-title').textContent = win ? (last ? 'Journey Complete!' : 'Level Complete!') : 'Try Again!';
  $('result-sub').textContent = `Level ${index + 1} ${win ? 'cleared' : 'failed'}`;
  $('result-score').textContent = state.score.toLocaleString('en-US');
  const box = $('result-unlock');
  box.hidden = !unlock;
  if (unlock) box.innerHTML = `<span class="ru-title">Unlocked:</span><div class="ru-items">${UNLOCK_ITEMS[unlock].map(item => `<figure><span class="ru-icon">${item.icon}</span><figcaption>${item.name}</figcaption></figure>`).join('')}</div>`;
  dialog.classList.toggle('has-unlock', !!unlock);
  $('result-continue').hidden = !unlock;
  $('result-next').hidden = !win || last || !!unlock;
  $('result-replay').hidden = !win || !!unlock;
  $('result-map').hidden = !!unlock;
  $('result-retry').hidden = win;
  setTimeout(() => { dialog.showModal(); resultShownAt = now(); }, win ? 0 : 700);
}
// Thứ được mở khoá ở các màn onboarding (onboarding.js), hiện dưới "Unlocked:" ở bảng kết quả.
const UNLOCK_ITEMS = {
  garden: [{ name: 'Garden', icon: '<svg viewBox="0 0 24 24"><use href="#i-deco"/></svg>' }],
  cats: [{ name: 'Orange cat', icon: catMarkup.orange }, { name: 'Gray cat', icon: catMarkup.gray }],
  decor: [{ name: 'Decoration', icon: '<svg viewBox="0 0 24 24"><use href="#i-cart"/></svg>' }],
};
$('result-continue').onclick = () => { leaveResult(); menus.runOnboarding(); };
$('result-next').onclick = () => { leaveResult(); startLevel(state.levelIndex + 1); };
$('result-retry').onclick = $('result-replay').onclick = () => { leaveResult(); startLevel(state.levelIndex); };
$('result-map').onclick = () => { leaveResult(); menus.showTab('home'); };

$('tutorial-avatar').innerHTML = catMarkup.orange;
// Dev (chỉ DEV_MODE): kết thúc ngay ván đang chơi để kiểm luồng LiveOps trên trình duyệt (chuỗi thắng, nhiệm vụ, rương, event).
// Console: gomgomDev.win(3) / gomgomDev.lose(). Thắng giả không báo sự kiện gom mèo (cats / big4 / crates).
if (DEV_MODE) globalThis.gomgomDev = {
  win(stars = 3) {
    if (!state || state.over) return;
    state.score = Math.max(state.score, state.level.target);
    state.over = true;
    state.outcome = { win: true, reason: '', stars };
    endLevel(true);
  },
  lose(reason = 'Out of moves!') {
    if (!state || state.over) return;
    state.moves = 0;
    state.over = true;
    state.outcome = { win: false, reason, stars: 0 };
    endLevel(false, reason);
  },
};


// Rời ván đang chơi dở (đã đặt ít nhất một thẻ): hỏi lại trước để không mất lượt vì bấm nhầm.
let quitAction = null;
function confirmQuit(title, action) {
  if (state.animating) return;
  if (state.over || state.moves >= state.startMoves) return action();
  quitAction = action;
  const t = Date.now(), live = getLiveOps();
  const losing = [lo.livesActive(state.levelIndex) && !lo.hasUnlimited(live, t) && '1 life', lo.streakActive(state.levelIndex) && live.streak > 0 && `win streak ×${live.streak}`].filter(Boolean);
  $('quit-note').textContent = losing.length ? `You'll lose ${losing.join(' and ')}.` : "Moves used and boosters spent won't come back.";
  $('quit-title').textContent = title;
  $('quit-dialog').showModal();
}
$('quit-cancel').onclick = () => $('quit-dialog').close();
$('quit-ok').onclick = () => { $('quit-dialog').close(); recordQuit(); quitAction?.(); quitAction = null; };
$('restart').onclick = () => confirmQuit('Restart this level?', () => startLevel(state.levelIndex));
$('open-map').onclick = () => confirmQuit('Leave this level?', () => menus.showTab('home'));

// Ảnh bảng kết quả (Figma 3×, panel ~850 KB): giải mã sẵn lúc rảnh, để lần đầu bảng bật lên không phải giải mã giữa anim (giật).
(function preloadResultArt() {
  const names = ['panel', 'win-cat', 'win-stars', 'win-title', 'win-score', 'win-cleared', 'fail-cat', 'fail-heart', 'fail-title', 'btn-next', 'btn-retry', 'btn-home-round', 'btn-retry-round'];
  const keep = [];
  const load = () => names.forEach(name => {
    const img = new Image();
    img.src = `./ui/result/img/${name}.png`;
    img.decode?.().catch(() => {});
    keep.push(img); // giữ tham chiếu để ảnh đã giải mã không bị dọn
  });
  (globalThis.requestIdleCallback ?? (fn => setTimeout(fn, 1500)))(load);
})();
