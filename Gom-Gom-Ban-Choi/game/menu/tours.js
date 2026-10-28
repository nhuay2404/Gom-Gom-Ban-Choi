// Hướng dẫn trong Deco (deco-tour.js) + onboarding sau các màn mở khoá (onboarding.js). Sang Unity: TourController.
import * as ob from '../app/onboarding.js';
import { TUTORIAL_TOP_UP } from '../data/economy.mjs';
import { playSound } from '../ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';
import { ZONES, CATALOG, itemStatus, isOwned, slotOf } from '../deco/deco-data.mjs';
import { startDecoTour, waitFor } from '../app/deco-tour.js';
import { $, getDeco, setDeco, refreshWallet } from '../app/shared.js';
import { decoUnlockedLevel, renderZoneSwitch } from './areas.js';
import { decoBases, decoVisible, setDecoLock, closeDecoPop, clearDecoPick, renderDeco, decoPick, decoPop, setDecoTab, clearPreview } from './deco-panel.js';
import { guideRect, setGuide, applyRoom, room3d } from './room.js';
import { switchTab } from './tabs.js';
import { play } from './context.js';
import { setShopPage } from './shop.js';

// ---------- Hướng dẫn Deco (deco-tour.js): lần đầu vào Deco tự chạy, nút "?" ở cột trái chạy lại ----------
// Lần đầu (vườn còn món chưa xây + món đó có kiểu thay thế): người chơi thao tác THẬT — chạm thẻ, Buy, chạm món trong nhà, đổi
// kiểu, chạm tab Shop / Decoration. Để làm được: bù xu đủ mua món rẻ nhất, mua xong tặng một kiểu thay thế (kèm ghim NEW).
// Người chơi mới đã xây món đầu tiên ở onboarding (bước build): bỏ hai bước chạm thẻ / Buy, tặng kiểu thay thế cho chính món đó.
// Chạy lại từ nút "?" (hoặc không có gì để xây): chỉ các bước đọc, không tặng gì.
const tourDone = () => {
  writeText(SAVE_KEYS.decoTour, 'done');
  if (ob.stage() === 'decor') ob.setStage('done'); // hết hướng dẫn Decoration = hết onboarding
};

function guidedTourPlan() {
  const deco = getDeco(), unlocked = decoUnlockedLevel(), first = ob.firstBuild();
  const variantOf = base => CATALOG.find(entry => entry.slot === base.id && decoVisible(entry) && !(entry.lock && unlocked < entry.lock) && !isOwned(deco, entry));
  if (first && isOwned(deco, first) && variantOf(first)) return { base: first, variant: variantOf(first), built: true };
  const bases = decoBases('garden').filter(base => !isOwned(deco, base) && base.price > 0 && itemStatus(deco, base, unlocked) !== 'locked').sort((a, b) => a.price - b.price);
  for (const base of bases) {
    const variant = CATALOG.find(entry => entry.slot === base.id && decoVisible(entry) && !(entry.lock && unlocked < entry.lock));
    if (variant) return { base, variant };
  }
  return null;
}

// Kết hướng dẫn Deco (sau bước Decoration trong Shop): ảnh cả ngôi nhà khi đã xây đủ món gốc mọi phòng (không có mẫu giáo) để người chơi có cái mong chờ.
// Ảnh chụp từ cảnh thật (đủ món gốc, ban ngày); đổi đồ gốc / thêm phòng thì chụp lại. Đường dẫn viết đủ để build:html nhúng được.
const dreamHome = {
  target: () => null, image: './assets/img/tutorial/house-complete.webp',
  text: 'This is your dream home! Build every spot in each room to make it just like this. Win levels to earn coins. Have fun!',
};

