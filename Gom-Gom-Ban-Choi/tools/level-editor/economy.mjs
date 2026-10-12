// Level Editor — tab Economy: sửa công thức xu mỗi màn, mốc mở khu, hệ số giá khu; xem cân bằng theo stage ngay khi sửa;
// chạy mô phỏng người ảo (tools/economy-sim.mjs); lưu thẳng vào game/gameplay/economy.mjs (POST /api/save-economy).
// Dùng đúng code game (rewardFor, zonePrice, areaState...), chỉ truyền bộ số đang sửa.
import * as ECO from '../../game/gameplay/economy.mjs';
import { rewardFor } from '../../game/gameplay/progression.mjs';
import { CATALOG, AREA_ORDER, AREA_NAMES, zonePrice } from '../../game/deco/deco-data.mjs';
import { EDITABLE, PROFILES, simulateProfile } from '../economy-sim.mjs';
import { economyVerdict, profileVerdict, profilesSummary } from '../economy-verdict.mjs';
import { idlePerHour, idleCap } from '../../game/gameplay/idle.mjs';

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
const levelsCount = () => Math.max(10, Number($('levels').value) || 100);
const reward = index => rewardFor(index, cfg);

function markDirty() { dirty = true; $('saveStatus').textContent = '● chưa lưu'; }

