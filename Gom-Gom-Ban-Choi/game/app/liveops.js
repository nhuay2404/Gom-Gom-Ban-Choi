// Nối Gom Gom với hc-kit (game/hc-kit/, luật Economy + LiveOps dùng chung nhiều game; tài liệu: hc-kit docs/INTEGRATION.md).
// Ở đây có đúng ba thứ riêng của game: adapter (kit trao thưởng / buff / continue vào game), ports (lưu trữ, quảng cáo, thanh toán)
// và instance `liveops` mà hai luồng gọi. Config + số liệu: liveops/config.mjs. Giao diện: liveops-ui.js.
// Tắt LiveOps (LIVEOPS_ON = false): `liveops` = null, mọi chỗ gọi tự bỏ qua, game chạy như bản core.
import { createKit, ports } from '../hc-kit/index.mjs';
import { LIVEOPS_CONFIG, LIVEOPS_ON } from '../liveops/config.mjs';
import { loadProgress, levelsCleared } from '../gameplay/progression.mjs';
import { grantItem } from '../deco/deco-data.mjs';
import { $, getDeco, setDeco, getBoosters, storeBoosters, refreshWallet } from './shared.js';

// Màn chơi đăng ký cách áp buff chuỗi thắng / continue vào ván (play-controller.js gọi connectPlay lúc nạp).
let play = { applyBuff() {}, resume() {} };
export const connectPlay = handlers => { play = handlers; };

const adapter = {
  progress: () => ({ cleared: levelsCleared(loadProgress()) }),
  // Phần thưởng của game: xu vào ví Deco, booster vào kho, đồ Deco độc quyền (event) vào kho + đặt luôn. Gems / mạng vô hạn kit tự giữ.
  grant(bundle) {
    let deco = getDeco();
    if (bundle.coins) deco = { ...deco, coins: deco.coins + bundle.coins };
    const stock = { ...getBoosters() };
    for (const [id, n] of Object.entries(bundle.items ?? {})) {
      if (id in stock) stock[id] += n;
      else deco = grantItem(deco, id);
    }
    setDeco(deco);
    storeBoosters(stock);
    refreshWallet();
  },
  applyBuff: (buffs, info) => play.applyBuff(buffs, info),
  resume: info => play.resume(info),
};

// ===== Quảng cáo có thưởng giả lập: đếm 3 giây rồi mới nhận được thưởng; đóng sớm = không thưởng =====
export function playAd(label) {
  return new Promise(resolve => {
    const dialog = $('ad-dialog'), claim = $('ad-claim'), close = $('ad-close');
    let left = 3, done = false;
    $('ad-label').textContent = label;
    claim.hidden = true;
    $('ad-count').textContent = left;
    const timer = setInterval(() => {
      left--;
      $('ad-count').textContent = Math.max(0, left);
      if (left <= 0) { clearInterval(timer); claim.hidden = false; }
    }, 1000);
    const finish = ok => {
      if (done) return;
      done = true;
      clearInterval(timer);
      dialog.close();
      resolve(ok);
    };
    claim.onclick = () => finish(true);
    close.onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    dialog.showModal();
  });
}
const C = LIVEOPS_CONFIG;
const AD_LABEL = { continue: `+${C.continue.ad.value} moves`, life: '+1 life', chest: 'Double chest', 'double:fish': 'Double fish' };

// Phase 1–2 chưa có SDK quảng cáo / thanh toán thật: hai port giả lập, giao diện ghi nhãn "test". Production: thay port, không sửa kit.
export const liveops = LIVEOPS_ON ? createKit({
  config: LIVEOPS_CONFIG,
  adapter,
  ports: {
    storage: ports.webStorage(globalThis.localStorage),
    ads: { rewarded: placement => playAd(AD_LABEL[placement] ?? 'Reward') },
    iap: { buy: async () => ({ ok: true }) },
  },
}) : null;
// Giao diện: body.liveops-on hiện phần LiveOps (.lo-only), tắt thì hiện phần của bản core (.core-only, như main: pill "coming soon").
document.body.classList.toggle('liveops-on', LIVEOPS_ON);
if (!LIVEOPS_ON) { $('home-daily').classList.add('soon'); $('home-daily').setAttribute('aria-label', 'Daily (coming soon)'); }
liveops?.sync();

// Số màn trong game đếm từ 0 (levelIndex), trong kit đếm từ 1.
export const kitLevel = levelIndex => levelIndex + 1;
