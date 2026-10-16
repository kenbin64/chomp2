# Chomp 3D: Wally's Cairns Adventure (working document)

Read this first if you are an AI (or a person) picking up the project. It says what the game is, how to
run and test it, where every file and asset lives, how the assets were made, what is in progress, and how
to work alongside another AI without overwriting each other. Keep it current: when you finish something,
update **Status** and add a line to the **Log** at the bottom.

Owner and director: Ken Bingham. The ideas, story and art direction are his; AI sessions implement and test.

## What it is

A 3D browser game (three.js r186, plain JavaScript modules, no build step) for PC and phone. Wally the Cairns
Crocodile, a friendly croc in an orange Hawaiian shirt and a safari helmet, travels around Cairns, Far North
Queensland, catching the food visitors throw. Kenny the Koala is his sidekick and rescues him with Vegemite
when he runs out of puff or air. The look is "animated feature": realistic light, water, scenery and
materials, with stylised characters.

The trip (areas, in order; `js/quests.js` `AREAS`, unlocks in `js/progress.js`):

| # | Area | State | Page and code |
|---|---|---|---|
| 1 | Croc Park | playable | `index.html`, `js/main.js`, `js/world.js` |
| 2 | The Esplanade, with the reef dive | playable | `esplanade.html`, `js/levels/esplanade*.js`, `js/levels/reef-*.js` |
| 3 | Daintree River | not started | |
| 4 | Mossman Gorge | not started | |
| 5 | Kuranda | not started | |
| 6 | Green Island and the Great Barrier Reef | not started | |

### Level 1: Croc Park
Feed out every group of visitors around the lagoon (they throw when Wally is in the "sweet spot": close, not
too close). Thieves: pelicans (swim and walk onto land to scoop missed food), flying foxes (swoop in the air),
cane toads (food on the ground), other crocs (in the water). Box jellyfish sting. Kenny brings Vegemite toast
when the feed-o-meter is in the red.

### Level 2: The Esplanade and the reef (Ken's design, 2026-10-16)
1. **On the boardwalk:** feed out every picnic group and fill the feed-o-meter. A group fed out to the last
   bite **leaves a pearl** (a scared-off group does not). Pearls start on this level and are a theme through
   the whole game: the more pearls, the better the chance of clearing a level. A lifetime pearl total is
   saved in progress (`progress.pearls`).
2. **The dive:** once ready, a glowing ring and buoy appear out to sea. Swimming into it dives to the reef.
   No food under water: the feed-o-meter becomes an **air meter**. Space swims up for air (not inside the
   cave: rock overhead); Shift (the Fours button on phones) dives again. Bubble vents refill air. Running out costs a life, and Kenny paddles
   out on a float with **Vegemite** to revive him.
   Anywhere in the sea beside the boardwalk Wally can also go under: **Shift** (Fours on phones) dives, **Space** comes up, the air
   meter shows while he is under, and box jellyfish drift both at the surface and deep down. To get back onto
   the boardwalk he swims to its edge and pushes toward it to **crawl out** (or does a croc leap).
3. **The coral cave:** a maze inside a rocky mound, with pearls in dead ends, two bubble vents, and the **old
   pirate chest** (holding a Golden Mango) in the furthest cell. Taking the chest makes the **giant clam** at
   the mouth snap shut; only **a pearl** placed in it opens it again. Out of the cave with the treasure and up
   to the surface wins the level.

## Run and test

```
node serve.mjs              # then open http://localhost:8090   (add --lan to open it from a phone)
npm test                    # all rule tests: rules, quests, progress, esplanade, reef
```

URL switches (any page): `?q=low|medium|high` force graphics quality, `?real=0` turn off the photographic
layer (compare with the painted look), `?bot` a test pilot plays, `?play` skip the title.
Esplanade only: `?dive` jump straight to the dive, `&pearls=3` start with pearls, `?seed=7` course and maze.

Test hooks in the browser console: `window.chomp` holds `game`, `wally`, `food`, `cam`, and per level
`pelicans`, `jellies`, `toads`, `clusters`, `kenny` (park) or `reef`, `maze`, `camera`, `scene` (Esplanade).

## Code map

