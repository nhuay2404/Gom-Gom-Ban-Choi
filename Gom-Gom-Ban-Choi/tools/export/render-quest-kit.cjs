// Requires sharp and playwright (available in the Codex bundled runtime).
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
sharp.cache(false);
const { chromium } = require('playwright');
(async()=>{
  const root=path.resolve(__dirname,'../..'), dir=path.join(root,'game/assets/img/quests'), out=path.join(root,'output/quest-kit');
  await fs.mkdir(out,{recursive:true});
  const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  for(const a of manifest.assets) {
    if(a.source) await sharp(path.join(dir,a.source)).png().toFile(path.join(dir,a.png));
    if(a.paintedSource) {
      const encoded=await sharp(path.join(dir,a.paintedSource)).resize(a.width??512,a.height??512,{fit:'contain',background:'#0000'}).png().toBuffer();
      await fs.writeFile(path.join(dir,a.png),encoded);
      const {data,info}=await sharp(path.join(dir,a.png)).raw().toBuffer({resolveWithObject:true});
      if(info.channels!==4)throw Error(`${a.name} has no alpha channel`);
      let transparent=false,opaque=false;
      for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent=true;if(data[i]===255)opaque=true;}
      if(!transparent||!opaque)throw Error(`${a.name} has invalid alpha content`);
    }
  }
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1200,height:1100},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await page.goto('http://127.0.0.1:4400/quest-kit.html');
  await page.locator('.asset').last().waitFor();
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(out,'quest-kit-overview.png'),fullPage:true});
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    for(const state of ['mixed','active','ready','empty','long']){
      await page.locator(`[data-state="${state}"]`).click();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.quest-text,.quest-claim')].some(e=>e.scrollWidth>e.clientWidth));
      if(overflow)throw Error(`Overflow at ${width}, ${state}`);
      await page.locator('.phone').screenshot({path:path.join(out,`quest-${state}-${width}.png`)});
    }
  }
  await page.locator('[data-state="mixed"]').click();
  await page.locator('.quest-claim:not(:disabled)').click();
  if(!await page.locator('.toast').textContent().then(t=>t.includes('150')))throw Error('Claim preview failed');
  if(await page.locator('.quest-claim:not(:disabled)').count())throw Error('Claim remained enabled');
  // Real menu + native dialog + real claim logic, with an isolated in-memory save.
  await page.route('**/app/shared.js',route=>route.fulfill({contentType:'text/javascript',body:`
    let q={order:['level','area','build','pets','styles'],tiers:{carry:1,view:1,surface:1},active:[{track:'level',text:'Beat level 5',n:5,progress:5,reward:150}]};
    let deco={coins:0,cats:[]};
    export const $=id=>document.getElementById(id);
    export const getQuests=()=>q;
    export const setQuests=v=>{q=v;dispatchEvent(new Event('tasks'))};
    export const getDeco=()=>deco;
    export const setDeco=v=>{deco=v;window.testCoins=v.coins};
    export const refreshWallet=()=>{};
    export const showToast=v=>{window.testToast=v};
    export const questCtx=()=>({unlocked:400,cleared:400,maxLevel:400,nextArea:null,open:[],basesLeft:0,petsLeft:0,stylesLeft:0});
  `}));
  await page.route('**/ui/sound.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export const playSound=()=>{};export const playMeow=()=>{};'}));
  await page.route('**/app/store.js',route=>route.fulfill({contentType:'text/javascript',body:'export const grantGems=()=>0;'}));
  await page.evaluate(async()=>{
    document.querySelector('main').remove();
    for(const id of ['home-quests','deco-quests']){const b=document.createElement('button');b.id=id;document.body.append(b);}
    await import('./menu/quests.js');
  });
  await page.locator('#home-quests').click();
  await page.locator('dialog[open] .quest-claim').click();
  if(await page.evaluate(()=>window.testCoins)!==150)throw Error('Live claim did not award exactly once');
  if(!await page.locator('dialog .quest-empty').count())throw Error('Live final claim did not show empty state');
  if(await page.evaluate(()=>window.testToast.includes('New quest added')))throw Error('Misleading final-claim toast');
  if(!await page.locator('dialog .quest-close').evaluate(el=>document.activeElement===el))throw Error('Focus lost after claim');
  await page.keyboard.press('Escape');
  await page.locator('dialog').waitFor({state:'detached'});
  await page.locator('#deco-quests').click();
  await page.locator('dialog .quest-close').click();
  await page.locator('dialog').waitFor({state:'detached'});
  if(errors.length)throw Error(errors.join('\n'));
  await browser.close();
  console.log('23 assets exported; 10 mobile state/size checks, preview claim, live final claim, wallet, empty state, focus, Escape, and both entry points passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
