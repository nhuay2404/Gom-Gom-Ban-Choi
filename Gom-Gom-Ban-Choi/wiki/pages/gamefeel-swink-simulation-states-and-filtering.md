---
type: book-topic
source: gamefeel-swink
fit_g1: medium
tags: [book, gamefeel-swink]
---
# Simulation, state changes, input filtering, gestures and parameter relationships

Source: [[gamefeel-swink-src]], Ch. 7 (pp. 127-135), Ch. 13 (pp. 205-220), Ch. 17 (pp. 298-300), Ch. 19 response (pp. 328-334).

## Simulation choices (how the envelope is produced)
- **Top-down** simulation: store only what the feel needs (Mario: position, velocity, acceleration; Metroid: jump as predetermined positions, crisper). **Bottom-up**: a generic physics engine (Mario 64 onward, Raptor Safari, physics games) gives emergent behaviour and exploits, with many case-specific overrides on top (pp. 131, 328-333).
- Perception beats physical accuracy: Mario's jump sets upward velocity high at press, then **if the button is released early, clamps velocity to a small fixed value** so every jump ends on the same arc; **gravity is multiplied (~3x) at the apex/while falling** so the jump feels weighty and the player is out of control for less time; falling speed is capped at terminal velocity; vertical velocity is zeroed on ground/ceiling contact every frame to avoid stored force (pp. 210-219). "Even things that seem hacky ... may feel better than a more pedantic approach" (p. 228).
- Ground vs air state: horizontal acceleration is much lower in the air; running changes acceleration and max speed (B button), producing a huge number of speeds with two buttons (pp. 209-210, 130).

## State changes
States re-map the same input to a different response (ground/air, duck, slide, grind, manual). Cheap expressivity, but fine only if the player **perceives** the state; Tony Hawk's six states with 12 buttons overwhelm novices because inputs seem random (pp. 130-131, 299). Visual metaphor (a human avatar visibly airborne) tells the player the state changed (p. 226).

## Filtering and transposition of input
- Raw input is almost always modified: multiplication (control-display ratio), non-linear curves (GTA stick steering ratio increases with displacement, reducing twitchiness), time smoothing (pp. 131-132).
- **Gestures** = input patterns over time (Konami code, Hadouken, Wii swings): time-window pattern matching; **chording** = combinations at one time; **context sensitivity** = position in the world changes meaning (Resident Evil context button) (pp. 132-134).
- Danger: complex input that maps to a trivial canned response feels like "a massive firecracker with a whimper" (p. 331).
- Ambiguities: inputs resolved at millisecond scale that the player cannot control (Mario 64 A+R1 simultaneous: ground pound, backflip or jump at random) must be resolved so the same intent gives the same result; Mick West's rule is to map for the player's imprecision, not the computer's (pp. 268, 298-299).

## Relationships between parameters
Feel lives in ratios: gravity vs jump force (Sonic), friction vs steering (carving vs ice), run/walk speeds, ground/air acceleration, ship thrust vs rotation. In Asteroids the key relationship is **thrust vector added to a separate ship velocity** (instead of overwriting it), which decouples rotation from motion, giving the floaty feel; overwriting gives a "squirrely remote-controlled car" (pp. 134, 193-196). Cross-mechanic "crossover sensation": flying, swimming, running should all seem to obey the same physics (Mario 64) (pp. 264-265).

## Future claims (Ch. 19)
More processing power will go to input parsing and to more bottom-up simulation (fluids, flocks, muscles/active ragdoll); realism returns diminish; "reality isn't much fun", aim for self-consistent and stable (pp. 328-334).

## Stance and applicability
- (a) Avatar physics and real-time controllers on pad/keyboard; "simulation" means velocity/gravity/friction integrators.
- (b) Reverse-engineered by the author in clones; some Mario numbers (3x gravity, clamp) are well attested by speedrunning communities, others are his tunings.
- (c) Connects to [[concept-vectors-basics]] and [[concept-projection-and-reflection]] (additive vectors, velocity decomposition) in the math sources; as a tuning approach it parallels [[mobiledesign-scolastici-balancing-and-tuning]]. Qualifies "realistic physics" instincts: the juice skill's easing and squash are the same "perceptual shortcut" idea.
- (d) Fit for a mobile casual match-3 + deco game: **medium**. Reusable: cheat for perception (clamp, asymmetric gravity), relationships over absolutes, state clarity, resolving input ambiguity (tap vs drag threshold, swap direction detection, multi-touch), and spring/velocity integrators for drag, snap-back and cat motion. Not needed: jump arcs, vehicle friction, gesture recognition for 3D motion.
