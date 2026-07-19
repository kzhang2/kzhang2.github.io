// Polyfill for window object (if needed)
// actual hacks LMAO 
// actually shocked i managed to come up with the below
// with the help of chatgpt and reverse engineering GLTFExporter.js
global.window = global;

// Mock implementation of FileReader (if needed)
class FileReader {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.onloadend = null;
    }
  
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(
            (arrayBuffer) => {
                this.result = arrayBuffer;
                this.onloadend();
            }
        )
    }
  }
  
global.FileReader = FileReader;

async function saveBufferToFile(buffer, filePath) {
    // console.log("saving");
    try {
      await fs.writeFile(filePath, buffer);
      console.log(`File saved to ${filePath}`);
    } catch (error) {
      console.error('Error saving Buffer to file:', error);
    }
  }

// Import the entire THREE library from the CDN
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import fs from 'fs/promises';

console.log("hello world");

// let dataJson = await fetch("./data_for_three.json").then((response) => response.json());
import data_json from './data_for_three.json' assert { type: 'json' };
let data = data_json["data"];
// let data = dataJson["data"]

// hardcoded params 
const scale = 1; 
// const img_w = 4032;
// const img_h = 3024; 
const img_w = 3024;
const img_h = 4032;
// const occ_w = img_w / img_h * scale; 
// const occ_h = 1.0 * scale;

// const grid_len = 50;
const material = new THREE.MeshStandardMaterial({color: 0xFFFFFF});
for (let i = 0; i < data.length; i++) {
    const scene = new THREE.Scene();
    // console.log(data[i]);
    let angle = data[i]["light_angle"];
    let offset = data[i]["light_offset"];
    let projected_circle_points = data[i]["projected_circle_points"];
    let projected_grid_points = data[i]["projected_grid_points"];

    for (let j = 0; j < projected_grid_points.length; j++) {
        console.log(j);
        // create geometry
        let curr_grid_pts = projected_grid_points[j];
        let curr_circle_pts = projected_circle_points[j];
        let grid_shape_pts = [] 
        let circle_shape_pts = []
        for (let k = 0; k < curr_grid_pts.length; k++) {
        grid_shape_pts.push(new THREE.Vector2(curr_grid_pts[k][0], curr_grid_pts[k][1]));
        }
        for (let k = 0; k < curr_circle_pts.length; k++) {
        circle_shape_pts.push(new THREE.Vector2(curr_circle_pts[k][0], curr_circle_pts[k][1]))
        }
        let curr_grid_shape = new THREE.Shape(grid_shape_pts);
        let curr_circle_shape = new THREE.Shape(circle_shape_pts);
        const grid_geometry = new THREE.ShapeGeometry(curr_grid_shape);
        const circle_geometry = new THREE.ShapeGeometry(curr_circle_shape);
        const circleBrush = new Brush(circle_geometry)
        const gridBrush = new Brush(grid_geometry)
        const evaluator = new Evaluator();
        const currTile = evaluator.evaluate(gridBrush, circleBrush, SUBTRACTION);
        currTile.material = material 
        currTile.receiveShadow = false;
        currTile.castShadow = true; 

        // do transformation
        currTile.position.z = 1;
        currTile.position.applyAxisAngle(new THREE.Vector3(0.0, 1.0, 0.0), angle);
        currTile.position.x += offset[0];
        currTile.position.y += offset[1];
        currTile.position.z += offset[2];
        currTile.rotation.y = angle;   
        scene.add(currTile);

        // old debug code 
        // break;
    }
    const exporter = new GLTFExporter();
    exporter.parse(
        scene,
        // called when the gltf has been generated
        function ( gltf ) {
            console.log( gltf );
            // let blob = new Blob([gltf], { type: 'application/octet-stream' });
            const buffer = Buffer.from(gltf);
            saveBufferToFile(buffer, `./scene_${i}.glb`);
        },
        // called when there is an error in the generation
        function ( error ) {
            console.log(error);
            console.log( 'An error happened' );
    
        },
      { binary: true }
    );
    // break;
}



// console.log("test")

  // break