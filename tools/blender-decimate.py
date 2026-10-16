# Blender, headless: import a GLB, decimate every mesh to a triangle target, export a GLB.
# Usage: blender --background --factory-startup --python decimate.py -- in.glb out.glb target_tris
import bpy, sys
args = sys.argv[sys.argv.index('--') + 1:]
src, dst, target = args[0], args[1], int(args[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
total = sum(len(o.data.polygons) for o in meshes)
for o in meshes:
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, target / max(total, 1))
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)
after = sum(len(o.data.polygons) for o in meshes)
print(f'DECIMATED {total} -> {after} faces')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_draco_mesh_compression_enable=False)
