// Điểm vào của game: nối hai luồng điều khiển rồi mở game.
// - play-controller.js: luồng MÀN CHƠI (gameplay trong một ván, bảng vào màn, kết quả).
// - menu-controller.js: luồng MENU (Map, Home / Deco / Shop, cài đặt, dev).
// Phần dùng chung (ví xu, kho booster, toast): shared.js.
import * as play from './play-controller.js';
import * as menus from './menu-controller.js';
import { loadProgress, unlockedCount } from './gameplay/progression.mjs';

play.connectMenus(menus);
menus.connectPlay(play);

// Mở game luôn vào Home; màn chơi dựng sẵn phía sau ở level đang mở. PLAY vào thẳng level đó.
play.newGame(unlockedCount(loadProgress()) - 1);
menus.showTab('home');
