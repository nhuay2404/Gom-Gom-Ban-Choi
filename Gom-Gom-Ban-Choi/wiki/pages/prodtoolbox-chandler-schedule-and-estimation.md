# Scheduling, WBS and estimation

Source: [[prodtoolbox-chandler-src]], Ch7 (pp. 105-119); Ch18.2; Ch13.3.

## Why and how (Ch7.2-7.3)
Teams distrust schedules (inflexible, inaccurate, not asked). A schedule is a **baseline road map**, not a contract: it makes "way off schedule" visible; "fun factor" work needs room to iterate and scrap. Involve the team, otherwise no ownership. Do not expect accuracy months ahead: schedule key milestones, add detail as each approaches. Count backward from the ship date (example: launch, third-party submission one month earlier, release candidate two weeks before that, beta one month before RC). Define **exit criteria** for each goal (tangible, e.g. "all P1 features playable, P1-P2 bugs fixed, approvals done"). Adding people costs onboarding and review time and can lengthen the plan.

Tooling: define work, owner, duration/deadline, dependency at minimum. Choose what the team will use; one person owns updates (a few hours/day), ideally also the budget. Google Sheets as fallback; list of tools (JIRA, Trello, Hansoft, Shotgun, HacknPlan...).

## Initial schedule and WBS (Ch7.3-7.4)
Fig. 7.1: one-page list of goals per department (production, approvals, design, art, engineering, audio, localization, QA, vendors, marketing). Then **Work Breakdown Structure**: whole group lists every task for a deliverable (e.g. one shippable character or one level, Fig. 7.2: art ~60 days, design ~20, sound ~13, QA ~18), grouped by discipline, then owners estimate. Works for repeatable assets, poorly for new modes with unknown technical/design questions. Use it to decide content volume (launch with 5, 10 or 20 levels? maybe 8).

## Estimates (Ch7.5)
Best guess, revised as information arrives, any change in scope communicated at once; involve team; use historical data. If "impossible to estimate", **time-box**: fixed window, prioritized requirements, stop at done or deadline, then decide continue / good enough / cut / new box; cutting is legitimate (tool-tip system example).

## Putting it together (Ch7.6, Figs 7.3-7.6)
Tasks 1-5 days; no blank durations; padding per task or at the end; account for sick days, holidays, vacations; **do not schedule overtime**; assume **5-6 productive hours per 8-hour day**. One level: 15 days with no dependencies/resources, 63 days with resources only, 37 days with dependencies only, **41 days with both** - the point is that resources and dependencies, not raw effort, set duration; run several levels in parallel to hide bottlenecks. Track: single keeper, regular updates to team, early warning of slips (so help can come instead of overtime), upcoming-deadline reminders, individual check-ins.

## Stance and applicability
(a) Multi-discipline asset-heavy 3D/level production (levels, characters, cinematics, vendors) with an experienced producer maintaining a schedule tool.
(b) Practitioner method; the worked level example is illustrative arithmetic, not measured data. Productivity rule (5-6 h/day) is experiential.
(c) Qualifies: agile schools estimate in relative points and re-plan every sprint, avoiding WBS detail; Chandler keeps a hybrid (WBS for repeatable content, time-box for unknowns). The repeatable-asset WBS is exactly how content-pipeline throughput is modeled in live ops (levels, deco items per week) - see [[concept-live-ops-and-inflation]] (content planning) and [[concept-pacing-and-content-control]] (content treadmill). Spreadsheet modeling of production throughput parallels [[concept-spreadsheet-modeling]]. No-overtime advice contrasts with crunch culture common in the industry.
(d) Fit: medium-high for the WBS of a deco item or level, the time-box technique, and "no overtime, 5-6 productive hours"; low for console submission back-planning and large Gantt charts. For a designer-only role: medium - designers should supply task breakdowns and honest durations for level/feature/deco content and propose time-boxes for risky features, but not own the schedule.
