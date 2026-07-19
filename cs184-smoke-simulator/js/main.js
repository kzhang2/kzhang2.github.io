import * as THREE from "three";
import { Solver } from "./solver.js"
import { SolverSphere } from "./solver_sphere.js"
import { SolverParametric } from "./solver_parametric.js"
import {ParametricGeometries} from "three/examples/jsm/geometries/ParametricGeometries.js";

let renderer;
let camera, scene;
let mesh, material, line_seg;

let canRotate = true;

let solver;

let width;
let height;

let mouseX, mouseY;

let isDrawingSmoke = false;
let isMovingCamera = false;
let canMoveCamera = true;

let solverPos;

let currTime;

let smokeColor;

let raycaster;

let settings;
let gui;

function mobius3d ( u, t, target ) {

    // volumetric mobius strip

    u *= Math.PI;
    t *= 2 * Math.PI;

    u = u * 2;
    var phi = u / 2;
    var major = 2.25, a = 0.125, b = 0.65;
    var scale = 5;

    var x, y, z;

    x = a * Math.cos( t ) * Math.cos( phi ) - b * Math.sin( t ) * Math.sin( phi );
    z = a * Math.cos( t ) * Math.sin( phi ) + b * Math.sin( t ) * Math.cos( phi );
    y = ( major + x ) * Math.sin( u );
    x = ( major + x ) * Math.cos( u );

    target.set( scale * x, scale * y, scale * z );

}

function torusParametric(u, v, target) {

    const r = 5.0;
    const R = 12.0;

    u = u * 2.0 * Math.PI;
    v = v * 2.0 * Math.PI;

    let x = r * Math.sin(v);
    let y = (R + r * Math.cos(v)) * Math.cos(u);
    let z = (R + r * Math.cos(v)) * Math.sin(u);

    target.set(x, y, z);

}

// Camera rotation stuff
let onPointerDownPointerX, onPointerDownPointerY, onPointerDownLon, onPointerDownLat;
let lon = 90, lat = 0;
let phi = 0, theta = 0;
let cameraDist;

function Settings() {
    // Radius of mouse click smoke
    this.smokeRadius = 0.2;

    this.randomColor = true;
    this.red = 0.80;
    this.green = 0.50;
    this.blue = 0.00;

    // Dissipation of smoke
    this.dissipation = 0.99;

    // vorticity rate
    this.vorticity = 0.2;

    // Wrap around up/down and left/right
    this.wrap = true;

    // wireframes
    this.wireframe = false;

    // Buoyancy
    this.buoyancy = false;
    this.buoyancyDirection = 90.0;
    
    // Object rendered
    this.objects = ["Sphere", "Plane", "Torus", "Planar Sphere", "Mobius Strip", "Klein Bottle", "Cube"];
    this.object = this.objects[0];

    // Rotation Speed
    this.rotx = 0.0;
    this.roty = 0.0;

}

function recreateSolver() {

    if (settings.object === "Sphere" || settings.object === "Cube") {

        const solverSize = 250;
        solver = new SolverSphere(renderer, solverSize);

    } else if (settings.object === "Parametric Torus (WIP)") {

        const solverHeight = 250;
        const solverWidth = Math.floor(solverHeight * width / height);
        solver = new SolverParametric(renderer, solverWidth, solverHeight);
 
    } else {

        const solverHeight = 250;
        const solverWidth = Math.floor(solverHeight * width / height);
        solver = new Solver(renderer, solverWidth, solverHeight, settings.wrap, settings.buoyancy, settings.buoyancyDirection);
    }

    solver.dissipation = settings.dissipation;
    solver.vorticityWeight = settings.vorticity;

}

