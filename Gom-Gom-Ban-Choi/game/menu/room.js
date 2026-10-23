// Phòng 3D dùng chung cho Home + Deco (deco/deco-room.mjs): dựng / gắn vào tab, mèo chỉ đường, vuốt mèo trong phòng.
// Sang Unity: RoomHost (MonoBehaviour quản lý scene phòng).
import * as ob from '../app/onboarding.js';
import { categories, addArt as addCatArt } from '../ui/cat-art.mjs';
import { playMeow } from '../ui/sound.mjs';
import { claimCat, isCatClaimed } from '../deco/deco-data.mjs';
import { $, reduceMotion, DEV_MODE, getDeco, setDeco, noteEvent } from '../app/shared.js';
import { isZoneOpen, isGardenExpanded, placeAreaMarker, renderZoneSwitch } from './areas.js';
import { decoShown, onScenePick, placeDecoPop, placeDecoPins, clearDecoPick, closeDecoPop, renderDeco } from './deco-panel.js';
import { runQC } from './dev-tools.js';
import { ambient } from './settings.js';
import { placeIdleCoin } from './idle-coins.js';
import { TABS } from './tabs.js';
import { renderShopDeco } from './shop.js';
import { map3dReady } from './map-view.js';

export let room3d = null; // phòng 3D, có sau khi nạp xong Three.js; null thì dùng phòng CSS phẳng

export let decoThumbnail = null; // chụp model 3D làm ảnh cho ô đồ (có sau khi nạp Three.js)

// Vườn và phòng khách nối liền thành một khu nhà; phòng khách chỉ có khi đã mở (thắng màn 10). Chỉ Deco dựng cảnh này.
// Mèo cam dẫn đường của các hướng dẫn Deco (Garden, Decoration): trong lúc hướng dẫn luôn có mặt trong vườn (chưa nhận thì ở TẠM,
// không ghi vào save), ngồi yên nhìn camera và "nói" bằng bong bóng lời thoại. Xong hướng dẫn thì đi lại tự do.
const GUIDE_CAT = 'orange';

let guiding = false;

const withGuide = shown => (guiding && !shown.cats.includes(GUIDE_CAT) ? { ...shown, cats: [...shown.cats, GUIDE_CAT] } : shown);

export const guideRect = () => room3d?.screenRectOfCat(GUIDE_CAT);

// nearSlot: chỗ đặt hướng dẫn sắp chỉ tới (mèo ngồi sẵn cạnh đó, camera lướt tới món vẫn thấy mèo).
export function setGuide(on, nearSlot = null) {
  guiding = on;
  if (on) applyRoom(getDeco());
  room3d?.holdCat(GUIDE_CAT, on, nearSlot);
}

export const applyRoom = shown => room3d?.apply(withGuide(shown), { living: isZoneOpen('living'), bedroom: isZoneOpen('bedroom'), kitchen: isZoneOpen('kitchen'), bathroom: isZoneOpen('bathroom'), backyard: isZoneOpen('backyard'), kinder: isZoneOpen('kinder'), gardenExpand: isGardenExpanded() });

export function mountRoom(tab) {
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
    // ví / dock đang ẩn (nút ngắm nhà khoá UI: display none, khung 0 × 0) thì không che gì; không thì cả màn bị tính là "bị che",
    // zoom tụt về ~0 khi đổi cỡ cửa sổ lúc đang khoá UI (lỗi cảnh biến thành nền trời + mép đất)
    const room = $('deco-room').getBoundingClientRect(), shown = el => el.getClientRects().length > 0;
    const wallet = $('deco').querySelector('.wallet-hud'), dock = $('deco').querySelector('.deco-dock');
    return { top: shown(wallet) ? wallet.getBoundingClientRect().bottom - room.top : 0, bottom: shown(dock) ? room.bottom - dock.getBoundingClientRect().top : 0 };
  },
};

// Phòng CSS phẳng (dự phòng khi không nạp được 3D): tranh, cửa sổ, chậu cây, thảm và mèo; chạm mèo để cưng.
function buildRoom(room, cats) {
  room.innerHTML = '<span class="room-frame"></span><span class="room-window"></span><span class="room-plant"></span><span class="room-rug"></span><div class="room-cats"></div>';
  room.querySelector('.room-cats').append(...cats.map(group => {
    const cat = document.createElement('button');
    cat.className = 'room-cat';
    cat.dataset.breed = group;
    cat.setAttribute('aria-label', `Pet the ${categories[group].name.toLowerCase()}`);
    addCatArt(cat, group);
    return cat;
  }));
}

export function buildFlatRooms() {
  buildRoom($('deco-room'), getDeco().cats.slice(0, 3));
}

function petRoomCat(cat) {
  cat.classList.remove('petted');
  void cat.offsetWidth;
  cat.classList.add('petted');
  clearTimeout(cat.petTimer);
  cat.petTimer = setTimeout(() => cat.classList.remove('petted'), 1100);
  playMeow(cat.dataset.breed);
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

// Khởi động (menu-controller.js gọi sau khi mọi module menu đã nạp): mèo dẫn đường + dựng trước các phòng phẳng.
export function startRoom() {
  // Người mới: vườn chỉ có mèo cam (mở sẵn, mèo dẫn đường của hướng dẫn); mèo khác nhận dần ở Map (deco-data.mjs catRewardsAt).
  if (ob.stage() === 'L1' && getDeco().cats.join() !== GUIDE_CAT) setDeco({ ...getDeco(), cats: [GUIDE_CAT], claimedCats: [GUIDE_CAT] });
  // Save cũ (trước khi mèo cam mở sẵn) chưa nhận mèo cam: tặng luôn.
  else if (!isCatClaimed(getDeco(), GUIDE_CAT)) setDeco(claimCat(getDeco(), GUIDE_CAT));
  buildFlatRooms();
}

// Cảnh 3D nạp xong (phòng + bản đồ): màn loading (main.js) đợi cái này rồi mới tắt.
export const roomReady = import('../deco/deco-room.mjs').then(({ createRoom, thumbnail }) => {
  room3d = createRoom();
  if (DEV_MODE && new URLSearchParams(location.search).has('qc')) setTimeout(runQC, 500);
  room3d.setAmbient(ambient);
  decoThumbnail = thumbnail;
  room3d.onPick(onScenePick);
  room3d.onCatEvent(kind => { if (kind === 'pet') noteEvent('pet'); }); // nhiệm vụ "vuốt mèo"
  // Bảng đổi món + ghim NEW đặt lại ngay sau mỗi lần vẽ cảnh (cùng khung hình với camera, không trễ / rung).
  room3d.onFrame(() => { if (!$('deco').hidden) { placeDecoPop(); placeDecoPins(); placeIdleCoin(); placeAreaMarker(); } });
  // Deco: kéo cảnh sang phòng khác thì hàng thẻ, nút cột trái và hàng chọn khu đổi theo phòng đang ở giữa (camera không lướt lại).
  room3d.onZoneView(zone => {
    if ($('deco').hidden || zone === getDeco().zone || !isZoneOpen(zone)) return;
    setDeco({ ...getDeco(), zone });
    clearDecoPick();
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

