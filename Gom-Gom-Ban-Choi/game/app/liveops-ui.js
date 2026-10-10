// Giao diện LiveOps dùng chung cho hai luồng (menu + màn chơi): pill gems / mạng ở hàng ví, bảng Daily (điểm danh 7 ngày + nhiệm vụ
// ngày + rương), hộp mạng, hộp continue sau khi thua, gói gems, event hằng tuần (nút Home, bảng event, nhân đôi cá ở bảng kết quả).
// Luật + state: hc-kit qua instance `liveops` (app/liveops.js); số liệu: liveops/config.mjs. File này chỉ vẽ và chuyển thao tác.
// Màn chơi / menu gọi các hàm ở cuối file (levelStart, matched, boosterUsed, petted, levelEnd, offerContinue, atStake):
// mỗi hàm tự bỏ qua khi LiveOps tắt, nên chỗ gọi trong file chung chỉ là một dòng.
// Quảng cáo / thanh toán còn giả lập (port trong app/liveops.js), giao diện ghi nhãn "test".
import { core } from '../hc-kit/index.mjs';
import { LIVEOPS_CONFIG as C, EVENT_INFO, CONTINUE_CLEAR_CELLS } from '../liveops/config.mjs';
import { liveops, kitLevel } from './liveops.js';
import { itemById, setDecoSale } from '../deco/deco-data.mjs';
import { loadProgress, levelsCleared } from '../gameplay/progression.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, showToast, refreshWallet, BOOSTER_NAMES } from './shared.js';

const now = () => Date.now();
const cleared = () => levelsCleared(loadProgress());
export const dailyOn = () => !!liveops && core.dailyOn(C, cleared());

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
// Đường dẫn viết đủ (không ghép chuỗi) để build:html nhúng được ảnh vào bản 1 file.
const BOOSTER_SRC = { hammer: './ui/play/img/booster-hammer.png', swap: './ui/play/img/booster-swap.png', moves: './ui/play/img/booster-moves.png' };
const BOOSTER_IMG = id => `<img class="ico-booster" src="${BOOSTER_SRC[id]}" alt="">`;
const isBooster = id => id in BOOSTER_NAMES;
const items = reward => Object.entries(reward.items ?? {});
const unlimitedMin = reward => reward.timers?.unlimitedLives ?? 0;

// Phần thưởng (định dạng kit: { coins, gems, items, timers }) thành chuỗi icon + số (ô điểm danh, rương) và thành chữ (toast).
function rewardMarkup(reward) {
  const parts = [];
  if (reward.coins) parts.push(`<span>${COIN}${reward.coins}</span>`);
  if (reward.gems) parts.push(`<span>${GEM}${reward.gems}</span>`);
  items(reward).filter(([id]) => isBooster(id)).forEach(([id, n]) => parts.push(`<span>${BOOSTER_IMG(id)}×${n}</span>`));
  const min = unlimitedMin(reward);
  if (min) parts.push(`<span>${HEART}∞ ${min >= 60 ? `${min / 60}h` : `${min}m`}</span>`);
  items(reward).filter(([id]) => !isBooster(id)).forEach(([id]) => parts.push(`<span class="lo-deco">${DECO_ICON[id] ?? '🎁'} ${itemById(id)?.name ?? ''}</span>`));
  return parts.join('');
}
export function rewardText(reward) {
  return [reward.coins && `${reward.coins} coins`, reward.gems && `${reward.gems} gems`,
    ...items(reward).map(([id, n]) => (isBooster(id) ? `${n} ${BOOSTER_NAMES[id]}` : itemById(id)?.name)),
    unlimitedMin(reward) && `${unlimitedMin(reward)} min unlimited lives`].filter(Boolean).join(' · ');
}
// Thưởng đã được kit chia (gems / mạng vô hạn kit giữ, xu / booster / đồ Deco qua adapter): chỉ còn báo cho người chơi. Gộp một toast.
function announce(rewards) {
  const got = (rewards ?? []).filter(r => r.reward);
  if (!got.length) return;
  refreshWallet();
  playSound(got.some(r => r.big) ? 'complete' : 'reward');
  showToast(got.map(r => `${r.label}: ${rewardText(r.reward)}`).join(' | '));
}
const questText = id => core.questDef(C, id)?.text ?? id;