function recreateScene() {

    if (settings.object === "Sphere") {

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        canMoveCamera = true;
        cameraDist = 20;
        camera.position.z = cameraDist;
        let geometry = new THREE.SphereGeometry(10, 32, 32);
        // let geometry = new THREE.BoxGeometry( 10, 10, 10 );
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        line_seg = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), lineMaterial);

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
        canRotate = false;
        
        scene = new THREE.Scene();
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }

        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -10.0;
        scene.add(grid);

    } else if (settings.object === "Torus") {

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        canMoveCamera = true;
        cameraDist = 30;
        camera.position.z = cameraDist;
        let geometry = new THREE.TorusGeometry(12, 5, 48, 100);
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        line_seg = new THREE.LineSegments( new THREE.WireframeGeometry(geometry), lineMaterial );
        material = new THREE.MeshBasicMaterial({map: solver.getTexture()})
        mesh = new THREE.Mesh(geometry, material);
        canRotate = true;

        scene = new THREE.Scene();
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }

        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -17.0;
        scene.add(grid);

    } else if (settings.object === "Parametric Torus (WIP)") {

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        canMoveCamera = true;
        cameraDist = 30;
        camera.position.z = cameraDist;
        let geometry = new THREE.ParametricGeometry(torusParametric, 100, 48); //new THREE.TorusGeometry(12, 5, 48, 100);
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        line_seg = new THREE.LineSegments( new THREE.WireframeGeometry(geometry), lineMaterial );
        material = new THREE.MeshBasicMaterial({map: solver.getTexture()})
        mesh = new THREE.Mesh(geometry, material);
        canRotate = true;

        scene = new THREE.Scene();
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }

        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -17.0;
        scene.add(grid);

    } else if (settings.object === "Plane") {

        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        canMoveCamera = false;
        let geometry = new THREE.PlaneGeometry(2, 2);
        material = new THREE.MeshBasicMaterial({map: solver.getTexture()})
        mesh = new THREE.Mesh(geometry, material);
        canRotate = false;
        scene = new THREE.Scene();
        scene.add(mesh);

    } else if (settings.object == "Mobius Strip") {
      
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 20;
        cameraDist = 20;
        let geometry = new THREE.ParametricGeometry( mobius3d, 25, 25 );
        material = new THREE.MeshBasicMaterial({map: solver.getTexture()})
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        // material = new THREE.MeshBasicMaterial({ color: 0x00ff00 } )
        mesh = new THREE.Mesh(geometry,material);
        line_seg = new THREE.LineSegments( new THREE.WireframeGeometry(geometry), lineMaterial );
        canRotate = true;

        scene = new THREE.Scene();
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }
        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -10.0;
        scene.add(grid);
      
    } else if (settings.object === "Klein Bottle") {

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 20;
        cameraDist = 20;
        let geometry = new THREE.ParametricGeometry( ParametricGeometries.klein, 25, 25 );
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        material = new THREE.MeshBasicMaterial({map: solver.getTexture()})
        mesh = new THREE.Mesh(geometry, material);
        scene = new THREE.Scene();
        line_seg = new THREE.LineSegments( new THREE.WireframeGeometry(geometry), lineMaterial );
        canRotate = true;
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }
        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -10.0;
        scene.add(grid);
      
    } else if (settings.object === "Cube") {
      
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        canMoveCamera = true;
        cameraDist = 20;
        camera.position.z = cameraDist;
        // let geometry = new THREE.SphereGeometry(10, 32, 32);
        let geometry = new THREE.BoxGeometry( 10, 10, 10 );
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        line_seg = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), lineMaterial);

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
        canRotate = false;
        
        scene = new THREE.Scene();
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }

        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -10.0;
        scene.add(grid);
      
    }else if (settings.object === "Planar Sphere") {

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 20;
        cameraDist = 20;
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } );
        let geometry = new THREE.SphereGeometry( 10, 32, 32 );
        line_seg = new THREE.LineSegments( new THREE.WireframeGeometry(geometry), lineMaterial );
        material = new THREE.MeshBasicMaterial({map: solver.getTexture()})
        mesh = new THREE.Mesh(geometry, material);
        canRotate = false;
        scene = new THREE.Scene();
        scene.add(mesh);
        if (settings.wireframe) {
            scene.add(line_seg);
        }
        scene.background = new THREE.Color(0xeeeeee);

        let grid = new THREE.GridHelper(60, 15);
        grid.position.y = -10.0;
        scene.add(grid);
        
    }

    lon = 90;
    lat = 0;
    phi = 0; 
    theta = 0;
    
}

let currObject;

