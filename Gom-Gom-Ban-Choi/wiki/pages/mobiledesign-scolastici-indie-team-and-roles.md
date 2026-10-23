# Indie team, roles and production habits

Source: [[mobiledesign-scolastici-src]], Ch. 2 (pp. 35-64), plus Ch. 9 (p. 202) and Ch. 11 (p. 274).

## Team shape
- Mobile scope is narrow, so one or few people per role; key roles: design, art/modeling, programming, sound, QA, production. Roles may be shared or doubled up; too small and too large teams both slow down (p. 36).
- Cross-cutting traits: commitment, cohesion, discipline, professional training, passion; key roles should have shipped before so their estimates are trustworthy (pp. 37-39).
- Agile is named as the common method (iterative, short milestones) (p. 38).

## Designer (pp. 40-44)
- Turns an idea into a living design document, acts as "living wiki" for the team, pitches to investors, manages test sessions.
- Tools: paper sketches ("if you cannot sketch it, it is probably not a good mechanic"), spreadsheets, image editors, white-box levels.
- Skills ranked: communication first, technical writing, drawing/mockups, basic programming/scripting, algebra-level math, finance (cost of changing direction), psychology (reward, aversion feedback).
- Practice: prototype the most frequent action, then the second, up to 3-5 actions for a first project; each added action multiplies testing cost. Never be attached to ideas; "no game is ever done", file extra ideas for the sequel.

## Other roles
- Artist: 2D (concept, sprites, UI, textures) plus 1-2 3D people; graphics sell the game on impulse (pp. 44-47).
- Programmer: C++ default in 2013; engines rarely written from scratch; AI minimal because mobile avoids frustration; network must be hack-proof when free-to-play needs servers (pp. 48-51).
- Tester must not be a developer; cost of correcting a mechanic grows with time since implementation; test types: functionality, compatibility, localization, stress ("monkey"), compliance, beta (pp. 51-55).
- Producer: schedule, budget, QA scheduling, "commitment over ego", say "it is good enough"; anecdote: partners self-produced mocap assets in the wrong format and cost more than outsourcing (pp. 56-60).
- Sound designer is usually a late contractor on mobile (pp. 60-63).

## Reusable takeaways
- Check asset requirements with the developer before producing assets (false economy story, p. 60).
- Use a bug report with exact reproduction steps; use new testers for each build (Ch. 9 p. 198).

## Stance and applicability
- (a) Assumes a 3-10 person self-funded indie team, premium or freemium, 2013 tooling (Visio, MS Project, FileMaker, Skydrive). Dated as of 2026: salary/tool references, "audio is last" practice, Git as a novelty. Not written for live-ops F2P teams with analysts, UA, and economy designers.
- (b) Pure experience and opinion with personal anecdotes (Faceball 2000, XX La Breccia); no data.
- (c) Differs from [[src-czerkawski-game-economy-design]] and [[src-gd-fresher-f2p-monetization-training]], which assume dedicated economy/monetization/live-ops roles; this book gives the designer finance and psychology as side skills only. Fits the project memory note that the user is a game designer and setup/perf/SDK is another team.
- (d) Fit: low to medium. Designer-skill list and "prototype most frequent action first" still apply to a designer-led team; tooling and hiring advice do not.
