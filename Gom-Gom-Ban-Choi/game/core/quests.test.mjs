import test from 'node:test';
import assert from 'node:assert/strict';
import { fillQuests, noteQuests, claimQuest, questDone, questsClaimable } from './quests.mjs';
import { dailyRate } from './daily.mjs';
import { QUESTS, QUEST_TRACKS } from '../data/economy.mjs';

const ctx = { unlocked: 12, cleared: 11, maxLevel: 100, nextArea: 'living', areaName: 'Living room', open: ['garden', 'garden2'], basesLeft: 40, petsLeft: 6, stylesLeft: 30 };
const track = id => QUEST_TRACKS.find(t => t.id === id);

test('nhiệm vụ tiến trình: đủ slots nhiệm vụ, mỗi chuỗi tối đa một, xu theo hệ số từng chuỗi; cùng trạng thái thì không đổi', () => {
  const q = fillQuests(null, ctx);
  assert.equal(q.active.length, QUESTS.slots);
  assert.deepEqual(q.active.map(x => x.track), QUEST_TRACKS.slice(0, QUESTS.slots).map(t => t.id));
  assert.match(q.active[0].text, /Beat level 15!$/);
  assert.equal(q.active[0].progress, 11, 'tiến độ màn đo theo số màn đã thắng');
  assert.match(q.active[1].text, /Open the Living room next!$/);
  for (const x of q.active) assert.equal(x.reward, Math.round(track(x.track).share * dailyRate(ctx.unlocked) / 10) * 10);
  assert.ok(q.active[1].reward > fillQuests({ order: ['pets'], tiers: {}, active: [] }, ctx).active[0].reward, 'mở khu thưởng hơn nhận mèo');
  assert.equal(fillQuests(q, ctx), q);
  assert.ok(QUEST_TRACKS.every(t => !['play', 'match', 'pet'].includes(t.event)), 'việc trong phiên chơi để cho nhiệm vụ ngày');
});

test('nhiệm vụ tiến trình: nhận xong thì đẻ nhiệm vụ kế ngay; mục tiêu có trần; hết nội dung thì chuỗi thôi', () => {
  let q = fillQuests(null, ctx);
  q = noteQuests(q, 'build', 3);
  const got = claimQuest(q, 2, ctx);
  assert.equal(got.quests.active.length, QUESTS.slots, 'chỗ trống được lấp ngay');
  assert.equal(got.quests.active[2].track, 'pets', 'chuỗi đầu hàng còn lại');
  // Xây nhiều lần: mục tiêu tăng 3 → 4 → 5 rồi dừng ở trần.
  const b = track('build');
  for (const tier of [0, 1, 2, 5, 9]) assert.equal(fillQuests({ order: ['build'], tiers: { build: tier }, active: [] }, ctx).active[0].n, Math.min(b.base + b.grow * tier, b.max));
  // Cuối game: hết màn, hết khu, hết chỗ, hết mèo, hết kiểu đồ -> bảng trống.
  const done = { ...ctx, cleared: 100, nextArea: null, basesLeft: 0, petsLeft: 0, stylesLeft: 0 };
  // Chuỗi dạy chơi (once) đã làm xong từ trước.
  const taught = { order: QUEST_TRACKS.map(t => t.id), tiers: { carry: 1, view: 1, surface: 1 }, active: [] };
  assert.equal(fillQuests(taught, done).active.length, 0);
  assert.deepEqual(fillQuests(taught, { ...done, stylesLeft: 1 }).active.map(x => [x.track, x.n]), [['styles', 1]], 'mục tiêu không vượt số còn lại');
});

test('nhiệm vụ tiến trình: chưa xong không nhận được; đếm không vượt mục tiêu; chuỗi lên bậc + xuống cuối hàng', () => {
  const q = fillQuests(null, ctx);
  assert.ok(claimQuest(q, 2, ctx).error);
  const counted = noteQuests(q, 'build', 99);
  assert.equal(counted.active[2].progress, counted.active[2].n);
  assert.equal(questsClaimable(counted), 1);
  assert.ok(questDone(counted.active[2]));
  const got = claimQuest(counted, 2, ctx).quests;
  assert.equal(got.tiers.build, 1);
  assert.equal(got.order.at(-1), 'build');
  assert.equal(noteQuests(got, 'play', 5), got, 'sự kiện không thuộc chuỗi nào thì không đổi');
});

test('nhiệm vụ tiến trình: chuỗi dạy chơi (once) chỉ ra một lần; thắng màn thưởng nhẹ hơn mở khu', () => {
  const q = fillQuests({ order: ['carry', 'level', 'area'], tiers: {}, active: [] }, ctx);
  assert.equal(q.active[0].track, 'carry');
  const done = claimQuest(noteQuests(q, 'carry'), 0, ctx).quests;
  assert.ok(!done.active.some(x => x.track === 'carry'), 'xong rồi thì không ra lại');
  assert.ok(q.active[1].reward < q.active[2].reward);
});

test('cấp nhà: lên bậc sau mỗi rankEvery quest đã nhận; bậc cuối giữ danh hiệu cuối', async () => {
  const { questRank } = await import('./quests.mjs');
  assert.deepEqual(questRank(null), { rank: 0, title: QUESTS.ranks[0], into: 0, every: QUESTS.rankEvery });
  const r = questRank({ tiers: { build: QUESTS.rankEvery, pets: 1 } });
  assert.equal(r.rank, 1);
  assert.equal(r.into, 1);
  assert.equal(questRank({ tiers: { level: QUESTS.rankEvery * 99 } }).title, QUESTS.ranks.at(-1));
});
