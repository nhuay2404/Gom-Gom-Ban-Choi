// ===== Hướng dẫn Deco: làm mờ màn hình, khoét sáng từng khu vực + bong bóng lời thoại =====
// Chỉ vẽ và chạy bước; nội dung bước (chỗ cần sáng, lời thoại, chuyển tab, tặng quà) do menu-controller.js khai báo.
// Một bước: { target: () => Element | {left, top, width, height} | mảng các thứ đó | null, text: chuỗi | () => chuỗi,
//   next?: nhãn nút (mặc định "Next"), before?: async () => void (chạy trước khi hiện bước), after?: () => void (khi qua bước),
//   until?: () => boolean, bubble?: 'above' | 'below' }.
// Có `until` = bước thao tác: chỉ chỗ sáng chạm được (ngoài chỗ sáng bị chắn), không có nút Next, tự qua bước khi until() đúng.
// Không có `until` = bước đọc: cả màn hình bị chắn, bấm Next để qua.
import { catMarkup } from './ui/cat-art.mjs';
import { playSound } from './ui/sound.mjs';

const PAD = 8, POLL = 150;
let layer = null, running = null;

function build() {
  layer = document.createElement('div');
  layer.className = 'tutorial deco-tour';
  layer.hidden = true;
  layer.innerHTML = `<svg class="tutorial-dim" aria-hidden="true">
      <defs><mask id="deco-tour-mask"><rect width="100%" height="100%" fill="#fff"/><g class="deco-tour-holes" fill="#000"></g></mask></defs>
      <rect width="100%" height="100%" mask="url(#deco-tour-mask)"/>
    </svg>
    <div class="deco-tour-blockers"></div>
    <div class="deco-tour-rings"></div>
    <div class="tutorial-hand deco-tour-hand" aria-hidden="true">👆</div>
    <div class="tutorial-bubble deco-tour-bubble" role="status">
      <span class="tutorial-avatar" aria-hidden="true">${catMarkup.orange}</span>
      <p></p>
      <footer class="deco-tour-foot">
        <button class="deco-tour-skip" type="button">Skip</button>
        <i class="deco-tour-dots"></i>
        <button class="pill-button deco-tour-next" type="button">Next</button>
      </footer>
    </div>`;
  document.body.append(layer);
  layer.querySelector('.deco-tour-next').onclick = () => { playSound('pick'); running?.advance(); };
  layer.querySelector('.deco-tour-skip').onclick = () => { playSound('pick'); running?.finish(); };
  addEventListener('resize', () => running?.render());
}

const rectOf = target => {
  const list = [target].flat().filter(Boolean).map(el => el.getBoundingClientRect?.() ?? el)
    .map(r => ({ left: r.left, top: r.top, right: r.right ?? r.left + r.width, bottom: r.bottom ?? r.top + r.height }))
    .map(r => ({ ...r, width: r.right - r.left, height: r.bottom - r.top })).filter(r => r.width && r.height);
  if (!list.length) return null;
  const left = Math.min(...list.map(r => r.left)), top = Math.min(...list.map(r => r.top));
  return { left, top, width: Math.max(...list.map(r => r.right)) - left, height: Math.max(...list.map(r => r.bottom)) - top };
};

export const decoTourActive = () => !!running;
export const waitFor = (test, timeout = 4000) => new Promise(resolve => {
  const start = performance.now(), tick = () => (test() || performance.now() - start > timeout ? resolve() : setTimeout(tick, 60));
  tick();
});

