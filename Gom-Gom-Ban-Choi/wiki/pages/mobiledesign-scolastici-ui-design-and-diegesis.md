---
type: book-topic
source: mobiledesign-scolastici
fit_g1: medium
tags: [book, mobiledesign-scolastici]
---
# UI design and the diegesis model

Source: [[mobiledesign-scolastici-src]], Ch. 3 (pp. 90-91), Ch. 7 (pp. 147-167), Ch. 12 (pp. 298-299, 311-317).

## Claims
- A well-designed UI is the one least noticed; a patchy UI sinks a game regardless of features (pp. 147-148, 159).
- Two-axis classification of UI components: part of the narrative? part of the game space? Gives diegetic (both yes), non-diegetic (both no, classic HUD), spatial (in-world cue not known to characters, e.g., selection brackets, path trail), meta (in-narrative but not in space, e.g., screen blood) (pp. 150-155). Choose per component: immersion-heavy games lean diegetic; clarity-heavy games lean spatial/non-diegetic.
- Process: list required functions (score, lives, currencies) -> map each to an interface method -> iterate; audio and FX are UI too (pp. 155-156).
- Practical rules: fewest buttons, one primary purpose per screen, split complex info into chunks, a BACK button on every screen, screen-flow chart before art, wireframes in grayscale built with designer + artist + programmer (pp. 161-162).
- Main screen: a large, distinctive PLAY button; icons instead of text where possible (helps localisation); expected extras: options, leaderboards, achievements, buy, support (p. 164).
- Test heuristic: if a new feature takes a player over 30 seconds or more than 3 questions to understand, redesign it (p. 149).
- Icon is the store's first impression; hand-draw small sizes (pp. 158-159).
- Evergreen: multiple save slots per mode/user, auto-save on interruption, rotate, calibration, challenge bars showing a friend's score beaten (pp. 165-166).

## Reusable takeaways
- Use the 2x2 diegesis table to decide which UI lives in the 3D room (diegetic/spatial, e.g., item cards in the room) vs overlay HUD.
- 30 s / 3 questions is a cheap onboarding test.

## Stance and applicability
- (a) Assumes console/PC-derived HUD theory applied to 2013 phones, premium/freemium with banner ads at the bottom of the screen (Lilypads layout reserves a bottom strip, pp. 315). Dated as of 2026: banner-reserved layout, Visio/Axure/Flairbuilder tooling, "social share on Facebook/Twitter" challenge bars, and screen sizes in the tables.
- (b) Theory borrowed (diegesis, Gibson affordances, Norman, Gestalt) plus authorial rules; one numeric heuristic is anecdotal.
- (c) Complements [[src-gd-fresher-f2p-monetization-training]] / [[concept-offers-and-merchandising]] (offer UI hierarchy) which treat store UI as a sales surface; this book treats UI as neutral navigation. No conflict, but it never discusses popups, offers or dark UI ([[concept-dark-game-design-patterns]]).
- (d) Fit: medium. The diegesis table and "fewest buttons, one purpose per screen" suit a hub-based UI (home/map/shop/deco/play); monetization UI needs the other sources.
