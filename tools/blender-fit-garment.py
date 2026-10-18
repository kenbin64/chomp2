# blender-fit-garment.py
# Fits a separate garment (a shirt or jacket made on its own in Meshy, no body
# inside) onto the rigged Wally template and rigs it to his skeleton, so it
# moves with every one of his moves (Ken: change his clothes without a whole new
# Wally model). Steps:
#   1. straighten the sleeves to his straight-out T-pose arms (the droop angle is
#      measured from the sleeve itself),
#   2. reshape it in sections to his body: hem just over his shorts, armpits at
#      his arms, collar at his neck, taken in to his chest with a little room,
#   3. push it out wherever his body would poke through,
#   4. copy his skin weights onto it and bind it to his skeleton,
#   5. export Wally wearing it, with all his moves (and, if asked, a picture).
#
# Wally's landmarks (from slicing the template): torso half-width about 0.35,
# armpits at height 0.12, arms along height 0.25, neck top about 0.5, top of
# his shorts about -0.22, body front-to-back from -0.41 to 0.16.
#
#   blender --background --factory-startup --python tools/blender-fit-garment.py -- \
#       template-moves.blend garment.glb out.glb [preview-prefix]

import sys, math
import bpy, bmesh
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
template, garment_file, out = args[:3]
preview = args[3] if len(args) > 3 else None
BODY = { 'half': 0.40, 'arm_z': 0.25, 'hem_z': -0.32, 'neck_z': 0.52, 'y0': -0.43, 'y1': 0.18, 'arm_reach': 0.36 }

bpy.ops.wm.open_mainfile(filepath=template)
rig = bpy.data.objects['WallyRig']; body = bpy.data.objects['Wally']
if rig.animation_data:
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    rig.animation_data.action = None
for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.context.view_layer.update()

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=garment_file)
parts = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']: bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1: bpy.ops.object.join()
g = bpy.context.view_layer.objects.active; g.name = 'Garment'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = g.data

# Measure the garment: its torso half-width (below the sleeves), hem and collar.
vs = [v.co.copy() for v in me.vertices]
zmin, zmax = min(v.z for v in vs), max(v.z for v in vs)
low = [v for v in vs if v.z < zmin + 0.25 * (zmax - zmin)]
torso_half = max(abs(v.x) for v in low)
root = torso_half * 1.0                               # where a sleeve starts, sideways
# 1. Straighten each sleeve: fit a line through the sleeve points (x against z),
#    and turn them about the sleeve root so that line is level.
for side in (1, -1):
    sl = [v for v in me.vertices if v.co.x * side > root]
    if len(sl) < 10: continue
    xs = [abs(v.co.x) for v in sl]; zs = [v.co.z for v in sl]
    mx, mz = sum(xs) / len(xs), sum(zs) / len(zs)
    slope = sum((x - mx) * (z - mz) for x, z in zip(xs, zs)) / max(1e-9, sum((x - mx) ** 2 for x in xs))
    droop = math.atan(slope)                          # negative: the sleeve angles down
    pivot_z = mz - slope * (mx - root)                # the sleeve line's height at the root
    c, s = math.cos(-droop), math.sin(-droop)
    for v in sl:
        dx, dz = abs(v.co.x) - root, v.co.z - pivot_z
        v.co.x = side * (root + dx * c - dz * s); v.co.z = pivot_z + dx * s + dz * c
    print('SLEEVE side %+d droop %.1f degrees, levelled at height %.2f' % (side, math.degrees(droop), pivot_z))
    arm_z = pivot_z
# 2. Reshape in sections. Heights: hem -> his hem line, sleeve line -> his arms,
#    collar top -> his neck, straight lines between. Sideways: the torso taken in
#    to his chest, sleeves shortened in proportion. Front to back: to his depth.
vs = [v.co.copy() for v in me.vertices]
zmin, zmax = min(v.z for v in vs), max(v.z for v in vs)
ymin, ymax = min(v.y for v in vs), max(v.y for v in vs)
kx = BODY['half'] / torso_half
ky = (BODY['y1'] - BODY['y0']) / (ymax - ymin)
def height(z):
    if z <= arm_z: return BODY['hem_z'] + (z - zmin) / (arm_z - zmin) * (BODY['arm_z'] - BODY['hem_z'])
    return BODY['arm_z'] + (z - arm_z) / (zmax - arm_z) * (BODY['neck_z'] - BODY['arm_z'])
