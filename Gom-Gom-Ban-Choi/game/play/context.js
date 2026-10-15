// Trạng thái dùng chung của màn chơi: ván đang chơi (`state`, cỡ bàn W × H — chỉ setSession gán), skin quân, cầu nối sang
// menu (`menus`), tiện ích DOM nhỏ (ô bàn, lớp hiệu ứng). Mọi module trong play/ đọc qua import, không tự gán.
// Sang Unity: PlaySession (MonoBehaviour giữ Session của core) + vài hàm tiện ích của BoardView.
import { categories, addArt as addCatArt, skinGroup } from '../ui/cat-art.mjs';
import { BOARD, TIMING } from '../data/tuning.mjs';
import { $, pieceSkin } from '../app/shared.js';

// Luồng menu (showTab, showMap, hideMenus, menuOpen): main.js nối vào lúc khởi động.
export let menus = null;

export function connectMenus(menuController) { menus = menuController; }

export const { PREVIEW_COUNT } = BOARD;

// Kích thước bàn của màn đang chơi (mỗi màn một cỡ/hình, xem board-shapes.mjs); đặt lại ở newGame.
export let W = BOARD.W, H = BOARD.H;

export let state;

// Bắt đầu ván mới: giữ phiên + cỡ bàn (chỉ module này gán; module khác đọc qua import).
export function setSession(next) { state = next; ({ W, H } = next); }

export const now = () => performance.now();

// Bộ quân đang dùng (mèo / chó, shared.js pieceSkin): đọc lại mỗi lần vào màn. look(nhóm) = giống vẽ trên bàn (tên, màu, hình).
let skin = pieceSkin();

export function refreshSkin() { skin = pieceSkin(); }

export const look = group => categories[skinGroup(group, skin)];

export function addArt(element, object) {
  addCatArt(element, skinGroup(object.group, skin));
}

export function cellEl(index) {
  return document.querySelector(`.cell[data-index="${index}"]`);
}

export const { LIFT_MS, MERGE_MS, WIN_PAUSE_MS, DROP_MS } = TIMING;

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const pendingMerges = new Set();

export function fxLayer() {
  let layer = $('board').querySelector(':scope > .board-fx');
  if (!layer) { layer = document.createElement('div'); layer.className = 'board-fx'; $('board').append(layer); }
  return layer;
}
