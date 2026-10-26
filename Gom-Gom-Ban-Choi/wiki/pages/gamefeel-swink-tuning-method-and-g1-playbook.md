---
type: book-topic
source: gamefeel-swink
fit_g1: high
tags: [book, gamefeel-swink]
---
# Tuning method and playbook for a casual match-3 + deco game (synthesis)

Source: [[gamefeel-swink-src]], mainly Ch. 5-9, 13, 17-18 (pp. 81-170, 201-228, 297-320). This page is a **wiki synthesis**: items marked (book) are claims by Swink; items marked (adapt) are the editor's translation to this project, not statements in the book.

## Tuning method (book)
1. Fix the three foundations first: input mapping, an object/space to tune against, the camera (p. 26). Build a "gameplay garden" of varied cases and tune against them (pp. 269, 335).
2. Expose parameters as live-editable fields and tune by hand; the author's Jumper and Tune exercises ("here is a mechanic, make it fun") and the "naked demo with all parameters zero" are the teaching method (pp. 187, 319-320).
3. Use a **frame-by-frame overlay** of inputs and events when something "feels off" (pp. 83-84).
4. Iterate by playtest; fix whatever bothers you until it feels right; creators of the classics "did not follow a methodology" (pp. 82, 187).
5. Tune relationships (ratios) and cheat perception (clamps, asymmetric gravity, placebo input) rather than model reality (pp. 134, 228, 235).

## Polish ladder (adapt, from Ch. 9 tiers)
Build feedback in layers, each testable by removing it (as in the book's toggle demos):
1. Instant visible response within ~100 ms (state change, highlight) (p. 301).
2. Motion envelope: ease-in/out with curved attack, squash and stretch, anticipation/follow-through (pp. 124-126, 155-157).
3. Sound variants, randomised, tiered by magnitude; pitch rising with positive events (pp. 159-160, 225, 271-272).
4. Particles with fast, readable motion; dust at contact (pp. 158-159, 272).
5. Camera/time effects for big moments: shake, zoom, ~20 ms hit pause or short slow-motion (p. 161).
6. Haptics tied to the same tier (p. 162).
7. Restraint: only the effects that support one physical impression; Peggle/Chuzzle-style everything-explodes is a warning (pp. 339-340).

## Mapping to this project's moments (adapt)
- Tile swap/match: small, medium, big tiers; mass cues via sound pitch and shake amount (Mario 64 three-tier model).
- Card drag: continuous input; use smoothed follow (attack) and snap-back with a soft release; keep the drag below the ~240 ms correction loop (pp. 36-42, 127-130).
- Cat reactions: expression chosen by cause (rules), animation synced to motion speed, same face/sound for the same cause (principles 1 and 7).
- Deco placing: pop-in with squash, ambient dust, place sound matched to material; camera must not move during placement.
- UI taps: <= 100 ms to a visible state; ensure control ambiguity cannot occur (double taps, tap vs drag) (pp. 268, 298-299).

## Book ideas worth noting for future (book)
Role shifting ("play as the castle/the weather"), 1,000 avatars at once with falloff of influence, tactile touch games, invisible avatars (feel from polish alone) (pp. 311-318, 341-342); the invisible-avatar idea supports the conclusion that a game made only of polish is possible, relevant to a board game with no avatar.

## Stance and applicability
- (a) Draws on real-time avatar games; this page re-targets to a turn-based touch game.
- (b) Book part = designer craft knowledge; adapt part = editor's synthesis, untested here.
- (c) Extends [[mobiledesign-scolastici-balancing-and-tuning]] (numbers) and [[mobiledesign-scolastici-prototyping-process]] / [[prodtoolbox-chandler-prototyping]] (prototype with some visual/audio layer); disagrees with [[mobiledesign-scolastici-audio-for-mobile]] on audio priority (keep audio layered and optional, but design it with the visuals); aligns with the repo's game-feel skill. See [[council-playbook-casual-deco]] for genre verdicts on economy, which this page does not touch.
- (d) Fit for a mobile casual match-3 + deco game: **high**, as a working checklist: response within 100 ms, envelopes, tiered feedback, consistent abstraction, restraint. Caveat: no mobile measurements; verify timings on the Capacitor build on real devices (another team's job to instrument).
