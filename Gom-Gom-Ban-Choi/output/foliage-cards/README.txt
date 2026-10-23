FOLIAGE CARDS - PNG FROM THE GAME'S ORIGINAL TEXTURES

These are flat leaf/flower clusters for intersecting planes, not rendered
views of entire models. Original shapes, colors and alpha are preserved.

canopy-sheet.png: 3 columns x 2 rows, 6 foliage clusters.
hydrangea-sheet.png: 3 columns x 3 rows, 9 flower clusters (blue/red/yellow).
lavender-sheet.png: 4 columns x 4 rows, 16 lavender clusters.

Subfolders contain all 31 individual PNG cards.
Row and column numbers start at 1 from the top left.
The hydrangea source height is 760px, so row heights are 253/254/253px.

ASSEMBLY
Use two vertical planes crossed at 90 degrees; optionally add a third at
60 degrees. Apply cards from the same color row with small rotations and
scale variation. Scatter several crossed clusters to form the canopy.
Keep the trunk/branches or underlying bush volume as separate geometry.
These cards do not include trunk or planter geometry.

MATERIAL - MATCH THE GAME
Use a double-sided material with alpha clipping/cutout at 0.5 (128/255),
not fully blended transparency. The original textures contain faint pixels
outside the silhouette that the game's alpha test discards.
Set color space to sRGB. Match shadow alpha cutoff to the color material.
Use the same cutoff in previews to see the intended clean silhouettes.

manifest.json lists the exact dimensions of each individual PNG.
