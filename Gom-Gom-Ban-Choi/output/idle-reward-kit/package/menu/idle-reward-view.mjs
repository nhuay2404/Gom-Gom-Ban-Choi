// Shared by the live idle-coins prompt and the standalone art preview.
const art = './assets/img/idle-reward/';
const fmt = n => n.toLocaleString('en-US');
const coins = n => `<img class="idle-coin-icon" src="${art}icon-coin.png" alt=""><span>${fmt(n)}</span>`;
export function idleRewardOptions(pending, bonusRate) {
  const extra = Math.round(pending * bonusRate);
  const percent = Math.round(bonusRate * 100);
  return {
    title: 'Pets collected coins!',
    className: 'idle-claim',
    body: `<button class="idle-reward-close" data-choice="" aria-label="Close without claiming"></button>
      <div class="idle-reward-hero" aria-hidden="true"><span class="idle-reward-glow"></span><img class="idle-reward-pet" src="${art}icon-pet.png" alt=""><img class="idle-reward-stack" src="${art}coin-stack.png" alt=""></div>
      <p class="idle-claim-total" aria-label="${fmt(pending)} coins collected">${coins(pending)}</p>
      <p class="idle-reward-caption">A little gift from your pets</p>`,
    choices: [
      { id: 'ad', style: 'ad', label: `<img class="idle-video-icon" src="${art}icon-video.png" alt=""><span class="idle-video-copy"><span>Watch video</span><strong class="idle-btn-amount">${coins(pending + extra)}</strong></span><em class="idle-bonus">+${percent}%</em>` },
      { id: 'claim', style: 'ghost', label: `<span>Claim</span><strong class="idle-btn-amount">${coins(pending)}</strong>` },
    ],
  };
}
