// ===== Luồng điều khiển MÀN CHƠI: điều phối =====
// Vào màn (startLevel / newGame), đặt thẻ (placeAt) và kết thúc lượt (finishTurn); phần vẽ / anim / HUD nằm ở các module
// cùng thư mục play/. Luật nằm ở core/session.mjs: ở đây gọi luật rồi giao cho các module vẽ.
// Không đụng Home / Deco / Shop / Map: cần chuyển màn hình thì gọi qua `menus` (menu-controller.js, nối ở start.js).
// Sang Unity: PlayController (MonoBehaviour) điều phối các component trên.
import * as game from '../core/session.mjs';
import { LEVELS } from '../data/levels.mjs';
import { loadProgress, levelsCleared as clearedCount, levelTier } from '../core/progression.mjs';
import { boostersUnlocked } from '../core/boosters.mjs';
import { playSound, playMeowChorus } from '../ui/sound.mjs';
import { planLevel, elementCount, difficultyOf } from '../core/adaptive.mjs';
import { $ } from '../app/shared.js';
import { state, now, look, setSession, refreshSkin, menus } from './context.js';
import { render, nudgeGoals, lowMovesText } from './hud.js';
import { track, endLevel, profile, startTracking, leaveResult, dropPendingRun } from './result.js';
import { animateTurn, EFFECT_FX } from './match-fx.js';
import { showNextTutorial, renderTutorial } from './tutorial.js';
import { drainMoves, celebrateWin } from './finale.js';
import { disarmHammer, suggestBoosters } from './booster-bar.js';
import { resetScoreFlights } from './score-bar.js';
import { armAfk } from './afk.js';
import { rotateActive, holdActive } from './cards.js';

// API cho menu-controller (nối ở start.js): menu gọi startLevel / mapTier, play gọi menus.* qua connectMenus.
export { connectMenus } from './context.js';
// Ván treo khi sang Shop mua gem: menu hỏi khi về Home để mở lại (menu/tabs.js).
export { pendingRun, resumeRun } from './result.js';

export function placeAt(anchor) {
  if (state.over || state.animating) return;
  const turn = game.place(state, anchor);
  if (turn.error) playSound('invalid');
  if (turn.error === 'tutorial') return render('Drag onto the glowing cell!', true);
  if (turn.error) return render(turn.error, true);
  if (!turn.ok) return;
  state.goalHint = false; // ô mục tiêu chỉ sáng tới nước đi kế tiếp
  const placedAt = now();
  track.thinks.push(placedAt - track.last);
  track.last = placedAt;
  // Chỉ gom (xóa cụm 3+) mới có điểm; đặt thẻ thôi thì không.
  animateTurn(turn);
  finishTurn(turn);
}

function finishTurn(turn) {
  const { result, match, gained } = turn;
  // Sau khi gom, mèo còn lại đã rơi xong rồi -> không chạy anim rơi lần nữa.
  // Mèo vừa đặt mà không bị gom thì rơi xuống ô thật; mèo bị gom đã có bóng mèo lo phần anim.
  state.justPlaced = new Set(result.indices.filter(index => match.board[index]));
  if (match.clusters.length) {
    playSound('merge', Math.max(...match.clusters.map(cluster => cluster.length)));
    // Cả bàn mèo vui kêu chồng lên (giống vừa gom trước, thêm vài giống đang đứng trên bàn; mèo trong lồng không kêu).
    playMeowChorus([...match.groups, ...match.board.filter(object => object?.group && !object.cage && !object.block).map(object => object.group)]);
  }
  else playSound('place');
  const crateText = match.broken?.length ? ` Broke ${match.broken.length} crate${match.broken.length > 1 ? 's' : ''}!` : '';
  const freedCages = match.freed?.filter(index => !match.syrup.includes(index)) ?? [];
  const cageText = freedCages.length ? ` Freed ${freedCages.length} caged cat${freedCages.length > 1 ? 's' : ''}!` : match.caged?.length ? ' A cage lock broke!' : '';
  const syrupText = match.syrup?.length ? ` Washed off ${match.syrup.length} syrup!` : '';
  const grassText = turn.cleaned?.length ? ` Cleared ${turn.cleaned.length} grass!` : '';
  const effectText = turn.effect?.effects.length ? ` ${turn.effect.effects.map(fx => EFFECT_FX[fx.kind].label).join(' ')}` : '';
  if (!turn.win) nudgeGoals();
  const goalText = !turn.win && state.score >= state.level.target ? (game.grassLeft(state) ? ' Clear the rest of the grass to win!' : game.cagesLeft(state) ? ' Free every caged cat to win!' : '') : '';
  const clearedText = match.groups.length ? `Matched ${match.groups.map(group => look(group).name).join(', ')}! +${gained} points.${effectText}${crateText}${grassText}${cageText}${syrupText}${goalText}` : goalText.trim();
  state.preview = null;
  if (turn.tutorialAdvanced) showNextTutorial(700);
  if (turn.win) {
    render(`You win with ${state.score} points! ✨`);
    return drainMoves().then(() => {
      const message = `You win with ${state.score} points! ✨`;
      render(message);
      return celebrateWin(message);
    }).then(() => endLevel(true));
  }
  if (turn.lose && !turn.stuck) return endLevel(false, state.outcome.reason);
  suggestBoosters(turn);
  // Màn bảo đảm thắng (session.mjs): hết lượt thì được tặng lượt thay vì thua.
  const noRoom = state.holdOn ? 'No room left — drag a card into Hold.' : 'No room left for this card!';
  render(`${turn.fit ? clearedText : `${clearedText} ${noRoom}`} ${lowMovesText()}`.trim(), !turn.fit);
  if (turn.stuck) endLevel(false, state.outcome.reason);
}

