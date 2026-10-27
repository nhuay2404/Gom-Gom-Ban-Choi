// Kết thúc ván: bảng kết quả (sao, xu, mở khu), metric cho độ khó thích ứng (thời gian nghĩ, AFK, booster, bỏ ngang),
// hộp hỏi rời màn / chơi lại. Sang Unity: ResultPanel + PlayMetrics.
import * as game from '../core/session.mjs';
import * as ob from '../app/onboarding.js';
import { catMarkup } from '../ui/cat-art.mjs';
import { LEVELS } from '../data/levels.mjs';
import { loadProgress, saveProgress, recordWin } from '../core/progression.mjs';
import { COMEBACK_GIFT_MOVES, GEM_REWARDS, OFFERS } from '../data/economy.mjs';
import { boostersUnlocked } from '../core/boosters.mjs';
import { playSound } from '../ui/sound.mjs';
import { loadProfile, saveProfile, startVisit, recordAttempt, noteDwell, boosterTip } from '../core/adaptive.mjs';
import { $, getDeco, setDeco, getBoosters, storeBoosters, BOOSTER_NAMES, refreshWallet, getWallet, noteEvent } from '../app/shared.js';
import { grantGems, triggerOffer, showOffer } from '../app/store.js';
import { showRewarded, adReady } from '../app/ads.js';
import { bonusCoins } from '../core/gems.mjs';
import { offerContinue } from './continue.js';
import { now, state, menus } from './context.js';
import { render } from './hud.js';
import { renderTutorial } from './tutorial.js';
import { startLevel } from './play-controller.js';
import { confirmationMarkup } from '../ui/shared/confirmation-view.mjs';

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