// ===== Hàng ví: gems + mạng (mọi .wallet-hud), chấm báo nút Daily, nút event. Chỉ ĐỌC state: kit gọi lại hàm này sau mỗi thay đổi. =====
function renderHud() {
  const s = liveops.state, info = liveops.livesInfo();
  document.querySelectorAll('.gems-count').forEach(node => { node.textContent = liveops.wallet('gems').toLocaleString('en-US'); });
  document.querySelectorAll('.lives-count').forEach(node => { node.textContent = info.unlimitedMs ? '∞' : info.lives; });
  document.querySelectorAll('.lives-timer').forEach(node => {
    node.textContent = info.unlimitedMs ? formatTime(info.unlimitedMs) : info.nextMs ? formatTime(info.nextMs) : 'Full';
  });
  const status = core.loginStatus(s, C, now());
  $('home-daily').classList.toggle('ready', dailyOn() && (status.canClaim || core.chestReady(s, C)));
  $('home-daily').classList.toggle('locked', !dailyOn());
  if (!$('lives-dialog').hidden && $('lives-dialog').open) renderLives();
  if ($('daily-dialog').open) renderDailyTimers();
  renderEventButtons();
  if ($('event-dialog').open) renderEvent();
}

// ===== Gói gems (thanh toán giả lập) =====
export function renderGemPacks(container, onBought) {
  if (!liveops) return;
  container.innerHTML = C.shop.packs.map(pack => `<button class="gem-pack" data-pack="${pack.id}">
    ${pack.tag ? `<small class="gem-tag">${pack.tag}</small>` : ''}${GEM}<b>${pack.reward.gems.toLocaleString('en-US')}</b><em>${pack.price}</em></button>`).join('');
  container.onclick = async event => {
    const button = event.target.closest('[data-pack]');
    if (!button) return;
    const reward = await liveops.buyPack(button.dataset.pack);
    if (!reward) return;
    playSound('reward');
    showToast(`Test purchase: +${reward.gems} gems`);
    onBought?.();
  };
}

// ===== Hộp mạng: số mạng, giờ hồi, xem quảng cáo +1, hồi đầy bằng gems; `onReady` = vào màn khi đã có mạng =====
let livesReady = null;
function renderLives() {
  const info = liveops.livesInfo(), refill = info.refill.gems;
  $('lives-hearts').innerHTML = Array.from({ length: info.max }, (_, i) => `<i class="ico-heart${info.unlimitedMs || i < info.lives ? '' : ' empty'}"></i>`).join('');
  $('lives-status').textContent = info.unlimitedMs ? `Unlimited lives: ${formatTime(info.unlimitedMs)} left`
    : info.lives >= info.max ? 'Your lives are full!' : `Next life in ${formatTime(info.nextMs)}`;
  $('lives-title').textContent = info.canPlay ? 'Lives' : 'Out of lives';
  const full = info.unlimitedMs > 0 || info.lives >= info.max;
  $('lives-ad').hidden = full || info.adsLeft <= 0;
  $('lives-ad').innerHTML = `<span>Watch ad</span><b>+1 ${HEART}</b><small>${info.adsLeft} left today</small>`;
  $('lives-refill').hidden = full;
  $('lives-refill').innerHTML = `<span>Refill</span><b>${GEM}${refill}</b>`;
  $('lives-refill').classList.toggle('poor', liveops.wallet('gems') < refill);
  $('lives-play').hidden = !livesReady || !info.canPlay;
  $('lives-packs').hidden = true;
}
export function openLives({ onReady = null } = {}) {
  if (!liveops) return;
  livesReady = onReady;
  renderLives();
  $('lives-dialog').showModal();
}

// ===== Continue sau khi thua: gems (giá tăng dần trong lượt chơi) hoặc quảng cáo (1 lần / lượt chơi) =====
let shownContinue = null;
const continueOpen = () => shownContinue && liveops.continueOffer(shownContinue.level);
function renderContinue() {
  const o = continueOpen(), stuck = shownContinue.stuck, gems = liveops.wallet('gems');
  $('continue-title').textContent = stuck ? 'No room left!' : 'Out of moves!';
  $('continue-gain').textContent = `+${o.value} moves${stuck ? ` & ${CONTINUE_CLEAR_CELLS} cells cleared` : ''}`;
  const losing = o.losing.map(l => (l.id === 'life' ? '1 life' : `Win streak ×${l.n}`));
  $('continue-losing').hidden = !losing.length;
  $('continue-losing').innerHTML = losing.length ? `If you give up you lose: <b>${losing.join(' · ')}</b>` : '';
  $('continue-gems').innerHTML = `<span>Continue</span><b>${GEM}${o.price.gems}</b>`;
  $('continue-gems').classList.toggle('poor', !o.affordable);
  $('continue-ad').hidden = !o.ad;
  $('continue-ad').innerHTML = o.ad ? `<span>Watch ad</span><b>+${o.ad.value} moves</b>` : '';
  $('continue-wallet').innerHTML = `You have ${GEM}${gems.toLocaleString('en-US')}`;
}
const closeContinue = () => { const o = shownContinue; shownContinue = null; $('continue-dialog').close(); return o; };

