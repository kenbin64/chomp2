# blender-animate-kenny.py
# Kenny the Koala's moves, on the rig from blender-rig-kenny.py, exported as one
# GLB with each move as a named clip, and his jar in his right hand.
#
# Kenny is always happy and does his own thing (Ken's direction), and he always
# carries his jar. Like Wally he never stands perfectly still, and his big ears
# bounce a beat behind his head (follow-through), which is most of his charm.
#
# Moves, matching what he does in the game (js/kenny.js):
#   Idle      sitting about, happy, jar held at his chest
#   Walk      wandering: a bouncy waddle
#   Run       hurrying to help Wally, jar held up high
#   Wave      a big cheery wave with his free hand
#   Offer     holds the jar out to Wally and sets it down (the game swaps in the
#             pickup jar at the half-way point and hides the one in his hand)
#   Celebrate jumping for joy, jar in the air
#
# The jar is a separate object parented to his right hand bone and named
# HeldJar, so the game can hide it while it is on the ground.
#
# Directions are given in the rig's rest frame: x is Kenny's left, y is his
# back, z is up; each turn is (axis, degrees) from the rest pose (an A-pose).
#
#   blender --background --factory-startup --python tools/blender-animate-kenny.py -- rig.blend jar.glb out.glb [preview-prefix]

import sys, math
import bpy
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
rig_file, jar_file, out_glb = args[0], args[1], args[2]
preview = args[3] if len(args) > 3 else None

bpy.ops.wm.open_mainfile(filepath=rig_file)
rig = bpy.data.objects['KennyRig']
body = bpy.data.objects['Kenny']
bpy.context.scene.render.fps = 30
P = rig.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in P}

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = math.pi * 2
def s(t, phase=0.0): return math.sin(TAU * (t + phase))
def bump(t, a, b): return 0.0 if t <= a or t >= b else math.sin(math.pi * (t - a) / (b - a))
def ramp(t, a, b):
    u = min(max((t - a) / (b - a), 0.0), 1.0); return u * u * (3 - 2 * u)

def bend_axis(name):
    # The axis that folds a forearm forward, whatever angle the arm rests at:
    # square to the forearm and to "forward" (-y).
    d = REST[name].col[1].normalized()
    return tuple(d.cross(Vector((0, -1, 0))).normalized())

def elbow(p, left=0, right=0):
    p.setdefault('LeftForeArm', []).append((bend_axis('LeftForeArm'), left))
    p.setdefault('RightForeArm', []).append((bend_axis('RightForeArm'), right))

def carry(p, t, lift=0.0, bob=1.0):
    # The jar arm: elbow bent, jar held in front of his chest. lift raises it.
    p['RightArm'] = [(Y, -8 + 25 * lift), (X, -35 - 40 * lift + 3 * bob * s(t * 2))]
    p.setdefault('RightForeArm', []).append((bend_axis('RightForeArm'), 95 - 30 * lift))

def ears(p, t, amount=8, speed=1.0, lag=0.12):
    # Ears follow the head a moment late: they flop up and down and swing a little.
    for side, sign in (('Left', 1), ('Right', -1)):
        p[side + 'Ear'] = [(Y, sign * amount * s(t * speed, -lag)), (X, 0.5 * amount * s(t * speed, -lag - 0.2))]

def legs_walk(p, t, swing, knee):
    step = s(t)
    p['LeftUpLeg'] = [(X, -swing * step)]
    p['RightUpLeg'] = [(X, swing * step)]
    p['LeftLeg'] = [(X, knee * max(0, s(t, 0.2)))]
    p['RightLeg'] = [(X, knee * max(0, s(t, 0.7)))]

def idle(t):
    p = {}
    carry(p, t)
    p['LeftArm'] = [(Y, 30 + 4 * s(t, 0.1)), (X, -10 + 6 * s(t * 2, 0.3))]
    elbow(p, left=20 + 8 * s(t * 2))
    p['Spine'] = [(Y, 3 * s(t))]
    p['Spine1'] = [(X, 2 * s(t * 2))]
    p['Head'] = [(Y, 8 * s(t, 0.25)), (Z, 12 * s(t, 0.4)), (X, -4)]       # happy head tilts
    ears(p, t * 2, 7)
    p['_hips'] = (0.01 * s(t), 0, 0.012 * abs(s(t * 2)))                 # little bounce on his toes
    return p

def walk(t):
    p = {}
    carry(p, t, bob=2)
    p['LeftArm'] = [(Y, 30), (X, 28 * s(t))]
    elbow(p, left=25)
    legs_walk(p, t, 26, 40)
    p['Spine'] = [(Y, 7 * s(t))]                                            # the waddle
    p['Spine2'] = [(Y, -4 * s(t)), (Z, -6 * s(t))]
    p['Head'] = [(Y, -5 * s(t)), (X, -3 + 4 * s(t * 2, 0.15))]
    ears(p, t * 2, 12)
    p['_hips'] = (0.03 * s(t), 0, 0.03 * abs(s(t)) - 0.01)
    return p

def run(t):
    p = {}
    carry(p, t, lift=0.6, bob=3)                                           # jar held up: "coming, mate!"
    p['LeftArm'] = [(Y, 20), (X, 50 * s(t))]
    elbow(p, left=70)
    legs_walk(p, t, 50, 70)
    p['Spine'] = [(X, 14), (Y, 5 * s(t))]
    p['Head'] = [(X, -14), (Z, 6 * s(t))]
    ears(p, t * 2, 20, lag=0.2)
    p['_hips'] = (0.02 * s(t), 0, 0.06 * abs(s(t)) - 0.03)
    return p

