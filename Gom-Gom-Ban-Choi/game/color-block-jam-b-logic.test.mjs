import test from 'node:test';
import assert from 'node:assert/strict';
import { boardNeeds, clearMatches, clearOdds, expectedLeftover, findHelpfulCard, generateStartBoard, helpChance, remainingCats, mergeTarget, findLineMatch, placeCard, placementIndices, rotateOffsets, slideDirectional } from './color-block-jam-b-logic.mjs';

const W = 5, H = 5;
function scene() {
  const board = Array(W * H).fill(null);
  board[1 * W + 2] = { name: 'Nấm', group: 'garden' };
  board[2 * W + 2] = { name: 'Lá', group: 'garden' };
  board[3 * W + 1] = { name: 'Hoa', group: 'garden' };
  return board;
}
function names(board) { return board.map(cell => cell?.name ?? null); }

test('match bốn block cùng màu theo hàng ngang hoặc dọc', () => {
  const horizontal = Array(W * H).fill(null);
  for (let col = 1; col < 5; col++) horizontal[2 * W + col] = { group: 'fruit' };
  assert.deepEqual(findLineMatch(horizontal, W, H), { group: 'fruit', indices: [11, 12, 13, 14], axis: 'horizontal' });
  const vertical = Array(W * H).fill(null);
  for (let row = 0; row < 4; row++) vertical[row * W + 3] = { group: 'animal' };
  assert.deepEqual(findLineMatch(vertical, W, H), { group: 'animal', indices: [3, 8, 13, 18], axis: 'vertical' });
});

test('bốn block hình chữ L không được tính là match', () => {
  const board = Array(W * H).fill(null);
  [0, 1, 2, 7].forEach(index => { board[index] = { group: 'garden' }; });
  assert.equal(findLineMatch(board, W, H), null);
});

test('vuốt Nấm sang trái: Lá đi theo, Hoa chạm chéo đứng yên', () => {
  const result = slideDirectional(scene(), W, H, 1 * W + 2, -1);
  assert.equal(result.moved, 2);
  assert.equal(result.board[1 * W + 1].name, 'Nấm');
  assert.equal(result.board[2 * W + 1].name, 'Lá');
  assert.equal(result.board[3 * W + 1].name, 'Hoa');
});

test('vuốt Lá sang trái: Nấm cũng đi theo', () => {
  const result = slideDirectional(scene(), W, H, 2 * W + 2, -1);
  assert.equal(result.moved, 2);
  assert.equal(result.board[1 * W + 1].name, 'Nấm');
  assert.equal(result.board[2 * W + 1].name, 'Lá');
  assert.equal(result.board[3 * W + 1].name, 'Hoa');
});

test('Hoa chạm chéo nên vuốt Hoa không kéo Nấm/Lá', () => {
  const result = slideDirectional(scene(), W, H, 3 * W + 1, -1);
  assert.equal(result.moved, 1);
  assert.equal(result.board[3 * W + 0].name, 'Hoa');
  assert.equal(result.board[1 * W + 2].name, 'Nấm');
  assert.equal(result.board[2 * W + 2].name, 'Lá');
});

test('cụm chữ L dính hoàn toàn khi chạm cạnh', () => {
  const board = scene(); board[2 * W + 1] = board[3 * W + 1]; board[3 * W + 1] = null;
  const result = slideDirectional(board, W, H, 1 * W + 2, -W);
  assert.equal(result.moved, 3);
  assert.equal(result.board[0 * W + 2].name, 'Nấm');
  assert.equal(result.board[1 * W + 2].name, 'Lá');
  assert.equal(result.board[1 * W + 1].name, 'Hoa');
});

test('một thẻ bị chặn nhưng thẻ khác trong cụm vẫn đi', () => {
  const board = scene(); board[1 * W + 1] = { wall: true };
  const result = slideDirectional(board, W, H, 1 * W + 2, -1);
  assert.equal(result.moved, 1);
  assert.equal(result.blocked, 1);
  assert.equal(result.board[1 * W + 2].name, 'Nấm');
  assert.equal(result.board[2 * W + 1].name, 'Lá');
});

