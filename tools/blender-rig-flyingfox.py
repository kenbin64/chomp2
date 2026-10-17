# blender-rig-flyingfox.py
# The flying fox: skeleton, skin weights and flight moves in one go, exported
# as a GLB with clips Fly, Glide and Dive.
#
# A bat's wing is a hand: an upper arm, a forearm, and long fingers with skin
# stretched between them. In real flight the wing beats down fully spread, then
# on the way up the elbow and fingers fold it in, so it meets less air, before
# spreading for the next downstroke. That fold is what makes it read as a bat
# rather than a bird or a flapping sheet.
#
# The model stands in its front view (Blender: z up toward the head, front is
# -y, its left wing along +x). The game turns it to fly belly-down, so here
# "wing up" means the tip moves toward +y (its back). Bone positions were
# measured from the model: shoulder near x 0.2, wrist claw at x 0.47 z 0.27,
# leading finger to the tip at x 0.95, middle finger to the scallop at x 0.57
# z -0.23, rear finger to the trailing edge near x 0.33 z -0.17.
#
#   blender --background --factory-startup --python tools/blender-rig-flyingfox.py -- in.glb out.glb [preview-prefix]

import sys, math
import bpy
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
src, out_glb = args[0], args[1]
preview = args[2] if len(args) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
body.name = 'FlyingFox'

def side(name, x): return name.replace('Left', 'Right') if x < 0 else name

BONES = [
    ('Hips',  (0, 0, -0.35), (0, 0, -0.10), None),
    ('Spine', (0, 0, -0.10), (0, 0, 0.15), 'Hips'),
    ('Chest', (0, 0, 0.15), (0, 0, 0.28), 'Spine'),
    ('Head',  (0, 0, 0.28), (0, -0.02, 0.54), 'Chest'),
]
for s in (1, -1):
    def m(p): return (s * p[0], p[1], p[2])
    BONES += [
        (side('LeftShoulder', s), m((0.06, 0, 0.20)), m((0.20, 0, 0.21)), 'Chest'),
        (side('LeftArm', s),      m((0.20, 0, 0.21)), m((0.36, 0, 0.24)), side('LeftShoulder', s)),
        (side('LeftForeArm', s),  m((0.36, 0, 0.24)), m((0.47, 0, 0.27)), side('LeftArm', s)),
        (side('LeftFingerA1', s), m((0.47, 0, 0.27)), m((0.72, 0, 0.20)), side('LeftForeArm', s)),
        (side('LeftFingerA2', s), m((0.72, 0, 0.20)), m((0.95, 0, -0.05)), side('LeftFingerA1', s)),
        (side('LeftFingerB', s),  m((0.47, 0, 0.27)), m((0.57, 0, -0.23)), side('LeftForeArm', s)),
        (side('LeftFingerC', s),  m((0.47, 0, 0.27)), m((0.33, 0, -0.17)), side('LeftForeArm', s)),
        (side('LeftLeg', s),      m((0.08, 0, -0.30)), m((0.10, 0, -0.52)), 'Hips'),
    ]

arm_data = bpy.data.armatures.new('FoxRig')
rig = bpy.data.objects.new('FoxRig', arm_data)
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
# The wing skin is a few large triangles between the fingers, which automatic
# weights handle badly, so each point takes the nearest bone it is allowed to
# belong to and the weights are then blurred a little along the surface.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_NAME')
segments = {n: (Vector(h), Vector(t)) for n, h, t, _ in BONES}
WING = ('Shoulder', 'Arm', 'Finger')
def allowed(n, p):
    if any(w in n for w in WING) and abs(p.x) < 0.15: return False       # the body is body
    if not any(w in n for w in WING) and abs(p.x) > 0.26: return False   # the wing is wing
    if 'Leg' in n and p.z > -0.25: return False
    if ('Left' in n and p.x < 0) or ('Right' in n and p.x > 0): return False
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
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- Moves -----------------------------------------------------------------------
P = rig.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in P}
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = math.pi * 2
def sn(t, ph=0.0): return math.sin(TAU * (t + ph))
def cs(t, ph=0.0): return math.cos(TAU * (t + ph))
def bump(t, a, b): return 0.0 if t <= a or t >= b else math.sin(math.pi * (t - a) / (b - a))

