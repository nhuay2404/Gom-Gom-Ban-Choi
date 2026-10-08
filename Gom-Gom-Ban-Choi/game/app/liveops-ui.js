// Giao diện LiveOps dùng chung cho hai luồng (menu + màn chơi): pill gems / mạng ở hàng ví, bảng Daily (điểm danh 7 ngày + nhiệm vụ
// ngày + rương), hộp mạng, hộp continue sau khi thua, gói gems, quảng cáo có thưởng giả lập.
// Luật nằm ở gameplay/liveops.mjs; state ở shared.js (getLiveOps / setLiveOps). Phase 1 chưa có SDK quảng cáo / thanh toán thật:
// playAd() và mua gems là giả lập, có ghi nhãn "test" trên giao diện.
import * as lo from '../gameplay/liveops.mjs';
import { LIVEOPS } from '../gameplay/tuning.mjs';
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
const BOOSTER_IMG = id => `<img class="ico-booster" src="./ui/play/img/booster-${id}.png" alt="">`;

// Phần thưởng thành chuỗi icon + số (ô điểm danh, rương) và thành chữ (toast).
function rewardMarkup(reward) {
  const parts = [];
  if (reward.coins) parts.push(`<span>${COIN}${reward.coins}</span>`);
  if (reward.gems) parts.push(`<span>${GEM}${reward.gems}</span>`);
  Object.entries(reward.boosters ?? {}).forEach(([id, n]) => parts.push(`<span>${BOOSTER_IMG(id)}×${n}</span>`));
  if (reward.unlimitedMin) parts.push(`<span>${HEART}∞ ${reward.unlimitedMin >= 60 ? `${reward.unlimitedMin / 60}h` : `${reward.unlimitedMin}m`}</span>`);
  return parts.join('');
}
export function rewardText(reward) {
  return [reward.coins && `${reward.coins} coins`, reward.gems && `${reward.gems} gems`,
    ...Object.entries(reward.boosters ?? {}).map(([id, n]) => `${n} ${BOOSTER_NAMES[id]}`),
    reward.unlimitedMin && `${reward.unlimitedMin} min unlimited lives`].filter(Boolean).join(' · ');
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

renderHud();
