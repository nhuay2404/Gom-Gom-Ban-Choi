// Kéo thẻ đang bóc lên bàn: bóng kéo (lực lò xo nghiêng theo tay), tìm ô neo gần nhất, thả vào bàn / ô Hold, xoay khi đang kéo
// (ngón thứ hai). Sang Unity: CardDragController (IBeginDrag / IDrag / IEndDrag).
import * as game from '../core/session.mjs';
import { placementIndices } from '../core/board-rules.mjs';
import { DRAG } from '../data/tuning.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { state, W, H } from './context.js';
import { hammerArmed, disarmHammer, renderBoosters } from './booster-bar.js';
import { tutorialAllows, showNextTutorial } from './tutorial.js';
import { paintPreview } from './board-view.js';
import { rotateActive, markHoldDrop, holdActive } from './cards.js';
import { placeAt } from './play-controller.js';
import { render } from './hud.js';

const DRAG_BOOST = DRAG.BOOST, DRAG_SHRINK_RANGE = DRAG.SHRINK_RANGE;

export let cardDrag = null;

export const centerOf = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

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
  cancelCardDrag(); // lượt kéo trước bị mất pointerup (chuột phải / menu): dọn bóng cũ, không để mèo kẹt trên màn hình
  if (hammerArmed) { disarmHammer(); renderBoosters(); }
  const source = $('active-card');
  try { source.setPointerCapture(event.pointerId); } catch { /* con trỏ giả (test) / đã nhả */ }
  const rect = source.getBoundingClientRect();
  cardDrag = {
    pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ghost: null, anchor: null,
    grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, width: rect.width, height: rect.height,
    grabbed: grabbedPiece(event.clientX, event.clientY), cells: null,
    lift: event.pointerType === 'mouse' ? 0 : DRAG.TOUCH_LIFT,
    tapTolerance: event.pointerType === 'mouse' ? DRAG.TAP_TOLERANCE : DRAG.TOUCH_TAP_TOLERANCE,
  };
  source.classList.add('dragging');
  // Đang giữ thẻ: tắt cử chỉ của trình duyệt (chụm phóng to / cuộn) để ngón thứ hai chạm = xoay thẻ.
  document.body.classList.add('card-holding');
}

// Huỷ lượt kéo: bỏ bóng, thẻ về dock, không đặt mèo.
const cancelCardDrag = () => cardDrag && finishCardDrag({ pointerId: cardDrag.pointerId, type: 'cancel' });

function moveCardDrag(event) {
  if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) return cancelCardDrag(); // đã nhả chuột trái mà không nhận pointerup
  cardDrag.lastX = event.clientX; cardDrag.lastY = event.clientY;
  if (!cardDrag.ghost && Math.hypot(event.clientX - cardDrag.startX, event.clientY - cardDrag.startY) < cardDrag.tapTolerance) return;
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
  // Điểm cầm: cảm ứng thì nổi lên trên ngón tay (cardDrag.lift); mọi phép đo bên dưới theo điểm này.
  const x = event.clientX, y = event.clientY - cardDrag.lift;
  // Xa bàn: mèo to DRAG_BOOST lần cho dễ nhìn; càng gần bàn càng co về đúng cỡ ô để không che grid + ô xem trước.
  const board = cardDrag.boardRect, gapY = Math.max(0, y - board.bottom, board.top - y);
  const gapX = Math.max(0, board.left - x, x - board.right);
  const far = Math.min(1, Math.hypot(gapX, gapY) / DRAG_SHRINK_RANGE);
  cardDrag.ghost.style.transform = `scale(${(cardDrag.baseScale * (1 + (DRAG_BOOST - 1) * far)).toFixed(3)})`;
  feedDragPhysics(cardDrag.physics, x);
  cardDrag.ghost.style.left = `${x - cardDrag.grabX}px`;
  cardDrag.ghost.style.top = `${y - cardDrag.grabY}px`;
  // Kéo vào ô Gửi tạm: ưu tiên hơn bàn, sáng ô lên để báo thả được.
  const hold = cardDrag.holdRect;
  cardDrag.overHold = state.holdOn && x >= hold.left - 8 && x <= hold.right + 8
    && y >= hold.top - 8 && y <= hold.bottom + 8;
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
    markHoldDrop(); // thả tay vào ô: mèo rơi xuống ô thay vì bay từ thẻ đang bóc sang
    return holdActive();
  }
  if (anchor !== null && event.type !== 'cancel') placeAt(anchor);
  else render(); // thả ra ngoài bàn = huỷ kéo, không cần báo
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

// Chuột phải lúc đang kéo: không mở menu, huỷ lượt kéo. Rời cửa sổ cũng huỷ.
document.addEventListener('contextmenu', event => { if (cardDrag) { event.preventDefault(); cancelCardDrag(); } });

addEventListener('blur', cancelCardDrag);
