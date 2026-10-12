// Level Editor — tab Economy: sửa công thức xu mỗi màn, mốc mở khu, hệ số giá khu; xem cân bằng theo stage ngay khi sửa;
// chạy mô phỏng người ảo (tools/economy-sim.mjs); lưu thẳng vào game/gameplay/economy.mjs (POST /api/save-economy).
// Dùng đúng code game (rewardFor, zonePrice, areaState...), chỉ truyền bộ số đang sửa.
import * as ECO from '../../game/gameplay/economy.mjs';
import { rewardFor } from '../../game/gameplay/progression.mjs';
import { CATALOG, AREA_ORDER, AREA_NAMES, zonePrice } from '../../game/deco/deco-data.mjs';
import { EDITABLE, PROFILES, simulateProfile } from '../economy-sim.mjs';
import { idlePerHour, idleCap } from '../../game/gameplay/idle.mjs';

const $ = id => document.getElementById(id);
const fmt = n => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const clone = value => JSON.parse(JSON.stringify(value));
const fromGame = () => Object.fromEntries(EDITABLE.map(name => [name, clone(ECO[name])]));
let cfg = fromGame(), profiles = clone(PROFILES), winRates = [], dirty = false;

const AREAS = [['garden', 'Garden'], ...AREA_ORDER.map(area => [area, AREA_NAMES[area]])];
const areaOf = entry => (entry.area === 'garden2' ? 'garden2' : entry.zone);
const paid = CATALOG.filter(entry => entry.cat !== 'cats' && entry.basePrice > 0);
const isBase = entry => entry.cat === 'furniture' && !entry.slot;
const totals = area => {
  const list = paid.filter(entry => areaOf(entry) === area), price = entry => zonePrice(entry, cfg.ZONE_PRICE_MULT);
  const base = list.filter(isBase);
  return { base: base.reduce((t, e) => t + price(e), 0), baseN: base.length, all: list.reduce((t, e) => t + price(e), 0), allN: list.length };
};
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
  $('idleInfo').textContent = `Idle: ${idleAt.map(l => `ở màn ${l + 1} ≈ ${Math.round(idlePerHour(l, cfg))} xu/giờ, đầy ${idleCap(l, cfg)} xu`).join(' · ')}`;
  $('rewardInfo').textContent = `Màn 1: ${values[0]} · màn 10 (boss): ${values[9]} · màn 50: ${values[49] ?? '—'} · màn ${n}: ${values[n - 1]} · tổng ${n} màn + xu ban đầu: ${fmt(total)} xu`;
}

// ---------- 2. Khu ----------
function renderAreas() {
  const rows = AREAS.map(([area, name], i) => {
    const t = totals(area), gate = cfg.AREA_UNLOCK[area], prev = AREAS[i - 1] && totals(AREAS[i - 1][0]).base;
    const spendRatio = gate && prev ? gate.spend / prev : null;
    return `<tr><td><b>${name}</b></td>
      <td>${gate ? `<input type="number" min="0" data-area="${area}" data-field="level" value="${gate.level}">` : 'có sẵn'}</td>
      <td>${gate ? `<input type="number" min="0" step="50" data-area="${area}" data-field="spend" value="${gate.spend}">` : '—'}</td>
      <td>${spendRatio == null ? '—' : `<span class="${spendRatio <= .8 ? 'ok' : 'warn'}">${Math.round(spendRatio * 100)}%</span>`}</td>
      <td><input type="number" min="0.1" step="0.05" data-mult="${area}" value="${cfg.ZONE_PRICE_MULT[area] ?? 1}"></td>
      <td>${fmt(t.base)} <span class="muted">(${t.baseN})</span></td><td>${fmt(t.all)} <span class="muted">(${t.allN})</span></td></tr>`;
  }).join('');
  $('areaTable').innerHTML = `<tr><th>Khu</th><th>Màn mốc</th><th>Cần tiêu cho decor</th><th title="Nên ≤ 80% để lúc nào cũng còn đồ để mua cho đủ mốc">Mốc tiêu so với<br>món chính khu trước</th><th>Hệ số giá</th><th>Tổng giá món chính<br><span class="muted">(số món)</span></th><th>Tổng giá mọi đồ<br><span class="muted">(+ kiểu khác, tường/sàn)</span></th></tr>${rows}`;
}

