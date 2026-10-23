---
type: concept
source: src-zagal-dark-patterns-in-game-design
tags: [concept]
---
# Dark game design patterns

Source: [[src-zagal-dark-patterns-in-game-design]] (FDG 2013). Patterns are grouped by what the player is deceived into spending: **time, money, social capital**. Each group has guiding questions.

## Definition (final)
A pattern used intentionally by a game creator to cause negative experiences for players which are against their best interests and likely to happen without their consent. Tricks that serve the player (fake crash scare, rubber-band AI) are not dark.

## Temporal (takes more time than players expected)
Questions: can the player sense the time commitment? does expectation differ greatly from reality? will they feel they wasted time?
- **Grinding**: repetitive tasks to extend duration; emphasises time over skill; also hurts skill-based play when levelling gives power (CoD 4 perks).
- **Playing by appointment**: the game dictates when you must play (FarmVille crops wither within ~24 h). The darkness disappears when appointments aren't required for progression (Pokémon night-only monsters, Animal Crossing's Gracie, WoW rare spawns are optional).

## Monetary (spend more than expected)
Questions: will the player regret spending? lose track of the total? know what they get? spend by accident? know how much they must spend to reach their goal?
- **Pay to skip**: monetise the solution to a challenge (Angry Birds' Mighty Eagle; FarmVille help; Battlefield 3 shortcut items). Aggressive form: the player's effective play is steadily reduced until payment is needed (SimCity Social energy outgrown by the city). Often paired with grinding.
- **Pre-delivered content**: content already on disc/in the install but locked behind a fee (Street Fighter X Tekken, 12 characters for $20): feels like nickel-and-diming.
- **Monetized rivalries**: pay to win / to keep rank; leaderboards that show friends who paid (Candy Crush, Robot Unicorn Attack Evolution), "pay to cheat" boosts in an otherwise skill game (Words With Friends Tile Pile, Word-O-Meter), constant payment to stay competitive.

## Social capital (risks standing or relationships)
Questions: could standing diminish? does the player feel obliged to play?
- **Social pyramid schemes**: progress effectively requires recruiting friends (FarmVille needs ~8 neighbours without paying); recruits then play only from obligation.
- **Impersonation**: the game speaks as the player or friends ("Betty sent you a gift" when she didn't), friend spam via harvested credentials, broadcasting actions unknowingly.

## Shades of grey (borderline)
- **Psychological tricks** (Madigan's SimCity Social list): artificial scarcity ("One Time Offer! You will NEVER see this again") and other exploitation of cognitive biases. Open question: when does applying psychology become manipulation? Compare the pricing biases in [[concept-store-and-pricing]] and the loss-aversion / endowment techniques in [[concept-reward-design-and-psychology]].
- Anti-social behaviour inside games (Diplomacy, Poker, traitor games): fine when the effects stay inside the game and everyone consents.
- Games with a purpose / serious games: tricking players into learning or unpaid work without telling them is dark; disclosure fixes it.

## Judging how dark a pattern is
Context (does it block progression?), implementation and audience, whether it supports the player's play style, whether most players must engage with it, and the player's manipulation literacy (known patterns are less dark; consent needs understanding).

## Checking our own features (my application, not the paper's)
- Energy/lives ([[concept-pacing-and-content-control]], [[concept-monetization-strategies]]): is pay-to-refill honest about what it costs and does the game still have a free path? Paper warns about rising demand until payment is the only way (pay to skip).
- Daily/weekly missions and streaks ([[concept-spreadsheet-modeling]] example): do they punish missing a day (appointment pattern)?
- Rewarded ads, one-time offers, countdown discounts: is the scarcity real, and is price/return clear? Cross-check with [[concept-store-and-pricing]].
