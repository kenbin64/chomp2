# blender-rig-croc.py
# The regular crocodile (Ken's Meshy croc, models/croc-regular.glb): skeleton,
# skin weights and moves in one go, exported as a GLB with clips Swim, Walk, Idle.
#
# How a real crocodile moves, which the moves follow:
#   Swim  the legs fold back flat against the body and the tail does the work,
#         a wave that runs from the hips to the tip, growing as it goes, with
#         the head held steady.
#   Walk  the low "sprawl" walk: diagonal legs move together (front left with
#         back right), each lifted a little as it swings forward, while the
#         spine curves side to side and the tail drags in a gentle sway.
#   Idle  lying still, the way a croc rests (Ken, 2026-10-20): the legs drawn in
#         along its sides, elbows and knees bent, feet tucked beside the body (not
#         spread flat as the model was made); breathing, a slow drift of the tail tip.
#
# The model lies flat (Blender: z up, the snout toward -y, its left side +x).
# Bone positions were measured from the model (tools/blender-inspect.py and a
# slice-by-slice measure): snout at y -0.95, front shoulders at y -0.46 with the
# front feet out at x +-0.54, hips at y 0.12 with the back feet at x +-0.48, the
# tail from y 0.25 to the tip at 0.95; the body is about 0.24 high, centred near z 0.
#
#   blender --background --factory-startup --python tools/blender-rig-croc.py -- in.glb out.glb [preview-prefix]

import sys, math
import bpy
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
src, out_glb = args[0], args[1]
preview = args[2] if len(args) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
body.name = 'Croc'

def side(name, x): return name.replace('Left', 'Right') if x < 0 else name

BONES = [
    ('Hips',  (0, 0.12, 0.0),   (0, -0.05, 0.01), None),
    ('Spine', (0, -0.05, 0.01), (0, -0.30, 0.02), 'Hips'),
    ('Chest', (0, -0.30, 0.02), (0, -0.50, 0.02), 'Spine'),
    ('Neck',  (0, -0.50, 0.02), (0, -0.62, 0.01), 'Chest'),
    ('Head',  (0, -0.62, 0.01), (0, -0.95, -0.03), 'Neck'),
]
TAIL = [0.12, 0.28, 0.43, 0.57, 0.71, 0.84, 0.95]
for i in range(len(TAIL) - 1):
    BONES.append(('Tail%d' % (i + 1), (0, TAIL[i], -0.01 * i), (0, TAIL[i + 1], -0.01 * (i + 1)), 'Hips' if i == 0 else 'Tail%d' % i))
for s in (1, -1):
    def m(p): return (s * p[0], p[1], p[2])
    BONES += [
        (side('LeftArm', s),     m((0.12, -0.46, 0.00)), m((0.30, -0.45, -0.05)), 'Chest'),
        (side('LeftForeArm', s), m((0.30, -0.45, -0.05)), m((0.45, -0.44, -0.09)), side('LeftArm', s)),
        (side('LeftHand', s),    m((0.45, -0.44, -0.09)), m((0.55, -0.44, -0.11)), side('LeftForeArm', s)),
        (side('LeftUpLeg', s),   m((0.12, 0.12, -0.01)), m((0.28, 0.13, -0.06)), 'Hips'),
        (side('LeftLeg', s),     m((0.28, 0.13, -0.06)), m((0.42, 0.14, -0.10)), side('LeftUpLeg', s)),
        (side('LeftFoot', s),    m((0.42, 0.14, -0.10)), m((0.49, 0.145, -0.11)), side('LeftLeg', s)),
    ]

arm_data = bpy.data.armatures.new('CrocRig')
rig = bpy.data.objects.new('CrocRig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
made = {}
for name, head, tail, parent in BONES:
    b = arm_data.edit_bones.new(name); b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = made[parent]; b.use_connect = (Vector(head) - made[parent].tail).length < 1e-4
    made[name] = b
bpy.ops.object.mode_set(mode='OBJECT')

# ---- Skin weights: nearest bone, kept to its part, then softened ------------------
# Each point takes the nearest bone it may belong to: the legs only out to the
# sides (past the body's flank), the body and tail only in the middle, and a leg
# only on its own side. The weights are then blurred along the surface so the
# shoulders and hips bend softly.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_NAME')
segments = {n: (Vector(h), Vector(t)) for n, h, t, _ in BONES}
LEG = ('Arm', 'Hand', 'Leg', 'Foot')
def allowed(n, p):
    leg = any(w in n for w in LEG)
    if leg and abs(p.x) < 0.13: return False                  # the flank is body
    if not leg and abs(p.x) > 0.22: return False              # out at the sides is leg
    if ('Left' in n and p.x < 0) or ('Right' in n and p.x > 0): return False
    if leg and ('Arm' in n or 'Hand' in n) and p.y > -0.2: return False   # front legs stay at the front
    if leg and ('UpLeg' in n or n.endswith('Leg') or 'Foot' in n) and p.y < -0.15: return False
    return True
def nearest(p):
    best, name = 1e9, 'Spine'
    for n, (a, b) in segments.items():
        if not allowed(n, p): continue
        ab = b - a; u = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        d = (p - (a + ab * u)).length
        if d < best: best, name = d, n
    return name
for v in body.data.vertices:
    body.vertex_groups[nearest(v.co)].add([v.index], 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=5)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- Moves -----------------------------------------------------------------------
# Turns are given about the world's axes: Z turns side to side (a yaw), X tips up
# and down along the body, Y rolls about the body's length (it lifts a leg's foot).
P = rig.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in P}
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = math.pi * 2
def sn(t, ph=0.0): return math.sin(TAU * (t + ph))
def cs(t, ph=0.0): return math.cos(TAU * (t + ph))

