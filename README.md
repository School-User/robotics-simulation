# Byte to Bite: Robotics Simulation

A 3D browser game that recreates the 2026 BEST Robotics "Byte to Bite" field, built by Siddh Patel at the Rock Canyon High School team to practice driving and strategy before the real robot exists. Plain Three.js, no build step.

**Play it:** https://school-user.github.io/robotics-simulation/

## Modes

- **Single Player:** one quadrant of the field, no server needed. The game runs entirely in your browser.
- **Multiplayer:** the full field with up to four robots per room, one per quadrant. Each match has a 15-second lobby (no joining mid-match) and a 3-minute clock run by the server. Restart is off in multiplayer, so a stray keypress can't reset a live match.

Each player gets 8 plates and 8 cups on their own side, 32 of each in the whole game.

Every quadrant also has 10 each of Dairy, Protein, Grain and Veg. Every point award is doubled (`SCORE_MULT = 2` in `game.js`) so scores can go past 300; set it to 1 for the official BEST values. Dining tables block movement like walls.

## Graphics and settings

Open Settings with the gear button or Esc. Choices are saved in your browser.

- **Graphics quality:** Auto (default, steps down if frames drop), Low, Medium or High.
- **Frame rate cap:** 30, 60 or Max. The game also skips drawing behind the menu and when the tab is unfocused.
- **RTX mode:** off by default. Adds ambient occlusion, bloom, 4096 shadow maps and full-resolution rendering for a ray-traced look. It is post-processing, not real ray tracing, and it needs a strong GPU.
- **Minimap** and **FPS counter** toggles.
- **Robots:** pick one of four designs (Scout, Tank, Rover, Hover) on the start menu. They are cosmetic; collision is the same for all.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Drive / turn | WASD or arrow keys | Left stick / right stick |
| Pick up / deliver | E | A |
| Restart (Single Player only) | R | B |

Gamepads use the browser Gamepad API.

## Run locally

Single player: serve the folder with any static server and open it.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Multiplayer: the Node server serves the game and the WebSocket on one port.

```bash
cd server && npm ci && node server.mjs   # http://localhost:8080
```

- `PORT` sets the port (default 8080).
- `/health` returns `ok` for uptime checks.
- To point a page at a different server, use `?ws=wss://host` or change `MP_SERVER` in `index.html`.

## How it's hosted

- **The game** is on GitHub Pages, so players only need the link.
- **Multiplayer** runs on Google Cloud Run (us-central1, one instance). Cloud Run scales to zero when idle, so the first player after a quiet spell may wait a few seconds. Pages connects over `wss://` to the `run.app` address, which school web filters let through (the earlier `sslip.io` address was blocked).
- Load-tested with 20 simulated players across five rooms on the earlier Google Cloud VM host; the server stayed well under its memory limit.

## Files

- `index.html`: page, start menu, and the `MP_SERVER` setting
- `game.js`: the game (field, robot, scoring, input, multiplayer client)
- `server/server.mjs`: room server (lobbies, match clock, pose relay, item claims)
- `field.glb`: the field model
- `plays-setup.sql`: Supabase tables for the anonymous visit counter
- `CHANGELOG.md`: every update, with the branch it lives on

## Notes

- Field geometry comes from the official BEST Robotics field CAD and drawings.
- Scores are client-reported and submitted to a public leaderboard, so they are honor-system.
- The server does not validate robot movement; it only relays positions and arbitrates item claims (first claim wins).
