import { vertex, triangle, shape, sub_v, scale_v, add_v } from "./geom_obj.js";
import { t } from "./triangulate.js";
import { arrange_vertices, inside_polygon, make_id, random_color, make_shape_translation, distance, angle, make_shape_rotation, above } from "./geometry.js";
import { tri_to_parallel, par_to_rect, rect_to_sqr, combine_squares, transform_sc } from "./shape_dissections.js";
import { shape_collection, get_leaf_shapes, get_leaves_inverted, get_leaves_inverted_histories } from "./dissection_trees.js";
import { make_history_generator, create_synchronized_generators } from "./history_animations.js";


// TODO: make triangulation work for triangles
// TODO: daniel says add dummy vertices to make triangles more equal in area

var triangles = [];
var t_poly = new shape(random_color(), []);
let vertices = t_poly.v_list;
let t_sc = new shape_collection(t_poly, [], new make_id());
var radius = 1;
var test_quad = [];
var test_sc = new shape_collection(test_quad, [], new make_id());
var loaded_triangles = [];

async function loadVerticesFromJSON() {
  try {
    console.log("Loading vertices from JSON...");
    const response = await fetch('./lunar_moth_boundary_vertices.json');
    const data = await response.json();
    console.log("JSON data loaded:", data);
    test_quad = data.vertices.map(v => new vertex(v.color, v.x, v.y));
    console.log("Vertices created:", test_quad);
    
    // Create a shape object from the vertices
    let test_shape = new shape("red", test_quad);
    test_sc = new shape_collection(test_shape, [], new make_id());
    console.log("Shape collection created:", test_sc);
    return true;
  } catch (error) {
    console.error('Error loading vertices from JSON:', error);
    return false;
  }
}

async function loadTrianglesFromJSON() {
  try {
    console.log("Loading triangles from JSON...");
    const response = await fetch('./lunar_moth_triangles.json');
    const data = await response.json();
    console.log("Triangle data loaded:", data);
    
    // Convert triangles to the format expected by the rest of the code
    loaded_triangles = data.triangles.map(tri => {
      // Create vertices with red color (simple)
      const v1 = new vertex("red", tri.vertices[0].x, tri.vertices[0].y);
      const v2 = new vertex("red", tri.vertices[1].x, tri.vertices[1].y);
      const v3 = new vertex("red", tri.vertices[2].x, tri.vertices[2].y);
      
      // Create a triangle shape with random color
      const triangle_shape = new shape(random_color(), [v1, v2, v3]);
      
      return triangle_shape;
    });
    
    console.log("Triangles created:", loaded_triangles);
    return true;
  } catch (error) {
    console.error('Error loading triangles from JSON:', error);
    return false;
  }
}

function findMatchingVertex(x, y) {
  // Look for a vertex in test_quad that matches the given coordinates
  for (let i = 0; i < test_quad.length; i++) {
    const vertex = test_quad[i];
    if (Math.abs(vertex.x - x) < 1 && Math.abs(vertex.y - y) < 1) {
      return vertex;
    }
  }
  return null;
}

function processShapeCollection() {
  console.log("Processing shape collection, test_quad length:", test_quad.length);
  if (test_quad.length === 0) {
    console.log("No vertices loaded yet, skipping shape collection processing");
    return;
  }
  
  console.log("test_sc outer_shape:", test_sc.outer_shape);
  console.log("test_sc outer_shape.v_list:", test_sc.outer_shape.v_list);
  
  t_poly.v_list = vertices.concat(test_quad);
  vertices = vertices.concat(test_quad);
  let regions1 = tri_to_parallel(test_sc);
  let regions2 = par_to_rect(test_sc);
  let regions3 = rect_to_sqr(test_sc);
  let histories = get_leaves_inverted_histories(test_sc);
  draw_sc(test_sc);
  // draw_histories(histories[0], histories[1]);
  console.log(histories);
  myGameArea.update();
}

async function startGame() {
  await loadVerticesFromJSON();
  await loadTrianglesFromJSON();
  
  // Initialize vertices array with the loaded boundary vertices
  vertices = test_quad.slice(); // Make a copy
  t_poly.v_list = vertices;
  
  myGameArea.start();
  // Don't call processShapeCollection here - it should be called after triangulation
}

