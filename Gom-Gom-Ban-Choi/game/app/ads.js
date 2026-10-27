// =====================================================================================================================
//  ADS-SDK — REWARDED ADS ĐANG GIẢ LẬP (phát video mẫu, nút Skip hiện sau 2/3 video)
// =====================================================================================================================
//  Bàn giao dev: chỉ cần thay thân hàm `playAd()` bên dưới bằng SDK quảng cáo thật (rewarded video). Mọi chỗ đặt ads đều đi qua
//  showRewarded(placement) và đánh dấu bằng chú thích `ADS-SDK` — `grep -rn "ADS-SDK" game` ra đủ danh sách:
//    continue    play/continue.js   màn continue khi thua: +lượt (chỉ lần continue đầu của một ván)
//    bonusCoins  play/result.js     bảng thắng: thêm xu (lần 1–2 trong ngày +50%, sau đó +20%), không giới hạn
//    booster     app/store.js       popup hết booster: nhận 1 cái
//    idle        menu/idle-coins.js nhận xu idle ở Deco: thêm 50%, 1 lần/ngày
//    gems        menu/shop.js       Shop: gem miễn phí
//  Giới hạn / ngày + màn bắt đầu có ads: REWARDED_ADS trong data/economy.mjs (Remote Config). Đếm ở core/gems.mjs.
//  Interstitial: chưa có (thiết kế: tắt ở đầu bản test).
// =====================================================================================================================
import { REWARDED_ADS } from '../data/economy.mjs';
import { adsLeft, noteAd } from '../core/gems.mjs';
import { loadProgress, levelsCleared } from '../core/progression.mjs';
import { getWallet, setWallet, showToast } from './shared.js';

const SIM_VIDEO = './assets/video/sample-ad.mp4';
const SKIP_AT = 2 / 3;
const PLACEMENT_NAMES = { continue: 'Extra moves', bonusCoins: 'Bonus coins', booster: 'Free booster', idle: 'Bonus cat coins', gems: 'Free gems' };

// Chỗ đặt này hiện được không: đã tới màn có ads và hôm nay còn lượt.
export const adReady = placement => levelsCleared(loadProgress()) >= REWARDED_ADS.from - 1 && adsLeft(getWallet(), placement, Date.now()) > 0;
export const adsLeftToday = placement => adsLeft(getWallet(), placement, Date.now());

// Xem một rewarded ad; true = xem hết, được thưởng (người gọi tự phát thưởng). Đếm trần chỉ khi xem hết.
export async function showRewarded(placement) {
  if (!adReady(placement)) { showToast('No more ads here today. Come back tomorrow!'); return false; }
  const watched = await playAd(placement);
  if (watched) setWallet(noteAd(getWallet(), placement, Date.now()));
  // ADS-SDK: gửi analytics (ad_rewarded / ad_skipped + placement) ở đây.
  console.info(`[ads] rewarded ${placement}: ${watched ? 'watched' : 'skipped'}`);
  return watched;
}

// ADS-SDK: THAY HÀM NÀY bằng SDK. Trả về Promise<boolean>: true khi SDK báo "user earned reward", false khi đóng sớm / lỗi / không có ads.
// Giả lập: phát SIM_VIDEO; đồng hồ đếm ngược tới lúc hiện nút Skip (sau SKIP_AT thời lượng). Skip hay xem hết đều được thưởng.
function playAd(placement) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ad-sim';
    dialog.innerHTML = `<video src="${SIM_VIDEO}" playsinline></video><small>AD · ${PLACEMENT_NAMES[placement] ?? placement}</small>
      <div class="ad-clock"><b></b></div><button class="pill-button ghost" hidden>Skip ›</button>`;
    const video = dialog.querySelector('video'), clock = dialog.querySelector('.ad-clock'), skip = dialog.querySelector('button');
    video.ontimeupdate = () => {
      const skipAt = video.duration * SKIP_AT, left = Math.max(0, skipAt - video.currentTime);
      clock.style.setProperty('--p', left / skipAt);
      clock.querySelector('b').textContent = Math.ceil(left);
      if (!left) { clock.hidden = true; skip.hidden = false; }
    };
    skip.onclick = () => dialog.close('done');
    video.onended = () => dialog.close('done');
    video.onerror = () => dialog.close('error');
    dialog.addEventListener('cancel', event => event.preventDefault()); // Esc không đóng ads
    dialog.addEventListener('close', () => { video.pause(); dialog.remove(); resolve(dialog.returnValue === 'done'); });
    document.body.append(dialog);
    dialog.showModal();
    // Trình duyệt chặn tự phát có tiếng thì phát không tiếng.
    video.play().catch(() => { video.muted = true; return video.play(); }).catch(() => dialog.close('error'));
  });
}
