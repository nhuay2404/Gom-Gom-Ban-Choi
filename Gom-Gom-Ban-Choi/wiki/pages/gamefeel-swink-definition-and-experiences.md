---
type: book-topic
source: gamefeel-swink
fit_g1: medium
tags: [book, gamefeel-swink]
---
# Definition of game feel, the three building blocks and the five experiences

Source: [[gamefeel-swink-src]], Intro and Ch. 1 (pp. 1-33), Ch. 4 (pp. 69-80).

## The definition
- **Game feel = real-time control of virtual objects in a simulated space, with interactions emphasised by polish** (Ch. 1 p. 6). Three building blocks:
  - *Real-time control*: an uninterrupted closed loop (intent, input, game update, perceived output, new intent); more like steering a car than having a conversation (pp. 2-4).
  - *Simulated space*: collision and response between a controlled avatar and objects, plus level design (spacing relative to avatar speed); it must be perceived **actively** (the player moves through it). Grids, tiles and hex space are abstract, not literal simulated space (pp. 4-5).
  - *Polish*: any effect that enhances interaction without changing the simulation (dust, crash sound, camera shake, squash and stretch). For the player simulation and polish are indistinguishable; De Blob's squash shader turned a "stone ball" into a "paint ball" with no physics change (pp. 5-6).
- Seven combinations on a Venn diagram (p. 7-9): true game feel (all three: Sonic, Half-Life, Mario 64); raw feel (control + space, no polish); polished control with no space; passive physics (Peggle, Armadillo Run: simulation plus polish but no control); naked control; naked simulation (Bridge Builder); **naked polish (Civilization 4, Bejeweled)**. Definition is classification, not value judgement; Starcraft has superb polish and balance but is "not true game feel" (p. 9).
- Swink concedes the borderline: is a click-driven game like Diablo real time? Answer deferred to a threshold test (see [[gamefeel-swink-perception-and-real-time-control]]).

## Mechanics as "game feel atoms" (Ch. 4)
A mechanic is one complete loop of interaction (one press, one drag, one strum), i.e. a verb. Test each mechanic for: motion above ~10 fps, response within ~100 ms, a continuous feedback loop (input accepted any time). Findings:
- Street Fighter II walking has real-time control; its attack buttons play a locked animation (up to ~750-1000 ms) so they are not correction cycles, but the player chose the moment, so control still "feels" intact (risk-reward, not disruption) (pp. 71-72).
- Prince of Persia: smooth animation hides stilted control; stand-to-run takes ~900 ms with input locked; only the crouch-hop (~150 ms) is truly real time. Feel can be cobbled together by the player "imagining control" (pp. 72-75).
- Guitar Hero strum: instantaneous response but no continuity and no simulated space, so no true feel; the whammy bar is continuous but has no space (pp. 75-78).
- Kirby Canvas Curse: drawing is a correction loop on the player's own hand (stylus = pencil), tapping is one-shot; Kirby is steered indirectly, so outside the definition (pp. 78-80).
- Lock-out versus cut-off: Prince of Persia locks the player out; Guitar Hero ends the loop. Neither sustains control.

## Five experiences that blend into "feel"
1. Aesthetic sensation of control (smooth, floaty, stiff): intrinsic pleasure of steering something; a mapping creates a *possibility space* of motions, each with an aesthetic character (pp. 10, 14-15).
2. Pleasure of learning, practising, mastering a skill; skill is "the price of admission" to the feel (pp. 10-11, 21). See [[gamefeel-swink-skill-challenge-and-flow]].
3. Extension of the senses: screen = vision, speakers = hearing, rumble = touch; the avatar is a tool for perception and action; camera behaviour is the designer's definition of the player's eyes (pp. 11, 24-26). See [[gamefeel-swink-camera]].
4. Extension of identity ("proxied embodiment", Blow): "I hit a pole" not "my car hit a pole"; identity flows out and back (cursing the avatar mitigates frustration). It cannot be designed directly; it grows from sensitive control and is broken by frustration, boredom, ambiguity. Tetris (low control sensitivity) transfers less than Asteroids or Quake (pp. 11-12, 28-29).
5. Unique physical reality: players infer weight, material and gravity from motion, sound and effects, building a mental model of a self-consistent "faked Newtonian physics" (pp. 12-13, 29-32). Motion trumps visuals and sound when cues disagree (bowling-ball and ping-pong-ball thought experiment, pp. 30-32). Doom 3's tinny sounds and random prop physics "shattered" its realistic look; Gears of War's dust, shake and armour clatter made a "human wrecking ball" (pp. 32).
- "Virtual proprioception": thumbs still feel button/stick resistance, so control is an amplified, not a lost, body sense; a "megaphone for your thumbs" (pp. 26-28).

## Stance and applicability
- (a) Assumes real-time, avatar-centred, mostly 2D/early-3D action games on pad/keyboard/mouse (2009). It explicitly excludes turn-based and grid/tile-abstract games from "true feel" and gives them only "naked polish" (p. 9). Touch is mentioned only as a direct-input type.
- (b) Conceptual definition built from designer analysis and one psychology model (Model Human Processor); no player data of its own.
- (c) Qualifies, not contradicts, the project's game-feel/juice skill: the skill lists techniques (shake, hit-stop, squash); Swink explains why they work (polish = perceived physics) and warns that without a controllable simulated space they feel hollow ("dissonance", p. 8). Complements [[mobiledesign-scolastici-four-keys-to-fun]] (feel as sensory pleasure) and [[cozydive-bycer-ui-ux-and-approachability]] (UX as the sum of feel plus GUI).
- (d) Fit for a mobile casual match-3 + deco game: **medium**. The match board is exactly his "naked polish" class, so the definition says feel there is all polish plus timing; but card drag, deco placement and 3D cat reactions are direct-manipulation moments where the continuous-control parts (response curve, active perception) do apply. Use the five experiences as a checklist for what a tap or drag should feel like, not the real-time-control gate.
