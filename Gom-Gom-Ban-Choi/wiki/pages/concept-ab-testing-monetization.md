---
type: concept
source: src-gd-fresher-f2p-monetization-training
tags: [concept]
---
# Measuring and A/B testing monetization

Source: [[src-gd-fresher-f2p-monetization-training]], stage 5 (slides 53–59).

## Metrics per tool (slide 54)
| Tool | Main metrics | Question |
|---|---|---|
| 6-pack | revenue split per pack, % buyers per pack | is the cheapest pack the top earner (problem)? |
| Offer/bundle | view → click → buy, revenue per impression | right player, right moment? click high/buy low = nice art, weak content/price; view high/click low = wrong person or time |
| Battle Pass | purchase rate, **completion rate**, revenue per season | right price? season too long to finish? |
| VIP/subscription | renewal rate, average lifetime days | perks worth paying for regularly? |
| Gacha | average spend until rare, % hitting hard pity | pity set right? |
| Rewarded video | impressions/DAU, eCPM, opt-in rate per placement | which placements have real demand? |
Rule: if a metric can't change a decision, don't track it. Baseline KPIs: [[concept-analytics-and-kpis]].

## A/B test rules (slides 55–56)
- Random A (control) vs B (change **one variable**): pack price, gift ratio, store layout, offer content, pass price, ad placement. Enough sample and time; also watch secondary metrics (retention, LTV), not conversion alone.
- First test suggested (Barnes): the **cheapest pack's price** ($0.99, $3.99, or remove it); track conversion and LTV together.
- **Peeking**: stopping the first day B looks ahead will eventually "win" even if the arms are identical (day 3 shows +22%, day 14 ≈ +1%). Fix before running: a specific hypothesis, ONE primary metric, sample size and end date, read results only at planned points.
- Time: at least 1–2 full weeks (weekend cycle); smaller differences need more people and days; revenue is noisier than conversion; avoid big events/holidays. Early stop = "worth re-testing", not a conclusion.

## Whale outlier (slide 57)
One $2000 payer in arm B turns a flat test into "+20% ARPU". Handle by: (1) use **conversion rate** as the primary metric, (2) cap each player's contribution and recompute (a flip means outlier-driven), (3) measure whales separately, (4) stratify assignment by spend. Reflex question: "is this still true without the top 5 spenders?"

## Cohorts (slide 58)
Daily revenue mixes new and old players and rises with UA spend. Compare cohorts at the **same age** (D0, D7, D14, D30 cumulative revenue per player); a drop in the week-4 cohort shows up here while daily totals hide it. Use for before/after an update and per-UA-batch payback ([[concept-f2p-business-model-and-ltv]]).

## Decision loop (slide 59)
Hypothesis → test with a control and stop point → read target metric **and guardrail** (retention D7, sessions, continue rate) → decide and document (keep, fix and retest, or drop; no "leave and see"). A best-selling offer that drops retention is a bad offer. Log failed tests so the team doesn't repeat them.
