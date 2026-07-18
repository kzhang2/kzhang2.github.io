import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createDefaultTarget, optimizeSchedule, sampleCanvas } from "./optimizer.js";

const TEXTURE_SIZE = 32;
const OPTIMIZER_GRID_SIZE = 64;
const MAX_IMPACTS = 128;
const CACHE_KEY = "raindrop-display-cache-v1";
const DEFAULT_OFFLINE_SOLVE_URL = "./solver_output_med_cat/schedule.json";

const config = {
  period: 4,
  snapshotPhase: 0.5,
  maxImpacts: 128,
  damping: 0.25,
  waveSpeed: 0.34,
  impulseWidth: 0.04,
  angularFrequency: 38,
  regularization: 0.05,
  minAmplitude: 0.01,
  phaseSamples: 18,
  slowZoneWidth: 0.18,
  slowStrength: 0.65,
  viewMode: "surface",
  showMarkers: true,
  autoplay: true,
  manualPhase: 0,
};

const dom = {
  canvas: document.querySelector("#scene"),
  overlay: document.querySelector("#overlay"),
  targetPreview: document.querySelector("#targetPreview"),
  period: document.querySelector("#period"),
  snapshot: document.querySelector("#snapshot"),
  impacts: document.querySelector("#impacts"),
  damping: document.querySelector("#damping"),
  wavespeed: document.querySelector("#wavespeed"),
  slowWidth: document.querySelector("#slowWidth"),
  slowStrength: document.querySelector("#slowStrength"),
  periodValue: document.querySelector("#periodValue"),
  snapshotValue: document.querySelector("#snapshotValue"),
  impactsValue: document.querySelector("#impactsValue"),
  dampingValue: document.querySelector("#dampingValue"),
  wavespeedValue: document.querySelector("#wavespeedValue"),
  slowWidthValue: document.querySelector("#slowWidthValue"),
  slowStrengthValue: document.querySelector("#slowStrengthValue"),
  viewMode: document.querySelector("#viewMode"),
  showMarkers: document.querySelector("#showMarkers"),
  resetCamera: document.querySelector("#resetCamera"),
  autoplay: document.querySelector("#autoplay"),
  phaseControl: document.querySelector("#phaseControl"),
  phaseControlValue: document.querySelector("#phaseControlValue"),
  imageUpload: document.querySelector("#imageUpload"),
  offlineUpload: document.querySelector("#offlineUpload"),
  recompute: document.querySelector("#recompute"),
  clearCache: document.querySelector("#clearCache"),
  phaseLabel: document.querySelector("#phaseLabel"),
  errorLabel: document.querySelector("#errorLabel"),
  activeLabel: document.querySelector("#activeLabel"),
};

const gl = dom.canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false });
if (!gl) {
  throw new Error("WebGL2 is required for this prototype.");
}

const quadBuffer = createFullscreenQuad(gl);
const threeState = createThreeScene();

