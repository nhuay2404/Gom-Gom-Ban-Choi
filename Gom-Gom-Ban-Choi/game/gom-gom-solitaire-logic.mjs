// Gom Gom Solitaire: luật thuần, không đụng DOM, để kiểm thử bằng node:test.
// Bàn gồm các cột úp (chỉ thẻ đáy ngửa), bãi cỏ thẻ ngửa, giỏ mục tiêu và khay 8 ô.

export const TRAY_SIZE = 8, MATCH_SIZE = 3, PARKING_SIZE = 3;

export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, rng) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

const clone = state => structuredClone(state);

// Lớp ngửa lúc mở màn (bãi cỏ + thẻ đáy mỗi cột) chia đều các loại,
// nên chọn loại nào làm mục tiêu cũng gom ngay được vài con. Thẻ úp chỉ được gán loại sau khi chọn.
// othersTotal: một số (mọi loại phụ bằng nhau) hoặc mảng quota cho các loại phụ, gán ngẫu nhiên lúc chọn mục tiêu.
export function createLevel({ breeds, depths, fieldRows, fieldCols, targetTotal, othersTotal }, rng) {
  const visibleCount = depths.length + fieldRows * fieldCols;
  const quotas = Array.isArray(othersTotal) ? othersTotal : Array(breeds.length - 1).fill(othersTotal);
  if (quotas.length !== breeds.length - 1) throw new Error('Số quota phải bằng số loại mèo phụ');
  if (targetTotal % MATCH_SIZE || quotas.some(quota => quota % MATCH_SIZE)) throw new Error('Số mèo mỗi loại phải chia hết cho 3');
  const hiddenCount = depths.reduce((sum, depth) => sum + depth - 1, 0);
  if (targetTotal + quotas.reduce((sum, quota) => sum + quota, 0) !== visibleCount + hiddenCount) throw new Error('Tổng số mèo không khớp số ô');
  const perBreed = Math.ceil(visibleCount / breeds.length);
  if (perBreed > Math.min(targetTotal, ...quotas)) throw new Error('Lớp ngửa nhiều hơn số mèo của một loại');
  let nextId = 0;
  // Chia đều nhất có thể: mỗi loại xuất hiện floor hoặc ceil(visible / số loại) lần.
  const extra = shuffle(breeds, rng).slice(0, visibleCount % breeds.length);
  const base = Math.floor(visibleCount / breeds.length);
  const visible = shuffle(breeds.flatMap(breed => Array(base + (extra.includes(breed) ? 1 : 0)).fill(breed)), rng);
  const card = breed => ({ id: nextId++, breed });
  // Mỗi cột: phần tử cuối là thẻ đáy đang ngửa, phần tử 0 nằm sâu nhất.
  const columns = depths.map(depth => [...Array.from({ length: depth - 1 }, () => card(null)), card(visible.pop())]);
  const field = Array.from({ length: fieldRows * fieldCols }, () => card(visible.pop()));
  return {
    breeds, columns, field, fieldCols, tray: [], parking: [],
    target: null, targetTotal, quotas, collected: 0, status: 'choose',
  };
}

// Chọn loại mục tiêu rồi gán loại cho thẻ úp: mèo mục tiêu còn lại bị đẩy về phía sâu của cột.
export function chooseTarget(state, breed, rng, buryBias = 0.75, chaos = 1, layout = 'layer') {
  if (state.status !== 'choose' || !state.breeds.includes(breed)) return { error: 'Không chọn được loại mèo này.' };
  const next = clone(state);
  next.target = breed;
  next.status = 'playing';
  const onTop = [...next.field.filter(Boolean), ...next.columns.map(column => column.at(-1))];
  const quotas = shuffle(next.quotas, rng);
  const remaining = Object.fromEntries(next.breeds.map(name => [name, name === breed ? next.targetTotal : quotas.pop()]));
  onTop.forEach(card => { remaining[card.breed]--; });
  const hidden = next.columns.flatMap(column => column.slice(0, -1).map((card, depthFromTop) => ({ card, depth: column.length - 1 - depthFromTop })));
  const maxDepth = Math.max(1, ...hidden.map(slot => slot.depth));
  // Điểm càng cao càng dễ nhận mèo mục tiêu: sâu hơn thì điểm cao hơn, cộng một phần ngẫu nhiên.
  const ranked = hidden
    .map(slot => ({ ...slot, score: buryBias * (slot.depth / maxDepth) + (1 - buryBias) * rng() }))
    .sort((a, b) => b.score - a.score);
  ranked.slice(0, remaining[breed]).forEach(slot => { slot.card.breed = breed; });
  // Mèo phụ được xếp thành từng bộ 3: 'layer' = cùng một tầng ở các cột cạnh nhau, 'stack' = nối nhau trong một cột.
  // Sau đó xáo lẫn một phần `chaos`.
  // Nhờ vậy cột sâu vẫn giải được: bóc hết một tầng là lộ ra vài bộ 3 cùng lúc.
  // Phần lẻ (bù cho mấy con đang ngửa) đặt ở tầng nông nhất để ghép ngay với con ngửa; các bộ 3 đủ nằm sau.
  const partials = [], triples = [];
  next.breeds.filter(name => name !== breed).forEach(name => {
    const odd = remaining[name] % MATCH_SIZE;
    if (odd) partials.push(Array(odd).fill(name));
    for (let left = remaining[name] - odd; left > 0; left -= MATCH_SIZE) triples.push(Array(MATCH_SIZE).fill(name));
  });
  const others = [...shuffle(partials, rng), ...shuffle(triples, rng)].flat();
  const columnOf = slot => next.columns.findIndex(column => column.includes(slot.card));
  const slots = ranked.slice(remaining[breed]).sort(layout === 'stack'
    ? (a, b) => columnOf(a) - columnOf(b) || a.depth - b.depth
    : (a, b) => a.depth - b.depth || columnOf(a) - columnOf(b));
  for (let swaps = Math.round(chaos * others.length); swaps > 0; swaps--) {
    const i = Math.floor(rng() * others.length), j = Math.floor(rng() * others.length);
    [others[i], others[j]] = [others[j], others[i]];
  }
  slots.forEach((slot, index) => { slot.card.breed = others[index]; });
  const events = [];
  collectVisibleTargets(next, events);
  resolveStatus(next);
  return { state: next, events };
}

