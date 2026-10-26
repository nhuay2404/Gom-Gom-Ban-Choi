# 7-Day Login Event UI

## Design

The login calendar uses a portrait event-board layout inspired by the supplied reference: a bold event title, a wide Gom Gom mascot panel, six compact reward cards in a 3-by-2 grid, and a featured full-width Day 7 reward. It uses the game's original panel, card and Claim button artwork, plus the meadow backdrop and cream, cocoa, honey-gold and leaf-green palette. This keeps the layout reference while using the game's own surface treatment. The full panel fits common 320–390px phone widths and scrolls on shorter screens.

Day 3 stands out with a rose frame, the actual Heart cushion image, and +15 gems. Day 7 has a gold feature frame and the Mystery cat icon. Current, collected, next-day and locked states remain visible in the cards.

## Actual rewards

Rewards are read from LOGIN_CALENDAR, with no economy changes: +3 moves booster; 800 coins; Heart cushion +15 gems; Hammer; 3,000 coins; New card; Mystery cat. The calendar is not a consecutive-day streak: missed days never reset it.

## Files

- `game/menu/login-view.mjs`: shared event shell, reward cards and mystery-cat markup.
- `game/menu/login.js`: existing reward controller; actual booster, coin, item, gem and pending-cat grant paths are preserved.
- `game/ui/home/login-gift.css`: portrait board styling and compact-screen rules.
- `game/assets/img/login-gift/`: 11 reused mascot, reward, close and event-banner assets. The interface also uses five original Quest panel/card/button skins and the meadow background from `game/assets/img/quests/` and `game/assets/img/play/`.
- `game/login-gift-kit.html`: interactive preview for Day 1, Day 3, waiting, Day 7 and completion. Preview claims never change game saves.
- `output/login-gift-kit/`: overview, mobile state previews and an isolated screenshot of the actual game dialog.

## Rebuild and verification

Run `node tools/export/build-login-gift-kit.mjs`, then `node tools/export/render-login-gift-kit.cjs`. Rendering requires sharp, Playwright, Edge and the game server at port 4400; Codex's bundled dependencies can be provided through NODE_PATH.

Verification covers 10 state and viewport combinations at 320/390px, all seven actual controller grant branches with isolated storage and wallet boundaries, same-day claim lock, keyboard focus, Escape and Close. The pending mystery cat is checked as a pending reward, not substituted for an existing cat.

The ZIP package contains a portable preview. Serve its root with a local HTTP server and open `login-gift-kit.html`. Supporting data and core files preserve the actual reward configuration used for this export.
