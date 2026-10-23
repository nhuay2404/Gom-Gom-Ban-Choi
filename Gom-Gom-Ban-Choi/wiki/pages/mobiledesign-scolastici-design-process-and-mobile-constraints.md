# Design process, dos and don'ts, and mobile constraints

Source: [[mobiledesign-scolastici-src]], Ch. 11 (pp. 271-281), Ch. 2 (pp. 49-50).

## General process (pp. 272-274)
Find an idea (step away when stuck) -> rough concept document (fun parts, how to win, obstacles, target players) -> storyboard/paper test -> playable demo of the most frequent action -> test with varied people -> fix or discard -> refine the design document -> production with continual "is this fun for the target audience?" even late -> accept "never complete, just done".

## Dos and don'ts (pp. 275-276)
- Dos: lose gracefully (player wins after challenge = designer wins); enough hints to solve puzzles; payoff proportional to challenge; use the game's unique features; one-outcome situations become cutscenes, no fake control.
- Don'ts: no missable essential content; no cheating; avoid mindless repetition and randomness for its own sake; never leave the player lost; no obscure solutions; do not require outside knowledge; players must understand expectations.

## Mobile-specific constraints (pp. 276-281)
- Hardware: small screens, show less of a big field and scroll; limited controls; mono audio; download size (50 MB OTA, 2 GB cap); weak CPUs; target broad audience at USD 0.99 price points.
- Play time: a satisfying experience in three minutes or less; place save points about 2.5 minutes apart so an interruption costs at most a couple of minutes.
- Depth: mobile games rarely exceed about 10 hours; 5 h = 120 sessions of 2.5 min, 50 h = 1,200 sessions, so ask whether the loop survives 1,200 sessions.
- Environment: sunlight, noise, shaking; avoid pixel precision.
- Smartphone: calls/updates interrupt; pause and auto-save are mandatory.
- Multiplayer: only asynchronous turn-based fits the window (Ruzzle, Hero Academy); servers cost money.
- Casual audience: polished, well-tested mechanics, clear goals, cute graphics, forgiving difficulty, friends' recommendations, immediate first impression, little willingness to learn complex systems (p. 283).

## Reusable takeaways
- The "1,200 save-points" check is a neat longevity sanity test for a level-based game of 100 levels.
- Auto-save and instant resume are non-negotiable.

## Stance and applicability
- (a) Assumes commute-time, low-commitment, mostly one-shot premium games; the three-minute rule and 10-hour depth reflect 2013 premium casual. Dated as of 2026: retention-driven F2P games use multi-session meta (decoration, collections, events) to carry hundreds of hours; async social, daily-return loops and push notifications change the "no depth" claim; OTA and hardware limits are obsolete.
- (b) Opinion plus a few market quotes (Flurry gender/genre splits, 61 percent of US payers male - dated).
- (c) Conflicts with [[concept-core-loop-and-metagame]] and [[concept-progression-systems]] (long journeys, metagame), and [[concept-pacing-and-content-control]] (energy/timers to pace play); Czerkawski, GD Fresher and Zagal ([[concept-dark-game-design-patterns]]) treat depth as engineered progression, this book as weakness. Its "avoid mindless repetition" echoes Zagal's grinding warning.
- (d) Fit: medium. Short-session design, auto-save and forgiving difficulty match match-3; the depth/longevity claim does not fit a deco metagame.
