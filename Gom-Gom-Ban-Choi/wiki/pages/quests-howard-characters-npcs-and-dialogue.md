---
type: book-topic
source: quests-howard
fit_g1: low
tags: [book, quests-howard]
---
# Characters: quest-givers, Propp functions, encounters and dialogue

Source: [[quests-howard-src]], Ch. 3, pp. 67-75.

## NPCs defined by function
- Propp's dramatis personae are more useful than Campbell/Vogler archetypes because they are defined by actions that can be coded: villain, donor, helper, princess and her father, **dispatcher** (= quest-giver), hero, false hero (pp. 68-69). *Fable* shows the failure of generic archetypes (p. 67).
- **Quest-giver**: offers tasks, sometimes gives directions (map target, which NPC to talk to), gives the reward on completion, then may propose a follow-up quest or next part (p. 69).
- **Donor/helper**: give items/information that must provide a strategic advantage (combat, commerce, navigation) (p. 69).
- **Villains**: many minor villains plus one central antagonist, because the core mechanic needs repetition. Villain behaviors to script: attack, steal items, set traps, cast spells, block access (p. 69).
- When adapting narrative, characters who barely act in the text (Clinschor) may need to appear on stage to create gameplay (p. 71).

## Encounters and dialogue
- **Encounter** = any PC-NPC exchange: talk, fight, persuade, give, receive (p. 69).
- Quests are dialogue- and journal-driven in basic structure; tools' "simple quest" tutorials are really dialogue-editor and journal-editor tutorials (p. 70).
- Garriott's *Ultima IV* conversation was one-word commands (name, job, health) yet produced a rich quest network via gossip pointing the player to items and other NPCs (pp. 69-70).
- **Erickson's guidelines** (GDC 2007): keep players in the moment; pace dialogue (about two sentences per NPC turn, shorter PC replies); reinforce the player's personal fiction; make choices matter. For quests: players should be able to accept or refuse for *different reasons*, not just yes/no (or worse, yes/yes) (pp. 70-71).
- Plan which information each NPC holds about locations, items and events; one quest per NPC is rare, so write conversations for each possible quest plus gossip that doubles as clues (p. 71).
- Dialogue-node "fall-through": the engine checks nodes from the top until one's conditions return true; a basic fetch quest needs three nodes in order: thanks (completion), will-you-go (offer), hello-I-need-help (intro) (pp. 72-73).
- Fetch dialogue is often parodied because of cliche, but the template can be varied like a sonnet form: vary accept/refuse options and phrasing to the NPC's circumstances (p. 73).

## Stance and applicability
(a) Story RPG with talking NPCs; assumes a conversation UI. (b) Design craft plus a designer's (Erickson) GDC talk; qualitative. (c) No wiki source discusses NPC dialogue or quest-givers, so there is nothing to contradict. The "accept or refuse for different reasons" idea runs against the frictionless one-tap claim flow we want for Daily tasks and with [[cozydive-bycer-low-stakes-design]] (no friction, no required reading). (d) Fit for casual match-3 + deco: **low**. Quest-giver as a cat (a "dispatcher" character who asks for something and thanks the player) is a cheap flavour layer for milestone Quests; the three-node thanks/offer/intro structure maps to our three UI states (claimable / in progress / not yet given). Dialogue craft itself is irrelevant to Daily tasks.
