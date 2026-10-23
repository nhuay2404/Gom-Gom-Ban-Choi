# Prototyping: types, audience, feedback

Source: [[prodtoolbox-chandler-src]], Ch6 (pp. 95-102); Ch4.5.1-4.5.2; Ch9.4.3.

## Why (Ch6.2)
Cheap compared with full production (2-3 people, hard deadline); settles opinion fights between developers by building both options and showing a neutral group; early external feedback (Minecraft, Stardew Valley); fastest way to communicate a game; a prototype becomes a demo; useful at any phase, even close to ship (two people, a few days); can test pipelines (localization) or art techniques, not only mechanics; anyone can do one, including paper. Prototype effort also calibrates the budget and schedule (Ch6.6).

## Types by goal (Ch6.3)
- **Exploratory** (throw-away): answer a question fast; building the game on it is "a house on sand"; convincing people to discard it is hard.
- **Experimental**: validate a system already in place (e.g. tuning stat numbers, testing a localization flow).
- **Iterative**: meant to evolve into the shipped game; strong architecture, higher cost.
- **Vertical slice**: polished section with final art/audio/UX; used for pitches; track how long it took to improve estimates.
- Analog (paper, dice, spreadsheets for random-stat balance) vs digital (expose configurable values such as field size or timer). Need not run on the target platform. Do not build the real game on an architecturally unsound prototype.

## Sidebar (Brian Sowers)
Do not ignore visuals: a bird behavior system felt boring in grey boxes and "came alive" when art dropped in; look at sound, art and mechanics holistically. Most prototypes take under a week; throw them away when you lose interest; one giant-monster prototype was scrapped in a week.

## Audience (Ch6.4)
Fellow developers: rough is fine, state the question (cylinders instead of animated characters unless context given). Executives/publishers: polished, vertical-slice level, otherwise they critique unfinished parts and feel free to request changes. Players (early access): still playable and fun, clear notes on state and desired feedback.

## Feedback loop (Ch6.5)
Decide what to learn and ask neutrally (do not "sell"). Three questions: *What do you like and why? What do you wish this had and why? What if it could do X and why?* Collect in a spreadsheet, later Trello/JIRA; synthesize; close the loop with reviewers explaining what was not used; evaluate against stated goals, remove ego. RITES with UX before formal tests; UX data offsets opinion. Tools: Stanford d.School Design Thinking Bootleg, IDEO Design Kit.

## Stance and applicability
(a) Small prototype pod inside a bigger funded studio or indie preparing a pitch; digital prototypes in an engine; feedback from colleagues and publishers rather than from live cohorts.
(b) Practitioner experience plus design-thinking toolkits; no measurements of prototype ROI.
(c) Qualifies other approaches: agrees with lean "build-measure-learn" but stops before quantitative testing - for F2P the equivalent next step is soft launch cohorts and A/B tests ([[concept-ab-testing-monetization]], [[concept-analytics-and-kpis]]); numerical tuning of a prototype maps to spreadsheet simulation ([[concept-spreadsheet-modeling]]). Disagrees with pure "prototype in greybox" orthodoxy by insisting on some visual/audio layer (Sowers) - relevant to feel and juice of match-3 and to the current art-heavy prototype.
(d) Fit: high. Cheap prototypes, explicit prototype goals, "what do you like / wish / what if" questions, closing the loop with testers, and telling reviewers what the build is for are directly usable for a mobile match-3/deco game and cost nothing. Designer-only: high - prototyping and feedback synthesis are core designer tasks; the throw-away vs iterative distinction affects what engineers must build.
