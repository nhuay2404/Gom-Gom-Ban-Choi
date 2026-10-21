// Anim + juice khi gom: bóng mèo nhấc lên chụm vào điểm tụ, thùng vỡ, lồng rung, cỏ văng, hiệu ứng cụm to (Pounce, Yarn Boom,
// Claw Cross, Call the Herd, Cat Drop), lời khen, pháo hoa, confetti. Sang Unity: MatchFx (MonoBehaviour, DOTween / ParticleSystem).
import { mergeTarget } from '../core/board-rules.mjs';
import { clusterPoints, turnPoints, rollPoints, POINTS_PER_CRATE } from '../core/scoring.mjs';
import { DRAG, EFFECTS } from '../data/tuning.mjs';
import { CRATE_SVG, CRATE_OPEN_SRC, CAGE_OPEN_SRC, CAGE_DOOR_SRC, LETTER_SVG, MAILBOX_OPEN_SRC, VASE_SHARD_SVG, SYRUP_DROP_SVG } from '../ui/board-art.mjs';
import { playSound, playMeowChorus } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { W, DROP_MS, LIFT_MS, MERGE_MS, cellEl, pendingMerges, fxLayer, state, look, addArt, wait, H } from './context.js';
import { holdScoreSlots, showMergeScore, releaseScoreSlot, scoreTier } from './score-bar.js';
import { setFatMood, fatAnnoyedUntil, cageUp, uncage, cageHeld } from './board-view.js';
import { renderGoals } from './hud.js';

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
  flyToGoal('mail', match.mail, DROP_MS + LIFT_MS + MERGE_MS * .7);
  flyToGoal('mail', turn.effect?.mail, DROP_MS + LIFT_MS + MERGE_MS + 420);
  breakVases(match, DROP_MS + LIFT_MS + MERGE_MS * .7);
  breakVases(turn.effect, DROP_MS + LIFT_MS + MERGE_MS + 420);
  washSyrup(turn.match.syrup, DROP_MS + LIFT_MS + MERGE_MS * .7);
  washSyrup(turn.effect?.syrup, DROP_MS + LIFT_MS + MERGE_MS + 420);
  pendingMerges.add(done);
  done.finally(() => pendingMerges.delete(done));
}

