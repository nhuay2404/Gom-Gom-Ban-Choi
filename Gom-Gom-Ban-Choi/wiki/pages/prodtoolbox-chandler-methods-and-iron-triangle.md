# Process methods, the iron triangle, waterfall vs Scrum

Source: [[prodtoolbox-chandler-src]], Ch4.7 (pp. 75-79); Ch11.5; Ch14.1, 14.5 sidebars.

## Why a process (Ch4.7)
Chandler disagrees with developers who feel process stifles creativity: process "makes it easier to be creative" because people know what to expect. Benefits: visible dependencies (a designer cannot script a level before the artist builds it), overloaded critical path found early, burn-down charts show ahead/behind, task metrics improve future estimates, faster onboarding, fewer surprises. She notes there is no common terminology because many developers lack PM training.

## Iron triangle (Ch4.7.1)
Budget, Schedule, Scope; **quality is what gives** when any of them changes. "Good, fast, cheap - pick two." If all three keep changing, the project is never stable. Producer's job is balancing schedule, resources, features, quality.

## Methods named
- PMP/PMBOK (rigorous, big toolbox) and Certified Scrum Master (2-day course, light process, flexible with feature implementation); recommends both. Scrum: cross-functional self-directed teams of 5-10, Scrum Master removes impediments, sprints (here "usually one month") each ending in a playable deliverable. Agile = prototype first, iterate with feedback. Readings: McConnell *Rapid Development*, Keith *Agile Game Development with Scrum*, Schwaber & Beedle.
- Sidebar (Matt Immerman): keep a **waterfall master schedule/roadmap** for the 1,000-ft view (dependencies, deployment, parallelism), distilled into **Scrum** for developers' day-to-day (sprints, tasks, priorities); share both with developers.
- Sidebar (Chuck Hoover): do not become a zealot; methods are "made up"; the best methods have thoughtful iteration, are made with the team, are hyper-defined, and are transparent and tool-light.
- Strike teams + agile (Ch11.5): cross-discipline feature teams reconfigured at sprint/milestone ends.
- Small-prototype alternative (Ch14.5 sidebar): a **Burndown List** per discipline, ordered by priority, for a 15-person, 12-week demo; no JIRA overhead; does not scale and ignores dependencies.

## Stance and applicability
(a) Studio with a producer using a hybrid of PMBOK-style planning and Scrum, with sprints as long as one month; teams of 5-10 inside a larger project.
(b) Practitioner opinion; certification descriptions are factual, claims about creativity and morale are experiential. No outcome data (the Game Outcomes Project is only cited in Ch12).
(c) Conflicts: more plan-driven than Kanban/continuous-delivery live-ops, where scope is a rolling backlog tied to metrics ([[concept-live-ops-and-inflation]]); monthly sprints are long compared to the 1-2 week sprints typical for mobile. Agrees with lean sources that process must be team-owned and light (Hoover). Czerkawski's per-feature design docs with analytics hooks ([[concept-spreadsheet-modeling]]) fit under the Scrum half. The "quality gives" framing treats quality as the adjustable variable; live-ops teams often hold quality/time fixed and cut scope.
(d) Fit: medium-high for the principle (iron triangle, scope flexes, keep one visible list, copy what the team will actually use), low for the certification detail. For a small mobile casual team a one-person-owned burndown list or short sprints is closest to what the author recommends for small teams. Designer-only: medium - designers should know the triangle to propose scope trades rather than only add features.
