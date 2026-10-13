// Level Editor — tab Economy: sửa công thức xu mỗi màn, mốc mở khu, hệ số giá khu; xem cân bằng theo stage ngay khi sửa;
// chạy mô phỏng người ảo (tools/economy-sim.mjs); lưu thẳng vào game/gameplay/economy.mjs (POST /api/save-economy).
// Dùng đúng code game (rewardFor, zonePrice, areaState...), chỉ truyền bộ số đang sửa.
import * as ECO from '../../game/gameplay/economy.mjs';
import { rewardFor } from '../../game/gameplay/progression.mjs';
import { CATALOG, AREA_ORDER, AREA_NAMES, zonePrice } from '../../game/deco/deco-data.mjs';
import { EDITABLE, PROFILES, simulateProfile } from '../economy-sim.mjs';
import { economyVerdict, profileVerdict, profilesSummary } from '../economy-verdict.mjs';
import { idlePerHour, idleCap } from '../../game/gameplay/idle.mjs';
import { runFlow } from '../economy-flow.mjs';

const $ = id => document.getElementById(id);
const fmt = n => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const clone = value => JSON.parse(JSON.stringify(value));
const fromGame = () => Object.fromEntries(EDITABLE.map(name => [name, clone(ECO[name])]));
let cfg = fromGame(), profiles = clone(PROFILES), winRates = [], levelInfo = [], dirty = false;
// Giá gốc đang sửa (cfg.DECO) áp vào danh mục để mọi bảng + mô phỏng tính theo giá mới: dòng của chính món, không có thì của món gốc.
function applyPrices() {
  for (const entry of CATALOG) entry.basePrice = (cfg.DECO[entry.id] || cfg.DECO[entry.slot] || {}).price ?? 0;
}
applyPrices();

const AREAS = [['garden', 'Garden'], ...AREA_ORDER.map(area => [area, AREA_NAMES[area]])];
const areaOf = entry => (entry.area === 'garden2' ? 'garden2' : entry.zone);
const paid = CATALOG.filter(entry => entry.cat !== 'cats' && entry.basePrice > 0);
const isBase = entry => entry.cat === 'furniture' && !entry.slot;
const totals = area => {
  const list = paid.filter(entry => areaOf(entry) === area), price = entry => zonePrice(entry, cfg.ZONE_PRICE_MULT);
  const base = list.filter(isBase);
  return { base: base.reduce((t, e) => t + price(e), 0), baseN: base.length, all: list.reduce((t, e) => t + price(e), 0), allN: list.length };
};
// Món mở ở chặng nào: khu mở theo mốc màn (thắng mốc -> mua được từ màn mốc + 1), cộng lock của món.
const openLevel = entry => Math.max(1, (cfg.AREA_UNLOCK[areaOf(entry)]?.level ?? 0) + 1, entry.lock || 1);
const levelsCount = () => Math.max(10, Math.min(1e6, Math.round(Number($('viewLevels').value) || 100)));
const simLevels = () => Math.max(10, Number($('levels').value) || 100);
const reward = index => rewardFor(index, cfg);
// Tổng luỹ kế xu thưởng: cum[k] = tổng màn 1..k (tính lại khi đổi công thức / số màn) -> tổng một khoảng màn bất kỳ trong O(1).
let cum = new Float64Array(1);
function buildCum() {
  const n = levelsCount();
  cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + reward(i);
}
const sumLevels = (from, to) => cum[to] - cum[from - 1];

function markDirty() { dirty = true; $('saveStatus').textContent = '● chưa lưu'; }