function init() {

    width = document.getElementById('topnav').offsetWidth;
    height = window.innerHeight - document.getElementById('topnav').offsetHeight;;

    renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    document.getElementById("smoke").appendChild(renderer.domElement);

    // Create a GUI with object settings of defaults
    gui = new dat.GUI();
    settings = new Settings();
    
    currObject = settings.object;

    gui.add(settings, "object", settings.objects).onChange(function(object) {
        settings.object = object;
        if (((currObject === "Sphere" || currObject === "Cube") && (object !== "Sphere" && object !== "Cube"))
            || ((currObject !== "Sphere" && currObject !== "Cube") && (object === "Sphere" || object === "Cube"))) {
            recreateSolver();
        }
        currObject = object;
        recreateScene();
    });

    gui.add(settings, "smokeRadius", 0.01, 0.50, 0.01);

    gui.add(settings, "randomColor").onChange(function(randomColor) {
        settings.randomColor = randomColor;
    });
    gui.add(settings, "red", 0.00, 1.00, 0.01);
    gui.add(settings, "green", 0.00, 1.00, 0.01);
    gui.add(settings, "blue", 0.00, 1.00, 0.01);

    gui.add(settings, "dissipation", 0.95, 1.00, 0.005).onChange(function(dissipation) {
        settings.dissipation = dissipation;
        solver.dissipation = dissipation;
    });

    gui.add(settings, "vorticity", 0.0, 0.5, 0.01).onChange(function(vorticity) {
        settings.vorticity = vorticity;
        solver.vorticityWeight = vorticity;
    });

    gui.add(settings, "rotx", 0.0, 2.0, 0.05);
    gui.add(settings, "roty", 0.0, 2.0, 0.05);
    
    
    gui.add(settings, "wrap").onChange(function(wrap) {
        settings.wrap = wrap;
        recreateSolver();
    });

    gui.add(settings, "wireframe").onChange(function(wireframe) {
        settings.wireframe = wireframe;
        if (wireframe) {
            scene.add(line_seg);
        } else {
            scene.remove(line_seg);
        }
    });

    gui.add(settings, "buoyancy").onChange(function(buoyancy) {
        settings.buoyancy = buoyancy;
        solver.shouldAddBuoyancy = buoyancy;
    });
    gui.add(settings, "buoyancyDirection", 0.0, 360.0, 10.0).onChange(function(buoyancyDirection) {
        solver.buoyancyDirection = buoyancyDirection;
    });

    // create solver and scene
    recreateSolver();
    recreateScene();

    // set up mouse interactions
    raycaster = new THREE.Raycaster();

    mouseX = 0.0;
    mouseY = 0.0;

    solverPos = getSolverPos(mouseX, mouseY);

    currTime = 1.0;

    smokeColor = new THREE.Vector3(1.0, 1.0, 1.0);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

}

function onWindowResize() {

    width = document.getElementById('topnav').offsetWidth;
    height = window.innerHeight - document.getElementById('topnav').offsetHeight;;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

}

function onMouseDown(e) {

    mouseX = e.offsetX;
    mouseY = e.offsetY;
    
    if (e.button == 0) {
        solverPos = getSolverPos(mouseX, mouseY);
        isDrawingSmoke = (solverPos != null);
        isMovingCamera = !isDrawingSmoke && canMoveCamera;
    }

    if (isMovingCamera) {
        onPointerDownPointerX = e.clientX;
        onPointerDownPointerY = e.clientY;
    
        onPointerDownLon = lon;
        onPointerDownLat = lat;
    }

}

function onMouseMove(e) {

    mouseX = e.offsetX;
    mouseY = e.offsetY;

    if (isMovingCamera) {
        lon = (e.clientX - onPointerDownPointerX) * 0.2 + onPointerDownLon;
        lat = (e.clientY - onPointerDownPointerY) * 0.2 + onPointerDownLat;
    }

}

function onMouseUp(e) {

    mouseX = e.offsetX;
    mouseY = e.offsetY;

    if (e.button == 0) {
        isDrawingSmoke = false;
        isMovingCamera = false;
    } 

}

// function onContextMenu(e) {
//     e.preventDefault();
// }

