# blender-animate-wally.py
# Wally's moves, keyframed on the rig from blender-rig-wally.py, then exported
# as one GLB with every move as a named animation clip.
#
# Ken's direction (2026-10-16): he moves like the promo video, fun and playful,
# never mechanical. So every move uses the cartoon basics: anticipation before
# big actions, squash and stretch in the body, the tail and head lagging behind
# (follow-through), arms that never mirror each other exactly, and no moment of
# standing perfectly still.
#
# Two body modes:
#   upright: Idle, Walk, Run, Jump (in place), Leap (running jump), ClimbUp,
#            ClimbAcross, GroundPick, Celebrate, Hurt
#   swimming: Swim, a real croc: body flat, head and snout in line with it, arms
#            and legs tucked at his sides, a side-to-side wave down the body and
#            the tail sculling for thrust.
#   eating (upper body only, so they can play over running or swimming):
#            Chomp (snaps food straight from the air), Grab (catches it in his
#            hands, then into the mouth)
#
# Directions are given in the rig's rest frame: x is Wally's left, y is his
# back, z is up. Each turn is (axis, degrees) about one of those directions,
# measured from the rest pose, and is applied in the order listed.
#
#   blender --background --factory-startup --python tools/blender-animate-wally.py -- rig.blend out.glb [preview-prefix]

import sys, math
import bpy
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
rig_file, out_glb = args[0], args[1]
preview = args[2] if len(args) > 2 else None

bpy.ops.wm.open_mainfile(filepath=rig_file)
rig = bpy.data.objects['WallyRig']
body = bpy.data.objects['Wally']
FPS = 30
bpy.context.scene.render.fps = FPS

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = math.pi * 2

def s(t, phase=0.0):        # one smooth swing per loop, -1 to 1
    return math.sin(TAU * (t + phase))

def bump(t, a, b):          # 0 outside a..b, rising to 1 in the middle and back
    if t <= a or t >= b: return 0.0
    return math.sin(math.pi * (t - a) / (b - a))

def ramp(t, a, b):          # 0 before a, 1 after b, smooth in between
    u = min(max((t - a) / (b - a), 0.0), 1.0)
    return u * u * (3 - 2 * u)

# ---- Shared pieces ---------------------------------------------------------------

def arms_down(p, left=70, right=70):
    # Arms hang from the T-pose to his sides (a little away from the body).
    p.setdefault('LeftArm', []).insert(0, (Y, left))
    p.setdefault('RightArm', []).insert(0, (Y, -right))

def elbow(p, left=0, right=0):
    # Bend the elbows so the forearms come forward (positive = more bend).
    p.setdefault('LeftForeArm', []).append((Z, -left))
    p.setdefault('RightForeArm', []).append((Z, right))

def tail_wag(p, t, amount, speed=1.0, lift=0.0, lag=0.12):
    # Each tail bone follows the one before it a little later: the whip that
    # makes a tail look alive instead of stiff.
    for i, name in enumerate(['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5']):
        p.setdefault(name, []).append((Z, amount * (0.5 + 0.25 * i) * s(t * speed, -lag * (i + 1))))
        if lift: p[name].append((X, lift * (1 if i == 0 else 0.3)))

# ---- The moves: each returns the pose at loop time t (0 to 1) ----------------------
# A pose is {bone: [(axis, degrees), ...], '_hips': (x, y, z) offset in metres}.

