const fs = require('node:fs/promises');
const sharp = require('C:/Users/CPU13410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs');
(async()=>{
 const out='output/foliage-cards';
 const specs=[['canopy',3,2],['hydrangea',3,3],['lavender',4,4]];
 const manifest={source:'Original in-game textures, converted to PNG without repainting',cards:[]};
 for(const [name,cols,rows] of specs){
  const src='game/assets/img/deco/'+name+'.webp';
  const meta=await sharp(src).metadata();
  await sharp(src).png().toFile(out+'/'+name+'-sheet.png');
  await fs.mkdir(out+'/'+name,{recursive:true});
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const left=Math.round(col*meta.width/cols),top=Math.round(row*meta.height/rows);
   const width=Math.round((col+1)*meta.width/cols)-left,height=Math.round((row+1)*meta.height/rows)-top;
   const file=name+'/'+name+'-r'+(row+1)+'-c'+(col+1)+'.png';
   await sharp(src).extract({left,top,width,height}).png().toFile(out+'/'+file);
   manifest.cards.push({file,row:row+1,column:col+1,width,height});
  }
 }
 await fs.writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
 console.log('Exported '+manifest.cards.length+' individual PNG cards and 3 original atlases');
})();
