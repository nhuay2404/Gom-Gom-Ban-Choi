// Thanh điều hướng Home / Deco / Shop: chuyển tab (màn chờ khi tab nặng), nút Play, nút đổi bộ quân, gói khởi đầu.
// Sang Unity: TabBar + ScreenRouter.
import * as ob from '../app/onboarding.js';
import { catMarkup } from '../ui/cat-art.mjs';
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getDeco, refreshWallet, pieceSkin, setPieceSkin, dogSkinOpen } from '../app/shared.js';
import { setDecoLock, clearDecoPick, closeDecoPop, noticeDeco, clearDecoNew, renderDeco } from './deco-panel.js';
import { room3d, mountRoom } from './room.js';
import { map3d, showMap } from './map-view.js';
import { markTab } from './settings.js';
import { renderShopBoosters, renderShopDeco, setShopPage, shopZone } from './shop.js';
import { renderZoneSwitch } from './areas.js';
import { enterDeco, boxBlocksPlay } from './gift-boxes.js';
import { play } from './context.js';

// ===== Deco / Shop: các tab dùng chung thanh điều hướng nổi (cùng Home = bản đồ), chỉ hiện ngoài màn chơi =====
// Khu nhà 3D (mèo đi lại, đồ đã đặt) chỉ còn ở Deco; Home cũ (vườn + nút PLAY) đã bỏ, bản đồ là hub.
export const TABS = ['deco', 'shop'];

export const menuOpen = () => TABS.some(tab => !$(tab).hidden);

export function hideMenus() {
  TABS.forEach(tab => { $(tab).hidden = true; });
  $('tabbar').hidden = true;
  $('hub-settings').hidden = true;
  setDecoLock(false);
  clearDecoPick();
  closeDecoPop(false);
  room3d?.stop();
  map3d?.stop();
}

export function showTab(tab) {
  // Đang treo ván để sang Shop mua gem: về Home = quay lại ván đó (màn continue / chơi tiếp), không ra bản đồ.
  if (tab === 'home' && play.pendingRun()) return play.resumeRun();
  if (tab === 'home') return showMap();
  if (tab === 'deco' && $('deco').hidden) noticeDeco();
  if (tab !== 'deco') clearDecoNew();
  setDecoLock(false);
  map3d?.stop();
  TABS.forEach(name => { $(name).hidden = name !== tab; });
  markTab(tab);
  $('map').hidden = true;
  $('tutorial').hidden = true;
  refreshWallet();
  if (tab !== 'deco') { clearDecoPick(); closeDecoPop(false); }
  if (tab === 'deco') renderDeco();
  if (tab === 'shop') { renderShopBoosters(); renderShopDeco(); }
  renderZoneSwitch();
  mountRoom(tab);
  $(tab).scrollTop = 0;
  if (tab === 'deco') enterDeco();
}

// PLAY ở Home hub: vào màn đang mở (màn cao nhất chưa qua; qua hết thì chơi lại màn cuối).
$('home-play').onclick = () => { playSound('pick'); if (boxBlocksPlay()) return; play.startLevel(unlockedCount(loadProgress()) - 1); };

// Gói khởi đầu nằm đầu tab Shop; Shop còn khoá (onboarding) thì chỉ báo.
// Nút đổi bộ quân trên bàn (mèo <-> chó), chỉ hiện khi đã mở bộ chó (màn 30). Hình + chữ theo bộ đang dùng.
export function renderSkinButton() {
  const button = $('home-skin'), skin = pieceSkin();
  button.hidden = !dogSkinOpen();
  if (button.hidden) return;
  button.querySelector('.fh-skin-art').innerHTML = catMarkup[skin === 'dogs' ? 'golden' : 'orange'];
  button.querySelector('span').textContent = skin === 'dogs' ? 'Dogs' : 'Cats';
}

$('home-skin').onclick = () => {
  const next = pieceSkin() === 'dogs' ? 'cats' : 'dogs';
  setPieceSkin(next);
  renderSkinButton();
  playSound('pick');
  showToast(next === 'dogs' ? 'Board pieces: Dogs!' : 'Board pieces: Cats!');
};

// Khởi động (menu-controller.js gọi sau khi mọi module menu đã nạp).
export function startTabs() { renderSkinButton(); }

$('home-starter').onclick = () => {
  if (!ob.tabOpen('shop')) { showToast('The Shop opens soon. Keep playing!'); return; }
  playSound('pick'); setShopPage('store'); switchTab('shop');
};

$('tabbar').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab || tab.disabled || tab.getAttribute('aria-current')) return;
  playSound('pick');
  switchTab(tab.dataset.tab);
});

// Chuyển tab Home / Deco / Shop: dựng cảnh 3D + chụp thumbnail model chặn luồng chính một lúc (màn hình đứng hình, ảnh hiện
// lần lượt). Hiện màn loading của lúc mở game trước, đợi nó vẽ lên màn hình rồi mới dựng tab, vẽ xong khung đầu mới mờ đi.
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

const TAB_LOADING_MIN = 350; // ms: hiện ít nhất chừng này cho khỏi chớp

let tabLoad = 0;

// Tab + khu đã dựng một lần (cảnh 3D đã nạp, ảnh thumbnail đã chụp và giữ trong bộ nhớ): lần sau dựng lại rất nhanh nên
// chuyển thẳng, không hiện màn loading. Chỉ lần đầu vào một tab / khu (việc nặng, đứng hình thấy rõ) mới hiện.
const tabsBuilt = new Set(['home']); // Home (bản đồ) dựng sẵn dưới màn loading lúc mở game

const tabKey = tab => tab === 'deco' ? `deco:${getDeco().zone}` : tab === 'shop' ? `shop:${shopZone}` : tab;

const tabNeedsLoading = tab => !!room3d && !tabsBuilt.has(tabKey(tab));

export async function switchTab(tab) {
  const screen = $('loading'), fill = $('loading-fill'), id = ++tabLoad, shownAt = performance.now();
  if (!screen || !tabNeedsLoading(tab)) { showTab(tab); if (room3d) tabsBuilt.add(tabKey(tab)); return; }
  // Hiện ngay (không mờ dần vào): luồng chính bị chặn khi màn còn trong suốt thì người chơi vẫn thấy tab cũ đứng hình.
  screen.style.transition = 'none';
  fill.style.transition = 'none';
  fill.style.width = '30%';
  screen.classList.remove('done');
  await nextFrame(); await nextFrame();
  screen.style.transition = ''; fill.style.transition = '';
  if (id !== tabLoad) return;
  showTab(tab);
  if (room3d) tabsBuilt.add(tabKey(tab));
  fill.style.width = '100%';
  // Khung đầu của tab mới (cảnh 3D, ảnh thumbnail) đã vẽ xong.
  await nextFrame(); await nextFrame();
  await new Promise(resolve => setTimeout(resolve, Math.max(0, TAB_LOADING_MIN - (performance.now() - shownAt))));
  if (id === tabLoad) screen.classList.add('done');
}
