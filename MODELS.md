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

### 4. Tourists: `tourist-1.glb` to `tourist-10.glb`
Everyday Australians and visitors on a sunny day out, each one a distinct individual. Make about ten that vary in age, build, height, skin tone, hair and clothes. Dress them in ordinary holiday clothes only: no costumes and nothing meant to signal a culture. Show them as warm, friendly, happy people.

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
