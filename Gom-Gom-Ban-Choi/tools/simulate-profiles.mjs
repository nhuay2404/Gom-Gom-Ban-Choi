// Mô phỏng các kiểu người chơi đi hết hành trình 20 màn, so màn cố định (bản cũ) với độ khó thích ứng (adaptive.mjs).
// Chạy: node tools/simulate-profiles.mjs [số người mỗi kiểu, mặc định 40] [--json] [--levels]
//   --levels  thêm bảng theo từng màn 1–20 (gộp mọi kiểu người chơi)
//
// Mỗi người ảo = bot (tools/bot.mjs) với tay nghề riêng + hành vi riêng (thời gian nghĩ, AFK, bỏ ngang, đứng ở bảng
// kết quả, nghỉ vài ngày). Người ảo chơi màn đang mở, thua thì chơi lại, và BỎ GAME khi:
//   - thua liên tiếp `patience` lần (nản), hoặc
//   - (kiểu "chơi chán") thắng ngay lần đầu `boredAfter` màn liền (quá dễ).
// Đây là mô hình giả định để so hai chế độ với cùng người chơi, không phải dự báo số liệu thật.
import { LEVELS } from '../game/gameplay/levels.mjs';
import { planLevel, recordAttempt, noteDwell, startVisit, elementCount, difficultyOf } from '../game/gameplay/adaptive.mjs';
import { ADAPTIVE, BOOSTERS, ECONOMY, holdUnlocked } from '../game/gameplay/tuning.mjs';
import { boostersUnlocked } from '../game/gameplay/boosters.mjs';
import { play, mulberry32 } from './bot.mjs';

const PLAYERS = Number(process.argv.slice(2).find(arg => /^\d+$/.test(arg)) ?? 40);
const JSON_OUT = process.argv.includes('--json'), LEVEL_OUT = process.argv.includes('--levels');
const MAX_TRIES = 150, DAY = 24 * 3600 * 1000, T0 = Date.UTC(2026, 9, 1);

// noise/hold: tay nghề (xem bot.mjs) · think: giây nghĩ mỗi lượt · patience: thua liên tiếp bấy nhiêu lần thì bỏ game.
// boostAt: dùng +lượt khi còn 1 lượt mà đã đạt tỉ lệ điểm này · buy: hết booster thì mua bằng xu ('always' | 'rich' = khi
// đủ xu cho 2 cái | false) · onlyRetry: chỉ dùng booster khi đang chơi lại màn đã thua.
export const TYPES = [
  { id: 'weak', name: 'Người mới, chơi yếu', noise: 90, hold: false, think: 4.5, patience: 6, tiltOnLoss: true, boostAt: 0.7, buy: 'always' },
  { id: 'average', name: 'Chơi trung bình', noise: 40, hold: true, think: 3.5, patience: 8, boostAt: 0.8, buy: 'rich' },
  { id: 'decent', name: 'Chơi khá (hay thua sát nút)', noise: 25, hold: true, think: 3, patience: 8, boostAt: 0.8, buy: 'rich' },
  { id: 'skilled', name: 'Cao thủ', noise: 1, hold: true, think: 2.2, patience: 10, boostAt: 0.9, buy: false, onlyRetry: true },
  { id: 'quitter', name: 'Dễ nản, hay bỏ ngang', noise: 60, hold: false, think: 4, patience: 3, tiltOnLoss: true, quits: true, boostAt: 0.8, buy: false },
  { id: 'bored', name: 'Cao thủ dễ chán', noise: 1, hold: true, think: 2.2, patience: 10, boredAfter: 6, boostAt: 0.9, buy: false, onlyRetry: true },
  { id: 'thinker', name: 'Suy nghĩ kỹ', noise: 8, hold: true, think: 8, patience: 8, boostAt: 0.8, buy: 'rich' },
  { id: 'returning', name: 'Quay lại sau 4 ngày nghỉ', noise: 25, hold: false, think: 3.5, patience: 6, breakAt: 10, tiltOnLoss: true, boostAt: 0.8, buy: 'rich' },
];

