import * as THREE from "three";

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { SolverSphere } from "./solver_sphere.js"

let renderer;
let camera, scene;
let mesh, material;

let solver;

let mouse0Down;
let mouse1Down;
let mouseX, mouseY;

let solverPos;
let prevSolverPos;

let currTime;
let prevTime;

let smokeColor;
let smokeRadius;

let raycaster;

function init() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer = new THREE.WebGLRenderer();

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    document.body.appendChild(renderer.domElement);

    const solverSize = 250;

    solver = new SolverSphere(renderer, solverSize);

    let geometry;
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.z = 30;
    geometry = new THREE.SphereGeometry(10, 32, 32);

    material = new THREE.ShaderMaterial({
        uniforms: { map: { } },
        vertexShader: `
        varying vec3 v_position;
        void main() {
            v_position = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
        `,
        fragmentShader: `
        varying vec3 v_position;
        uniform samplerCube map;
        void main() {
            vec3 normal = normalize(v_position);
            vec3 color = textureCube(map, normal).xyz * 1.0;
            gl_FragColor = vec4(color, 1.0);
        }
        `
    })
    mesh = new THREE.Mesh(geometry, material);
    
    scene = new THREE.Scene();
    scene.add(mesh);

    scene.background = new THREE.Color( 0xeeeeee );

    let grid = new THREE.GridHelper(40, 10);
    grid.position.y = -10.0;
    scene.add(grid);

    mouse0Down = false;
    mouse1Down = false;
    mouseX = 0.0;
    mouseY = 0.0;

    solverPos = new THREE.Vector2();
    prevSolverPos = new THREE.Vector2();

    currTime = 1.0;
    prevTime = 0.0;

    raycaster = new THREE.Raycaster();

    smokeColor = new THREE.Vector3(1.0, 1.0, 1.0);
    smokeRadius = 0.005;

    let controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 20;
    controls.maxDistance = 70;
    
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    // window.addEventListener('mousedown', onMouseDown);
    // window.addEventListener('mouseup', onMouseUp);

    window.addEventListener('keydown', onMouseDown);
    window.addEventListener('keyup', onMouseUp);

    // document.addEventListener("contextmenu", onContextMenu, false);

}

function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

}

function onMouseDown(e) {

    // mouseX = e.offsetX;
    // mouseY = e.offsetY;
    
    // if (e.button == 0) {
    //     mouse0Down = true;
    // } 
    // if (e.button == 2) {
    //     mouse1Down = true
    // }

    if (e.key == 'd') {
        mouse0Down = true;
    } 
    if (e.key == 'f') {
        mouse1Down = true
    }
    
}

function onMouseMove(e) {

    mouseX = e.offsetX;
    mouseY = e.offsetY;

}

function onMouseUp(e) {

    // if (e.button == 0) {
    //     mouse0Down = false;
    //     solver.removeExternalDensity();
    // } 
    // if (e.button == 2) {
    //     mouse1Down = false;
    //     solver.removeExternalVelocity();
    // }

    if (e.key == 'd') {
        mouse0Down = false;
        solver.removeExternalDensity();
    } 
    if (e.key == 'f') {
        mouse1Down = false;
        solver.removeExternalVelocity();
    }

}

function onContextMenu(e) {
    e.preventDefault();
}

function getSolverPos(mouseX, mouseY) {

    let startX = (mouseX / window.innerWidth) * 2 - 1;
    let startY = -(mouseY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(startX, startY), camera);
    const intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0 && intersects[0].point) {
        const point = intersects[0].point;
        const length = point.length();
        return new THREE.Vector3(point.x / length, point.y / length, point.z / length);
    } else {
        return null;
    }

    if (false) {
        return new THREE.Vector2(mouseX / window.innerWidth, 1.0 - mouseY / window.innerHeight);
    }

}

function getSolverVelocity(pos, prevPos) {

    return new THREE.Vector3(pos.x - prevPos.x, pos.y - prevPos.y, pos.z - prevPos.z);

}

function animate(time) {
    
    prevTime = currTime;
    currTime = time;

    prevSolverPos = solverPos;
    let newSolverPos = getSolverPos(mouseX, mouseY);
    if (newSolverPos != null) {
        solverPos = newSolverPos;
        if (mouse0Down) {
            solver.addExternalDensity(solverPos, smokeColor, smokeRadius);
        }
        if (mouse1Down) {
            const vel = getSolverVelocity(solverPos, prevSolverPos);
            solver.addExternalVelocity(solverPos, vel, smokeRadius);
        }
    } else {
        solver.removeExternalDensity();
        solver.removeExternalVelocity();
    } 

    smokeColor.x = Math.min(Math.max(smokeColor.x + (Math.random() - 0.5) * 0.1, 0.0), 1.0);
    smokeColor.y = Math.min(Math.max(smokeColor.y + (Math.random() - 0.5) * 0.1, 0.0), 1.0);
    smokeColor.z = Math.min(Math.max(smokeColor.z + (Math.random() - 0.5) * 0.1, 0.0), 1.0);

    solver.step(time);
    
    material.uniforms.map.value = solver.getTexture();
    
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    
    requestAnimationFrame(animate);

}

export { init, animate };