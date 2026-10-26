// Presentation shared by the real login calendar and its isolated preview.
const art='./assets/img/login-gift/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const loginShell=()=>`<header class="login-header"><img class="login-emblem" src="${art}icon-login.png" alt=""><h2 id="login-title">7 Days Login</h2><button class="login-close" data-close aria-label="Close gifts"></button></header><p class="login-note" role="status" aria-live="polite"></p><div class="login-scene"><ol class="login-grid" aria-label="Seven daily gifts"></ol><aside class="login-hero" aria-hidden="true"><span class="login-hero-glow"></span><img class="login-hero-cat" src="${art}hero-cat.png" alt=""></aside></div><div class="store-choices"><button class="pill-button login-claim" data-claim>Claim</button></div>`;
export function loginGrid(calendar,state,today,artFor){
 return calendar.map((cell,i)=>{
  const {icon,text}=artFor(cell),status=i<state.claimed?'claimed':i===state.claimed?(today?'today':'tomorrow'):'locked';
  const tag={claimed:'Collected',today:'Today',tomorrow:'Tomorrow',locked:''}[status];
  const graphic=cell.art?`<img src="${escape(cell.art)}" alt="">`:icon;
  return `<li class="login-cell ${status}${i===calendar.length-1?' big':''}${cell.art?' photo':''}" aria-label="Day ${i+1}${tag?', '+tag:''}"><b class="login-day"><span>Day</span>${i+1}</b><span class="login-icon" aria-hidden="true">${graphic}</span><small class="login-reward-name">${text}</small>${cell.art?'<span class="login-exclusive">Exclusive</span>':''}${i===calendar.length-1?'<span class="login-final-badge">Day 7</span>':''}${tag?`<em class="login-status">${status==='claimed'?`<img src="${art}check.png" alt="">`:''}${tag}</em>`:''}</li>`;
 }).join('');
}
export const loginProgress=(claimed,total)=>`<span>${claimed} / ${total} gifts collected</span><div class="login-pips" aria-hidden="true">${Array.from({length:total},(_,i)=>`<i${i<claimed?' class="filled"':''}></i>`).join('')}</div>`;
export const mysteryCat=()=>`<span class="login-mystery"><img src="${art}mystery-cat.png" alt=""><b>?</b></span>`;
