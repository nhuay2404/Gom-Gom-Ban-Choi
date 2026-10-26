---
type: book-topic
source: quests-howard
fit_g1: medium
tags: [book, quests-howard]
---
# Scripting quests: stages, state variables, triggers, counters

Source: [[quests-howard-src]], Ch. 5 pp. 117-138; Ch. 3 pp. 72-75; Appendix A pp. 151-160. Toolset-specific steps (Aurora/NWN2 menus, hakpaks, Gmax) are skipped; the transferable *logic* is listed.

## Quest as condition-result chains
- Scripting = event-based logic: **conditions** (if-then) plus **results** that set variables and new conditions in response to player action. It is the glue turning spaces, NPCs, objects and challenges into one goal-oriented activity (pp. 117-118).
- Dawson's pattern ("Anatomy of a Quest"): trigger a stage and change settings to reflect the new status; go into **hiatus** waiting for the player to trigger the next action; when triggered do the actions, then trigger the next stage (p. 121).
- Track quest progress with an **integer stage variable per quest** (e.g. 100 accepted, 200 completed). Space values widely (**by 5 or 10, not 1**) so intermediate steps can be inserted later; update the journal each time the stage changes (p. 122). NWN2 uses journal entry numbers in increments of 10 or 20 (p. 155).
- Check state at hand-in by inventory possession (fetch) or by stage value; reward on the completion node (experience, gold, items) (pp. 74-75).

## Kill and fetch bookkeeping
- Better to script a hook on the *enemy's death* (OnDeath: update journal, set variable, shift alignment/faction) than make the player bring back a trophy as proof (pp. 123-124).
- Update the journal as soon as the item is acquired, not only on return to the NPC: gives **immediate feedback per sub-goal**, which matters most when many quests are pending and the player forgets what they were looking for (p. 124).
- **Counters** for "do N things" quests (activate seven altars): increment one counter variable; use a counter rather than per-object stages so they can be done in any order; journal text "x out of 7", spawn a consequence per step, mark each item as done (glow) and refuse repeats (App. A, pp. 157-159). A switch-case on the count picks the right journal entry.

## Other scripted devices
- Triggers on areas (enter to heal, journal update); portals created by rune plate + waypoint + ready flag (pp. 125-128).
- **Alignment and faction** adjustments after kill/accept/refuse choices, which can gate later quests, so that moral choices have consequences (pp. 129-131).
- Virtue variables initialised at module load and altered by actions (pp. 131-132).
- **Puzzles**: poorly designed levers/sliders are rightly disliked; best puzzles need an "insight" leap (Danesi) and may encode meaning. Koster: want puzzles with more than one right answer (p. 133). Example puzzle: five rune plates activated while holding the matching item, then a lever (pp. 134-136).
- Branching dialogue-only scripting becomes "browsing a webpage by clicking links"; use rule-based events in gameplay (pp. 120-121).
- Alternate outcomes (take or refuse the girdle) are scripted as variables, not branching paths (p. 138).

## Stance and applicability
(a) Authoring in an RPG construction set (event handlers on NPCs, items, triggers, with a journal). (b) Engineering how-to from tutorials and the author's own module; not research. (c) The stage/counter logic is generic and agrees with the data-driven quest tracking in [[concept-spreadsheet-modeling]]; implementation-wise it is "just quest state". No source in the wiki covers quest-state design, so there is nothing to contradict, but the *immediate sub-goal feedback* advice complements the reward-timing points in [[concept-reward-design-and-psychology]]. (d) Fit for casual match-3 + deco: **medium**. Directly usable (design level, not code): (i) counter-style goals ("match 50 red", "place 3 items") shown as x / N with a per-event progress tick during play, not only at claim; (ii) spacing quest stage ids (10, 20, 30) so a milestone chain can be extended or reordered without migrating saves; (iii) completion detected by game events, never by the player proving it; (iv) order-independent counters rather than forced sequences for Daily. Quest chains for milestones: stage ladder with a single current stage per chain. Everything on alignment, portals and puzzles is irrelevant.
