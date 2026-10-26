---
type: book-topic
source: uxui-brewer
fit_g1: high
tags: [book, uxui-brewer]
---
# UI systems, input and widget patterns

Source: [[uxui-brewer-src]], Ch. 7 (pp. 96-108).

## UI systems (pp. 96-98)
- A UI system = reusable components + patterns (input routing, navigation, menu manager, focus). Gives consistency, speed, scalability and a shared language. Focus system: always show which element is active. Input routing matters for multi-layered menus.
- Input: touch needs space for finger detection and consideration of hand size/strength; small buttons in hard-to-reach places and complex gestures ruin touch games; one-hand portrait vs two-hand landscape (p. 97). PC supports mouse and keyboard together, left-handed layouts. Gamepad navigation: D-pad, stick, free cursor (flexible but less accessible, p. 98). VR needs spatial/diegetic UI.

## Widgets (pp. 98-107)
- Pick patterns for function, not names (players do not care about naming). Pattern choice is by need, "best tool for the task, not the one we have" (p. 99).
- Text and images (icons cross language borders). Buttons: familiar, accessible (not one feedback channel), clear hierarchy; anatomy label + hit area; states: default, hover/focus, pressed, deactivated, selected (pp. 100-101). Progress bars (linear, radial, segmented; motivate waiting) (p. 101-102).
- Menus: accordion (saves space, unclear expandability), drop-down, radial (limited options), hamburger (hidden = discoverability/accessibility problem), grid (clear, limited counts; asymmetrical grid shows hierarchy), flyout, tab (fast, few options; reduces layers), cross menu, carousel (show count/position indicator), cards (common region; too many overwhelm; keep hierarchy and white space) (pp. 102-106).
- Loader/throbber (Doherty), modal (forces interruption; use infrequently; must be easy to close, p. 106), notifications (passive, timed, non-pausing; excess annoys, p. 106), sliders/steppers, separators/spacers, checkboxes and toggles (state must be unambiguous) (p. 107).

## Reusable takeaways
- G1 shop = cards in a grid with common region; keep card count per screen low and the hierarchy clear (Hick, p. 33).
- Modals: one purpose, obvious close; fewer interrupting popups (conflicts with some offer-popup practice, see below).
- Button state kit (default, pressed, disabled, selected) as a studio-wide spec; toggles with explicit on/off visuals for Settings.

## Stance and applicability
- (a) Console/PC game UI engineering vocabulary (menu manager, focus system, input routing); mobile touch gets a paragraph.
- (b) Practitioner glossary; no evidence on conversion or discoverability.
- (c) Aligns with [[mobiledesign-scolastici-touch-input-and-controls]] and [[mobiledesign-scolastici-ui-design-and-diegesis]]. Conflicts in emphasis with [[concept-offers-and-merchandising]] / [[src-gd-fresher-f2p-monetization-training]]: those treat popups as deliberate merchandising (trigger-based starter packs, limited offers) while Brewer says modals should be rare and notifications passive; resolve via [[council-topic-verdicts]] and [[src-zagal-dark-patterns-in-game-design]] (frequency caps, easy close). Hamburger/hidden navigation warning also argues for the project's visible tab bar.
- (d) Fit: high. Concrete, platform-agnostic widget guidance (card, tab, toggle, modal, button states) maps straight to a casual game's shop, Deco panel and Settings; commercial popup strategy has to come from the F2P sources.