def wave(t):
    p = {}
    carry(p, t)
    p['LeftArm'] = [(Y, -70), (X, -45)]                                    # free hand up, in front of his big ear
    elbow(p, left=25 + 25 * s(t * 3))                                      # and waving
    p['Spine'] = [(Y, -6)]
    p['Head'] = [(Y, 10 * s(t, 0.1)), (X, -8)]
    ears(p, t * 3, 10)
    p['_hips'] = (0, 0, 0.02 * abs(s(t * 3)))
    return p

def offer(t):
    # Holds the jar out to Wally, crouches and sets it down, stands up pleased.
    p = {}
    out = bump(t, 0.0, 0.75)
    down = bump(t, 0.25, 0.75)
    p['RightArm'] = [(Y, -8), (X, -35 - 45 * out)]
    elbow(p, right=95 - 70 * out, left=40 * out)
    p['LeftArm'] = [(Y, 25), (X, -70 * out)]                              # second hand under the jar
    p['Spine'] = [(X, 20 * down)]
    p['Spine1'] = [(X, 15 * down)]
    p['LeftUpLeg'] = [(X, -45 * down)]; p['RightUpLeg'] = [(X, -45 * down)]
    p['LeftLeg'] = [(X, 70 * down)]; p['RightLeg'] = [(X, 70 * down)]
    p['Head'] = [(X, 10 * out - 15 * ramp(t, 0.75, 1.0)), (Y, 8 * ramp(t, 0.75, 1.0))]
    ears(p, t * 3, 8)
    p['_hips'] = (0, 0.03 * down, -0.16 * down)
    return p

def celebrate(t):
    p = {}
    b = abs(s(t * 2))
    carry(p, t, lift=1.0)
    p['RightArm'] = [(Y, 45 + 10 * b), (X, -35)]                           # jar up in the air
    p['LeftArm'] = [(Y, -45 - 10 * b), (X, -35)]
    elbow(p, left=20, right=20)
    p['LeftUpLeg'] = [(X, -25 * b)]; p['RightUpLeg'] = [(X, -25 * b)]
    p['LeftLeg'] = [(X, 40 * b)]; p['RightLeg'] = [(X, 40 * b)]
    p['Head'] = [(X, -15), (Y, 8 * s(t))]
    ears(p, t * 4, 18)
    p['_hips'] = (0, 0, 0.10 * b)
    return p

MOVES = {
    'Idle': (idle, 90, True), 'Walk': (walk, 30, True), 'Run': (run, 18, True),
    'Wave': (wave, 36, True), 'Offer': (offer, 45, False), 'Celebrate': (celebrate, 36, True),
}

def to_local(name, turns):
    m = Matrix.Identity(3)
    for axis, deg in turns:
        m = Matrix.Rotation(math.radians(deg), 3, Vector(axis)) @ m
    r = REST[name]
    return (r.inverted() @ m @ r).to_quaternion()

def apply_pose(pose):
    for pb in P:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = to_local(pb.name, pose.get(pb.name, []))
    P['Hips'].location = REST['Hips'].inverted() @ Vector(pose.get('_hips', (0, 0, 0)))

# ---- The jar in his right hand -------------------------------------------------------
# Placed upright at his palm while he holds the carrying pose, then parented to
# the hand bone so it moves with the hand from then on.
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=jar_file)
jar = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]
for o in [o for o in bpy.data.objects if o not in before and o != jar]:
    bpy.data.objects.remove(o)
jar.name = 'HeldJar'
bpy.context.view_layer.objects.active = jar
bpy.ops.object.select_all(action='DESELECT'); jar.select_set(True)
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
jar.location = (0, 0, 0)
jar.scale *= 0.28 / jar.dimensions.z                       # about 0.28 of Kenny's 1.9 height
bpy.ops.object.transform_apply(scale=True)
apply_pose(idle(0.0))
bpy.context.view_layer.update()
hand = rig.matrix_world @ P['RightHand'].matrix
palm = hand @ Vector((0, 0.07, 0))                           # a little way along the hand
want = Matrix.Translation(palm + Vector((0.0, -0.10, 0.06)))   # in front of the palm, held up
jar.parent = rig; jar.parent_type = 'BONE'; jar.parent_bone = 'RightHand'
bpy.context.view_layer.update()
jar.matrix_world = want
bpy.context.view_layer.update()

# ---- Keyframes -----------------------------------------------------------------------
if rig.animation_data is None: rig.animation_data_create()
for name, (fn, length, loops) in MOVES.items():
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    last = {}
    for f in list(range(0, length, 2)) + [length]:
        apply_pose(fn(0.0 if (loops and f == length) else f / length))
        for pb in P:
            q = pb.rotation_quaternion.copy()
            if pb.name in last and last[pb.name].dot(q) < 0: q.negate(); pb.rotation_quaternion = q
            last[pb.name] = q
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
        P['Hips'].keyframe_insert('location', frame=f + 1)
    act.frame_range = (1, length + 1)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act)
    rig.animation_data.action = None
    print('MOVE', name, length)
for pb in P:
    pb.rotation_quaternion = Quaternion(); pb.location = Vector()

bpy.ops.wm.save_as_mainfile(filepath=rig_file.replace('.blend', '-moves.blend'))

for pb in P: pb.custom_shape = None
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o not in (body, jar): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in (rig, body, jar): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out_glb)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 300, 360
    scene.world = bpy.data.worlds.new('w'); rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.6
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = Vector((7.5, -7.5, 1.0)); cam.rotation_euler = (math.radians(84), 0, math.radians(45))
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    for name, (fn, length, loops) in MOVES.items():
        rig.animation_data.action = bpy.data.actions[name]
        for k in range(6):
            scene.frame_set(1 + round(length * k / 6))
            scene.render.filepath = '%s-%s-%d.png' % (preview, name, k)
            bpy.ops.render.render(write_still=True)
    print('PREVIEWED')
