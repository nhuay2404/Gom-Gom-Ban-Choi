---
type: concept
source: src-enfield-mathematics-of-game-development
tags: [concept]
---
# Trigonometry, radians and field of view

Source: [[src-enfield-mathematics-of-game-development]], ch. 5 (pp. 90–120).

- **Angles**: 360° = one turn; adding/subtracting 360° gives the same direction (−105° ≡ 255° ≡ 615°). Game code normally uses **radians**: 360° = 2π, 180° = π, 90° = π/2. Convert: rad × 180/π = deg; deg × π/180 = rad. π = circumference ÷ diameter.
- **SOH-CAH-TOA** for a right triangle with angle θ: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent. Known angle + one side gives other sides (hyp 100 at π/6: opposite 50, adjacent 86.7). Two known sides give the angle with the inverse function (tan θ = 40/30 → θ = atan(40/30) = 53.13°). The three angles sum to 180°. Pick the function from what you know; calculators must be in the right mode (radians).
- **Atan2(dy, dx)**: gives the direction from one object to another and handles the quadrant for you; plain atan can't tell which quadrant (p. 105). Multiply by Rad2Deg (180/π) for degrees. Facing a target = set rotation to this angle; moving "forward" = add the facing vector × speed × frame time.
- **Enemy field of view** (the chapter's project): an enemy "sees" a target within a **sight angle** around its facing direction and up to a **sight distance**. Test = distance check ([[concept-coordinates-pivots-distance]]) plus compare the direction-to-target angle (Atan2) with the facing angle. Exercise 4: with π/3 FOV the target is visible when the angle difference is within half of it (±π/6). The book builds the FOV cone as a generated mesh. Extensions mentioned: obstacles block view; a gradient FOV models detection probability.
- Enemy awareness ladder: fixed patrol / reverse-at-obstacle (Goombas) → patrol path → react when detected (distance, then FOV).

Next: [[concept-vectors-basics]], [[concept-dot-and-cross-product]] (a cheaper FOV test with dot products).
