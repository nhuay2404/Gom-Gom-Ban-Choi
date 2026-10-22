# Pure IAP, pure ads and hybrid; ethics and law

Source: [[src-gd-fresher-f2p-monetization-training]], stage 7 (slides 69–76).

## Three revenue models: a spectrum, not boxes (slide 70)
Measure by your own IAP vs IAA revenue share, not by genre label. Genre only *suggests* the model: Royal Match and Candy Crush are both match-3; Royal Match runs no ads, Candy Crush uses rewarded video for extra lives.
| Model | Genres | Numbers (cited with source) | Why it fits |
|---|---|---|---|
| **Pure IAP** | RPG/gacha, 4X, MMORPG, CCG (Marvel Snap), casino, premium puzzle (Royal Match) | midcore ≈ 90% revenue from IAP, casino ≈ 83% (AppsFlyer 2025–26); RV still ≈ 51.8% of midcore ad revenue (TopOn) | very high ARPPU, deep progression to sell, ads break immersion and compete with IAP, high CPI needs high ARPU. Risk: few payers → retention is survival (Royal Match $1.37B in 2025, slightly below 2024) |
| **Pure ads** | hypercasual, .io, runners | ARPDAU $0.03–0.08 hypercasual, $0.01–0.05 casual ads-only | short loops, nothing to sell, very low CPI, needs huge scale; eCPM falling and low in SEA so it rarely closes CPI there; industry drifting to hybrid-casual |
| **Hybrid** | casual puzzle, merge, idle, sim, hybrid-casual | hybrid-casual ≈ 40–50% IAP, ARPDAU $0.15–0.50; three-stream games ≈ 35% IAP / 56% ads / 7% subscription (AppsFlyer 2026) | enough progression for IAP but low payer rate; RV doubles as retention tool; casual Tier-1 CPI too high for one stream (Android casual ROAS D30 ≈ 15%, Liftoff) |
Benchmark lesson: TopOn says >72% of developers use IAP+ads, AppsFlyer says <30% of games. Both are right for their sample (TopOn only sees games with an ad SDK). Always ask "who measured, on what sample?"

## Hybrid logic and cannibalization (slide 74)
Whale/dolphin → IAP, non-payers/minnows → IAA, maximising LTV over the whole base (price discrimination by effort: [[concept-price-discrimination]]). Risk: players watch ads instead of buying. Mitigations: RV gives something **different** from what IAP sells; hide interstitials for payers and remove-ads buyers; compare ad ARPDAU vs IAP ARPDAU per segment; use RV as a value touchpoint, then invite IAP. Details: [[concept-iaa-ads-design]].

## Ethics and law (slide 75)
Do: create real value (players happy, no regret), transparent prices/pack contents/gacha rates, easy subscription cancel and a clear close button, protect vulnerable players (children, runaway spending; consider spend limits).
Avoid dark patterns: hidden/tiny close buttons or mis-tap layouts, fake timers and fake scarcity, bundled or sneaky auto-renew, exploiting loss emotions to force a purchase.
Law/policy: gacha/loot-box rate disclosure (mandatory in many countries, gambling treatment in some), price/subscription transparency (Apple/Google + consumer law), children's ads/data rules (e.g. COPPA), EU personalised-pricing disclosure ([[concept-price-discrimination]]), fabricated reference prices ([[concept-offers-and-merchandising]]). Check with legal/ops before big promotions.
Bottom line: real value beats tricks; retention and brand last. See [[concept-dark-game-design-patterns]] for the academic framing.
