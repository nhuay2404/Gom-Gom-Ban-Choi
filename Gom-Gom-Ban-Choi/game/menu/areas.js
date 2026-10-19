// Khu (vườn, phòng khách, phòng ngủ, bếp...): chuyển khu, thẻ "khu kế tiếp" + bảng mở khu (đủ màn → tiêu xu → khánh thành).
// Sang Unity: AreaSwitcher + AreaUnlockPanel.
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import { AREA_UNLOCK } from '../data/economy.mjs';
import { playSound } from '../ui/sound.mjs';
import { readText } from '../core/save.mjs';
import { ZONES, AREA_NAMES, AREA_ORDER, areaOpen, areaState, nextArea, unlockArea } from '../deco/deco-data.mjs';
import { $, DEV_MODE, showToast, getDeco, setDeco, refreshWallet } from '../app/shared.js';
import { builtCount, decoLocked, coin, clearDecoPick, closeDecoPop, renderDeco, decoTab, setDecoTab, clearPreview } from './deco-panel.js';
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

// Hàng tab ở khay đáy: nút mèo + mỗi khu đã mở một nút biểu tượng; khu đang chọn xanh lá, kèm số món đã xây / tổng.
// Biểu tượng tab là mặt nạ ảnh (assets/img/deco/tab-*.png tách từ Figma, deco.css `.zi`), tô màu theo trạng thái.
const zoneIcon = zone => `<i class="zi" data-z="${zone}"></i>`;
export function renderZoneSwitch() {
  const current = getDeco().zone;
  document.querySelectorAll('#deco-zone button').forEach(button => {
    if (button.dataset.kind === 'cats') {
      button.classList.toggle('on', decoTab === 'cats');
      button.setAttribute('aria-selected', decoTab === 'cats');
      return;
    }
    const zone = button.dataset.zone, open = isZoneOpen(zone), on = zone === current && decoTab !== 'cats';
    button.classList.toggle('on', on);
    button.setAttribute('aria-selected', on);
    button.setAttribute('aria-label', ZONES[zone].name);
    button.title = ZONES[zone].name;
    const [built, total] = open ? builtCount(getDeco(), zone) : [0, 0];
    button.innerHTML = `${zoneIcon(zone)}${on ? `<small>${built}/${total}</small>` : ''}`;
    // Khu chưa mở khoá (chưa trả xu mở khu): chưa hiện.
    button.hidden = !open;
  });
  fitZoneSwitch();
  renderAreaNext();
}

// Hàng chọn khu ở Deco: hiện tối đa 3 khu, khu mở sau đó vuốt ngang để xem; tự cuộn tới khu đang chọn.
// Lúc Deco còn ẩn thì chưa đo được nút: đo lại khi hàng chọn khu hiện ra / đổi cỡ.
new ResizeObserver(() => fitZoneSwitch()).observe($('deco-zone'));

// PC: giữ chuột trái rồi kéo để cuộn ngang hàng tab khu và hàng thẻ (cảm ứng đã vuốt được sẵn). Kéo quá 5 px thì không tính là bấm.
function dragScroll(bar) {
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
dragScroll($('deco-zone'));
dragScroll($('deco-cards'));

function fitZoneSwitch() {
  const bar = $('deco-zone'), on = [...bar.children].find(button => !button.hidden && button.classList.contains('on'));
  // Chỉ cuộn khi khu đang chọn nằm ngoài khung nhìn; còn lại giữ sát trái như thiết kế
  if (!on || !on.offsetWidth) return;
  const left = on.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft;
  if (left < bar.scrollLeft || left + on.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = left - 12;
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
  const button = event.target.closest('#deco-zone button');
  if (!button) return;
  const zone = button.dataset.zone;
  if (button.dataset.kind === 'cats') {
    if (decoTab === 'cats') return;
    playSound('pick');
    setDecoTab('cats');
  } else {
    if (!isZoneOpen(zone)) return;
    if (zone === getDeco().zone && decoTab !== 'cats') return;
    playSound('pick');
    if (decoTab === 'cats') setDecoTab('furniture');
    if (zone !== getDeco().zone) setDeco({ ...getDeco(), zone });
  }
  clearDecoPick();
  clearPreview();
  closeDecoPop(false);
  renderZoneSwitch();
  renderDeco();
  applyRoom(getDeco()); // camera Deco lướt sang khu vừa chọn (nút chọn khu giờ chỉ còn ở Deco)
});
