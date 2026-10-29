// Vẽ bàn: lưới ô theo hình bàn, mèo / thùng / kim loại / lồng / cỏ, xem trước chỗ thả, chạm vuốt mèo (tim, mèo bực).
// Sang Unity: BoardView (MonoBehaviour) + prefab CellView.
import { categories, catMarkup } from '../ui/cat-art.mjs';
import { CRATE_SVG, METAL_SVG, MAILBOX_SVG, vaseSvg, SYRUP_TILE, cageSvg, GRASS_SVG } from '../ui/board-art.mjs';
import { playMeow } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { W, H, state, look, addArt, fxLayer } from './context.js';
import { spawnPuff } from './match-fx.js';
import { hammerArmed, smashAt } from './booster-bar.js';
import { syrupMaskAt, syrupAtlasStyle } from '../ui/syrup-autotile.mjs';
import { playBackgroundForLevel } from '../ui/play-backgrounds.mjs';

// Cùng một texture phủ toàn bàn: mỗi ô lấy đúng tọa độ để mép nối không đổi màu.
const sheetTile = index => `--col:${index % W};--row:${Math.floor(index / W)}`;

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
  const grassAt = (row, col) => row >= 0 && row < H && col >= 0 && col < W && !!state.grass?.[row * W + col];
  const grassJoins = index => {
    const row = Math.floor(index / W), col = index % W;
    if (!grassAt(row, col)) return '';
    // Cỏ dưới mèo béo không nối với cỏ ngoài khối: mèo che mất phần nối nên bãi cỏ bên ngoài trông như bị cắt cụt, mất viền
    const fat = !!state.board[index]?.fat;
    const hasGrass = (r, c) => grassAt(r, c) && !!state.board[r * W + c]?.fat === fat;
    return (hasGrass(row - 1, col) ? 'n' : '') + (hasGrass(row, col + 1) ? 'e' : '') + (hasGrass(row + 1, col) ? 's' : '') + (hasGrass(row, col - 1) ? 'w' : '') || '-';
  };
  // Siro dâu liền nhau: như cỏ, chuỗi cạnh giáp ô siro khác (đổi khi ô bên cạnh hết siro -> vẽ lại cho mép mảng khép kín).
  const syrupAt = (row, col) => row >= 0 && row < H && col >= 0 && col < W && !!state.board[row * W + col]?.syrup;
  const syrupJoins = index => {
    const row = Math.floor(index / W), col = index % W;
    if (!syrupAt(row, col)) return '';
    return syrupMaskAt(row, col, syrupAt);
  };
  board.querySelectorAll(':scope > .cell').forEach((cell, index) => {
    const object = state.board[index] || null, grass = grassJoins(index), syrup = syrupJoins(index);
    if (cell.renderedObject === object && cell.renderedGrass === grass && cell.renderedSyrup === syrup) return;
    cell.renderedObject = object;
    cell.renderedGrass = grass;
    cell.renderedSyrup = syrup;
    cell.getAnimations().forEach(animation => animation.cancel()); // bỏ fill:forwards của anim gom/bay
    cell.replaceChildren();
    cell.removeAttribute('style');
    cell.dataset.alt = (Math.floor(index / W) + index % W) % 2; // ô xen kẽ hai tông (bàn kiểu bàn cờ)
    if (object?.void) {
      cell.className = 'cell void';
      // Cạnh nào giáp ô lỗ khác thì bỏ viền (hud.css --vl/--vr/--vt/--vb). Tính theo hàng / cột thật: luật CSS "ô liền trước / sau"
      // coi ô đầu hàng là kề ô cuối hàng trên, làm mất viền mép trái / phải của lỗ.
      const col = index % W, hole = (r, c) => c >= 0 && c < W && !!state.board[r * W + c]?.void, row = Math.floor(index / W);
      // Góc lõm (hai cạnh kề là lỗ, ô chéo thì không): viền hai ô bên cạnh không gặp nhau qua khe -> vá góc (--cne / --cnw / --cse / --csw).
      const concave = (dr, dc) => +(hole(row + dr, col) && hole(row, col + dc) && !hole(row + dr, col + dc));
      cell.style.cssText = `--vl:${+!hole(row, col - 1)};--vr:${+!hole(row, col + 1)};--vt:${+!hole(row - 1, col)};--vb:${+!hole(row + 1, col)};`
        + `--cne:${concave(-1, 1)};--cnw:${concave(-1, -1)};--cse:${concave(1, 1)};--csw:${concave(1, -1)}`;
      cell.disabled = true;
      cell.setAttribute('aria-hidden', 'true');
      return;
    }
    if (object?.mail) {
      cell.className = 'cell block mail';
      cell.setAttribute('aria-label', 'Mailbox, it never breaks. Match cats next to it to send a letter');
      cell.innerHTML = MAILBOX_SVG;
      return;
    }
    if (object?.vase) {
      cell.className = `cell block vase${grass ? ' grass' : ''}`;
      cell.setAttribute('aria-label', object.vase > 1 ? 'Vase, match cats next to it twice to break it' : 'Cracked vase, one more match next to it breaks it');
      cell.innerHTML = vaseSvg(object.vase === 1);
      return;
    }
    if (object?.carton) {
      cell.className = `cell block carton${object.cartonId === index ? ' carton-anchor' : ''}`;
      cell.setAttribute('aria-label', 'Cardboard box, it never breaks');
      if (object.cartonId === index) cell.innerHTML = '<span class="carton-box"><img src="./assets/img/board/cardboard-front.png" alt=""></span>';
      return;
    }
    if (object?.block) {
      cell.className = `cell block${object.metal ? ' metal' : ''}`;
      cell.setAttribute('aria-label', object.metal ? 'Metal block, it never breaks' : 'Crate, match cats next to it to break it');
      cell.innerHTML = object.metal ? METAL_SVG : CRATE_SVG;
      return;
    }
    const held = cageHeld.has(index) && object && !object.cage;
    cell.className = `cell ${object ? `locked ${object.group}` : 'empty'}${object?.syrup ? ' caged syrup' : object?.cage ? ` caged cage-${object.cage}` : held ? ' caged' : ''}${grass ? ' grass' : ''}`;
    cell.setAttribute('aria-label', !object ? `Cell ${index + 1}, empty${grass ? ', on grass' : ''}`
      : object.syrup ? 'A cat stuck in strawberry syrup. Match next to it to wash it off'
      : object.cage ? `Caged ${look(object.group).name}. Match next to it to break the lock` : `${object.name}${grass ? ', on grass' : ''}, locked`);
    if (grass) {
      cell.insertAdjacentHTML('afterbegin', GRASS_SVG);
      const tile = cell.firstElementChild;
      for (const side of grass.replace('-', '')) tile.classList.add(`j-${side}`);
      tile.style.cssText = sheetTile(index);
    }
    if (object?.fat) { paintFatCat(cell, object, index, grass); return; }
    if (!object) return;
    cell.style.setProperty('--group-color', look(object.group).color);
    // Siro che kín con vật: không vẽ con vật, chỉ vẽ mảng siro (nối với ô siro bên cạnh).
    if (object.syrup) {
      cell.insertAdjacentHTML('beforeend', SYRUP_TILE);
      cell.lastElementChild.style.cssText = syrupAtlasStyle(syrup);
      return;
    }
    addArt(cell, object);
    if (object.cage || held) cageUp(cell);
    if (state.justPlaced?.has(index) && !reduceMotion.matches) {
      cell.classList.add('drop');
      cell.addEventListener('animationend', () => cell.classList.remove('drop'), { once: true });
      spawnPuff(cell);
    }
  });
  // Mèo ngay dưới ô siro: đầu nhô lên (ảnh mèo cao hơn ô) phải nằm sau mảng siro, base.css cắt phần nhô (.under-syrup).
  // Bật / tắt sau vòng vẽ vì ô không vẽ lại khi chỉ ô phía trên hết siro.
  board.querySelectorAll(':scope > .cell').forEach((cell, index) => cell.classList.toggle('under-syrup', syrupAt(Math.floor(index / W) - 1, index % W)));
  state.previewKey = '';
  state.justPlaced = null;
  requestAnimationFrame(seeThrough);
}

