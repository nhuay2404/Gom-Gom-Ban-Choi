---
type: book-topic
source: uxui-brewer
fit_g1: medium-high
tags: [book, uxui-brewer]
---
# Usability testing, surveys and fixing UX issues

Source: [[uxui-brewer-src]], Ch. 5 (pp. 71-75), Ch. 4 (survey bias p. 39, affect heuristic p. 43).

## Claims
- Usability test: real users trial the game or an isolated part; choose testers near the target personas (not a violent game on children); labs or internal teams recruit (p. 71).
- GIGO: the build under test need not be final quality but must contain the essential ingredients of the intent; "satisfying exploding barrels" need smoke, fire and sound (pp. 71-72).
- Testers are not a focus group designing your game; test clarity of what you put out against intent (p. 72).
- Survey frame (pp. 72-74): frustration (most frustrating/confusing/challenging), favourite (what and why), wanted (what could you not do), magic wand (what to zap/add), doing (what were you doing, what did you think you were meant to do), describe (how would you pitch it to friends). Confirm players understood goals, not that they finished.
- Contextualise feedback; one player struggling does not mean tear the feature out, maybe something else blocked understanding; do not only celebrate positives (survivorship/confirmation bias) (p. 74).
- Fixing issues (pp. 74-75): find root cause ("fall in love with the problem"); analyse player data; workshop solutions; check genre peers; collaborate; ship minor manageable fixes not one drastic change (fewer variables); retest under the same conditions; keep monitoring engagement and retention post-launch.
- "Don't iterate without testing"; "don't silo UX decisions" (p. 71). Fail fast and get to "right", not perfect (p. 172); counter to sunk cost.

## Reusable takeaways
- A 6-question post-session script (frustration, favourite, wanted, magic wand, doing, describe) fits 5-person guerrilla tests of new zones, shops and popups.
- When a mechanic is misunderstood, check attention and layout before adding UI (see [[uxui-brewer-ui-representation-and-attention]]).

## Stance and applicability
- (a) Studio-run or lab playtests for premium games; assumes access to testers and a UX researcher.
- (b) Practitioner method; no statistics, sample sizes or telemetry-based UX beyond "monitor retention".
- (c) Overlaps [[prodtoolbox-chandler-qa-testing]] and [[prodtoolbox-chandler-ux-process]]; casual/cozy testing and churn in [[cozydive-bycer-playtesting-and-churn]]; quantitative validation of UX/offer changes belongs to [[concept-ab-testing-monetization]] and [[concept-analytics-and-kpis]], which Brewer does not cover. His "small changes, retest" aligns with A/B discipline.
- (d) Fit: medium-high. Low-cost survey script and "one change at a time" suit a small designer-led team; must be paired with funnel analytics for F2P UX decisions.