// ---------- Bay vào ô Goal: thư (hộp thư '@') và mảnh bình vỡ (bình hoa '%') ----------
// cells = ô nguồn, mỗi món một phần tử (hộp thư trúng 2 lần = 2 thư). Gọi ngay khi chốt lượt, TRƯỚC khi vẽ lại: món tính là "đang bay"
// (state.flying[kind], ô Goal chưa trừ) tới lúc chạm icon cùng loại ở ô Goal thì mới trừ. Món bật lên khỏi ô rồi bay vòng vào Goal.
const GOAL_FLY = { mail: { art: LETTER_SVG, bump: '.mailbox' }, vase: { art: VASE_SHARD_SVG }, syrup: { art: SYRUP_DROP_SVG } };
export function flyToGoal(kind, cells, delay) {
  if (!cells?.length || reduceMotion.matches) return;
  const session = state, { art, bump } = GOAL_FLY[kind];
  const land = () => { if (state !== session) return; state.flying[kind] = Math.max(0, state.flying[kind] - 1); renderGoals(); };
  state.flying[kind] += cells.length;
  const seen = new Map();
  cells.forEach(index => {
    const k = seen.get(index) ?? 0;
    seen.set(index, k + 1);
    setTimeout(() => {
      const cell = cellEl(index), icon = [...document.querySelectorAll('.fg-goal-icon')].find(el => el.dataset.kind === kind && !el.hidden);
      if (!cell || !icon) return land();
      const box = bump && cell.querySelector(bump);
      if (box && kind === 'mail') {
        const closed = box.getAttribute('src');
        box.src = MAILBOX_OPEN_SRC;
        setTimeout(() => box.isConnected && box.setAttribute('src', closed), 520);
      }
      box?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18, .86)', offset: .3 }, { transform: 'scale(.94, 1.1)', offset: .6 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
      const from = cell.getBoundingClientRect(), to = icon.getBoundingClientRect();
      const item = document.createElement('span');
      item.className = 'goal-fly';
      item.innerHTML = art;
      item.style.cssText = `left:${from.left + from.width / 2}px;top:${from.top + from.height * .35}px;width:${from.width * .6}px`;
      document.body.append(item);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height * .35);
      const side = (k % 2 ? -1 : 1) * from.width * .5;
      playSound('pick');
      item.animate([
        { transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)', opacity: 0 },
        { transform: `translate(calc(-50% + ${side * .4}px), calc(-50% - ${from.height * .7}px)) scale(1.1) rotate(${side > 0 ? 12 : -12}deg)`, opacity: 1, offset: .3 },
        { transform: `translate(calc(-50% + ${dx * .5 + side}px), calc(-50% + ${dy * .5 - from.height * .6}px)) scale(.9) rotate(${side > 0 ? -8 : 8}deg)`, opacity: 1, offset: .65 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${to.width / (from.width * .6)}) rotate(0deg)`, opacity: 1 },
      ], { duration: 820, easing: 'cubic-bezier(.4, 0, .5, 1)', fill: 'forwards' }).finished.then(() => {
        item.remove();
        land();
        playSound('reward');
        icon.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: .4 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
      });
    }, delay + k * 160);
  });
}

// Bình hoa: `cracked` = vừa nứt (ô đã vẽ lại bình nứt: lắc + vài mảnh men văng), `shattered` = vừa vỡ. Gọi TRƯỚC khi vẽ lại bàn:
// bình sắp vỡ được sao thành bóng ngay (ô thật trống ở lần vẽ tới), tới `delay` thì bóng phình lên rồi vỡ tung, một mảnh bay vào Goal.
export function breakVases(source, delay) {
  if (reduceMotion.matches || (!source?.cracked?.length && !source?.shattered?.length)) return;
  const ghosts = source.shattered.map(index => {
    const cell = cellEl(index), art = cell?.querySelector('.vase');
    if (!art) return null;
    const ghost = document.createElement('span');
    ghost.className = 'vase-ghost';
    ghost.append(art.cloneNode(true));
    ghost.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    fxLayer().append(ghost);
    return ghost;
  });
  flyToGoal('vase', source.shattered, delay + 160);
  setTimeout(() => {
    const layer = fxLayer();
    source.cracked.forEach(index => {
      const cell = cellEl(index);
      if (!cell) return;
      cell.querySelector('.vase')?.animate([{ rotate: '0deg' }, { rotate: '-10deg', offset: .25 }, { rotate: '8deg', offset: .55 }, { rotate: '-4deg', offset: .8 }, { rotate: '0deg' }], { duration: 420, easing: 'ease-in-out' });
      flyBits(layer, cell, 'vase-chip', 2);
      playSound('pick');
    });
    source.shattered.forEach((index, i) => {
      const ghost = ghosts[i], cell = cellEl(index);
      if (cell) { flyBits(layer, cell, 'vase-chip', 7); spawnPuff(cell); }
      ghost?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.15, .9)', opacity: 1, offset: .5 }, { transform: 'scale(1.3)', opacity: 0 }],
        { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished.then(() => ghost.remove());
    });
    if (source.shattered.length) playSound('crateBreak');
  }, delay);
}

// Siro dâu vỡ (core/board-rules.mjs `syrup`). Gọi TRƯỚC khi vẽ lại bàn: ô siro được sao thành bóng phủ đúng chỗ (ô thật vẽ con vật
// sạch ở lần vẽ tới), tới `delay` thì bóng phình ra rồi tan, giọt siro văng ra và một giọt bay vào Goal.
export function washSyrup(cells, delay) {
  if (!cells?.length || reduceMotion.matches) return;
  const ghosts = cells.map(index => {
    const cell = cellEl(index);
    if (!cell?.querySelector('.syrup-tile')) return null;
    const ghost = cell.cloneNode(true);
    ghost.classList.add('syrup-ghost');
    ghost.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    fxLayer().append(ghost);
    return ghost;
  });
  flyToGoal('syrup', cells, delay + 120);
  setTimeout(() => {
    const layer = fxLayer();
    cells.forEach((index, i) => {
      const cell = cellEl(index);
      if (cell) flyBits(layer, cell, 'syrup-bit', 6);
      ghosts[i]?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.12, .92)', opacity: .9, offset: .4 }, { transform: 'scale(1.25)', opacity: 0 }],
        { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished.then(() => ghosts[i].remove());
    });
    playSound('pick');
  }, delay);
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
    setFatMood(ghost, 'happy'); // đủ lần đánh thức: vui vẻ lăn đi
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
      // bị gom sát bên: cau có một lúc rồi ngủ tiếp
      fatAnnoyedUntil.set(id, performance.now() + 1100);
      setFatMood(art, 'annoyed');
      setTimeout(() => setFatMood(cellEl(id)?.querySelector('.fat-cat'), 'sleep'), 1120);
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
  drop: { label: 'Cat Drop!', shake: 4, bits: 'grass-bit' },
};

let bonusPounces = 0, pounceSession = null;

function playEffects(turn, delay) {
  const effect = turn.effect;
  if (!effect || (!effect.effects.length && !effect.double && !effect.chain)) return;
  // Gom dây chuyền (mèo thả xuống / mèo vừa ra khỏi lồng thành cụm): chạy y như gom thường — nhấc bổng, trượt vào điểm tụ,
  // điểm bật ra ở điểm tụ, khen + pháo hoa, thùng sát cụm vỡ. Điểm này tách khỏi số thưởng ở tâm.
  const chain = effect.chain, chained = chain?.cleared ?? [];
  const sources = [...(effect.dropped ?? []).map(d => d.index), ...effect.freed, ...turn.match.freed];
  const chainMerges = (chain?.clusters ?? []).map(cluster => ({ cluster, target: mergeTarget(cluster, sources.filter(i => cluster.includes(i)), W) }));
  const chainShown = chainMerges.reduce((sum, { cluster }) => sum + clusterPoints(cluster.length), 0) + (chain?.broken.length ?? 0) * POINTS_PER_CRATE;
  // Claw Cross: điểm mèo bị gom bật ra ngay lúc cả đàn chụm về tâm (nhân gom đôi như cả lượt), tách khỏi số thưởng cuối
  const mult = effect.double ? EFFECTS.DOUBLE_MULT : 1;
  const crossShown = effect.effects.filter(fx => fx.kind === 'cross' && fx.points).map(fx => Math.round(fx.points * mult));
  holdScoreSlots(1 + chainMerges.length + (chain?.broken.length ?? 0) + crossShown.length); // điểm thưởng + điểm gom dây chuyền / Claw Cross giữ thanh điểm tới khi bật ra
  const bonus = turn.gained - turnPoints(turn.match) - chainShown - crossShown.reduce((a, b) => a + b, 0);
  // Thùng / kim loại / mèo trong chuồng bị hiệu ứng phá: chụp lại ô thật (bàn chưa vẽ lại) giữ chỗ cũ tới lúc trúng.
  const solidGhosts = new Map();
  [...effect.broken.filter(i => !chain?.broken.includes(i)), ...effect.blasted.filter(i => turn.match.board[i]?.cage)].forEach(index => {
    const cell = cellEl(index);
    if (!cell || reduceMotion.matches) return;
    const ghost = cell.cloneNode(true);
    ghost.classList.add('solid-ghost');
    ghost.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
    fxLayer().append(ghost);
    solidGhosts.set(index, ghost);
  });
  const blastGhosts = spawnGhosts(effect.blasted.filter(i => !solidGhosts.has(i)), turn.match.board);
  // Lịch: hiệu ứng thường nối nhau mỗi 260ms; cụm dây chuyền gom sau khi mèo thả đáp xong / sau hiệu ứng thường; hiệu ứng cụm to
  // của cụm dây chuyền (fx.chain) nổ sau khi cụm đó gom xong — đúng thứ tự đặt -> gom -> nổ như lượt thường.
  const plain = effect.effects.filter(fx => !fx.chain), dropAt = plain.findIndex(fx => fx.kind === 'drop');
  const chainAt = dropAt >= 0 ? delay + dropAt * 260 + (effect.dropped.length - 1) * 120 + 140 : delay + plain.length * 260;
  const chainFxAt = chainAt + DROP_MS + LIFT_MS + MERGE_MS + 60;
  let nPlain = 0, nChain = 0;
  const times = effect.effects.map(fx => (fx.chain ? chainFxAt + nChain++ * 260 : delay + nPlain++ * 260));
  // Bóng mèo của cụm dây chuyền (mèo sẵn trên bàn). Mèo thả xuống thêm vào lúc rơi. Mèo còn lồng trước lượt này vẫn vẽ lồng tới đúng
  // lúc lồng vỡ (vỡ do gom: cùng lúc cụm gom chụm lại; vỡ do hiệu ứng: lúc hiệu ứng nổ; vỡ do gom dây chuyền: lúc cụm đó chụm lại).
  const uncaged = turn.match.board.map(o => (o?.cage ? { ...o, cage: 0 } : o));
  const chainGhosts = spawnGhosts(chained.filter(i => uncaged[i]?.group), uncaged);
  const freeAt = index => {
    if (turn.match.freed.includes(index)) return DROP_MS + LIFT_MS + MERGE_MS * .7;
    const n = effect.effects.findIndex(fx => fx.cells.includes(index));
    return n >= 0 ? times[n] : chainAt + DROP_MS + LIFT_MS + MERGE_MS * .7;
  };
  chainGhosts.forEach((ghost, index) => {
    const before = turn.result.board[index];
    if (!before?.cage || before.syrup || reduceMotion.matches) return;
    ghost.classList.add('caged', `cage-${before.cage}`);
    cageUp(ghost);
    setTimeout(() => { ghost.classList.remove('caged', `cage-${before.cage}`); uncage(ghost); }, freeAt(index));
  });
  // Mèo thả xuống mà không bị gom: ô thật đã vẽ sẵn mèo, giấu đi tới lúc mèo rơi xuống
  const keptDrops = (effect.dropped ?? []).filter(d => !chained.includes(d.index));
  setTimeout(() => keptDrops.forEach(d => { const cell = cellEl(d.index); if (cell) cell.style.visibility = 'hidden'; }), 0);
  effect.effects.forEach((fx, n) => setTimeout(() => {
    const style = EFFECT_FX[fx.kind], layer = fxLayer();
    n = (fx.chain ? effect.effects.filter(f => f.chain) : plain).indexOf(fx); // chữ tên hiệu ứng xếp tầng theo thứ tự trong nhóm của nó
    playSound(fx.kind === 'pounce' ? 'crateBreak' : 'merge', fx.kind === 'herd' ? 7 : fx.kind === 'cross' ? 6 : 5);
    if (fx.kind === 'herd') playMeowChorus(state.board.filter(o => o?.group).map(o => o.group));
    shakeBoard(style.shake);
    // Bonus Time: Pounce đếm dồn suốt lúc xả lượt ("Pounce! x3"); ván mới / ngoài Bonus Time đếm lại từ đầu
    const bonus = document.body.classList.contains('bonus-time');
    if (!bonus || pounceSession !== state) { bonusPounces = 0; pounceSession = state; }
    if (bonus && fx.kind === 'pounce') bonusPounces++;
    effectBanner(bonus && fx.kind === 'pounce' && bonusPounces > 1 ? `${style.label} x${bonusPounces}` : style.label, n);
    if (fx.kind === 'drop') return dropCats(effect, chainGhosts);
    const gathered = new Map(); // Claw Cross: mèo cùng màu bị gom chụm về tâm (không bay lên)
    const rc = i => [Math.floor(i / W), i % W], [cr, cc] = rc(fx.center);
    // Call the Herd: sóng quét toả từ tâm ra cả bàn, ô xa trúng sau
    const wait = (index, i) => (fx.kind === 'herd' ? (Math.abs(rc(index)[0] - cr) + Math.abs(rc(index)[1] - cc)) * 55 : i * 18);
    if (fx.kind === 'cross') clawSlash(layer, fx.center);
    if (fx.kind === 'herd') herdWave(layer, fx.center);
    const lead = fx.kind === 'cross' ? 150 : 0; // vệt cào quẹt gần xong là bắn tia gom
    fx.cells.forEach((index, i) => {
      const cell = cellEl(index);
      if (!cell) return;
      const at = lead + wait(index, i);
      const flash = document.createElement('span');
      flash.className = `fx-flash fx-${fx.kind}`;
      flash.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px;animation-delay:${at}ms`;
      layer.append(flash);
      setTimeout(() => flash.remove(), 700 + at);
      const ghost = blastGhosts.get(index);
      if (ghost) {
        blastGhosts.delete(index);
        if (fx.kind === 'cross') gathered.set(index, ghost); else setTimeout(() => liftAway(layer, ghost), at);
        return;
      }
      const solid = solidGhosts.get(index);
      if (solid) {
        solidGhosts.delete(index);
        setTimeout(() => {
          if (solid.classList.contains('locked')) { uncage(solid); solid.classList.add('merge-ghost'); flyBits(layer, cell, 'cage-bar', 6); return liftAway(layer, solid); }
          flyBits(layer, cell, solid.querySelector('.crate') ? 'crate-shard' : 'cage-bar', 6); spawnPuff(cell); solid.remove();
        }, at);
        return;
      }
      if (effect.broken.includes(index) || effect.cleaned.includes(index)) setTimeout(() => { flyBits(layer, cell, style.bits, 5); spawnPuff(cell); }, at);
    });
    if (fx.kind === 'cross' && !gathered.size && fx.points) setTimeout(() => showMergeScore(cellEl(fx.center), Math.round(fx.points * mult), 0, 'm6'), lead);
    if (gathered.size) setTimeout(() => gatherTo(layer, gathered, fx.center, Math.round(fx.points * mult)), lead);
  }, times[n]));
  if (chainMerges.length) {
    const hit = chainAt + DROP_MS + LIFT_MS + MERGE_MS * .7;
    breakCrates(chain.broken, hit);
    chain.broken.forEach(index => { const cell = cellEl(index); if (cell) showMergeScore(cell, POINTS_PER_CRATE, hit + 120, 'crate'); else releaseScoreSlot(); });
    celebrateMatch(chainMerges, hit);
    setTimeout(() => { playSound('merge', Math.max(...chainMerges.map(m => m.cluster.length))); animateMerges(chainGhosts, chainMerges); }, chainAt);
  }
  const last = Math.max(delay + 200, ...times.map(t => t + 200), chainMerges.length ? chainAt + DROP_MS + LIFT_MS + MERGE_MS + 200 : 0);
  setTimeout(() => {
    blastGhosts.forEach(ghost => ghost.remove()); // phòng hờ: ô xoá mà không nằm trong ô của hiệu ứng nào
    solidGhosts.forEach(ghost => ghost.remove());
    if (effect.double && !effect.effects.length) effectBanner('Double!', 0);
    const center = cellEl(effect.effects[0]?.center ?? turn.result.indices[0]);
    if (center && bonus > 0) showMergeScore(center, bonus, 0, effect.double ? 'm7' : 'm6'); else releaseScoreSlot();
  }, last);
}

