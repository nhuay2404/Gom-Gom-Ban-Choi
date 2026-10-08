// Điểm vào của game: nối hai luồng điều khiển rồi mở game.
// - play-controller.js: luồng MÀN CHƠI (gameplay trong một ván, bảng vào màn, kết quả).
// - menu-controller.js: luồng MENU (Map, Home / Deco / Shop, cài đặt, dev).
// Phần dùng chung (ví xu, kho booster, toast): shared.js.
import * as play from './play-controller.js';
import * as menus from './menu-controller.js';
import { loadProgress, unlockedCount } from '../gameplay/progression.mjs';
import * as ob from './onboarding.js';

play.connectMenus(menus);
menus.connectPlay(play);

// Mở game luôn vào Home; màn chơi dựng sẵn phía sau ở level đang mở. PLAY vào thẳng level đó.
play.newGame(unlockedCount(loadProgress()) - 1);
menus.showTab('home');
// Lần đầu chơi (chưa qua màn nào): vào thẳng level 1, không dừng ở Home. Thoát / xong màn thì về Home như thường.
if (!loadProgress().stars.some(Boolean)) play.startLevel(0);
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
