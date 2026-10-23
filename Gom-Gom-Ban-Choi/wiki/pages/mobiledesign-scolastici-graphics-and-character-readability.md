---
type: book-topic
source: mobiledesign-scolastici
fit_g1: medium
tags: [book, mobiledesign-scolastici]
---
# Graphics, character readability and resolution

Source: [[mobiledesign-scolastici-src]], Ch. 3 (pp. 65-91), Ch. 11 (p. 277).

## Claims
- Graphics are the second selling factor after gameplay, especially for impulse downloads without a demo; Wing Commander vs Balance of Power debate (content vs context) is settled by "do both with planning" (pp. 65-67).
- Most mobile blockbusters are 2D: simple mechanics suit occasional players, run on low-end devices, and mass reach beats showing off tech (p. 68). Fixed backgrounds suit puzzle games (p. 77).
- Resolution variability is the first art problem: pick 2-3 reference devices and make separate assets per main resolution; shrinking icons does not work (pp. 75, 277). iOS: one retina UI then scale down; Android: design for a high-end reference and scale.
- Vector scales but is heavier at runtime; under about 48x48 px, hand-draw separate bitmaps per size (Ch. 7 pp. 156-159).
- Memory tricks: palette reduction, power-of-two textures, textures above 512-1024 rarely needed, baked shadows only on static objects, tilesets, bump/normal maps (pp. 76-85). Battery matters: heavier graphics shorten play time (p. 67).
- Character design: adjectives -> references -> basic shapes -> silhouette first; fill black to test recognisability at small size; too many details are noise (pp. 87-88).
- Colour: unique palette for the player character; do not reuse its hue for enemies; background strongly contrasting with game objects; confusion can be a cheap gameplay device (e.g., enemies hiding in the background) (p. 89).
- Facial expression via big eyes recommended for the cute target (Lilypads, Ch. 12 p. 306).

## Reusable takeaways
- Silhouette-in-black test for every cat and board tile; contrast of key objects vs background; separate hue families per role.
- Budget textures and effects for low-end batteries.

## Stance and applicability
- (a) Assumes a 2013 native 2D/3D mobile game, small screens (3.5-4.8 in), bitmap vs vector debate, UDK/Max/Maya pipeline. Dated as of 2026: texture-size advice, GIF/BMP/TIFF/CGM tutorials, Flash, 320x480 era; phones are now 6+ in OLED with high-density screens and sprite atlases/compressed textures.
- (b) Craft heuristics, widely agreed and low-risk; no measurements.
- (c) Consistent with the project's own rules in CLAUDE.md (toon, 2D sprite tufts for foliage, strong cat readability, expression table) rather than conflicting; adds nothing on economy sources. The "2D beats 3D for casual" claim is qualified by this project's 3D deco rooms, which are a retention/meta feature, not core-play readability (see [[concept-core-loop-and-metagame]]).
- (d) Fit: medium. Silhouette and colour-role guidance transfers directly to match-3 tiles and cats; the technical asset advice is obsolete.
