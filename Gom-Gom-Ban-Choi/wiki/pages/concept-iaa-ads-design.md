---
type: concept
source: src-gd-fresher-f2p-monetization-training
tags: [concept]
---
# In-app ads (IAA) design

Source: [[src-gd-fresher-f2p-monetization-training]], stage 6 (slides 60–68). Czerkawski covers ad types briefly in [[concept-monetization-strategies]].

- **Role**: monetize the 95–98% who never pay; combine with IAP ([[concept-hybrid-models-and-ethics]]). Chain: advertiser → ad network/mediation → game → player. Metrics: **eCPM** (revenue per 1000 impressions), fill rate, impressions/DAU, ad ARPDAU.
- **Types**: rewarded video (RV, opt-in, high eCPM, liked), interstitial (full screen, high eCPM, annoying if misplaced), banner (low eCPM, unobtrusive), native, offer wall.
- **Revenue formula**: ad revenue = (impressions per DAU × eCPM) / 1000. Both are measurable in your own game: don't borrow other studios' eCPM. Drivers of eCPM: **region** (biggest: casual rewarded about $8.90 Android / $12.24 iOS in EU/NA vs low single digits in SEA/LATAM; TopOn H1 2025), platform (iOS > Android), format, genre/user value (midcore > casual), season (Q4 peak). Trend: casual Android rewarded eCPM fell $3.60 (H1 2023) → $3.02 (H1 2025). Format share in casual: banner ≈ 37% of impressions but ≈ 6.5% of ad revenue; interstitial 44%, rewarded 39%.
- **Mediation**: waterfall (ordered by past eCPM, slower, manual) vs in-app bidding (real-time auction; usually hybrid of both). Ad ops owns mediation; designers own **how many placements and where**, must design for fill < 100% (grey out or say so, never a dead button) and for **preload** (no waiting).
- **Rewarded video placement** (slide 65): appear when the player has a need (out of lives, lost, want ×2 reward, revive); reward attractive but not economy-breaking; state the reward before watching; never forced; cap/cooldown to protect value and eCPM. Classic placements: ×2 end-of-level reward, revive/continue, extra moves or energy, bonus chest, daily gift.
- **Interstitial** (slide 66): only at natural breaks (between levels, results), never mid-gameplay; cooldown + minimum levels between ads; not at launch or while loading; avoid mis-tap overlays; grace period for new players and for payers. Case study cited: Block Blast (interstitial at natural breaks, RV first, moderate frequency).
- **Ad capping** (slide 67): ad load is the main dial. Higher impressions/DAU raise ad ARPDAU but lower retention; LTV vs ad load **has a peak** (example: low cap $0.05 ARPDAU / D7 25%; medium $0.12 / 23% highest LTV; high $0.18 / 16%). Caps: cooldown, per session, per day, minimum levels between ads. RV is voluntary and **doesn't count** toward the interstitial cap. Caps are hypotheses: pick one, watch D7 retention and revenue per session together, move gradually.
- **Remove-ads and payers** (slide 68): sell remove-ads (often the first IAP casual players buy), auto-disable interstitials for anyone who bought within N days, or bundle no-ads into Battle Pass/VIP. **Turn off interstitial for payers but keep rewarded video.** Price against the ad LTV of a non-payer but add the retention and later-IAP uplift; read the buyer group's total ARPDAU to catch cannibalization.

Ethics for ads: [[concept-dark-game-design-patterns]] (misleading close buttons, mis-taps).
