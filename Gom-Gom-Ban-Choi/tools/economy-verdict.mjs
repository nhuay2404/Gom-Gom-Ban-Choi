// Kết luận cân bằng kinh tế (tab Kinh tế của Level Editor): chấm điểm từ bảng chặng + mô phỏng người chơi ảo, viết bằng lời dễ hiểu.
import { AREA_NAMES } from '../game/deco/deco-data.mjs';

const fmt = n => Math.round(n).toLocaleString('en-US');
const minutes = min => (min < 60 ? `${Math.round(min * 10) / 10} phút` : `${Math.floor(min / 60)} giờ${Math.round(min % 60) ? ` ${Math.round(min % 60)} phút` : ''}`);
// Mỗi vấn đề trừ điểm theo mức nặng (thang 10); gợi ý sửa kèm con số cụ thể.
const round50 = n => Math.max(50, Math.round(n / 50) * 50);
export function economyVerdict({ off, avg, others, cfg }) {
  const good = [], issues = [], fixes = [];
  let penalty = 0;
  const hit = (weight, text, fix) => { penalty += weight; issues.push(text); if (fix && !fixes.includes(fix)) fixes.push(fix); };
  // off: chặng mà % đủ mua món mặc định (sau khi trả tiền mở khu) tăng lại so với chặng trước (dư xu) hoặc dưới 25% (thiếu xu).
  for (const { s, r, prev, kind } of off.slice(0, 3)) {
    if (kind === 'low') hit(1, `Chặng ${s} (màn ${(s - 1) * 10 + 1}–${s * 10}): trả tiền mở khu xong chỉ còn đủ mua ${Math.round(r * 100)}% đồ mặc định — người chơi thấy đồ quá đắt.`,
      'Giảm giá mở khu hoặc Nhân giá đồ của khu mở ở chặng thiếu xu, hoặc tăng xu thưởng.');
    else hit(1, `Chặng ${s} (màn ${(s - 1) * 10 + 1}–${s * 10}): đủ mua ${Math.round(r * 100)}% đồ mặc định, tăng lại so với ${Math.round(prev * 100)}% chặng trước — dư xu vì không có khu / đồ mới.`,
      'Thêm khu hoặc đồ mới cho các chặng dư xu, hoặc giảm Xu tăng thêm mỗi màn.');
  }
  if (!off.length) good.push('Sau khi trả tiền mở khu, % đủ mua đồ mặc định giảm dần qua mọi chặng — khu sau khó mua đủ hơn.');
  if (avg) {
    const name = avg.profile.name;
    const stuck = avg.areas.filter(x => x.opened < 1);
    for (const x of stuck) {
      const cost = cfg.AREA_UNLOCK[x.area].cost;
      hit(3, `Người chơi ${name.toLowerCase()} chỉ ${Math.round(x.opened * 100)}% mở được ${AREA_NAMES[x.area]} — giá mở khu quá cao so với xu kiếm được.`,
        `Giảm giá mở ${AREA_NAMES[x.area]} từ ${fmt(cost)} xuống khoảng ${fmt(round50(cost * .7))} xu.`);
    }
    if (!stuck.length) good.push(`Người chơi ${name.toLowerCase()} mở được đủ ${avg.areas.length} khu.`);
    // Chờ gom xu sau màn mốc có thể là cố ý (xu là mục tiêu): gộp thành một ý, trừ nhẹ.
    const waited = avg.areas.filter(x => x.opened >= 1 && x.short >= cfg.AREA_UNLOCK[x.area].cost * .5);
    if (waited.length) hit(1, `Vừa thắng màn mốc mà ví còn thiếu nhiều xu để mở: ${waited.map(x => `${AREA_NAMES[x.area]} (thiếu ${fmt(x.short)} / ${fmt(cfg.AREA_UNLOCK[x.area].cost)} xu)`).join(', ')}. Cố ý thì giữ; không thì người chơi thấy bị chặn.`,
      `Muốn mở khu ngay khi tới màn mốc: giảm giá ~15% (${waited.map(x => `${AREA_NAMES[x.area]} ${fmt(cfg.AREA_UNLOCK[x.area].cost)} → ${fmt(round50(cfg.AREA_UNLOCK[x.area].cost * .85))}`).join(', ')}).`);
    if (avg.owned >= avg.shopSize && avg.wallet > 2000) hit(2, `Cuối game người chơi ${name.toLowerCase()} đã mua hết đồ mà còn dư ${fmt(avg.wallet)} xu — xu không còn giá trị.`,
      `Giảm Xu tăng thêm mỗi màn từ ${cfg.REWARD_STEP} xuống ${Math.max(0, Math.round(cfg.REWARD_STEP * .7 * 10) / 10)}, hoặc thêm đồ để mua ở khu cuối.`);
    else good.push(`Cuối game không dư xu quá nhiều (${fmt(avg.wallet)} xu).`);
    if (avg.idleShare > .15) hit(1, `Xu tự sinh chiếm ${Math.round(avg.idleShare * 100)}% tổng xu — người chơi không cần chơi màn vẫn giàu.`,
      `Giảm "Mỗi giờ sinh" từ ${cfg.IDLE_RATE} xuống ${+(cfg.IDLE_RATE * .7).toFixed(3)}.`);
    else if (avg.idleShare >= .05) good.push(`Xu tự sinh chiếm ${Math.round(avg.idleShare * 100)}% — vừa đủ làm quà quay lại, không lấn xu chơi màn.`);
  }
  for (const r of others) for (const x of r.areas.filter(x => x.opened < 1))
    hit(.5, `Người chơi ${r.profile.name.toLowerCase()} chỉ ${Math.round(x.opened * 100)}% mở được ${AREA_NAMES[x.area]}.`);
  const score = Math.max(1, Math.round(10 - penalty));
  const label = score >= 8 ? 'Cân bằng' : score >= 5 ? 'Hơi lệch' : 'Lệch nhiều';
  return { score, label, good, issues, fixes };
}

