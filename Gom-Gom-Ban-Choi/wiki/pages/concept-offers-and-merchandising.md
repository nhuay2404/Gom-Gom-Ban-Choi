---
type: concept
source: src-gd-fresher-f2p-monetization-training
tags: [concept]
---
# Offers, bundles and merchandising

Source: [[src-gd-fresher-f2p-monetization-training]], stage 3 (slides 22–43). Turbine Games' Merchandising Playbook (Emery) parts 1–2 are the deck's source for UI.

## Offer vs base pack (slide 23)
Base product: always in store, static. **Special offer**: prominent, time-limited, hero image, value combo, creates FOMO. Goal: right item, right player, right moment, fair value and price. Placements: in-store list (next to base packs, easy to compare) and **modal popup** (≈2/3 of screen, takeover for one product).

## Design frame (slide 24)
**Need** (what pain: stuck, out of lives, lost a boss) · **Timing** (peak need: after losing, near empty, level milestone) · **Value** (visible deal: bonus %, versus buying separately) · **Price** (fits that segment). A weak offer is off on one axis.

## Bundle anatomy (slide 26)
Retail $25 (1000 gems $10 + legendary skin $10 + 20 revive tickets $5) sold at $9.99 → save $15 = 60% OFF = +150% VALUE.
1. Price on the **total** (players compare one number, not line items).
2. A **star item** (skin/hero/rare) anchors the value; the rest ride along.
3. The deal must be **real**: stuffing useless items to inflate retail value makes a hollow % and players stop opening popups.
Bonus: bundles are the way to sell hard-to-sell items (secondary currency, consumables) by attaching a star.

## % OFF vs % VALUE (slide 28)
% OFF = (retail − sale) / retail (needs a credible retail price; good for listed items/skins and FOMO). % VALUE = (retail − sale) / sale (no struck-through price needed; good for pure currency; always looks bigger: 60% OFF = +150%). **A fabricated retail price is a dark pattern**, breaks store policy and consumer law in many markets; check with legal before big discount campaigns (see [[concept-dark-game-design-patterns]], [[concept-hybrid-models-and-ethics]]).

## Pricing cognition (slide 32–33)
Anchoring, decoy, and loss aversion (limited time/one-time) are small nudges; real value is the foundation. Compare Czerkawski's version in [[concept-store-and-pricing]].

## Offer UI checklist (slides 34–39)
Must (5): large enough (modal ≥ 2/3 screen; store medium banner or bigger), aspirational **hero image**, crisp retina art, clean layout (little text, margins), **visual hierarchy**. Bonus (2): value statement as a benefit, animation (sparkle/glow). Hierarchy has max **3 tiers**: Tier 1 header (hero, product name, buy button), Tier 2 body (value statement, icons and amounts), Tier 3 fine print (terms, close X). The eye goes to big, bold, high-contrast or moving elements; a big contrasty X "dares" the player to close; everything shouting at once makes players close it.

## Running offers at scale (slides 40–43)
An offer engine: offer library + **trigger** rules (event / schedule / segment) + priority + cadence + caps. Anti-spam: popup cap per day, cooldown, no stacking. Measure view → click → buy, revenue per offer, and impact on retention/LTV (a best-selling offer that makes players quit is a bad offer).
Client-only architecture in the deck, four layers: **EligibilityRule** (who, what event) → **DisplayRule** (when, how long, how often resurfaces) → **OfferGroup + PromotionPack** (what, how much, format, group behaviour; packs can be standalone) → **PackItem** (weapon, skin, gold, cash, gacha…). Aim: add or edit one offer without affecting others (ER-diagram tables T1–T5, global SystemConfig for popup caps and rotation).

See also [[concept-price-discrimination]], [[concept-iap-packs-and-starter-pack]], [[concept-ab-testing-monetization]].