// Lỗ (ô ngoài bàn) lộ đúng mảng nền đồng cỏ của .shell phía sau khung kem: mỗi lỗ vẽ lại ảnh nền với cùng cỡ (cover) và
// dời theo vị trí của lỗ trong .shell (hud.css dùng --see-*).
const MEADOW = Object.assign(new Image(), { onload: () => seeThrough() });
export function setPlayBackground(levelIndex) {
  const background = playBackgroundForLevel(levelIndex);
  const src = new URL(`../${background.src}`, import.meta.url).href;
  document.documentElement.style.setProperty('--play-background-image', `url("${src}")`);
  document.documentElement.dataset.playBackground = background.id;
  if (MEADOW.src !== src) MEADOW.src = src;
  requestAnimationFrame(seeThrough);
}
function seeThrough() {
  const holes = $('board').querySelectorAll(':scope > .cell.void'), shell = $('board').closest('.shell');
  if (!holes.length || !shell || !MEADOW.naturalWidth) return;
  const box = shell.getBoundingClientRect(), k = Math.max(box.width / MEADOW.naturalWidth, box.height / MEADOW.naturalHeight);
  const w = MEADOW.naturalWidth * k, h = MEADOW.naturalHeight * k, left = (box.width - w) / 2;
  holes.forEach(hole => {
    const at = hole.getBoundingClientRect();
    hole.style.setProperty('--see', `${left - (at.left - box.left)}px ${-(at.top - box.top)}px / ${w}px ${h}px`);
  });
}
addEventListener('resize', () => requestAnimationFrame(seeThrough));

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

