// ===== Luồng điều khiển MENU (giao diện ngoài màn chơi) =====
// Home hub = bản đồ màn (ví, liveops), Deco / Shop (thanh tab, phòng 3D, mua / đặt đồ, chọn khu), cài đặt (âm thanh, ngày / đêm, hướng dẫn)
// và nút dev. Vào màn chơi thì gọi qua `play` (play-controller.js, nối ở main.js).
import { categories, catMarkup, addArt as addCatArt } from '../ui/cat-art.mjs';
import { LEVELS, LETTERS } from '../gameplay/levels.mjs';
import { loadProgress, saveProgress, unlockedCount, levelsCleared as clearedCount, levelTier } from '../gameplay/progression.mjs';
import { BOOSTERS } from '../gameplay/tuning.mjs';
import { playSound, soundOn, setSound } from '../ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from '../gameplay/save.mjs';
import { ZONES, ZONE_IDS, CATALOG, MAX_ROOM_CATS, zoneOpen, gardenExpanded, slotGroups, itemById, itemStatus, applyAction, previewDeco, claimCat, isCatClaimed,
  isOwned, catalogFor, slotOf, shopCatalog, shopStatus, buyToStock, ownedOptions, useItem, freshKeys, clearFresh } from '../deco/deco-data.mjs';
import { startDecoTour, waitFor } from './deco-tour.js';
import * as ob from './onboarding.js';
import { openDaily, maybeAutoDaily, questEvent, renderGemPacks } from './liveops-ui.js';
import { $, reduceMotion, DEV_MODE, showToast, getDeco, setDeco, refreshWallet, getBoosters, buyOne, priceTag } from './shared.js';

// Luồng màn chơi (startLevel, mapTier): main.js nối vào lúc khởi động.
let play = null;
export function connectPlay(playController) { play = playController; }

