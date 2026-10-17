# blender-rig-kenny.py
# Builds Kenny the Koala's skeleton on his baked game model (about 20k
# triangles, made from the Meshy original by tools/blender-bake-lowpoly.py) and
# binds the skin. Same bone names as Wally (the Mixamo pattern without the
# prefix), plus an ear bone each side so his big ears can bounce and wobble.
# No jaw: his mouth stays in its happy open smile.
#
# Joint positions were measured by slicing the model (Blender coordinates: z
# up, front is -y, his left is +x). He stands in an A-pose: arms about 45
# degrees down from the shoulders.
#
#   blender --background --factory-startup --python tools/blender-rig-kenny.py -- in.glb out.blend

import sys
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
body.name = 'Kenny'

def side(name, x):
    return name.replace('Left', 'Right') if x < 0 else name

# Shoulder, elbow, wrist and fingertip of his left arm (the right mirrors it).
SHOULDER, ELBOW, WRIST, TIP = (0.30, 0.0, 0.08), (0.50, -0.02, -0.09), (0.67, -0.03, -0.25), (0.80, -0.05, -0.40)

BONES = [
    ('Hips',   (0, 0.0, -0.48), (0, 0.0, -0.25), None),
    ('Spine',  (0, 0.0, -0.25), (0, 0.0, -0.05), 'Hips'),
    ('Spine1', (0, 0.0, -0.05), (0, 0.0, 0.08), 'Spine'),
    ('Spine2', (0, 0.0, 0.08), (0, 0.0, 0.18), 'Spine1'),
    ('Neck',   (0, 0.0, 0.18), (0, -0.02, 0.27), 'Spine2'),
    ('Head',   (0, -0.02, 0.27), (0, -0.02, 0.90), 'Neck'),
]
for s in (1, -1):
    def m(p): return (s * p[0], p[1], p[2])
    BONES += [
        (side('LeftEar', s),      m((0.30, 0.04, 0.62)), m((0.64, 0.06, 0.66)), 'Head'),
        (side('LeftShoulder', s), m((0.08, 0.0, 0.13)), m(SHOULDER), 'Spine2'),
        (side('LeftArm', s),      m(SHOULDER), m(ELBOW), side('LeftShoulder', s)),
        (side('LeftForeArm', s),  m(ELBOW), m(WRIST), side('LeftArm', s)),
        (side('LeftHand', s),     m(WRIST), m(TIP), side('LeftForeArm', s)),
        (side('LeftUpLeg', s),    m((0.17, 0.0, -0.50)), m((0.19, -0.01, -0.72)), 'Hips'),
        (side('LeftLeg', s),      m((0.19, -0.01, -0.72)), m((0.20, 0.0, -0.88)), side('LeftUpLeg', s)),
        (side('LeftFoot', s),     m((0.20, 0.0, -0.88)), m((0.20, -0.15, -0.94)), side('LeftLeg', s)),
    ]

arm_data = bpy.data.armatures.new('KennyRig')
rig = bpy.data.objects.new('KennyRig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
made = {}
for name, head, tail, parent in BONES:
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = made[parent]
        b.use_connect = (Vector(head) - made[parent].tail).length < 1e-4
    made[name] = b
bpy.ops.object.mode_set(mode='OBJECT')

# Blender's automatic (bone heat) weights fail on the baked, remeshed body
# ("failed to find solution"), so Kenny is weighted in a way that cannot fail:
# every point starts on the bone nearest to it, then the weights are blurred
# along the surface so each joint bends smoothly instead of creasing.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_NAME')          # empty groups, one per bone

segments = {n: (Vector(h), Vector(t)) for n, h, t, _ in BONES}
def allowed(n, p):
    # Keep each part on its own bones: the vest beside the armpit is body, not
    # arm; nothing low on the body belongs to an ear; nothing high to a leg.
    if ('Arm' in n or 'Hand' in n) and abs(p.x) < 0.36 and p.z < 0.0: return False
    if 'Ear' in n and p.z < 0.45: return False
    if ('Leg' in n or 'Foot' in n) and p.z > -0.35: return False
    return True
def nearest_bone(p):
    best, name = 1e9, 'Spine1'
    for n, (a, b) in segments.items():
        if not allowed(n, p): continue
        ab = b - a; u = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        d = (p - (a + ab * u)).length
        if d < best: best, name = d, n
    return name
for v in body.data.vertices:
    body.vertex_groups[nearest_bone(v.co)].add([v.index], 1.0, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=12)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')

def smooth(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)

def set_weights(v, weights):
    total = sum(weights.values()) or 1
    for g in list(v.groups):
        body.vertex_groups[g.group].remove([v.index])
    for name, w in weights.items():
        if w / total > 0.01:
            body.vertex_groups[name].add([v.index], w / total, 'REPLACE')

# ---- The arms, along their length ----------------------------------------------
# As with Wally, automatic weights let the shoulder reach too far down the arm.
# Each point near the arm belongs to the bone it sits on, measured along the
# shoulder-to-fingertip line, blending only across the elbow and the wrist. The
# body stops at about x 0.36 below the chest, so points there stay with it.
sh, tip = Vector(SHOULDER), Vector(TIP)
axis = (tip - sh); length = axis.length; axis.normalize()
u_elbow = (Vector(ELBOW) - sh).dot(axis) / length
u_wrist = (Vector(WRIST) - sh).dot(axis) / length
for v in body.data.vertices:
    p = v.co.copy(); s = 1 if p.x > 0 else -1
    q = Vector((abs(p.x), p.y, p.z))
    u = (q - sh).dot(axis) / length
    perp = ((q - sh) - axis * (u * length)).length
    if u < -0.05 or u > 1.1 or perp > 0.20 or (q.x < 0.37 and q.z < 0.02):
        continue
    sname = 'Left' if s > 0 else 'Right'
    e, w = smooth(u_elbow - 0.06, u_elbow + 0.06, u), smooth(u_wrist - 0.06, u_wrist + 0.06, u)
    chain = {sname + 'Arm': 1 - e, sname + 'ForeArm': e * (1 - w), sname + 'Hand': w}
    k = smooth(-0.05, 0.12, u)                    # blend into the automatic weights at the shoulder
    mix = {body.vertex_groups[g.group].name: g.weight * (1 - k) for g in v.groups}
    for n, wt in chain.items():
        mix[n] = mix.get(n, 0) + wt * k
    set_weights(v, mix)

for v in body.data.vertices:
    if not any(g.weight > 0.01 for g in v.groups):
        body.vertex_groups[nearest_bone(v.co)].add([v.index], 1.0, 'REPLACE')

rig.show_in_front = True
arm_data.display_type = 'STICK'
bare = sum(1 for v in body.data.vertices if not any(g.weight > 0.01 for g in v.groups))
print('VERTICES', len(body.data.vertices), 'UNWEIGHTED', bare, 'GROUPS', len(body.vertex_groups))
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)
