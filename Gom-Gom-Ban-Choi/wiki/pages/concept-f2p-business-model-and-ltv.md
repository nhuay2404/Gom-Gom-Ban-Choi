# F2P business model, LTV and payer segments

Source: [[src-gd-fresher-f2p-monetization-training]], stage 1 (slides 3–11).

## Business models
- **Premium**: pay once, own all. **Subscription** (business model): periodic fee for access (Apple Arcade, Game Pass), key metric is renewal rate. **Freemium/F2P**: free entry, revenue later from a few payers (IAP) and ads (IAA). Barrier to entry falls in that order; value is given before money is taken, only from people who saw the value.
- Don't confuse the *subscription business model* with a *subscription product* (VIP, monthly card) sold inside a free game ([[concept-battle-pass-vip-gacha]]).

## Lifecycle flywheel (slide 5)
UA (paid installs, every install has a price) → retention → monetization (IAP + IAA) → reinvest in UA. The wheel only turns if every link is healthy. **Organic** players (ASO, viral, referrals) cost nothing, so their revenue is pure profit and lowers blended CPI.

## LTV vs CPI (slide 6)
- **CPI** = cost per install (CAC is broader). **LTV** = average lifetime revenue per player (IAP + IAA) **after** ~30% store fee; beginners often compute it gross.
- LTV < CPI: loss (spending more on UA loses more). ≈: fragile, living on organic. > : scale.
- **Payback window / ROAS** (slide 7): ROAS D7/D30 = % of UA spend recovered; UA teams switch campaigns on this, not on final LTV. Designers help by putting revenue touchpoints **early** (starter pack, day-1 offer, short Battle Pass) but "collect early ≠ squeeze early": forcing purchases in the first minutes hurts retention and final LTV. Casual Android ROAS D30 can be only ~15% (Liftoff, cited slide 73).

## What a designer moves (slide 8)
LTV ≈ **Retention × Conversion × ARPPU** (+ IAA from non-payers). Mental model, not accounting. Retention: engagement first. Conversion (first purchase) is the hardest barrier → 6-pack, starter pack, offers ([[concept-iap-packs-and-starter-pack]], [[concept-offers-and-merchandising]]). ARPPU → gift ratio, Battle Pass, VIP, gacha. IAA → the 95–98% who never pay ([[concept-iaa-ads-design]]). +10% LTV lets you pay 10% more per install at the same margin, a real bidding advantage.

## Two faces (slide 9)
Engagement (core loop, progression, UX/FTUE, content) gives the "right" to monetize; payers are the players who love the game most. Supercell earns billions with few UX tricks. Don't optimise selling on a game that doesn't retain.

## Payer segments (slide 10)
~1–5% pay (≈2% typical); **Minnow** ~$1–5, **Dolphin** ~$10–50, **Whale** $100s+; whales carry most IAP revenue; non-payers (95–98%) monetize through ads. Caveat: lifetime-total labels mislead (a $10/month dolphin for 2 years ≠ a $1000/1-month whale), so also look at the last 30 days; thresholds vary by genre. Design consequence: offer packs at many price tiers.

Compare KPI definitions in [[concept-analytics-and-kpis]] and the genre/model view in [[concept-hybrid-models-and-ethics]].
