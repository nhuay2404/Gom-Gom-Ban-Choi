---
type: concept
source: src-enfield-mathematics-of-game-development
tags: [concept]
---
# Dot product and cross product

Source: [[src-enfield-mathematics-of-game-development]], ch. 8–9 (pp. 187–222).

## Dot product (result: a scalar)
- a·b = a₁b₁ + a₂b₂ + a₃b₃ = |a||b|cos θ (θ in 0…π). Commutative, distributive.
- v·v = |v|² (squared magnitude, cheap since no square root).
- **Angle between vectors**: θ = cos⁻¹( a·b / (|a||b|) ). Smallest angle only.
- **Direction test without computing the angle**:
  - dot > 0 → acute (roughly the same way); dot = 0 → perpendicular; dot < 0 → obtuse (roughly opposite).
  - For **unit vectors** a·b = cos θ: 1 = same direction, 0 = orthogonal, −1 = opposite. (Typical uses: "is the target in front of me", field-of-view check, UI behaviour, speed along a heading.)
- **Parallel** if the angle is 0 or π, or if one vector is a scalar multiple of the other.
- Axis vectors (1,0,0), (0,1,0), (0,0,1) are mutually orthogonal (dot 0).

## Cross product (result: a vector, 3D)
- a×b is orthogonal to both a and b; direction by the **right-hand rule**; b×a = −(a×b).
- Computed as the determinant of the 3×3 matrix with î ĵ k̂ in the first row: components (a₂b₃−a₃b₂, a₃b₁−a₁b₃, a₁b₂−a₂b₁). Example: (3,4,0)×(5,6,2) = (8,−6,−2) (check: dots with a and b are 0).
- Magnitude |a×b| = |a||b| sin θ (derived via the identity |a×b|² = |a|²|b|² − (a·b)²). Maximal at 90°, zero when parallel.
- a×b = 0 (non-zero vectors) ⇒ parallel; a·b = 0 ⇒ perpendicular.
- **Area**: parallelogram on a and b = |a×b|; triangle = |a×b| / 2 (e.g. triangle from three 3D points).
- **Normal** of a plane/triangle = cross product of two non-parallel vectors in it (QR×QS and QS×QR point opposite ways). Normalized normal = unit normal. Unity Plane: `Set3Points` (clockwise seen from above), `SetNormalAndPosition`.
- ijk notation: v = v₁î + v₂ĵ + v₃k̂ (handy for the determinant).

Related: [[concept-vectors-basics]], [[concept-projection-and-reflection]].
