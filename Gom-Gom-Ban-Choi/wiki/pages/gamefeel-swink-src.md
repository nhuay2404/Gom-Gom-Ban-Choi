---
type: book-source
source: gamefeel-swink
tags: [book, gamefeel-swink]
---
# Source: Swink, *Game Feel: A Game Designer's Guide to Virtual Sensation* (Morgan Kaufmann / Elsevier, 2009)

Book key `gamefeel-swink`. About 350 pages, ~139k words. Author: Steve Swink, designer at Flashbang Studios (Off-Road Velociraptor Safari), ex-Neversoft, IGF co-chair, game-design teacher. Method: a definition built from a feedback-loop model of perception, six "metrics" (input, response, context, polish, metaphor, rules), then reverse-engineering case studies of classic games (Asteroids, Super Mario Bros., Bionic Commando, Super Mario 64, his own Raptor Safari), then seven principles. Companion site game-feel.com (playable Flash demos with exposed parameters; not available in the text). Almost no measured data of his own: the numbers come from Card/Moran/Newell's Model Human Processor, Mick West's articles, and the author's own tuning of clones.

## Chapter map
| Ch. | Pages | Topic | Wiki page |
|---|---|---|---|
| Intro | xiii-xvii | Feel as "the tactile, kinesthetic sense of manipulating a virtual object"; structure of the book | [[gamefeel-swink-definition-and-experiences]] |
| 1 | 1-33 | Three building blocks (real-time control, simulated space, polish); five experiences; skill, challenge, intuitive controls, flow; unique physical reality | [[gamefeel-swink-definition-and-experiences]], [[gamefeel-swink-skill-challenge-and-flow]] |
| 2 | 35-60 | Human perception: 240 ms correction cycle, 100 ms response, 10 fps, continuity; Fitts' law; perceptual field | [[gamefeel-swink-perception-and-real-time-control]] |
| 3 | 61-68 | Game Feel Model of Interactivity (7 steps, designer controls steps 4-6) | [[gamefeel-swink-perception-and-real-time-control]] |
| 4 | 69-80 | Mechanics as "game feel atoms"; test on Street Fighter II, Prince of Persia, Guitar Hero, Kirby Canvas Curse | [[gamefeel-swink-definition-and-experiences]] |
| 5 | 81-100 | Why measure; hard vs soft metrics; six elements | [[gamefeel-swink-metrics-framework]] |
| 6 | 101-118 | Input metrics (micro, macro, tactile) | [[gamefeel-swink-input-metrics-and-touch]] |
| 7 | 119-138 | Response metrics: mapping, ADSR envelopes, simulation, states, filtering, relationships, input/response sensitivity | [[gamefeel-swink-response-adsr-and-mapping]], [[gamefeel-swink-simulation-states-and-filtering]] |
| 8 | 139-149 | Context: space, speed, size, spacing, collision | [[gamefeel-swink-context-space-speed-collision]] |
| 9 | 151-170 | Polish: animation, VFX, SFX, cinematic, tactile; Gears of War vs Dawn of Sorrow | [[gamefeel-swink-polish-and-impact-cues]] |
| 10 | 171-178 | Metaphor: representation and treatment; real/iconic/abstract | [[gamefeel-swink-metaphor-and-treatment]] |
| 11 | 179-186 | Rules: high/mid/low level; Street Fighter II, Cave Story | [[gamefeel-swink-rules-and-meaning]] |
| 12 | 187-199 | Asteroids recipe | [[gamefeel-swink-case-asteroids-and-mario-bros]] |
| 13 | 201-228 | Super Mario Bros. recipe | [[gamefeel-swink-case-asteroids-and-mario-bros]] |
| 14 | 229-245 | Bionic Commando (animation-driven feel, camera dead zones) | [[gamefeel-swink-case-bionic-mario64-raptor]], [[gamefeel-swink-camera]] |
| 15 | 247-275 | Super Mario 64 | [[gamefeel-swink-case-bionic-mario64-raptor]], [[gamefeel-swink-camera]] |
| 16 | 277-296 | Raptor Safari (vehicle sim, tiered impact sounds, reward-everything rules) | [[gamefeel-swink-case-bionic-mario64-raptor]] |
| 17 | 297-309 | Seven principles + ownership | [[gamefeel-swink-principles]] |
| 18 | 311-320 | Games the author wants to make (1,000 Marios, intimacy by touch, invisible avatars, Tune) | [[gamefeel-swink-tuning-method-and-g1-playbook]] |
| 19 | 321-344 | Future of input, response, context, polish, metaphor, rules | [[gamefeel-swink-input-metrics-and-touch]], [[gamefeel-swink-polish-and-impact-cues]], [[gamefeel-swink-metaphor-and-treatment]] |

Synthesis page for this project (not in the book): [[gamefeel-swink-tuning-method-and-g1-playbook]].

## Thesis in six lines
1. Game feel is the sensation of real-time control of a virtual object, in a simulated space, with the interaction emphasised by polish; feel lives in the player's mind, not in the code (Ch. 1, 14).
2. Real-time control needs: motion fused above ~10 fps, response perceived as instantaneous (about 50-100 ms), continuous input handling, because the human correction cycle is about 240 ms (Ch. 2).
3. Feel can be compared across games by six measurable or semi-measurable elements; response curve (ADSR envelope) and the relationships between parameters are where most of the feel is made (Ch. 5-7).
4. Context (object spacing against avatar motion) is "the second half of tuning"; speed has no meaning without a frame of reference (Ch. 8, 19).
5. Polish, metaphor and rules change perceived mass, material and toughness without changing the simulation; for the player simulation and polish are indistinguishable (Ch. 9-11).
6. Good feel is predictable, immediate, easy-but-deep, novel, appealing, organic and harmonious (Ch. 17); perception beats physical accuracy ("hacks" such as Mario's 3x fall gravity feel better than pedantic physics, Ch. 13).

## What the book is really about
Real-time avatar-control games: platformers, space shooters, driving, fighting, 3D action. The author explicitly puts Civilization, Bejeweled, Peggle, Starcraft and turn-based games outside "true game feel" (they get only "naked polish", Ch. 1 p. 9). Everything written about input assumes pads, keyboards and mice (the Wiimote and Novint Falcon are the "future"); touch screens appear only as "direct input" and as the Kirby Canvas Curse stylus case (pp. 78-80, 103, 322).

## Disagreements and caveats against the rest of the wiki (summary)
- Audio: Swink treats sound as a core feel layer (the two-balls demo, Mario 64, Raptor Safari); [[mobiledesign-scolastici-audio-for-mobile]] says treat audio as secondary and optional on phones. See [[gamefeel-swink-polish-and-impact-cues]].
- Prototyping: Swink insists on a context-bearing "gameplay garden" plus placeholder feedback layers; this agrees with the Sowers point in [[prodtoolbox-chandler-prototyping]] and differs from greybox-only orthodoxy.
- Realism: he warns against photoreal harmony ("uncanny valley of game feel"), which supports the toon/iconic direction already chosen for the 3D deco scene (see [[gamefeel-swink-metaphor-and-treatment]]).
- Hard data on tap latency, thumb reach or match-3 feedback timing is absent; use [[mobiledesign-scolastici-touch-input-and-controls]] and own playtests.
