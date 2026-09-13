# Task: fix robot movement + camera in game.js

Context: `index.html` + `game.js` (Three.js 0.160 via jsDelivr import map, no build
step) load `field.glb`. The glb was just replaced with a much more detailed
version: it now contains a large single mesh named `FieldStructure` (real CAD
geometry of the field boards/shelves, ~16MB) plus the same named gameplay
objects as before (`RSA_Tile`, `Floor`, `Plate_0..2`, ingredients, scoring
zones, `Robot_Chassis`, `Robot_Arm`, etc.). Units: 1 unit = 1 foot. The field is
roughly 13 x 13 ft.

Only edit `game.js` (and `index.html` if strictly needed). Do not touch
`field.glb` or `SPEC.md`.

## Fix these

1. **Driving feels broken / unreliable.** Rewrite the movement in `tick()`:
   - Use `e.code` (`KeyW`, `KeyA`, `KeyS`, `KeyD`, `ArrowUp`, ...) instead of
     `e.key`, ignore `e.repeat`, and `preventDefault()` on arrow keys and space
     so the page never scrolls. Clear all held keys on `blur`.
   - Velocity-based motion with acceleration/deceleration (snappy, arcade
     feel): top speed ~4.5 ft/s forward, ~3 ft/s reverse, turn rate ~3 rad/s,
     reach top speed in ~0.25 s. Turning while stationary must work.
   - Make sure the robot visually faces its driving direction (the
     `Robot_Arm` box marks the FRONT of the chassis). Check how
     `robot.attach(robotVisual)` currently sets things up and fix any
     mismatch between the group's forward axis and the mesh.
   - Clamp the robot inside the playable area: derive a bounding rectangle
     from the `Floor` object's world-space bounding box (`Box3.setFromObject`)
     shrunk by 0.6 ft; never let the robot leave it.
   - Simple collision with `FieldStructure`: after computing the desired new
     position, do a cheap check so the robot cannot drive through the field
     boards. A reasonable approach: build a low-res occupancy grid once at
     load (e.g. 0.25 ft cells) by raycasting downward from above each cell
     center against `FieldStructure` only and marking cells hit above 0.15 ft
     as blocked; then reject moves into blocked cells (try X and Z separately
     so the robot can slide along walls). Keep it fast — it's a one-time
     build.

2. **Camera clips inside geometry.** The chase camera currently ends up
   inside the field structure. Use a higher, further-back offset (about
   (0, 5.5, 7.5) relative to the robot, rotated with it), lerp smoothly, and
   set the camera `near` plane to 0.1. Additionally, raycast from the robot
   toward the desired camera position against `FieldStructure` and pull the
   camera in front of the first hit (minus 0.3) so it never sits inside a
   wall.

3. **Timer display bug.** `Math.ceil(state.time/60)` shows "2:59" right
   after start. Show `mm:ss` from `Math.ceil(state.time)` with
   `Math.floor(total/60)` minutes.

4. **Performance.** `FieldStructure` is heavy: set `castShadow=false` on it
   (keep `receiveShadow`), and don't include it in per-frame interaction
   distance checks. Keep shadows for the small props only.

5. **Restart without reload.** `R` / "Play Again" currently call
   `location.reload()`, which re-downloads the 16MB glb. Instead restore all
   hidden objects (`visible=true` for everything in `state.taken`), reset the
   robot to `RSA_Tile`, call `resetState()`, hide the results panel.

Keep everything else (scoring, interactions, HUD) working exactly as it is.
Verify with `node --check game.js` (or equivalent) that the file parses.
Write a short summary of what changed to `MOVEMENT_RESULT.md`.
