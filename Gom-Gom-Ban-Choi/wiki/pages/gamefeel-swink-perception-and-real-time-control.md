---
type: book-topic
source: gamefeel-swink
fit_g1: medium-high
tags: [book, gamefeel-swink]
---
# Human perception, latency thresholds and the model of interactivity

Source: [[gamefeel-swink-src]], Ch. 2 (pp. 35-60), Ch. 3 (pp. 61-68), Ch. 4 thresholds (p. 70).

## Time budget (the book's hard numbers)
- Model Human Processor (Card, Moran, Newell): perceptual 100 ms [50-200], cognitive 70 ms [30-100], motor 70 ms [25-170]; the three run concurrently. A full **correction cycle is about 240 ms** (perceive, think, act); this is the rate at which people steer, track and aim (pp. 36-42).
- Three computer-side thresholds for real-time control (pp. 43-47):
  1. **Impression of motion**: display above 10 fps (20 better, 30 "pleasingly smooth"); perceptual fusion happens inside one ~100 ms perceptual cycle. "No such thing as a frame rate too high" (p. 44).
  2. **Instantaneous response**: input-to-display under 240 ms to sustain control; about **50 ms feels instantaneous**, above 100 ms lag is noticeable but ignorable, ~200 ms feels sluggish; Mick West: 50-100 ms feels "tight" (pp. 44-45). Even at 60 fps a 3-frame lag (50 ms) is nearly unavoidable.
  3. **Continuity**: the game must accept input and respond at a consistent 100 ms or less; sporadic response (frame drops, display lag, overloaded CPU) breaks control and "feels awful" like stuttering vision (pp. 46-47).
- Causality: if effect lands in the same perceptual cycle as the action, the brain binds them ("my action caused this"), which also makes tools feel like body extensions (p. 44).
- Interruption can be forgiven if the player chose it and the metaphor justifies it (Zangief's ~750 ms heavy punch, p. 47). "The ultimate judge is the player": if it feels like real-time control, it is.
- West's practical measurement: film screen and controller with a 60 fps camera to count frames of response lag; graph button states and events per frame in a scrubbable overlay to find control problems (pp. 45, 83-84).

## Perception ideas that support the design stance
- *Perception requires action* (Held and Hein kittens; Bach-y-Rita tactile vision): players learn a world by probing it with the avatar (pp. 48-49).
- *Perception is skill*: moves go from "abstract movements" (effortful) to "concrete movements" (automatic); skill is the price of admission to feel (pp. 49-52).
- *Perceptual field* (Snygg and Combs): perception is filtered by prior experience, attitudes and misconceptions; a game world is a simplified micro-world of that field. **A consistent abstraction beats a detailed one**: players decode a simple world within minutes, so never violate the rules you set (Dig Dug good, Jurassic Park: Trespasser bad, pp. 49-51). Norman's mental model plus "natural mapping" (stove knobs, Geometry Wars stick) is useful but too rigid; paradigm-shift "aha" moments (Phantom Hourglass DS-lid stamp) are a legitimate pleasure (pp. 52-56).
- *Whole-body experience*: sight, sound, touch fuse; any cross-stimulus inconsistency (foot clipping, invisible walls) is glaring because real life never has it (p. 57).
- *Tools become extensions of the body* (blind man's cane); abilities change the "bodily space" (Metroid morph ball), so new verbs change how the same world feels (pp. 57-59).

## Model of interactivity (Ch. 3)
Seven steps: human processor, muscles, input device, computer, game world, output devices, senses, with intent from rules (pp. 61-68). The player side is fixed physiology; **the designer's palette is steps 4-6** (computer processing, game world model, output). Intent is designed too: goals like "100 coins gives a star" give arbitrary variables meaning (pp. 66-67). Fitts' law (movement time grows with distance, shrinks with target width) is cited for UI targets; an edge-of-screen menu bar is "infinitely" wide (p. 42-43).

## Stance and applicability
- (a) Assumes real-time continuous control (steering, aiming) on pad/mouse; "response" means avatar motion. Numbers are 2009 general-HCI figures; no touch-specific latency data.
- (b) Strong on the human timing figures (cited experimental literature, Card/Moran/Newell is a classic); weaker on the philosophical parts (perceptual field, proxied embodiment) which are essay-style.
- (c) Supplies the timing numbers other wiki sources lack: [[mobiledesign-scolastici-touch-input-and-controls]] gives no latency budget; [[mobiledesign-scolastici-balancing-and-tuning]] tunes values, not response time. Compatible with [[concept-sinusoidal-motion]] (eased motion). Qualified by touch: the touch screen adds its own sensing and display latency on top of the app's, which the book never measures.
- (d) Fit for a mobile casual match-3 + deco game: **medium-high**. The 50-100 ms "instant" window, the 240 ms limit for a drag-correction loop, the continuity rule (no dropped frames during a drag) and the consistent-abstraction rule apply directly to card drag, tile taps, deco placement and cat reactions. The correction-cycle theory itself matters mainly for drag/placement, less for discrete taps.
