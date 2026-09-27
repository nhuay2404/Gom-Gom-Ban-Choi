import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAY_SIZE, createLevel, chooseTarget, insertIntoTray, moveOut, mulberry32, pick, remainingOnBoard, shuffleBoard,
} from './gom-gom-solitaire-logic.mjs';

const breeds = ['a', 'b', 'c', 'd', 'e', 'f'];
const config = { breeds, depths: [8, 8, 8, 8, 8, 8], fieldRows: 2, fieldCols: 6, targetTotal: 15, othersTotal: 9 };
const cat = (id, breed) => ({ id, breed });

function countBreeds(state) {
  const counts = {};
  const all = [...state.columns.flat(), ...state.field.filter(Boolean), ...state.tray, ...state.parking];
  all.forEach(card => { counts[card.breed] = (counts[card.breed] ?? 0) + 1; });
  return counts;
}

test('mở màn: lớp ngửa có đúng 3 con mỗi loại, thẻ úp chưa có loại', () => {
  const state = createLevel(config, mulberry32(1));
  const visible = [...state.field, ...state.columns.map(column => column.at(-1))];
  breeds.forEach(breed => assert.equal(visible.filter(card => card.breed === breed).length, 3));
  assert.ok(state.columns.every(column => column.slice(0, -1).every(card => card.breed === null)));
  assert.equal(state.status, 'choose');
});

test('cấu hình lệch tổng số mèo bị từ chối', () => {
  assert.throws(() => createLevel({ ...config, targetTotal: 12 }, mulberry32(1)));
});

test('chọn mục tiêu: mèo mục tiêu đang ngửa vào giỏ, tổng mỗi loại đúng quota', () => {
  const start = createLevel(config, mulberry32(2));
  const { state, events } = chooseTarget(start, 'c', mulberry32(3));
  assert.equal(state.status, 'playing');
  assert.equal(state.collected, 3);
  assert.equal(events.filter(event => event.type === 'collect').length, 3);
  const counts = countBreeds(state);
  assert.equal(counts.c + state.collected, 15);
  breeds.filter(breed => breed !== 'c').forEach(breed => assert.equal(counts[breed], 9));
});

test('buryBias = 1 dồn mèo mục tiêu xuống đáy sâu nhất của cột', () => {
  const start = createLevel(config, mulberry32(4));
  const { state } = chooseTarget(start, 'a', mulberry32(5), 1);
  // 12 con còn lại, 6 cột: hai tầng sâu nhất (vị trí 0 và 1) phải toàn là mèo mục tiêu.
  state.columns.forEach(column => {
    assert.equal(column[0].breed, 'a');
    assert.equal(column[1].breed, 'a');
  });
});

test('khay tự xếp cạnh con cùng loại và nổ khi đủ 3', () => {
  let result = insertIntoTray([cat(1, 'a'), cat(2, 'b'), cat(3, 'a')], cat(4, 'b'));
  assert.deepEqual(result.tray.map(card => card.id), [1, 2, 4, 3]);
  result = insertIntoTray([cat(1, 'a'), cat(3, 'a'), cat(2, 'b')], cat(5, 'a'));
  assert.deepEqual(result.cleared.map(card => card.id), [1, 3, 5]);
  assert.deepEqual(result.tray.map(card => card.id), [2]);
});

function playing(overrides = {}) {
  return {
    breeds, target: 'a', targetTotal: 3, othersTotal: 3, collected: 0, status: 'playing', fieldCols: 2,
    columns: [[cat(10, 'b'), cat(11, 'a')], [cat(12, 'c')]],
    field: [cat(20, 'b'), null], tray: [], parking: [], ...overrides,
  };
}

test('lấy đáy cột làm lộ thẻ kế tiếp; mèo mục tiêu không vào khay', () => {
  const { state, events } = pick(playing(), { zone: 'column', index: 0 });
  assert.equal(state.collected, 1);
  assert.equal(state.tray.length, 0);
  assert.equal(state.columns[0].at(-1).id, 10);
  assert.ok(events.some(event => event.type === 'reveal'));
});

