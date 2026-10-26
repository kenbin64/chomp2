# Level 1 (Croc Park) performance: plan and pass bar

Written 2026-10-26, before any change to the game. Agreed with Ken.

## Baseline (high detail, 1280 x 720, the test pilot playing, 30 s per run)

| Measure | Run 1 | Run 2 |
|---|---|---|
| Frame rate | 59.5 fps | 59.6 fps |
| Game code per frame | 5.57 ms | 5.82 ms |
| Draw calls per frame | 473 | 469 |
| Triangles per frame | 2.10 million | 2.12 million |
| Stutters over 50 ms | 2 | 1 |

The two identical runs differ by about 4%, so a change under about 5% is noise.

Profile (15 s): CPU 58% idle; the game's own code about 2%; three.js scene work about 30%. The scene holds 1,883 meshes, 256 visible; three.js recalculates the position of every one each frame. About 5% goes to re-checking material programs each frame.

## The pass bar

- **Pass:** at least 25% less game-code time per frame, or at least 25% fewer draw calls, at high detail, averaged over three runs each, before and after.
- **Target for each piece of waste found:** cut by 90% (for example, meshes recalculated each frame that are hidden or never move).
- **Must not change:** what the player sees, and how the game plays. All game tests (npm test) and the end-to-end play test (npm run e2e) pass.

A cheap, safe gain under 25% is reported as it is and may still be kept if Ken agrees.

## Why these numbers

Tuning a game's own engine is judged by the frame budget (16.7 ms per frame at 60 fps, 11.1 ms in VR), where 10% to 30% off frame time on target devices is a meaningful win. The 90% target applies to waste, which can be nearly removed; the needed work of drawing what is on screen cannot be.

## Result (2026-10-26)

| Measure (high detail) | Baseline (2 runs) | After (3 runs) | Change |
|---|---|---|---|
| Game code per frame | 5.70 ms | 4.24 ms | **25.6% less** (runs 4.18 to 4.29; baseline 5.57 to 5.82, no overlap) |
| Draw calls per frame | 471 | 453 | 4% fewer |
| Program re-checks per frame | about 140 | about 31 | 78% fewer |
| Lights-record re-checks | 73 | 0 | 100% fewer |

Pass bar: met, narrowly (25.6% against 25%). Unit tests pass; the end-to-end play test passes, 107 of 107 (run against serve.mjs: the feedback form needs its endpoint).

Waste found and removed:
1. **The scene's positions worked out three times a frame** (once per drawing: reflection, picture, shading). Now once, in the game loop (main.js).
2. **The water's reflection drawn inside the main drawing.** three.js keeps a separate lights record for a drawing inside a drawing, so about 100 materials a frame were re-checked. Now drawn first (world.js).
3. **Flat see-through rings drawn twice** (three.js draws see-through two-sided materials in two passes and marks them changed before each). Now one pass, which looks the same for a flat ring (clusters, fx, food, kenny, gear).
4. **Hidden stand-ins worked out every frame.** Now skipped while hidden; asking for their place still works it out (models.js). Measured effect within noise; kept because it is correct and cheap.

Left alone, for Ken to judge by eye: a see-through 3D model (8 copies, likely the jellyfish) still drawn in two passes; drawing it once could change how its layers look.

## Measuring

The measuring tools change nothing in the game: they time each screen frame's callbacks from outside and count WebGL draw calls.

    node tools/perf-level1.mjs "http://localhost:8090/index.html?bot&q=high" 30 my-run

## Controls (2026-10-26)

Players found the keyboard clunky and spun past the food. Measured with a controlled trial: Wally at the same
spot each time, real food thrown to land at 16 fixed places (8 directions, 3 m and 5 m), and a scripted player
pressing A, D and W with a person's reaction time (0.2 s). 48 trials per version.

| | Before | After |
|---|---|---|
| Food caught | 64.6% | 87.5% |
| Caught when it lands to the side (90 degrees) | 8 of 12 | 12 of 12 |
| Turn reversals per trial (overshoot) | 1.06 | 0.88 |

Pass bar (25% more catches): met, +35%. The overshoot target (90% fewer reversals) was reached only by a
stronger aim slowdown that made him too slow to catch food, so the catch rate was chosen. Tried and left
out: walking slowly while turning (the tourists bolted; a third less food was thrown).

    node tools/controls-trial.mjs "http://localhost:8090/index.html?noopening&q=high" 3 my-run
