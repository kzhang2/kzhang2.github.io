# halftone-display
## How-to
1. Install some python packages. We need `numpy`, `pillow`, `scikit-learn`, `matplotlib`, and `trimesh`. 
2. Run `gen_ht_data_for_three.py`. This generates the halftone data, namely where the center of the halftones are (but that has some bugs). 
3. Run `project-halftones.py`. You can have it either generate short metadata, which only contains light information, or long metadata, which contains the full mesh information. 
4. Install some node packages. 
5. Run `generate_meshes.js` using node. (TODO: move this into python so I can combine everything into one script? Just need a basic CSG routine to do subtractions, does that exist in trimesh?)
6. Run the code in `merge-meshes.py`.
7. Serve the site!
```
npm init -y
npm install three three-bvh-csg lil-gui
```