export function startDecoTour(steps, onDone) {
  if (running || !steps.length) return;
  if (!layer) build();
  let index = 0, token = 0, drawn = '', poll = 0;
  const holes = layer.querySelector('.deco-tour-holes'), rings = layer.querySelector('.deco-tour-rings'), blockers = layer.querySelector('.deco-tour-blockers');
  const bubble = layer.querySelector('.deco-tour-bubble'), text = bubble.querySelector('p'), hand = layer.querySelector('.deco-tour-hand');
  const next = layer.querySelector('.deco-tour-next'), dots = layer.querySelector('.deco-tour-dots');
  const div = (cls, css) => Object.assign(document.createElement('div'), { className: cls, style: css });

  // Vẽ lại theo vị trí hiện tại của chỗ sáng (cảnh 3D / bảng còn trượt): chỉ dựng lại phần tử khi vị trí đổi, để vòng sáng không giật.
  const render = () => {
    const step = steps[index], box = rectOf(step.target()), tap = !!step.until;
    const label = typeof step.text === 'function' ? step.text() : step.text;
    if (text.textContent !== label) text.textContent = label;
    next.hidden = tap && !!box; // bước thao tác mà không đo được chỗ sáng: cho bấm Next để khỏi kẹt
    next.textContent = step.next || (index === steps.length - 1 ? 'Got it!' : 'Next');
    dots.textContent = steps.map((_, i) => (i === index ? '●' : '○')).join(' ');
    const rect = box && { x: Math.round(box.left - PAD), y: Math.round(box.top - PAD), width: Math.round(box.width + PAD * 2), height: Math.round(box.height + PAD * 2) };
    const key = `${index}|${rect ? Object.values(rect) : ''}`;
    if (key !== drawn) {
      drawn = key;
      holes.replaceChildren(...(rect ? [rect] : []).map(r => {
        const hole = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        Object.entries({ ...r, rx: 16 }).forEach(([name, value]) => hole.setAttribute(name, value));
        return hole;
      }));
      rings.replaceChildren(...(rect ? [rect] : []).map(r => div('tutorial-ring', `left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`)));
      // Bước thao tác: bốn tấm chắn quanh chỗ sáng, chỗ sáng để trống cho ngón tay chạm xuống nút thật. Bước đọc: một tấm chắn kín.
      const r = rect, right = r && r.x + r.width, bottom = r && r.y + r.height;
      blockers.replaceChildren(...(tap && r
        ? [`left:0;top:0;right:0;height:${Math.max(0, r.y)}px`, `left:0;top:${bottom}px;right:0;bottom:0`,
          `left:0;top:${r.y}px;width:${Math.max(0, r.x)}px;height:${r.height}px`, `left:${right}px;top:${r.y}px;right:0;height:${r.height}px`]
        : ['inset:0']).map(css => div('deco-tour-blocker', css)));
      hand.hidden = !(tap && r);
      if (!hand.hidden) {
        const x = r.x + r.width / 2, y = r.y + r.height / 2, at = scale => `translate(${x}px, ${y}px) scale(${scale})`;
        hand.getAnimations().forEach(animation => animation.cancel());
        hand.animate([{ transform: at(1) }, { transform: at(.8), offset: .3 }, { transform: at(1), offset: .6 }, { transform: at(1) }], { duration: 1100, iterations: Infinity });
      }
    }
    // Bong bóng nằm phía đối diện chỗ được sáng (sáng ở nửa trên -> bóng xuống dưới, ngược lại), không có chỗ sáng thì giữa màn hình.
    const height = bubble.offsetHeight, view = innerHeight;
    let top = (view - height) / 2;
    if (rect) {
      const below = rect.y + rect.height + 14, above = rect.y - height - 14, wantBelow = step.bubble ? step.bubble === 'below' : rect.y + rect.height / 2 < view / 2;
      top = wantBelow ? (below + height < view - 8 ? below : Math.max(8, above)) : (above > 8 ? above : below);
    }
    bubble.style.top = `${Math.max(8, Math.min(top, view - height - 8))}px`;
  };
  const stopPoll = () => { clearInterval(poll); poll = 0; };
  const show = async () => {
    const mine = ++token;
    stopPoll();
    layer.hidden = true;
    drawn = '';
    await steps[index].before?.();
    if (mine !== token) return;
    layer.hidden = false;
    // Cảnh mới đổi (tab, bảng) cần một khung hình để đo đúng chỗ.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (mine !== token) return;
      render();
      bubble.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
      poll = setInterval(() => {
        if (mine !== token) return stopPoll();
        render();
        if (steps[index].until?.()) { playSound('pick'); advance(); }
      }, POLL);
    }));
  };
  const finish = () => { token++; stopPoll(); running = null; layer.hidden = true; onDone?.(); };
  const advance = () => { stopPoll(); steps[index].after?.(); if (++index >= steps.length) finish(); else show(); };
  running = { render: () => { if (!layer.hidden) render(); }, advance, finish };
  show();
}
