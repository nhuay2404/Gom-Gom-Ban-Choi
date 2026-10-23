# Outsourcing, vendors and middleware

Source: [[prodtoolbox-chandler-src]], Ch13 (pp. 183-188); Ch16.2.5, Ch17.6, Ch18.4.

## Position (Ch13.1-13.3)
Outsource for capacity or specialized work (voiceover, localization, cinematics, audio, art, QA); **not to save time or money** - the vendor needs ramp-up and fast feedback, and delays on your side (late feedback, scope changes) make a vendor late. Good candidates: discrete tasks off the critical path with clear scripts/storyboards. **Outsourcing engineering is not recommended** (interdependence, merge conflicts, source access, matched dev environment) but can work with extra diligence or on-site vendors. Cons: cost, loss of schedule flexibility, need to think months ahead to feed assets, deadline risk. Mitigate: pad schedule, require weekly or more frequent deliveries, vendor attends daily check-ins, delivery a week before a milestone, treat a missed interim date as a red flag; if hopeless, cut losses.

## Working with vendors (Ch13.4)
Kickoff: clarify scope and expectations, deadlines and contingency plan, **single points of contact** on both sides with daily contact, communication channels (add to chat/mail if secure), provide concept art, prototypes, style guide; treat the vendor as part of the team (water cooler, on-site visit). Inform them of schedule changes or pay extra. Sidebar (Schweitzer): **start small** with test assets (six animation emotes exposed a feedback bottleneck and broken anim-audio dependency); keep vendors fed with tasks, discuss the next contract at the midpoint and finalize by 3/4.

## Middleware (Ch13.5)
Engines and tools (Unreal as middleware) let the team focus on unique features; learning curve and licensing cost/royalties; SDK/API/support; vendor may require a build review for approval - schedule time. Do not assume savings.

## Related vendor processes
Studio bid packages with line counts for VO (Ch16.2.5), composers by the minute (Ch16.3.3), localization vendors and kits (Ch17.6), QA vendor questions (Ch18.4); see [[prodtoolbox-chandler-audio-and-localization]], [[prodtoolbox-chandler-qa-testing]].

## Stance and applicability
(a) Studio with its own critical path and producers buying services for VO, cinematics, localization, QA; Western vendor market, US-style contracts.
(b) Practitioner experience; the "start small" sidebar is the only concrete case.
(c) Qualifies: external-art outsourcing is common and heavily used in mobile (e.g. asset studios), where cost saving is often the primary reason - Chandler's "not cheaper" is a counter-claim from AAA/mid-size experience. The dev-side feedback bottleneck matches live-ops cadence problems. Middleware advice (budget a learning curve) applies equally to SDK integration, which is another team's concern here.
(d) Fit: medium. For a team that outsources 2D art, SFX/music or localization, the kickoff checklist, small test batch, weekly deliveries and one point of contact are directly useful. Designer-only: medium - designers write briefs, give feedback and set style references, so feedback turnaround is the design side's responsibility.
