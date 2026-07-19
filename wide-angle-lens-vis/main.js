import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "lil-gui";

const gui = new GUI();

class MeshHelperOptions {
  constructor(mesh, start_visibility) {
    this.mesh = mesh;
    this.visible = start_visibility;
  }

  get visible() {
    return this._visible;
  }

  set visible(v) {
    this._visible = v;
    this.mesh.visible = v;
  }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// initialize viewing sphere texture
const texture_canvas = document.createElement("canvas");
const texture_ctx = texture_canvas.getContext("2d");
texture_ctx.canvas.width = 256;
texture_ctx.canvas.height = 256;
texture_ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
texture_ctx.fillRect(0, 0, texture_ctx.canvas.width, texture_ctx.canvas.height);
// make wireframe
let num_grid_lines = 16;
texture_ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx.fillRect(
    Math.floor((i * texture_ctx.canvas.width) / num_grid_lines),
    0,
    1,
    texture_ctx.canvas.height,
  );
}
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx.fillRect(
    0,
    Math.floor((i * texture_ctx.canvas.height) / num_grid_lines),
    texture_ctx.canvas.width,
    1,
  );
}
const texture = new THREE.CanvasTexture(texture_ctx.canvas);

// initialize viewing sphere geometry
const geometry = new THREE.SphereGeometry(1, 100, 100);
const material = new THREE.MeshBasicMaterial({ map: texture });
const sphere = new THREE.Mesh(geometry, material);

// initialize perspective imaging plane texture
const texture_canvas_plane = document.createElement("canvas");
const texture_ctx_plane = texture_canvas_plane.getContext("2d");
texture_ctx_plane.canvas.width = 256;
texture_ctx_plane.canvas.height = 256;
texture_ctx_plane.fillStyle = "rgba(255, 255, 255, 0.25)";
texture_ctx_plane.fillRect(
  0,
  0,
  texture_ctx_plane.canvas.width,
  texture_ctx_plane.canvas.height,
);
// make wireframe
// let num_grid_lines = 16;
texture_ctx_plane.fillStyle = "rgba(0, 0, 0, 1.0)";
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx_plane.fillRect(
    Math.floor((i * texture_ctx_plane.canvas.width) / num_grid_lines),
    0,
    1,
    texture_ctx_plane.canvas.height,
  );
}
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx_plane.fillRect(
    0,
    Math.floor((i * texture_ctx_plane.canvas.height) / num_grid_lines),
    texture_ctx_plane.canvas.width,
    1,
  );
}
const texture_plane = new THREE.CanvasTexture(texture_ctx_plane.canvas);

// initialize perspective imaging plane geometry
const plane_geometry = new THREE.PlaneGeometry(1, 1, 25, 25);
const plane_material = new THREE.MeshBasicMaterial({
  map: texture_plane,
  side: THREE.DoubleSide,
});
const plane = new THREE.Mesh(plane_geometry, plane_material);
plane.position.z = -2;
plane.scale.x = 10;
plane.scale.y = 10;
// plane.scale.z = 2;
plane.updateMatrixWorld();
scene.add(plane);

// initialize perspective imaging plane texture
const texture_canvas_plane_stereographic = document.createElement("canvas");
const texture_ctx_plane_stereographic =
  texture_canvas_plane_stereographic.getContext("2d");
texture_ctx_plane_stereographic.canvas.width = 256;
texture_ctx_plane_stereographic.canvas.height = 256;
texture_ctx_plane_stereographic.fillStyle = "rgba(255, 255, 255, 0.25)";
texture_ctx_plane_stereographic.fillRect(
  0,
  0,
  texture_ctx_plane_stereographic.canvas.width,
  texture_ctx_plane_stereographic.canvas.height,
);
// make wireframe
// let num_grid_lines = 16;
texture_ctx_plane_stereographic.fillStyle = "rgba(0, 0, 0, 1.0)";
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx_plane_stereographic.fillRect(
    Math.floor(
      (i * texture_ctx_plane_stereographic.canvas.width) / num_grid_lines,
    ),
    0,
    1,
    texture_ctx_plane_stereographic.canvas.height,
  );
}
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx_plane_stereographic.fillRect(
    0,
    Math.floor(
      (i * texture_ctx_plane_stereographic.canvas.height) / num_grid_lines,
    ),
    texture_ctx_plane_stereographic.canvas.width,
    1,
  );
}
const texture_plane_stereographic = new THREE.CanvasTexture(
  texture_ctx_plane_stereographic.canvas,
);

// initialize stereographic imaging plane geometry
const plane_stereographic_geometry = new THREE.PlaneGeometry(1, 1, 25, 25);
const plane_stereographic_material = new THREE.MeshBasicMaterial({
  map: texture_plane_stereographic,
  side: THREE.DoubleSide,
});
const plane_stereographic = new THREE.Mesh(
  plane_stereographic_geometry,
  plane_stereographic_material,
);
plane_stereographic.position.z = -2;
plane_stereographic.scale.x = 4;
plane_stereographic.scale.y = 4;
// plane.scale.z = 2;
plane_stereographic.updateMatrixWorld();
scene.add(plane_stereographic);