const program = createProgram(
  gl,
  `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;
  void main() {
    v_uv = 0.5 * (a_position + 1.0);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }`,
  `#version 300 es
  precision highp float;

  in vec2 v_uv;
  out vec4 outColor;

  uniform sampler2D u_targetTexture;
  uniform sampler2D u_reconstructionTexture;
  uniform int u_viewMode;
  uniform float u_snapshotPhase;
  uniform float u_loopPhase;
  uniform float u_period;
  uniform float u_damping;
  uniform float u_waveSpeed;
  uniform float u_impulseWidth;
  uniform float u_angularFrequency;
  uniform float u_viewAspect;
  uniform int u_impactCount;
  uniform vec4 u_impacts[${MAX_IMPACTS}];

  vec3 palette(float t) {
    vec3 deep = vec3(0.02, 0.08, 0.12);
    vec3 mid = vec3(0.12, 0.45, 0.58);
    vec3 light = vec3(0.90, 0.97, 1.0);
    return mix(mix(deep, mid, smoothstep(0.18, 0.7, t)), light, smoothstep(0.65, 1.0, t));
  }

  vec3 proximityPalette(float closeness) {
    vec3 farColor = vec3(0.95, 0.47, 0.22);
    vec3 nearColor = vec3(0.20, 0.57, 0.98);
    return mix(farColor, nearColor, closeness);
  }

  float wrappedPhaseDistance(float a, float b) {
    float delta = abs(a - b);
    return min(delta, 1.0 - delta);
  }

  float phaseDelta(float nowPhase, float eventPhase) {
    return nowPhase >= eventPhase ? nowPhase - eventPhase : nowPhase + 1.0 - eventPhase;
  }

  float circularWave(vec2 uv, vec4 impact) {
    float dt = phaseDelta(u_loopPhase, impact.z) * u_period;
    float radius = length(uv - impact.xy);
    float front = u_waveSpeed * dt;
    float ring = exp(-pow(radius - front, 2.0) / max(0.0001, 2.0 * u_impulseWidth * u_impulseWidth));
    float oscillation = cos(u_angularFrequency * (radius - front));
    float damping = exp(-u_damping * dt);
    return impact.w * damping * ring * oscillation;
  }

  vec2 screenToFieldUv(vec2 uv, float aspect) {
    vec2 fieldUv = uv;
    if (aspect > 1.0) {
      fieldUv.x = (uv.x - 0.5) * aspect + 0.5;
    } else {
      fieldUv.y = (uv.y - 0.5) / aspect + 0.5;
    }
    return fieldUv;
  }

  void main() {
    vec2 fieldUv = screenToFieldUv(v_uv, u_viewAspect);
    bool insideField = fieldUv.x >= 0.0 && fieldUv.x <= 1.0 && fieldUv.y >= 0.0 && fieldUv.y <= 1.0;

    if (!insideField) {
      vec3 bg = vec3(0.03, 0.08, 0.11);
      outColor = vec4(bg, 1.0);
      return;
    }

    float field = 0.0;
    for (int i = 0; i < ${MAX_IMPACTS}; i += 1) {
      if (i >= u_impactCount) {
        break;
      }
      field += circularWave(fieldUv, u_impacts[i]);
    }

    float waveMapped = clamp(0.5 + field * 1.35, 0.0, 1.0);
    float target = texture(u_targetTexture, fieldUv).r;
    float reconstruction = texture(u_reconstructionTexture, fieldUv).r;

    vec3 color;
    if (u_viewMode == 1) {
      color = vec3(target);
    } else if (u_viewMode == 2) {
      color = vec3(reconstruction);
    } else if (u_viewMode == 3) {
      color = palette(clamp(abs(target - reconstruction) * 2.0, 0.0, 1.0));
    } else {
      float phaseCloseness = 1.0 - smoothstep(0.0, 0.5, wrappedPhaseDistance(u_loopPhase, u_snapshotPhase));
      vec3 base = palette(waveMapped);
      vec3 proximity = proximityPalette(phaseCloseness);
      float highlight = smoothstep(0.76, 1.0, waveMapped);
      // Multiplicative tint keeps the image's dynamic range: blacks stay
      // black while the hue still signals distance to the snapshot phase.
      vec3 tint = proximity / max(proximity.r, max(proximity.g, proximity.b));
      color = base * mix(vec3(1.0), tint, 0.35);
      color += vec3(0.14, 0.1, 0.05) * highlight;
    }

    outColor = vec4(color, 1.0);
  }`,
);

const uniforms = {
  targetTexture: gl.getUniformLocation(program, "u_targetTexture"),
  reconstructionTexture: gl.getUniformLocation(program, "u_reconstructionTexture"),
  viewMode: gl.getUniformLocation(program, "u_viewMode"),
  snapshotPhase: gl.getUniformLocation(program, "u_snapshotPhase"),
  loopPhase: gl.getUniformLocation(program, "u_loopPhase"),
  period: gl.getUniformLocation(program, "u_period"),
  damping: gl.getUniformLocation(program, "u_damping"),
  waveSpeed: gl.getUniformLocation(program, "u_waveSpeed"),
  impulseWidth: gl.getUniformLocation(program, "u_impulseWidth"),
  angularFrequency: gl.getUniformLocation(program, "u_angularFrequency"),
  viewAspect: gl.getUniformLocation(program, "u_viewAspect"),
  impactCount: gl.getUniformLocation(program, "u_impactCount"),
  impacts: gl.getUniformLocation(program, "u_impacts"),
};

const targetTexture = createTexture(gl, TEXTURE_SIZE, TEXTURE_SIZE);
const reconstructionTexture = createTexture(gl, TEXTURE_SIZE, TEXTURE_SIZE);

