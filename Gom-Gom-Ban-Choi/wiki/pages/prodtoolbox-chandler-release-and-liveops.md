# Release, marketing support and live operations

Source: [[prodtoolbox-chandler-src]], Ch19 (pp. 259-264), Ch20 (pp. 265-273); Ch2.4.6-2.4.8; Ch4.5.5-4.5.7.

## Marketing and PR (Ch19)
Involve marketing from concept (comps, focus tests, trends); marketing is metric/sales-driven, developers are experience-driven - name the difference. Single point of contact on the dev side; weekly sync; share schedule, docs, platform decisions, prototype, cheats/walkthroughs; keep them informed of feature cuts (do not announce removed features). Plan assets: weekly screenshots and raw footage, key art, demo builds, trailers; PR: press tours just before launch, conferences, influencers. If dev doubles as creative services, hire an artist for it. Focus groups: subjective, can contradict; NDAs for informal ones.

## Is it ready? (Ch20.2)
Release checklist across testing (P1-P2 bugs fixed, others may ship), ratings certificates (10-30 days), legal/licensor sign-off (a week or more), third-party approval (5-10 days). Stakeholders sign off: dev leads, QA with a formal final report, publishing, third parties. **Release notes** with a known-issues list to lower CS load.

## Live operations (Ch20.4)
Create a **LiveOps team** before launch (CS, community, development, publishing). Two scenarios: unwinnable progression bug (patch fast), crashes on friend-join (take the game offline). **CS**: builds, FAQs from designers/QA, in LiveOps standups; self-service site first. **Community**: monitor forums/Reddit/Discord, but **vocal players may not represent the majority - check metrics before changing the game**. **Metrics**: start from questions (session length, popular activities, feature discoverability); feature developers add basic analytics at implementation; you need analysis capacity or the data is useless. **Updates**: critical fix first, do not cram; use a needed download to bundle fixes/feedback-driven changes; tell players what will and will not be fixed (public Trello/database); respond promptly; use the same formal release process for updates (placeholder art once leaked); consider download size, version splits between players, downtime. CS sidebar (Thompson): empathy, grit, process, clarity, presentation.

## MVP link (Ch4.5.5, Ch1.2)
Launch minimal and iterate on feedback (Pokemon GO), "works well with F2P"; keep one feature set in planning, one in execution, one in launch.

## Stance and applicability
(a) Console/PC or live-service online game with a publisher, CS/community/marketing departments and platform submission; LiveOps as a staffed team, follow-the-sun at large publishers. Fortnite is the implicit model.
(b) Practitioner experience; the "vocal minority" claim is asserted; no data about update frequency or retention effects.
(c) Conflicts/qualifies: treats LiveOps mostly as stability/patch/community management; mobile F2P live-ops is event, offer, economy and content cadence run by data - see [[concept-live-ops-and-inflation]], [[concept-analytics-and-kpis]], [[concept-ab-testing-monetization]], [[src-czerkawski-game-economy-design]]. The release-checklist and known-issues approach is closer to premium-game QA gates than to staged rollouts/feature flags used by remote-config teams (this project uses Firebase Remote Config). Metrics-before-forum-feedback aligns with the data-first analytics sources.
(d) Fit: medium-high. Take: pre-launch LiveOps process, release checklist with severity thresholds, known issues list, metrics-before-opinion, include CS in LiveOps stand-ups, and the "update needs a formal release path" rule. Skip: press tours, console submission. Designer-only: medium - designers drive content/event design for updates and define the questions telemetry must answer; process ownership is production/live-ops.
