// Hướng dẫn trong Deco (deco-tour.js) + onboarding sau các màn mở khoá / hộp quà (onboarding.js). Sang Unity: TourController.
import * as ob from '../app/onboarding.js';
import { playSound } from '../ui/sound.mjs';
import { SAVE_KEYS, writeText } from '../core/save.mjs';
import { ZONES, isOwned, slotOf } from '../deco/deco-data.mjs';
import { startDecoTour, waitFor } from '../app/deco-tour.js';
import { $, getDeco, setDeco } from '../app/shared.js';
import { renderZoneSwitch } from './areas.js';
import { setDecoLock, closeDecoPop, clearDecoPick, renderDeco, decoPick, setDecoTab, clearPreview, refreshDecoDot, setTourHold } from './deco-panel.js';
import { guideRect, setGuide, applyRoom, room3d } from './room.js';
import { switchTab } from './tabs.js';
import { setShopPage } from './shop.js';
import { flyArt } from './reward-fly.js';
import { showBoxReward } from './map-view.js';
import { GIFT_BOX_SVG, BOX_ART } from '../ui/gift-box-art.mjs';

// Mèo cam ngồi trong vườn, mọi lời hướng dẫn là bong bóng thoại mọc từ nó (speaker); mèo khuất (Shop) thì bóng thường.
// Giọng: mèo cam là một thành viên của bầy mèo, gọi người chơi là "Owner" (người nuôi cả bầy), nói "our home / our garden / the crew".
const say = steps => steps.map(step => (step.text ? { speaker: guideRect, ...step } : step));

// Kết hướng dẫn Deco (nút "?"): ảnh cả ngôi nhà khi đã xây đủ món gốc mọi phòng (không có mẫu giáo) để người chơi có cái mong chờ.
// Ảnh chụp từ cảnh thật (đủ món gốc, ban ngày); đổi đồ gốc / thêm phòng thì chụp lại. Đường dẫn viết đủ để build:html nhúng được.
const dreamHome = {
  target: () => null, image: './assets/img/tutorial/house-complete.webp',
  text: 'Meow! This is the home our whole crew dreams of! Fill every spot in every room, Owner, and ours will look just like it. Win levels for coins!',
};

// ---------- Hướng dẫn Deco đọc lại (nút "?" ở cột trái, chỉ hiện khi đã xong onboarding): chỉ các bước đọc, không tặng gì ----------
export function runDecoTour() {
  const names = () => ZONES[getDeco().zone].cats;
  setDecoLock(false);
  closeDecoPop(false);
  setDecoTab('furniture');
  clearPreview();
  const middle = () => {
    const r = $('deco-room').getBoundingClientRect();
    return { left: r.left + r.width * .12, top: r.top + r.height * .22, width: r.width * .76, height: r.height * .4 };
  };
  setGuide(true);
  startDecoTour([...say([
    { target: () => $('deco-cards').hidden ? $('deco').querySelector('.deco-dock') : $('deco-cards'),
      text: 'Swipe the tray and tap something to see it in our home, Owner. Tap Buy and it’s ours!' },
    { target: () => $('deco-kinds'), before: () => closeDecoPop(false),
      text: () => `${names().walls} and ${names().floors} come in other styles too! Tap a type here, try a style, then buy it for us.` },
    { target: middle, text: 'Tap anything in our home to swap its style. A NEW tag means a style you got us is waiting!' },
    { target: () => $('tabbar').querySelector('[data-tab="shop"]'), before: () => closeDecoPop(false),
      text: 'The Shop has even more styles for us. Come look, Owner!', next: 'Open Shop', after: () => { if ($('shop').hidden) switchTab('shop'); } },
    { target: () => [$('shop-pages'), $('shop-deco-grid')], before: async () => { await waitFor(() => !$('shop').hidden); setShopPage('deco'); },
      text: 'Pick an area, tap a style to try it, then buy. Back home in Deco, tap the item to put it out for us.' },
  ]), dreamHome], () => setGuide(false));
}

// Mèo cam vừa ra khỏi thùng lần đầu có dấu "!" trên đầu (gift-boxes.js); chạm vào thì nó than vườn còn trống, rủ chủ chơi tiếp.
export function runCatTalk() {
  setGuide(true);
  startDecoTour(say([
    { target: () => null, next: 'Okay!',
      text: 'Mrrow… it’s so empty out here. Nothing to climb, nothing to nap on! Owner, keep playing levels so we can fill our home with cozy things!' },
  ]), () => { setGuide(false); ob.catTalkDone(); room3d?.markCat(null); });
}

$('deco-help').onclick = () => { playSound('pick'); runDecoTour(); };