// ---------- 1. Công thức ----------
// Mỗi hàng bảng gom bao nhiêu màn: tự động = từng màn khi xem ≤ 100 màn; nhiều hơn thì bội của 10 nhỏ nhất để bảng ≤ 20 hàng (300000 màn: 100000 / hàng).
function bucketSize(n) {
  const pick = Number($('bucket').value);
  if (pick) return pick;
  if (n <= 100) return 1;
  let size = 10;
  while (Math.ceil(n / size) > 20) size *= 10;
  return size;
}
function renderRangeTotal() {
  const n = levelsCount(), clamp = v => Math.max(1, Math.min(n, Math.round(Number(v) || 1)));
  const from = clamp($('rangeFrom').value), to = Math.max(from, clamp($('rangeTo').value));
  $('rangeTotal').textContent = `${fmt(sumLevels(from, to))} xu`;
  $('rangeNote').textContent = `(màn ${from.toLocaleString('en-US')} → ${to.toLocaleString('en-US')}, ${(to - from + 1).toLocaleString('en-US')} màn; chưa gồm ${fmt(cfg.START_COINS)} xu ban đầu${to > Number($('rangeTo').value) || from !== Number($('rangeFrom').value) ? ' · đã kẹp trong ' + n.toLocaleString('en-US') + ' màn xem' : ''})`;
}
function renderReward() {
  for (const input of document.querySelectorAll('[data-key]')) if (document.activeElement !== input) input.value = cfg[input.dataset.key];
  const n = levelsCount();
  buildCum();
  const idleAt = [cfg.IDLE_FROM_LEVEL, 30, 50].filter(l => l < n);
  $('idleInfo').textContent = `Xu tự sinh mỗi con mèo: ${idleAt.map(l => `ở màn ${l + 1} ≈ ${Math.round(idlePerHour(l, cfg))} xu/giờ, đầy ${idleCap(l, cfg)} xu`).join(' · ')} (nhân số mèo trong nhà, tối đa 6)`;
  $('rewardInfo').textContent = `Màn 1: ${fmt(reward(0))} · màn 10: ${fmt(reward(9))} · màn ${n.toLocaleString('en-US')}: ${fmt(reward(n - 1))} · tổng ${n.toLocaleString('en-US')} màn + xu ban đầu: ${fmt(cum[n] + cfg.START_COINS)} xu`;
  // Bảng Source (xu thưởng) + Sink (chỗ tiêu mới mở) theo khoảng màn; hàng gom bucketSize màn nên 300000 màn vẫn chỉ ~20 hàng.
  const size = bucketSize(n), price = e => zonePrice(e, cfg.ZONE_PRICE_MULT);
  const head = `<tr><th rowspan="2">Màn</th><th colspan="4" style="text-align:center">Source: xu thưởng (mỗi hàng ${size.toLocaleString('en-US')} màn)</th>
    <th colspan="5" style="text-align:center;border-left:2px solid var(--line)">Sink: chi tiêu mới mở trong khoảng</th></tr>
    <tr><th>Màn đầu</th><th>Màn cuối</th><th>Tổng khoảng</th><th>Luỹ kế<br><span class="muted">(+ xu ban đầu)</span></th>
    <th style="border-left:2px solid var(--line)">Mở khu</th><th>Đồ mặc định</th><th>Đồ full</th><th>Khu + mặc định</th><th>Khu + full</th></tr>`;
  const body = Array.from({ length: Math.ceil(n / size) }, (_, r) => {
    const from = r * size + 1, to = Math.min(n, (r + 1) * size), range = from === to ? from.toLocaleString('en-US') : `${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')}`;
    const opened = paid.filter(e => openLevel(e) >= from && openLevel(e) <= to);
    const areas = AREA_ORDER.filter(ar => cfg.AREA_UNLOCK[ar].level + 1 >= from && cfg.AREA_UNLOCK[ar].level + 1 <= to);
    const cost = areas.reduce((t, ar) => t + cfg.AREA_UNLOCK[ar].cost, 0);
    const base = opened.filter(isBase).reduce((t, e) => t + price(e), 0), full = opened.reduce((t, e) => t + price(e), 0);
    return `<tr><td>${range}</td><td>${fmt(reward(from - 1))}</td><td>${fmt(reward(to - 1))}</td>
      <td><b>${fmt(sumLevels(from, to))}</b></td><td>${fmt(cum[to] + cfg.START_COINS)}</td>
      <td style="border-left:2px solid var(--line)" title="${areas.map(ar => AREA_NAMES[ar]).join(', ')}">${cost ? fmt(cost) : '—'}</td><td>${base ? fmt(base) : '—'}</td><td>${full ? fmt(full) : '—'}</td>
      <td><b>${cost + base ? fmt(cost + base) : '—'}</b></td><td><b>${cost + full ? fmt(cost + full) : '—'}</b></td></tr>`;
  }).join('');
  $('rewardTable').innerHTML = head + body;
  renderRangeTotal();
}

// ---------- 2. Khu ----------
function renderAreas() {
  const rows = AREAS.map(([area, name]) => {
    const t = totals(area), gate = cfg.AREA_UNLOCK[area];
    return `<tr><td><b>${name}</b></td>
      <td>${gate ? `<input type="number" min="0" data-area="${area}" data-field="level" value="${gate.level}">` : 'có sẵn'}</td>
      <td>${gate ? `<input type="number" min="0" step="50" data-area="${area}" data-field="cost" value="${gate.cost}">` : '—'}</td>
      <td><input type="number" min="0.1" step="0.05" data-mult="${area}" value="${cfg.ZONE_PRICE_MULT[area] ?? 1}"></td>
      <td>${fmt(t.base)} <span class="muted">(${t.baseN})</span></td><td>${fmt(t.all)} <span class="muted">(${t.allN})</span></td></tr>`;
  }).join('');
  $('areaTable').innerHTML = `<tr><th>Khu</th><th>Màn mốc</th><th>Giá mở khu (xu)</th><th>Nhân giá đồ<br><span class="muted">(1.5 = đắt gấp rưỡi)</span></th><th>Tổng giá món mặc định<br><span class="muted">(số món)</span></th><th>Tổng giá mọi đồ<br><span class="muted">(+ kiểu khác, tường/sàn)</span></th></tr>${rows}`;
}

// ---------- 3. Stage ----------
function renderStages() {
  const n = levelsCount(), stages = Math.ceil(n / 10);
  let income = cfg.START_COINS, base = 0, all = 0, areaPaid = 0, prevLeft = null, rows = '';
  // Món mới mở theo chặng (tính một lần, không lọc lại cả danh mục mỗi chặng: 300000 màn = 30000 chặng).
  const openedAt = new Map();
  for (const e of paid) { const st = Math.ceil(openLevel(e) / 10); openedAt.set(st, [...(openedAt.get(st) || []), e]); }
  stageStats = { off: [], income: 0 };
  for (let s = 1; s <= stages; s++) {
    const from = (s - 1) * 10 + 1, to = Math.min(n, s * 10);
    let coins;
    coins = sumLevels(from, to);
    income += coins;
    const opened = openedAt.get(s) || [], price = e => zonePrice(e, cfg.ZONE_PRICE_MULT);
    const stageBase = opened.filter(isBase).reduce((t, e) => t + price(e), 0), stageAll = opened.reduce((t, e) => t + price(e), 0);
    base += stageBase; all += stageAll;
    const area = AREA_ORDER.find(a => Math.ceil((cfg.AREA_UNLOCK[a].level + 1) / 10) === s);
    // Khu có mốc màn trong chặng này được mua (trừ xu) ngay khi thắng mốc: xu còn lại để mua đồ = xu kiếm được − tiền mở khu đã trả.
    areaPaid += AREA_ORDER.filter(a => cfg.AREA_UNLOCK[a].level >= from && cfg.AREA_UNLOCK[a].level <= to).reduce((t, a) => t + cfg.AREA_UNLOCK[a].cost, 0);
    const left = base ? (income - areaPaid) / base : null;
    // Nên giảm dần qua từng chặng (khu sau khó mua đủ hơn): chặng tăng lại = dư xu; quá thấp = thiếu xu. Xanh = giảm (hoặc chặng đầu).
    const rise = left != null && prevLeft != null && left > prevLeft + .01, low = left != null && left < .25;
    if (rise || low) stageStats.off.push({ s, r: left, prev: prevLeft, kind: low ? 'low' : 'rise' });
    if (left != null) prevLeft = left;
    if (s === 1 || s === stages || opened.length || area) rows += `<tr><td>${s}</td><td>${from}–${to}</td><td>${area ? AREA_NAMES[area] : s === 1 ? 'Garden' : '—'}</td><td>${fmt(stageBase)}</td><td>${fmt(income)}</td><td>${left == null ? '—' : `<b class="${low ? 'warn' : rise ? 'mid' : 'ok'}">${Math.round(left * 100)}%</b>`}</td><td>${all ? Math.round(income / all * 100) + '%' : '—'}</td></tr>`;
  }
  stageStats.income = income;
  $('stageTable').innerHTML = `<tr><th>Chặng</th><th>Màn</th><th>Khu mới mở</th><th>Giá món mặc định<br>mới mở</th><th>Xu kiếm được<br>tới lúc này</th><th title="Xu kiếm được trừ tiền mở các khu đã mua, chia cho giá món mặc định đã mở. Nên giảm dần: khu sau khó mua đủ hơn.">Đủ mua món mặc định<br>sau khi trả tiền mở khu</th><th>Đủ mua mọi đồ<br>(tới lúc này)</th></tr>${rows}`;
  renderKpis();
}

