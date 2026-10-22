# In-game store, bundles and pricing

Source: [[src-czerkawski-game-economy-design]], ch. 4 (pp. 108–117), ch. 7 (pp. 166–168).

## Store design (pp. 108–112)
- Easy to navigate, best deals promoted, kept fresh; clutter/too much choice hurts spend.
- **Bundles**: several items at a % discount; each player sees value in a different item (SMG fans vs shotgun fans), so you sell more to more players. Themed/seasonal/licensed bundles are sold only as bundles. **Starter pack / conversion bundle**: appealing first purchase (premium-looking cosmetics + hard currency), can be refreshed each season.
- **Discounts**: backend-controlled for any item: start time, end time, % off; UI shows struck-through price, % badge, countdown. Timing sweet spot: too early and players wait for the sale; too late leaves money on the table. After ~1 year tag items as rotate-out candidates into an "old content" pool for later promotions.
- **Featured page**: landing page for new/licensed content and weekly offers (also DLC ads).
- **Context-sensitive purchase popup**: when a player tries to buy with hard currency they lack, show the smallest pack covering the shortfall.

## Pricing (pp. 112–117)
- Model all resource values in USD and link them to time-to-progress. Performance/preference: price by time saved / performance gained. Personalization: competitor analysis, surveys, post-launch sales data.
- **Hard-currency SKUs**: usually 5 (sometimes 6) packs, $1 = 100 units, bonus % grows with price. Book's example: $4.99/500 (0%), $9.99/1200 (20%), $19.99/2500 (25%), $49.99/7000 (40%), $99.99/15,000 (50%). Minimum SKU: lower for cheap-purchase performance games; raise it if players convert at the minimum regardless. Don't force a bigger pack just to buy a cheaper cosmetic; price a big bundle at exactly 2500 HC so it equals the $19.99 pack (a straight $20 purchase, transparent). Estimate the **monetization cap** (max possible spend).
- **Price anchoring**: put a $10k watch next to a $2k one; set a high anchor with the top legendary.
- **Decoy effect** (target is the large option made to look good by a poor middle option) and **compromise effect** (target is the middle option of basic/standard/premium).
- **Weber's law**: just-noticeable difference ∝ original size (ΔI/I = k); price increases during live ops should scale, so small raises on big prices go unnoticed.

## The Finals store (case study)
Store = a featured subset of the inventory; items in a bundle can only be bought as the bundle (avoids cannibalising); a standalone item is a bundle of one (same UI); seasonal starter bundle; 5-SKU table ($4.99/500 … $99.99/13,000, extras 0–30%). See [[case-marvel-snap-and-the-finals]].

Strategy context: [[concept-monetization-strategies]].

More pricing/offer material: [[concept-iap-packs-and-starter-pack]], [[concept-offers-and-merchandising]], [[concept-price-discrimination]].
