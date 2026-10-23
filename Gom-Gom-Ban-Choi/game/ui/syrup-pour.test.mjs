import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.Image = class { decode() { return Promise.resolve(); } };
const { petRevealFrames, playSyrupPour, revealLine } = await import('./syrup-pour.mjs');

test('pet rises out of the syrup with the liquid surface, fully shown before cap closure', () => {
  const line = Array.from({ length: 121 }, (_, i) => revealLine(i, { top: 100, height: 64 }, { top: 80, height: 100 }));
  assert.equal(line[0], 0);
  assert.equal(line[24], 0);
  assert(line[42] > 0 && line[42] < 1);
  assert.equal(line[83], 1);
  line.forEach((v, i) => { if (i) assert(v >= line[i - 1]); });
  // mid-pour the line sits on the liquid surface (frame 50: surface 88 px in the frame → 36 px into the cell), no board gap above it
  assert.equal(80 + line[50] * 100, 100 + (88 - 16) / 128 * 64);
});

test('head above the cell stays hidden until the surface sinks; frames are evenodd polygons', () => {
  const frames = petRevealFrames({ left: 10, top: 100, width: 64, height: 64 }, { left: 4, top: 80, width: 76, height: 100 });
  assert.equal(frames.length, 121);
  // frame 0: line at the pet top and the cell box not re-shown yet (collapsed at the cell bottom, 84% down the pet)
  assert.match(frames[0].clipPath, /^polygon\(evenodd, .*0% 0\.00%, 100% 0\.00%.*7\.89% 84\.00%/);
  assert.match(frames[120].clipPath, /0% 100\.00%, 100% 100\.00%/);
});

test('pour shares one clock with pets, preserves terrain and releases all holds', async () => {
  const animations = [];
  let removed = 0;
  const animate = (frames, timing) => {
    const a = { frames, timing, finished: Promise.resolve(), cancel() {} };
    animations.push(a); return a;
  };
  globalThis.document = {
    timeline: { currentTime: 1234 }, body: { append() {} },
    createElement: () => ({ style: {}, setAttribute() {}, animate, remove() { removed++; } }),
  };
  const terrain = { background: 'unchanged' };
  const cell = {
    isConnected: true, dataset: { syrupPour: 'pending' },
    getBoundingClientRect: () => ({ left: 10, top: 100, width: 64, height: 60 }),
    querySelectorAll(selector) {
      assert.equal(selector, ':scope > .cat, :scope > .fat-cat');
      return [{ getBoundingClientRect: () => ({ left: 4, top: 80, width: 76, height: 75 }), clientWidth: 58, style: {}, animate }];
    },
  };
  await playSyrupPour(cell, { remove() { removed++; } });
  assert.equal(removed, 2);
  assert.equal(cell.dataset.syrupPour, undefined);
  assert.equal(terrain.background, 'unchanged');
  assert.equal(animations.length, 3);
  animations.forEach(a => { assert.equal(a.startTime, 1234); assert.equal(a.timing.duration, 2000); });
  assert.equal(animations[2].frames.length, 121);
});