// ---------- 4. Biến số ----------
function renderProfiles() {
  $('profileTable').innerHTML = `<tr><th>Kiểu người chơi</th><th>Lượt/ngày</th><th>Tay nghề</th><th>Mua</th><th>Nhận xu tự sinh<br>mấy lần / ngày</th><th>Nhịp chơi</th></tr>` + profiles.map((p, i) => `<tr>
    <td><input style="width:190px" data-p="${i}" data-f="name" value="${p.name}"></td>
    <td><input type="number" min="1" data-p="${i}" data-f="attempts" value="${p.attempts}"></td>
    <td><input type="number" min="0.1" step="0.1" data-p="${i}" data-f="skill" value="${p.skill}"></td>
    <td><select data-p="${i}" data-f="buy"><option${p.buy === 'base' ? ' selected' : ''} value="base">chỉ món mặc định</option><option${p.buy === 'all' ? ' selected' : ''} value="all">mọi kiểu + tường/sàn</option></select></td>
    <td><input type="number" min="1" max="12" data-p="${i}" data-f="claims" value="${p.claims ?? 2}"></td>
    <td><select data-p="${i}" data-f="pace">${[['weak', 'Yếu'], ['mid', 'Trung bình'], ['good', 'Giỏi']].map(([v, t]) => `<option${(p.pace ?? 'mid') === v ? ' selected' : ''} value="${v}">${t}</option>`).join('')}</select></td></tr>`).join('');
}

// ---------- 5. Mô phỏng ----------
// Vừa thắng màn mốc mà còn thiếu từ chừng này phần giá mở khu trở lên: tô vàng (khung Kết luận cũng dùng mốc này).
const SHORT_WARN = .5;
// Phút -> "4.5 phút" / "2 giờ 10 phút".
const playTime = min => (min < 60 ? `${Math.round(min * 10) / 10} phút` : `${Math.floor(min / 60)} giờ${Math.round(min % 60) ? ` ${Math.round(min % 60)} phút` : ''}`);
const COLORS = ['#3a9a5b', '#e07a2e', '#5a8fd6', '#b0559c', '#8a8075'];
function runSim() {
  const t0 = performance.now(), opts = { runs: Number($('runs').value) || 40, levels: simLevels(), maxDays: Number($('maxDays').value) || 200 };
  const results = profiles.map(p => simulateProfile(cfg, p, winRates, { ...opts, levelInfo }));
  const head = `<tr><th>Kiểu người chơi</th><th>Số ngày để<br>chơi hết ${opts.levels} màn</th><th>Thời gian chơi<br><span class="muted">mỗi màn · mỗi ngày · cả game</span></th>${AREA_ORDER.map(a => `<th>${AREA_NAMES[a]}<br><span class="muted">mở ngày · ở màn · thiếu xu lúc tới mốc</span></th>`).join('')}<th>Xu dư<br>cuối game</th><th>Đồ đã mua</th><th>Mua đủ đồ mặc định<br><span class="muted">ngày · ở màn · giờ chơi</span></th></tr>`;
  const rows = results.map((r, i) => `<tr><td><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COLORS[i % COLORS.length]}"></i> ${r.profile.name}</td>
    <td>${r.cleared < opts.levels ? `<span class="warn">kẹt màn ${r.cleared}</span>` : r.days}</td>
    <td>${playTime(r.minPerLevel)} · ${playTime(r.minPerDay)} · ${playTime(r.playMin)}</td>
    ${r.areas.map(a => `<td>${a.opened < 1 ? `<span class="warn">${Math.round(a.opened * 100)}% mở</span>` : `${a.day} · ${a.level} · <span class="${a.short >= cfg.AREA_UNLOCK[a.area].cost * SHORT_WARN ? 'mid' : 'muted'}">${a.short ? `thiếu ${fmt(a.short)} xu` : 'đủ xu'}</span>`}</td>`).join('')}
    <td>${fmt(r.wallet)}</td><td>${r.owned}/${r.shopSize}</td>
    <td>${r.fullBase.rate < 1 ? `<span class="warn">${Math.round(r.fullBase.rate * 100)}% mua đủ</span>` : `ngày ${r.fullBase.day} · màn ${r.fullBase.level} · ${playTime(r.fullBase.playMin)}`}</td></tr>`).join('');
  $('simTable').innerHTML = head + rows;
  // Kết luận chung cho cả 4 kiểu + kết luận từng kiểu (dưới bảng).
  const all = profilesSummary(results, cfg, opts.levels);
  $('profilesSummary').innerHTML = `<b>Kết luận chung</b> <span class="${all.ok ? 'ok' : 'mid'}">${all.ok ? 'Ổn' : 'Cần chú ý'}</span><ul>${all.lines.map(line => `<li>${line}</li>`).join('')}</ul>`;
  $('profileNotes').innerHTML = results.map((r, i) => {
    const v = profileVerdict(r, cfg, opts.levels);
    return `<div class="profile-note"><b><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COLORS[i % COLORS.length]}"></i> ${r.profile.name}</b>
      <span class="${v.ok ? 'ok' : 'mid'}">${v.ok ? 'Ổn' : 'Cần chú ý'}</span><ul>${v.lines.map(line => `<li>${line}</li>`).join('')}</ul></div>`;
  }).join('');
  // Ví theo màn: ví phình đều = xu thừa (không có gì để mua); ví về ~0 liên tục = thiếu xu.
  const W = 600, H = 170, max = Math.max(1, ...results.flatMap(r => r.walletByLevel.filter(v => v != null)));
  const lines = results.map((r, i) => `<polyline fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="2" points="${r.walletByLevel.map((v, l) => v == null ? '' : `${l / opts.levels * W},${H - v / max * (H - 12)}`).join(' ')}"/>`).join('');
  const gates = AREA_ORDER.map((a, i) => { const x = cfg.AREA_UNLOCK[a].level / opts.levels * W; return `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="#e4ddd2" stroke-dasharray="3 3"/><text x="${x + 2}" y="${24 + i * 12}">${AREA_NAMES[a]}</text>`; }).join('');
  $('walletChart').innerHTML = `<div class="muted">Xu trong ví theo màn đã thắng (người chơi điển hình)</div><svg viewBox="0 -2 ${W} ${H + 4}">${gates}${lines}<text x="2" y="10">${fmt(max)} xu</text></svg>`;
  $('runInfo').textContent = `${opts.runs} người ảo × ${profiles.length} kiểu · ${Math.round(performance.now() - t0)} ms`;
  simResults = results;
  renderOverview();
  renderKpis();
}

