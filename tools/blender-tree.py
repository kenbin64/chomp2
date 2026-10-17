# blender-tree.py
# Turns a heavy Meshy tree (millions of triangles, its mesh cut apart at every
# texture seam) into a light game tree that keeps its look. Trunk and leaves
# need opposite treatment, so each comes from the method that suits it:
#
#   Trunk and branches: the whole tree is melted into one surface, slimmed,
#     given fresh texture coordinates, and its colour and detail baked from the
#     original. Melting turns leaves into blobs, but the bark comes out clean, so
#     once baked the blobs are recognised by their colour and removed.
#   Leaves: a straight slim of the original keeps real, wispy leaves (one piece
#     per leaf at the least). A share of them is kept, each grown a little so the
#     crown stays full, and anything lying on the trunk is dropped so the bark
#     stays clean.
#
#   blender --background --factory-startup --python tools/blender-tree.py -- \
#       in.glb out.glb <leaf-triangles> <trunk-triangles> <texture-size>

import sys, math, random, colorsys
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
leaf_target, trunk_target, size = int(args[2]), int(args[3]), int(args[4])
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
high = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
high.name = 'High'
height = high.dimensions.z

def select_only(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def copy_of(o, name):
    c = o.copy(); c.data = o.data.copy(); c.name = name; bpy.context.scene.collection.objects.link(c); return c
def slim(o, target):
    select_only(o)
    m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, target / max(1, tris(o))); m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)

# ---- 1. Trunk: melt, slim, bake, then drop the leaf blobs by their baked colour ----
trunk = copy_of(high, 'Trunk')
select_only(trunk)
m = trunk.modifiers.new('melt', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = height * 0.003
bpy.ops.object.modifier_apply(modifier=m.name)
slim(trunk, trunk_target * 4)                       # leaf blobs are still in; most of them go below
bpy.ops.object.shade_smooth()
trunk.data.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')

scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 8
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception:
    scene.cycles.device = 'CPU'
color = bpy.data.images.new('BarkColor', size, size); normal = bpy.data.images.new('BarkNormal', size, size)
normal.colorspace_settings.name = 'Non-Color'
mat = bpy.data.materials.new('Bark'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = color
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normal
nm = nt.nodes.new('ShaderNodeNormalMap')
trunk.data.materials.clear(); trunk.data.materials.append(mat)
bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); trunk.select_set(True)
bpy.context.view_layer.objects.active = trunk
bake = scene.render.bake
bake.use_selected_to_active = True; bake.cage_extrusion = height * 0.01; bake.max_ray_distance = height * 0.03; bake.margin = 8
nt.nodes.active = tc
bake.use_pass_direct = False; bake.use_pass_indirect = False; bake.use_pass_color = True
bpy.ops.object.bake(type='DIFFUSE')
nt.nodes.active = tn
bpy.ops.object.bake(type='NORMAL')
nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.8

# Each face reads its baked colour. Bark is the brighter part of a tree; the
# melted leaf blobs are darker and green. The line between them is set from this
# tree's own colours (half way between its darker and brighter faces).
px = np.empty(size * size * 4, dtype=np.float32); color.pixels.foreach_get(px); px = px.reshape(size, size, 4)
bm = bmesh.new(); bm.from_mesh(trunk.data); uv = bm.loops.layers.uv.active
hsv = []
for f in bm.faces:
    u = sum(l[uv].uv.x for l in f.loops) / len(f.loops); v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
    r, g, b = px[min(size - 1, int(v * size)), min(size - 1, int(u * size)), :3]
    hsv.append(colorsys.rgb_to_hsv(float(r), float(g), float(b)))
vals = [x[2] for x in hsv]
rgbs = []
for f in bm.faces:
    u = sum(l[uv].uv.x for l in f.loops) / len(f.loops); v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
    rgbs.append(px[min(size - 1, int(v * size)), min(size - 1, int(u * size)), :3])
rgbs = np.array(rgbs)
print('COLOURS value pct', [round(float(np.percentile(vals, q)), 3) for q in (5, 25, 50, 75, 95)],
      'hue pct', [round(float(np.percentile([x[0] for x in hsv], q)), 3) for q in (5, 25, 50, 75, 95)],
      'g-r pct', [round(float(np.percentile(rgbs[:, 1] - rgbs[:, 0], q)), 3) for q in (5, 25, 50, 75, 95)])
cut = 0.5 * (np.percentile(vals, 30) + np.percentile(vals, 85))
# The melted leaf blobs sit too far from any real surface for the bake to reach,
# so they come out black; the darker green faces are blob edges.
leafy = [f for f, (h, s, val), c in zip(bm.faces, hsv, rgbs) if val < 0.06 or (val < cut and c[1] - c[0] > 0.005)]
bmesh.ops.delete(bm, geom=leafy, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(trunk.data); bm.free()
slim(trunk, trunk_target)
color.pack(); normal.pack()
print('TRUNK', tris(trunk), 'brightness line %.2f' % cut, 'leaf blobs removed', len(leafy))

# ---- 2. Leaves: a straight slim keeps them wispy; keep a share, grown --------------
leaves = copy_of(high, 'Leaves')
slim(leaves, 1)                                    # as low as it goes: about one piece per leaf
bm = bmesh.new(); bm.from_mesh(leaves.data)
tree = BVHTree.FromObject(trunk, bpy.context.evaluated_depsgraph_get())
near_trunk = []
for f in bm.faces:
    hit = tree.find_nearest(f.calc_center_median())
    if hit[0] is not None and hit[3] < height * 0.012: near_trunk.append(f)
bmesh.ops.delete(bm, geom=near_trunk, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.verts.ensure_lookup_table()
seen, pieces = set(), []
for v in bm.verts:
    if v.index in seen: continue
    stack = [v]; members = []
    while stack:
        a = stack.pop()
        if a.index in seen: continue
        seen.add(a.index); members.append(a)
        stack.extend(e.other_vert(a) for e in a.link_edges)
    pieces.append(members)
total = len(bm.faces)
keep_share = min(1.0, leaf_target / max(1, total))
grow = 1.0 / max(keep_share, 0.05) ** 0.3
drop = []
for members in pieces:
    if random.random() < keep_share:
        c = sum((v.co for v in members), Vector()) / len(members)
        for v in members: v.co = c + (v.co - c) * grow
    else:
        drop.extend(members)
bmesh.ops.delete(bm, geom=drop, context='VERTS')
bm.to_mesh(leaves.data); bm.free()
print('LEAVES', tris(leaves), 'from', total, 'pieces', len(pieces), 'grown x%.2f' % grow, 'removed on trunk', len(near_trunk))

# ---- 3. Export trunk and leaves together ------------------------------------------
bpy.data.objects.remove(high)
bpy.ops.object.select_all(action='DESELECT'); leaves.select_set(True); trunk.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format='GLB')
print('EXPORTED', out, 'total', tris(leaves) + tris(trunk))
