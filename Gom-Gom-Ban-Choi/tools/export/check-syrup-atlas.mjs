// Exhaustive seam check for compatible 3x4 neighborhoods, including concave corners.
import { createRequire } from 'node:module';
import { SYRUP_MASKS, syrupMaskAt } from '../../game/ui/syrup-autotile.mjs';
const sharp = createRequire(import.meta.url)(process.argv[2]);
const {data,info} = await sharp(new URL('../../game/assets/img/board/syrup-autotile.png', import.meta.url).pathname.replace(/^\/(\w:)/,'$1')).raw().toBuffer({resolveWithObject:true});
const pixel=(mask,x,y)=>{
  const slot=SYRUP_MASKS.indexOf(mask), offset=((Math.floor(slot/8)*132+2+y)*info.width+slot%8*132+2+x)*4;
  return data.subarray(offset,offset+4);
};
let maxAlpha=0,maxPremultiplied=0,pairs=0,worst;
for(let bits=0;bits<4096;bits++){
  const has=(r,c)=>r>=0&&r<3&&c>=0&&c<4&&!!(bits&(1<<(r*4+c)));
  if(!has(1,1)||!has(1,2))continue;
  for(const vertical of [false,true]){ const at=vertical?((r,c)=>has(c,r)):has; const a=syrupMaskAt(1,1,at),b=vertical?syrupMaskAt(2,1,at):syrupMaskAt(1,2,at);
  for(let p=0;p<128;p++){
    const left=vertical?pixel(a,p,127):pixel(a,127,p),right=vertical?pixel(b,p,0):pixel(b,0,p);
    maxAlpha=Math.max(maxAlpha,Math.abs(left[3]-right[3]));
    for(let channel=0;channel<3;channel++){ const delta=Math.abs(left[channel]*left[3]-right[channel]*right[3])/255;if(delta>maxPremultiplied){maxPremultiplied=delta;worst={a,b,p,left:[...left],right:[...right]};}}
  }
  pairs++; }
}
console.log(JSON.stringify({pairs,maxAlpha,maxPremultiplied,worst}));
if(maxAlpha>8||maxPremultiplied>12)process.exitCode=1;