test('ví dụ Hoa–Lá–Nấm vuốt lên: Lá kẹt, Hoa và Nấm lên', () => {
  const board = Array(W * H).fill(null);
  board[3 * W + 2] = { wall: true };
  board[4 * W + 1] = { name: 'Hoa', group: 'garden' };
  board[4 * W + 2] = { name: 'Lá', group: 'garden' };
  board[4 * W + 3] = { name: 'Nấm', group: 'garden' };
  for (const source of [4 * W + 1, 4 * W + 2, 4 * W + 3]) {
    const result = slideDirectional(board, W, H, source, -W);
    assert.equal(result.moved, 2);
    assert.equal(result.blocked, 1);
    assert.equal(result.board[3 * W + 1].name, 'Hoa');
    assert.equal(result.board[4 * W + 2].name, 'Lá');
    assert.equal(result.board[3 * W + 3].name, 'Nấm');
  }
});

test('khi cả cụm bị chặn thì không đổi bàn', () => {
  const board = scene(); board[1 * W + 1] = { wall: true }; board[2 * W + 1] = { wall: true };
  const before = names(board);
  const result = slideDirectional(board, W, H, 1 * W + 2, -1);
  assert.ok(result.error);
  assert.deepEqual(names(board), before);
});

test('màn chính có đường giải với bốn khối mỗi nhóm', () => {
  let board = Array(W * H).fill(null);
  const put = (r, c, name, group) => { board[r * W + c] = { name, group }; };
  put(0, 4, 'Táo', 'fruit'); put(1, 0, 'Nho', 'fruit'); put(1, 1, 'Dâu', 'fruit'); put(1, 2, 'Chuối', 'fruit');
  put(2, 4, 'Mèo', 'animal'); put(3, 0, 'Chó', 'animal'); put(3, 1, 'Thỏ', 'animal'); put(3, 2, 'Gấu', 'animal');
  put(4, 0, 'Hoa', 'garden'); put(4, 1, 'Lá', 'garden'); put(4, 2, 'Ong', 'garden'); put(3, 4, 'Nấm', 'garden');
  board[1 * W + 3] = { wall: true }; board[3 * W + 3] = { wall: true };
  const swipe = (r, c, delta) => {
    const result = slideDirectional(board, W, H, r * W + c, delta);
    assert.equal(result.error, undefined);
    board = result.board;
  };
  const clear = (row, group) => {
    assert.deepEqual(board.slice(row * W + 1, row * W + 5).map(c => c?.group), [group, group, group, group]);
    for (let c = 1; c < 5; c++) board[row * W + c] = null;
  };
  swipe(1, 0, -W); swipe(0, 4, -1); swipe(0, 0, 1); clear(0, 'fruit');
  swipe(3, 0, -W); swipe(2, 4, -1); swipe(2, 0, 1); clear(2, 'animal');
  swipe(3, 4, W); swipe(4, 4, -1); swipe(4, 0, 1); clear(4, 'garden');
  assert.equal(board.filter(cell => cell?.group).length, 0);
});

function verifyHardLevel(tiles, walls, solution) {
  let board = Array(W * H).fill(null);
  for (const [row, col, name, group] of tiles) board[row * W + col] = { name, group };
  for (const [row, col] of walls) board[row * W + col] = { wall: true };
  const swipe = (row, col, delta) => {
    const result = slideDirectional(board, W, H, row * W + col, delta);
    assert.equal(result.error, undefined, `vuốt lỗi tại hàng ${row + 1}, cột ${col + 1}, delta ${delta}`); board = result.board;
  };
  const clear = (row, group) => {
    assert.deepEqual(board.slice(row * W + 1, row * W + 5).map(cell => cell?.group), [group, group, group, group]);
    for (let col = 1; col < W; col++) board[row * W + col] = null;
  };
  for (const action of solution) action.length === 2 ? clear(...action) : swipe(...action);
  assert.equal(board.filter(cell => cell?.group).length, 0);
}