for v in me.vertices:
    x, y, z = v.co
    if abs(x) <= root: nx = x * kx
    else: nx = math.copysign(BODY['half'] + (abs(x) - root) * BODY['arm_reach'] / (max(abs(p.x) for p in vs) - root), x)
    v.co = Vector((nx, BODY['y0'] + (y - ymin) * ky, height(z)))
me.update()
print('RESHAPED torso x%.2f, depth x%.2f' % (kx, ky))

# 3. Push it out wherever the body pokes through (a little gap over his body).
bpy.ops.object.select_all(action='DESELECT'); g.select_set(True); bpy.context.view_layer.objects.active = g
sw = g.modifiers.new('fit', 'SHRINKWRAP'); sw.target = body; sw.wrap_method = 'NEAREST_SURFACEPOINT'
sw.wrap_mode = 'OUTSIDE'; sw.offset = 0.025
bpy.ops.object.modifier_apply(modifier=sw.name)
sm = g.modifiers.new('smooth', 'CORRECTIVE_SMOOTH'); sm.iterations = 4; sm.factor = 0.5
bpy.ops.object.modifier_apply(modifier=sm.name)

# 4. His skin weights, then his skeleton.
for vg in body.vertex_groups:
    if vg.name not in g.vertex_groups: g.vertex_groups.new(name=vg.name)
dt = g.modifiers.new('weights', 'DATA_TRANSFER'); dt.object = body
dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier=dt.name)
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=3)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')
arm = g.modifiers.new('rig', 'ARMATURE'); arm.object = rig
g.parent = rig
print('BOUND', len(me.vertices), 'points')

# 4b. Hide what the garment covers (the usual game trick): every face of his body
#     that looks straight out into the garment within a few centimetres is
#     removed from this outfit's copy, so his own shirt can never poke through,
#     however he bends. Faces the garment does not cover stay.
from mathutils.bvhtree import BVHTree
dg = bpy.context.evaluated_depsgraph_get()
tree = BVHTree.FromObject(g, dg)
bm = bmesh.new(); bm.from_mesh(body.data); bm.faces.ensure_lookup_table()
covered = []
for f in bm.faces:
    c = f.calc_center_median(); n = f.normal
    if c.z < BODY['hem_z'] - 0.05 or c.z > BODY['neck_z'] + 0.05: continue
    hit = tree.ray_cast(c + n * 0.002, n, 0.14)
    if hit[0] is not None: covered.append(f)
bmesh.ops.delete(bm, geom=covered, context='FACES')
bm.to_mesh(body.data); bm.free(); body.data.update()
print('HIDDEN under the garment:', len(covered), 'faces of his body')

# 5. Export Wally wearing it, with every move.
for pb in rig.pose.bones: pb.custom_shape = None
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o not in (body, g): bpy.data.objects.remove(o)
if rig.animation_data:
    for tr in rig.animation_data.nla_tracks: tr.mute = False
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); body.select_set(True); g.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 500, 600
    scene.world = bpy.data.worlds.new('w'); rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.3
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    if rig.animation_data:
        for tr in rig.animation_data.nla_tracks: tr.mute = True
    shots = [('tpose', None, (0, -10, 0.1), (90, 0, 0)), ('idle', 'Idle', (6, -6, 0.1), (89, 0, 45)), ('run', 'Run', (6, -6, 0.1), (89, 0, 45)), ('celebrate', 'Celebrate', (0, -10, 0.1), (90, 0, 0))]
    for name, act, loc, rot in shots:
        rig.animation_data.action = bpy.data.actions.get(act) if act else None
        if not act:
            for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0)
        a = rig.animation_data.action
        scene.frame_set(int(a.frame_range[0] + (a.frame_range[1] - a.frame_range[0]) * 0.3) if a else 1)
        cam.location = Vector(loc); cam.rotation_euler = tuple(math.radians(r) for r in rot)
        scene.render.filepath = '%s-%s.png' % (preview, name); bpy.ops.render.render(write_still=True)
    print('PREVIEWED')
