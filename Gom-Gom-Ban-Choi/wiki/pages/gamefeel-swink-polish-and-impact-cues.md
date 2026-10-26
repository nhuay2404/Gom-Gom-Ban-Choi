---
type: book-topic
source: gamefeel-swink
fit_g1: high
tags: [book, gamefeel-swink]
---
# Polish: animation, visual effects, sound, cinematic and tactile cues

Source: [[gamefeel-swink-src]], Ch. 1 (pp. 5-6), Ch. 9 (pp. 151-170), Ch. 13 (pp. 223-225), Ch. 15 (pp. 271-273), Ch. 16 (pp. 291-293), Ch. 19 (pp. 339-340).

## Core argument
- Polish = effects layered on without changing the simulation; the player cannot tell them apart from simulation, and they carry the **inferred physical properties** (mass, material, friction, elasticity, "how heavy/hard/soft"). Never dismiss as "just polish" (pp. 151-155). With identical collision code, a different particle spray timing or sound changes perceived mass completely (p. 154).
- Measure polish in three layers: individual effects; groups that convey a perception; inferred physical properties. Catalog per interaction as a table of animation / visual / sound / cinematic / tactile (Gears of War vs Dawn of Sorrow, pp. 163-170). Use the table as a quick check of intent vs outcome and of conflicting cues (Painkiller bosses had huge sound but fast animation and few particles, so read small; Colossus had slow motion, dust plumes, booms, screen shake in agreement) (pp. 152, 144-145).
- **Animation**: principles of animation (squash and stretch, anticipation, overlapping action and follow-through, arcs, staging, slow-in slow-out) apply almost directly; realism is not the goal, "perception shortcuts" are (bouncing ball squash). Animation on a simulated body gives weight; animation speed must match movement speed, otherwise foot slip reveals the simulation (pp. 155-158, 223). Animation should emphasise what the simulation does, not "wag the dog" like Prince of Persia (p. 224).
- **Visual effects**: short-lived, caused by an object but not the object (sparks, dust, trails, star bursts). Texture matters less than the **motion** of particles; Nintendo's star bursts are unrealistic yet convey force (pp. 158-159). Dust at foot plant sells friction (p. 272).
- **Sound**: Foley-like but repeatable; **randomise among variants** to avoid fatigue; categories impact, grind, loop; sound can override vision (two balls pass through each other until a "ptoing" makes them bounce) and fixes weak animation (God of War attack felt light until sound was added); non-realistic sounds are fine (record scratch, orchestral hit); impacts can also tell the environment (reverb = big room) (pp. 159-161). Tiering: Mario 64 uses light/medium/hard impact tiers across animation, VFX and SFX, Raptor Safari three collision sound tiers plus pitch modulation by speed and tyre force; Asteroids maps object size to pitch (large = low) (pp. 197, 271-272, 291-292).
- **Cinematic**: screen shake, view-angle change, motion blur, slow-motion, **frame pause of about 20 ms on heavy hits** (fighting games, Zelda, Raptor Safari zoom + slow-motion on impacts); no real-world analogue but universally read as massive force. Mario 64 uses gentle shake only for heavy things (pp. 161-162, 273).
- **Tactile**: rumble matched to the metaphor (recoil, grinding), used judiciously (p. 162).
- Cohesion over quantity: Asteroids' simple but consistent size-to-pitch cues beat gaudy effects (p. 197). **Too much polish is distracting** (Chuzzle, Peggle, Mario Galaxy: every object "waiting to explode"); pull back so each effect supports one physical impression; Mario's dust puffs work because they are easy to read (pp. 339-340). Polish is also a time sink to enter late or too early (p. 163).
- Missing sounds undermine: Bionic Commando lacked a hit grunt and demolition sound (p. 243).

## Stance and applicability
- (a) Avatar and vehicle games where physical interaction is the content; polish sells collision. Assumes sound is on and one-to-one with action.
- (b) Designer analysis with detailed effect inventories; no player testing of which cue matters most.
- (c) Differs from [[mobiledesign-scolastici-audio-for-mobile]], which says treat audio as secondary and optional on phones; Swink treats sound as one of the strongest feel carriers. Resolve for mobile: design visual cue first, haptic and audio as additive layers that carry the same tier. Supports the repo's game-feel / juice skill and [[prodtoolbox-chandler-audio-and-localization]] on early audio planning; complements [[concept-reward-design-and-psychology]] (feedback as reward).
- (d) Fit for a mobile casual match-3 + deco game: **high**. For a board that is "naked polish" by his own classification, polish is the feel: tiered match feedback (small/medium/big combo), randomised sound variants, ~20 ms hit pause for large clears, squash/stretch on tiles and cat reactions, cohesion between animation speed and sound, and restraint when effects stack. Realistic-physics motivation is irrelevant; the "perception shortcut" idea is the point.