export function runDecoTour() {
  const names = () => ZONES[getDeco().zone].cats;
  const plan = readText(SAVE_KEYS.decoTour) !== 'done' && guidedTourPlan();
  setDecoLock(false);
  closeDecoPop(false);
  setDecoTab('furniture');
  clearPreview();
  // Như hướng dẫn Garden: mèo cam ngồi trong vườn, mọi lời hướng dẫn là bong bóng thoại mọc từ nó (speaker); mèo khuất (Shop) thì bóng thường.
  const say = steps => steps.map(step => (step.text ? { speaker: guideRect, ...step } : step));
  const done = () => { setGuide(false); tourDone(); };
  const fencesStep = {
    target: () => $('deco-kinds'),
    text: () => `${names().walls} and ${names().floors} come in other styles too. Tap a type here, preview a style, then buy it.`,
    before: () => closeDecoPop(false),
  };
  const shopTab = { target: () => $('tabbar').querySelector('[data-tab="shop"]'), before: () => closeDecoPop(false) };
  if (!plan) {
    const middle = () => {
      const r = $('deco-room').getBoundingClientRect();
      return { left: r.left + r.width * .12, top: r.top + r.height * .22, width: r.width * .76, height: r.height * .4 };
    };
    setGuide(true);
    return startDecoTour([...say([
      { target: () => $('deco-cards').hidden ? $('deco').querySelector('.deco-dock') : $('deco-cards'),
        text: 'Swipe the tray and tap an item to preview it in your home. Tap Buy to build it!' },
      fencesStep,
      { target: middle, text: 'Tap any item in your home to swap its style. A NEW tag means a style you bought is waiting!' },
      { ...shopTab, text: 'More styles for every item live in the Shop. Let\u2019s take a look!', next: 'Open Shop',
        after: () => { if ($('shop').hidden) switchTab('shop'); } },
      { target: () => [$('shop-pages'), $('shop-deco-grid')], before: async () => { await waitFor(() => !$('shop').hidden); setShopPage('deco'); },
        text: 'Decoration: pick an area, tap a style to preview it, then buy. Back in Deco, tap the item to use it.' },
    ]), dreamHome], done);
  }
  const { base, variant } = plan, slot = slotOf(base);
  const card = () => $('deco-cards').querySelector(`[data-id="${base.id}"]`);
  const deco = getDeco();
  if (deco.zone !== 'garden') { setDeco({ ...deco, zone: 'garden' }); applyRoom(getDeco()); renderZoneSwitch(); }
  const toppedUp = !plan.built && TUTORIAL_TOP_UP && getDeco().coins < base.price;
  if (toppedUp) { setDeco({ ...getDeco(), coins: base.price }); refreshWallet(); }
  clearDecoPick();
  renderDeco();
  const gift = () => {
    const current = getDeco(), zone = current.zones.garden;
    if (zone.owned.includes(variant.id)) return;
    setDeco({ ...current, zones: { ...current.zones, garden: { ...zone, owned: [...zone.owned, variant.id] } }, fresh: [...(current.fresh || []), variant.id] });
    renderDeco();
  };
  setGuide(true, slot);
  if (plan.built) gift();
  const buySteps = plan.built ? [] : [
    { target: card, text: `Tap ${base.name} to see how it looks in your home.`, until: () => decoPick === base, before: () => scrollToCard(card()) },
    { target: () => card()?.querySelector('[data-act="buy"]'), text: `Love it? Tap Buy to build it.${toppedUp ? ' We topped up your coins!' : ''}`, until: () => isOwned(getDeco(), base), after: gift },
  ];
  startDecoTour([...say([
    ...buySteps,
    { target: () => room3d?.screenRectOf(slot), bubble: 'below', until: () => decoPop?.key === slot,
      text: plan.built ? `Remember your ${base.name}? Tap it to swap its style. We gave you a new one.` : `${base.name} is built! Tap it to swap its style. We gave you a new one.`,
      before: () => new Promise(resolve => setTimeout(resolve, plan.built ? 300 : 1100)) },
    { target: () => $('deco-pop-items').querySelector(`[data-id="${variant.id}"]`), bubble: 'below', until: () => getDeco().zones.garden.placed.includes(variant.id),
      text: `Tap ${variant.name} to use it instead.`, before: () => waitFor(() => $('deco-pop-items').querySelector(`[data-id="${variant.id}"]`)) },
    fencesStep,
    { ...shopTab, text: 'More styles for every item live in the Shop. Open it!', until: () => !$('shop').hidden },
    { target: () => $('shop-pages').querySelector('[data-page="deco"]'), text: 'Tap Decoration.', until: () => $('shop').dataset.page === 'deco',
      before: () => waitFor(() => !$('shop').hidden) },
    { target: () => [$('shop-pages'), $('shop-deco-grid')], text: 'Pick an area, tap a style to preview it, then buy. Back in Deco, tap the item to use it.' },
  ]), dreamHome], done);
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

// ---------- Onboarding (onboarding.js) bước build: xây món đầu tiên ngay sau màn 1, rồi vào thẳng màn 2 ----------
// Vùng giữa cảnh 3D: chỗ sáng cho gợi ý cử chỉ (chụm / kéo), chừa hàng ví và thanh tab.
const roomArea = () => {
  const r = $('deco-room').getBoundingClientRect();
  return { left: r.left + r.width * .04, top: r.top + r.height * .14, width: r.width * .92, height: r.height * .5 };
};

function runBuildTour() {
  const base = ob.firstBuild(), slot = slotOf(base), say = steps => steps.map(step => (step.text ? { speaker: guideRect, ...step } : step));
  const card = () => $('deco-cards').querySelector(`[data-id="${base.id}"]`);
  const watch = ob.watchGestures($('deco-room'));
  setDecoLock(false);
  closeDecoPop(false);
  setDecoTab('furniture');
  clearPreview();
  if (getDeco().zone !== 'garden') { setDeco({ ...getDeco(), zone: 'garden' }); applyRoom(getDeco()); renderZoneSwitch(); }
  // Xu thắng màn 1 chưa đủ món đầu tiên: bù đủ giá (quà hướng dẫn, economy.mjs TUTORIAL_TOP_UP). Mở lại giữa chừng thì không bù thêm.
  const toppedUp = TUTORIAL_TOP_UP && !isOwned(getDeco(), base) && getDeco().coins < base.price;
  if (toppedUp) { setDeco({ ...getDeco(), coins: base.price }); refreshWallet(); }
  clearDecoPick();
  renderDeco();
  setGuide(true, slot);
  const tapDeco = { target: () => $('tabbar').querySelector('[data-tab="deco"]'), gesture: 'tap', bubble: 'above', until: () => !$('deco').hidden,
    text: 'Your garden is unlocked! Tap Deco to go visit it.' };
  const inDeco = async () => { await waitFor(() => !$('deco').hidden); setGuide(true, slot); await new Promise(resolve => setTimeout(resolve, 250)); };
  const built = { target: () => null, bubble: 'speech', next: 'Play Level 2',
    text: `Your cat loves the new ${base.name}! Win levels to earn coins and build more.`,
    before: async () => { await inDeco(); await new Promise(resolve => setTimeout(resolve, 900)); } };
  const steps = isOwned(getDeco(), base) ? [tapDeco, built] : [
    tapDeco,
    { target: () => null, bubble: 'speech', next: 'Let\u2019s build!', before: inDeco,
      text: `Welcome to your garden! Let's build a ${base.name} for your cat.` },
    { target: card, text: `Tap ${base.name} to see it in your garden.`, until: () => decoPick === base, before: () => scrollToCard(card()) },
    // Dạy cử chỉ camera ngay trong mục tiêu: chụm / kéo tới chỗ đặt món đang xem; không bắt buộc (chạm là qua).
    { target: roomArea, gesture: 'pinch', skippable: true, until: () => watch.done.zoom || watch.done.drag,
      text: 'Pinch to zoom in on the spot, or drag to look around.', before: () => { watch.done.zoom = watch.done.drag = false; } },
    { target: () => card()?.querySelector('[data-act="buy"]'), until: () => isOwned(getDeco(), base),
      text: `Tap Buy to build it!${toppedUp ? ' We topped up your coins.' : ''}`,
      // Lỡ chạm cảnh làm bỏ xem món: chọn lại để thẻ còn nút Buy; camera quay về chỗ đặt (bước kéo / chụm có thể đã đưa đi xa).
      before: async () => { if (decoPick !== base) card()?.click(); else room3d?.focus(base.id); await scrollToCard(card()); } },
    built,
  ];
  // Xong (bấm "Play Level 2" hoặc chạm bong bóng): sang bước L2 rồi vào thẳng màn 2, không về Home.
  startDecoTour(say(steps), () => { watch.stop(); setGuide(false); ob.setStage('L2'); play.startLevel(1); });
}

// Chạy bước hướng dẫn đang chờ (gọi từ bảng kết quả bấm Continue, hoặc lúc mở game nếu đang dở).
export async function runOnboarding() {
  const stage = ob.stage();
  if (!ob.pending()) return;
  // Chặn mọi cú chạm từ lúc chuyển tab tới khi lớp hướng dẫn hiện: trước đây khoảng chờ này (màn loading + 600 ms + lúc vẽ bước đầu)
  // để hở bản đồ / nút PLAY ở Home, chạm vào là vào thẳng màn 2 thay vì đi hướng dẫn Deco.
  const shield = Object.assign(document.createElement('div'), { className: 'tour-shield' });
  shield.style.cssText = 'position:fixed;inset:0;z-index:2147483000';
  document.body.append(shield);
  try {
    await switchTab(stage === 'build' ? 'home' : 'deco'); // hướng dẫn xây món đầu tiên bắt đầu từ Home hub: chỉ vào nút Deco
    await new Promise(resolve => setTimeout(resolve, 600));
    if (stage === 'build') runBuildTour();
    else if (stage === 'decor') runDecoTour();
    // Tấm chắn của hướng dẫn đã vẽ thì mới gỡ tấm chắn tạm (bước đầu có thể vẽ muộn vài giây, chờ cảnh / màn loading xong).
    await waitFor(() => document.querySelector('.deco-tour-blocker'), 10000);
  } finally { shield.remove(); }
}
