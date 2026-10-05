// ===== Luồng điều khiển MENU (giao diện ngoài màn chơi) =====
// Bản đồ màn, Home / Deco / Shop (thanh tab, phòng 3D, mua / đặt đồ, chọn khu), cài đặt (âm thanh, ngày / đêm, hướng dẫn)
// và nút dev. Vào màn chơi thì gọi qua `play` (play-controller.js, nối ở gom-gom.js).
import { categories, catMarkup, addArt as addCatArt } from './ui/cat-art.mjs';
import { LEVELS } from './gameplay/levels.mjs';
import { loadProgress, saveProgress, unlockedCount, levelsCleared as clearedCount, levelTier } from './gameplay/progression.mjs';
import { BOOSTERS } from './gameplay/tuning.mjs';
import { playSound, soundOn, setSound } from './ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from './gameplay/save.mjs';
import { ZONES, MAX_ROOM_CATS, zoneOpen, gardenExpanded, slotGroups, itemById, itemStatus, applyAction, previewDeco, occupantOf } from './deco/deco-data.mjs';
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

// Thanh tab chung hiện ở Home / Map / Deco / Shop, đánh dấu mục đang mở.
function markTab(tab) {
  $('tabbar').hidden = false;
  $('tabbar').querySelectorAll('.tab').forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
// Bản đồ 3D (deco/map-world.mjs: trống cỏ lăn như Animal Crossing). Máy không có WebGL / lỗi nạp thì dùng bản đồ 2D ở trên.
let map3d = null, map3dFailed = false;
const map3dReady = import('./deco/map-world.mjs').then(({ createMapWorld }) => {
  map3d = createMapWorld($('map-3d'), {
    avatarSvg: catMarkup.orange,
    onPick: index => { map3d.stop(); $('map').hidden = true; play.startLevel(index); },
  });
}).catch(error => { map3dFailed = true; console.warn('Map 3D off:', error); });
function mapLevels() {
  const open = unlockedCount(loadProgress());
  return LEVELS.map((level, index) => ({ locked: index >= open, current: index === open - 1, tier: play.mapTier(index, index === open - 1).style }));
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

export function showMap() {
  hideMenus();
  markTab('map');
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

// ===== Home / Deco / Shop: các tab dùng chung thanh điều hướng nổi, chỉ hiện ngoài màn chơi =====
const TABS = ['home', 'deco', 'shop'];
export const menuOpen = () => TABS.some(tab => !$(tab).hidden);
let room3d = null; // phòng 3D, có sau khi nạp xong Three.js; null thì dùng phòng CSS phẳng
let decoThumbnail = null; // chụp model 3D làm ảnh cho ô đồ (có sau khi nạp Three.js)
let decoCat = 'furniture', decoPick = null;

export function hideMenus() {
  TABS.forEach(tab => { $(tab).hidden = true; });
  $('tabbar').hidden = true;
  decoPick = null;
  room3d?.stop();
  map3d?.stop();
}
export function showTab(tab) {
  TABS.forEach(name => { $(name).hidden = name !== tab; });
  markTab(tab);
  $('map').hidden = true;
  $('tutorial').hidden = true;
  refreshWallet();
  if (tab !== 'deco') decoPick = null;
  if (tab === 'deco') renderDeco();
  if (tab === 'shop') renderShopBoosters();
  renderZoneSwitch();
  mountRoom(tab);
  $(tab).scrollTop = 0;
}
// Vườn và phòng khách nối liền thành một khu nhà; phòng khách chỉ có khi đã mở (thắng màn 10).
const applyRoom = shown => room3d?.apply(shown, { living: isZoneOpen('living'), bedroom: isZoneOpen('bedroom'), gardenExpand: isGardenExpanded() });
function mountRoom(tab) {
  if (!room3d) return;
  if (tab === 'shop') return room3d.stop();
  applyRoom(tab === 'deco' ? decoShown() : getDeco());
  // Home = khu nhà: kéo để đi qua các khu, chụm để thu nhỏ xem toàn bộ. Deco = khoá vào khu đang trang trí.
  room3d.mount($(`${tab}-room`), { mode: tab === 'home' ? 'hub' : 'room', resetView: tab === 'home', view: tab === 'home' ? HOME_VIEW : undefined });
}
// Home tràn viền: phòng phủ cả màn, nút / pill đè lên; camera nhắm vào đúng ô đảo vườn của bản Figma (.fh-island).
const HOME_VIEW = {
  zoomCap: 1.15, zoomFit: .95, // ô đảo rộng hơn cao nhiều nên zoom chạm trần: zoomCap quyết định cỡ vườn
  insets() {
    const room = $('home-room').getBoundingClientRect(), island = document.querySelector('.fh-island').getBoundingClientRect();
    return { top: island.top - room.top, bottom: room.bottom - island.bottom };
  },
};
$('home-starter').onclick = () => { playSound('pick'); showTab('shop'); }; // gói khởi đầu nằm đầu trang Shop
$('tabbar').addEventListener('click', event => {
  const tab = event.target.closest('.tab');
  if (!tab || tab.getAttribute('aria-current')) return;
  playSound('pick');
  if (tab.dataset.tab === 'map') showMap(); else showTab(tab.dataset.tab);
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
  buildRoom($('home-room'), getDeco().cats.slice(0, 3));
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
import('./deco/deco-room.mjs').then(({ createRoom, thumbnail }) => {
  room3d = createRoom();
  if (DEV_MODE && new URLSearchParams(location.search).has('qc')) setTimeout(runQC, 500);
  room3d.setNight(night);
  decoThumbnail = thumbnail;
  $('home-room').replaceChildren();
  $('deco-room').replaceChildren();
  $('home-room').classList.add('is-3d');
  $('deco-room').classList.add('is-3d');
  const open = TABS.find(tab => !$(tab).hidden);
  if (open) mountRoom(open);
  if (open === 'deco') renderDeco(); // thay quả cầu màu bằng ảnh chụp model
}).catch(error => console.warn('3D room unavailable, using the flat room.', error));

// ===== Deco: mua / đặt đồ, đổi tường, sàn, chọn mèo. Chọn món = xem trước ngay trong phòng. =====
// Danh sách gom theo chỗ đặt: mỗi khung là các món "chọn một" chung một vị trí (đồ: món gốc + phương án; tường / sàn: cả mục).
// Mỗi ô có nhãn trạng thái (✓ In room / Owned / ⇄ Swap / giá / 🔒). Chạm một món: xem trước trong phòng, nhãn của chính ô đó
// thành nút hành động (Buy / Swap / Place / Remove) — chạm nhãn là làm luôn; chạm lại ô = bỏ chọn.
const FURNISHING = entry => entry.cat === 'furniture' || entry.cat === 'cats';
// Đồ phần vườn mở rộng chỉ hiện khi vườn đã mở rộng (trước đó chúng chưa có chỗ trong cảnh; danh sách đỡ dài).
const decoVisible = entry => entry.area !== 'garden2' || isGardenExpanded();
const decoShown = () => previewDeco(getDeco(), decoPick);
const coin = amount => `<span class="amt"><i class="ico-coin"></i>${amount}</span>`; // xu + số không bị ngắt dòng
// Nhãn trạng thái của một món trên ô: [chữ, kiểu nhãn]
function decoBadge(entry, status) {
  if (status === 'locked') return [`🔒 Lv ${entry.lock}`, 'lock'];
  if (status === 'using') return [FURNISHING(entry) ? '✓ In room' : '✓ Using', 'using'];
  if (status === 'owned') {
    if (entry.cat === 'cats') return ['+ Add', 'owned'];
    const swap = entry.cat === 'furniture' ? occupantOf(getDeco(), entry) : true; // tường / sàn: luôn có một món đang dùng
    return swap ? ['⇄ Swap', 'swap'] : ['Owned', 'owned'];
  }
  return [coin(entry.price), status]; // buy / poor
}
// Nút hành động thay nhãn khi món đang được chọn; null = không làm gì được (khoá, thiếu xu, tường / sàn đang dùng).
function decoActionLabel(entry, status) {
  if (status === 'buy') return `Buy ${coin(entry.price)}`;
  if (status === 'owned') return entry.cat === 'cats' ? '+ Add' : decoBadge(entry, status)[1] === 'swap' ? '⇄ Swap' : FURNISHING(entry) ? 'Place' : 'Use';
  if (status === 'using' && FURNISHING(entry)) return 'Remove';
  return null;
}
function decoGroupTitle(group) {
  const cat = group[0].cat;
  if (cat === 'cats') return `Up to ${MAX_ROOM_CATS} cats in the room`;
  if (cat !== 'furniture') return `${ZONES[getDeco().zone].cats[cat]} · pick one`;
  return ''; // đồ: mỗi khung là một chỗ — giải thích một lần ở dòng gợi ý phía trên
}
function renderDeco() {
  const unlocked = decoUnlockedLevel(), deco = getDeco();
  $('deco').querySelectorAll('.chip').forEach(chip => { chip.textContent = ZONES[deco.zone].cats[chip.dataset.cat]; });
  $('deco-grid').classList.toggle('compact', decoCat === 'furniture');
  $('deco-grid').replaceChildren(...slotGroups(deco.zone, decoCat).map(group => group.filter(decoVisible)).filter(group => group.length).map(group => {
    const box = document.createElement('div');
    box.className = `deco-group${group.length > 2 ? ' wide' : ''}`;
    const title = decoGroupTitle(group);
    if (title) box.innerHTML = `<p class="deco-group-title">${title}</p>`;
    const row = document.createElement('div');
    row.className = 'deco-group-items';
    row.append(...group.map(entry => {
      const status = itemStatus(deco, entry, unlocked), [label, kind] = decoBadge(entry, status);
      const action = decoPick === entry ? decoActionLabel(entry, status) : null;
      const node = document.createElement('button');
      node.className = `deco-item ${status}${decoPick === entry ? ' picked' : ''}`;
      node.dataset.id = entry.id;
      const thumb = entry.breed ? `<span class="thumb cat-thumb">${catMarkup[entry.breed]}</span>`
        : decoThumbnail ? `<img class="thumb thumb-3d" src="${decoThumbnail(entry)}" alt="">`
        : `<span class="thumb" style="--c:${entry.color}"></span>`;
      const badge = action ? `<em class="badge act" data-act="apply">${action}</em>` : `<em class="badge ${kind}">${label}</em>`;
      node.innerHTML = `${thumb}<span class="deco-name">${entry.name}</span>${badge}`;
      return node;
    }));
    box.append(row);
    return box;
  }));
}
function pickDeco(entry) {
  decoPick = entry;
  applyRoom(decoShown());
  if (entry) room3d?.focus(entry.id);
  renderDeco();
}
$('deco-grid').addEventListener('click', event => {
  if (event.target.closest('[data-act="apply"]')) return applyDecoPick();
  const entry = itemById(event.target.closest('.deco-item')?.dataset.id);
  if (!entry) return;
  if (decoPick === entry) return pickDeco(null); // chạm lại món đang xem = bỏ chọn
  pickDeco(entry);
  const status = itemStatus(getDeco(), entry, decoUnlockedLevel());
  if (status === 'locked') showToast(`Unlocks at level ${entry.lock}`);
  if (status === 'poor') showToast(`Need ${entry.price - getDeco().coins} more coins`);
});
function applyDecoPick() {
  if (!decoPick) return;
  const unlocked = decoUnlockedLevel();
  const next = applyAction(getDeco(), decoPick, unlocked);
  if (next.error) return showToast(next.error);
  const bought = next.coins < getDeco().coins;
  setDeco(next);
  refreshWallet();
  if (bought) showToast(`Bought ${decoPick.name}!`);
  playSound(bought ? 'reward' : 'pick');
  if (!room3d) buildFlatRooms();
  // Vừa gỡ ra thì bỏ chọn luôn, không thì bản xem trước lại đặt món đó vào phòng.
  pickDeco(itemStatus(getDeco(), decoPick, unlocked) === 'using' ? decoPick : null);
}
$('deco').querySelector('.chips').addEventListener('click', event => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  chip.parentElement.querySelectorAll('.chip').forEach(other => {
    other.classList.toggle('on', other === chip);
    other.setAttribute('aria-selected', other === chip);
  });
  decoCat = chip.dataset.cat;
  pickDeco(null);
});

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
    button.innerHTML = open ? ZONES[zone].name : `🔒 ${ZONES[zone].name}`;
  });
}
document.addEventListener('click', event => {
  const button = event.target.closest('.zone-switch button');
  if (!button) return;
  const zone = button.dataset.zone;
  if (!isZoneOpen(zone)) return showToast(`Beat level ${ZONES[zone].unlockAfter} to unlock the ${ZONES[zone].name.toLowerCase()}`);
  if (zone === getDeco().zone) return;
  setDeco({ ...getDeco(), zone });
  decoPick = null;
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

$('help').onclick = () => $('help-dialog').showModal();
// Nút cài đặt (Home: ngày/đêm, âm thanh, hướng dẫn; màn chơi: âm thanh, hướng dẫn): bánh răng xổ menu.
// Chạm ra ngoài hoặc Esc thì đóng.
function setSettingsOpen(box, open) {
  box.querySelector('.settings-menu').hidden = !open;
  box.querySelector('.settings-toggle').setAttribute('aria-expanded', open);
}
const closeAllSettings = (except = null) => document.querySelectorAll('.settings').forEach(box => { if (box !== except) setSettingsOpen(box, false); });
document.querySelectorAll('.settings').forEach(box => {
  box.querySelector('.settings-toggle').onclick = () => { playSound('pick'); setSettingsOpen(box, box.querySelector('.settings-menu').hidden); };
});
document.addEventListener('pointerdown', event => closeAllSettings(event.target.closest('.settings')));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAllSettings(); });
['home-help', 'game-help'].forEach(id => { $(id).onclick = () => { closeAllSettings(); $('help-dialog').showModal(); }; });
function renderSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach(button => {
    button.setAttribute('aria-pressed', soundOn());
    button.setAttribute('aria-label', soundOn() ? 'Sound on, tap to mute' : 'Sound off, tap to unmute');
    button.innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${soundOn() ? 'sound' : 'mute'}"/></svg>`;
  });
}
document.querySelectorAll('.sound-toggle').forEach(button => { button.onclick = () => { setSound(!soundOn()); renderSoundButtons(); }; });
renderSoundButtons();

// Ngày / đêm cho khu mèo (Home + Deco dùng chung một cảnh 3D). Lưu lại cho lần sau.
let night = readText(SAVE_KEYS.night) === 'on';
function applyNight() {
  const button = $('night-toggle');
  button.setAttribute('aria-pressed', night);
  button.setAttribute('aria-label', night ? 'Night, tap for day' : 'Day, tap for night');
  button.title = night ? 'Night' : 'Day';
  button.innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${night ? 'moon' : 'sun'}"/></svg>`;
  ['home-room', 'deco-room'].forEach(id => $(id).classList.toggle('night', night));
  room3d?.setNight(night);
}
$('night-toggle').onclick = () => { night = !night; writeText(SAVE_KEYS.night, night ? 'on' : 'off'); playSound('pick'); applyNight(); };
applyNight();
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
$('dev-reset').onclick = () => {
  closeAllSettings();
  if (!confirm('Dev: reset ALL progress (levels, coins, deco, boosters, difficulty profile)?')) return;
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
$('home-play').onclick = () => play.startLevel(unlockedCount(loadProgress()) - 1);
$('map-back').onclick = () => showTab('home');