// Claw Cross: ba vệt cào sáng quẹt chéo qua tâm (to cỡ 3 ô), rồi mèo cùng màu bị gom.
function clawSlash(layer, center) {
  const cell = cellEl(center);
  if (!cell || reduceMotion.matches) return;
  const claw = document.createElement('span');
  claw.className = 'claw-slash';
  claw.style.cssText = `left:${cell.offsetLeft + cell.offsetWidth / 2}px;top:${cell.offsetTop + cell.offsetHeight / 2}px;--s:${cell.offsetWidth}px`;
  claw.innerHTML = '<i></i><i></i><i></i>';
  layer.append(claw);
  setTimeout(() => claw.remove(), 900);
}

// Mèo cùng màu (Claw Cross): từ ô tâm bắn tia sáng tới từng con (lần lượt); tia chạm tới thì con đó loé sáng và bị nhấc bổng
// (chân lủng lẳng như lúc gom); trúng hết thì cả đàn bay chụm về ô tâm, nhỏ dần; tới nơi thì loé + khói.
const BEAM_STEP = 40, BEAM_MS = 120;
function gatherTo(layer, ghosts, center, points) {
  const to = cellEl(center);
  if (!to) { if (points) releaseScoreSlot(); return ghosts.forEach(ghost => ghost.remove()); }
  const cx = to.offsetLeft + to.offsetWidth / 2, cy = to.offsetTop + to.offsetHeight / 2;
  let k = 0;
  ghosts.forEach(ghost => {
    const at = k++ * BEAM_STEP;
    const dx = ghost.offsetLeft + ghost.offsetWidth / 2 - cx, dy = ghost.offsetTop + ghost.offsetHeight / 2 - cy;
    const beam = document.createElement('span');
    beam.className = 'claw-beam';
    beam.style.cssText = `left:${cx}px;top:${cy}px;width:${Math.hypot(dx, dy)}px;rotate:${Math.atan2(dy, dx)}rad;--d:${at}ms`;
    layer.append(beam);
    setTimeout(() => beam.remove(), at + BEAM_MS + 420);
    setTimeout(() => {
      const flash = document.createElement('span');
      flash.className = 'fx-flash fx-cross';
      flash.style.cssText = `left:${ghost.offsetLeft}px;top:${ghost.offsetTop}px;width:${ghost.offsetWidth}px;height:${ghost.offsetHeight}px`;
      layer.append(flash);
      setTimeout(() => flash.remove(), 700);
      ghost.classList.add('lifted');
      playSound('pick');
    }, at + BEAM_MS);
  });
  setTimeout(() => {
    let n = 0;
    ghosts.forEach(ghost => {
      const dx = to.offsetLeft - ghost.offsetLeft, dy = to.offsetTop - ghost.offsetTop;
      ghost.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * .85}px, ${dy * .85}px) scale(.7)`, opacity: 1, offset: .8 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3)`, opacity: 0 },
      ], { duration: 280, delay: n++ * 15, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' }).finished.then(() => ghost.remove());
    });
    if (points) showMergeScore(to, points, 160, 'm6'); // điểm bật ra khi đàn mèo đang chụm lại
    setTimeout(() => { spawnPuff(to); flyBits(layer, to, 'yarn-bit', 8); playSound('merge', 6); }, 280 + n * 15);
  }, (k - 1) * BEAM_STEP + BEAM_MS + 110);
}

