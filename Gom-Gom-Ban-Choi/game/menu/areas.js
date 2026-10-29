// Khu (vườn, phòng khách, phòng ngủ, bếp...): chuyển khu, thẻ "khu kế tiếp" + bảng mở khu (đủ màn → tiêu xu → khánh thành).
// Sang Unity: AreaSwitcher + AreaUnlockPanel.
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import { GEM_REWARDS } from '../data/economy.mjs';
import { grantGems, triggerOffer, showOffer, coverCoins } from '../app/store.js';
import { playSound } from '../ui/sound.mjs';
import { readText } from '../core/save.mjs';
import { ZONES, AREA_NAMES, AREA_ORDER, areaOpen, areaState, areaBefore, areaBuilt, nextArea, unlockArea, AREA_UNLOCK } from '../deco/deco-data.mjs';
import { $, DEV_MODE, showToast, getDeco, setDeco, refreshWallet, ask } from '../app/shared.js';
import { builtCount, decoLocked, coin, clearDecoPick, closeDecoPop, renderDeco, decoTab, setDecoTab, clearPreview } from './deco-panel.js';
import { levelsCleared } from './context.js';
import { room3d, applyRoom } from './room.js';
import { shopBurst } from './shop.js';
import { renderGiftBoxes } from './gift-boxes.js';
import { renderQuestButtons } from './quests.js';

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
  renderQuestButtons(); // khu vừa mở / chỗ vừa xây: nhiệm vụ tiến trình đo lại
}

// Hàng chọn khu ở Deco: hiện tối đa 3 khu, khu mở sau đó vuốt ngang để xem; tự cuộn tới khu đang chọn.
// Lúc Deco còn ẩn thì chưa đo được nút: đo lại khi hàng chọn khu hiện ra / đổi cỡ.
new ResizeObserver(() => fitZoneSwitch()).observe($('deco-zone'));

