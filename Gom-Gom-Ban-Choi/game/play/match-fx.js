// Anim + juice khi gom: bóng mèo nhấc lên chụm vào điểm tụ, thùng vỡ, lồng rung, cỏ văng, hiệu ứng cụm to (Pounce, Yarn Boom,
// Claw Cross, Call the Herd, Kitty Leap), lời khen, pháo hoa, confetti. Sang Unity: MatchFx (MonoBehaviour, DOTween / ParticleSystem).
import { mergeTarget } from '../core/board-rules.mjs';
import { clusterPoints, turnPoints, rollPoints, POINTS_PER_CRATE } from '../core/scoring.mjs';
import { DRAG } from '../data/tuning.mjs';
import { CRATE_SVG } from '../ui/board-art.mjs';
import { playSound, playMeowChorus } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { W, DROP_MS, LIFT_MS, MERGE_MS, cellEl, pendingMerges, fxLayer, state, look, addArt, wait, H } from './context.js';
import { holdScoreSlots, showMergeScore, releaseScoreSlot, scoreTier } from './score-bar.js';

// Anim một lượt đặt thẻ đã chốt state (gom, thùng, chuồng, cỏ, khen, hiệu ứng). Dùng cho lượt người chơi và lượt xả sau khi thắng.
export function animateTurn(turn) {
  const { result, match } = turn;
  if (!match.cleared.length || reduceMotion.matches) return;
  // State được chốt ngay (cụm biến mất, điểm cộng, rút thẻ mới) để người chơi đặt tiếp liền.
  // Anim gom chạy trên các "bóng mèo" phủ đúng chỗ cũ, không chặn thao tác.
  const merges = match.clusters.map(cluster => ({ cluster, target: mergeTarget(cluster, result.indices, W) }));
  holdScoreSlots(merges.length + (match.broken?.length || 0)); // điểm giữ lại tới khi đốm bay vào thanh
  const ghosts = spawnMergeGhosts(merges, result);
  const done = animateMerges(ghosts, merges);
  breakCrates(match.broken, DROP_MS + LIFT_MS + MERGE_MS * .7);
  match.broken?.forEach(index => { const cell = cellEl(index); if (cell) showMergeScore(cell, POINTS_PER_CRATE, DROP_MS + LIFT_MS + MERGE_MS * .7 + 120, 'crate'); else releaseScoreSlot(); });
  rattleCages(match, DROP_MS + LIFT_MS + MERGE_MS * .7);
  flyGrass(turn.cleaned, DROP_MS + LIFT_MS + MERGE_MS * .7);
  celebrateMatch(merges, DROP_MS + LIFT_MS + MERGE_MS * .7);
  animateFat(match, DROP_MS + LIFT_MS + MERGE_MS * .7, { score: true });
  playEffects(turn, DROP_MS + LIFT_MS + MERGE_MS + 120);
  animateFat(turn.effect, DROP_MS + LIFT_MS + MERGE_MS + 420); // điểm lăn do hiệu ứng đã nằm trong số thưởng của playEffects
  pendingMerges.add(done);
  done.finally(() => pendingMerges.delete(done));
}

