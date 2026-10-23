# Balancing, tuning and difficulty

Source: [[mobiledesign-scolastici-src]], Ch. 10 (pp. 229-235), Ch. 11 (pp. 275, 283).

## Balancing (pp. 230-232)
- Games as dynamic systems with an equilibrium; balance affects longevity.
- Techniques: symmetry (equal resources, with first-move advantage as the exception), randomisation (fair only in the long run; offset frustration with short sessions or player-shaped distributions, e.g., deck building), feedback loops (negative: Mario Kart rubber-banding, RTS upkeep), a "game director" AI that adjusts spawns to performance (Left 4 Dead), and statistics from sessions. Players find dominant strategies, so playtest.

## Tuning (pp. 232-235)
- Tuning aims at fun from start to end across skill levels; well-tuned means a balance of punishment and reward. Quotes Meier "interesting choices" and Koster "fun is learning".
- Strategies: generalisation (consistent global rules, not per-entity patches); keep code separate from data so designers change values during playtests; change one value at a time; try extreme values first (double or halve); record changes (version control).
- Difficulty settings: casual mobile audience wants a forgiving game; list of difficulty parameters (enemy counts and speed, health, power-up frequency, time limits, hints, death consequences); add a master global difficulty multiplier to tune session length (too short -> raise; too long for mobile -> lower).
- Level pacing caveat: playtest with different skill groups; a friend-breaking test (Faceball 2000 anecdote) is the "perfect balance" signal.

## Reusable takeaways
- Data/code separation and "one variable at a time, extremes first" apply to the project's economy.mjs/tuning.mjs remote constants; global multipliers match the project's remote config approach.
- Dynamic difficulty is named as an advanced technique (the project has an adaptive-difficulty module).

## Stance and applicability
- (a) Assumes action/arcade-style balance of enemies and player stats in a premium game; no economy, no F2P pinch points. Dated as of 2026: no live-ops/remote config, no cohort-based difficulty, no discussion of monetized difficulty. The balancing notions are timeless general design.
- (b) Conceptual; examples from known games; no numbers.
- (c) Differs from [[src-czerkawski-game-economy-design]] / [[concept-pacing-and-content-control]] and [[concept-spreadsheet-modeling]]: those tune economies via simulation and sources/sinks, this book tunes combat/difficulty by hand playtests. Also [[src-gd-fresher-f2p-monetization-training]] ties difficulty spikes to monetization; this book does not, and its "forgiving casual" stance qualifies using spikes as pinch points ([[concept-monetization-strategies]]).
- (d) Fit: medium. The tuning discipline fits level difficulty and board shapes (the project's adaptive difficulty), but no guidance on win-rate targets.
