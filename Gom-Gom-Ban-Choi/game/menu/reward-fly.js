// Xu / gem bay từ nút nhận thưởng vào ô ví đang hiện (Home, Deco hoặc Shop). Chạy trên một lớp popover (top layer) để nằm
// trên cả popup <dialog> đang mở. Trả về Promise xong khi đồng cuối chạm ví (người gọi cập nhật số trong ví lúc đó).
import { reduceMotion } from '../app/shared.js';

const COIN_IMG = './assets/img/home/icon-coin.png';
const FLY_MS = 650, STAGGER_MS = 60, MAX_ICONS = 8;

// Ô ví đang hiện trên màn hình (bỏ qua bản ở tab đang ẩn).
// Bản sao ví nằm trên lớp mờ của bảng (menu/wallet-lift.js) được ưu tiên vì nó là ví người chơi đang nhìn thấy rõ.
const pillOf = kind => [...document.querySelectorAll(`.wallet-lift .fh-${kind}`), ...document.querySelectorAll(`.fh-${kind}`)].find(el => el.getClientRects().length && el.getBoundingClientRect().width);

function flyOne(layer, kind, from, to, delay) {
  const icon = document.createElement(kind === 'coins' ? 'img' : 'i');
  icon.className = kind === 'coins' ? 'reward-fly-icon' : 'reward-fly-icon ico-gem';
  if (kind === 'coins') { icon.src = COIN_IMG; icon.alt = ''; }
  icon.style.cssText = `left:${from.x}px;top:${from.y}px`;
  layer.append(icon);
  // Bay vòng nhẹ lên trên rồi rơi vào ví; lệch ngang ngẫu nhiên cho tản ra.
  const dx = to.x - from.x, dy = to.y - from.y, side = (Math.random() - .5) * 70;
  return icon.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: `translate(calc(-50% + ${side}px),calc(-50% - 40px)) scale(1.15)`, opacity: 1, offset: .25 },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.7)`, opacity: 1 },
  ], { duration: FLY_MS, delay, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'both' }).finished.then(() => icon.remove());
}

// from: chỗ bắt đầu (DOMRect của nút nhận, đo TRƯỚC khi cập nhật dữ liệu: bảng vẽ lại ngay sau đó); reward: { coins, gems }.
export function flyReward(from, { coins = 0, gems = 0 } = {}) {
  if (reduceMotion.matches || !from?.width) return Promise.resolve();
  const start = from, origin = { x: start.left + start.width / 2, y: start.top + start.height / 2 };
  const layer = document.createElement('div');
  layer.className = 'reward-fly';
  layer.popover = 'manual';
  document.body.append(layer);
  layer.showPopover();
  const flights = [];
  for (const [kind, amount] of [['coins', coins], ['gems', gems]]) {
    const pill = amount > 0 && pillOf(kind);
    if (!pill) continue;
    const box = pill.getBoundingClientRect(), to = { x: box.left + box.height / 2, y: box.top + box.height / 2 };
    const count = Math.min(MAX_ICONS, Math.max(3, Math.ceil(Math.log10(amount + 1) * 2)));
    const arrivals = Array.from({ length: count }, (_, i) => flyOne(layer, kind, origin, to, i * STAGGER_MS));
    // Ví nảy lên khi đồng đầu tiên chạm.
    arrivals[0].then(() => { pill.classList.remove('coin-hit'); void pill.offsetWidth; pill.classList.add('coin-hit'); });
    flights.push(...arrivals);
  }
  // Chốt an toàn: app chạy nền thì hiệu ứng có thể đứng yên; quá hạn vẫn xong để ví được cập nhật.
  const timeout = new Promise(resolve => setTimeout(resolve, FLY_MS + MAX_ICONS * STAGGER_MS + 400));
  return Promise.race([Promise.all(flights), timeout]).then(() => layer.remove());
}