let targetImage = createDefaultTarget(OPTIMIZER_GRID_SIZE);
let scheduleResult = null;
let lastTimestamp = performance.now();
let holdRemaining = 0;
resize();
bindControls();
window.addEventListener("resize", resize);
initializeState().finally(() => {
  requestAnimationFrame(frame);
});

async function initializeState() {
  const cachedState = loadCachedState();
  if (cachedState) {
    targetImage = cachedState.targetImage;
    scheduleResult = cachedState.scheduleResult;
  } else {
    const loadedDefault = await loadDefaultOfflineSolve();
    if (!loadedDefault) {
      recomputeSchedule();
    }
  }
  renderTargetPreview(targetImage.canvas);
}

async function loadDefaultOfflineSolve() {
  try {
    const response = await fetch(DEFAULT_OFFLINE_SOLVE_URL, { cache: "no-store" });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    applyOfflineSolve(payload);
    return true;
  } catch {
    return false;
  }
}

function frame(timestamp) {
  const delta = Math.min((timestamp - lastTimestamp) / 1000, 1 / 20);
  lastTimestamp = timestamp;
  if (config.autoplay) {
    config.manualPhase = advanceAutoplayPhase(config.manualPhase, delta);
    dom.phaseControl.value = config.manualPhase.toFixed(2);
    dom.phaseControlValue.textContent = config.manualPhase.toFixed(2);
  }
  const phase = config.manualPhase;

  renderDisplay(phase);
  renderThreeScene(phase);

  dom.phaseLabel.textContent = phase.toFixed(2);
  dom.activeLabel.textContent = countActiveImpacts(phase).toString();
  requestAnimationFrame(frame);
}

function bindControls() {
  dom.impacts.max = String(MAX_IMPACTS);
  const sliderBindings = [
    [dom.period, "period", (value) => `${Number(value).toFixed(2)}s`, dom.periodValue],
    [dom.snapshot, "snapshotPhase", (value) => Number(value).toFixed(2), dom.snapshotValue],
    [dom.impacts, "maxImpacts", (value) => String(value), dom.impactsValue],
    [dom.damping, "damping", (value) => Number(value).toFixed(2), dom.dampingValue],
    [dom.wavespeed, "waveSpeed", (value) => Number(value).toFixed(2), dom.wavespeedValue],
    [dom.slowWidth, "slowZoneWidth", (value) => Number(value).toFixed(2), dom.slowWidthValue],
    [dom.slowStrength, "slowStrength", (value) => Number(value).toFixed(2), dom.slowStrengthValue],
  ];

  sliderBindings.forEach(([element, key, format, output]) => {
    element.value = String(config[key]);
    output.textContent = format(config[key]);
    element.addEventListener("input", () => {
      config[key] = Number(element.value);
      output.textContent = format(element.value);
      if (key === "maxImpacts") {
        recomputeSchedule();
      }
    });
  });

  dom.viewMode.addEventListener("change", () => {
    config.viewMode = dom.viewMode.value;
  });
  dom.viewMode.value = config.viewMode;

  dom.showMarkers.addEventListener("change", () => {
    config.showMarkers = dom.showMarkers.checked;
  });
  dom.showMarkers.checked = config.showMarkers;

  dom.resetCamera.addEventListener("click", () => {
    threeState.controls.reset();
  });

  dom.autoplay.addEventListener("change", () => {
    config.autoplay = dom.autoplay.checked;
    dom.phaseControl.disabled = config.autoplay;
    if (config.autoplay) {
      lastTimestamp = performance.now();
      holdRemaining = 0;
    }
  });
  dom.autoplay.checked = config.autoplay;

  dom.phaseControl.value = String(config.manualPhase);
  dom.phaseControlValue.textContent = config.manualPhase.toFixed(2);
  dom.phaseControl.disabled = config.autoplay;
  dom.phaseControl.addEventListener("input", () => {
    config.manualPhase = Number(dom.phaseControl.value);
    dom.phaseControlValue.textContent = config.manualPhase.toFixed(2);
    holdRemaining = 0;
  });

  dom.recompute.addEventListener("click", () => {
    recomputeSchedule();
  });

  dom.clearCache.addEventListener("click", () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore storage failures and keep the app functional.
    }
    recomputeSchedule();
  });

  dom.imageUpload.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const bitmap = await createImageBitmap(file);
    const canvas = createContainedSquareCanvas(bitmap, OPTIMIZER_GRID_SIZE);
    targetImage = sampleCanvas(canvas, OPTIMIZER_GRID_SIZE);
    renderTargetPreview(canvas);
    recomputeSchedule();
  });

  dom.offlineUpload.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text());
      applyOfflineSolve(payload);
    } catch (error) {
      console.error(error);
      window.alert("Unable to load offline solve JSON.");
    } finally {
      dom.offlineUpload.value = "";
    }
  });
}

