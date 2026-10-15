// Mở game (main.js gọi SAU khi tải config từ Firebase): nối hai luồng điều khiển rồi mở game.
// - play-controller.js: luồng MÀN CHƠI (gameplay trong một ván, bảng vào màn, kết quả).
// - menu-controller.js: luồng MENU (Map, Home / Deco / Shop, cài đặt, dev).
// Phần dùng chung (ví xu, kho booster, toast): shared.js.
import * as play from '../play/play-controller.js';
import * as menus from './menu-controller.js';
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import * as ob from './onboarding.js';
import { DEV_MODE } from './shared.js';

play.connectMenus(menus);
menus.connectPlay(play);

// Mở game luôn vào Home; màn chơi dựng sẵn phía sau ở level đang mở. PLAY vào thẳng level đó.
play.newGame(unlockedCount(loadProgress()) - 1);
menus.showTab('home');
// Lần đầu chơi (chưa qua màn nào): vào thẳng level 1, không dừng ở Home. Thoát / xong màn thì về Home như thường.
if (!loadProgress().stars.some(Boolean)) play.startLevel(0);
// ?level=N (chỉ dev; level editor mở từ nút "Chơi thử trong game"): vào thẳng màn N, kể cả màn chưa mở khoá.
const devLevel = Number(new URLSearchParams(location.search).get('level'));
if (DEV_MODE && devLevel >= 1) play.startLevel(devLevel - 1);
// ?embed (Level Editor nhúng game trong khung): ẩn cột nút Dev (chỉ ẩn, không xoá: menu-controller.js còn bám nút Studio trong đó).
if (new URLSearchParams(location.search).has('embed')) document.getElementById('dev-panel')?.style.setProperty('display', 'none', 'important');
// ?bot=weak|mid|good (chỉ dev): bot tự chơi ván hiện tại ngay trên giao diện game.
const botProfile = new URLSearchParams(location.search).get('bot');
if (DEV_MODE && botProfile) import('./dev-bot.js').then(m => m.startBot(botProfile));
// Đã thắng màn mở khoá nhưng chưa xem xong hướng dẫn (tắt game giữa chừng): làm tiếp ngay.
if (ob.pending()) menus.sceneReady.then(() => menus.runOnboarding());

// Màn loading (index.html #loading): JS game đã chạy = 45%, font = 60%, cảnh 3D = 100% rồi mờ dần. Hiện tối thiểu ~1 s
// cho khỏi chớp; quá 8 s (mạng chậm) thì vào game luôn, cảnh 3D tự hiện khi nạp xong.
const loading = document.getElementById('loading');
const step = pct => { document.getElementById('loading-fill').style.width = `${pct}%`; };
step(45);
const shownAt = performance.now(), wait = ms => new Promise(resolve => setTimeout(resolve, ms));
document.fonts?.ready.then(() => step(60));
Promise.race([menus.sceneReady, wait(8000)])
  .then(() => { step(100); return wait(Math.max(350, 1000 - (performance.now() - shownAt))); })
  .then(() => loading.classList.add('done')); // giữ lại phần tử: chuyển tab Home / Deco / Shop dùng lại màn này (menu-controller.js switchTab)