// ---------- 1. Công thức ----------
function renderReward() {
  for (const input of document.querySelectorAll('[data-key]')) if (document.activeElement !== input) input.value = cfg[input.dataset.key];
  const n = levelsCount(), values = Array.from({ length: n }, (_, i) => reward(i)), max = Math.max(...values, 1);
  const W = 600, H = 150, bw = W / n;
  const bars = values.map((v, i) => `<rect x="${i * bw}" y="${H - v / max * (H - 14)}" width="${Math.max(1, bw - 1)}" height="${v / max * (H - 14)}" fill="${(i + 1) % 10 ? '#e7b27f' : '#e07a2e'}"><title>Màn ${i + 1}: ${v} xu</title></rect>`).join('');
  const ticks = [1, ...Array.from({ length: Math.floor(n / 10) }, (_, k) => (k + 1) * 10)].map(l => `<text x="${(l - .5) * bw}" y="${H + 11}" text-anchor="middle">${l}</text>`).join('');
  $('rewardChart').innerHTML = `<svg viewBox="0 -2 ${W} ${H + 16}">${bars}<text x="2" y="10">${max} xu</text>${ticks}</svg>`;
  const total = values.reduce((a, b) => a + b, 0) + cfg.START_COINS;
  const idleAt = [cfg.IDLE_FROM_LEVEL, 30, 50].filter(l => l < n);
  $('idleInfo').textContent = `Xu tự sinh mỗi con mèo: ${idleAt.map(l => `ở màn ${l + 1} ≈ ${Math.round(idlePerHour(l, cfg))} xu/giờ, đầy ${idleCap(l, cfg)} xu`).join(' · ')} (nhân số mèo trong nhà, tối đa 6)`;
  $('rewardInfo').textContent = `Màn 1: ${values[0]} · màn 10 (boss): ${values[9]} · màn 50: ${values[49] ?? '—'} · màn ${n}: ${values[n - 1]} · tổng ${n} màn + xu ban đầu: ${fmt(total)} xu`;
  // Bảng xu thưởng từng màn (Source) + chỗ tiêu mới mở trong chặng (Sink): mỗi hàng một chặng 10 màn, màn boss tô đậm.
  // Sink: giá mở khu mới + đồ mặc định mới mở (món đầu mỗi chỗ đặt) / đồ full (thêm kiểu khác, tường / sàn) của chặng đó.
  const price = e => zonePrice(e, cfg.ZONE_PRICE_MULT);
  const head = `<tr><th rowspan="2">Chặng</th><th colspan="11" style="text-align:center">Source: xu thưởng từng màn</th>
    <th colspan="5" style="text-align:center;border-left:2px solid var(--line)">Sink: chi tiêu mới mở trong chặng</th></tr>
    <tr>${Array.from({ length: 10 }, (_, k) => `<th>+${k + 1}</th>`).join('')}<th>Tổng chặng</th>
    <th style="border-left:2px solid var(--line)">Mở khu</th><th>Đồ mặc định</th><th>Đồ full</th><th>Khu + mặc định</th><th>Khu + full</th></tr>`;
  const body = Array.from({ length: Math.ceil(n / 10) }, (_, s) => {
    const row = values.slice(s * 10, s * 10 + 10), got = row.reduce((a, b) => a + b, 0);
    const opened = paid.filter(e => Math.ceil(openLevel(e) / 10) === s + 1);
    const area = AREA_ORDER.find(a => Math.ceil((cfg.AREA_UNLOCK[a].level + 1) / 10) === s + 1), cost = area ? cfg.AREA_UNLOCK[area].cost : 0;
    const base = opened.filter(isBase).reduce((t, e) => t + price(e), 0), full = opened.reduce((t, e) => t + price(e), 0);
    return `<tr><td>Màn ${s * 10 + 1}–${s * 10 + row.length}</td>${row.map((v, k) => `<td${(s * 10 + k + 1) % 10 ? '' : ' style="color:#e07a2e;font-weight:700" title="màn boss"'}>${fmt(v)}</td>`).join('')}<td><b>${fmt(got)}</b></td>
      <td style="border-left:2px solid var(--line)" title="${area ? AREA_NAMES[area] : ''}">${area ? fmt(cost) : '—'}</td><td>${fmt(base)}</td><td>${fmt(full)}</td><td><b>${fmt(cost + base)}</b></td><td><b>${fmt(cost + full)}</b></td></tr>`;
  }).join('');
  $('rewardTable').innerHTML = head + body;
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
const ratioClass = r => (r >= .85 && r <= 1.15 ? 'ok' : r >= .7 && r <= 1.4 ? 'mid' : 'warn');
function renderStages() {
  const n = levelsCount(), stages = Math.ceil(n / 10);
  let income = cfg.START_COINS, base = 0, all = 0, areaPaid = 0, prevLeft = null, rows = '', itemRows = '';
  stageStats = { off: [], income: 0 };
  for (let s = 1; s <= stages; s++) {
    const from = (s - 1) * 10 + 1, to = Math.min(n, s * 10);
    let coins = 0;
    for (let l = from; l <= to; l++) coins += reward(l - 1);
    income += coins;
    const opened = paid.filter(e => Math.ceil(openLevel(e) / 10) === s), price = e => zonePrice(e, cfg.ZONE_PRICE_MULT);
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
    // Bảng chi tiết: xu nhận trong lô so với giá mở khu + giá mọi đồ mới mở trong lô, kèm danh sách đồ theo khu.
    const areaCost = area ? cfg.AREA_UNLOCK[area].cost : 0, need = areaCost + stageAll, got = coins + (s === 1 ? cfg.START_COINS : 0);
    const byArea = AREAS.map(([id, name]) => [name, opened.filter(e => areaOf(e) === id).sort((a, b) => price(a) - price(b))]).filter(([, list]) => list.length);
    const items = byArea.map(([name, list]) => `<details><summary><b>${name}</b> · ${list.length} món · ${fmt(list.reduce((t, e) => t + price(e), 0))} xu</summary>`
      + `<div class="muted">${list.map(e => `${e.name} ${fmt(price(e))}`).join(' · ')}</div></details>`).join('') || '—';
    itemRows += `<tr><td>${s}</td><td>${from}–${to}</td><td>${fmt(got)}</td><td>${area ? `${AREA_NAMES[area]} ${fmt(areaCost)}` : '—'}</td><td>${fmt(stageAll)} <span class="muted">(${opened.length})</span></td>
      <td>${fmt(need)}</td><td>${need ? `<span class="${ratioClass(got / need)}">${Math.round(got / need * 100)}%</span>` : '—'}</td><td style="text-align:left">${items}</td></tr>`;
    rows += `<tr><td>${s}</td><td>${from}–${to}</td><td>${area ? AREA_NAMES[area] : s === 1 ? 'Garden' : '—'}</td><td>${fmt(stageBase)}</td><td>${fmt(income)}</td><td>${left == null ? '—' : `<b class="${low ? 'warn' : rise ? 'mid' : 'ok'}">${Math.round(left * 100)}%</b>`}</td><td>${all ? Math.round(income / all * 100) + '%' : '—'}</td></tr>`;
  }
  stageStats.income = income;
  $('stageItems').innerHTML = `<tr><th>Chặng</th><th>Màn</th><th>Xu nhận<br>trong chặng</th><th>Mở khu<br>(giá)</th><th>Giá đồ mới mở<br><span class="muted">(số món)</span></th><th>Tổng cần<br>(khu + đồ)</th><th>Xu nhận /<br>tổng cần</th><th>Đồ mua được trong chặng (theo khu, rẻ → đắt)</th></tr>${itemRows}`;
  $('stageTable').innerHTML = `<tr><th>Chặng</th><th>Màn</th><th>Khu mới mở</th><th>Giá món mặc định<br>mới mở</th><th>Xu kiếm được<br>tới lúc này</th><th title="Xu kiếm được trừ tiền mở các khu đã mua, chia cho giá món mặc định đã mở. Nên giảm dần: khu sau khó mua đủ hơn.">Đủ mua món mặc định<br>sau khi trả tiền mở khu</th><th>Đủ mua mọi đồ<br>(tới lúc này)</th></tr>${rows}`;
  renderKpis();
}

// ---------- 4. Biến số ----------
function renderProfiles() {
  $('profileTable').innerHTML = `<tr><th>Kiểu người chơi</th><th>Lượt/ngày</th><th>Tay nghề</th><th>Mua</th><th>Nhận xu tự sinh<br>mấy lần / ngày</th><th>Giây / lượt</th></tr>` + profiles.map((p, i) => `<tr>
    <td><input style="width:190px" data-p="${i}" data-f="name" value="${p.name}"></td>
    <td><input type="number" min="1" data-p="${i}" data-f="attempts" value="${p.attempts}"></td>
    <td><input type="number" min="0.1" step="0.1" data-p="${i}" data-f="skill" value="${p.skill}"></td>
    <td><select data-p="${i}" data-f="buy"><option${p.buy === 'base' ? ' selected' : ''} value="base">chỉ món mặc định</option><option${p.buy === 'all' ? ' selected' : ''} value="all">mọi kiểu + tường/sàn</option></select></td>
    <td><input type="number" min="1" max="12" data-p="${i}" data-f="claims" value="${p.claims ?? 2}"></td>
    <td><input type="number" min="1" max="30" step="0.5" data-p="${i}" data-f="spm" value="${p.spm ?? 5}"></td></tr>`).join('');
}

// ---------- 5. Mô phỏng ----------
// Vừa thắng màn mốc mà còn thiếu từ chừng này phần giá mở khu trở lên: tô vàng (khung Kết luận cũng dùng mốc này).
const SHORT_WARN = .5;
// Phút -> "4.5 phút" / "2 giờ 10 phút".
const playTime = min => (min < 60 ? `${Math.round(min * 10) / 10} phút` : `${Math.floor(min / 60)} giờ${Math.round(min % 60) ? ` ${Math.round(min % 60)} phút` : ''}`);
const COLORS = ['#3a9a5b', '#e07a2e', '#5a8fd6', '#b0559c', '#8a8075'];
function runSim() {
  const t0 = performance.now(), opts = { runs: Number($('runs').value) || 40, levels: levelsCount(), maxDays: Number($('maxDays').value) || 200 };
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

// ---------- 2b. Giá từng món ----------
const CAT_NAMES = { furniture: 'Đồ', walls: 'Tường / rào', floors: 'Sàn / nền' };
const priceArea = id => (CATALOG.find(e => e.id === id)?.area === 'garden2' ? 'garden2' : CATALOG.find(e => e.id === id)?.zone);
function renderPrices() {
  const zone = $('priceZone').value || AREAS[0][0];
  const rows = Object.keys(cfg.DECO).map(id => CATALOG.find(e => e.id === id)).filter(e => e && priceArea(e.id) === zone);
  const mult = cfg.ZONE_PRICE_MULT[zone] ?? 1;
  $('priceInfo').textContent = `${rows.length} món · Nhân giá đồ khu này: ×${mult}`;
  $('priceTable').innerHTML = `<tr><th>Món</th><th>Loại</th><th>Giá gốc</th><th>Giá thật</th><th>Mở ở màn</th></tr>` + rows.map(e => `<tr>
    <td>${e.name} <span class="muted">${e.id}</span></td><td>${CAT_NAMES[e.cat] ?? e.cat}</td>
    <td><input type="number" min="0" step="10" data-price="${e.id}" value="${cfg.DECO[e.id].price}"></td>
    <td data-real="${e.id}">${fmt(zonePrice(e, cfg.ZONE_PRICE_MULT))}</td><td>${cfg.DECO[e.id].lock ?? '—'}</td></tr>`).join('');
}
$('priceZone').innerHTML = AREAS.map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
$('priceZone').onchange = renderPrices;

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
    <tr><td>Idle</td><td>${perSec(idleFrom)}–${perSec(idleTo)} Gold/s / mèo</td><td><b>${avg ? fmt(avg.idleEarned) : '…'}</b></td><td colspan="${span - 2}" class="muted" style="text-align:left">≈ ${Math.round(idleFrom)}–${Math.round(idleTo)} xu / giờ mỗi mèo (màn ${cfg.IDLE_FROM_LEVEL + 1} → màn ${n}), tối đa 6 mèo · tổng cả game của người chơi Trung bình</td></tr>
    <tr><th>Sink</th><th colspan="${span}"></th></tr>
    <tr><th rowspan="2">Deco</th><th rowspan="2">Mở khu</th><th rowspan="2">Total Asset</th><th rowspan="2">Default</th><th colspan="${levelCols.length}" style="text-align:center">Nâng cấp</th></tr>
    <tr>${levelCols.map(k => `<th>${k}</th>`).join('')}</tr>${rows}
    <tr><td><b>Tổng</b></td><td><b>${fmt(unlockTotal)} xu</b></td><td><b>${fmt(assetTotal)}</b></td><td colspan="${span - 2}" class="muted" style="text-align:left">Tổng chỗ tiêu = mở khu + mọi đồ = ${fmt(unlockTotal + assetTotal)} xu (chưa tính booster)</td></tr>`;
}

function renderAll() { renderReward(); renderAreas(); renderStages(); renderPrices(); renderOverview(); }

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

// ---------- Sự kiện ----------
document.addEventListener('input', event => {
  const el = event.target;
  if (el.dataset.key) { cfg[el.dataset.key] = Number(el.value); markDirty(); renderReward(); renderStages(); }
  else if (el.dataset.area) { cfg.AREA_UNLOCK[el.dataset.area][el.dataset.field] = Number(el.value); markDirty(); renderStages(); }
  else if (el.dataset.mult) { cfg.ZONE_PRICE_MULT[el.dataset.mult] = Number(el.value); markDirty(); renderStages(); renderPrices(); }
  else if (el.dataset.price) {
    const id = el.dataset.price, entry = CATALOG.find(e => e.id === id);
    cfg.DECO[id].price = Math.max(0, Math.round(Number(el.value) || 0));
    applyPrices(); markDirty(); renderStages();
    document.querySelector(`[data-real="${id}"]`).textContent = fmt(zonePrice(entry, cfg.ZONE_PRICE_MULT));
  }
  else if (el.dataset.p) { const p = profiles[el.dataset.p]; p[el.dataset.f] = el.dataset.f === 'name' || el.dataset.f === 'buy' ? el.value : Number(el.value); }
  else if (el.id === 'levels') renderAll();
  scheduleSim();
});
// Bảng khu vẽ lại khi rời ô (vẽ lại lúc đang gõ làm mất con trỏ).
document.addEventListener('change', event => { if (event.target.dataset.area || event.target.dataset.mult || event.target.dataset.price) renderAreas(); });
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
  levelInfo = baseline.map(({ moves, movesUsedWin, movesUsedLoss, tier }) => ({ moves, movesUsedWin, movesUsedLoss, tier }));
} catch {
  winRates = [];
}
$('status').textContent = winRates.length ? `Tỉ lệ thắng bot: ${winRates.length} màn (tools/baseline.json)` : '⚠ Không đọc được tools/baseline.json — mô phỏng coi mọi màn thắng 50%';
if (!winRates.length) winRates = [.5];
renderAll();
renderProfiles();
runSim();
