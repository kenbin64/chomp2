# blender-rig-human.py
# One skeleton for every person in the game (the visitors Ken makes in Meshy
# from his cast sheets), built on a baked model (tools/blender-bake-lowpoly.py)
# and bound to its skin. Same bone names as Wally and Kenny (the Mixamo pattern
# without the prefix), so one set of moves (blender-animate-human.py) fits all.
#
# Nobody is measured by hand: each body is measured by itself, so the same
# script fits a tall hiker, a small child, a T-pose or an A-pose:
#   crotch    a ray from the front at x = 0, stepping up the legs until it hits
#   neck      the narrowest slice of the middle of the body near the top
#   shoulder  just below the neck, at the width of the chest
#   hand      the point of the arm farthest from the shoulder
#   legs      the middle of each leg; the toe is the foot's front
# Blender coordinates: z up, front is -y, their left is +x. The models are
# symmetrical, so the left side is measured and the right side mirrors it.
#
#   blender --background --factory-startup --python tools/blender-rig-human.py -- in.glb out.blend

import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
body.name = 'Person'
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
V = [v.co.copy() for v in body.data.vertices]

# ---- Measuring ----------------------------------------------------------------------
z0, z1 = min(v.z for v in V), max(v.z for v in V)
H = z1 - z0
def at(f): return z0 + H * f                       # a height as a share of the body

bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
def solid(x, z):
    # Only the front half counts: a backpack behind the neck is not the neck.
    hit = bvh.ray_cast(Vector((x, -5.0, z)), Vector((0, 1, 0)))
    return hit[0] is not None and hit[0].y < 0.03 * H

def core(z):
    # The half-width of the body at height z, x = 0 outward: rays from the front
    # until one misses (the remeshed surface has too few points to slice).
    x = 0.0
    while x < 0.6 * H and solid(x, z): x += 0.004 * H
    return (-x, x)

# Crotch: the first height, going up between the legs, where the body is solid.
# A skirt or dress closes the gap at its hem, so the result is held to the range
# a person's crotch is in (about 40 to 50 percent of their height).
crotch = None
f = 0.12
while f < 0.6:
    if solid(0.0, at(f)) and solid(0.0, at(f + 0.01)): crotch = f; break
    f += 0.005
crotch = min(max(crotch or 0.45, 0.40), 0.50)

# Neck: the narrowest middle slice just above the shoulders. In a T-pose the
# arms mark the shoulders (the highest slice wider than the arms' reach);
# searching only a little above them keeps a hat band from passing as a neck.
arm_top = None
f = 0.95
while f > 0.6:
    if core(at(f))[1] > 0.3 * H: arm_top = f; break
    f -= 0.005
lo_f, hi_f = (arm_top + 0.005, arm_top + 0.08) if arm_top else (0.72, 0.88)
neck_f, neck_w = (lo_f + hi_f) / 2, 1e9
f = lo_f
while f < hi_f:
    lo, hi = core(at(f))
    if 0 < hi - lo < neck_w: neck_w, neck_f = hi - lo, f
    f += 0.005
NECK = at(neck_f)
SHOULDER_Z = NECK - 0.055 * H
chest = core(NECK - 0.12 * H)
SX = min(max(chest[1], 0.08 * H), 0.12 * H)
SHOULDER = Vector((SX, 0.0, SHOULDER_Z))

# Hand: the arm's farthest point from the shoulder, out beyond the chest.
arm_pts = [v for v in V if v.x > SX + 0.08 * H and v.z > at(crotch) + 0.05 * H]
TIP = max(arm_pts, key=lambda v: (v - SHOULDER).length).copy() if arm_pts else SHOULDER + Vector((0.4 * H, 0, -0.3 * H))
TIP.y = 0.0
ELBOW = SHOULDER.lerp(TIP, 0.42)
WRIST = SHOULDER.lerp(TIP, 0.78)

# Legs.
HIP_Z = at(crotch) + 0.04 * H
ANKLE_Z = at(0.055)
KNEE_Z = (HIP_Z + ANKLE_Z) / 2 + 0.01 * H
def leg_x(z):
    xs = [v.x for v in V if abs(v.z - z) < H * 0.015 and 0.01 * H < v.x < 0.2 * H]
    return (min(xs) + max(xs)) / 2 if xs else 0.06 * H
LX = leg_x(KNEE_Z)
feet = [v for v in V if v.z < at(0.04) and v.x > 0]
TOE_Y = min(v.y for v in feet) if feet else -0.08 * H
HEEL_Y = max(v.y for v in feet) if feet else 0.03 * H
print('MEASURED H %.3f crotch %.3f neck %.3f shoulder %s tip %s legX %.3f' % (H, crotch, neck_f, tuple(round(c, 3) for c in SHOULDER), tuple(round(c, 3) for c in TIP), LX))