// ===== Bảng Daily: điểm danh 7 ngày + 3 nhiệm vụ ngày + rương =====
function renderDaily() {
  const view = liveops.dailyView(), status = view.login;
  const done = status.claimedToday && status.step === 0 ? status.rewards.length : status.step;
  $('daily-login').innerHTML = status.rewards.map((reward, i) => {
    const cls = i < done ? 'claimed' : !status.claimedToday && i === status.step ? 'today' : '';
    return `<li class="${cls}${i === status.rewards.length - 1 ? ' big' : ''}"><span class="dl-day">Day ${i + 1}</span><span class="dl-reward">${rewardMarkup(reward)}</span></li>`;
  }).join('');
  $('daily-claim').disabled = !status.canClaim;
  $('daily-quests').innerHTML = view.quests.map(q => `<li class="${q.done ? 'done' : ''}"><span class="dq-text">${q.text}</span><span class="dq-bar"><i style="width:${(q.have / q.need) * 100}%"></i></span>
      <span class="dq-count">${q.have}/${q.need}</span><span class="dq-points">${q.done ? '✓' : `+${q.points}`}</span></li>`).join('');
  $('daily-chest-fill').style.width = `${Math.min(1, view.points / view.goal) * 100}%`;
  $('daily-chest-points').textContent = `${view.points}/${view.goal}`;
  $('daily-chest-reward').innerHTML = rewardMarkup({ coins: view.chest.coins }) + `<span>+ ${view.chest.random?.n ?? 0} random booster</span>`;
  $('daily-chest-open').hidden = !view.chestReady;
  $('daily-chest-ad').hidden = !view.chestReady;
  $('daily-chest').classList.toggle('opened', view.chestOpened);
  renderDailyTimers();
}
function renderDailyTimers() {
  const status = core.loginStatus(liveops.state, C, now()), left = formatTime(core.msToNextDay(now()));
  $('daily-claim').textContent = status.canClaim ? 'Claim' : status.claimedToday ? `Next reward in ${left}` : 'Check your device clock';
  $('daily-reset').textContent = `New quests in ${left}`;
}
export function openDaily() {
  if (!dailyOn()) return showToast(`Daily rewards unlock after level ${C.daily.fromCleared}`);
  renderDaily();
  $('daily-dialog').showModal();
}
// Lần mở Home đầu tiên trong ngày: tự bật bảng Daily nếu có quà điểm danh (không chen vào màn chơi / hộp khác đang mở).
export function maybeAutoDaily() {
  if (!dailyOn() || !core.loginStatus(liveops.state, C, now()).canClaim || document.querySelector('dialog[open]')) return;
  openDaily();
}
function collect(reward, source) {
  playSound('reward');
  showToast(`${source}: ${rewardText(reward)}`);
  refreshWallet();
}
async function openChest(ad) {
  // Quảng cáo là hộp modal riêng: đóng bảng Daily trong lúc xem, xem xong mở lại
  if (ad) $('daily-dialog').close();
  const result = await liveops.claimChest({ ad });
  if (ad) $('daily-dialog').showModal();
  if (!result) return;
  collect(result.reward, ad ? 'Chest ×2' : 'Chest');
  renderDaily();
}

