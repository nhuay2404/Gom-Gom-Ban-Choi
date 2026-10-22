# Spreadsheet modeling, docs and balancing

Source: [[src-czerkawski-game-economy-design]], ch. 3 (pp. 51–87).

## Feature design doc (pp. 51–62)
- No single standard; a repo of small per-feature docs + spreadsheets + mock-ups beats one "bible".
- Header: **goals of the feature**, **how it achieves them**, **analytics to track** (telemetry is specified up front, not afterthought).
- Body: overview, how it works, **worked example calculation** (removes ambiguity: 200 + 13×50 + 4×50×1.2 = 1090 XP), UI considerations, mock-ups, narrative context.
- Keep balancing *numbers* out of the doc (list the variables; numbers live in spreadsheets/tools). Too vague ("easy to get into, perception of mastery") and too detailed are both bad.
- Sample: daily/weekly missions (daily: 24 h UTC reset, pool, 3–5 picked, a "meta" mission for clearing all; weekly: set per week, sets accumulate, easy/medium/hard, premium missions for Battle Pass buyers).

## Spreadsheet simulations (pp. 62–76)
Functions you need: SUM, RAND, RANDBETWEEN, VLOOKUP/LOOKUP (approximate match).
- **Account-level model**: table level → XP required (Table 3.2, e.g. 100, 300, 600, 1000…); simulate N matches with `RANDBETWEEN` XP, running total, `LOOKUP` to get level, plus time per match → time-in-game. Re-roll to get playthroughs; model skilled and unskilled players, hundreds of matches. Early levels fast, later slower; speed up where players tend to churn. Enter level thresholds by hand rather than being slave to a formula. Baseline for balancing = **resources per unit time**.
- **Random drop / roll table**: frequency column → percentage chance → cumulative "chance value" column; drop = `VLOOKUP(RAND(), table, 2, TRUE)`. Re-usable for loot crates, gacha. Test it: relying on approximate-match default can give false results.

## Pipeline and balancing (pp. 76–79)
- Work with programmers: communicate goal, expose "hooks" (balancing values) in a backend/tool; tables can move via CSV import.
- Balancing = (1) simulation, (2) tester feedback and own play, (3) live telemetry ("players blow expectations out of the water at launch").

## Math toolkit (pp. 79–87)
- Algebra "change side, change sign"; brackets. Example: XP to reach level n = 50·n·(n+1) (scaled triangular numbers); solve for level from XP via the quadratic formula (ignore the negative root).
- **Coupon collector**: expected draws to collect all N equally likely items ≈ N·ln N + 0.5772·N + 0.5 (60 items → ~281 draws). Quick estimate for loot box / random-drop content cost; real drops are rarely equal, so treat as a lower-bound starting point.