// Call the Herd: vòng sáng lớn toả từ tâm ra quét cả bàn.
function herdWave(layer, center) {
  const cell = cellEl(center);
  if (!cell || reduceMotion.matches) return;
  const wave = document.createElement('span');
  wave.className = 'herd-wave';
  wave.style.cssText = `left:${cell.offsetLeft + cell.offsetWidth / 2}px;top:${cell.offsetTop + cell.offsetHeight / 2}px;--s:${cell.offsetWidth}px`;
  layer.append(wave);
  setTimeout(() => wave.remove(), 1100);
}

// Mèo bị hiệu ứng xoá: nhấc bổng (chân lủng lẳng như lúc gom) rồi bay vút lên, quanh thân có các đốm sáng phép thuật bay vòng (quỹ đạo elip,
// vòng ra sau thân thì mờ đi), kéo theo vệt sáng; quầng tím mờ sau lưng. Các đốm nằm trong bóng mèo nên bay lên cùng mèo.
const MAGIC = ['#c9a7ff', '#8fe3ff', '#ffb3e6', '#fff2a8'];
function liftAway(layer, ghost) {
  const magic = document.createElement('span');
  magic.className = 'magic';
  magic.innerHTML = '<i class="magic-halo"></i>';
  const rx = ghost.offsetWidth * .72, ry = ghost.offsetWidth * .3;
  for (let k = 0; k < 6; k++) {
    const orb = document.createElement('i'), start = (k / 6) * Math.PI * 2, rise = (k % 3) * .22 - .22, steps = 24;
    orb.className = 'magic-orb';
    orb.style.setProperty('--c', MAGIC[k % MAGIC.length]);
    magic.append(orb);
    // 1.5 vòng xoắn từ chân lên đầu: x/y theo elip, đốm ở nửa sau thân mờ + nhỏ lại
    orb.animate(Array.from({ length: steps + 1 }, (_, t) => {
      const angle = start + (t / steps) * Math.PI * 3, front = Math.sin(angle);
      const y = Math.sin(angle) * ry + ghost.offsetHeight * (rise + .35 - (t / steps) * .7);
      return { transform: `translate(${Math.cos(angle) * rx}px, ${y}px) scale(${.75 + front * .3})`, opacity: t === 0 || t === steps ? 0 : .55 + front * .45, zIndex: front > 0 ? 2 : 0 };
    }), { duration: 900, delay: k * 40, easing: 'linear', fill: 'both' });
  }
  ghost.append(magic);
  ghost.classList.add('lifted');
  ghost.animate([
    { translate: '0 0', opacity: 1 },
    { translate: '0 -15%', opacity: 1, offset: .35 },
    { translate: '0 -160%', opacity: 0 },
  ], { duration: 900, delay: 180, easing: 'cubic-bezier(.5, 0, .7, .4)', fill: 'forwards' }).finished.then(() => ghost.remove());
}

