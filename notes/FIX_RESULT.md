# Wall collision fix

- Made the existing 0.85-foot chassis clearance an explicit `ROBOT_RADIUS` in `blocked()`, including boundary contact. Collision boxes now retain their actual wall bounds rather than being pre-inflated; the radius is applied exactly once.
- Replaced fixed 0.1-foot substeps with a limit of half the thinnest transformed wall thickness (capped at 0.1 feet). Large frame movements are split into safe increments without losing free-space travel distance.
- Preserved sequential X/Z resolution for wall sliding: each Z check uses the accepted X position from that substep.
- Kept the collision debug HUD, `dbgpos`, and `Box3Helper` in place. Helpers now display the physical wall bounds; collision clearance extends 0.85 feet beyond them.

Validation: `node --check game.js` passed. Browser-free Node checks of the movement functions passed for radius/contact, thin walls on both axes, forward/reverse large displacements, diagonal sliding, a clear opening, free movement distance, and floor clamping. No browser was launched; visual verification remains pending.

## Standing-panel investigation

Added `inspect-field-bounds.mjs`, a standalone Node script using
`@gltf-transform/core`. It lists all 65 nodes with world-space min/max and
dimensions, calculated from mesh vertices and full world transforms (including
descendants). The complete output is saved in `FIELD_NODE_BOUNDS.tsv`.
The inspection dependency was installed under `/tmp/byte-to-bite-inspect`,
without adding game runtime dependencies. Run it with:

```sh
NODE_PATH=/tmp/byte-to-bite-inspect/node_modules node inspect-field-bounds.mjs
```

No separately named tall panel matches X=2..4, Z=6..10. Closest candidates:

| Node | World min (X, Y, Z) | World max (X, Y, Z) | Assessment |
| --- | --- | --- | --- |
| `FieldStructure` | (-1.3750, 0, -1.3750) | (11.8125, 2.3333, 11.8125) | Likely contains the panel as part of the combined CAD mesh; its full bounds are unsuitable for a collision box. |
| `WarmingShelf` | (1.1000, 0.3300, 10.6000) | (4.7000, 0.3300, 11.3000) | Nearby scoring marker, but horizontal and zero-height, not an upright panel. |
| `BalanceBuffetShelf` | (0.2500, 0.4200, 6.9800) | (1.2500, 0.4200, 8.3800) | Another nearby horizontal, zero-height scoring marker, not an upright panel. |

Cross-check: `named` includes every named scene node, not just `targetNames`.
`SPEC.md` mentions `DiningWall_A`/`DiningWall_B`, but neither exists in this
GLB. `RESULT.md` gives no separate panel name; `ANIMATION_RESULT.md` documents
the four measured CAD wall segments and exclusion of detailed fixtures.

Stopped pending identification confirmation rather than guessing: no fifth
box was added and `game.js` was left unchanged. A marked screenshot or an
exact mesh/primitive identification is needed to isolate the panel within
`FieldStructure`. Note that `Box3.setFromObject()` already produces world-space
bounds; applying the object's world matrix again would double-transform them.

Validation: `node --check game.js` and `node --check inspect-field-bounds.mjs`
passed; the inspection script successfully loaded the GLB and listed every
node. No browser was launched.

## Primitive-level follow-up

Added `inspect-field-primitives.mjs` and saved its full output to
`FIELD_PRIMITIVE_BOUNDS.json`. The script reads raw GLB JSON POSITION accessor
min/max values, verifies them against decoded vertices, and transforms all
eight bounding-box corners using FieldStructure's world matrix. That matrix
is identity in this asset, so local and world bounds are identical.

FieldStructure (mesh 11) has only three primitives (zero-based indices):

| Primitive | Material index / name | Local = world min (X, Y, Z) | Local = world max (X, Y, Z) |
| --- | --- | --- | --- |
| 0 | 11 / `WoodMat` | (-0.9167, ~0, -0.5000) | (11.8125, 2.3333, 11.8125) |
| 1 | 12 / `CloseWall_XMat` | (-1.3750, 0, -1.3100) | (-1.2250, 1.5000, 11.7900) |
| 2 | 13 / `CloseWall_YMat` | (-1.3100, 0, -1.3750) | (11.7900, 1.5000, -1.2250) |

No primitive isolates the described panel. Primitive 0 overlaps the requested
region but combines a broad expanse of CAD geometry; primitives 1 and 2 are
the already-covered perimeter walls outside the region. Filtering for region
overlap and wall-like proportions returned no candidates, even allowing
height up to 2.5 feet. If the panel is in FieldStructure, it must be part of
primitive 0 (`WoodMat`); separating connected geometry or spatially inspecting
its triangles is needed to obtain a panel-specific bounding box.

The script ran successfully, decoded bounds matched accessor metadata, and
`node --check inspect-field-primitives.mjs` passed. No collision changes or
browser launch were made; panel identification is still unresolved.

## Confirmed panel collision added

The user identified the panel through the live click debugger and connected-
triangle flood-fill, not CAD inspection: world hit (0.030, 0.625, 7.510),
FieldStructure primitive 0 (`WoodMat`), face 73657. The connected island
contained 3,796 of 296,138 triangles, with bounds X=-0.031..0.031,
Y=0.333..0.625, Z=6.344..9.010. FieldStructure's identity world matrix makes
these X/Z coordinates valid as local segment coordinates.

Added `[-0.031, 0.031, 6.344, 9.010]` as the fifth collision segment, using
the same Y=0..1.5 collision height and world transform as the other walls.
The existing 0.85 robot radius applies automatically; the 0.062 panel
thickness reduces the movement substep limit to 0.031. The debug HUD,
Box3Helper boxes, and temporary click/flood-fill debugger remain in place.

Validation: `node --check game.js` passed. No browser was launched; live
verification of the new collision remains pending.