def idle(t):
    p = {}
    sway = s(t)                                       # weight shifting from foot to foot
    arms_down(p, 72 + 3 * s(t, 0.1), 72 - 3 * s(t, 0.1))
    p['LeftArm'].append((X, -6 + 4 * s(t * 2, 0.3)))   # hands drifting, never frozen
    p['RightArm'].append((X, -4 + 5 * s(t * 2, 0.55)))
    elbow(p, 18 + 6 * s(t * 2), 22 + 6 * s(t * 2, 0.4))
    p['Spine'] = [(Y, 3 * sway)]
    p['Spine1'] = [(X, 2 * s(t * 2))]                 # breathing
    p['Spine2'] = [(X, 2 * s(t * 2, 0.1)), (Y, -2 * sway)]
    p['Neck'] = [(X, -4)]
    p['Head'] = [(Z, 18 * s(t, 0.25)), (X, -6 + 4 * s(t * 2, 0.2)), (Y, 5 * s(t, 0.3))]   # looking about, head tilts
    p['Jaw'] = [(X, 2 + 2 * s(t * 2, 0.6))]
    p['LeftUpLeg'] = [(Y, -2 * sway)]
    p['RightUpLeg'] = [(Y, -2 * sway)]
    tail_wag(p, t, 10)
    p['_hips'] = (0.015 * sway, 0, -0.01 + 0.006 * s(t * 2))
    return p

def walk(t):
    # A happy, bouncy swagger: hips sway, shoulders roll, arms swing loose.
    p = {}
    step = s(t)
    arms_down(p, 70, 70)
    p['LeftArm'].append((X, 32 * step))               # arms swing opposite the legs
    p['RightArm'].append((X, -32 * step))
    elbow(p, 25 + 10 * max(0, -step), 25 + 10 * max(0, step))
    p['LeftUpLeg'] = [(X, -30 * step)]
    p['RightUpLeg'] = [(X, 30 * step)]
    p['LeftLeg'] = [(X, 35 * max(0, s(t, 0.2)))]       # knee bends as the leg comes through
    p['RightLeg'] = [(X, 35 * max(0, s(t, 0.7)))]
    p['LeftFoot'] = [(X, -12 * step)]
    p['RightFoot'] = [(X, 12 * step)]
    p['Spine'] = [(Y, 5 * step), (X, 4)]
    p['Spine2'] = [(Z, -9 * step), (Y, -4 * step)]     # shoulders roll against the hips
    p['Head'] = [(Z, 6 * step), (X, -8 + 5 * s(t * 2, 0.1)), (Y, -4 * step)]
    p['Jaw'] = [(X, 3)]
    tail_wag(p, t, 18)
    p['_hips'] = (0.02 * step, 0, 0.03 * abs(s(t)) - 0.02)   # up on each step
    return p

def run(t):
    # Flat out and loving it: knees high, arms pumping wide, leaning in, grinning.
    p = {}
    step = s(t)
    arms_down(p, 62, 62)
    p['LeftArm'].append((X, 55 * step))
    p['RightArm'].append((X, -55 * step))
    p['LeftArm'].append((Z, 10 * max(0, step)))        # flung a little outward
    p['RightArm'].append((Z, -10 * max(0, -step)))
    elbow(p, 75, 75)
    p['LeftUpLeg'] = [(X, -62 * step - 10)]
    p['RightUpLeg'] = [(X, 62 * step - 10)]
    p['LeftLeg'] = [(X, 25 + 70 * max(0, s(t, 0.15)))]
    p['RightLeg'] = [(X, 25 + 70 * max(0, s(t, 0.65)))]
    p['LeftFoot'] = [(X, 20 * step)]
    p['RightFoot'] = [(X, -20 * step)]
    p['Spine'] = [(X, 14), (Y, 4 * step)]
    p['Spine1'] = [(X, 6)]
    p['Spine2'] = [(Z, -14 * step)]
    p['Neck'] = [(X, -12)]
    p['Head'] = [(X, -10 + 6 * s(t * 2, 0.15)), (Z, 8 * step), (Y, 5 * s(t, 0.2))]
    p['Jaw'] = [(X, 6 + 3 * s(t * 2))]                 # big open grin
    tail_wag(p, t, 26, lift=14)
    p['_hips'] = (0.025 * step, 0, 0.07 * abs(s(t)) - 0.05)   # bounding
    return p

