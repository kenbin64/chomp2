# Blender, headless: keep only a palm's crown (everything above a fraction of its height),
# decimate it to a triangle target, and export a GLB. Prints the crown's measurements.
# Usage: blender --background --factory-startup --python crown.py -- in.glb out.glb target_tris cut_fraction
import bpy, bmesh, sys
args = sys.argv[sys.argv.index('--') + 1:]
src, dst, target, cut = args[0], args[1], int(args[2]), float(args[3])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
zs = [(o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices]
lo, hi = min(zs), max(zs); limit = lo + (hi - lo) * cut
for o in meshes:
    bm = bmesh.new(); bm.from_mesh(o.data)
    mw = o.matrix_world
    gone = [f for f in bm.faces if all((mw @ v.co).z < limit for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(o.data); bm.free()
total = sum(len(o.data.polygons) for o in meshes)
for o in meshes:
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, target / max(total, 1)); m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)
print(f'CROWN cut at {cut:.2f} of height ({limit - lo:.3f} of {hi - lo:.3f}); faces {total} -> {sum(len(o.data.polygons) for o in meshes)}')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB')
