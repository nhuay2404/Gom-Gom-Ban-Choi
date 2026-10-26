---
type: book-topic
source: gamefeel-swink
fit_g1: medium
tags: [book, gamefeel-swink]
---
# Camera as feel: placement, movement, dead zones and comfort

Source: [[gamefeel-swink-src]], Ch. 1 (pp. 25-26), Ch. 8 (pp. 143-145), Ch. 9 cinematic (p. 161), Ch. 13 (p. 219), Ch. 14 (pp. 237-239), Ch. 15 (pp. 265-268).

## Claims
- The camera is the player's eyes ("organ of perception"); defining its position and movement is the **third foundation** of a feel prototype, with input mapping and object layout. Without all three feel is not reliably testable (pp. 25-26).
- Rules of thumb: move the camera no more than necessary, move it smoothly, and give players control when programmed behaviour fails; otherwise it interferes between intent and result and can cause **nausea** (visual flow disagrees with the inner ear), as sudden frame-rate drops feel like stuttering vision (p. 26).
- Camera is also an indirectly controlled avatar (Mario Bros: only moves right, slow zone in the left quarter; Bionic Commando: dead zones; Mario 64: "Lakitu" with follow/stationary zones, pull-back, ahead-of-Mario interpolation, C-button nudge of 20 degrees that drifts back, "vertical shake cushion" to avoid pitch-induced sickness (pp. 219, 237-239, 265-268).
- Dead zones: no tracking inside the central region (about a third of the screen horizontally, narrow vertically); a larger zone while swinging prevents nausea and makes an anchor feel anchored (pp. 237-239).
- Camera sets the impression of speed and size: wider FOV exaggerates speed; looking up at colossi exaggerates height; slow-motion zoom and shake sell impact (pp. 143-145, 161, 292).
- Level design must serve the camera: landmark towers viewed from inside, round self-contained worlds, avoid tight caves (use fixed "security cam" views) (pp. 249, 271). One-screen rooms kill a swinging mechanic; no scrolling in Wik and the Fable of Souls constrained it (pp. 237, 240).
- Camera-relative control is natural but breaks directly under the camera (running in circles) (p. 248).

## Stance and applicability
- (a) Third-person avatar games with a chasing camera.
- (b) Observational; the nausea claim cites Nintendo's Koizumi talk, not data.
- (c) Supports the project's deco camera rules in CLAUDE.md (camera auto-glide must not change zones; wide framing; shake/pan comfort) and [[gamefeel-swink-context-space-speed-collision]] on perspective. No conflict with other wiki sources, which do not cover camera.
- (d) Fit for a mobile casual match-3 + deco game: **medium**. The deco room uses a user-orbited and auto-gliding 3D camera; use: smooth eased moves, damp small motions (dead zone), never move the camera while a drag is active, and keep any screen shake gentle and brief. The match board has a fixed camera, so most points do not apply there.
