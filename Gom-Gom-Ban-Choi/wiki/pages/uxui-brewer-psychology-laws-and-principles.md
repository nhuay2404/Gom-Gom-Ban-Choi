---
type: book-topic
source: uxui-brewer
fit_g1: medium-high
tags: [book, uxui-brewer]
---
# UX psychology laws, Gestalt and UX principles

Source: [[uxui-brewer-src]], Ch. 4 (pp. 32-55). Mostly a glossary in the style of lawsofux.com, each with a one-paragraph game example.

## Information (how players process)
- Hick's law (more choices, slower decisions; stage customisation, offer favourite/sort/search/"new" flags, p. 33); Fitts's law (big, near targets; pad interactive elements, p. 33); Miller's 7+-2 and cognitive load (p. 34, 37); Recognition > recall (p. 45); Tesler's law (complexity is conserved, move it, do not fake complexity for perceived value, p. 36); Occam's razor (p. 38); Progressive disclosure (reveal features and map gradually, p. 35); Attentional spotlight (cannot direct attention to two competing feedback sources at once, pp. 35-36); Von Restorff (make the key button anomalous, p. 34); Priming, anchoring (first minutes set the reference, p. 34); Doherty threshold (response under ~400 ms or show feedback, loaders, let player practise while loading, p. 46); Postel's law (forgiving input, p. 46); Jakob's law (consistency with genre, use GameUIDatabase, p. 46-47); Default bias (make alternatives discoverable, p. 47).
- Biases to guard against in the team: confirmation, survivorship (copying winners ignores failures, p. 37), expectation, survey bias, sunk cost (let go of features that do not work, p. 41), law of the instrument, Parkinson's law (p. 40).

## Meaning and motivation
- Scarcity (limited-time events, rare items, limited lives, pp. 37-38), variable reward ("live service and mobile games frequently trigger free rewards for returning players", p. 38), goal-gradient (progress bars, quest lists, make incomplete progress look exciting, p. 45), peak-end rule (find peak joy moments and highlight them, p. 45), investment loops, loss aversion (do not make failure sting, p. 40), endowment and IKEA effects (naming pets/buildings, customisation = ownership, pp. 43-44), delighters (petting an animal, easter eggs, p. 44), temptation bundling, nudging (p. 36), reactance (explain forced restrictions, no invisible walls, p. 41), affect heuristic, negativity bias, decision fatigue, serial position (important items first or last, p. 46), Weber-Fechner (small increments are noticeable; big UI scale-ups must be proportionally larger, p. 42).
- Persuasion-style items are named without critique: decoy effect ("loot? anyone?", p. 36), framing ("create urgency", p. 36), scarcity, variable reward. The book never mentions ethics or dark patterns.

## Gestalt (pp. 47-52)
Proximity, similarity (ability icon shape/colour families), common region (panels, cards), continuity, closure (half-faded last list row implies scroll), figure-ground, uniform connectedness, common fate (things that animate together read as related), Pragnanz. Emergence, reification, multistability, invariance as underlying ideas.

## UX principles (pp. 52-55)
User-centricity (but games are also artistic vision), consistency, feedback (visual + audio + haptic, timely, unambiguous), equitable use, affordance, hierarchy, conceptual model, error prevention and tolerance (undo, buy-back), low physical effort (avoid holds and repeated taps), constraints, KISS.

## Reusable takeaways
- A short laws checklist for UI reviews: Hick (shop tab count, Deco list), Fitts (thumb zones), goal-gradient (level/quest bars), peak-end (win screen), endowment/IKEA (naming cats, placing furniture), serial position (first/last item in carousel).
- Decoy, scarcity, framing and variable reward are exactly the levers [[liveops-vasiuk-storefront-psychology]] and [[concept-offers-and-merchandising]] use deliberately; Brewer lists them as neutral tools.

## Stance and applicability
- (a) General UX theory applied with console/PC examples (Bioshock, GTA, Overwatch, Red Dead 2); no mobile or F2P case.
- (b) Secondary literature digest (lawsofux, Norman, Cialdini-style effects); no original research; some entries are loose (Doherty "late 1970s study", Miller).
- (c) Persuasion items conflict in tone with [[src-zagal-dark-patterns-in-game-design]] and [[concept-dark-game-design-patterns]], which would flag decoy/urgency framing and variable reward as potentially manipulative; Brewer never engages with that. Sunk-cost and loss-aversion items support [[cozydive-bycer-low-stakes-design]] (do not punish failure). Reward items overlap [[concept-reward-design-and-psychology]].
- (d) Fit: medium-high. A compact, usable vocabulary for UI reviews of a match-3 + deco game (progressive disclosure for zones, goal-gradient, endowment on cat/furniture naming). The persuasion-for-sales items must be read through the wiki's council verdicts, not adopted as-is.