// Lúc chọn mục tiêu hoặc sau khi xáo, mọi mèo mục tiêu đang ngửa bay thẳng vào giỏ.
// Chỉ quét một lượt: thẻ vừa lộ ra ở đáy cột phải bấm mới lấy.
function collectVisibleTargets(state, events) {
  state.field.forEach((card, index) => {
    if (card?.breed !== state.target) return;
    state.field[index] = null;
    state.collected++;
    events.push({ type: 'collect', card, from: { zone: 'field', index } });
  });
  state.columns.forEach((column, index) => {
    const card = column.at(-1);
    if (card?.breed !== state.target) return;
    column.pop();
    state.collected++;
    events.push({ type: 'collect', card, from: { zone: 'column', index } });
  });
}

export function pickable(state, source) {
  if (state.status !== 'playing' && state.status !== 'choose') return null;
  if (source.zone === 'field') return state.field[source.index] ?? null;
  if (source.zone === 'column') return state.columns[source.index]?.at(-1) ?? null;
  if (source.zone === 'parking') return state.status === 'playing' ? state.parking[source.index] ?? null : null;
  return null;
}

// Thẻ mới chèn ngay sau con cùng loại cuối cùng trong khay; đủ 3 con liền nhau thì biến mất.
export function insertIntoTray(tray, card) {
  const next = tray.slice();
  const last = next.findLastIndex(other => other.breed === card.breed);
  next.splice(last < 0 ? next.length : last + 1, 0, card);
  const same = next.filter(other => other.breed === card.breed);
  if (same.length < MATCH_SIZE) return { tray: next, cleared: [] };
  const cleared = same.slice(0, MATCH_SIZE);
  return { tray: next.filter(other => !cleared.includes(other)), cleared };
}

function resolveStatus(state) {
  if (state.collected >= state.targetTotal) state.status = 'won';
  else if (state.tray.length >= TRAY_SIZE) state.status = 'lost';
}

export function pick(state, source) {
  if (state.status !== 'playing') return { error: 'Ván chưa bắt đầu hoặc đã kết thúc.' };
  const card = pickable(state, source);
  if (!card) return { error: 'Không lấy được thẻ này.' };
  const next = clone(state);
  if (source.zone === 'field') next.field[source.index] = null;
  else if (source.zone === 'column') next.columns[source.index].pop();
  else next.parking.splice(source.index, 1);
  const events = [];
  if (card.breed === next.target) {
    next.collected++;
    events.push({ type: 'collect', card, from: source });
  } else {
    const result = insertIntoTray(next.tray, card);
    next.tray = result.tray;
    events.push({ type: 'tray', card, from: source });
    if (result.cleared.length) events.push({ type: 'clear', breed: card.breed, cards: result.cleared });
  }
  if (source.zone === 'column' && next.columns[source.index].length) events.push({ type: 'reveal', column: source.index });
  resolveStatus(next);
  return { state: next, events };
}

// Gỡ tối đa 3 con đầu khay ra hàng chờ; con trong hàng chờ bấm lại được để đưa về khay.
export function moveOut(state) {
  if (state.status !== 'playing' && state.status !== 'lost') return { error: 'Chưa dùng được Gỡ ra.' };
  const room = PARKING_SIZE - state.parking.length;
  if (!state.tray.length) return { error: 'Khay đang trống.' };
  if (!room) return { error: 'Hàng chờ đã đầy.' };
  const next = clone(state);
  const moved = next.tray.splice(0, Math.min(room, next.tray.length));
  next.parking.push(...moved);
  next.status = 'playing';
  return { state: next, events: [{ type: 'moveOut', cards: moved }] };
}

// Xáo loại của mọi mèo còn trên bàn (cột + bãi cỏ), giữ nguyên vị trí và số lượng.
export function shuffleBoard(state, rng) {
  if (state.status !== 'playing') return { error: 'Chưa dùng được Xáo.' };
  const next = clone(state);
  const cards = [...next.columns.flat(), ...next.field.filter(Boolean)];
  const breeds = shuffle(cards.map(card => card.breed), rng);
  cards.forEach((card, index) => { card.breed = breeds[index]; });
  const events = [{ type: 'shuffle' }];
  collectVisibleTargets(next, events);
  resolveStatus(next);
  return { state: next, events };
}

export function remainingOnBoard(state) {
  return state.columns.reduce((sum, column) => sum + column.length, 0) + state.field.filter(Boolean).length;
}
