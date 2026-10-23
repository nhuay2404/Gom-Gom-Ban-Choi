---
type: book-source
source: prodtoolbox-chandler
fit_g1: medium
tags: [book, prodtoolbox-chandler]
---
# Source: Chandler, The Game Production Toolbox (2020)

Heather Maxwell Chandler, *The Game Production Toolbox*, CRC Press, 2020 (xxiii + ~290 pp., 20 chapters, 6 parts). Book key `prodtoolbox-chandler`. Text extracted with pdftotext; the PDF is outside the repo.

**Author background (Preface, Author):** 20+ years producing at Activision, EA, Ubisoft, Epic (Senior Producer on Fortnite incl. launch and updates); AAA and some indie (Never Alone). Wrote *The Game Localization Handbook*. Chaired the IGDA Production SIG 2006-2010. Foreword by Celia Hodent (UX). The book is interleaved with short sidebars from ~11 practitioners (Matt Immerman, Daniel Taylor/Psyonix, Ben Smith/EA Partners, Chuck Hoover, Chris Schweitzer/Epic, Brian Sowers, Jay Powell, Ashley Jennings/Hi-Rez, Colin Thompson, Jason Della Rocca, Ray Crowell).

**Thesis (Preface):** production is not budgets and schedules (those only measure progress); it is understanding all the pieces that must converge, making a plan, and unblocking the team. A producer serves the team, communicates, and keeps scope/schedule/budget/quality in balance.

## Chapter map -> wiki pages
| Part / Ch | Topic | Wiki page |
|---|---|---|
| 1 / Ch1 Industry overview (framework, financing, revenue models, platforms, distribution) | business context | [[prodtoolbox-chandler-business-funding-publishing-legal]] |
| 1 / Ch2 Developer and publisher (roles, producer types, publisher functions) | roles | [[prodtoolbox-chandler-roles-and-producer]], business page |
| 1 / Ch3 Legal (IP, NDA, contracts, EULA/TOS, licensors) | legal | [[prodtoolbox-chandler-business-funding-publishing-legal]] |
| 2 / Ch4 Laying the groundwork (SMART goals, stakeholders, third parties, milestones, approvals, change requests, iron triangle, PMP/CSM) | alignment and process | [[prodtoolbox-chandler-goals-stakeholders-change-control]], [[prodtoolbox-chandler-milestones]], [[prodtoolbox-chandler-methods-and-iron-triangle]] |
| 2 / Ch5 Creating concept (brainstorm, hook, loop, SWOT, treatment, risk) | concept | [[prodtoolbox-chandler-concept-and-risk]] |
| 2 / Ch6 Prototyping | prototype | [[prodtoolbox-chandler-prototyping]] |
| 3 / Ch7 Schedule (exit criteria, WBS, estimates, time-box) | schedule | [[prodtoolbox-chandler-schedule-and-estimation]] |
| 3 / Ch8 Budget (burn rate, cost breakdown, overages) | budget | [[prodtoolbox-chandler-budget]] |
| 3 / Ch9 Pitching (deck, demo, vetting) | pitch | [[prodtoolbox-chandler-business-funding-publishing-legal]] (pitch section) |
| 4 / Ch10 Hiring; Ch11 Team organization | people | [[prodtoolbox-chandler-team-hiring-and-organization]] |
| 4 / Ch12 Managing your team | leadership, communication | [[prodtoolbox-chandler-leadership-and-communication]] |
| 4 / Ch13 Outsourcing and middleware | vendors | [[prodtoolbox-chandler-outsourcing-and-middleware]] |
| 5 / Ch14 Executing the plan (pipeline, docs, reviews, feature creep, postmortems, builds, ratings) | execution | [[prodtoolbox-chandler-execution-feature-creep-postmortem]] |
| 5 / Ch15 UX (with Celia Hodent) | UX process | [[prodtoolbox-chandler-ux-process]] |
| 5 / Ch16 Audio; Ch17 Localization | content pipelines | [[prodtoolbox-chandler-audio-and-localization]] |
| 5 / Ch18 QA testing | QA | [[prodtoolbox-chandler-qa-testing]] |
| 6 / Ch19 Marketing and PR; Ch20 Releasing, LiveOps | launch | [[prodtoolbox-chandler-release-and-liveops]] |
| Appendices (acronyms, resources, bios, references, index) | skipped, except as pointers | -- |

