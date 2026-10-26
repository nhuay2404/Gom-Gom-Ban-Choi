const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('playwright');sharp.cache(false);
(async()=>{
 const root=path.resolve(__dirname,'../..'),dir=path.join(root,'game/assets/img/idle-reward'),out=path.join(root,'output/idle-reward-kit');await fs.mkdir(out,{recursive:true});
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 for(const a of manifest.assets){
  if(a.file.endsWith('.svg'))await fs.writeFile(path.join(dir,a.png??a.file.replace('.svg','.png')),await sharp(path.join(dir,a.file)).png().toBuffer());
  if(a.source)await fs.writeFile(path.join(dir,a.file),await sharp(path.join(dir,a.source)).resize(a.width??512,a.height??512,{fit:'contain',background:'#0000'}).png().toBuffer());
 }
 const metadata=await sharp(path.join(dir,'icon-video.png')).metadata();if(!metadata.hasAlpha)throw Error('RV icon missing alpha');
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1120,height:1000},deviceScaleFactor:1});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await page.goto('http://127.0.0.1:4400/idle-reward-kit.html');await page.locator('.asset').last().waitFor();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(out,'idle-reward-overview.png'),fullPage:true});
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   for(const amount of [125,12345]){
    await page.locator(`[data-amount="${amount}"]`).click();
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.store-choices button')].some(e=>e.scrollWidth>e.clientWidth)))throw Error(`Overflow: ${width}, ${amount}`);
    await page.locator('.phone').screenshot({path:path.join(out,`idle-reward-${width}-${amount}.png`)});
   }
  }
  await page.locator('[data-reset]').click();await page.locator('[data-choice="ad"]').click();await page.waitForFunction(()=>document.querySelector('.toast').textContent.includes('188'),null,{timeout:9000});
  await page.locator('[data-reset]').click();await page.locator('[data-choice="ad"]').click();await page.locator('[data-skip]').click();if(!(await page.locator('.toast').textContent()).includes('125'))throw Error('Skip granted wrong amount');
  await page.locator('[data-reset]').click();await page.locator('[data-choice="claim"]').click();if(!(await page.locator('.toast').textContent()).includes('125'))throw Error('Normal claim incorrect');
  await page.locator('[data-reset]').click();await page.locator('.idle-reward-close').click();if(!(await page.locator('.toast').textContent()).includes('No coins'))throw Error('Close should not grant coins');
  // Exercise the real idle-coins controller and core math with an isolated wallet.
  await page.route('**/app/shared.js',r=>r.fulfill({contentType:'text/javascript',body:`
   let deco;
   window.resetIdle=()=>{deco={coins:0,cats:['orange'],idleAt:{orange:Date.now()-3600000}};window.testCoins=0};window.resetIdle();
   export const $=id=>document.getElementById(id);
   export const getDeco=()=>deco;
   export const setDeco=v=>{deco=v;window.testCoins=v.coins};
   export const refreshWallet=()=>{};export const noteEvent=()=>{};export const showToast=()=>{};
   export const ask=({title,body,choices,className})=>new Promise(resolve=>{const d=document.createElement('dialog');d.className='level-dialog store-dialog '+className;d.innerHTML='<h2>'+title+'</h2>'+body+'<div class="store-choices">'+choices.map(c=>'<button class="pill-button '+c.style+'" data-choice="'+c.id+'">'+c.label+'</button>').join('')+'</div>';d.onclick=e=>{const b=e.target.closest('[data-choice]');if(b)d.close(b.dataset.choice)};d.onclose=()=>{d.remove();resolve(d.returnValue||null)};document.body.append(d);d.showModal()});
  `}));
  for(const [url,body] of [
   ['**/app/ads.js',"export const adReady=()=>window.testAdReady!==false;export const showRewarded=async()=>window.testWatched===true;"],
   ['**/menu/context.js','export const levelsCleared=()=>100;'],
   ['**/menu/deco-panel.js','export const decoLocked=false,decoPop=null;export const renderDeco=()=>{};'],
   ['**/menu/room.js','export const room3d=null;'],
   ['**/ui/sound.mjs','export const playSound=()=>{};']
  ])await page.route(url,r=>r.fulfill({contentType:'text/javascript',body}));
  await page.evaluate(async()=>{
   Date.now=()=>1800000000000;
   document.querySelector('main').remove();
   document.body.insertAdjacentHTML('beforeend','<button id="idle-coin" class="idle-coin" data-breed="orange">Collect</button><div class="fh-coins"><span id="deco-coins">0</span></div>');
   await Promise.all(['./ui/play/base.css','./ui/shared/base.css','./ui/shared/store.css','./ui/shared/idle-reward.css'].map(href=>new Promise(resolve=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.onload=resolve;document.head.append(l)})));
   await import('./menu/idle-coins.js');
  });
  let base;
  for(const scenario of ['normal','watched','skipped','close','escape']){
   await page.evaluate(s=>{window.resetIdle();window.testWatched=s==='watched';},scenario);
   await page.locator('#idle-coin').click();
   await page.locator('dialog.idle-claim[open]').waitFor();
   base=Number((await page.locator('dialog .idle-claim-total').textContent()).replace(/\D/g,''));
   if(!base)throw Error('Live prompt has no pending coins');
   if(scenario==='normal')await page.locator('dialog').screenshot({path:path.join(out,'idle-reward-live.png')});
   if(scenario==='escape')await page.keyboard.press('Escape');
   else if(scenario==='close')await page.locator('dialog .idle-reward-close').click();
   else await page.locator(`dialog [data-choice="${scenario==='normal'?'claim':'ad'}"]`).click();
   await page.locator('dialog.idle-claim').waitFor({state:'detached'});
   const expected=['close','escape'].includes(scenario)?0:scenario==='watched'?base+Math.round(base*.5):base;
   await page.waitForFunction(expected=>window.testCoins===expected,expected,{timeout:3000});
  }
  await page.evaluate(()=>{window.resetIdle();window.testAdReady=false});
  await page.locator('#idle-coin').click();await page.waitForFunction(()=>window.testCoins>0);
  if(await page.locator('dialog.idle-claim').count())throw Error('Unavailable RV should not show video prompt');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Idle reward: alpha, 4 mobile layouts, preview flows, live watched/skipped/normal/close/Escape/no-ad payouts passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
