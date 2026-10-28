// ===== Onboarding người chơi mới: một dãy bước, mỗi bước mở khoá một phần của game =====
// Vòng đầu "chơi -> được xu -> xây" khép kín ngay sau màn 1:
//   L1     chơi màn 1 (vào thẳng, tutorial không chữ)  -> thắng: mở Garden (Deco), sang build
//   build  hướng dẫn xây món đầu tiên (menu/tours.js runBuildTour): chạm Deco -> chạm thẻ món gốc rẻ nhất của vườn
//          (firstBuild) -> gợi ý chụm / kéo camera tới chỗ đặt (không bắt buộc) -> Buy (thiếu xu thì bù đủ giá,
//          economy.mjs TUTORIAL_TOP_UP) -> nút "Play Level 2" vào thẳng màn 2. Chỉ mua được đúng món đó.
//   L2     chơi màn 2                                  -> thắng: bảng kết quả có Next sang màn 3
//   free   chơi màn 3, 4 bình thường, màn 5            -> thắng màn 5: mở phần nâng cao (mua món khác, đổi kiểu, Shop)
//          Mèo thưởng nhận ở Map bằng nút Claim (màn 7, 10…, deco-data.mjs catRewardsAt), có chấm đỏ ở tab Home.
//   decor  hướng dẫn đổi kiểu / tường rào / Shop       -> xong là hết onboarding
//   done   người chơi cũ (đã có sao) hoặc đã xong onboarding
// Bước được lưu ngay lúc thắng màn mở khoá, nên tắt game giữa chừng thì mở lại vẫn tiếp tục đúng chỗ (main.js); món đã xây
// ở bước build là món gốc đã mua thật (tính vào luật mở khu), mở lại sau khi đã mua thì chỉ còn nút "Play Level 2".
// Save cũ: 'cats' (bước mèo, đã bỏ) -> free; 'basics' (hướng dẫn cử chỉ camera, đã thay bằng build) -> build.
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';
import { loadProgress } from '../core/progression.mjs';
import { CATALOG, isBase } from '../deco/deco-data.mjs';

const STAGES = ['L1', 'build', 'L2', 'free', 'decor', 'done'];
const OLD = { cats: 'free', basics: 'build' };
const UNLOCK_AT = { L1: { level: 0, kind: 'garden', next: 'build' }, L2: { level: 1, kind: null, next: 'free' }, free: { level: 4, kind: 'decor', next: 'decor' } };
const at = name => STAGES.indexOf(name);
let current = null;

// Món xây đầu tiên ở bước build: món gốc (chỗ đặt) rẻ nhất của vườn gốc mà phải trả xu.
export const firstBuild = () => CATALOG.filter(entry => isBase(entry) && entry.zone === 'garden' && !entry.area && entry.price > 0)
  .sort((a, b) => a.price - b.price)[0];

export function stage() {
  if (current) return current;
  const raw = readText(SAVE_KEYS.onboarding), saved = OLD[raw] ?? raw;
  current = STAGES.includes(saved) ? saved : loadProgress().stars.some(Boolean) ? 'done' : 'L1';
  return current;
}
// Chỉ cho test: đọc lại bước từ save (mô phỏng mở lại game).
export const reloadStage = () => { current = null; return stage(); };
export function setStage(next) {
  current = next;
  writeText(SAVE_KEYS.onboarding, next);
  globalThis.document?.body.classList.toggle('onboarding', next !== 'done');
  globalThis.document?.body.classList.toggle('ob-no-build', at(next) < at('decor') && next !== 'build');
}
export const active = () => stage() !== 'done';
// Mua / đổi đồ: từ hướng dẫn Decoration (thắng màn 5) mở hết; ở bước build chỉ mua được đúng món đầu tiên (firstBuild).
export const buildOpen = entry => at(stage()) >= at('decor') || (stage() === 'build' && !!entry && entry.id === firstBuild()?.id);
// Tab nào đã mở: Deco sau màn 1, Shop khi tới phần hướng dẫn Decoration.
export const tabOpen = tab => tab === 'home' || (tab === 'deco' && at(stage()) >= at('build')) || (tab === 'shop' && at(stage()) >= at('decor'));
// Chờ làm tiếp ngay khi vào game (đã thắng màn mở khoá nhưng chưa xem xong hướng dẫn).
export const pending = () => ['build', 'decor'].includes(stage());

// Thắng màn `levelIndex`: trả về thứ vừa mở ('garden' | 'decor') và chuyển sang bước hướng dẫn tương ứng, không thì null.
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
