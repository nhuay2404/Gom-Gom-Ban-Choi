---
type: book-topic
source: quests-howard
fit_g1: medium-high
tags: [book, quests-howard]
---
# Quest systems: main vs side quests, quest menu and journal text

Source: [[quests-howard-src]], Ch. 5, pp. 104-117 (esp. 105-112).

## Quest system = network of quests
- RPGs go from a single quest to a **quest system**: a **main quest** that must be done to progress, plus **side quests** done optionally, in any order, for rewards (p. 105). Main quest gives purposeful structure to a welter of activities; side quests keep play from becoming a static linear story (p. 108).
- *Oblivion* groups tasks into **quest lines** (guild lines: Mages, Fighters, Arena, Dark Brotherhood, Daedric); each line escalates: early quests trivial, later ones reveal a larger plot (pp. 24-25, 108).
- *Oblivion* main quest follows the hero's journey (called to adventure, mentor, road of trials in dungeons, ordeal, return with boon, resurrection) (pp. 106-107).
- Main-quest urgency escalates, and enemy power scales with player level, so delaying the main quest raises difficulty (pp. 109-110).

## The quest menu (pp. 108-110)
- Lives inside the **map screen**: quest state is linked to space.
- Three lists: **active** (the one chosen to focus on), **current** (accepted), **completed**, represented by chalice icons (Holy Grail allusion).
- Player can accept or refuse offers, often returning later to accept; many quests pend at once, so the player picks one *active* quest, which puts a **target arrow** on the local and world map (red/green by urgency) (pp. 109-111). Focus selection manages multitasking and confusion.
- Unexplored map space plus a distant target arrow creates the productive "gap of the unknown" (p. 111).

## Journal-text grammar (p. 110)
Each quest has about four or five entries, written in the **first person**, **past perfect plus imperative**: "X has happened; I should go to Y and do Z" (e.g. "I've arrived at Weynon Priory. Now I must take the Amulet of Kings to Jauffre."). Even completed quests tend to end pointing to the next task, because one quest's completion should give rise to others to keep the game moving. Reads like a diary of an ambitious person with short- and long-term goals.

## Interlacing (pp. 112-113)
Medieval romances interlace strands; knights abandon one quest for another. *Oblivion* "quest bumps" only update the journal with a suggested plan; they do not force completion, so players shuttle between threads like tapestry threads. Treat strands as ordered by the player, not the designer.

## Stance and applicability
(a) Single-player RPG on PC/console with a world map and journal. (b) Design analysis of one flagship game plus designer/modder commentary; no player testing data. (c) Aligns with the "show the next step clearly" practices in [[cozydive-bycer-ui-ux-and-approachability]] and is compatible with the mission example in [[concept-spreadsheet-modeling]] (pool, fixed counters). Conflicts with the permissive many-parallel-quests model if applied to Daily tasks: our design is five easy tasks (no active-quest picking), so the active/current split is unnecessary. Also qualifies [[concept-pacing-and-content-control]]: Howard scales quest difficulty by level, whereas we have no level gate on Daily and Quests by choice. (d) Fit for casual match-3 + deco: **medium-high** for the *presentation principles* only. Usable now: a single quest list with three states (active, claimable, done); each entry always states what is done and the next concrete action; completing a milestone surfaces the next one (chain) instead of a dead end; optional/order-free milestones rather than a forced line; keep a clear one-line goal text per quest. Do not import the multi-active/priority mechanism or level-scaled difficulty.
