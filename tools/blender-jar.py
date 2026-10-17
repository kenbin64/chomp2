# blender-jar.py
# Kenny's jar: dark brown glass, a yellow ridged lid, and a yellow label with a
# red band and a big red "V". It is a nod to the famous Australian spread
# without naming it (Ken's rule: the product is implied, never named).
#
# The label picture is painted with Pillow first (tools/jar-label.py writes
# assets/jar/label.png); this script builds the jar around it and exports a GLB
# about 9 cm tall, the size of a small real jar.
#
#   blender --background --factory-startup --python tools/blender-jar.py -- assets/jar/label.png out.glb [preview.png]

import sys, math
import bpy, bmesh

args = sys.argv[sys.argv.index('--') + 1:]
label_png, out = args[0], args[1]
preview = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

H, R = 0.09, 0.034              # jar height and radius in metres

def material(name, color, rough, metal=0.0, image=None, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if image:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(image)
        m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return m

glass = material('JarGlass', (0.10, 0.045, 0.02), 0.12)
lid = material('JarLid', (1.0, 0.70, 0.02), 0.4, 0.1)
label = material('JarLabel', (1, 1, 1), 0.55, image=label_png)

# The glass body: a lathe profile (radius by height) spun around, rounded at the
# shoulder and the base like a real jar.
profile = [(0.0, 0.0), (R * 0.85, 0.0), (R, 0.006), (R, H * 0.78), (R * 0.93, H * 0.84),
           (R * 0.80, H * 0.86), (R * 0.80, H * 0.88), (0.0, H * 0.88)]
SEG = 40
bm = bmesh.new()
rings = []
for r, z in profile:
    ring = [bm.verts.new((r * math.cos(TAU), r * math.sin(TAU), z)) for TAU in
            [2 * math.pi * k / SEG for k in range(SEG)]]
    rings.append(ring)
for a, b in zip(rings, rings[1:]):
    for k in range(SEG):
        bm.faces.new((a[k], a[(k + 1) % SEG], b[(k + 1) % SEG], b[k]))
me = bpy.data.meshes.new('Jar'); bm.to_mesh(me); bm.free()
me.materials.append(glass)
jar = bpy.data.objects.new('Jar', me); bpy.context.scene.collection.objects.link(jar)
bpy.context.view_layer.objects.active = jar
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()

# The lid: a short cylinder with grip ridges round its edge.
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=R * 0.9, depth=H * 0.16, location=(0, 0, H * 0.96))
cap = bpy.context.object; cap.name = 'Lid'; cap.data.materials.append(lid)
for i, v in enumerate([v for v in cap.data.vertices]):
    k = round(math.atan2(v.co.y, v.co.x) / (2 * math.pi) * 48)
    if k % 2 == 0:
        v.co.x *= 1.04; v.co.y *= 1.04          # every other edge point out: ridges
bev = cap.modifiers.new('round', 'BEVEL'); bev.width = 0.0025; bev.segments = 2
bpy.ops.object.modifier_apply(modifier='round')

# The label: an open cylinder just outside the glass, wrapped with the picture.
LSEG = 48
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new()
lo, hi = H * 0.16, H * 0.70
bottom = [bm.verts.new((R * 1.004 * math.cos(2 * math.pi * k / LSEG), R * 1.004 * math.sin(2 * math.pi * k / LSEG), lo)) for k in range(LSEG + 1)]
top = [bm.verts.new((R * 1.004 * math.cos(2 * math.pi * k / LSEG), R * 1.004 * math.sin(2 * math.pi * k / LSEG), hi)) for k in range(LSEG + 1)]
for k in range(LSEG):
    f = bm.faces.new((bottom[k], bottom[k + 1], top[k + 1], top[k]))
    for loop, (u, v) in zip(f.loops, [(k / LSEG, 0), ((k + 1) / LSEG, 0), ((k + 1) / LSEG, 1), (k / LSEG, 1)]):
        loop[uv_layer].uv = (u, v)
me = bpy.data.meshes.new('Label'); bm.to_mesh(me); bm.free()
me.materials.append(label)
lab = bpy.data.objects.new('Label', me); bpy.context.scene.collection.objects.link(lab)
# Turn the label so the V faces the front (-y in Blender, +z in the game).
# A V printed at u = 0.25 sits at 90 degrees round the jar; the front is at 270
# (-y), so a half turn brings it there (and the second V to the back).
lab.rotation_euler = (0, 0, math.pi)
bpy.context.view_layer.objects.active = lab; lab.select_set(True)
bpy.ops.object.transform_apply(rotation=True)
bpy.ops.object.shade_smooth()

# One object, origin at the base centre. Every part needs a UV map of the same
# name before joining, or the label loses its picture coordinates in the join.
for o in (jar, cap):
    if not o.data.uv_layers:
        o.data.uv_layers.new(name='UVMap')
lab.data.uv_layers[0].name = 'UVMap'
bpy.ops.object.select_all(action='DESELECT')
for o in (jar, cap, lab): o.select_set(True)
bpy.context.view_layer.objects.active = jar
bpy.ops.object.join()
jar.name = 'KennysJar'
bpy.ops.object.shade_smooth()                    # smooth glass after the join
tris = sum(len(p.vertices) - 2 for p in jar.data.polygons)
print('JAR triangles', tris)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
print('EXPORTED', out)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = scene.render.resolution_y = 600
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.35, 0.42, 0.5, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), 0, math.radians(-30)); scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.lens = 85
    cam.location = (0.11, -0.40, 0.10); cam.rotation_euler = (math.radians(86), 0, math.radians(15))
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', preview)