// ===== Event hằng tuần: nút ở cột trái Home (1 event chính + tối đa 1 event phụ), bảng event =====
const EV = C.events.defs;
const formatLeft = ms => (ms >= 86400000 ? `${Math.floor(ms / 86400000)}d ${Math.floor(ms / 3600000) % 24}h` : formatTime(ms));
function renderEventButtons() {
  const t = now(), list = liveops.homeEvents();
  ['main', 'side'].forEach(slot => {
    const button = $(`home-event-${slot}`), item = list.find(e => e.slot === slot);
    button.hidden = !item;
    if (!item) return;
    const race = EV[item.id].type === 'race' && liveops.eventView(item.id), info = EVENT_INFO[item.id];
    const html = `<span class="fe-icon" aria-hidden="true">${info.icon}</span><span class="fe-name">${info.short}</span>`
      + `<small class="fe-time">${race?.over ? 'Done!' : race?.joinable ? 'Join' : formatLeft(item.end - t)}</small>${race?.over ? '<i class="fh-alert">!</i>' : ''}`;
    button.dataset.event = item.id;
    button.setAttribute('aria-label', info.name);
    if (button.innerHTML !== html) button.innerHTML = html;
  });
  // Deco Sale: giá đồ Deco (deco-data costOf) + nhãn giảm giá trên tab Deco / Shop
  const off = liveops.saleOff('decoSale');
  setDecoSale(off);
  document.querySelectorAll('#tabbar [data-tab="deco"], #tabbar [data-tab="shop"]').forEach(tab => {
    if (off) tab.dataset.sale = `−${Math.round(off * 100)}%`; else delete tab.dataset.sale;
  });
}

