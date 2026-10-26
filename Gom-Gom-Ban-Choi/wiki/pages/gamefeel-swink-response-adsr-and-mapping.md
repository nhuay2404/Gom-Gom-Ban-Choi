---
type: book-topic
source: gamefeel-swink
fit_g1: high
tags: [book, gamefeel-swink]
---
# Response: mapping, ADSR envelopes and input/response sensitivity

Source: [[gamefeel-swink-src]], Ch. 7 (pp. 119-138), Ch. 17 instantaneous response (pp. 300-301), Ch. 12 (pp. 190-195).

## Mapping (what an input can do)
Input can: set position or orientation each frame; add force/torque to a simulation; modify a global simulation variable (gravity, tyre friction; Mario Kart's powerslide lowers friction); play an animation from start to end (a fighting-game move); change the playback speed of a looping animation; spawn an entity (bullet, sonic boom). Mapping is hooking signals to parameters and defining modulation over time (p. 120).
Avatar-motion descriptors: linear vs rotation; dimensions; absolute vs relative frame (ship-relative, camera-relative); position vs rate (stick displacement sets turn rate in Halo); direct vs indirect; integrated vs separate dimensions (pp. 120-121).

## ADSR envelope of a parameter vs input
- Attack (ramp to max), decay (usually accidental overshoot, fatigues the hands, became a speed exploit in an early Counter-Strike beta), sustain (the level = max speed), release (ramp down after input stops) (pp. 121-127).
- **Long attack = floaty/loose; short attack = tight/responsive; short and linear = twitchy; fully linear and very short = stiff.** All are one continuum of slightly different envelopes (p. 126).
- Even tight controls use a **curved** attack (keeps organic feel while preserving perceived instant response). A long attack is fine only if there is an obvious first response within ~70-100 ms; otherwise it reads as unresponsive (pp. 124-126, 301).
- Attack and release are often mirrored (Mario: same time to speed up as to stop); no release (Donkey Kong) feels abrupt (p. 126).
- Where envelopes come from: setting position directly gives near-zero attack and release (Donkey Kong, Metroid, mouse cursor); adding acceleration to a stored velocity plus drag gives a smooth attack and release (the cube demo: acceleration, drag, max speed) (pp. 127-129); filtering the raw input over time also adds a slight attack (Asteroids rotation, about a third of a second, without which rotation feels "stiff and robotic") (pp. 129-130).
- Halo's Warthog steering: stick sets a heading target and the vehicle seeks it faster the farther away it is, so the biggest response happens right after the input, i.e. instantly felt even with a long tail (p. 300-301), analogous to slow-in/slow-out (ease-out).

## Input and response sensitivity (the 2x2)
- Low in / low response (4 buttons, binary speed): stiff, grid-like; OK for contemplative games (Zelda, Pac-Man).
- Low in / high response (NES Mario): organic, loose, very expressive.
- High in / low response (mouse moves a cube 1:1): quick, natural, but "bit boring", no mass.
- High in / high response: needs mastery, richest (pp. 135-137).
- A precise stick mapped to a canned animation (Twilight Princess) wastes sensitivity; the more sensitive the input, the smoother the game should react (pp. 135-137, 323).

## Mario run vs walk, relationships
Run seems fast only by contrast with walk; keep the ratio and the feel survives rescaling (p. 209). Formulas: the *relationships* between parameters create feel more than absolute values (p. 134). See [[gamefeel-swink-simulation-states-and-filtering]].

## Stance and applicability
- (a) Real-time continuous input driving motion of an avatar; envelope measures speed vs time after a held button or stick. Timings (quarter-second attack, 3-second thrust) are for arcade steering.
- (b) Analytical, observed from demos built by the author; numbers come from his own reproductions, not from original source code.
- (c) Concretises what [[concept-sinusoidal-motion]] says about eased oscillation (ease-in/out vs linear) and what [[mobiledesign-scolastici-balancing-and-tuning]] lacks (response curves, not just difficulty numbers). The project's juice skill (easing, squash, hit-stop) is the same idea applied to feedback motion rather than avatar speed.
- (d) Fit for a mobile casual match-3 + deco game: **high** as a vocabulary: every animated reaction (tile swap, card snap-back, cat jump, furniture placement pop) is an envelope with attack/sustain/release; "curved attack, first visible reaction within 100 ms, long soft release" is a direct recipe, and the 2x2 explains why a 1:1 drag feels dead and a spring-smoothed drag feels alive. Avatar-speed specifics do not apply.
