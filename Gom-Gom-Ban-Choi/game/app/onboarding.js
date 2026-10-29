// ===== Onboarding người chơi mới: mỗi màn đầu mở khoá một phần của game =====
//   L1     chơi màn 1 (vào thẳng, tutorial không chữ, có hộp các-tông 2×2)  -> thắng: hộp mở, mèo cam ló ra, bảng thắng KHÔNG
//          có xu; Continue -> về Home, màn "You got a new box" (thùng 3D của Home hub), thùng bay vào tab Deco (chấm đỏ). Vào Deco:
//          thùng nằm giữa vườn, người chơi chạm thì thùng mở, mèo cam nhảy ra (petBoxes). Không ép vào Deco.
//   gifts  chơi tiếp màn 2…5. Thắng màn 2 và màn 3 mỗi màn được một hộp quà trong Deco (chấm đỏ tab Deco, menu/gift-boxes.js);
//          bảng thắng hiện "Unlocked: Gift box", Continue về Home và hộp bay vào tab Deco (không ép vào Deco).
//          Hộp mở ĐẦU TIÊN luôn là món đồ: bồn hoa (ITEM_GIFT; vườn người mới chưa có bồn hoa, menu/room.js startRoom) nhảy từ
//          hộp ra chỗ đặt + hướng dẫn đổi kiểu (KHÔNG nói Shop, panel Deco còn ẩn). Hộp THỨ HAI luôn là xu (coinGift: xu màn
//          1 + 2 + 3, bù cho các màn không trả xu) bay vào thanh xu; lúc đó mới mở panel Deco + thanh xu / gem, rồi hướng dẫn mua
//          Tree stump (nextBase: món gốc rẻ nhất chưa có). Chạm hộp nào cũng vậy.
//          Thắng màn 1–3 không cộng xu (màn 3 vẫn hiện dòng xu: số đó nằm trong hộp xu). Sau hộp xu mua được mọi món gốc.
//   done   thắng màn 5: mở Quest, Daily, quà 7 ngày, tab Shop (không có hướng dẫn) + mọi kiểu / tường / sàn.
// Hộp còn chờ = số màn đã thắng trong màn 2, 3 − số hộp đã mở (SAVE_KEYS.gifts), nên tắt game lúc hộp chưa mở thì mở lại vẫn còn.
// Hướng dẫn sau mỗi hộp xong thì ghi SAVE_KEYS.decoTour ('styles' sau hộp món, 'done' sau hộp xu); mở lại giữa chừng thì chạy lại.
// Save cũ (onboarding cũ): L1 -> L1; basics / build / L2 -> gifts, chưa mở hộp nào; cats / free -> gifts, coi như đã mở đủ 2 hộp
// (đã có xu, giữ nguyên đồ); decor / done / người chơi cũ không có bước -> done.
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';
import { loadProgress, levelReward } from '../core/progression.mjs';
import { CATALOG, isBase, isOwned, itemById, zoneState, slotOf } from '../deco/deco-data.mjs';

const OLD = { basics: 'gifts', build: 'gifts', L2: 'gifts', cats: 'gifts', free: 'gifts', decor: 'done' };
// Save cũ đã nhận xu qua các màn (không còn hộp nào để mở).
const PAID = new Set(['cats', 'free', 'decor', 'done']);
const GIFT_LEVELS = [1, 2], FEATURES_LEVEL = 4;
let current = null;

// Món gốc của vườn gốc còn phải trả xu mà chưa có, rẻ trước.
const gardenBases = deco => CATALOG.filter(entry => isBase(entry) && entry.zone === 'garden' && !entry.area && entry.price > 0 && !!deco && !isOwned(deco, entry))
  .sort((a, b) => a.price - b.price);
// Quà ở hộp món đồ: bồn hoa (món gốc miễn phí, người mới chưa được đặt sẵn). Save cũ đã có bồn hoa: món gốc rẻ nhất chưa có.
export const ITEM_GIFT = 'flowers';
export const giftPlaced = deco => zoneState(deco, 'garden').placed.some(id => slotOf(itemById(id) ?? { id }) === ITEM_GIFT);
export const itemGift = deco => (giftPlaced(deco) ? nextBase(deco) : itemById(ITEM_GIFT));
// Món dạy mua ở hộp xu: món gốc rẻ nhất chưa có (người mới: Tree stump).
export const nextBase = deco => gardenBases(deco)[0];
// Xu trong hộp: phần xu của màn 1 + 2 + 3, ít nhất đủ mua món dạy mua.
export const coinGift = deco => Math.max(levelReward(0) + levelReward(1) + levelReward(2), (nextBase(deco)?.price ?? 0) - (deco?.coins ?? 0));

export function stage() {
  if (current) return current;
  const raw = readText(SAVE_KEYS.onboarding), saved = OLD[raw] ?? raw;
  current = ['L1', 'gifts', 'done'].includes(saved) ? saved : loadProgress().stars.some(Boolean) ? 'done' : 'L1';
  // Người mới (chưa có bước, chưa qua màn nào — kể cả sau Dev: Reset còn sót khoá hộp cũ): chưa mở hộp nào.
  if (current === 'L1') writeText(SAVE_KEYS.gifts, '0');
  else if (readText(SAVE_KEYS.gifts) === null) {
    const paid = PAID.has(raw) || (raw === null && current === 'done');
    writeText(SAVE_KEYS.gifts, paid ? '2' : '0');
    // Đã có xu từ trước: không có hướng dẫn hộp nào để chạy (Shop / Decoration giờ không có hướng dẫn).
    if (paid) writeText(SAVE_KEYS.decoTour, 'done');
  }
  if (raw !== current) writeText(SAVE_KEYS.onboarding, current);
  return current;
}
// Chỉ cho test: đọc lại bước từ save (mô phỏng mở lại game).
export const reloadStage = () => { current = null; return stage(); };

