// Shop: tab Shop (ưu đãi, gem miễn phí, gói gem, booster bằng gem, túi xu) + tab Decoration (kiểu khác của món, tường / sàn), popup xem thử, mua.
// Sang Unity: ShopScreen (MonoBehaviour).
import { BOOSTERS } from '../data/tuning.mjs';
import { GEM_PACKS, OFFERS, REWARDED_ADS } from '../data/economy.mjs';
import { activeOffers, addGems } from '../core/gems.mjs';
import { buyGemPack, buyBooster, buyOffer, coverCoins, contentsOf, timeLeft, OFFER_NAMES } from '../app/store.js';
import { showRewarded, adReady, adsLeftToday } from '../app/ads.js';
import { playSound } from '../ui/sound.mjs';
import { ZONES, ZONE_IDS, itemById, previewDeco, slotOf, shopCatalog, shopStatus, buyToStock } from '../deco/deco-data.mjs';
import { $, reduceMotion, showToast, getDeco, setDeco, refreshWallet, getBoosters, priceTag, gemTag, getWallet, setWallet, noteEvent } from '../app/shared.js';
import { decoUnlockedLevel, isZoneOpen, dragScroll } from './areas.js';
import { decoVisible, coin, thumbOf } from './deco-panel.js';
import { room3d, applyRoom } from './room.js';
import { showTab } from './tabs.js';
import * as ob from '../app/onboarding.js';

// ---------- Shop: 2 tab — "Shop" (ưu đãi, gem, booster, túi xu) và "Decoration" (chỉ đồ trang trí) ----------
// Gói gem (IAP): số / giá từ data/economy.mjs GEM_PACKS; giá cố định nên vẽ một lần.
$('gem-packs').innerHTML = GEM_PACKS.map((pack, i) =>
  `<button class="coin-pack gem-pack" data-gem-pack="${i}"><i class="ico-gem big"></i><b>${pack.gems.toLocaleString('en-US')}</b>${pack.tag ? `<small class="pack-tag">${pack.tag}</small>` : ''}<em>$${pack.usd.toFixed(2)}</em></button>`).join('');
$('gem-packs').addEventListener('click', async event => {
  const button = event.target.closest('[data-gem-pack]');
  if (button && await buyGemPack(GEM_PACKS[button.dataset.gemPack])) { shopBurst(button); renderShopBoosters(); }
});

// Mở Shop, trang Shop, cuộn tới mục Gems: khi chạm ví gem, và khi thiếu gem ở bất kỳ đâu (app/store.js ensureGems phát 'gomgom:gem-shop').
function openGemShop() {
  if (!ob.tabOpen('shop')) { showToast('The Shop opens soon. Keep playing!'); return; }
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); // popup xem thử món / hộp hỏi còn mở
  if ($('shop').hidden) showTab('shop');
  setShopPage('store');
  $('gem-packs').previousElementSibling.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}
document.addEventListener('click', event => { if (event.target.closest('.fh-gems')) openGemShop(); });
addEventListener('gomgom:gem-shop', openGemShop);

