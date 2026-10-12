// Mô phỏng economy cho Level Editor (tab Economy) — thuần logic, chạy được cả trình duyệt lẫn Node (test: economy-sim.test.mjs).
// Dùng đúng code game: rewardFor (progression.mjs), zonePrice / areaState / unlockArea (deco-data.mjs); chỉ truyền bảng số đang sửa.
//
// Mỗi người ảo, mỗi ngày: chơi `attempts` lượt; mỗi lượt thắng với xác suất p(màn) (tỉ lệ thắng của bot ở tools/baseline.json,
// chỉnh theo tay nghề: p = 1 − (1 − winRate)^skill). Thắng lần đầu thì nhận xu và sang màn sau. Sau mỗi lượt: mua đồ rẻ nhất
// đang mua được (khu đã mở, tới màn lock) cho tới khi hết xu, rồi mở khu kế nếu đủ màn + đủ xu đã tiêu.
// Idle: mỗi ngày chia lượt chơi thành `claims` phiên; đầu mỗi phiên nhận xu idle của min(24 / claims, trần) giờ (idle.mjs).
// Đây là mô hình giả định để so các bộ số với nhau, không phải dự báo số liệu thật.
import { rewardFor } from '../game/gameplay/progression.mjs';
import { CATALOG, AREA_ORDER, areaState, unlockArea, zonePrice } from '../game/deco/deco-data.mjs';
import { mulberry32 } from './bot.mjs';
import { idlePerHour } from '../game/gameplay/idle.mjs';

// Tham số economy mà tab Economy được sửa + lưu (economy-save.mjs chỉ cho ghi đúng các tên này).
export const EDITABLE = ['START_COINS', 'REWARD_BASE', 'REWARD_GROWTH', 'REWARD_BOSS_MULT', 'ZONE_PRICE_MULT', 'AREA_UNLOCK', 'IDLE_RATE', 'IDLE_CAP_HOURS', 'IDLE_FROM_LEVEL'];

export const PROFILES = [
  { id: 'casual', name: 'Chơi ít (casual)', attempts: 6, skill: 1, buy: 'base', claims: 1 },
  { id: 'average', name: 'Trung bình', attempts: 12, skill: 1.5, buy: 'base', claims: 2 },
  { id: 'collector', name: 'Thích sưu tầm (mua mọi kiểu)', attempts: 12, skill: 1.5, buy: 'all', claims: 2 },
  { id: 'hardcore', name: 'Chơi nhiều', attempts: 30, skill: 2.5, buy: 'base', claims: 3 },
];