function recomputeSchedule() {
  scheduleResult = optimizeSchedule(targetImage, config);
  dom.errorLabel.textContent = scheduleResult.error.toFixed(3);
  uploadScalarTexture(targetTexture, targetImage.pixels, targetImage.width, targetImage.height);
  uploadScalarTexture(reconstructionTexture, scheduleResult.reconstruction, scheduleResult.width, scheduleResult.height);
  persistCachedState();
}

function renderDisplay(phase) {
  gl.useProgram(program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  bindTexture(gl, targetTexture, 0);
  bindTexture(gl, reconstructionTexture, 1);
  gl.uniform1i(uniforms.targetTexture, 0);
  gl.uniform1i(uniforms.reconstructionTexture, 1);
  gl.uniform1i(uniforms.viewMode, ["surface", "target", "reconstruction", "difference"].indexOf(config.viewMode));
  gl.uniform1f(uniforms.snapshotPhase, config.snapshotPhase);
  gl.uniform1f(uniforms.loopPhase, phase);
  gl.uniform1f(uniforms.period, config.period);
  gl.uniform1f(uniforms.damping, config.damping);
  gl.uniform1f(uniforms.waveSpeed, config.waveSpeed);
  gl.uniform1f(uniforms.impulseWidth, config.impulseWidth);
  gl.uniform1f(uniforms.angularFrequency, config.angularFrequency);
  gl.uniform1f(uniforms.viewAspect, gl.canvas.width / gl.canvas.height);

  const impacts = flattenSchedule(scheduleResult?.schedule ?? []);
  gl.uniform1i(uniforms.impactCount, Math.min(scheduleResult?.schedule.length ?? 0, MAX_IMPACTS));
  gl.uniform4fv(uniforms.impacts, impacts);

  drawFullscreen(gl, quadBuffer, program);
}

function renderThreeScene(phase) {
  threeState.displayTexture.needsUpdate = true;
  updateDisplayTextureTransform();
  updateThreeMarkers();
  updateThreeDrops(phase);
  threeState.controls.enabled = true;
  threeState.controls.update();
  threeState.renderer.render(threeState.scene, threeState.camera);
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(dom.canvas.clientWidth * ratio);
  const height = Math.floor(dom.canvas.clientHeight * ratio);
  dom.canvas.width = width;
  dom.canvas.height = height;
  dom.overlay.width = width;
  dom.overlay.height = height;
  threeState.renderer.setPixelRatio(ratio);
  threeState.renderer.setSize(dom.overlay.clientWidth, dom.overlay.clientHeight, false);
  threeState.camera.aspect = dom.overlay.clientWidth / dom.overlay.clientHeight;
  threeState.camera.updateProjectionMatrix();
  updateDisplayTextureTransform();
}

function countActiveImpacts(phase) {
  if (!scheduleResult) {
    return 0;
  }
  return scheduleResult.schedule.filter((impact) => {
    const dt = phase >= impact.phase ? phase - impact.phase : phase + 1 - impact.phase;
    return dt < 0.18;
  }).length;
}

function renderTargetPreview(sourceCanvas) {
  const context = dom.targetPreview.getContext("2d");
  context.clearRect(0, 0, dom.targetPreview.width, dom.targetPreview.height);
  const side = Math.min(dom.targetPreview.width, dom.targetPreview.height);
  const offsetX = (dom.targetPreview.width - side) * 0.5;
  const offsetY = (dom.targetPreview.height - side) * 0.5;
  context.drawImage(sourceCanvas, offsetX, offsetY, side, side);
}

function flattenSchedule(schedule) {
  const values = new Float32Array(MAX_IMPACTS * 4);
  const count = Math.min(schedule.length, MAX_IMPACTS);
  for (let i = 0; i < count; i += 1) {
    const impact = schedule[i];
    values[i * 4] = impact.x;
    values[i * 4 + 1] = 1 - impact.y;
    values[i * 4 + 2] = impact.phase;
    values[i * 4 + 3] = impact.amplitude * 0.65;
  }
  return values;
}

function phaseColor(phase, alpha) {
  const hue = 190 + phase * 60;
  return `hsla(${hue}, 92%, 70%, ${alpha})`;
}

function wrap01(value) {
  return value - Math.floor(value);
}

function centeredDelta(value, center) {
  const wrapped = wrap01(value - center + 0.5);
  return wrapped - 0.5;
}

function slowdownWeight(delta, width) {
  const normalized = Math.abs(delta) / Math.max(width, 1e-4);
  return normalized >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * normalized);
}

