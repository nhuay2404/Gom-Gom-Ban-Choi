// Presentation only: shared by the live dialog and the asset-kit preview.
const art = './assets/img/quests/';
const fmt = n => n.toLocaleString('en-US');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Nhãn + icon theo chuỗi (QUEST_TRACKS); chuỗi dạy chơi dùng lại icon có sẵn.
const labels = { level: 'Adventure', area: 'Explore', build: 'Build', pets: 'New friends', styles: 'Decorate', carry: 'Cat care', view: 'Cozy time', surface: 'Decorate' };
const icons = { carry: 'pets', view: 'styles', surface: 'styles' };
export function questRow(q, index) {
  const done = q.progress >= q.n;
  const progress = Math.max(0, Math.min(q.n, q.progress));
  const pct = q.n > 0 ? Math.round(progress / q.n * 100) : 0;
  const track = Object.hasOwn(labels, q.track) ? q.track : 'level';
  // Quest tặng gem hiện gem thay đồng xu. Chưa xong: chạm thẻ = đi tới chỗ làm (data-go, menu/quests.js).
  const prize = q.gems ? `<i class="ico-gem"></i>${fmt(q.gems)}` : `<img src="./assets/img/home/coin-glossy.png" alt="">${fmt(q.reward)}`, unit = q.gems ? `${fmt(q.gems)} gems` : `${fmt(q.reward)} coins`;
  return `<li class="quest-card${done ? ' is-ready' : ''}"${done ? '' : ` data-go="${index}" role="button" tabindex="0"`}>
    <div class="quest-icon"><img src="${art}icon-${icons[track] ?? track}.png" alt="">${done ? `<img class="quest-check" src="${art}check.png" alt="">` : ''}</div>
    <div class="quest-info"><span class="quest-category">${labels[track]}${done ? ' · Complete!' : '<span class="quest-go">Go ›</span>'}</span><b class="quest-text">${escape(q.text)}</b>
    <span class="quest-progress" role="progressbar" aria-label="${escape(q.text)}" aria-valuemin="0" aria-valuemax="${q.n}" aria-valuenow="${progress}"><i style="width:${pct}%"></i><em>${fmt(progress)} / ${fmt(q.n)}</em></span></div>
    <button class="quest-claim" data-claim="${index}" aria-label="${done ? 'Claim' : 'Reward'} ${unit}: ${escape(q.text)}"${done ? '' : ' disabled'}><strong>${prize}</strong></button></li>`;
}
export function questBody(quests) {
  return quests.active.length ? `<ul class="quest-list">${quests.active.map(questRow).join('')}</ul>`
    : `<div class="quest-empty"><img src="${art}empty.png" alt=""><h3>You're all caught up!</h3><p>New quests arrive with new levels and areas.</p></div>`;
}
export const questShell = () => `<header class="quest-header"><img class="quest-emblem" src="./assets/img/quests/icon-quest.png" alt=""><h2 id="quests-title">Quests</h2><button class="quest-close" data-close aria-label="Close quests" autofocus></button></header><p class="quest-subtitle">Little steps, lovely rewards</p><div class="quest-summary" role="status" aria-live="polite"></div><div class="quest-body"></div>`;