// Lồng mèo: bàn là cảnh 3D (preserve-3d) nên z-index không xếp được mèo giữa thân lồng và song sắt; mèo được chuyển VÀO khung lồng
// (dựng đứng, phẳng) nằm giữa hai lớp ảnh. uncage trả mèo ra ô rồi bỏ khung.
// Ô vừa được thả khỏi lồng nhưng anim mở lồng chưa chạy (match-fx.js rattleCages): vẫn vẽ lồng đóng, không lộ con vật ra trước.
export const cageHeld = new Set();
export function cageUp(cell) {
  cell.insertAdjacentHTML('beforeend', cageSvg());
  const cat = cell.querySelector(':scope > .cat');
  if (cat) cell.querySelector('.cage-back').after(cat);
}
export function uncage(cell) {
  const box = cell.querySelector('.cage-box');
  if (!box) return;
  const cat = box.querySelector('.cat');
  if (cat) box.before(cat);
  box.remove();
}
// Mèo béo 2×2 đang ngủ (core/board-rules.mjs wakeFatCats): ô góc trên-trái vẽ một con mèo to phủ cả khối + huy hiệu số lần
// còn phải đánh thức; 3 ô còn lại chỉ bị chiếm. Ảnh riêng (assets/img/cats/fat/): thân + mặt, mặt sleep (mặc định),
// annoyed (bị gom sát bên, match-fx.js animateFat), happy (đủ lần đánh thức, lăn đi).
const FAT_ART = 'assets/img/cats/fat/';
// fatId -> thời điểm (performance.now) hết cau có; bàn vẽ lại giữa chừng vẫn giữ mặt annoyed
export const fatAnnoyedUntil = new Map();
// Đủ 3 mặt chồng nhau, đổi mặt = đổi data-mood (CSS mờ dần qua lại cho mượt); thân + mặt nằm trong .fat-bob (thở phập phồng).
export const fatMarkup = mood => `<span class="fat-bob" data-mood="${mood}"><img class="fat-body" src="${FAT_ART}body.png" alt="">${
  ['sleep', 'annoyed', 'happy'].map(m => `<img class="fat-face f-${m}" src="${FAT_ART}face-${m}.png" alt="">`).join('')}</span><span class="fat-zzz"><i>z</i><i>z</i><i>Z</i></span>`;
export const setFatMood = (art, mood) => art?.querySelector('.fat-bob')?.setAttribute('data-mood', mood);
function paintFatCat(cell, object, index, grass) {
  const anchor = object.fatId === index;
  cell.className = `cell fat${anchor ? ' fat-anchor' : ''}${grass ? ' grass' : ''}`;
  cell.setAttribute('aria-label', `Big sleepy cat: match next to it ${object.fat} more time${object.fat > 1 ? 's' : ''} to wake it up`);
  if (!anchor) return;
  const big = document.createElement('span');
  big.className = 'fat-cat';
  big.innerHTML = fatMarkup((fatAnnoyedUntil.get(object.fatId) ?? 0) > performance.now() ? 'annoyed' : 'sleep');
  const pips = document.createElement('span');
  pips.className = 'fat-pips';
  pips.textContent = object.fat;
  big.prepend(pips);
  cell.append(big);
}


// ===== Hộp các-tông (màn 1, level-rules.mjs 'B'): thắng màn thì hộp mở (4 khung bóc keo -> mở nắp), mèo cam ló đầu ra =====
// Đường dẫn khung viết đủ (không ghép chuỗi) để build:html nhúng được ảnh.
const CARTON_FRAMES = ['./assets/img/board/cardboard-opening/frame-0.png', './assets/img/board/cardboard-opening/frame-1.png',
  './assets/img/board/cardboard-opening/frame-2.png', './assets/img/board/cardboard-opening/frame-3.png'];
const CARTON_FRAME_MS = 220, CAT_PEEK_MS = 900;
export function openCartons() {
  const boxes = [...document.querySelectorAll('#board .carton-box')];
  if (!boxes.length) return Promise.resolve();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  return Promise.all(boxes.map(async box => {
    const img = box.querySelector('img');
    box.classList.add('opening');
    for (const src of CARTON_FRAMES) { img.src = src; await wait(reduceMotion.matches ? 0 : CARTON_FRAME_MS); }
    // Mèo nằm sau mặt trước của hộp: khung cắt ngang mép trên mặt trước, mèo trồi lên trong khung đó.
    box.insertAdjacentHTML('beforeend', `<span class="carton-cat"><span>${catMarkup.orange}</span></span>`);
    playMeow('orange');
    await wait(reduceMotion.matches ? 0 : CAT_PEEK_MS);
  }));
}
