# Goals, stakeholders, approvals and change requests

Source: [[prodtoolbox-chandler-src]], Ch4.2-4.4, 4.6 (pp. 58-64, 70-74); Ch9.2.

## SMART goals (Ch4.2)
Start from motivation / need / problem, then write Specific, Measurable, Attainable, Relevant, Time-bound goals in positive, active language (example: ship a succulent battle-royale in six months, $100k in first 3 months). Include things to avoid (no console version, no publisher). Publish goals; adjust them with the team when facts change; hold everyone accountable and be transparent. "Aim beyond the target" but within reach. Measurable examples in F2P form: 2% payer conversion, concurrent players.

## Stakeholders (Ch4.3)
Stakeholders = players, team, senior management, publisher, international partners, discipline leads, external teams, third-party platform holders. **Power-Interest grid** (Fig. 4.1): Manage Closely (high/high), Keep Satisfied (high power/low interest, e.g. players, rating boards), Keep Informed (low power/high interest, e.g. most of the team and QA), Monitor (e.g. LiveOps during development, will migrate to Keep Informed after launch). Grid can be done per game area (scope change, localization, platform tech, roadmap, China launch). **Stakeholder Communication Plan**: name, power, areas of interest, main goal, contribution, interactions, frequency; living document.

## Third parties (Ch4.4)
Platform holders want to review concept, alpha, beta; TRC list; account manager; 2-20 days per approval round, resubmit on failure. Count back from ship date, add buffer; add them to the stakeholder map. Sidebars: integration is "hidden work" (every department says done, feature fails playtest, ~3 weeks lost); load-test online features; licensors drag approvals (limit revisions).

## Aligning expectations, approvals (Ch4.6)
Explain why decisions were made, never dictate; keep demos/playtests for the team; post concept art, control scheme in team rooms. **Approval process** has three rules: keep it simple (few signers), define and publish it, track it with a single owner. Stakeholders who go to individual team members create hidden change requests and feature creep.

## Change requests (Ch4.6.2)
Prototype phase is the cheap time to change; later changes cascade. Form fields: description, reason, impact if not added, alternatives, impact on schedule/resources/quality, **what existing feature can be removed**, who to notify. Producer reviews with team, then with stakeholders to slot or swap; announce and update plans. Reality: often the change must be absorbed anyway, so reserve time for unknown work. Sidebar (Taylor): sell a new process as temporary, make it "our idea", simplify (e.g. monthly goals replacing eight sprint calendars).

## Stance and applicability
(a) Assumes multi-party projects: publisher, licensor, platform holders, executives, 20+ people; goals measured in sales/concurrency.
(b) Practitioner experience; SMART and power-interest grids are borrowed general-management tools (Doran 1981, standard PM texts), not game-tested research.
(c) Conflicts: lean/startup practice replaces formal stakeholder plans with a few metrics and direct conversations; in a small mobile team a signed change-request form is heavy. But the core rule (every addition names a removal) matches scope discipline in agile "fixed time, variable scope" and complements Czerkawski's habit of stating feature goals and analytics up front ([[concept-spreadsheet-modeling]]). Goal-setting with payer conversion echoes [[concept-analytics-and-kpis]] and [[concept-f2p-business-model-and-ltv]].
(d) Fit: medium. Measurable goal wording, a short feature-request template with an "what do we remove" field, and a one-line approval rule are cheap and useful for a designer-led team; power-interest grids and third-party approval planning are only partly relevant (Apple/Google review is lighter than console certification, though ratings/store policy still need lead time). Designer-only: medium-high for the change-request habit, since designers receive most scope pressure.
