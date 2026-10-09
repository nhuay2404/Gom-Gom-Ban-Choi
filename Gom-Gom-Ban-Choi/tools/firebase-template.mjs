// Sinh template Firebase Remote Config từ số MẶC ĐỊNH trong code: `npm run firebase:template`.
// Ghi firebase/remoteconfig.template.json — mỗi hằng số khai bằng remote('TÊN', ...) trong economy.mjs / tuning.mjs thành
// một tham số cùng TÊN (kiểu JSON / NUMBER / BOOLEAN), chia nhóm "Economy" và "Gameplay tuning" cho dễ tìm trên console.
// Đẩy lên Firebase: `npm run firebase:deploy` (xem docs/FIREBASE.md — lệnh này GHI ĐÈ toàn bộ config đang có trên Firebase).
import { mkdirSync, writeFileSync } from 'node:fs';
import { REMOTE_DEFAULTS } from '../game/gameplay/remote-config.mjs';

await import('../game/gameplay/economy.mjs');
const economyKeys = [...REMOTE_DEFAULTS.keys()];
await import('../game/gameplay/tuning.mjs');
const tuningKeys = [...REMOTE_DEFAULTS.keys()].filter(key => !economyKeys.includes(key));

const GROUP_INFO = {
  Economy: 'Kinh tế: xu thưởng mỗi màn, xu ban đầu, quà, gói xu, giá booster, giá + màn mở khoá đồ deco (game/gameplay/economy.mjs).',
  'Gameplay tuning': 'Cảm giác chơi: bàn, nhịp animation, kéo thả, độ khó thích ứng, chuyển động mèo 3D (game/gameplay/tuning.mjs).',
};
const typeOf = value => (typeof value === 'number' ? 'NUMBER' : typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'string' ? 'STRING' : 'JSON');
const param = key => {
  const { value, description } = REMOTE_DEFAULTS.get(key), type = typeOf(value);
  return { defaultValue: { value: type === 'JSON' ? JSON.stringify(value) : String(value) }, valueType: type, ...(description && { description: description.slice(0, 250) }) };
};
const group = (keys, name) => ({ description: GROUP_INFO[name], parameters: Object.fromEntries(keys.map(key => [key, param(key)])) });
const template = { parameterGroups: { Economy: group(economyKeys, 'Economy'), 'Gameplay tuning': group(tuningKeys, 'Gameplay tuning') } };

mkdirSync(new URL('../firebase/', import.meta.url), { recursive: true });
writeFileSync(new URL('../firebase/remoteconfig.template.json', import.meta.url), `${JSON.stringify(template, null, 2)}\n`);
console.log(`Đã ghi firebase/remoteconfig.template.json: ${economyKeys.length} tham số Economy + ${tuningKeys.length} tham số Gameplay tuning`);
console.log(`  Economy: ${economyKeys.join(', ')}\n  Tuning:  ${tuningKeys.join(', ')}`);
