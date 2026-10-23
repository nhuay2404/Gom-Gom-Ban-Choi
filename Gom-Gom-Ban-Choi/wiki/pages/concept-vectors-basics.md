---
type: concept
source: src-enfield-mathematics-of-game-development
tags: [concept]
---
# Vectors and matrices basics

Source: [[src-enfield-mathematics-of-game-development]], ch. 6 (pp. 121–164).

- **Vector** (Euclidean): magnitude + direction, no position. Two vectors are equal if both match (e.g. AB from (1,1)→(4,2) equals CD from (7,2)→(10,3): both √10, slope 1/3). In code a vector is a list of scalars; a vector is a matrix with one row or column. Typical uses: position, rotation, scale, velocity, force. In Unity: Vector2/Vector3.
- Point (2,−4,7) ≠ vector ⟨2,−4,7⟩: a point has position only; a vector has direction and magnitude. A **position vector** starts at the origin so its components equal its endpoint; this simplifies slope (v₂/v₁) and magnitude (√(v₁²+v₂²+v₃²)).
- **Add** same-size vectors component-wise (order irrelevant): position [1,3] + movement [5,−2] = [6,1]. Visualise head-to-tail.
- **Subtract** to get the vector from one object to another: B − A = A→B (order matters, reverses direction). A − B = A + (−B), easier to visualise.
- **Scalar multiply** scales length; **negate** (×−1) reverses direction (move backward = −forward).
- **Magnitude** = distance formula from the origin ([[concept-coordinates-pivots-distance]]).
- **Normalize**: v̂ = v / |v| → unit vector (length 1, same direction), derived with similar triangles. Standard for directions so that `velocity = direction × speed` has magnitude = speed. Unity: `Normalize()`. Careful: `Vector3.one` = (1,1,1) is not a unit vector. Don't confuse vector *norm* (magnitude), *normal* (perpendicular to a surface) and *normalized* (unit length).
- **Transpose** swaps rows/columns so a 1×3 can match a 3×1 for multiplication. Matrix multiplication needs inner dimensions to match and each result cell is a dot product ([[concept-dot-and-cross-product]]).
- Movement pattern: `position += direction.normalized × speed × deltaTime`.
