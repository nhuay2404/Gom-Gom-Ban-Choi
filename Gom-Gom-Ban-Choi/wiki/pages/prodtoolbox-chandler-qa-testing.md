# QA testing: process, test plans, bug handling

Source: [[prodtoolbox-chandler-src]], Ch18 (pp. 245-256); Ch14.7; Ch17.7.

## Working with QA (Ch18.2)
QA = functional ("does it behave as intended"), distinct from UX ("is it satisfying"). QA is the last stage and absorbs schedule slips (overtime). Bring the **QA lead in from the beginning**: testing cost affects how features are scoped; reduce scope early if untestable and iterate later. Make a back-counted testing schedule (internal test done weeks before platform test). QA should spend days on a **single stable build**, not every daily build; milestone builds need weeks. Also schedule playtests (fresh eyes), marketing demo builds, and launch candidates (a week or more).

## Types (Ch18.3)
Playtesting (fun), functional (test plan), compatibility (hardware matrix; Android/iOS configs), performance (30 fps minimum, 60 ideal), compliance (platform rules), localization, ad hoc ("break it", idle, multitask).

## Outsourcing QA (Ch18.4)
Useful for small teams, big live tests (100 testers), compatibility labs, native-language testing, platform requirement experience. Ask: build lead time, who writes the plan, hourly vs daily rates, overtime, project-manager fee, cancellation, daily reports, bug tool. Check builds before sending, give clear scope, set a build cadence, answer questions fast.

## Test plans (Ch18.5)
Derived from design docs; pass/fail checklists; **keep updated** (a cut character otherwise logged as a bug); rotate sections across builds; full plan on milestone and code-release builds.

## Bug process (Ch18.6)
Status flow: Found -> Assigned -> Fixed (note build) -> Verified (note build) -> Resolved by QA lead. Central database (JIRA/Bugzilla), not email; train everyone to write bugs. Definitions: blocker, crash, critical, minor, feature request (a feature request is not a bug; mislabeling feeds feature creep). **Severity (0-4) versus priority**: three severity-1 crashes can have different priorities by where in the game they occur. Report fields: version, category, component, summary convention (e.g. L01--Art), description with expected vs actual, steps, screenshot, crash log. Assignment chain tester -> QA lead -> discipline lead -> assignee -> verify -> daily/weekly resolve. **"Will not fix" list** needs senior approval and seeds the known-issues list.

## Stance and applicability
(a) Studio with a QA lead, several testers, a bug database, platform certification and often a QA vendor; QA kept separate from development.
(b) Practitioner experience, closely aligned with standard software test practice (Schultz and Bryant *Game Testing All-in-One* cited).
(c) Qualifies: mobile F2P teams use a small QA core plus crash/analytics telemetry and staged rollouts instead of formal full-plan passes; severity/priority split still applies. The repo's own QC practice (npm test, QC models, eyes-on checks) is an automated, code-level version of the same checks. "QA test every build" vs "one build for days" is a real disagreement with continuous testing/automation schools. The compliance and compatibility types map to store policy and low-end Android device checks (Capacitor web build) that another team owns.
(d) Fit: medium. Bug lifecycle with build numbers, severity vs priority, feature-request-vs-bug discipline, a known-issues list and keeping the test plan synced with design are all useful and cheap. Designer-only: medium - designers feed expected behavior and feature definitions into test plans and decide design-related "will not fix".
