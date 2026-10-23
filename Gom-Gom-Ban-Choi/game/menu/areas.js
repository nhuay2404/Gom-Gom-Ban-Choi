// Khu (vườn, phòng khách, phòng ngủ, bếp...): chuyển khu, thẻ "khu kế tiếp" + bảng mở khu (đủ màn → tiêu xu → khánh thành).
// Sang Unity: AreaSwitcher + AreaUnlockPanel.
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import { AREA_UNLOCK, GEM_REWARDS } from '../data/economy.mjs';
import { grantGems, triggerOffer, showOffer, coverCoins } from '../app/store.js';
import { playSound } from '../ui/sound.mjs';
import { readText } from '../core/save.mjs';
import { ZONES, AREA_NAMES, AREA_ORDER, areaOpen, areaState, areaBefore, areaBuilt, nextArea, nextAreas, unlockArea } from '../deco/deco-data.mjs';
import { $, DEV_MODE, showToast, getDeco, setDeco, refreshWallet, ask } from '../app/shared.js';
import { builtCount, decoLocked, coin, clearDecoPick, closeDecoPop, renderDeco } from './deco-panel.js';
import { levelsCleared } from './context.js';
import { room3d, applyRoom } from './room.js';
import { shopBurst } from './shop.js';
import { renderQuestButtons } from './quests.js';

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
  renderQuestButtons(); // khu vừa mở / chỗ vừa xây: nhiệm vụ tiến trình đo lại
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

// ===== Mở khu: bong bóng "khu kế tiếp" ở Deco + bảng 2 khu kế tiếp (xây đủ món gốc khu trước → đủ xu → khánh thành) =====
const areaInfo = area => {
  const deco = getDeco(), cleared = levelsCleared(), { cost } = AREA_UNLOCK[area], before = areaBefore(area), [built, total] = areaBuilt(deco, before);
  return { area, cost, before, built, total, coins: Math.min(deco.coins, cost), state: areaState(deco, area, cleared), name: AREA_NAMES[area] };
};

// Khu kế tiếp hiện thành mảnh đất mờ trong cảnh Deco (room3d.setGhost) + bong bóng giá bám trên đó (placeAreaMarker mỗi khung hình);
// Đủ điều kiện thì bong bóng đổi xanh và nảy nhanh. Chưa xây đủ khu trước thì thêm dòng "đã xây / tổng".
export function renderAreaNext() {
  const marker = $('area-next'), area = $('deco').hidden || devAllZones() || decoLocked ? null : nextArea(getDeco());
  room3d?.setGhost(area); // tên khu trùng tên ô trong room-layout ZONE_OFFSET
  marker.hidden = !area;
  if (!area) return;
  const info = areaInfo(area);
  marker.dataset.state = info.state;
  marker.setAttribute('aria-label', `${info.name}: how to unlock`);
  marker.innerHTML = `<b aria-hidden="true">${coin(info.cost)}${info.state === 'build' ? `<small>Build ${info.built}/${info.total}</small>` : ''}</b>`;
}

export function placeAreaMarker() {
  const marker = $('area-next');
  if (!marker.dataset.state) return;
  const at = nextArea(getDeco()) && !devAllZones() && !decoLocked ? room3d?.screenOfGhost() : null;
  marker.hidden = !at;
  if (at) marker.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
}

// Một dòng trong bảng mở khu: 2 bước (xây đủ khu trước, trả xu); khu thứ hai chỉ ghi "sau khu trước".
const STEP = (done, text) => `<li class="${done ? 'done' : ''}"><i aria-hidden="true">${done ? '✓' : ''}</i>${text}</li>`;
function areaRow(info) {
  const steps = info.state === 'soon' ? STEP(false, `Open the ${AREA_NAMES[info.before].toLowerCase()} first`)
    : STEP(info.built >= info.total, `Build every spot in the ${AREA_NAMES[info.before].toLowerCase()} <b>${info.built}/${info.total}</b>`)
      + STEP(info.state === 'ready', `Pay ${coin(info.cost)}`);
  return `<section class="area-row" data-state="${info.state}"><h3>${info.name}</h3><ul>${steps}</ul></section>`;
}

// Chạm bong bóng: bảng 2 khu kế tiếp. Đủ điều kiện thì nút mở; đã xây đủ mà thiếu xu thì bù gem (coverCoins).
$('area-next').addEventListener('click', async () => {
  const area = nextArea(getDeco());
  if (!area) return;
  playSound('pick');
  const infos = nextAreas(getDeco()).map(areaInfo), { state, cost, name } = infos[0];
  const choices = state === 'ready' ? [{ id: 'open', label: `Open ${coin(cost)}` }]
    : state === 'coins' ? [{ id: 'cover', label: `Open ${coin(cost)}` }]
    : [{ id: 'build', label: 'Go build' }];
  const choice = await ask({ title: 'Next areas', className: 'area-sheet', body: infos.map(areaRow).join(''), choices: [...choices, { id: 'close', style: 'ghost', label: 'Later' }] });
  if (choice === 'open') return buyArea(area);
  if (choice === 'cover') return coverCoins(cost, name).then(ok => ok && buyArea(area));
  if (choice === 'build') { setDeco({ ...getDeco(), zone: zoneOfArea(infos[0].before) }); clearDecoPick(); closeDecoPop(false); renderZoneSwitch(); renderDeco(); applyRoom(getDeco()); }
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
