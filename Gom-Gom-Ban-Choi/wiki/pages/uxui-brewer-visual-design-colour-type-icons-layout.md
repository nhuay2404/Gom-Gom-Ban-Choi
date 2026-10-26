---
type: book-topic
source: uxui-brewer
fit_g1: medium-high
tags: [book, uxui-brewer]
---
# Visual design: form vs function, colour, typography, icons, layout

Source: [[uxui-brewer-src]], Ch. 6 (pp. 77-80, 95), Ch. 7 (pp. 108-119), Ch. 4 (aesthetic-usability p. 39, skeuomorphism pp. 39-40).

## Form and function
- "Make it pretty" is dismissive; UI blends emotion, interaction, brand and art (p. 77). Aesthetic-usability effect means good looks buy tolerance for flaws, so form is part of function (pp. 39, 78). Worry: layouts become identical rectangles; "is UI art dying?" Rule of Cool: sometimes sacrifice some UX for memorability, but involve the UX designer (p. 95).
- Visual principles (pp. 79-80): consistency, hierarchy, contrast, white space, typography, colour, simplicity, balance (symmetric/asymmetric).

## Colour (pp. 108-112)
- Wheel, hue/saturation/value, shade/tint/tone, temperature; schemes: complementary, monochrome, analogous (calm, low strain), split-complementary, triad.
- Colour psychology is cultural and not absolute ("red means bad" is reductive); define a colour language with names by role (alert, legendary) and use it consistently; colour will not rescue bad UX.
- Limit palette to 2-4 colours plus tints/tones/shades; textures alter perceived colour; test contrast (WCAG checkers); never colour alone (see [[uxui-brewer-accessibility]]).
- Contrast: primary action gets the most contrast; use size, shape, texture, position too; overuse creates clutter (p. 112).

## Typography (pp. 113-116)
- Serif/sans/decorative/script roles; decorative and script for headers/logos only; define body (workhorse), heading and accent fonts; two to three weights (e.g. regular + semibold); do not use brand wordmark fonts; track font licences; uppercase "shouty" for urgent states; sentence case for body; font usage guide.

## Icons (pp. 116-117)
- Icons save space and cross languages but risk ambiguity and cultural issues; design at multiple sizes (hand-tune small versions), match stroke weight to type, pixel grid, simplest form, use familiar tropes (gear = settings), test with people out of context ("what does this mean?"); new symbols need introduction.

## Layout (pp. 117-119)
- Alignment (visual and functional), rhythm and variety, lines of force (reading path; west reads left-to-right), anchoring (corners/centre; test viewport changes), padding ("use more than you need").

## Reusable takeaways
- A single named colour language (currency, positive, danger, rare tier), a 3-weight type scale and an icon test ("5 players, no context") for the Figma-derived UI kit.
- Padding and anchoring advice supports the project's existing `--edge-x`/anchor grid approach.

## Stance and applicability
- (a) Games UI artist handbook for console/PC with a TV-distance bias (18 pt claim); colour/type basics are generic design.
- (b) Textbook design principles plus practitioner taste; no testing data.
- (c) Consistent with [[mobiledesign-scolastici-graphics-and-character-readability]] and [[mobiledesign-scolastici-ui-design-and-diegesis]] (icons first impression). Pro-aesthetics stance supports the project's rich bitmap UI and [[cozydive-bycer-ui-ux-and-approachability]]; the 2-4 colour palette and "limit fonts" rules sit in tension with candy-coloured casual UI that uses many hues for gem/cat types (colour is gameplay information there, so the limit applies to chrome only).
- (d) Fit: medium-high. Practical, easy-to-apply UI craft rules; some numbers are not mobile-calibrated.
