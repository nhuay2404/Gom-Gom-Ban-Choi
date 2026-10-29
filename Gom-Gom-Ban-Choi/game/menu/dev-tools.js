// Nút cho game dev (chỉ máy dev): mở hết màn, cộng xu, reset, QC model, UI Studio, Level Editor. Không port sang bản phát hành.
import * as ob from '../app/onboarding.js';
import { LEVELS } from '../data/levels.mjs';
import { OFFERS } from '../data/economy.mjs';
import { openOffer } from '../core/gems.mjs';
import { loadProgress, saveProgress } from '../core/progression.mjs';
import { playSound } from '../ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';
import { CATALOG, previewDeco, ownAllBase, claimCat } from '../deco/deco-data.mjs';
import { $, DEV_MODE, showToast, getDeco, setDeco, devMoney, getWallet, setWallet } from '../app/shared.js';
import { closeAllSettings } from './settings.js';
import { DEV_ZONES_KEY } from './areas.js';
import { showTab, TABS } from './tabs.js';
import { room3d, applyRoom, mountRoom } from './room.js';
import { map3d } from './map-view.js';

// ===== Nút cho game dev: mở hết màn (3 sao) → mở luôn phòng khách + mèo khoá theo màn, cộng xu để thử Deco/Shop =====
const DEV_COINS = 99999;
const DEV_GEMS = 99999;

document.querySelectorAll('.dev-only').forEach(row => { row.hidden = !DEV_MODE; });

$('dev-unlock').onclick = () => {
  closeAllSettings();
  saveProgress({ ...loadProgress(), stars: LEVELS.map(() => 3) });
  ob.setStage('done');
  writeText(SAVE_KEYS.decoTour, 'done'); // bỏ luôn hướng dẫn Deco
  writeText(SAVE_KEYS.gifts, '2'); // bỏ qua hộp quà onboarding (hộp món + hộp xu)
  writeText(SAVE_KEYS.petBoxes, '[]');
  writeText(SAVE_KEYS.catTalk, 'done'); // không còn dấu "!" trên mèo cam
  room3d?.markCat(null); // không còn thùng mèo chờ mở (mèo nhận sẵn ngay dưới)
  writeText(DEV_ZONES_KEY, 'on'); // mở cả phần / món khoá ở màn chưa có (vườn mở rộng)
  setDeco(ownAllBase({ ...getDeco(), boxed: [], coins: Math.max(getDeco().coins, DEV_COINS) })); // hộp quà khu mới: đặt luôn món // + có sẵn mọi món mặc định
  // Nhận sẵn mọi mèo / chó (không xếp hàng chục thùng chờ mở ở Deco: room.js startRoom chỉ đóng thùng cho con chưa nhận).
  setDeco(CATALOG.filter(entry => entry.cat === 'cats').reduce((deco, entry) => claimCat(deco, entry.breed), getDeco()));
  // Xoá trạng thái ưu đãi cũ (đã mua / đang hồi) rồi mở lại mọi gói để thử ở Shop.
  setWallet(Object.keys(OFFERS).reduce((w, kind) => openOffer(w, kind, Date.now()), { ...getWallet(), gems: Math.max(getWallet().gems, DEV_GEMS), offers: {} }));
  playSound('reward');
  showTab('home');
  showToast(`Dev: all ${LEVELS.length} levels + all areas unlocked · all default furniture owned · ${DEV_COINS.toLocaleString('en-US')} coins + gems · all shop packs open · tutorials skipped`);
};

const renderDevMoney = () => $('dev-money').setAttribute('aria-pressed', devMoney());

// Khởi động (menu-controller.js gọi sau khi mọi module menu đã nạp).
export function startDevTools() { renderDevMoney(); }

$('dev-money').onclick = () => {
  try { localStorage.setItem('gomgom-dev-money', devMoney() ? 'off' : 'on'); } catch {}
  renderDevMoney();
  showToast(devMoney() ? 'Dev: money mod ON — spending adds coins' : 'Dev: money mod OFF');
};

// Reset: xoá tiến độ, deco/xu, booster, hồ sơ độ khó (giữ cài đặt âm thanh, ngày/đêm) rồi tải lại như người chơi mới.
// Hỏi lại bằng hộp thoại trong game: confirm() của trình duyệt bị webview / trình duyệt trong app chặn (trả về false ngay).
$('dev-reset').onclick = () => {
  closeAllSettings();
  $('dev-reset-dialog').showModal();
};

$('dev-reset-cancel').onclick = () => $('dev-reset-dialog').close();

