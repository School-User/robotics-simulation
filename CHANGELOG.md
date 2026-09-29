# Changelog

Every update to the Byte to Bite simulation, newest first. Dates are 2026, Mountain time.

- **Live** means the change is on the public site (`main` branch).
- **Local** means it exists only in the `history` branch and on the developer's laptop.

To see the code for any version, open the [`history` branch commits](https://github.com/School-User/robotics-simulation/commits/history). The live site's own changes are in the [`main` commits](https://github.com/School-User/robotics-simulation/commits/main).

| Date | Update | Built with | Status |
|---|---|---|---|
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
