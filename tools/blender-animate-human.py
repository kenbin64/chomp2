# blender-animate-human.py
# The visitors' moves, on any person rigged by tools/blender-rig-human.py,
# exported as one GLB with each move as a named clip and a phone in the right
# hand (an object named HeldPhone, which the game shows only for photos).
#
# The moves are the things people do in js/clusters.js and js/tourists.js:
#   Idle     watching Wally: weight shifting, glancing about
#   Walk     strolling
#   Run      running away, laughing (Ken: "run away laughing")
#   Wave     a big wave
#   Point    pointing him out
#   Chat     talking with a friend, one hand going
#   Photo    phone held up at eye level in both hands
#   Throw    an overarm throw of food to Wally
#   Cheer    both arms up, hopping: he caught it!
#   Nervous  hands up and leaning back: a croc is very close
#
# The same moves fit every body, T-pose or A-pose: an upper arm is AIMED at a
# direction (not turned from its rest pose), and elbows and knees bend from
# there. Directions are in the rig's frame: x is the person's left, -y is
# forward, z is up; L(...) gives a left-arm direction and mirrors it for the right.
#
#   blender --background --factory-startup --python tools/blender-animate-human.py -- rig.blend out.glb [preview-prefix]

import sys, math
import bpy
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
rig_file, out_glb = args[0], args[1]
preview = args[2] if len(args) > 2 else None

bpy.ops.wm.open_mainfile(filepath=rig_file)
rig = bpy.data.objects['PersonRig']
body = bpy.data.objects['Person']
bpy.context.scene.render.fps = 30
P = rig.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in P}
# Heights in the world and in the rig's own units (a Meshy rig is in centimetres).
dg = bpy.context.evaluated_depsgraph_get()
zs = [(body.matrix_world @ v.co).z for v in body.evaluated_get(dg).data.vertices]
HW = max(zs) - min(zs)
H = HW / rig.matrix_world.to_scale().z
NEXT = {side + a: side + b for side in ('Left', 'Right') for a, b in (('Arm', 'ForeArm'), ('ForeArm', 'Hand'))}

def limb(name):
    # Which way a limb points at rest: from its joint to the next joint (bone
    # tips from other tools can point anywhere).
    b = rig.data.bones[name]
    if name in NEXT: return (rig.data.bones[NEXT[name]].head_local - b.head_local).normalized()
    return b.matrix_local.to_3x3().col[1].normalized()

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAU = math.pi * 2
def s(t, phase=0.0): return math.sin(TAU * (t + phase))
def bump(t, a, b): return 0.0 if t <= a or t >= b else math.sin(math.pi * (t - a) / (b - a))
def ramp(t, a, b):
    u = min(max((t - a) / (b - a), 0.0), 1.0); return u * u * (3 - 2 * u)
def mix(a, b, u): return tuple(a[i] + (b[i] - a[i]) * u for i in range(3))

def aim(p, side, d, extra=()):
    # Point the upper arm along d (given for the left arm; mirrored for the right).
    v = Vector(d) if side == 'Left' else Vector((-d[0], d[1], d[2]))
    v.normalize()
    rest = limb(side + 'Arm')
    ax = rest.cross(v)
    turns = []
    if ax.length > 1e-6:
        turns.append((tuple(ax.normalized()), math.degrees(rest.angle(v))))
    p[side + 'Arm'] = turns + list(extra)

def bend_axis(name):
    d = limb(name)
    return tuple(d.cross(Vector((0, -1, 0))).normalized())
def elbow(p, side, deg):
    p[side + 'ForeArm'] = [(bend_axis(side + 'ForeArm'), deg)]

DOWN = (0.18, 0.02, -1)                          # arms relaxed at the sides

def relaxed(p, t, sway=1.0):
    aim(p, 'Left', mix(DOWN, (0.18, -0.12 * s(t, 0.1), -1), sway))
    aim(p, 'Right', mix(DOWN, (0.18, 0.12 * s(t, 0.6), -1), sway))
    elbow(p, 'Left', 12); elbow(p, 'Right', 12)

def legs_walk(p, t, swing, knee):
    step = s(t)
    p['LeftUpLeg'] = [(X, -swing * step)]
    p['RightUpLeg'] = [(X, swing * step)]
    p['LeftLeg'] = [(X, knee * max(0, s(t, 0.2)))]
    p['RightLeg'] = [(X, knee * max(0, s(t, 0.7)))]
    p['LeftFoot'] = [(X, -10 * step)]; p['RightFoot'] = [(X, 10 * step)]

