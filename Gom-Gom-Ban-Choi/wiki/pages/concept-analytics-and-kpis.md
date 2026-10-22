# Analytics and KPIs

Source: [[src-czerkawski-game-economy-design]], ch. 5 (pp. 132–139).

Put telemetry in each feature's design doc ([[concept-spreadsheet-modeling]]); players behave unexpectedly after launch, so analytics drives adjustment. Benchmarks vary by genre and shift over time: look up current reports (GameAnalytics etc.), the book gives none.

| KPI | Definition |
|---|---|
| DAU / MAU | Unique users starting a session per day / month |
| Stickiness | DAU ÷ MAU (100k MAU, 20k DAU → 20%) |
| Sessions | Count of app opens; sessions per DAU = engagement, typical for short-session mobile |
| Classic (Day-N) retention | % of a day-0 install cohort returning *exactly* on day N (D1, D7, D30). Prefer this |
| Rolling retention | Returning on day N *or later*; always higher, keeps changing, misleading for decisions |
| Churn | 1 − retention (D7 retention 40% → 60% churn). Early churn = onboarding problem; later churn = missing content/features; also crashes |
| Conversion rate | % of unique users making ≥1 purchase in a period (also applies to paymium) |
| ARPDAU | Revenue ÷ DAU; watch after updates; can split by source (IAP vs ads) |
| LTV | Rough: ARPDAU × average user lifespan (from retention/churn) |
| ARPPU | Average spend of paying users only; genre-dependent |

Insights beyond the KPIs: what content sells, store click order and item placement, weapon/item usage vs sales, how players spend free hard currency (value of premium content), currency flow. Example diagnosis: D7 retention dip → check average level at day 7 → players stuck on one mission with no reward cadence → fix progression ([[concept-progression-systems]]).

Extra: payback/ROAS and A/B testing practice in [[concept-f2p-business-model-and-ltv]] and [[concept-ab-testing-monetization]].