$('dev-reset-ok').onclick = () => {
  ['progress', 'deco', 'boosters', 'profile', 'decoTour', 'onboarding', 'gifts', 'petBoxes'].forEach(key => { try { localStorage.removeItem(SAVE_KEYS[key]); } catch {} });
  try { localStorage.removeItem(DEV_ZONES_KEY); } catch {}
  location.reload();
};

// QC model 3D (qc.mjs): liệt kê lỗi model / chỗ đặt đồ. Mở game với ?qc thì tự chạy khi phòng 3D sẵn sàng.
export function runQC() {
  if (!room3d) return showToast('3D room not ready yet');
  const report = room3d.qc(map3d?.scene ? { map: map3d.scene } : {});
  // Popup xem trước ở Shop: dựng thử từng món (mọi khu mở), soi như popup — còn bị che / quay mặt sau là lỗi.
  for (const entry of CATALOG.filter(e => e.cat === 'furniture')) {
    room3d.apply({ ...previewDeco(getDeco(), entry), zone: entry.zone }, { living: true, bedroom: true, kitchen: true, bathroom: true, backyard: true, kinder: true, gardenExpand: true });
    room3d.qcPreview(entry.id).forEach(what => report.push({ level: 'error', zone: entry.zone, what: `preview: ${what}` }));
  }
  applyRoom(getDeco());
  const open = TABS.find(tab => !$(tab).hidden);
  if (open) mountRoom(open);
  const errors = report.filter(r => r.level === 'error');
  console.table(report);
  $('qc-title').textContent = errors.length ? `Model QC: ${errors.length} error(s), ${report.length - errors.length} warning(s)` : report.length ? `Model QC: no errors, ${report.length} warning(s)` : 'Model QC: all clear ✓';
  $('qc-list').replaceChildren(...report.map(r => Object.assign(document.createElement('li'), { className: r.level, textContent: `[${r.zone}] ${r.what}` })));
  $('qc-dialog').showModal();
  return report;
}

$('dev-qc').onclick = () => runQC();

// Cột nút dev thu gọn / mở (nhớ trong máy).
const DEV_PANEL_KEY = 'gomgom-dev-panel-collapsed';

$('dev-panel').classList.toggle('collapsed', readText(DEV_PANEL_KEY) === 'on');

$('dev-toggle').onclick = () => writeText(DEV_PANEL_KEY, $('dev-panel').classList.toggle('collapsed') ? 'on' : 'off');

// UI Studio (app/ui-studio.js, main.js nạp khi có nút dev): nút chỉ hiện khi studio đã nạp (nó báo qua sự kiện 'ui-studio:state').
addEventListener('ui-studio:state', event => {
  $('dev-studio').hidden = false;
  $('dev-studio').setAttribute('aria-pressed', event.detail.shown);
});

$('dev-studio').onclick = () => dispatchEvent(new Event('ui-studio:toggle'));

// Slow-mo (soi anim, không lưu: tải lại là về ×1): mọi anim (WAAPI + CSS) chạy chậm theo playbackRate, setTimeout giãn theo cùng hệ số
// để các nhịp hẹn giờ của juice vẫn khớp nhau. Anim tự chạy theo requestAnimationFrame (cảnh 3D, số điểm đếm lên) không bị chậm.
const SLOW_STEPS = [1, 5, 10];
const nativeTimeout = window.setTimeout.bind(window);
let slow = 1;

function slowTick() {
  for (const animation of document.getAnimations()) if (animation.playbackRate !== 1 / slow) animation.playbackRate = 1 / slow;
  if (slow > 1) requestAnimationFrame(slowTick);
}

$('dev-slow').onclick = () => {
  const wasOff = slow === 1;
  slow = SLOW_STEPS[(SLOW_STEPS.indexOf(slow) + 1) % SLOW_STEPS.length];
  window.setTimeout = slow > 1 ? (fn, ms = 0, ...args) => nativeTimeout(fn, ms * slow, ...args) : nativeTimeout;
  if (wasOff || slow === 1) slowTick();
  $('dev-slow').setAttribute('aria-pressed', slow > 1);
  $('dev-slow').querySelector('span').textContent = `×${slow}`;
  showToast(slow > 1 ? `Dev: slow-mo ×${slow}` : 'Dev: slow-mo off');
};

// Level Editor (tools/levels/level-editor/): mở toàn màn hình trong iframe. Bản HTML một file (file://) không có máy chủ phục vụ /tools.
$('dev-editor').hidden = location.protocol === 'file:';

$('dev-editor').onclick = () => {
  const frame = $('dev-editor-frame');
  if (!frame.src) frame.src = '/tools/levels/level-editor/';
  $('dev-editor-overlay').hidden = false;
};

$('dev-editor-close').onclick = () => { $('dev-editor-overlay').hidden = true; };
