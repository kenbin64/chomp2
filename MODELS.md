# Chomp! models to make

Make these in your model program, save each as a `.glb` file with the file name given, and put it in `C:\projects\chomp-3d\models\`. The game will use a model when its file is there and fall back to the built-in stand-in when it is not, so you can add them one at a time.

## Settings for every model

- **Format:** GLB (glTF binary), with the textures packed inside the file.
- **Size:** real-world metres. Wally about 2.7 m tall including his hat, Kenny about 1.1 m, people 1.5 to 1.9 m.
- **Facing and position:** standing upright, facing forward, with the ground point between the feet at the model's origin.
- **Phone-friendly detail:**
  - Wally: up to 30,000 triangles, textures 2048 x 2048.
  - Other characters: up to 15,000 triangles, textures 1024 x 1024.
  - Food and small props: up to 3,000 triangles, textures 512 x 512.
- **Style, for every prompt:** stylised 3D animated-feature style, soft rounded shapes, warm sunny colours, friendly expressive faces, clean simple textures.
- **Avoid:** brand names, logos or real people's likenesses, in the models and in the prompts. The spread is shown only as a dark spread, never with a label.

## Rigging and animation

If your program can rig and animate, use these animation names so the game can find them. If it can only rig, send the rigged model: as long as the bones below exist, I can move them from code.

| Model | Bones that matter | Animations |
|---|---|---|
| Wally | standard humanoid skeleton, plus a lower **jaw** bone and 4 to 6 **tail** bones | idle, run, run_fours, swim, jump, leap, chomp, cheer, nap |
| Kenny | humanoid, plus ear bones if possible | idle, walk, run, wave, sit, carry |
| Tourists | standard humanoid (any auto-rigger works) | idle, walk, throw, startled |
| Croc | spine, **jaw**, 4 legs, 4 to 6 **tail** bones | swim, lunge_snap |
| Pelican | neck, head, bill, legs | paddle, waddle, snap |
| Flying fox | 2 wing bones each side | fly, dive |
| Box jellyfish | bell and tentacles | pulse |

Excitable movement for Wally: big arm swings, a bounce in every step, arms flung up in the jump and the cheer. Kenny: always happy, bouncy, waves a lot.

## Priority order

Make them in this order: the first three matter most to how the game feels.

1. Wally
2. Kenny
3. The food set
4. Tourists
5. The other crocs
6. Pelican
7. Flying fox
8. Box jellyfish
9. The props

## The models

### 1. Wally the Cairns Crocodile: `wally.glb`
> A friendly, excitable cartoon saltwater crocodile who stands and runs upright on two legs like a person. Green scaly skin, a pale cream belly, a long snout with a big happy toothy grin, large expressive eyes on top of the head. He wears an open orange Hawaiian shirt with pink, yellow and white hibiscus flowers and green leaves, orange board shorts, and a cream safari-style helmet with a dark band, a small round green badge on the front and a pink flower tucked in the side. Long thick tail with ridged scales along the top. Energetic, enthusiastic wildlife-lover personality, arms open wide.

The jaw must open, because he catches food in his mouth.

### 2. Kenny the Koala: `kenny.glb`
> A small, round, always-smiling cartoon koala. Soft grey fur, white fluffy chest, big round fluffy ears with white insides, a large shiny black nose, small bright eyes, rosy cheeks and a wide happy smile. Chubby, cheerful and bouncy. He holds a small squat glass jar of glossy, almost black spread, with a bright yellow screw lid and a yellow label with a red band. The label has no words, letters, logo or brand name.

### 3. Food: one file each, about 0.4 to 0.6 m across (oversized so it reads from far away)

| File | Description |
|---|---|
| `food-fries.glb` | A red paper cup of golden french fries, fries sticking out at angles |
| `food-hamburger.glb` | A big hamburger: sesame bun, beef patty, melted cheese, lettuce, tomato |
| `food-hotdog.glb` | A hot dog in a soft bun with a wavy line of yellow mustard |
| `food-shrimp.glb` | A large curled grilled shrimp, pink-orange with a tail fan |
| `food-chicken.glb` | A golden fried chicken drumstick with the bone end showing |
| `food-steak.glb` | A thick grilled steak with dark grill marks and a fat rim |
| `food-hoagie.glb` | A long sub roll with ham, salami, lettuce and tomato showing at the side |
| `food-taco.glb` | A crunchy taco shell with beef, lettuce, tomato and cheese |
| `food-pizza.glb` | A slice of pepperoni pizza with melted cheese and a thick crust |
| `toast.glb` | Kenny's power-up: a slice of golden toast thinly spread with a dark brown, almost black spread, a little butter melting on top. No packaging. |

### How to make every character from now on (Blender pipeline, 2026-10-16)

Wally showed the way: an unrigged model from Meshy, rigged and animated in Blender by script
(`tools/blender-rig-wally.py`, `tools/blender-animate-wally.py`), looks and moves far better than
Meshy's own auto-rig. So for every character and creature:

1. **Same look as Wally.** Add to every prompt: *"Stylised 3D animated-feature character, same art style
   as a modern family animated film, detailed hand-painted textures, soft appealing shapes."* Everyone
   should look like they belong in Wally's world.
2. **Pose for rigging.** People: a **T-pose** (arms straight out, legs slightly apart, mouth closed,
   fingers spread). Creatures: a **neutral pose with limbs clear of the body** (pelican with wings
   slightly open and legs straight; toad with legs out from the body; croc lying straight, legs out to
   the sides, tail straight, mouth slightly open).
3. **Export without a rig.** In Meshy choose the **game-ready (about 10k triangles), no rig, for Blender**
   GLB, the same kind as `Meshy_AI_wally_game_ready_10k_Withoutrigfor_blender.glb`.
4. Save to Downloads and say which character it is. The rest (shrinking, rig, moves, phone copies) is done here.

People can also go through **Mixamo** (free, from Adobe, made for human figures): upload the T-pose
model there and it rigs it and gives hundreds of ready moves (throwing, waving, cheering, phone photo,
running away). Use whichever is quicker; the Blender route works for people too.

### Tourists from pictures (Ken, 2026-10-17): match the promo video

The quickest way to tourists that look like the people in Ken's video and title art: make a picture
of each in the **same image tool and style**, then build the model from it in **Meshy, image to 3D**.

1. In the image tool, one picture per person with this frame around the description below:
   > *Full-body character design of [DESCRIPTION], standing in a T-pose (arms straight out to the
   > sides, legs slightly apart), facing the camera, plain light grey background, even soft light,
   > no shadows, whole body in frame from head to shoes. Stylised 3D animated-feature look, the same
   > warm Pixar-like style as a family animated film, friendly happy expression.*
2. In Meshy: **image to 3D** from that picture, then download **game-ready (about 10k), no rig, for
   Blender** (GLB), as with Wally. Name it `tourist-1.glb` to `tourist-10.glb` in the order below.
3. The rest (shrinking, rig, moves) is done here: watching, waving, phone photos, throwing, cheering,
   and running off laughing when Wally gets too close.

The ten people are the ones listed under section 4 just below (use each description as [DESCRIPTION]).

**How the people are built (2026-10-17, working for the surfer, hiker and elder).** Ken's two cast
sheets hold 24 people; each one goes through Meshy on its own and lands in Downloads. Either way in works:

- **Rigged in Meshy** (the `..._rigged_All_Animations.glb` download): `tools/blender-import-rigged.py`
  keeps Meshy's skeleton, skin weights, Walking and Running, and gives the bones our names.
- **Not rigged**: `tools/blender-bake-lowpoly.py` (12k triangles, 2048, reach 2.5), then
  `tools/blender-rig-human.py`, which measures each body by itself (crotch, neck, shoulders, hands,
  legs; T-pose or A-pose; a backpack or hat does not fool it) and builds the same skeleton.

Then `tools/blender-animate-human.py` adds the shared moves (Idle, Walk, Run, Wave, Point, Chat, Photo,
Throw, Cheer, Nervous, plus a HeldPhone shown only for photos), and gltf-transform makes
`models/tourist-N.glb` (1024 textures) and `tourist-N-phone.glb` (512), about 0.4 to 0.6 MB each.
Slots run tourist-1 to tourist-24. No group of visitors ever has the same person twice (Ken): until
there are as many people as a group's size, the extra members step out.

Made so far: tourist-1 hiker (Meshy rig), tourist-2 young surfer, tourist-3 elder bushman, tourist-4 Torres Strait auntie (long dress: folds a little at the hem; fine at crowd distance), tourist-5 tropical beach kid, tourist-6 islander girl, tourist-7 Japanese tourist, tourist-8 hippie woman, tourist-9 female tourist, tourist-10 Kuranda resident, tourist-11 young Aboriginal woman (dress print to be reviewed; see MASTER.md), tourist-12 American tourist (man), tourist-13 American tourist (woman). Each person's height range is in CAST in js/tourists.js: add a line there for every new person (children especially).

### 4. Tourists: `tourist-1.glb` to `tourist-10.glb`
Everyday Australians and visitors on a sunny day out, each one a distinct individual. Make about ten that vary in age, build, height, skin tone, hair and clothes. Dress them in ordinary holiday clothes, no costumes. Show them as warm, friendly, happy people. (Updated 2026-10-18: culture is shown truly, not hidden, with community review; avoid stereotypes and AI imitations of traditional art. See MASTER.md, Release.)

1. > A cheerful Aboriginal Australian woman in her thirties with curly dark hair tied back, a teal t-shirt, khaki shorts, sneakers, a sun visor and a small camera.
2. > A tall Torres Strait Islander man in his forties with short dark hair and a neat beard, a bright patterned short-sleeved shirt, navy shorts and sunglasses pushed up on his head.
3. > A smiling Samoan Australian woman in her twenties with long wavy black hair, a yellow sundress, sandals and a straw sun hat.
4. > A broad-shouldered Tongan Australian man in his fifties with short grey-black hair, a white polo shirt, grey shorts and a backpack.
5. > A sunburnt white Australian bloke in his thirties with sandy hair, a blue singlet, board shorts, thongs (flip-flops) and a cap worn backwards.
6. > A white Australian grandmother in her seventies with short silver hair, a floral blouse, light trousers, a wide-brim hat and a walking stick.
7. > A Chinese Australian dad in his forties with glasses, a green t-shirt, cargo shorts and a camera on a strap.
8. > An Indian Australian university student in her twenties with a long dark braid, a red top, jeans and a tote bag.
9. > A Fijian Australian teenager with a curly high-top haircut, an oversized orange t-shirt, basketball shorts and sneakers.
10. > A Filipino Australian nurse on her day off, in her thirties, with a dark bob haircut, a purple t-shirt, white shorts and sunglasses.

Animations: idle, walk, throw (an overarm throw) and startled (a jump back with hands up, laughing rather than frightened).

### 5. Ordinary crocodile: `croc.glb`
> A realistic-proportioned but stylised estuarine crocodile lying low, darker olive-green skin, yellowish belly, yellow eyes, rows of bumpy scutes along the back, a long powerful tail. No clothes. A bit grumpy-looking, not scary.

### 6. Australian pelican: `pelican.glb`
> A stylised Australian pelican: white body, black wing feathers folded along its back, a very long pale-pink-to-orange bill with a throat pouch, short grey legs, slightly cheeky expression. Sitting or standing, never flying.

### 7. Flying fox: `flyingfox.glb`
> A stylised spectacled flying fox (fruit bat): fox-like face with big dark eyes, rusty-brown fur on the head and shoulders, dark leathery wings spread wide, around 1 m wingspan. Mischievous, not scary.

### 8. Box jellyfish: `jellyfish.glb`
> A translucent, softly glowing box jellyfish: a cube-shaped clear bell with a faint pink-purple glow and long thin pale-blue tentacles trailing from each corner.

### Cane toad: `toad.glb`
> A realistic Australian cane toad: squat and warty, mottled olive-brown back, pale cream belly, big golden eyes with dark pupils, sitting upright.

Done 2026-10-16 from Ken's Meshy export. The game fits it to 0.42 m tall (bigger than life, so it reads in play) and moves it by hopping the whole model, so it needs no bones.

### 9. Props

| File | Description |
|---|---|
| `palm-1.glb`, `palm-2.glb` | Tall tropical coconut palms, gently curved trunks, 8 to 12 m |
| `rock-1.glb` to `rock-3.glb` | Rounded granite boulders with flat-ish tops, 1 to 2 m tall, for Wally to jump on |
| `sign.glb` | A rustic wooden park sign on one post, blank face 4 m by 2 m (the game paints the words on) |
| `gate.glb` | A timber archway over a boardwalk, 3.5 m tall, with a red-and-white boom-gate arm |
| `boardwalk.glb` | One 2 m long section of wooden boardwalk, 3.2 m wide, with white posts and rails on both sides, on dark timber piles |
| `boat.glb` | A white tourist reef boat, about 12 m, with a blue stripe and an upper deck |

The lagoon, banks, water and sky stay built by the game, so they don't need models.

## The giant clam (Great Barrier Reef, level 3, Ken 2026-10-18)

The clam guards the reef maze, and Wally pays it the Big Golden Mango to open it. It has to open and shut
in the game, so make it **half open**, with the two shells clearly apart and the hinge showing. It is split
into its two shells in Blender here. Export **game-ready (about 10k triangles), no rig, for Blender** (GLB).

| File | Prompt |
|---|---|
| `clam.glb` | A giant Queensland clam (Tridacna gigas) from the Great Barrier Reef, about 1.2 m across, resting hinge-down on the sandy seabed, half open. A massive heavy shell with four to six deep wavy folds, so the two lips meet in a bold zigzag; cream and off-white shell, slightly weathered. Between the lips a thick fleshy mantle, golden brown to olive green, covered in small glowing iridescent blue-green spots. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No words or logos. |

| `pearl-key.glb` | An ornate old-fashioned key, about 30 cm long, made of gold, with a large lustrous white pearl set in the round handle and small coral-shaped curls on the shaft. Lying flat. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No words or logos. About 3k triangles. |
| `starfish.glb` | A friendly sea star from the Great Barrier Reef, about 30 cm across, five plump arms, lying flat on its underside, bumpy textured top in warm orange and coral red with small cream spots. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No face. About 3k triangles. |

The starfish's glow when Wally touches it is added in the game, so the model needs no glow of its own.

If the clam is to be a character, add: *"with two big friendly expressive eyes on the mantle and a wide
smiling mouth along the lips, a little grumpy but kind, like a gatekeeper."*

## The Barron Gorge from the air (the Skyrail ride, Ken 2026-10-19)

For the Skyrail's crossing of the gorge: a stretch of landscape seen from above, the falls at one end.
Export **game-ready, no rig, for Blender** (GLB); it is baked down here.

| File | Prompt |
|---|---|
| `barron-gorge.glb` | An aerial landscape block of the Barron Gorge in Far North Queensland: a deep, winding river gorge cut into a plateau, sheer grey granite cliffs with vertical joints, dense tropical rainforest canopy right to both rims, a wide stepped waterfall pouring into the head of the gorge at one end, white water and river boulders on the gorge floor, mist rising from the base of the falls. Seen from above at an angle, as from a cable car. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No buildings, no words. |

## The river cruise boat (the Daintree finale, Ken 2026-10-19)

The boat that runs aground in the storm and is pushed ashore by the crocs. Its passengers are **the same
people who threw food all game** (tourist-1 to tourist-13 and any added later), standing at the rails, so
the boat must be **open-sided** with room to see them. They already have the moves the finale needs:
Nervous in the storm, Point and Wave at Wally, Cheer at the rescue. So the only new model is the boat.
One solid piece (it tilts and is pushed as a whole), **no rig**. Export **game-ready (about 15k
triangles), for Blender** (GLB); it is baked down here, with a phone copy.

| File | Prompt |
|---|---|
| `river-boat.glb` | A small open-sided river cruise boat for wildlife spotting on a tropical rainforest river in Far North Queensland, about 10 m long and 3.5 m wide: a flat-bottomed white hull with a green stripe, a flat open deck with low wooden bench seats along both sides and a waist-high rail, a light flat canopy roof on thin white posts, the sides completely open so people on board can be seen, a small outboard motor at the stern. Empty, no people. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No words, no logos, no names. |

No words or names on it, so it is not any real operator's boat. **Check every image before 3D (2026-10-19):**
Meshy's first boat image ignored "no words" and painted a tour company name and a real outboard brand on
it. Look for lettering, logos and brand names on every generated image, and regenerate if any appear.

## The King Crocodile's sceptre (the whole trip, Ken 2026-10-19)

Wally carries it from the bottom of the Croc Park lake to the King in the Daintree, and the seven talismans
are set into it as he wins them. **The holders for the talismans are built in the game, not by Meshy**:
seven gold claw settings placed round the head, empty until each talisman is won, so they line up exactly
and can light up one by one. So the sceptre itself is made **plain, with no gems and no holes**. One solid
piece, **no rig**. Export **game-ready (about 10k triangles), for Blender** (GLB).

| File | Prompt |
|---|---|
| `sceptre.glb` | A royal sceptre for a crocodile king, about 1 m long: a straight shaft of dark polished wood wrapped with bands of old gold, a gold grip with a scale pattern like crocodile skin, and at the top a rounded gold head shaped like a stylised crocodile's crown with a smooth plain band around it. No gems, no jewels, no holes, plain gold where jewels would go. Standing upright. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No words or logos. |

**Second version (Ken, 2026-10-20):** the sceptre is to match the King's garments, reflecting the
rainforest and the river, and **each of the six settings is made in the style of the talisman that goes
in it**, so the player can see where each one belongs. The layout is heaven above, earth below:

| | left | centre | right |
|---|---|---|---|
| top (heaven) | moon | **sun** (top) | air (Proposed: Ken wrote "earth" here and again at the bottom) |
| bottom (earth) | water | **earth, the opal** (bottom) | fire |

| File | Prompt |
|---|---|
| `sceptre.glb` (v2) | A royal sceptre for the crocodile king of a tropical rainforest river, about 1 m long, made from the rainforest and the river, not from gold. The shaft is dark polished rainforest wood carved like a twisting vine, wrapped with living green vines and leaves, with smooth river stones and flowing blue-green inlay like a river running down it, and a grip with a crocodile scale pattern. At the top a crocodile head carved from dark wood and green river stone, wearing a crown of leaves, ferns and vines, surrounded by six empty jewel settings, three above the head and three below, each setting shaped and decorated for its own element: at the very top a sunburst setting of warm amber; upper left a silvery setting with stars for the moon; upper right a setting of swirling wind ribbons for air; at the very bottom a setting of rough rock and roots for an opal; lower left a setting of blue-green waves for water; lower right a setting of red-orange flames for fire. The settings are empty, no gems in them. Standing upright. Stylised 3D animated-feature look, same art style as a modern family animated film, detailed hand-painted textures. No words or logos. |

Meshy may not get six different settings right from words alone. If not: make a picture of it first (text
to image), clear its background (`tools/clear-background.py`), then image to 3D from that.

**Made 2026-10-19 (Ken's Meshy, first version):** Ken's sceptre came with its own holders: a gold crocodile head with a
crown and **six hexagonal settings** (top, two upper, two lower, bottom), so the game uses those instead of
building its own. Baked to 40k (`sceptre.glb` 455 KB, phone 276 KB). Six settings, six talismans.

**The talismans (Ken's Meshy):** pendants, each a carved bronze frame round its element. The first is
`talisman-fire.glb` (a flame in a teardrop frame; baked to 16k, 337 KB, phone 175 KB). The others: air,
water, the opal (earth), the sun and the moon: six in all, one per setting, each frame in its own
element's style (mangoes, pearls and paw
paws are trade items, not talismans).

**Each talisman's frame depicts its own element** (Ken, 2026-10-20, replacing "all the same sides"): the
water talisman's silver waves, the fire talisman's flame, and so on, so each reads as its element at a
glance. Proposed, to keep them a set: about the same size, a pendant with a loop at the top, the same
hanging shape.

**Clear the background before image to 3D** (Ken found it, 2026-10-20): a reference picture with a solid
background (white, grey or a gradient) gets that colour painted onto the model's sides and back. Run
`python tools/clear-background.py picture.png` first; it writes `picture-clear.png` with the background
transparent, and that is the one to give Meshy.

**Every model is checked from all sides before it goes in** (Ken, 2026-10-20): front, side, back and top in
the game's own renderer (`tools/view-model.html`), looking for colour patches or squares on the sides
that the front view hides.

**The moon talisman is a full moon, as seen from Australia** (Ken): never a crescent (it has religious
meaning). From the southern hemisphere the full moon's dark patches appear turned about 180 degrees from
the northern view most pictures show. Meshy will likely make the northern view; if so, the moon disc is
turned 180 degrees here, or use a photo of the full moon taken in Australia as the reference. The pendant is not hexagonal, so it does
not fit a setting as it is: **Proposed:** the pendant is what Wally finds in the chest and what the screen
shows; when it goes into the sceptre, its heart (the element) lights the setting as a glowing hex gem in
its colour, built in the game.

## Kuranda and Barron Falls (level 4, Ken 2026-10-17)

For every one: add the style line *"Stylised 3D animated-feature look, same art style as a modern family
animated film, detailed hand-painted textures, warm and inviting"*; export **game-ready, no rig, for Blender**
(GLB). Props are fine at about 5k triangles. No words, logos or brand names on anything.

| File | Prompt |
|---|---|
| `kur-stall-1.glb` | A tropical market stall: a timber frame with a striped red-and-cream canvas awning, a wooden counter piled with tropical fruit (mangoes, pineapples, bananas, papayas) in woven baskets, hanging string lights, about 3 m wide and 3 m tall. |
| `kur-stall-2.glb` | A tropical market stall: a timber frame with a green-and-white striped canvas awning, racks of colourful sarongs and sun hats, a wooden counter, a small hand-painted sign with no writing, about 3 m wide and 3 m tall. |
| `kur-stall-3.glb` | A tropical market food stall: a timber hut with a palm-thatch roof, a counter with jars of honey, fudge and local treats, an old-fashioned set of scales, about 3 m wide and 3 m tall. |
| `kur-shopfront.glb` | A Queenslander-style shopfront: a single-storey timber building on a low raised floor, a wide shady veranda with white wooden posts and lacework, a corrugated iron roof painted green, big shop windows, cream and sage weatherboards, about 8 m wide. |
| `kur-gondola.glb` | A small enclosed cable-car gondola cabin with big windows on all sides, rounded corners, painted forest green with a silver roof hanger arm on top, seats inside for six, about 2 m tall, no logos. |
| `kur-cable-tower.glb` | A tall steel cable-car support tower, a slim lattice tower with a crossbar and pulley wheels at the top, painted dark green, about 30 m tall. |
| `kur-lookout.glb` | A rainforest lookout platform: a timber boardwalk deck jutting out on tall posts, with sturdy timber railings, a little shade roof over the end, about 6 m long. |
| `kur-bungee.glb` | A bungee jumping platform: a timber and steel tower about 20 m tall with stairs up the side, a small jump platform with a gate at the top sticking out over the edge, safety railings, a rope anchor point, no logos. |
| `kur-zipline.glb` | A zip line launch platform built around a big rainforest tree trunk: a round timber deck with railings, a steel cable starting from a post above the deck, a small ramp to step off, about 6 m tall. |
| `kur-pulley.glb` | A zip line trolley and harness: a steel pulley trolley with two wheels on top, a sturdy hanging strap below with a seat harness, bright orange, about 1 m tall. |
| `kur-cliff-1.glb` | A large rainforest cliff rock face: dark grey and brown granite with vertical cracks, ferns and small plants growing from ledges, moss and wet streaks, about 15 m tall and 15 m wide. |
| `kur-cliff-2.glb` | A tall jagged rock outcrop for a gorge edge: dark wet granite with hanging vines and ferns, about 12 m tall. |
| `kur-river-rock.glb` | A cluster of big smooth river boulders, grey granite worn round by water, some wet and dark, about 5 m across. |
| `kur-crates.glb` | A stack of wooden market crates full of tropical fruit: mangoes, pineapples, coconuts and bananas, about 1.2 m tall. |

**Clothes and gear from the Kuranda markets** (Ken's list, 2026-10-17). Small worn objects, about 2k to 4k
triangles, no rig, each on its own; the game fits them on Wally's or Kenny's head, face or hand. Shirts and
board shorts need no models: they are coloured and patterned in the game (Hawaiian colours, stripes, neon, disco).

| File | Prompt |
|---|---|
| `acc-cork-hat.glb` | A classic Australian bush hat, brown felt with a wide brim, with wine corks hanging on strings all round the brim, cartoon style. |
| `acc-lifeguard-cap.glb` | An Australian surf lifesaver's cap: a close-fitting fabric skull cap in quarters of bright red and yellow, with chin ties, cartoon style. |
| `acc-pirate-hat.glb` | A black pirate tricorn hat with gold trim and a white skull-and-crossbones badge on the front, cartoon style. |
| `acc-sunnies.glb` | A pair of chunky, fun round sunglasses with bright yellow frames and dark lenses, cartoon style. |
| `acc-mask.glb` | A sparkly carnival party mask covering the eyes, purple with gold glitter edges and a small feather on one side. |
| `acc-wig-rainbow.glb` | A big fluffy curly wig in rainbow stripes (red, orange, yellow, green, blue, purple), clown-party style, cartoon. |
| `acc-wig-blue.glb` | A big fluffy afro-style party wig in electric neon blue, cartoon style. |
| `acc-wig-pink.glb` | A big fluffy party wig in bubblegum pink, cartoon style. |
| `acc-boomerang.glb` | A traditional-shaped wooden boomerang, smooth polished wood, plain or with simple painted dots, about 60 cm tip to tip. Respectful, not a cartoon caricature. |
| `acc-bandana.glb` | A red bandana with a white paisley pattern, folded and tied in a knot, shaped to sit around a neck. |
| `acc-lei.glb` | A Hawaiian-style flower lei necklace: a full ring of bright pink, yellow and white hibiscus and frangipani flowers. |

## Backdrops (pictures, not models)

Put these in `C:\projects\chomp-3d\backdrops\`. Each one replaces the painted version the game draws for itself, and the game uses whichever you have made.

| File | What it is | Size |
|---|---|---|
| `park-ring.png` | The horizon all the way round the park, as one long strip with a **transparent sky** (PNG with transparency). Left edge to right edge is a full circle, so the two ends must join up. About three-quarters of the way along, the view looks out over the harbour, so that part is open sea with a low island. Everywhere else is rainforest-covered ranges, hazy blue-green in the distance and deep green closer. | 4096 x 512 |
| `park-sky.jpg` | Optional: a full 360 degree sky panorama (equirectangular), late-afternoon tropical sky, warm peach at the horizon, soft clouds. | 4096 x 2048 |

Prompt for the horizon strip:
> A seamless 360 degree panoramic horizon strip of Far North Queensland seen from a coastal wildlife park near Cairns: layered rainforest-covered mountain ranges, the farthest hazy blue-green and the nearest deep green with visible canopy texture. In one section the ranges give way to open turquoise sea with a low green island far out. Warm late-afternoon light, stylised animated-feature look, transparent sky above the ranges.

Each later area will get its own pair, for example `daintree-ring.png` (mangroves and rainforest to the water's edge) and `kuranda-ring.png` (rainforest over steep hills, cane fields in the valley).

## Animating in Meshy (text to motion)

1. Rig the character in Meshy first. It rigs best from a model standing straight in a T-pose or A-pose.
2. Make each move below from its text prompt. Loop the ones marked "loop".
3. Export each as GLB, with the file name given, into `C:\projects\chomp-3d\models\`. If Meshy puts several moves in one file, name that file `wally.glb` and name each animation inside it as below.
4. Reload the game. Each file is picked up by its name, and missing moves fall back to the nearest one Wally has.

Wally's moves. He is excitable, so every move is big:

| File | Kind | Text prompt |
|---|---|---|
| `wally@idle.glb` | loop | Excited, bouncy idle: shifts weight from foot to foot, looks around eagerly, arms out, gesturing as if telling a story |
| `wally@run.glb` | loop | Energetic cartoon run: big arm swings, bouncing steps, leaning forward, full of enthusiasm |
| `wally@run_fours.glb` | loop | Drops low and scuttles fast on hands and feet like a crocodile, body close to the ground |
| `wally@swim.glb` | loop | Swims on his stomach with his body flat and horizontal, arms paddling, legs kicking |
| `wally@jump.glb` | once | Excited jump straight up with both arms thrown in the air |
| `wally@leap.glb` | once | Explosive leap from a low crouch, stretching up high with arms and head reaching to grab something above |
| `wally@chomp.glb` | once | Lunges his head forward and snaps at something, then a pleased little nod |
| `wally@cheer.glb` | once | Celebrates: pumps both fists in the air and does a quick happy dance |
| `wally@nap.glb` | once | Runs out of energy, slumps down and lies on his back, asleep |

Kenny's moves, same way (`kenny@walk.glb` and so on). He is always happy and bouncy:

| File | Kind | Text prompt |
|---|---|---|
| `kenny@idle.glb` | loop | Happy little sway, smiling, bouncing gently |
| `kenny@walk.glb` | loop | Cheerful waddling walk, bouncing on each step |
| `kenny@run.glb` | loop | Hurrying, bouncy little run, arms pumping |
| `kenny@wave.glb` | loop | Waves happily with one arm, big smile |
| `kenny@sit.glb` | loop | Sits down contentedly and sways from side to side |

Tourists (`tourist-1@walk.glb` and so on, or shared): walk, throw (an overarm throw), startled (jumps back with hands up, laughing rather than scared), idle.
