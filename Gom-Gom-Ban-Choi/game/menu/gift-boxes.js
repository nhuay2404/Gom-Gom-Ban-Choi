// Hộp quà onboarding trong Deco (app/onboarding.js): thắng màn 2 và màn 3 mỗi màn một hộp 3D giữa vườn (deco-room.mjs setGiftBoxes),
// chạm để mở. Hộp mở đầu tiên luôn là món đồ (nắp bật, model món nhảy từ hộp tới chỗ đặt + hướng dẫn Deco), hộp thứ hai luôn
// là xu (xu rơi ra đất quanh hộp rồi bay vào thanh xu vừa hiện + hướng dẫn mua). Quà ghi vào save TRƯỚC khi diễn, tắt game
// giữa chừng không mất. Sang Unity: GiftBoxView.
import * as ob from '../app/onboarding.js';
import { applyAction, itemById, ownedOptions } from '../deco/deco-data.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, getDeco, setDeco, refreshWallet, showToast } from '../app/shared.js';
import { categories } from '../ui/cat-art.mjs';
import { renderZoneSwitch } from './areas.js';
import { showPetReward } from './map-view.js';
import { startIdle } from './idle-coins.js';
import { renderDeco, refreshDecoDot } from './deco-panel.js';
import { applyRoom, room3d } from './room.js';
import { runItemTour, runBuyTour } from './tours.js';

let busy = false;

// Vẽ lại các hộp đang chờ (gọi khi vào Deco / sau mỗi lần mở).
export const renderGiftBoxes = () => { if (!busy) room3d?.setGiftBoxes(ob.giftsWaiting()); };

// Vào Deco: hiện thùng thú cưng đang chờ (mèo / chó vừa nhận nằm trong, chạm để mở), hộp quà, chạy lại hướng dẫn còn dở
// (tắt game giữa chừng).
export function enterDeco() {
  showNextPet();
  refreshDecoDot();
  renderGiftBoxes();
  const pending = ob.tourPending();
  if (pending === 'item') setTimeout(() => runItemTour(itemById(ob.ITEM_GIFT)), 600);
  if (pending === 'coins') setTimeout(() => runBuyTour(ob.nextBase(getDeco())), 600);
}

// ---------- Thùng thú cưng (ob.petBoxes): mỗi lần một thùng giữa vườn; chạm thì thùng mở, con vật nhảy ra, rồi tới thùng kế ----------
let petBusy = false;
function showNextPet() {
  const breeds = ob.petBoxes();
  // Thùng nằm ở vườn: đang ở khu khác thì về vườn.
  if (breeds.length && getDeco().zone !== 'garden') { setDeco({ ...getDeco(), zone: 'garden' }); applyRoom(getDeco()); renderZoneSwitch(); }
  room3d?.showPetBox(breeds);
}
// Chạm thùng trong cảnh (deco-panel.js onScenePick).
export async function openPetBox() {
  const breed = ob.petBoxes()[0];
  if (!breed || petBusy) return;
  petBusy = true;
  ob.removePetBox(breed); // ghi ngay: tắt game giữa lúc mở thì con vật đã ở trong nhà
  startIdle(); // ra khỏi thùng mới bắt đầu tích xu idle (core/idle.mjs tickIdle)
  refreshDecoDot();
  await showPetReward(breed); // "You got <tên>", đóng xong thì thùng mở và con vật nhảy ra
  await room3d?.openPetBox();
  petBusy = false;
  if (!getDeco().cats.includes(breed)) showToast(`${categories[breed].name} is waiting in Deco (room is full)`);
  showNextPet();
}

// Chạm hộp thứ `index` trong cảnh (deco-panel.js onScenePick). Chạm hộp nào cũng vậy: thứ tự quà theo số hộp đã mở.
export async function openGiftBox(index) {
  if (busy) return;
  const kind = ob.openGift();
  if (!kind) return renderGiftBoxes();
  busy = true;
  playSound('reward');
  try {
    if (kind === 'item') await giveItem(index);
    else await giveCoins(index);
  } finally {
    busy = false; // hộp vừa mở tự ẩn trong cảnh (deco-room.mjs openGift); hộp còn lại giữ nguyên chỗ
    refreshDecoDot();
  }
}

// Bồn hoa (ob.itemGift): đặt luôn (không trừ xu); nắp bật, model món nhảy từ hộp tới chỗ đặt rồi nảy + pháo giấy.
async function giveItem(index) {
  const base = ob.itemGift(getDeco());
  if (!base) return;
  setDeco(applyAction({ ...getDeco(), coins: getDeco().coins + base.price }, base, 1));
  if (getDeco().zone !== 'garden') setDeco({ ...getDeco(), zone: 'garden' });
  applyRoom(getDeco());
  await room3d?.openGift(index, base.id);
  renderDeco();
  runItemTour(base);
}

// Hiện thanh xu / gem + panel Deco; khung cảnh 3D trượt dần theo phần UI mới che và camera lướt về góc mặc định (không nhảy).
const reveal = () => { ob.applyClasses(); room3d?.refit(700); room3d?.resetCamera(1000); };

// Nắp bật, xu rơi ra đất quanh hộp, nằm một nhịp rồi bay vào thanh xu; thanh xu + gem + panel Deco hiện ngay lúc xu vừa chạm đất.
async function giveCoins(index) {
  const amount = ob.coinGift(getDeco()), before = getDeco().coins;
  setDeco({ ...getDeco(), coins: before + amount });
  $('deco-coins').textContent = before.toLocaleString('en-US');
  const pill = $('deco-coins').closest('.fh-coins');
  await new Promise(resolve => room3d ? room3d.openGift(index, null, mouth => {
    setTimeout(reveal, 700);
    const box = pill.getBoundingClientRect(), target = { x: box.left + box.width * .22, y: box.top + box.height / 2 + 14 }; // +14: thanh đang trượt xuống từ trên
    room3d.dropCoins(mouth, target, 12, () => { pill.classList.remove('coin-hit'); void pill.offsetWidth; pill.classList.add('coin-hit'); playSound('fill', 5); }).then(resolve);
  }) : resolve());
  reveal();
  refreshWallet();
  // Các kiểu khác của bồn hoa (quà hộp đầu) giờ mới đổi được: ghim NEW trên bồn hoa, chạm vào là thấy kiểu mới.
  const deco = getDeco(), flowerStyles = ownedOptions(deco, 'garden', ob.ITEM_GIFT).map(entry => entry.id).filter(id => !deco.zones.garden.placed.includes(id));
  setDeco({ ...deco, fresh: [...new Set([...(deco.fresh || []), ...flowerStyles])] });
  renderDeco();
  runBuyTour(ob.nextBase(getDeco()));
}