// ---------- Kết luận tự động: chấm điểm cân bằng từ bảng chặng + mô phỏng, viết bằng lời dễ hiểu ----------
function renderVerdict() {
  if (!simResults) return;
  const avg = simResults.find(r => r.profile.id === 'average') ?? simResults[0];
  const v = economyVerdict({ off: stageStats.off, avg, others: simResults.filter(r => r !== avg), cfg });
  const list = (items, empty) => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;
  const tone = v.score >= 8 ? 'ok' : v.score >= 5 ? 'mid' : 'warn';
  $('verdict').innerHTML = `<h3>Kết luận: <span class="${tone}">${v.label} · ${v.score}/10</span></h3>`
    + `<h3>Điểm ổn</h3>${list(v.good, 'Chưa có điểm nào ổn.')}<h3>Vấn đề</h3>${list(v.issues, 'Không thấy vấn đề.')}<h3>Nên sửa</h3>${list(v.fixes, 'Giữ nguyên bộ số.')}`;
}

// ---------- Tổng quan Gold (bảng trên cùng): nguồn xu + chỗ tiêu theo từng khu ----------
function renderOverview() {
  const n = levelsCount(), price = e => zonePrice(e, cfg.ZONE_PRICE_MULT);
  let levelGold = 0;
  for (let i = 0; i < n; i++) levelGold += reward(i);
  const avg = simResults?.find(r => r.profile.id === 'average') ?? simResults?.[0];
  // Xu tự sinh của MỘT con mèo: lúc vừa mở tính năng -> màn cuối (xu / giờ và xu / giây).
  const idleFrom = idlePerHour(cfg.IDLE_FROM_LEVEL, cfg), idleTo = idlePerHour(n - 1, cfg);
  const perSec = v => (v / 3600).toFixed(4);
  // Kiểu khác thứ k của mỗi chỗ đặt: theo thứ tự khai báo trong danh mục (món gốc = Default).
  const optionsOf = area => {
    const bases = CATALOG.filter(e => e.cat === 'furniture' && !e.slot && areaOf(e) === area);
    return bases.map(base => [base, ...CATALOG.filter(e => e.slot === base.id)]);
  };
  const maxOptions = Math.max(...AREAS.map(([area]) => Math.max(1, ...optionsOf(area).map(list => list.length))));
  const cell = list => (list.length ? `${list.length} món · ${fmt(list.reduce((t, e) => t + price(e), 0))} xu` : '—');
  const levelCols = Array.from({ length: maxOptions - 1 }, (_, k) => k + 2);
  let assetTotal = 0;
  const rows = AREAS.map(([area, name], i) => {
    const slots = optionsOf(area), all = CATALOG.filter(e => e.cat !== 'cats' && areaOf(e) === area);
    const asset = all.reduce((t, e) => t + price(e), 0);
    assetTotal += asset;
    const unlock = cfg.AREA_UNLOCK[area];
    return `<tr><td>${i + 1}. ${name}</td><td>${unlock ? `màn ${unlock.level} · ${fmt(unlock.cost)} xu` : 'có sẵn'}</td><td><b>${fmt(asset)}</b></td>
      <td>${cell(slots.map(list => list[0]))}</td>${levelCols.map(k => `<td>${cell(slots.map(list => list[k - 1]).filter(Boolean))}</td>`).join('')}</tr>`;
  }).join('');
  const unlockTotal = AREA_ORDER.reduce((t, a) => t + cfg.AREA_UNLOCK[a].cost, 0);
  const span = 3 + levelCols.length;
  $('overviewTable').innerHTML = `<tr><th colspan="${span + 1}" style="text-align:left">Gold</th></tr>
    <tr><th>Source</th><th>Số lượng</th><th>Total Gold</th><th colspan="${span - 2}"></th></tr>
    <tr><td>Màn chơi</td><td>${n} màn</td><td><b>${fmt(levelGold)}</b></td><td colspan="${span - 2}" class="muted" style="text-align:left">xu thưởng thắng lần đầu mọi màn${cfg.START_COINS ? ` + ${fmt(cfg.START_COINS)} xu ban đầu` : ''}</td></tr>
    <tr><td>Idle</td><td>${perSec(idleFrom)}–${perSec(idleTo)} Gold/s / mèo</td><td><b>${avg ? fmt(avg.idleEarned) : '…'}</b></td><td colspan="${span - 2}" class="muted" style="text-align:left">≈ ${Math.round(idleFrom)}–${Math.round(idleTo)} xu / giờ mỗi mèo (màn ${cfg.IDLE_FROM_LEVEL + 1} → màn ${n}), tối đa 6 mèo · tổng cả game của người chơi ảo Trung bình (tab Mô phỏng)</td></tr>
    <tr><th>Sink</th><th colspan="${span}"></th></tr>
    <tr><th rowspan="2">Deco</th><th rowspan="2">Mở khu</th><th rowspan="2">Total Asset</th><th rowspan="2">Default</th><th colspan="${levelCols.length}" style="text-align:center">Nâng cấp</th></tr>
    <tr>${levelCols.map(k => `<th>${k}</th>`).join('')}</tr>${rows}
    <tr><td><b>Tổng</b></td><td><b>${fmt(unlockTotal)} xu</b></td><td><b>${fmt(assetTotal)}</b></td><td colspan="${span - 2}" class="muted" style="text-align:left">Tổng chỗ tiêu = mở khu + mọi đồ = ${fmt(unlockTotal + assetTotal)} xu (chưa tính booster)</td></tr>`;
}

