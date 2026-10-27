// Màn continue khi thua (hết lượt / hết chỗ): cho thấy suýt thắng (thiếu bao nhiêu điểm, mục tiêu nào) rồi mời chơi tiếp bằng gem
// (giá tăng dần trong một ván) hoặc xem ads (chỉ lần đầu). Màn paywall: lần continue đầu tiên trong đời miễn phí (dạy cơ chế).
// Số liệu: CONTINUE trong data/economy.mjs. Sang Unity: ContinuePanel.
import * as game from '../core/session.mjs';
import { LEVELS } from '../data/levels.mjs';
import { CONTINUE } from '../data/economy.mjs';
import { boostersUnlocked } from '../core/boosters.mjs';
import { playSound } from '../ui/sound.mjs';
import { ask, getWallet, setWallet, getBoosters, storeBoosters, gemTag } from '../app/shared.js';
import { payGems, tookGemShopTrip } from '../app/store.js';
import { showRewarded, adReady } from '../app/ads.js';
import { state } from './context.js';
import { render } from './hud.js';
import { renderBoosters } from './booster-bar.js';

// Tiến độ tới mục tiêu (như metric độ khó): điểm, và cỏ nếu màn có cỏ.
const progressOf = s => Math.min(s.score / s.level.target, s.grassTotal ? 1 - game.grassLeft(s) / s.grassTotal : 1);

function missingList(s) {
  const short = Math.max(0, s.level.target - s.score);
  return [short && `${short} points`, game.grassLeft(s) && `${game.grassLeft(s)} grass`, game.cagesLeft(s) && `${game.cagesLeft(s)} caged cats`,
    game.fatLeft(s) && `${game.fatLeft(s)} sleepy cat`, game.mailLeft(s) && `${game.mailLeft(s)} letters`, game.vasesLeft(s) && `${game.vasesLeft(s)} vases`,
    game.syrupLeft(s) && `${game.syrupLeft(s)} syrup`].filter(Boolean);
}

// Gọi khi ván vừa thua, trước bảng kết quả. true = người chơi đã continue (ván chạy tiếp), false = vào bảng thua như cũ,
// 'shop' = thiếu gem và đã chọn Buy gems (game đã chuyển tới Shop; ván treo lại, về Home thì màn này hiện lại).
export async function offerContinue() {
  const s = state, used = s.continues ?? 0;
  if (!boostersUnlocked(s.levelIndex) || used >= CONTINUE.prices.length || progressOf(s) < CONTINUE.minProgress) return false;
  const stuck = s.moves > 0; // còn lượt mà thua = hết chỗ đặt thẻ
  const free = used === 0 && !!LEVELS[s.levelIndex].paywall && !getWallet().freeContinueUsed;
  const price = CONTINUE.prices[used], adMoves = stuck ? CONTINUE.stuckMoves : CONTINUE.adMoves;
  const gain = moves => (stuck ? `+1 Hammer & +${moves} moves` : `+${moves} moves`);
  const missing = missingList(s);
  // Kích mua: cho thấy công sức sắp mất (điểm đã có) và giá lần continue sau (mỏ neo: lần này rẻ hơn).
  const next = CONTINUE.prices[used + 1];
  const body = `<p class="continue-progress">You have <b>${s.score.toLocaleString('en-US')}/${s.level.target.toLocaleString('en-US')}</b> points. Don't lose it now!</p>`
    + `<p class="level-feature">${missing.length ? `Still missing: <b>${missing.join(' · ')}</b>` : s.outcome?.reason ?? ''}</p>`
    + (next && !free ? `<p class="continue-next">Next continue: ${gemTag(next)}</p>` : '');
  playSound('invalid');
  for (;;) {
    const choice = await ask({
      title: 'So close!', className: 'continue', icon: './assets/img/play/booster-moves.png', body,
      choices: [
        { id: 'gems', label: `${gain(stuck ? CONTINUE.stuckMoves : CONTINUE.moves)} · ${free ? 'FREE' : gemTag(price)}` },
        used === 0 && adReady('continue') && { id: 'ad', label: `▶ Watch ad: ${gain(adMoves)}`, style: 'ad' },
        { id: 'quit', label: 'Give up', style: 'ghost' },
      ].filter(Boolean),
    });
    if (choice === 'gems') {
      if (free) setWallet({ ...getWallet(), freeContinueUsed: true });
      else if (!(await payGems(price))) { if (tookGemShopTrip()) return 'shop'; continue; }
      return revive(stuck ? CONTINUE.stuckMoves : CONTINUE.moves, stuck);
    }
    if (choice === 'ad') {
      if (!(await showRewarded('continue'))) continue; // ADS-SDK: chỗ đặt "continue"
      return revive(adMoves, stuck);
    }
    return false;
  }
}

function revive(moves, stuck) {
  game.revive(state, moves);
  state.continues = (state.continues ?? 0) + 1;
  if (stuck) storeBoosters({ ...getBoosters(), hammer: getBoosters().hammer + 1 });
  document.body.classList.remove('level-over');
  playSound('reward');
  renderBoosters();
  if (stuck) document.querySelector('#booster-bar [data-boost="hammer"]').classList.add('suggest');
  render(stuck ? `+${moves} moves! Smash some room with the Hammer.` : `+${moves} moves! Go for it!`);
  console.info(`[analytics] continue #${state.continues} level ${state.levelIndex + 1}`);
  return true;
}
