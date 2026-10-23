---
type: book-topic
source: prodtoolbox-chandler
fit_g1: mixed
tags: [book, prodtoolbox-chandler]
---
# Audio production and localization

Source: [[prodtoolbox-chandler-src]], Ch16 (pp. 215-230), Ch17 (pp. 231-244).

## Audio (Ch16)
Most studios outsource VO and composition. **VO**: design drives cost (characters, lines, effects); concatenated lines save memory but break in localization and sound stitched; manage assets with a database, consistent file naming (placeholder and final share names), automated script-vs-file check; VO script as one spreadsheet with a row per file (line number, character, text, location, type, effects, context, direction, filename); record as late as possible (except cinematics), **~50 lines/hour** (a line = 8-10 words); one point of contact with actors; bid package with accurate line count; union vs nonunion; auditions; yelling at session end; pickups; pronunciation guide.
**Music**: design the use (UI loops, in-game, cinematics), memory/streaming/compression limits; placeholder music must be removed or cleared before shipping and kept out of marketing; royalty-free libraries vs licensing from publishers (slow, restrictive) vs original (in-house or work-for-hire, **$300-$1,500 per minute**); bid package (minutes, pieces, locations); written, specific feedback; final mixes ~6 weeks before launch with stems; rights signed ~1 month before launch.

## Localization (Ch17)
International can exceed 50% of sales. Common launch set EFIGS. Cultural awareness (Fallout 3 Japan, Wolfenstein Germany, Never Alone as inclusive process). **Localization-friendly code**: string tables, language directories, text not baked into art (separate layer), Unicode and fonts (Noto), UI space +25-30% for longer text, scalable elements, icons, regional date/currency, keyboard mapping, subtitles, lip-sync. Retrofitting is buggy. Approach levels: box and docs, partial (text only, VO subtitled), full. China and Korea features: playtime reminders, reward decay, minors' curfew, PC-bang support. Process: associate producer manages; vendor kit (playable build, design docs, glossary, VO notes); automated integration (XLOC-style); simultaneous release is hard because text keeps changing (100,000 words take weeks). Testing: linguistic (native speakers) and functionality. Rule of thumb **1,500-2,000 words/translator/day**; typically 2-3 months of production; testers are the largest cost; pick languages by ROI.

## Stance and applicability
(a) Story/VO-driven console-PC titles with thousands of lines, union actors and certification; author wrote the localization handbook, so ch17 is her specialty.
(b) Practitioner experience with concrete rules of thumb and prices from circa 2018-2019; no data on localization ROI.
(c) Qualifies: a casual match-3/deco game has little VO and light text, so most audio costs shrink to SFX/music and string tables; but the "design the UI for longer text, no text in art, use icons, string tables from day one" advice applies fully. Compare player-impact/ethics rules in China/Korea with [[concept-hybrid-models-and-ethics]] (compliance, minors). Localization revenue decisions parallel store-page optimization in [[concept-store-and-pricing]] only loosely.
(d) Fit: medium (audio low, localization medium-high for the engineering-design rules). Designer-only: medium - designers write the strings, set UI text lengths and choose the voice/music direction; pipeline setup is another team's.