// mode: 'fixed' (màn cố định) · 'adaptive' (độ khó thích ứng). Người ảo dùng booster ở cả hai chế độ.
function runPlayer(type, playerIndex, mode) {
  const adaptive = mode !== 'fixed';
  const rng = mulberry32(TYPES.indexOf(type) * 7919 + playerIndex * 104729 + 1);
  let profile = { attempts: [], streakFrom: 0, cooldown: 0, giftPending: false, warmup: false, lastSeen: 0 };
  let level = 0, tries = 0, loseStreak = 0, winStreak = 0, firstTryStreak = 0, triesHere = 0, now = T0, tookBreak = false;
  const out = { cleared: 0, tries: 0, wins: 0, nearMiss: 0, stuck: 0, losses: 0, deals: 0, quits: 0, maxLoseStreak: 0, churn: null, tiers: { easy: 0, medium: 0, hard: 0 }, profiles: {}, gifts: 0, boostUsed: 0, bought: 0, carried: 0,
    perLevel: LEVELS.map(() => ({ tries: 0, firstWin: 0, cleared: 0, churn: 0, deals: 0, shift: 0, stuck: 0, moves: 0, tiers: { easy: 0, medium: 0, hard: 0 } })) };
  profile = startVisit(profile, now);
  // Kho booster (START_STOCK mỗi loại như người chơi mới) và xu kiếm theo sao mới; xu chỉ dùng để mua booster.
  const stock = { moves: BOOSTERS.START_STOCK, swap: BOOSTERS.START_STOCK }, best = [];
  let coins = 0, bought = 0;
  const want = id => {
    if (stock[id] > 0) { stock[id]--; return true; }
    const price = BOOSTERS.PRICE[id];
    if (type.buy === 'always' ? coins >= price : type.buy === 'rich' ? coins >= 2 * price : false) { coins -= price; bought++; return true; }
    return false;
  };
  while (level < LEVELS.length && tries < MAX_TRIES) {
    if (type.breakAt === level && !tookBreak) { tookBreak = true; now += 4 * DAY; if (adaptive) profile = startVisit(profile, now); }
    const plan = adaptive ? planLevel(profile, level) : { level: LEVELS[level], profile: 'fixed', shift: 0, mode: null };
    const canBoost = boostersUnlocked(level) && (!type.onlyRetry || triesHere > 0);
    const boughtBefore = bought;
    const result = play(plan.level, 1e6 * (TYPES.indexOf(type) + 1) + playerIndex * 1000 + tries,
      { noise: type.noise, hold: type.hold && holdUnlocked(level), boost: canBoost ? { at: type.boostAt, want } : null });
    const used = result.boostUse.moves + result.boostUse.swap, boughtNow = bought - boughtBefore;
    out.boostUsed += used; out.bought += boughtNow;
    if (result.win) { const stars = result.stars || 1; coins += Math.max(0, stars - (best[level] || 0)) * ECONOMY.COINS_PER_STAR; best[level] = Math.max(best[level] || 0, stars); }
    if (result.win && used) out.carried++;
    tries++; triesHere++;
    out.tiers[difficultyOf(elementCount(plan.level))]++;
    out.profiles[plan.profile] = (out.profiles[plan.profile] || 0) + 1;
    if (plan.deal) out.deals++;
    const here = out.perLevel[level];
    here.tries++; here.tiers[difficultyOf(elementCount(plan.level))]++; here.shift += plan.shift || 0; if (plan.deal) here.deals++;
    const ratio = result.score / plan.level.target;
    // Hành vi: đang thua liên tục thì nghĩ lâu hơn, AFK nhiều, đứng lâu ở bảng thua; cao thủ dễ chán thắng mãi thì lơ đãng dần.
    const tilt = type.tiltOnLoss && loseStreak >= 2;
    const drift = type.boredAfter && winStreak >= 2 ? 1 + 0.2 * winStreak : 1;
    const thinkMs = Math.round(type.think * 1000 * (0.85 + 0.3 * rng()) * (tilt ? 1.7 : 1) * drift);
    const durationMs = thinkMs * Math.max(1, result.movesUsed);
    const quit = type.quits && !result.win && ratio < 0.6 && loseStreak >= 1;
    const reason = result.win ? 'win' : quit ? 'quit' : result.reason;
    const dwellMs = (!result.win && tilt) || (result.win && type.boredAfter && winStreak >= 2) ? 10000 + 4000 * rng() : 1500 + 2000 * rng();
    if (adaptive) {
      const rec = recordAttempt(profile, {
        level, win: result.win, reason, ratio: +ratio.toFixed(3), stars: result.stars || 0, thinkMs,
        boosters: used, boostUse: result.boostUse, bought: boughtNow,
        preBoostRatio: result.preBoostRatio == null ? null : +result.preBoostRatio.toFixed(3),
        idleMs: tilt ? Math.round(durationMs * 0.3) : 0, durationMs, profile: plan.profile, shift: plan.shift, mode: plan.mode, layout: plan.layout, count: plan.count,
      }, now);
      profile = noteDwell(rec.profile, Math.round(dwellMs));
      if (rec.gift) out.gifts++;
    }
    now += durationMs + dwellMs + 30000;
    if (result.win) {
      out.wins++; out.cleared++;
      out.perLevel[level].cleared = 1; if (triesHere === 1) out.perLevel[level].firstWin = 1;
      firstTryStreak = triesHere === 1 ? firstTryStreak + 1 : 0;
      winStreak++; loseStreak = 0; triesHere = 0; level++;
      if (type.boredAfter && firstTryStreak >= type.boredAfter && level < LEVELS.length) { out.churn = 'chán'; out.perLevel[level - 1].churn = 1; break; }
    } else {
      out.losses++; loseStreak++; winStreak = 0; firstTryStreak = 0;
      if (quit) out.quits++;
      if (reason === 'stuck') { out.stuck++; out.perLevel[level].stuck++; }
      if (reason === 'moves') out.perLevel[level].moves++;
      if (!quit && ratio >= ADAPTIVE.NEAR_MISS) out.nearMiss++;
      out.maxLoseStreak = Math.max(out.maxLoseStreak, loseStreak);
      if (loseStreak >= type.patience) { out.churn = 'nản'; out.perLevel[level].churn = 1; break; }
    }
  }
  out.tries = tries;
  out.finished = level >= LEVELS.length;
  return out;
}

