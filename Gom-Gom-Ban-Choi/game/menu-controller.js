// ===== Luồng điều khiển MENU (giao diện ngoài màn chơi) =====
// Home hub = bản đồ màn (ví, liveops), Deco / Shop (thanh tab, phòng 3D, mua / đặt đồ, chọn khu), cài đặt (âm thanh, ngày / đêm, hướng dẫn)
// và nút dev. Vào màn chơi thì gọi qua `play` (play-controller.js, nối ở gom-gom.js).
import { categories, catMarkup, addArt as addCatArt } from './ui/cat-art.mjs';
import { LEVELS, LETTERS } from './gameplay/levels.mjs';
import { loadProgress, saveProgress, unlockedCount, levelsCleared as clearedCount, levelTier } from './gameplay/progression.mjs';
import { BOOSTERS } from './gameplay/tuning.mjs';
import { playSound, soundOn, setSound } from './ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from './gameplay/save.mjs';
import { ZONES, ZONE_IDS, CATALOG, MAX_ROOM_CATS, zoneOpen, gardenExpanded, slotGroups, itemById, itemStatus, applyAction, previewDeco, claimCat, isCatClaimed,
  isOwned, catalogFor, slotOf, shopCatalog, shopStatus, buyToStock, ownedOptions, useItem, freshKeys, clearFresh } from './deco/deco-data.mjs';
import { $, reduceMotion, DEV_MODE, showToast, getDeco, setDeco, refreshWallet, getBoosters, buyOne, priceTag } from './shared.js';

