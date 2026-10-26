// Nhiệm vụ tiến trình (thuần logic, không đụng DOM): luôn có QUESTS.slots nhiệm vụ đang chạy, mỗi cái thuộc một chuỗi (QUEST_TRACKS).
// Nhận thưởng xong thì chuỗi đó lên bậc (mục tiêu tăng), xuống cuối hàng, và chỗ trống được lấp ngay bằng chuỗi đầu hàng còn làm được.
// Số liệu ở data/economy.mjs (QUESTS, QUEST_TRACKS).
//
// Save (SAVE_KEYS.quests): { order: [id chuỗi], tiers: { id: số lần đã xong }, active: [{ track, n, text, area?, reward, progress }] }
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

// Nhiệm vụ bậc `tier` của một chuỗi, hoặc null nếu chuỗi đó lúc này không làm được (hết màn / khu / chỗ xây / mèo / kiểu đồ).
function spawn(track, tier, ctx) {
  let n, area;
  if (track.kind === 'level') {
    if (ctx.cleared >= ctx.maxLevel) return null;
    n = Math.min(ctx.maxLevel, (Math.floor(ctx.cleared / track.step) + 1) * track.step);
  } else if (track.kind === 'area') {
    if (!ctx.nextArea) return null;
    n = 1;
    area = ctx.nextArea;
  } else {
    if (track.once && tier) return null;
    // Có trần (không thành cày) và không vượt số còn lại trong game (nhiệm vụ không bao giờ kẹt).
    n = Math.min(track.base + track.grow * tier, track.max ?? Infinity);
    if (track.cap) { if (!ctx[track.cap]) return null; n = Math.min(n, ctx[track.cap]); }
  }
  const text = track.text.replace('{n}', n.toLocaleString('en-US')).replace('{area}', ctx.areaName ?? '').replace('{s}', n > 1 ? 's' : '');
  return { track: track.id, n, text, ...(area && { area }), reward: round10(track.share * dailyRate(ctx.unlocked)), progress: 0 };
}

// Tiến độ của nhiệm vụ đo theo trạng thái game (màn đã thắng, khu đã mở); nhiệm vụ đếm sự kiện giữ nguyên.
function measure(quest, ctx) {
  const track = trackOf(quest.track);
  if (track?.kind === 'level') return { ...quest, progress: Math.min(quest.n, ctx.cleared) };
  if (track?.kind === 'area') return { ...quest, progress: ctx.open.includes(quest.area) ? 1 : 0 };
  return quest;
}

// Cập nhật tiến độ + lấp đủ chỗ trống. Không đổi gì thì trả lại đúng object cũ (khỏi ghi save).
export function fillQuests(saved, ctx) {
  const base = saved ?? { order: QUEST_TRACKS.map(track => track.id), tiers: {}, active: [] };
  // Chuỗi mới thêm vào bảng (bản cập nhật) xếp cuối hàng; chuỗi đã bỏ khỏi bảng thì thôi.
  const order = [...base.order.filter(trackOf), ...QUEST_TRACKS.map(track => track.id).filter(id => !base.order.includes(id))];
  const active = base.active.filter(quest => trackOf(quest.track)).map(quest => measure(quest, ctx));
  for (const id of order) {
    if (active.length >= QUESTS.slots) break;
    if (active.some(quest => quest.track === id)) continue;
    const quest = spawn(trackOf(id), base.tiers[id] ?? 0, ctx);
    if (quest) active.push(measure(quest, ctx));
  }
  const next = { ...base, order, active };
  return saved && JSON.stringify(next) === JSON.stringify(saved) ? saved : next;
}

export const questDone = quest => quest.progress >= quest.n;
export const questsClaimable = quests => quests.active.filter(questDone).length;

// Đếm một sự kiện cho các nhiệm vụ đếm (build, claimPet, style...).
export function noteQuests(quests, event, n = 1) {
  let changed = false;
  const active = quests.active.map(quest => {
    if (trackOf(quest.track)?.event !== event || questDone(quest)) return quest;
    changed = true;
    return { ...quest, progress: Math.min(quest.n, quest.progress + n) };
  });
  return changed ? { ...quests, active } : quests;
}

// Nhận thưởng nhiệm vụ thứ `index`: chuỗi lên bậc, xuống cuối hàng, rồi lấp chỗ trống.
export function claimQuest(quests, index, ctx) {
  const quest = quests.active[index];
  if (!quest) return { error: 'No such quest' };
  if (!questDone(quest)) return { error: 'Not done yet' };
  const next = {
    ...quests,
    tiers: { ...quests.tiers, [quest.track]: (quests.tiers[quest.track] ?? 0) + 1 },
    order: [...quests.order.filter(id => id !== quest.track), quest.track],
    active: quests.active.filter((_, i) => i !== index),
  };
  return { quests: fillQuests(next, ctx), coins: quest.reward };
}

// Cấp nhà: mỗi QUESTS.rankEvery quest đã nhận thưởng = lên một bậc (danh hiệu QUESTS.ranks, bậc cuối giữ nguyên tên).
// done = số quest đã nhận (tổng số lần lên bậc của mọi chuỗi), into = đã làm bao nhiêu quest trong bậc hiện tại.
export function questRank(quests) {
  const done = Object.values(quests?.tiers ?? {}).reduce((sum, n) => sum + n, 0), rank = Math.floor(done / QUESTS.rankEvery);
  return { rank, title: QUESTS.ranks[Math.min(rank, QUESTS.ranks.length - 1)], into: done % QUESTS.rankEvery, every: QUESTS.rankEvery };
}