// Ván treo khi người chơi sang Shop mua gem: 'continue' (đang ở màn "So close!") | 'play' (đang chơi dở, từ popup hết booster).
// Về Home (menu/tabs.js showTab) thì mở lại đúng chỗ đó thay cho bản đồ. Vào màn khác (startLevel) thì bỏ ván treo và ghi thua / bỏ ngang.
let pending = null;
export const pendingRun = () => pending;
export function suspendForShop(kind) { pending = kind; }
export function resumeRun() {
  const kind = pending;
  pending = null;
  menus.hideMenus();
  $('map').hidden = true;
  render();
  if (kind === 'continue') endLevel(false, state.outcome?.reason ?? '');
}
export function dropPendingRun() {
  if (pending === 'continue') recordTry(false, state.moves > 0 ? 'stuck' : 'moves');
  else if (pending === 'play') recordQuit();
  pending = null;
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

export async function endLevel(win, reason = '') {
  // Thua: mời continue trước (gem / ads); chơi tiếp thì không có bảng thua.
  if (!win && !state.outcome?.win) {
    const kept = await offerContinue();
    if (kept === true) return;
    // Thiếu gem, đã chuyển tới Shop: treo ván ở màn continue; về Home thì màn continue hiện lại (resumeRun).
    if (kept === 'shop') { pending = 'continue'; return; }
  }
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
  // Nhiệm vụ: chơi xong 1 màn (thắng / thua), thắng không booster (chỉ tính khi đã mở booster).
  noteEvent('play');
  if (win && track && !track.boosters && boostersUnlocked(index)) noteEvent('cleanWin');
  let coinsEarned = 0;
  if (win) {
    const record = recordWin(loadProgress(), index, stars); // chỉ sao mới (vượt kỷ lục cũ) mới ra xu
    saveProgress(record.progress);
    coinsEarned = record.coins;
    if (coinsEarned) setDeco({ ...getDeco(), coins: getDeco().coins + coinsEarned });
  }
  // Gem thưởng lần thắng đầu: màn paywall (sau bài học continue) / màn boss.
  const level = LEVELS[index];
  const gems = coinsEarned ? grantGems(`level:${index}`, level.paywall ? GEM_REWARDS.paywall : level.tier === 'boss' ? GEM_REWARDS.boss : 0) : 0;
  // Ưu đãi: starter khi thắng lần đầu màn mốc; gói giải cứu khi thua cùng màn OFFERS.rescue.afterLosses lần liền.
  const offer = win ? (coinsEarned && index + 1 === OFFERS.starter.starterLevel && triggerOffer('starter') && 'starter')
    : (lossStreakHere(index) >= OFFERS.rescue.afterLosses && triggerOffer('rescue') && 'rescue');
  const unlock = win ? ob.unlockOnWin(index) : null; // onboarding: màn này vừa mở khoá thứ gì ('garden' | 'cats' | 'decor')
  if (coinsEarned || gift) setTimeout(() => playSound('reward'), 450);
  // Bảng kết quả (Figma): xu thưởng là dòng to có đồng xu; các ghi chú khác (mở khu, quà, mẹo, lý do thua) là dòng nhỏ.
  $('result-coins').innerHTML = `<i class="ico-coin"></i><b>+${coinsEarned}</b><small>coins</small>`;
  // ADS-SDK: chỗ đặt "bonusCoins" — xem ads nhận thêm xu (lần 1–2 trong ngày +50%, sau đó +20%; REWARDED_ADS.coinBonus), không giới hạn.
  // Nút ghi đúng số xu thêm (không ghi "x2" / "%"), tính theo số lần đã xem hôm nay.
  $('result-coins').parentElement.querySelector('.ad-double')?.remove();
  if (coinsEarned && adReady('bonusCoins')) {
    const bonus = bonusCoins(getWallet(), coinsEarned, Date.now());
    const button = document.createElement('button');
    button.className = 'ad-double';
    button.innerHTML = `▶ +${bonus.toLocaleString('en-US')}`;
    button.setAttribute('aria-label', `Watch an ad for ${bonus} more coins`);
    button.onclick = async () => {
      button.disabled = true;
      if (!(await showRewarded('bonusCoins'))) { button.disabled = false; return; }
      setDeco({ ...getDeco(), coins: getDeco().coins + bonus });
      refreshWallet();
      playSound('reward');
      $('result-coins').querySelector('b').textContent = `+${(coinsEarned + bonus).toLocaleString('en-US')}`;
      button.remove();
    };
    $('result-coins').after(button);
  }
  const notes = [gems && `+${gems} gems`, gift && `Gift: ${BOOSTER_NAMES.moves} booster`,
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
  // Ưu đãi vừa bật: popup đè lên bảng kết quả một lần (sau đó vẫn ở đầu Shop tới khi hết giờ).
  if (offer) setTimeout(() => showOffer(offer), 1600);
}

// Số lần thua liên tiếp ở màn này (lịch sử của độ khó thích ứng, gồm cả lần vừa thua).
function lossStreakHere(index) {
  let n = 0;
  for (let i = profile.attempts.length - 1; i >= 0 && profile.attempts[i].level === index && !profile.attempts[i].win; i--) n++;
  return n;
}

// Thứ được mở khoá ở các màn onboarding (onboarding.js), hiện dưới "Unlocked:" ở bảng kết quả.
// Mở khu / mở Deco dùng chung icon Deco của thanh tab.
const DECO_ICON = '<img src="./assets/img/nav/icon-deco-matte.png" alt="">';
const UNLOCK_ITEMS = {
  garden: [{ name: 'Garden', icon: DECO_ICON }],
  cats: [{ name: 'Orange cat', icon: catMarkup.orange }, { name: 'Gray cat', icon: catMarkup.gray }],
  decor: [{ name: 'Decoration', icon: DECO_ICON }],
};

$('result-continue').onclick = () => { leaveResult(); menus.runOnboarding(); };

$('result-next').onclick = () => { leaveResult(); startLevel(state.levelIndex + 1); };

$('result-retry').onclick = $('result-replay').onclick = () => { leaveResult(); startLevel(state.levelIndex); };

$('result-map').onclick = () => { leaveResult(); menus.showTab('home'); };

// Rời ván đang chơi dở (đã đặt ít nhất một thẻ): hỏi lại trước để không mất lượt vì bấm nhầm.
let quitAction = null;
$('quit-dialog').innerHTML = confirmationMarkup({
  title: 'Leave this level?', titleId: 'quit-title', bodyId: 'quit-description',
  body: '<p>Moves used and boosters spent won’t come back.</p>',
  choices: [
    { id: 'cancel', domId: 'quit-cancel', label: 'Keep playing', autofocus: true },
    { id: 'leave', domId: 'quit-ok', label: 'Leave', style: 'danger' },
  ],
});
$('quit-dialog').querySelector('[data-confirm-close]').onclick = () => $('quit-dialog').close();
$('quit-dialog').addEventListener('close', () => { quitAction = null; });

function confirmQuit(title, action, label) {
  if (state.animating) return;
  if (state.over || state.moves >= state.level.moves) return action();
  quitAction = action;
  $('quit-title').textContent = title;
  $('quit-ok').querySelector('.confirm-action-label').textContent = label;
  $('quit-dialog').showModal();
}

$('quit-cancel').onclick = () => $('quit-dialog').close();

$('quit-ok').onclick = () => { const action = quitAction; quitAction = null; $('quit-dialog').close(); recordQuit(); action?.(); };

$('restart').onclick = () => confirmQuit('Restart this level?', () => startLevel(state.levelIndex), 'Restart');

$('open-map').onclick = () => confirmQuit('Leave this level?', () => menus.showTab('home'), 'Leave');

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
