---
type: council
tags: [council]
---
# Council: members, genres and how much each source can be trusted for which genre

Purpose: the wiki sources often write about the same topic but disagree. A topic page can't tell you which book is right; it depends on **which genre the author was writing about**. This page defines the genres and each source's "home turf". The verdicts are in [[council-topic-verdicts]]; what that means for our game is in [[council-playbook-casual-deco]].

This is an editorial synthesis by the wiki maintainer (Claude), built from each source's own "Stance and applicability" sections. It is a judgement aid, not a claim made by any book.

## Genres used by the council
| Code | Genre | Examples named in sources |
|---|---|---|
| **G1** | Casual puzzle / merge / sim with a meta layer (our category; match-3 + deco) | Candy Crush, Royal Match, Block Blast, hybrid-casual |
| **G2** | Cozy premium sim (PC/console/Switch, sold once) | Stardew Valley, Animal Crossing, A Short Hike |
| **G3** | Hero-collector / gacha mobile | Azur Lane, Arknights, Marvel Strike Force, Marvel Snap |
| **G4** | Midcore PvP / multiplayer live service (PC/console/mobile) | WoT, Fortnite, Destiny, CoD, The Finals |
| **G5** | Hypercasual / ads-led | Voodoo-style, .io games |
| **G6** | Premium / AAA production (console/PC, publisher-funded) | Skyrim, large studios |

## Members and home turf
Trust is rated per genre: **H** high, **M** medium, **L** low (my judgement, based on what each author actually wrote about).
| Source | Home turf | Evidence style | G1 | G2 | G3 | G4 | G5 | G6 |
|---|---|---|---|---|---|---|---|---|
| [[src-czerkawski-game-economy-design]] (Czerkawski) | economy/monetization of F2P mobile CCG/shooter and premium; practitioner | experience, formulas, case studies | M-H (economy basics) | L | H | M-H | L | L |
| [[src-gd-fresher-f2p-monetization-training]] (internal deck) | mobile F2P from hybrid-casual to midcore; LTV/UA/IAP/IAA | cites AppsFlyer/TopOn/Sensor Tower/Liftoff | **H** | L | M | M | M-H | L |
| [[src-zagal-dark-patterns-in-game-design]] (Zagal et al.) | social/casual F2P of 2012 (FarmVille, SimCity Social, Candy Crush); academic ethics | framework + named cases | **H** (ethics) | M | M | M | M | L |
| [[liveops-vasiuk-src]] (Vasiuk, Dubrovskyi) | PC/console midcore live service (Wargaming), events/offers | practitioner playbook, few numbers | M (events, storefront, personalization) | L | M | **H** | L | L |
| [[f2pdive-bycer-src]] (Bycer, F2P) | PC and hero-collector/PvP F2P; critic's manifesto | named examples, opinion, no conversion data | M (ethics, currencies) | L | M-H | M-H | L | L |
| [[cozydive-bycer-src]] (Bycer, Cozy) | premium cozy sims | named games, design opinion | M (deco/meta only) | **H** | L | L | L | L |
| [[mobiledesign-scolastici-src]] (Scolastici, Nolte, 2013) | 2013 premium/early-freemium 2D casual and arcade | opinion, some 2012 stats; ~40% obsolete | L-M (timeless tuning/UI only) | L | L | L | M (early era) | L |
| [[prodtoolbox-chandler-src]] (Chandler) | publisher-funded console/PC production, 10–300 people | practitioner experience | L-M (prototyping, scope, QA) | L | L | M | L | **H** |
| [[quests-howard-src]] (Howard) | PC/console RPG, adventure, interactive fiction, MMO quest theory and history | academic theory, literary history, modding pedagogy; no mobile data | L-M (quest log and milestone UX only) | L | L | L-M | L | L |
| [[uxui-brewer-src]] (Brewer) | AAA console/PC narrative and action UI/UX; about half career handbook | practitioner opinion + digest of UX theory, no data | M (accessibility, widgets, flows, testing) | L | L | L-M | L | M (UI craft) |
| [[gamefeel-swink-src]] (Swink) | real-time avatar-control games (platformers, space, 3D action); mostly 2D, pre-touch | designer analysis and case studies; reaction-time figures from psychology | L-M (response curves, polish, tuning method) | L | L | L-M | L | L |
| [[src-enfield-mathematics-of-game-development]] (Enfield) | game maths with Unity | textbook | tool, not a design opinion | | | | | |

## Reading the table
- No source is a G1 specialist for the *whole* job. GD Fresher is closest for monetization; Zagal for ethics; Bycer-Cozy for the deco meta; Czerkawski for economy fundamentals.
- When Bycer (F2P) or Vasiuk disagree with GD Fresher, check **genre first**: they write about G3/G4 where whales, PvP fairness and large teams matter, while GD Fresher's data comes from mobile casual/hybrid.
- When GD Fresher and Bycer both give opinions without data on the same point, treat it as an open question and plan a test ([[concept-ab-testing-monetization]]).
- Evidence rule used in the verdicts: **[D]** documented/measured, **[P]** practitioner consensus across several sources, **[O]** opinion of one author.