function renderAll() { renderReward(); renderAreas(); renderStages(); renderOverview(); buildFlow(); renderFlow(); }

// ---------- Tóm tắt (thẻ số trên cùng): đọc nhanh bộ số đang sửa có ổn không ----------
let stageStats = { off: [], income: 0 }, simResults = null;
function renderKpis() {
  const avg = simResults?.find(r => r.profile.id === 'average') ?? simResults?.[0];
  const card = (title, value, note, tone = '') => `<div class="kpi ${tone}"><small>${title}</small><b>${value}</b><small>${note}</small></div>`;
  $('kpis').innerHTML = [
    card('Tổng xu cả game', fmt(stageStats.income), `${levelsCount()} màn + xu ban đầu`),
    avg ? card(`Xu dư cuối game (${avg.profile.name})`, fmt(avg.wallet), avg.wallet > 2000 ? 'thừa xu: thêm đồ để mua / giảm mức tăng xu' : 'ổn', avg.wallet > 2000 ? 'bad' : 'good') : '',
    avg ? card(`Xu tự sinh chiếm (${avg.profile.name})`, `${Math.round(avg.idleShare * 100)}%`, `${fmt(avg.idleEarned)} xu cả game · nên 5–15%`, avg.idleShare > .15 ? 'bad' : avg.idleShare >= .05 ? 'good' : '') : '',
  ].join('');
  renderVerdict();
}
// Sửa số thì tự chạy lại mô phỏng (vài chục ms), chờ ngừng gõ một chút.
let simTimer = 0;
const scheduleSim = () => { clearTimeout(simTimer); simTimer = setTimeout(runSim, 250); };

