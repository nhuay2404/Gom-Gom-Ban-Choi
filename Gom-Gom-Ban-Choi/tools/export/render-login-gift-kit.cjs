const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('playwright');sharp.cache(false);
(async()=>{
 const root=path.resolve(__dirname,'../..'),dir=path.join(root,'game/assets/img/login-gift'),out=path.join(root,'output/login-gift-kit');await fs.mkdir(out,{recursive:true});
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 for(const a of manifest.assets)if(a.file.endsWith('.svg'))await fs.writeFile(path.join(dir,a.png??a.file.replace('.svg','.png')),await sharp(path.join(dir,a.file)).png().toBuffer());
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1100},deviceScaleFactor:1});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await page.goto('http://127.0.0.1:4400/login-gift-kit.html');await page.locator('.asset').last().waitFor();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(out,'login-gift-overview.png'),fullPage:true});
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   for(const state of ['day1','day3','waiting','day7','complete']){
    await page.locator(`[data-state="${state}"]`).click();
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.login-reward-name')].some(e=>e.scrollWidth>e.clientWidth)))throw Error(`Overflow: ${width}, ${state}`);
    if(await page.locator('.login-cell').count()!==7)throw Error('Wrong number of days');
    await page.locator('.phone').screenshot({path:path.join(out,`login-gift-${state}-${width}.png`)});
   }
  }
  await page.locator('[data-state="day1"]').click();await page.locator('[data-claim]').click();if(await page.locator('[data-claim]').isVisible())throw Error('Claim should hide after collecting');
  // Import the real controller with isolated save/wallet boundaries, keeping actual core calendar logic.
  await page.route('**/app/shared.js',r=>r.fulfill({contentType:'text/javascript',body:`
   let deco={coins:0,cats:[]},boosters={moves:0,hammer:0,swap:0};
   window.resetWallet=()=>{deco={coins:0,cats:[]};boosters={moves:0,hammer:0,swap:0};window.grantedGems=0};
   window.readWallet=()=>({deco,boosters,gems:window.grantedGems||0});
   export const $=id=>document.getElementById(id);export const showToast=()=>{};export const refreshWallet=()=>{};
   export const getDeco=()=>deco;export const setDeco=v=>{deco=v};export const getBoosters=()=>boosters;export const storeBoosters=v=>{boosters=v};
   export const BOOSTER_NAMES={moves:'+3 moves',hammer:'Hammer',swap:'New card'};export const gemTag=n=>'<i class="ico-gem"></i> '+n;
  `}));
  await page.route('**/ui/sound.mjs',r=>r.fulfill({contentType:'text/javascript',body:'export const playSound=()=>{};'}));
  await page.route('**/app/store.js',r=>r.fulfill({contentType:'text/javascript',body:'export const grantGems=(key,n)=>{window.grantedGems=(window.grantedGems||0)+n;return n;};'}));
  await page.route('**/menu/deco-panel.js',r=>r.fulfill({contentType:'text/javascript',body:'export const thumbOf=()=>"";'}));
  await page.route('**/deco/deco-data.mjs',r=>r.fulfill({contentType:'text/javascript',body:`
   export const CATALOG=[];
   export const itemById=id=>({id,name:'Heart cushion',price:100});
   export const giftItem=(deco,entry)=>({...deco,testGift:entry.id});
   export const claimCat=(deco,breed)=>({...deco,cats:[...deco.cats,breed]});
  `}));
  // Stub only login storage; canClaimLogin/claimLogin/loginDone/loginCoins stay real.
  await page.route('**/core/login.mjs',async r=>{
   let body=await fs.readFile(path.join(root,'game/core/login.mjs'),'utf8');
   const begin=body.indexOf('export function loadLogin()'),end=body.indexOf('export const loginDone');
   body=body.slice(0,begin)+`let state={claimed:0,lastDay:null,lastAt:0,pendingCats:[],seenDay:null};export const loadLogin=()=>state;export const saveLogin=v=>{state=v};window.testLoginState=(v)=>{state=v};window.readLoginState=()=>state;\n`+body.slice(end);
   await r.fulfill({contentType:'text/javascript',body});
  });
  await page.evaluate(async()=>{
   Date.now=()=>1800000000000;
   document.querySelector('main').remove();document.body.insertAdjacentHTML('beforeend','<button id="home-login">7 Days</button>');
   await Promise.all(['./ui/play/base.css','./ui/shared/base.css','./ui/shared/store.css','./ui/home/home.css','./ui/home/login-gift.css'].map(href=>new Promise(resolve=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.onload=resolve;document.head.append(l)})));
   window.loginController=await import('./menu/login.js');
  });
  for(const claimed of [0,1,2,3,4,5,6]){
   await page.evaluate(n=>{window.resetWallet();window.testLoginState({claimed:n,lastDay:null,lastAt:0,pendingCats:[],seenDay:null});},claimed);
   await page.evaluate(()=>{window.loginController.renderLoginButton();document.querySelector('#home-login').hidden=false;});
   await page.locator('#home-login').click();await page.locator('dialog[open]').waitFor();
   if(claimed===0)await page.locator('dialog').screenshot({path:path.join(out,'login-gift-live.png')});
   await page.locator('dialog [data-claim]').click();
   const got=await page.evaluate(()=>({state:window.readLoginState(),wallet:window.readWallet()}));
   if(got.state.claimed!==claimed+1)throw Error(`Day ${claimed+1}: claim did not advance once`);
   if(await page.locator('dialog [data-claim]').isVisible())throw Error('Repeat claim allowed on same day');
   if(claimed===0&&got.wallet.boosters.moves!==1)throw Error('Day 1 moves incorrect');
   if(claimed===1&&got.wallet.deco.coins!==800)throw Error('Day 2 coins incorrect');
   if(claimed===2&&(got.wallet.deco.testGift!=='catbed-heart'||got.wallet.gems!==15))throw Error('Day 3 exclusive gift incorrect');
   if(claimed===3&&got.wallet.boosters.hammer!==1)throw Error('Day 4 hammer incorrect');
   if(claimed===4&&got.wallet.deco.coins!==3000)throw Error('Day 5 coins incorrect');
   if(claimed===5&&got.wallet.boosters.swap!==1)throw Error('Day 6 swap incorrect');
   if(claimed===6&&!got.state.pendingCats.includes('login-cat'))throw Error('Mystery cat was not saved as pending');
   if(!await page.locator('dialog .login-close').evaluate(el=>document.activeElement===el))throw Error('Focus lost after claim');
   await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  }
  await page.evaluate(()=>{window.testLoginState({claimed:0,lastDay:null,lastAt:0,pendingCats:[],seenDay:null});window.loginController.renderLoginButton();document.querySelector('#home-login').hidden=false;});
  await page.locator('#home-login').click();await page.locator('dialog .login-close').click();await page.locator('dialog').waitFor({state:'detached'});
  if(await page.evaluate(()=>window.readLoginState().claimed)!==0)throw Error('Close claimed a gift');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Login gift: 10 mobile states, preview claim, all 7 actual grant paths, same-day lock, focus, Escape and close passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
