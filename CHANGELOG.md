# Changelog

Every update to the Byte to Bite simulation, newest first. Dates are 2026, Mountain time.

- **Live** means the change is on the public site (`main` branch).
- **Local** means it exists only in the `history` branch and on the developer's laptop.
- **Private repo** is retired: the private `robotics-simulation-multiplayer` repo is archived. All work now goes to this public repo.

To see the code for any version, open the [`history` branch commits](https://github.com/School-User/robotics-simulation/commits/history). The live site's own changes are in the [`main` commits](https://github.com/School-User/robotics-simulation/commits/main).

| Date | Update | Built with | Status |
|---|---|---|---|
| Oct 30 | 10 of each Dairy, Protein, Grain and Veg per quadrant (was 3/3/3/6), in solo and multiplayer: Dairy, Protein and Grain are one stack per box sunk under the floor, so only the top 3 show and the stack rises as items are taken; Veg adds a second column and the Fridge and Breadbox tiles stay exactly as in the GLB. | freebuff (DeepSeek V4.1 Flash) | Local |
| Oct 28 | Dining tables block movement like walls, in single player and multiplayer. Reach for pressing E is unchanged. | freebuff (DeepSeek V4.1 Flash), reviewed by Claude Code (Haiku 5.5) | Live |
| Oct 28 | Multiplayer disconnect notice: a dropped connection, a full room, or an unreachable server now shows a message that stays on screen. A stale lobby countdown is cleared on disconnect. | Claude Code (Haiku 5.5) | Live |
| Oct 26 | Multiplayer server moved from Render to a Google Cloud VM (e2-medium, us-central1) with HTTPS through Caddy. Load-tested with 20 simulated players across five rooms. | Claude Code (Haiku 5.5) | Live |
| Oct 26 | Restart removed from multiplayer: R, gamepad B/Start and Play Again no longer reset a live room. Single player keeps restart. | Claude Code (Haiku 5.5) | Live |
| Oct 26 | 8 plates and 8 cups per player, placed on each player's own side (replaces the Oct 1 layout). Match is 3 minutes in both modes. Single player timer shows 3:00; menu heading reads "Pick a Mode". | Claude Code (Haiku 5.5) | Live |
| Oct 26 | Field 1.5x bigger; robots at 52.5% of original size; slower driving (forward 2, reverse 1.5). Collision radius unchanged. | Claude Code (Haiku 5.5) | Live |
| Oct 26 | Fix: single player never offered the dining table score option. Tables are now registered in solo mode too. | Claude Code (Haiku 5.5) | Live |
| Oct 26 | README rewritten for modes, controls, hosting and local run. Private repo archived; all work is now in this public repo. | Claude Code (Haiku 5.5) | Live |
| Oct 13 | Anonymous visit counter: first visit asks Allow or Reject, and each choice is counted once. Allow also logs one anonymous row per play. | Claude Code (Sonnet 5.5) | Live |
| Oct 1 | 9 plates and 6 cups (was 3 and 2), moved off the start tile to the open floor by the outer wall. In multiplayer they sit just across the line in the neighbouring quadrant; in single player, at the same spot inside the quadrant. | Claude Code (Opus 5.5) | Private repo |
| Oct 1 | Multiplayer made ready to test: 15-second lobby before each match (no joining mid-match), match clock kept by the server so every player stays in sync, and a fix for a crash when joining while the field was still loading. | Claude Code (Opus 5.5) | Private repo |
| Sep 29 | Credit line: "Made using AI · by Siddh Patel, Team Rock Canyon High School". This changelog and the `history` branch. | Claude Code (Opus 5.5) | Live |
| Sep 22 | Single-player aerial view is centered on the one quadrant instead of the full field. | Claude Code (Sonnet 5) | Local |
| Sep 20 | Start screen to choose **Single Player** (one quadrant) or **Multiplayer** (full field). | Claude Code (Sonnet 5) | Local |
| Sep 20 | Full 4-quadrant field for multiplayer, built by mirroring one quadrant, with red, yellow, green and blue quadrants. | Claude Code (Sonnet 5) | Local |
| Sep 20 | USB gamepad support through the browser Gamepad API (tested with a Logitech F310). | OpenCode + Qwen3-Coder 30B, managed by Claude Code | Live |
| Sep 20 | Top-down mini map on the right side of the screen. | OpenCode + Qwen3-Coder 30B (local model), playtested by Hermes Agent (DeepSeek V4 Flash) | Live |
| Sep 18 | Multiplayer client and a small Node.js WebSocket room server. | Claude Code (Sonnet 5) | Local |
| Sep 18 | Published on GitHub Pages. Supabase username leaderboard added, debug overlays removed, and the two open field edges closed with walls. | Claude Code (Sonnet 5) | Live |
| Sep 16–17 | Wall collision and extra wall barriers, tested wall by wall in a browser. | Codex CLI (gpt-6-astra), tested by Hermes Agent | Live (part of the Sep 18 release) |
| Sep 15–16 | Drive the robot with a real VEX EXP controller: a program on the VEX EXP Brain sends the joystick over USB, and a Python bridge passes it to the game. | Claude Code (Sonnet 5) | Local (needs the Brain plugged into the computer) |
| Sep 13 | Robot movement fixes and a performance fix. | Codex CLI | Live (part of the Sep 18 release) |
| Sep 12–13 | First playable browser game (Three.js), built from the official field converted in Blender. | Codex CLI, Blender MCP, Claude Code | Live (part of the Sep 18 release) |
| Sep 12 | Downloaded the official BEST "Byte to Bite" field files. | Claude Code | Not code |
