// Kết màn khi thắng: Bonus Time (xả lượt: bàn mọc câu đố, AI giải tới sạch mèo — luật ở core/session.mjs finaleTurn),
// rồi thùng còn lại vỡ, bàn trống. Sang Unity: FinaleController (coroutine).
import * as game from '../core/session.mjs';
import { playSound } from '../ui/sound.mjs';
import { $, reduceMotion } from '../app/shared.js';
import { state, wait, cellEl, WIN_PAUSE_MS, pendingMerges } from './context.js';
import { render } from './hud.js';
import { spawnPuff, animateTurn, breakCrates } from './match-fx.js';
import { scoreSettled } from './score-bar.js';

// Xả lượt sau khi thắng (session.finaleTurn): bàn mọc "câu đố" cho đủ số lượt còn lại, AI tự chọn thẻ + đặt, mỗi lượt gom một
// cụm → đúng hết lượt là sạch mèo; hết lượt mà còn mèo thì chơi tiếp (lượt thưởng) tới sạch. Nhịp nhanh; chạm bàn thì nhanh hơn nữa.
// Sao đã chốt lúc thắng, chỉ điểm tăng thêm.
const FINALE_MS = 280, FINALE_FAST_MS = 110, FINALE_SPAWN_MS = 420;

let finaleFast = false;

export async function drainMoves() {
  state.animating = true;
  finaleFast = false;
  await Promise.all([...pendingMerges]);
  if (!state.moves && !state.board.some(object => object?.group && !object.cage)) return;
  const banner = bonusBanner();
  playSound('reward');
  await wait(finaleFast ? FINALE_FAST_MS : 550);
  for (let turn = game.finaleTurn(state); turn.ok; turn = game.finaleTurn(state)) {
    if (turn.spawned.length) {
      // Mèo câu đố mọc lên trước (bàn tạm vẽ ở trạng thái vừa mọc), rồi mới tới lượt AI đặt thẻ.
      const final = state.board, moves = state.moves;
      state.board = turn.spawnBoard;
      state.moves = moves + (turn.extra ? 0 : 1); // ô Move chưa trừ lượt này lúc mèo đang mọc
      state.justPlaced = new Set(turn.spawned);
      render(`${turn.spawned.length} cats pop in!`);
      state.moves = moves;
      if (!reduceMotion.matches) turn.spawned.forEach((index, i) => setTimeout(() => { const cell = cellEl(index); if (cell) spawnPuff(cell); }, i * 15));
      playSound('fill', 8);
      await wait(finaleFast ? FINALE_FAST_MS : FINALE_SPAWN_MS);
      state.board = final;
    }
    state.justPlaced = new Set(turn.result.indices.filter(index => turn.match.board[index]));
    animateTurn(turn);
    playSound('merge', turn.match.cleared.length);
    render(`${turn.extra ? 'Bonus clear' : 'Bonus'}! +${turn.gained} points.`);
    await wait(finaleFast || reduceMotion.matches ? FINALE_FAST_MS : FINALE_MS + (turn.effect.effects.length ? 120 : 0));
  }
  await Promise.all([...pendingMerges]);
  banner.end();
}

// Chữ "Bonus Time!" ở lại suốt lúc xả lượt (sọc cầu vồng chạy lặp, CSS .bonus-banner) + thanh điểm sọc cầu vồng (body.bonus-time).
function bonusBanner() {
  const board = $('board').getBoundingClientRect(), pop = document.createElement('span');
  pop.className = 'bonus-banner';
  // Hai lớp chữ chồng nhau: lớp dưới viền dày một màu, lớp trên chữ cầu vồng không viền (viền gọn bên ngoài nét chữ).
  pop.innerHTML = '<span class="bonus-outline">Bonus Time!</span><span class="bonus-fill">Bonus Time!</span>';
  pop.style.left = `${board.left + board.width / 2}px`;
  pop.style.top = `${board.top - 26}px`; // trên mép bàn, không đè lời khen (praise-pop ở 12% bàn)
  document.body.append(pop);
  document.body.classList.add('bonus-time');
  pop.animate([{ scale: .3, opacity: 0 }, { scale: 1.2, opacity: 1, offset: .6 }, { scale: 1, opacity: 1 }], { duration: 380, easing: 'ease-out' });
  return {
    end() {
      document.body.classList.remove('bonus-time');
      pop.animate([{ opacity: 1 }, { opacity: 0, scale: .8 }], { duration: 250, fill: 'forwards' }).finished.then(() => pop.remove());
    },
  };
}

$('board').addEventListener('pointerdown', () => { if (state.outcome?.win && state.animating) finaleFast = true; });

// Thắng (sau khi xả lượt đã dọn sạch mèo): chờ anim gom + điểm bay xong, ẩn UI chơi, thùng còn lại vỡ, bàn trống trơn.
// Bàn trống sau khi thắng: giữ ô ngoài bàn ('#') để lưới không bị dựng lại thành hình chữ nhật.
const emptiedBoard = () => state.board.map(cell => (cell?.void ? cell : null));

export async function celebrateWin(message) {
  state.animating = true;
  await Promise.all([...pendingMerges]);
  await scoreSettled(); // lượt gom cuối: đợi điểm bay hết vào thanh + thanh chạy đầy tới nóc
  document.body.classList.add('level-over'); // thanh điểm vừa đầy: ẩn ngay UI chơi (xem endLevel)
  breakCrates(state.board.map((object, index) => object?.block && !object.metal ? index : null).filter(index => index !== null), WIN_PAUSE_MS);
  state.animating = false;
  state.board = emptiedBoard();
  render(message);
}
