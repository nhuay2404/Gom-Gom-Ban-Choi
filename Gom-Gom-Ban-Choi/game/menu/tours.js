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
import { setShopPage } from './shop.js';

// ---------- Hướng dẫn Deco (deco-tour.js): lần đầu vào Deco tự chạy, nút "?" ở cột trái chạy lại ----------
// Lần đầu (vườn còn món chưa xây + món đó có kiểu thay thế): người chơi thao tác THẬT — chạm thẻ, Buy, chạm món trong nhà, đổi
// kiểu, chạm tab Shop / Decoration. Để làm được: bù xu đủ mua món rẻ nhất, mua xong tặng một kiểu thay thế (kèm ghim NEW).
// Chạy lại từ nút "?" (hoặc không có gì để xây): chỉ các bước đọc, không tặng gì.
const tourDone = () => {
  writeText(SAVE_KEYS.decoTour, 'done');
  if (ob.stage() === 'decor') ob.setStage('done'); // hết hướng dẫn Decoration = hết onboarding
};

function guidedTourPlan() {
  const deco = getDeco(), unlocked = decoUnlockedLevel();
  const bases = decoBases('garden').filter(base => !isOwned(deco, base) && base.price > 0 && itemStatus(deco, base, unlocked) !== 'locked').sort((a, b) => a.price - b.price);
  for (const base of bases) {
    const variant = CATALOG.find(entry => entry.slot === base.id && decoVisible(entry) && !(entry.lock && unlocked < entry.lock));
    if (variant) return { base, variant };
  }
  return null;
}

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
    return startDecoTour(say([
      { target: () => $('deco-cards').hidden ? $('deco').querySelector('.deco-dock') : $('deco-cards'),
        text: 'Swipe the tray and tap an item to preview it in your home. Tap Buy to build it!' },
      fencesStep,
      { target: middle, text: 'Tap any item in your home to swap its style. A NEW tag means a style you bought is waiting!' },
      { ...shopTab, text: 'More styles for every item live in the Shop. Let\u2019s take a look!', next: 'Open Shop',
        after: () => { if ($('shop').hidden) switchTab('shop'); } },
      { target: () => [$('shop-pages'), $('shop-deco-grid')], before: async () => { await waitFor(() => !$('shop').hidden); setShopPage('deco'); },
        text: 'Decoration: pick an area, tap a style to preview it, then buy. Back in Deco, tap the item to use it.' },
    ]), done);
  }
  const { base, variant } = plan, slot = slotOf(base);
  const card = () => $('deco-cards').querySelector(`[data-id="${base.id}"]`);
  const deco = getDeco();
  if (deco.zone !== 'garden') { setDeco({ ...deco, zone: 'garden' }); applyRoom(getDeco()); renderZoneSwitch(); }
  const toppedUp = TUTORIAL_TOP_UP && getDeco().coins < base.price;
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
  startDecoTour(say([
    { target: card, text: `Tap ${base.name} to see how it looks in your home.`, until: () => decoPick === base,
      // offsetLeft đo theo offsetParent (không phải khay) nên lệch; đo bằng rect để thẻ nằm gọn trong khay rồi mới sáng.
      before: async () => {
        const el = card(), tray = $('deco-cards');
        if (!el) return;
        tray.style.scrollBehavior = 'auto';
        tray.scrollLeft += el.getBoundingClientRect().left - tray.getBoundingClientRect().left - 12;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      } },
    { target: () => card()?.querySelector('[data-act="buy"]'), text: `Love it? Tap Buy to build it.${toppedUp ? ' We topped up your coins!' : ''}`, until: () => isOwned(getDeco(), base), after: gift },
    { target: () => room3d?.screenRectOf(slot), bubble: 'below', until: () => decoPop?.key === slot,
      text: `${base.name} is built! Tap it to swap its style. We gave you a new one.`,
      before: () => new Promise(resolve => setTimeout(resolve, 1100)) },
    { target: () => $('deco-pop-items').querySelector(`[data-id="${variant.id}"]`), bubble: 'below', until: () => getDeco().zones.garden.placed.includes(variant.id),
      text: `Tap ${variant.name} to use it instead.`, before: () => waitFor(() => $('deco-pop-items').querySelector(`[data-id="${variant.id}"]`)) },
    fencesStep,
    { ...shopTab, text: 'More styles for every item live in the Shop. Open it!', until: () => !$('shop').hidden },
    { target: () => $('shop-pages').querySelector('[data-page="deco"]'), text: 'Tap Decoration.', until: () => $('shop').dataset.page === 'deco',
      before: () => waitFor(() => !$('shop').hidden) },
    { target: () => [$('shop-pages'), $('shop-deco-grid')], text: 'Pick an area, tap a style to preview it, then buy. Back in Deco, tap the item to use it. Have fun!' },
  ]), done);
}

