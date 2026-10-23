const {chromium}=require('C:/Users/CPU13410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});const page=await browser.newPage({viewport:{width:420,height:580}});
await page.route('**/syrup-proof',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><link rel="stylesheet" href="/ui/play/base.css"><link rel="stylesheet" href="/ui/play/board-grid.css"><link rel="stylesheet" href="/ui/play/skin.css"><style>body{margin:0;background:#fff9ef}.board{--tilt:10deg;--c:90px;--gap:4px;--pad:0px;--rad:12px;--cols:3;--rows:3;width:280px;height:280px;position:absolute;left:60px;top:70px;transform:rotateX(10deg);background:transparent!important;box-shadow:none!important}.cell{width:90px;height:90px}.cat{width:90px;height:90px}</style><div class="board"><button class="cell locked" id="source" data-syrup-draining="pending"></button>${'<button class="cell"></button>'.repeat(8)}</div>`}));
await page.goto('http://127.0.0.1:4400/syrup-proof');
await page.evaluate(async()=>{const {addArt}=await import('/ui/cat-art.mjs');const fx=await import('/ui/syrup-pour.mjs');const source=document.querySelector('#source');addArt(source,'malamute');await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));window.run=()=>new Promise(started=>{const box=source.getBoundingClientRect();window.done=fx.playSyrupFrames(box,()=>{window.cancelReveal=fx.revealSyrupCat(source);window.restore=fx.suppressSyrupBackdrop(box);started()});});});
await page.clock.install();await page.evaluate(()=>window.run());
for(const ms of [350,650,950,1250,1600]){
 await page.evaluate(ms=>document.getAnimations().forEach(a=>{const f=a.effect.getKeyframes();if(f.some(k=>'backgroundPosition' in k || 'clipPath' in k)){a.pause();a.currentTime=ms}}),ms);
 await page.screenshot({path:'output/syrup-flow/progressive-'+ms+'.png'});
 console.log(ms,await page.evaluate(()=>({visibility:getComputedStyle(document.querySelector('.cat')).visibility,clip:getComputedStyle(document.querySelector('.cat')).clipPath,backdrops:[...document.querySelectorAll('[data-syrup-backdrop]')].every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)')})));
}
await browser.close();})().catch(e=>{console.error(e);process.exitCode=1});

