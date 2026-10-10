// Chạy bot cho Level Editor trong Web Worker (không đơ giao diện).
//   { id, jobs: [{ key, level, runs, noise, hold, seed }] } -> từng kết quả { id, key, winRate, stuckRate, avgScore, avgStars, avgMovesLeft }
//   { id, tune: { level, goal, runs, hold, seed } } -> { id, tuned: { target, winRate } }: tìm nhị phân mục tiêu điểm (bội số 10)
//     để bot giỏi thắng gần `goal` nhất (bot không đổi nước đi theo mục tiêu nên tỉ lệ thắng giảm dần khi mục tiêu tăng).
import { play } from '../bot.mjs';

const winRate = (level, { runs, hold, seed }) => {
  let wins = 0;
  for (let run = 0; run < runs; run++) if (play(level, seed + run, { noise: 1, hold }).win) wins++;
  return wins / runs;
};

// Curve độ khó: { id, curve: [{ key, level, index, noise, hold, runs }] } -> từng { id, key, stats: { winRate, movesUsed, movesUsedWin } }
// (movesUsed = trung bình số lượt đã dùng mọi ván; movesUsedWin = chỉ các ván thắng).
function curveStats(job) {
  let wins = 0, used = 0, usedWin = 0;
  for (let run = 0; run < job.runs; run++) {
    const r = play(job.level, (job.index + 1) * 100000 + run, { noise: job.noise, hold: job.hold });
    used += r.movesUsed;
    if (r.win) { wins++; usedWin += r.movesUsed; }
  }
  return { winRate: wins / job.runs, movesUsed: used / job.runs, movesUsedWin: wins ? usedWin / wins : job.level.moves };
}

self.onmessage = ({ data: { id, jobs, tune, curve } }) => {
  if (curve) {
    for (const job of curve) self.postMessage({ id, key: job.key, stats: curveStats(job) });
    self.postMessage({ id, done: true });
    return;
  }
  if (tune) {
    let lo = 1, hi = Math.max(20, tune.level.moves * 60 / 10), best = null;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2), rate = winRate({ ...tune.level, target: mid * 10 }, tune);
      if (!best || Math.abs(rate - tune.goal) < Math.abs(best.winRate - tune.goal)) best = { target: mid * 10, winRate: rate };
      self.postMessage({ id, progress: { target: mid * 10, winRate: rate } });
      if (rate > tune.goal) lo = mid + 1; else hi = mid - 1;
    }
    self.postMessage({ id, tuned: best });
    return;
  }
  for (const job of jobs) {
    let wins = 0, stuck = 0, score = 0, stars = 0, left = 0;
    for (let run = 0; run < job.runs; run++) {
      const r = play(job.level, job.seed + run, { noise: job.noise, hold: job.hold });
      score += r.score;
      if (r.win) { wins++; stars += r.stars; left += job.level.moves - r.movesUsed; }
      if (r.reason === 'stuck') stuck++;
    }
    self.postMessage({
      id, key: job.key, winRate: wins / job.runs, stuckRate: stuck / job.runs, avgScore: Math.round(score / job.runs),
      avgStars: wins ? stars / wins : 0, avgMovesLeft: wins ? left / wins : 0,
    });
  }
  self.postMessage({ id, done: true });
};
