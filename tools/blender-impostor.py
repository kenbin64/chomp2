# blender-impostor.py
# Renders a model (a tree) from several directions round it into picture tiles,
# for "impostors": in the game each tree is one flat card that turns to face the
# camera and shows the tile for the direction it is seen from. The full-detail
# Meshy original is what gets rendered, so the tree looks exactly like it, at a
# cost of two triangles. Big open-world games draw their trees this way.
#
# Two tiles per direction:
#   colour  the surface colour only (no lighting), with transparency around it
#   normal  which way each point of the surface faces, as seen from the camera,
#           so the game's own sun and sky light the card as if it were round
#
# The tiles are put together into one picture each by tools/impostor-atlas.py.
#
#   blender --background --factory-startup --python tools/blender-impostor.py -- \
#       in.glb out-folder <directions> <tile-pixels> <camera-elevation-degrees>

import sys, os, math, json
import bpy
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
frames, tile, elev = int(args[2]), int(args[3]), float(args[4])
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
lo = Vector((1e9, 1e9, 1e9)); hi = -lo
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
centre = (lo + hi) / 2
height = hi.z - lo.z
reach = max(hi.x - lo.x, hi.y - lo.y, height) * 1.04   # the square every view fits in

# ---- Two override materials: surface colour, and surface direction ----------------
def base_image(mat):
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and any(l.to_socket.name == 'Base Color' for l in n.outputs['Color'].links):
            return n.image
    return None

def colour_material(img):
    m = bpy.data.materials.new('ImpColour'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs['Color'], e.inputs['Color']); nt.links.new(e.outputs[0], o.inputs[0])
    return m

def normal_material():
    # Camera-space surface direction, turned toward the camera on the back of a
    # leaf, packed into 0..1 colour: x right, y up, z toward the camera.
    m = bpy.data.materials.new('ImpNormal'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    g = nt.nodes.new('ShaderNodeNewGeometry')
    vt = nt.nodes.new('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'CAMERA'
    flip = nt.nodes.new('ShaderNodeMath'); flip.operation = 'MULTIPLY_ADD'
    flip.inputs[1].default_value = -2.0; flip.inputs[2].default_value = 1.0          # 1 on the front, -1 on the back
    sc = nt.nodes.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'
    half = nt.nodes.new('ShaderNodeVectorMath'); half.operation = 'MULTIPLY_ADD'
    half.inputs[1].default_value = (0.5, 0.5, -0.5); half.inputs[2].default_value = (0.5, 0.5, 0.5)
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(g.outputs['Normal'], vt.inputs['Vector'])
    nt.links.new(g.outputs['Backfacing'], flip.inputs[0])
    nt.links.new(vt.outputs['Vector'], sc.inputs[0]); nt.links.new(flip.outputs[0], sc.inputs['Scale'])
    nt.links.new(sc.outputs['Vector'], half.inputs[0])
    nt.links.new(half.outputs['Vector'], e.inputs['Color']); nt.links.new(e.outputs[0], o.inputs[0])
    return m
# (Blender's camera looks down its own -z, so the z part is flipped above to make
#  "toward the camera" positive, as the game's normal maps expect.)

originals = {o.name: [s.material for s in o.material_slots] for o in meshes}
colours = {}
for o in meshes:
    for s in o.material_slots:
        if s.material and s.material.name not in colours:
            img = base_image(s.material)
            colours[s.material.name] = colour_material(img) if img else s.material
normal_mat = normal_material()

# ---- Camera and render settings ----------------------------------------------------
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = tile
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
scene.render.filter_size = 1.2
scene.world = bpy.data.worlds.new('w')
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = reach; cd.clip_end = reach * 20
cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam

def aim(k):
    # Direction k of `frames`, going round anticlockwise seen from above, starting
    # in front of the model (Blender's -y, the game's +z).
    a = 2 * math.pi * k / frames
    e = math.radians(elev)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = centre + d * reach * 6
    f = (centre - cam.location).normalized()
    right = f.cross(Vector((0, 0, 1))).normalized(); up = right.cross(f)
    cam.matrix_world = Matrix.Translation(cam.location) @ Matrix((right, up, -f)).transposed().to_4x4()

for pass_name in ('colour', 'normal'):
    scene.view_settings.view_transform = 'Standard' if pass_name == 'colour' else 'Raw'
    scene.view_settings.look = 'None'
    for o in meshes:
        for i, s in enumerate(o.material_slots):
            s.material = colours[originals[o.name][i].name] if pass_name == 'colour' else normal_mat
    for k in range(frames):
        aim(k)
        scene.render.filepath = os.path.join(out, '%s-%d.png' % (pass_name, k))
        bpy.ops.render.render(write_still=True)

# Where the card sits: the tree's base is `base` of the way up the square, and the
# square is `reach` model units wide for a tree `height` tall.
info = {'frames': frames, 'elevation': elev, 'size': reach, 'height': height,
        'base': (lo.z - (centre.z - reach / 2)) / reach, 'tile': tile}
json.dump(info, open(os.path.join(out, 'info.json'), 'w'), indent=1)
print('IMPOSTOR', json.dumps(info))
