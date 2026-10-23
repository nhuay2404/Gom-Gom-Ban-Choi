---
type: book-topic
source: mobiledesign-scolastici
fit_g1: low-medium
tags: [book, mobiledesign-scolastici]
---
# Audio for mobile games

Source: [[mobiledesign-scolastici-src]], Ch. 2 (pp. 60-64), Ch. 4 (pp. 93-106), Ch. 11 (p. 278).

## Claims
- Taxonomy: dynamic (adaptive: reacts to game state, e.g., music speeds as time runs out; interactive: reacts directly to player, e.g., Tetris thump) vs non-dynamic; diegetic vs non-diegetic (pp. 96-97).
- Mobile listening: usually one mono speaker, noisy places, often muted in public; cannot rely on headphones; test in several environments with and without headphones (pp. 102-103).
- Therefore: treat audio as a secondary feature, make it optional, never make gameplay depend on it (p. 278). Counter-balance: poor audio still hurts perceived quality, so plan audio from the start rather than last (p. 101, p. 105).
- Frequently heard sounds must stay pleasant after hundreds of repeats: tune volume, pitch, modulation over time (p. 103).
- Technical: compress (MP3 about 1 MB/min), MP3 adds padding samples that break seamless loops, 20 MB 3G download limit (p. 104). Designer-audio communication: send an early asset list and references (p. 105).
- Audio-only games (Papa Sangre, Audio Invaders) open accessibility for low-vision players (Ch. 6 p. 143).

## Reusable takeaways
- Sound as a mutable layer: every feedback must also be visible/haptic.
- Repetition tuning: randomise pitch/variant for frequent sounds (match pops, coin ticks).

## Stance and applicability
- (a) Assumes public, commuting, sound-off play on 2013 phones (single mono speaker). Dated as of 2026: stereo speakers, earbuds and haptics are normal; MP3 loop padding is solved by OGG/AAC loop points or WebAudio; codecs and Pro Tools-era tool lists are irrelevant.
- (b) Opinion/heuristic with no audience data (no sound-on rates).
- (c) Conflicts mildly with project practice (no wiki source covers audio): the project ships SFX and ambient moods (day/dusk/night) and a "juice" skill (game-feel), which treat audio-visual feedback as a core feel layer; this book's "audio is secondary" underweights that. No economy source covers audio.
- (d) Fit: low to medium. Keep "design for muted play" and "frequent sounds must not annoy"; ignore the rest. See [[mobiledesign-scolastici-design-process-and-mobile-constraints]].