// Luồng màn chơi (startLevel, mapTier): gom-gom.js nối vào lúc khởi động.
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
const SETTINGS_TABS = ['home', 'deco'];
function markTab(tab) {
  $('tabbar').hidden = false;
  $('hub-settings').hidden = !SETTINGS_TABS.includes(tab);
  $('tabbar').querySelectorAll('.tab').forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
// Bản đồ 3D (deco/map-world.mjs: trống cỏ lăn như Animal Crossing). Máy không có WebGL / lỗi nạp thì dùng bản đồ 2D ở trên.
let map3d = null, map3dFailed = false, catShowcase = null;
const map3dReady = import('./deco/map-world.mjs').then(({ createMapWorld, catShowcase: showcase }) => {
  catShowcase = showcase;
  map3d = createMapWorld($('map-3d'), {
    avatarSvg: catMarkup.orange,
    onPick: index => { map3d.stop(); $('map').hidden = true; play.startLevel(index); },
    onClaim: (breed, index) => showCatReward(breed, () => {
      setDeco(claimCat(getDeco(), breed));
      map3d.render(mapLevels());
      map3d.focus(index, false);
    }),
  });
}).catch(error => { map3dFailed = true; console.warn('Map 3D off:', error); });
function mapLevels() {
  const progress = loadProgress(), open = unlockedCount(progress), seen = new Set(), deco = getDeco();
  return LEVELS.map((level, index) => {
    // Giống mèo lần đầu xuất hiện ở màn này: bản đồ dựng mèo 3D giống đó cạnh màn (mèo đã nhận thì về nhà, không hiện nữa).
    // Thắng màn rồi mà chưa nhận: nhãn NEW! thành nút Claim.
    const newCats = [...level.cats].filter(ch => !seen.has(ch)).map(ch => (seen.add(ch), LETTERS[ch])).filter(breed => !isCatClaimed(deco, breed));
    return { locked: index >= open, current: index === open - 1, tier: play.mapTier(index, index === open - 1).style, newCats, claimable: !!progress.stars[index] };
  });
}
// Màn hình nhận thưởng mèo (kiểu "You got" của game mobile): tia sáng xoay, mèo bật ra, độ hiếm + tên, "Tap to claim".
// Chạm (sau khi hiện xong) thì mèo bay đi, gọi onClaimed, báo toast mèo đã về nhà.
const CAT_RARITY = { orange: 'Common', gray: 'Common', white: 'Common', tabby: 'Rare', siamese: 'Epic', tuxedo: 'Legendary' };
function showCatReward(breed, onClaimed) {
  const rarity = CAT_RARITY[breed] || 'Rare', name = categories[breed].name;
  const screen = document.createElement('div');
  screen.className = 'cat-reward';
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
  try { showcase = catShowcase?.(screen.querySelector('.cr-cat'), breed, { reduceMotion }); } catch (error) { console.warn('Cat showcase off:', error); }
  if (!showcase) screen.querySelector('.cr-cat').insertAdjacentHTML('afterbegin', catMarkup[breed]);
  playSound('reward');
  let ready = false, done = false;
  setTimeout(() => { ready = true; screen.classList.add('ready'); }, reduceMotion ? 0 : 900);
  screen.addEventListener('click', () => {
    if (!ready || done) return;
    done = true;
    playSound('pick');
    onClaimed();
    screen.classList.add('closing');
    const roomy = getDeco().cats.includes(breed);
    setTimeout(() => { showcase?.stop(); screen.remove(); showToast(roomy ? `${name} moved into your home!` : `${name} is waiting in Deco (room is full)`); }, reduceMotion ? 0 : 450);
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
  if (tab === 'shop') { renderShopBoosters(); renderShopDeco(); }
  renderZoneSwitch();
  mountRoom(tab);
  $(tab).scrollTop = 0;
}
// Vườn và phòng khách nối liền thành một khu nhà; phòng khách chỉ có khi đã mở (thắng màn 10). Chỉ Deco dựng cảnh này.
const applyRoom = shown => room3d?.apply(shown, { living: isZoneOpen('living'), bedroom: isZoneOpen('bedroom'), gardenExpand: isGardenExpanded() });
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
$('home-starter').onclick = () => { playSound('pick'); setShopPage('store'); showTab('shop'); }; // gói khởi đầu nằm đầu tab Shop
$('tabbar').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab || tab.getAttribute('aria-current')) return;
  playSound('pick');
  showTab(tab.dataset.tab);
});

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
buildFlatRooms();
// Cảnh 3D nạp xong (phòng + bản đồ): màn loading (gom-gom.js) đợi cái này rồi mới tắt.
const roomReady = import('./deco/deco-room.mjs').then(({ createRoom, thumbnail }) => {
  room3d = createRoom();
  if (DEV_MODE && new URLSearchParams(location.search).has('qc')) setTimeout(runQC, 500);
  room3d.setNight(night);
  decoThumbnail = thumbnail;
  room3d.onPick(onScenePick);
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
  cards.replaceChildren(...todo.map(base => {
    const status = itemStatus(deco, base, unlocked), picked = decoPick === base;
    const card = document.createElement('button');
    card.className = `deco-card ${status}${picked ? ' picked' : ''}`;
    card.dataset.id = base.id;
    card.setAttribute('role', 'listitem');
    const foot = status === 'locked' ? `<em class="deco-card-price lock">🔒 Lv ${base.lock}</em>`
      : picked && status === 'buy' ? `<em class="deco-card-price act" data-act="buy">Buy ${coin(base.price)}</em>`
      : `<em class="deco-card-price">${coin(base.price)}</em>`;
    card.innerHTML = `<span class="deco-card-art">${thumbOf(base)}</span><span class="deco-card-name">${base.name}</span>${foot}`;
    return card;
  }));
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
  decoPop = spec;
  // Bảng đổi kiểu một món: camera khoá ở góc đã căn tới khi bảng đóng (bảng mèo / tường / sàn thì không)
  room3d?.lockView(!['cats', 'walls', 'floors'].includes(spec.key));
  if (spec.key !== 'cats') setDeco(clearFresh(getDeco(), spec.zone, spec.key)); // đã xem món mới -> thôi sáng
  if (decoPick) { decoPick = null; applyRoom(getDeco()); }
  renderDeco();
  $('deco-pop').hidden = false;
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
  $('deco-pop').hidden = true;
  room3d?.lockView(false);
  room3d?.focus(null, false);
  if (render) renderDeco();
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
  const title = { cats: `Cats · ${deco.cats.length}/${MAX_ROOM_CATS}`, walls: names.walls, floors: names.floors }[decoPop.key] ?? using?.name ?? itemById(decoPop.key).name;
  $('deco-pop-title').textContent = title;
  $('deco-pop-items').replaceChildren(...options.map(entry => {
    const shop = entry.cat !== 'cats' && !isOwned(deco, entry), status = shop ? shopStatus(deco, entry, unlocked) : itemStatus(deco, entry, unlocked);
    const node = document.createElement('button');
    node.className = `deco-opt ${status}${shop ? ' in-shop' : ''}`;
    node.dataset.id = entry.id;
    const tag = status === 'using' ? '<b class="deco-opt-tag">✓</b>' : status === 'locked' && !shop ? '<b class="deco-opt-tag lock">🔒</b>' : '';
    const price = !shop ? '' : status === 'locked' ? `<em class="deco-opt-price lock">🔒 Lv ${entry.lock}</em>` : `<em class="deco-opt-price">${coin(entry.price)}</em>`;
    node.innerHTML = `${thumbOf(entry)}<span class="deco-opt-name">${entry.name}</span>${tag}${price}`;
    return node;
  }));
  $('deco-pop').classList.toggle('side', !!decoPop.side);
}
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
    return goShopItem(entry); // kiểu chưa có: sang Shop, cuộn tới đúng món đó
  } else {
    if (status === 'using') return;
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
function goShopItem(entry) {
  playSound('pick');
  shopZone = entry.zone;
  closeDecoPop(false);
  setShopPage('deco');
  showTab('shop');
  const card = $('shop-deco-grid').querySelector(`[data-id="${entry.id}"]`);
  card?.scrollIntoView({ block: 'center', inline: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); // cuộn cả hàng ngang tới món
  card?.classList.add('flash');
  setTimeout(() => card?.classList.remove('flash'), 1600);
}
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
    // Còn thiếu chỗ sau cú lướt: trượt bù từ từ; chạm mép khu nhà (không dời được nữa) thì thôi, không giằng co rung camera.
    if (need > 1 && !decoPop.stuck && room3d && !room3d.nudge(Math.min(need * .12, 8))) decoPop.stuck = true;
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
  // Mỗi chỗ đặt (và tường, sàn) là MỘT hàng: các kiểu cùng chỗ nằm chung hàng, nhiều thì vuốt ngang. Tường / sàn lên đầu, rồi các
  // chỗ đồ theo thứ tự danh mục; hàng chưa mua được gì (chưa xây chỗ / khoá theo màn) xuống cuối.
  const names = ZONES[shopZone].cats, rows = new Map();
  shopCatalog(shopZone).filter(decoVisible).forEach(entry => {
    const key = entry.slot || entry.cat;
    rows.set(key, [...(rows.get(key) || []), [entry, shopStatus(deco, entry, unlocked)]]);
  });
  const rank = key => (key === 'walls' ? -2 : key === 'floors' ? -1 : 0) + (rows.get(key).some(([, status]) => status === 'buy' || status === 'poor' || status === 'owned') ? 0 : 10);
  const keys = [...rows.keys()].sort((a, b) => rank(a) - rank(b));
  $('shop-deco-grid').replaceChildren(...keys.map(key => {
    const row = document.createElement('section');
    row.className = 'shop-deco-row';
    // Tiêu đề hàng chỉ cho tường / sàn; hàng đồ đạc không cần tên (thẻ đã có ảnh + tên món)
    const items = rows.get(key);
    if (key === 'walls' || key === 'floors') {
      const owned = items.filter(([, status]) => status === 'owned').length;
      row.innerHTML = `<h4 class="shop-deco-row-title">${names[key]}<small>${owned}/${items.length} owned</small></h4>`;
    } else if (key === keys.find(other => other !== 'walls' && other !== 'floors')) {
      row.innerHTML = '<h4 class="shop-deco-row-title">Decoration</h4>'; // một tiêu đề chung trên cụm đồ đạc (dưới Floors / Ground)
    }
    const strip = document.createElement('div');
    strip.className = 'shop-deco-strip';
    strip.append(...items.map(([entry, status]) => {
      const card = document.createElement('button');
      card.className = `shop-deco-item ${status}`;
      card.dataset.id = entry.id;
      const price = status === 'owned' ? 'Owned ✓' : status === 'locked' ? `🔒 Lv ${entry.lock}` : status === 'needBase' ? '🔒 Build first' : coin(entry.price);
      card.innerHTML = `${thumbOf(entry)}<span>${entry.name}</span><em>${price}</em>`;
      return card;
    }));
    row.append(strip);
    return row;
  }));
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
  const next = buyToStock(getDeco(), entry, decoUnlockedLevel());
  if (next.error) return showToast(next.error === 'Not enough coins' ? `Need ${entry.price - getDeco().coins} more coins` : next.error);
  setDeco(next);
  refreshWallet();
  playSound('reward');
  showToast(entry.slot ? `Bought ${entry.name}! Tap the ${itemById(entry.slot).name.toLowerCase()} in Deco to swap` : `Bought ${entry.name}! Tap the ${entry.cat === 'walls' ? ZONES[entry.zone].cats.walls.toLowerCase() : ZONES[entry.zone].cats.floors.toLowerCase()} in Deco to use it`);
  renderShopDeco();
  renderShopBoosters();
  shopBurst($('shop-deco-grid').querySelector(`[data-id="${entry.id}"]`));
});
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