def tail_wave(p, t, amp, lag=0.12, grow=1.6):
    # A wave from the hips to the tip, each bone a little behind the one before.
    n = len(TAIL) - 1
    for i in range(n):
        p['Tail%d' % (i + 1)] = [(Z, amp * (1 + grow * i / n) * sn(t, -lag * i))]

def legs_tucked(p):
    # Swimming: the legs laid back along the body (the feet toward the tail).
    for name, sg in (('Left', 1), ('Right', -1)):
        p[name + 'Arm'] = [(Z, sg * 70), (Y, -sg * 8)]
        p[name + 'ForeArm'] = [(Z, sg * 25)]
        p[name + 'UpLeg'] = [(Z, sg * 75), (Y, -sg * 6)]
        p[name + 'Leg'] = [(Z, sg * 20)]

def swim(t):
    p = {}
    legs_tucked(p)
    tail_wave(p, t, 9)
    p['Hips'] = [(Z, -3 * sn(t, 0.1))]             # the body answers the tail a little
    p['Head'] = [(Z, 2.5 * sn(t, 0.1))]            # and the head is held on line
    return p

def walk(t):
    p = {}
    # Diagonal pairs: front left with back right, then front right with back left.
    for name, sg, ph in (('Left', 1, 0.0), ('Right', -1, 0.5)):
        fwd = sn(t, ph)                                    # +1: swung forward (toward the head)
        lift = max(0.0, cs(t, ph))                         # lifted while it swings forward
        p[name + 'Arm'] = [(Z, -sg * 28 * fwd), (Y, -sg * 18 * lift)]
        p[name + 'ForeArm'] = [(Y, sg * 10 * lift)]
        back = sn(t, ph + 0.5)                             # the hind leg of the other pair moves with it
        lift2 = max(0.0, cs(t, ph + 0.5))
        p[name + 'UpLeg'] = [(Z, -sg * 26 * back), (Y, -sg * 16 * lift2)]
        p[name + 'Leg'] = [(Y, sg * 10 * lift2)]
    p['Spine'] = [(Z, 6 * sn(t))]                          # the spine bends toward the forward leg
    p['Chest'] = [(Z, 4 * sn(t))]
    p['Head'] = [(Z, -6 * sn(t))]                          # the head keeps looking ahead
    tail_wave(p, t, 4, lag=0.15, grow=1.0)
    return p

def legs_resting(p):
    # Drawn in close along the flanks: the upper leg swept back a little and down,
    # the lower leg folded forward under it, so the foot sits beside the body.
    for name, sg in (('Left', 1), ('Right', -1)):
        p[name + 'Arm'] = [(Z, sg * 35), (Y, sg * 18)]
        p[name + 'ForeArm'] = [(Z, -sg * 55)]
        p[name + 'Hand'] = [(Z, sg * 25)]
        p[name + 'UpLeg'] = [(Z, sg * 40), (Y, sg * 16)]
        p[name + 'Leg'] = [(Z, -sg * 60)]
        p[name + 'Foot'] = [(Z, sg * 30)]

def idle(t):
    p = {}
    legs_resting(p)
    p['Chest'] = [(X, 1.2 * sn(t))]                        # breathing
    p['Head'] = [(X, -1.0 * sn(t, 0.1))]
    tail_wave(p, t, 1.5, lag=0.2, grow=2.0)
    return p

MOVES = {'Swim': (swim, 40), 'Walk': (walk, 32), 'Idle': (idle, 120)}

def to_local(name, turns):
    m = Matrix.Identity(3)
    for axis, deg in turns:
        m = Matrix.Rotation(math.radians(deg), 3, Vector(axis)) @ m
    r = REST[name]
    return (r.inverted() @ m @ r).to_quaternion()

rig.animation_data_create()
for name, (fn, length) in MOVES.items():
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    last = {}
    for f in list(range(0, length, 1)) + [length]:
        pose = fn((f % length) / length)
        for pb in P:
            pb.rotation_mode = 'QUATERNION'
            q = to_local(pb.name, pose.get(pb.name, []))
            if pb.name in last and last[pb.name].dot(q) < 0: q.negate()
            last[pb.name] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
    act.frame_range = (1, length + 1)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act)
    rig.animation_data.action = None
    print('MOVE', name, length)
for pb in P:
    pb.rotation_quaternion = Quaternion(); pb.location = Vector()

bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); body.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out_glb)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 360, 300
    scene.world = bpy.data.worlds.new('w'); rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.2
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = Vector((0, 0, 4)); cam.rotation_euler = (0, 0, 0)       # straight down from above
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    for name, (fn, length) in MOVES.items():
        rig.animation_data.action = bpy.data.actions[name]
        for k in range(4):
            scene.frame_set(1 + round(length * k / 4))
            scene.render.filepath = '%s-%s-%d.png' % (preview, name, k)
            bpy.ops.render.render(write_still=True)
    print('PREVIEWED')