// Bản đồ saga: màn 1 ở đáy, các nút nằm trên một con đường uốn hình sin đi lên (như Candy Crush).
const MAP = { STEP: 118, TOP: 230, BOTTOM: 150, SWING: 0.3, FREQ: 0.95 };
const PAW_SVG = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="16" rx="5.5" ry="4.6"/><circle cx="5.6" cy="10" r="2.4"/><circle cx="9.6" cy="6.2" r="2.5"/><circle cx="14.4" cy="6.2" r="2.5"/><circle cx="18.4" cy="10" r="2.4"/></svg>';
const EAR_SVG = '<svg viewBox="0 0 24 24"><path class="ear-out" d="M3 22 6.5 4.5Q7.5 1.5 10 3.5L22 13Z"/><path class="ear-in" d="M8 16.5 9.5 8.5 15.5 13.5Z"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13Z"/></svg>';
const mapPoint = (index, width, height) => ({
  x: width * (0.5 + MAP.SWING * Math.sin(index * MAP.FREQ)),
  y: height - MAP.BOTTOM - index * MAP.STEP,
});
// Đường cong mượt qua các điểm: mỗi đoạn là cubic bezier với tay nắm thẳng đứng.
const mapPath = points => points.map((p, i) => {
  if (!i) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const q = points[i - 1], mid = (q.y - p.y) / 2;
  return `C${q.x.toFixed(1)} ${(q.y - mid).toFixed(1)} ${p.x.toFixed(1)} ${(p.y + mid).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}).join('');

function renderMap() {
  const list = $('map-list'), progress = loadProgress(), open = unlockedCount(progress);
  const width = Math.min(list.clientWidth, 440), height = MAP.TOP + MAP.BOTTOM + (LEVELS.length - 1) * MAP.STEP;
  const points = LEVELS.map((_, index) => mapPoint(index, width, height));
  const road = document.createElement('div');
  road.className = 'map-road';
  road.style.cssText = `width:${width}px;height:${height}px`;
  // Đoạn đã đi (tới màn đang mở) tô màu kẹo; phần còn lại là đường đất.
  road.innerHTML = `<svg width="${width}" height="${height}" aria-hidden="true">
      <path class="road-edge" d="${mapPath(points)}"/><path class="road-fill" d="${mapPath(points)}"/>
      ${open > 1 ? `<path class="road-done" d="${mapPath(points.slice(0, open))}"/>` : ''}
      <path class="road-dots" d="${mapPath(points)}"/>
    </svg>`;
  // Dấu chân mèo trên đường giữa hai màn (2 dấu mỗi đoạn, theo design Figma "Map").
  const bezier = (q, p, t) => {
    const mid = (q.y - p.y) / 2, u = 1 - t;
    return { x: u * u * u * q.x + 3 * u * t * (u * q.x + t * p.x) + t * t * t * p.x,
      y: u * u * u * q.y + 3 * u * u * t * (q.y - mid) + 3 * u * t * t * (p.y + mid) + t * t * t * p.y };
  };
  road.append(...points.slice(1).flatMap((p, i) => [0.38, 0.62].map((t, k) => {
    const paw = document.createElement('span'), at = bezier(points[i], p, t);
    paw.className = `map-paw${i + 1 < open ? ' done' : ''}`;
    paw.innerHTML = PAW_SVG;
    paw.style.cssText = `left:${(at.x + (k ? 7 : -7)).toFixed(1)}px;top:${at.y.toFixed(1)}px;rotate:${k ? 18 : -18}deg`;
    return paw;
  })));
  road.append(...LEVELS.map((level, index) => {
    const node = document.createElement('button');
    const stars = progress.stars[index] || 0, locked = index >= open, tier = levelTier(level), current = index === open - 1;
    node.className = `map-node${locked ? ' locked' : stars ? ' done' : ''}${current ? ` current${points[index].x > width / 2 ? ' avatar-left' : ''}` : ''} tier-${play.mapTier(index, current).style}`;
    node.style.cssText = `left:${points[index].x}px;top:${points[index].y}px`;
    node.disabled = locked;
    node.title = `${level.name} · ${play.mapTier(index, current).label}`;
    node.setAttribute('aria-label', `Level ${index + 1}: ${level.name}${locked ? ' (locked)' : stars ? ' (cleared)' : ''}`);
    node.innerHTML = `${EAR_SVG.replace('<svg', '<svg class="ear l"')}${EAR_SVG.replace('<svg', '<svg class="ear r"')}<b>${index + 1}${locked ? LOCK_SVG : ''}</b>`
      + (tier === 'boss' ? '<span class="map-crown" aria-hidden="true">👑</span>' : '')
      + (current ? `<span class="map-avatar" aria-hidden="true">${catMarkup.orange}</span>` : '');
    node.onclick = () => { $('map').hidden = true; play.startLevel(index); };
    return node;
  }));
  // Cuối đường: biển báo hết màn để người chơi biết đã tới đỉnh, không phải bản đồ bị cắt.
  const end = document.createElement('span');
  end.className = 'map-end';
  end.textContent = 'More levels coming soon!';
  end.style.cssText = `left:${width / 2}px;top:${points[LEVELS.length - 1].y - 78}px`;
  road.append(end);
  list.replaceChildren(road);
}

// Thanh tab chung hiện ở Home (bản đồ) / Deco / Shop, đánh dấu mục đang mở.
// Home và Deco có nút cài đặt chung (cùng hàng ví); Shop không có (banner gói khởi đầu nằm đúng chỗ đó).
const SETTINGS_TABS = ['home', 'deco', 'shop'];
const CLAIM_FROM_LEVEL = 2; // chỉ số màn 3: mèo các màn đầu chỉ nhận được từ khi thắng màn này
function markTab(tab) {
  // Onboarding: tab chưa mở thì ẩn; chỉ còn mỗi Home thì ẩn cả thanh tab.
  $('tabbar').querySelectorAll('.tab').forEach(button => { button.hidden = !ob.tabOpen(button.dataset.tab); });
  $('tabbar').hidden = ['deco', 'shop'].every(name => !ob.tabOpen(name));
  $('hub-settings').hidden = !SETTINGS_TABS.includes(tab);
  refreshClaimDot();
  $('tabbar').querySelectorAll('.tab').forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
// Bản đồ 3D (deco/map-world.mjs: trống cỏ lăn như Animal Crossing). Máy không có WebGL / lỗi nạp thì dùng bản đồ 2D ở trên.
let map3d = null, map3dFailed = false, catShowcase = null;
const map3dReady = import('../deco/map-world.mjs').then(({ createMapWorld, catShowcase: showcase }) => {
  catShowcase = showcase;
  map3d = createMapWorld($('map-3d'), {
    avatarSvg: catMarkup.orange,
    onPick: index => { map3d.stop(); $('map').hidden = true; play.startLevel(index); },
    onClaim: (breed, index) => showCatReward(breed, () => {
      setDeco(claimCat(getDeco(), breed));
      map3d.render(mapLevels());
      map3d.focus(index, false);
      refreshClaimDot();
    }),
  });
}).catch(error => { map3dFailed = true; console.warn('Map 3D off:', error); });
function mapLevels() {
  const progress = loadProgress(), open = unlockedCount(progress), seen = new Set(), deco = getDeco();
  return LEVELS.map((level, index) => {
    // Giống mèo lần đầu xuất hiện ở màn này: bản đồ dựng mèo 3D giống đó cạnh màn (mèo đã nhận thì về nhà, không hiện nữa).
    // Thắng màn rồi mà chưa nhận: nhãn NEW! thành nút Claim.
    const newCats = [...level.cats].filter(ch => !seen.has(ch)).map(ch => (seen.add(ch), LETTERS[ch])).filter(breed => !isCatClaimed(deco, breed));
    // Mèo của các màn đầu chỉ nhận được sau khi thắng màn 3 (CLAIM_FROM_LEVEL), không tự động nhận lúc thắng màn 2.
    const claimable = !!progress.stars[index] && !!progress.stars[Math.min(index, CLAIM_FROM_LEVEL)];
    return { locked: index >= open, current: index === open - 1, tier: play.mapTier(index, index === open - 1).style, newCats, claimable };
  });
}
// Chấm đỏ ở tab Home khi còn mèo đã mở khoá mà chưa nhận (nút CLAIM trên Map).
const hasUnclaimedCat = () => mapLevels().some(level => level.claimable && level.newCats.length > 0);
function refreshClaimDot() {
  $('tabbar').querySelector('[data-tab="home"]')?.classList.toggle('has-dot', hasUnclaimedCat());
}
// Màn hình nhận thưởng mèo (kiểu "You got" của game mobile): tia sáng xoay, mèo bật ra, độ hiếm + tên, "Tap to claim".
// Chạm (sau khi hiện xong) thì mèo bay đi, gọi onClaimed, báo toast mèo đã về nhà.
const CAT_RARITY = { orange: 'Common', gray: 'Common', white: 'Common', tabby: 'Rare', siamese: 'Epic', tuxedo: 'Legendary' };
// `keep`: sắp có màn thưởng kế tiếp nên giữ nền khi đóng (không mờ ra); `chained`: màn kế của một cặp, hiện luôn không mờ vào.
function showCatReward(breed, onClaimed, { keep = false, chained = false } = {}) {
  const rarity = CAT_RARITY[breed] || 'Rare', name = categories[breed].name;
  const screen = document.createElement('div');
  screen.className = `cat-reward${chained ? ' chained' : ''}`;
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-label', `You got ${name}`);
  screen.innerHTML = `<div class="cr-rays"></div><div class="cr-glow"></div>
    <p class="cr-title">You got</p>
    <div class="cr-cat cr-3d"><i class="cr-spark s1"></i><i class="cr-spark s2"></i><i class="cr-spark s3"></i><i class="cr-spark s4"></i></div>
    <p class="cr-rarity r-${rarity.toLowerCase()}">${rarity}</p>
    <p class="cr-name">${name}</p>
    <p class="cr-tap">Tap to claim</p>`;
  document.body.append(screen);
  // Mèo 3D (cùng model trên Map); máy không dựng được 3D thì dùng art 2D.
  let showcase = null;
  try { showcase = catShowcase?.(screen.querySelector('.cr-cat'), breed, { reduceMotion: reduceMotion.matches }); } catch (error) { console.warn('Cat showcase off:', error); }
  if (!showcase) screen.querySelector('.cr-cat').insertAdjacentHTML('afterbegin', catMarkup[breed]);
  playSound('reward');
  let ready = false, done = false;
  setTimeout(() => { ready = true; screen.classList.add('ready'); }, reduceMotion.matches ? 0 : 900);
  screen.addEventListener('click', () => {
    if (!ready || done) return;
    done = true;
    playSound('pick');
    onClaimed();
    screen.classList.add('closing');
    if (keep) screen.classList.add('keep');
    const roomy = getDeco().cats.includes(breed);
    setTimeout(() => { showcase?.stop(); screen.remove(); showToast(roomy ? `${name} moved into your home!` : `${name} is waiting in Deco (room is full)`); }, reduceMotion.matches ? 0 : 450);
  });
}
async function showMap3d() {
  await map3dReady;
  if ($('map').hidden) return;
  if (!map3d) { showMap2d(); return; }
  const levels = mapLevels();
  $('map').classList.add('is-3d');
  map3d.render(levels);
  map3d.focus(Math.max(0, levels.findIndex(level => level.current)));
  map3d.start();
}

// Home hub chính là bản đồ màn (showTab('home') cũng dẫn tới đây).
export function showMap() {
  hideMenus();
  markTab('home');
  refreshWallet();
  $('map').hidden = false;
  $('tutorial').hidden = true;
  if (map3dFailed) showMap2d();
  else showMap3d();
  // LiveOps: lần đầu về Home trong ngày có quà điểm danh thì tự mở bảng Daily (không chen vào onboarding)
  if (!ob.active()) setTimeout(() => { if (!$('map').hidden) maybeAutoDaily(); }, 900);
}
function showMap2d() {
  $('map').classList.remove('is-3d');
  renderMap();
  // Cuộn cho màn đang chơi nằm giữa màn hình (không có thì ở đáy, chỗ màn 1).
  const list = $('map-list'), current = list.querySelector('.map-node.current');
  list.scrollTop = current ? current.offsetTop - list.clientHeight / 2 : list.scrollHeight;
}
addEventListener('resize', () => { if (!$('map').hidden && map3dFailed) renderMap(); });

// ===== Deco / Shop: các tab dùng chung thanh điều hướng nổi (cùng Home = bản đồ), chỉ hiện ngoài màn chơi =====
// Khu nhà 3D (mèo đi lại, đồ đã đặt) chỉ còn ở Deco; Home cũ (vườn + nút PLAY) đã bỏ, bản đồ là hub.
const TABS = ['deco', 'shop'];
export const menuOpen = () => TABS.some(tab => !$(tab).hidden);
let room3d = null; // phòng 3D, có sau khi nạp xong Three.js; null thì dùng phòng CSS phẳng
let decoThumbnail = null; // chụp model 3D làm ảnh cho ô đồ (có sau khi nạp Three.js)
let decoPick = null; // món gốc đang xem trước (thẻ chưa xây vừa chạm)

export function hideMenus() {
  TABS.forEach(tab => { $(tab).hidden = true; });
  $('tabbar').hidden = true;
  $('hub-settings').hidden = true;
  setDecoLock(false);
  decoPick = null;
  closeDecoPop(false);
  room3d?.stop();
  map3d?.stop();
}
export function showTab(tab) {
  if (tab === 'home') return showMap();
  setDecoLock(false);
  map3d?.stop();
  TABS.forEach(name => { $(name).hidden = name !== tab; });
  markTab(tab);
  $('map').hidden = true;
  $('tutorial').hidden = true;
  refreshWallet();
  if (tab !== 'deco') { decoPick = null; closeDecoPop(false); }
  if (tab === 'deco') renderDeco();
  if (tab === 'shop') { renderShopBoosters(); renderShopDeco(); renderGemPacks($('shop-gems')); }
  renderZoneSwitch();
  mountRoom(tab);
  $(tab).scrollTop = 0;
  if (tab === 'deco' && !ob.active() && readText(SAVE_KEYS.decoTour) !== 'done') setTimeout(() => { if (!$('deco').hidden && !decoLocked) runDecoTour(); }, 600);
}
// Vườn và phòng khách nối liền thành một khu nhà; phòng khách chỉ có khi đã mở (thắng màn 10). Chỉ Deco dựng cảnh này.
const applyRoom = shown => room3d?.apply(shown, { living: isZoneOpen('living'), bedroom: isZoneOpen('bedroom'), kitchen: isZoneOpen('kitchen'), gardenExpand: isGardenExpanded() });
function mountRoom(tab) {
  if (!room3d) return;
  if (tab !== 'deco') return room3d.stop();
  applyRoom(decoShown());
  // Kéo để đi qua các khu, chụm để thu nhỏ; deco: true bật phần riêng của Deco (khoá khu, chạm món để đổi...).
  room3d.mount($('deco-room'), { mode: 'hub', deco: true, resetView: true, view: DECO_VIEW });
}
// Deco tràn viền: phòng nằm giữa hàng ví và dải thẻ dưới đáy; khung dọc nên cỡ phòng tính theo bề ngang (zoomFit nhỏ = to hơn).
const DECO_VIEW = {
  zoomFit: .82,
  insets() {
    const room = $('deco-room').getBoundingClientRect();
    return { top: $('deco').querySelector('.wallet-hud').getBoundingClientRect().bottom - room.top, bottom: room.bottom - $('deco').querySelector('.deco-dock').getBoundingClientRect().top };
  },
};
// PLAY ở Home hub: vào màn đang mở (màn cao nhất chưa qua; qua hết thì chơi lại màn cuối).
$('home-play').onclick = () => { playSound('pick'); play.startLevel(unlockedCount(loadProgress()) - 1); };
$('home-daily').onclick = () => { playSound('pick'); openDaily(); };
// Pill gems ở mọi hàng ví: mở Shop tới mục gói gems
document.addEventListener('click', event => {
  if (!event.target.closest('[data-open="gems"]')) return;
  playSound('pick');
  setShopPage('store');
  switchTab('shop');
  setTimeout(() => $('shop-gems').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' }), 250);
});
$('home-starter').onclick = () => { playSound('pick'); setShopPage('store'); switchTab('shop'); }; // gói khởi đầu nằm đầu tab Shop
$('tabbar').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab || tab.getAttribute('aria-current')) return;
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

// Phòng CSS phẳng (dự phòng khi không nạp được 3D): tranh, cửa sổ, chậu cây, thảm và mèo; chạm mèo để cưng.
function buildRoom(room, cats) {
  room.innerHTML = '<span class="room-frame"></span><span class="room-window"></span><span class="room-plant"></span><span class="room-rug"></span><div class="room-cats"></div>';
  room.querySelector('.room-cats').append(...cats.map(group => {
    const cat = document.createElement('button');
    cat.className = 'room-cat';
    cat.setAttribute('aria-label', `Pet the ${categories[group].name.toLowerCase()}`);
    addCatArt(cat, group);
    return cat;
  }));
}
function buildFlatRooms() {
  buildRoom($('deco-room'), getDeco().cats.slice(0, 3));
}
function petRoomCat(cat) {
  cat.classList.remove('petted');
  void cat.offsetWidth;
  cat.classList.add('petted');
  clearTimeout(cat.petTimer);
  cat.petTimer = setTimeout(() => cat.classList.remove('petted'), 1100);
  playSound('pet');
  questEvent('pet');
  if (reduceMotion.matches) return;
  const room = cat.closest('.room'), box = room.getBoundingClientRect(), rect = cat.getBoundingClientRect();
  for (let i = 0; i < 4; i++) {
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = '♥';
    heart.style.left = `${rect.left - box.left + rect.width * (.3 + Math.random() * .4)}px`;
    heart.style.top = `${rect.top - box.top + rect.height * .2}px`;
    heart.style.setProperty('--dx', `${(Math.random() - .5) * 40}px`);
    heart.style.setProperty('--rot', `${(Math.random() - .5) * 40}deg`);
    heart.style.animationDelay = `${i * 110}ms`;
    heart.style.fontSize = `${14 + Math.random() * 8}px`;
    room.append(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}
document.addEventListener('click', event => {
  const cat = event.target.closest('.room-cat');
  if (cat) petRoomCat(cat);
});
// Người mới: vườn chưa có mèo, nhận ở màn 2 (onboarding.js).
if (ob.stage() === 'L1' && getDeco().cats.length) setDeco({ ...getDeco(), cats: [], claimedCats: [] });
buildFlatRooms();
// Cảnh 3D nạp xong (phòng + bản đồ): màn loading (main.js) đợi cái này rồi mới tắt.
const roomReady = import('../deco/deco-room.mjs').then(({ createRoom, thumbnail }) => {
  room3d = createRoom();
  if (DEV_MODE && new URLSearchParams(location.search).has('qc')) setTimeout(runQC, 500);
  room3d.setAmbient(ambient);
  decoThumbnail = thumbnail;
  room3d.onPick(onScenePick);
  room3d.onCatEvent(event => { if (event === 'pet') questEvent('pet'); });
  // Bảng đổi món + ghim NEW đặt lại ngay sau mỗi lần vẽ cảnh (cùng khung hình với camera, không trễ / rung).
  room3d.onFrame(() => { if (!$('deco').hidden) { placeDecoPop(); placeDecoPins(); } });
  // Deco: kéo cảnh sang phòng khác thì hàng thẻ, nút cột trái và hàng chọn khu đổi theo phòng đang ở giữa (camera không lướt lại).
  room3d.onZoneView(zone => {
    if ($('deco').hidden || zone === getDeco().zone || !isZoneOpen(zone)) return;
    setDeco({ ...getDeco(), zone });
    decoPick = null;
    closeDecoPop(false);
    applyRoom(getDeco());
    renderZoneSwitch();
    renderDeco();
  });
  $('deco-room').replaceChildren();
  $('deco-room').classList.add('is-3d');
  const open = TABS.find(tab => !$(tab).hidden);
  if (open) mountRoom(open);
  if (open === 'deco') renderDeco(); // thay quả cầu màu bằng ảnh chụp model
  if (open === 'shop') renderShopDeco();
}).catch(error => console.warn('3D room unavailable, using the flat room.', error));
// Cho màn loading: xong khi cảnh phòng + bản đồ 3D đã nạp (lỗi cũng tính là xong, game dùng bản phẳng thay thế).
export const sceneReady = Promise.all([roomReady, map3dReady]);

// ===== Deco kiểu "xây chỗ" (như Monopoly Go) =====
// Hàng thẻ dưới màn hình = món gốc của từng chỗ đặt trong khu (một hàng, vuốt ngang). Chạm thẻ chưa xây: xem trước món ngay
// tại chỗ + camera quay tới, thẻ hiện nút Buy; mua = xây chỗ đó (✓). Thẻ đã xây: quay tới món + mở bảng đổi món.
// Kiểu khác của món + tường / sàn khác bán ở Shop → Decoration (mua vào kho). Món có đồ mới mua thay được thì sáng lên trong
// cảnh; chạm món / sàn / tường trong cảnh thì bảng đổi món hiện NGAY CẠNH chỗ đó (không nằm ở đáy màn hình).
// Đồ phần vườn mở rộng chỉ hiện khi vườn đã mở rộng (trước đó chúng chưa có chỗ trong cảnh).
const decoVisible = entry => entry.area !== 'garden2' || isGardenExpanded();
const decoShown = () => previewDeco(getDeco(), decoPick);
const coin = amount => `<span class="amt"><i class="ico-coin"></i>${amount}</span>`; // xu + số không bị ngắt dòng
const thumbOf = entry => entry.breed ? `<span class="thumb cat-thumb">${catMarkup[entry.breed]}</span>`
  : decoThumbnail ? `<img class="thumb thumb-3d" src="${decoThumbnail(entry)}" alt="">`
  : `<span class="thumb" style="--c:${entry.color}"></span>`;
// Món gốc của mọi chỗ trong khu (theo thứ tự danh mục) — chính là các thẻ.
const decoBases = zone => slotGroups(zone, 'furniture').map(group => group[0]).filter(decoVisible);
const builtCount = (deco, zone) => { const bases = decoBases(zone); return [bases.filter(base => isOwned(deco, base)).length, bases.length]; };
let decoPop = null; // bảng đổi món đang mở: { zone, key (chỗ đặt | 'walls' | 'floors' | 'cats'), x, y }
let popPreview = null; // kiểu chưa mua đang xem thử trong bảng (chạm nút giá để mua)
let lastCardZone = '';

function renderDeco() {
  const deco = getDeco(), unlocked = decoUnlockedLevel(), fresh = freshKeys(deco, deco.zone);
  room3d?.setHighlights(decoLocked ? new Set() : fresh);
  $('deco').querySelectorAll('.deco-side [data-key]').forEach(button => {
    button.querySelector('span').textContent = ZONES[deco.zone].cats[button.dataset.key];
    button.classList.toggle('on', decoPop?.key === button.dataset.key);
  });
  // Ghim "NEW" trên các món có đồ mới thay được (chỉ đồ đạc; tường / sàn mới báo bằng toast ở Shop)
  $('deco-pins').replaceChildren(...[...fresh].filter(key => key !== 'walls' && key !== 'floors').map(slot => {
    const pin = document.createElement('span');
    pin.className = 'deco-pin';
    pin.dataset.slot = slot;
    pin.textContent = 'NEW';
    return pin;
  }));
  const cards = $('deco-cards');
  // Món đã xây thì thẻ biến mất (đổi kiểu: chạm món trong cảnh). Xây hết: ẩn cả hàng thẻ, hàng chọn khu tụt xuống sát thanh tab.
  const todo = decoBases(deco.zone).filter(base => !isOwned(deco, base));
  cards.hidden = !todo.length;
  // Cập nhật thẻ tại chỗ (giữ nguyên phần tử + ảnh thumbnail đã giải mã): dựng lại cả hàng mỗi lần chạm thẻ thì trình duyệt
  // phải giải mã lại hàng chục ảnh PNG + vẽ lại, đúng khung hình camera bắt đầu lướt -> giật.
  const existing = new Map([...cards.children].map(card => [card.dataset.id, card]));
  const next = todo.map(base => {
    const status = itemStatus(deco, base, unlocked), picked = decoPick === base;
    let card = existing.get(base.id);
    if (!card) {
      card = document.createElement('button');
      card.dataset.id = base.id;
      card.setAttribute('role', 'listitem');
    }
    const className = `deco-card ${status}${picked ? ' picked' : ''}`;
    if (card.className !== className) card.className = className;
    const art = thumbOf(base), foot = status === 'locked' ? `<em class="deco-card-price lock">Lv ${base.lock}</em>`
      : picked && status === 'buy' ? `<em class="deco-card-price act" data-act="buy">Buy ${coin(base.price)}</em>`
      : `<em class="deco-card-price">${coin(base.price)}</em>`;
    if (card.artHtml !== art) { card.artHtml = art; card.innerHTML = `<span class="deco-card-art">${art}</span><span class="deco-card-name">${base.name}</span>${foot}`; }
    else if (card.footHtml !== foot) card.lastElementChild.outerHTML = foot;
    card.footHtml = foot;
    return card;
  });
  if (next.length !== cards.children.length || next.some((card, i) => cards.children[i] !== card)) cards.replaceChildren(...next);
  // Chuẩn bị trước lúc rảnh: model các thẻ xem thử được + ảnh các kiểu trong bảng đổi món của khu (không thì lần đầu chạm
  // phải dựng / chụp ngay trong khung hình, camera đứng hình lúc đang lướt).
  room3d?.prewarm(todo.filter(base => itemStatus(deco, base, unlocked) !== 'locked'));
  warmDecoThumbs(deco.zone);
  // Đổi khu: về đầu hàng thẻ
  if (lastCardZone !== deco.zone) { lastCardZone = deco.zone; cards.scrollLeft = 0; }
  renderDecoPop();
}
$('deco-cards').addEventListener('click', event => {
  const card = event.target.closest('.deco-card'), base = itemById(card?.dataset.id);
  if (!base) return;
  if (event.target.closest('[data-act="buy"]')) return buildBase(base);
  playSound('pick');
  closeDecoPop(false);
  const status = itemStatus(getDeco(), base, decoUnlockedLevel());
  if (status === 'locked') return showToast(`Unlocks at level ${base.lock}`);
  pickDeco(decoPick === base ? null : base); // chạm lại thẻ đang xem = bỏ xem
  if (decoPick && status === 'poor') showToast(`Need ${base.price - getDeco().coins} more coins`);
});
function pickDeco(entry) {
  decoPick = entry;
  applyRoom(decoShown());
  room3d?.focus(entry?.id ?? null); // xem trước = quay về chỗ đó + zoom vào được; bỏ xem = zoom quanh giữa khu
  if (entry?.cat === 'furniture') room3d?.fx(slotOf(entry), 'preview'); // lấp lánh nhẹ quanh món đang xem thử
  renderDeco();
}
function buildBase(base) {
  const next = applyAction(getDeco(), base, decoUnlockedLevel());
  if (next.error) return showToast(next.error);
  setDeco(next);
  refreshWallet();
  playSound('reward');
  showToast(`Built ${base.name}!`);
  if (!room3d) buildFlatRooms();
  decoPick = null;
  applyRoom(getDeco());
  room3d?.focus(base.id, false);
  room3d?.fx(base.id, 'buy'); // pháo giấy + sao + vòng sáng
  renderDeco();
  renderZoneSwitch();
}

// ---------- Bảng đổi món (cạnh món / chỗ vừa chạm) ----------
// Chạm trong cảnh: món = bảng đổi món cạnh nó. Sàn / tường (chạm cỏ trống là chuyện thường) chỉ mở khi đã có kiểu khác mua ở Shop
// và chưa có bảng nào đang mở; đang mở bảng thì chạm chỗ khác = đóng.
function onScenePick(pick) {
  if (decoLocked) return;
  const surface = pick.key === 'walls' || pick.key === 'floors';
  if (!pick.key || (surface && (decoPop || ownedOptions(getDeco(), pick.zone, pick.key).length < 2))) return closeDecoPop();
  // Món ở phòng khác: chuyển Deco sang phòng đó (hàng thẻ, nút, hàng chọn khu) rồi mở bảng — camera lướt thẳng tới món.
  if (pick.zone !== getDeco().zone && isZoneOpen(pick.zone)) {
    setDeco({ ...getDeco(), zone: pick.zone });
    decoPick = null;
    applyRoom(getDeco());
    renderZoneSwitch();
  }
  openDecoPop(pick);
}
function openDecoPop(spec) {
  if (popPreview) { popPreview = null; applyRoom(getDeco()); } // đang xem thử ở bảng khác: bỏ xem
  decoPop = spec;
  // Bảng đổi kiểu một món: camera khoá ở góc đã căn tới khi bảng đóng (bảng mèo / tường / sàn thì không)
  room3d?.lockView(!['cats', 'walls', 'floors'].includes(spec.key));
  if (spec.key !== 'cats') setDeco(clearFresh(getDeco(), spec.zone, spec.key)); // đã xem món mới -> thôi sáng
  if (decoPick) { decoPick = null; applyRoom(getDeco()); }
  renderDeco();
  $('deco-pop').hidden = false;
  updatePopSwipeHint(); // đo sau khi bảng hiện (lúc ẩn thì clientWidth = 0)
  $('deco-pop').classList.remove('show');
  void $('deco-pop').offsetWidth;
  $('deco-pop').classList.add('show');
  // Món ra giữa khung, hạ thấp nửa chiều cao bảng: bảng phía trên vừa khít, không phải trượt bù sau cú lướt.
  if (spec.key !== 'cats' && spec.key !== 'walls' && spec.key !== 'floors') room3d?.focus(spec.key, false, ($('deco-pop').offsetHeight + 14) / 2 + 12);
  placeDecoPop();
}
function closeDecoPop(render = true) {
  if (!decoPop) return;
  decoPop = null;
  // Đóng bảng khi đang xem thử một kiểu chưa mua: phòng trở về đồ đang dùng.
  if (popPreview) { popPreview = null; applyRoom(getDeco()); }
  $('deco-pop').hidden = true;
  room3d?.lockView(false);
  room3d?.focus(null, false);
  if (render) renderDeco();
}
// Ảnh thumbnail (render model + mã hoá PNG, ~20–60 ms mỗi ảnh) cho mọi kiểu đồ / tường / sàn của khu: chụp từng ảnh một lúc
// trình duyệt rảnh, để mở bảng đổi món không phải chụp hàng loạt ngay lúc camera đang lướt tới món.
const idleCall = globalThis.requestIdleCallback ?? (fn => setTimeout(() => fn({ timeRemaining: () => 12 }), 40));
let thumbQueue = [], thumbZone = '', thumbPending = false;
function warmDecoThumbs(zone) {
  if (!decoThumbnail) return;
  if (zone !== thumbZone) {
    thumbZone = zone;
    thumbQueue = [...CATALOG.filter(entry => entry.cat === 'furniture' && entry.zone === zone && decoVisible(entry)),
      ...catalogFor(zone, 'walls'), ...catalogFor(zone, 'floors')];
  }
  if (thumbPending || !thumbQueue.length) return;
  thumbPending = true;
  idleCall(deadline => {
    thumbPending = false;
    while (thumbQueue.length && deadline.timeRemaining() > 10) decoThumbnail(thumbQueue.shift());
    if (!$('deco').hidden) warmDecoThumbs(thumbZone);
  });
}
function decoPopOptions(deco) {
  if (decoPop.key === 'cats') return CATALOG.filter(entry => entry.cat === 'cats');
  const all = decoPop.key === 'walls' || decoPop.key === 'floors' ? catalogFor(decoPop.zone, decoPop.key) : CATALOG.filter(entry => entry.cat === 'furniture' && slotOf(entry) === decoPop.key);
  // Đã có trước, kiểu bán ở Shop sau
  return all.filter(decoVisible).sort((a, b) => isOwned(deco, b) - isOwned(deco, a));
}
function renderDecoPop() {
  if (!decoPop) return;
  const deco = getDeco(), unlocked = decoUnlockedLevel(), names = ZONES[decoPop.zone].cats;
  const options = decoPopOptions(deco);
  const using = options.find(entry => itemStatus(deco, entry, unlocked) === 'using');
  const title = { cats: `Cats · ${deco.cats.length}/${MAX_ROOM_CATS}`, walls: names.walls, floors: names.floors }[decoPop.key] ?? (popPreview && options.includes(popPreview) ? popPreview.name : using?.name) ?? itemById(decoPop.key).name;
  $('deco-pop-title').textContent = title;
  $('deco-pop-items').replaceChildren(...options.map(entry => {
    const shop = entry.cat !== 'cats' && !isOwned(deco, entry), status = shop ? shopStatus(deco, entry, unlocked) : itemStatus(deco, entry, unlocked);
    const node = document.createElement('button');
    const previewing = popPreview === entry;
    node.className = `deco-opt ${status}${shop ? ' in-shop' : ''}${previewing ? ' previewing' : ''}`;
    node.dataset.id = entry.id;
    node.setAttribute("aria-label", entry.name); node.title = entry.name; // tên hiện ở dòng tiêu đề bảng, không lặp trong thẻ
    const tag = status === 'using' && !popPreview ? '<b class="deco-opt-tag">✓</b>' : '';
    // Đang xem thử: nút giá thành nút mua (chạm để mua + đặt luôn)
    const price = !shop ? '' : status === 'locked' ? `<em class="deco-opt-price lock">Lv ${entry.lock}</em>`
      : previewing ? `<em class="deco-opt-price buy-now">Buy ${coin(entry.price)}</em>` : `<em class="deco-opt-price">${coin(entry.price)}</em>`;
    node.innerHTML = `${thumbOf(entry)}${tag}${price}`;
    return node;
  }));
  $('deco-pop').classList.toggle('side', !!decoPop.side);
  updatePopSwipeHint();
}
// Gợi ý vuốt ngang trong bảng đổi món: còn thẻ bị cắt ở bên nào thì bên đó hiện dải mờ + mũi tên.
function updatePopSwipeHint() {
  const items = $('deco-pop-items'), box = $('deco-pop-scroll');
  box.classList.toggle('more-left', items.scrollLeft > 4);
  box.classList.toggle('more-right', items.scrollLeft + items.clientWidth < items.scrollWidth - 4);
}
$('deco-pop-items').addEventListener('scroll', updatePopSwipeHint, { passive: true });
$('deco-pop-items').addEventListener('click', event => {
  const entry = itemById(event.target.closest('.deco-opt')?.dataset.id);
  if (!entry || !decoPop) return;
  const deco = getDeco(), unlocked = decoUnlockedLevel(), status = itemStatus(deco, entry, unlocked);
  if (entry.cat === 'cats') {
    if (status === 'locked') return showToast(`Beat level ${entry.lock}, then claim it on the Map`);
    const next = applyAction(deco, entry, unlocked);
    if (next.error) return showToast(next.error);
    setDeco(next);
  } else if (!isOwned(deco, entry)) {
    // Kiểu chưa có: chạm lần đầu = xem thử trong phòng (chưa trừ xu); ưng thì chạm vào nút giá để mua + đặt luôn.
    // Chạm lại chính món đang xem = thôi xem. Không chuyển sang Shop.
    const fxKey = entry.cat === 'furniture' ? slotOf(entry) : entry.cat;
    if (popPreview === entry && event.target.closest('.deco-opt-price')) {
      const bought = buyToStock(deco, entry, unlocked);
      if (bought.error) return showToast(bought.error === 'Not enough coins' ? `Need ${entry.price - deco.coins} more coins` : bought.error);
      const placed = useItem(bought, entry);
      popPreview = null;
      setDeco(placed.error ? bought : placed);
      refreshWallet();
      playSound('reward');
      if (!room3d) buildFlatRooms();
      applyRoom(getDeco());
      room3d?.fx(fxKey, 'buy'); // pháo giấy + vòng sáng khi mua
      renderDeco();
      return renderDecoPop();
    }
    const status = shopStatus(deco, entry, unlocked);
    if (status === 'locked') return showToast(`Unlocks at level ${entry.lock}`);
    if (status === 'needBase') return showToast(`Build the ${itemById(entry.slot).name.toLowerCase()} first`);
    popPreview = popPreview === entry ? null : entry;
    playSound('pick');
    if (!room3d) buildFlatRooms();
    applyRoom(previewDeco(getDeco(), popPreview));
    if (popPreview) room3d?.fx(fxKey, 'preview'); // lấp lánh khi xem thử
    if (popPreview && status === 'poor') showToast(`Need ${entry.price - deco.coins} more coins`);
    return renderDecoPop();
  } else {
    const wasPreviewing = !!popPreview;
    popPreview = null;
    // Chạm món đang dùng khi đang xem thử món khác = thôi xem, phòng trở về như cũ.
    if (status === 'using') { if (wasPreviewing) { applyRoom(getDeco()); renderDecoPop(); } return; }
    const next = useItem(deco, entry);
    if (next.error) return showToast(next.error);
    setDeco(next);
  }
  playSound('pick');
  if (!room3d) buildFlatRooms();
  applyRoom(getDeco());
  if (entry.cat !== 'cats') room3d?.fx(entry.cat === 'furniture' ? slotOf(entry) : entry.cat, 'swap'); // làn khói + lấp lánh khi đổi kiểu
  renderDeco();
});
// Không có nút đóng: chạm ra ngoài bảng là đóng. Chạm trong cảnh 3D do onScenePick lo (chạm món khác = đổi sang bảng của
// món đó); nút cột trái tự bật / tắt bảng của nó.
document.addEventListener('pointerdown', event => {
  if (!decoPop || event.target.closest('#deco-pop, .deco-side, .room-canvas')) return;
  closeDecoPop();
}, true);
// Nút khoá (cột trái, dưới Ground): ẩn mọi UI mua bán / ví / thao tác + thanh tab để ngắm nhà; chỉ còn nút khoá và cài đặt,
// cả hai mờ đi (CSS: #deco.ui-locked, body.deco-locked). Rời Deco / mở lại Deco thì tự mở khoá.
let decoLocked = false;
function setDecoLock(on) {
  if (decoLocked === on) return;
  decoLocked = on;
  $('deco').classList.toggle('ui-locked', on);
  document.body.classList.toggle('deco-locked', on);
  const button = $('deco-lock');
  button.setAttribute('aria-pressed', on);
  button.setAttribute('aria-label', on ? 'Show buttons' : 'Hide buttons to view your home');
  button.title = on ? 'Show UI' : 'Hide UI';
  if (on) { decoPick = null; closeDecoPop(false); }
  if (!$('deco').hidden) renderDeco();
}
$('deco-lock').onclick = () => { playSound('pick'); setDecoLock(!decoLocked); };
// Cột trái (mèo / tường / sàn): bảng mở ngay bên phải nút, đuôi chỉ vào nút; chạm lại nút đang mở = đóng.
$('deco').querySelector('.deco-side').addEventListener('click', event => {
  const button = event.target.closest('[data-key]');
  if (!button) return;
  playSound('pick');
  if (decoPop?.key === button.dataset.key) return closeDecoPop();
  const rect = button.getBoundingClientRect();
  openDecoPop({ zone: getDeco().zone, key: button.dataset.key, x: rect.right, y: rect.top + rect.height / 2, side: true });
});
// Bảng đổi món luôn nằm PHÍA TRÊN món (bám theo món mỗi khung hình khi camera trượt / xoay / zoom — room3d.onFrame), đuôi chỉ xuống món.
// Phía trên không đủ chỗ (món ở sát mép trên) thì trượt camera cho món tụt xuống tới khi vừa. Bảng mở từ cột nút trái thì nằm
// bên phải nút.
function placeDecoPop() {
  if (!decoPop || $('deco').hidden) return;
  const pop = $('deco-pop'), screen = $('deco').getBoundingClientRect();
  // Dưới hàng ví và nút cài đặt (nút cài đặt nằm ngoài màn Deco, lớp cao hơn: bảng không được chui xuống dưới nó)
  const top = Math.max($('deco').querySelector('.wallet-hud').getBoundingClientRect().bottom, $('hub-settings').getBoundingClientRect().bottom) + 6;
  const bottom = $('deco').querySelector('.deco-dock').getBoundingClientRect().top - 6, minX = 8, maxX = screen.width - 8;
  const w = pop.offsetWidth, h = pop.offsetHeight, gap = 14;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  let x, y;
  if (decoPop.side) {
    x = Math.min(decoPop.x + gap, maxX - w);
    y = clamp(decoPop.y - 34, top, bottom - h);
    pop.style.setProperty('--tail-y', `${clamp(decoPop.y - y, 18, h - 18)}px`);
    pop.dataset.side = 'right';
  } else {
    const box = room3d?.screenRectOf(decoPop.key) || { left: decoPop.x, right: decoPop.x, top: decoPop.y };
    // Mép trên của khung bao trọn model (cả món phẳng như thảm: mép sau của thảm): bảng nằm trên hẳn, không đè lên phần nào.
    const cx = (box.left + box.right) / 2, need = top + h + gap - box.top;
    // Còn thiếu chỗ sau cú lướt: lướt bù một lần (room3d.nudge tự làm mượt, đang lướt thì đợi); chạm mép khu nhà thì thôi.
    if (need > 1 && !decoPop.stuck && room3d && !room3d.nudge(need)) decoPop.stuck = true;
    x = clamp(cx - w / 2, minX, maxX - w);
    y = Math.max(box.top - gap - h, top);
    pop.style.setProperty('--tail', `${clamp(cx - x, 18, w - 18)}px`);
    pop.dataset.side = 'above';
  }
  pop.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

// Ghim "NEW" bám theo món mỗi khung hình (room3d.onFrame); món đang mở bảng đổi thì ẩn ghim.
function placeDecoPins() {
  for (const pin of $('deco-pins').children) {
    const at = room3d?.screenOf(pin.dataset.slot);
    pin.hidden = !at || decoPop?.key === pin.dataset.slot;
    if (at) pin.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
  }
}

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
function runDecoTour() {
  const names = () => ZONES[getDeco().zone].cats;
  const plan = readText(SAVE_KEYS.decoTour) !== 'done' && guidedTourPlan();
  setDecoLock(false);
  closeDecoPop(false);
  const fencesStep = {
    target: () => [...$('deco').querySelectorAll('.deco-side [data-key="walls"], .deco-side [data-key="floors"]')],
    text: () => `${names().walls} and ${names().floors} come in other styles too. Buy them in the Shop, then pick one here.`,
    before: () => closeDecoPop(false),
  };
  const shopTab = { target: () => $('tabbar').querySelector('[data-tab="shop"]'), before: () => closeDecoPop(false) };
  if (!plan) {
    const middle = () => {
      const r = $('deco-room').getBoundingClientRect();
      return { left: r.left + r.width * .12, top: r.top + r.height * .22, width: r.width * .76, height: r.height * .4 };
    };
    return startDecoTour([
      { target: () => $('deco-cards').hidden ? $('deco').querySelector('.deco-dock') : $('deco-cards'),
        text: 'Swipe the tray and tap an item to preview it in your home. Tap Buy to build it!' },
      fencesStep,
      { target: middle, text: 'Tap any item in your home to swap its style. A NEW tag means a style you bought is waiting!' },
      { ...shopTab, text: 'More styles for every item live in the Shop. Let\u2019s take a look!', next: 'Open Shop',
        after: () => { if ($('shop').hidden) switchTab('shop'); } },
      { target: () => [$('shop-pages'), $('shop-deco-grid')], before: async () => { await waitFor(() => !$('shop').hidden); setShopPage('deco'); },
        text: 'Decoration: pick an area, tap a style to preview it, then buy. Back in Deco, tap the item to use it.' },
    ], tourDone);
  }
  const { base, variant } = plan, slot = slotOf(base);
  const card = () => $('deco-cards').querySelector(`[data-id="${base.id}"]`);
  const deco = getDeco();
  if (deco.zone !== 'garden') { setDeco({ ...deco, zone: 'garden' }); applyRoom(getDeco()); renderZoneSwitch(); }
  if (getDeco().coins < base.price) { setDeco({ ...getDeco(), coins: base.price }); refreshWallet(); }
  decoPick = null;
  renderDeco();
  const gift = () => {
    const current = getDeco(), zone = current.zones.garden;
    if (zone.owned.includes(variant.id)) return;
    setDeco({ ...current, zones: { ...current.zones, garden: { ...zone, owned: [...zone.owned, variant.id] } }, fresh: [...(current.fresh || []), variant.id] });
    renderDeco();
  };
  startDecoTour([
    { target: card, text: `Tap ${base.name} to see how it looks in your home.`, until: () => decoPick === base,
      // offsetLeft đo theo offsetParent (không phải khay) nên lệch; đo bằng rect để thẻ nằm gọn trong khay rồi mới sáng.
      before: async () => {
        const el = card(), tray = $('deco-cards');
        if (!el) return;
        tray.style.scrollBehavior = 'auto';
        tray.scrollLeft += el.getBoundingClientRect().left - tray.getBoundingClientRect().left - 12;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      } },
    { target: () => card()?.querySelector('[data-act="buy"]'), text: 'Love it? Tap Buy to build it. We topped up your coins!', until: () => isOwned(getDeco(), base), after: gift },
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
  ], tourDone);
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
  // Mở đầu: từ Home hub chỉ vào nút Deco (bàn tay chạm), vào Deco rồi một đoạn giải thích Deco là gì, sau đó mới tới ba cử chỉ.
  startDecoTour([
    { target: () => $('tabbar').querySelector('[data-tab="deco"]'), gesture: 'tap', bubble: 'above', until: () => !$('deco').hidden,
      text: 'Your garden is unlocked! Tap Deco to go visit it.' },
    { target: () => null, text: 'Welcome to your garden! Deco is where you decorate your home with furniture and cats live. Play levels to earn coins and buy new things!', next: 'Show me',
      before: async () => { await waitFor(() => !$('deco').hidden); await new Promise(resolve => setTimeout(resolve, 500)); } },
    gesture('drag', 'drag'),
    gesture('zoom', 'pinch'),
    gesture('twist', 'twist'),
  ], () => { watch.stop(); ob.setStage('L2'); }); // xong là tắt hướng dẫn, người chơi tự về Home hub chọn màn 2
}
// Chạy bước hướng dẫn đang chờ (gọi từ bảng kết quả bấm Continue, hoặc lúc mở game nếu đang dở).
export async function runOnboarding() {
  const stage = ob.stage();
  if (!ob.pending()) return;
  await switchTab(stage === 'basics' ? 'home' : 'deco'); // hướng dẫn Deco đầu tiên bắt đầu từ Home hub: chỉ vào nút Deco
  await new Promise(resolve => setTimeout(resolve, 600));
  if (stage === 'basics') runBasicsTour();
  else if (stage === 'decor') runDecoTour();
}

// ---------- Shop: 2 tab — "Shop" (gói khởi đầu, booster, gói xu) và "Decoration" (chỉ đồ trang trí) ----------
function setShopPage(page) {
  $('shop').dataset.page = page;
  $('shop-pages').querySelectorAll('[data-page]').forEach(tab => tab.setAttribute('aria-selected', tab.dataset.page === page));
  $('shop').scrollTop = 0;
}
$('shop-pages').addEventListener('click', event => {
  const tab = event.target.closest('[data-page]');
  if (!tab || tab.dataset.page === $('shop').dataset.page) return;
  playSound('pick');
  setShopPage(tab.dataset.page);
});

// ---------- Shop → Decoration: kiểu khác của món + tường / sàn khác, theo khu ----------
let shopZone = null;
function renderShopDeco() {
  const deco = getDeco(), unlocked = decoUnlockedLevel(), zones = ZONE_IDS.filter(zone => isZoneOpen(zone));
  if (!zones.includes(shopZone)) shopZone = zones.includes(deco.zone) ? deco.zone : zones[0];
  $('shop-deco-tabs').replaceChildren(...zones.map(zone => {
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', zone === shopZone);
    tab.className = zone === shopZone ? 'on' : '';
    tab.dataset.zone = zone;
    tab.textContent = ZONES[zone].name;
    return tab;
  }));
  // Tường và sàn: mỗi thứ MỘT hàng vuốt ngang. Đồ đạc: một lưới chung "Decoration" (3 món mỗi dòng, xếp liền theo thứ tự, không
  // xuống dòng riêng cho từng chỗ đặt) — các kiểu cùng chỗ vẫn đứng cạnh nhau; chỗ chưa mua được gì (chưa xây / khoá theo màn) xuống cuối.
  const names = ZONES[shopZone].cats, rows = new Map();
  shopCatalog(shopZone).filter(decoVisible).forEach(entry => {
    const key = entry.slot || entry.cat;
    rows.set(key, [...(rows.get(key) || []), [entry, shopStatus(deco, entry, unlocked)]]);
  });
  const rank = key => (key === 'walls' ? -2 : key === 'floors' ? -1 : 0) + (rows.get(key).some(([, status]) => status === 'buy' || status === 'poor' || status === 'owned') ? 0 : 10);
  const keys = [...rows.keys()].sort((a, b) => rank(a) - rank(b));
  const card = ([entry, status]) => {
    const node = document.createElement('button');
    node.className = `shop-deco-item ${status}`;
    node.dataset.id = entry.id;
    const price = status === 'owned' ? 'Owned ✓' : status === 'locked' ? `Lv ${entry.lock}` : status === 'needBase' ? 'Build first' : coin(entry.price);
    node.innerHTML = `${thumbOf(entry)}<span>${entry.name}</span><em>${price}</em>`;
    return node;
  };
  const section = (title, items, listClass) => {
    const row = document.createElement('section');
    row.className = 'shop-deco-row';
    row.innerHTML = `<h4 class="shop-deco-row-title">${title}</h4>`;
    const list = document.createElement('div');
    list.className = listClass;
    list.append(...items.map(card));
    row.append(list);
    return row;
  };
  const sections = ['walls', 'floors'].filter(key => rows.has(key)).map(key => {
    const items = rows.get(key), owned = items.filter(([, status]) => status === 'owned').length;
    return section(`${names[key]}<small>${owned}/${items.length} owned</small>`, items, 'shop-deco-strip');
  });
  const furniture = keys.filter(key => key !== 'walls' && key !== 'floors').flatMap(key => rows.get(key));
  if (furniture.length) sections.push(section('Decoration', furniture, 'shop-deco-wrap'));
  $('shop-deco-grid').replaceChildren(...sections);
}
$('shop-deco-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-zone]');
  if (!tab) return;
  playSound('pick');
  shopZone = tab.dataset.zone;
  renderShopDeco();
});
$('shop-deco-grid').addEventListener('click', event => {
  const entry = itemById(event.target.closest('.shop-deco-item')?.dataset.id);
  if (!entry) return;
  const status = shopStatus(getDeco(), entry, decoUnlockedLevel());
  if (status !== 'buy' && status !== 'poor') return buyDeco(entry); // đã có / khoá / chưa xây: báo lý do như cũ
  playSound('pick');
  openShopPreview(entry);
});
function buyDeco(entry) {
  const next = buyToStock(getDeco(), entry, decoUnlockedLevel());
  if (next.error) { showToast(next.error === 'Not enough coins' ? `Need ${entry.price - getDeco().coins} more coins` : next.error); return false; }
  setDeco(next);
  refreshWallet();
  playSound('reward');
  showToast(entry.slot ? `Bought ${entry.name}! Tap the ${itemById(entry.slot).name.toLowerCase()} in Deco to swap` : `Bought ${entry.name}! Tap the ${entry.cat === 'walls' ? ZONES[entry.zone].cats.walls.toLowerCase() : ZONES[entry.zone].cats.floors.toLowerCase()} in Deco to use it`);
  renderShopDeco();
  renderShopBoosters();
  shopBurst($('shop-deco-grid').querySelector(`[data-id="${entry.id}"]`));
  return true;
}
// Xem thử trước khi mua: popup dựng cảnh Deco (đúng khu của món) có đặt sẵn món đó, camera soi vào món; nút giá ở dưới = đồng ý mua.
// Không có WebGL (room3d null): popup hiện ảnh thu nhỏ của món thay cho cảnh.
let shopPreviewEntry = null;
function openShopPreview(entry) {
  shopPreviewEntry = entry;
  $('shop-preview-name').textContent = entry.name;
  $('shop-preview-buy').innerHTML = `Buy ${coin(entry.price)}`;
  $('shop-preview-buy').classList.toggle('poor', getDeco().coins < entry.price);
  const stage = $('shop-preview-stage');
  stage.replaceChildren();
  $('shop-preview').showModal();
  if (!room3d) { stage.innerHTML = thumbOf(entry); return; }
  applyRoom({ ...previewDeco(getDeco(), entry), zone: entry.zone });
  room3d.mount(stage, { mode: 'room', deco: true, resetView: true });
  // soi vào món sau khi khung đã có kích thước + cảnh vẽ xong một frame (đo cỡ món theo model đã dựng)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (shopPreviewEntry !== entry) return;
    room3d.frameItem(entry.id); // món vừa khít khung popup
    if (entry.cat === 'furniture') room3d.fx(slotOf(entry), 'preview');
  }));
}
function closeShopPreview() {
  if (!shopPreviewEntry) return;
  shopPreviewEntry = null;
  $('shop-preview').close();
  if (room3d) { room3d.stop(); applyRoom(getDeco()); }
}
// addEventListener: nút dùng chung class .settings-close, code cài đặt gán đè onclick cho mọi nút class này
$('shop-preview-close').addEventListener('click', closeShopPreview);
$('shop-preview').addEventListener('cancel', event => { event.preventDefault(); closeShopPreview(); });
$('shop-preview').addEventListener('click', event => { if (event.target === $('shop-preview')) closeShopPreview(); }); // chạm nền tối ngoài bảng
$('shop-preview-buy').onclick = () => { const entry = shopPreviewEntry; if (entry && buyDeco(entry)) closeShopPreview(); };
// Mua ở Shop thành công: sao + chấm màu bung ra từ thẻ món (DOM, không có cảnh 3D ở Shop).
const BURST_COLORS = ['#ff6f91', '#ffd23f', '#5fbe57', '#5ab8ff', '#b48cf0'];
function shopBurst(card) {
  if (!card || reduceMotion.matches) return;
  card.classList.remove('bought'); void card.offsetWidth; card.classList.add('bought');
  const box = card.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height * .4;
  for (let i = 0; i < 16; i++) {
    const bit = document.createElement('span'), a = (i / 16) * Math.PI * 2 + Math.random() * .3, d = 45 + Math.random() * 40, star = i % 3 === 0;
    bit.className = `shop-burst${star ? ' star' : ''}`;
    bit.textContent = star ? '✦' : '';
    bit.style.left = `${cx}px`; bit.style.top = `${cy}px`;
    bit.style.setProperty('--dx', `${Math.cos(a) * d}px`); bit.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
    bit.style.setProperty('--c', BURST_COLORS[i % BURST_COLORS.length]);
    bit.style.animationDelay = `${Math.random() * 60}ms`;
    document.body.append(bit);
    bit.addEventListener('animationend', () => bit.remove());
  }
}

// ===== Khu: vườn (màn 1–10; mở rộng khi thắng màn 10) / phòng khách (thắng màn 20) / phòng ngủ (30) / bếp (40). Mỗi khu lưu đồ riêng, mèo dùng chung. =====
const levelsCleared = () => clearedCount(loadProgress());
// Dev "mở hết khu" (nút Dev: Unlock all): xem được cả phần / món khoá ở màn game chưa có (vườn mở rộng: màn 30+). Lưu trong máy.
const DEV_ZONES_KEY = 'gomgom-dev-all-zones';
const devAllZones = () => DEV_MODE && readText(DEV_ZONES_KEY) === 'on';
const isZoneOpen = (zone, cleared = levelsCleared()) => zoneOpen(zone, cleared) || devAllZones();
const isGardenExpanded = () => gardenExpanded(levelsCleared()) || devAllZones();
const decoUnlockedLevel = () => devAllZones() ? Infinity : unlockedCount(loadProgress());
function renderZoneSwitch() {
  const cleared = levelsCleared();
  document.querySelectorAll('.zone-switch button').forEach(button => {
    const zone = button.dataset.zone, open = isZoneOpen(zone, cleared);
    button.classList.toggle('on', zone === getDeco().zone);
    button.classList.toggle('locked', !open);
    button.setAttribute('aria-selected', zone === getDeco().zone);
    const [built, total] = open ? builtCount(getDeco(), zone) : [0, 0];
    button.innerHTML = open ? `${ZONES[zone].name} <small>${built}/${total}</small>` : ZONES[zone].name;
    // Khu đã xây hết mọi chỗ: ẩn khỏi hàng chọn khu (vẫn tới được bằng cách kéo cảnh / chạm đồ trong khu đó)
    button.hidden = open && built === total;
  });
  $('deco-zone').hidden = ![...$('deco-zone').children].some(button => !button.hidden);
}
document.addEventListener('click', event => {
  const button = event.target.closest('.zone-switch button');
  if (!button) return;
  const zone = button.dataset.zone;
  if (!isZoneOpen(zone)) return showToast(`Beat level ${ZONES[zone].unlockAfter} to unlock the ${ZONES[zone].name.toLowerCase()}`);
  if (zone === getDeco().zone) return;
  setDeco({ ...getDeco(), zone });
  decoPick = null;
  closeDecoPop(false);
  renderZoneSwitch();
  renderDeco();
  applyRoom(getDeco()); // camera Deco lướt sang khu vừa chọn (nút chọn khu giờ chỉ còn ở Deco)
});

// Shop (tiền thật) vẫn là khung giao diện: bấm vào chỉ báo "sắp có".
document.addEventListener('click', event => { if (event.target.closest('.soon')) showToast('Coming soon!'); });

function renderShopBoosters() {
  $('shop-boosters').querySelectorAll('[data-buy]').forEach(button => {
    const id = button.dataset.buy;
    button.querySelector('small').textContent = `You have ${getBoosters()[id]}`;
    button.querySelector('em').innerHTML = priceTag(id);
    button.classList.toggle('poor', getDeco().coins < BOOSTERS.PRICE[id]);
  });
}
$('shop-boosters').addEventListener('click', event => {
  const button = event.target.closest('[data-buy]');
  if (button && buyOne(button.dataset.buy)) renderShopBoosters();
});

// Nút cài đặt (Home: ngày/đêm, âm thanh, hướng dẫn; màn chơi: âm thanh, hướng dẫn): bánh răng xổ menu.
// Chạm ra ngoài hoặc Esc thì đóng.
function setSettingsOpen(box, open) {
  menuOf(box).hidden = !open;
  box.querySelector('.settings-toggle').setAttribute('aria-expanded', open);
}
// Menu của một nút bánh răng: theo aria-controls (popup Settings ở Home nằm ngoài khối .settings, menu màn chơi nằm trong).
const menuOf = box => document.getElementById(box.querySelector('.settings-toggle').getAttribute('aria-controls'));
const settingsBoxes = [...document.querySelectorAll('.settings')];
const closeAllSettings = (except = null) => settingsBoxes.forEach(box => { if (box !== except) setSettingsOpen(box, false); });
settingsBoxes.forEach(box => {
  box.querySelector('.settings-toggle').onclick = () => {
    playSound('pick');
    // Mở từ màn chơi: popup hiện thêm hàng Home / Restart
    menuOf(box).classList.toggle('in-game', box.classList.contains('fg-settings'));
    setSettingsOpen(box, menuOf(box).hidden);
  };
});
// Chạm ra ngoài thì đóng; với popup, chạm nền tối (ngoài khung) cũng đóng.
// Bánh răng Home và màn chơi dùng chung một popup: giữ mọi hộp có popup chứa chỗ chạm (không chỉ hộp tìm thấy đầu tiên),
// không thì chạm nút trong popup đang mở từ màn chơi lại đóng nó trước khi nút kịp chạy.
document.addEventListener('pointerdown', event => {
  const inside = box => box.contains(event.target)
    || (menuOf(box).contains(event.target) && !(event.target === menuOf(box) && menuOf(box).classList.contains('settings-modal')));
  const keptMenus = new Set(settingsBoxes.filter(inside).map(menuOf));
  settingsBoxes.forEach(box => { if (!keptMenus.has(menuOf(box))) setSettingsOpen(box, false); });
});
// Hộp LiveOps (.lo-dialog: Daily, mạng...) mượn kiểu nút .settings-close nhưng tự đóng ở liveops-ui.js: không gán đè.
document.querySelectorAll('.settings-close:not(.lo-dialog .settings-close)').forEach(button => { button.onclick = () => { playSound('pick'); closeAllSettings(); }; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAllSettings(); });
// Home / Restart trong popup: đóng popup trước, play-controller.js hỏi lại rồi rời / chơi lại màn
['open-map', 'restart'].forEach(id => $(id).addEventListener('click', () => closeAllSettings()));
function renderSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach(button => {
    button.setAttribute('aria-pressed', soundOn());
    button.setAttribute('aria-label', soundOn() ? 'Sound on, tap to mute' : 'Sound off, tap to unmute');
    // Công tắc ON / OFF (popup Settings) hoặc nút icon loa (menu màn chơi).
    if (button.classList.contains('switch')) button.querySelector('b').textContent = soundOn() ? 'ON' : 'OFF';
    else button.innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${soundOn() ? 'sound' : 'mute'}"/></svg>`;
  });
}
document.querySelectorAll('.sound-toggle').forEach(button => { button.onclick = () => { setSound(!soundOn()); renderSoundButtons(); }; });
renderSoundButtons();

