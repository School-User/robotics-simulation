# Urgent perf fix: page hangs on load

`buildCollisionMap()` in game.js raycasts once per occupancy-grid cell
(~50x50 = 2500 cells) against `FieldStructure`, which is now a much heavier
real-CAD mesh (tens of thousands of triangles, single merged object). This
raycasting loop runs synchronously on load and is freezing/hanging the tab —
it never finishes in reasonable time.

Fix: drop the per-cell raycast entirely. Replace the fine occupancy-grid wall
collision with something cheap:

- Keep the existing floor-bounds rectangle clamp (from `Floor`'s world
  bounding box, shrunk by 0.6) — that already works and is cheap.
- For `FieldStructure` collision, do NOT raycast against the full mesh.
  Instead compute one axis-aligned bounding box for the whole
  `FieldStructure` object once (`new THREE.Box3().setFromObject(fieldStructure)`)
  and skip wall collision inside it entirely for now — rely on the floor
  bounds and the fact that gameplay props (stations/zones) are laid out with
  clearance. If you want basic wall avoidance, you may instead sample a
  small fixed number (e.g. <= 8) of manually-placed cheap collision boxes
  around the known interior wall segments (list is small — look at where
  `FieldStructure` sits relative to `Floor`, e.g. along the two closing
  walls), but do not do any per-frame or per-cell raycasting against the
  full CAD mesh.
- Remove/disable `buildCollisionMap`'s raycasting loop so nothing freezes on
  load. It's fine if wall collision is coarse or absent for this MVP.

Verify manually that the page loads and the robot can drive around within a
couple seconds of `field.glb` finishing download (no long synchronous
blocking loop). Run `node --check game.js` and update MOVEMENT_RESULT.md
with a one-line note about this fix.