def jump(t):
    # Jumping on the spot is Wally showing off (Ken: make it dramatic). The clip
    # is stretched over his time in the air: a stretched launch, a star shape at
    # the top with a full spin, mouth wide and snout up, a tuck, and a squashy
    # landing.
    p = {}
    launch = bump(t, 0.0, 0.18)
    star = bump(t, 0.12, 0.72)
    tuck = bump(t, 0.66, 0.92)
    land = bump(t, 0.88, 1.0)
    spin = 360 * ramp(t, 0.12, 0.74)
    p['Hips'] = [(Z, spin)]                                          # the full turn in the air
    arms_down(p, 70 - 110 * launch - 120 * star + 40 * tuck, 70 - 110 * launch - 120 * star + 40 * tuck)
    p['LeftArm'].append((X, -15 * launch + 25 * tuck)); p['RightArm'].append((X, -15 * launch + 25 * tuck))
    elbow(p, 10 + 60 * tuck, 10 + 60 * tuck)
    for side, sgn in (('Left', 1), ('Right', -1)):
        p[side + 'UpLeg'] = [(Y, -sgn * 28 * star), (X, 15 * launch - 70 * tuck)]   # legs spread wide, then tucked
        p[side + 'Leg'] = [(X, 10 * star + 100 * tuck + 60 * land)]
        p[side + 'Foot'] = [(X, 35 * launch + 20 * star)]
    p['Spine'] = [(X, -10 * star + 15 * land)]
    p['Spine2'] = [(X, -10 * star)]
    p['Head'] = [(X, -30 * star + 10 * land)]
    p['Jaw'] = [(X, 4 + 14 * star - 10 * land)]                      # "Crikey!"
    tail_wag(p, t * 2, 18, lift=40 * star - 20 * land)
    p['_hips'] = (0, 0, -0.18 * land + 0.04 * launch)
    return p

def leap(t):
    # The running jump is a clean, straight-ahead leap: lead leg forward, trailing
    # leg back, arms reaching forward, tail streaming behind, reaching for the landing.
    p = {}
    air = bump(t, 0.0, 1.0)
    reach = ramp(t, 0.65, 0.95)
    arms_down(p, 55, 55)
    p['LeftArm'].append((X, -55 * air + 20 * reach)); p['RightArm'].append((X, -35 * air + 30 * reach))
    elbow(p, 20, 30)
    p['LeftUpLeg'] = [(X, -60 * air + 25 * reach)]
    p['LeftLeg'] = [(X, 45 * air - 25 * reach)]
    p['RightUpLeg'] = [(X, 35 * air - 50 * reach)]
    p['RightLeg'] = [(X, 70 * air - 40 * reach)]
    p['LeftFoot'] = [(X, -10 * air)]; p['RightFoot'] = [(X, 45 * air)]
    p['Spine'] = [(X, 16 * air)]
    p['Neck'] = [(X, -10 * air)]
    p['Head'] = [(X, -10 * air)]
    p['Jaw'] = [(X, 8 * air)]
    tail_wag(p, t, 8, lift=25 * air)
    return p

def swim(t):
    # A real croc swimming: flat body, snout in line, limbs tucked, a wave that
    # runs from the shoulders to the tail tip, side to side.
    p = {}
    p['Hips'] = [(X, 90)]                                # body flat, head forward
    chain = ['Spine', 'Spine1', 'Spine2', 'Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5']
    amp = [6, 6, 5, 11, 16, 22, 28, 34]                  # bigger than a real croc: cartoon swagger
    for i, name in enumerate(chain):
        p[name] = [(Y, amp[i] * s(t, -0.11 * i))]        # the wave travels backward
    p['Spine1'].append((Z, 6 * s(t, 0.25)))              # a little roll with each stroke
    p['Tail5'].append((X, 12 * s(t * 2, 0.3)))           # the tail tip flicks up: a show-off flourish
    p['Tail1'].insert(0, (X, -37))                       # tail straight out behind, in line
    # Like a real croc at the surface (Ken): the neck lifts so the eyes and snout
    # ride above the water while the body sits just under it; the head turns
    # back down to keep the snout level.
    p['Neck'] = [(X, -66), (Y, -7 * s(t, 0.08))]         # head held up and level...
    p['Head'] = [(X, -22 + 4 * s(t * 2, 0.2)), (Z, -5 * s(t, 0.05)), (Y, 6 * s(t, 0.3))]   # ...against the wave, with a happy bob and tilt
    p['Jaw'] = [(X, 2 + 3 * s(t * 2, 0.5))]              # grinning as he goes
    arms_down(p, 78, 78)                                 # arms back along his sides
    p['LeftArm'].append((X, 12)); p['RightArm'].append((X, 12))
    elbow(p, 10, 10)
    for side in ('Left', 'Right'):
        p[side + 'UpLeg'] = [(X, 2), (Y, (-6 if side == 'Left' else 6))]   # legs straight and together behind,
        p[side + 'Leg'] = [(X, 0)]                       # under the water
        p[side + 'Foot'] = [(X, 35)]                     # feet pointed back
    p['_hips'] = (0, 0, 0)
    return p

