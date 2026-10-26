// Nhiệm vụ tiến trình (thuần logic, không đụng DOM): luôn có QUESTS.slots nhiệm vụ đang chạy, mỗi cái thuộc một chuỗi (QUEST_TRACKS).
// Mỗi chuỗi là một dãy mốc TÍCH LUỸ (4 → 10 → 20…). Sự kiện được đếm ngầm vào `totals` kể cả khi quest chưa hiện trong ô, nên làm vượt
// nhiều mốc mà chưa nhận thì nhận xong một mốc, mốc kế hiện ra đã đầy sẵn. Nhận thưởng xong thì mốc kế của chuỗi thay vào đúng ô đó
// (tối đa QUESTS.keep mốc liên tiếp); rồi chuỗi nhường ô, ô được lấp bằng chuỗi đầu hàng còn làm được. Số liệu ở data/economy.mjs (QUESTS, QUEST_TRACKS).
//
// Save (SAVE_KEYS.quests): { order: [id chuỗi], tiers: { id: số mốc đã nhận }, totals: { sự kiện: tổng đếm ngầm },
//   levelFrom: mốc màn lúc mở Quests (÷ step), active: [{ track, n, text, area?, reward, progress, run? }] }
// ctx (shared.js questCtx): { unlocked, cleared, maxLevel, nextArea, areaName, open: [khu đã mở],
//   basesLeft (chỗ chưa xây ở mọi khu), petsLeft (mèo chưa nhận ở Map), stylesLeft (kiểu đồ / tường / sàn chưa mua ở Shop) }
import { QUESTS, QUEST_TRACKS } from '../data/economy.mjs';
import { dailyRate } from './daily.mjs';
import { SAVE_KEYS, readJSON, writeJSON } from './save.mjs';

export const loadQuests = () => readJSON(SAVE_KEYS.quests);
export function saveQuests(quests) { writeJSON(SAVE_KEYS.quests, quests); }
export const questsOpen = unlocked => unlocked >= QUESTS.fromLevel;

const trackOf = id => QUEST_TRACKS.find(track => track.id === id);
const round10 = n => Math.round(n / 10) * 10;

// Mốc thứ `tier` (tính từ 0) của chuỗi đếm: steps, hết steps thì cộng dần `then`; null = chuỗi hết mốc.
export function milestone(track, tier) {
  if (tier < track.steps.length) return track.steps[tier];
  return track.then ? track.steps.at(-1) + track.then * (tier - track.steps.length + 1) : null;
}

// Nhiệm vụ mốc `tier` của một chuỗi, hoặc null nếu chuỗi đó lúc này không còn mốc nào làm được (hết màn / khu / chỗ xây / mèo / kiểu đồ).
function spawn(track, tier, ctx, quests) {
  let n, area;
  if (track.kind === 'level') {
    // Mốc màn tính từ lúc mở Quests: bỏ ngang vài mốc thì các mốc đó vẫn còn, nhận lần lượt.
    const prev = (quests.levelFrom + tier) * track.step;
    if (prev >= ctx.maxLevel) return null;
    n = Math.min(ctx.maxLevel, prev + track.step);
  } else if (track.kind === 'area') {
    if (!ctx.nextArea) return null;
    n = 1;
    area = ctx.nextArea;
  } else {
    const goal = milestone(track, tier), prev = tier ? milestone(track, tier - 1) : 0;
    if (goal == null) return null;
    // Mốc không vượt tổng có thể đạt (đã làm + còn lại trong game): nhiệm vụ không bao giờ kẹt.
    n = track.cap ? Math.min(goal, (quests.totals[track.event] ?? 0) + (ctx[track.cap] ?? 0)) : goal;
    if (n <= prev) return null;
  }
  const text = track.text.replace('{n}', n.toLocaleString('en-US')).replace('{area}', ctx.areaName ?? '').replace('{s}', n > 1 ? 's' : '');
  return { track: track.id, n, text, ...(area && { area }), reward: round10(track.share * dailyRate(ctx.unlocked)), progress: 0 };
}

// Tiến độ: màn đã thắng / khu đã mở đo theo trạng thái game; chuỗi đếm lấy từ tổng đếm ngầm.
function measure(quest, ctx, totals) {
  const track = trackOf(quest.track);
  if (track?.kind === 'level') return { ...quest, progress: Math.min(quest.n, ctx.cleared) };
  if (track?.kind === 'area') return { ...quest, progress: ctx.open.includes(quest.area) ? 1 : 0 };
  return { ...quest, progress: Math.min(quest.n, totals[track.event] ?? 0) };
}

