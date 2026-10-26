---
type: book-topic
source: gamefeel-swink
fit_g1: low-medium
tags: [book, gamefeel-swink]
---
# Case studies: Bionic Commando, Super Mario 64, Raptor Safari

Source: [[gamefeel-swink-src]], Ch. 14 (pp. 229-245), Ch. 15 (pp. 247-275), Ch. 16 (pp. 277-296).

## Bionic Commando (NES, 1988)
- No jump; a grappling claw fired diagonally attaches to almost any pixel flagged connectable and starts a **pre-baked pendulum swing**: 10 animation frames, arc size scaled by cable length, release only on the apex frame. Only gravity after release is simulated. Feel is "player perception in a few frames": the sense of pushing a pendulum is a **placebo** (input only matters at apex frames) (pp. 232-236).
- Ground movement is binary speed (stiff), deliberately contrasted with fluid swinging. Camera dead zones (a third of the screen horizontally, narrower vertically; larger while swinging) reduce nausea and make the grapple feel anchored (pp. 237-239).
- Context: wide, open levels and many connect points give improvisation; later levels remove connect points and feel worse (pp. 239-241). Sound trio (extend rising tone, "ka-chink" on connect, dull thud on fail) heard hundreds of times sells metal and stone (pp. 242-243). Rules: enemy hit counts and health boxes shape perceived toughness (pp. 243-245).

## Super Mario 64 (1996)
- Rate-based analog stick, **camera-relative** movement, direction blended each frame toward the stick (carving), sharp reversal triggers foot-plant and slide animation; animation synced to speed (no foot slip), lean into turns (pp. 248, 255-256).
- Friction and slope: standing = high friction, slope above ~45-75 degrees slows then triggers a slide state; slopes serve as **soft boundaries** (pp. 254-255, 270-271). Sides of the capsule are frictionless ("waterslide") so near-misses succeed (p. 255).
- Special jumps (long, triple, side/back somersault) have fixed trajectories for predictability; the basic jump keeps hold-time sensitivity and the apex-gravity trick; ground pound halts horizontal momentum for precision (pp. 258-262). Control ambiguity (A+R1 timing) is called out as a flaw (p. 268).
- Level spacing follows rules for jump heights, distances, platform sizes and slope angles; landmark towers give camera-friendly layouts; no goals smaller than ~5 Marios wide because 3D stomping is imprecise (pp. 249, 268-271).
- Polish: three impact tiers (light/medium/hard) across animation, VFX (dust, yellow stars) and SFX, material-dependent footsteps, rising voice pitch with jumps, gentle screen shake for heavy objects (pp. 271-273). Rules: coins heal, boss rule of threes (pp. 274-275). Designers asked "what if" questions and plugged each answer into the same simple physics ("crossover sensation") (pp. 264-265).

## Raptor Safari (2008, the author's Unity browser game)
- Six keys, physics-based Jeep: four raycast "tyres" with suspension force and damping, separate **desired (motor) vs actual velocity** per tyre with side friction much higher than forward friction (carving) and a slip threshold, center-of-gravity shifted when the chain is deployed for stability (pp. 281-289). Unity input smoothing (gravity/sensitivity/snap) supplies attack and release (pp. 281-282).
- Polish mainly sound: two layers (engine, dirt) pitch-modulated by turn angle and speed, three collision tiers with random variants, slow-motion zoom on stunts and raptor hits (pp. 291-293).
- Rules: reward every interaction, cross-linked combos, five-minute timer, achievements (pp. 294-296). Built bottom-up: tune the Jeep and ragdolls first, then world, then rewards; two months, six people (pp. 277, 295-296).

## Stance and applicability
- (a) 2D/3D platformers and a vehicle game; camera and collision issues are central. 3D camera chapters assume a player-driven avatar.
- (b) Reverse engineering and the author's own post-mortem; no measured player metrics (550,000 plays reported only as popularity).
- (c) Overlaps with [[prodtoolbox-chandler-prototyping]] on build-the-feel-first and with the project's 3D scene rules (camera distance, soft boundaries instead of invisible walls, animation synced to motion). [[gamefeel-swink-camera]] extracts the camera material.
- (d) Fit for a mobile casual match-3 + deco game: **low-medium**. Useful by analogy for the 3D deco view (dead zones and camera ease, sound tiers, slope-like soft boundaries, cat animation speed matched to movement) and for the "baked animation + perceived control" lesson; the action mechanics themselves are not applicable.
