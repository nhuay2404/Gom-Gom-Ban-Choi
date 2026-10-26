---
type: book-topic
source: uxui-brewer
fit_g1: medium
tags: [book, uxui-brewer]
---
# Art direction routes, style guides, workflow and working in teams

Source: [[uxui-brewer-src]], Ch. 2 (pp. 5-14), Ch. 6 (pp. 89-95), Ch. 7 (pp. 123-125), Ch. 10 (p. 163, 165), Ch. 11 (pp. 170).

## Finding the route (pp. 89-95)
- Before designing, explore 3-4 named "routes" (name, slogan, pillars, execution) with research images; too many options yield weak choices; present only options you are happy to build.
- Position the game on an immersion vs abstraction scale; ask genre, audience, IP, setting, period; talk to directors, writers, designers, concept art (p. 91-92). Late planning forces a non-diegetic overlay.
- Reference research beyond Pinterest: field trips, museums, physical props; keep a few "hero" references; organise by pillar; practise restraint (pp. 92-93). Mood boards pitch a route in a few references (p. 93-94).
- Style guide: core visual and design elements with do/don't ticks and crosses; communication tool for new hires, outsourcing, co-dev; gives tools, not every answer (p. 94). High-fidelity previs/mockups (Photoshop, XD, After Effects, Sketch, Figma) catch problems early (p. 94).

## Roles and structure (Ch. 2)
- 15 role types: UX researcher, interaction designer, UX writer, UX architect, UX designer, UX/UI designer, UI designer, UI artist, visual designer, UI technical artist, UI VFX artist, UI scripter/implementer, UI programmer, UX strategist, UI/UX director. Titles are inconsistent and overlap; small studios compress them (pp. 5-14). Common traits: communicate clearly, UX over UI, player first, brevity/consistency/familiarity, accessibility, data as driver (p. 13-14).
- Unicorn = full-stack UX/UI person; nobody recruits one; generalist early, specialise later (p. 14).
- Cross-discipline: UX "is not limited to one person with the title"; keep dialogue across disciplines (Lyver, p. 162); UX/UI sits at the intersection of pillars, narrative, art and feature design (Yovina, p. 165). Introduce UX culture gradually, adapt to the studio (p. 170); communication is the key skill: listen to understand (p. 170).
- Designers' job includes persuading management and production to invest in features (p. 8).

## Workflow (pp. 123-125)
- File naming convention (Event_EventSpecific_Element_Type_Variation, zero-padded numbers, Latin characters only), folder structure rules, readme for structure; performance budgets (texture sizes, channel packing, SDF, nine-slicing, power-of-two); learn the engine basics (Unity/Unreal or proprietary).

## Reusable takeaways
- Write a one-page UI style guide with ticks/crosses and a colour language; a naming scheme for UI art (the repo's `game/assets/img/<group>/` plus prefix rules is already similar).
- Map who owns each UI surface in a designer-led team (design vs art vs implementation) to avoid the "fix it in UI" loop.

## Stance and applicability
- (a) Mid/large studio with art director, UX team and UI technical artists; indie/small-team compression acknowledged but not elaborated.
- (b) Practitioner experience; no org data.
- (c) Complements [[prodtoolbox-chandler-roles-and-producer]], [[prodtoolbox-chandler-team-hiring-and-organization]] and [[mobiledesign-scolastici-indie-team-and-roles]]; the project's asset/UI conventions are documented in the repo's CLAUDE.md and [[mobiledesign-scolastici-ui-design-and-diegesis]] (grayscale wireframes). No conflict.
- (d) Fit: medium. The route/style-guide method and role map help a designer-led team brief artists, but the team structure and engine/perf advice are another team's concern per project scope.
