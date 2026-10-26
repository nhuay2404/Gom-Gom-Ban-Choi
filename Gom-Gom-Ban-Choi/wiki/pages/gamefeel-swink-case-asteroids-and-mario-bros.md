---
type: book-topic
source: gamefeel-swink
fit_g1: low-medium
tags: [book, gamefeel-swink]
---
# Case studies: Asteroids and Super Mario Bros. (recipes)

Source: [[gamefeel-swink-src]], Ch. 12 (pp. 187-199), Ch. 13 (pp. 201-228). The long parameter walk-throughs are summarised for transferable logic only.

## Asteroids (1979)
- Input: five two-state buttons. Rotation overwrites orientation each frame with a slight (~0.25-0.33 s) attack from filtering the input; thrust adds a **thrust vector (from heading) to a separate velocity** with a long attack (about 3 s to full), low damping (~4 s to rest), a max velocity cap and screen wrap (pp. 189-196).
- Key relationship: decouple rotation from thrust; if thrust overwrites velocity the ship feels like a remote-control car; if rotation had inertia too it would not feel crisp. "Crisp rotation + loose thrust" gives both precision and flow (pp. 191-196).
- Context: large slow rocks, small fast fragments, saucers that shoot; the ship is faster than the field yet feels out of control, like skating among novices (p. 196). Polish: pitch scales inversely with object size (visual-audio coherence), particle spray, flashing flame line. Rules: instant death on touch, extra life per 10,000 points, small saucer worth 1,000 vs 200 gives risk-reward (pp. 197-198).
- Spacewar!'s inertia and the later rebalancing of rules and spatial context explain why Asteroids outsold Space Invaders (stiff slow position-setting) (p. 188).

## Super Mario Bros. (1985)
- Lineage: Donkey Kong (binary speed, fixed jump arc) to Mario Bros (3 speed states, slight slide) to SMB (acceleration, deceleration, inertia) (pp. 201-202). Miyamoto: simplification not simulation; designs hardware and metaphor together (p. 202).
- Horizontal recipe values: acceleration (L/R), max speed, deceleration (separate from acceleration), run acceleration and run max (B button), air acceleration; **keep ratios, not absolutes** (pp. 209-210).
- Vertical recipe: gravity always on, jump = impulse at press, variable height 1.5-5 tiles by hold time within min/max, **early-release clamps velocity to a low fixed value**, fall gravity ~3x, terminal velocity cap, zero Y velocity on collision, small jump boost when above walk speed (pp. 210-216).
- Collision: tile grid, snap out of solid tiles, no friction, "bar of soap on wet tile"; levels use 4-tile platforms, "fortune favours the bold" running speed, enemy speed equal to walk speed (pp. 216-222).
- States: idle, walk, run, jump, stuck, dead (p. 220). Camera moves only right; a slow zone in the left quarter eases the scroll (p. 219).
- Polish: run cycle exactly synced to speed (no foot slip), slide pose emerges only when pressing opposite to motion, brick jiggle (small Mario) vs smash (big Mario) conveys mass, rising slide-whistle jump sound follows the arc, rubber-band bump sound; very few particles (pp. 223-225).
- Metaphor surreal and iconic, so unrealistic motion is accepted; rules: power-ups change threat zones; lives are rarest; coins small constant reward (pp. 225-228).

## Stance and applicability
- (a) 1979-1985 arcade/NES single-avatar real-time games; digital buttons; sprite-based 2D.
- (b) Reverse-engineering through the author's playable replicas; precise numbers are tuned reproductions.
- (c) Mostly orthogonal to the other wiki sources; the math of acceleration/drag relates to [[concept-vectors-basics]] and decoupling to [[concept-projection-and-reflection]] (velocity decomposition).
- (d) Fit for a mobile casual match-3 + deco game: **low-medium**. Transferable bits: "perception over physics" hacks, matching animation speed to motion speed, polish telling mass via contrast (small vs big Mario), pitch-size coherence for sound, and risk-reward value scaling. The recipe parameters themselves (jump, run) do not apply.
