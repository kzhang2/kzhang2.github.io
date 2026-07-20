// Neural World Model — fully client-side DIAMOND diffusion world model on WebGPU.
//
// Port of the server-side loop in world-model-exps/src/play_web.py + world_model_env.py:
// each frame is imagined by N Euler denoising steps of a UNet (denoiser_step_fp16.onnx),
// then a reward/death LSTM (rew_end_fp16.onnx) decides if you died. All ML runs here in
// the browser via onnxruntime-web (WebGPU); no server. The models are exported by
// world-model-exps/src/export_onnx.py; seed frames by src/export_seeds.py.

import * as ort from 'onnxruntime-web/webgpu';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.wasm.numThreads = 1; // no cross-origin isolation on GitHub Pages (no SharedArrayBuffer)

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const hudEl = $('hud');
const overlayEl = $('overlay');
const canvas = $('frame');
const ctx = canvas.getContext('2d');

const WEIGHTS = './weights/';
const C = 3;

// --- state -----------------------------------------------------------------------------
let meta = null; // { num_cond, img_size, sigmas, lstm_dim, num_actions }
let seedMeta = null; // { num_seeds, num_cond, img_size, actions }
let seedBuf = null; // Float32Array view helper source (Uint8Array)
let denoiser = null;
let rewEnd = null;

let IMG = 64;
let NCOND = 4;
let SIGMAS = [];
let LSTM = 512;
const HORIZON = 600; // soft cap before auto-reseed, mirrors WorldModelEnv horizon

let obs = null; // Array(NCOND) of Float32Array(C*IMG*IMG), values in [-1,1]
let act = null; // Array(NCOND) of int (0/1)
let hx = null, cx = null; // Float32Array(LSTM)
let ret = 0, steps = 0;

const held = new Set();
let playing = false, busy = false, ready = false;