// ---------- 3. Stage ----------
const ratioClass = r => (r >= .85 && r <= 1.15 ? 'ok' : r >= .7 && r <= 1.4 ? 'mid' : 'warn');
function renderStages() {
  const n = levelsCount(), stages = Math.ceil(n / 10);
  // Món mở ở stage nào: khu mở theo mốc màn (thắng mốc -> mua được từ màn mốc + 1), cộng lock của món.
  const openLevel = entry => Math.max(1, (cfg.AREA_UNLOCK[areaOf(entry)]?.level ?? 0) + 1, entry.lock || 1);
  let income = cfg.START_COINS, base = 0, all = 0, rows = '';
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
    const r = base ? income / base : null;
    if (r != null && ratioClass(r) === 'warn') stageStats.off.push({ s, r });
    rows += `<tr><td>${s}</td><td>${from}–${to}</td><td>${area ? AREA_NAMES[area] : s === 1 ? 'Garden' : '—'}</td><td>${fmt(coins)}</td><td>${fmt(stageBase)}</td><td>${fmt(stageAll)}</td>
      <td>${area ? fmt(cfg.AREA_UNLOCK[area].spend) : '—'}</td><td>${fmt(income)}</td><td>${r == null ? '—' : `<span class="${ratioClass(r)}">${Math.round(r * 100)}%</span>`}</td><td>${all ? Math.round(income / all * 100) + '%' : '—'}</td></tr>`;
  }
  stageStats.income = income;
  $('stageTable').innerHTML = `<tr><th>Lô</th><th>Màn</th><th>Khu mới mở</th><th>Xu nhận<br>trong lô</th><th>Giá món chính<br>mới mở</th><th>Giá mọi đồ<br>mới mở</th><th>Cần tiêu để<br>mở khu</th><th>Xu kiếm được<br>tới lúc này</th><th>Đủ mua món chính<br>(tới lúc này)</th><th>Đủ mua mọi đồ<br>(tới lúc này)</th></tr>${rows}`;
  renderKpis();
}

// ---------- 4. Biến số ----------
function renderProfiles() {
  $('profileTable').innerHTML = `<tr><th>Kiểu người chơi</th><th>Lượt/ngày</th><th>Tay nghề</th><th>Mua</th><th>Nhận idle / ngày</th></tr>` + profiles.map((p, i) => `<tr>
    <td><input style="width:190px" data-p="${i}" data-f="name" value="${p.name}"></td>
    <td><input type="number" min="1" data-p="${i}" data-f="attempts" value="${p.attempts}"></td>
    <td><input type="number" min="0.1" step="0.1" data-p="${i}" data-f="skill" value="${p.skill}"></td>
    <td><select data-p="${i}" data-f="buy"><option${p.buy === 'base' ? ' selected' : ''}>base</option><option${p.buy === 'all' ? ' selected' : ''}>all</option></select></td>
    <td><input type="number" min="1" max="12" data-p="${i}" data-f="claims" value="${p.claims ?? 2}"></td></tr>`).join('');
}

