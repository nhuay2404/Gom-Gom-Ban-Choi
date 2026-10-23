# Prototyping process

Source: [[mobiledesign-scolastici-src]], Ch. 9 (pp. 197-227), Ch. 11 (pp. 272-274), Ch. 2 (p. 43), Ch. 12 (p. 296). The Unity Space Invaders code in Ch. 8-10 is tutorial only.

## Method
- Four steps: define (written description of the activity), build (quickly, no fancy graphics/sound), test (fresh testers each build), fix/cut (pp. 197-198).
- Horizontal prototype = wireframe of the whole flow ("context over content"); vertical prototype = one mechanic in depth ("content over context") (pp. 198-199).
- Throwaway/disposable code first to prove the core mechanic cheaply; then reusable/evolutionary code that becomes the product. Ladder: imagination -> pencil and paper (spreadsheet math, designer as game master, cards/dice/dominoes) -> visual prototype (clickable PowerPoint/Visio) -> interactive prototype (pp. 199-201).
- Build the most frequent player action first, add the second, and so on: 3-5 elements, never above 7 (p. 201).
- Re-run define/build/test/fix whenever a feature is added to avoid hidden exploits (p. 201).
- Pitfalls: losing the big picture, feature creep, feature attachment ("bite the bullet and toss it"), prototype costing more than budget (pp. 202-203).
- Rule of thumb: an element on its third failed fix gets cut (p. 274). Placeholder art from a prestigious source can poison later judgement of final art (Game Boy Advance anecdote, p. 273).
- Test with team, former testers and fresh testers, collect reactions and data; end preproduction with a design doc that reflects what survived (p. 274).
- Post-release: gather the team and record what they would change; store for the sequel (p. 274).

## Reusable takeaways
- Paper/spreadsheet prototype of a match-3 rule or economy loop before engine work (see [[concept-spreadsheet-modeling]]).
- Keep a "cut after three failed fixes" rule and a feature-attachment check.

## Stance and applicability
- (a) Assumes a first-time indie team, premium or simple freemium, fixed release followed by sequel/DLC. Dated as of 2026: Visio/Axure/Flairbuilder tools, "no beta on mobile" claim (soft launch, TestFlight, Play internal tracks, and data-driven soft launch are standard), single-release mindset. Only a hint of iteration after launch ("version releases") exists.
- (b) Craft experience and anecdotes; widely echoed by industry, but untested here.
- (c) Differs from [[src-gd-fresher-f2p-monetization-training]] and [[concept-ab-testing-monetization]]: this book validates fun by playtesting before release, while F2P live-ops validates through cohort metrics and A/B tests post-launch. They are complementary, not competing; neither covers soft launch KPIs for prototypes.
- (d) Fit: medium. The process is sound and cheap for any new feature (the project's deco zones, kitchen, kinder); it lacks quantitative gates.
