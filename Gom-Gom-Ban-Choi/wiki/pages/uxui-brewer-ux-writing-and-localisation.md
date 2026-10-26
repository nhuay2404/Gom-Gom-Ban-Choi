---
type: book-topic
source: uxui-brewer
fit_g1: medium-high
tags: [book, uxui-brewer]
---
# UX writing, strings and localisation

Source: [[uxui-brewer-src]], Ch. 2 (UX writer p. 7), Ch. 5 (pp. 65-68), Ch. 7 (text pp. 99-100, internationalisation pp. 116).

## UX writing rules (pp. 65-68)
- Copy guides players through mechanics, objectives, feedback, tutorials, item descriptions, prompts and popups; simple language but authentic and encouraging.
- Brevity (system text plain; flavour allowed if message is first); do not blame the player (help correct the error); voice matches game tone; no double negatives; be helpful and specific ("Preview Item", not "More info"); do not be generic but do not theme every option; digits not number words; active voice; put the point first; careful prepositions; simplified punctuation (no full stops in titles, buttons, labels, single lines).
- Small studios lack UX writers; designers' copy becomes personal and wordy. "The copy is for the player, not for the writer" (p. 7).

## Strings and layout (pp. 99-100, 116)
- Text is stored as string IDs per language; translations can double or triple length; names and subtitles vary too.
- Overflow strategies: scale-to-fit container, text scaling, truncation with ellipsis (rare), scrolling/looping text (blunt), scroll boxes.
- Localisation tips: maximum character limits per field, context notes per string, 40% buffer in layouts, avoid concatenating variables that translate badly ([Legendary] [Sword]), request a language-preview debug tool, ensure font glyph coverage (Unicode font fallback), keep fonts licensed and logged.
- Typography claim: text below 18 pt can be unreadable depending on the font (p. 116; console TV context, not phone points).

## Reusable takeaways
- Button labels: verbs + object ("Place Furniture", "Claim Coins"); error and insufficient-currency messages must tell the player what to do next without blame (relevant to shop and continue prompts).
- Keep numbers as digits with currency icons; plan 40% growth for Vietnamese/other localisations in buttons and offer banners.

## Stance and applicability
- (a) Console/PC game text conventions; the 18 pt rule and many examples assume TV distance.
- (b) Practitioner style guide; reasonable but uncited.
- (c) Consistent with [[prodtoolbox-chandler-audio-and-localization]] (localisation scheduling); sources on offer copy ([[liveops-vasiuk-storefront-psychology]], [[concept-offers-and-merchandising]]) add the commercial layer (call to action, urgency); Brewer's "do not blame the player" is compatible with [[src-zagal-dark-patterns-in-game-design]] (no confirm-shaming).
- (d) Fit: medium-high. Cheap, directly usable rules for a casual game's microcopy and for localisation-safe layouts; the project already ships Vietnamese UI, so string-expansion rules matter.
