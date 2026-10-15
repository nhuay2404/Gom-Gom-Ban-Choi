// Kết thúc ván: bảng kết quả (sao, xu, mở khu), metric cho độ khó thích ứng (thời gian nghĩ, AFK, booster, bỏ ngang),
// hộp hỏi rời màn / chơi lại. Sang Unity: ResultPanel + PlayMetrics.
import * as game from '../core/session.mjs';
import * as ob from '../app/onboarding.js';
import { catMarkup } from '../ui/cat-art.mjs';
import { LEVELS } from '../data/levels.mjs';
import { loadProgress, saveProgress, recordWin } from '../core/progression.mjs';
import { COMEBACK_GIFT_MOVES, AREA_UNLOCK } from '../data/economy.mjs';
import { boostersUnlocked } from '../core/boosters.mjs';
import { playSound } from '../ui/sound.mjs';
import { loadProfile, saveProfile, startVisit, recordAttempt, noteDwell, boosterTip } from '../core/adaptive.mjs';
import { AREA_ORDER, AREA_NAMES } from '../deco/deco-data.mjs';
import { $, getDeco, setDeco, getBoosters, storeBoosters, BOOSTER_NAMES } from '../app/shared.js';
import { now, state, menus } from './context.js';
import { render } from './hud.js';
import { renderTutorial } from './tutorial.js';
import { levelsCleared, startLevel } from './play-controller.js';

// Profile người chơi cho độ khó thích ứng (adaptive.mjs) + metric của ván đang chơi (ghi ở recordTry).
export let profile = startVisit(loadProfile());

saveProfile(profile);

export let track = null;

export function startTracking() {
  const t = now();
  track = { start: t, last: t, thinks: [], idleMs: 0, idleSince: 0, boosters: 0, boostUse: { hammer: 0, swap: 0, moves: 0 }, bought: 0, preBoostRatio: null, done: false };
}

const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

// ===== Metric cho độ khó thích ứng: thời gian nghĩ mỗi lượt, AFK, booster, bỏ ngang, đứng ở bảng kết quả =====
// Ghi một lần thử vào profile (mỗi ván một lần). Trả về true nếu được tặng quà (thắng sau chuỗi "sắp bỏ game").
function recordTry(win, reason) {
  if (!track || track.done) return false;
  track.done = true;
  if (track.idleSince) track.idleMs += now() - track.idleSince;
  const { plan, level } = state;
  const result = recordAttempt(profile, {
    level: state.levelIndex, win, reason, ratio: +Math.min(state.score / level.target, state.grassTotal ? 1 - game.grassLeft(state) / state.grassTotal : Infinity).toFixed(3), stars: win ? state.outcome.stars : 0,
    boosters: track.boosters, boostUse: track.boostUse, bought: track.bought, preBoostRatio: track.preBoostRatio, thinkMs: Math.round(median(track.thinks)), idleMs: Math.round(track.idleMs),
    durationMs: Math.round(now() - track.start), profile: plan.profile, shift: plan.shift, mode: plan.mode, layout: plan.layout, count: plan.count,
  });
  profile = result.profile;
  saveProfile(profile);
  return result.gift;
}

// Rời ván giữa chừng (chơi lại / về Home) khi đã đặt ít nhất một thẻ = bỏ ngang.
function recordQuit() {
  if (state && !state.over && state.moves < state.level.moves) recordTry(false, 'quit');
}

let resultShownAt = 0;

export function leaveResult() {
  profile = noteDwell(profile, Math.round(now() - resultShownAt));
  saveProfile(profile);
  $('result-dialog').close();
}

