// Giao diện LiveOps dùng chung cho hai luồng (menu + màn chơi): pill gems / mạng ở hàng ví, bảng Daily (điểm danh 7 ngày + nhiệm vụ
// ngày + rương), hộp mạng, hộp continue sau khi thua, gói gems, quảng cáo có thưởng giả lập, event hằng tuần (nút Home, bảng event,
// tiến độ từ màn chơi, nhân đôi cá; luật ở gameplay/events.mjs, lịch ở gameplay/liveops-data.mjs).
// Luật nằm ở gameplay/liveops.mjs; state ở shared.js (getLiveOps / setLiveOps). Phase 1 chưa có SDK quảng cáo / thanh toán thật:
// playAd() và mua gems là giả lập, có ghi nhãn "test" trên giao diện.
import * as lo from '../gameplay/liveops.mjs';
import * as ev from '../gameplay/events.mjs';
import { EVENT_INFO } from '../gameplay/liveops-data.mjs';
import { LIVEOPS } from '../gameplay/tuning.mjs';
import { itemById, setDecoSale } from '../deco/deco-data.mjs';
import { loadProgress, levelsCleared } from '../gameplay/progression.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, getLiveOps, setLiveOps, onLiveOpsChange, grantReward, refreshWallet, BOOSTER_NAMES } from './shared.js';

const now = () => Date.now();
const cleared = () => levelsCleared(loadProgress());
export const dailyOn = () => lo.dailyUnlocked(cleared());