function advanceAutoplayPhase(currentPhase, deltaSeconds) {
  if (holdRemaining > 0) {
    holdRemaining = Math.max(0, holdRemaining - deltaSeconds);
    return config.snapshotPhase;
  }

  const baseStep = deltaSeconds / Math.max(config.period, 1e-4);
  const deltaToTarget = forwardPhaseDistance(currentPhase, config.snapshotPhase);
  const localSlow = slowdownWeight(deltaToTarget, config.slowZoneWidth);
  const speedScale = 1 - 0.88 * config.slowStrength * localSlow;
  const nextPhase = wrap01(currentPhase + baseStep * Math.max(0.03, speedScale));

  if (didCrossPhase(currentPhase, nextPhase, config.snapshotPhase)) {
    holdRemaining = config.slowStrength * config.period * 0.45;
    return config.snapshotPhase;
  }

  return nextPhase;
}

function forwardPhaseDistance(start, end) {
  return end >= start ? end - start : end + 1 - start;
}

function didCrossPhase(start, end, target) {
  if (start <= end) {
    return target > start && target <= end;
  }
  return target > start || target <= end;
}

function createContainedSquareCanvas(source, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "black";
  context.fillRect(0, 0, size, size);

  const sourceWidth = source.width ?? source.videoWidth;
  const sourceHeight = source.height ?? source.videoHeight;
  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (size - drawWidth) * 0.5;
  const offsetY = (size - drawHeight) * 0.5;
  context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
  return canvas;
}

function createThreeScene() {
  const renderer = new THREE.WebGLRenderer({
    canvas: dom.overlay,
    antialias: true,
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(-2.1, 2.9, 3.2);

  const controls = new OrbitControls(camera, dom.overlay);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.12, 0);
  controls.minDistance = 2.6;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.update();
  controls.saveState();

  const ambient = new THREE.HemisphereLight(0xf1fbff, 0x0e2632, 1.4);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2.8, 4.5, 3.2);
  scene.add(key);

  const displayTexture = new THREE.CanvasTexture(dom.canvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  displayTexture.minFilter = THREE.LinearFilter;
  displayTexture.magFilter = THREE.LinearFilter;
  displayTexture.wrapS = THREE.ClampToEdgeWrapping;
  displayTexture.wrapT = THREE.ClampToEdgeWrapping;

  const puddle = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshStandardMaterial({
      map: displayTexture,
      side: THREE.DoubleSide,
      roughness: 0.28,
      metalness: 0.02,
      emissive: 0x0a1e27,
      emissiveIntensity: 0.18,
    }),
  );
  puddle.rotation.x = -Math.PI / 2;
  scene.add(puddle);

  const rim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, 0.002, -1),
      new THREE.Vector3(1, 0.002, -1),
      new THREE.Vector3(1, 0.002, 1),
      new THREE.Vector3(-1, 0.002, 1),
    ]),
    new THREE.LineBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.35 }),
  );
  scene.add(rim);

  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);
  [
    [-1.36, 2.06, -0.82, 0.42],
    [-1.08, 2.16, 0.02, 0.48],
    [-1.18, 2.0, 0.86, 0.38],
    [-0.52, 2.22, -0.94, 0.44],
    [-0.28, 2.12, -0.16, 0.56],
    [-0.34, 2.18, 0.72, 0.46],
    [0.34, 2.18, -0.88, 0.46],
    [0.12, 2.26, -0.02, 0.54],
    [0.28, 2.14, 0.86, 0.44],
    [0.96, 2.08, -0.74, 0.4],
    [1.08, 2.2, 0.08, 0.46],
    [1.18, 2.04, 0.88, 0.36],
    [-0.78, 2.38, -0.42, 0.3],
    [0.02, 2.46, 0.36, 0.34],
    [0.86, 2.34, -0.22, 0.28],
  ].forEach(([x, y, z, radius]) => {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf0fbff,
        transparent: true,
        opacity: 0.88,
        roughness: 1,
      }),
    );
    puff.position.set(x, y, z);
    cloudGroup.add(puff);
  });

  const dropGeometry = new THREE.SphereGeometry(0.026, 12, 10);
  const dropMaterial = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  const drops = Array.from({ length: MAX_IMPACTS }, () => {
    const mesh = new THREE.Mesh(dropGeometry, dropMaterial.clone());
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  const markerGeometry = new THREE.SphereGeometry(0.032, 14, 12);
  const markers = Array.from({ length: MAX_IMPACTS }, () => {
    const mesh = new THREE.Mesh(
      markerGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.82 }),
    );
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });

  return { renderer, scene, camera, controls, displayTexture, puddle, drops, markers };
}

