# Live operations, inflation and content planning

Source: [[src-czerkawski-game-economy-design]], ch. 5 (pp. 118–132).

- **Games as a Service**: after launch the game keeps evolving; live ops = all post-launch work. Designers plan ~6 months ahead but really for years. Pre-launch work must set up efficient live work. No magic formula: ship, watch players, pivot.
- **Obsolescence**: digital goods don't wear out, so build it in (rarity tiers, new content outranking old) or players have nothing to replace. See [[concept-pacing-and-content-control]] for cycling and treadmills.
- **Soft-currency inflation**: the repeated core activity is "a license to print money"; mitigate, don't expect to solve.
  - Add **infinite sinks**: reusable consumables (permanent cosmetics are one-shot sinks); taxes, entry fees where genre-appropriate.
  - Use **separate currencies per mode/feature** (guild currency); let the main currency inflate and move players to new modes/currencies. F2P mobile tolerates multiple currencies.
  - **PAYDAY 3 case**: cash inflates inherently (heists). Fix: late-game secondary currency **C-Stacks**, bought with cash at a rate that rises with each purchase and resets weekly — cheap if you wait, expensive if you buy repeatedly, so it works as a large cash sink without feeling mandatory.
  - **Fusion systems**: consume surplus items (+ soft-currency fee) to boost another item: sink for goods and currency at once, plus player choice.
- **Content planning**: master spreadsheet of items: internal name (stable, not tied to appearance, e.g. `cosmetic_sticker1`), player-facing name (narrative/localization owns it), type, rarity, USD price, HC price, description; plus planned / approved / art delivered / in game columns. Client-side content needs an app update scheduled in advance; properties like prices change instantly via backend. You act as product owner working with production.
- **Which features to add**: new content for Battle Pass/store/DLC; new modes and social features chosen via **Bartle taxonomy** — Achievers (goals, completion → end-game bosses), Explorers (systems, discovery), Socializers (guilds), Killers (dominance → PvP, arcade quick rounds).

Metrics that drive these decisions: [[concept-analytics-and-kpis]].
