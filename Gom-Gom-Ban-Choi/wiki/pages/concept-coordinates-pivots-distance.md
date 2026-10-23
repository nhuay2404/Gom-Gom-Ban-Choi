---
type: concept
source: src-enfield-mathematics-of-game-development
tags: [concept]
---
# Coordinates, pivots and distance

Source: [[src-enfield-mathematics-of-game-development]], ch. 3–4 (pp. 59–89).

## Positions
- A position needs a reference point. Game engines use a **world origin** (0,0) / (0,0,0); x right, y up, z depth (Unity colours XYZ = RGB). The origin can be anywhere.
- 2D web games and UI usually measure from the **top-left corner of the window**, with y increasing downward. Even world-space games often position UI this way.
- Each GameObject also has its own local coordinate system (Unity), which differs from the world axes when rotated.
- **Pivot point**: the single point that stands for an object's position and the centre it rotates about. Moving the pivot (head vs chest vs top-left) changes the position numbers needed to show the same picture. Web engines default to top-left; most engines let you change it. Placing an object on a platform without overhang means accounting for both pivots and sizes (exercise 4, p. 72).

## Distance
- Pythagoras: a² + b² = c². Any triangle splits into two right triangles; any polygon splits into triangles.
- **2D distance**: d = √((x₁−x₂)² + (y₁−y₂)²). Subtraction order doesn't matter (squared). **3D**: add (z₁−z₂)².
- Uses: enemy chases when the player is close enough; grenade damages everything within a radius; select the object nearest a click.
- Sanity check: the hypotenuse is always the longest side.

## Triangle budget (pp. 73–75)
3D models are triangles; low-poly vs high-poly (3,666 vs 69,668 in the book's skull). More triangles cost more per frame (30 fps = redraw 30×/s), so mobile wants low poly; textures add apparent detail without triangles. Relevant to our Deco performance rules in `CLAUDE.md` (merge static meshes, low segment counts).

See also [[concept-trigonometry-and-angles]], [[concept-vectors-basics]].
