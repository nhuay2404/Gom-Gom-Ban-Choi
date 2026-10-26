# Pet coins / rewarded-video HUD

Replaces the generic “Pets collected coins!” prompt with the warm cream, cocoa outline, honey-gold bevels and orange game cat used in the Quest UI kit.

The primary honey-gold button uses a contrasting blue painted clapperboard + Play icon, dark cocoa “Watch video” text, the total payout and a coral percentage badge. The secondary glossy leaf-green button claims the base amount. Amounts and the badge come from the pending coins and REWARDED_ADS.idleBonus; for 125 coins at +50%, the displayed payout is 188, using the existing rounding rule.

Revision 2 fixes stretched button artwork: runtime button backgrounds, borders, highlights and corner radii are drawn with CSS, so increasing width cannot turn the ends into flattened ellipses. Exported button SVG/PNG assets have matching gold/green skins and 9-slice insets in manifest.json (top/right/bottom/left source pixels) for engine import. Use 9-slicing when resizing these exported images.

The close button and Escape dismiss without collecting. Completing the rewarded ad grants the bonus; skipping grants the base amount, preserving the current game behavior. If rewarded video is unavailable, the original controller claims the base amount directly. The ad player remains the existing simulated SDK integration in app/ads.js.

## Deliverables

Revision 4 replaces the flat title ribbon with a painted PNG matching the existing glossy game icons: rounded honey-gold body, folded tails, cocoa/amber occlusion and ivory highlights. The saved source and exact imagegen prompt are in `painted/banner.png` and `painted/banner-prompt.json`. The header preserves the 3:1 canvas aspect ratio with `background-size:contain`; the title remains live text and uses smaller sizes to leave space inside the painted face. The old vector ribbon is archived under `output/idle-reward-kit/legacy-vector/` and excluded from the current package.

- `game/menu/idle-reward-view.mjs`: presentation options consumed by the actual idle-coins controller and preview.
- `game/ui/shared/idle-reward.css`: scoped styles, responsive at 320px, reduced-motion and visible keyboard focus.
- `game/assets/img/idle-reward/`: 10 assets, PNG outputs with SVG sources for the buttons, close and bonus badge. The generated video icon and painted ribbon have high-resolution sources and exact prompts in `painted/`. Cat, coin, coin stack, panel and existing UI parts are reused from the game.
- `game/idle-reward-kit.html`: interactive preview for 125 / 12,345 coins and +50% / +20%. Its five-second video preview never changes the game save.
- `output/idle-reward-kit/`: overview and mobile screenshots; live-controller screenshot uses an isolated wallet.
- `output/idle-reward-hud-kit.zip`: portable preview, sources and asset package. Serve its root through a local HTTP server to open idle-reward-kit.html.

## Rebuild and verification

Run `node tools/export/build-idle-reward-kit.mjs`, then `node tools/export/render-idle-reward-kit.cjs` with the game server on port 4400. The latter needs sharp, Playwright and Edge; bundled Codex dependencies can be supplied through NODE_PATH. The saved painted source is preserved. No additional generation call is required to rebuild.

Verified PNG alpha, 320/390px layouts at short and long coin amounts, preview completion/skip/claim/close, actual idle-coins controller payouts with watched and skipped ads, normal claim, Close, Escape and ad unavailability. The live integration check uses the real core idle math with a fixed clock and an in-memory wallet; no user save is read or modified. All four core idle tests also pass.