// Kết luận cho từng kiểu người chơi ảo (mục 4): r = kết quả simulateProfile, levels = số màn mô phỏng.
// Trả về { ok, lines }: ok = không có điểm đáng lo; lines = các câu ngắn, dễ hiểu.
export function profileVerdict(r, cfg, levels) {
  const lines = [];
  let ok = true;
  const warn = text => { ok = false; lines.push('⚠ ' + text); };
  if (r.cleared < levels) warn(`Kẹt ở màn ${r.cleared}, không chơi hết ${levels} màn trong thời gian mô phỏng.`);
  else lines.push(`Chơi hết ${levels} màn trong ${r.days} ngày` + (r.minPerLevel ? `: mỗi màn ≈ ${minutes(r.minPerLevel)} (kể cả chơi lại khi thua), ≈ ${minutes(r.minPerDay)} / ngày, cả game ≈ ${minutes(r.playMin)}.` : '.'));
  const TIER_NAMES = { chill: 'dễ', normal: 'thường', hard: 'khó', boss: 'boss' };
  const tiers = Object.entries(r.tierMin ?? {}).filter(([, m]) => m != null).sort((a, b) => a[1] - b[1]);
  if (tiers.length > 1) lines.push(`Mỗi màn theo độ khó: ${tiers.map(([t, m]) => `${TIER_NAMES[t] ?? t} ≈ ${minutes(m)}`).join(', ')} (màn khó thua nhiều, phải chơi lại).`);
  if (r.fullBase) {
    if (r.fullBase.rate < 1) warn(`Chỉ ${Math.round(r.fullBase.rate * 100)}% người ảo mua đủ ${r.baseCount} món mặc định — xu không đủ cho cách chơi này.`);
    else lines.push(`Mua đủ ${r.baseCount} món mặc định vào ngày ${r.fullBase.day} (ở màn ${r.fullBase.level}), sau ≈ ${minutes(r.fullBase.playMin)} chơi` + (r.fullBase.level >= levels ? ' — phải chơi hết màn và chờ thêm xu tự sinh.' : '.'));
  }
  const stuck = r.areas.filter(a => a.opened < 1);
  if (stuck.length) warn(`Không mở được: ${stuck.map(a => `${AREA_NAMES[a.area]} (${Math.round(a.opened * 100)}% người ảo mở được)`).join(', ')} — giá khu quá cao so với xu kiếm được.`);
  else lines.push(`Mở đủ ${r.areas.length} khu, khu cuối (${AREA_NAMES[r.areas.at(-1).area]}) vào ngày ${r.areas.at(-1).day}.`);
  const opened = r.areas.filter(a => a.opened >= 1);
  const worst = opened.reduce((m, a) => (!m || a.short / cfg.AREA_UNLOCK[a.area].cost > m.short / cfg.AREA_UNLOCK[m.area].cost ? a : m), null);
  if (worst && worst.short > 0) {
    const share = worst.short / cfg.AREA_UNLOCK[worst.area].cost;
    const text = `Lúc tới màn mốc thiếu xu nhiều nhất ở ${AREA_NAMES[worst.area]}: thiếu ${fmt(worst.short)} / ${fmt(cfg.AREA_UNLOCK[worst.area].cost)} xu (${Math.round(share * 100)}% giá khu), phải chơi thêm để gom.`;
    if (share >= .5) warn(text + ' Hơi lâu: cố ý thì giữ, không thì giảm giá khu.'); else lines.push(text);
  } else if (opened.length) lines.push('Tới màn mốc là luôn đủ xu mở khu ngay — giá khu có thể hơi rẻ.');
  if (r.owned >= r.shopSize) lines.push(`Mua hết ${r.shopSize} món muốn mua.`);
  else lines.push(`Mua được ${r.owned} / ${r.shopSize} món muốn mua — còn nhiều đồ để cày tiếp.`);
  if (r.wallet > 2000) warn(`Cuối game dư ${fmt(r.wallet)} xu mà không còn gì để mua — cần thêm khu / đồ cho giai đoạn cuối.`);
  else lines.push(`Cuối game còn ${fmt(r.wallet)} xu — tiêu gần hết, xu vẫn có giá trị.`);
  if (r.idleShare > .15) warn(`Xu tự sinh chiếm ${Math.round(r.idleShare * 100)}% tổng xu — quá nhiều, không cần chơi màn vẫn giàu.`);
  else lines.push(`Xu tự sinh chiếm ${Math.round(r.idleShare * 100)}% tổng xu.`);
  return { ok, lines };
}