function updateDisplayTextureTransform() {
  const width = Math.max(1, dom.canvas.width);
  const height = Math.max(1, dom.canvas.height);
  const side = Math.min(width, height);
  threeState.displayTexture.repeat.set(side / width, side / height);
  threeState.displayTexture.offset.set(
    (width - side) / (2 * width),
    (height - side) / (2 * height),
  );
}

function updateThreeMarkers() {
  const schedule = scheduleResult?.schedule ?? [];
  for (let i = 0; i < threeState.markers.length; i += 1) {
    const marker = threeState.markers[i];
    const impact = schedule[i];
    if (!config.showMarkers || !impact) {
      marker.visible = false;
      continue;
    }
    marker.visible = true;
    marker.position.set((impact.x - 0.5) * 2, 0.03, (impact.y - 0.5) * 2);
    marker.scale.setScalar(0.7 + Math.abs(impact.amplitude) * 0.55);
    marker.material.color.set(phaseColorHex(impact.phase));
  }
}

function updateThreeDrops(phase) {
  const schedule = scheduleResult?.schedule ?? [];
  const fallDuration = Math.max(0.2, config.period * 0.18);
  const minLeadTime = Math.min(0.06, fallDuration * 0.22);
  let writeIndex = 0;

  for (const impact of schedule) {
    const timeToImpact = forwardPhaseDistance(phase, impact.phase) * config.period;
    if (timeToImpact > fallDuration || timeToImpact <= minLeadTime || writeIndex >= threeState.drops.length) {
      continue;
    }

    const progress = 1 - (timeToImpact - minLeadTime) / Math.max(fallDuration - minLeadTime, 1e-4);
    const drop = threeState.drops[writeIndex];
    drop.visible = true;
    drop.position.set((impact.x - 0.5) * 2, 1.95 * (1 - progress), (impact.y - 0.5) * 2);
    drop.scale.setScalar(0.8 + 0.45 * progress);
    drop.material.color.set(phaseColorHex(impact.phase));
    writeIndex += 1;
  }

  for (let i = writeIndex; i < threeState.drops.length; i += 1) {
    threeState.drops[i].visible = false;
  }
}

function phaseColorHex(phase) {
  const color = new THREE.Color();
  color.setHSL(0.53 + phase * 0.12, 0.92, 0.72);
  return color;
}

function createFullscreenQuad(context) {
  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    context.STATIC_DRAW,
  );
  return buffer;
}

function createProgram(context, vertexSource, fragmentSource) {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource);
  const program = context.createProgram();
  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    throw new Error(context.getProgramInfoLog(program) || "Program linking failed.");
  }

  return program;
}

function compileShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    throw new Error(context.getShaderInfoLog(shader) || "Shader compilation failed.");
  }
  return shader;
}

function drawFullscreen(context, buffer, program) {
  const positionLocation = context.getAttribLocation(program, "a_position");
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.enableVertexAttribArray(positionLocation);
  context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
}