// Cập nhật tiến độ + lấp đủ chỗ trống. Không đổi gì thì trả lại đúng object cũ (khỏi ghi save).
export function fillQuests(saved, ctx, first = null) {
  const start = saved ?? { order: QUEST_TRACKS.map(track => track.id), tiers: {}, active: [] };
  const levelStep = trackOf('level')?.step ?? 1;
  const base = { ...start, totals: start.totals ?? seedTotals(start.active), levelFrom: start.levelFrom ?? Math.floor(ctx.cleared / levelStep) };
  // Chuỗi mới thêm vào bảng (bản cập nhật) xếp cuối hàng; chuỗi đã bỏ khỏi bảng thì thôi.
  const order = [...base.order.filter(trackOf), ...QUEST_TRACKS.map(track => track.id).filter(id => !base.order.includes(id))];
  // `first`: chuỗi vừa nhận thưởng được thử trước (mốc kế của nó thay vào ô vừa trống).
  const tryOrder = first ? [first, ...order.filter(id => id !== first)] : order;
  const active = base.active.filter(quest => trackOf(quest.track)).map(quest => measure(quest, ctx, base.totals));
  for (const id of tryOrder) {
    if (active.length >= QUESTS.slots) break;
    if (active.some(quest => quest.track === id)) continue;
    const quest = spawn(trackOf(id), base.tiers[id] ?? 0, ctx, base);
    if (quest) active.push(measure(quest, ctx, base.totals));
  }
  const next = { ...base, order, active };
  return saved && JSON.stringify(next) === JSON.stringify(saved) ? saved : next;
}

export const questDone = quest => quest.progress >= quest.n;
export const questsClaimable = quests => quests.active.filter(questDone).length;

// Save cũ (trước khi đếm ngầm): lấy tiến độ đang có của quest đếm làm tổng ban đầu, không mất phần đã làm.
function seedTotals(active = []) {
  const totals = {};
  for (const quest of active) { const event = trackOf(quest.track)?.event; if (event) totals[event] = Math.max(totals[event] ?? 0, quest.progress ?? 0); }
  return totals;
}

// Đếm ngầm một sự kiện (build, claimPet, style...): cộng vào tổng dù quest của nó đang hiện hay không, rồi đo lại các quest đang hiện.
export function noteQuests(quests, event, n = 1) {
  if (n <= 0 || !QUEST_TRACKS.some(track => track.event === event)) return quests;
  const totals = { ...(quests.totals ?? seedTotals(quests.active)), [event]: (quests.totals?.[event] ?? seedTotals(quests.active)[event] ?? 0) + n };
  const active = quests.active.map(quest => (trackOf(quest.track)?.event === event ? { ...quest, progress: Math.min(quest.n, totals[event]) } : quest));
  return { ...quests, totals, active };
}

// Nhận thưởng nhiệm vụ thứ `index`: mốc kế của CÙNG chuỗi thay vào đúng ô đó (thanh tiến độ tự đẩy lên mốc kế; đã làm vượt thì
// mốc kế đầy sẵn), tối đa QUESTS.keep mốc liên tiếp (`run` = số mốc chuỗi đã nhận liền trong ô). Đủ keep mốc hoặc chuỗi hết mốc thì
// chuỗi xuống cuối hàng và ô được lấp bằng chuỗi đầu hàng còn làm được (chuỗi nhường ô vẫn đếm ngầm).
export function claimQuest(quests, index, ctx) {
  const quest = quests.active[index];
  if (!quest) return { error: 'No such quest' };
  if (!questDone(quest)) return { error: 'Not done yet' };
  const run = (quest.run ?? 0) + 1, stay = run < QUESTS.keep;
  const tiers = { ...quests.tiers, [quest.track]: (quests.tiers[quest.track] ?? 0) + 1 };
  const order = stay ? quests.order : [...quests.order.filter(id => id !== quest.track), quest.track];
  const base = fillQuests({ ...quests, tiers, order, active: quests.active.filter((_, i) => i !== index) }, ctx, stay ? quest.track : null);
  const nextOf = base.active.findIndex(q => q.track === quest.track);
  // Mốc kế của chuỗi vừa nhận về đúng vị trí cũ (thấy thanh tiến độ "đẩy lên"); ô của chuỗi khác thì vào cuối danh sách.
  const active = [...base.active];
  if (stay && nextOf >= 0) { const [next] = active.splice(nextOf, 1); active.splice(index, 0, { ...next, run }); }
  return { quests: { ...base, active }, coins: quest.reward };
}

// Cấp nhà: mỗi QUESTS.rankEvery quest đã nhận thưởng = lên một bậc (danh hiệu QUESTS.ranks, bậc cuối giữ nguyên tên).
// done = số quest đã nhận (tổng số lần lên bậc của mọi chuỗi), into = đã làm bao nhiêu quest trong bậc hiện tại.
export function questRank(quests) {
  const done = Object.values(quests?.tiers ?? {}).reduce((sum, n) => sum + n, 0), rank = Math.floor(done / QUESTS.rankEvery);
  return { rank, title: QUESTS.ranks[Math.min(rank, QUESTS.ranks.length - 1)], into: done % QUESTS.rankEvery, every: QUESTS.rankEvery };
}
