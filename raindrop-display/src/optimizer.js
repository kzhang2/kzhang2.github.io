const DEFAULT_GRID_SIZE = 64;
const DEFAULT_PHASE_SAMPLES = 256;

// The display shader shows the wave field as `0.5 + field * DISPLAY_GAIN`
// (see main.js), so the solver fits (target - 0.5) / DISPLAY_GAIN.
const DISPLAY_GAIN = 1.35;

export function createDefaultTarget(size = DEFAULT_GRID_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.fillStyle = "black";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "white";
  context.font = `bold ${Math.floor(size * 0.46)}px Georgia`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("RD", size * 0.5, size * 0.53);

  return sampleCanvas(canvas, size);
}

export function sampleCanvas(canvas, size = DEFAULT_GRID_SIZE) {
  const buffer = document.createElement("canvas");
  buffer.width = size;
  buffer.height = size;
  const context = buffer.getContext("2d", { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, size, size);
  const imageData = context.getImageData(0, 0, size, size).data;
  const pixels = new Float32Array(size * size);

  for (let i = 0; i < pixels.length; i += 1) {
    const offset = i * 4;
    const r = imageData[offset] / 255;
    const g = imageData[offset + 1] / 255;
    const b = imageData[offset + 2] / 255;
    pixels[i] = Math.max(0, Math.min(1, 0.299 * r + 0.587 * g + 0.114 * b));
  }

  return {
    width: size,
    height: size,
    pixels,
    canvas: buffer,
  };
}

export function optimizeSchedule(target, config) {
  const candidatePhases = config.phaseSamples ?? DEFAULT_PHASE_SAMPLES;
  const gridSize = target.width;
  const signal = new Float32Array(target.pixels);
  const displayTarget = new Float32Array(signal.length);
  for (let pixel = 0; pixel < signal.length; pixel += 1) {
    displayTarget[pixel] = (signal[pixel] - 0.5) / DISPLAY_GAIN;
  }
  const basis = buildBasis(gridSize, candidatePhases, config);
  const selected = [];
  const reconstruction = new Float32Array(signal.length);
  const residual = new Float32Array(displayTarget);

  for (let count = 0; count < config.maxImpacts; count += 1) {
    let best = null;

    for (let i = 0; i < basis.length; i += 1) {
      const atom = basis[i];
      let numerator = 0;
      let denominator = config.regularization;

      for (let pixel = 0; pixel < residual.length; pixel += 1) {
        numerator += residual[pixel] * atom.values[pixel];
        denominator += atom.values[pixel] * atom.values[pixel];
      }

      const amplitude = numerator / denominator;
      // Energy reduction <atom, r>^2 / ||atom||^2, not the raw correlation:
      // the latter favors large-norm atoms regardless of how much residual
      // they actually remove. (The offline Python solver additionally refits
      // all amplitudes by least squares each step; omitted here for speed.)
      const score = (numerator * numerator) / denominator;

      if (!best || score > best.score) {
        best = { atom, amplitude, score };
      }
    }

    if (!best || Math.abs(best.amplitude) < config.minAmplitude) {
      break;
    }

    selected.push({
      x: best.atom.x,
      y: best.atom.y,
      phase: best.atom.phase,
      amplitude: best.amplitude,
    });

    for (let pixel = 0; pixel < residual.length; pixel += 1) {
      const contribution = best.atom.values[pixel] * best.amplitude;
      reconstruction[pixel] += contribution;
      residual[pixel] -= contribution;
    }
  }

  mapFieldToDisplay(reconstruction);

  return {
    schedule: selected.sort((a, b) => a.phase - b.phase),
    reconstruction,
    error: computeRootMeanSquareError(signal, reconstruction),
    width: target.width,
    height: target.height,
  };
}

function buildBasis(gridSize, phaseSamples, config) {
  const atoms = [];
  const spacing = Math.max(4, Math.floor(gridSize / Math.sqrt(config.maxImpacts * 2)));

  for (let gy = spacing / 2; gy < gridSize; gy += spacing) {
    for (let gx = spacing / 2; gx < gridSize; gx += spacing) {
      for (let phaseIndex = 0; phaseIndex < phaseSamples; phaseIndex += 1) {
        const phase = phaseIndex / phaseSamples;
        const dt = wrappedPhaseDistance(config.snapshotPhase, phase) * config.period;
        const values = new Float32Array(gridSize * gridSize);

        for (let py = 0; py < gridSize; py += 1) {
          for (let px = 0; px < gridSize; px += 1) {
            const u = (px + 0.5) / gridSize;
            const v = (py + 0.5) / gridSize;
            const dx = u - gx / gridSize;
            const dy = v - gy / gridSize;
            const distance = Math.hypot(dx, dy);
            const arrival = config.waveSpeed * dt;
            const envelope = Math.exp(-((distance - arrival) ** 2) / (2 * config.impulseWidth ** 2));
            const oscillation = Math.cos(config.angularFrequency * (distance - arrival));
            const damping = Math.exp(-config.damping * dt);
            const value = damping * envelope * oscillation;
            values[py * gridSize + px] = value;
          }
        }

        atoms.push({
          x: gx / gridSize,
          y: gy / gridSize,
          phase,
          values,
        });
      }
    }
  }

  return atoms;
}

function wrappedPhaseDistance(targetPhase, eventPhase) {
  if (eventPhase > targetPhase) {
    return targetPhase + 1 - eventPhase;
  }
  return targetPhase - eventPhase;
}

function mapFieldToDisplay(values) {
  for (let i = 0; i < values.length; i += 1) {
    values[i] = Math.max(0, Math.min(1, 0.5 + DISPLAY_GAIN * values[i]));
  }
}

function computeRootMeanSquareError(target, reconstruction) {
  let total = 0;
  for (let i = 0; i < target.length; i += 1) {
    const delta = target[i] - reconstruction[i];
    total += delta * delta;
  }
  return Math.sqrt(total / target.length);
}