test('ô bãi cỏ đã lấy thì bỏ trống, không lấy lại được', () => {
  const first = pick(playing(), { zone: 'field', index: 0 });
  assert.equal(first.state.field[0], null);
  assert.equal(first.state.tray[0].id, 20);
  assert.ok(pick(first.state, { zone: 'field', index: 0 }).error);
});

test('gom đủ mục tiêu là thắng', () => {
  const { state } = pick(playing({ collected: 2 }), { zone: 'column', index: 0 });
  assert.equal(state.status, 'won');
});

test('khay đầy 8 con không có bộ 3 là thua', () => {
  const tray = ['b', 'b', 'c', 'c', 'd', 'd', 'f'].map((breed, index) => cat(100 + index, breed));
  const { state } = pick(playing({ tray, columns: [[cat(12, 'e')]] }), { zone: 'column', index: 0 });
  assert.equal(state.tray.length, TRAY_SIZE);
  assert.equal(state.status, 'lost');
});

test('con thứ 8 tạo bộ 3 thì không thua', () => {
  const tray = ['b', 'b', 'c', 'c', 'd', 'd', 'f'].map((breed, index) => cat(100 + index, breed));
  const { state } = pick(playing({ tray }), { zone: 'field', index: 0 });
  assert.equal(state.status, 'playing');
  assert.equal(state.tray.length, 5);
});

test('Gỡ ra cứu ván thua và con trong hàng chờ quay lại khay được', () => {
  const tray = ['b', 'b', 'c', 'c', 'd', 'd', 'e'].map((breed, index) => cat(100 + index, breed));
  const out = moveOut(playing({ tray, status: 'lost' }));
  assert.equal(out.state.status, 'playing');
  assert.deepEqual(out.state.parking.map(card => card.breed), ['b', 'b', 'c']);
  assert.equal(out.state.tray.length, 4);
  assert.ok(moveOut(out.state).error, 'hàng chờ đầy thì không gỡ thêm');
  const back = pick(out.state, { zone: 'parking', index: 0 });
  assert.equal(back.state.parking.length, 2);
  assert.equal(back.state.tray.filter(card => card.breed === 'b').length, 1);
});

test('Xáo giữ nguyên số mèo trên bàn và tự gom mục tiêu vừa ngửa', () => {
  const start = chooseTarget(createLevel(config, mulberry32(6)), 'b', mulberry32(7)).state;
  const before = remainingOnBoard(start) + start.collected;
  const { state } = shuffleBoard(start, mulberry32(8));
  assert.equal(remainingOnBoard(state) + state.collected, before);
  const visible = [...state.field.filter(Boolean), ...state.columns.map(column => column.at(-1)).filter(Boolean)];
  assert.ok(visible.every(card => card.breed !== 'b'));
});

test('quota riêng cho từng loại phụ: 16 loại, bàn 10 cột lệch số lượng vẫn khớp', () => {
  const many = Array.from({ length: 16 }, (_, index) => `k${index}`);
  const quotas = Array.from({ length: 15 }, (_, index) => index < 5 ? 6 : 3);
  const cfg = { breeds: many, depths: Array(10).fill(4).map((depth, index) => depth + (index < 8 ? 1 : 0)), fieldRows: 3, fieldCols: 10, targetTotal: 18, othersTotal: quotas };
  const start = createLevel(cfg, mulberry32(9));
  const { state } = chooseTarget(start, start.field[0].breed, mulberry32(10));
  assert.equal(state.collected + (countBreeds(state)[state.target] ?? 0), 18);
  const others = many.filter(name => name !== state.target).map(name => countBreeds(state)[name]).sort((a, b) => a - b);
  assert.deepEqual(others, [...quotas].sort((a, b) => a - b));
});
