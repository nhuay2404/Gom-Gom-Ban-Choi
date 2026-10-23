---
type: council
tags: [council]
---
# Council: topic-by-topic verdicts

Method and member profiles: [[council-members-and-genres]]. Our genre is **G1** (casual puzzle + meta layer; a cat match-3 with a deco home). Each verdict states the positions, the best-fit answer per genre, and a **confidence** (High/Medium/Low). Evidence tags: [D] measured, [P] consensus of several sources, [O] one author's opinion. Verdicts are editorial; source pages hold the details.

## 1. Energy / lives / refill timers
| Source | Position |
|---|---|
| Czerkawski ([[concept-pacing-and-content-control]]) | Legitimate session control, content brake and habit builder; direct monetization is crude; disguised variants (Clash Royale chests) ok [P] |
| GD Fresher ([[concept-iaa-ads-design]], [[concept-iap-packs-and-starter-pack]]) | Lives/out-of-lives is a standard pinch point; rewarded video for extra lives as the soft path |
| Vasiuk ([[liveops-vasiuk-f2p-economics-and-sunk-cost]]) | Neutral; delay plus stored cap as a return driver; no paid-refill advice |
| Bycer F2P ([[f2pdive-bycer-fun-pain-pay-or-wait-and-ads]]) | "Fun pain" is obsolete; energy accepted as a throttle; never wall before an unlock or at an emotional beat [O] |
| Bycer Cozy ([[cozydive-bycer-low-stakes-design]]) | No countdown pressure; only a soft daily energy that resets and can't be bought [O] |
| Zagal ([[concept-dark-game-design-patterns]]) | Dark when effective play is steadily reduced until payment is needed (SimCity Social); consent and transparency matter |
**By genre:** G1 acceptable with generous regen, a free path (wait, ad, gifts) and no wall at emotional beats; G2 no; G3/G4 as throttle; G5 n/a.
**Verdict for us (confidence Medium):** keep lives as a business lever, but design them as a gentle brake, not a wall; the free route must exist and be transparent. The disagreement is partly a genre difference (Cozy is premium).

## 2. Daily login and streak rewards
Czerkawski: small soft-currency daily reward, meta-mission, peak-end bonus [P]. GD Fresher: monthly card builds a login habit [P]. Vasiuk: permissive, equal or escalating, no streak-loss caution. Bycer Cozy: reward presence, never punish absence; warns that Animal Crossing-style conditioning is abused [O]. Zagal: appointment mechanics are dark when required for progression.
**Verdict (High):** everyone supports rewarding return; nobody defends punishing absence. Calendar-style rewards with no streak reset or forfeits; small hard currency only at milestones.

## 3. Rewarded video and interstitial ads
GD Fresher: RV is the win-win format; interstitial only at natural breaks with caps, grace period and payer exemption; LTV vs ad load has a peak [D from cited reports]. Czerkawski: RV opt-in, careful frequency. Scolastici (2013): interstitials hurt retention, banners/offer walls era. Bycer F2P: avoid ads, sell ad-free; calls ads outdated with no data [O]. Vasiuk: not covered.
**By genre:** G1/G5 hybrid with RV first; G3/G4 cosmetic-led often minimal ads (Royal Match runs none); G2 none.
**Verdict (High on RV, Medium on interstitial):** follow GD Fresher's data for G1, add Bycer's guardrails (never forced, remove-ads IAP, no ad at emotional beats).

## 4. Whales and payer segmentation
GD Fresher and Czerkawski treat payer tiers as normal design input. Bycer: whale-targeted design is unethical and self-defeating [O]. Vasiuk ("People's LiveOps"): chasing the top 1% leads to P2W and a content treadmill. Zagal: monetized rivalries are dark.
**By genre:** the P2W harm is largest in PvP (G3/G4); in single-player G1 (boosters/levels/cosmetics) the competitive-unfairness argument is weak.
**Verdict (Medium):** offer packs across price points, but avoid dark mechanics; run Bycer's "free route to cosmetics" and "spending cap/no random-only" tests as an audit ([[f2pdive-bycer-ethics-player-friendly-design]]).

## 5. Starter pack, discounts, VIP, price discrimination
GD Fresher: starter pack has one job (first conversion), VIP/monthly card, segment tiers; warns against two prices for one item and fake reference prices ([[concept-iap-packs-and-starter-pack]], [[concept-price-discrimination]], [[concept-offers-and-merchandising]]). Vasiuk: no discounts for active payers, bigger ones for long-lapsed ex-payers; remove content after first run, bring back in 3–4 months ([[liveops-vasiuk-personalization-lifecycle]], [[liveops-vasiuk-content-lifecycle-and-sink-techniques]]). Czerkawski: discount timing sweet spot; starter bundle ([[concept-store-and-pricing]]). Bycer: expiring beginner packs and lifetime-spend VIP are manipulative [O].
**Verdict (Medium):** starter pack and monthly card are a practitioner consensus [P] for G1; reduce the manipulation risk with honest timers (no fake scarcity), a pack that reappears, and a real reference price. "No discounts for active payers" is a cheap rule to try.

