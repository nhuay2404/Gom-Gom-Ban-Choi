// Khu (vườn, phòng khách, phòng ngủ, bếp...): chuyển khu, thẻ "khu kế tiếp" + bảng mở khu (đủ màn → tiêu xu → khánh thành).
// Sang Unity: AreaSwitcher + AreaUnlockPanel.
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import { AREA_UNLOCK } from '../data/economy.mjs';
import { playSound } from '../ui/sound.mjs';
import { readText } from '../core/save.mjs';
import { ZONES, AREA_NAMES, AREA_ORDER, areaOpen, areaState, nextArea, unlockArea } from '../deco/deco-data.mjs';
import { $, DEV_MODE, showToast, getDeco, setDeco, refreshWallet } from '../app/shared.js';
import { builtCount, decoLocked, coin, clearDecoPick, closeDecoPop, renderDeco } from './deco-panel.js';
import { levelsCleared } from './context.js';
import { room3d, applyRoom } from './room.js';
import { shopBurst } from './shop.js';

// Dev "mở hết khu" (nút Dev: Unlock all): xem được cả phần / món khoá ở màn game chưa có (vườn mở rộng: màn 30+). Lưu trong máy.
export const DEV_ZONES_KEY = 'gomgom-dev-all-zones';

const devAllZones = () => DEV_MODE && readText(DEV_ZONES_KEY) === 'on';

// Khu mở = đã trả xu mở khu (areaOpen); Vườn luôn mở.
export const isZoneOpen = zone => areaOpen(getDeco(), zone) || devAllZones();

export const isGardenExpanded = () => areaOpen(getDeco(), 'garden2') || devAllZones();

export const decoUnlockedLevel = () => devAllZones() ? Infinity : unlockedCount(loadProgress());

export function renderZoneSwitch() {
  document.querySelectorAll('.zone-switch button').forEach(button => {
    const zone = button.dataset.zone, open = isZoneOpen(zone);
    button.classList.toggle('on', zone === getDeco().zone);
    button.classList.toggle('locked', !open);
    button.setAttribute('aria-selected', zone === getDeco().zone);
    const [built, total] = open ? builtCount(getDeco(), zone) : [0, 0];
    button.innerHTML = open ? `${ZONES[zone].name} <small>${built}/${total}</small>` : ZONES[zone].name;
    // Khu chưa mở khoá: chưa hiện (mở khi người chơi tới stage của khu đó). Khu đã xây hết mọi chỗ: ẩn khỏi hàng chọn khu
    // (vẫn tới được bằng cách kéo cảnh / chạm đồ trong khu đó).
    button.hidden = !open || built === total;
  });
  $('deco-zone').hidden = ![...$('deco-zone').children].some(button => !button.hidden);
  fitZoneSwitch();
  renderAreaNext();
}

// Hàng chọn khu ở Deco: hiện tối đa 3 khu, khu mở sau đó vuốt ngang để xem; tự cuộn tới khu đang chọn.
// Lúc Deco còn ẩn thì chưa đo được nút: đo lại khi hàng chọn khu hiện ra / đổi cỡ.
new ResizeObserver(() => fitZoneSwitch()).observe($('deco-zone'));

// PC: giữ chuột trái rồi kéo để cuộn ngang hàng chọn khu (cảm ứng đã vuốt được sẵn). Kéo quá 5 px thì không tính là bấm chọn khu.
{
  const bar = $('deco-zone');
  let drag = null;
  bar.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: bar.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; bar.style.scrollBehavior = 'auto'; bar.style.scrollSnapType = 'none'; bar.classList.add('dragging'); }
    if (drag.moved) bar.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved) {
      // chặn cú click ngay sau khi thả chuột (nếu có); gỡ ngay sau đó để không nuốt cú bấm thật kế tiếp
      const eat = event => { event.stopPropagation(); event.preventDefault(); };
      bar.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => bar.removeEventListener('click', eat, { capture: true }), 0);
    }
    bar.style.scrollBehavior = bar.style.scrollSnapType = '';
    bar.classList.remove('dragging');
    drag = null;
  });
}

function fitZoneSwitch() {
  const ZONE_SWITCH_MAX = 3, bar = $('deco-zone'), shown = [...bar.children].filter(button => !button.hidden);
  bar.style.maxWidth = '';
  if (bar.hidden || shown.length <= ZONE_SWITCH_MAX || !shown[0].offsetWidth) return;
  const style = getComputedStyle(bar), gap = parseFloat(style.columnGap) || 0;
  const width = shown.slice(0, ZONE_SWITCH_MAX).reduce((sum, button) => sum + button.offsetWidth, 0) + gap * (ZONE_SWITCH_MAX - 1)
    + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  bar.style.maxWidth = `min(${Math.ceil(width)}px, calc(100% - 24px))`;
  const on = shown.find(button => button.classList.contains('on'));
  if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
}