// ---------- Sơ đồ dòng xu (kiểu Machinations): Nguồn → Ví → Cổng mở khu → Chỗ tiêu, chạy từng màn ----------
let flowSteps = [], flowTimer = 0;
const ROW = 64, FLOW_TOP = 52;
const flowRows = () => AREAS.map(([area, name], i) => ({ area, name, y: FLOW_TOP + 20 + i * ROW }));
function buildFlow() {
  const hours = Math.max(0, Number($('flowHours').value) || 0), cats = Math.max(1, Math.min(6, Number($('flowCats').value) || 1));
  const items = paid.filter(isBase).map(e => ({ area: areaOf(e), price: zonePrice(e, cfg.ZONE_PRICE_MULT), open: openLevel(e) }));
  flowSteps = runFlow({ start: cfg.START_COINS, levels: levelsCount(), reward, idle: i => Math.min(idleCap(i, cfg), idlePerHour(i, cfg) * hours) * cats,
    gates: cfg.AREA_UNLOCK, order: AREA_ORDER, items });
  $('flowLevel').max = flowSteps.length - 1;
}
// Màu theo loại nút (kiểu Machinations): nguồn xanh lá / xanh dương, ví cam, cổng cam đất, chỗ tiêu đỏ.
const FC = { win: '#2f9e5e', start: '#2f9e5e', idle: '#4a86d8', gate: '#e07a2e', sink: '#d0483d', idleEdge: '#c9bdab' };
// Dây cong + nhãn dạng viên thuốc; có xu chảy ở bước này thì dây đậm màu + đồng xu chạy dọc dây.
function flowEdge(x1, y1, x2, y2, now, total, color, id, t = .5) {
  const mx = (x1 + x2) / 2, d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, live = now > 0;
  const w = total > 0 ? 2.5 + Math.min(7, Math.log10(1 + total) * 1.2) : 1.5, stroke = live ? color : total ? '#cdbfae' : '#e2d9cc';
  const coins = live ? [0, .22, .44].map(b => `<circle r="6" fill="url(#coin)" stroke="#a46d00" stroke-width="1.2"><animateMotion dur="1s" begin="${b}s" fill="freeze" path="${d}"/><animate attributeName="opacity" values="1;1;0" dur="1s" begin="${b}s" fill="freeze"/></circle>`).join('') : '';
  const text = total ? `${live ? '+' + fmt(now) + '  ·  ' : ''}${fmt(total)}` : '', tw = text.length * 6.4 + 16, u = 1 - t, b = 3 * u * t;
  const lx = u ** 3 * x1 + b * mx + t ** 3 * x2, ly = (u ** 3 + b * u) * y1 + (b * t + t ** 3) * y2;
  const label = text ? `<g transform="translate(${lx},${ly})"><rect x="${-tw / 2}" y="-10" width="${tw}" height="20" rx="10" fill="${live ? color : '#fff'}" stroke="${live ? color : '#e2d9cc'}"/>
    <text class="edge-lbl" y="4" text-anchor="middle" style="fill:${live ? '#fff' : '#6f6559'}">${text}</text></g>` : '';
  return { line: `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${total ? '' : 'stroke-dasharray="4 6"'} marker-end="url(#arr-${live ? id : total ? 'on' : 'off'})"/>${coins}`, label };
}
function renderFlow() {
  if (!flowSteps.length) return;
  const k = Math.min(Number($('flowLevel').value) || 0, flowSteps.length - 1), s = flowSteps[k], rows = flowRows();
  const H = rows.at(-1).y + 46, poolY = (rows[0].y + rows.at(-1).y) / 2, PX = 400, PR = 76, GX = 660, SX = 790;
  $('flowAt').textContent = `Màn ${k}`;
  const src = [['start', '🪙', 'Xu ban đầu', `${fmt(cfg.START_COINS)} xu`], ['win', '🏆', 'Thắng màn', `màn kế +${fmt(reward(k))}`], ['idle', '🐱', 'Mèo tự sinh', `từ màn ${cfg.IDLE_FROM_LEVEL}`]]
    .map(([id, icon, name, sub], i) => ({ id, icon, name, sub, color: FC[id], x: 40, y: poolY + (i - 1) * 140 }));
  const lines = [], labels = [];
  const edge = (...a) => { const e = flowEdge(...a); lines.push(e.line); labels.push(e.label); };
  let nodes = '';
  for (const n of src) {
    edge(n.x + 190, n.y, PX - PR - 4, poolY, s.gain[n.id], s.tot[n.id], n.color, n.id === 'idle' ? 'idle' : 'win', .25);
    const live = s.gain[n.id] > 0;
    nodes += `<g class="node" data-node="${n.id}"><rect x="${n.x}" y="${n.y - 32}" width="190" height="64" rx="14" fill="#fff" stroke="${n.color}" stroke-width="${live ? 3 : 1.5}" filter="url(#sh)"/>
      <path d="M${n.x + 34},${n.y - 20} L${n.x + 56},${n.y + 18} L${n.x + 12},${n.y + 18} Z" fill="${n.color}" opacity=".16" stroke="${n.color}" stroke-width="2" stroke-linejoin="round"/>
      <text x="${n.x + 34}" y="${n.y + 11}" text-anchor="middle" style="font-size:15px">${n.icon}</text>
      <text class="lbl" x="${n.x + 68}" y="${n.y - 3}">${n.name}</text><text class="sub" x="${n.x + 68}" y="${n.y + 15}">${n.sub}</text></g>`;
  }
  const spent = Object.values(s.tot.pay).reduce((t, p) => t + p.gate + p.deco, 0);
  nodes += `<g class="node" data-node="pool"><circle cx="${PX}" cy="${poolY}" r="${PR + 10}" fill="#e07a2e" opacity=".08"/>
    <circle cx="${PX}" cy="${poolY}" r="${PR}" fill="url(#pool)" stroke="#e07a2e" stroke-width="4" filter="url(#sh)"/>
    <text x="${PX}" y="${poolY - 30}" text-anchor="middle" style="font-size:20px">👛</text>
    <text class="val" x="${PX}" y="${poolY + 4}" text-anchor="middle">${fmt(s.wallet)}</text><text class="sub" x="${PX}" y="${poolY + 22}" text-anchor="middle">xu trong ví</text>
    <text class="sub" x="${PX}" y="${poolY + 40}" text-anchor="middle" style="fill:#d0483d">đã tiêu ${fmt(spent)}</text></g>`;
  for (const r of rows) {
    const gate = cfg.AREA_UNLOCK[r.area], open = s.opened.includes(r.area), pay = s.pay[r.area] ?? { gate: 0, deco: 0 }, tot = s.tot.pay[r.area] ?? { gate: 0, deco: 0 };
    const all = totals(r.area).base, done = all ? Math.min(1, tot.deco / all) : 1, live = pay.deco > 0, dim = gate && !open;
    if (gate) {
      edge(PX + PR, poolY, GX - 28, r.y, pay.gate, tot.gate, FC.gate, 'gate', .78);
      edge(GX + 28, r.y, SX - 4, r.y, pay.deco, tot.deco, FC.sink, 'sink');
      nodes += `<g class="node" data-node="gate" data-area="${r.area}"><path d="M${GX},${r.y - 25} L${GX + 25},${r.y} L${GX},${r.y + 25} L${GX - 25},${r.y} Z" fill="${open ? '#fde6d3' : '#efe9e0'}" stroke="${open ? FC.gate : '#b3a594'}" stroke-width="${pay.gate ? 3.5 : 2}" stroke-linejoin="round" filter="url(#sh)"/>
        <text x="${GX}" y="${r.y + 5}" text-anchor="middle" style="font-size:13px">${open ? '✓' : '🔒'}</text>
        <text class="sub" x="${GX}" y="${r.y + 39}" text-anchor="middle">màn ${gate.level} · ${fmt(gate.cost)}</text></g>`;
    } else edge(PX + PR, poolY, SX - 4, r.y, pay.deco, tot.deco, FC.sink, 'sink', .78);
    const bar = 150, color = done >= 1 ? '#2f9e5e' : FC.sink;
    nodes += `<g class="node" data-node="sink" data-area="${r.area}" opacity="${dim ? .6 : 1}"><rect x="${SX}" y="${r.y - 25}" width="330" height="50" rx="12" fill="#fff" stroke="${live ? FC.sink : '#e2d9cc'}" stroke-width="${live ? 3 : 1.5}" filter="url(#sh)"/>
      <path d="M${SX + 12},${r.y - 12} L${SX + 40},${r.y - 12} L${SX + 26},${r.y + 13} Z" fill="${FC.sink}" opacity=".18" stroke="${FC.sink}" stroke-width="2" stroke-linejoin="round"/>
      <text class="lbl" x="${SX + 52}" y="${r.y - 3}">${r.name}</text><text class="sub" x="${SX + 52}" y="${r.y + 14}">${done >= 1 ? '✓ mua đủ' : `${fmt(tot.deco)} / ${fmt(all)} xu`}</text>
      <rect x="${SX + 166}" y="${r.y - 5}" width="${bar}" height="10" rx="5" fill="#f1ebe2"/><rect x="${SX + 166}" y="${r.y - 5}" width="${Math.max(done ? 10 : 0, bar * done)}" height="10" rx="5" fill="${color}"/></g>`;
  }
  const lanes = [[20, 230, 'NGUỒN'], [PX - 110, 220, 'VÍ'], [GX - 55, 110, 'CỔNG MỞ KHU'], [SX - 10, 350, 'CHỖ TIÊU · đồ mặc định']]
    .map(([x, w, t]) => `<rect x="${x}" y="8" width="${w}" height="${H - 16}" rx="16" fill="#fff" opacity=".55"/><rect x="${x + w / 2 - t.length * 3.6 - 12}" y="16" width="${t.length * 7.2 + 24}" height="22" rx="11" fill="#3a2f25"/><text x="${x + w / 2}" y="31" text-anchor="middle" style="fill:#fff;font-size:11px;font-weight:700;letter-spacing:.05em">${t}</text>`).join('');
  const marker = (id, c) => `<marker id="arr-${id}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" orient="auto"><path d="M1,1 L9,5 L1,9 Z" fill="${c}" stroke="${c}" stroke-linejoin="round"/></marker>`;
  $('flowSvg').innerHTML = `<svg viewBox="0 0 1150 ${H}"><defs>
    ${marker('on', '#cdbfae')}${marker('off', '#e2d9cc')}${marker('win', FC.win)}${marker('idle', FC.idle)}${marker('gate', FC.gate)}${marker('sink', FC.sink)}
    <filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#3a2f25" flood-opacity=".14"/></filter>
    <radialGradient id="pool" cx=".4" cy=".35"><stop offset="0" stop-color="#fffaf2"/><stop offset="1" stop-color="#fde3c8"/></radialGradient>
    <radialGradient id="coin" cx=".35" cy=".35"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#f0a800"/></radialGradient></defs>
    ${lanes}${lines.join('')}${nodes}${labels.join('')}</svg>`;
  // Đường ví theo màn (vùng tô) + vạch màn đang xem.
  const W = 1000, SH = 70, max = Math.max(1, ...flowSteps.map(x => x.wallet)), x = i => i / (flowSteps.length - 1) * W, y = v => SH - v / max * (SH - 8);
  const pts = flowSteps.map((p, i) => `${x(i)},${y(p.wallet)}`).join(' ');
  $('flowSpark').innerHTML = `<div class="muted">Ví theo màn (đỉnh ${fmt(max)} xu) — bấm để nhảy tới màn</div><svg viewBox="0 0 ${W} ${SH}" preserveAspectRatio="none" style="height:80px;cursor:pointer;background:#fff;border:1px solid var(--line);border-radius:10px">
    <polygon points="0,${SH} ${pts} ${W},${SH}" fill="#e07a2e" opacity=".15"/><polyline fill="none" stroke="#e07a2e" stroke-width="2" points="${pts}"/>
    <line x1="${x(k)}" x2="${x(k)}" y1="0" y2="${SH}" stroke="#3a2f25" stroke-width="2"/><circle cx="${x(k)}" cy="${y(s.wallet)}" r="5" fill="#3a2f25"/></svg>`;
}
// Bấm nút trên sơ đồ: mở bảng sửa số đúng của nút đó (ô nhập dùng chung data-key / data-area / data-mult với tab Cân bằng xu).
function openFlowPop(g) {
  const { node, area } = g.dataset, name = AREAS.find(a => a[0] === area)?.[1];
  const num = (label, attrs, value, step = 1) => `<label>${label}<input type="number" step="${step}" min="0" ${attrs} value="${value}"></label>`;
  const key = (label, k, step) => num(`${label} <span class="code">${k}</span>`, `data-key="${k}"`, cfg[k], step);
  const body = {
    start: () => ['Xu ban đầu', key('Xu có sẵn khi vào game', 'START_COINS', 10)],
    win: () => ['Thắng màn', key('Xu màn 1', 'REWARD_BASE', 10) + key('Xu tăng thêm mỗi màn', 'REWARD_STEP', 5) + key('Tăng bước mỗi cụm 10 màn', 'REWARD_GROWTH', .01)],
    idle: () => ['Mèo tự sinh', key('Tỉ lệ idle (× xu màn / giờ)', 'IDLE_RATE', .01) + key('Giờ tích tối đa', 'IDLE_CAP_HOURS', 1) + key('Bắt đầu từ màn', 'IDLE_FROM_LEVEL', 1)],
    pool: () => ['Ví xu', '<p class="hint" style="margin:0">Ví = xu vào − xu ra. Sửa các nút Nguồn / Cổng / Chỗ tiêu để đổi dòng chảy.</p>'],
    gate: () => [`Mở ${name}`, num('Màn mốc', `data-area="${area}" data-field="level"`, cfg.AREA_UNLOCK[area].level) + num('Giá mở khu (xu)', `data-area="${area}" data-field="cost"`, cfg.AREA_UNLOCK[area].cost, 50)],
    sink: () => [`Đồ ${name}`, num('Nhân giá đồ của khu', `data-mult="${area}"`, cfg.ZONE_PRICE_MULT[area] ?? 1, .05) + `<p class="hint" style="margin:0">Giá từng món sửa ở tab Cân bằng xu (bảng giá).</p>`],
  }[node]();
  const pop = $('flowPop'), box = g.getBoundingClientRect(), wrap = $('flowWrap').getBoundingClientRect();
  pop.innerHTML = `<h3>${body[0]}<button type="button" aria-label="Đóng">✕</button></h3>${body[1]}`;
  pop.hidden = false;
  pop.style.left = `${Math.min(wrap.width - 240, Math.max(4, box.right - wrap.left + $('flowWrap').scrollLeft + 8))}px`;
  pop.style.top = `${Math.max(4, box.top - wrap.top)}px`;
  pop.querySelector('button').onclick = () => { pop.hidden = true; };
}
$('flowSvg').addEventListener('click', event => { const g = event.target.closest('.node'); if (g) openFlowPop(g); });
$('flowSpark').addEventListener('click', event => {
  const svg = event.target.closest('svg'); if (!svg) return;
  const box = svg.getBoundingClientRect();
  $('flowLevel').value = Math.round((event.clientX - box.left) / box.width * (flowSteps.length - 1)); renderFlow();
});
const flowGo = k => { $('flowLevel').value = Math.max(0, Math.min(flowSteps.length - 1, k)); renderFlow(); };
const flowStop = () => { clearInterval(flowTimer); flowTimer = 0; $('flowPlay').textContent = '▶ Chạy'; };
$('flowStep').onclick = () => { flowStop(); flowGo(Number($('flowLevel').value) + 1); };
$('flowBack').onclick = () => { flowStop(); flowGo(Number($('flowLevel').value) - 1); };
$('flowReset').onclick = () => { flowStop(); flowGo(0); };
$('flowPlay').onclick = () => {
  if (flowTimer) return flowStop();
  if (Number($('flowLevel').value) >= flowSteps.length - 1) flowGo(0);
  $('flowPlay').textContent = '⏸ Dừng';
  flowTimer = setInterval(() => { const k = Number($('flowLevel').value) + 1; if (k >= flowSteps.length) return flowStop(); flowGo(k); }, 700);
};
$('flowLevel').oninput = () => { flowStop(); renderFlow(); };

