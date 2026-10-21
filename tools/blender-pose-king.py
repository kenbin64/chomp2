# blender-pose-king.py
# The Croc King's moves on his throne (Ken, 2026-10-21: seat the King), on the rig made by
# tools/blender-rig-human.py, exported as one GLB with each move as a named clip:
#   Sit     seated, forearms along the armrests, breathing, looking about a little
#   Speak   seated, the right hand opening as he talks, the head moving with the words
#   Raise   seated, the right arm raising the sceptre high
# The helpers (aim, elbow, to_local) are the ones in blender-animate-human.py: an upper
# arm is AIMED at a direction, elbows and knees bend from there. Directions in the rig's
# frame: x is his left, -y forward, z up; given for the left side and mirrored for the right.
#
#   blender --background --factory-startup --python tools/blender-pose-king.py -- rig.blend out.glb [preview-prefix]

import sys, math
import bpy
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
rig_file, out_glb = args[0], args[1]
preview = args[2] if len(args) > 2 else None

bpy.ops.wm.open_mainfile(filepath=rig_file)
rig = bpy.data.objects['PersonRig']
body = bpy.data.objects['Person']
bpy.context.scene.render.fps = 30
P = rig.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in P}
dg = bpy.context.evaluated_depsgraph_get()
zs = [(body.matrix_world @ v.co).z for v in body.evaluated_get(dg).data.vertices]
H = (max(zs) - min(zs)) / rig.matrix_world.to_scale().z
NEXT = {side + a: side + b for side in ('Left', 'Right') for a, b in (('Arm', 'ForeArm'), ('ForeArm', 'Hand'))}

def limb(name):
    b = rig.data.bones[name]
    if name in NEXT: return (rig.data.bones[NEXT[name]].head_local - b.head_local).normalized()
    return b.matrix_local.to_3x3().col[1].normalized()

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = math.pi * 2
def s(t, phase=0.0): return math.sin(TAU * (t + phase))
def ramp(t, a, b):
    u = min(max((t - a) / (b - a), 0.0), 1.0); return u * u * (3 - 2 * u)
def mix(a, b, u): return tuple(a[i] + (b[i] - a[i]) * u for i in range(3))

def aim(p, side, d, extra=()):
    v = Vector(d) if side == 'Left' else Vector((-d[0], d[1], d[2]))
    v.normalize()
    rest = limb(side + 'Arm')
    ax = rest.cross(v)
    turns = []
    if ax.length > 1e-6: turns.append((tuple(ax.normalized()), math.degrees(rest.angle(v))))
    p[side + 'Arm'] = turns + list(extra)
def bend_axis(name):
    d = limb(name)
    return tuple(d.cross(Vector((0, -1, 0))).normalized())
def elbow(p, side, deg): p[side + 'ForeArm'] = [(bend_axis(side + 'ForeArm'), deg)]
def to_local(name, turns):
    m = Matrix.Identity(3)
    for axis, deg in turns: m = Matrix.Rotation(math.radians(deg), 3, Vector(axis)) @ m
    r = REST[name]
    return (r.inverted() @ m @ r).to_quaternion()

# ---- Seated ---------------------------------------------------------------------------------
# Thighs forward level, knees bent square, feet flat; a little forward lean; the forearms
# along the armrests, hands over their ends.
ARMREST = (0.35, 0.05, -1)                        # the upper arm down at his side, a little out (tuned by eye on renders)
def seated(p, t):
    for side in ('Left', 'Right'):
        p[side + 'UpLeg'] = [(X, -88), (Y, (6 if side == 'Left' else -6))]   # forward, knees a little apart
        p[side + 'Leg'] = [(X, 88)]
        p[side + 'Foot'] = [(X, -6)]
    aim(p, 'Left', ARMREST); aim(p, 'Right', ARMREST)
    elbow(p, 'Left', 40); elbow(p, 'Right', 40)                       # forearms forward along the armrests
    p['Spine'] = [(X, 6)]
    p['Spine2'] = [(X, 2 * s(t * 2))]                                # breathing
    p['Head'] = [(Z, 10 * s(t, 0.3)), (X, -4)]

def sit(t):
    p = {}; seated(p, t); return p

def speak(t):
    # Talking (Ken, 2026-10-21: alive, but no hand to the face, which read as stroking his nose):
    # the head nods and turns as he speaks, he leans in a little, the chest rises with his words,
    # and the right hand opens a little off the armrest, staying low and out in front.
    p = {}; seated(p, t)
    w = s(t * 2)
    aim(p, 'Right', mix(ARMREST, (0.42, -0.35, -0.85), 0.5 + 0.5 * s(t)))   # the arm eases forward off the rest, never up
    elbow(p, 'Right', 40 + 10 * (0.5 + 0.5 * s(t)))
    p['RightHand'] = [(Y, 8 * w), (X, -10)]                            # the palm turns up a little: an open hand
    p['Head'] = [(X, -6 + 5 * s(t * 2)), (Z, 9 * s(t, 0.2))]           # nods with the words, looks to Wally and back
    p['Neck'] = [(X, -2 + 2 * s(t * 2, 0.1))]
    p['Spine'] = [(X, 9 + 2 * s(t))]                                   # leaning in as he speaks
    p['Spine2'] = [(X, 3 * s(t * 2))]                                  # the chest with the breath of the words
    return p

def raise_(t):
    p = {}; seated(p, t)
    u = ramp(t, 0.0, 0.45)
    aim(p, 'Right', mix((0.5, -0.75, -0.35), (0.25, -0.25, 1.0), u))   # up high
    elbow(p, 'Right', 50 - 35 * u)
    p['Head'] = [(X, -4 - 14 * u)]                                       # looking up at it
    p['Spine'] = [(X, 6 - 8 * u)]
    return p

MOVES = {'Sit': (sit, 4.0, True), 'Speak': (speak, 2.0, True), 'Raise': (raise_, 3.0, False)}

def apply_pose(pose):
    for pb in P:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = to_local(pb.name, pose.get(pb.name, []))

if rig.animation_data is None: rig.animation_data_create()
for name, (fn, length, loops) in MOVES.items():
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data.action = act
    frames = int(length * 30)
    for f in range(0, frames + 1, 3):
        t = f / frames if loops else f / 30.0
        apply_pose(fn(t))
        for pb in P: pb.keyframe_insert('rotation_quaternion', frame=f + 1)
rig.animation_data.action = None

# Previews: seated, from the front and the side.
if preview:
    apply_pose(sit(0)); bpy.context.view_layer.update()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_WORKBENCH'
    scene.render.resolution_x, scene.render.resolution_y = 600, 700
    world = bpy.data.worlds.new('w'); scene.world = world; world.color = (0.25, 0.25, 0.27)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); scene.collection.objects.link(sun); sun.rotation_euler = (0.8, 0.2, 0.6); sun.data.energy = 3
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    zs = [(body.matrix_world @ v.co).z for v in body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices]
    mid = (max(zs) + min(zs)) / 2; span = max(zs) - min(zs)
    for tag, pos in (('front', (0, -3.2 * span, mid)), ('side', (3.2 * span, 0, mid))):
        cam.location = pos; d = Vector((0, 0, mid)) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{preview}-{tag}.png'; bpy.ops.render.render(write_still=True)

for o in bpy.context.scene.objects: o.select_set(False)
for o in (rig, body): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format='GLB',            # as blender-animate-human.py
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out_glb)
