// Config LiveOps của Gom Gom cho hc-kit (game/hc-kit/, luật dùng chung nhiều game): mọi con số Economy & LiveOps của game nằm ở đây.
// Thiết kế + lý do từng số: tai-lieu/6-Thiet-ke-LiveOps.html. Hợp đồng config: game/hc-kit/index.d.ts (KitConfig).
// Chỉnh từ xa: tham số Firebase 'LIVEOPS' (JSON, chỉ cần phần muốn đổi), 'LIVEOPS_ON', 'CONTINUE_CLEAR_CELLS' (xem gameplay/remote-config.mjs).
// Tên vật phẩm trong phần thưởng là id của game: booster hammer / swap / moves, đồ Deco độc quyền lantern-koi (deco-data.mjs EXCLUSIVES).
import { remote } from '../gameplay/remote-config.mjs';

// Cờ bật / tắt LiveOps: tắt thì game chạy như bản core (Home / Shop như main, không mạng / continue / daily / event).
// Mặc định TẮT; ?liveops=1 / ?liveops=0 trên URL ghi đè (playtest, A/B).
const urlFlag = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('liveops');
export const LIVEOPS_ON = urlFlag === null ? remote('LIVEOPS_ON', false, 'Bật LiveOps (gems, mạng, continue, daily, event)') : urlFlag === '1';

// Continue khi thua vì hết chỗ: dọn thêm bấy nhiêu ô (luật bàn chơi của game, kit chỉ báo `stuck`).
export const CONTINUE_CLEAR_CELLS = remote('CONTINUE_CLEAR_CELLS', 3, 'Continue khi hết chỗ: số ô được dọn');

const BOOSTERS = ['hammer', 'swap', 'moves'];
const data = remote('LIVEOPS', {
  gameId: 'gomgom',
  // Giữ key lưu cũ để người chơi cũ không mất tiến độ (migrateGomGomV1 bên dưới chuyển định dạng).
  storageKey: 'gomgom-rotate-liveops-v1',
  clockToleranceMin: 10,
  currencies: {
    gems: { owner: 'kit', start: 0 },
    coins: { owner: 'game' },
  },
  lives: { max: 5, regenMin: 30, fromLevel: 21, introUnlimitedMin: 60, refill: { gems: 60 }, adPerDay: 3 },
  continue: { fromLevel: 11, prices: [{ gems: 60 }, { gems: 100 }, { gems: 150 }], value: 5, ad: { perAttempt: 1, value: 3 } },
  streak: {
    fromLevel: 21,
    tiers: [
      { wins: 3, buffs: { extraMoves: 2 } },
      { wins: 5, buffs: { extraMoves: 2, freeHammer: 1 } },
      { wins: 8, buffs: { extraMoves: 3, freeHammer: 1, freeSwap: 1 } },
    ],
  },
  daily: {
    fromCleared: 5,
    login: [
      { coins: 50 },
      { items: { hammer: 1 } },
      { coins: 80 },
      { items: { swap: 1 }, timers: { unlimitedLives: 30 } },
      { coins: 120 },
      { items: { moves: 1 } },
      { coins: 150, gems: 10, timers: { unlimitedLives: 60 } },
    ],
    quests: {
      slots: { easy: 20, medium: 30, hard: 50 },
      chest: { coins: 60, random: { pool: BOOSTERS, n: 1 } },
      pool: {
        easy: [
          { id: 'win2', text: 'Win 2 levels', need: 2, match: { signal: 'level_end', win: true } },
          { id: 'cats30', text: 'Match 30 cats', need: 30, count: 'amount', match: { signal: 'collect', kind: 'cat' } },
          { id: 'pet3', text: 'Pet your cats 3 times', need: 3, match: { signal: 'action', id: 'pet' } },
        ],
        medium: [
          { id: 'big5', text: 'Match 5 groups of 4+ cats', need: 5, match: { signal: 'collect', kind: 'cat', minAmount: 4 } },
          { id: 'crates8', text: 'Break 8 crates', need: 8, count: 'amount', fromCleared: 5, match: { signal: 'collect', kind: 'crate' } },
          { id: 'boost2', text: 'Use 2 boosters', need: 2, fromCleared: 3, match: { signal: 'action', id: 'booster' } },
          { id: 'win3', text: 'Win 3 levels', need: 3, match: { signal: 'level_end', win: true } },
        ],
        hard: [
          { id: 'star3', text: 'Win a level with 3 stars', need: 1, match: { signal: 'level_end', win: true, minStars: 3 } },
          { id: 'mega1', text: 'Match a group of 6+ cats', need: 1, match: { signal: 'collect', kind: 'cat', minAmount: 6 } },
          { id: 'win5', text: 'Win 5 levels', need: 5, match: { signal: 'level_end', win: true } },
        ],
      },
    },
  },
  // Lịch là dữ liệu: chu kỳ 28 ngày từ thứ Hai 05/10/2026 (tuần 4 của chu kỳ đầu = 26/10 – 01/11: Deco Sale rơi đúng Halloween).
  events: {
    epoch: { year: 2026, month: 10, day: 5 },
    cycleDays: 28,
    calendar: [
      { id: 'yarn', slot: 'main', weekdays: [0, 1, 2, 3] },
      { id: 'fish', slot: 'main', weekdays: [4, 5, 6] },
      { id: 'race', slot: 'side', weekdays: [1, 5] },
      { id: 'decoSale', slot: 'offer', weekdays: [5, 6], weeks: [4] },
    ],
    defs: {
      yarn: {
        type: 'ladder', name: 'Yarn Climb', fromLevel: 11, steps: 7,
        stepRewards: { 2: { coins: 20 }, 4: { items: { hammer: 1 } }, 6: { coins: 40 } },
        top: { coins: 200, gems: 15, items: { moves: 1 } },
        repeatTop: { coins: 100, gems: 5 },
      },
      fish: {
        type: 'collect', name: 'Fish Festival', fromLevel: 11, collect: { kind: 'cat', per: 1 }, adDoublePerDay: 3,
        milestones: [
          { at: 40, reward: { coins: 30 } },
          { at: 90, reward: { items: { hammer: 1 } } },
          { at: 150, reward: { coins: 50 } },
          { at: 220, reward: { items: { swap: 1 } } },
          { at: 300, reward: { gems: 5 } },
          { at: 380, reward: { coins: 60 } },
          { at: 460, reward: { items: { moves: 1 } } },
          { at: 540, reward: { coins: 80 } },
          { at: 620, reward: { gems: 5 } },
          { at: 700, reward: { items: { 'lantern-koi': 1 } } },
        ],
      },
      race: {
        type: 'race', name: 'Cat Race', fromLevel: 11, goal: 10, hours: 24,
        bots: [[11, 14], [8, 11], [5, 8], [2, 5]],
        botNames: ['Mochi', 'Biscuit', 'Pudding', 'Noodle', 'Tofu', 'Pepper', 'Maple', 'Sushi', 'Waffle', 'Olive'],
        rewards: [{ gems: 30, coins: 300 }, { gems: 15, coins: 150 }, { gems: 5, coins: 80 }, { coins: 30 }, { coins: 30 }],
      },
      decoSale: { type: 'sale', name: 'Deco Sale', off: 0.3 },
    },
  },
  shop: {
    packs: [
      { id: 'gems-s', price: '$0.99', reward: { gems: 60 } },
      { id: 'gems-m', price: '$4.99', reward: { gems: 330 } },
      { id: 'gems-l', price: '$9.99', reward: { gems: 700 }, tag: 'Popular' },
      { id: 'gems-xl', price: '$19.99', reward: { gems: 1500 } },
    ],
  },
}, 'Config LiveOps cho hc-kit (mạng, continue, chuỗi thắng, daily, event, gói gems)');

