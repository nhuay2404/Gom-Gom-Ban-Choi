---
type: council
tags: [council]
---
# Council playbook for a casual match-3 + deco game

Distilled from [[council-topic-verdicts]] using the genre weights in [[council-members-and-genres]]. These are **hypotheses to check against our own data**, not rules from the books. The user owns the design; setup, performance and SDKs belong to another team.

## Adopt (broad agreement, low risk)
1. **Rewarded video as the soft path** for extra moves/lives; opt-in, show the reward first, cap and cooldown ([[concept-iaa-ads-design]]).
2. **Starter pack** with one job (first purchase), triggered after FTUE, judged by first-purchase conversion and the buyers' LTV, not by its own revenue ([[concept-iap-packs-and-starter-pack]]).
3. **Reward return, never absence**: calendar-style daily rewards, no streak reset or forfeits.
4. **One hard currency**, clear conversion, pack ladder with bonus on larger packs ([[concept-store-and-pricing]]).
5. **Ethics checklist before release**: Zagal's test (intent, negative experience, consent) plus Bycer's four questions (forced to play? pressured to spend? payer-exclusive content? can free players compete?) and "every paid item has a fixed price or cap" ([[concept-dark-game-design-patterns]], [[f2pdive-bycer-ethics-player-friendly-design]]).
6. **Deco meta from the cozy playbook**: an unlock with a new subsystem every few levels, no dead stretch, free rearranging without penalty, naming/dressing cats, an optional photo/share mode ([[cozydive-bycer-relaxing-progression-curve]], [[cozydive-bycer-personalization-and-sandbox]]).
7. **Lean process**: cheap prototypes with an explicit goal, per-feature docs with analytics hooks, "adding a feature means removing one", short postmortems ([[prodtoolbox-chandler-prototyping]], [[concept-spreadsheet-modeling]]).

## Adopt with guardrails
- **Lives/energy**: keep, but with generous regeneration, a free route, and no wall at emotional beats (just after a big win, before a deco unlock).
- **Season/event pass** (deco/cat theme): free track with currency, catch-up window, keep earned items, cosmetic rewards ([[concept-battle-pass-vip-gacha]]); cap hard-currency pass-to-pass renewal.
- **Monthly card**: honest terms, easy to cancel, clear daily value.
- **Interstitials**: only at natural breaks, grace period for new players, none for recent payers.
- **Discounts**: target ex-payers and lapsed players more than active payers; real reference prices only ([[concept-offers-and-merchandising]]).
- **Event calendar**: one shared calendar, 1 month detailed + 2 months loose; check that an event doesn't flood a currency another drains ([[liveops-vasiuk-event-types-and-calendar]]).

## Avoid or defer
- Gacha-style random-only paid items, multiple premium currencies, variable exchange rates, auctions, creator marketplaces (G3/G4 tools).
- Fake scarcity or fake reference prices; two prices for the same item.
- Required recruiting/social obligations.
- Heavy documentation, stakeholder matrices, budget/legal/certification chapters from the production book.
- Treating 2013 benchmarks (CPI, payer rates, "3-minute everything") as current.

## Open questions only our data can settle
| Question | Where sources disagree | Cheapest test |
|---|---|---|
| Does a rotating deco set beat always-available items? | Czerkawski/Vasiuk rotate; many deco games don't | rotate one themed set, compare conversion and retention of the cohort |
| Is an expiring starter pack worth the manipulation risk? | GD Fresher tool vs Bycer manipulative | A/B: expiring vs reappearing pack; guardrail D7 retention |
| How strict should lives be? | Czerkawski/GD Fresher vs Cozy | regen time A/B with D1/D7 and ad opt-in as metrics |
| Do interstitials pay for themselves? | GD Fresher cap/peak vs Bycer avoid | cap A/B with D7 retention as guardrail ([[concept-ab-testing-monetization]]) |
| Does a free-route cosmetic cut revenue? | Bycer fairness test | offer a free path for a subset of items and compare |

## How to use this page
When a design question touches monetization, pacing, events or ethics, read the topic's verdict in [[council-topic-verdicts]] first, then the source pages it links to. If the verdict says "needs data", treat it as a test, not a decision.
