# LiveOps toolset, analytics, experiments and data culture

Source: [[liveops-vasiuk-src]], ch. 13-14, pp. 173-201.

## Toolset (ch. 13)
Seven modules around a **data platform** hub: attribution/performance marketing (traffic attribution, fraud, affiliates), commerce (catalogue, inventory incl. seasonal/event inventories, soft/hard currency, dynamic storefronts, targeted offers, payment gateways), communication (email, push, in-game promo, messengers; automated winback/onboarding), PRM (personal / regular / special activities; planning, launching and forecasting automation), distribution/launcher, accounts and privacy (one-click sign-up, GDPR/CCPA). **Build vs buy**: depends on budget, team, legacy; most studios buy; integrate tools **during development or before launch** to collect data from day one; self-hosted (control, expertise) vs provider-hosted (ease, cost, legal data location).

## Analytics (ch. 14)
- Mantras with additions: "if you cannot measure it yet it is not necessarily bad"; "torture the data and it confesses" (peer review); data enhances intuition.
- **Reporting hierarchy** (DAU decomposed into audience = acquisition + retention, and ARPDAU = monetization): D1-3 tests FTUE, D7-14 conversion and variety, D30+ economy and community; **power-user curve** (MAU by active days; a "smile" indicates a core); monetization dashboards (ARPU, ARPPU, %payers, first-payment timing, recency/frequency, currency flows, inflation, deficit/surplus by segment, funnels, event revenue); LTV aggregate by payback window and source.
- **Insights vs reports**: insights are new, journalism-like; **expect ~25% of ideas to work: 59 of 78 monthly WoT campaigns in 2017 failed on significance or negative results** (p. 193). Open questions about "common knowledge" generate hypotheses.
- **Experiments**: control group; choose significance level knowingly (70% vs 95%); judge 360 degrees across several metrics (selling XP may earn money but kill play); no-control fallback: Causal Impact, Prophet.
- **Predictive**: player-behaviour prediction vs product forecasting; confusion matrix; accuracy misleads at 5% payer rates (predict "none pay" = 95% accurate); use **sensitivity** for low-risk targeting, **precision** when giving valuable rewards (a free premium account to non-churners inflates the economy). Prediction is the easy part of churn prevention; offers, localisation, QA, campaigns follow.
- **Data culture**: bias awareness, flexibility (avoid analysis paralysis), common lexicon, accountability, learning culture; new product wants rigor, mature product can be freer.

## Stance and applicability
- (a) PC/console with launcher and large data team; ML models commoditised via cloud services.
- (b) The strongest quantified claim in the book is the 59/78 failure rate (single studio, one year). Statistics guidance (significance, precision vs recall) is correct and standard.
- (c) Deepens [[concept-analytics-and-kpis]] and [[concept-ab-testing-monetization]] (peeking, cohorts, guardrails): same direction, adds "360 degree" multi-metric reading and the sensitivity/precision rule. Notes explicitly that early free users are the best, matching the cohort caution there. Does not discuss mobile MMP/SKAN limits.
- (d) **Medium.** Reporting hierarchy, power-user curve, precision-for-valuable-rewards, "expect most experiments to fail", and early data integration are directly usable. Full PRM/ML stack is out of scope for a designer-led team; Firebase Remote Config/A-B tests are our practical equivalent.
