# 7-Day Login Event UI

## Design

The login calendar is a portrait, one-day-at-a-time HUD. The selected reward image fills a large hero panel; the title, note, page controls and claim actions stay on the familiar cream HUD. The Claim and Later plates use the flat game-matched SVG button assets. No title gradients or ribbons are used.

Every selected reward fills the hero panel without cropping away the item. Day 5 uses a generous mound of paw coins; Day 7 uses a gray crowned cat based on the supplied reference. Day 3 reuses the exact Heart cushion image captured from the in-game model and places the game's gem icon beside it. Booster days carry a prominent “Premium Booster” label, and Day 3's Exclusive badge has a high-contrast solid rose treatment. Current, collected, next-day and locked states remain visible.

## Actual rewards

Rewards are read from LOGIN_CALENDAR, with no economy changes: +3 moves booster; 800 coins; Heart cushion +15 gems; Hammer; 3,000 coins; New card; Mystery cat. The calendar is not a consecutive-day streak: missed days never reset it.

## Files

- `game/menu/login-view.mjs`: shared event shell and reward card markup.
- `game/menu/login.js`: existing reward controller; actual booster, coin, item, gem and pending-cat grant paths are preserved.
- `game/ui/home/login-gift.css`: portrait board styling and compact-screen rules.
- `game/assets/img/login-gift/`: source/HUD assets, six full-bleed generated reward images, the exact in-game Heart cushion render and three flat SVG buttons, all listed in `manifest.json`.
- `game/login-gift-kit.html`: interactive preview for Day 1, Day 3, waiting, Day 7 and completion. Preview claims never change game saves.
- `output/login-gift-kit/`: overview and mobile state previews, including the live controller's HUD styling.

## Rebuild and verification

Run `node tools/export/build-login-gift-kit.mjs`, then `node tools/export/render-login-gift-kit.cjs`. Rendering requires sharp, Playwright, Edge and the game server at port 4400; Codex's bundled dependencies can be provided through NODE_PATH.

Verification covers 10 state and viewport combinations at 320/390px, all seven actual controller grant branches with isolated storage and wallet boundaries, same-day claim lock, keyboard focus, Escape and Close. The pending mystery cat is checked as a pending reward, not substituted for an existing cat.

The ZIP package contains a portable preview. Serve its root with a local HTTP server and open `login-gift-kit.html`. Supporting data and core files preserve the actual reward configuration used for this export.
