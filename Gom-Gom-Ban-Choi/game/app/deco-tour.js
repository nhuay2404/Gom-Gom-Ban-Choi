// ===== Hướng dẫn Deco: làm mờ màn hình, khoét sáng từng khu vực + bong bóng lời thoại =====
// Chỉ vẽ và chạy bước; nội dung bước (chỗ cần sáng, lời thoại, chuyển tab, tặng quà) do menu-controller.js khai báo.
// Một bước: { target: () => Element | {left, top, width, height} | mảng các thứ đó | null, text: chuỗi | () => chuỗi,
//   next?: nhãn nút (mặc định "Next"), before?: async () => void (chạy trước khi hiện bước), after?: () => void (khi qua bước),
//   until?: () => boolean, bubble?: 'above' | 'below' | 'speech', gesture?: 'drag' | 'pinch' | 'twist' }.
// bubble 'speech': bong bóng lời thoại có đuôi, nằm sát cạnh chỗ sáng (vd. mèo đang nói), không có ảnh mèo trong bóng.
// speaker?: () => rect — bong bóng lời thoại mọc từ người nói (mèo) thay vì theo chỗ sáng; đo không được (mèo khuất, đang ở Shop) thì về bóng thường.
// Không có text = không hiện bong bóng, chỉ bàn tay minh hoạ cử chỉ (`gesture`) giữa chỗ sáng + nút Skip nhỏ.
// Có `until` = bước thao tác: chỉ chỗ sáng chạm được (ngoài chỗ sáng bị chắn), không có nút Next, tự qua bước khi until() đúng.
// Không có `until` = bước đọc: cả màn hình bị chắn, bấm Next để qua.
import { catMarkup } from '../ui/cat-art.mjs';
import { playSound } from '../ui/sound.mjs';

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
    <div class="deco-tour-gesture" aria-hidden="true" hidden><img alt=""></div>
    <div class="tutorial-bubble deco-tour-bubble" role="status">
      <span class="tutorial-avatar" aria-hidden="true">${catMarkup.orange}</span>
      <p></p>
    </div>`;
  document.body.append(layer);
  // Không có nút Skip / Next / chấm: chạm bất kỳ đâu (tấm chắn hoặc bong bóng) là qua bước — trừ bước thao tác đang chờ chạm đúng chỗ sáng.
  const tapNext = () => { if (running?.tappable()) { playSound('pick'); running.advance(); } };
  layer.querySelector('.deco-tour-blockers').addEventListener('click', tapNext);
  layer.querySelector('.deco-tour-bubble').addEventListener('click', tapNext);
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
  let index = 0, token = 0, drawn = '', poll = 0, speakerBox = null;
  const holes = layer.querySelector('.deco-tour-holes'), rings = layer.querySelector('.deco-tour-rings'), blockers = layer.querySelector('.deco-tour-blockers');
  const bubble = layer.querySelector('.deco-tour-bubble'), text = bubble.querySelector('p'), hand = layer.querySelector('.deco-tour-hand');
  const gesture = layer.querySelector('.deco-tour-gesture');
  let tappable = false;
  // Đường dẫn ĐẦY ĐỦ (không ghép `${tên}.png`): build:html chỉ nhúng ảnh có đường dẫn viết sẵn, ghép động thì bản xuất ra mất ảnh.
  const GESTURES = { drag: './ui/shared/img/tutorial/hand-drag.png', pinch: './ui/shared/img/tutorial/gesture-pinch.png', twist: './ui/shared/img/tutorial/gesture-rotate.png', tap: './ui/shared/img/tutorial/hand-tap.png' };
  // Bàn tay minh hoạ cử chỉ lặp lại giữa chỗ sáng: kéo = lướt ngang, chụm = co / giãn, xoay = đứng yên.
  const drawGesture = (kind, rect) => {
    gesture.hidden = !kind || !rect;
    if (gesture.hidden) return;
    const img = gesture.querySelector('img');
    img.src = GESTURES[kind];
    gesture.classList.toggle('tap', kind === 'tap'); // chạm: đầu ngón tay đặt đúng tâm chỗ sáng
    gesture.style.cssText = `left:${rect.x + rect.width / 2}px;top:${rect.y + rect.height / 2}px`;
    img.getAnimations().forEach(animation => animation.cancel());
    const keys = {
      drag: [{ transform: 'translateX(-70px)' }, { transform: 'translateX(70px)' }],
      pinch: [{ transform: 'scale(1.12)' }, { transform: 'scale(.86)' }],
      tap: [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }],
    }[kind];
    if (!keys) return; // xoay: ảnh đứng yên (mũi tên vòng đã tự nói lên cử chỉ)
    img.animate(keys, { duration: 900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  };
  const div = (cls, css) => Object.assign(document.createElement('div'), { className: cls, style: css });

  // Vẽ lại theo vị trí hiện tại của chỗ sáng (cảnh 3D / bảng còn trượt): chỉ dựng lại phần tử khi vị trí đổi, để vòng sáng không giật.
  const render = () => {
    const step = steps[index], box = rectOf(step.target()), tap = !!step.until;
    const label = (typeof step.text === 'function' ? step.text() : step.text) || '';
    if (text.textContent !== label) text.textContent = label;
    bubble.hidden = !label; // bước chỉ có hình: không bong bóng
    // bước thao tác mà không đo được chỗ sáng: chạm đâu cũng qua để khỏi kẹt (bước cử chỉ skippable: luôn cho qua)
    tappable = !(tap && !!box && !step.skippable);
    const rect = box && { x: Math.round(box.left - PAD), y: Math.round(box.top - PAD), width: Math.round(box.width + PAD * 2), height: Math.round(box.height + PAD * 2) };
    // Người nói (speaker, vd. mèo cam trong vườn): bong bóng lời thoại mọc từ nó, nó cũng được khoét sáng (không viền) để không chìm trong lớp mờ.
    // Khung người nói giữ cố định: cỡ đo một lần khi vào bước, chỉ dời theo khi tâm mèo trôi xa > 10 px (camera lướt), không co giãn
    // / rung theo dáng thở, quay đầu của mèo.
    const said = step.speaker && rectOf(step.speaker());
    let speaker = null;
    if (said) {
      const cx = said.left + said.width / 2, cy = said.top + said.height / 2;
      if (!speakerBox || speakerBox.index !== index) speakerBox = { index, w: Math.round(said.width + 12), h: Math.round(said.height + 12), cx, cy };
      else if (Math.hypot(cx - speakerBox.cx, cy - speakerBox.cy) > 10) Object.assign(speakerBox, { cx, cy });
      speaker = { x: Math.round(speakerBox.cx - speakerBox.w / 2), y: Math.round(speakerBox.cy - speakerBox.h / 2), width: speakerBox.w, height: speakerBox.h };
    }
    const key = `${index}|${rect ? Object.values(rect) : ''}|${speaker ? Object.values(speaker) : ''}`;
    if (key !== drawn) {
      drawn = key;
      holes.replaceChildren(...[rect, speaker].filter(Boolean).map(r => {
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
      drawGesture(step.gesture, r);
      hand.hidden = !(tap && r) || !!step.gesture;
      if (!hand.hidden) {
        const x = r.x + r.width / 2, y = r.y + r.height / 2, at = scale => `translate(${x}px, ${y}px) scale(${scale})`;
        hand.getAnimations().forEach(animation => animation.cancel());
        hand.animate([{ transform: at(1) }, { transform: at(.8), offset: .3 }, { transform: at(1), offset: .6 }, { transform: at(1) }], { duration: 1100, iterations: Infinity });
      }
    }
    // Bong bóng nằm phía đối diện chỗ được sáng (sáng ở nửa trên -> bóng xuống dưới, ngược lại), không có chỗ sáng thì giữa màn hình.
    if (bubble.hidden) return;
    const height = bubble.offsetHeight, view = innerHeight;
    // bubble: 'speech' = lời thoại của chính chỗ sáng (mèo): bóng sát ngay trên (hết chỗ thì dưới), canh ngang theo nó, đuôi chỉ vào nó.
    // Có speaker: bóng mọc từ speaker, chỗ sáng vẫn là nơi cần chạm.
    // Bóng lời thoại không được che chỗ sáng (nơi cần chạm): thử phía trên rồi phía dưới người nói, cả hai đều che thì về bóng thường.
    let speech = null;
    const anchor = speaker || (step.bubble === 'speech' ? rect : null);
    if (anchor) {
      const width = bubble.offsetWidth, mid = anchor.x + anchor.width / 2, gap = 18;
      const left = Math.max(8 + width / 2, Math.min(mid, innerWidth - 8 - width / 2));
      const covers = top => anchor !== rect && rect && top < rect.y + rect.height && top + height > rect.y && left - width / 2 < rect.x + rect.width && left + width / 2 > rect.x;
      const tops = [[anchor.y - height - gap, true], [anchor.y + anchor.height + gap, false]].filter(([top]) => top > 8 && top + height < view - 8);
      const pick = tops.find(([top]) => !covers(top));
      if (pick) speech = { top: pick[0], up: pick[1], left, tail: Math.round(mid - left + width / 2) };
    }
    bubble.classList.toggle('speech', !!speech);
    layer.classList.toggle('speaking', step.bubble === 'speech' && !!speech); // lời thoại thuần: không làm mờ / khoét sáng, chỉ bong bóng hiện cạnh mèo
    if (speech) {
      bubble.classList.toggle('tail-up', !speech.up);
      bubble.style.left = `${speech.left}px`;
      bubble.style.setProperty('--tail-x', `${speech.tail}px`);
      bubble.style.top = `${speech.top}px`;
      return;
    }
    bubble.style.left = '';
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
    layer.classList.toggle('speaking', steps[index].bubble === 'speech'); // khỏi nháy lớp mờ trước khi render
    layer.hidden = false;
    // Cảnh mới đổi (tab, bảng) cần một khung hình để đo đúng chỗ.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (mine !== token) return;
      render();
      if (bubble.classList.contains('speech')) // lời thoại bật ra từ đuôi (chỗ mèo)
        bubble.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.05)', offset: .7 }, { opacity: 1, transform: 'none' }],
          { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      else bubble.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
      poll = setInterval(() => {
        if (mine !== token) return stopPoll();
        render();
        if (steps[index].until?.()) { playSound('pick'); advance(); }
      }, POLL);
    }));
  };
  const finish = () => { token++; stopPoll(); running = null; layer.hidden = true; onDone?.(); };
  const advance = () => { stopPoll(); steps[index].after?.(); if (++index >= steps.length) finish(); else show(); };
  running = { render: () => { if (!layer.hidden) render(); }, advance, finish, tappable: () => !layer.hidden && tappable };
  show();
}
