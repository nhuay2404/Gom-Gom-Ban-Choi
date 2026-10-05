// Xuất dữ liệu game ra JSON (thuần dữ liệu) để Cocos đọc thẳng, không phải chép tay.
// Chạy: npm run export:data   ->   export/data/*.json
//   levels.json    20 màn: bàn, lượt, mục tiêu, giống mèo, thẻ kịch bản, tutorial, tier, cơ chế mới
//   cards.json     cách viết thẻ + hình (offsets) + tỉ lệ hình mặc định của bộ chia
//   scoring.json   điểm theo cỡ cụm, cỡ gom tối thiểu, mốc sao
//   cats.json      6 giống mèo: tên, màu, kiểu tai / mắt / biểu cảm
//   deco.json      2 khu + danh mục đồ (giá, khoá level)
//   room.json      chỗ đặt đồ [x, z, xoay], bán kính vật cản, cửa sổ, cỡ phòng
//   tuning.json    mọi hằng số cảm giác chơi (thời gian anim, kéo thả, lò xo mèo...)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, LETTERS, parseCard } from '../game/gameplay/levels.mjs';
import { MATCH_SIZE, clusterPoints } from '../game/gameplay/scoring.mjs';
import { categories } from '../game/ui/cat-art.mjs';
import { CATALOG, ZONES } from '../game/deco/deco-data.mjs';
import { PLACES, OBSTACLE_RADIUS, WINDOW, ROOM_HALF, WALL_H, facingOf } from '../game/deco/room-layout.mjs';
import * as tuning from '../game/gameplay/tuning.mjs';
import { levelTier, levelMechanics } from '../game/gameplay/progression.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export', 'data');
mkdirSync(OUT, { recursive: true });
const save = (name, value) => writeFileSync(join(OUT, name), `${JSON.stringify(value, null, 2)}\n`);

save('levels.json', {
  legend: { '.': 'empty', X: 'crate (breaks when an adjacent cluster clears)', M: 'metal (never breaks)', ...LETTERS },
  tutorialSteps: {
    drag: 'drag the current card so its top-left lands on `anchor` (free = any cell allowed)',
    rotate: 'rotate until the card offsets equal `offsets`',
    hold: 'drag the current card into the Hold slot', tapHold: 'tap the Hold slot (swap)', info: 'read, then press Continue',
  },
  levels: LEVELS.map((level, i) => ({
    number: i + 1, ...level, tier: levelTier(level), mechanics: levelMechanics(level),
    deckCards: (level.deck || []).map(spec => ({ spec, ...parseCard(spec) })),
  })),
});
save('cards.json', {
  notation: "'O' single · 'OG' domino · 'O|G' vertical domino · 'I:OGW' line · 'V:OGW' vertical line · 'L:OGW' elbow",
  rotation: 'rotate 90° clockwise, then normalise so the smallest row/col is 0 (board-rules.mjs rotateOffsets)',
  defaultShapeWeights: { single: 6, domino: 5, triple: 1 }, tripleSplit: { line: .5, elbow: .5 },
  assist: 'probability that a dealt cat copies a colour already on the board (level.assist, default 0.3)',
});
save('scoring.json', {
  minMatch: MATCH_SIZE, pointsByClusterSize: Object.fromEntries([3, 4, 5, 6, 7, 8].map(n => [n, clusterPoints(n)])),
  stars: '3★ if movesLeft >= ceil(moves × 0.3), 2★ if >= ceil(moves × 0.12), else 1★',
  coinsPerNewStar: tuning.ECONOMY.COINS_PER_STAR,
});
save('cats.json', categories);
save('deco.json', { zones: ZONES, catalog: CATALOG });
save('room.json', {
  roomHalf: ROOM_HALF, wallHeight: WALL_H, window: WINDOW,
  places: Object.fromEntries(Object.keys(PLACES).map(id => [id, { x: PLACES[id][0], z: PLACES[id][1], rotationY: +facingOf(id).toFixed(4) }])),
  obstacleRadius: OBSTACLE_RADIUS,
});
save('tuning.json', Object.fromEntries(Object.entries(tuning)));
console.log(`Đã xuất dữ liệu vào ${OUT}`);
