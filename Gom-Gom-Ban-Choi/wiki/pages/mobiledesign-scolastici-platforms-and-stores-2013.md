# Mobile platforms and stores in 2013

Source: [[mobiledesign-scolastici-src]], Ch. 1 (pp. 9-34), Ch. 11 (pp. 281-282), Ch. 12 (pp. 297-298).

## What the book says
- Mobile OS set: Android, iOS, Windows Phone, Java ME, BlackBerry; BREW and Bada "out of the race" (p. 11).
- Android: open, fragmented hardware, slow OS updates, about 1M activations/day; Google Play "25 billion downloads" and 1.5B/month; Eclipse + ADT, NDK only if it truly helps (pp. 12-17).
- iOS: about 700k apps, 30B downloads; Mac required; USD 99/year fee; review 10-15 days; 30/70 revenue split; "best UI/UX"; few device variants so no need for many test devices (pp. 18-22).
- Windows Phone and BlackBerry: store fees (USD 99, USD 200), BlackBerry claims higher average revenue per app (about USD 4,000/month) and a RIM revenue guarantee (pp. 24, 32).
- Java ME: dying but still prevalent in India, Middle East, SE Asia, North Africa, South America (p. 28).
- Platform choice for a premium game: target iOS (Android users "less likely to pay"); for freemium, cover all main platforms (Ch. 12 p. 297).
- Market share: Android about 64 percent of Q1 2013 handset sales, iOS most lucrative per user (p. 282).
- Compatibility testing on low-end vs high-end devices is mandatory (Ch. 2 p. 53, Ch. 1 p. 15).

## Reusable takeaways
- Choose 2-3 reference devices (one low, one high) and test on real hardware, not emulators; emulators cannot test multitouch (Ch. 2 p. 52).
- The 30 percent store cut and review latency are structural facts to plan around; still true in kind, not in detail.

## Stance and applicability
- (a) Assumes iPhone 4/5-era and Android 2.2-4.x devices, premium or early freemium, indie team shipping a native app. Dated as of 2026: Windows Phone, BlackBerry, Java ME, BREW, Bada are gone; store data (700k apps), fees, review times, 3G 20 MB / 50 MB OTA limits and Eclipse/Xcode 4 workflow are obsolete. Android is no longer "less lucrative by definition" in the same way; regional differences remain.
- (b) Mostly cited statistics from vendors plus authorial opinion ("iPhone best UI/UX"); not reproducible data.
- (c) Qualifies the project's own stack: CLAUDE.md and memory note [Production = web + Capacitor] choose a web + Capacitor build, which this book treats only as a risky 2013 option (HTML5 "slow", see [[mobiledesign-scolastici-engines-and-tech-choices]]). No wiki source covers platform economics; [[src-gd-fresher-f2p-monetization-training]] covers UA costs but not store mechanics.
- (d) Fit: low. Only the "test on real low-end devices" and "design for fragmentation" ideas still matter for a Capacitor build.