test('màn 2 có đường giải 13 lượt', () => verifyHardLevel([
  [0, 4, 'Táo', 'fruit'], [1, 0, 'Nho', 'fruit'], [1, 1, 'Dâu', 'fruit'], [2, 2, 'Chuối', 'fruit'],
  [2, 4, 'Mèo', 'animal'], [3, 0, 'Chó', 'animal'], [3, 1, 'Thỏ', 'animal'], [4, 3, 'Gấu', 'animal'],
  [4, 0, 'Hoa', 'garden'], [4, 1, 'Lá', 'garden'], [3, 2, 'Ong', 'garden'], [3, 4, 'Nấm', 'garden'],
], [[1, 3]], [
  [3, 2, W],
  [2, 2, -W], [1, 0, -W], [0, 4, -1], [0, 0, 1], [0, 'fruit'],
  [4, 3, -W], [3, 3, -1], [3, 0, -W], [2, 4, -1], [2, 0, 1], [2, 'animal'],
  [3, 4, W], [4, 4, -1], [4, 0, 1], [4, 'garden'],
]));

test('màn 3 có đường giải đúng 15 lượt', () => verifyHardLevel([
  [0, 4, 'Táo', 'fruit'], [1, 0, 'Nho', 'fruit'], [2, 1, 'Dâu', 'fruit'], [1, 2, 'Chuối', 'fruit'],
  [2, 4, 'Mèo', 'animal'], [3, 0, 'Chó', 'animal'], [3, 1, 'Thỏ', 'animal'], [4, 3, 'Gấu', 'animal'],
  [4, 0, 'Hoa', 'garden'], [4, 1, 'Lá', 'garden'], [3, 2, 'Ong', 'garden'], [1, 4, 'Nấm', 'garden'],
], [[1, 3]], [
  [3, 2, W],
  [2, 1, -W], [1, 0, -W], [0, 4, -1], [0, 0, 1], [0, 'fruit'],
  [4, 3, -W], [3, 3, -1], [3, 0, -W], [2, 4, -1], [2, 0, 1], [2, 'animal'],
  [1, 4, W], [2, 4, W], [3, 4, W], [4, 4, -1], [4, 0, 1], [4, 'garden'],
]));

test('màn 4 có bảy batch và đường giải 31 lượt trên bàn 8x5', () => {
  const width = 8, height = 5;
  let board = Array(width * height).fill(null);
  const batches = [
    ['fruit', ['Táo', 'Chuối', 'Nho', 'Dâu'], 6],
    ['animal', ['Mèo', 'Chó', 'Thỏ', 'Gấu'], 5],
    ['garden', ['Hoa', 'Lá', 'Nấm', 'Ong'], 4],
    ['weather', ['Nắng', 'Mây', 'Mưa', 'Tuyết'], 3],
    ['vehicles', ['Ô tô', 'Xe buýt', 'Máy bay', 'Thuyền'], 2],
    ['sea', ['Cá', 'Cá voi', 'Bạch tuộc', 'Cua'], 1],
    ['tools', ['Búa', 'Cờ lê', 'Tua vít', 'Cưa'], 0],
  ];
  batches.forEach(([group, names, singletonCol], targetCol) => {
    for (let row = 0; row < 3; row++) board[row * width + targetCol] = { name: names[row], group };
    board[4 * width + singletonCol] = { name: names[3], group };
  });
  let moves = 0;
  for (const [group, , singletonCol] of batches) {
    let row = 4, col = singletonCol;
    let result = slideDirectional(board, width, height, row * width + col, -width);
    assert.equal(result.error, undefined); board = result.board; row--; moves++;
    const targetCol = batches.findIndex(batch => batch[0] === group);
    const delta = targetCol < col ? -1 : 1;
    while (col !== targetCol) {
      result = slideDirectional(board, width, height, row * width + col, delta);
      assert.equal(result.error, undefined); board = result.board; col += delta; moves++;
    }
    const match = findLineMatch(board, width, height);
    assert.equal(match?.group, group);
    match.indices.forEach(index => { board[index] = null; });
  }
  assert.equal(moves, 31);
  assert.equal(board.filter(cell => cell?.group).length, 0);
});