// --- small numerics --------------------------------------------------------------------
function randn(n) {
  // Box–Muller into a Float32Array of length n.
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(Math.random(), 1e-7);
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

function sampleCategorical(logits) {
  // logits: plain array. Softmax then sample an index.
  let m = -Infinity;
  for (const v of logits) m = Math.max(m, v);
  let sum = 0;
  const probs = logits.map((v) => { const e = Math.exp(v - m); sum += e; return e; });
  let r = Math.random() * sum;
  for (let i = 0; i < probs.length; i++) { r -= probs[i]; if (r <= 0) return i; }
  return probs.length - 1;
}

// --- tensors ---------------------------------------------------------------------------
const f32 = (data, dims) => new ort.Tensor('float32', data, dims);
const i64 = (arr, dims) => new ort.Tensor('int64', BigInt64Array.from(arr, (x) => BigInt(x)), dims);

function prevObsTensor() {
  // Concatenate the 4 conditioning frames into [1, NCOND*C, IMG, IMG].
  const per = C * IMG * IMG;
  const data = new Float32Array(NCOND * per);
  for (let t = 0; t < NCOND; t++) data.set(obs[t], t * per);
  return f32(data, [1, NCOND * C, IMG, IMG]);
}

// --- inference -------------------------------------------------------------------------
async function imagineNextFrame() {
  const prevObs = prevObsTensor();
  const prevAct = i64(act, [1, NCOND]);
  let x = f32(randn(C * IMG * IMG), [1, C, IMG, IMG]);
  const nsteps = parseInt($('steps').value, 10);
  // SIGMAS has length (num_steps_denoising + 1), ending in 0. Use the last `nsteps`
  // schedule points + the final 0 so 1 step jumps straight from the smallest sigma.
  const start = SIGMAS.length - 1 - nsteps;
  for (let k = start; k < SIGMAS.length - 1; k++) {
    const sigma = f32(Float32Array.of(SIGMAS[k]), [1]);
    const nextSigma = f32(Float32Array.of(SIGMAS[k + 1]), [1]);
    const out = await denoiser.run({ x, sigma, next_sigma: nextSigma, prev_obs: prevObs, prev_act: prevAct });
    x = out.x_next;
  }
  return x.data; // Float32Array(C*IMG*IMG) in [-1,1]
}

async function predictRewEnd(prevFrame, action, nextFrame) {
  const out = await rewEnd.run({
    obs: f32(prevFrame, [1, C, IMG, IMG]),
    act: i64([action], [1]),
    next_obs: f32(nextFrame, [1, C, IMG, IMG]),
    hx: f32(hx, [1, 1, LSTM]),
    cx: f32(cx, [1, 1, LSTM]),
  });
  hx = out.hx_out.data;
  cx = out.cx_out.data;
  const rew = sampleCategorical(Array.from(out.logits_rew.data)) - 1; // {-1,0,1}
  const end = sampleCategorical(Array.from(out.logits_end.data)); // {0,1}
  return { rew, end };
}

// --- one imagined step (mirrors world_model_env.step + play_web.do_step) ---------------
async function stepOnce() {
  if (!ready || busy) return;
  busy = true;
  try {
    const action = (held.has('Space') || held.has('ArrowUp')) ? 1 : 0;
    act[NCOND - 1] = action;

    const nextFrame = await imagineNextFrame();
    const prevFrame = obs[NCOND - 1];
    const { rew, end } = await predictRewEnd(prevFrame, action, nextFrame);
    ret += rew;
    steps += 1;
    const trunc = steps >= HORIZON ? 1 : 0;

    // roll buffers left, newest frame into the last slot
    for (let t = 0; t < NCOND - 1; t++) { obs[t] = obs[t + 1]; act[t] = act[t + 1]; }
    obs[NCOND - 1] = nextFrame;
    act[NCOND - 1] = 0; // placeholder, overwritten next step

    render(nextFrame);
    renderHud({ action, rew, end, trunc });

    if (end || trunc) {
      overlayEl.textContent = end ? 'you died — reseeding…' : 'drifted too far — reseeding…';
      overlayEl.classList.add('show');
      await new Promise((r) => setTimeout(r, 700));
      await reseed();
      overlayEl.classList.remove('show');
    }
  } finally {
    busy = false;
  }
}

// --- seeding (mirrors play_web.seed_env "start"/burn-in) --------------------------------
function loadSeedWindow(idx) {
  const per = C * IMG * IMG;
  const base = idx * NCOND * per;
  obs = [];
  act = [];
  for (let t = 0; t < NCOND; t++) {
    const frame = new Float32Array(per);
    for (let i = 0; i < per; i++) frame[i] = (seedBuf[base + t * per + i] / 255) * 2 - 1;
    obs.push(frame);
    act.push(seedMeta.actions[idx][t]);
  }
}

async function reseed() {
  const idx = Math.floor(Math.random() * seedMeta.num_seeds);
  loadSeedWindow(idx);
  // burn in the reward/death LSTM over the 3 seed transitions (from zero state)
  hx = new Float32Array(LSTM);
  cx = new Float32Array(LSTM);
  for (let t = 0; t < NCOND - 1; t++) {
    await predictRewEnd(obs[t], act[t], obs[t + 1]);
  }
  ret = 0;
  steps = 0;
  render(obs[NCOND - 1]);
  hudEl.textContent = `seed #${idx} loaded — press Play or Step.\nreturn: 0`;
}

// --- rendering -------------------------------------------------------------------------
const imgData = () => ctx.createImageData(IMG, IMG);
let _id = null;
function render(frame) {
  if (!_id) _id = imgData();
  const d = _id.data;
  const plane = IMG * IMG;
  for (let p = 0; p < plane; p++) {
    const r = (frame[p] + 1) * 127.5;
    const g = (frame[plane + p] + 1) * 127.5;
    const b = (frame[2 * plane + p] + 1) * 127.5;
    const o = p * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  ctx.putImageData(_id, 0, 0);
}

function renderHud({ action, rew, end, trunc }) {
  let s = `action: ${action === 1 ? 'jump' : 'noop'}\n`;
  s += `reward: ${rew >= 0 ? '+' : ''}${rew}    return: ${ret}\n`;
  s += `steps: ${steps}`;
  if (end) s += `\n*** predicted death ***`;
  else if (trunc) s += `\n*** horizon reached ***`;
  hudEl.textContent = s;
  hudEl.classList.toggle('dead', !!(end || trunc));
}

// --- loop + wiring ---------------------------------------------------------------------
async function loop() {
  if (!playing) return;
  const t0 = performance.now();
  await stepOnce();
  const target = 1000 / Math.max(1, parseInt($('fps').value, 10));
  setTimeout(loop, Math.max(0, target - (performance.now() - t0)));
}

function setPlaying(on) {
  if (!ready) return;
  playing = on;
  $('play').textContent = on ? '⏸ Pause' : '▶ Play';
  if (on) loop();
}

function newStart() {
  setPlaying(false); // stop the loop and reset the Play/Pause button
  reseed();
}

function wireUI() {
  $('play').onclick = () => setPlaying(!playing);
  $('step').onclick = () => { if (!playing) stepOnce(); };
  $('reset').onclick = newStart;
  $('fps').oninput = (e) => { $('fpsValue').textContent = e.target.value; };
  $('steps').oninput = (e) => { $('stepsValue').textContent = e.target.value; };

  const GAME_KEYS = new Set(['Space', 'ArrowUp']);
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (GAME_KEYS.has(e.code)) { e.preventDefault(); held.add(e.code); }
    else if (e.code === 'Enter') newStart();
    else if (e.code === 'KeyP') setPlaying(!playing);
  });
  document.addEventListener('keyup', (e) => held.delete(e.code));
}