function summarize(type, mode) {
  const runs = Array.from({ length: PLAYERS }, (_, i) => runPlayer(type, i, mode));
  const sum = key => runs.reduce((s, r) => s + r[key], 0);
  const tiers = runs.reduce((t, r) => { Object.keys(t).forEach(k => { t[k] += r.tiers[k]; }); return t; }, { easy: 0, medium: 0, hard: 0 });
  const profiles = runs.reduce((p, r) => { Object.entries(r.profiles).forEach(([k, n]) => { p[k] = (p[k] || 0) + n; }); return p; }, {});
  const tries = sum('tries');
  return {
    perLevel: LEVELS.map((_, i) => runs.map(r => r.perLevel[i])),
    finished: runs.filter(r => r.finished).length / PLAYERS,
    churnFrustrated: runs.filter(r => r.churn === 'nản').length / PLAYERS,
    churnBored: runs.filter(r => r.churn === 'chán').length / PLAYERS,
    cleared: sum('cleared') / PLAYERS,
    winRate: sum('wins') / tries,
    triesPerLevel: tries / Math.max(1, sum('cleared')),
    maxLoseStreak: sum('maxLoseStreak') / PLAYERS,
    nearMissShare: sum('nearMiss') / Math.max(1, sum('losses')),
    stuckShare: sum('stuck') / Math.max(1, sum('losses')),
    dealShare: sum('deals') / tries,
    tiers: Object.fromEntries(Object.entries(tiers).map(([k, n]) => [k, n / tries])),
    profiles: Object.entries(profiles).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, n / tries]),
    gifts: sum('gifts') / PLAYERS,
    boostUsed: sum('boostUsed') / PLAYERS,
    bought: sum('bought') / PLAYERS,
    carriedShare: sum('carried') / Math.max(1, sum('wins')),
  };
}

