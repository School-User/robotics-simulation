# Collision and interaction animations

## Changes in game.js

Inspected `field.glb` directly by decoding its position/index accessors and
rendering a top-down projection of the CAD triangles offline. `Floor` is a
single rectangle (four vertices, two triangles), spanning approximately
-1.30 to 11.78 in both X and Z; it has no internal holes.

Four static collision boxes describe the actual wall runs, in FieldStructure
local coordinates, transformed once into world space:

| Wall | X interval | Z interval |
| --- | --- | --- |
| Dining divider | -0.271 to 3.500 | 5.500 to 5.803 |
| Garden divider | 5.500 to 5.803 | 0 to 5.803 |
| West closing wall | -1.375 to -1.225 | -1.310 to 11.790 |
| North closing wall | -1.310 to 11.790 | -1.375 to -1.225 |

Boxes use 0.85 units of chassis clearance to cover the rotating 1.2 × 1.2
chassis. The original 0.6 Floor padding gains 0.25 corner clearance. Separate
X/Z checks allow wall sliding; movement substeps of at most 0.1 prevent
crossing a wall in one update. The doorway between the dividers remains open.
There are no CAD raycasts, occupancy grids, or runtime CAD triangle scans.
Movement reuses its temporary vectors.

Plate, cup, ingredient, and water pickups now use a 0.4-second arcing
lerp/scale animation into visible carried meshes. Ingredients stack above
the plate; water attaches to the cup. Scoring animates the consumed items
toward the scoring zone and scales them out over 0.5 seconds. Empty cups
and unscored plates remain held. State and points update immediately;
animations continue independently, including at match end. Restart removes
all animation meshes and restores the original items and plate stems.
The small geometries/materials are shared; tween updates reuse one vector
and are driven by the existing clock delta. No dependencies were added.

Interaction range now measures ground-plane distance so elevated water
balls are reachable. Scoring measures distance to the cached zone surface
rather than its center, keeping QCA accessible from inside the field edge.

## Verification and limitations

- `node --check game.js` passed.
- A temporary Node harness using extracted game functions and lightweight
  vector/scene test doubles passed: both faces of both interior walls,
  doorway passage in both directions, diagonal sliding, all four floor
  edges, large-step tunnelling prevention, plate/ingredient/cup/water
  tweens, moving carry targets, selective meal/drink delivery, and cleanup.
- **Visual browser verification could not be completed.** Actual launch
  attempts were made with installed Chromium (including a second launch
  with crash reporting disabled) and Firefox. Chromium exited with
  `setsockopt: Operation not permitted (1)`; Firefox exited with code 139.
  `python3 -m http.server 8000` also failed with a socket-creation
  `PermissionError: [Errno 1] Operation not permitted`. This environment
  does not permit approval escalation. No rendered gameplay screenshot
  was obtained, and browser load time, frame rate, and visual correctness
  remain unverified. The offline CAD projection and Node harness do not
  substitute for browser verification.
- Collision intentionally covers walls and the Floor perimeter, not tables
  or detailed station fixtures. Boxes are specific to the supplied GLB;
  replacing its geometry requires rechecking their coordinates. Doorway
  clearance is conservative. Carry meshes are stylized primitives, and
  large ingredient stacks can become tall.

For remaining browser verification, run `python3 -m http.server 8000` in an
environment allowing local sockets and open `http://localhost:8000`.
Drive against both divider faces, through the doorway near X=4.5, and toward
each perimeter edge. Pick up a plate, two ingredient types, and a cup;
activate the valve, collect water, and deliver to a scoring zone. Check
pickup/delivery motion, restart during a tween, and sustained frame rate.