## 6. Battle Pass / seasons
GD Fresher: detailed design, completion rate as the health metric. Czerkawski: time pressure is a feature. Vasiuk: cap hard-currency pass-to-pass renewal, retroactive activation, free track with currency ([[liveops-vasiuk-battle-pass-in-events]]). Bycer: no empty free tier, catch-up window, keep earned items, reward cosmetics not level-skips ([[f2pdive-bycer-battle-pass-and-seasons]]).
**Verdict (Medium-High):** a seasonal deco/cat pass fits G1. Adopt Bycer/Vasiuk guardrails because they cost little revenue and protect trust.

## 7. Session length and depth
Scolastici: 3-minute sessions, shallow depth (2013 premium casual). Czerkawski/GD Fresher: a metagame supplies hundreds of hours. Cozy: no dead stretch between unlocks ([[cozydive-bycer-relaxing-progression-curve]]).
**Verdict (High):** both are right at different layers. A match-3 level is a short session; the deco meta carries the long journey. Scolastici's depth claim is dated.

## 8. Hard currency design
Czerkawski and GD Fresher: a hard currency is standard, bonus on bigger packs, $1 = 100 baseline. Bycer: against multiple premium currencies and obscuring [O]. Vasiuk: variable hard→soft exchange rates, multi-currency pricing, event shops (G4-style).
**Verdict (Medium):** one hard currency, clear conversion, no multi-currency item pricing. Variable exchange rates and auctions don't fit G1.

## 9. Events, calendar and team
Vasiuk: four event types, 1-month detailed plus 2-month loose horizon, don't stack revenue events, don't queue far ahead, events mustn't contradict (one drains what another floods) ([[liveops-vasiuk-event-types-and-calendar]]). Czerkawski: plan content ahead via spreadsheets. Bycer: always have something running, keep events inclusive. Chandler: set up the LiveOps process before launch; check metrics before acting on vocal forum feedback ([[prodtoolbox-chandler-release-and-liveops]]).
**Verdict (Medium):** a simple shared calendar and currency-conflict check fit a small team; skip 24/7 coverage and regional store ops.

## 10. Item availability: always-on vs rotation
Czerkawski: rotate out after about a year, reuse for promotions. Vasiuk: remove after first run, return later, then permanent sale. Many deco games keep everything available. **Verdict (Low-Medium, needs data):** keep core furniture always available; rotate themed/seasonal sets. Test.

## 11. Personalization and the content treadmill
Czerkawski: cosmetic-only monetization is the most treadmill-prone. Bycer Cozy: personalization and sandbox widen the audience; players always want more options ([[cozydive-bycer-personalization-and-sandbox]]).
**Verdict (High on the tension):** for deco, personalization *is* the product, so plan the content budget for endless demand and give free rearranging with no penalty.

## 12. Difficulty spikes and pinch points
GD Fresher/Czerkawski: a pinch point creates conversion. Bycer: no hidden spike before an unlock [O]. Scolastici: forgiving difficulty. Cozy: assists don't fix churn (Celeste lost ~30% before chapter 1 ended). Zagal: spike-then-pay is "pay to skip".
**Verdict (Medium):** keep DDA-driven difficulty; don't tune a spike purely to sell a booster; offer a generous assist after repeated failure.

## 13. How strict should ethics be?
Strictness ladder: Bycer (strictest) > Zagal > GD Fresher > Czerkawski > Vasiuk (light cautions). Zagal's consent-plus-disclosure test is the common core; Bycer's four-question audit makes it checkable.
**Verdict (High):** adopt Zagal's definition and Bycer's audit as a pre-release checklist ([[concept-dark-game-design-patterns]]).

## 14. Production process
Chandler: heavy documentation, stakeholder matrices, milestone gates (G6). Czerkawski: lean per-feature docs. Scolastici: prototype first. GD Fresher: A/B and cohort decisions.
**Verdict (High):** for a small designer-led team use lean docs and cheap prototypes ([[prodtoolbox-chandler-prototyping]]), plus Chandler's scope rule (adding means cutting, adding time or lowering quality) and postmortems. Skip budget, legal and certification chapters.

## 15. Tech and platform advice
Scolastici (2013) calls HTML5 slow and immature; the project uses web + Capacitor, so this is dated. The residual risk (low-end Android WebView performance) belongs to the technical team.

## 16. Social features and virality
Scolastici: score sharing. Vasiuk: limit invites, aggressive popups kill word of mouth. Zagal: social pyramid schemes and impersonation are dark.
**Verdict (High):** optional photo/share mode is fine; never make recruiting required for progress.

## Where the sources agree (safe ground)
Engagement before monetization; monetization designed in early but not ahead of the game; transparency (prices, contents, odds); reward return without punishing absence; no hidden walls; measure with cohorts and guardrail metrics.