// ---------- 5. Mô phỏng ----------
const COLORS = ['#3a9a5b', '#e07a2e', '#5a8fd6', '#b0559c', '#8a8075'];
function runSim() {
  const t0 = performance.now(), opts = { runs: Number($('runs').value) || 40, levels: levelsCount(), maxDays: Number($('maxDays').value) || 200 };
  const results = profiles.map(p => simulateProfile(cfg, p, winRates, opts));
  const head = `<tr><th>Kiểu người chơi</th><th>Số ngày để<br>chơi hết ${opts.levels} màn</th>${AREA_ORDER.map(a => `<th>${AREA_NAMES[a]}<br><span class="muted">mở ngày · ở màn · % phải chờ tiêu xu</span></th>`).join('')}<th>Xu dư<br>cuối game</th><th>Đồ đã mua</th></tr>`;
  const rows = results.map((r, i) => `<tr><td><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${COLORS[i % COLORS.length]}"></i> ${r.profile.name}</td>
    <td>${r.cleared < opts.levels ? `<span class="warn">kẹt màn ${r.cleared}</span>` : r.days}</td>
    ${r.areas.map(a => `<td>${a.opened < 1 ? `<span class="warn">${Math.round(a.opened * 100)}% mở</span>` : `${a.day} · ${a.level} · <span class="${a.waitedForSpend > .5 ? 'mid' : 'muted'}">${Math.round(a.waitedForSpend * 100)}%</span>`}</td>`).join('')}
    <td>${fmt(r.wallet)}</td><td>${r.owned}/${r.shopSize}</td></tr>`).join('');
  $('simTable').innerHTML = head + rows;
  // Ví theo màn: ví phình đều = xu thừa (không có gì để mua); ví về ~0 liên tục = thiếu xu.
  const W = 600, H = 170, max = Math.max(1, ...results.flatMap(r => r.walletByLevel.filter(v => v != null)));
  const lines = results.map((r, i) => `<polyline fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="2" points="${r.walletByLevel.map((v, l) => v == null ? '' : `${l / opts.levels * W},${H - v / max * (H - 12)}`).join(' ')}"/>`).join('');
  const gates = AREA_ORDER.map((a, i) => { const x = cfg.AREA_UNLOCK[a].level / opts.levels * W; return `<line x1="${x}" x2="${x}" y1="0" y2="${H}" stroke="#e4ddd2" stroke-dasharray="3 3"/><text x="${x + 2}" y="${24 + i * 12}">${AREA_NAMES[a]}</text>`; }).join('');
  $('walletChart').innerHTML = `<div class="muted">Xu trong ví theo màn đã thắng (trung vị)</div><svg viewBox="0 -2 ${W} ${H + 4}">${gates}${lines}<text x="2" y="10">${fmt(max)} xu</text></svg>`;
  // Gợi ý đọc kết quả.
  const notes = [];
  for (const r of results) {
    const stuck = r.areas.find(a => a.opened < 1);
    if (stuck) notes.push(`<b>${r.profile.name}</b>: ${AREA_NAMES[stuck.area]} chỉ ${Math.round(stuck.opened * 100)}% người ảo mở được — mốc tiêu xu quá cao hoặc thiếu đồ để mua.`);
    const waited = r.areas.filter(a => a.waitedForSpend > .5).map(a => AREA_NAMES[a.area]);
    if (waited.length) notes.push(`<b>${r.profile.name}</b>: tới mốc màn rồi vẫn phải chờ tiêu xu ở ${waited.join(', ')} — xu là nút thắt (có thể muốn vậy, hoặc giảm mốc tiêu).`);
    if (r.owned >= r.shopSize && r.wallet > 2000) notes.push(`<b>${r.profile.name}</b>: mua hết đồ mà ví còn ${fmt(r.wallet)} xu — xu thừa cuối game (thêm chỗ tiêu hoặc giảm REWARD_GROWTH).`);
  }
  $('simNotes').innerHTML = notes.map(n => `<li>${n}</li>`).join('') || '<li class="ok">Không thấy vấn đề lớn.</li>';
  $('runInfo').textContent = `${opts.runs} người ảo × ${profiles.length} kiểu · ${Math.round(performance.now() - t0)} ms`;
  simResults = results;
  renderKpis();
}

function renderAll() { renderReward(); renderAreas(); renderStages(); }