// ---------- Mèo béo 2×2 (core/board-rules.mjs wakeFatCats) ----------
// source = { woke, rolled } của lượt gom / hiệu ứng / búa. Gọi TRƯỚC khi vẽ lại bàn: mèo sắp lăn được sao thành bóng ngay (ô thật
// biến mất ở lần vẽ tới), mèo chỉ bị đánh thức thì nhún lắc trên ô thật sau `delay` (đã vẽ lại, chấm tiến độ mới).
// score: bật số điểm lăn ở chỗ mèo (lượt gom); điểm lăn do hiệu ứng nổ đã nằm trong số thưởng của playEffects.
export function animateFat(source, delay, { score = false } = {}) {
  if (!source || (!source.woke?.length && !source.rolled?.length)) return;
  const rolling = new Set(source.rolled.map(roll => roll.id));
  const ghosts = new Map();
  if (!reduceMotion.matches) for (const roll of source.rolled) {
    const art = cellEl(roll.id)?.querySelector('.fat-cat'), cell = cellEl(roll.id);
    if (!art || !cell) continue;
    const ghost = art.cloneNode(true);
    ghost.classList.add('fat-ghost');
    ghost.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${art.offsetWidth}px;height:${art.offsetHeight}px`;
    fxLayer().append(ghost);
    ghosts.set(roll.id, ghost);
  }
  if (score) holdScoreSlots(source.rolled.length);
  setTimeout(() => {
    for (const { id } of source.woke) {
      if (rolling.has(id)) continue;
      const art = cellEl(id)?.querySelector('.fat-cat');
      if (!art || reduceMotion.matches) continue;
      art.classList.remove('fat-poke');
      void art.offsetWidth;
      art.classList.add('fat-poke');
      art.addEventListener('animationend', () => art.classList.remove('fat-poke'), { once: true });
      playSound('pick');
    }
    for (const roll of source.rolled) {
      const ghost = ghosts.get(roll.id), layer = fxLayer();
      playMeowChorus([state.board.find(o => o?.group)?.group || 'orange']);
      playSound('merge', 7);
      if (ghost) ghost.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'translate(0, -18%) rotate(-25deg) scale(1.12)', opacity: 1, offset: .3 },
        { transform: 'translate(0, -40%) rotate(340deg) scale(1.2)', opacity: .9, offset: .75 },
        { transform: 'translate(0, -60%) rotate(360deg) scale(.6)', opacity: 0 },
      ], { duration: 900, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).finished.then(() => ghost.remove());
      if (!reduceMotion.matches) roll.area.forEach((index, i) => setTimeout(() => {
        const cell = cellEl(index);
        if (cell) { spawnPuff(cell); flyBits(layer, cell, 'yarn-bit', 3); }
      }, 120 + i * 18));
      shakeBoard(10);
      effectBanner('Wakey wakey!', 0);
      const at = cellEl(roll.id);
      if (score) { if (at) showMergeScore(at, rollPoints([roll]), 260, 'm7'); else releaseScoreSlot(); }
    }
  }, delay);
}

// ---------- Hiệu ứng cụm to / gom đôi (core/cluster-effects.mjs) ----------
// Mỗi hiệu ứng: khựng nhẹ (bàn phóng to 1 nhịp) + rung theo bậc, ô trúng loé sáng + văng mảnh, chữ tên hiệu ứng, điểm thưởng bật ra ở tâm.
export const EFFECT_FX = {
  pounce: { label: 'Pounce!', shake: 3, bits: 'grass-bit' },
  yarn: { label: 'Yarn Boom!', shake: 6, bits: 'yarn-bit' },
  cross: { label: 'Claw Cross!', shake: 8, bits: 'yarn-bit' },
  herd: { label: 'Call the Herd!', shake: 12, bits: 'yarn-bit' },
  leap: { label: 'Kitty Leap!', shake: 4, bits: 'grass-bit' },
};

function playEffects(turn, delay) {
  const effect = turn.effect;
  if (!effect || (!effect.effects.length && !effect.double)) return;
  holdScoreSlots(1); // điểm thưởng của hiệu ứng / gom đôi giữ thanh điểm tới khi bật ra
  const bonus = turn.gained - turnPoints(turn.match);
  effect.effects.forEach((fx, n) => setTimeout(() => {
    const style = EFFECT_FX[fx.kind], layer = fxLayer();
    if (fx.kind === 'leap') leapPaws(layer, fx);
    playSound(fx.kind === 'pounce' ? 'crateBreak' : 'merge', fx.kind === 'herd' ? 7 : fx.kind === 'cross' ? 6 : 5);
    if (fx.kind === 'herd') playMeowChorus(state.board.filter(o => o?.group).map(o => o.group));
    const land = fx.kind === 'leap' ? 440 : 0; // mèo vồ: ô đích nổ lúc dấu chân đáp
    fx.cells.forEach((index, i) => {
      const cell = cellEl(index);
      if (!cell) return;
      const flash = document.createElement('span');
      flash.className = `fx-flash fx-${fx.kind}`;
      flash.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px;animation-delay:${land + i * 18}ms`;
      layer.append(flash);
      setTimeout(() => flash.remove(), 700 + land + i * 18);
      const debris = effect.blasted.includes(index) || effect.broken.includes(index) || effect.cleaned.includes(index);
      if (debris) setTimeout(() => { flyBits(layer, cell, style.bits, 5); spawnPuff(cell); }, land);
    });
    shakeBoard(style.shake);
    effectBanner(style.label, n);
  }, delay + n * 260));
  const last = delay + Math.max(0, effect.effects.length - 1) * 260 + 200;
  setTimeout(() => {
    if (effect.double && !effect.effects.length) effectBanner('Double!', 0);
    const center = cellEl(effect.effects[0]?.center ?? turn.result.indices[0]);
    if (center && bonus > 0) showMergeScore(center, bonus, 0, effect.double ? 'm7' : 'm6'); else releaseScoreSlot();
  }, last);
}

