// Deco kiểu "xây chỗ": thẻ chỗ đặt đồ, bảng đổi món cạnh món vừa chạm, khoá UI để ngắm phòng, ghim NEW.
// Sang Unity: DecoPanel (MonoBehaviour) + prefab DecoCard / DecoPopup.
import * as ob from '../app/onboarding.js';
import { catMarkup } from '../ui/cat-art.mjs';
import { playSound } from '../ui/sound.mjs';
import { readText, writeText } from '../core/save.mjs';
import { ZONES, ZONE_IDS, CATALOG, slotGroups, itemById, itemStatus, applyAction, previewDeco, isOwned, catalogFor, slotOf, shopStatus, buyToStock, ownedOptions, useItem, freshKeys, clearFresh } from '../deco/deco-data.mjs';
import { $, showToast, getDeco, setDeco, refreshWallet, noteEvent } from '../app/shared.js';
import { coverCoins } from '../app/store.js';
import { isGardenExpanded, decoUnlockedLevel, isZoneOpen, renderAreaNext, renderZoneSwitch } from './areas.js';
import { decoThumbnail, room3d, applyRoom, buildFlatRooms } from './room.js';
import { startIdle } from './idle-coins.js';

export let decoPick = null; // món gốc đang xem trước (thẻ chưa xây vừa chạm)

export function clearDecoPick() { decoPick = null; }

// ===== Deco kiểu "xây chỗ" (như Monopoly Go) =====
// Hàng thẻ dưới màn hình = món gốc của từng chỗ đặt trong khu (một hàng, vuốt ngang). Chạm thẻ chưa xây: xem trước món ngay
// tại chỗ + camera quay tới, thẻ hiện nút Buy; mua = xây chỗ đó (✓). Thẻ đã xây: quay tới món + mở bảng đổi món.
// Kiểu khác của món + tường / sàn khác bán ở Shop → Decoration (mua vào kho). Món có đồ mới mua thay được thì sáng lên trong
// cảnh; chạm món / sàn / tường trong cảnh thì bảng đổi món hiện NGAY CẠNH chỗ đó (không nằm ở đáy màn hình).
// Đồ phần vườn mở rộng chỉ hiện khi vườn đã mở rộng (trước đó chúng chưa có chỗ trong cảnh).
export const decoVisible = entry => entry.area !== 'garden2' || isGardenExpanded();

export const decoShown = () => previewDeco(getDeco(), decoPick);

export const coin = amount => `<span class="amt"><i class="ico-coin"></i>${amount}</span>`; // xu + số không bị ngắt dòng

export const thumbOf = entry => entry.breed ? `<span class="thumb cat-thumb">${catMarkup[entry.breed]}</span>`
  : decoThumbnail ? `<img class="thumb thumb-3d" src="${decoThumbnail(entry)}" alt="">`
  : `<span class="thumb" style="--c:${entry.color}"></span>`;

// Món gốc của mọi chỗ trong khu (theo thứ tự danh mục) — chính là các thẻ.
export const decoBases = zone => slotGroups(zone, 'furniture').map(group => group[0]).filter(decoVisible);

export const builtCount = (deco, zone) => { const bases = decoBases(zone); return [bases.filter(base => isOwned(deco, base)).length, bases.length]; };

export let decoPop = null; // bảng đổi món đang mở: { zone, key (chỗ đặt | 'walls' | 'floors' | 'cats'), x, y }

let popPreview = null; // kiểu chưa mua đang xem thử trong bảng (chạm nút giá để mua)

let lastCardZone = '';

// Chấm đỏ tab Deco: món đồ (thẻ chưa xây) vừa mở khoá + đủ xu mua mà người chơi chưa thấy. Vào Deco là tính đã thấy (chấm tắt,
// lưu máy); các thẻ đó gắn nhãn NEW tới khi rời Deco. Save chưa có danh sách (máy mới / bản cũ): coi mọi món hiện có là đã thấy.
const DECO_SEEN_KEY = 'gomgom-deco-seen';

