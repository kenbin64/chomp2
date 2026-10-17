# blender-bake-lowpoly.py
# Turns a heavy Meshy model (hundreds of thousands to millions of triangles,
# its texture cut into thousands of pieces) into a light game model that still
# looks like the original. Simply merging triangles scrambles such a texture, so
# this does what game studios do:
#   1. make a clean light copy of the shape (optionally melted into one surface
#      first with a voxel remesh, for models made of many loose bits such as fur),
#   2. lay out fresh, tidy texture coordinates on it,
#   3. bake: copy the colour and the fine surface detail (as a normal map) from
#      the heavy model onto the light one.
#
#   blender --background --factory-startup --python tools/blender-bake-lowpoly.py -- \
#       in.glb out.glb <triangles> <texture-size> [voxel-size-in-model-units] [reach]
#   reach (default 1): how far the bake looks for the original's surface; raise it
#   (2 or 3) for busy shapes where the light copy sits further from the original,
#   which otherwise shows as black patches.
#
# Example: Kenny (fur in 68,000 loose tufts) needs the voxel step; a jar does not.

import sys, math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out, target, size = args[0], args[1], int(args[2]), int(args[3])
voxel = float(args[4]) if len(args) > 4 else 0.0
reach_k = float(args[5]) if len(args) > 5 else 1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
high.name = 'High'
dims = high.dimensions
reach = max(dims)
print('HIGH', sum(len(p.vertices) - 2 for p in high.data.polygons), 'triangles, size', tuple(round(d, 3) for d in dims))

# ---- 1. The light copy -----------------------------------------------------------
low = high.copy(); low.data = high.data.copy(); low.name = 'Low'
bpy.context.scene.collection.objects.link(low)
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active = low
if voxel > 0:
    m = low.modifiers.new('melt', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=m.name)
else:
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=reach * 1e-4); bpy.ops.object.mode_set(mode='OBJECT')
faces = len(low.data.polygons)
m = low.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'
m.ratio = min(1.0, target / max(1, sum(len(p.vertices) - 2 for p in low.data.polygons)))
m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.shade_smooth()
print('LOW', len(low.data.polygons), 'triangles (from', faces, 'faces)')

# ---- 2. Fresh texture coordinates ------------------------------------------------
while low.data.uv_layers: low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 3. Bake colour and detail from the heavy model -------------------------------
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception:
    scene.cycles.device = 'CPU'

def image(name, data=False):
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    if data: img.colorspace_settings.name = 'Non-Color'
    return img

color_img, normal_img = image('Color'), image('Normal', data=True)
mat = bpy.data.materials.new('Baked'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = color_img
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal_img
nm = nt.nodes.new('ShaderNodeNormalMap')
low.data.materials.clear(); low.data.materials.append(mat)

bpy.ops.object.select_all(action='DESELECT')
high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
bake = scene.render.bake
bake.use_selected_to_active = True
bake.cage_extrusion = reach * 0.012 * reach_k
bake.max_ray_distance = reach * 0.04 * reach_k
bake.margin = 8

nt.nodes.active = tc
bake.use_pass_direct = False; bake.use_pass_indirect = False; bake.use_pass_color = True
bpy.ops.object.bake(type='DIFFUSE')
print('BAKED colour')
nt.nodes.active = tn
bpy.ops.object.bake(type='NORMAL')
print('BAKED normal')

# Wire the baked pictures into the material the game will read.
nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.55
for img in (color_img, normal_img): img.pack()

# ---- Export only the light model --------------------------------------------------
bpy.data.objects.remove(high)
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True)
low.name = 'Model'
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format='GLB')
print('EXPORTED', out)