const pad = n => String(n).padStart(2, '0');
export function formatTime(ms) {
  const total = Math.ceil(ms / 1000), h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
const GEM = '<i class="ico-gem" aria-hidden="true"></i>';
const COIN = '<i class="ico-coin" aria-hidden="true"></i>';
const HEART = '<i class="ico-heart" aria-hidden="true"></i>';
// Đồ Deco độc quyền trong phần thưởng event: icon chữ (thumbnail 3D nằm ở luồng menu)
const DECO_ICON = { 'lantern-koi': '🎏' };
const BOOSTER_IMG = id => `<img class="ico-booster" src="./ui/play/img/booster-${id}.png" alt="">`;

// Phần thưởng thành chuỗi icon + số (ô điểm danh, rương) và thành chữ (toast).
function rewardMarkup(reward) {
  const parts = [];
  if (reward.coins) parts.push(`<span>${COIN}${reward.coins}</span>`);
  if (reward.gems) parts.push(`<span>${GEM}${reward.gems}</span>`);
  Object.entries(reward.boosters ?? {}).forEach(([id, n]) => parts.push(`<span>${BOOSTER_IMG(id)}×${n}</span>`));
  if (reward.unlimitedMin) parts.push(`<span>${HEART}∞ ${reward.unlimitedMin >= 60 ? `${reward.unlimitedMin / 60}h` : `${reward.unlimitedMin}m`}</span>`);
  if (reward.deco) parts.push(`<span class="lo-deco">${DECO_ICON[reward.deco] ?? '🎁'} ${itemById(reward.deco)?.name ?? ''}</span>`);
  return parts.join('');
}
export function rewardText(reward) {
  return [reward.coins && `${reward.coins} coins`, reward.gems && `${reward.gems} gems`,
    ...Object.entries(reward.boosters ?? {}).map(([id, n]) => `${n} ${BOOSTER_NAMES[id]}`),
    reward.unlimitedMin && `${reward.unlimitedMin} min unlimited lives`, reward.deco && itemById(reward.deco)?.name].filter(Boolean).join(' · ');
}

// ===== Hàng ví: gems + mạng (mọi .wallet-hud), chấm báo nút Daily. Đếm ngược hồi mạng mỗi giây. =====
function renderHud() {
  const s = getLiveOps(), info = lo.livesInfo(s, now());
  document.querySelectorAll('.gems-count').forEach(node => { node.textContent = s.gems.toLocaleString('en-US'); });
  document.querySelectorAll('.lives-count').forEach(node => { node.textContent = info.unlimitedMs ? '∞' : info.lives; });
  document.querySelectorAll('.lives-timer').forEach(node => {
    node.textContent = info.unlimitedMs ? formatTime(info.unlimitedMs) : info.nextMs ? formatTime(info.nextMs) : 'Full';
  });
  const status = lo.loginStatus(s, now());
  $('home-daily').classList.toggle('ready', dailyOn() && (status.canClaim || lo.chestReady(s)));
  $('home-daily').classList.toggle('locked', !dailyOn());
  if (!$('lives-dialog').hidden && $('lives-dialog').open) renderLives();
  if ($('daily-dialog').open) renderDailyTimers();
  settleEvents();
  renderEventButtons();
  if ($('event-dialog').open) renderEvent();
}
onLiveOpsChange(renderHud);
setInterval(renderHud, 1000);

document.addEventListener('click', event => {
  if (event.target.closest('[data-open="lives"]')) { playSound('pick'); openLives(); }
});

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

// ===== Gói gems (thanh toán giả lập) =====
export function renderGemPacks(container, onBought) {
  container.innerHTML = LIVEOPS.GEM_PACKS.map(pack => `<button class="gem-pack" data-pack="${pack.id}">
    ${pack.tag ? `<small class="gem-tag">${pack.tag}</small>` : ''}${GEM}<b>${pack.gems.toLocaleString('en-US')}</b><em>${pack.price}</em></button>`).join('');
  container.onclick = event => {
    const button = event.target.closest('[data-pack]');
    if (!button) return;
    const pack = LIVEOPS.GEM_PACKS.find(p => p.id === button.dataset.pack);
    setLiveOps(lo.buyGemPack(getLiveOps(), pack.id));
    playSound('reward');
    showToast(`Test purchase: +${pack.gems} gems`);
    onBought?.();
  };
}

// ===== Hộp mạng: số mạng, giờ hồi, xem quảng cáo +1, hồi đầy bằng gems; `onReady` = vào màn khi đã có mạng =====
let livesReady = null;
function renderLives() {
  const s = getLiveOps(), info = lo.livesInfo(s, now());
  $('lives-hearts').innerHTML = Array.from({ length: info.max }, (_, i) => `<i class="ico-heart${info.unlimitedMs || i < info.lives ? '' : ' empty'}"></i>`).join('');
  $('lives-status').textContent = info.unlimitedMs ? `Unlimited lives: ${formatTime(info.unlimitedMs)} left`
    : info.lives >= info.max ? 'Your lives are full!' : `Next life in ${formatTime(info.nextMs)}`;
  $('lives-title').textContent = info.canPlay ? 'Lives' : 'Out of lives';
  const adsLeft = lo.adLivesLeft(s, now()), full = info.unlimitedMs > 0 || info.lives >= info.max;
  $('lives-ad').hidden = full || adsLeft <= 0;
  $('lives-ad').innerHTML = `<span>Watch ad</span><b>+1 ${HEART}</b><small>${adsLeft} left today</small>`;
  $('lives-refill').hidden = full;
  $('lives-refill').innerHTML = `<span>Refill</span><b>${GEM}${LIVEOPS.REFILL_GEMS}</b>`;
  $('lives-refill').classList.toggle('poor', s.gems < LIVEOPS.REFILL_GEMS);
  $('lives-play').hidden = !livesReady || !info.canPlay;
  $('lives-packs').hidden = true;
}
export function openLives({ onReady = null } = {}) {
  livesReady = onReady;
  renderLives();
  $('lives-dialog').showModal();
}
$('lives-ad').onclick = async () => {
  if (!(await playAd('+1 life'))) return;
  const next = lo.adLife(getLiveOps(), now());
  if (next) { setLiveOps(next); playSound('reward'); }
  renderLives();
};
$('lives-refill').onclick = () => {
  const next = lo.refillLives(getLiveOps(), now());
  if (!next) {
    $('lives-packs').hidden = false;
    renderGemPacks($('lives-packs'), renderLives);
    return;
  }
  setLiveOps(next);
  playSound('reward');
  renderLives();
};
$('lives-play').onclick = () => { const go = livesReady; livesReady = null; $('lives-dialog').close(); go?.(); };
$('lives-close').onclick = () => { livesReady = null; $('lives-dialog').close(); };

// ===== Continue sau khi thua: gems (giá tăng dần trong lượt chơi) hoặc quảng cáo (1 lần / lượt chơi) =====
// opts: { price, adAvailable, stuck, losing: ['−1 life', 'Win streak ×5'], onGems(), onAd(), onGiveUp() }
let continueOpts = null;
function renderContinue() {
  const o = continueOpts, gems = getLiveOps().gems;
  const gain = o.stuck ? `+${LIVEOPS.CONTINUE_MOVES} moves & ${LIVEOPS.CONTINUE_CLEAR_CELLS} cells cleared` : `+${LIVEOPS.CONTINUE_MOVES} moves`;
  $('continue-title').textContent = o.stuck ? 'No room left!' : 'Out of moves!';
  $('continue-gain').textContent = gain;
  $('continue-losing').hidden = !o.losing.length;
  $('continue-losing').innerHTML = o.losing.length ? `If you give up you lose: <b>${o.losing.join(' · ')}</b>` : '';
  $('continue-gems').innerHTML = `<span>Continue</span><b>${GEM}${o.price}</b>`;
  $('continue-gems').classList.toggle('poor', gems < o.price);
  $('continue-ad').hidden = !o.adAvailable;
  $('continue-ad').innerHTML = `<span>Watch ad</span><b>+${LIVEOPS.CONTINUE_AD_MOVES} moves</b>`;
  $('continue-wallet').innerHTML = `You have ${GEM}${gems.toLocaleString('en-US')}`;
}
export function offerContinue(opts) {
  continueOpts = opts;
  $('continue-packs').hidden = true;
  renderContinue();
  $('continue-dialog').showModal();
}
const closeContinue = () => { const o = continueOpts; continueOpts = null; $('continue-dialog').close(); return o; };
$('continue-gems').onclick = () => {
  const o = continueOpts, paid = lo.spendGems(getLiveOps(), o.price);
  if (!paid) {
    $('continue-packs').hidden = false;
    renderGemPacks($('continue-packs'), renderContinue);
    return;
  }
  setLiveOps(paid);
  playSound('reward');
  closeContinue().onGems();
};
$('continue-ad').onclick = async () => {
  $('continue-dialog').close();
  const ok = await playAd(`+${LIVEOPS.CONTINUE_AD_MOVES} moves`);
  if (ok) return closeContinue().onAd();
  $('continue-dialog').showModal();
};
$('continue-giveup').onclick = () => closeContinue().onGiveUp();
$('continue-dialog').oncancel = event => event.preventDefault();

// ===== Bảng Daily: điểm danh 7 ngày + 3 nhiệm vụ ngày + rương =====
function renderDaily() {
  const s = getLiveOps(), status = lo.loginStatus(s, now());
  const done = status.claimedToday && status.step === 0 ? status.rewards.length : status.step;
  $('daily-login').innerHTML = status.rewards.map((reward, i) => {
    const cls = i < done ? 'claimed' : !status.claimedToday && i === status.step ? 'today' : '';
    return `<li class="${cls}${i === status.rewards.length - 1 ? ' big' : ''}"><span class="dl-day">Day ${i + 1}</span><span class="dl-reward">${rewardMarkup(reward)}</span></li>`;
  }).join('');
  $('daily-claim').disabled = !status.canClaim;
  $('daily-quests').innerHTML = (s.quests?.list ?? []).map(q => {
    const def = lo.questDef(q.id), finished = q.have >= q.need;
    return `<li class="${finished ? 'done' : ''}"><span class="dq-text">${def.text}</span><span class="dq-bar"><i style="width:${(q.have / q.need) * 100}%"></i></span>
      <span class="dq-count">${q.have}/${q.need}</span><span class="dq-points">${finished ? '✓' : `+${q.points}`}</span></li>`;
  }).join('');
  const points = lo.questPoints(s), goal = lo.questGoal(), ready = lo.chestReady(s), opened = !!s.quests?.chest;
  $('daily-chest-fill').style.width = `${Math.min(1, points / goal) * 100}%`;
  $('daily-chest-points').textContent = `${points}/${goal}`;
  $('daily-chest-reward').innerHTML = rewardMarkup({ coins: LIVEOPS.CHEST.coins }) + `<span>+ ${LIVEOPS.CHEST.randomBooster} random booster</span>`;
  $('daily-chest-open').hidden = !ready;
  $('daily-chest-ad').hidden = !ready;
  $('daily-chest').classList.toggle('opened', opened);
  renderDailyTimers();
}
function renderDailyTimers() {
  const s = getLiveOps(), status = lo.loginStatus(s, now()), left = formatTime(lo.msToNextDay(now()));
  $('daily-claim').textContent = status.canClaim ? 'Claim' : status.claimedToday ? `Next reward in ${left}` : 'Check your device clock';
  $('daily-reset').textContent = `New quests in ${left}`;
}
export function openDaily() {
  if (!dailyOn()) return showToast(`Daily rewards unlock after level ${LIVEOPS.DAILY_FROM_CLEARED}`);
  setLiveOps(lo.ensureQuests(getLiveOps(), now(), cleared()));
  renderDaily();
  $('daily-dialog').showModal();
}
// Lần mở Home đầu tiên trong ngày: tự bật bảng Daily nếu có quà điểm danh (không chen vào màn chơi / hộp khác đang mở).
export function maybeAutoDaily() {
  if (!dailyOn() || !lo.loginStatus(getLiveOps(), now()).canClaim || document.querySelector('dialog[open]')) return;
  openDaily();
}
function collect(reward, source) {
  playSound('reward');
  showToast(`${source}: ${rewardText(reward)}`);
  refreshWallet();
}
$('daily-claim').onclick = () => {
  const result = lo.claimLogin(getLiveOps(), now());
  if (!result) return;
  setLiveOps(result.state);
  // gems + mạng vô hạn đã vào state ở claimLogin; còn xu + booster
  grantReward({ coins: result.reward.coins, boosters: result.reward.boosters });
  collect(result.reward, `Day ${result.step + 1}`);
  renderDaily();
};
async function openChest(double) {
  if (double) {
    $('daily-dialog').close();
    const ok = await playAd('Double chest');
    $('daily-dialog').showModal();
    if (!ok) return;
  }
  const result = lo.claimChest(getLiveOps(), now(), { double });
  if (!result) return;
  setLiveOps(result.state);
  grantReward(result.reward);
  collect(result.reward, double ? 'Chest ×2' : 'Chest');
  renderDaily();
}
$('daily-chest-open').onclick = () => openChest(false);
$('daily-chest-ad').onclick = () => openChest(true);
$('daily-close').onclick = () => $('daily-dialog').close();

// ===== Nhiệm vụ: hai luồng báo sự kiện qua đây (thắng màn, gom mèo, dùng booster, vuốt mèo...) =====
export function questEvent(event, amount = 1) {
  if (!dailyOn() || amount <= 0) return;
  const { state, completed } = lo.trackQuest(lo.ensureQuests(getLiveOps(), now(), cleared()), now(), event, amount);
  setLiveOps(state);
  completed.forEach(q => showToast(`Quest done: ${lo.questDef(q.id).text}!`));
}

// ===== Event hằng tuần: nút ở cột trái Home (1 event chính + tối đa 1 event phụ), bảng event, tiến độ từ màn chơi =====
const EV = LIVEOPS.EVENTS;
const EVENT_ICON = { yarn: '🧶', fish: '🐟', race: '🏁' };
const formatLeft = ms => (ms >= 86400000 ? `${Math.floor(ms / 86400000)}d ${Math.floor(ms / 3600000) % 24}h` : formatTime(ms));
// Thưởng event: gems đã vào state LiveOps ở events.mjs (gọi setLiveOps trước); xu, booster, đồ Deco cộng ở đây. Gộp một toast.
function payEventRewards(rewards) {
  if (!rewards.length) return;
  rewards.forEach(({ reward }) => grantReward({ coins: reward.coins, boosters: reward.boosters, deco: reward.deco }));
  playSound(rewards.some(r => r.big) ? 'complete' : 'reward');
  showToast(rewards.map(r => `${r.label}: ${rewardText(r.reward)}`).join(' | '));
}
// Cuộc đua hết giờ: chốt hạng + trả thưởng (chạy mỗi giây cùng hàng ví).
function settleEvents() {
  const { state, rewards } = ev.syncEvents(getLiveOps(), now());
  if (!rewards.length) return;
  setLiveOps(state);
  payEventRewards(rewards);
}
function renderEventButtons() {
  const t = now(), s = getLiveOps(), list = ev.homeEvents(s, t, cleared());
  ['main', 'side'].forEach(kind => {
    const button = $(`home-event-${kind}`), item = list.find(e => e.kind === kind);
    button.hidden = !item;
    if (!item) return;
    const race = item.id === 'race' && ev.raceStatus(s, t, cleared());
    const html = `<span class="fe-icon" aria-hidden="true">${EVENT_ICON[item.id]}</span><span class="fe-name">${EVENT_INFO[item.id].short}</span>`
      + `<small class="fe-time">${race?.over ? 'Done!' : race?.joinable ? 'Join' : formatLeft(item.end - t)}</small>${race?.over ? '<i class="fh-alert">!</i>' : ''}`;
    button.dataset.event = item.id;
    button.setAttribute('aria-label', EVENT_INFO[item.id].name);
    if (button.innerHTML !== html) button.innerHTML = html;
  });
  // Deco Sale: giá đồ Deco (deco-data costOf) + nhãn giảm giá trên tab Deco / Shop
  const off = ev.decoSaleOff(t);
  setDecoSale(off);
  document.querySelectorAll('#tabbar [data-tab="deco"], #tabbar [data-tab="shop"]').forEach(tab => {
    if (off) tab.dataset.sale = `−${Math.round(off * 100)}%`; else delete tab.dataset.sale;
  });
}
['main', 'side'].forEach(kind => { $(`home-event-${kind}`).onclick = event => { playSound('pick'); openEvent(event.currentTarget.dataset.event); }; });

let shownEvent = null;
export function openEvent(id) {
  shownEvent = id;
  renderEvent();
  $('event-dialog').showModal();
}
function renderEvent() {
  const id = shownEvent, t = now(), s = getLiveOps(), c = cleared();
  $('event-title').textContent = `${EVENT_ICON[id]} ${EVENT_INFO[id].name}`;
  $('event-rule').textContent = EVENT_INFO[id].rule.replace('{goal}', EV.race.goal);
  let body = '<p class="lo-status">This event has ended. See you next time!</p>', timer = '';
  if (id === 'yarn') {
    const y = ev.yarnStatus(s, t, c);
    if (y) {
      timer = `Ends in ${formatLeft(y.event.end - t)}`;
      const rows = [];
      for (let step = y.steps; step >= 0; step--) {
        const reward = step === y.steps ? (y.tops ? EV.yarn.repeatTop : EV.yarn.top) : EV.yarn.stepRewards[step];
        const cls = [step === y.step && 'here', step < y.step && 'passed', step === y.steps && 'top', y.paid.includes(step) && 'paid'].filter(Boolean).join(' ');
        rows.push(`<li class="${cls}"><span class="ey-step">${step || 'Start'}</span><span class="ey-reward">${reward ? rewardMarkup(reward) : ''}</span>`
          + `${step === y.step ? '<span class="ey-cat" aria-label="You">🐱</span>' : ''}</li>`);
      }
      body = `<ol class="ev-yarn">${rows.join('')}</ol><p class="lo-status">Step ${y.step}/${y.steps}${y.tops ? ` · Top reached ×${y.tops}` : ''}</p>`;
    }
  } else if (id === 'fish') {
    const f = ev.fishStatus(s, t, c);
    if (f) {
      timer = `Ends in ${formatLeft(f.event.end - t)}`;
      const next = f.milestones[f.reached], prev = f.reached ? f.milestones[f.reached - 1].fish : 0;
      const fill = next ? Math.min(1, (f.fish - prev) / (next.fish - prev)) : 1;
      body = `<div class="ef-count">🐟 <b>${f.fish.toLocaleString('en-US')}</b>${next ? `<small>next reward at ${next.fish}</small>` : '<small>all rewards collected!</small>'}</div>`
        + `<span class="dq-bar ef-bar"><i style="width:${fill * 100}%"></i></span>`
        + `<ol class="ef-miles">${f.milestones.map((m, i) => `<li class="${i < f.reached ? 'done' : ''}${i === f.milestones.length - 1 ? ' big' : ''}">`
          + `<span class="ef-need">🐟 ${m.fish}</span><span class="ef-reward">${rewardMarkup(m.reward)}</span></li>`).join('')}</ol>`;
    }
  } else if (id === 'race') {
    const r = ev.raceStatus(s, t, c), goal = EV.race.goal;
    const prizes = `<ol class="er-prizes">${EV.race.rewards.map((reward, i) => `<li><b>#${i + 1}</b>${rewardMarkup(reward)}</li>`).join('')}</ol>`;
    if (r?.joinable) {
      timer = `Join today · ${formatLeft(r.end - t)} left`;
      body = `<p class="lo-status">Play a level to join! You'll have ${EV.race.hours} hours.</p>${prizes}`;
    } else if (r) {
      const you = r.standings.findIndex(e => e.you) + 1;
      timer = r.over ? `Race over · You finished #${r.race.rank ?? you}` : `Ends in ${formatLeft(r.end - t)}`;
      body = `<ol class="er-list">${r.standings.map((e, i) => `<li class="${e.you ? 'you' : ''}${e.finished ? ' finished' : ''}"><span class="er-rank">${i + 1}</span>`
        + `<span class="er-name">${e.you ? 'You' : `${e.name} <small>AI</small>`}</span><span class="dq-bar"><i style="width:${(e.wins / goal) * 100}%"></i></span>`
        + `<span class="er-wins">${e.finished ? '🏆' : `${e.wins}/${goal}`}</span></li>`).join('')}</ol>${prizes}<p class="er-note">Rivals are computer-controlled cats.</p>`;
    }
  }
  $('event-timer').textContent = timer;
  $('event-timer').hidden = !timer;
  if ($('event-body').innerHTML !== body) $('event-body').innerHTML = body;
}
function closeEvent() {
  // Đã xem kết quả cuộc đua đã xong: thôi hiện nút đua tới ngày đua sau
  if (shownEvent === 'race' && ev.raceStatus(getLiveOps(), now(), cleared())?.over) setLiveOps(ev.markRaceSeen(getLiveOps()));
  $('event-dialog').close();
}
$('event-close').onclick = closeEvent;
$('event-dialog').oncancel = event => { event.preventDefault(); closeEvent(); };

// ----- Nối với màn chơi (play-controller.js) -----
// Vào màn: ngày đua thì tự vào cuộc đua (mỗi ngày đua một lượt).
export function eventLevelStart(levelIndex) {
  const r = ev.joinRace(getLiveOps(), now(), cleared(), levelIndex);
  if (r.joined || r.rewards.length) setLiveOps(r.state);
  payEventRewards(r.rewards);
  if (r.joined) showToast(`Cat Race started! Win ${EV.race.goal} levels first`);
}
// Gom mèo: cá cho Fish Festival (cá = số mèo). Trả về số cá vừa nhận (0 = không có event / màn không tính).
export function eventMatch(levelIndex, cats) {
  const r = ev.addFish(getLiveOps(), now(), cleared(), levelIndex, cats);
  if (!r.added) return 0;
  setLiveOps(r.state);
  payEventRewards(r.rewards);
  return r.added;
}
// Hết màn (thắng / thua / bỏ ngang): thang len, cuộc đua. Trả về ghi chú cho bảng kết quả.
export function eventLevelEnd(levelIndex, win, fish = 0) {
  const t = now(), c = cleared(), before = getLiveOps();
  const r = ev.eventLevelEnd(before, t, c, levelIndex, win);
  setLiveOps(r.state);
  payEventRewards(r.rewards);
  const notes = [], y0 = ev.yarnStatus(before, t, c), y1 = ev.yarnStatus(r.state, t, c);
  if (y1 && (y1.step !== y0.step || y1.tops !== y0.tops)) notes.push(`Yarn Climb ${y1.step}/${y1.steps}`);
  // cuộc đua: chỉ ghi khi màn này còn tính (chưa về đích / chưa chốt hạng trước màn này)
  const race = ev.raceStatus(r.state, t, c), raced = ev.raceStatus(before, t, c)?.race;
  if (win && race?.race && raced && !raced.paid && ev.eventCounts('race', levelIndex)) notes.push(`Cat Race ${Math.min(EV.race.goal, race.race.wins.length)}/${EV.race.goal}`);
  if (fish) notes.push(`+${fish} fish`);
  return notes;
}
// Bảng kết quả thắng: mời xem quảng cáo nhân đôi cá của màn (tối đa adDoublePerDay lần / ngày). fish = 0 thì ẩn nút.
export function offerFishDouble(levelIndex, fish) {
  const button = $('result-fish'), left = ev.fishAdsLeft(getLiveOps(), now());
  button.hidden = !(fish > 0 && left > 0 && ev.fishStatus(getLiveOps(), now(), cleared()));
  if (button.hidden) return;
  button.innerHTML = `<span>Watch ad: ×2 fish (+${fish})</span><small>${left} left today</small>`;
  button.onclick = async () => {
    button.hidden = true;
    if (!(await playAd(`+${fish} fish`))) { button.hidden = false; return; }
    const r = ev.doubleFish(getLiveOps(), now(), cleared(), levelIndex, fish);
    if (!r) return;
    setLiveOps(r.state);
    if (r.rewards.length) payEventRewards(r.rewards);
    else { playSound('reward'); showToast(`+${fish} fish!`); }
  };
}

renderHud();