// ---------- Tóm tắt (thẻ số trên cùng): đọc nhanh bộ số đang sửa có ổn không ----------
let stageStats = { off: [], income: 0 }, simResults = null;
function renderKpis() {
  const avg = simResults?.find(r => r.profile.id === 'average') ?? simResults?.[0];
  const kitchen = avg?.areas.at(-1);
  const stuck = simResults?.flatMap(r => r.areas.filter(a => a.opened < 1).map(a => `${r.profile.name}: ${AREA_NAMES[a.area]}`)) ?? [];
  const card = (title, value, note, tone = '') => `<div class="kpi ${tone}"><small>${title}</small><b>${value}</b><small>${note}</small></div>`;
  const off = stageStats.off;
  $('kpis').innerHTML = [
    card('Tổng xu cả game', fmt(stageStats.income), `${levelsCount()} màn + xu ban đầu`),
    card('Lô 10 màn bị lệch', off.length || 'Không', off.length ? 'lô ' + off.map(o => `${o.s} (${Math.round(o.r * 100)}%)`).join(', ') : 'mọi lô trong khoảng chấp nhận', off.length ? 'bad' : 'good'),
    avg ? card(`Mở bếp (${avg.profile.name})`, kitchen.opened < 1 ? 'Không mở được' : `ngày ${kitchen.day}`, kitchen.opened < 1 ? 'mốc tiêu xu quá cao?' : `ở màn ${kitchen.level}`, kitchen.opened < 1 ? 'bad' : '') : '',
    avg ? card(`Xu dư cuối game (${avg.profile.name})`, fmt(avg.wallet), avg.wallet > 2000 ? 'thừa xu: thêm chỗ tiêu / giảm hệ số tăng' : 'ổn', avg.wallet > 2000 ? 'bad' : 'good') : '',
    avg ? card(`Xu từ idle (${avg.profile.name})`, `${Math.round(avg.idleShare * 100)}%`, `${fmt(avg.idleEarned)} xu cả game · nên 5–15%`, avg.idleShare > .15 ? 'bad' : avg.idleShare >= .05 ? 'good' : '') : '',
    card('Khu không mở được', stuck.length || 'Không', stuck.length ? stuck.slice(0, 2).join(' · ') : 'mọi kiểu người chơi mở đủ khu', stuck.length ? 'bad' : 'good'),
  ].join('');
}
// Sửa số thì tự chạy lại mô phỏng (vài chục ms), chờ ngừng gõ một chút.
let simTimer = 0;
const scheduleSim = () => { clearTimeout(simTimer); simTimer = setTimeout(runSim, 250); };

// ---------- Sự kiện ----------
document.addEventListener('input', event => {
  const el = event.target;
  if (el.dataset.key) { cfg[el.dataset.key] = Number(el.value); markDirty(); renderReward(); renderStages(); }
  else if (el.dataset.area) { cfg.AREA_UNLOCK[el.dataset.area][el.dataset.field] = Number(el.value); markDirty(); renderStages(); }
  else if (el.dataset.mult) { cfg.ZONE_PRICE_MULT[el.dataset.mult] = Number(el.value); markDirty(); renderStages(); }
  else if (el.dataset.p) { const p = profiles[el.dataset.p]; p[el.dataset.f] = el.dataset.f === 'name' || el.dataset.f === 'buy' ? el.value : Number(el.value); }
  else if (el.id === 'levels') renderAll();
  scheduleSim();
});
// Bảng khu vẽ lại khi rời ô (vẽ lại lúc đang gõ làm mất con trỏ).
document.addEventListener('change', event => { if (event.target.dataset.area || event.target.dataset.mult) renderAreas(); });
$('btnRun').onclick = runSim;
$('btnReset').onclick = () => { cfg = fromGame(); dirty = false; $('saveStatus').textContent = ''; renderAll(); };
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
  winRates = (await (await fetch('../baseline.json')).json()).levels.map(level => level.winRate);
} catch {
  winRates = [];
}
$('status').textContent = winRates.length ? `Tỉ lệ thắng bot: ${winRates.length} màn (tools/baseline.json)` : '⚠ Không đọc được tools/baseline.json — mô phỏng coi mọi màn thắng 50%';
if (!winRates.length) winRates = [.5];
renderAll();
renderProfiles();
runSim();
