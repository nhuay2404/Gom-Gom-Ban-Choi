import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { LEVELS_PER_BACKGROUND, PLAY_BACKGROUNDS, playBackgroundForLevel } from './play-backgrounds.mjs';

test('backgrounds: giữ nguyên nền trong từng nhóm 10 màn, lặp lại sau 80 màn', () => {
  assert.equal(PLAY_BACKGROUNDS.length, 8);
  assert.equal(LEVELS_PER_BACKGROUND, 10);
  const expected = ['spring-garden', 'sunset-meadow', 'autumn-garden', 'daisy-morning', 'lavender-day', 'sunflower-day', 'hydrangea-day', 'orchard-day'];
  for (let cycle = 0; cycle < 3; cycle++) {
    expected.forEach((id, group) => {
      for (let offset = 0; offset < 10; offset++) {
        assert.equal(playBackgroundForLevel(cycle * 80 + group * 10 + offset).id, id);
      }
    });
  }
  assert.equal(playBackgroundForLevel(9).id, 'spring-garden');
  assert.equal(playBackgroundForLevel(10).id, 'sunset-meadow');
  assert.equal(playBackgroundForLevel(79).id, 'orchard-day');
  assert.equal(playBackgroundForLevel(80).id, 'spring-garden');
});

test('backgrounds: chơi lại hay mở màn trực tiếp luôn nhận cùng nền', () => {
  for (const index of [0, 10, 79, 80, 149]) {
    const first = playBackgroundForLevel(index);
    playBackgroundForLevel(index + 30);
    assert.equal(playBackgroundForLevel(index), first);
  }
});

test('backgrounds: mọi ảnh trong queue tồn tại và không có nền đêm', async () => {
  assert.equal(new Set(PLAY_BACKGROUNDS.map(b => b.id)).size, 8);
  assert.ok(PLAY_BACKGROUNDS.every(b => !/moonlit|night/.test(b.id)));
  await Promise.all(PLAY_BACKGROUNDS.map(b => access(new URL(`../${b.src}`, import.meta.url))));
});
