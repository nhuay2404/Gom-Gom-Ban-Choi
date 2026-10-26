import {mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=`${root}game/assets/img/login-gift`;
mkdirSync(out,{recursive:true});const assets=[];
for(const [file,from] of Object.entries({'banner.png':'idle-reward/banner.png','hero-cat.png':'result/win-cat.png','icon-login.png':'home/icon-login.png','icon-coin.png':'home/icon-coin.png','moves.png':'play/booster-moves.png','hammer.png':'play/booster-hammer.png','swap.png':'play/booster-swap.png','heart-cushion.jpg':'deco/gift-catbed-heart.jpg','mystery-cat.png':'quests/icon-pets.png','check.png':'quests/check.png','close.svg':'quests/close.svg'})){
 copyFileSync(`${root}game/assets/img/${from}`,`${out}/${file}`);assets.push({name:file.replace(/\.[^.]+$/,''),file,reusedFrom:from});
}
for(const file of ['card-standard.svg','card-standard.png','card-today.svg','card-today.png','card-exclusive.svg','card-exclusive.png','card-collected.svg','card-collected.png','card-day7.svg','card-day7.png','button-claim.svg','button-claim.png','button-close.svg','button-close.png'])rmSync(`${out}/${file}`,{force:true});
writeFileSync(`${out}/manifest.json`,JSON.stringify({version:4,assets},null,2));console.log(`${assets.length} login gift assets prepared.`);
