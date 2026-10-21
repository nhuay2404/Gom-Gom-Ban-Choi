// Deterministic native artwork: generate the 47 matching silhouettes from shared quarter geometry.
// PNG rasterization is optional: node tools/export/build-syrup-atlas.mjs <absolute sharp module path>
import { writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { SYRUP_MASKS } from '../../game/ui/syrup-autotile.mjs';
const output = new URL('../../game/assets/img/board/', import.meta.url);
const SIZE = 128;
const base = '#f27fa2';
const material = (await readFile(new URL('syrup-atlas-material.png', output))).toString('base64');
const mirrors = ['', 'translate(128 0) scale(-1 1)', 'translate(128 128) scale(-1 -1)', 'translate(0 128) scale(1 -1)'];
function quarter(n, w, diagonal, corner) {
  const outer = !n && !w;
  const inner = n && w && !diagonal;
  // Exposed edges are inset by 8 px. The concave arc ends at that SAME inset
  // on the connected neighbor, so a hole never acquires little disconnected hooks.
  const shape = outer ? 'M64 8H30Q8 8 8 30V64H64Z'
    : inner ? 'M8 0H64V64H0V8Q8 8 8 0Z'
    : !n ? 'M0 8H64V64H0Z'
    : !w ? 'M8 0H64V64H8Z' : 'M0 0H64V64H0Z';
  const horizontal = !n && !outer ? 'M0 8H64' : '';
  const vertical = !w && !outer ? 'M8 0V64' : '';
  const curve = outer ? 'M8 64V30Q8 8 30 8H64' : inner ? 'M0 8Q8 8 8 0' : '';
  // Use world-facing normals, not the quarter number: both halves of a side
  // must carry exactly the same rim color at their shared endpoint.
  const horizontalTone = corner < 2 ? '#ffd3df' : '#ca477b';
  const verticalTone = corner === 0 || corner === 3 ? '#f8abc4' : '#dd658e';
  const stroke = (d, tone) => !d ? '' : `<path d="${d}" fill="none" stroke="${tone}" stroke-width="14"/><path d="${d}" fill="none" stroke="#b93a70" stroke-width="3" opacity=".6"/>`;
  const gradientId = `rim${corner}`;
  const gradientAxis = inner ? 'x1="8" y1="0" x2="0" y2="8"' : 'x1="8" y1="30" x2="30" y2="8"';
  const edge = `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" ${gradientAxis}><stop stop-color="${verticalTone}"/><stop offset="1" stop-color="${horizontalTone}"/></linearGradient>`
    + stroke(horizontal, horizontalTone) + stroke(vertical, verticalTone) + stroke(curve, `url(#${gradientId})`);
  const highlight = !outer ? '' : corner === 0
    ? '<path d="M18 33C18 23 30 17 42 19C48 21 31 28 25 36C21 40 17 39 18 33Z" fill="#ffe7e9" opacity=".9"/><ellipse cx="49" cy="20" rx="2.5" ry="2" fill="#ffeced"/>'
    : corner === 1 ? '<path d="M18 30Q22 18 34 19" fill="none" stroke="#ffe4ea" stroke-width="4" stroke-linecap="round" opacity=".7"/>'
    : corner === 2 ? '<path d="M18 32Q20 22 31 19" fill="none" stroke="#ffe4ea" stroke-width="3" stroke-linecap="round" opacity=".65"/>' : '';
  // Center shading fades completely before shared tile edges; every compatible edge is identical.
  return `<clipPath id="q${corner}"><path d="${shape}"/></clipPath><g clip-path="url(#q${corner})"><path d="${shape}" fill="${base}"/><g transform="${mirrors[corner]}"><g mask="url(#blendX)"><use href="#paint" mask="url(#blendY)"/></g></g>${edge}${highlight}</g>`;
}
function tile(mask, index) {
  const directions = [[1,8,128],[1,2,16],[4,2,32],[4,8,64]];
  const transforms = ['', 'translate(128 0) scale(-1 1)', 'translate(128 128) scale(-1 -1)', 'translate(0 128) scale(1 -1)'];
  const corners = directions.map(([n,w,d],i) => `<g transform="${transforms[i]}">${quarter(mask & n,mask & w,mask & d,i).replaceAll(`q${i}`,`t${index}q${i}`).replaceAll(`rim${i}`,`t${index}rim${i}`)}</g>`).join('');
  const has = flag => !!(mask & flag);
  // Two-pixel continuation strips give BOTH sprites the identical raster profile
  // at a shared side, including when a concave arc meets a straight edge.
  const strip = (side, start, end) => {
    const vertical = side === 'e' || side === 'w';
    const offset = side === 'e' || side === 's' ? 126 : 0;
    const rect = vertical ? `x="${offset}" y="${start}" width="2" height="${128-start-end}"` : `x="${start}" y="${offset}" width="${128-start-end}" height="2"`;
    let edges='';
    for(const [at,depth] of [[start,false],[128-end,true]]){
      if(!(depth?end:start))continue;
      const tone=vertical?(depth?'#ca477b':'#ffd3df'):(depth?'#dd658e':'#f8abc4');
      const position=depth?at-7:at;
      const rimRect=vertical?`x="${offset}" y="${position}" width="2" height="7"`:`x="${position}" y="${offset}" width="7" height="2"`;
      const linePosition=depth?at-1:at;
      const lineRect=vertical?`x="${offset}" y="${linePosition}" width="2" height="1"`:`x="${linePosition}" y="${offset}" width="1" height="2"`;
      edges+=`<rect ${rimRect} fill="${tone}"/><rect ${lineRect} fill="#b93a70" opacity=".6"/>`;
    }
    return `<rect ${rect} fill="${base}"/>${edges}`;
  };
  const guards = (has(1)?strip('n',has(8)&&has(128)?0:8,has(2)&&has(16)?0:8):'')
    +(has(2)?strip('e',has(1)&&has(16)?0:8,has(4)&&has(32)?0:8):'')
    +(has(4)?strip('s',has(8)&&has(64)?0:8,has(2)&&has(32)?0:8):'')
    +(has(8)?strip('w',has(1)&&has(128)?0:8,has(4)&&has(64)?0:8):'');
  const x=has(8)?2:0,y=has(1)?2:0,width=128-x-(has(2)?2:0),height=128-y-(has(4)?2:0);
  return `<g transform="translate(${index % 8 * SIZE} ${Math.floor(index / 8) * SIZE})"><clipPath id="body${index}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath><g clip-path="url(#body${index})">${corners}</g>${guards}</g>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768"><defs><linearGradient id="fadeX"><stop stop-color="black"/><stop offset=".16" stop-color="white"/><stop offset=".84" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><linearGradient id="fadeY" x2="0" y2="1"><stop stop-color="black"/><stop offset=".16" stop-color="white"/><stop offset=".84" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient><mask id="blendX"><rect width="128" height="128" fill="url(#fadeX)"/></mask><mask id="blendY"><rect width="128" height="128" fill="url(#fadeY)"/></mask><image id="paint" width="128" height="128" href="data:image/png;base64,${material}"/></defs>${SYRUP_MASKS.map(tile).join('')}</svg>`;
await writeFile(new URL('syrup-autotile.svg', output), svg);
await writeFile(new URL('syrup-autotile.json', output), JSON.stringify({ tileSize: SIZE, columns: 8, rows: 6, padding: 2, stride: 132, masks: SYRUP_MASKS }, null, 2));
if (process.argv[2]) {
  const sharp = createRequire(import.meta.url)(process.argv[2]);
  const raster = await sharp(Buffer.from(svg)).png().toBuffer();
  const packed = await Promise.all(SYRUP_MASKS.map(async (_, index) => ({
    input: await sharp(raster).extract({left:index % 8 * 128,top:Math.floor(index / 8) * 128,width:128,height:128}).extend({top:2,bottom:2,left:2,right:2,extendWith:'copy'}).png().toBuffer(),
    left:index % 8 * 132, top:Math.floor(index / 8) * 132,
  })));
  await sharp({create:{width:1056,height:792,channels:4,background:'#0000'}}).composite(packed).png().toFile(new URL('syrup-autotile.png', output).pathname.replace(/^\/(\w:)/,'$1'));
}
console.log(`Generated ${SYRUP_MASKS.length} syrup autotiles.`);