// PC: giữ chuột trái rồi kéo để cuộn ngang hàng tab khu và hàng thẻ (cảm ứng đã vuốt được sẵn). Kéo quá 5 px thì không tính là bấm.
// Shop → Decoration dùng lại cho hàng chọn khu (menu/shop.js, gọi lúc render đầu chứ không lúc nạp module: hai module import vòng tròn).
export function dragScroll(bar) {
  let drag = null;
  bar.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: bar.scrollLeft, moved: false };
  });
  // Ảnh thumbnail (<img>) bị trình duyệt kéo kiểu kéo-thả file: nuốt mất pointerup -> hàng thẻ "dính" theo chuột dù đã thả nút.
  bar.addEventListener('dragstart', event => event.preventDefault());
  window.addEventListener('pointermove', event => {
    if (!drag) return;
    if (!(event.buttons & 1)) { end(); return; } // đã thả nút ở chỗ không nhận được pointerup (ngoài cửa sổ, menu chuột phải...)
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; bar.style.scrollBehavior = 'auto'; bar.style.scrollSnapType = 'none'; bar.classList.add('dragging'); }
    if (drag.moved) bar.scrollLeft = drag.left - dx;
  });
  const end = () => {
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
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
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

const AREA_NEXT_LEVEL = 6;

// ===== Mở khu: bong bóng "khu kế tiếp" ở Deco + bảng 2 khu kế tiếp (xây đủ món gốc khu trước → đủ xu → khánh thành) =====
const areaInfo = area => {
  const deco = getDeco(), cleared = levelsCleared(), { cost } = AREA_UNLOCK[area], before = areaBefore(area), [built, total] = areaBuilt(deco, before);
  return { area, cost, before, built, total, coins: Math.min(deco.coins, cost), state: areaState(deco, area, cleared), name: AREA_NAMES[area] };
};

// Khu kế tiếp hiện thành mảnh đất mờ trong cảnh Deco + cọc gỗ có dấu "!" ở giữa (xanh lá khi đủ điều kiện mở) (room3d.setGhost). #area-next là vùng chạm
// trong suốt đè lên cọc (placeAreaMarker mỗi khung hình), chạm mở bảng điều kiện.
export function renderAreaNext() {
  // Mảnh đất khu kế tiếp chỉ hiện từ khi thắng màn AREA_NEXT_LEVEL (người mới chưa bị phân tâm khỏi vườn).
  const marker = $('area-next'), area = $('deco').hidden || devAllZones() || decoLocked || levelsCleared() < AREA_NEXT_LEVEL ? null : nextArea(getDeco());
  room3d?.setGhost(area, !!area && areaInfo(area).state === 'ready'); // tên khu trùng tên ô trong room-layout ZONE_OFFSET
  marker.hidden = !area;
  if (!area) return;
  const info = areaInfo(area);
  marker.dataset.state = info.state;
  marker.setAttribute('aria-label', `${info.name}: how to unlock`);
}

export function placeAreaMarker() {
  const marker = $('area-next');
  if (!marker.dataset.state) return;
  const at = nextArea(getDeco()) && !devAllZones() && !decoLocked ? room3d?.screenOfGhost() : null;
  // Cọc ra khỏi khung: vùng chạm tắt (không chặn chạm vào cảnh).
  marker.classList.toggle('away', !at);
  if (!at) return;
  marker.hidden = false;
  marker.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
}

// Một dòng trong bảng mở khu: 2 bước (xây đủ khu trước, trả xu).
const STEP = (done, text) => `<li class="${done ? 'done' : ''}"><i aria-hidden="true">${done ? '✓' : ''}</i>${text}</li>`;
function areaRow(info) {
  const steps = STEP(info.built >= info.total, `Build every spot in the ${AREA_NAMES[info.before].toLowerCase()} <b>${info.built}/${info.total}</b>`);
  return `<section class="area-row" data-state="${info.state}"><h3>${info.name}</h3><ul>${steps}</ul></section>`;
}

// Chạm cọc: bảng khu kế tiếp, một nút "Pay <giá>" (đóng bằng nút X). Chưa xây đủ thì báo; đã xây đủ mà thiếu xu thì bù gem (coverCoins).
$('area-next').addEventListener('click', async () => {
  const area = nextArea(getDeco());
  if (!area) return;
  playSound('pick');
  const info = areaInfo(area), { state, cost, name } = info;
  const choice = await ask({ title: 'Next area', className: 'area-sheet', body: areaRow(info), choices: [{ id: 'pay', label: `Pay ${coin(cost)}` }] });
  if (choice !== 'pay') return;
  if (state === 'build') return showToast(`Build every spot in the ${AREA_NAMES[info.before].toLowerCase()} first (${info.built}/${info.total})`);
  if (state === 'ready') return buyArea(area);
  if (state === 'coins') return coverCoins(cost, name).then(ok => ok && buyArea(area));
});

// Vườn mở rộng là phần của khu vườn.
const zoneOfArea = area => area === 'garden2' ? 'garden' : area;

function buyArea(area) {
  const next = unlockArea(getDeco(), area, levelsCleared());
  if (next.error) return showToast(next.error);
  shopBurst($('area-next'));
  // Mở xong: camera lướt sang khu mới (Vườn mở rộng là phần của khu vườn).
  setDeco({ ...next, zone: zoneOfArea(area) });
  clearDecoPick();
  closeDecoPop(false);
  refreshWallet();
  applyRoom(getDeco());
  renderGiftBoxes(); // món miễn phí của khu mới nằm trong hộp quà, chạm để mở
  renderZoneSwitch();
  renderDeco();
  room3d?.openFx(area);
  playSound('reward');
  // Mở xong khu cuối cùng: quà vườn hoa (deco-room.mjs bloom) mọc lên bên trái vườn
  const gems = grantGems(`area:${area}`, GEM_REWARDS.area);
  showToast(`${AREA_NAMES[area]} is open!${gems ? ` +${gems} gems!` : ''}${AREA_ORDER.every(id => areaOpen(next, id)) ? ' Gift: a Flower garden is blooming next to your garden!' : ''}`);
  // Ưu đãi Builder Pack (gem + xu cho khu mới), có thời gian chờ giữa hai lần.
  if (triggerOffer('builder')) setTimeout(() => showOffer('builder'), 1800);
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
