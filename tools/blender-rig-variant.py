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
# 1. Line up: same height, feet on the same floor, centred the same.
blo, bhi = box(body); vlo, vhi = box(outfit)
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
# If the new model has no tail (Meshy sometimes leaves it off), the template's
# tail must not lend its weights: it hangs between his legs, and the inner
# thighs would follow the tail. Copy from a template body with the tail removed.
src = body
vlo2, vhi2 = box(outfit)
has_tail = (vhi2.y - vlo2.y) > 0.85 * (bhi.y - blo.y)
if not has_tail:
    import bmesh
    src = body.copy(); src.data = body.data.copy(); bpy.context.scene.collection.objects.link(src)
    names = {g.index: g.name for g in src.vertex_groups}
    bm = bmesh.new(); bm.from_mesh(src.data); dl = bm.verts.layers.deform.active; bm.verts.ensure_lookup_table()
    tail = [v for v in bm.verts if v[dl] and names.get(max(v[dl].items(), key=lambda kv: kv[1])[0], '').startswith('Tail')]
    bmesh.ops.delete(bm, geom=tail, context='VERTS'); bm.to_mesh(src.data); bm.free()
    print('NO TAIL on the new model: copying weights without the template tail (%d points left out)' % len(tail))
dt = outfit.modifiers.new('weights', 'DATA_TRANSFER')
dt.object = src
dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier=dt.name)
bare = sum(1 for v in outfit.data.vertices if not any(g.weight > 0.01 for g in v.groups))
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.4, repeat=2)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')
print('WEIGHTS copied; points with no weight:', bare, 'of', len(outfit.data.vertices))

# 3. Bind to the skeleton, drop the template body, export with every move.
mod = outfit.modifiers.new('rig', 'ARMATURE'); mod.object = rig
outfit.parent = rig
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