export function setShopPage(page) {
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
export let shopZone = null;
let zoneDrag = false;

export function renderShopDeco() {
  // Hàng chọn khu cuộn ngang: kéo chuột để cuộn trên PC (như hàng khu ở Deco); gắn một lần, lúc render đầu
  if (!zoneDrag) { dragScroll($('shop-deco-tabs')); zoneDrag = true; }
  const deco = getDeco(), unlocked = decoUnlockedLevel(), zones = ZONE_IDS.filter(zone => isZoneOpen(zone));
  if (!zones.includes(shopZone)) shopZone = zones.includes(deco.zone) ? deco.zone : zones[0];
  $('shop-deco-tabs').replaceChildren(...zones.map(zone => {
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', zone === shopZone);
    tab.className = zone === shopZone ? 'on' : '';
    tab.dataset.zone = zone;
    // Cùng kiểu hàng chọn khu ở Deco (menu/areas.js): icon khu (mặt nạ .zi trong deco.css), chỉ tab đang chọn hiện thêm tên khu
    tab.setAttribute('aria-label', ZONES[zone].name);
    tab.innerHTML = `<i class="zi" data-z="${zone}"></i>${zone === shopZone ? `<small>${ZONES[zone].name}</small>` : ''}`;
    return tab;
  }));
  // Tab đang chọn (dài hơn vì có tên) luôn nằm trọn trong hàng: cuộn ngang tới nó nếu bị khuất ở mép
  const bar = $('shop-deco-tabs'), on = bar.querySelector('.on');
  if (on) {
    const left = on.offsetLeft - bar.offsetLeft - 8, right = left + on.offsetWidth + 16;
    if (left < bar.scrollLeft) bar.scrollLeft = left;
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  }
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
  // Thiếu xu: mời trả hết xu + bù gem; xong thì mua lại (và đóng popup xem thử nếu đang mở).
  if (next.error === 'Not enough coins') { coverCoins(entry.price, entry.name).then(ok => { if (ok && buyDeco(entry)) closeShopPreview(); }); return false; }
  if (next.error) { showToast(next.error); return false; }
  setDeco(next);
  noteEvent('style');
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

export function shopBurst(card) {
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

// Nút chưa làm (Daily, Language…): bấm vào chỉ báo "sắp có".
document.addEventListener('click', event => { if (event.target.closest('.soon')) showToast('Coming soon!'); });

// Vẽ lại trang Shop (gọi khi mở Shop + sau mỗi lần mua): ưu đãi đang chạy (đếm giờ), gem miễn phí, giá booster.
export function renderShopBoosters() {
  const gems = getWallet().gems;
  $('shop-offers').innerHTML = activeOffers(getWallet(), Date.now()).map(kind =>
    `<button class="offer-card" data-offer="${kind}"><b>${OFFER_NAMES[kind]}</b><span>${contentsOf(OFFERS[kind])}</span><small>Ends in ${timeLeft(kind)}</small><em>$${OFFERS[kind].usd.toFixed(2)}</em></button>`).join('');
  const free = $('shop-free-gems'), ready = adReady('gems');
  free.querySelector('b').innerHTML = `▶ Free ${gemTag(REWARDED_ADS.gems)}`;
  free.querySelector('em').textContent = ready ? `${adsLeftToday('gems')} left today` : 'Tomorrow';
  free.classList.toggle('poor', !ready);
  document.querySelectorAll('#shop-boosters [data-buy], #shop-booster-packs [data-buy]').forEach(button => {
    const id = button.dataset.buy, pack = button.hasAttribute('data-pack');
    if (!pack) button.querySelector('small').textContent = `You have ${getBoosters()[id]}`;
    button.querySelector('em').innerHTML = priceTag(id, pack);
    button.classList.toggle('poor', gems < (pack ? BOOSTERS.PACK_PRICE : BOOSTERS.PRICE)[id]);
  });
}

document.querySelectorAll('#shop-boosters, #shop-booster-packs').forEach(row => row.addEventListener('click', async event => {
  const button = event.target.closest('[data-buy]');
  if (button && await buyBooster(button.dataset.buy, button.hasAttribute('data-pack'))) { shopBurst(button); renderShopBoosters(); }
}));

$('shop-offers').addEventListener('click', async event => {
  const card = event.target.closest('[data-offer]');
  if (card && await buyOffer(card.dataset.offer)) renderShopBoosters();
});

// ADS-SDK: chỗ đặt "gems" — gem miễn phí ở Shop.
$('shop-free-gems').addEventListener('click', async () => {
  if (!(await showRewarded('gems'))) return renderShopBoosters();
  setWallet(addGems(getWallet(), REWARDED_ADS.gems));
  playSound('reward');
  shopBurst($('shop-free-gems'));
  renderShopBoosters();
});