function createTexture(context, width, height) {
  const texture = context.createTexture();
  context.bindTexture(context.TEXTURE_2D, texture);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  context.texImage2D(
    context.TEXTURE_2D,
    0,
    context.RGBA,
    width,
    height,
    0,
    context.RGBA,
    context.UNSIGNED_BYTE,
    null,
  );
  return texture;
}

function bindTexture(context, texture, unit) {
  context.activeTexture(context.TEXTURE0 + unit);
  context.bindTexture(context.TEXTURE_2D, texture);
}

function uploadScalarTexture(texture, values, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = y * width + x;
      const targetRow = height - 1 - y;
      const offset = (targetRow * width + x) * 4;
      const value = Math.max(0, Math.min(255, Math.round(values[sourceIndex] * 255)));
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
}

function applyOfflineSolve(payload) {
  const loaded = normalizeOfflinePayload(payload);
  if (!loaded) {
    throw new Error("Invalid offline solve payload.");
  }

  if (loaded.config) {
    assignConfigFromLoadedSolve(loaded.config);
    syncControlsFromConfig();
  }

  if (loaded.targetPixels) {
    targetImage = {
      width: loaded.gridSize,
      height: loaded.gridSize,
      pixels: loaded.targetPixels,
      canvas: createCanvasFromPixels(loaded.targetPixels, loaded.gridSize, loaded.gridSize),
    };
    renderTargetPreview(targetImage.canvas);
    uploadScalarTexture(targetTexture, loaded.targetPixels, loaded.gridSize, loaded.gridSize);
  }

  scheduleResult = {
    schedule: loaded.schedule,
    reconstruction: loaded.reconstruction ?? new Float32Array(loaded.gridSize * loaded.gridSize),
    error: loaded.error ?? 0,
    width: loaded.gridSize,
    height: loaded.gridSize,
  };
  dom.errorLabel.textContent = scheduleResult.error.toFixed(3);
  uploadScalarTexture(
    reconstructionTexture,
    scheduleResult.reconstruction,
    scheduleResult.width,
    scheduleResult.height,
  );
  holdRemaining = 0;
  persistCachedState();
}

function normalizeOfflinePayload(payload) {
  if (!payload || !Array.isArray(payload.schedule)) {
    return null;
  }

  const configFromPayload = payload.config
    ? {
        period: payload.config.period,
        snapshotPhase: payload.config.snapshotPhase ?? payload.config.snapshot_phase,
        maxImpacts: payload.config.maxImpacts ?? payload.config.max_impacts,
        damping: payload.config.damping,
        waveSpeed: payload.config.waveSpeed ?? payload.config.wave_speed,
        impulseWidth: payload.config.impulseWidth ?? payload.config.impulse_width,
        angularFrequency: payload.config.angularFrequency ?? payload.config.angular_frequency,
        regularization: payload.config.regularization,
        minAmplitude: payload.config.minAmplitude ?? payload.config.min_amplitude,
        phaseSamples: payload.config.phaseSamples ?? payload.config.phase_samples,
      }
    : null;

  const gridSize =
    Number(payload.gridSize ?? payload.grid_size ?? payload.width ?? payload.config?.gridSize ?? payload.config?.grid_size) ||
    OPTIMIZER_GRID_SIZE;

  const schedule = payload.schedule
    .map((impact) => ({
      x: Number(impact.x),
      y: Number(impact.y),
      phase: Number(impact.phase),
      amplitude: Number(impact.amplitude),
    }))
    .filter((impact) => [impact.x, impact.y, impact.phase, impact.amplitude].every(Number.isFinite));

  if (schedule.length === 0) {
    return null;
  }

  const reconstruction = coercePixelArray(payload.reconstruction, gridSize);
  const targetPixels = coercePixelArray(payload.targetPixels ?? payload.target_pixels ?? payload.target, gridSize);
  const error = Number(payload.error);

  return {
    config: configFromPayload,
    gridSize,
    schedule,
    reconstruction,
    targetPixels,
    error: Number.isFinite(error) ? error : 0,
  };
}

function coercePixelArray(values, gridSize) {
  if (!Array.isArray(values)) {
    return null;
  }
  const result = Float32Array.from(values);
  if (result.length !== gridSize * gridSize) {
    return null;
  }
  return result;
}

