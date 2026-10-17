# Outfit templates

New clothes that change Wally's shape (a pirate coat, a costume) are made as a whole new Wally in Meshy,
then rigged automatically from the template, so every move works on them without new animation.

1. In Meshy, **image to 3D** (or text to 3D with the image as reference), starting from
   `wally-tpose-front.png` (and `wally-tpose-side.png` if Meshy takes a second view).
   Prompt: *"The same cartoon crocodile character, same body, same proportions and the same T-pose
   (arms straight out, legs apart), now wearing [THE NEW OUTFIT]. Stylised 3D animated-feature look."*
2. Keep the T-pose, the size and the proportions as close to the picture as possible: the closer it
   matches, the cleaner the rig.
3. Download **game-ready (about 10k), no rig, for Blender** (GLB), to Downloads, named for the outfit
   (for example `wally-pirate.glb`).
4. The tool (`tools/blender-rig-variant.py`) lines it up with the template, copies the skin weights,
   binds it to the same skeleton and exports it with all 13 moves.

Hats, sunnies, masks, wigs and the boomerang do not need this: they attach to a bone.
