# blender-import-rigged.py
# Brings in a person Ken has rigged with Meshy's auto-rig (a Mixamo skeleton,
# "mixamorig:" names, usually with Meshy's Walking and Running clips) and
# readies it for tools/blender-animate-human.py: the same object and bone names
# as tools/blender-rig-human.py makes, Meshy's own skin weights kept, and its
# walk and run kept as our Walk and Run.
#
#   blender --background --factory-startup --python tools/blender-import-rigged.py -- meshy-rigged.glb out.blend

import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, bone_heuristic='TEMPERANCE')
rig = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
body = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == rig][0]
for o in [o for o in bpy.context.scene.objects if o not in (rig, body)]:
    bpy.data.objects.remove(o)                                  # Meshy's stray icosphere
rig.name, body.name = 'PersonRig', 'Person'

# Our bone names: the Mixamo pattern without the prefix. Renaming a bone also
# renames its skin group and the clips' channels.
for b in rig.data.bones:
    if b.name.startswith('mixamorig:'): b.name = b.name[len('mixamorig:'):]

KEEP = {'Walking': 'Walk', 'Running': 'Run'}
for a in list(bpy.data.actions):
    if a.name in KEEP: a.name = KEEP[a.name]; a.use_fake_user = True
    else: bpy.data.actions.remove(a)
if rig.animation_data:
    rig.animation_data.action = None
    for tr in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(tr)

print('BONES', ' '.join(b.name for b in rig.data.bones))
print('ACTIONS', ' '.join(a.name for a in bpy.data.actions))
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)
