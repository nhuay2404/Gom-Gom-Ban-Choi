import {mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=`${root}game/assets/img/login-gift`;
mkdirSync(out,{recursive:true});const assets=[];
for(const [file,from] of Object.entries({'hero-cat.png':'result/win-cat.png','icon-login.png':'home/icon-login.png','icon-coin.png':'home/icon-coin.png','moves.png':'play/booster-moves.png','hammer.png':'play/booster-hammer.png','swap.png':'play/booster-swap.png','heart-cushion.jpg':'deco/gift-catbed-heart.jpg','check.png':'quests/check.png','close.svg':'quests/close.svg'})){
 copyFileSync(`${root}game/assets/img/${from}`,`${out}/${file}`);assets.push({name:file.replace(/\.[^.]+$/,''),file,reusedFrom:from});
}
for(const file of ['button-claim.svg','button-later.svg','badge-premium.svg'])assets.push({name:file.replace(/\.svg$/,''),file,generated:true});
const rewardSources=['play/booster-moves.png','home/icon-coin.png','deco/gift-catbed-heart.jpg','play/booster-hammer.png','home/icon-coin.png','play/booster-swap.png','user-reference/crowned-gray-cat.png'];
for(let day=1;day<=7;day++){
 if(day===3)continue; // Day 3 reuses the exact in-game Heart cushion image already listed above.
 const file=`reward-day${day}.png`;
 assets.push({name:`Day ${day} reward · 3D`,file,basedOn:rewardSources[day-1]});
}
for(const file of ['banner.png','mystery-cat.png','card-standard.svg','card-standard.png','card-today.svg','card-today.png','card-exclusive.svg','card-exclusive.png','card-collected.svg','card-collected.png','card-day7.svg','card-day7.png','button-atlas.png','button-claim.png','button-close.svg','button-close.png'])rmSync(`${out}/${file}`,{force:true});
writeFileSync(`${out}/manifest.json`,JSON.stringify({version:5,assets},null,2));console.log(`${assets.length} login gift assets prepared.`);