| File | What it does |
|---|---|
| `index.html`, `style.css` | Level 1 page and the shared HUD styles |
| `esplanade.html` | Level 2 page |
| `serve.mjs` | Local server; also writes `models/index.json` on the fly (list of model files present) |
| `js/main.js` | Croc Park: scene setup and game loop |
| `js/world.js` | Croc Park scenery: sky, lights, ground, water, fence, boardwalk, rocks, palms, harbour, distant ranges |
| `js/realism.js` | The photographic layer: HDR sky, scanned surfaces, grass-to-sand ground blend, sky and sun alignment |
| `js/palms.js` | Coconut palms: built trunk + Ken's crown model, clumps of 1 to 3, Esplanade fairy lights |
| `js/forest.js` | Rainforest belt around the park (instanced leaf clusters) |
| `js/post.js` | Post-processing: ambient occlusion, bloom, colour grade |
| `js/look.js` | Rim light, contact shadows, shader wing flap (flying fox), shader leg stride (pelican) |
| `js/models.js` | Loads `.glb` models when present (phone copies on phones), fits and dresses them over the stand-ins |
| `js/rig.js` | Skeleton in code for Wally's model |
| `js/wally.js` | Wally: movement, swimming, leaping, animation |
| `js/kenny.js` | Kenny the Koala |
| `js/tourists.js`, `js/clusters.js` | Visitors and the groups that throw food |
| `js/food.js` | Thrown food, Kenny's toast and Vegemite jar |
| `js/hazards.js` | Jellyfish, flying foxes, pelicans, cane toads |
| `js/crocs.js` | The other crocodiles |
| `js/ground.js` | What the current level is made of (each level calls `setGround`) |
| `js/rules.js` | Park rules (tested) |
| `js/quests.js`, `js/progress.js` | Areas, quests, saved progress (tested) |
| `js/textures.js` | Pictures painted on canvas at start-up (shirt, signs, jar label, sky, planks) |
| `js/bubbles.js`, `js/fx.js`, `js/sound.js`, `js/input.js`, `js/quality.js` | Speech bubbles, effects, generated sound, controls, quality levels |
| `js/levels/esplanade.js` | Level 2 game loop, including the dive (`reefStep`) |
| `js/levels/esplanade-scene.js` | Level 2 scenery |
| `js/levels/esplanade-rules.js` | Level 2 course and scoring (tested) |
| `js/levels/reef-rules.js` | The dive's rules: maze, pearls, walls, air, score (tested in `test/reef.test.mjs`) |
| `js/levels/reef-scene.js` | The reef and cave: seabed, coral, fish, vents, clams, chest, giant clam |
| `js/addons/` | three.js add-ons, copied from three r186 (`npm three@0.186.0`) |
| `js/three.core.js`, `js/three.module.js` | three.js r186 |
| `tools/view-model.html` | Model checker: `http://localhost:8090/tools/view-model.html?m=pelican&h=1.35&walk=1` |
| `tools/fetch-assets.mjs` | Downloads the sky and surface pictures (see Assets) |
| `tools/blender-decimate.py`, `tools/blender-crown.py` | Blender scripts used to shrink models (see Pipelines) |
| `people-test.html`, `rig-test.html`, `preview.html` | Test pages from earlier sessions |
| `MODELS.md` | The model list and Meshy prompts for every character and prop |

## Assets

Everything below is in the repository unless marked **local only**.

### Models (`models/`, loaded by `js/models.js`; each has a smaller `-phone.glb` twin)

| File | What | PC size / triangles | Made from |
|---|---|---|---|
| `models/wally.glb` | Wally, rigged in code (`js/rig.js`) | 700 KB | Meshy export, third version (`incoming/wally3-rigged.glb`) |
| `models/kenny.glb` | Kenny the Koala, rigged, with clips | 872 KB | Meshy (`incoming/kenny-rigged.glb`) |
| `models/flyingfox.glb` | Flying fox (wings flap in the shader) | 872 KB, 17k | Meshy (`incoming/flyingfox-original.glb`) |
| `models/pelican.glb` | Australian pelican (legs stride in the shader on land) | 524 KB, 23k | Meshy (`incoming/pelican-original.glb`) |
| `models/jellyfish.glb` | Box jellyfish, made see-through in code (`hazards.js jellyLook`) | 300 KB, 12k | Meshy (`incoming/jellyfish-original.glb`) |
| `models/toad.glb` | Cane toad | 504 KB, 9.8k | Meshy (`incoming/toad-original.glb`) |
| `models/palm-crown.glb` | Coconut palm crown only; the trunk is built in `js/palms.js` | 404 KB, 9k | Meshy palm (`incoming/palm-original.glb`), crown cut off in Blender |

Not made yet (the game draws built-in stand-ins): tourists `tourist-1..10.glb`, food `food-*.glb`,
`toast.glb`, `croc.glb`, `boat.glb`, rocks, sign, gate. Prompts for all of them are in `MODELS.md`.

### Photographic layer (`assets/`, loaded by `js/realism.js`; all CC0)

| Path | What | Source |
|---|---|---|
| `assets/sky/sky-1k.hdr` | Sky lighting and reflections | Poly Haven `kloofendal_48d_partly_cloudy_puresky` |
| `assets/sky/sky-pc.jpg`, `sky-phone.jpg` | The visible sky (4096 and 2048 wide) | same, resized from the 8K tonemapped JPG |
| `assets/sky/sky.json` | Where the sun is in the photo, and the horizon colour (for the haze) | measured from the HDR |
| `assets/surfaces/grass/` | `color.jpg`, `normal.jpg`, `rough.jpg` | ambientCG `Grass006` |
| `assets/surfaces/sand/` | same three maps | Poly Haven `dense_sand` |
| `assets/surfaces/planks/` | same | Poly Haven `hinoki_planks` |
| `assets/surfaces/rock/` | same | Poly Haven `rock_boulder_dry` |
| `assets/surfaces/paving/` | same | Poly Haven `concrete_floor` |
| `assets/surfaces/palm/` | same | Poly Haven `palm_tree_bark` |
| `assets/water/waternormals.jpg` | Ripples for the reflective water | three.js examples (MIT) |

