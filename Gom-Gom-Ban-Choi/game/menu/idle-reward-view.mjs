// Popup nhận xu idle trên art đồng hồ vẽ sẵn (meter-panel.png); kim + số xu do menu/idle-coins.js attachWheel chạy. Dùng chung cho game và idle-reward-kit.html.
const fmt = n => n.toLocaleString('en-US');
export function idleRewardOptions(pending, bonusRate) {
  return {
    title: 'Pets collected coins!',
    className: 'idle-claim idle-meter',
    body: `<button class="idle-reward-close" data-choice="" aria-label="Close without claiming"></button><span class="meter-total">${fmt(pending)}</span><img class="meter-needle" src="./assets/img/idle-reward/meter-needle.png" alt=""><span class="meter-factor">x${+(1 + bonusRate).toFixed(1)}</span>`,
    choices: [
      { id: 'ad', style: 'ad', label: `<span class="meter-video-amount">${fmt(pending + Math.round(pending * bonusRate))}</span><span class="meter-sr">Watch video for bonus coins</span>` },
      { id: 'claim', style: 'ghost', label: `<span class="meter-claim-amount">${fmt(pending)}</span><span class="meter-sr">Claim collected coins</span>` },
    ],
  };
}