// Kết luận chung cho mọi kiểu người chơi ảo (mục 4): điểm giống nhau (vấn đề chung) + điểm khác nhau giữa các kiểu.
// results = mảng kết quả simulateProfile. Trả về { ok, lines }.
export function profilesSummary(results, cfg, levels) {
  const lines = [], names = list => list.map(r => r.profile.name).join(', ');
  const all = list => list.length === results.length;
  const finished = results.filter(r => r.cleared >= levels), stuck = results.filter(r => r.areas.some(a => a.opened < 1));
  const rich = results.filter(r => r.wallet > 2000), idleHigh = results.filter(r => r.idleShare > .15);
  const days = results.map(r => r.days), fast = results.reduce((a, b) => (b.days < a.days ? b : a)), slow = results.reduce((a, b) => (b.days > a.days ? b : a));
  // 1. Tiến độ + mở khu
  lines.push(all(finished) ? `Mọi kiểu đều chơi hết ${levels} màn: nhanh nhất ${fast.profile.name} ${fast.days} ngày, chậm nhất ${slow.profile.name} ${slow.days} ngày.`
    : `Kẹt, không chơi hết ${levels} màn: ${names(results.filter(r => r.cleared < levels))}.`);
  if (results.every(r => r.minPerLevel)) {
    const per = results.map(r => r.minPerLevel), daily = results.map(r => r.minPerDay);
    const total = results.map(r => r.playMin);
    lines.push(`Thời gian chơi thật (đã gồm ván thua, màn khó dễ): mỗi màn ≈ ${minutes(Math.min(...per))}–${minutes(Math.max(...per))}, mỗi ngày ≈ ${minutes(Math.min(...daily))}–${minutes(Math.max(...daily))}, cả game ≈ ${minutes(Math.min(...total))}–${minutes(Math.max(...total))} tuỳ kiểu.`);
    const full = results.filter(r => r.fullBase?.rate >= 1);
    if (full.length === results.length) lines.push(`Mua đủ mọi món mặc định sau ≈ ${minutes(Math.min(...full.map(r => r.fullBase.playMin)))}–${minutes(Math.max(...full.map(r => r.fullBase.playMin)))} chơi (ngày ${Math.min(...full.map(r => r.fullBase.day))}–${Math.max(...full.map(r => r.fullBase.day))}).`);
    else lines.push(`⚠ Không mua đủ mọi món mặc định: ${names(results.filter(r => !(r.fullBase?.rate >= 1)))}.`);
  }
  lines.push(stuck.length ? `⚠ Không mở đủ khu: ${names(stuck)} — giá khu quá cao với cách chơi này.` : `Mọi kiểu đều mở đủ ${results[0].areas.length} khu.`);
  // 2. Khu mà mọi kiểu đều thiếu nhiều xu lúc tới mốc (≥ nửa giá khu)
  const hard = results[0].areas.map(a => a.area).filter(area => results.every(r => {
    const x = r.areas.find(a => a.area === area);
    return x.opened >= 1 && x.short >= cfg.AREA_UNLOCK[area].cost * .5;
  }));
  if (hard.length) lines.push(`⚠ Kiểu nào tới màn mốc cũng còn thiếu hơn nửa giá khu: ${hard.map(area => `${AREA_NAMES[area]} (${fmt(cfg.AREA_UNLOCK[area].cost)} xu)`).join(', ')} — do giá khu, không do cách chơi. Cố ý thì giữ, không thì giảm giá.`);
  else lines.push('Không có khu nào mà mọi kiểu đều phải chờ gom xu lâu.');
  // 3. Xu dư cuối game
  if (rich.length >= results.length - 1 && rich.length) lines.push(`⚠ Hầu hết các kiểu dư nhiều xu cuối game (${rich.map(r => `${r.profile.name} ${fmt(r.wallet)}`).join(', ')}) — vấn đề chung: thiếu khu / đồ cho giai đoạn cuối.`);
  else if (rich.length) lines.push(`Chỉ ${names(rich)} dư nhiều xu cuối game; các kiểu khác tiêu gần hết.`);
  else lines.push('Không kiểu nào dư nhiều xu cuối game — xu luôn có chỗ tiêu.');
  // 4. Khác nhau: xu tự sinh theo số ngày chơi
  const idle = results.map(r => r.idleShare), lo = Math.round(Math.min(...idle) * 100), hi = Math.round(Math.max(...idle) * 100);
  lines.push(`Xu tự sinh chiếm ${lo}–${hi}% tổng xu: chơi càng chậm (nhiều ngày) càng được nhiều, vì xu tự sinh tính theo giờ thật.` + (idleHigh.length ? ` ⚠ Quá 15% ở: ${names(idleHigh)}.` : ''));
  const collectors = results.filter(r => r.owned < r.shopSize);
  if (collectors.length) lines.push(`${names(collectors)} còn nhiều đồ chưa mua — có chỗ để cày dài.`);
  const ok = !lines.some(line => line.startsWith('⚠'));
  return { ok, lines, spread: Math.max(...days) / Math.max(1, Math.min(...days)) };
}