// controls
const controls = new OrbitControls(camera, renderer.domElement);

// vis coord system
const axes = new THREE.AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 2; // after the grid

let units = 10;
const grid = new THREE.GridHelper(units, units);
grid.material.depthTest = false;
grid.renderOrder = 1;

// load mesh and project textures
const loader = new GLTFLoader();
loader.load(
  // resource URL
  "static/models/rubiks_cube/scene.gltf",
  // "static/models/fumo/scene.gltf",
  // called when the resource is loaded
  function (gltf) {
    let loaded_scene = gltf;
    console.log(loaded_scene);
    // let mesh = gltf.scene.children[0].children[0].children[0]; // hardcoded for reimu
    let mesh = gltf.scene.children[0].children[0].children[0].children[0].children[0]; // hardcoded for rubik's cube
    // mesh.rotation.z = Math.PI;
    // mesh.position.z = -15;
    // mesh.position.y = -10;

    mesh.position.z = -8;
    mesh.position.y = 2;
    mesh.position.x = -2;
    mesh.scale.x = 90;
    mesh.scale.y = 90;
    mesh.scale.z = 90;

    mesh.updateMatrixWorld();
    scene.add(mesh);

    let mho = new MeshHelperOptions(scene.children[2], true); // hardcoded index for fumo
    gui.add(mho, "visible").name("mesh visibility");
    console.log(mesh);
    console.log(mesh.material);
    const texture = mesh.material.map;
    const textureWidth = texture.image.width;
    const textureHeight = texture.image.height;
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set the canvas size to match the ImageBitmap
    let imageBitmap = texture.source.data;
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    // Draw the ImageBitmap onto the canvas
    ctx.drawImage(imageBitmap, 0, 0);
    // document.body.appendChild(canvas);

    // Get the pixel data of the entire canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let positions = geometry.getAttribute("position");
    let uvs = geometry.getAttribute("uv");
    let positions_arr = positions.array;
    let uvs_arr = uvs.array;
    // console.log(positions);
    // console.log(uvs);
    // console.log(uvs_arr);
    let origin = new THREE.Vector3(0, 0, 0);
    let line_debug_group = new THREE.Group();
    let ep_debug_group = new THREE.Group();

    let line_debug_group_stereographic = new THREE.Group();
    for (let i = 0; i < positions_arr.length; i += 3) {
      let curr_pos = new THREE.Vector3(
        positions_arr[i],
        positions_arr[i + 1],
        positions_arr[i + 2],
      );
      let dir = curr_pos.sub(origin).normalize();

      let rc = new THREE.Raycaster(origin, dir);
      const intersects = rc.intersectObject(scene.children[2]);
      // shade viewing sphere
      if (intersects.length > 0) {
        let isect_pt = intersects[0].point;
        // make line vis
        const line_material = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const points = [];
        points.push(origin);
        points.push(isect_pt);
        // points.push(dir.multiplyScalar(intersects[0].distance));
        const line_geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(line_geometry, line_material);
        line_debug_group.add(line);

        // get hitpoint color
        // Sample the texture map using the UV coordinates
        let uvX = intersects[0].uv.x;
        let uvY = intersects[0].uv.y;
        const pixelX = Math.floor(uvX * textureWidth);
        const pixelY = Math.floor(uvY * textureHeight);
        const index = (pixelY * textureWidth + pixelX) * 4; // 4 components per pixel (R, G, B, A)
        // Retrieve RGB values from the sampled texture
        // const data = texture.image.data; // Assuming the texture is loaded as an ImageData
        const r = data[index] / 255; // Normalize to range [0, 1]
        const g = data[index + 1] / 255;
        const b = data[index + 2] / 255;

        // console.log(r, g, b);
        const curr_color = new THREE.Color();
        curr_color.r = r;
        curr_color.g = g;
        curr_color.b = b;
        curr_color.convertSRGBToLinear();

        // make hitpoint vis
        const geometry = new THREE.SphereGeometry(0.25, 25, 25);
        const material = new THREE.MeshBasicMaterial({ color: curr_color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(isect_pt.x, isect_pt.y, isect_pt.z);
        ep_debug_group.add(sphere);

        // color texture on view sphere
        let real_ind = Math.floor((i / 3) * 2); // forgot the *2
        let ctx_x = Math.floor(uvs_arr[real_ind] * texture_ctx.canvas.width);
        let ctx_y =
          texture_ctx.canvas.height -
          Math.floor(uvs_arr[real_ind + 1] * texture_ctx.canvas.height);
        texture_ctx.fillStyle = "#" + curr_color.getHexString(); // need hashtag!!!
        texture_ctx.fillRect(ctx_x, ctx_y, 3, 3);

        // shade perspective projection imaging plane
        const intersects_plane = rc.intersectObject(scene.children[0]); // hardcoded
        // console.log(intersects_plane);
        if (intersects_plane.length > 0) {
          // console.log(intersects_plane);
          let uvX = intersects_plane[0].uv.x;
          let uvY = intersects_plane[0].uv.y;
          const pixelX = Math.floor(uvX * texture_ctx_plane.canvas.width);
          const pixelY =
            texture_ctx_plane.canvas.height -
            Math.floor(uvY * texture_ctx_plane.canvas.height);
          texture_ctx_plane.fillStyle = "#" + curr_color.getHexString(); // need hashtag!!!
          // texture_ctx.fillStyle = "00FF00";
          texture_ctx_plane.fillRect(pixelX, pixelY, 10, 10);
        }
        // shade stereographic projection imaging plane
        let origin_stereographic = new THREE.Vector3(0, 0, 1); // hardcoded
        let dir_stereographic = curr_pos.sub(origin_stereographic).normalize();
        let rc_stereographic = new THREE.Raycaster(
          origin_stereographic,
          dir_stereographic,
        );
        const intersects_plane_stereographic = rc_stereographic.intersectObject(
          scene.children[1], // hardcoded
        );
        if (intersects_plane_stereographic.length > 0) {
          let isect_pt = intersects_plane_stereographic[0].point;
          const line_material = new THREE.LineBasicMaterial({
            color: 0x0000ff,
          });
          const points = [];
          points.push(origin_stereographic);
          points.push(isect_pt);
          const line_geometry = new THREE.BufferGeometry().setFromPoints(
            points,
          );
          const line = new THREE.Line(line_geometry, line_material);
          line_debug_group_stereographic.add(line);

          let uvX = intersects_plane_stereographic[0].uv.x;
          let uvY = intersects_plane_stereographic[0].uv.y;
          const pixelX = Math.floor(
            uvX * texture_ctx_plane_stereographic.canvas.width,
          );
          const pixelY =
            texture_ctx_plane_stereographic.canvas.height -
            Math.floor(uvY * texture_ctx_plane_stereographic.canvas.height);
          texture_ctx_plane_stereographic.fillStyle =
            "#" + curr_color.getHexString(); // need hashtag!!!
          // texture_ctx.fillStyle = "00FF00";
          texture_ctx_plane_stereographic.fillRect(pixelX, pixelY, 10, 10);
        }
      }
    }
    const geometry_stereographic_origin = new THREE.SphereGeometry(
      0.1,
      100,
      100,
    );
    const material_stereographic_origin = new THREE.MeshBasicMaterial({
      color: 0x0000ff,
    });
    const sphere_stereographic_origin = new THREE.Mesh(
      geometry_stereographic_origin,
      material_stereographic_origin,
    );
    sphere_stereographic_origin.position.z = 1;
    line_debug_group_stereographic.add(sphere_stereographic_origin);

    let lho = new MeshHelperOptions(line_debug_group, false);
    gui.add(lho, "visible").name("debug viewing sphere ray visibility");
    let eho = new MeshHelperOptions(ep_debug_group, false);
    gui.add(eho, "visible").name("debug endpoint visibility");
    let ppho = new MeshHelperOptions(plane, false);
    gui.add(ppho, "visible").name("perspective imaging plane visibility");
    let sho = new MeshHelperOptions(sphere, true);
    gui.add(sho, "visible").name("imaging sphere visibility");
    let spho = new MeshHelperOptions(plane_stereographic, false);
    gui.add(spho, "visible").name("stereographic imaging plane visibility");
    let lsho = new MeshHelperOptions(line_debug_group_stereographic, false);
    gui.add(lsho, "visible").name("debug stereographic ray visibility");
    scene.add(ep_debug_group);
    scene.add(line_debug_group);
    scene.add(line_debug_group_stereographic);
    scene.add(sphere);
    scene.add(axes);
    scene.add(grid);

    let texture_label = document.createElement("p");
    texture_label.textContent = "projected texture on viewing sphere";
    document.body.appendChild(texture_label);
    document.body.appendChild(texture_canvas);

    let texture_plane_label = document.createElement("p");
    texture_plane_label.textContent =
      "projected texture on perspective imaging plane";
    document.body.appendChild(texture_plane_label);
    document.body.appendChild(texture_canvas_plane);

    let texture_plane_stereographic_label = document.createElement("p");
    texture_plane_stereographic_label.textContent =
      "projected texture on stereographic imaging plane";
    document.body.appendChild(texture_plane_stereographic_label);
    document.body.appendChild(texture_canvas_plane_stereographic);
  },
  // called while loading is progressing
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  // called when loading has errors
  function (error) {
    console.log(error);
    console.log("An error happened");
  },
);
// console.log(scene.children);

camera.position.z = 5;
controls.update();

function animate() {
  texture.needsUpdate = true;
  texture_plane.needsUpdate = true;
  texture_plane_stereographic.needsUpdate = true;

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
