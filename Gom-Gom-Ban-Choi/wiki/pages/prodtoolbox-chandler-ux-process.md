# UX process and working with a UX team

Source: [[prodtoolbox-chandler-src]], Ch15 (pp. 205-213, written with Celia Hodent); Ch6.5; Ch18.1.

Note: the extracted text lost most of sec. 15.3-15.4 (list of five developer misconceptions and the UX-team misconceptions); only the first two misconceptions survive.

## What UX is (Ch15.2)
A mindset placing the end user at the centre; making sure design and business intentions are experienced as intended by the target audience, using cognitive science/psychology plus user research (playtests, analytics); concern of the whole studio, UX staff provide tools.

## Misconceptions (Ch15.3)
Surviving items: (1) UX hampers creativity / makes the game easy - no, it helps deliver the intended experience even for hardcore challenge; (2) UX is common sense so tests are unnecessary - developers and players are subject to perception and cognitive biases, so use standardized protocols.

## Working together (Ch15.5)
Establish trust (UX available as a resource, not another gate); find advocates (production is ideal; schedules UX tasks); start small (icons, in-game UI, core loop questions) and track UX issues in JIRA; align goals by prioritizing which features to test over the next 6 months and fixing test dates in the schedule; invite the team to watch tests.

## Process (Ch15.6)
1. **Hypotheses**: key questions from anyone (will players find the doors? what do they use least?). 2. **Planning**: dates, build ready days before, recruit via questionnaire. 3. **Testing**: participants play unprompted unless a feature is being explained; developers watch live (one-way mirror), free calendars on test days. 4. **Reporting**: focus on hypotheses; less is more; review together and classify each issue *By Design*, *Needs Addressed* or *In Progress*. 5. **Iterate**: issues as tracked tasks with video/screenshots, scheduled (sprint). 6. **Retest** in the next scheduled test; late in production fewer iterations are possible, critical failures may delay or redesign.

Contrast with QA (Ch18.1): UX asks "is the experience satisfying"; QA asks "does it behave as intended". Playtest feedback technique in [[prodtoolbox-chandler-prototyping]].

## Stance and applicability
(a) Studio with a dedicated UX lab (Epic-style) and recruited participants testing a prototype/alpha in person; chapter written by a UX director from AAA.
(b) Practitioner/academic-informed: Hodent is a psychologist (*The Gamer's Brain*); the process is standard UX research, but the chapter cites no outcome data.
(c) Qualifies: for F2P mobile, quantitative telemetry, funnel analysis and A/B tests ([[concept-analytics-and-kpis]], [[concept-ab-testing-monetization]]) usually replace lab tests; Chandler mentions analytics as an input only. The UX framing "intended experience" can be applied to ethical concerns raised in [[concept-dark-game-design-patterns]]: UX testing can verify clarity of disclosure, though the book itself does not make that link. Overlaps with the existing repo habit of eyes-on mobile frame checks.
(d) Fit: medium-high. Hypothesis-first testing, observed (not self-reported) behavior, "by design / needs addressed / in progress" triage, scheduled retests and having developers watch live are cheap with 5-8 casual testers on phones. A UX lab, one-way mirror and questionnaires are optional. Designer-only: high; test planning and issue triage are design work.
