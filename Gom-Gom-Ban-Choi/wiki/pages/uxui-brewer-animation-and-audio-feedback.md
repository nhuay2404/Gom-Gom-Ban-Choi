---
type: book-topic
source: uxui-brewer
fit_g1: medium-high
tags: [book, uxui-brewer]
---
# Animation, feedback and audio in UI

Source: [[uxui-brewer-src]], Ch. 5 (feedback pp. 53, 65), Ch. 6 (UI channels p. 85), Ch. 7 (animation pp. 119-122, audio pp. 122-123), Ch. 4 (Weber-Fechner, delighters, sensory appeal pp. 42-44).

## Feedback
- Players need immediate, clear information about action and inaction; visual, audio and haptic combined; timely, relevant, unambiguous (p. 53). Micro-interactions (subtle colour change, sound, translation, vibration) stop controls feeling dead (p. 65). Value changes (combo meter rising) are a chance to make players feel something (p. 121).
- Delighters and peak-end moments (petting animals, easter eggs) raise memorability (pp. 44-45).

## Animation (pp. 119-122)
- Motion supports aesthetics and UX: pulses on notifications, transitions, bouncy buttons, ambient motion, reassuring spinners. Learn basic animation; define the purpose of each motion (what information it conveys).
- Real-time (player-driven, e.g. scrolling) vs non-real-time (triggered, transitional). Properties: position, opacity, scale, rotation, anchor, colour, stroke, shape.
- Principles named: easing (naturalism), offset/delay (hierarchy and reading order; last element is the action), parenting, transformation, value change, masking, overlay, cloning, obscuration (blur background for modal), parallax (important elements move fastest), dimensionality (card flip), dolly/zoom.

## Audio (pp. 122-123)
- Sound gives feedback, mood and space; distinct recognisable sounds per action/event; rising pitch or tempo implies conclusion; offer visual alternatives to important audio, volume per category and on/off for elements.

## Reusable takeaways
- Pair every tap with at least two feedback channels, but keep a reduce-motion and haptic switch.
- Sequence reward reveals with offset/delay so the claim button lands last; obscure background when a modal opens.
- Weber-Fechner: when emphasising a button scale, use a visible but proportional delta.

## Stance and applicability
- (a) AAA UI artist/UI-VFX practice (UI VFX artists, loot-box reveals mentioned in passing); no mobile performance or battery caveats beyond a performance note on texture budgets (p. 124-125).
- (b) Practitioner/design-school principles (borrowed from motion design); no measurement of effect on usability.
- (c) Complements [[mobiledesign-scolastici-audio-for-mobile]] and [[prodtoolbox-chandler-audio-and-localization]]; the project's own juice guidance (game-feel skill and CLAUDE.md toon/outline rules) is stricter on performance. Loot/reward reveal animation is shared with [[concept-reward-design-and-psychology]]; excess celebratory animation on offers is a [[src-zagal-dark-patterns-in-game-design]] concern.
- (d) Fit: medium-high. Principles are directly reusable for a juicy match-3 UI (tweened claims, ordered reveals, audio confirmation); it offers no tuning numbers.
