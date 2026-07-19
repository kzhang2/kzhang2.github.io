import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'lil-gui';

// Define your R2 bucket base URL
const R2_BUCKET_URL = 'https://pub-95935b9b2f6c42acbc226fe7e2afe83d.r2.dev';

// Initialize the loading counter
let totalModelsToLoad = 0;
let loadedModels = 0;

// Show loading status
function updateLoadingStatus() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const loadButton = document.getElementById('loadButton');
  
  if (loadingIndicator) {
    loadingIndicator.textContent = `Loading: ${loadedModels}/${totalModelsToLoad} models loaded`;
  }
  
  // If all models are loaded, show the download button and update status
  if (loadedModels === totalModelsToLoad && totalModelsToLoad > 0) {
    const downloadButton = document.getElementById('dl');
    if (downloadButton) {
      downloadButton.classList.remove('hidden');
    }
    
    if (loadingIndicator) {
      loadingIndicator.textContent = 'All models loaded!';
    }
    
    if (loadButton) {
      loadButton.textContent = 'Loading Complete';
      loadButton.style.backgroundColor = '#4A90E2'; // Change to blue to indicate completion
    }
  }
}

// Load the data and initialize everything
async function init() {
  // Modify this to load from R2 instead of local file
  let dataJsonResponse = await fetch(`${R2_BUCKET_URL}/data_for_three_short.json`);
  let dataJson = await dataJsonResponse.json();
  let data = dataJson["data"];
  console.log(data);
  
  // Update the total models to load count
  totalModelsToLoad = data.length;
  updateLoadingStatus();

  const gui = new GUI({ 
    container: document.getElementById('threeContainer'),
    autoPlace: true,
    width: 250
  });
  // Position the GUI below the status bar
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.top = '10px';
  gui.domElement.style.right = '10px';
  function makeAxisGrid(node, label, units) {
    const helper = new AxisGridHelper(node, units);
    gui.add(helper, 'visible').name(label);
  }

  class AmbientLightOptions {
    constructor(ambientLight) {
      this.ambientLight = ambientLight;
      this.intensity = 0.01;
    }
    get intensity() {
      return this._intensity;
    }
    set intensity(v) {
      this._intensity = v;
      this.ambientLight.intensity = this.intensity;
    }
  }

  class LightHelperOptions {
    constructor() {
      this.lightHelpers = new Array();
      this.visible = false; 
    }

    addLight(lightHelper) {
      this.lightHelpers.push(lightHelper);
    }

    get visible() {
      return this._visible;
    }

    set visible(v) {
      this._visible = v;
      console.log(this.lightHelpers);
      for (let i = 0; i < this.lightHelpers.length; i++) {
        this.lightHelpers[i].visible = v;
      }
    }
  }

  class AxisGridHelper {
    constructor(node, units = 10) {
      const axes = new THREE.AxesHelper();
      axes.material.depthTest = false;
      axes.renderOrder = 2;  // after the grid
      node.add(axes);
   
      const grid = new THREE.GridHelper(units, units);
      grid.material.depthTest = false;
      grid.renderOrder = 1;
      node.add(grid);
   
      this.grid = grid;
      this.axes = axes;
      this.visible = false;
    }
    get visible() {
      return this._visible;
    }
    set visible(v) {
      this._visible = v;
      this.grid.visible = v;
      this.axes.visible = v;
    }
  }

  // hardcoded params 
  const scale = 1; 
  const img_w = 3024;
  const img_h = 4032;
  const occ_w = img_w / img_h * scale; 
  const occ_h = 1.0 * scale;

  const grid_len = 50;

  // initialize scene
  const scene = new THREE.Scene();
  
  // Calculate proper aspect ratio based on container size
  const containerHeight = window.innerHeight - 50; // Subtract status bar height
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / containerHeight, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.setSize(window.innerWidth, containerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('threeContainer').appendChild(renderer.domElement);
  
  // Handle window resize to maintain aspect ratio
  window.addEventListener('resize', function() {
    const newContainerHeight = window.innerHeight - 50;
    camera.aspect = window.innerWidth / newContainerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, newContainerHeight);
  });

  const controls = new OrbitControls(camera, renderer.domElement);

  // make occluder
  const material = new THREE.MeshStandardMaterial({color: 0xFFFFFF});
  material.shadowSide = THREE.DoubleSide;
  material.side = THREE.DoubleSide;
  let ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.01);
  let alo = new AmbientLightOptions(ambientLight);
  scene.add(ambientLight);
  let lho = new LightHelperOptions();
  console.log(lho);

  for (let i = 0; i < data.length; i++) {
    console.log(data[i]);
    let angle = data[i]["light_angle"];
    let offset = data[i]["light_offset"];
    let path = data[i]["scene_path"];

    let color;
    if (i == 0){
      color = 0xFF0000;
    } else if (i == 1){
      color = 0x00FF00;
    } else if (i == 2) {
      color = 0x0000FF;
    } 
      
    const intensity = 1000;
    const light = new THREE.SpotLight(color, intensity, 0, Math.PI/12);
    light.position.set(offset[0], offset[1], offset[2]);
    light.castShadow = true;
    light.shadow.mapSize.setScalar(4096);
    light.shadow.bias = 1e-5;
    light.shadow.normalBias = 1e-2;
    scene.add(light);
    const lightHelper = new THREE.SpotLightHelper(light);
    lightHelper.visible = false;
    scene.add(lightHelper);

    lho.addLight(lightHelper);

    const loader = new GLTFLoader();
    // Modify the path to use the R2 bucket URL
    const r2FilePath = `${R2_BUCKET_URL}/${path}`;
    
    loader.load(
      // Use the R2 URL instead of local path
      r2FilePath,
      // called when the resource is loaded
      function (gltf) {
        console.log(gltf);
        let children = gltf.scene.children;
        let display_mesh = children[0].children[0]; // hacky

        const tileMaterial = new THREE.MeshPhongMaterial({color: 0xFFFFFF});
        tileMaterial.shadowSide = THREE.DoubleSide;
        tileMaterial.side = THREE.DoubleSide;

        display_mesh.material = tileMaterial;
        display_mesh.castShadow = true;
        display_mesh.side = THREE.DoubleSide;
        display_mesh.shadowSide = THREE.DoubleSide;
        display_mesh.receiveShadow = true; 
        display_mesh.position.z = 1;
        display_mesh.position.applyAxisAngle(new THREE.Vector3(0.0, 1.0, 0.0), angle);
        display_mesh.position.x += offset[0];
        display_mesh.position.y += offset[1];
        display_mesh.position.z += offset[2];
        display_mesh.rotation.y = angle;   
        console.log(display_mesh);
        scene.add(display_mesh);
        
        // Increment loaded models count and update status
        loadedModels++;
        updateLoadingStatus();
      },
      // called while loading is progressing
      function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      // called when loading has errors
      function (error) {
        console.log('An error happened loading', r2FilePath, error);
        // Increment counter even on error to avoid getting stuck
        loadedModels++;
        updateLoadingStatus();
      }
    );
  }

  gui.add(lho, 'visible').name("light visualizations");
  gui.add(alo, 'intensity').name("ambient light level");

  // make screen 
  const geometry = new THREE.PlaneGeometry(5.0, 5.0);
  const material1 = new THREE.MeshStandardMaterial({color: 0xFFFFFF, side: THREE.DoubleSide,});
  material1.shadowSide = THREE.BackSide;
  material1.side = THREE.BackSide;
  const backPlane = new THREE.Mesh(geometry, material1);
  backPlane.castShadow = true;
  backPlane.receiveShadow = true;
  scene.add(backPlane);

  // update camera
  camera.position.z = -5;
  controls.update();

  // debug visualizations
  makeAxisGrid(backPlane, "backPlane");

  const exporter = new GLTFExporter();

  exporter.parse(
    scene,
    // called when the gltf has been generated
    function (gltf) {
      console.log(gltf);
      let blob = new Blob([gltf], { type: 'application/octet-stream' });
      let dl = document.getElementById("dl");
      dl.href = window.URL.createObjectURL(blob);
      dl.download = "scene.glb";
    },
    // called when there is an error in the generation
    function (error) {
      console.log('An error happened');
    },
    { binary: true }
  );

  // render
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

// Start the initialization process
init();