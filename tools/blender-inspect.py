# blender-inspect.py
# Opens a model in Blender without its window and reports what is in it: objects,
# triangles, size, bones, materials and textures. Also renders front, side and
# top pictures so the model can be checked without opening Blender by hand.
#
#   blender --background --factory-startup --python tools/blender-inspect.py -- model.glb out-prefix

import sys, math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
path, prefix = args[0], args[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
if path.lower().endswith('.fbx'):
    bpy.ops.import_scene.fbx(filepath=path)
else:
    bpy.ops.import_scene.gltf(filepath=path)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']

lo = Vector((1e9, 1e9, 1e9)); hi = -lo
tris = 0
for o in meshes:
    m = o.data
    m.calc_loop_triangles()
    tris += len(m.loop_triangles)
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
size = hi - lo
print('OBJECTS', [(o.name, o.type) for o in bpy.context.scene.objects])
print('TRIANGLES', tris)
print('SIZE x %.3f  y %.3f  z %.3f   (Blender: z is up, -y is front)' % tuple(size))
print('MIN', tuple(round(v, 3) for v in lo), 'MAX', tuple(round(v, 3) for v in hi))
for a in arms:
    print('BONES', len(a.data.bones), [b.name for b in a.data.bones][:80])
for o in meshes:
    print('MESH', o.name, 'materials', [s.material.name if s.material else None for s in o.material_slots],
          'vertex groups', len(o.vertex_groups))
print('IMAGES', [(i.name, tuple(i.size)) for i in bpy.data.images])
print('ACTIONS', [a.name for a in bpy.data.actions])

# Render front, side and top with the solid (workbench) engine and the model's texture.
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.render.resolution_x, scene.render.resolution_y = 700, 900
scene.render.film_transparent = False
world = bpy.data.worlds.new('w'); scene.world = world
centre = (lo + hi) / 2
reach = max(size) * 1.25
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = reach
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
views = {
    'front': (Vector((0, -10, 0)), (math.radians(90), 0, 0)),
    'side':  (Vector((10, 0, 0)), (math.radians(90), 0, math.radians(90))),
    'back':  (Vector((0, 10, 0)), (math.radians(90), 0, math.radians(180))),
}
for name, (off, rot) in views.items():
    cam.location = centre + off
    cam.rotation_euler = rot
    scene.render.filepath = '%s-%s.png' % (prefix, name)
    bpy.ops.render.render(write_still=True)
print('RENDERED', prefix)
