# import plotly.graph_objects as go
import numpy as np
# import matplotlib.pyplot as plt
import json

from scipy.spatial.transform import Rotation as R
from utils import *
import argparse 

parser = argparse.ArgumentParser()
parser.add_argument("--long", action="store_true")
args = parser.parse_args()

# hardcoded params (that can be stored/read properly later)
img_w = 3024
img_h = 4032 
occ_w = img_w / img_h 
occ_h = 1.0
grid_len = 50

paths = ["0_ds.png", "15_ds.png", "30_ds.png"]
# paths = ["0_ds.npy", "15_ds.npy", "30_ds.npy"]
# paths = ["0_cl.png", "15_cl.png", "30_cl.png"]
colors = ["red", "green", "blue"]
ts = [np.array([-1.0, 0.0, -np.sqrt(3)]), np.array([0.0, 0.0, -2]), np.array([1.0, 0.0, -np.sqrt(3)])]
angles = [np.pi/6, 0, -np.pi/6]
grid_angles = [0, np.pi/12, np.pi/6]
fig = go.Figure()


data_for_3 = {"data": []}

for i, path in enumerate(paths):
    curr_out = {}
    data_for_3["data"].append(curr_out)
    curr_out["light_angle"] = angles[i] 
    curr_out["light_offset"] = list(ts[i])
    xs, ys, radii = load_center_data(path, img_h, img_w, occ_w, occ_h, grid_len)
    print((radii==0).sum())
    pts = get_circle_pts(xs, ys, radii)
    pts_grid = get_grid_pts(xs, ys, grid_len/img_h, grid_angles[i])

    print(pts.shape)

    # c2w matrix 
    light_pose = np.eye(4)
    light_pose[:3, 3] = ts[i]
    rot = R.from_rotvec(angles[i] * np.array([0, 1, 0]))
    light_pose[:3, :3] = rot.as_matrix()
    plot_pose(light_pose, fig)

    pts_init_shape = pts.shape 
    pts_grid_init_shape = pts_grid.shape
    pts_disp = pts.reshape(-1, 3)
    pts_grid_disp = pts_grid.reshape(-1, 3)
    pts_proj = project(pts_disp, light_pose)
    pts_grid_proj = project(pts_grid_disp, light_pose)
    if args.long:
        curr_out["projected_circle_points"] = pts_proj.reshape(pts_init_shape).tolist()
        curr_out["projected_grid_points"] = pts_grid_proj.reshape(pts_grid_init_shape).tolist()

if args.long:
    with open("data_for_three.json", "w", encoding="utf-8") as f:
        json.dump(data_for_3, f, ensure_ascii=False, indent=4)
else:
    with open("data_for_three_short.json", "w", encoding="utf-8") as f:
        json.dump(data_for_3, f, ensure_ascii=False, indent=4)    