// Ánh sáng môi trường cho khu mèo (cảnh 3D ở Deco): Day / Afternoon (dusk) / Night. Lưu lại cho lần sau ('off' = ngày, 'dusk', 'on' = đêm).
const AMBIENTS = { off: 'day', dusk: 'dusk', on: 'night' };
let ambient = AMBIENTS[readText(SAVE_KEYS.night)] || 'day';
function applyAmbient() {
  document.querySelectorAll('#ambient-toggle [data-ambient]').forEach(button => button.setAttribute('aria-pressed', button.dataset.ambient === ambient));
  $('ambient-toggle').title = ambient === 'dusk' ? 'Afternoon' : ambient === 'night' ? 'Night' : 'Day';
  $('deco-room').classList.toggle('night', ambient === 'night');
  $('deco-room').classList.toggle('dusk', ambient === 'dusk');
  $('deco').classList.toggle('night', ambient === 'night'); // nền trời đêm của màn Deco (ui-portrait.css)
  $('deco').classList.toggle('dusk', ambient === 'dusk'); // nền trời chiều
  room3d?.setAmbient(ambient);
}
$('ambient-toggle').addEventListener('click', event => {
  const button = event.target.closest('[data-ambient]');
  if (!button || button.dataset.ambient === ambient) return;
  ambient = button.dataset.ambient;
  writeText(SAVE_KEYS.night, ambient === 'night' ? 'on' : ambient === 'dusk' ? 'dusk' : 'off');
  playSound('pick');
  applyAmbient();
});
applyAmbient();