// Mèo vồ: dấu chân mèo nhảy vòng cung từ ô vừa đặt tới từng ô đích (ô đích loé sáng cùng lúc chân đáp).
function leapPaws(layer, fx) {
  const from = cellEl(fx.center);
  if (!from) return;
  fx.cells.forEach(index => {
    const to = cellEl(index);
    if (!to) return;
    const paw = document.createElement('span');
    paw.className = 'leap-paw';
    paw.style.cssText = `left:${from.offsetLeft + from.offsetWidth / 2}px;top:${from.offsetTop + from.offsetHeight / 2}px`;
    layer.append(paw);
    const dx = to.offsetLeft - from.offsetLeft, dy = to.offsetTop - from.offsetTop;
    paw.animate([
      { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 40}px)) scale(1.3)`, opacity: 1, offset: .5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: .85 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.6)`, opacity: 0 },
    ], { duration: 520, easing: 'ease-in-out', fill: 'both' }).finished.then(() => paw.remove());
  });
}

export function shakeBoard(px) {
  if (reduceMotion.matches) return;
  // Rung bằng translate / scale riêng: cộng dồn với transform nghiêng 3D của bàn, không ghi đè nó.
  const k = [0, 1, -1, .6, -.6, .3, 0].map(f => ({ translate: `${f * px}px ${-f * px * .5}px`, scale: `${f ? 1 + px / 400 : 1}` }));
  $('board').animate(k, { duration: 260 + px * 15, easing: 'ease-out' });
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(px * 6); // trình duyệt chặn rung khi chưa chạm màn hình
}

function effectBanner(text, n) {
  const board = $('board').getBoundingClientRect(), pop = document.createElement('span');
  pop.className = 'effect-banner';
  pop.textContent = text;
  pop.style.left = `${board.left + board.width / 2}px`;
  pop.style.top = `${board.top + board.height * (.45 + n * .1)}px`;
  document.body.append(pop);
  pop.animate([
    { transform: 'translate(-50%, -50%) scale(.3) rotate(-8deg)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.25) rotate(3deg)', opacity: 1, offset: .2 },
    { transform: 'translate(-50%, -50%) scale(1) rotate(0)', opacity: 1, offset: .7 },
    { transform: 'translate(-50%, -80%) scale(.9)', opacity: 0 },
  ], { duration: 1000, easing: 'ease-out', fill: 'both' }).finished.then(() => pop.remove());
}