def climb_up(t):
    # Hand over hand up a vine: one arm reaches high while the other pulls down,
    # knees come up in turn, the body twists toward the reaching arm.
    p = {}
    a = s(t)
    p['LeftArm'] = [(Y, -60 - 25 * a), (X, -40)]
    p['RightArm'] = [(Y, 60 - 25 * a), (X, -40)]
    elbow(p, 40 + 40 * a, 40 - 40 * a)
    p['LeftUpLeg'] = [(X, -55 - 35 * a)]
    p['RightUpLeg'] = [(X, -55 + 35 * a)]
    p['LeftLeg'] = [(X, 70 + 30 * a)]
    p['RightLeg'] = [(X, 70 - 30 * a)]
    p['Spine2'] = [(Z, 10 * a), (X, 8)]
    p['Head'] = [(X, -20), (Z, 6 * a)]
    p['Jaw'] = [(X, 4)]
    tail_wag(p, t, 14, lift=10)
    p['_hips'] = (0, 0, 0.03 * a)
    return p

def climb_across(t):
    # Hanging from a line, swinging hand over hand along it: both arms overhead,
    # legs dangling and kicking, the body swinging like a pendulum.
    p = {}
    a = s(t)
    p['LeftArm'] = [(Y, -80 - 15 * a), (Z, 0)]
    p['RightArm'] = [(Y, 80 - 15 * a)]
    elbow(p, 15 - 12 * a, 15 + 12 * a)
    p['Spine'] = [(Y, 7 * a)]
    p['Spine2'] = [(Y, 5 * a)]
    p['LeftUpLeg'] = [(X, -20 * s(t * 2)), (Y, -6 * a)]
    p['RightUpLeg'] = [(X, 20 * s(t * 2)), (Y, -6 * a)]
    p['LeftLeg'] = [(X, 30 + 20 * s(t * 2, 0.2))]
    p['RightLeg'] = [(X, 30 - 20 * s(t * 2, 0.2))]
    p['Head'] = [(X, -18), (Y, -5 * a)]
    p['Jaw'] = [(X, 6)]
    tail_wag(p, t, 22, lift=5)
    return p

def ground_pick(t):
    # Spots food on the ground: bends right over, scoops it with one hand,
    # pops it into his mouth, chomp, and straightens up pleased.
    p = {}
    down = bump(t, 0.0, 0.62)
    to_mouth = bump(t, 0.4, 0.85)
    snap = bump(t, 0.6, 0.72)
    arms_down(p, 72, 72)
    p['RightArm'].append((X, -70 * down - 60 * to_mouth))
    p['LeftArm'].append((X, -15 * down))
    elbow(p, 20, 10 + 100 * to_mouth)
    p['Spine'] = [(X, 30 * down)]
    p['Spine1'] = [(X, 25 * down)]
    p['Spine2'] = [(X, 15 * down)]
    p['LeftUpLeg'] = [(X, -30 * down)]
    p['RightUpLeg'] = [(X, -30 * down)]
    p['LeftLeg'] = [(X, 45 * down)]
    p['RightLeg'] = [(X, 45 * down)]
    p['Head'] = [(X, -20 * down - 10 * to_mouth)]
    p['Jaw'] = [(X, 10 * to_mouth - 22 * snap)]
    tail_wag(p, t, 12, lift=25 * down)
    p['_hips'] = (0, 0.05 * down, -0.15 * down)
    return p

