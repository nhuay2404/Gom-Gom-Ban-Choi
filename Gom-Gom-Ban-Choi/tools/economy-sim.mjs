// Mô phỏng economy cho Level Editor (tab Economy) — thuần logic, chạy được cả trình duyệt lẫn Node (test: economy-sim.test.mjs).
// Dùng đúng code game: rewardFor (progression.mjs), zonePrice / areaState / unlockArea (deco-data.mjs); chỉ truyền bảng số đang sửa.
//
// Mỗi người ảo, mỗi ngày: chơi `attempts` lượt; mỗi lượt thắng với xác suất p(màn) (tỉ lệ thắng của bot ở tools/baseline.json,
// chỉnh theo tay nghề: p = 1 − (1 − winRate)^skill). Thắng lần đầu thì nhận xu và sang màn sau. Sau mỗi lượt: mua đồ rẻ nhất
// đang mua được (khu đã mở, tới màn lock) cho tới khi hết xu; nhưng trước đó mở khu kế nếu đủ màn + đủ xu, và đã tới màn mốc
// mà chưa đủ xu thì để dành (không mua đồ) cho tới khi mở được khu.
// Idle: mỗi ngày chia lượt chơi thành `claims` phiên; đầu mỗi phiên nhận xu idle của min(24 / claims, trần) giờ (idle.mjs).
// Đây là mô hình giả định để so các bộ số với nhau, không phải dự báo số liệu thật.
import { rewardFor } from '../game/gameplay/progression.mjs';
import { CATALOG, AREA_ORDER, MAX_ROOM_CATS, areaState, unlockArea, zonePrice } from '../game/deco/deco-data.mjs';
import { mulberry32 } from './bot.mjs';
import { idlePerHour } from '../game/gameplay/idle.mjs';

// Tham số economy mà tab Economy được sửa + lưu (economy-save.mjs chỉ cho ghi đúng các tên này).
export const EDITABLE = ['START_COINS', 'REWARD_BASE', 'REWARD_STEP', 'ZONE_PRICE_MULT', 'AREA_UNLOCK', 'IDLE_RATE', 'IDLE_CAP_HOURS', 'IDLE_FROM_LEVEL', 'DECO'];

const CAT_LOCKS = CATALOG.filter(e => e.cat === 'cats').map(e => e.lock ?? 0);
export const catsAt = cleared => Math.min(MAX_ROOM_CATS, CAT_LOCKS.filter(lock => lock <= cleared).length);

export const PROFILES = [
  // spm: giây cho mỗi lượt (đặt một thẻ), giống nhịp chơi của profile ở tab Độ khó cả game (Cơ bản 5, Cao thủ 3, Người yếu 7).
  { id: 'casual', name: 'Chơi ít (casual)', attempts: 6, skill: 1, buy: 'base', claims: 1, spm: 7 },
  { id: 'average', name: 'Trung bình', attempts: 12, skill: 1.5, buy: 'base', claims: 2, spm: 5 },
  { id: 'collector', name: 'Thích sưu tầm (mua mọi kiểu)', attempts: 12, skill: 1.5, buy: 'all', claims: 2, spm: 5 },
  { id: 'hardcore', name: 'Chơi nhiều', attempts: 30, skill: 2.5, buy: 'base', claims: 3, spm: 3 },
];

