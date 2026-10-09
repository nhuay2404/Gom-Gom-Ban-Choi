// ===== Onboarding người chơi mới: một dãy bước, mỗi bước mở khoá một phần của game =====
//   L1     chơi màn 1                                  -> thắng: mở Garden (Deco)
//   basics hướng dẫn Deco: kéo, chụm zoom, xoay        -> xong vào thẳng màn 2
//   L2     chơi màn 2                                  -> thắng: vào thẳng màn 3 (không còn bước mèo)
//   free   chơi màn 3, 4 bình thường, màn 5            -> thắng màn 5: mở Decoration (mua đồ, đổi kiểu, Shop)
//          Mèo đầu tiên nhận ở Map bằng nút Claim sau khi thắng màn 3 (menu-controller.js mapLevels), có chấm đỏ ở tab Home.
//   decor  hướng dẫn mua đồ / đổi kiểu / Shop          -> xong là hết onboarding
//   done   người chơi cũ (đã có sao) hoặc đã xong onboarding
// Bước được lưu ngay lúc thắng màn mở khoá, nên tắt game giữa chừng thì mở lại vẫn tiếp tục đúng chỗ (main.js).
import { SAVE_KEYS, readText, writeText } from '../gameplay/save.mjs';
import { loadProgress } from '../gameplay/progression.mjs';

const STAGES = ['L1', 'basics', 'L2', 'free', 'decor', 'done'];
const UNLOCK_AT = { L1: { level: 0, kind: 'garden', next: 'basics' }, L2: { level: 1, kind: null, next: 'free' }, free: { level: 4, kind: 'decor', next: 'decor' } };
const at = name => STAGES.indexOf(name);
let current = null;

export function stage() {
  if (current) return current;
  const saved = readText(SAVE_KEYS.onboarding) === 'cats' ? 'free' : readText(SAVE_KEYS.onboarding); // save cũ đang ở bước mèo (đã bỏ)
  current = STAGES.includes(saved) ? saved : loadProgress().stars.some(Boolean) ? 'done' : 'L1';
  return current;
}
export function setStage(next) {
  current = next;
  writeText(SAVE_KEYS.onboarding, next);
  document.body.classList.toggle('onboarding', next !== 'done');
  document.body.classList.toggle('ob-no-build', at(next) < at('decor'));
}
export const active = () => stage() !== 'done';
// Mua / đổi đồ trang trí chỉ mở từ hướng dẫn Decoration (thắng màn 5); trước đó (kể cả sau hướng dẫn Garden) chỉ ngắm vườn.
export const buildOpen = () => at(stage()) >= at('decor');
// Tab nào đã mở: Deco sau màn 1, Shop khi tới phần hướng dẫn Decoration.
export const tabOpen = tab => tab === 'home' || (tab === 'deco' && at(stage()) >= at('basics')) || (tab === 'shop' && at(stage()) >= at('decor'));
// Chờ làm tiếp ngay khi vào game (đã thắng màn mở khoá nhưng chưa xem xong hướng dẫn).
export const pending = () => ['basics', 'decor'].includes(stage());

// Thắng màn `levelIndex`: trả về thứ vừa mở ('garden' | 'cats' | 'decor') và chuyển sang bước hướng dẫn tương ứng, không thì null.
export function unlockOnWin(levelIndex) {
  // Màn 5 luôn mở Decoration nếu người chơi chưa xem hướng dẫn đó (kể cả save cũ / đi lệch các bước trước).
  if (levelIndex === UNLOCK_AT.free.level && stage() !== 'decor' && readText(SAVE_KEYS.decoTour) !== 'done') { setStage('decor'); return 'decor'; }
  const rule = UNLOCK_AT[stage()];
  if (!rule || rule.level !== levelIndex) return null;
  setStage(rule.next);
  return rule.kind;
}
setStage(stage());

// Theo dõi cử chỉ trên khung cảnh 3D: kéo một ngón, chụm / lăn chuột (zoom), vặn hai ngón / kéo chuột phải (xoay).
export function watchGestures(element) {
  const done = { drag: false, zoom: false, twist: false }, pointers = new Map();
  let startGap = 0, startAngle = 0, origin = null;
  const pair = () => { const [a, b] = [...pointers.values()]; return { gap: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) }; };
  const down = event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) origin = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) { ({ gap: startGap, angle: startAngle } = pair()); origin = null; }
  };
  const move = event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1 && origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 40) {
      // Chuột: kéo chuột phải = xoay khu nhà (deco-room.mjs mouseButtons.RIGHT); kéo chuột trái / một ngón = di chuyển.
      if (event.pointerType === 'mouse' && event.buttons & 2) done.twist = true;
      else done.drag = true;
    }
    if (pointers.size === 2) {
      const { gap, angle } = pair();
      if (Math.abs(gap - startGap) > 36) done.zoom = true;
      const turn = Math.abs(((angle - startAngle) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      if (turn > .15) done.twist = true;
    }
  };
  const up = event => { pointers.delete(event.pointerId); origin = null; };
  const wheel = () => { done.zoom = true; };
  element.addEventListener('pointerdown', down, true);
  element.addEventListener('pointermove', move, true);
  element.addEventListener('pointerup', up, true);
  element.addEventListener('pointercancel', up, true);
  element.addEventListener('wheel', wheel, { capture: true, passive: true });
  return { done, stop() {
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type, i) => element.removeEventListener(type, [down, move, up, up][i], true));
    element.removeEventListener('wheel', wheel, true);
  } };
}