def celebrate(t):
    # The video's big moment: arms wide, leaning back, laughing, bouncing.
    p = {}
    b = abs(s(t * 2))
    p['LeftArm'] = [(Y, -25 - 10 * b), (X, -20)]
    p['RightArm'] = [(Y, 25 + 10 * b), (X, -20)]
    elbow(p, 25 + 15 * b, 30 + 15 * b)
    p['Spine'] = [(X, -10 - 4 * b)]
    p['Spine2'] = [(X, -8), (Z, 8 * s(t))]
    p['Head'] = [(X, -25 - 8 * b), (Y, 10 * s(t))]
    p['Jaw'] = [(X, 8 + 8 * b)]
    p['LeftUpLeg'] = [(Y, 6), (X, -10 * b)]
    p['RightUpLeg'] = [(Y, -6), (X, -10 * b)]
    p['LeftLeg'] = [(X, 20 * b)]
    p['RightLeg'] = [(X, 20 * b)]
    tail_wag(p, t * 2, 25, lift=20)
    p['_hips'] = (0, 0, 0.06 * b - 0.03)
    return p

def hurt(t):
    # Stung: jolts back, arms flail, eyes-shut grimace (jaw clamps), shakes it off.
    p = {}
    hit = bump(t, 0.0, 0.5)
    shake = math.sin(t * 30) * (1 - t)
    arms_down(p, 70 - 80 * hit, 70 - 90 * hit)
    p['LeftArm'].append((X, -30 * hit + 10 * shake))
    p['RightArm'].append((X, -20 * hit - 10 * shake))
    elbow(p, 50 * hit, 60 * hit)
    p['Spine'] = [(X, -18 * hit)]
    p['Head'] = [(X, -20 * hit), (Z, 15 * shake)]
    p['Jaw'] = [(X, -10 * hit)]
    tail_wag(p, t * 3, 20, lift=30 * hit)
    p['_hips'] = (0, 0.05 * hit, -0.04 * hit)
    return p

UPPER = {'Spine2', 'Neck', 'Head', 'Jaw', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm',
         'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'}

def chomp(t):
    # Snapping food out of the air: head pulls back with the mouth wide, then
    # lunges and snaps shut, two happy chews. Head and jaw only, so it plays over
    # running, jumping or swimming.
    p = {}
    wind = bump(t, 0.0, 0.3)
    snap = ramp(t, 0.25, 0.35) * (1 - ramp(t, 0.45, 0.6))
    chew = bump(t, 0.6, 0.75) + bump(t, 0.78, 0.93)
    p['Neck'] = [(X, -10 * wind + 14 * snap)]
    p['Head'] = [(X, -12 * wind + 10 * snap)]
    p['Jaw'] = [(X, 12 * wind - 12 * snap + 6 * chew - 6 * ramp(t, 0.35, 0.6) * (1 - ramp(t, 0.9, 1)))]
    return p

def grab(t):
    # Catching with his hands: both reach up and clap onto the food, pull it in
    # to the mouth, chomp, and a pleased little shimmy. Upper body only.
    p = {}
    reach = bump(t, 0.0, 0.45)
    to_mouth = bump(t, 0.3, 0.85)
    snap = bump(t, 0.55, 0.68)
    p['LeftArm'] = [(Y, 70 - 120 * reach - 40 * to_mouth), (X, -60 * reach - 50 * to_mouth)]
    p['RightArm'] = [(Y, -70 + 115 * reach + 40 * to_mouth), (X, -55 * reach - 50 * to_mouth)]
    elbow(p, 20 + 90 * to_mouth, 25 + 90 * to_mouth)
    p['Spine2'] = [(X, -6 * reach + 6 * to_mouth), (Z, 8 * s(t * 2) * ramp(t, 0.7, 0.85))]
    p['Head'] = [(X, -15 * reach + 8 * to_mouth)]
    p['Jaw'] = [(X, 10 * to_mouth - 20 * snap)]
    return p

