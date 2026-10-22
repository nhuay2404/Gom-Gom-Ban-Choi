# Price discrimination (segmentation by spending power)

Source: [[src-gd-fresher-f2p-monetization-training]], slides 29–31 (notes cite Javier Barnes, Coase, EU Directive 2019/2161).

**Why** (slide 29): with a single price you lose at both ends: whales willing to pay $50 pay $5, while players who can only pay $1–3 buy nothing. Fix = sell the same kind of value at several price points, by changing **pack contents**, not the price of the same item.

## Six approaches (slide 30)
1. **Self-selection menu** (second-degree): multi-tier menu, e.g. 6-pack, Battle Pass vs Premium+, VIP tiers. Each tier must be the best choice for *its* group; classic bug: the middle pack is so good whales drop down from the top pack. Safest, no personal prices.
2. **Observable groups** (third-degree): country, device, UA channel. Normal and valid, but Barnes' experience says regional price changes often **don't work**: you lose spend from high spenders in that market, the system gets hard to maintain, and some whales switch region/VPN. Safer: keep high pack prices and vary currency amounts, or run more offers for low-spend markets.
3. **Post-conversion escalation** (behaviour-based): find the price a player accepts, then raise 50–100% per step to probe the ceiling.
4. **Descending over progress** (intertemporal): offer high, then lower ($10 → 5 → 1). Risk: Coase problem.
5. **Behaviour signals and pLTV**: RFM, currency burn speed, progress speed, ad-view rate → predict LTV from the first sessions → assign pack tier (assign *packs*, not prices). Advanced: uplift modelling (discount only "persuadables"), contextual bandits.
6. **Effort-based** (non-price): rewarded video/grind: low-spend players pay with time and attention, high-spend with money. Almost no fairness risk; bridge to [[concept-iaa-ads-design]].
Most games use (1)+(2) as a base and add (3)–(5) when traffic can measure them.

## Three traps (slide 31)
- **Coase problem**: if players learn that not buying leads to a lower price they wait; predictable liveops discounts make payers pause spending. Fix: the expensive pack must contain something the cheap pack **never** has.
- **Fairness backlash**: players read it as "the game is pricier for the most engaged", screenshot and compare; trust damage outweighs revenue (Amazon DVD test, 2000).
- **Legal**: EU Omnibus Directive (2019/2161, applicable 28 May 2022) requires disclosure when price is personalised by automated decision-making; plus store policies and finite price tiers.
Rule: **personalise packs, don't personalise the price of the same item.** Checklist: the same item never appears at two prices at once; differences explained by pack contents not buyer identity; country/cohort price tests are fine, individual ones need legal first.

Related: [[concept-offers-and-merchandising]], [[concept-store-and-pricing]] (Czerkawski's anchoring/decoy), [[concept-dark-game-design-patterns]].
