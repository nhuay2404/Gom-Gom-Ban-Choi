# Execution: pipeline, documentation, reviews, feature creep, postmortems, builds, ratings

Source: [[prodtoolbox-chandler-src]], Ch14 (pp. 191-204).

## Development pipeline (Ch14.2)
Series of steps getting assets and code into a playable build (character example: concept, model, texture, rig, animate, import, skills, mission, audio, optimize). Properties: tools/software, **two-way conversion** (game asset back to source), **critical path** (avoid one person owning too much), **few steps** (assets visible in build quickly), **always fully functional** (do not defer parts), version control for everything, automation. Sidebar (Schweitzer): map the pipeline backward from the end (usually QA), single owner at the start, draw it visually with owners/discipline/dependencies, track in a tool the team can use; the weapon pipeline moved from Excel in Perforce to JIRA to Shotgun.

## Documentation (Ch14.3)
Philosophies range from prototype-as-spec to everything written. Docs are useful only if kept current and read by the right people; QA writes test plans from design docs, so an undocumented UI prototype hurts. Lists: art (style guide, asset list, tool instructions), design (character bible, UI wireframes, story bible, game script), technical (coding standards, technical design), production/QA (budget and schedule, staffing plan, test plan). Must have enough detail for implementation; update after change.

## Measuring progress and project reviews (Ch14.4)
Every 4-6 weeks with consistent format: progress vs baseline (features and budget), accomplishments (none = trouble), risks, roadblocks, resource needs, scope/milestone changes. Reviews give stakeholders a formal channel and let leads synthesize feedback. Sidebar (Taylor) eight questions: vision, status, talent, schedule, budget/scope, process improvement, tools, morale.

## Feature creep (Ch14.5)
Feature creep = adding features without adjusting time, resources or quality. Some feedback improves the game (usability after UX tests). Assess requests against vision and cost. **Adding a feature after production starts means removing one** (or changing the others). Four levers: increase time, increase resources (not always; ramp-up cost), cut features (secondary ones with the worst resource/schedule pressure, never key ones), reduce quality (ship bare-bones and improve in a later update). Marketing's request for an online ranking system is the example (weeks, several people).

## Postmortems (Ch14.6)
Better after each major milestone than only at the end. Questions: goals achieved, were expectations realistic, what went right/wrong, lessons learned. Take notes during development. **Lessons Learned document: at most five items**, biased to ones the company will commit to; publish to team and studio.

## Builds and ratings (Ch14.7-14.8)
Daily automated builds on a build machine (nightly, copy to QA machines, script checks for missing/misnamed assets, mail error log); QA should test a stable build for days, not every daily. Rating boards (ESRB, PEGI, USK, CERO, IARC, China government...): submit beta, 10-45 days (resubmit another 10-45), concern areas violence, language, drugs, adult themes; platforms require certificates.

## Stance and applicability
(a) Mid/large studio with a build engineer, QA team and publisher; asset-heavy 3D pipeline; console/PC certification; examples mostly Epic/EA.
(b) Practitioner experience; the five-lessons cap, review cadence (4-6 weeks) and 10-45 day ratings are experiential figures.
(c) Conflicts: lean/continuous-delivery teams document sparsely (prototype or short per-feature doc as in [[concept-spreadsheet-modeling]]) and run retrospectives every sprint, not per milestone; Chandler does recommend milestone-level postmortems. For feature creep she treats stakeholders as the source; in live ops creep also comes from event/offer cadence ([[concept-live-ops-and-inflation]]). The two-way pipeline and "always functional" rules echo the repo's own practice (tools, QC pass). IARC makes ratings lighter on mobile than the multi-board process described.
(d) Fit: medium-high for pipeline principles, feature-creep levers, five-lesson postmortems and the "docs stay current or die" rule; low for rating boards and certification. Designer-only: medium-high: feature-creep triage and documentation are largely design responsibilities; the "add one, cut one" rule is a ready tool for scope discussions.
