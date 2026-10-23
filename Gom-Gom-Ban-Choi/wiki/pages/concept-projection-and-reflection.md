---
type: concept
source: src-enfield-mathematics-of-game-development
tags: [concept]
---
# Vector projection and reflection

Source: [[src-enfield-mathematics-of-game-development]], ch. 10 (pp. 223–243).

- **Projection of a onto b** ("how much of a goes in b's direction", the shadow of a on b):
  - component (scalar): Comp_b a = |a| cos θ = (a·b) / |b|
  - vector: Proj_b a = ((a·b) / |b|²) · b; with unit b̂: (a·b̂) b̂ (two dot products).
  - sin/cos from [[concept-sinusoidal-motion]] are the special case of projecting onto the vertical/horizontal axis.
- **Reflection** (perfect bounce, no energy loss, same speed, outgoing angle = incoming angle) of v about the surface normal n:
  **v_r = v − 2·Proj_n v**
  (derived with congruent triangles; the projection onto the normal is doubled and subtracted). Physics engines do this on collisions.
- Uses: a ball bouncing off a wall, a laser bouncing off mirrors the player rotates, predicted motion paths (the chapter's "Octagon" project draws a trajectory through repeated reflections).
- Keep n a unit vector to simplify; the wall's normal can come from a cross product ([[concept-dot-and-cross-product]]).

Related: [[concept-vectors-basics]].