Reading note: the extracted text lost ~2 pages of Ch15 (sec. 15.3-15.5 partly) and the ch.3.3.2-3.3.3 stretch; summaries rely on what survived.

## Distinctive claims (digest)
- Production is a support role: the producer "unblocks", keeps information flowing, and protects scope/schedule/budget; a designer-producer hybrid will be biased against cutting scope (Ch2.3).
- Milestone ladder: Prototype -> Vertical Slice -> Alpha (~50% of time, mechanics in, placeholder content) -> Beta (75-85%, content complete, bugs only) -> MVP/Release -> Post-release (Ch4.5). Milestones tied to publisher payments.
- A schedule is a baseline for tracking, not a promise; do not schedule overtime; plan 5-6 productive hours per 8-hour day; use time-boxes for features nobody can estimate (Ch7).
- Feature creep fix is the iron triangle: adding a feature means cutting one, adding time/people, or lowering quality (Ch14.5).
- Prototype early and cheaply (2-3 people); throw exploratory prototypes away; show executives a vertical-slice-grade build, developers a rough one (Ch6).
- Pick leads for people skills, not as the best craftsperson (Ch11.3). Trust and respect beat money for retention (Ch10.7).
- Outsourcing is not a cost/time saver; it adds feedback and integration overhead (Ch13).
- QA process is Found -> Assigned -> Fixed -> Verified -> Resolved, severity separate from priority, "will not fix" list becomes the known-issues note (Ch18).
- Live game needs a LiveOps process set before launch; vocal forum users are not the player base, check metrics first (Ch20).

## Project type the book is really about
Publisher-backed or well-funded premium/AAA/mid-size PC-console titles with 10-300+ people and a discipline-led org (art/design/eng/QA/audio/localization/marketing), released through platform-holder certification. F2P/LiveOps/MVP appear in Ch1.4, Ch4.5.5, Ch20 but as add-ons, with Fortnite and Pokemon Go as the examples. Almost nothing about small mobile casual live-ops loops, soft launch, UA, ad monetization or economy tuning.

## Cross-wiki connections
- Economy and live-ops content: [[src-czerkawski-game-economy-design]], [[concept-live-ops-and-inflation]], [[concept-analytics-and-kpis]].
- F2P business: [[src-gd-fresher-f2p-monetization-training]], [[concept-f2p-business-model-and-ltv]].
- Ethics: [[src-zagal-dark-patterns-in-game-design]], [[concept-hybrid-models-and-ethics]] (Chandler mentions pay-to-win only briefly, Ch1.4.4).

## Stance and applicability
(a) Implicit project: a publisher-funded, milestone-paid, console/PC title made by a discipline-structured studio of dozens to hundreds, with producers as a dedicated role. Free-to-play and live service appear as variants.
(b) Evidence: almost entirely practitioner experience and interview sidebars; no data except rules of thumb (Alpha at 50%, $10k/person/month burn, 1,500-2,000 words/day/translator, 50 VO lines/hour, 2-3 months for localized builds). One cited empirical source (Game Outcomes Project, Ch12).
(c) Conflicts/qualifications: leans waterfall-with-milestones plus light Scrum, whereas lean/live-ops mobile practice (see [[concept-live-ops-and-inflation]]) treats the soft-launched game as continuously changing and measured by retention/LTV ([[concept-f2p-business-model-and-ltv]], [[concept-ab-testing-monetization]]). Heavier on documentation and approvals than lean-startup and Czerkawski's "repo of small feature docs" ([[concept-spreadsheet-modeling]]).
(d) Fit: medium overall. Roughly 6 of 20 chapters (scope/feature creep, prototyping, estimation, postmortems, QA process, live release) transfer; hiring, legal, pitching, platform certification, VO and boxed distribution mostly do not. Designer-only role: medium (useful for understanding what producers/QA need from design, and for scope arguments).