export function endLevel(win, reason = '') {
  state.over = true;
  state.outcome ??= { win, reason, stars: 0 };
  // Hết ván (thắng: đã ẩn từ lúc thanh điểm đầy, celebrateWin; thua: hết lượt / kẹt): ẩn mọi UI chơi (level / move / thanh
  // điểm, booster, dock xoay / next / hold), chỉ còn bàn + bảng kết quả
  document.body.classList.add('level-over');
  if (!win) playSound('lose');
  const gift = recordTry(win, win ? 'win' : state.moves > 0 ? 'stuck' : 'moves');
  if (gift) storeBoosters({ ...getBoosters(), moves: getBoosters().moves + COMEBACK_GIFT_MOVES });
  // Thua sát nút mà chưa dùng booster: mời dùng +lượt ở lần sau (luật sát nút giữ nguyên độ khó).
  const tip = !win && boostersUnlocked(state.levelIndex) && boosterTip(profile);
  render(win ? '' : `${reason} You scored ${state.score}/${state.level.target} points.`, !win);
  renderTutorial();
  const index = state.levelIndex, last = index === LEVELS.length - 1;
  const stars = win ? state.outcome.stars : 0;
  let coinsEarned = 0;
  if (win) {
    const record = recordWin(loadProgress(), index, stars); // chỉ sao mới (vượt kỷ lục cũ) mới ra xu
    saveProgress(record.progress);
    coinsEarned = record.coins;
    if (coinsEarned) setDeco({ ...getDeco(), coins: getDeco().coins + coinsEarned });
  }
  const unlock = win ? ob.unlockOnWin(index) : null; // onboarding: màn này vừa mở khoá thứ gì ('garden' | 'cats' | 'decor')
  // Vừa tới mốc màn của một khu (thắng đúng màn mốc lần đầu): báo trong hộp kết quả (còn bước trang trí ở Deco).
  const reachedArea = win && coinsEarned > 0 && AREA_ORDER.find(area => index + 1 === AREA_UNLOCK[area].level && levelsCleared() === AREA_UNLOCK[area].level);
  if (coinsEarned || gift) setTimeout(() => playSound('reward'), 450);
  // Bảng kết quả (Figma): xu thưởng là dòng to có đồng xu; các ghi chú khác (mở khu, quà, mẹo, lý do thua) là dòng nhỏ.
  $('result-coins').innerHTML = `<i class="ico-coin"></i><b>+${coinsEarned}</b><small>coins</small>`;
  const notes = [reachedArea && `${AREA_NAMES[reachedArea]}: level goal reached!`, gift && `Gift: ${BOOSTER_NAMES.moves} booster`,
    tip && `So close! Try ${BOOSTER_NAMES.moves} next time.`, !win && !tip && reason].filter(Boolean);
  $('result-note').hidden = !notes.length;
  $('result-note').textContent = notes.join(' · ');
  const dialog = $('result-dialog');
  dialog.classList.toggle('win', win);
  dialog.classList.toggle('lose', !win);
  // Mèo ló đầu: mèo cam vẽ sẵn (cat-art.mjs), thắng thì mặt vui (.joy), thua thì khóc (.afk-crying) — CSS chọn mặt theo class.
  if (!$('result-cat').firstChild) $('result-cat').innerHTML = catMarkup.orange;
  $('result-title').textContent = win ? (last ? 'Journey Complete!' : 'Level Complete!') : 'Try Again!';
  $('result-sub').textContent = `Level ${index + 1} ${win ? 'cleared' : 'failed'}`;
  $('result-score').textContent = state.score.toLocaleString('en-US');
  const box = $('result-unlock');
  box.hidden = !unlock;
  if (unlock) box.innerHTML = `<span class="ru-title">Unlocked:</span><div class="ru-items">${UNLOCK_ITEMS[unlock].map(item => `<figure><span class="ru-icon">${item.icon}</span><figcaption>${item.name}</figcaption></figure>`).join('')}</div>`;
  dialog.classList.toggle('has-unlock', !!unlock);
  $('result-continue').hidden = !unlock;
  $('result-next').hidden = !win || last || !!unlock;
  $('result-replay').hidden = !win || !!unlock;
  $('result-map').hidden = !!unlock;
  $('result-retry').hidden = win;
  // Tiếng thắng phát đúng lúc bảng Level Complete hiện (sound.mjs: fade in).
  setTimeout(() => { dialog.showModal(); resultShownAt = now(); if (win) playSound('complete'); }, win ? 0 : 700);
}

// Thứ được mở khoá ở các màn onboarding (onboarding.js), hiện dưới "Unlocked:" ở bảng kết quả.
const UNLOCK_ITEMS = {
  garden: [{ name: 'Garden', icon: '<svg viewBox="0 0 24 24"><use href="#i-deco"/></svg>' }],
  cats: [{ name: 'Orange cat', icon: catMarkup.orange }, { name: 'Gray cat', icon: catMarkup.gray }],
  decor: [{ name: 'Decoration', icon: '<svg viewBox="0 0 24 24"><use href="#i-cart"/></svg>' }],
};

$('result-continue').onclick = () => { leaveResult(); menus.runOnboarding(); };

$('result-next').onclick = () => { leaveResult(); startLevel(state.levelIndex + 1); };

$('result-retry').onclick = $('result-replay').onclick = () => { leaveResult(); startLevel(state.levelIndex); };

$('result-map').onclick = () => { leaveResult(); menus.showTab('home'); };

// Rời ván đang chơi dở (đã đặt ít nhất một thẻ): hỏi lại trước để không mất lượt vì bấm nhầm.
let quitAction = null;

function confirmQuit(title, action) {
  if (state.animating) return;
  if (state.over || state.moves >= state.level.moves) return action();
  quitAction = action;
  $('quit-title').textContent = title;
  $('quit-dialog').showModal();
}

$('quit-cancel').onclick = () => $('quit-dialog').close();

$('quit-ok').onclick = () => { $('quit-dialog').close(); recordQuit(); quitAction?.(); quitAction = null; };

$('restart').onclick = () => confirmQuit('Restart this level?', () => startLevel(state.levelIndex));

$('open-map').onclick = () => confirmQuit('Leave this level?', () => menus.showTab('home'));

// Ảnh bảng kết quả (Figma 3×, panel ~850 KB): giải mã sẵn lúc rảnh, để lần đầu bảng bật lên không phải giải mã giữa anim (giật).
(function preloadResultArt() {
  const names = ['panel', 'win-cat', 'win-stars', 'win-title', 'win-score', 'win-cleared', 'fail-cat', 'fail-heart', 'fail-title', 'btn-next', 'btn-retry', 'btn-home-round', 'btn-retry-round'];
  const keep = [];
  const load = () => names.forEach(name => {
    const img = new Image();
    img.src = `./assets/img/result/${name}.png`;
    img.decode?.().catch(() => {});
    keep.push(img); // giữ tham chiếu để ảnh đã giải mã không bị dọn
  });
  (globalThis.requestIdleCallback ?? (fn => setTimeout(fn, 1500)))(load);
})();