// Cỏ vừa bị phá: vài đốm cỏ văng ra từ ô (ô đã được vẽ lại sạch).
function flyGrass(cleaned, delay) {
  if (reduceMotion.matches || !cleaned?.length) return;
  setTimeout(() => {
    const layer = fxLayer();
    cleaned.forEach(index => { const cell = cellEl(index); if (cell) flyBits(layer, cell, 'grass-bit', 5); });
  }, delay);
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

export function flyBits(layer, cell, className, count) {
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
export function breakCrates(indices, delay) {
  if (!indices?.length) return;
  setTimeout(() => playSound('crateBreak'), delay);
  if (reduceMotion.matches) return;
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

// Khói phì ra khi mèo đáp xuống ô: vài cụm bụi tròn toả ra hai bên đáy ô rồi tan.
const PUFF_COUNT = 8;

export function spawnPuff(cell) {
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
    ghost.style.setProperty('--group-color', look(object.group).color);
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

// ---------- Juice khi gom: lời khen chơi chữ về mèo (chữ nghiêng, nảy) + pháo hoa theo số mèo gom được ----------
// Bậc theo tổng số mèo gom trong lượt (gom nhiều cụm cùng lúc = combo, lên thẳng bậc cao nhất).
const PRAISE = [
  { min: 3, tone: 'p1', words: ['Nice!', 'Meow!', 'Purrty!', 'Good kitty!'] },
  { min: 4, tone: 'p2', words: ['Great!', 'Paw-some!', 'Fur-tastic!', 'Whisker-ific!'] },
  { min: 5, tone: 'p3', words: ['Excellent!', 'Clawsome!', 'Meow-velous!', 'Purr-fect!'] },
  { min: 6, tone: 'p4', words: ['Amazing!', 'Cat-tastic!', 'Hiss-toric!', 'Purr-fection!'] },
  { min: 8, tone: 'p5', words: ['Pawless!', 'Meow-nificent!', 'Un-fur-gettable!', 'Cat-astrophic!'] },
];

const FIREWORK_COLORS = ['#ffd93d', '#ff6b8b', '#6bd8ff', '#9df07a', '#c77dff', '#ffa94d'];

let lastPraise = '';

function celebrateMatch(merges, delay) {
  if (reduceMotion.matches || !merges.length) return;
  const total = merges.reduce((sum, merge) => sum + merge.cluster.length, 0), combo = merges.length > 1;
  const level = PRAISE.filter(p => total >= p.min).pop() || PRAISE[0], tier = combo ? PRAISE[Math.min(PRAISE.length - 1, PRAISE.indexOf(level) + 2)] : level;
  setTimeout(() => {
    cheerNeighbors(merges);
    const board = $('board').getBoundingClientRect();
    // Pháo hoa: mỗi cụm một chùm ngay chỗ gom, thêm chùm ngẫu nhiên quanh bàn theo số mèo (3 mèo: 1 chùm ... 8+ / combo: 4-6 chùm).
    merges.forEach(({ target, cluster }) => {
      const cell = cellEl(target)?.getBoundingClientRect();
      if (!cell) return;
      firework(cell.left + cell.width / 2, cell.top + cell.height / 2, 10 + total * 2);
      confetti(cell.left + cell.width / 2, cell.top + cell.height / 2, 14 + cluster.length * 4 + (combo ? 8 : 0), cell.width);
    });
    const extra = Math.min(5, Math.max(0, total - 4) + (combo ? 2 : 0));
    for (let i = 0; i < extra; i++) {
      setTimeout(() => firework(board.left + board.width * (.15 + Math.random() * .7), board.top + board.height * (.1 + Math.random() * .6), 14 + Math.random() * 10), 140 + i * 130);
    }
    // Lời khen: mép trên bàn (không đè số điểm bật ra ở chỗ gom), nghiêng ngẫu nhiên trái / phải; không lặp lại câu vừa hiện.
    const options = tier.words.filter(word => word !== lastPraise);
    const word = combo && Math.random() < .5 ? `Combo x${merges.length}!` : options[Math.floor(Math.random() * options.length)];
    lastPraise = word;
    const pop = document.createElement('span'), tilt = (Math.random() < .5 ? -1 : 1) * (7 + Math.random() * 6);
    pop.className = `praise-pop ${tier.tone}`;
    pop.textContent = word;
    pop.style.left = `${board.left + board.width / 2}px`;
    pop.style.top = `${board.top + board.height * .12}px`;
    document.querySelectorAll('.praise-pop').forEach(node => node.remove());
    document.body.append(pop);
    const at = (scale, rot, dy = 0) => `translate(-50%, -50%) translateY(${dy}px) rotate(${rot}deg) scale(${scale})`;
    pop.animate([
      { transform: at(.2, -tilt * 1.6), opacity: 0 },
      { transform: at(1.25, tilt * 1.15), opacity: 1, offset: .18 },
      { transform: at(.94, tilt * .9), offset: .3 },
      { transform: at(1.03, tilt), offset: .4 },
      { transform: at(1, tilt, -8), offset: .82 },
      { transform: at(.7, tilt * 1.2, -26), opacity: 0 },
    ], { duration: 1100, easing: 'ease-out', fill: 'both' }).finished.catch(() => {}).then(() => pop.remove());
  }, delay);
}

// Gom xong: mọi mèo trên bàn (trừ mèo trong lồng) nảy lên với mặt vui (cùng anim + mặt như khi được cưng), lan dần từ cụm vừa gom ra.
function cheerNeighbors(merges) {
  const gone = new Set(merges.flatMap(merge => merge.cluster)), near = new Map();
  for (let n = 0; n < W * H; n++) {
    if (gone.has(n)) continue;
    const x = n % W, y = Math.floor(n / W);
    let dist = 99;
    for (const index of gone) dist = Math.min(dist, Math.max(Math.abs(index % W - x), Math.abs(Math.floor(index / W) - y)));
    near.set(n, dist);
  }
  near.forEach((dist, index) => {
    const cell = cellEl(index);
    if (!cell?.querySelector('.cat') || cell.classList.contains('caged')) return;
    // Mèo còn lại trên bàn: chỉ đổi sang mặt vui (.petted), đứng yên — .cheered tắt cú nhảy / lắc (khác với lúc người chơi chạm vuốt mèo).
    setTimeout(() => {
      cell.classList.remove('petted', 'cheered', 'idle-cute');
      void cell.offsetWidth;
      cell.classList.add('petted', 'cheered');
      clearTimeout(cell.petTimer);
      cell.petTimer = setTimeout(() => cell.classList.remove('petted', 'cheered'), 1100);
    }, (dist - 1) * 90 + Math.random() * 60);
  });
}

// Một chùm pháo hoa: chấm tròn + tia toả tròn đều, rơi nhẹ theo trọng lực rồi tắt.
function firework(x, y, count) {
  const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  const flash = document.createElement('span');
  flash.className = 'firework-flash';
  flash.style.cssText = `left:${x}px;top:${y}px;--fw:${color}`;
  document.body.append(flash);
  flash.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 380, easing: 'ease-out' })
    .finished.catch(() => {}).then(() => flash.remove());
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span'), angle = (i / count) * Math.PI * 2 + Math.random() * .3, dist = 45 + Math.random() * 45;
    spark.className = 'firework-spark';
    spark.style.cssText = `left:${x}px;top:${y}px;--fw:${i % 3 ? color : '#fff6c8'}`;
    document.body.append(spark);
    const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
    spark.animate([
      { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy * 1.1 + 22}px)) scale(.3)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.4,1)' }).finished.catch(() => {}).then(() => spark.remove());
  }
}