// Save do LiveOps viết riêng trong game (trước hc-kit, Phase 1–2) → state của kit. Save đã chuyển (có `v`) trả nguyên.
// Test: hc-kit test/migrate.test.mjs (fixture sinh từ code cũ).
export function migrateGomGomV1(old) {
  if (old.v) return old;
  const fish = old.events?.fish;
  return {
    v: 1,
    wallet: { gems: old.gems ?? 0 },
    lives: { n: old.lives ?? 5, regenFrom: old.regenFrom ?? null, unlimitedUntil: old.unlimitedUntil ?? 0, intro: !!old.livesIntro,
      ads: { day: old.ads?.day ?? null, used: old.ads?.lives ?? 0 } },
    maxSeen: old.maxSeen ?? 0,
    login: old.login,
    quests: old.quests ?? null,
    streak: old.streak ?? 0,
    events: {
      yarn: old.events?.yarn ?? null,
      fish: fish ? { key: fish.key, tokens: fish.fish, reached: fish.reached } : null,
      race: old.events?.race ?? null,
      ads: { day: old.events?.ads?.day ?? null, fish: old.events?.ads?.fish ?? 0 },
    },
  };
}

// migrate là hàm nên nằm ngoài remote() (tham số Firebase chỉ chứa JSON).
export const LIVEOPS_CONFIG = { ...data, migrate: migrateGomGomV1 };

// Chữ hiện trên giao diện event (tiếng Anh như phần còn lại của game). {goal} = số màn thắng của Cat Race.
export const EVENT_INFO = {
  yarn: { name: 'Yarn Climb', short: 'Climb', icon: '🧶', rule: 'Win to climb a step, lose to slip one down. Reach the top for a big prize!' },
  fish: { name: 'Fish Festival', short: 'Fish', icon: '🐟', rule: 'Every group you match gives fish, one per cat. Collect fish to unlock rewards!' },
  race: { name: 'Cat Race', short: 'Race', icon: '🏁', rule: 'First to win {goal} levels wins! Your rivals are AI cats.' },
  decoSale: { name: 'Deco Sale', short: 'Sale', icon: '🏷️', rule: 'Decorations cost less this weekend!' },
};