`backdrops/` is empty: optional painted horizon and sky, specified in `MODELS.md`.
Many smaller pictures are painted in code at start-up (`js/textures.js`, `reef-scene.js`, `palms.js`, `forest.js`).

### Originals (**local only**, `incoming/`, about 750 MB, ignored by git)

The full Meshy downloads and in-between versions: `*-original.glb`, `*-rigged.glb`, `*-pc.glb`, `*-phone.glb`,
older Wally versions. Ken's Downloads folder holds the files as he exported them.

## Pipelines

**A new Meshy model** (Ken exports it to Downloads):
1. Copy it to `incoming/<name>-original.glb`.
2. Shrink with glTF-Transform 4.5.1 (Draco geometry, WebP textures):
   `npx -y @gltf-transform/cli@4.5.1 optimize incoming/<name>-original.glb incoming/<name>-pc.glb --compress draco --texture-compress webp --texture-size 1024 --simplify-ratio 0.005 --simplify-error 0.05`
   and the phone copy with `--texture-size 512` and a smaller ratio.
3. If simplifying stalls (Meshy splits textures into many islands; the simplifier will not cross the seams),
   reduce in Blender instead: `blender --background --factory-startup --python tools/blender-decimate.py -- in.glb out.glb <triangles>`,
   then run step 2 with `--simplify false`.
4. Copy to `models/<name>.glb` and `models/<name>-phone.glb`; add the name to `MODEL_FILES` in `js/models.js`
   if it is new; check it in `tools/view-model.html` (facing +z, base on the ground).

Budgets (MODELS.md): Wally up to 30k triangles, other characters 15k, props 3k.

**Sky and surfaces:** `node tools/fetch-assets.mjs` downloads them; the sky photo is then resized to
`sky-pc.jpg` and `sky-phone.jpg` and `sky.json` written (done by hand with Python and PIL, see the script's comments).

## How the code is written (keep to it)

- Every model and picture is optional: a missing file falls back to the built-in look. Never make one required.
- Phones get `-phone.glb` models, smaller textures and fewer things; `?q=low` must still play.
- Rules live apart from drawing (`*-rules.js`, `rules.js`) and are tested; add a test with every rule.
- Plain, well-commented code: comments say why, in words a newcomer can follow. No long dashes in text.
- Ken's standing rules: test before claiming, say what was actually run, no guessing. Credit: ideas are Ken's.

## Working with more than one AI

Git started 2026-10-16 because two AI sessions were editing the same files. Repository:
https://github.com/kenbin64/chomp2 (to be renamed chomp-3d on GitHub; the folder is `C:\projects\chomp-3d`).

1. Before starting: `git status` and `git log --oneline -5`. If there are uncommitted changes you did not
   make, commit them first as they are (message: "Work from another session, committed as found").
2. Work on a branch: `git switch -c <session>-<topic>` (e.g. `reef-cave`, `esplanade-look`).
3. Commit small and often, with clear messages. Run `npm test` before each commit.
4. Do not reformat or rewrite files you are not changing. Line endings are left as they are
   (`core.autocrlf false` for this repository).
5. Merge into `main` when a piece works; resolve conflicts by reading both sides, never by discarding one.
6. Update **Status** and the **Log** below.

## Status (2026-10-16)

Done and tested:
- Level 1 realism pass: HDR sky, scanned surfaces, reflective water, beach, rainforest belt, distant ranges.
- Meshy models in: Wally, Kenny, flying fox, pelican, jellyfish, toad, palm crown.
- Pelicans steal on land and water, with walking legs. Palms vary in height, size, lean and clumps; Esplanade palms lit.
- Level 2 reef dive: rules and maze tested (69 tests); full run checked in a browser (chest, clam shuts, pearl opens it, win).

In progress / next (in Ken's order of asking):
- **Esplanade look to match level 1:** shiny water, buildings with depth, light and shadow, people with
  features, stained wood boardwalk panels, and Ken's models instead of the built-in low-poly ones
  (the Esplanade still uses `jellyModel()` and the built-in pelican and people).
- **Detailed mangroves** (and fig trees) on the Esplanade.
- Wally's helmet and white chest bloom too bright in close-ups.
- Frame rate not yet measured in a normal browser window (headless tests stall).
- Remaining models from `MODELS.md` (tourists, food, croc, props).

## Log

- 2026-10-16: git started (baseline commit). Working document written. Reef dive added to level 2.
- 2026-10-16 (branch esplanade-water): crawl out onto the boardwalk, swim under water beside it (sea floor now 5.5 m down), jellyfish at the surface and deep, Kenny's rescue shared by sea and reef. Name back to Chomp 3D.
- 2026-10-16 (branch reef-cave): the Esplanade's shallow sea floor (y = -2.2) is hidden while diving; it was hiding the reef from the camera in the cave.
