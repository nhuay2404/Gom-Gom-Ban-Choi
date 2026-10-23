---
type: book-topic
source: mobiledesign-scolastici
fit_g1: low
tags: [book, mobiledesign-scolastici]
---
# Engines, languages and tech choices (2013)

Source: [[mobiledesign-scolastici-src]], Ch. 5 (pp. 107-125), Ch. 8 (pp. 169-195), Ch. 2 (pp. 48-50).

## Claims
- Use an existing engine; building your own makes sense only if you sell engines (p. 170).
- Beginners: start with 2D (touchscreens suit it, less math, lower hardware needs) (p. 172). Engines reviewed: Torque 2D, Cocos2D (iOS only then), Corona SDK (Lua, poor Android, cloud compile), Shiva 3D, Unity 3D (USD 1,500 Pro plus per-platform licenses, about USD 3,000 to ship mobile), UDK (25 percent royalty above USD 50k), GameMaker and GameSalad (education/prototyping) (pp. 172-184).
- Distrust "no coding" slogans unless you can add code (p. 172).
- Languages: C++ the pro default; Java for Android; Objective-C for iOS (no garbage collection, manual memory); scripting (Lua, JavaScript, UnrealScript) for game logic.
- HTML5: cross-platform via PhoneGap, Canvas API, but different performance per browser, a long side-tool chain (WebGL, SVG, WebAudio, WebSockets), "generally slow", "still immature", though "the future" (pp. 118-122). Cut the Rope cited as an HTML5 game.
- Game program structure: initialization, loop (input, update, draw), termination; draw after logic; handle time/frame-rate; free resources on exit (pp. 122-124).

## Reusable takeaways
- Keep the update/draw order and frame-time handling disciplined (already the project's practice in `game/core` vs `game/play`).

## Stance and applicability
- (a) Assumes a first-time indie team choosing among 2013 engines and languages, mobile-native builds, Flash dying, HTML5 immature. Dated as of 2026: nearly all engine licensing/prices, Eclipse/ADT, Corona, Shiva, UDK, Torque, GameSalad, Windows Phone; HTML5/WebGL and WebView wrappers (Capacitor) are mature and viable for casual games; Unity changed model.
- (b) Opinion plus vendor facts, no benchmarks.
- (c) Directly contradicts the project's chosen architecture assumptions: memory note [Production = web + Capacitor] bets on web tech the book calls slow and risky; the 2026 reality favors the project for casual 2D/light 3D, but low-end Android WebView performance remains a real risk. No wiki economy source overlaps.
- (d) Fit: low. Only generic cautions (test on low-end devices, prefer proven tooling) survive; the owning team for setup/perf is another team per project memory.