const report = TYPES.map(type => ({ type, fixed: summarize(type, 'fixed'), adaptive: summarize(type, 'adaptive') }));
if (JSON_OUT) {
  console.log(JSON.stringify(report.map(({ type, fixed, adaptive }) => ({ type: type.id, name: type.name, fixed, adaptive })), null, 2));
} else {
  const pct = x => `${Math.round(x * 100)}%`, num = x => x.toFixed(1);
  const arrow = (a, b, fmt) => `${fmt(a)} → **${fmt(b)}**`;
  console.log(`Mô phỏng ${PLAYERS} người mỗi kiểu, màn cố định → độ khó thích ứng\n`);
  console.log('| Kiểu người chơi | Qua hết 20 màn | Bỏ game (nản) | Bỏ game (chán) | Màn qua TB | Tỉ lệ thắng / lần thử | Lần thử / màn | Chuỗi thua dài nhất TB | Thua sát nút / lần thua |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  report.forEach(({ type, fixed: f, adaptive: a }) => console.log(`| ${type.name} | ${arrow(f.finished, a.finished, pct)} | ${arrow(f.churnFrustrated, a.churnFrustrated, pct)} | ${arrow(f.churnBored, a.churnBored, pct)} | ${arrow(f.cleared, a.cleared, num)} | ${arrow(f.winRate, a.winRate, pct)} | ${arrow(f.triesPerLevel, a.triesPerLevel, num)} | ${arrow(f.maxLoseStreak, a.maxLoseStreak, num)} | ${arrow(f.nearMissShare, a.nearMissShare, pct)} |`));
  console.log('\n| Kiểu người chơi | Easy / Medium / Hard (cố định) | Easy / Medium / Hard (thích ứng) | Thua vì hết chỗ / lần thua | Lần thử có chỉnh bộ thẻ | Profile nhận diện nhiều nhất | Quà / người |');
  console.log('|---|---|---|---|---|---|---|');
  report.forEach(({ type, fixed: f, adaptive: a }) => {
    const mix = t => `${pct(t.easy)} / ${pct(t.medium)} / ${pct(t.hard)}`;
    console.log(`| ${type.name} | ${mix(f.tiers)} | ${mix(a.tiers)} | ${arrow(f.stuckShare, a.stuckShare, pct)} | ${pct(a.dealShare)} | ${a.profiles.slice(0, 3).map(([k, n]) => `${k} ${pct(n)}`).join(', ')} | ${a.gifts.toFixed(1)} |`);
  });
}

// Bảng booster: cố định → thích ứng.
if (!JSON_OUT) {
  const pct = x => `${Math.round(x * 100)}%`, three = (r, k, f) => `${f(r.fixed[k])} → **${f(r.adaptive[k])}**`;
  console.log('\n### Booster (cố định → thích ứng)\n');
  console.log('| Kiểu người chơi | Bỏ game (nản) | Qua hết 20 màn | Booster dùng / người | Booster mua bằng xu / người | Lần thắng có dùng booster |');
  console.log('|---|---|---|---|---|---|');
  report.forEach(r => console.log(`| ${r.type.name} | ${three(r, 'churnFrustrated', pct)} | ${three(r, 'finished', pct)} | ${three(r, 'boostUsed', x => x.toFixed(1))} | ${three(r, 'bought', x => x.toFixed(1))} | ${three(r, 'carriedShare', pct)} |`));
}

// ---------- --levels: bảng theo từng màn, gộp mọi kiểu người chơi ----------
if (LEVEL_OUT) {
  const pct = x => `${Math.round(x * 100)}%`, num = x => x.toFixed(2);
  const per = (mode, i, ids) => {
    const cells = report.filter(r => !ids || ids.includes(r.type.id)).flatMap(r => r[mode].perLevel[i]);
    const reached = cells.filter(c => c.tries > 0), n = Math.max(1, reached.length), cleared = reached.filter(c => c.cleared).length;
    const tries = reached.reduce((a, c) => a + c.tries, 0) || 1, t = { easy: 0, medium: 0, hard: 0 };
    reached.forEach(c => Object.keys(t).forEach(k => { t[k] += c.tiers[k]; }));
    const losses = reached.reduce((a, c) => a + c.stuck + c.moves, 0) || 1;
    return {
      reached: reached.length, firstWin: reached.filter(c => c.firstWin).length / n, triesPerClear: tries / Math.max(1, cleared),
      churn: reached.filter(c => c.churn).length, tiers: t, tries, shift: reached.reduce((a, c) => a + c.shift, 0) / tries,
      deals: reached.reduce((a, c) => a + c.deals, 0) / tries, stuckShare: reached.reduce((a, c) => a + c.stuck, 0) / losses,
    };
  };
  const label = level => (level.tier === 'boss' ? 'Boss' : { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[difficultyOf(elementCount(level))]);
  const mix = r => `${pct(r.tiers.easy / r.tries)}/${pct(r.tiers.medium / r.tries)}/${pct(r.tiers.hard / r.tries)}`;
  console.log(`
### Theo từng màn (${PLAYERS * TYPES.length} người mỗi chế độ, cố định → thích ứng)
`);
  console.log('| Màn | Tên | Nhãn gốc | Người tới màn | Thắng ngay lần đầu | Lần thử / người qua | Bỏ game tại màn (% người tới) | E/M/H thực chơi (thích ứng) | Element đổi TB | Có chỉnh bộ thẻ | Thua vì hết chỗ |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  LEVELS.forEach((level, i) => {
    const f = per('fixed', i), a = per('adaptive', i);
    console.log(`| ${i + 1} | ${level.name}${level.tutorial ? ' (tutorial)' : ''} | ${label(level)} | ${f.reached} → **${a.reached}** | ${pct(f.firstWin)} → **${pct(a.firstWin)}** | ${num(f.triesPerClear)} → **${num(a.triesPerClear)}** | ${pct(f.churn / Math.max(1, f.reached))} → **${pct(a.churn / Math.max(1, a.reached))}** | ${mix(a)} | ${a.shift >= 0 ? '+' : ''}${a.shift.toFixed(2)} | ${pct(a.deals)} | ${pct(f.stuckShare)} → **${pct(a.stuckShare)}** |`);
  });
  const groups = [['Yếu + dễ nản', ['weak', 'quitter']], ['Trung bình + khá + quay lại', ['average', 'decent', 'returning']], ['Cao thủ + dễ chán + suy nghĩ kỹ', ['skilled', 'bored', 'thinker']]];
  console.log(`
### Thắng ngay lần đầu theo nhóm tay nghề (cố định → thích ứng)
`);
  console.log(`| Màn | ${groups.map(g => g[0]).join(' | ')} |`);
  console.log(`|---|${groups.map(() => '---').join('|')}|`);
  LEVELS.forEach((level, i) => console.log(`| ${i + 1} | ${groups.map(([, ids]) => { const f = per('fixed', i, ids), a = per('adaptive', i, ids); return `${f.reached ? pct(f.firstWin) : '—'} → **${a.reached ? pct(a.firstWin) : '—'}** (${f.reached}→${a.reached} người)`; }).join(' | ')} |`));
}

