// Test đồ treo tường hoà theo màu tường (wall-theme.mjs). Chạy: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitToWall, fitToFloor, DEFAULT_WALL, DEFAULT_FLOOR, MIN_CONTRAST, hexToRgb, rgbToHsl } from './wall-theme.mjs';
import { CATALOG } from './deco-data.mjs';

const hsl = hex => rgbToHsl(hexToRgb(hex));
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const DECOR = ['#ffb3c4', '#e8617f', '#c98a55', '#2b2f3a', '#9fd0f0', '#3b8fe0', '#ffd66b', '#7fc45a', '#fff4e0', '#ffffff', '#b48ee8', '#f6d88f', '#8a6a4a'];
const walls = CATALOG.filter(e => e.cat === 'walls' && e.zone === 'living').map(e => e.color);

test('tường mặc định: đồ treo giữ đúng màu gốc', () => {
  for (const c of DECOR) assert.equal(fitToWall(c, DEFAULT_WALL), c);
});

test('mọi tường trong danh mục: đồ treo không chìm vào tường (tương phản không kém bản gốc, tối đa MIN_CONTRAST)', () => {
  assert.ok(walls.length >= 6, 'không đọc được danh sách tường');
  for (const wall of walls) for (const c of DECOR) {
    const need = Math.min(Math.abs(hsl(c)[2] - hsl(DEFAULT_WALL)[2]), MIN_CONTRAST);
    const got = Math.abs(hsl(fitToWall(c, wall))[2] - hsl(wall)[2]);
    assert.ok(got >= need - .02, `${c} trên tường ${wall}: tương phản ${got.toFixed(2)} < ${need.toFixed(2)}`);
  }
});

test('tường có sắc: đồ treo xoay sắc theo tường (bạc hà ngả xanh lá, tường tím ngả tím)', () => {
  const mint = walls.find(c => c.toLowerCase() === '#d4efd0'), lilac = walls.find(c => c.toLowerCase() === '#e6dcff');
  for (const [wall, target] of [[mint, hsl(mint)[0]], [lilac, hsl(lilac)[0]]]) {
    const out = hsl(fitToWall('#e8617f', wall))[0], base = hsl('#e8617f')[0];
    assert.ok(hueGap(out, target) < hueGap(base, target), `sắc rèm ${out.toFixed(0)}° không gần tường ${target.toFixed(0)}° hơn bản gốc ${base.toFixed(0)}°`);
  }
});

test('tường xám / tối: đồ xám giữ xám, đồ tối sáng lên khỏi chìm', () => {
  const graphite = walls.find(c => c.toLowerCase() === '#3b3f46'), concrete = walls.find(c => c.toLowerCase() === '#8d9196');
  assert.ok(hsl(fitToWall('#ffffff', graphite))[1] < .1, 'đồ trắng trên tường xám đổi sang có sắc');
  assert.ok(hsl(fitToWall('#2b2f3a', graphite))[2] > hsl('#2b2f3a')[2] + .1, 'khung tối trên tường graphite vẫn chìm');
  const out = hsl(fitToWall('#e8617f', concrete));
  assert.ok(out[1] < hsl('#e8617f')[1], 'tường xám phải làm dịu màu rực');
});

test('tường xám / tối không có sắc để theo: đồ treo giữ nguyên sắc (không hồng hoá xanh lá)', () => {
  for (const wall of ['#3b3f46', '#8d9196']) for (const c of ['#ffb3c4', '#e8617f', '#ffd66b', '#7fc45a', '#9fd0f0']) {
    assert.ok(hueGap(hsl(fitToWall(c, wall))[0], hsl(c)[0]) < 4, `${c} trên tường ${wall} bị đổi sắc`);
  }
});

test('deco-room.mjs gọi themeWallDecor mỗi lần áp tường và bỏ qua kính / texture / vật phát sáng', async () => {
  const fs = await import('node:fs');
  const room = fs.readFileSync(new URL('./deco-room.mjs', import.meta.url), 'utf8');
  assert.ok(room.includes('themeWallDecor(inside, wall.color)'), 'đổi tường phải tô lại đồ treo tường');
  assert.ok(room.includes("import { fitToWall, fitToFloor } from './wall-theme.mjs'"), 'thiếu import fitToWall / fitToFloor');
  assert.ok(room.includes('themeFloorDecor(inside, floorEntry.color)'), 'đổi sàn phải tô lại đồ cố định trên sàn');
  assert.ok(room.includes('m.userData.wallKeep') && room.includes('m.map') && room.includes('m.emissive'), 'thiếu bộ lọc kính / texture / phát sáng');
  assert.ok((room.match(/wallKeep: true/g) || []).length >= 2, 'kính trời cửa sổ phải đánh dấu wallKeep');
});

// Đồ cố định trên sàn (tủ thấp, gối, thảm chùi chân, dép, thùng rác...): vẽ cho sàn sồi mặc định, hoà theo sàn đang chọn.
const floors = CATALOG.filter(e => e.cat === 'floors' && e.zone !== 'garden').map(e => e.color);
const FLOOR_DECOR = ['#e9c58f', '#d9a36a', '#b9854a', '#f3d5a8', '#8fc9f2', '#e8617f', '#ffd27a', '#9fd0f0', '#ffb3c4', '#c9955e', '#b48ee8', '#c8ccd2', '#fffaf0'];

test('sàn mặc định (sồi): đồ cố định trên sàn giữ đúng màu gốc', () => {
  for (const c of FLOOR_DECOR) assert.equal(fitToFloor(c, DEFAULT_FLOOR), c);
});

test('mọi sàn trong danh mục: đồ trên sàn không chìm vào sàn, sàn xám thì giữ sắc, sàn có sắc thì ngả theo', () => {
  assert.ok(floors.length >= 15, 'không đọc được danh sách sàn');
  for (const floor of floors) for (const c of FLOOR_DECOR) {
    const need = Math.min(Math.abs(hsl(c)[2] - hsl(DEFAULT_FLOOR)[2]), MIN_CONTRAST);
    const got = Math.abs(hsl(fitToFloor(c, floor))[2] - hsl(floor)[2]);
    assert.ok(got >= need - .02, `${c} trên sàn ${floor}: tương phản ${got.toFixed(2)} < ${need.toFixed(2)}`);
  }
  for (const floor of ['#3a3330', '#9a9da1', '#4a4e55', '#5c6068']) for (const c of ['#e8617f', '#8fc9f2', '#ffd27a']) {
    assert.ok(hueGap(hsl(fitToFloor(c, floor))[0], hsl(c)[0]) < 4, `${c} trên sàn xám ${floor} bị đổi sắc`);
  }
  const mint = '#bfe3cf', out = hsl(fitToFloor('#e8617f', mint))[0], base = hsl('#e8617f')[0], target = hsl(mint)[0];
  assert.ok(hueGap(out, target) < hueGap(base, target), 'sàn bạc hà: đồ trên sàn phải ngả về xanh');
});
