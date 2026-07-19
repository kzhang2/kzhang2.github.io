import numpy as np
import plotly.graph_objects as go
import numpy as np
import matplotlib.pyplot as plt

def get_circle_pts(center_xs, center_ys, radii, num_pts=25):
    """
    Args:
        center_xs: (n,)
        center_ys: (n,)
        radii: (n,)
    """
    thetas = np.linspace(0, 2*np.pi, num_pts)
    xs = np.cos(thetas)[None, :] * radii[:, None] - center_xs[:, None]
    ys = np.sin(thetas)[None, :] * radii[:, None] - center_ys[:, None]
    zs = np.zeros_like(xs)
    pts = np.stack([xs, ys, zs], axis=-1)
    return pts

def get_grid_pts(center_xs, center_ys, gsl, angle):
    rot_mat = np.array([[np.cos(angle), -np.sin(angle)],
                        [np.sin(angle), np.cos(angle)]])
    pts = np.array([[-gsl, -gsl],
                    [-gsl, gsl],
                    [gsl, gsl],
                    [gsl, -gsl]]) / 2
    pts = (rot_mat @ pts.T).T 
    ret = np.zeros((len(center_xs), 4, 3))
    ret[..., 0] = -center_xs[:, None] + pts[None, :, 0]
    ret[..., 1] = -center_ys[:, None] + pts[None, :, 1]
    return ret 

def load_center_data(path, img_h, img_w, occ_w, occ_h, grid_len):
    center_data = plt.imread(path)
    # center_data = np.load(path) / 255
    print(center_data.sum())
    centers = np.argwhere(center_data > 0) 
    diameters = center_data[centers[:, 0], centers[:, 1]]
    xs = centers[:, 1].astype(float) / img_h - (occ_w/2)
    ys = centers[:, 0].astype(float) / img_h - (occ_h/2)
    radii = (diameters / 2) * (grid_len / img_h)
    return xs, ys, radii

def plot_pose(light_pose, fig):
    R = light_pose[:3, :3]
    t = light_pose[:3, 3] 
    
    in_vec = np.array([0.0, 0.0, 1.0])
    in_vec_world = (R @ in_vec[:, None])[:, 0]
    into = t + in_vec_world
    pts = np.array([t, into]) 

    pose_plot = go.Scatter3d(
        x=pts[:, 0],
        y=pts[:, 1],
        z=pts[:, 2],
        marker=dict(size=5, color="blue"),
    )
    fig.add_trace(pose_plot)

def project(pts, c2w):
    R = c2w[:3, :3] # (3, 3)
    t = c2w[:3, 3]  # (3,)
    pts_camera = (R.T @ (pts - t[None, :]).T).T # (n, 3) 
    pts_proj_camera = pts_camera / pts_camera[:, 2:3]
    pts_proj_world = (R @ (pts_proj_camera.T)).T + t[None, :]
    # return pts_proj_world
    return pts_proj_camera