test('cụm 4 món cùng nhóm liền kề bị xóa, cụm 3 món thì không', () => {
  const board = Array(W * H).fill(null);
  [0, 1, 2, 7].forEach(index => { board[index] = { group: 'animals' }; });
  [20, 21, 22].forEach(index => { board[index] = { group: 'fruit' }; });
  const result = clearMatches(board, W, H);
  assert.deepEqual(result.cleared.sort((a, b) => a - b), [0, 1, 2, 7]);
  assert.deepEqual(result.groups, ['animals']);
  assert.equal(result.board.filter(Boolean).length, 3);
});

test('match 3: cụm 3 món cùng nhóm bị xóa, cụm 2 món thì không', () => {
  const board = Array(W * H).fill(null);
  [0, 1, 6].forEach(index => { board[index] = { group: 'orange' }; });
  [20, 21].forEach(index => { board[index] = { group: 'gray' }; });
  const result = clearMatches(board, W, H, 3);
  assert.deepEqual(result.cleared.sort((a, b) => a - b), [0, 1, 6]);
  assert.equal(result.board.filter(Boolean).length, 2);
});

test('điểm tụ là ô vừa đặt trong cụm, ưu tiên ô ở giữa cụm', () => {
  // Cụm ngang 0-1-2, vừa đặt ô 1 và 2 -> ô 1 nằm giữa nên là điểm tụ.
  assert.equal(mergeTarget([0, 1, 2], [1, 2], W), 1);
  // Chỉ vừa đặt ô 2 ở đầu cụm -> vẫn tụ về ô 2.
  assert.equal(mergeTarget([0, 1, 2], [2], W), 2);
  const board = Array(W * H).fill(null);
  [0, 1, 2].forEach(index => { board[index] = { group: 'gray' }; });
  assert.deepEqual(clearMatches(board, W, H, 3).clusters.map(c => c.sort((a, b) => a - b)), [[0, 1, 2]]);
});

test('xoay thẻ chữ L bốn lần trở về hình ban đầu', () => {
  const original = [[0, 0], [1, 0], [1, 1]];
  let rotated = original;
  for (let turn = 0; turn < 4; turn++) rotated = rotateOffsets(rotated);
  assert.deepEqual(rotated, original);
});

test('không đặt thẻ đè lên object đã khóa hoặc vượt khỏi bàn', () => {
  const board = Array(16).fill(null);
  board[1] = { name: 'Chó', group: 'animal', locked: true };
  assert.equal(placementIndices(board, 4, 4, 0, [[0, 0], [0, 1]]), null);
  assert.equal(placementIndices(board, 4, 4, 3, [[0, 0], [0, 1]]), null);
});

test('đặt thẻ nhiều object sẽ khóa tất cả và cộng điểm liền kề', () => {
  const board = Array(16).fill(null);
  board[0] = { name: 'Mèo', group: 'animal', locked: true };
  const card = {
    offsets: [[0, 0], [1, 0], [1, 1]],
    items: [
      { name: 'Chó', group: 'animal' },
      { name: 'Mũ rơm', group: 'sky' },
      { name: 'Hành tinh nâu', group: 'sky' },
    ],
  };
  const result = placeCard(board, 4, 4, 1, card);
  assert.deepEqual(result.indices, [1, 5, 6]);
  assert.equal(result.score, 35);
  assert.ok(result.indices.every(index => result.board[index].locked));
});