def wings(p, up, fold, sweep=0.0, lag=0.0):
    # up: degrees the whole wing is raised; fold: 0 spread to 1 tucked;
    # sweep: degrees swept forward (toward the head). Fingers trail a little.
    for name, sg in (('Left', 1), ('Right', -1)):
        p[name + 'Arm'] = [(Y, -sg * sweep), (Z, sg * up)]
        p[name + 'ForeArm'] = [(Y, sg * 35 * fold), (Z, sg * 6 * lag)]
        p[name + 'FingerA1'] = [(Y, sg * 45 * fold), (Z, sg * 10 * lag)]
        p[name + 'FingerA2'] = [(Y, sg * 25 * fold), (Z, sg * 14 * lag)]
        p[name + 'FingerB'] = [(Y, sg * 40 * fold), (Z, sg * 10 * lag)]
        p[name + 'FingerC'] = [(Y, sg * 20 * fold)]

def fly(t):
    p = {}
    up = 52 * cs(t) + 4                      # top of the stroke at t = 0, bottom at 0.5
    fold = bump(t, 0.5, 1.0)                 # folding in on the way up
    wings(p, up, fold, sweep=12 * bump(t, 0.0, 0.5), lag=sn(t, -0.1))
    p['Head'] = [(Z, 0), (X, -4 * sn(t))]
    p['LeftLeg'] = [(X, 8 * sn(t, 0.2))]; p['RightLeg'] = [(X, 8 * sn(t, 0.25))]
    p['_hips'] = (0, 0.03 * sn(t), 0)        # the body rises on each downstroke
    return p

def glide(t):
    p = {}
    bank = sn(t)
    wings(p, 6 + 3 * sn(t * 2), 0.05, lag=0.3 * sn(t * 2))
    p['LeftArm'].append((Z, 6 * bank)); p['RightArm'].append((Z, 6 * bank))   # a gentle lean, one wing up
    p['Head'] = [(Y, -6 * bank)]
    return p

def dive(t):
    p = {}
    wings(p, -8 + 14 * cs(t), 0.55 + 0.1 * cs(t), sweep=-15, lag=sn(t, -0.15))
    p['Head'] = [(X, 8)]
    p['LeftLeg'] = [(X, -10)]; p['RightLeg'] = [(X, -10)]
    return p

MOVES = {'Fly': (fly, 16), 'Glide': (glide, 60), 'Dive': (dive, 12)}

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
        P['Hips'].location = REST['Hips'].inverted() @ Vector(pose.get('_hips', (0, 0, 0)))
        P['Hips'].keyframe_insert('location', frame=f + 1)
    act.frame_range = (1, length + 1)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act)
    rig.animation_data.action = None
    print('MOVE', name, length)
for pb in P:
    pb.rotation_quaternion = Quaternion(); pb.location = Vector()

bpy.ops.wm.save_as_mainfile(filepath=out_glb.replace('.glb', '.blend'))
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); body.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out_glb)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 360, 260
    scene.world = bpy.data.worlds.new('w'); rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.3
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    # Looking at the bat from in front and a little above its flight line: the
    # model's head (+z) is the bat's nose, its back (+y) is up in flight.
    cam.location = Vector((2.6, 2.2, 6.0))                   # ahead of it, above, a little to one side
    f = (-cam.location).normalized(); up_hint = Vector((0, 1, 0))
    right = f.cross(up_hint).normalized(); up = right.cross(f)
    cam.rotation_euler = Matrix((right, up, -f)).transposed().to_euler()
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    for name, (fn, length) in MOVES.items():
        rig.animation_data.action = bpy.data.actions[name]
        for k in range(6):
            scene.frame_set(1 + round(length * k / 6))
            scene.render.filepath = '%s-%s-%d.png' % (preview, name, k)
            bpy.ops.render.render(write_still=True)
    print('PREVIEWED')
