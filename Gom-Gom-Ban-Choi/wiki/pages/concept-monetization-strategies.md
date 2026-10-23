---
type: concept
source: src-czerkawski-game-economy-design
tags: [concept]
---
# Monetization strategies and components

Source: [[src-czerkawski-game-economy-design]], ch. 4 (pp. 89–111), ch. 1 (pp. 14–18).

Build monetization into the design from day one; bolted-on monetization gives mediocre results. Business models: free-to-play (microtransactions, mostly mobile; single core method of play in measurable sessions, retention/monetization wrapped around it) vs premium (upfront cost, more room for self-contained journey; "paymium" = premium + microtransactions).

## Three strategies (pp. 90–92)
| Strategy | Monetizes | Notes |
|---|---|---|
| **Performance** | Power / speed of progress | Most aggressive; pure form = pay-to-win, increasingly resented |
| **Preference** | Playstyle variety / faster unlock of a preferred style | e.g. CoD weapon blueprint: same potential power achievable free, just more play time |
| **Personalization** | Cosmetics / self-expression | Cheapest in player anger, most expensive in art content; treadmill-prone ([[concept-pacing-and-content-control]]) |
Most games mix them. Goal: "you get a better game when you spend" and fairness: non-payers must be able to compete, payers must feel challenged.

## Components
- **Hard currency** (pp. 93–94): central store of microtransactions; $1 = 100 units baseline; bonus on larger packs; obscures real price (honesty concern) but gives pricing flexibility, lets designers give small amounts free, and decouples content costing from payment integration.
- **Consumables** (temporary, drive repeat purchase) vs **durables** (permanent, bulk of cosmetics).
- **Advertising** (pp. 95–97): banner (passive; suits single-screen puzzle/strategy), interstitial (full screen; use at natural transition points such as between levels), **rewarded video** (opt-in for a lesser reward; use small currency, consumables, retry-from-checkpoint, reward multiplier; must not undercut microtransactions; limit frequency).
- **Battle Pass** (pp. 97–98): tiered track on bespoke XP, ~$10, free tiers + paid tiers, season ~60 days with reset. Doubles as retention: unclaimed locked rewards nudge conversion; payers feel time pressure. Final-tier hard currency can fund next season's pass. Less linear passes (CoD MWII) give choice.
- **DLC** (pp. 98–99): paid content via platform store; in-game hard-currency purchases are not DLC.
- **Subscriptions** (p. 99): recurring benefits (Fortnite Crew: monthly cosmetics + currency + Battle Pass + legacy styles); sell a long-term commitment benefit.
- **Lootboxes / gacha** (pp. 99–101): paid random reward; used as the progression engine in some F2P (spend caps in the tens of thousands of dollars); regulated as gambling in some countries (drop-rate disclosure). Fairness theme.

## F2P habits and pinch points (pp. 101–105)
- Players only pay if they keep returning: retention first, then "stickiness" ([[concept-analytics-and-kpis]]). No magic formula; iterate.
- **Pinch point**: after some play, the player runs out of something valuable (lives, soft currency), creating a soft block; first spend = **conversion**, after which repeat spend is likelier. Non-payers need a grind/timer path past it. Keep it honest to the fiction. Multi-resource trick: make one resource (soft currency) run out faster than the other (card boosters) — Marvel Snap ([[case-marvel-snap-and-the-finals]]).
- **Energy systems**: see [[concept-pacing-and-content-control]].
- **Loss aversion / reward removal**: defeat loses rewards, paid revive restores them ([[concept-reward-design-and-psychology]]).
- **Cosmetic item types**: character/weapon/vehicle skins, emotes, loading screens, emblems/banners (cheap), pets, decals, colours. Cosmetics lack a model; ask the community, read sales data; keep a "Ferrari" tier (Veblen goods) and rarity guidelines for artists.

Pricing, store and bundles: [[concept-store-and-pricing]].

Ethics check: [[concept-dark-game-design-patterns]] (pay to skip, monetized rivalries, pre-delivered content).

Deeper commercial detail (UA/LTV, offers, A/B tests, ads, hybrid): [[src-gd-fresher-f2p-monetization-training]], e.g. [[concept-iap-packs-and-starter-pack]], [[concept-iaa-ads-design]], [[concept-battle-pass-vip-gacha]].
