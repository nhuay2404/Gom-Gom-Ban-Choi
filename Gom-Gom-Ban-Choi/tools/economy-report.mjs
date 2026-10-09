// Báo cáo kinh tế theo stage: chạy `npm run economy` sau khi sửa game/gameplay/economy.mjs.
// In bảng ra màn hình và ghi docs/economy-report.md. Mỗi stage = 10 màn:
//   - Xu nhận trong stage (thắng mỗi màn một lần; stage 1 cộng thêm START_COINS)
//   - Đồ trang trí MỞ trong stage (theo khu mở + lock) và tổng giá: món gốc / kiểu khác / tường-sàn
//   - Luỹ kế: tổng xu đã nhận so với tổng giá mọi món đã mở tới hết stage đó (đủ mua bao nhiêu %)
import { writeFileSync, mkdirSync } from 'node:fs';
import { START_COINS, BOOSTER_PRICE, COIN_PACKS } from '../game/gameplay/economy.mjs';
import { levelReward } from '../game/gameplay/progression.mjs';
import { LEVELS } from '../game/gameplay/levels.mjs';
import { CATALOG, ZONES, GARDEN_EXPANSION } from '../game/deco/deco-data.mjs';

const STAGE = 10, stages = Math.ceil(LEVELS.length / STAGE);
const stageOfLevel = level => Math.ceil(level / STAGE);
// Màn đầu tiên người chơi mua được món: khu mở (thắng unlockAfter -> mở từ màn unlockAfter + 1), vườn mở rộng, lock.
const openAt = entry => Math.max(1, (ZONES[entry.zone]?.unlockAfter ?? 0) + 1, entry.area === 'garden2' ? GARDEN_EXPANSION.unlockAfter + 1 : 1, entry.lock || 1);
const paid = CATALOG.filter(entry => entry.cat !== 'cats' && entry.price > 0);
const sum = list => list.reduce((total, entry) => total + entry.price, 0);
const fmt = n => n.toLocaleString('en-US');
const pct = (a, b) => (b ? `${Math.round(a / b * 100)}%` : '—');

const rows = [];
let coinsTotal = 0, baseTotal = 0, allTotal = 0;
for (let s = 1; s <= stages; s++) {
  const from = (s - 1) * STAGE + 1, to = Math.min(LEVELS.length, s * STAGE);
  let coins = s === 1 ? START_COINS : 0;
  for (let level = from; level <= to; level++) coins += levelReward(level - 1);
  const opened = paid.filter(entry => stageOfLevel(openAt(entry)) === s);
  const base = opened.filter(entry => entry.cat === 'furniture' && !entry.slot), variants = opened.filter(entry => entry.cat === 'furniture' && entry.slot);
  const surfaces = opened.filter(entry => entry.cat === 'walls' || entry.cat === 'floors');
  const areas = [...new Set(opened.map(entry => (entry.area === 'garden2' ? 'Garden 2' : ZONES[entry.zone].name)))].join(', ') || '—';
  coinsTotal += coins; baseTotal += sum(base); allTotal += sum(opened);
  rows.push({ s, levels: `${from}–${to}`, areas, coins, base: sum(base), baseN: base.length, variants: sum(variants), variantsN: variants.length,
    surfaces: sum(surfaces), surfacesN: surfaces.length, all: sum(opened), coinsTotal, baseTotal, allTotal });
}

const header = ['Stage', 'Màn', 'Khu mở đồ', 'Xu nhận', 'Món gốc', 'Kiểu khác', 'Tường / sàn', 'Tổng giá đồ mở', 'Xu nhận / giá món gốc', 'Xu luỹ kế', 'Đủ mua món gốc (luỹ kế)', 'Đủ mua tất cả (luỹ kế)'];
const table = [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---').join('|')}|`,
  ...rows.map(r => `| ${r.s} | ${r.levels} | ${r.areas} | **${fmt(r.coins)}** | ${fmt(r.base)} (${r.baseN}) | ${fmt(r.variants)} (${r.variantsN}) | ${fmt(r.surfaces)} (${r.surfacesN}) | **${fmt(r.all)}** | ${pct(r.coins, r.base)} | ${fmt(r.coinsTotal)} | ${pct(r.coinsTotal, r.baseTotal)} | ${pct(r.coinsTotal, r.allTotal)} |`),
];
const md = `# Báo cáo kinh tế (tự sinh — đừng sửa tay)

Sinh bởi \`npm run economy\` từ [game/gameplay/economy.mjs](../game/gameplay/economy.mjs). Sửa số ở file đó rồi chạy lại lệnh.

- **Xu nhận**: tổng xu thưởng khi thắng lần đầu mọi màn trong stage${START_COINS ? ` (stage 1 gồm ${fmt(START_COINS)} xu ban đầu)` : ''}.
- **Món gốc / Kiểu khác / Tường-sàn**: tổng giá các món *mở trong stage đó* (số trong ngoặc = số món). Món giá 0 và mèo không tính.
- **Tổng giá đồ mở**: mua hết mọi thứ mở trong stage (gốc + kiểu khác + tường/sàn).
- **Đủ mua … (luỹ kế)**: tổng xu nhận được tới hết stage chia cho tổng giá đồ đã mở tới hết stage. ≥ 100% = mua hết được.

${table.join('\n')}

**Tổng cả game** (${LEVELS.length} màn): nhận ${fmt(coinsTotal)} xu · món gốc ${fmt(baseTotal)} xu · mọi đồ ${fmt(allTotal)} xu.

Chỗ tiêu khác: booster ${Object.entries(BOOSTER_PRICE).map(([id, p]) => `${id} ${p}`).join(' · ')} xu/cái. Gói xu (tiền thật, chưa bán): ${COIN_PACKS.map(p => `${fmt(p.coins)} xu = $${p.usd}`).join(' · ')}.
`;
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/economy-report.md', import.meta.url), md);
console.log(table.join('\n').replace(/\*\*/g, ''));
console.log(`\nTổng: nhận ${fmt(coinsTotal)} xu · món gốc ${fmt(baseTotal)} · mọi đồ ${fmt(allTotal)}  →  đã ghi docs/economy-report.md`);