let decoNew = new Set();

export function clearDecoNew() { decoNew = new Set(); }

const buyableIds = () => {
  const deco = getDeco(), unlocked = decoUnlockedLevel();
  return ZONE_IDS.filter(zone => isZoneOpen(zone)).flatMap(decoBases).filter(base => !isOwned(deco, base) && itemStatus(deco, base, unlocked) === 'buy').map(base => base.id);
};

function seenIds() {
  const raw = readText(DECO_SEEN_KEY);
  if (raw === null) { writeText(DECO_SEEN_KEY, JSON.stringify(buyableIds())); return new Set(buyableIds()); }
  try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
}

export function refreshDecoDot() {
  const seen = seenIds();
  $('tabbar').querySelector('[data-tab="deco"]')?.classList.toggle('has-dot', buyableIds().some(id => !seen.has(id)));
}

export function noticeDeco() {
  const seen = seenIds(), ids = buyableIds();
  decoNew = new Set(ids.filter(id => !seen.has(id)));
  writeText(DECO_SEEN_KEY, JSON.stringify([...new Set([...seen, ...ids])]));
  refreshDecoDot();
}

export function renderDeco() {
  const deco = getDeco(), unlocked = decoUnlockedLevel(), fresh = freshKeys(deco, deco.zone), freshIds = new Set(deco.fresh || []);
  renderAreaNext(); // mua đồ (ở thẻ, bảng đổi món, Shop) đẩy thanh "tiêu xu vào decor" của khu kế tiếp
  startIdle();
  room3d?.setHighlights(decoLocked ? new Set() : fresh);
  $('deco-kinds').hidden = decoTab === 'cats';
  $('deco-pets').hidden = decoTab !== 'cats';
  $('deco-pets').querySelectorAll('[data-pet]').forEach(button => {
    button.classList.toggle('on', decoPet === button.dataset.pet);
    button.setAttribute('aria-selected', decoPet === button.dataset.pet);
  });
  $('deco-kinds').querySelectorAll('[data-key]').forEach(button => {
    button.querySelector('span').textContent = button.dataset.key === 'furniture' ? 'Furniture' : ZONES[deco.zone].cats[button.dataset.key];
    button.classList.toggle('on', decoTab === button.dataset.key);
    button.setAttribute('aria-selected', decoTab === button.dataset.key);
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
  // Một hàng thẻ theo tab + chip đang chọn (stripEntries); món gốc chưa xây xếp đầu hàng, xây rồi thì thẻ biến mất.
  const entries = stripEntries(deco), todo = entries.filter(isBaseEntry);
  cards.hidden = !entries.length;
  // Cập nhật thẻ tại chỗ (giữ nguyên phần tử + ảnh thumbnail đã giải mã): dựng lại cả hàng mỗi lần chạm thẻ thì trình duyệt
  // phải giải mã lại hàng chục ảnh PNG + vẽ lại, đúng khung hình camera bắt đầu lướt -> giật.
  const existing = new Map([...cards.children].map(card => [card.dataset.id, card]));
  const next = entries.map(entry => {
    const base = isBaseEntry(entry), shop = !base && entry.cat !== 'cats' && !isOwned(deco, entry);
    const status = shop ? shopStatus(deco, entry, unlocked) : itemStatus(deco, entry, unlocked);
    const picked = base ? decoPick === entry : popPreview === entry;
    let card = existing.get(entry.id);
    if (!card) {
      card = document.createElement('button');
      card.dataset.id = entry.id;
      card.setAttribute('role', 'listitem');
    }
    const className = `deco-card ${status}${picked ? ' picked' : ''}${decoNew.has(entry.id) || (!base && freshIds.has(entry.id)) ? ' is-new' : ''}`;
    if (card.className !== className) card.className = className;
    const buyable = status === 'buy' && picked;
    const art = thumbOf(entry), foot = status === 'locked' ? `<em class="deco-card-price lock">${entry.cat === 'cats' ? 'Claim' : `Lv ${entry.lock}`}</em>`
      : buyable ? `<em class="deco-card-price act" data-act="buy">Buy ${coin(entry.price)}</em>`
      : status === 'using' ? `<em class="deco-card-price own">${entry.cat === 'cats' ? 'In home' : '✓ In use'}</em>`
      : status === 'owned' ? `<em class="deco-card-price own">${entry.cat === 'cats' ? 'Add' : 'Use'}</em>`
      : `<em class="deco-card-price">${coin(entry.price)}</em>`;
    if (card.artHtml !== art) { card.artHtml = art; card.innerHTML = `<span class="deco-card-art">${art}</span><span class="deco-card-name">${entry.name}</span>${foot}`; }
    else if (card.footHtml !== foot) card.lastElementChild.outerHTML = foot;
    card.footHtml = foot;
    return card;
  });
  if (next.length !== cards.children.length || next.some((card, i) => cards.children[i] !== card)) cards.replaceChildren(...next);
  updateCardsFade();
  // Chuẩn bị trước lúc rảnh: model các thẻ xem thử được + ảnh các kiểu trong bảng đổi món của khu (không thì lần đầu chạm
  // phải dựng / chụp ngay trong khung hình, camera đứng hình lúc đang lướt).
  room3d?.prewarm(todo.filter(base => itemStatus(deco, base, unlocked) !== 'locked'));
  warmDecoThumbs(deco.zone);
  // Đổi khu / tab / chip: về đầu hàng thẻ
  const stripKey = `${deco.zone}/${decoTab}/${decoPet}`;
  if (lastCardZone !== stripKey) { lastCardZone = stripKey; cards.scrollLeft = 0; updateCardsFade(); }
  renderDecoPop();
}

// Tab đang chọn ở khay đáy: 'cats' (mèo trong nhà) hoặc chip loại đồ của khu: 'furniture' | 'walls' | 'floors'.
// Hàng chọn khu (areas.js) và hướng dẫn Deco (tours.js) đổi tab qua setDecoTab.
export let decoTab = 'furniture';
export function setDecoTab(tab) { decoTab = tab; }
// Tab mèo chia hai nhóm: mèo / chó (id món chó bắt đầu bằng 'dog-')
let decoPet = 'cats';
const isBaseEntry = entry => entry.cat === 'furniture' && !entry.slot;
function stripEntries(deco) {
  const zone = deco.zone;
  if (decoTab === 'cats') return CATALOG.filter(entry => entry.cat === 'cats' && entry.id.startsWith('dog-') === (decoPet === 'dogs'));
  if (decoTab === 'walls' || decoTab === 'floors') return catalogFor(zone, decoTab).filter(decoVisible).sort((a, b) => isOwned(deco, b) - isOwned(deco, a));
  // Furniture: chỉ món gốc chưa xây (kiểu khác của món mua ở Shop → Decoration / chạm món trong cảnh)
  return decoBases(zone).filter(base => !isOwned(deco, base));
}
// Thẻ bị cắt ở mép nào thì mép đó có dải mờ phủ lên (CSS .deco-cards-wrap.more-left / .more-right)
// Chỉ hiện khi đã kéo qua (đứng yên ở đầu hàng thì không có dải mờ).
function updateCardsFade() {
  const cards = $('deco-cards'), wrap = $('deco-cards-wrap'), moved = cards.scrollLeft > 4;
  wrap.classList.toggle('more-left', moved);
  wrap.classList.toggle('more-right', moved && cards.scrollLeft + cards.clientWidth < cards.scrollWidth - 4);
}
// Thu gọn khay: chỉ còn hàng tab
$('deco-collapse').addEventListener('click', () => {
  playSound('pick');
  const tray = document.querySelector('.deco-tray'), collapsed = tray.classList.toggle('collapsed');
  $('deco-collapse').setAttribute('aria-expanded', !collapsed);
  $('deco-collapse').setAttribute('aria-label', collapsed ? 'Expand item bar' : 'Collapse item bar');
  $('deco-collapse').title = collapsed ? 'Expand' : 'Collapse';
});
$('deco-cards').addEventListener('scroll', updateCardsFade, { passive: true });
export function clearPreview() {
  if (!popPreview) return;
  popPreview = null;
  applyRoom(getDeco());
}
$('deco-kinds').addEventListener('click', event => {
  const key = event.target.closest('[data-key]')?.dataset.key;
  if (!key || key === decoTab) return;
  playSound('pick');
  decoTab = key;
  clearDecoPick();
  closeDecoPop(false);
  clearPreview();
  applyRoom(getDeco());
  renderDeco();
});
$('deco-pets').addEventListener('click', event => {
  const pet = event.target.closest('[data-pet]')?.dataset.pet;
  if (!pet || pet === decoPet) return;
  playSound('pick');
  decoPet = pet;
  renderDeco();
});

$('deco-cards').addEventListener('click', event => {
  const card = event.target.closest('.deco-card'), base = itemById(card?.dataset.id);
  if (!base) return;
  if (!isBaseEntry(base)) { clearDecoPick(); return chooseOption(base, !!event.target.closest('[data-act="buy"]')); }
  clearPreview();
  if (!ob.buildOpen()) return showToast(BUILD_LOCKED);
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

const BUILD_LOCKED = 'Beat level 5 to start decorating!';

function buildBase(base) {
  if (!ob.buildOpen()) return showToast(BUILD_LOCKED);
  const next = applyAction(getDeco(), base, decoUnlockedLevel());
  // Thiếu xu: trả hết xu + bù gem rồi xây lại.
  if (next.error === 'Not enough coins') return coverCoins(base.price, base.name).then(ok => ok && buildBase(base));
  if (next.error) return showToast(next.error);
  setDeco(next);
  refreshWallet();
  playSound('reward');
  showToast(`Built ${base.name}!`);
  noteEvent('build');
  if (!room3d) buildFlatRooms();
  clearDecoPick();
  applyRoom(getDeco());
  room3d?.focus(base.id, false);
  room3d?.fx(base.id, 'buy'); // pháo giấy + sao + vòng sáng
  renderDeco();
  renderZoneSwitch();
}

// ---------- Bảng đổi món (cạnh món / chỗ vừa chạm) ----------
// Chạm trong cảnh: món = bảng đổi món cạnh nó. Sàn / tường (chạm cỏ trống là chuyện thường) chỉ mở khi đã có kiểu khác mua ở Shop
// và chưa có bảng nào đang mở; đang mở bảng thì chạm chỗ khác = đóng.
export function onScenePick(pick) {
  if (decoLocked) return;
  const surface = pick.key === 'walls' || pick.key === 'floors';
  if (!pick.key || (surface && (decoPop || ownedOptions(getDeco(), pick.zone, pick.key).length < 2))) return closeDecoPop();
  // Món ở phòng khác: chuyển Deco sang phòng đó (hàng thẻ, nút, hàng chọn khu) rồi mở bảng — camera lướt thẳng tới món.
  if (pick.zone !== getDeco().zone && isZoneOpen(pick.zone)) {
    setDeco({ ...getDeco(), zone: pick.zone });
    clearDecoPick();
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
  if (decoPick) { clearDecoPick(); applyRoom(getDeco()); }
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

export function closeDecoPop(render = true) {
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
  const title = { cats: `Pets · ${deco.cats.length}`, walls: names.walls, floors: names.floors }[decoPop.key] ?? (popPreview && options.includes(popPreview) ? popPreview.name : using?.name) ?? itemById(decoPop.key).name;
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
  chooseOption(entry, !!event.target.closest('.deco-opt-price'));
});
// Chọn một kiểu (mèo / kiểu khác của món / tường / sàn): dùng chung cho thẻ ở khay đáy và bảng đổi món trong cảnh.
// buyTap = chạm đúng nút giá của kiểu đang xem thử.
function chooseOption(entry, buyTap) {
  if (!ob.buildOpen() && entry.cat !== 'cats') return showToast(BUILD_LOCKED);
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
    if (popPreview === entry && buyTap) {
      const bought = buyToStock(deco, entry, unlocked);
      // Thiếu xu: trả hết xu + bù gem rồi bấm lại đúng nút giá của món này (bảng có thể đã vẽ lại).
      if (bought.error === 'Not enough coins') return coverCoins(entry.price, entry.name).then(ok => ok && $('deco-pop-items').querySelector(`.deco-opt[data-id="${entry.id}"] .deco-opt-price`)?.click());
      if (bought.error) return showToast(bought.error);
      noteEvent('style');
      const placed = useItem(bought, entry);
      popPreview = null;
      setDeco(placed.error ? bought : placed);
      if (!placed.error) noteEvent('place');
      refreshWallet();
      playSound('reward');
      if (!room3d) buildFlatRooms();
      applyRoom(getDeco());
      room3d?.fx(fxKey, 'buy'); // pháo giấy + vòng sáng khi mua
      return renderDeco();
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
    return renderDeco();
  } else {
    const wasPreviewing = !!popPreview;
    popPreview = null;
    // Chạm món đang dùng khi đang xem thử món khác = thôi xem, phòng trở về như cũ.
    if (status === 'using') { if (wasPreviewing) { applyRoom(getDeco()); renderDeco(); } return; }
    const next = useItem(deco, entry);
    if (next.error) return showToast(next.error);
    setDeco(next);
    noteEvent('place');
  }
  playSound('pick');
  if (!room3d) buildFlatRooms();
  applyRoom(getDeco());
  if (entry.cat !== 'cats') room3d?.fx(entry.cat === 'furniture' ? slotOf(entry) : entry.cat, 'swap'); // làn khói + lấp lánh khi đổi kiểu
  renderDeco();
}

// Không có nút đóng: chạm ra ngoài bảng là đóng. Chạm trong cảnh 3D do onScenePick lo (chạm món khác = đổi sang bảng của
// món đó).
document.addEventListener('pointerdown', event => {
  if (!decoPop || event.target.closest('#deco-pop, .deco-side, .room-canvas')) return;
  closeDecoPop();
}, true);

// Nút khoá (cột trái, dưới Ground): ẩn mọi UI mua bán / ví / thao tác + thanh tab để ngắm nhà; chỉ còn nút khoá và cài đặt,
// cả hai mờ đi (CSS: #deco.ui-locked, body.deco-locked). Rời Deco / mở lại Deco thì tự mở khoá.
export let decoLocked = false;

export function setDecoLock(on) {
  if (decoLocked === on) return;
  decoLocked = on;
  $('deco').classList.toggle('ui-locked', on);
  document.body.classList.toggle('deco-locked', on);
  const button = $('deco-lock');
  button.setAttribute('aria-pressed', on);
  button.setAttribute('aria-label', on ? 'Show buttons' : 'Hide buttons to view your home');
  button.title = on ? 'Show UI' : 'Hide UI';
  if (on) { clearDecoPick(); closeDecoPop(false); }
  if (!$('deco').hidden) renderDeco();
  renderAreaNext(); // chế độ xem: ẩn cả mảnh đất mờ + bong bóng giá
}

$('deco-lock').onclick = () => { playSound('pick'); setDecoLock(!decoLocked); };

// Bảng đổi món luôn nằm PHÍA TRÊN món (bám theo món mỗi khung hình khi camera trượt / xoay / zoom — room3d.onFrame), đuôi chỉ xuống món.
// Phía trên không đủ chỗ (món ở sát mép trên) thì trượt camera cho món tụt xuống tới khi vừa. Bảng mở từ cột nút trái thì nằm
// bên phải nút.
export function placeDecoPop() {
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
export function placeDecoPins() {
  for (const pin of $('deco-pins').children) {
    const at = room3d?.screenOf(pin.dataset.slot);
    pin.hidden = !at || decoPop?.key === pin.dataset.slot;
    if (at) pin.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
  }
}
