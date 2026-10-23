# Operations management: lean LiveOps

Source: [[liveops-vasiuk-src]], ch. 12, pp. 159-172; Part IV intro p. 157.

- **Independence principle**: LiveOps and game dev creatively aligned but **operationally autonomous**; ops should run without constant dev intervention. Do not launch a campaign/event without a 24/7 team able to respond (Introduction p. 5). Admits Part IV focuses on PC.
- **Analogies**: Zara (asset = fabric, resize = cut, bundle = sew, CDN/store = distribution) and Amazon FBA (pick/pack/ship). Three ops functions map to LAPs: **Data management, Store management, Content management**; campaign types: storefront promotion, engagement programme, personal offer, ad hoc, advanced (no-code referral/loyalty/survey/battle pass).
- **Added value = KPI uplift minus operational cost** (p. 162): a clever event can be net-negative once payroll and tooling count.
- **Process mapping**: map real current steps with durations and waiting; spot tasks where time spent is negatively correlated with value.
- **Eight wastes** (Toyota) in live ops: transportation (scattered event details; one source of truth), inventory (event queue; example of event B planned before A overperformed), motion (toggling tools), waiting (approvals, time zones), overproduction (too many bundles/events), overprocessing (cinematic trailer for a small event), defects (contradictory simultaneous events; need rollback plans), skills (underused talent, over-split tasks).
- **Map v2.0 example**: remove waits, merge copywriting tasks, merge bundle and communication art tasks, parallelise localisation.
- **Content categorisation and asset library** (pp. 168-170): approved asset lists per activity type; limit asset reuse across parallel events; create-smart/reuse-wisely (generic copy that survives 6 months), connect everything in one wiki, start minimal, adopt habits.
- **Automation** (pp. 170-172): simplify and standardise first, automate later (Toyota lesson: over-automation reduces agility); different item/token IDs per region break automation.

## Stance and applicability
- (a) Large studio with multiple regions, stores, localisation vendors and cross-team approvals (100M+ player fantasy at pp. 159-160).
- (b) Management theory (Lean/TPS) mapped by analogy; one concrete event-queue anecdote.
- (c) Extends [[concept-spreadsheet-modeling]] and the content-planning spreadsheet in [[concept-live-ops-and-inflation]] (internal names, status columns). Different scale: Czerkawski assumes the economy designer is also the product owner; Vasiuk separates roles. Team-size guidance: none explicit, but "4-12 people per event workshop" and the 24/7 response requirement imply a sizeable team.
- (d) **Low-medium.** For a designer-led small team: keep the formulas (added value = uplift - cost; avoid event queues; standardise IDs and copy; reuse via an asset library). Skip 24/7 coverage and multi-region store management; our remote-config constants approach already follows "standardise before automating".
