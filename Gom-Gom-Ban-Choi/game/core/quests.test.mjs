import test from 'node:test';
import assert from 'node:assert/strict';
import { fillQuests, noteQuests, claimQuest, questDone, questsClaimable, milestone } from './quests.mjs';
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

test('nhiệm vụ tiến trình: nhận xong thì đẻ nhiệm vụ kế ngay; mốc tăng theo dãy steps rồi cộng then; hết nội dung thì chuỗi thôi', () => {
  let q = fillQuests(null, ctx);
  q = noteQuests(q, 'build', 4);
  const got = claimQuest(q, 2, ctx);
  assert.equal(got.quests.active.length, QUESTS.slots, 'chỗ trống được lấp ngay');
  assert.equal(got.quests.active[2].track, 'build', 'mốc kế của cùng chuỗi thay vào đúng ô');
  assert.equal(got.quests.active[2].n, track('build').steps[1]);
  const b = track('build');
  assert.deepEqual([0, 1, 2].map(t => milestone(b, t)), b.steps.slice(0, 3));
  assert.equal(milestone(b, b.steps.length), b.steps.at(-1) + b.then, 'hết steps thì cộng then');
  assert.equal(milestone(track('carry'), 1), null, 'chuỗi một mốc thì hết');
  // Cuối game: hết màn, hết khu, hết chỗ, hết mèo, hết kiểu đồ -> bảng trống.
  const done = { ...ctx, cleared: 100, nextArea: null, basesLeft: 0, petsLeft: 0, stylesLeft: 0 };
  const taught = { order: QUEST_TRACKS.map(t => t.id), tiers: { carry: 1, view: 1, surface: 1, level: 99 }, active: [] };
  assert.equal(fillQuests(taught, done).active.length, 0);
  assert.deepEqual(fillQuests(taught, { ...done, stylesLeft: 1 }).active.map(x => [x.track, x.n]), [['styles', 1]], 'mốc không vượt số còn lại');
});

test('nhiệm vụ tiến trình: đếm ngầm — làm vượt nhiều mốc khi quest chưa hiện / chưa nhận thì các mốc đó đầy sẵn, nhận lần lượt', () => {
  const b = track('build');
  // Quest xây chỗ chưa hiện trong 3 ô (order đẩy nó xuống cuối) nhưng vẫn được đếm.
  let q = fillQuests({ order: ['level', 'area', 'pets', 'build'], tiers: {}, active: [] }, ctx);
  assert.ok(!q.active.some(x => x.track === 'build'));
  q = noteQuests(q, 'build', 20);
  assert.equal(q.totals.build, 20);
  // Lên tới lượt build: mốc 1 (4) đầy; nhận xong mốc 2 (10) cũng đầy sẵn; rồi mốc 3 (20) đầy; mốc 4 (30) còn 20/30.
  q = { ...q, order: ['build', 'level', 'area', 'pets'], active: [] };
  const seen = [];
  for (let i = 0; i < 4; i++) {
    // Lần đầu, hoặc khi chuỗi đã nhường ô (đủ keep mốc): cho chuỗi quay lại đầu hàng để xem mốc kế.
    if (!i || !q.active.some(x => x.track === 'build')) q = fillQuests({ ...q, order: ['build', 'level', 'area', 'pets'], active: [] }, ctx);
    const at = q.active.findIndex(x => x.track === 'build'), quest = q.active[at];
    seen.push([quest.n, quest.progress]);
    if (!questDone(quest)) break;
    q = claimQuest(q, at, ctx).quests;
  }
  assert.deepEqual(seen, [[b.steps[0], b.steps[0]], [b.steps[1], b.steps[1]], [b.steps[2], 20], [b.steps[3], 20]]);
});

test('nhiệm vụ tiến trình: mốc màn tính từ lúc mở Quests, bỏ ngang mốc thì vẫn nhận lần lượt', () => {
  let q = fillQuests({ order: ['level', 'area', 'pets'], tiers: {}, active: [] }, ctx);
  assert.equal(q.active[0].n, 15);
  const far = { ...ctx, cleared: 27, unlocked: 28 };
  q = claimQuest(fillQuests(q, far), 0, far).quests;
  const next = q.active[0];
  assert.deepEqual([next.n, next.progress], [20, 20], 'mốc 20 không bị bỏ qua, đầy sẵn');
});

test('nhiệm vụ tiến trình: chưa xong không nhận được; đếm không vượt mục tiêu; chuỗi giữ ô và lên mốc kế', () => {
  const q = fillQuests(null, ctx);
  assert.ok(claimQuest(q, 2, ctx).error);
  const counted = noteQuests(q, 'build', 99);
  assert.equal(counted.active[2].progress, counted.active[2].n);
  assert.equal(questsClaimable(counted), 1);
  assert.ok(questDone(counted.active[2]));
  const got = claimQuest(counted, 2, ctx).quests;
  assert.equal(got.tiers.build, 1);
  assert.equal(got.active[2].track, 'build', 'chuỗi giữ ô, lên mốc kế');
  assert.equal(noteQuests(got, 'play', 5), got, 'sự kiện không thuộc chuỗi nào thì không đổi');
});

test('nhiệm vụ tiến trình: chuỗi dạy chơi (once) chỉ ra một lần; thắng màn thưởng nhẹ hơn mở khu', () => {
  const q = fillQuests({ order: ['carry', 'level', 'area'], tiers: {}, active: [] }, ctx);
  assert.equal(q.active[0].track, 'carry');
  const done = claimQuest(noteQuests(q, 'carry'), 0, ctx).quests;
  assert.ok(!done.active.some(x => x.track === 'carry'), 'xong rồi thì không ra lại');
  assert.equal(done.active.length, QUESTS.slots, 'chuỗi hết mốc thì ô được lấp bằng chuỗi khác');
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

test('nhiệm vụ tiến trình: chuỗi giữ ô tối đa QUESTS.keep mốc liên tiếp rồi nhường ô (vẫn đếm ngầm)', () => {
  let q = fillQuests({ order: ['styles', 'level', 'area', 'pets', 'build'], tiers: {}, active: [] }, ctx);
  q = noteQuests(q, 'style', 100);
  for (let i = 0; i < QUESTS.keep; i++) {
    assert.equal(q.active[0].track, 'styles', `mốc ${i + 1} vẫn ở ô đầu`);
    q = claimQuest(q, 0, ctx).quests;
  }
  assert.ok(!q.active.some(x => x.track === 'styles'), 'đủ keep mốc thì nhường ô');
  assert.equal(q.order.at(-1), 'styles', 'xuống cuối hàng');
  q = noteQuests(q, 'style', 5);
  assert.equal(q.totals.style, 105, 'vẫn đếm ngầm khi không hiện');
});
