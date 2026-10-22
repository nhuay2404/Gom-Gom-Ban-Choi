# Source: Mathematics of Game Development — A Collection of Applied Lessons

Jacob Enfield (George Mason University), CRC Press, 2024 (ISBN 9780367527716). Textbook for students; each chapter = one math idea + a small Unity/C# project + challenges + exercises. Prerequisite: algebra only.
File: `Downloads/Mathematics of Game Development ... (Jacob Enfield).pdf` (53 MB, not copied into `raw/`). Page numbers are the book's printed pages.

## Chapter map
| Ch | Topic | Pages | Wiki page |
|---|---|---|---|
| 1 | Unity fundamentals | 4–18 | not ingested (tooling) |
| 2 | C# programming primer | 19–58 | not ingested (tooling) |
| 3 | Positions, coordinate plane, pivot points | 59–72 | [[concept-coordinates-pivots-distance]] |
| 4 | Distance: Pythagoras, distance formula (2D/3D), triangles and polygon cost | 73–89 | [[concept-coordinates-pivots-distance]] |
| 5 | Radians, SOH-CAH-TOA, Atan2, enemy field of view | 90–120 | [[concept-trigonometry-and-angles]] |
| 6 | Matrices and vectors | 121–164 | [[concept-vectors-basics]] |
| 7 | Sine/cosine, sinusoidal functions, head bob | 165–186 | [[concept-sinusoidal-motion]] |
| 8 | Dot product | 187–205 | [[concept-dot-and-cross-product]] |
| 9 | Cross product, area, normals | 206–222 | [[concept-dot-and-cross-product]] |
| 10 | Vector projection and reflection | 223–243 | [[concept-projection-and-reflection]] |

## How it fits our project
- It is a *programmer's* math book, not a design/economy book; it complements [[src-czerkawski-game-economy-design]] only through shared basics (algebra, trig). The Unity code and activities were not ingested.
- Our game is web (Three.js) + Capacitor, not Unity: the maths are engine-independent, but method names differ (Unity `Mathf.Atan2`, `Vector3.Normalize` ↔ JS `Math.atan2`, Three.js `Vector3.normalize()`).
- Likely uses here: cat movement/vision and 3D Deco camera (angles, distance, direction), bobbing/idle animation ([[concept-sinusoidal-motion]]), bounce/reflection effects ([[concept-projection-and-reflection]]).
- Caveat: book pairs "2D web games" with top-left origin and y increasing downward (p. 60) while Unity/world space is y up. Check which convention a given system uses.
