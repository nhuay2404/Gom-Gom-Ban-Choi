---
type: book-topic
source: gamefeel-swink
fit_g1: medium-high
tags: [book, gamefeel-swink]
---
# The six-element metrics framework (hard vs soft metrics)

Source: [[gamefeel-swink-src]], Ch. 5 (pp. 81-100), Ch. 6-11 summaries.

## Why measure
- Feel tuning is usually pure intuition and every project "re-invents the wheel" (Derek Daniels on Mario's jump); copying Mario's numbers into another system does not work. Goal: a vocabulary (floaty, tight, loose, twitchy, stiff, smooth) tied to measurable properties so that feel can be compared across games and built by insight rather than emulation (pp. 81-82, 100).

## Hard vs soft metrics
- **Hard**: quantifiable and comparable across playtests (button pressed 57 ms after the edge, play time, score). Example: Mick West's debug overlay graphing every button and physics flag per frame with event markers (jump, land, late jump) and pause/scrub/zoom, so "controls feel wrong" becomes visible (pp. 83-84).
- **Soft**: fun, laughter, requests to replay; Lazzaro's Four Fun Keys as an attempt to quantify. Equal in value to hard metrics; honed designer intuition is "attunement to soft metrics" (p. 84).
- Playtests are the only valid temperature check; close to natural environment is harsher but more honest; "drink from the fire hose" works because big issues are obvious; iteration count matters more than method (pp. 82-83).

## The six pieces the designer can change (computer side of the model)
| Element | What it measures | Kind | Wiki page |
|---|---|---|---|
| Input | Physical device: number of inputs, discrete vs continuous, sensitivity, boundaries, tactile quality | mostly hard | [[gamefeel-swink-input-metrics-and-touch]] |
| Response | Mapping of signals to parameters; ADSR envelope; simulation; states; filtering; relationships | hard (envelope) + soft (sensitivity) | [[gamefeel-swink-response-adsr-and-mapping]], [[gamefeel-swink-simulation-states-and-filtering]] |
| Context | Space, speed, size, object spacing, collision feel | soft | [[gamefeel-swink-context-space-speed-collision]] |
| Polish | Effects that sell mass/material without changing simulation | soft | [[gamefeel-swink-polish-and-impact-cues]] |
| Metaphor | Representation and treatment set expectations | soft | [[gamefeel-swink-metaphor-and-treatment]] |
| Rules | Arbitrary relationships give objects meaning (value, toughness) | soft | [[gamefeel-swink-rules-and-meaning]] |

- Chapters 12-16 apply the six to five games; ch. 12's exercise: the demos ship "naked" with every parameter at zero so students can tune toward a target feel (p. 187).
- Method note: the underlying simulation is irrelevant for measuring feel; the output (envelope, sensation) is what the player gets (p. 138).

## Stance and applicability
- (a) Designed for avatar-control games and comparison across them; metrics for context and polish are explicitly subjective.
- (b) Taxonomy and craft knowledge; only the input/response measures are quantitative, and none of it was validated with players.
- (c) Complements [[prodtoolbox-chandler-qa-testing]] and [[cozydive-bycer-playtesting-and-churn]] (playtests) with a per-feel checklist; differs from [[concept-analytics-and-kpis]], which measures behaviour after launch, not sensation. The frame-by-frame input/response overlay is the one measurable method worth copying.
- (d) Fit for a mobile casual match-3 + deco game: **medium-high**. The six-element checklist (device, response curve, context, polish, metaphor, rules) is a reusable review template for any tap/drag feedback; the hard-metric overlay idea can be applied to tap-to-feedback timing in a web build. Context and device columns need touch re-interpretation.
