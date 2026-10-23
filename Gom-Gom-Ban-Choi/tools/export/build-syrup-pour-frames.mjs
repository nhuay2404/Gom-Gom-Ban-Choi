import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const root='Gom-Gom-Ban-Choi', out=root+'/output/syrup-flow';
await fs.mkdir(out+'/frames',{recursive:true});
await fs.mkdir(out+'/bottle-frames',{recursive:true});
const tile=await sharp(root+'/game/assets/img/board/syrup-autotile.png').extract({left:2,top:2,width:128,height:128}).ensureAlpha().raw().toBuffer();
const W=192,H=320,N=120,cols=12,rows=10;
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
const lerp=(a,b,t)=>a+(b-a)*t;
const body=await sharp(root+'/game/assets/img/board/syrup-goal-bottle.png').extract({left:0,top:310,width:1254,height:944}).resize(140,106).png().toBuffer();
const cap=await sharp(root+'/game/assets/img/board/syrup-goal-bottle.png').extract({left:390,top:55,width:470,height:270}).resize(50,29).png().toBuffer();
const opening=Buffer.from('<svg width="192" height="320"><ellipse cx="95" cy="186" rx="17" ry="4" fill="#9c2851"/><path d="M78 186 Q95 194 112 186" fill="none" stroke="#ffadc9" stroke-width="2"/></svg>');
const rim=Buffer.from('<svg width="192" height="320"><path d="M78 187 Q95 195 112 187" fill="none" stroke="#ffadc9" stroke-width="3"/></svg>');
const frames=[],combined=[],meta=[],fullFrames=[];
for(let i=0;i<N;i++){
 const t=Math.min(1,i/83),stretch=ease((t-.16)/.30),drain=ease((t-.30)/.70),collapse=ease((drain-.45)/.55);
 const top=lerp(16,187,drain),bottom=lerp(144,187,stretch),waist=lerp(122,top,stretch),cx=96;
 const data=Buffer.alloc(W*H*4);
 const sx=1+.035*Math.sin(t/.22*Math.PI*2)*(1-ease(t/.25));
 for(let y=Math.ceil(top);y<bottom;y++){
  const u=(y-top)/Math.max(1,bottom-top),neck=ease((y-waist)/Math.max(1,bottom-waist));
  // Keep a cylindrical stream for the last third of its length; rounded leading lip.
  const streamHalf=7;
  const shoulder=ease(neck/.62)*stretch;
  let half=lerp(lerp(64*sx,streamHalf,collapse),streamHalf,shoulder);
  const tipDepth=bottom-y;
  if(tipDepth<6)half*=lerp(1,Math.sqrt(Math.max(0,1-Math.pow(1-tipDepth/6,2))),stretch);
  if(half<.1)continue;
  const sway=2*Math.sin(u*5-t*8)*Math.sin(Math.PI*u)*stretch*(1-collapse);
  for(let x=Math.max(0,Math.ceil(cx+sway-half));x<Math.min(W,cx+sway+half);x++){
   const sourceX=Math.min(127,Math.max(0,Math.floor((x-cx-sway+half)/(2*half)*128)));
   const sourceY=Math.min(127,Math.floor(lerp(u*127,12+u*96,shoulder*stretch)));
   const from=(sourceY*128+sourceX)*4,to=(y*W+x)*4;
   for(let k=0;k<4;k++)data[to+k]=tile[from+k];
  }
 }
 const png=await sharp(data,{raw:{width:W,height:H,channels:4}}).png().toBuffer();
 const name='frame-'+String(i).padStart(3,'0')+'.png';await fs.writeFile(out+'/frames/'+name,png);
 frames.push({input:png,left:i%cols*W,top:Math.floor(i/cols)*H});
 // The cap travels above the neck only after the syrup has disappeared.
 const close=ease((i-85)/23), settle=i>108?Math.sin((i-108)/11*Math.PI*2)*2.5*(1-(i-108)/11):0;
 const capX=Math.round(lerp(139,71,close));
 const capY=Math.round(lerp(149,157,close)+settle-18*Math.sin(Math.PI*close));
 const capImage=await sharp(cap).rotate(24*(1-close),{background:'#00000000'}).png().toBuffer();
 const composite=await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).composite([{input:body,left:26,top:185},{input:opening},{input:png},{input:rim},{input:capImage,left:capX,top:capY}]).png().toBuffer();
 await fs.writeFile(out+'/bottle-frames/'+name,composite);
 fullFrames.push({input:composite,left:i%cols*W,top:Math.floor(i/cols)*H});
 combined.push(composite);meta.push({filename:name,frame:{x:i%cols*W,y:Math.floor(i/cols)*H,w:W,h:H},duration:1000/60});
}
await sharp({create:{width:W*cols,height:H*rows,channels:4,background:'#00000000'}}).composite(frames).png().toFile(out+'/syrup-pour-60fps.png');
await sharp({create:{width:W*cols,height:H*rows,channels:4,background:'#00000000'}}).composite(fullFrames).png().toFile(out+'/syrup-bottle-close-60fps.png');
await fs.writeFile(out+'/syrup-pour-60fps.json',JSON.stringify({meta:{image:'syrup-pour-60fps.png',fps:60,durationMs:2000,liquidEndFrame:83,capCloseStartFrame:85,capSeatedFrame:108,combinedImage:'syrup-bottle-close-60fps.png',columns:cols,rows,frameWidth:W,frameHeight:H,source:'game/assets/img/board/syrup-autotile.png',mask:0,pivot:{x:96,y:187}},frames:meta},null,2));
const selected=[0,22,34,46,58,70,80,85,92,100,108,119];
const panels=[];
for(let k=0;k<selected.length;k++){
 const i=selected[k];const label=Buffer.from(`<svg width="192" height="350"><text x="12" y="338" font-family="Arial" font-size="14" fill="#663449">Frame ${i} · ${Math.round(i/60*1000)} ms</text></svg>`);
 const p=await sharp({create:{width:W,height:350,channels:4,background:'#fbeaf1'}}).composite([{input:combined[i],left:0,top:0},{input:label}]).png().toBuffer();panels.push({input:p,left:k%4*W,top:Math.floor(k/4)*350});
}
await sharp({create:{width:768,height:1050,channels:4,background:'#fbeaf1'}}).composite(panels).png().toFile(out+'/sprite-contact-sheet.png');
await fs.writeFile(out+'/preview.html',`<!doctype html><meta charset="utf-8"><title>Siro dâu · Rót và đóng nắp</title><style>body{background:#fbeaf1;color:#663449;font:16px system-ui;max-width:800px;margin:24px auto}#stage{width:192px;height:320px;background-image:url(syrup-bottle-close-60fps.png);transform:scale(1.4);transform-origin:top left;margin:20px 0 145px}button,input{margin:12px}img{width:100%}</style><h1>Siro dâu · Rót và đóng nắp</h1><p>120 frame · 60 FPS · 2 giây · Sprite tile và bình gốc trong game.</p><button id="play">Phát / Dừng</button><input id="seek" type="range" min="0" max="119" value="0"><span id="label"></span><div id="stage"></div><p><a href="syrup-bottle-close-60fps.png">Sprite sheet toàn bộ hiệu ứng</a> · <a href="syrup-pour-60fps.png">Lớp siro riêng</a> · <a href="syrup-pour-60fps.json">Tọa độ frame JSON</a></p><img src="sprite-contact-sheet.png"><script>let running=true,start=performance.now();const seek=document.querySelector('#seek');function draw(i){document.querySelector('#stage').style.backgroundPosition=(-(i%12)*192)+'px '+(-Math.floor(i/12)*320)+'px';seek.value=i;document.querySelector('#label').textContent='Frame '+i+' / 119 · '+(i<84?'Siro chảy':i<109?'Đậy nắp':'Nắp khớp vào bình')}document.querySelector('#play').onclick=()=>{running=!running;start=performance.now()-Number(seek.value)/60*1000};seek.oninput=()=>{running=false;draw(Number(seek.value))};function tick(now){if(running)draw(Math.min(119,Math.floor(((now-start)%2600)/1000*60)));requestAnimationFrame(tick)}requestAnimationFrame(tick)</script>`);
console.log('Exported 120 liquid frames + 120 bottle frames, two atlases, JSON and preview.');