// Confetti: giấy màu (mảnh chữ nhật + dải ruy băng) nổ toả ra từ chỗ gom (nghiêng lên trên), không khí hãm lại rất nhanh,
// rồi rơi chậm và chao lượn như giấy thật — không bay theo đường ném (vọt lên rồi rơi cắm xuống). size = cỡ ô (px).
const CONFETTI_COLORS = ['#ff5f8f', '#ffd23f', '#4fc3ff', '#7ed957', '#b48ee8', '#ff9f43', '#ffffff'];

const CONFETTI_MAX = 120;

let confettiLive = 0;

function confetti(x, y, count, size = 48) {
  count = Math.min(count, CONFETTI_MAX - confettiLive);
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span'), ribbon = Math.random() < .3;
    piece.className = `confetti${ribbon ? ' ribbon' : ''}`;
    piece.style.cssText = `left:${x}px;top:${y}px;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`;
    document.body.append(piece);
    confettiLive++;
    // Nổ: hướng ngẫu nhiên quanh phương thẳng đứng (±150°, nghiêng lên), bay xa 1.2–2.6 ô rồi bị cản khí hãm lại (DRAG / giây).
    // Sau đó rơi đều với vận tốc giới hạn nhỏ (FALL ô / giây) + chao ngang dần to lên, xoay lật chậm dần theo tốc độ.
    const DRAG = 7, FALL = 1.6, T = .8 + Math.random() * .35;
    const angle = -Math.PI / 2 + (Math.random() * 2 - 1) * 2.6, reach = size * (1.2 + Math.random() * 1.4);
    const vx = Math.cos(angle) * reach * DRAG, vy = Math.sin(angle) * reach * DRAG;
    const sway = size * (.12 + Math.random() * .18), swayHz = 7 + Math.random() * 5, phase = Math.random() * 6.28;
    const spin = (Math.random() < .5 ? -1 : 1) * (300 + Math.random() * 400), flip = 300 + Math.random() * 500;
    const keys = [];
    for (let k = 0; k <= 10; k++) {
      const f = k / 10, t = f * T, burst = (1 - Math.exp(-DRAG * t)) / DRAG, settle = Math.min(1, t * 3);
      const dx = vx * burst + sway * settle * Math.sin(t * swayHz + phase), dy = vy * burst + size * FALL * t * settle;
      keys.push({ offset: f, opacity: f < .7 ? 1 : 1 - (f - .7) / .3,
        transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) rotate(${spin * burst * DRAG * .3 + spin * .25 * t}deg) rotateX(${flip * (burst * DRAG * .3 + .3 * t)}deg)` });
    }
    piece.animate(keys, { duration: T * 1000, easing: 'linear' }).finished.catch(() => {}).then(() => { piece.remove(); confettiLive--; });
  }
}
