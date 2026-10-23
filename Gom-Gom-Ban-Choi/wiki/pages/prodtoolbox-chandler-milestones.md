# Milestones: prototype to post-release

Source: [[prodtoolbox-chandler-src]], Ch4.5 (pp. 66-71, Fig. 4.4); Ch7.3; Ch3.3.1 sidebar; Ch14.

## The ladder (Ch4.5)
| Milestone | Meaning | Timing |
|---|---|---|
| Prototype / First Playable | core mechanics playable, placeholder art/audio, tech risks may remain | as early as possible, then iterate |
| Vertical Slice ("Beautiful corner") | core mechanics + final-look art/audio/UX in one small area, minutes long; unlocks publisher funding | before full production |
| Alpha | all major mechanics, placeholder art/audio for all content, runs on target hardware in debug, many bugs | ~50% of dev time (24-month game: month 12; 6-month: month 3) |
| Beta | all engineering, art, audio, design done; only bug fixing; last-minute features go to a later update | 75-85% |
| MVP | first launchable version: content and code complete, small feature set, plan for regular updates (Pokemon GO weekly updates; "works well with F2P since players forgive sparse content") | -- |
| Release | full, polished, intended feature set; code freeze; platform approval | 100% |
| Post-release | content/feature updates, themselves run through the same milestones; design the game so content can be added ("hard to retrofit") | after launch |

## Milestone plan matrix (Fig. 4.4)
Rows by discipline (engineering, art, design, UX, audio, localization, production, QA) x columns by milestone: e.g. Alpha art assets 40-50% final; Beta all assets final, only major fixes; Release full freeze (only crash bugs). Use it to align stakeholders; companies define "alpha/beta" differently.

## Practitioner advice in sidebars
- Ben Smith (EA Partners): vertical slice is the gate; "alpha feature complete, beta asset-locked"; the gap between them was never given enough time and "final" was never really final.
- Chuck Hoover (Facebook Reality Labs): keep milestone definitions simple; test is whether every team member can recite the next milestone date and goal from memory; use **"shippable"** instead of "done".
- Daniel Taylor (Psyonix): budget integration and load testing; licensor approvals.
- Milestones tied to deadlines are used in publishing contracts for payment release; a missed milestone is a natural decision point for scope cut, pivot or date change (Ch4.5).
- Exit criteria per milestone (Ch7.3): e.g. release candidate = all Priority 1 features playable, P1-P2 bugs fixed, approvals and submission docs complete.

## Stance and applicability
(a) Console/PC publisher-funded model where milestones gate payment and platform certification; example games are AAA.
(b) Practitioner experience; percentage figures (50%, 75-85%) are rules of thumb, not measured; sidebars openly note that alpha/beta slip in practice.
(c) Conflicts: for soft-launched mobile F2P the relevant gates are retention/monetization thresholds (D1/D7, ARPDAU - see [[concept-analytics-and-kpis]], [[concept-f2p-business-model-and-ltv]]) and continuous live-ops content cadence ([[concept-live-ops-and-inflation]]), not feature-complete/asset-locked states. Chandler's own MVP milestone and "post-release treated like any project" bridge the two, but do not define data-driven go/no-go. Agile schools drop "alpha/beta" for sprint increments.
(d) Fit: medium. A cut-down version fits a small team: prototype (core match-3 feel) -> vertical slice (one polished beautiful corner of the deco meta) -> content-complete soft launch -> live updates. Shippable-not-done and "recite the next milestone" tests are lightweight. Designer-only: medium - designers feed vertical-slice scope and per-milestone content targets (e.g. levels per milestone) in the matrix.
