// Editable quest UI sources. Run with Node; SVG output needs no dependencies.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = `${root}game/assets/img/quests`;
mkdirSync(out, { recursive: true });
const assets = [];
const defs = `<defs><linearGradient id="cream" x2="0" y2="1"><stop stop-color="#fffdf1"/><stop offset="1" stop-color="#ffe7ad"/></linearGradient><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#ffdc67"/><stop offset=".5" stop-color="#ffba36"/><stop offset="1" stop-color="#e78824"/></linearGradient><linearGradient id="green" x2="0" y2="1"><stop stop-color="#a7e96b"/><stop offset=".5" stop-color="#70cf51"/><stop offset="1" stop-color="#39a649"/></linearGradient><linearGradient id="muted" x2="0" y2="1"><stop stop-color="#eee3c9"/><stop offset="1" stop-color="#cbb78c"/></linearGradient><linearGradient id="red" x2="0" y2="1"><stop stop-color="#ffac80"/><stop offset="1" stop-color="#e85d4f"/></linearGradient></defs>`;
function save(name, w, h, body, extra = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${defs}<g stroke="#713518" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
  writeFileSync(`${out}/${name}.svg`, svg);
  assets.push({ name, source: `${name}.svg`, png: `${name}.png`, width: w, height: h, ...extra });
}
function surface(name, w, h, fill, edge = '#713518', radius = 22, extra = '') {
  save(name,w,h,`<rect x="4" y="7" width="${w-8}" height="${h-11}" rx="${radius}" fill="#a66429"/><rect x="4" y="3" width="${w-8}" height="${h-11}" rx="${radius}" fill="url(#${fill})" stroke="${edge}"/><rect x="10" y="9" width="${w-20}" height="${h-23}" rx="${radius-6}" fill="none" stroke="#fff8d9" stroke-opacity=".8" stroke-width="3"/>${extra}`, { slice: [24,24,24,24] });
}
surface('panel',480,640,'cream','#713518',36);
surface('card-active',400,120,'cream');
surface('card-ready',400,120,'cream','#56883a');
surface('card-complete',400,120,'muted');
surface('button-claim',200,76,'green','#315d25',30);
surface('button-pressed',200,76,'green','#315d25',30,'<rect x="5" y="4" width="190" height="61" rx="29" fill="#19451b" opacity=".2" stroke="none"/>');
surface('button-disabled',200,76,'muted','#a18a5c',30);
surface('button-secondary',200,76,'gold','#713518',30);
surface('progress-track',300,32,'muted','#a67c40',14);
surface('progress-fill',300,32,'green','#477a2b',14);
save('close',80,80,'<circle cx="40" cy="43" r="34" fill="#a94427"/><circle cx="40" cy="37" r="33" fill="url(#red)"/><path d="M21 20Q26 12 38 12" stroke="#ffeacb" fill="none"/><path d="M29 26 51 48M51 26 29 48" stroke="#fff9df" stroke-width="8"/>');
save('badge',64,64,'<circle cx="32" cy="33" r="27" fill="url(#red)"/><circle cx="32" cy="31" r="21" fill="none" stroke="#fff5ce" stroke-width="2"/>');
// Painted replacements are versioned source art, preserved across rebuilds.
for (const name of ["icon-level","icon-area","icon-build","icon-pets","icon-styles","check","empty","sparkle"]) {
  const file = name + '.png';
  copyFileSync(out + '/painted/' + file, out + '/' + file);
  assets.push({name,png:file,paintedSource:'painted/' + file,width:512,height:512,artstyle:'glossy hand-painted 2.5D, cocoa outline, ivory upper-left highlights'});
}
for (const [name, src] of [['icon-quest','home/icon-quest.png'],['icon-coin','shop/coin.png']]) {
  copyFileSync(`${root}game/assets/img/${src}`,`${out}/${name}.png`);
  assets.push({name,png:`${name}.png`,reusedFrom:src});
}
writeFileSync(`${out}/manifest.json`,JSON.stringify({version:4,style:'Gom Gom warm cream / honey gold / cocoa / leaf green',alpha:true,assets},null,2));
console.log(`Quest kit: ${assets.length} assets written to ${out}`);