// ---------- Sự kiện ----------
document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'flowLevel') return;
  if (el.id === 'flowHours' || el.id === 'flowCats') { buildFlow(); return renderFlow(); }
  if (el.dataset.key) { cfg[el.dataset.key] = Number(el.value); markDirty(); renderReward(); renderStages(); }
  else if (el.dataset.area) { cfg.AREA_UNLOCK[el.dataset.area][el.dataset.field] = Number(el.value); markDirty(); renderStages(); }
  else if (el.dataset.mult) { cfg.ZONE_PRICE_MULT[el.dataset.mult] = Number(el.value); markDirty(); renderStages(); }
  if (el.dataset.key || el.dataset.area || el.dataset.mult) { buildFlow(); renderFlow(); }
  if (el.dataset.p) { const p = profiles[el.dataset.p]; p[el.dataset.f] = ['name', 'buy', 'pace'].includes(el.dataset.f) ? el.value : Number(el.value); }
  else if (el.id === 'viewLevels' || el.id === 'bucket') return renderAll();
  else if (el.id === 'rangeFrom' || el.id === 'rangeTo') {
    // Gõ "tới màn" quá số màn đang xem: nới cả board (bảng, biểu đồ, tổng quan) tới màn đó luôn.
    const want = Math.max(Number($('rangeFrom').value) || 0, Number($('rangeTo').value) || 0);
    if (want > levelsCount() && want <= 1e6) { $('viewLevels').value = Math.round(want); return renderAll(); }
    return renderRangeTotal();
  }
  scheduleSim();
});
// Bảng khu vẽ lại khi rời ô (vẽ lại lúc đang gõ làm mất con trỏ).
document.addEventListener('change', event => { if (event.target.dataset.area || event.target.dataset.mult) renderAreas(); });
// Tab con: Cân bằng xu / Mô phỏng người chơi ảo (mô phỏng vẫn chạy nền để thẻ tóm tắt + kết luận ở tab Cân bằng có số).
for (const button of document.querySelectorAll('[data-subtab]')) button.onclick = () => {
  document.querySelectorAll('[data-subtab]').forEach(b => b.classList.toggle('on', b === button));
  document.querySelectorAll('[data-pane]').forEach(pane => { pane.hidden = pane.dataset.pane !== button.dataset.subtab; });
};
$('btnRun').onclick = runSim;
$('btnReset').onclick = () => { cfg = fromGame(); applyPrices(); dirty = false; $('saveStatus').textContent = ''; renderAll(); };
$('btnSave').onclick = async () => {
  const bad = Object.entries(cfg).some(([, v]) => JSON.stringify(v).includes('null'));
  if (bad) return void ($('saveStatus').textContent = '⚠ có ô trống / không phải số');
  $('saveStatus').textContent = 'Đang lưu…';
  try {
    const res = await fetch('/api/save-economy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values: cfg }) });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error);
    dirty = false;
    $('saveStatus').textContent = '✓ Đã lưu vào economy.mjs — chạy npm run economy && npm run firebase:template để cập nhật báo cáo / template';
  } catch (error) {
    $('saveStatus').textContent = `⚠ Không lưu được: ${error.message} (mở editor bằng npm run editor hoặc npm start)`;
  }
};
window.addEventListener('beforeunload', event => { if (dirty) event.preventDefault(); });

try {
  const baseline = (await (await fetch('../baseline.json')).json()).levels;
  winRates = baseline.map(level => level.winRate);
  levelInfo = baseline.map(({ moves, movesUsedWin, movesUsedLoss, secWin, secLoss, tier }) => ({ moves, movesUsedWin, movesUsedLoss, secWin, secLoss, tier }));
} catch {
  winRates = [];
}
$('status').textContent = winRates.length ? `Tỉ lệ thắng bot: ${winRates.length} màn (tools/baseline.json)` : '⚠ Không đọc được tools/baseline.json — mô phỏng coi mọi màn thắng 50%';
if (!winRates.length) winRates = [.5];
renderAll();
renderProfiles();
runSim();