$('deco-help').onclick = () => { playSound('pick'); runDecoTour(); };

// ---------- Onboarding (onboarding.js): hướng dẫn trong Deco sau các màn mở khoá ----------
// Vùng giữa cảnh 3D: chỗ sáng cho các bước cử chỉ (kéo / zoom / xoay), chừa hàng ví và thanh tab.
const roomArea = () => {
  const r = $('deco-room').getBoundingClientRect();
  return { left: r.left + r.width * .04, top: r.top + r.height * .14, width: r.width * .92, height: r.height * .5 };
};

function runBasicsTour() {
  const watch = ob.watchGestures($('deco-room')), fresh = key => () => { watch.done[key] = false; };
  setDecoLock(false);
  closeDecoPop(false);
  // Chỉ hình, không chữ: bàn tay kéo / chụm / xoay lặp lại giữa cảnh; làm được cử chỉ nào thì tự sang cử chỉ kế, xong cả ba thì tắt hướng dẫn (không ép vào màn 2).
  const gesture = (key, kind) => ({ target: roomArea, gesture: kind, before: fresh(key), until: () => watch.done[key], skippable: true });
  // Mèo cam dẫn đường có sẵn trong vườn ngay khi mở vườn (xem setGuide). Thả mèo ra cả khi bỏ qua (Skip).
  setGuide(true);
  // Mở đầu: từ Home hub chỉ vào nút Deco (bàn tay chạm), vào Deco rồi một đoạn giải thích Deco là gì, sau đó mới tới ba cử chỉ.
  startDecoTour([
    { target: () => $('tabbar').querySelector('[data-tab="deco"]'), gesture: 'tap', bubble: 'above', until: () => !$('deco').hidden,
      text: 'Your garden is unlocked! Tap Deco to go visit it.' },
    { target: () => null, speaker: guideRect, bubble: 'speech', next: 'Show me',
      text: 'Welcome to your garden! Deco is where you decorate your home with furniture and cats live. Play levels to earn coins and buy new things!',
      before: async () => { await waitFor(() => !$('deco').hidden); setGuide(true); await new Promise(resolve => setTimeout(resolve, 250)); } },
    gesture('drag', 'drag'),
    gesture('zoom', 'pinch'),
    gesture('twist', 'twist'),
  ], () => { watch.stop(); setGuide(false); ob.setStage('L2'); }); // xong là tắt hướng dẫn, người chơi tự về Home hub chọn màn 2
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
    await switchTab(stage === 'basics' ? 'home' : 'deco'); // hướng dẫn Deco đầu tiên bắt đầu từ Home hub: chỉ vào nút Deco
    await new Promise(resolve => setTimeout(resolve, 600));
    if (stage === 'basics') runBasicsTour();
    else if (stage === 'decor') runDecoTour();
    // Tấm chắn của hướng dẫn đã vẽ thì mới gỡ tấm chắn tạm (bước đầu có thể vẽ muộn vài giây, chờ cảnh / màn loading xong).
    await waitFor(() => document.querySelector('.deco-tour-blocker'), 10000);
  } finally { shield.remove(); }
}
