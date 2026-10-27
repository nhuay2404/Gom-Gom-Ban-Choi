import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=`${root}game/assets/img/idle-reward`;
mkdirSync(out,{recursive:true});
const assets=[];
for(const [name,from] of Object.entries({'icon-pet.png':'quests/icon-pets.png','icon-coin.png':'shop/coin.png','coin-stack.png':'shop/coin-stack.png','panel.png':'result/panel.png','close.svg':'quests/close.svg'})){
  copyFileSync(`${root}game/assets/img/${from}`,`${out}/${name}`);
  assets.push({name:name.replace(/\.(png|svg)$/,''),file:name,reusedFrom:from});
}
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#ffe783"/><stop offset=".52" stop-color="#ffc64e"/><stop offset="1" stop-color="#f2a037"/></linearGradient><linearGradient id="green" x2="0" y2="1"><stop stop-color="#a4e773"/><stop offset=".52" stop-color="#6bc74e"/><stop offset="1" stop-color="#43ac42"/></linearGradient><linearGradient id="orange" x2="0" y2="1"><stop stop-color="#ffac81"/><stop offset=".5" stop-color="#f78057"/><stop offset="1" stop-color="#df6540"/></linearGradient></defs>${body}</svg>`;
writeFileSync(`${out}/button-video.svg`,svg(320,100,'<rect x="3" y="8" width="314" height="89" rx="22" fill="#87451e"/><rect x="3" y="3" width="314" height="89" rx="22" fill="url(#gold)" stroke="#87451e" stroke-width="3"/><rect x="8" y="8" width="304" height="79" rx="17" fill="none" stroke="#fff0b2" stroke-width="3"/><path d="M18 18H302" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>'));
writeFileSync(`${out}/button-claim.svg`,svg(320,64,'<rect x="2" y="5" width="316" height="57" rx="18" fill="#397a32"/><rect x="2" y="2" width="316" height="57" rx="18" fill="url(#green)" stroke="#397a32" stroke-width="2"/><rect x="6" y="6" width="308" height="49" rx="14" fill="none" stroke="#d6f7a5" stroke-width="2"/>'));
writeFileSync(`${out}/bonus-badge.svg`,svg(90,44,'<rect x="3" y="5" width="84" height="36" rx="17" fill="#a14d20"/><rect x="3" y="2" width="84" height="36" rx="17" fill="url(#orange)" stroke="#a75621" stroke-width="2"/><path d="M14 10Q15 7 23 7H70" stroke="#ffe6a8" stroke-width="3" fill="none" stroke-linecap="round"/>'));
assets.push({name:'button-claim',file:'button-claim.svg',png:'button-claim.png',width:320,height:64,slice:[22,22,22,22]}, {name:'button-video',file:'button-video.svg',png:'button-video.png',width:320,height:100,slice:[26,26,26,26]},{name:'bonus-badge',file:'bonus-badge.svg',png:'bonus-badge.png',width:90,height:44},{name:'icon-video',file:'icon-video.png',source:'painted/icon-video.png',width:512,height:512});
writeFileSync(`${out}/manifest.json`,JSON.stringify({version:4,assets},null,2));
console.log(`${assets.length} idle reward assets prepared.`);