function assignConfigFromLoadedSolve(nextConfig) {
  const keys = [
    "period",
    "snapshotPhase",
    "maxImpacts",
    "damping",
    "waveSpeed",
    "impulseWidth",
    "angularFrequency",
    "regularization",
    "minAmplitude",
    "phaseSamples",
  ];
  for (const key of keys) {
    if (Number.isFinite(nextConfig[key])) {
      config[key] = Number(nextConfig[key]);
    }
  }
}

function syncControlsFromConfig() {
  dom.period.value = String(config.period);
  dom.periodValue.textContent = `${config.period.toFixed(2)}s`;
  dom.snapshot.value = String(config.snapshotPhase);
  dom.snapshotValue.textContent = config.snapshotPhase.toFixed(2);
  dom.impacts.value = String(config.maxImpacts);
  dom.impactsValue.textContent = String(config.maxImpacts);
  dom.damping.value = String(config.damping);
  dom.dampingValue.textContent = config.damping.toFixed(2);
  dom.wavespeed.value = String(config.waveSpeed);
  dom.wavespeedValue.textContent = config.waveSpeed.toFixed(2);
}

function loadCachedState() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw);
    if (!cached) {
      return null;
    }
    if (!matchesScheduleConfig(cached.config)) {
      return null;
    }
    if (!Array.isArray(cached.targetPixels) || !cached.scheduleResult) {
      return null;
    }

    const gridSize = Number(cached.optimizerGridSize) || OPTIMIZER_GRID_SIZE;
    const targetPixels = Float32Array.from(cached.targetPixels);
    if (targetPixels.length !== gridSize * gridSize) {
      return null;
    }

    const targetImageFromCache = {
      width: gridSize,
      height: gridSize,
      pixels: targetPixels,
      canvas: createCanvasFromPixels(targetPixels, gridSize, gridSize),
    };

    const cachedSchedule = cached.scheduleResult.schedule;
    const cachedReconstruction = Float32Array.from(cached.scheduleResult.reconstruction);
    if (
      !Array.isArray(cachedSchedule) ||
      cachedReconstruction.length !== gridSize * gridSize
    ) {
      return null;
    }

    const restoredScheduleResult = {
      schedule: cachedSchedule,
      reconstruction: cachedReconstruction,
      error: Number(cached.scheduleResult.error) || 0,
      width: gridSize,
      height: gridSize,
    };

    dom.errorLabel.textContent = restoredScheduleResult.error.toFixed(3);
    uploadScalarTexture(targetTexture, targetImageFromCache.pixels, gridSize, gridSize);
    uploadScalarTexture(
      reconstructionTexture,
      restoredScheduleResult.reconstruction,
      gridSize,
      gridSize,
    );

    return {
      targetImage: targetImageFromCache,
      scheduleResult: restoredScheduleResult,
    };
  } catch {
    return null;
  }
}

function persistCachedState() {
  if (!scheduleResult) {
    return;
  }

  const payload = {
    optimizerGridSize: targetImage.width,
    config: getScheduleConfigSnapshot(),
    targetPixels: Array.from(targetImage.pixels),
    scheduleResult: {
      schedule: scheduleResult.schedule,
      reconstruction: Array.from(scheduleResult.reconstruction),
      error: scheduleResult.error,
    },
  };

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures and keep the app functional.
  }
}

function getScheduleConfigSnapshot() {
  return {
    period: config.period,
    snapshotPhase: config.snapshotPhase,
    maxImpacts: config.maxImpacts,
    damping: config.damping,
    waveSpeed: config.waveSpeed,
    impulseWidth: config.impulseWidth,
    angularFrequency: config.angularFrequency,
    regularization: config.regularization,
    minAmplitude: config.minAmplitude,
    phaseSamples: config.phaseSamples,
  };
}

function matchesScheduleConfig(snapshot) {
  if (!snapshot) {
    return false;
  }
  const current = getScheduleConfigSnapshot();
  return Object.keys(current).every((key) => snapshot[key] === current[key]);
}

function createCanvasFromPixels(pixels, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = y * width + x;
      const value = Math.max(0, Math.min(255, Math.round(pixels[sourceIndex] * 255)));
      const offset = sourceIndex * 4;
      imageData.data[offset] = value;
      imageData.data[offset + 1] = value;
      imageData.data[offset + 2] = value;
      imageData.data[offset + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}
