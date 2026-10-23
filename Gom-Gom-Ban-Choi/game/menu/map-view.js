// Home = bản đồ màn: bản đồ 3D (deco/map-world.mjs; không có WebGL thì bản đồ 2D), nút màn, nhận mèo thưởng khi qua mốc.
// Sang Unity: MapScreen (MonoBehaviour) + scene / prefab bản đồ.
import { categories, catMarkup } from '../ui/cat-art.mjs';
import { LEVELS } from '../data/levels.mjs';
import { loadProgress, unlockedCount, levelTier } from '../core/progression.mjs';
import { playSound, playMeow } from '../ui/sound.mjs';
import { SAVE_KEYS, readText } from '../core/save.mjs';
import { claimCat, isCatClaimed, catRewardsAt } from '../deco/deco-data.mjs';
import { GEM_REWARDS } from '../data/economy.mjs';
import { grantGems } from '../app/store.js';
import { $, reduceMotion, showToast, getDeco, setDeco, refreshWallet, setPieceSkin, dogSkinOpen, noteEvent } from '../app/shared.js';
import { play } from './context.js';
import { hideMenus, renderSkinButton } from './tabs.js';
import { renderDailyButton } from './daily.js';
import { renderQuestButtons } from './quests.js';
import { clearDecoNew } from './deco-panel.js';
import { markTab } from './settings.js';

// Bản đồ saga: màn 1 ở đáy, các nút nằm trên một con đường uốn hình sin đi lên (như Candy Crush).
const MAP = { STEP: 118, TOP: 230, BOTTOM: 150, SWING: 0.3, FREQ: 0.95 };

const PAW_SVG = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="16" rx="5.5" ry="4.6"/><circle cx="5.6" cy="10" r="2.4"/><circle cx="9.6" cy="6.2" r="2.5"/><circle cx="14.4" cy="6.2" r="2.5"/><circle cx="18.4" cy="10" r="2.4"/></svg>';

const EAR_SVG = '<svg viewBox="0 0 24 24"><path class="ear-out" d="M3 22 6.5 4.5Q7.5 1.5 10 3.5L22 13Z"/><path class="ear-in" d="M8 16.5 9.5 8.5 15.5 13.5Z"/></svg>';

const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13Z"/></svg>';

const mapPoint = (index, width, height) => ({
  x: width * (0.5 + MAP.SWING * Math.sin(index * MAP.FREQ)),
  y: height - MAP.BOTTOM - index * MAP.STEP,
});