def idle(t):
    p = {}
    relaxed(p, t, 0.4)
    shift = s(t)                                                   # weight from foot to foot
    p['Spine'] = [(Y, 3 * shift)]
    p['Spine2'] = [(X, 2 * s(t * 2))]                              # breathing
    p['Head'] = [(Z, 25 * s(t, 0.3)), (X, -3 + 3 * s(t * 2, 0.2))]   # looking about
    p['LeftUpLeg'] = [(Y, -2 * shift)]; p['RightUpLeg'] = [(Y, -2 * shift)]
    p['LeftLeg'] = [(X, 6 * max(0, -shift))]; p['RightLeg'] = [(X, 6 * max(0, shift))]
    p['_hips'] = (0.012 * H * shift, 0, -0.004 * H * abs(shift))
    return p

def walk(t):
    p = {}
    aim(p, 'Left', (0.15, 0.35 * s(t), -1)); aim(p, 'Right', (0.15, -0.35 * s(t), -1))
    elbow(p, 'Left', 20 + 10 * max(0, -s(t))); elbow(p, 'Right', 20 + 10 * max(0, s(t)))
    legs_walk(p, t, 24, 40)
    p['Spine'] = [(Z, 5 * s(t))]
    p['Spine2'] = [(Z, -8 * s(t))]
    p['Head'] = [(Z, 3 * s(t)), (X, -2)]
    p['_hips'] = (0.008 * H * s(t), 0, 0.012 * H * abs(s(t)) - 0.008 * H)
    return p

def run(t):
    # Running away, laughing: head thrown back, bobbing, arms pumping.
    p = {}
    aim(p, 'Left', (0.25, 0.7 * s(t), -0.6)); aim(p, 'Right', (0.25, -0.7 * s(t), -0.6))
    elbow(p, 'Left', 80); elbow(p, 'Right', 80)
    legs_walk(p, t, 50, 85)
    p['Spine'] = [(X, 12), (Z, 6 * s(t))]
    p['Spine2'] = [(Z, -10 * s(t))]
    p['Head'] = [(X, -22 + 8 * s(t * 4)), (Z, 4 * s(t))]          # laughing
    p['_hips'] = (0.01 * H * s(t), 0, 0.03 * H * abs(s(t)) - 0.02 * H)
    return p

def wave(t):
    p = {}
    relaxed(p, t, 0.3)
    w = s(t * 3)
    aim(p, 'Right', (0.55 + 0.25 * w, -0.2, 0.85))                 # arm up and swinging side to side
    elbow(p, 'Right', 15 + 15 * w)
    p['Spine'] = [(Y, 4)]
    p['Head'] = [(Y, -6 + 4 * s(t, 0.2)), (X, -6)]
    p['_hips'] = (0, 0, 0.004 * H * abs(s(t * 3)))
    return p

def point(t):
    p = {}
    relaxed(p, t, 0.3)
    aim(p, 'Right', (0.1, -1, 0.12 + 0.03 * s(t * 2)))             # "look, there he is!"
    elbow(p, 'Right', 0)
    p['Spine2'] = [(Z, -8), (X, 4)]
    p['Head'] = [(Z, -6), (X, -4 + 3 * s(t * 2))]
    return p

def chat(t):
    p = {}
    relaxed(p, t, 0.3)
    g = s(t * 2)
    aim(p, 'Left', (0.35, -0.55 - 0.15 * g, -0.6))                 # one hand going as they talk
    elbow(p, 'Left', 70 + 20 * g)
    p['Spine2'] = [(Z, 18)]                                       # turned to their friend
    p['Head'] = [(Z, 25), (X, 6 * s(t * 3)), (Y, 5 * s(t, 0.3))]
    return p

def photo(t):
    # Phone up at eye level in both hands, held still, a little lean in.
    p = {}
    aim(p, 'Left', (0.45, -0.55, -0.35)); aim(p, 'Right', (0.45, -0.55, -0.35))
    elbow(p, 'Left', 120); elbow(p, 'Right', 120)
    p['Spine'] = [(X, 4)]
    p['Spine2'] = [(X, 2 * s(t))]
    p['Head'] = [(X, 6), (Z, 2 * s(t, 0.25))]
    return p

