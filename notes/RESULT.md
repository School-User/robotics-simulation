# Byte to Bite

Built a static Three.js single-player 3D game using the supplied `field.glb` and its named scene objects. It includes chase-camera driving, contextual E interactions, ordered meal classification, water/valve rules, all listed one-time bonuses, all scoring zones, 120-second timer, carried-item end scoring, and a score breakdown/results screen.

Run it from this directory with:

```sh
python3 -m http.server
```

Then open `http://localhost:8000`. The game uses only pinned jsDelivr Three.js modules and no build/install step. I simplified presentation rather than adding audio or elaborate robot/field animations; the cyan ring is the nearest-interaction highlight.