// Đường cong mượt qua các điểm: mỗi đoạn là cubic bezier với tay nắm thẳng đứng.
const mapPath = points => points.map((p, i) => {
  if (!i) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const q = points[i - 1], mid = (q.y - p.y) / 2;
  return `C${q.x.toFixed(1)} ${(q.y - mid).toFixed(1)} ${p.x.toFixed(1)} ${(p.y + mid).toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}).join('');

function renderMap() {
  const list = $('map-list'), progress = loadProgress(), open = unlockedCount(progress);
  const width = Math.min(list.clientWidth, 440), height = MAP.TOP + MAP.BOTTOM + (LEVELS.length - 1) * MAP.STEP;
  const points = LEVELS.map((_, index) => mapPoint(index, width, height));
  const road = document.createElement('div');
  road.className = 'map-road';
  road.style.cssText = `width:${width}px;height:${height}px`;
  // Đoạn đã đi (tới màn đang mở) tô màu kẹo; phần còn lại là đường đất.
  road.innerHTML = `<svg width="${width}" height="${height}" aria-hidden="true">
      <path class="road-edge" d="${mapPath(points)}"/><path class="road-fill" d="${mapPath(points)}"/>
      ${open > 1 ? `<path class="road-done" d="${mapPath(points.slice(0, open))}"/>` : ''}
      <path class="road-dots" d="${mapPath(points)}"/>
    </svg>`;
  // Dấu chân mèo trên đường giữa hai màn (2 dấu mỗi đoạn, theo design Figma "Map").
  const bezier = (q, p, t) => {
    const mid = (q.y - p.y) / 2, u = 1 - t;
    return { x: u * u * u * q.x + 3 * u * t * (u * q.x + t * p.x) + t * t * t * p.x,
      y: u * u * u * q.y + 3 * u * u * t * (q.y - mid) + 3 * u * t * t * (p.y + mid) + t * t * t * p.y };
  };
  road.append(...points.slice(1).flatMap((p, i) => [0.38, 0.62].map((t, k) => {
    const paw = document.createElement('span'), at = bezier(points[i], p, t);
    paw.className = `map-paw${i + 1 < open ? ' done' : ''}`;
    paw.innerHTML = PAW_SVG;
    paw.style.cssText = `left:${(at.x + (k ? 7 : -7)).toFixed(1)}px;top:${at.y.toFixed(1)}px;rotate:${k ? 18 : -18}deg`;
    return paw;
  })));
  road.append(...LEVELS.map((level, index) => {
    const node = document.createElement('button');
    const stars = progress.stars[index] || 0, locked = index >= open, tier = levelTier(level), current = index === open - 1;
    node.className = `map-node${locked ? ' locked' : stars ? ' done' : ''}${current ? ` current${points[index].x > width / 2 ? ' avatar-left' : ''}` : ''} tier-${play.mapTier(index, current).style}`;
    node.style.cssText = `left:${points[index].x}px;top:${points[index].y}px`;
    node.disabled = locked;
    node.title = `${level.name} · ${play.mapTier(index, current).label}`;
    node.setAttribute('aria-label', `Level ${index + 1}: ${level.name}${locked ? ' (locked)' : stars ? ' (cleared)' : ''}`);
    node.innerHTML = `${EAR_SVG.replace('<svg', '<svg class="ear l"')}${EAR_SVG.replace('<svg', '<svg class="ear r"')}<b>${index + 1}${locked ? LOCK_SVG : ''}</b>`
      + (tier === 'boss' ? '<span class="map-crown" aria-hidden="true">👑</span>' : '')
      + (current ? `<span class="map-avatar" aria-hidden="true">${catMarkup.orange}</span>` : '');
    node.onclick = () => { $('map').hidden = true; play.startLevel(index); };
    return node;
  }));
  // Cuối đường: biển báo hết màn để người chơi biết đã tới đỉnh, không phải bản đồ bị cắt.
  const end = document.createElement('span');
  end.className = 'map-end';
  end.textContent = 'More levels coming soon!';
  end.style.cssText = `left:${width / 2}px;top:${points[LEVELS.length - 1].y - 78}px`;
  road.append(end);
  list.replaceChildren(road);
}

// Bản đồ 3D (deco/map-world.mjs: trống cỏ lăn như Animal Crossing). Máy không có WebGL / lỗi nạp thì dùng bản đồ 2D ở trên.
export let map3d = null, map3dFailed = false, catShowcase = null;

export const map3dReady = import('../deco/map-world.mjs').then(({ createMapWorld, catShowcase: showcase }) => {
  catShowcase = showcase;
  map3d = createMapWorld($('map-3d'), {
    avatarSvg: catMarkup.orange,
    onPick: index => { map3d.stop(); $('map').hidden = true; play.startLevel(index); },
    onClaim: (breed, index) => showCatReward(breed, () => {
      setDeco(claimCat(getDeco(), breed));
      noteEvent('claimPet');
      const gems = grantGems(`pet:${breed}`, GEM_REWARDS.pet);
      if (gems) showToast(`New friend! +${gems} gems`);
      map3d.render(mapLevels());
      map3d.focus(index, false);
      refreshClaimDot();
    }),
  });
}).catch(error => { map3dFailed = true; console.warn('Map 3D off:', error); });

function mapLevels() {
  const progress = loadProgress(), open = unlockedCount(progress), deco = getDeco();
  return LEVELS.map((level, index) => {
    // Mèo thưởng của màn này (deco-data.mjs catRewardsAt: 3 bé / stage, rải đều, màn cuối stage luôn có): bản đồ dựng mèo 3D
    // cạnh màn (mèo đã nhận thì về nhà, không hiện nữa). Thắng màn rồi mà chưa nhận: nhãn NEW! thành nút Claim.
    const newCats = catRewardsAt(index).filter(breed => !isCatClaimed(deco, breed));
    const claimable = !!progress.stars[index];
    return { locked: index >= open, current: index === open - 1, tier: play.mapTier(index, index === open - 1).style, newCats, claimable };
  });
}

// Chấm đỏ ở tab Home khi còn mèo đã mở khoá mà chưa nhận (nút CLAIM trên Map).
const hasUnclaimedCat = () => mapLevels().some(level => level.claimable && level.newCats.length > 0);

export function refreshClaimDot() {
  $('tabbar').querySelector('[data-tab="home"]')?.classList.toggle('has-dot', hasUnclaimedCat());
}

// Màn hình nhận thưởng mèo (kiểu "You got" của game mobile): tia sáng xoay, mèo bật ra, độ hiếm + tên, "Tap to claim".
// Chạm (sau khi hiện xong) thì mèo bay đi, gọi onClaimed, báo toast mèo đã về nhà.
const CAT_RARITY = { orange: 'Common', gray: 'Common', white: 'Common', tabby: 'Rare', siamese: 'Epic', tuxedo: 'Legendary',
  shiba: 'Rare', golden: 'Rare', pug: 'Epic', dalmatian: 'Epic', malamute: 'Legendary', rottweiler: 'Legendary' };

// `keep`: sắp có màn thưởng kế tiếp nên giữ nền khi đóng (không mờ ra); `chained`: màn kế của một cặp, hiện luôn không mờ vào.
function showCatReward(breed, onClaimed, { keep = false, chained = false } = {}) {
  const rarity = CAT_RARITY[breed] || 'Rare', name = categories[breed].name;
  const screen = document.createElement('div');
  screen.className = `cat-reward${chained ? ' chained' : ''}`;
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-label', `You got ${name}`);
  screen.innerHTML = `<div class="cr-rays"></div><div class="cr-glow"></div>
    <p class="cr-title">You got</p>
    <div class="cr-cat cr-3d"><i class="cr-spark s1"></i><i class="cr-spark s2"></i><i class="cr-spark s3"></i><i class="cr-spark s4"></i></div>
    <p class="cr-rarity r-${rarity.toLowerCase()}">${rarity}</p>
    <p class="cr-name">${name}</p>
    <p class="cr-tap">Tap to claim</p>`;
  document.body.append(screen);
  // Mèo 3D (cùng model trên Map); máy không dựng được 3D thì dùng art 2D.
  let showcase = null;
  try { showcase = catShowcase?.(screen.querySelector('.cr-cat'), breed, { reduceMotion: reduceMotion.matches }); } catch (error) { console.warn('Cat showcase off:', error); }
  if (!showcase) screen.querySelector('.cr-cat').insertAdjacentHTML('afterbegin', catMarkup[breed]);
  playSound('reward');
  // Mèo mới chào bằng giọng riêng của giống (sound.mjs VOICE), sau tiếng thưởng một nhịp.
  setTimeout(() => playMeow(breed), 450);
  let ready = false, done = false;
  setTimeout(() => { ready = true; screen.classList.add('ready'); }, reduceMotion.matches ? 0 : 900);
  screen.addEventListener('click', () => {
    if (!ready || done) return;
    done = true;
    playSound('pick');
    onClaimed();
    screen.classList.add('closing');
    if (keep) screen.classList.add('keep');
    const roomy = getDeco().cats.includes(breed);
    setTimeout(() => { showcase?.stop(); screen.remove(); showToast(roomy ? `${name} moved into your home!` : `${name} is waiting in Deco (room is full)`); }, reduceMotion.matches ? 0 : 450);
  });
}

async function showMap3d() {
  await map3dReady;
  if ($('map').hidden) return;
  if (!map3d) { showMap2d(); return; }
  const levels = mapLevels();
  $('map').classList.add('is-3d');
  map3d.render(levels);
  map3d.focus(Math.max(0, levels.findIndex(level => level.current)));
  map3d.start();
}

// Home hub chính là bản đồ màn (showTab('home') cũng dẫn tới đây).
export function showMap() {
  hideMenus();
  // Vừa chơi tới màn 30: bộ chó mở, tự đổi sang chó + báo một lần
  if (dogSkinOpen() && !readText(SAVE_KEYS.skin)) { setPieceSkin('dogs'); showToast('New! Dog pieces unlocked. Switch sets anytime with the button on the left.'); }
  renderSkinButton();
  renderDailyButton();
  renderQuestButtons();
  clearDecoNew();
  markTab('home');
  refreshWallet();
  $('map').hidden = false;
  $('tutorial').hidden = true;
  if (map3dFailed) showMap2d();
  else showMap3d();
}

function showMap2d() {
  $('map').classList.remove('is-3d');
  renderMap();
  // Cuộn cho màn đang chơi nằm giữa màn hình (không có thì ở đáy, chỗ màn 1).
  const list = $('map-list'), current = list.querySelector('.map-node.current');
  list.scrollTop = current ? current.offsetTop - list.clientHeight / 2 : list.scrollHeight;
}

addEventListener('resize', () => { if (!$('map').hidden && map3dFailed) renderMap(); });