# name: (pose function, length in frames, loops)
MOVES = {
    'Idle':        (idle, 90, True),
    'Walk':        (walk, 30, True),
    'Run':         (run, 18, True),
    'Jump':        (jump, 40, False),
    'Leap':        (leap, 30, False),
    'Swim':        (swim, 36, True),
    'ClimbUp':     (climb_up, 30, True),
    'ClimbAcross': (climb_across, 36, True),
    'GroundPick':  (ground_pick, 36, False),
    'Celebrate':   (celebrate, 36, True),
    'Hurt':        (hurt, 24, False),
    'Chomp':       (chomp, 15, False),
    'Grab':        (grab, 30, False),
}

# ---- Keyframing ----------------------------------------------------------------

P = rig.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in P}

def to_local(name, turns):
    m = Matrix.Identity(3)
    for axis, deg in turns:
        m = Matrix.Rotation(math.radians(deg), 3, Vector(axis)) @ m
    r = REST[name]
    return (r.inverted() @ m @ r).to_quaternion()

if rig.animation_data is None:
    rig.animation_data_create()
for b in P:
    b.rotation_mode = 'QUATERNION'

STEP = 2   # a key every 2 frames; Blender's smooth curves fill in between
for name, (fn, length, loops) in MOVES.items():
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    bones = {'Chomp': {'Neck', 'Head', 'Jaw'}, 'Grab': UPPER}.get(name, {b.name for b in P})
    last = {}
    for f in list(range(0, length, STEP)) + [length]:
        t = f / length
        pose = fn(0.0 if (loops and f == length) else t)
        for bn in bones:
            pb = P[bn]
            q = to_local(bn, pose.get(bn, []))
            if bn in last and last[bn].dot(q) < 0:
                q.negate()                       # keep neighbouring keys on the same side, no spins
            last[bn] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
        if name not in ('Chomp', 'Grab'):
            hips = P['Hips']
            hips.location = REST['Hips'].inverted() @ Vector(pose.get('_hips', (0, 0, 0)))
            hips.keyframe_insert('location', frame=f + 1)
    act.frame_range = (1, length + 1)
    # Push each action onto its own track so the exporter writes it as a clip.
    track = rig.animation_data.nla_tracks.new(); track.name = name
    track.strips.new(name, 1, act)
    rig.animation_data.action = None
    for pb in P:
        pb.rotation_quaternion = Quaternion(); pb.location = Vector()
    print('MOVE', name, length, 'frames')

bpy.ops.wm.save_as_mainfile(filepath=rig_file.replace('.blend', '-moves.blend'))

# ---- Export -------------------------------------------------------------------
# Blender's importer adds a small sphere as a bone display shape; it must not ship.
for pb in P:
    pb.custom_shape = None
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o != body:
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True); body.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_frame_step=1,
                          export_yup=True, export_skins=True)
print('EXPORTED', out_glb)

# ---- Preview: a strip of frames from each move ---------------------------------
if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 300, 360
    scene.world = bpy.data.worlds.new('w')
    rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.6
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = Vector((7.5, -7.5, 1.2)); cam.rotation_euler = (math.radians(84), 0, math.radians(45))
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    for name, (fn, length, loops) in MOVES.items():
        rig.animation_data.action = bpy.data.actions[name]
        for k in range(6):
            f = 1 + round(length * k / 6)
            scene.frame_set(f)
            scene.render.filepath = '%s-%s-%d.png' % (preview, name, k)
            bpy.ops.render.render(write_still=True)
    print('PREVIEWED')