# ---- The skeleton -------------------------------------------------------------------
def side(name, x): return name.replace('Left', 'Right') if x < 0 else name
spine = [HIP_Z - 0.02 * H, HIP_Z + 0.06 * H]
step = (SHOULDER_Z - 0.01 * H - spine[1]) / 3
BONES = [
    ('Hips',   (0, 0, spine[0]), (0, 0, spine[1]), None),
    ('Spine',  (0, 0, spine[1]), (0, 0, spine[1] + step), 'Hips'),
    ('Spine1', (0, 0, spine[1] + step), (0, 0, spine[1] + 2 * step), 'Spine'),
    ('Spine2', (0, 0, spine[1] + 2 * step), (0, 0, NECK - 0.02 * H), 'Spine1'),
    ('Neck',   (0, 0, NECK - 0.02 * H), (0, 0, NECK + 0.035 * H), 'Spine2'),
    ('Head',   (0, 0, NECK + 0.035 * H), (0, 0, z1), 'Neck'),
]
for s in (1, -1):
    def m(p): return (s * p[0], p[1], p[2])
    BONES += [
        (side('LeftShoulder', s), m((0.02 * H, 0, SHOULDER_Z)), m(SHOULDER), 'Spine2'),
        (side('LeftArm', s),      m(SHOULDER), m(ELBOW), side('LeftShoulder', s)),
        (side('LeftForeArm', s),  m(ELBOW), m(WRIST), side('LeftArm', s)),
        (side('LeftHand', s),     m(WRIST), m(TIP), side('LeftForeArm', s)),
        (side('LeftUpLeg', s),    m((LX, 0, HIP_Z)), m((LX, 0, KNEE_Z)), 'Hips'),
        (side('LeftLeg', s),      m((LX, 0, KNEE_Z)), m((LX, 0, ANKLE_Z)), side('LeftUpLeg', s)),
        (side('LeftFoot', s),     m((LX, 0, ANKLE_Z)), m((LX, TOE_Y * 0.8, z0)), side('LeftLeg', s)),
    ]

arm_data = bpy.data.armatures.new('PersonRig')
rig = bpy.data.objects.new('PersonRig', arm_data)
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

# ---- Weights ------------------------------------------------------------------------
# As for Kenny: every point starts on the nearest bone it may belong to, then
# the weights are blurred along the surface so joints bend smoothly.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_NAME')

segments = {n: (Vector(h), Vector(t)) for n, h, t, _ in BONES}
def allowed(n, p):
    # The shirt beside the armpit and a backpack's sides are body, not arm;
    # nothing above the hips is leg; a hat brim is head, not arm.
    if ('Arm' in n or 'Hand' in n) and abs(p.x) < SX + 0.03 * H and p.z < SHOULDER_Z - 0.04 * H: return False
    if ('Arm' in n or 'Hand' in n) and p.z > NECK: return False
    if ('Leg' in n or 'Foot' in n) and p.z > HIP_Z + 0.02 * H: return False
    if 'Foot' in n and p.z > ANKLE_Z + 0.04 * H: return False
    return True
def nearest_bone(p):
    best, name = 1e9, 'Spine1'
    for n, (a, b) in segments.items():
        if 'Shoulder' in n or not allowed(n, p): continue
        ab = b - a; u = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        d = (p - (a + ab * u)).length
        if d < best: best, name = d, n
    return name
for v in body.data.vertices:
    body.vertex_groups[nearest_bone(v.co)].add([v.index], 1.0, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT'); body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=10)
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

# The arms, along their length (as for Wally and Kenny): each point near the
# arm belongs to the bone it sits on, blending only across elbow and wrist.
sh, tip = SHOULDER, TIP
axis = tip - sh; length = axis.length; axis.normalize()
u_elbow = (ELBOW - sh).dot(axis) / length
u_wrist = (WRIST - sh).dot(axis) / length
for v in body.data.vertices:
    p = v.co; s = 1 if p.x > 0 else -1
    q = Vector((abs(p.x), p.y, p.z))
    u = (q - sh).dot(axis) / length
    perp = ((q - sh) - axis * (u * length)).length
    if u < -0.05 or u > 1.1 or perp > 0.09 * H or not allowed('LeftArm', q):
        continue
    sname = 'Left' if s > 0 else 'Right'
    e, w = smooth(u_elbow - 0.05, u_elbow + 0.05, u), smooth(u_wrist - 0.04, u_wrist + 0.04, u)
    chain = {sname + 'Arm': 1 - e, sname + 'ForeArm': e * (1 - w), sname + 'Hand': w}
    k = smooth(-0.05, 0.10, u)
    mix = {body.vertex_groups[g.group].name: g.weight * (1 - k) for g in v.groups}
    for n, wt in chain.items(): mix[n] = mix.get(n, 0) + wt * k
    set_weights(v, mix)

# The legs, the same way along hip, knee and ankle; above the hips the body
# (shorts, a skirt's waist) blends in from the Hips bone.
for v in body.data.vertices:
    p = v.co
    if p.z > HIP_Z + 0.03 * H or abs(p.x) < 0.004 * H and p.z > at(0.30): continue
    if abs(p.x) > LX + 0.12 * H: continue                                # a hand hanging beside the thigh
    if any(('Arm' in body.vertex_groups[g.group].name or 'Hand' in body.vertex_groups[g.group].name) and g.weight > 0.3 for g in v.groups): continue
    sname = 'Left' if p.x > 0 else 'Right'
    k = smooth(ANKLE_Z - 0.015 * H, ANKLE_Z + 0.015 * H, p.z)        # 0 foot, 1 leg
    n = smooth(KNEE_Z - 0.03 * H, KNEE_Z + 0.03 * H, p.z)            # 0 shin, 1 thigh
    hip = smooth(HIP_Z - 0.05 * H, HIP_Z + 0.03 * H, p.z)            # into the body
    set_weights(v, {sname + 'Foot': 1 - k, sname + 'Leg': k * (1 - n), sname + 'UpLeg': k * n * (1 - hip), 'Hips': k * n * hip})

for v in body.data.vertices:
    if not any(g.weight > 0.01 for g in v.groups):
        body.vertex_groups[nearest_bone(v.co)].add([v.index], 1.0, 'REPLACE')

rig.show_in_front = True
arm_data.display_type = 'STICK'
bare = sum(1 for v in body.data.vertices if not any(g.weight > 0.01 for g in v.groups))
print('VERTICES', len(body.data.vertices), 'UNWEIGHTED', bare, 'GROUPS', len(body.vertex_groups))
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)