// Đưa thẻ món vào khay rồi mới sáng: offsetLeft đo theo offsetParent (không phải khay) nên lệch; đo bằng rect để thẻ nằm gọn trong khay.
async function scrollToCard(el) {
  const tray = $('deco-cards');
  if (!el) return;
  tray.style.scrollBehavior = 'auto';
  tray.scrollLeft += el.getBoundingClientRect().left - tray.getBoundingClientRect().left - 12;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// Hướng dẫn chạy ở vườn: về khu vườn, bỏ món đang xem / bảng đang mở.
function prepareGarden() {
  setDecoLock(false);
  closeDecoPop(false);
  setDecoTab('furniture');
  clearPreview();
  clearDecoPick();
  if (getDeco().zone !== 'garden') { setDeco({ ...getDeco(), zone: 'garden' }); applyRoom(getDeco()); renderZoneSwitch(); }
  renderDeco();
}

// ---------- Hộp món đồ (hộp mở đầu tiên, bồn hoa): chỉ khoe món vừa nhận. Chưa đổi kiểu (chạm món chưa mở bảng đổi món,
// deco-panel.js onScenePick), không nói Shop, panel Deco còn ẩn — kiểu khác của bồn hoa được báo NEW ở hộp xu (gift-boxes.js). ----------
export function runItemTour(base) {
  prepareGarden();
  const slot = slotOf(base);
  setGuide(true, slot);
  startDecoTour(say([
    { target: () => room3d?.screenRectOf(slot), bubble: 'below', next: 'Yay!', before: () => new Promise(resolve => setTimeout(resolve, 600)),
      text: `A gift for our garden: a ${base.name}! The crew loves it already. Win more levels, Owner, and there’ll be another gift!` },
  ]), () => { setGuide(false); writeText(SAVE_KEYS.decoTour, 'styles'); renderDeco(); });
}

// ---------- Hộp xu (hộp mở thứ hai): dạy mua một món gốc vừa đủ tiền rồi đặt. KHÔNG mở / nói Shop ----------
export function runBuyTour(base) {
  prepareGarden();
  if (!base) return writeText(SAVE_KEYS.decoTour, 'done');
  const card = () => $('deco-cards').querySelector(`[data-id="${base.id}"]`);
  setGuide(true);
  setTourHold(true); // mở lại thanh đồ nếu đang thu gọn; trong lúc hướng dẫn: không thu gọn được, chạm lại thẻ đang xem không bỏ xem
  // Bong bóng thường (không mọc từ mèo): panel Deco vừa mở, mèo trong vườn có thể nằm sau panel, khoét sáng chỗ mèo sẽ đè lên panel.
  const plain = { speaker: () => null };
  startDecoTour(say([
    { ...plain, strict: true, target: card, text: `You have coins now, Owner! Tap the ${base.name} so we can see it in our garden.`, until: () => decoPick === base, before: () => scrollToCard(card()) },
    { ...plain, strict: true, target: () => card()?.querySelector('[data-act="buy"]'), until: () => isOwned(getDeco(), base), text: 'Tap Buy and build it for us!',
      // Lỡ chạm cảnh làm bỏ xem món: chọn lại để thẻ còn nút Buy.
      before: async () => { if (decoPick !== base) card()?.click(); await scrollToCard(card()); } },
    { ...plain, target: () => null, next: 'Got it!', before: () => new Promise(resolve => setTimeout(resolve, 900)),
      text: `Purrfect, we love the new ${base.name}! Keep winning levels for coins, Owner, and one day our home will look like this!` },
    // Kết: ảnh cả ngôi nhà đủ món (dreamHome) cho người chơi thấy cái đích để xây.
    { ...plain, ...dreamHome, next: 'Let’s go!' },
  ]), () => { setGuide(false); setTourHold(false); writeText(SAVE_KEYS.decoTour, 'done'); refreshDecoDot(); });
}

// Bảng kết quả bấm Continue sau màn mở khoá (result.js): về Home. Màn 1: thùng mèo / màn 2–3: hộp quà bay vào tab Deco (chấm đỏ ở đó).
export async function runOnboarding(unlock) {
  await switchTab('home');
  refreshDecoDot();
  const tab = $('tabbar').querySelector('[data-tab="deco"]');
  // Màn 1: màn "You got a new box" (thùng các-tông 3D của Home hub), chạm thì thùng bay vào tab Deco — mở Deco là thùng mở ra, mèo
  // cam nhảy ra (gift-boxes.js enterDeco).
  if (unlock === 'cat' || unlock === 'pet') await flyArt(await showBoxReward(), BOX_ART, tab);
  if (unlock === 'gift') {
    const size = 120, from = { left: innerWidth / 2 - size / 2, top: innerHeight / 2 - size / 2, width: size, height: size };
    await flyArt(from, GIFT_BOX_SVG, tab);
  }
  refreshDecoDot();
}
