// Presentation shared by the real login calendar and its isolated preview.
const art='./assets/img/login-gift/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const loginShell=()=>`<div class="login-art-backdrop" aria-hidden="true"></div><header class="login-header"><img class="login-emblem" src="${art}icon-login.png" alt=""><h2 id="login-title">7-Day Gift</h2><button class="login-close" data-close aria-label="Close gifts"></button></header><p class="login-note" role="status" aria-live="polite"></p><div class="login-scene"><button class="login-nav prev" data-nav="-1" aria-label="Previous day"></button><ol class="login-grid" aria-label="Seven daily gifts, swipe to see the next day"></ol><button class="login-nav next" data-nav="1" aria-label="Next day"></button></div><div class="login-dots" aria-hidden="true"></div><div class="store-choices"><button class="pill-button login-claim" data-claim>Claim</button><button class="pill-button ghost login-later" data-close>Later</button></div>`;
// from: bỏ các ô trước đó (quà đã nhận không hiện nữa).
export function loginGrid(calendar,state,today,artFor,from=0){
 return calendar.map((cell,i)=>{
  if(i<from)return '';
  const reward=artFor(cell,i),{icon,text,art:image}=reward,status=i<state.claimed?'claimed':i===state.claimed?(today?'today':'tomorrow'):'locked';
  const tag={claimed:'Collected',today:'Today',tomorrow:'Tomorrow',locked:''}[status];
  const src=cell.art??image,fullBleed=Boolean(src),photo=Boolean(cell.art);
  const graphic=fullBleed?`<img src="${escape(src)}" alt="">`:icon;
  return `<li class="login-cell ${status}${i===calendar.length-1?' big':''}${fullBleed?' art-fill':''}${photo?' photo':''}${cell.item?' furniture':''}${reward.fx?' '+reward.fx:''}" aria-label="Day ${i+1}${tag?', '+tag:''}"><b class="login-day"><span>Day</span>${i+1}</b>${reward.fx?'<span class="login-rays" aria-hidden="true"></span>':''}<span class="login-icon" aria-hidden="true">${graphic}</span>${reward.fx?`<span class="login-fx" aria-hidden="true">${'<i></i>'.repeat(5)}</span>`:''}${cell.item?`<span class="login-fx" aria-hidden="true">${'<i></i>'.repeat(10)}</span>`:''}${reward.gems?`<b class="login-bonus" aria-label="plus ${reward.gems} gems">+${reward.gems}<i class="ico-gem"></i></b>`:''}<small class="login-reward-name">${text}</small>${status==='claimed'?`<em class="login-status"><img src="${art}check.png" alt=""></em>`:''}</li>`;
 }).join('');
}
export const loginProgress=(claimed,total)=>`<span>${claimed} / ${total} gifts collected</span><div class="login-pips" aria-hidden="true">${Array.from({length:total},(_,i)=>`<i${i<claimed?' class="filled"':''}></i>`).join('')}</div>`;
