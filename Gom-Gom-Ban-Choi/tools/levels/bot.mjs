// Bot chơi một màn (dùng chung cho tools/levels/simulate-levels.mjs và tools/levels/simulate-profiles.mjs).
// Bot tham lam: xét mọi hướng xoay, mọi ô, có dùng Gửi tạm; chỉ nhìn 1 nước nên yếu hơn người chơi giỏi thật.
// `noise` = độ "lóng ngóng": cộng nhiễu ngẫu nhiên 0..noise vào giá trị nước đi (1 = gần như luôn chọn nước tốt nhất;
// một cú gom 3 đáng 30 nên noise 30+ là hay bỏ lỡ nước gom). `hold` = có biết dùng ô Gửi tạm không.
// `boost` = { at, want(id) }: còn 1 lượt mà điểm đã đạt tỉ lệ `at` thì +3 lượt; thẻ không vừa bàn thì đổi thẻ.
// want(id) trả về true nếu người chơi có (hoặc chịu mua) booster đó; kho và xu do bên gọi quản lý.
// `trace` = mảng (tuỳ chọn): mỗi lượt đẩy vào { placed (bàn sau khi đặt, trước khi gom), board (sau khi gom), cells (ô vừa đặt), cleared,
//   card, hold (có dùng Gửi tạm), points, score, movesLeft, boosts } để Level Editor phát lại ván chơi.
import { parseBoard, makeDealer, starsFor, parseGrass } from '../../game/core/level-rules.mjs';
import { boardSize } from '../../game/core/board-shapes.mjs';
import { BOOSTERS, EFFECTS } from '../../game/data/tuning.mjs';
import { clusterEffects } from '../../game/core/cluster-effects.mjs';
import { clearMatches, placementIndices, rotateOffsets, connectedGroup } from '../../game/core/board-rules.mjs';
import { openingCard } from '../../game/core/session.mjs';
import { MATCH_SIZE, turnPoints } from '../../game/core/scoring.mjs';

export function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rotations = offsets => { const out = [offsets]; for (let i = 0; i < 3; i++) out.push(rotateOffsets(out.at(-1))); return out; };
const fits = (board, card, W, H) => rotations(card.offsets).some(o => board.some((_, a) => placementIndices(board, W, H, a, o)));

