---
type: book-topic
source: uxui-brewer
fit_g1: medium
tags: [book, uxui-brewer]
---
# UI representation (diegesis), attention, HUD and interface types

Source: [[uxui-brewer-src]], Ch. 6 (pp. 77-95), Ch. 4 (attentional spotlight pp. 35-36).

## Representation (pp. 80-83)
- Two axes: is it part of the story (diegesis)? does it sit in scene space (spatiality)? Four types:
  - Non-diegetic: abstract overlay for the player; easiest and cheapest, most common; risk is overuse and fatigue; style can match, contrast or go minimal; skeuomorphic fantasy panels possible.
  - Meta: in the fiction but not in 3D space (blood on screen, scope view); can be subtle or intrusive.
  - Spatial: UI placed in the 3D scene unknown to characters (Rocket League ball arrow and landing ring, grenade arcs, Splinter Cell wall typography); precise, needs art-direction effort.
  - Diegetic: part of the world and known to characters (Dead Space spine health, Pip-Boy, ammo LED on a weapon); reduces screen clutter, can be a USP, but needs many teams, breaks when lighting/environment changes, costs performance and production (p. 82-83).
- Choose by art direction and by cost; plan early or default to non-diegetic overlay (p. 91).

## Attention (pp. 83-85, 35-36)
- Players cannot absorb everything; spotlight follows what grabs them. Endogenous attention (player seeks info, e.g. opens quest log: keep wording and icons consistent between map and HUD) vs exogenous (unexpected events: peripheral is ignorable, centre is intrusive).
- Useful field of view varies by game and shrinks with age and low vision; do not split related info to opposite screen sides (p. 84).
- Inattentional blindness: designers "fix it in UI" by adding more UI when the real issue is competing attention; if a mechanic is unnoticed, reduce competition (p. 85).
- UI channels: visual first, audio for confirmation/error/space, haptics (with an off switch) (p. 85).

## Interface types (pp. 85-89)
Start screen (tone, first second), front-end menus (foreshadow, keep depth 2-3 levels), settings (sliders, toggles, steppers; accessibility), HUD (transparent, genre-specific, dynamic reveals, conservative by default; RTS/MMO/city builders legitimately need density), in-game overlays (focus on the overlay function; pause/slow time).

## Reusable takeaways
- Diegesis table for G1: furniture cards and cat-need bubbles as spatial/diegetic in the 3D room; currency bar and nav as non-diegetic HUD; "screen shake/blood" equivalents as meta (e.g. confetti on clear).
- Cost warning matters: the project's Deco scene already pays 3D costs, so keep shop/offers non-diegetic and cheap.

## Stance and applicability
- (a) AAA console/PC action games; HUD means health/ammo/minimap; platform notes only mention mobile fingers and screen size.
- (b) Practitioner synthesis of the standard diegesis literature; no testing evidence.
- (c) Same 4-way table as [[mobiledesign-scolastici-ui-design-and-diegesis]] (which gives mobile-specific rules); Brewer adds the explicit cost/fragility warning. [[cozydive-bycer-ui-ux-and-approachability]] favours low-density friendly UI, matching "conservative HUD"; but the dense-HUD allowance for management games sits closer to [[concept-core-loop-and-metagame]] hubs with many currencies than to a minimal HUD, so density is a genre call.
- (d) Fit: medium. Useful vocabulary and the attention/"don't fix it in UI" insight; direct HUD guidance is built for action games and has little to say about a three-currency mobile HUD.