// cfg: { START_COINS, REWARD_BASE, REWARD_STEP, ZONE_PRICE_MULT, AREA_UNLOCK }
// winRates: mảng tỉ lệ thắng theo màn (chỉ số 0); màn ngoài mảng dùng trung bình 10 màn cuối.
// levelInfo: mỗi màn { moves, movesUsedWin, movesUsedLoss, tier } (tools/baseline.json): thời gian một ván = số lượt bot THẬT SỰ dùng
//   (ván thắng thường xong sớm, ván thua dùng hết lượt / kẹt) × spm giây; màn khó thua nhiều -> nhiều ván dài. Thiếu số liệu thì dùng hết lượt.
// Sau khi hết màn mà chưa mua đủ đồ mặc định: người ảo vẫn mở game nhận xu tự sinh + mua đồ mỗi ngày (không chơi màn) tới khi đủ / hết maxDays.
const BASE_IDS = CATALOG.filter(e => e.cat === 'furniture' && !e.slot && e.basePrice > 0).map(e => e.id);
export function simulatePlayer(cfg, profile, winRates, { seed = 1, levels = 100, maxDays = 200, levelInfo = [] } = {}) {
  const rng = mulberry32(seed);
  const infoTail = levelInfo.slice(-10), tailOf = key => { const list = infoTail.map(i => i[key] ?? i.moves).filter(v => v != null); return list.length ? list.reduce((t, v) => t + v, 0) / list.length : 20; };
  const fallback = { moves: tailOf('moves'), movesUsedWin: tailOf('movesUsedWin'), movesUsedLoss: tailOf('movesUsedLoss'), tier: 'normal' };
  const info = level => levelInfo[level] ?? fallback;
  const spm = profile.spm ?? 5;
  const tail = winRates.slice(-10), tailAvg = tail.reduce((a, b) => a + b, 0) / (tail.length || 1);
  const winP = level => Math.max(.03, 1 - (1 - (winRates[level] ?? tailAvg)) ** profile.skill);
  const shop = CATALOG.filter(e => e.cat !== 'cats' && e.basePrice > 0 && (profile.buy === 'all' || (e.cat === 'furniture' && !e.slot)))
    .map(e => ({ entry: e, price: zonePrice(e, cfg.ZONE_PRICE_MULT) })).sort((a, b) => a.price - b.price);
  const owned = new Set();
  let deco = { coins: cfg.START_COINS, unlocked: [], spent: 0 }, cleared = 0, playSec = 0, finishDay = null, walletAtFinish = null, fullBase = null, atFinish = null;
  const tierSec = {}, tierLevels = {};
  const areaOf = e => (e.area === 'garden2' ? 'garden2' : e.zone);
  const isOpen = area => area === 'garden' || deco.unlocked.includes(area);
  const events = [], log = [], shortAt = {};
  let earned = cfg.START_COINS, idleEarned = 0, peak = deco.coins;
  const claims = Math.max(1, profile.claims ?? 2), idleHours = Math.min(24 / claims, cfg.IDLE_CAP_HOURS ?? 0);
  for (let day = 1; day <= maxDays && (cleared < levels || !fullBase); day++) {
    for (let a = 0; a < profile.attempts; a++) {
      if (a % Math.ceil(profile.attempts / claims) === 0 && cfg.IDLE_RATE) {
        // Mỗi mèo trong nhà sinh xu riêng: số mèo = mèo đã nhận được ở Map tới màn này (tối đa MAX_ROOM_CATS con trong nhà).
        const idle = Math.floor(idleHours * idlePerHour(cleared, cfg) * catsAt(cleared));
        deco = { ...deco, coins: deco.coins + idle };
        earned += idle; idleEarned += idle;
      }
      if (cleared < levels) {
        const level = info(cleared), win = rng() < winP(cleared), tier = level.tier || 'normal';
        const sec = (win ? level.movesUsedWin ?? level.moves : level.movesUsedLoss ?? level.moves) * spm;
        playSec += sec; tierSec[tier] = (tierSec[tier] ?? 0) + sec;
        if (win) {
          const coins = rewardFor(cleared, cfg);
          deco = { ...deco, coins: deco.coins + coins };
          earned += coins;
          tierLevels[tier] = (tierLevels[tier] ?? 0) + 1;
          cleared++;
          if (cleared === levels) { finishDay = day; walletAtFinish = null; }
        }
      }
      for (const area of AREA_ORDER) {
        if (isOpen(area)) continue;
        // Lúc vừa thắng màn mốc: ví còn thiếu bao nhiêu xu so với giá mở khu (0 = mở được ngay).
        if (cleared >= cfg.AREA_UNLOCK[area].level) shortAt[area] ??= Math.max(0, cfg.AREA_UNLOCK[area].cost - deco.coins);
        const next = areaState(deco, area, cleared, cfg.AREA_UNLOCK) === 'ready' ? unlockArea(deco, area, cleared, cfg.AREA_UNLOCK) : null;
        if (!next || next.error) break;
        deco = next;
        events.push({ area, day, level: cleared, short: shortAt[area] ?? 0 });
      }
      // Đã tới màn mốc của khu kế mà chưa đủ xu: để dành tiền mở khu, chưa mua đồ (người chơi thật ưu tiên mở khu mới).
      const nextGate = AREA_ORDER.find(area => !isOpen(area));
      if (!(nextGate && cleared >= cfg.AREA_UNLOCK[nextGate].level)) {
        for (const item of shop) {
          if (owned.has(item.entry.id) || !isOpen(areaOf(item.entry)) || (item.entry.lock && cleared + 1 < item.entry.lock)) continue;
          if (deco.coins < item.price) break; // danh sách xếp theo giá: món này không đủ thì món sau cũng không
          owned.add(item.entry.id);
          deco = { ...deco, coins: deco.coins - item.price, spent: deco.spent + item.price };
        }
      }
      if (!fullBase && BASE_IDS.every(id => owned.has(id))) fullBase = { day, level: cleared, playSec };
      // Số liệu "cả game" (xu nhận, xu tự sinh, đã tiêu) chốt lúc thắng màn cuối; phần chờ thêm sau đó chỉ để đo mốc mua đủ đồ mặc định.
      if (finishDay != null && walletAtFinish == null) { walletAtFinish = deco.coins; atFinish = { earned, idleEarned, spent: deco.spent, owned: owned.size }; }
      peak = Math.max(peak, deco.coins);
    }
    if (finishDay == null || day === finishDay) log.push({ day, level: cleared, wallet: deco.coins, spent: deco.spent });
  }
  const tierMin = Object.fromEntries(Object.keys(tierSec).map(tier => [tier, tierSec[tier] / 60 / Math.max(1, tierLevels[tier] ?? 0)]));
  return { events, log, days: finishDay ?? log.length, cleared, playSec, tierMin, fullBase, earned: atFinish?.earned ?? earned, idleEarned: atFinish?.idleEarned ?? idleEarned, spent: atFinish?.spent ?? deco.spent,
    wallet: walletAtFinish ?? deco.coins, peak, owned: atFinish?.owned ?? owned.size, shopSize: shop.length };
}