// cfg: { START_COINS, REWARD_BASE, REWARD_GROWTH, REWARD_BOSS_MULT, ZONE_PRICE_MULT, AREA_UNLOCK }
// winRates: mảng tỉ lệ thắng theo màn (chỉ số 0); màn ngoài mảng dùng trung bình 10 màn cuối.
export function simulatePlayer(cfg, profile, winRates, { seed = 1, levels = 100, maxDays = 200 } = {}) {
  const rng = mulberry32(seed);
  const tail = winRates.slice(-10), tailAvg = tail.reduce((a, b) => a + b, 0) / (tail.length || 1);
  const winP = level => Math.max(.03, 1 - (1 - (winRates[level] ?? tailAvg)) ** profile.skill);
  const shop = CATALOG.filter(e => e.cat !== 'cats' && e.basePrice > 0 && (profile.buy === 'all' || (e.cat === 'furniture' && !e.slot)))
    .map(e => ({ entry: e, price: zonePrice(e, cfg.ZONE_PRICE_MULT) })).sort((a, b) => a.price - b.price);
  const owned = new Set();
  let deco = { coins: cfg.START_COINS, unlocked: [], spent: 0, spentAt: 0 }, cleared = 0;
  const areaOf = e => (e.area === 'garden2' ? 'garden2' : e.zone);
  const isOpen = area => area === 'garden' || deco.unlocked.includes(area);
  const events = [], log = [], gateDay = {};
  let earned = cfg.START_COINS, idleEarned = 0, peak = deco.coins;
  const claims = Math.max(1, profile.claims ?? 2), idleHours = Math.min(24 / claims, cfg.IDLE_CAP_HOURS ?? 0);
  for (let day = 1; day <= maxDays && cleared < levels; day++) {
    for (let a = 0; a < profile.attempts && cleared < levels; a++) {
      if (a % Math.ceil(profile.attempts / claims) === 0 && cfg.IDLE_RATE) {
        const idle = Math.floor(idleHours * idlePerHour(cleared, cfg));
        deco = { ...deco, coins: deco.coins + idle };
        earned += idle; idleEarned += idle;
      }
      if (rng() < winP(cleared)) {
        const coins = rewardFor(cleared, cfg);
        deco = { ...deco, coins: deco.coins + coins };
        earned += coins;
        cleared++;
      }
      for (const item of shop) {
        if (owned.has(item.entry.id) || !isOpen(areaOf(item.entry)) || (item.entry.lock && cleared + 1 < item.entry.lock)) continue;
        if (deco.coins < item.price) break; // danh sách xếp theo giá: món này không đủ thì món sau cũng không
        owned.add(item.entry.id);
        deco = { ...deco, coins: deco.coins - item.price, spent: deco.spent + item.price };
      }
      peak = Math.max(peak, deco.coins);
      for (const area of AREA_ORDER) {
        if (isOpen(area)) continue;
        if (cleared >= cfg.AREA_UNLOCK[area].level) gateDay[area] ??= day;
        const next = areaState(deco, area, cleared, cfg.AREA_UNLOCK) === 'ready' ? unlockArea(deco, area, cleared, cfg.AREA_UNLOCK) : null;
        if (!next || next.error) break;
        deco = next;
        // Nút thắt: tới mốc màn rồi mà còn chờ tiêu xu (spend) hay ngược lại (level).
        events.push({ area, day, level: cleared, waitedForSpend: day > gateDay[area] });
      }
    }
    log.push({ day, level: cleared, wallet: deco.coins, spent: deco.spent });
  }
  return { events, log, days: log.length, cleared, earned, idleEarned, spent: deco.spent, wallet: deco.coins, peak, owned: owned.size, shopSize: shop.length };
}

const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// Gộp `runs` người ảo mỗi kiểu: trung vị ngày / màn mở từng khu, % người phải chờ tiêu xu, ví lúc kết thúc.
export function simulateProfile(cfg, profile, winRates, { runs = 40, levels = 100, maxDays = 200 } = {}) {
  const results = Array.from({ length: runs }, (_, i) => simulatePlayer(cfg, profile, winRates, { seed: i * 7919 + profile.attempts * 31 + 1, levels, maxDays }));
  const areas = AREA_ORDER.map(area => {
    const hits = results.map(r => r.events.find(e => e.area === area)).filter(Boolean);
    return { area, opened: hits.length / runs, day: median(hits.map(e => e.day)), level: median(hits.map(e => e.level)),
      waitedForSpend: hits.length ? hits.filter(e => e.waitedForSpend).length / hits.length : 0 };
  });
  // Đường ví theo màn (trung vị mọi người ảo ở cùng màn) để vẽ biểu đồ.
  const walletByLevel = Array.from({ length: levels + 1 }, (_, level) => median(results.flatMap(r => r.log.filter(d => d.level === level).map(d => d.wallet))));
  return { profile, areas, walletByLevel, days: median(results.map(r => r.days)), cleared: median(results.map(r => r.cleared)),
    wallet: median(results.map(r => r.wallet)), peak: median(results.map(r => r.peak)), earned: median(results.map(r => r.earned)), idleEarned: median(results.map(r => r.idleEarned)),
    idleShare: median(results.map(r => (r.earned ? r.idleEarned / r.earned : 0))),
    spent: median(results.map(r => r.spent)), owned: median(results.map(r => r.owned)), shopSize: results[0].shopSize };
}
