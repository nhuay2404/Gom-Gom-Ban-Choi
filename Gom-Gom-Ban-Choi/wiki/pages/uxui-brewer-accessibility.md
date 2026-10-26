---
type: book-topic
source: uxui-brewer
fit_g1: high
tags: [book, uxui-brewer]
---
# Accessibility and inclusive design

Source: [[uxui-brewer-src]], Ch. 4 (p. 30, 44, 54-55), Ch. 5 (pp. 60-62, 70), Ch. 6 (UI channels p. 85), Ch. 7 (colour pp. 110-112, audio p. 123), Ch. 10 (Watterton, Dube, Savarimuthu).

## Claims
- Car analogy: everyone adjusts seat and mirrors; the challenge should be the drive, not reaching the pedals (p. 60). Needs are permanent, temporary or situational (baby on lap, broken wrist); everyone ages into some (p. 60).
- Economics: author cites nearly 3 billion gamers by 2029 and 20-45% of players with some disability (p. 61; secondary stat, not verified). Advertise accessibility features before release.
- Definitions (p. 61): difficulty is relative; capability vs barrier; intentional barriers are the game's challenge, unintentional ones are bugs; disability = mismatch between capability and barrier; accessibility = the mechanism that removes the mismatch. It is "not making the game easier".
- Three ways to handle a barrier: give tools to get through (remap, screen reader, aim assist, colour support, text sizing, subtitles, audio cues), give an alternative path (different mechanics, modes), or let the player skip it (GTA V skip after 3 fails; skip QTE; mid-game difficulty change; auto-simplify). Skipping suits non-core content (pp. 61-62).
- Language: avoid "disabled" as an option label; name difficulty creatively without shaming (Jedi: Fallen Order in-universe names; Last of Us II per-category sliders, p. 62).
- Plan early; tacking features on at the end leads to compromises and cuts (p. 62). "It's an opportunity for innovation": the best fix may remove the barrier.
- Colour (pp. 110-112): ~1 in 12 men and 1 in 200 women have CVD; never rely on colour alone; add shape/icon/text; provide palettes or per-element colour pickers; do not ship full-screen colour-blind filters; keep contrast high (WCAG, p. 112); consider dyslexia and low vision from the outset.
- Sensory (pp. 44, 85): offer multiple channels (visual + audio + haptic), but allow vibration to be reduced or off (RSI, arthritis); allow volume per category and visual alternatives to audio cues (p. 123).
- Onboarding ties in: ask early about audio assistance/text-to-speech; subtitles on by default; settings reachable before the first cutscene (p. 70).
- Low physical effort: avoid button holds and repeated taps; tolerance for error with undo (pp. 54-55). Useful field of view shrinks with age and in children (p. 84).

## Reusable takeaways
- Match-3 specifics: do not distinguish the six cat types by colour only (shape/pattern/pose), add a colour-blind-safe cat set, reduce-motion toggle, haptic toggle, text-size setting, sound off with visual substitutes.
- Offer popups: avoid tiny close buttons and timers that demand fast reaction (Fitts, low physical effort).
- Difficulty/assist language for Easy/skip-level options should not shame.

## Stance and applicability
- (a) AAA console/PC accessibility community view (AbleGamers, Rebellion/Insomniac accessibility staff); examples are action games, but the principles are platform-neutral.
- (b) Practitioner advocacy plus standards (WCAG); few primary numbers.
- (c) Aligns with [[cozydive-bycer-ui-ux-and-approachability]] (approachability for casual players) and [[cozydive-bycer-low-stakes-design]]; nothing in the wiki contradicts it. Tension is only with offer UX that uses small targets, countdown pressure or auto-playing animation ([[concept-offers-and-merchandising]]); [[src-zagal-dark-patterns-in-game-design]] (timed pressure, confusing close buttons) supports Brewer's direction.
- (d) Fit: high. Cheap, concrete, platform-neutral rules (not colour alone, haptic/audio toggles, text size, undo) apply directly to a casual match-3 + 3D deco game and widen the audience; the casual/older demographic benefits most.