def throw(t):
    # Wind up behind the head, whip over the top, follow through down and across.
    p = {}
    relaxed(p, t, 0.0)
    back, over, down = (0.55, 0.6, 0.7), (0.2, -0.9, 0.45), (-0.25, -0.6, -0.75)
    d = mix(back, over, ramp(t, 0.35, 0.55)) if t < 0.55 else mix(over, down, ramp(t, 0.55, 0.8))
    aim(p, 'Right', d)
    elbow(p, 'Right', 95 * (1 - ramp(t, 0.4, 0.55)) + 10 * ramp(t, 0.55, 0.8))
    aim(p, 'Left', mix((0.4, -0.8, 0.2), DOWN, ramp(t, 0.45, 0.8)))   # the other arm aims, then drops
    elbow(p, 'Left', 25)
    twist = -25 * (1 - ramp(t, 0.35, 0.6)) + 20 * ramp(t, 0.35, 0.6)
    p['Spine'] = [(Z, twist * 0.5), (X, 10 * ramp(t, 0.4, 0.7))]
    p['Spine2'] = [(Z, twist * 0.5)]
    p['RightUpLeg'] = [(X, -10 * (1 - ramp(t, 0.3, 0.6)))]
    p['Head'] = [(Z, -twist * 0.6)]
    return p

def cheer(t):
    p = {}
    b = abs(s(t * 2))
    aim(p, 'Left', (0.55, -0.1, 0.9)); aim(p, 'Right', (0.55, -0.1, 0.9))
    elbow(p, 'Left', 10 + 15 * b); elbow(p, 'Right', 10 + 15 * b)
    p['LeftUpLeg'] = [(X, -15 * b)]; p['RightUpLeg'] = [(X, -15 * b)]
    p['LeftLeg'] = [(X, 30 * b)]; p['RightLeg'] = [(X, 30 * b)]
    p['Head'] = [(X, -15), (Y, 6 * s(t))]
    p['_hips'] = (0, 0, 0.06 * H * b)
    return p

def nervous(t):
    # Hands up, palms out, leaning back: "Whoa, whoa! Easy, mate!"
    p = {}
    j = s(t * 6) * 0.04
    aim(p, 'Left', (0.55, -0.55, 0.35 + j)); aim(p, 'Right', (0.55, -0.55, 0.35 - j))
    elbow(p, 'Left', 70); elbow(p, 'Right', 70)
    p['Spine'] = [(X, -8)]
    p['Spine2'] = [(X, -6)]
    p['Head'] = [(X, 5), (Z, 6 * s(t * 2))]
    p['RightUpLeg'] = [(X, 12)]; p['RightLeg'] = [(X, 10)]       # one foot back
    p['_hips'] = (0, 0.01 * H, -0.01 * H)
    return p

MOVES = {
    'Idle': (idle, 120, True), 'Walk': (walk, 36, True), 'Run': (run, 20, True),
    'Wave': (wave, 40, True), 'Point': (point, 60, True), 'Chat': (chat, 60, True),
    'Photo': (photo, 60, True), 'Throw': (throw, 24, False), 'Cheer': (cheer, 30, True),
    'Nervous': (nervous, 40, True),
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

# ---- The phone in the right hand -----------------------------------------------------
bpy.ops.mesh.primitive_cube_add(size=1)
phone = bpy.context.active_object; phone.name = 'HeldPhone'
phone.scale = (0.04 * HW, 0.006 * HW, 0.08 * HW)
bpy.ops.object.transform_apply(scale=True)
mat = bpy.data.materials.new('Phone'); mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.05, 0.08, 0.15, 1)
phone.data.materials.append(mat)
apply_pose(photo(0.0))
bpy.context.view_layer.update()
hand = rig.matrix_world @ P['RightHand'].matrix
palm = (rig.matrix_world @ P['RightHand'].head).lerp(rig.matrix_world @ P['RightHand'].tail, 0.0)
phone.parent = rig; phone.parent_type = 'BONE'; phone.parent_bone = 'RightHand'
bpy.context.view_layer.update()
phone.matrix_world = Matrix.Translation(palm + Vector((-0.04 * HW, -0.02 * HW, 0.02 * HW)))
bpy.context.view_layer.update()

# ---- Keyframes -----------------------------------------------------------------------
if rig.animation_data is None: rig.animation_data_create()
for name, (fn, length, loops) in MOVES.items():
    if name in bpy.data.actions:
        print('KEPT', name); continue                       # the rig's own (Meshy's walk and run)
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

bpy.ops.object.select_all(action='DESELECT')
for o in (rig, body, phone): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out_glb)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 260, 320
    scene.world = bpy.data.worlds.new('w'); rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = HW * 1.35
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = Vector((6, -7.5, 0.0)); cam.rotation_euler = (math.radians(90), 0, math.radians(38))
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    cam.location = Vector((6, -7.5, (max(zs) + min(zs)) / 2))
    for name, (fn, length, loops) in MOVES.items():
        act = bpy.data.actions[name]; rig.animation_data.action = act
        a0, a1 = act.frame_range
        for k in range(3):
            scene.frame_set(round(a0 + (a1 - a0) * k / 3))
            scene.render.filepath = '%s-%s-%d.png' % (preview, name, k)
            bpy.ops.render.render(write_still=True)
    print('PREVIEWED')
