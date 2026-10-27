# Byte to Bite: Robotics Simulation

A 3D browser game that recreates the 2026 BEST Robotics "Byte to Bite" field, built by the Rock Canyon High School team to practice driving and strategy before the real robot exists. Plain Three.js, no build step.

**Play it:** https://school-user.github.io/robotics-simulation/

## Modes

- **Single Player:** one quadrant of the field, no server needed. The game runs entirely in your browser.
- **Multiplayer:** the full field with up to four robots per room, one per quadrant. Each match has a 15-second lobby (no joining mid-match) and a 3-minute clock run by the server. Restart is off in multiplayer, so a stray keypress can't reset a live match.

Each player gets 8 plates and 8 cups on their own side, 32 of each in the whole game.

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
- **Multiplayer** runs on a Google Cloud VM (e2-medium, us-central1) behind Caddy, which handles HTTPS. Pages connects to it over `wss://`.
- Load-tested with 20 simulated players across five rooms; the server stayed well under its memory limit.

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