test('bàn khởi đầu: có đủ cặp, không có cụm >= 3 gom được ngay', () => {
  for (let run = 0; run < 50; run++) {
    const board = generateStartBoard(6, 6, ['a', 'b', 'c', 'd', 'e', 'f'], { pairs: 3, singles: 4 });
    assert.equal(remainingCats(board), 10);
    assert.equal(clearMatches(board, 6, 6, 3).cleared.length, 0);
  }
});

test('thẻ có ích đặt đúng chỗ gợi ý thì gom được ngay', () => {
  for (let run = 0; run < 100; run++) {
    const board = generateStartBoard(6, 6, ['a', 'b', 'c', 'd', 'e', 'f']);
    const help = findHelpfulCard(board, 6, 6);
    assert.ok(help, 'bàn khởi đầu luôn có thẻ có ích');
    const card = { offsets: help.card.offsets, items: help.card.groups.map(group => ({ group })) };
    const placed = placeCard(board, 6, 6, help.anchor, card);
    assert.ok(!placed.error, placed.error);
    assert.ok(clearMatches(placed.board, 6, 6, 3).cleared.length >= 3);
  }
});

test('tỉ lệ thẻ có ích tăng khi bàn vơi, 100% khi còn <= 4 mèo', () => {
  assert.ok(helpChance(10, 10) < helpChance(6, 10));
  assert.equal(helpChance(4, 10), 1);
  assert.equal(helpChance(0, 10), 1);
});
test('AI ưu tiên thẻ gom đôi: một thẻ dọn được 2 cặp khác loại', () => {
  // Hàng 0: a a . . b b  -> domino [a, b] đặt ở ô 2-3 dọn cả hai cặp.
  const board = Array(36).fill(null);
  [0, 1].forEach(i => { board[i] = { group: 'a' }; });
  [4, 5].forEach(i => { board[i] = { group: 'b' }; });
  const help = findHelpfulCard(board, 6, 6);
  assert.deepEqual(help.card.groups, ['a', 'b']);
  assert.equal(help.anchor, 2);
  assert.equal(help.cleared, 6);
});

test('bàn cần bao nhiêu lượt: mỗi cụm một lượt', () => {
  const board = Array(36).fill(null);
  [0, 1].forEach(i => { board[i] = { group: 'a' }; });
  board[20] = { group: 'b' };
  assert.deepEqual(boardNeeds(board, 6, 6), { turns: 2, cats: 3 });
});

test('sắp hết lượt so với việc còn lại thì chỉ ra thẻ có ích', () => {
  assert.equal(helpChance(10, 10, 5, 5), 1);
  assert.ok(helpChance(10, 10, 20, 5) < 1);
  assert.ok(helpChance(10, 10, 8, 6) > helpChance(10, 10, 20, 6));
});
test('khả năng gom: cụm có mèo chờ sẵn trong thẻ đang bóc thì cao, cụm chưa có hàng thì thấp', () => {
  const board = Array(36).fill(null);
  [0, 1].forEach(i => { board[i] = { group: 'a' }; });   // cặp a
  [24, 25].forEach(i => { board[i] = { group: 'b' }; }); // cặp b
  const { odds } = clearOdds(board, 6, 6, [{ groups: ['a'], weight: .85 }]);
  assert.equal(odds[0], .85);
  assert.ok(odds[24] < .2);
  assert.ok(expectedLeftover(board, odds) > 1.5 && expectedLeftover(board, odds) < 2.2);
});

test('AI không ra thẻ trùng cho cụm đã có hàng, mà cứu cụm còn lại', () => {
  const board = Array(36).fill(null);
  [0, 1].forEach(i => { board[i] = { group: 'a' }; });
  [24, 25].forEach(i => { board[i] = { group: 'b' }; });
  const { odds } = clearOdds(board, 6, 6, [{ groups: ['a'], weight: .85 }]);
  for (let run = 0; run < 30; run++) {
    const help = findHelpfulCard(board, 6, 6, Math.random, odds);
    assert.ok(help.card.groups.includes('b'), `nhắm nhầm: ${help.card.groups}`);
  }
});