// Cat Drop (gom đôi 3+3): 2 mèo đơn rơi từ trên xuống ô đã chọn (khói khi đáp). Mèo thành cụm thì nằm lại làm bóng chờ gom
// (playEffects chạy anim gom cho cả cụm); không thì mèo ở lại, hiện ô thật.
const DROP_FALL_MS = 380;
function dropCats(effect, chainGhosts) {
  const chained = effect.chain?.cleared ?? [];
  effect.dropped.forEach(({ index, group }, k) => setTimeout(() => {
    const fake = [];
    fake[index] = { group };
    const ghost = spawnGhosts([index], fake, new Set([index])).get(index);
    if (!ghost) return;
    if (chained.includes(index)) { chainGhosts.set(index, ghost); return; }
    setTimeout(() => { ghost.remove(); const cell = cellEl(index); if (cell) cell.style.visibility = ''; }, DROP_FALL_MS);
  }, k * 120));
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
  const freed = match.freed?.filter(index => !match.syrup?.includes(index)) ?? []; // siro: washSyrup lo
  if (reduceMotion.matches || (!match.caged?.length && !freed.length)) return;
  // Gọi trước khi vẽ lại bàn: ô được thả vẫn vẽ lồng đóng tới lúc anim mở.
  freed.forEach(index => cageHeld.add(index));
  setTimeout(() => {
    const layer = fxLayer();
    match.caged.forEach(index => {
      const cell = cellEl(index);
      if (!cell) return;
      cell.classList.add('cage-hit');
      cell.addEventListener('animationend', () => cell.classList.remove('cage-hit'), { once: true });
      flyBits(layer, cell, 'cage-lock', 1);
    });
    freed.forEach(openCage);
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

// Nạp sẵn ảnh hộp mở / lồng mở để lúc đổi ảnh không bị trống một khung.
new Image().src = CRATE_OPEN_SRC;
new Image().src = CAGE_OPEN_SRC;
new Image().src = CAGE_DOOR_SRC;
// Bật mở mượt: nén xuống lấy đà, ảnh "mở" hiện dần chồng lên ảnh "đóng" trong lúc bật lên, giữ một nhịp, rồi bay nhẹ lên + mờ dần + khói.
async function openUp(ghost, openSrc) {
  const shut = ghost.querySelector('img');
  const open = shut.cloneNode();
  open.src = openSrc;
  open.classList.add('open');
  open.style.opacity = 0;
  shut.after(open);
  const ease = 'cubic-bezier(.34,1.56,.64,1)';
  await ghost.animate([{ scale: '1 1' }, { scale: '1.08 .9', offset: .3 }, { scale: '.96 1.06', offset: .65 }, { scale: '1 1' }],
    { duration: 380, easing: 'ease-in-out' }).finished.catch(() => {});
  open.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 0, fill: 'forwards', easing: 'ease-out' });
  shut.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 60, fill: 'forwards', easing: 'ease-in' });
  await ghost.animate([{ translate: '0 0' }, { translate: '0 -8%' }, { translate: '0 0' }], { duration: 320, easing: ease }).finished.catch(() => {});
  await wait(260);
  spawnPuff(ghost);
  await ghost.animate([{ scale: 1, opacity: 1, translate: '0 0' }, { scale: .7, opacity: 0, translate: '0 -12%' }],
    { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
}
// Lồng mở khi con vật được thả. Ô thật vẫn vẽ lồng đóng (cageHeld) tới lúc này; anim chạy ngay trong khung .cage-box của ô
// (thân lồng -> con vật -> khung trước -> cánh cửa; bàn là cảnh 3D nên lớp hiệu ứng riêng không xếp xen được).
// Khung trước đổi sang bản cửa mở (đã bỏ cánh cửa) + cánh cửa tách riêng, rồi CÙNG LÚC:
// - cánh cửa bung ra, rời khỏi lồng, xoay và rơi xuống, mờ dần;
// - thân lồng + khung trước thu lại cùng nhau, mờ dần (ease-out: chuyển động ngay từ đầu);
// - con vật bật to lên (được thả) rồi về đúng chỗ / cỡ thường của ô (đo thật: cuối anim khớp ô, rút khỏi khung không giật).
const CAGE_OPEN_MS = 520;
const PET_POP = 1.18;
function openCage(index) {
  const cell = cellEl(index);
  const release = () => {
    cageHeld.delete(index);
    const now = cellEl(index);
    if (!now?.querySelector('.cage-box') || state.board[index]?.cage) return;
    // anim của con vật có fill: forwards -> phải huỷ trước khi rút ra, không thì nó giữ cỡ / chỗ cuối anim ở ô thường (lỗi cũ: to hơn con khác)
    now.querySelectorAll('.cage-box > *').forEach(el => el.getAnimations().forEach(anim => anim.cancel()));
    uncage(now);
    now.classList.remove('caged', 'cage-opening');
  };
  const pet = cell?.querySelector('.cage-box > .cat');
  if (!pet || state.board[index]?.cage) return release();
  // Đo chỗ con vật khi ra khỏi lồng (rút ra, đo, cất lại trong cùng một khung hình nên không thấy chớp).
  const caged = pet.getBoundingClientRect();
  uncage(cell);
  cell.classList.remove('caged');
  const free = cell.querySelector(':scope > .cat').getBoundingClientRect();
  cell.classList.add('caged', 'cage-opening');
  cageUp(cell);
  // Vừa được thả: mặt vui ngay từ lúc lồng bung, giữ thêm một nhịp sau khi ra khỏi lồng (.cheered: chỉ đổi mặt, không nhảy chồng lên anim thả).
  clearTimeout(cell.petTimer);
  cell.classList.remove('idle-cute', 'grumpy', 'grumpy-chew');
  cell.classList.add('petted', 'cheered');
  cell.petTimer = setTimeout(() => cell.classList.remove('petted', 'cheered'), CAGE_OPEN_MS + 1000);
  const box = cell.querySelector('.cage-box'), boxRect = box.getBoundingClientRect();
  const kx = box.offsetWidth / boxRect.width, ky = box.offsetHeight / boxRect.height;
  const inBox = cell.querySelector('.cage-box > .cat'), front = cell.querySelector('.cage-front'), back = cell.querySelector('.cage-back');
  front.src = CAGE_OPEN_SRC;
  front.insertAdjacentHTML('afterend', `<img class="cage-door" src="${CAGE_DOOR_SRC}" alt="" draggable="false">`);
  const door = cell.querySelector('.cage-door');
  const dx = (free.left - caged.left) * kx, dy = (free.top - caged.top) * ky, k = free.width / caged.width;
  const opts = { duration: CAGE_OPEN_MS, fill: 'forwards' };
  // phóng quanh tâm con vật: bù phần dịch do transform-origin 0 0
  const w = inBox.offsetWidth, h = inBox.offsetHeight, pop = k * PET_POP;
  inBox.animate([
    { translate: '0 0', scale: 1 },
    { translate: `${dx * .5 - w * (pop - 1) / 2}px ${dy * .5 - h * (pop - 1) * .8}px`, scale: pop, offset: .4, easing: 'ease-in-out' },
    { translate: `${dx}px ${dy}px`, scale: k },
  ], { ...opts, easing: 'ease-out' });
  door.animate([
    { translate: '0 0', rotate: '0deg', opacity: 1, easing: 'ease-out' },
    { translate: '-8% -6%', rotate: '-10deg', opacity: 1, offset: .25, easing: 'ease-in' },
    { translate: '-14% 75%', rotate: '-35deg', opacity: 0 },
  ], opts);
  const shrink = [{ scale: 1, opacity: 1 }, { scale: .3, opacity: 0 }];
  front.animate(shrink, { ...opts, easing: 'cubic-bezier(.2,.6,.35,1)' });
  back.animate(shrink, { ...opts, easing: 'cubic-bezier(.2,.6,.35,1)' }).finished.then(release, release);
}
// Bóng hộp giữ nguyên chỗ cũ tới lúc gom xong, rung lên, bật nắp, giữ một nhịp rồi thu nhỏ biến mất + khói.
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
      await openUp(ghost, CRATE_OPEN_SRC);
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
// Bonus Time: mỗi lời khen một màu kế tiếp (cùng bậc gom vẫn đổi màu liên tục) — [chữ, viền, quầng]
const BONUS_TONES = [['#ffe46b', '#7a3a12', '#fff3b0'], ['#9df07a', '#1f6a2a', '#d4ffb8'], ['#7fd8ff', '#174f8a', '#c8efff'],
  ['#ff8fd8', '#7a1a5c', '#ffd0f0'], ['#ffa94d', '#8a3a0a', '#ffe0b8'], ['#c99bff', '#4a1f6b', '#eadcff']];
let bonusTone = 0;

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
    if (document.body.classList.contains('bonus-time')) {
      const [fill, ink, glow] = BONUS_TONES[bonusTone++ % BONUS_TONES.length];
      Object.assign(pop.style, { color: fill, background: 'none', animation: 'none', webkitTextStroke: `8px ${ink}`, filter: `drop-shadow(0 4px 0 ${ink}99) drop-shadow(0 0 14px ${glow})` });
    }
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