let shownEvent = null;
export function openEvent(id) {
  shownEvent = id;
  renderEvent();
  $('event-dialog').showModal();
}
function renderEvent() {
  const id = shownEvent, t = now(), def = EV[id], info = EVENT_INFO[id], view = liveops.eventView(id);
  $('event-title').textContent = `${info.icon} ${info.name}`;
  $('event-rule').textContent = info.rule.replace('{goal}', def.goal);
  let body = '<p class="lo-status">This event has ended. See you next time!</p>', timer = '';
  if (def.type === 'ladder' && view) {
    timer = `Ends in ${formatLeft(view.run.end - t)}`;
    const rows = [];
    for (let step = def.steps; step >= 0; step--) {
      const reward = step === def.steps ? (view.tops && def.repeatTop ? def.repeatTop : def.top) : def.stepRewards?.[step];
      const cls = [step === view.step && 'here', step < view.step && 'passed', step === def.steps && 'top', view.paid.includes(step) && 'paid'].filter(Boolean).join(' ');
      rows.push(`<li class="${cls}"><span class="ey-step">${step || 'Start'}</span><span class="ey-reward">${reward ? rewardMarkup(reward) : ''}</span>`
        + `${step === view.step ? '<span class="ey-cat" aria-label="You">🐱</span>' : ''}</li>`);
    }
    body = `<ol class="ev-yarn">${rows.join('')}</ol><p class="lo-status">Step ${view.step}/${def.steps}${view.tops ? ` · Top reached ×${view.tops}` : ''}</p>`;
  } else if (def.type === 'collect' && view) {
    timer = `Ends in ${formatLeft(view.run.end - t)}`;
    const miles = def.milestones, next = miles[view.reached], prev = view.reached ? miles[view.reached - 1].at : 0;
    const fill = next ? Math.min(1, (view.tokens - prev) / (next.at - prev)) : 1;
    body = `<div class="ef-count">🐟 <b>${view.tokens.toLocaleString('en-US')}</b>${next ? `<small>next reward at ${next.at}</small>` : '<small>all rewards collected!</small>'}</div>`
      + `<span class="dq-bar ef-bar"><i style="width:${fill * 100}%"></i></span>`
      + `<ol class="ef-miles">${miles.map((m, i) => `<li class="${i < view.reached ? 'done' : ''}${i === miles.length - 1 ? ' big' : ''}">`
        + `<span class="ef-need">🐟 ${m.at}</span><span class="ef-reward">${rewardMarkup(m.reward)}</span></li>`).join('')}</ol>`;
  } else if (def.type === 'race') {
    const goal = def.goal;
    const prizes = `<ol class="er-prizes">${def.rewards.map((reward, i) => `<li><b>#${i + 1}</b>${rewardMarkup(reward)}</li>`).join('')}</ol>`;
    if (view?.joinable) {
      timer = `Join today · ${formatLeft(view.end - t)} left`;
      body = `<p class="lo-status">Play a level to join! You'll have ${def.hours} hours.</p>${prizes}`;
    } else if (view) {
      const you = view.standings.findIndex(e => e.you) + 1;
      timer = view.over ? `Race over · You finished #${view.race.rank ?? you}` : `Ends in ${formatLeft(view.end - t)}`;
      body = `<ol class="er-list">${view.standings.map((e, i) => `<li class="${e.you ? 'you' : ''}${e.finished ? ' finished' : ''}"><span class="er-rank">${i + 1}</span>`
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
  if (EV[shownEvent]?.type === 'race' && liveops.eventView(shownEvent)?.over) liveops.markRaceSeen(shownEvent);
  $('event-dialog').close();
}

// ===== Nối với màn chơi (play-controller.js) và menu (menu-controller.js). LiveOps tắt: mọi hàm bỏ qua. =====
// Vào màn: hết mạng thì mở hộp mạng (`retry` khi có lại mạng) và trả false. Lần đầu tới màn có mạng: tặng mạng vô hạn.
// Ngày đua: vào màn = vào cuộc đua. Buff chuỗi thắng tới màn chơi qua adapter.applyBuff (app/liveops.js connectPlay).
export function levelStart(levelIndex, retry) {
  if (!liveops) return true;
  const r = liveops.requestStart(kitLevel(levelIndex));
  if (r.introMinutes) showToast(`Lives unlocked! ${r.introMinutes} min of unlimited lives`);
  if (!r.ok) { openLives({ onReady: retry }); return false; }
  announce(r.rewards);
  if (r.joinedRaces.length) showToast(`${EVENT_INFO.race.name} started! Win ${EV.race.goal} levels first`);
  return true;
}
// Một lượt gom: mỗi cụm một tín hiệu (amount = số mèo, nhiệm vụ "cụm ≥ 4" đếm theo tín hiệu), thùng vỡ một tín hiệu.
// Màn tutorial vẫn tính nhiệm vụ nhưng không tính event (level 0 = dưới mọi mốc fromLevel). Trả về số cá vừa nhận.
export function matched(levelIndex, sizes, crates, tutorial) {
  if (!liveops) return 0;
  const level = tutorial ? 0 : kitLevel(levelIndex);
  let fish = 0;
  for (const amount of sizes) fish += signal('collect', { kind: 'cat', amount, level }).added.fish ?? 0;
  if (crates) signal('collect', { kind: 'crate', amount: crates, level });
  return fish;
}
export const boosterUsed = () => liveops && signal('action', { id: 'booster' });
export const petted = () => liveops && signal('action', { id: 'pet' });
function signal(name, payload) {
  const out = liveops.signal(name, payload);
  out.completed.forEach(q => showToast(`Quest done: ${questText(q.id)}!`));
  announce(out.rewards);
  return out;
}
// Thứ sẽ mất nếu bỏ cuộc / bỏ ngang màn này (hộp continue, hộp rời màn): ['1 life', 'win streak ×5'].
export function atStake(levelIndex) {
  if (!liveops) return [];
  const level = kitLevel(levelIndex), s = liveops.state;
  return [core.livesOn(C, level) && !core.hasUnlimited(s, now()) && '1 life', core.streakOn(C, level) && s.streak > 0 && `win streak ×${s.streak}`].filter(Boolean);
}
// Hết màn (thắng / thua / bỏ ngang): mạng, chuỗi thắng, nhiệm vụ, event. Trả về ghi chú cho bảng kết quả.
// Màn tutorial: chỉ nhiệm vụ (không mạng / chuỗi thắng / event, như trước khi có kit).
export function levelEnd({ levelIndex, win, stars = 0, quit = false, tutorial = false, fish = 0 }) {
  if (!liveops) return [];
  const level = kitLevel(levelIndex);
  if (tutorial) { signal('level_end', { level, win, stars, quit }); offerFishDouble(0); return []; }
  const before = { streak: liveops.state.streak, yarn: liveops.eventView('yarn'), race: liveops.eventView('race')?.race };
  const r = liveops.levelEnd({ level, win, stars, quit });
  r.completed.forEach(q => showToast(`Quest done: ${questText(q.id)}!`));
  announce(r.rewards);
  const notes = [];
  if (win && r.streak > before.streak) notes.push(`Win streak ×${r.streak}`);
  if (!win && before.streak >= (C.streak?.tiers[0].wins ?? Infinity) && r.streak === 0) notes.push('Win streak lost');
  if (r.lifeLost) notes.push('−1 life');
  const yarn = liveops.eventView('yarn');
  if (yarn && (yarn.step !== before.yarn?.step || yarn.tops !== before.yarn?.tops)) notes.push(`${EVENT_INFO.yarn.name} ${yarn.step}/${EV.yarn.steps}`);
  // cuộc đua: chỉ ghi khi màn này còn tính (chưa về đích / chưa chốt hạng trước màn này)
  const race = liveops.eventView('race')?.race;
  if (win && race && before.race && !before.race.paid && core.eventCounts(C, 'race', level)) notes.push(`${EVENT_INFO.race.name} ${Math.min(EV.race.goal, race.wins.length)}/${EV.race.goal}`);
  if (fish) notes.push(`+${fish} fish`);
  offerFishDouble(win && !quit ? fish : 0);
  return notes;
}
// Bảng kết quả thắng: mời xem quảng cáo nhân đôi cá của màn (tối đa adDoublePerDay lần / ngày). fish = 0 thì ẩn nút.
function offerFishDouble(fish) {
  const button = $('result-fish'), view = liveops.eventView('fish');
  button.hidden = !(fish > 0 && view?.adsLeft > 0);
  if (button.hidden) return;
  button.innerHTML = `<span>Watch ad: ×2 fish (+${fish})</span><small>${view.adsLeft} left today</small>`;
  button.onclick = async () => {
    button.hidden = true;
    const r = await liveops.adDoubleCollect('fish', fish);
    if (!r) { button.hidden = false; return; }
    if (r.rewards.some(x => x.reward)) announce(r.rewards);
    else { playSound('reward'); showToast(`+${fish} fish!`); }
  };
}
// Màn này có mời continue khi thua không (LiveOps bật, từ màn continue.fromLevel).
export const canContinue = levelIndex => !!liveops?.continueOffer(kitLevel(levelIndex));
// Thua (từ màn continue.fromLevel, không ở màn tutorial): mời continue. Trả false nếu không mời (gọi tiếp phần kết thúc ván).
// Mua / xem ad thành công: kit gọi adapter.resume → màn chơi cộng lượt (connectPlay). Bỏ cuộc: onGiveUp().
export function offerContinue({ levelIndex, stuck, onGiveUp }) {
  if (!liveops || !liveops.continueOffer(kitLevel(levelIndex))) return false;
  shownContinue = { level: kitLevel(levelIndex), stuck, onGiveUp };
  $('continue-packs').hidden = true;
  renderContinue();
  $('continue-dialog').showModal();
  return true;
}

// ===== Gắn sự kiện (chỉ khi LiveOps bật) =====
function bind() {
  liveops.on(renderHud);
  // Mỗi giây: đếm ngược mạng / event, ghi nhận giờ + chốt cuộc đua hết giờ (sync ghi state nên không gọi trong renderHud).
  setInterval(() => { announce(liveops.sync().rewards); renderHud(); }, 1000);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-open="lives"]')) { playSound('pick'); openLives(); }
  });
  $('home-daily').onclick = () => { playSound('pick'); openDaily(); };

  $('lives-ad').onclick = async () => {
    if (await liveops.adLife()) playSound('reward');
    renderLives();
  };
  $('lives-refill').onclick = () => {
    if (!liveops.refillLives()) {
      $('lives-packs').hidden = false;
      renderGemPacks($('lives-packs'), renderLives);
      return;
    }
    playSound('reward');
    renderLives();
  };
  $('lives-play').onclick = () => { const go = livesReady; livesReady = null; $('lives-dialog').close(); go?.(); };
  $('lives-close').onclick = () => { livesReady = null; $('lives-dialog').close(); };

  $('continue-gems').onclick = () => {
    const { level, stuck } = shownContinue;
    if (!continueOpen().affordable) {
      $('continue-packs').hidden = false;
      renderGemPacks($('continue-packs'), renderContinue);
      return;
    }
    playSound('reward');
    closeContinue();
    liveops.buyContinue({ level, stuck });
  };
  $('continue-ad').onclick = async () => {
    const { level, stuck } = shownContinue;
    $('continue-dialog').close();
    if (await liveops.adContinue({ level, stuck })) { shownContinue = null; return; }
    $('continue-dialog').showModal();
  };
  $('continue-giveup').onclick = () => closeContinue().onGiveUp();
  $('continue-dialog').oncancel = event => event.preventDefault();

  $('daily-claim').onclick = () => {
    const result = liveops.claimLogin();
    if (!result) return;
    collect(result.reward, `Day ${result.step + 1}`);
    renderDaily();
  };
  $('daily-chest-open').onclick = () => openChest(false);
  $('daily-chest-ad').onclick = () => openChest(true);
  $('daily-close').onclick = () => $('daily-dialog').close();

  ['main', 'side'].forEach(slot => { $(`home-event-${slot}`).onclick = event => { playSound('pick'); openEvent(event.currentTarget.dataset.event); }; });
  $('event-close').onclick = closeEvent;
  $('event-dialog').oncancel = event => { event.preventDefault(); closeEvent(); };
  renderHud();
}
if (liveops) bind();