const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// Gộp `runs` người ảo mỗi kiểu: trung vị ngày / màn mở từng khu, số xu còn thiếu lúc vừa thắng màn mốc, ví lúc kết thúc.
export function simulateProfile(cfg, profile, winRates, { runs = 40, levels = 100, maxDays = 200, levelInfo = [] } = {}) {
  const results = Array.from({ length: runs }, (_, i) => simulatePlayer(cfg, profile, winRates, { seed: i * 7919 + profile.attempts * 31 + 1, levels, maxDays, levelInfo }));
  const areas = AREA_ORDER.map(area => {
    const hits = results.map(r => r.events.find(e => e.area === area)).filter(Boolean);
    return { area, opened: hits.length / runs, day: median(hits.map(e => e.day)), level: median(hits.map(e => e.level)),
      short: median(hits.map(e => e.short)) };
  });
  // Đường ví theo màn (trung vị mọi người ảo ở cùng màn) để vẽ biểu đồ.
  const walletByLevel = Array.from({ length: levels + 1 }, (_, level) => median(results.flatMap(r => r.log.filter(d => d.level === level).map(d => d.wallet))));
  // Thời gian chơi (phút): mỗi màn trung bình (kể cả chơi lại khi thua), mỗi ngày, cả game.
  const playMin = median(results.map(r => r.playSec / 60));
  return { profile, areas, walletByLevel, days: median(results.map(r => r.days)), cleared: median(results.map(r => r.cleared)),
    // Mỗi màn theo độ khó (tier: chill / normal / hard / boss) và mốc mua đủ mọi món mặc định (tỉ lệ người ảo đạt + trung vị ngày / màn / phút chơi).
    tierMin: Object.fromEntries([...new Set(results.flatMap(r => Object.keys(r.tierMin)))].map(tier => [tier, median(results.filter(r => r.tierMin[tier] != null).map(r => r.tierMin[tier]))])),
    fullBase: (() => { const hits = results.map(r => r.fullBase).filter(Boolean); return { rate: hits.length / runs, day: median(hits.map(h => h.day)), level: median(hits.map(h => h.level)), playMin: median(hits.map(h => h.playSec / 60)) }; })(),
    baseCount: BASE_IDS.length,
    playMin, minPerLevel: median(results.map(r => r.playSec / 60 / Math.max(1, r.cleared))), minPerDay: median(results.map(r => r.playSec / 60 / r.days)),
    wallet: median(results.map(r => r.wallet)), peak: median(results.map(r => r.peak)), earned: median(results.map(r => r.earned)), idleEarned: median(results.map(r => r.idleEarned)),
    idleShare: median(results.map(r => (r.earned ? r.idleEarned / r.earned : 0))),
    spent: median(results.map(r => r.spent)), owned: median(results.map(r => r.owned)), shopSize: results[0].shopSize };
}
