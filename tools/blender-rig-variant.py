# blender-rig-variant.py
# Rigs a new outfit of Wally (or Kenny) from the rigged template, so every move
# the template has works on it straight away (Ken: new clothes need new models
# of Wally; this saves rigging each one by hand).
#
# The new model is a full Wally in the new clothes, made in Meshy in the same
# T-pose as the template (use the template's picture as the reference). Here:
#   1. it is lined up with the template body (same height, same place),
#   2. its skin weights are copied from the template body, each point taking
#      the weights of the nearest point on the template's surface,
#   3. it is bound to the template's skeleton, and exported with all the
#      template's moves. The template body itself is left out.
# A Wally made without a tail (Meshy often leaves it off) gets the template's
# own tail grafted on, already weighted to the tail bones, so he has everything
# the standard Wally has (Ken, 2026-10-18).
#
#   blender --background --factory-startup --python tools/blender-rig-variant.py -- \
#       template-moves.blend Wally WallyRig new-outfit.glb out.glb [preview.png]

import sys, math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
template, body_name, rig_name, variant, out = args[:5]
preview = args[5] if len(args) > 5 else None

bpy.ops.wm.open_mainfile(filepath=template)
rig = bpy.data.objects[rig_name]
body = bpy.data.objects[body_name]
for tr in (rig.animation_data.nla_tracks if rig.animation_data else []):
    tr.mute = True
if rig.animation_data: rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
bpy.context.view_layer.update()

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=variant)
new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']:
    bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in new: o.select_set(True)
bpy.context.view_layer.objects.active = new[0]
if len(new) > 1: bpy.ops.object.join()
outfit = bpy.context.view_layer.objects.active
outfit.name = body_name + 'Outfit'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def box(o):
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi
# Does the new model have a tail? A tail makes a croc much deeper front to back
# for its height; compare the shapes, not the sizes.
blo, bhi = box(body); vlo, vhi = box(outfit)
has_tail = (vhi.y - vlo.y) / (vhi.z - vlo.z) > 0.85 * (bhi.y - blo.y) / (bhi.z - blo.z)

# Without a tail: split the template body into the body (to copy weights from
# and line up with) and its tail (grafted onto the new model below).
import bmesh
src, graft = body, None
if not has_tail:
    def part(keep_tail):
        o = body.copy(); o.data = body.data.copy(); bpy.context.scene.collection.objects.link(o)
        names = {g.index: g.name for g in o.vertex_groups}
        bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.active; bm.verts.ensure_lookup_table()
        # The graft takes only clearly-tail skin (not the edge of his own shorts
        # where the tail joins); the body copy leaves out anything mostly tail.
        cut = 0.8 if keep_tail else 0.5
        def tailish(v):
            if not v[dl]: return False
            tail = sum(w for gi, w in v[dl].items() if names.get(gi, '').startswith('Tail'))
            return tail > cut
        drop = [v for v in bm.verts if tailish(v) != keep_tail]
        bmesh.ops.delete(bm, geom=drop, context='VERTS'); bm.to_mesh(o.data); bm.free()
        return o, len(drop)
    src, dropped = part(False)
    graft, _ = part(True)
    graft.name = body_name + 'Tail'
    print('NO TAIL on the new model: weights from the template without its tail (%d points), and its tail grafted on' % dropped)

# 1. Line up: same height, feet on the same floor, centred the same (against
# the template without its tail when the new model has none).
blo, bhi = box(src)
k = (bhi.z - blo.z) / max(1e-6, vhi.z - vlo.z)
outfit.scale = (k, k, k); bpy.ops.object.transform_apply(scale=True)
vlo, vhi = box(outfit)
outfit.location = Vector(((blo.x + bhi.x) / 2 - (vlo.x + vhi.x) / 2, (blo.y + bhi.y) / 2 - (vlo.y + vhi.y) / 2, blo.z - vlo.z))
bpy.ops.object.transform_apply(location=True)
print('ALIGNED scale %.3f, size template %s variant %s' % (k, tuple(round(v, 2) for v in bhi - blo), tuple(round(v, 2) for v in box(outfit)[1] - box(outfit)[0])))

# 2. Copy the skin weights from the template body.
for g in body.vertex_groups:
    if g.name not in outfit.vertex_groups: outfit.vertex_groups.new(name=g.name)
bpy.ops.object.select_all(action='DESELECT'); outfit.select_set(True); bpy.context.view_layer.objects.active = outfit
dt = outfit.modifiers.new('weights', 'DATA_TRANSFER')
dt.object = src
dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier=dt.name)
bare = sum(1 for v in outfit.data.vertices if not any(g.weight > 0.01 for g in v.groups))
# Blur the copied weights along the surface so loose clothes (a shirt standing
# off the body) bend smoothly at the shoulders and waist instead of tearing.
# Only below the neck: the head and jaw keep their crisp weights.
neck_z = (rig.matrix_world @ rig.data.bones['Neck'].head_local).z if 'Neck' in rig.data.bones else 1e9
for v in outfit.data.vertices: v.select = (outfit.matrix_world @ v.co).z < neck_z - 0.05
outfit.data.use_paint_mask_vertex = True
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=8)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')
outfit.data.use_paint_mask_vertex = False
print('WEIGHTS copied; points with no weight:', bare, 'of', len(outfit.data.vertices))

# 3. Bind to the skeleton, drop the template body, export with every move.
mod = outfit.modifiers.new('rig', 'ARMATURE'); mod.object = rig
outfit.parent = rig
if graft:
    if not any(m.type == 'ARMATURE' for m in graft.modifiers):
        gm = graft.modifiers.new('rig', 'ARMATURE'); gm.object = rig
    for m in graft.modifiers:
        if m.type == 'ARMATURE': m.object = rig
    graft.parent = rig
    graft.matrix_parent_inverse = rig.matrix_world.inverted()
bpy.data.objects.remove(body)
if src is not body: bpy.data.objects.remove(src)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o not in (outfit,) and o.parent != rig: bpy.data.objects.remove(o)
for pb in rig.pose.bones: pb.custom_shape = None
for tr in (rig.animation_data.nla_tracks if rig.animation_data else []): tr.mute = False
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in rig.children: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True, export_yup=True, export_skins=True)
print('EXPORTED', out, 'moves:', len(bpy.data.actions))

if preview:
    for tr in rig.animation_data.nla_tracks: tr.mute = True
    act = bpy.data.actions.get('Run') or bpy.data.actions[0]
    rig.animation_data.action = act
    scene = bpy.context.scene
    scene.frame_set(int(act.frame_range[0] + (act.frame_range[1] - act.frame_range[0]) * 0.3))
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 600, 700
    scene.world = bpy.data.worlds.new('w'); rig.hide_render = True
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.4
    cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = Vector((5, -5, 0.2)); cam.rotation_euler = (math.radians(88), 0, math.radians(45))
    scene.render.filepath = preview; bpy.ops.render.render(write_still=True)
    print('PREVIEW', preview)