// Music / Haptic / Notifications: lựa chọn của người chơi (mặc định bật), nhớ qua localStorage. Game chưa có nhạc nền /
// thông báo nên hiện chỉ lưu lại; Haptic rung nhẹ khi bật (máy có hỗ trợ). Đọc ở nơi khác qua prefOn(name).
const PREF_KEY = name => `gomgom-rotate-pref-${name}`;
export const prefOn = name => readText(PREF_KEY(name)) !== 'off';
function renderPrefs() {
  document.querySelectorAll('.pref-toggle').forEach(button => {
    const on = prefOn(button.dataset.pref);
    button.setAttribute('aria-pressed', on);
    button.setAttribute('aria-label', `${button.dataset.pref}: ${on ? 'on' : 'off'}`);
    button.querySelector('b').textContent = on ? 'ON' : 'OFF';
  });
}
document.querySelectorAll('.pref-toggle').forEach(button => {
  button.onclick = () => {
    const name = button.dataset.pref, on = !prefOn(name);
    writeText(PREF_KEY(name), on ? 'on' : 'off');
    playSound('pick');
    if (name === 'haptic' && on) navigator.vibrate?.(30);
    renderPrefs();
  };
});
renderPrefs();
// ===== Nút cho game dev: mở hết màn (3 sao) → mở luôn phòng khách + mèo khoá theo màn, cộng xu để thử Deco/Shop =====
const DEV_COINS = 99999;
document.querySelectorAll('.dev-only').forEach(row => { row.hidden = !DEV_MODE; });
$('dev-unlock').onclick = () => {
  closeAllSettings();
  saveProgress({ ...loadProgress(), stars: LEVELS.map(() => 3) });
  ob.setStage('done');
  writeText(DEV_ZONES_KEY, 'on'); // mở cả phần / món khoá ở màn chưa có (vườn mở rộng)
  setDeco({ ...getDeco(), coins: Math.max(getDeco().coins, DEV_COINS) });
  playSound('reward');
  showTab('home');
  showToast(`Dev: all ${LEVELS.length} levels + all areas unlocked · ${DEV_COINS.toLocaleString('en-US')} coins`);
};
// Reset: xoá tiến độ, deco/xu, booster, hồ sơ độ khó (giữ cài đặt âm thanh, ngày/đêm) rồi tải lại như người chơi mới.
// Hỏi lại bằng hộp thoại trong game: confirm() của trình duyệt bị webview / trình duyệt trong app chặn (trả về false ngay).
$('dev-reset').onclick = () => {
  closeAllSettings();
  $('dev-reset-dialog').showModal();
};
$('dev-reset-cancel').onclick = () => $('dev-reset-dialog').close();
$('dev-reset-ok').onclick = () => {
  ['progress', 'deco', 'boosters', 'profile', 'decoTour', 'onboarding'].forEach(key => { try { localStorage.removeItem(SAVE_KEYS[key]); } catch {} });
  try { localStorage.removeItem(DEV_ZONES_KEY); } catch {}
  location.reload();
};
// QC model 3D (qc.mjs): liệt kê lỗi model / chỗ đặt đồ. Mở game với ?qc thì tự chạy khi phòng 3D sẵn sàng.
function runQC() {
  if (!room3d) return showToast('3D room not ready yet');
  const report = room3d.qc();
  // Popup xem trước ở Shop: dựng thử từng món (mọi khu mở), soi như popup — còn bị che / quay mặt sau là lỗi.
  for (const entry of CATALOG.filter(e => e.cat === 'furniture')) {
    room3d.apply({ ...previewDeco(getDeco(), entry), zone: entry.zone }, { living: true, bedroom: true, kitchen: true, gardenExpand: true });
    room3d.qcPreview(entry.id).forEach(what => report.push({ level: 'error', zone: entry.zone, what: `preview: ${what}` }));
  }
  applyRoom(getDeco());
  const open = TABS.find(tab => !$(tab).hidden);
  if (open) mountRoom(open);
  const errors = report.filter(r => r.level === 'error');
  console.table(report);
  $('qc-title').textContent = errors.length ? `Model QC: ${errors.length} error(s), ${report.length - errors.length} warning(s)` : report.length ? `Model QC: no errors, ${report.length} warning(s)` : 'Model QC: all clear ✓';
  $('qc-list').replaceChildren(...report.map(r => Object.assign(document.createElement('li'), { className: r.level, textContent: `[${r.zone}] ${r.what}` })));
  $('qc-dialog').showModal();
  return report;
}
$('dev-qc').onclick = () => { closeAllSettings(); runQC(); };