// Mọi nước đặt hợp lệ của thẻ kèm giá trị (đánh giá nhìn 1 nước). Thứ tự duyệt + số lần gọi rng giữ như cũ để bot cũ cho đúng kết quả cũ.
function movesFor(board, card, rng, noise, W, H, grass) {
  const out = [];
  for (const [rot, offsets] of rotations(card.offsets).entries()) for (let anchor = 0; anchor < W * H; anchor++) {
    const indices = placementIndices(board, W, H, anchor, offsets);
    if (!indices) continue;
    const next = board.slice();
    indices.forEach((index, i) => { next[index] = { group: card.items[i].group }; });
    const match = clearMatches(next, W, H, MATCH_SIZE);
    const points = turnPoints(match);
    // Chưa gom được thì ưu tiên nước tạo cụm 2 (chuẩn bị gom), phạt nước làm bàn chật.
    let setup = 0;
    indices.forEach(index => { if (match.board[index]) setup += connectedGroup(match.board, W, H, index).length - 1; });
    const empty = match.board.filter(cell => !cell).length;
    // Màn có cỏ: mỗi ô cỏ phá được đáng giá như một cú gom; đặt mèo lên cỏ (chuẩn bị gom) cũng được cộng.
    const cleaned = grass ? match.cleared.filter(index => grass[index]).length : 0;
    const onGrass = grass ? indices.filter(index => grass[index] && match.board[index]).length : 0;
    // Màn có mèo béo: mỗi lần đánh thức đáng như một cú gom 3 (phải đánh thức hết mới thắng).
    const wakes = (match.woke ?? []).length;
    // Màn có hộp thư: mỗi thư đáng như một cú gom 3 (màn không có hộp thư: luôn 0).
    const letters = match.mail.length;
    // Màn có bình hoa / siro dâu / chuồng: mỗi lần trúng (nứt / vỡ / rửa siro / bẻ khoá chuồng) đáng như một cú gom 3.
    // (siro là chuồng 1 khoá nên đã nằm trong `freed`.)
    const vaseHits = match.cracked.length + match.shattered.length + match.caged.length + match.freed.length;
    const value = points * 10 + cleaned * 40 + onGrass * 4 + setup * 6 + empty * 0.5 + wakes * 300 + letters * 300 + vaseHits * 300 + rng() * noise;
    out.push({ value, match, points, cleaned, indices, placed: next, rot, anchor });
  }
  return out;
}
function bestMove(board, card, rng, noise, W, H, grass) {
  let best = null;
  for (const move of movesFor(board, card, rng, noise, W, H, grass)) if (!best || move.value > best.value) best = move;
  return best;
}
// Nhìn trước 1 nước (người chơi giỏi): lấy LOOK_TOP nước tốt nhất (cả thẻ đang bóc lẫn đổi Hold), chấm bằng điểm THẬT của nước này + nước tốt nhất
// lượt sau với thẻ ĐÃ BIẾT (thẻ Next / thẻ trong Hold). Lượt sau không còn chỗ đặt = phạt nặng (tránh tự làm kẹt bàn).
const LOOK_TOP = 12, LOOK_DISCOUNT = 1, STUCK_PENALTY = 1000;
// Thế cờ để lại: mỗi cụm 2 mèo cùng màu (chờ ghép thành cụm to 4–6, ăn đậm) và ô trống còn lại.
const PAIR_VALUE = 60;
function potential(board, W, H) {
  const seen = new Set();
  let value = 0;
  board.forEach((cell, i) => {
    if (!cell?.group || cell.cage || seen.has(i)) return;
    const cluster = connectedGroup(board, W, H, i);
    cluster.forEach(k => seen.add(k));
    if (cluster.length === 2) value += PAIR_VALUE;
  });
  return value + board.filter(cell => !cell).length * .5;
}
function lookaheadPick(board, options, active, hold, queue, useHold, rng, noise, W, H, grass) {
  const cands = options.flatMap(option => movesFor(board, option.card, rng, noise, W, H, grass).map(move => ({ option, move })))
    .sort((a, b) => b.move.value - a.move.value).slice(0, LOOK_TOP);
  let pick = null;
  for (const c of cands) {
    const usedActive = c.option.card === active;
    // Sau nước này: thẻ kế biết trước = Next (nếu Hold đang trống mà đổi Hold thì Next đã bị rút, thẻ kế chưa biết); Hold = thẻ cất vào.
    const nextCard = usedActive || hold ? queue[0] : null, nextHold = usedActive ? hold : active;
    const grassAfter = grass && grass.map((g, i) => g && !c.move.match.cleared.includes(i));
    // Lượt sau: điểm thật (×10) + cỏ phá được + thế cờ để lại; nếu không biết thẻ kế thì chấm thế cờ ngay sau nước này.
    let follow = null;
    for (const card of [nextCard, useHold ? nextHold : null]) {
      if (!card) continue;
      for (const m of movesFor(c.move.match.board, card, () => 0, 0, W, H, grassAfter)) {
        const v = m.points * 10 + m.cleaned * 40 + potential(m.match.board, W, H);
        if (follow === null || v > follow) follow = v;
      }
    }
    if (follow === null) follow = nextCard || (useHold && nextHold) ? -STUCK_PENALTY : potential(c.move.match.board, W, H);
    const total = c.move.points * 10 + c.move.cleaned * 40 + LOOK_DISCOUNT * follow;
    if (!pick || total > pick.total) pick = { ...c, total };
  }
  return pick;
}

// Chọn nước đi cho game thật (Level Editor chạy bot trong game): trạng thái hiện tại -> { hold: có đổi Gửi tạm trước không, rot: số lần xoay, anchor }.
// next = thẻ kế trong hàng chờ (mảng; thẻ đầu là thẻ sẽ được bóc). Không có nước nào thì trả về null.
export function pickMove({ board, W, H, active, hold = null, next = [], useHold = true, noise = 1, lookahead = false, rng = Math.random, grass = null }) {
  const options = [{ card: active }];
  if (useHold && (hold || next[0])) options.push({ card: hold || next[0] });
  let pick = lookahead ? lookaheadPick(board, options, active, hold, next, useHold, rng, noise, W, H, grass) : null;
  if (!lookahead) for (const option of options) {
    const move = bestMove(board, option.card, rng, noise, W, H, grass);
    if (move && (!pick || move.value > pick.move.value)) pick = { option, move };
  }
  return pick && { hold: pick.option.card !== active, rot: pick.move.rot, anchor: pick.move.anchor };
}

