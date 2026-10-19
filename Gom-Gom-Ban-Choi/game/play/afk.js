// Không chạm màn hình một lúc: mèo buồn ngủ rồi ngủ say; lâu lâu một con làm mặt cute. Sang Unity: AfkWatcher (MonoBehaviour).
import { TIMING } from '../data/tuning.mjs';
import { $ } from '../app/shared.js';
import { state, menus, now } from './context.js';
import { cardDrag } from './card-drag.js';
import { track } from './result.js';

// AFK: 5 giây không thao tác thì mọi con mèo buồn ngủ (body.afk).
// Game mobile: chỉ tính là "có chơi" khi ngón tay chạm màn hình (nhấn, kéo, nhả). Rê chuột không tính.
const { AFK_MS, AFK_SLEEP_MS } = TIMING;

let afkTimer = 0, deepTimer = 0;

function goAfk() {
  if (state.over || state.animating || cardDrag) return armAfk();
  if (document.body.classList.contains('low-moves')) return armAfk(); // sắp hết lượt: mèo lo lắng, không ngủ
  document.body.classList.add('afk');
  // Lim dim (sleepy) một lúc rồi ngủ say (sleep + zzz)
  clearTimeout(deepTimer);
  deepTimer = setTimeout(() => { if (document.body.classList.contains('afk')) document.body.classList.add('afk-deep'); }, AFK_SLEEP_MS);
  // Metric idle: tính cả khoảng chờ trước khi mèo ngủ (đã AFK_MS không chạm), chỉ khi đang trong ván.
  if (track && !track.done && !menus.menuOpen() && $('map').hidden) track.idleSince = now() - AFK_MS;
}

export function armAfk() {
  document.body.classList.remove('afk', 'afk-deep');
  clearTimeout(deepTimer);
  if (track?.idleSince) { track.idleMs += now() - track.idleSince; track.idleSince = 0; }
  clearTimeout(afkTimer);
  afkTimer = setTimeout(goAfk, AFK_MS);
}

addEventListener('pointerdown', armAfk, { passive: true });

addEventListener('pointerup', armAfk, { passive: true });

// Mèo đứng yên trên bàn thỉnh thoảng đổi sang mặt cute (mắt long lanh) trong chốc lát, mỗi lần một con ngẫu nhiên.
// Không chạy khi AFK (đang ngủ), sắp hết lượt (mặt lo), hết ván, đang có anim hay đang kéo thẻ.
const IDLE_FACE = { EVERY: [1400, 3200], HOLD: 1500 };

function idleFace() {
  setTimeout(idleFace, IDLE_FACE.EVERY[0] + Math.random() * (IDLE_FACE.EVERY[1] - IDLE_FACE.EVERY[0]));
  const body = document.body.classList;
  if (!state || state.over || state.animating || cardDrag || body.contains('afk') || body.contains('low-moves') || !$('map').hidden) return;
  const cells = [...document.querySelectorAll('#board > .cell .cat.bitmap')].map(cat => cat.closest('.cell'))
    .filter(cell => !['caged', 'petted', 'lifted', 'idle-cute', 'grumpy', 'grumpy-chew'].some(name => cell.classList.contains(name)));
  const cell = cells[Math.floor(Math.random() * cells.length)];
  if (!cell) return;
  cell.classList.add('idle-cute');
  setTimeout(() => cell.classList.remove('idle-cute'), IDLE_FACE.HOLD);
}

setTimeout(idleFace, 2000);

addEventListener('pointermove', event => { if (event.buttons || event.pointerType === 'touch') armAfk(); }, { passive: true });

armAfk();