async function warmup() {
  // First WebGPU run compiles shaders; do it before the user interacts.
  statusEl.textContent = 'Warming up model…';
  await imagineNextFrame();
}

async function init() {
  wireUI();
  if (!navigator.gpu) {
    statusEl.innerHTML = 'This demo needs <b>WebGPU</b> — try a recent Chrome, Edge, or Safari 18+.';
    statusEl.classList.add('err');
    return;
  }
  // fp16 graphs are half the size and faster, but need the WebGPU 'shader-f16' feature;
  // fall back to fp32 (runs on any WebGPU adapter) when it is unavailable.
  const adapter = await navigator.gpu.requestAdapter();
  const useFp16 = !!(adapter && adapter.features.has('shader-f16'));
  const suffix = useFp16 ? '_fp16' : '';

  try {
    [meta, seedMeta] = await Promise.all([
      fetch(WEIGHTS + 'meta.json').then((r) => r.json()),
      fetch('./seeds.json').then((r) => r.json()),
    ]);
    IMG = meta.img_size; NCOND = meta.num_cond; SIGMAS = meta.sigmas; LSTM = meta.lstm_dim;
    canvas.width = IMG; canvas.height = IMG;

    const bin = await fetch('./seeds.bin').then((r) => r.arrayBuffer());
    seedBuf = new Uint8Array(bin);

    statusEl.textContent = `Loading networks (${useFp16 ? 'fp16' : 'fp32'})…`;
    const opts = { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' };
    [denoiser, rewEnd] = await Promise.all([
      ort.InferenceSession.create(`${WEIGHTS}denoiser_step${suffix}.onnx`, opts),
      ort.InferenceSession.create(`${WEIGHTS}rew_end${suffix}.onnx`, opts),
    ]);

    await reseed();      // needs a valid obs buffer before warmup
    await warmup();
    await reseed();      // reset state after the warmup step

    ready = true;
    statusEl.textContent = 'Ready. Hold Space / ↑ to jump.';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to initialize: ' + (err.message || err);
    statusEl.classList.add('err');
  }
}

init();