// Thời gian một lượt của người chơi (giây) khi truyền pace = { look, think, drag, rotate, hold, gom, settle }:
//   nghĩ = look + think × log2(1 + số lựa chọn) (định luật Hick). Thấy được nước gom thì chọn ngay (một nhịp think,
//   như chọn giữa 2 lựa chọn); chưa có thì phải dò mọi chỗ đặt hợp lệ (thẻ đang bóc lẫn thẻ đổi Hold): bàn rộng càng nghĩ lâu.
//   Nước có tay hướng dẫn (tutorial 'drag' của màn) không phải nghĩ: chỉ còn look.
//   thao tác = drag + rotate × số lần xoay thẻ + hold (khi đổi Hold); chờ anim = gom (có gom) hoặc settle (chỉ đặt thẻ).
// Nhịp chơi chuẩn của 3 kiểu người chơi (dùng chung: bảng thời gian chơi + curve EV ở Level Editor, baseline.json cho mô phỏng kinh tế).
// gom / settle là thời gian anim của game, như nhau cho mọi kiểu.
const ANIM = { gom: 1.0, settle: .35 };
export const PACES = {
  weak: { look: 1.0, think: .8, drag: 1.2, rotate: .6, hold: 1.0, ...ANIM },
  mid: { look: .7, think: .55, drag: .9, rotate: .45, hold: .7, ...ANIM },
  good: { look: .4, think: .35, drag: .6, rotate: .3, hold: .45, ...ANIM },
};
// Đặc điểm một lượt (tính một lần, dùng cho mọi nhịp): bits = log2(1 + số lựa chọn), 0 nếu có tay hướng dẫn.
function turnShape(board, options, pick, W, H, guided) {
  const all = guided ? [] : options.flatMap(o => movesFor(board, o.card, () => 0, 0, W, H));
  const choices = all.some(m => m.points > 0) ? 1 : all.length;
  return { bits: guided ? 0 : Math.log2(1 + choices), rot: pick.move.rot, hold: pick.hold, gom: pick.move.points > 0 };
}
const turnCost = (pace, t) => pace.look + pace.think * t.bits + pace.drag + pace.rotate * t.rot + (t.hold ? pace.hold : 0) + (t.gom ? pace.gom : pace.settle);
// Chơi một ván. Trả về { win, reason ('moves' | 'stuck'), score, stars, movesUsed, sec, boostUse, preBoostRatio }.
// pace: một nhịp ({ look, … }) -> sec là số giây; hoặc bảng nhiều nhịp ({ weak: {…}, … }) -> sec là { weak: giây, … } (cùng một ván).
// lookahead = nhìn trước 1 nước với thẻ đã biết (người chơi giỏi); mặc định tắt để các tool cũ (baseline, sinh màn) giữ kết quả.
export function play(level, seed, { noise = 1, hold: useHold = true, boost = null, trace = null, lookahead = false, pace = null, effects = true } = {}) {
  const rng = mulberry32(seed), deal = makeDealer(level, rng), { W, H } = boardSize(level.board);
  const grass = parseGrass(level), grassTotal = grass ? grass.filter(Boolean).length : 0;
  // Tiến độ tới mục tiêu (0..1+): điểm / mục tiêu; màn có cỏ lấy phần kém hơn giữa điểm và phần cỏ đã phá (phải đủ cả hai).
  const progress = () => Math.min(score / level.target, grassTotal ? 1 - grass.filter(Boolean).length / grassTotal : Infinity);
  let board = parseBoard(level.board, level.syrup), score = 0, moves = level.moves, hold = null, mail = level.mail ?? 0;
  const queue = [];
  const draw = () => { while (queue.length < 2) queue.push(deal(board)); return queue.shift(); };
  const boostUse = { hammer: 0, swap: 0, moves: 0 };
  const many = pace && !('look' in pace);
  let preBoostRatio = null, added = 0, sec = many ? Object.fromEntries(Object.keys(pace).map(id => [id, 0])) : 0;
  const guided = (level.tutorial || []).filter(step => step.type === 'drag').length;
  const done = result => ({ ...result, ratio: progress(), score, movesUsed: level.moves + added - moves, sec, boostUse, preBoostRatio });
  // Thẻ đầu luôn gom được ngay (như session.mjs createSession).
  let active = openingCard(board, W, H, draw());
  while (moves > 0) {
    // Booster +lượt: còn 1 lượt, chưa đủ điểm nhưng đã gần (tỉ lệ `at`) -> mua thêm lượt.
    if (boost && moves === 1 && progress() >= boost.at && boost.want('moves')) {
      preBoostRatio ??= progress();
      boostUse.moves++; moves += BOOSTERS.EXTRA_MOVES; added += BOOSTERS.EXTRA_MOVES;
    }
    // Lựa chọn: đặt thẻ đang bóc, hoặc đổi với Gửi tạm (ô trống thì cất và rút thẻ kế).
    const options = [{ card: active, after: () => {} }];
    const swapCard = hold || queue[0];
    if (useHold) options.push({ card: swapCard, after: () => { if (hold) hold = active; else { hold = active; queue.shift(); } } });
    let pick = lookahead ? lookaheadPick(board, options, active, hold, queue, useHold, rng, noise, W, H, grass) : null;
    if (!lookahead) for (const option of options) {
      const move = bestMove(board, option.card, rng, noise, W, H, grass);
      if (move && (!pick || move.value > pick.move.value)) pick = { option, move };
    }
    if (!pick) return done({ win: false, reason: 'stuck' });
    if (pace) {
      const shape = turnShape(board, options, { move: pick.move, hold: pick.option.card !== active }, W, H, level.moves + added - moves < guided);
      if (many) for (const id in pace) sec[id] += turnCost(pace[id], shape); else sec += turnCost(pace, shape);
    }
    if (pick.option.card !== active) pick.option.after();
    if (grass) [...pick.move.match.cleared, ...(pick.move.match.rolled ?? []).flatMap(roll => roll.area)].forEach(index => { grass[index] = false; });
    // Hiệu ứng cụm to / gom đôi như session.mjs (bot không chủ động săn hiệu ứng, chỉ hưởng khi trúng).
    const fx = effects ? clusterEffects(pick.move.match, pick.move.indices, W, H, grass) : null;
    score += fx ? Math.round((pick.move.points + fx.points) * (fx.double ? EFFECTS.DOUBLE_MULT : 1)) : pick.move.points;
    board = fx ? fx.board : pick.move.match.board;
    mail -= pick.move.match.mail.length + (fx?.mail.length ?? 0);
    if (fx?.grass) fx.grass.forEach((g, i) => { grass[i] = g; });
    moves--;
    trace?.push({ placed: pick.move.placed, board, cells: pick.move.indices, cleared: pick.move.match.cleared, card: pick.option.card, hold: pick.option.card !== active,
      points: pick.move.points, score, movesLeft: moves, boosts: { ...boostUse }, grass: grass && grass.slice() });
    if (score >= level.target && !(grass && grass.includes(true)) && mail <= 0 && !board.some(cell => cell?.cage || cell?.fat || cell?.vase)) return done({ win: true, stars: starsFor(level, moves) });
    active = draw();
    // Thẻ mới không vừa bàn: còn đường thoát nếu cất được vào Gửi tạm (ô trống, hoặc thẻ đang gửi vừa bàn).
    const escape = useHold && (!hold || fits(board, hold, W, H));
    // Booster đổi thẻ: thẻ không vừa bàn thì bóc thẻ khác (thử tối đa 2 lần).
    for (let k = 0; k < 2 && boost && !fits(board, active, W, H) && !escape && boost.want('swap'); k++) { boostUse.swap++; active = deal(board); }
    if (!fits(board, active, W, H) && !escape) return done({ win: false, reason: 'stuck' });
  }
  return done({ win: false, reason: 'moves' });
}