export const opened = () => (stage(), Number(readText(SAVE_KEYS.gifts)) || 0);
const won = index => !!loadProgress().stars[index];
// Hộp quà đang chờ trong Deco.
export const giftsWaiting = () => Math.max(0, GIFT_LEVELS.filter(won).length - opened());
// Mở một hộp: hộp đầu là 'item', hộp hai là 'coins' (lưu ngay). Không còn hộp thì null.
export function openGift() {
  if (!giftsWaiting()) return null;
  const kind = opened() === 0 ? 'item' : 'coins';
  writeText(SAVE_KEYS.gifts, String(opened() + 1));
  return kind; // class trên body đổi khi người gọi diễn xong (applyClasses): thanh xu hiện đúng lúc xu bay tới
}
// Hướng dẫn còn dở sau khi đã mở hộp (tắt game giữa chừng): 'item' | 'coins' | null.
export function tourPending() {
  const tour = readText(SAVE_KEYS.decoTour);
  if (tour === 'done') return null;
  if (opened() >= 2) return 'coins';
  return opened() === 1 && tour !== 'styles' ? 'item' : null;
}

export const active = () => stage() !== 'done';
// Thùng thú cưng chờ mở trong Deco (menu/gift-boxes.js): giống mèo / chó vừa nhận nằm trong thùng các-tông tới khi người chơi
// chạm mở. Thắng màn 1: mèo cam; mốc nhận mèo / chó ở Map (menu/map-view.js). Còn thùng thì tab Deco có chấm đỏ.
export function petBoxes() {
  try { return JSON.parse(readText(SAVE_KEYS.petBoxes) || '[]'); } catch { return []; }
}
export const addPetBox = breed => { if (!petBoxes().includes(breed)) writeText(SAVE_KEYS.petBoxes, JSON.stringify([...petBoxes(), breed])); };
// Mèo cam ra khỏi thùng lần đầu: dấu "!" trên đầu, chạm thì nó than vườn trống và rủ chủ chơi tiếp (menu/tours.js runCatTalk).
export const catTalkWaiting = () => readText(SAVE_KEYS.catTalk) === 'wait';
export function catOutOfBox(breed) { if (breed === 'orange' && readText(SAVE_KEYS.catTalk) === null) writeText(SAVE_KEYS.catTalk, 'wait'); }
export const catTalkDone = () => writeText(SAVE_KEYS.catTalk, 'done');
export const removePetBox = breed => writeText(SAVE_KEYS.petBoxes, JSON.stringify(petBoxes().filter(other => other !== breed)));
// Thắng màn 5 mà chưa mở hộp xu: vẫn hiện ví (màn 4–5 đã cộng xu thật).
export const walletShown = () => featuresOpen() || opened() >= 2;
export const featuresOpen = () => stage() === 'done';
// Tab nào đã mở: Deco sau màn 1, Shop sau màn 5.
export const tabOpen = tab => tab === 'home' || (tab === 'deco' && stage() !== 'L1') || (tab === 'shop' && featuresOpen());
// Được chạm / mua món này trong Deco chưa: sau màn 5 mọi thứ; có hộp món đồ thì đổi được kiểu đã có; có hộp xu thì mua được món gốc.
export const buildOpen = (entry, deco) => featuresOpen() || (!!entry && ((opened() >= 1 && !!deco && isOwned(deco, entry)) || (opened() >= 2 && isBase(entry))));
// Màn 1–3 trong onboarding: xu thưởng dồn vào hộp xu, không cộng lúc thắng.
export const coinsDeferred = levelIndex => active() && levelIndex <= GIFT_LEVELS.at(-1) && opened() < 2;

// Thắng màn `levelIndex` (first = lần thắng đầu): trả về thứ vừa mở ('cat' | 'gift' | 'features') để bảng kết quả hiện "Unlocked:"
// + Continue về Home (result.js -> tours.js runOnboarding), không thì null.
export function unlockOnWin(levelIndex, first = true) {
  if (stage() === 'L1' && levelIndex === 0) { addPetBox('orange'); setStage('gifts'); return 'cat'; }
  if (stage() === 'gifts' && first && GIFT_LEVELS.includes(levelIndex) && opened() < 2) return 'gift';
  if (stage() === 'gifts' && levelIndex === FEATURES_LEVEL) { setStage('done'); return 'features'; }
  return null;
}
export function setStage(next) {
  current = next;
  writeText(SAVE_KEYS.onboarding, next);
  applyClasses();
}
// Class trên body để CSS ẩn phần chưa mở (ui/shared/wallet.css, ui/home, ui/deco).
export function applyClasses() {
  const body = globalThis.document?.body;
  if (!body) return;
  body.classList.toggle('onboarding', active());
  body.classList.toggle('ob-no-build', !featuresOpen() && opened() < 2);
  body.classList.toggle('ob-no-panel', !featuresOpen() && opened() < 2);
  body.classList.toggle('ob-no-wallet', !walletShown());
  body.classList.toggle('ob-no-features', !featuresOpen());
}
applyClasses();