window.addEventListener("load", startGame);
let rm_btn = document.getElementById("remove");
let clr_btn = document.getElementById("clear");
let tri_btn = document.getElementById("triangulate");
rm_btn.addEventListener("click", remove);
clr_btn.addEventListener("click", clear_all);
tri_btn.addEventListener("click", triangulate);

let x_disp = document.getElementById("x");
let y_disp = document.getElementById("y");
let inside_disp = document.getElementById("inside");
let which_disp = document.getElementById("inside_which");

var myGameArea = {
  canvas: document.createElement("canvas"),
  start: function () {
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.context = this.canvas.getContext("2d");
    document.body.insertBefore(this.canvas, document.body.childNodes[0]);
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      var new_vertex = new vertex("red", x, y);
      vertices.push(new_vertex);
      if (vertices.length > 3) {
        vertices = arrange_vertices(vertices);
        t_poly.v_list = vertices;
      }
      this.update();
    });
    
    this.update(); // Draw the initial vertices
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Check if vertices array is valid and contains valid vertices
      if (vertices && vertices.length > 0 && vertices.every(v => v && v.x !== undefined && v.y !== undefined)) {
        let wn = inside_polygon(new vertex("red", x, y), vertices);
        inside_disp.innerHTML = wn.toString();
      } else {
        inside_disp.innerHTML = "N/A";
      }
      
      x_disp.innerHTML = x.toString() + ", ";
      y_disp.innerHTML = y.toString();
      
      // Check if t_sc is valid before calling inside_sc
      if (t_sc && t_sc.outer_shape) {
        which_disp.innerHTML = inside_sc(new vertex("red", x, y), t_sc).toString();
      } else {
        which_disp.innerHTML = "N/A";
      }
    });
  },
  clear: function () {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },
  update: function () {
    this.clear();
    if (vertices.length > 0) {
      // draw_vertices(vertices);  // Remove vertex drawing
      draw_edges(vertices);
    }
  }
}

function draw_histories(shapes, histories) {
  // Create the synchronized generator that advances all shapes together
  const synchronized_generator = create_synchronized_generators(shapes, histories);
  const synced_gen = synchronized_generator();
  
  function draw_generator_frames() {
    let ctx = myGameArea.context;
    
    const next_val = synced_gen.next();
    if (next_val.done) {
      return; // Animation is complete
    }
    
    const current_shapes = next_val.value;
    
    // Clear canvas and draw all shapes
    ctx.clearRect(0, 0, myGameArea.canvas.width, myGameArea.canvas.height);
    
    for (let i = 0; i < current_shapes.length; i++) {
      if (current_shapes[i]) {
        draw_poly(current_shapes[i]);
      }
    }
    
    window.requestAnimationFrame(draw_generator_frames);
  }
  
  window.requestAnimationFrame(draw_generator_frames);
}



function remove() {
  if (vertices.length > 0) {
    vertices.pop();
    myGameArea.clear();
  }
  myGameArea.update();
}

function clear_all() {
  t_poly.v_list = [];
  vertices = t_poly.v_list;
  myGameArea.update();
}

