# blender-rig-wally.py
# Builds a starting skeleton for Wally's raw Meshy model (T-pose, about 10k
# triangles) and binds the skin with Blender's automatic weights. The result is
# a .blend file Ken opens in Blender to check and fine-tune (weight painting,
# bone placement) before the moves are animated.
#
# Bone names follow the Mixamo pattern without the prefix (Hips, Spine, LeftArm,
# ...), the names js/rig.js HumanoidPoser already understands, plus Jaw and a
# five-bone tail (Tail1 at the root to Tail5 at the tip).
#
# Joint positions were measured from the model by slicing it (Blender
# coordinates: z up, front is -y, Wally's left is +x).
#
#   blender --background --factory-startup --python tools/blender-rig-wally.py -- in.glb out.blend [pose-prefix]

import sys, math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
prefix = args[2] if len(args) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
body.name = 'Wally'

# Meshy meshes come in loose pieces that share edges without joining, which
# makes automatic weights fail; merging overlapping points first fixes that.
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- The skeleton: (name, head, tail, parent) -------------------------------
Y = -0.12          # the body's centre line, front to back
def side(name, x):
    return name.replace('Left', 'Right') if x < 0 else name

BONES = [
    ('Hips',   (0, Y, -0.22), (0, Y, -0.05), None),
    ('Spine',  (0, Y, -0.05), (0, Y, 0.10), 'Hips'),
    ('Spine1', (0, Y, 0.10), (0, Y, 0.24), 'Spine'),
    ('Spine2', (0, Y, 0.24), (0, Y, 0.34), 'Spine1'),
    ('Neck',   (0, Y, 0.34), (0, -0.10, 0.44), 'Spine2'),
    ('Head',   (0, -0.10, 0.44), (0, -0.10, 0.80), 'Neck'),
    ('Jaw',    (0, -0.08, 0.46), (0, -0.52, 0.43), 'Head'),
    ('Tail1',  (0, 0.08, -0.22), (0, 0.20, -0.36), 'Hips'),
    ('Tail2',  (0, 0.20, -0.36), (0, 0.30, -0.50), 'Tail1'),
    ('Tail3',  (0, 0.30, -0.50), (0, 0.39, -0.63), 'Tail2'),
    ('Tail4',  (0, 0.39, -0.63), (0, 0.48, -0.75), 'Tail3'),
    ('Tail5',  (0, 0.48, -0.75), (0, 0.57, -0.85), 'Tail4'),
]
for s in (1, -1):
    BONES += [
        (side('LeftShoulder', s), (s * 0.06, Y, 0.28), (s * 0.20, -0.09, 0.26), 'Spine2'),
        (side('LeftArm', s),      (s * 0.20, -0.09, 0.26), (s * 0.52, -0.09, 0.25), side('LeftShoulder', s)),
        (side('LeftForeArm', s),  (s * 0.52, -0.09, 0.25), (s * 0.80, -0.10, 0.26), side('LeftArm', s)),
        (side('LeftHand', s),     (s * 0.80, -0.10, 0.26), (s * 0.95, -0.10, 0.26), side('LeftForeArm', s)),
        (side('LeftUpLeg', s),    (s * 0.17, -0.10, -0.26), (s * 0.19, -0.08, -0.55), 'Hips'),
        (side('LeftLeg', s),      (s * 0.19, -0.08, -0.55), (s * 0.20, -0.04, -0.80), side('LeftUpLeg', s)),
        (side('LeftFoot', s),     (s * 0.20, -0.04, -0.80), (s * 0.21, -0.28, -0.85), side('LeftLeg', s)),
    ]

arm_data = bpy.data.armatures.new('WallyRig')
rig = bpy.data.objects.new('WallyRig', arm_data)
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
# Arm bones roll so that bending the elbow folds the forearm forward.
for name, b in made.items():
    if 'Arm' in name or 'Hand' in name:
        b.roll = 0
bpy.ops.object.mode_set(mode='OBJECT')

# ---- Bind the skin with automatic weights -----------------------------------
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# Report: how many points ended up with no weight at all (those would not move).
groups = {g.index: g.name for g in body.vertex_groups}
bare = sum(1 for v in body.data.vertices if not any(g.weight > 0.01 for g in v.groups))
print('VERTICES', len(body.data.vertices), 'UNWEIGHTED', bare, 'GROUPS', len(groups))

bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)

# ---- Optional test pose: bend everything a little and render it -----------
if prefix:
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE')
    P = rig.pose.bones
    from mathutils import Matrix
    # Turn a bone about a world direction (x: his left, y: back, z: up), in
    # degrees, measured from its rest pose.
    def turn(name, axis, deg):
        b = P[name]; b.rotation_mode = 'QUATERNION'
        rest = b.bone.matrix_local.to_3x3()
        world = Matrix.Rotation(math.radians(deg), 3, Vector(axis))
        b.rotation_quaternion = (rest.inverted() @ world @ rest).to_quaternion()
    turn('LeftArm', (0, 1, 0), 70); turn('RightArm', (0, 1, 0), -70)   # arms down at his sides
    turn('LeftForeArm', (1, 0, 0), -30); turn('RightForeArm', (1, 0, 0), -30)   # forearms a little forward
    turn('LeftUpLeg', (1, 0, 0), -40); turn('LeftLeg', (1, 0, 0), 70)          # left knee up, as in a run
    turn('RightUpLeg', (1, 0, 0), 20)                                       # right leg pushing back
    turn('Jaw', (1, 0, 0), 25)                                              # mouth wider
    turn('Head', (1, 0, 0), -15)                                            # chin up
    for name in ['Tail2', 'Tail3', 'Tail4', 'Tail5']:
        turn(name, (0, 0, 1), 14)                                           # tail swinging to one side
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.hide_render = True
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 700, 900
    scene.world = bpy.data.worlds.new('w')
    cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 2.2
    cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
    views = {'front': ((0, -10, 0), (90, 0, 0)), 'side': ((10, 0, 0), (90, 0, 90)), 'quarter': ((7, -7, 2), (80, 0, 45))}
    for name, (off, rot) in views.items():
        cam.location = Vector(off)
        cam.rotation_euler = tuple(math.radians(r) for r in rot)
        scene.render.filepath = '%s-%s.png' % (prefix, name)
        bpy.ops.render.render(write_still=True)
    print('RENDERED', prefix)