// ===== Mở khu: thẻ "khu kế tiếp" ở Deco + bảng mở khu (track 3 bước kiểu Idle Theme Park: đủ màn → tiêu xu vào decor → khánh thành) =====
// Mỗi lúc chỉ hiện MỘT khu kế tiếp (mở theo thứ tự), để người chơi luôn thấy mục tiêu gần nhất.
const areaInfo = area => {
  const deco = getDeco(), cleared = levelsCleared(), { level, cost } = AREA_UNLOCK[area];
  return { area, level, cost, cleared, coins: Math.min(deco.coins, cost), state: areaState(deco, area, cleared), name: AREA_NAMES[area] };
};

// Khu kế tiếp hiện thành mảnh đất mờ trong cảnh Deco (room3d.setGhost) + bong bóng giá bám trên đó (placeAreaMarker mỗi khung hình);
// Đủ điều kiện thì bong bóng đổi xanh và nảy nhanh.
export function renderAreaNext() {
  const marker = $('area-next'), area = $('deco').hidden || devAllZones() || decoLocked ? null : nextArea(getDeco());
  room3d?.setGhost(area); // tên khu trùng tên ô trong room-layout ZONE_OFFSET
  marker.hidden = !area;
  if (!area) return;
  const info = areaInfo(area);
  marker.dataset.state = info.state;
  marker.setAttribute('aria-label', `${info.name}: how to unlock`);
  // Bong bóng giá trên mảnh đất: giá mở khu; chưa tới màn mốc thì thêm dòng "Level N".
  marker.innerHTML = `<b aria-hidden="true">${coin(info.cost)}${info.state === 'level' ? `<small>Level ${info.level}</small>` : ''}</b>`;
}

export function placeAreaMarker() {
  const marker = $('area-next');
  if (!marker.dataset.state) return;
  const at = nextArea(getDeco()) && !devAllZones() && !decoLocked ? room3d?.screenOfGhost() : null;
  marker.hidden = !at;
  if (at) marker.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
}

// Chạm bong bóng: đủ điều kiện thì mua luôn; thiếu xu / chưa tới màn mốc thì bong bóng nháy đỏ.
$('area-next').addEventListener('click', () => {
  const area = nextArea(getDeco());
  if (!area) return;
  const { state } = areaInfo(area);
  if (state === 'ready') return buyArea(area);
  const marker = $('area-next');
  marker.classList.remove('deny');
  void marker.offsetWidth; // chạy lại animation khi chạm liên tiếp
  marker.classList.add('deny');
  playSound('invalid');
});

$('area-next').addEventListener('animationend', event => { if (event.animationName === 'area-deny') $('area-next').classList.remove('deny'); });

function buyArea(area) {
  const next = unlockArea(getDeco(), area, levelsCleared());
  if (next.error) return showToast(next.error);
  shopBurst($('area-next'));
  // Mở xong: camera lướt sang khu mới (Vườn mở rộng là phần của khu vườn).
  setDeco({ ...next, zone: area === 'garden2' ? 'garden' : area });
  clearDecoPick();
  closeDecoPop(false);
  refreshWallet();
  applyRoom(getDeco());
  renderZoneSwitch();
  renderDeco();
  room3d?.openFx(area);
  playSound('reward');
  // Mở xong khu cuối cùng: quà vườn hoa (deco-room.mjs bloom) mọc lên bên trái vườn
  showToast(AREA_ORDER.every(id => areaOpen(next, id)) ? `${AREA_NAMES[area]} is open! Gift: a Flower garden is blooming next to your garden!` : `${AREA_NAMES[area]} is open!`);
}

document.addEventListener('click', event => {
  const button = event.target.closest('.zone-switch button');
  if (!button) return;
  const zone = button.dataset.zone;
  if (!isZoneOpen(zone)) return;
  if (zone === getDeco().zone) return;
  setDeco({ ...getDeco(), zone });
  clearDecoPick();
  closeDecoPop(false);
  renderZoneSwitch();
  renderDeco();
  applyRoom(getDeco()); // camera Deco lướt sang khu vừa chọn (nút chọn khu giờ chỉ còn ở Deco)
});