export function newGame(levelIndex = state?.levelIndex ?? 0) {
  // Màn không còn cố định: bật/tắt element theo profile người chơi (adaptive.mjs); màn có tutorial giữ bản gốc.
  const plan = planLevel(profile, levelIndex, { cleared: !!loadProgress().stars[levelIndex] }), { level } = plan;
  // Luật của ván nằm trong session; các trường còn lại (preview, animating...) chỉ phục vụ hiển thị.
  setSession(Object.assign(game.createSession(levelIndex, { level }), { plan, preview: null, previewAnchor: null, animating: false }));
  state.hasCages = game.cagesLeft(state) > 0;
  state.hasSyrup = game.syrupLeft(state) > 0;
  state.hasFat = state.board.some(object => object?.fat);
  state.hasVase = state.board.some(object => object?.vase);
  state.flying = { mail: 0, vase: 0, syrup: 0 };
  disarmHammer();
  startTracking();
  // Lần chơi lại sau khi thua sát nút: nút +lượt nhấp nháy mời dùng (adaptive.mjs: suggestBooster).
  $('booster-bar').querySelector('[data-boost="moves"]').classList.toggle('suggest', plan.suggestBooster && boostersUnlocked(levelIndex));
  // Ván mới: thanh điểm về 0 ngay, không tụt dần từ ván trước.
  const fill = $('score-fill');
  resetScoreFlights(); // điểm còn bay từ ván trước: bỏ
  document.querySelectorAll('.score-pop, .score-orb, .praise-pop, .firework-spark, .firework-flash').forEach(node => node.remove());
  fill.style.transition = 'none';
  const goal = state.grassTotal ? `Reach ${level.target} points and clear all ${state.grassTotal} grass tiles in ${level.moves} moves!` : `Reach ${level.target} points in ${level.moves} moves!`;
  render(`${goal}${state.hasCages ? ' Free every caged cat too!' : ''}${state.hasFat ? ' Wake up the big sleepy cat too!' : ''}${state.mailTotal ? ` Collect ${state.mailTotal} letters from the mailboxes too!` : ''}${state.hasVase ? ' Break every vase too!' : ''}${state.hasSyrup ? ' Wash the syrup off every cat too!' : ''}`);
  void fill.offsetWidth;
  fill.style.transition = '';
  renderTutorial();
}

// ===== Tiến độ (lưu trong máy), bản đồ màn, giới thiệu màn, kết quả =====
// Nhãn độ khó trên bản đồ (kiểu màu nút màn): theo tier thiết kế của màn (levels.mjs) — boss / hard / chill giữ nhãn
// Boss / Hard / Easy để người chơi thấy trước đỉnh khó (kiểu Candy Crush / Royal Match); màn normal là Easy / Medium theo
// số element của bản màn gốc (adaptive.mjs), không bao giờ hiện Hard. `style` = kiểu màu có sẵn trong CSS (.tier-*); 'normal' là màu mặc định.
const TIERS = {
  easy: { style: 'chill', label: 'Easy' }, medium: { style: 'normal', label: 'Medium' },
  hard: { style: 'hard', label: 'Hard' }, boss: { style: 'boss', label: 'Boss' },
};

const TIER_LABEL = { boss: 'boss', hard: 'hard', chill: 'easy' };

export const mapTier = index => TIERS[TIER_LABEL[levelTier(LEVELS[index])] ?? (difficultyOf(elementCount(LEVELS[index])) === 'easy' ? 'easy' : 'medium')];

// ?dda trên URL: ghi profile đang nhận diện ra console mỗi lần vào màn (để QA), người chơi thường không thấy.
const DDA_DEBUG = new URLSearchParams(location.search).has('dda');

// Cổng cho bot tự chơi (dev-bot.js, ?bot=...): đọc ván hiện tại + gọi đúng các hàm người chơi dùng (xoay / Hold / đặt thẻ).
export const botApi = {
  state: () => state,
  // bot thao tác = người chơi đang chơi: không cho mèo AFK ngủ gật giữa chừng
  rotate() { armAfk(); rotateActive(); }, hold() { armAfk(); holdActive(); }, place(anchor) { armAfk(); placeAt(anchor); },
  // bot không cần hướng dẫn: bỏ bước tutorial của màn
  // thua thì chơi lại ngay màn đó: đóng bảng kết quả / hộp thoại đang mở rồi vào lại màn
  retry() { armAfk(); if ($('result-dialog').open) leaveResult(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); startLevel(state.levelIndex); },
  skipTutorial() { if (state?.tutorial) { state.tutorial = null; renderTutorial(); } },
};

// Vào thẳng màn chơi (không có bảng giới thiệu màn); newGame() bắt đầu đo metric độ khó.
export function startLevel(index) {
  dropPendingRun(); // vào màn mới: ván treo (sang Shop mua gem) bị bỏ
  refreshSkin();
  menus.hideMenus();
  document.body.classList.remove('level-over');
  $('map').hidden = true;
  newGame(index);
  const { plan } = state;
  if (DDA_DEBUG) console.info(`Level ${index + 1} · ${plan.profile} ${plan.shift >= 0 ? '+' : ''}${plan.shift} (${plan.baseCount}→${plan.count})${plan.deal ? ` · ${plan.deal}` : ''}`);
  renderTutorial();
}

export const levelsCleared = () => clearedCount(loadProgress());