// ===== Khu: vườn (màn 1–10; mở rộng khi thắng màn 30) / phòng khách (thắng màn 10) / phòng ngủ (15). Mỗi khu lưu đồ riêng, mèo dùng chung. =====
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
    button.innerHTML = open ? `${ZONES[zone].name} <small>${built}/${total}</small>` : `🔒 ${ZONES[zone].name}`;
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
document.querySelectorAll('.settings-close').forEach(button => { button.onclick = () => { playSound('pick'); closeAllSettings(); }; });
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

// Ngày / đêm cho khu mèo (cảnh 3D ở Deco). Lưu lại cho lần sau.
let night = readText(SAVE_KEYS.night) === 'on';
function applyNight() {
  const button = $('night-toggle');
  button.setAttribute('aria-pressed', night);
  button.setAttribute('aria-label', night ? 'Night, tap for day' : 'Day, tap for night');
  button.title = night ? 'Night' : 'Day';
  $('deco-room').classList.toggle('night', night);
  room3d?.setNight(night);
}
$('night-toggle').onclick = () => { night = !night; writeText(SAVE_KEYS.night, night ? 'on' : 'off'); playSound('pick'); applyNight(); };
applyNight();

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
  ['progress', 'deco', 'boosters', 'profile'].forEach(key => { try { localStorage.removeItem(SAVE_KEYS[key]); } catch {} });
  try { localStorage.removeItem(DEV_ZONES_KEY); } catch {}
  location.reload();
};
// QC model 3D (qc.mjs): liệt kê lỗi model / chỗ đặt đồ. Mở game với ?qc thì tự chạy khi phòng 3D sẵn sàng.
function runQC() {
  if (!room3d) return showToast('3D room not ready yet');
  const report = room3d.qc(), errors = report.filter(r => r.level === 'error');
  console.table(report);
  $('qc-title').textContent = errors.length ? `Model QC: ${errors.length} error(s), ${report.length - errors.length} warning(s)` : report.length ? `Model QC: no errors, ${report.length} warning(s)` : 'Model QC: all clear ✓';
  $('qc-list').replaceChildren(...report.map(r => Object.assign(document.createElement('li'), { className: r.level, textContent: `[${r.zone}] ${r.what}` })));
  $('qc-dialog').showModal();
  return report;
}
$('dev-qc').onclick = () => { closeAllSettings(); runQC(); };
