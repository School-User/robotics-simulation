# Byte to Bite — browser mini-game spec

Build a small single-player 3D browser game based on the BEST Robotics 2026
"Byte to Bite" competition field. A 3D field model (`field.glb`, already in
this folder, exported from Blender) contains named objects you should look up
by name via `scene.getObjectByName(...)` after loading — use their real
transforms from the glTF rather than hardcoding positions, but the approximate
layout is described below so the interactions make sense.

## Deliverable

Plain static files, no build step, no bundler, no npm install:
- `index.html` — page shell, canvas, HUD overlay (score/timer/held-plate/
  prompts), minimal CSS.
- `game.js` — ES module with all game logic.

Load Three.js and GLTFLoader as ES modules straight from jsDelivr, pinned to
an exact version, via an import map in `index.html`, e.g.:

```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module" src="game.js"></script>
```
```js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
```

No other dependencies. No relative imports besides `field.glb`. This needs to
be viewable by just opening `index.html` in a browser (or via a trivial
static file server) — nothing server-side.

## Camera & controls

Third-person chase camera behind the robot. Controls:
- `W A S D` / arrow keys — drive the robot (simple arcade movement: forward/
  back speed + turn rate is fine, no need for real vehicle physics)
- `E` — context-sensitive interact (pick up plate/cup, add ingredient, open
  fridge/breadbox, turn irrigation valve, turn drone crank, place/score
  meal — whatever is valid at the robot's current location; show an on-screen
  prompt like "Press E to pick up Plate" whenever something is interactable)
- `R` — restart the match
- Timer: 120 seconds per match, shown in the HUD, counting down. When it
  hits 0, end the match: whatever meal is currently on the robot (if
  complete/valid) scores at the base "robot carried" rate, then show a
  results screen (score breakdown + "Play Again" button that calls `R`'s
  restart logic).

## Field layout (from the exported Blender scene — look these objects up by
name, don't hardcode coordinates)

- `RSA_Tile` — red robot start tile. Robot spawns here.
- `DriverBox_Tile`, `QCA_Tile` — Quality Check Area scoring zone near the RSA.
- Garden stations along the back wall, left to right: `Fridge` (with
  `Dairy_0..2` and `Protein_0..2` children nearby), `Breadbox` (with
  `Grain_0..2`), `VegTray` (with `Veg_0..5`), `FruitFrame` (with
  `Fruit_0..5`), `WaterStation` (with `Water_0..7`).
- `DronePost` / `Drone` — crank/activate near the fruit & water end.
- `IrrigationValve` — near the water station.
- `WarmingShelf` — scoring zone near the RSA end.
- `BalanceBuffetShelf` — scoring zone on the far wall.
- `DiningWall_A`/`DiningWall_B`, `Table_0..3` (each with a
  `TableFiducial_i` on top) — the shared autonomous dining corner; driving
  onto a free table and interacting scores it.
- `Plate_0..2` / `PlateStem_i`, `Cup_0..1` — pick-up-able plates/cups near
  the RSA (dish starting area). Robot can carry at most one plate and one cup
  at a time.
- `Robot_Chassis` / `Robot_Arm` — use as the player's robot mesh (drive this
  group; you can ignore/hide the placeholder arm or animate it lightly).

## Ingredients & meal-building

Ingredient types, each pickable by driving near it and pressing `E` (this
removes it from the world and adds it to the currently-held plate's stack,
tracked as an **ordered list of ingredient types** — order matters only for
grain, per the rules below). Show the current plate's stack as small icons/
labels in the HUD.

Types: `vegetable`, `fruit`, `dairy`, `protein`, `grain`, plus `water` (goes
in a held cup, not the plate).

To hold ingredients at all, the robot must first be carrying a `Plate`
(pick one up from the dish area near the RSA). To hold water, it must first
be carrying a `Cup`, AND the `IrrigationValve` must have been activated
(press `E` on it once — this also scores a one-time bonus, see below) before
water balls can be picked up from `WaterStation`.

### Meal classification (evaluate on the plate's ordered ingredient-type list)

- **Salad**: at least 2 distinct ingredient types on the plate, in any order.
- **Pizza**: the *first* ingredient added is `grain`, followed by at least 3
  more distinct non-grain types (any order after the grain).
- **Sandwich**: the *first* ingredient added is `grain` AND the *last* is
  also `grain`, with at least 4 distinct non-grain types added in between.
- A plate can only ever complete one meal at a time; classify it as the
  best (highest-scoring) meal type it currently satisfies (Sandwich >
  Pizza > Salad). Ingredients themselves never score — only a completed
  meal placed in a scoring zone (or held at match end) scores.
- A drink = a `Cup` containing at least one `water` ball, held upright. An
  empty cup or loose water ball never scores.

## Scoring (press `E` while in a zone with a valid meal/drink to place +
score it; this also frees the plate/cup so the robot can grab a new one)

| Where | Salad | Pizza | Sandwich |
|---|---|---|---|
| On robot / in field (at match end, if still holding a valid meal) | 10 | 30 | 50 |
| Warming Shelf (adds to the above) | +5 | +5 | +5 |
| Balance Buffet (adds to the above; treat as always "balanced" for this game) | +15 | +15 | +15 |
| Dining Room table (adds to the "in field" base value above) | +50 | +50 | +50 |
| Quality Check Area (its own separate rate, not additive with the above) | 5 | 15 | 25 |

Drinks:
- Filled drink alone, on robot/in field: 4 pts. In the QCA alone: 2 pts.
- Filled drink added on top of a *scoring* meal's plate: +12 pts (in
  field/robot/warming/balance/dining), or +6 pts if the meal is scoring in
  the QCA. At most one drink counts per meal.

One-time bonus tasks (each can only score once per match):
- Turn the `IrrigationValve` (press `E` near it): +4 pts, and this is what
  unlocks picking up water balls.
- Activate the `Drone` via `DronePost` (press `E` near it, maybe require a
  couple of presses to "crank" it across): +8 pts.
- Fully empty the `VegTray` (`Veg_0..5` all collected): +4 pts.
- Fully empty the `FruitFrame` (`Fruit_0..5` all collected): +4 pts.
- Fully empty the `Fridge` of both dairy and protein: +8 pts.
- Fully empty the `Breadbox` (`Grain_0..2` all collected): +8 pts.

## HUD

- Score (running total) and countdown timer, always visible.
- What the robot is currently carrying (plate contents as an ordered list/
  icons, cup/drink status).
- A single contextual prompt line for the nearest available interaction
  ("Press E to pick up Plate", "Press E to add Vegetable to plate", "Press E
  to score Salad on Warming Shelf", etc.) — only show one at a time, whichever
  is closest/most relevant.
- On match end: full-screen results panel with a breakdown of points scored
  (by category) and total, plus a "Play Again" button.

## Polish (nice to have, not blocking)

- Simple SFX-free "pop"/scale animation when picking up or scoring something.
- A subtle highlight (outline or floating arrow) over the nearest
  interactable object.
- Keep frame rate smooth with plain `requestAnimationFrame`; no physics
  engine needed, simple distance checks are fine for pickup/scoring ranges.

Please implement this fully working end-to-end, then briefly tell me how to
run it (e.g. `python3 -m http.server` in this folder) and note anything you
simplified or couldn't fit.
