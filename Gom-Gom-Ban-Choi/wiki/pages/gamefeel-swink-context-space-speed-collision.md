---
type: book-topic
source: gamefeel-swink
fit_g1: low-medium
tags: [book, gamefeel-swink]
---
# Context: spatial layout, impression of speed and size, spacing and collision feel

Source: [[gamefeel-swink-src]], Ch. 5 (pp. 92-94), Ch. 8 (pp. 139-149), Ch. 13 (pp. 220-222), Ch. 15 (pp. 268-271), Ch. 19 (pp. 334-339).

## Claims
- **Context is the second set of tuning knobs.** Avatar speed and turn numbers mean nothing until objects are spaced and sized against them; "to tune, you must have some context to tune against." Mario with no wall has no wall-kick; a Jeep tuned on flat terrain bottomed out on later hills (pp. 92, 145, 335).
- Three levels: **high** (impression of open vs claustrophobic space; open world invites looking outward, tight space induces introspection; WoW vs Counter-Strike), **medium** (spacing, number, size, nature of objects; the primary dimension for challenge: highway hypnosis in WoW vs knuckle-white Vanishing Point), **low** (collision: "waterslide" frictionless sliding vs sticky; jelly, glass, mush) (pp. 139-148).
- **Speed has no absolute meaning**: a car at "100 mph" with camera locked to it is not fast until there is a road texture; fence posts, trees, wider field of view and sound add the impression of speed (p. 142, demo CH08-1). Perspective changes everything (helicopter vs street view); racing games widen the FOV to exaggerate speed (pp. 143-144).
- **Impression of size** arises from the speed of motion against a frame of reference: colossi look huge because they move slowly relative to the avatar and the camera and shake add weight; bosses that animate fast read as shrunk creatures (pp. 144-145). Zangief seems slow only next to Chun-Li (p. 145).
- Spacing rules from Mario: platforms ~4 tiles high (just under the 5-tile max jump) feel best; horizontal platforms stretched; pits 2-6 wide; enemies move at Mario's walk speed (pp. 221-222). Mario 64: height, distance, platform size and slope angle follow fixed guidelines matched to each jump; slope angle serves as a soft, physical boundary ("victimless blame shift" rather than an invisible wall) (pp. 269-271).
- **"Gameplay garden"**: build mechanic and test space together, many objects at varied spacing, tuned against each other; best-feeling games grew this way (pp. 269, 335).
- Context defines difficulty: sparse and slow early, tighter and faster later (p. 336). Slim Tetris: the playfield width is a feel decision (p. 93).
- Polish and waterslide trade-off: collisions should not snag unless intended; Raptor Safari made them sticky because ramming raptors is the point (pp. 148, 291).

## Stance and applicability
- (a) Navigable physical space with an avatar moving through it, mostly platformers, racers, open-world 3D; spacing relative to continuous motion.
- (b) Soft metrics only; examples from the author's play; no measurement.
- (c) Related to [[concept-coordinates-pivots-distance]] (distances, pivots) and to the project's deco layout rules (obstacle radius, clearances in CLAUDE.md): the "second half of tuning" statement matches those rules, where cat motion needs 1 m door clearance and gaps either >= 0.8 m or <= 0.1 m. Complements [[mobiledesign-scolastici-graphics-and-character-readability]] for scale and readability.
- (d) Fit for a mobile casual match-3 + deco game: **low-medium**. The board is abstract grid space, so avatar-vs-obstacle spacing does not apply; it is useful for the 3D deco scene (cat speed vs room size, path clearances, camera distance and perceived size) and for sizing board cells against thumb and animation travel time.
