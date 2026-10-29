const fs = require('node:fs/promises');
const sharp = require('C:/Users/CPU13410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
const root = 'E:/GitHub/Gom-Gom-Ban-Choi/Gom-Gom-Ban-Choi';
const generated = 'C:/Users/CPU13410/.codex/generated_images/01a15d9d-53be-7260-968a-d59c1116962e';
const sources = [
  `${root}/game/assets/img/home/icon-cardboard-front.png`,
  `${generated}/exec-18baed73-8840-45e4-9a8f-8c695644f109.png`,
  `${generated}/exec-4739f980-06ea-4a0e-bc5b-befa100a3ae0.png`,
  `${generated}/exec-6eb19ae7-5eeb-4aac-9437-b3662425025a.png`,
];
(async () => {
  const dir = `${root}/game/assets/img/board/cardboard-opening`;
  await fs.mkdir(dir, {recursive:true});
  const buffers = [];
  for (let i=0;i<sources.length;i++) {
    const buffer = await sharp(sources[i]).resize(512,512).png().toBuffer();
    await fs.writeFile(`${dir}/frame-${i}.png`,buffer);
    buffers.push(buffer);
  }
  await sharp({create:{width:2048,height:512,channels:4,background:'#00000000'}})
    .composite(buffers.map((input,i)=>({input,left:i*512,top:0})))
    .png().toFile(`${dir}/spritesheet.png`);
  await fs.writeFile(`${dir}/spritesheet.json`,JSON.stringify({image:'spritesheet.png',width:2048,height:512,frameWidth:512,frameHeight:512,frames:[{file:'frame-0.png',state:'closed',duration:400},{file:'frame-1.png',state:'peel-start',duration:180},{file:'frame-2.png',state:'peel-lid',duration:180},{file:'frame-3.png',state:'open',duration:650}],loop:false},null,2));
  for(let i=0;i<4;i++) {
    const meta=await sharp(`${dir}/frame-${i}.png`).metadata();
    if(meta.width!==512||meta.height!==512||!meta.hasAlpha)throw Error(`Invalid frame ${i}`);
  }
  console.log('4 transparent 512x512 frames and 2048x512 sheet exported.');
})();
