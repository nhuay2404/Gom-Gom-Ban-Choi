export const LEVELS_PER_BACKGROUND = 10;

export const PLAY_BACKGROUNDS = Object.freeze([
  'spring-garden',
  'sunset-meadow',
  'autumn-garden',
  'daisy-morning',
  'lavender-day',
  'sunflower-day',
  'hydrangea-day',
  'orchard-day',
].map(id => Object.freeze({ id, src: `assets/img/play/background-variants/${id}.webp` })));

// Session levels are zero-based: 0..9 is the first background, 80 wraps to it.
export function playBackgroundForLevel(levelIndex = 0) {
  const index = Number.isFinite(levelIndex) ? Math.max(0, Math.floor(levelIndex)) : 0;
  return PLAY_BACKGROUNDS[Math.floor(index / LEVELS_PER_BACKGROUND) % PLAY_BACKGROUNDS.length];
}
