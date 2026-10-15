// Hướng dẫn trong màn: làm mờ, khoét sáng đúng chỗ cần chạm, bàn tay chỉ đường, bong bóng chữ. Bước khai ở data/levels.mjs,
// luật bước ở core/session.mjs. Sang Unity: TutorialOverlay (MonoBehaviour + Canvas mask).
import * as game from '../core/session.mjs';
import { placementIndices } from '../core/board-rules.mjs';
import { catMarkup } from '../ui/cat-art.mjs';
import { $ } from '../app/shared.js';
import { state, W, H, cellEl, menus } from './context.js';

// ===== Tutorial: làm mờ màn hình, khoét sáng đúng chỗ cần chạm, bàn tay chỉ đường + bong bóng lời thoại =====
// Mỗi bước (levels.mjs): drag (kéo vào ô `anchor`; free = chỉ gợi ý), rotate (xoay tới hướng `offsets`),
// hold (kéo vào Gửi tạm), tapHold (chạm Gửi tạm), info (đọc rồi bấm Tiếp tục).
// Luật tutorial (bước nào cho làm gì, khi nào sang bước) nằm ở session.mjs; ở đây chỉ vẽ.
export const tutorialStep = () => game.tutorialStep(state);

export const tutorialAllows = (action, anchor) => game.tutorialAllows(state, action, anchor);

// Chờ anim gom/đặt một nhịp rồi mới chỉ bước kế để người chơi kịp thấy kết quả.
export function showNextTutorial(delay) {
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

export function renderTutorial() {
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
  // đường dẫn viết đủ (không ghép chuỗi) để build:html nhúng được ảnh
  $('tutorial-hand-img').src = step.type === 'drag' || step.type === 'hold' ? './assets/img/tutorial/hand-drag.png' : './assets/img/tutorial/hand-tap.png';
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

$('tutorial-avatar').innerHTML = catMarkup.orange;