function getSolverPos(mouseX, mouseY) {

    let startX = (mouseX / width) * 2 - 1;
    let startY = -(mouseY / height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(startX, startY), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (settings.object == "Sphere" || settings.object == "Cube") {

        for (let intersect of intersects) {
            if (intersect.object === mesh && intersect.point) {
                const point = intersect.point;
                const length = point.length();
                return new THREE.Vector3(point.x / length, point.y / length, point.z / length);
            }
        }

    } else {

        for (let intersect of intersects) {
            if (intersect.object === mesh && intersect.uv) {
                const uv = intersect.uv;
                return new THREE.Vector2(uv.x, uv.y);
            }
        }

    }
    return null;

}

function getSolverVelocity(pos, prevPos) {

    if (settings.object == "Sphere" || settings.object == "Cube") {

        return new THREE.Vector3(pos.x - prevPos.x, pos.y - prevPos.y, pos.z - prevPos.z);

    } else {

        if (settings.wrap) {
            let dX = pos.x - prevPos.x;
            if (Math.abs(dX) > 0.5) {
                dX = -Math.sign(dX) * (1.0 - Math.abs(dX));
            }
            let dY = pos.y - prevPos.y;
            if (Math.abs(dY) > 0.5) {
                dY = -Math.sign(dY) * (1.0 - Math.abs(dY));
            }
            return new THREE.Vector2(dX, dY);
        }
    
        return new THREE.Vector2(pos.x - prevPos.x, pos.y - prevPos.y);

    }

}

function animate(time) {
    
    let deltaTime = time - currTime;
    currTime = time;

    if (isMovingCamera) {

        lat = Math.max(-85, Math.min(85, lat));
        phi = THREE.MathUtils.degToRad(90 - lat);
        theta = THREE.MathUtils.degToRad(lon);
    
        camera.position.x = cameraDist * Math.sin(phi) * Math.cos(theta);
        camera.position.y = cameraDist * Math.cos(phi);
        camera.position.z = cameraDist * Math.sin(phi) * Math.sin(theta);
    
        camera.lookAt(scene.position);
        
    } 
    
    if (isDrawingSmoke) {

        let newSolverPos = getSolverPos(mouseX, mouseY);
        if (newSolverPos != null) {
            solver.addExternalDensity(newSolverPos, smokeColor, settings.smokeRadius);
            solver.addExternalTemperature(newSolverPos, 0.05, settings.smokeRadius);

            if (solverPos != null) {
                const vel = getSolverVelocity(newSolverPos, solverPos);
                solver.addExternalVelocity(newSolverPos, vel, settings.smokeRadius);
            }

        } else {
            solver.removeExternalDensity();
            solver.removeExternalTemperature();
            solver.removeExternalVelocity();
        }
        solverPos = newSolverPos;
        
    } else {
        solver.removeExternalDensity();
        solver.removeExternalTemperature();
        solver.removeExternalVelocity();
    }

    if (settings.randomColor) {
        smokeColor.x = Math.min(Math.max(smokeColor.x + (Math.random() - 0.5) * 0.15, 0.0), 1.0);
        smokeColor.y = Math.min(Math.max(smokeColor.y + (Math.random() - 0.5) * 0.15, 0.0), 1.0);
        smokeColor.z = Math.min(Math.max(smokeColor.z + (Math.random() - 0.5) * 0.15, 0.0), 1.0);
    } else {
        smokeColor.x = settings.red;
        smokeColor.y = settings.green;
        smokeColor.z = settings.blue;
    }

    solver.step(time);
  
    if (canRotate && settings.roty != 0.0) {
        mesh.rotation.y += settings.roty * deltaTime / 5000.0;
        line_seg.rotation.y += settings.roty * deltaTime / 5000.0;
    }
    if (canRotate && settings.rotx != 0.0) {
        mesh.rotation.x += settings.rotx * deltaTime / 5000.0;
        line_seg.rotation.x += settings.rotx * deltaTime / 5000.0;
    }
    
    if (settings.object === "Sphere" || settings.object == "Cube") {
        material.uniforms.map.value = solver.getTexture();
    } else {
        material.setValues({map: solver.getTexture()});
    }
    
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    
    requestAnimationFrame(animate);

}

export { init, animate };
