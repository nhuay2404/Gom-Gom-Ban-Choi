// Vẽ bàn: lưới ô theo hình bàn, mèo / thùng / kim loại / lồng / cỏ, xem trước chỗ thả, chạm vuốt mèo (tim, mèo bực).
// Sang Unity: BoardView (MonoBehaviour) + prefab CellView.
import { categories } from '../ui/cat-art.mjs';
import { CRATE_SVG, METAL_SVG, cageSvg, GRASS_SVG } from '../ui/board-art.mjs';
import { playMeow } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { W, H, state, look, addArt, fxLayer } from './context.js';
import { spawnPuff } from './match-fx.js';
import { hammerArmed, smashAt } from './booster-bar.js';

export function renderBoard() {
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
  // Ô cỏ liền nhau: chuỗi các cạnh giáp ô cỏ khác ('n' 'e' 's' 'w'), '-' = cỏ đứng riêng, '' = không có cỏ (đổi khi ô bên cạnh hết cỏ -> vẽ lại).
  const hasGrass = (row, col) => row >= 0 && row < H && col >= 0 && col < W && !!state.grass?.[row * W + col];
  const grassJoins = index => {
    const row = Math.floor(index / W), col = index % W;
    if (!hasGrass(row, col)) return '';
    return (hasGrass(row - 1, col) ? 'n' : '') + (hasGrass(row, col + 1) ? 'e' : '') + (hasGrass(row + 1, col) ? 's' : '') + (hasGrass(row, col - 1) ? 'w' : '') || '-';
  };
  board.querySelectorAll(':scope > .cell').forEach((cell, index) => {
    const object = state.board[index] || null, grass = grassJoins(index);
    if (cell.renderedObject === object && cell.renderedGrass === grass) return;
    cell.renderedObject = object;
    cell.renderedGrass = grass;
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
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}${object?.cage ? ` caged cage-${object.cage}` : ''}${grass ? ' grass' : ''}`;
    cell.setAttribute('aria-label', !object ? `Cell ${index + 1}, empty${grass ? ', on grass' : ''}`
      : object.cage ? `Caged ${look(object.group).name}. Match next to it to break the lock` : `${object.name}${grass ? ', on grass' : ''}, locked`);
    if (grass) {
      cell.insertAdjacentHTML('afterbegin', GRASS_SVG);
      const tile = cell.firstElementChild;
      for (const side of grass.replace('-', '')) tile.classList.add(`j-${side}`);
      tile.style.cssText = `--col:${index % W};--row:${Math.floor(index / W)}`;
    }
    if (object?.fat) { paintFatCat(cell, object, index, grass); return; }
    if (!object) return;
    cell.style.setProperty('--group-color', look(object.group).color);
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

export function paintPreview() {
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

// Chạm vào mèo trên bàn: mèo cười phấn khích, nhún nhẹ (không co giãn) và vài trái tim nhỏ bay lên.
$('board').addEventListener('pointerdown', event => {
  if (hammerArmed) return smashAt(event.target.closest('.cell'));
  const cell = event.target.closest('.cell.locked:not(.caged)');
  if (!cell || cell.classList.contains('merge-ghost') || state.animating) return;
  petCat(cell);
});

// Chạm (hoặc rê chuột vào) dồn dập trong PET_ANNOY.WINDOW: từ CHEW lần thì mèo bực (biểu cảm chew), từ ANGRY lần thì nổi giận (angry)
// một lúc, trong lúc giận chạm vào không vui lên. Cùng nhịp với mèo 3D ở Deco (cat-brain.mjs PET_ANNOY).
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
  const cell = event.target.closest('.cell.locked:not(.caged)');
  if (cell && !cell.contains(event.relatedTarget)) annoyCat(cell);
});

function petCat(cell) {
  const breed = Object.keys(categories).find(name => cell.classList.contains(name));
  if (annoyCat(cell)) { playMeow(breed, 'grumpy'); return; }
  cell.classList.remove('petted', 'cheered', 'idle-cute'); // chạm vuốt thì nhảy như cũ dù vừa được 'cổ vũ' sau cú gom
  void cell.offsetWidth; // chạm liên tiếp thì chạy lại anim
  cell.classList.add('petted');
  clearTimeout(cell.petTimer);
  cell.petTimer = setTimeout(() => cell.classList.remove('petted'), 1100);
  playMeow(breed);
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

// Mèo béo 2×2 đang ngủ (core/board-rules.mjs wakeFatCats): ô góc trên-trái vẽ một con mèo to phủ cả khối + hàng chấm tiến độ
// (mỗi lần đánh thức sáng một chấm); 3 ô còn lại chỉ bị chiếm. Mặt: chưa đánh thức lần nào = ngủ say (zzz), còn 1 lần = mở mắt,
// ở giữa = lim dim.
export const fatMood = object => (object.fat >= object.fatMax ? 'sleep' : object.fat === 1 ? 'awake' : 'drowsy');
function paintFatCat(cell, object, index, grass) {
  const anchor = object.fatId === index;
  cell.className = `cell fat${anchor ? ' fat-anchor' : ''}${grass ? ' grass' : ''}`;
  cell.setAttribute('aria-label', `Big sleepy cat: match next to it ${object.fat} more time${object.fat > 1 ? 's' : ''} to wake it up`);
  if (!anchor) return;
  const big = document.createElement('span');
  big.className = `fat-cat ${fatMood(object)}`;
  addArt(big, { group: object.breed });
  const pips = document.createElement('span');
  pips.className = 'fat-pips';
  pips.innerHTML = Array.from({ length: object.fatMax }, (_, k) => `<i${k < object.fatMax - object.fat ? ' class="on"' : ''}></i>`).join('');
  big.prepend(pips);
  cell.append(big);
}

