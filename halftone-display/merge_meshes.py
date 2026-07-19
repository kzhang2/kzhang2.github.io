import trimesh
import json 

# TODO: automatically get below paths? 
scenes = ["scene_0", "scene_1", "scene_2"]
with open("data_for_three_short.json", "r") as f:
    dfts = json.load(f)

for i, s in enumerate(scenes):
    print(s)
    scene = trimesh.load_mesh(f"{s}.glb")
    count = 0
    sample_tiles = []
    limit = 10
    total_v = 0
    for geo in scene.geometry:
        sample_geo = scene.geometry[geo]

        if len(sample_geo.vertices) > 250:
            sample_geo.faces = sample_geo.faces[:len(sample_geo.vertices)//3] # hack bc three.js is buggy
            sample_tiles.append(sample_geo)   

        count += 1
        total_v += len(sample_geo.vertices)

    combined_sample_mesh = trimesh.util.concatenate(sample_tiles)
    print(combined_sample_mesh)
    combined_sample_mesh.merge_vertices()
    print(combined_sample_mesh)
    with open(f"{s}_merged.glb", "wb") as f:
        f.write(trimesh.exchange.gltf.export_glb(combined_sample_mesh, include_normals=True))
    dfts["data"][i]["scene_path"] = f"{s}_merged.glb"

with open('data_for_three_short.json', 'w') as file:
    json.dump(dfts, file, indent=4)