function triangulate() {
  console.log("triangulating");
  
  // Use the loaded triangles instead of computing triangulation
  if (loaded_triangles.length === 0) {
    console.error("No triangles loaded from JSON");
    return;
  }
  
  // Create shape collections for each triangle
  triangles = loaded_triangles;
  t_sc.child_regions = [];
  
  for (let i = 0; i < triangles.length; i++) {
    let triangle_shape = triangles[i];
    let triangle_sc = new shape_collection(triangle_shape, [], new make_id());
    t_sc.child_regions.push(triangle_sc);
  }
  
  console.log("Created", t_sc.child_regions.length, "triangle regions");
  console.log("Triangle colors:", triangles.map(t => t.color));
  
  // Continue with the dissection process
  for (let i = 0; i < t_sc.child_regions.length; i++) {
    let curr_region = t_sc.child_regions[i];
    tri_to_parallel(curr_region);
    par_to_rect(curr_region);
    rect_to_sqr(curr_region);
  }
  let num_regions = t_sc.child_regions.length;
  console.log(t_sc)
  for (let i = 0; i < num_regions-1; i++) {
    let reg1 = t_sc.child_regions.pop(0);
    let reg2 = t_sc.child_regions.pop(0);
    let new_region = combine_squares(reg1, reg2);
    t_sc.child_regions.push(new_region[0]);
  }
  console.log(t_sc);
  let outer_square = t_sc.child_regions[0].outer_shape;
  let canvas_center = new vertex("red", myGameArea.canvas.width/2, myGameArea.canvas.height/2);
  let sq_center = scale_v(add_v(outer_square.v_list[0], outer_square.v_list[2]), 0.5);
  let center_tr = new make_shape_translation(sub_v(canvas_center, sq_center));
  transform_sc(t_sc.child_regions[0], center_tr);
  outer_square = center_tr.tr(outer_square);
  let tar_corner = new vertex("red", 1 / Math.sqrt(2), 1 / Math.sqrt(2));
  let src_corner = sub_v(outer_square.v_list[0], canvas_center);
  let center_angle = angle(tar_corner, new vertex("red", 0, 0), src_corner);
  console.log("center angle", center_angle);
  if (above(new vertex("red", 0, 0), tar_corner, src_corner)) {
    center_angle *= -1;
  }
  let center_rot = new make_shape_rotation(canvas_center, center_angle);
  transform_sc(t_sc.child_regions[0], center_rot);
  let histories = get_leaves_inverted_histories(t_sc);
  let leaves = histories[0];
  let animations = histories[1];
  let maximum = -1;
  for(let i = 0; i < animations.length; i++) {
    if(animations[i].length > maximum) {
      maximum = animations[i].length;
    }
  }
  for(let i = 0; i < animations.length; i++) {
    for (let j = animations[i].length; j < maximum; j++) {
      animations[i].push(new make_id());
    }
  }
  draw_histories(leaves, animations);
}

// Utility functions for color averaging
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  return [
    parseInt(hex.substring(0,2), 16),
    parseInt(hex.substring(2,4), 16),
    parseInt(hex.substring(4,6), 16)
  ];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function averageColors(hexColors) {
  let rgbSum = [0, 0, 0];
  hexColors.forEach(hex => {
    let rgb = hexToRgb(hex);
    rgbSum[0] += rgb[0];
    rgbSum[1] += rgb[1];
    rgbSum[2] += rgb[2];
  });
  let n = hexColors.length;
  return rgbToHex(
    Math.round(rgbSum[0] / n),
    Math.round(rgbSum[1] / n),
    Math.round(rgbSum[2] / n)
  );
}

export { hexToRgb, rgbToHex, averageColors };

//drawing utilities

function draw_vertices(v) {
  if (v.length === 0) return;
  
  var ctx = myGameArea.context;
  for (var i = 0; i < v.length; i++) {
    ctx.beginPath();
    ctx.fillStyle = v[i].color;
    var vx = v[i].x;
    var vy = v[i].y;
    ctx.arc(vx, vy, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
}

function inside_sc(v, sc) {
  let leaves = get_leaf_shapes(sc);
  for (let i = 0; i < leaves.length; i++) {
    if (inside_polygon(v, leaves[i].v_list)) {
      return leaves[i].v_list.map((v) => { return "(" + v.x.toFixed(2) + "," + v.y.toFixed(2) + ")" });
    }
  }
  return -1;
}

function draw_sc(sc) {
  let leaves = get_leaf_shapes(sc);
  for (let i = 0; i < leaves.length; i++) {
    draw_poly(leaves[i]);
  }
}

function draw_sc_inv(sc) {
  let leaves = get_leaves_inverted(sc);
  for (let i = 0; i < leaves.length; i++) {
    draw_poly(leaves[i]);
  }
}

function draw_poly(shp) {
  // draw_vertices(shp.v_list);  // Remove vertex drawing
  draw_edges(shp.v_list, shp.color);
}

function draw_edges(v, color) {
  if (v.length === 0) return;
  
  var ctx = myGameArea.context;
  let start_x = v[0].x;
  let start_y = v[0].y;
  ctx.beginPath();
  ctx.moveTo(start_x, start_y);
  for (var i = 1; i < v.length; i++) {
    var vx = v[i].x;
    var vy = v[i].y;
    ctx.lineTo(vx, vy);
  }
  if (color) {
    ctx.fillStyle = color;
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.closePath();
    ctx.stroke();
  }
}
