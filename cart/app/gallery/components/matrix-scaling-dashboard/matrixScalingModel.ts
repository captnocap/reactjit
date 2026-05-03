export const MATRIX_SIZE = 256;
export const PANEL_SIZES = [512, 256, 128, 64, 32, 16] as const;
const STEP_MS = 48;
const HEAT_FADE = 2;
const INJECTION_INTERVAL = 45;
const INJECTION_SIZE = 10;
const INITIAL_SEED = 0x51f15eed;

export type PanelSize = (typeof PANEL_SIZES)[number];

export type MatrixSimulation = {
  current: Uint8Array;
  next: Uint8Array;
  decay: Uint8Array;
  colorMap: Uint8Array;
  seed: number;
  accumulatorMs: number;
  lastTickMs: number;
  stepCount: number;
};

export function deviceLabel(size: PanelSize): string {
  if (size >= 512) return 'wall';
  if (size >= 256) return 'desktop';
  if (size >= 128) return 'tablet';
  if (size >= 64) return 'phone';
  return 'wearable';
}

export function projectionLabel(size: PanelSize): string {
  if (size === MATRIX_SIZE) return 'Native 1:1 match';
  if (size > MATRIX_SIZE) return `Scaled up x${size / MATRIX_SIZE}`;
  return `Downsampled 1:${MATRIX_SIZE / size}`;
}

function lerpByte(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function createColorMap(): Uint8Array {
  const map = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    let r = 5;
    let g = 10;
    let b = 21;

    if (i < 85) {
      const t = i / 85;
      r = lerpByte(5, 14, t);
      g = lerpByte(10, 165, t);
      b = lerpByte(21, 233, t);
    } else if (i < 170) {
      const t = (i - 85) / 85;
      r = lerpByte(14, 192, t);
      g = lerpByte(165, 38, t);
      b = lerpByte(233, 211, t);
    } else if (i < 255) {
      const t = (i - 170) / 85;
      r = lerpByte(192, 52, t);
      g = lerpByte(38, 211, t);
      b = lerpByte(211, 153, t);
    } else {
      r = 255;
      g = 255;
      b = 255;
    }

    const base = i * 4;
    map[base] = r;
    map[base + 1] = g;
    map[base + 2] = b;
    map[base + 3] = 255;
  }
  return map;
}

function nextRandom(simulation: MatrixSimulation): number {
  simulation.seed = (Math.imul(simulation.seed, 1664525) + 1013904223) >>> 0;
  return simulation.seed / 0x100000000;
}

function injectNoise(simulation: MatrixSimulation) {
  const startX = Math.floor(nextRandom(simulation) * (MATRIX_SIZE - INJECTION_SIZE));
  const startY = Math.floor(nextRandom(simulation) * (MATRIX_SIZE - INJECTION_SIZE));
  for (let dy = 0; dy < INJECTION_SIZE; dy++) {
    const rowBase = (startY + dy) * MATRIX_SIZE + startX;
    for (let dx = 0; dx < INJECTION_SIZE; dx++) {
      if (nextRandom(simulation) > 0.5) simulation.current[rowBase + dx] = 1;
    }
  }
}

export function createMatrixSimulation(): MatrixSimulation {
  const numCells = MATRIX_SIZE * MATRIX_SIZE;
  const simulation: MatrixSimulation = {
    current: new Uint8Array(numCells),
    next: new Uint8Array(numCells),
    decay: new Uint8Array(numCells),
    colorMap: createColorMap(),
    seed: INITIAL_SEED,
    accumulatorMs: 0,
    lastTickMs: -1,
    stepCount: 0,
  };

  for (let index = 0; index < numCells; index++) {
    if (nextRandom(simulation) > 0.85) {
      simulation.current[index] = 1;
      simulation.decay[index] = 255;
    }
  }

  return simulation;
}

function stepSimulation(simulation: MatrixSimulation) {
  simulation.stepCount += 1;
  if (simulation.stepCount % INJECTION_INTERVAL === 0) injectNoise(simulation);

  const current = simulation.current;
  const next = simulation.next;
  const decay = simulation.decay;

  for (let y = 0; y < MATRIX_SIZE; y++) {
    const north = ((y + MATRIX_SIZE - 1) % MATRIX_SIZE) * MATRIX_SIZE;
    const center = y * MATRIX_SIZE;
    const south = ((y + 1) % MATRIX_SIZE) * MATRIX_SIZE;

    for (let x = 0; x < MATRIX_SIZE; x++) {
      const west = x === 0 ? MATRIX_SIZE - 1 : x - 1;
      const east = x === MATRIX_SIZE - 1 ? 0 : x + 1;
      const idx = center + x;

      const aliveNeighbors =
        current[north + west] +
        current[north + x] +
        current[north + east] +
        current[center + west] +
        current[center + east] +
        current[south + west] +
        current[south + x] +
        current[south + east];

      const alive = current[idx] === 1;
      if (alive) {
        next[idx] = aliveNeighbors === 2 || aliveNeighbors === 3 ? 1 : 0;
        decay[idx] = 255;
      } else {
        next[idx] = aliveNeighbors === 3 ? 1 : 0;
        decay[idx] = decay[idx] > HEAT_FADE ? decay[idx] - HEAT_FADE : 0;
      }
    }
  }

  simulation.current = next;
  simulation.next = current;
}

function advanceSimulation(simulation: MatrixSimulation) {
  const perf = (globalThis as any).performance;
  const nowMs = perf && typeof perf.now === 'function' ? perf.now() : Date.now();

  if (!Number.isFinite(nowMs)) return;
  if (simulation.lastTickMs < 0) {
    simulation.lastTickMs = nowMs;
    return;
  }

  const deltaMs = nowMs - simulation.lastTickMs;
  simulation.lastTickMs = nowMs;
  if (deltaMs <= 0) return;

  simulation.accumulatorMs = Math.min(simulation.accumulatorMs + deltaMs, STEP_MS * 6);
  while (simulation.accumulatorMs >= STEP_MS) {
    stepSimulation(simulation);
    simulation.accumulatorMs -= STEP_MS;
  }
}

export function renderProjection(simulation: MatrixSimulation, effect: any, physicalSize: number) {
  advanceSimulation(simulation);

  const width = effect.width | 0;
  const height = effect.height | 0;
  if (width <= 0 || height <= 0) return;

  const scaleX = MATRIX_SIZE / width;
  const scaleY = MATRIX_SIZE / height;
  const scanlines = physicalSize >= 128;

  for (let y = 0; y < height; y++) {
    let logicalY = (y * scaleY) | 0;
    if (logicalY >= MATRIX_SIZE) logicalY = MATRIX_SIZE - 1;
    const rowBase = logicalY * MATRIX_SIZE;
    const dimLine = scanlines && (y & 3) === 0;

    for (let x = 0; x < width; x++) {
      let logicalX = (x * scaleX) | 0;
      if (logicalX >= MATRIX_SIZE) logicalX = MATRIX_SIZE - 1;

      const colorBase = simulation.decay[rowBase + logicalX] * 4;
      let red = simulation.colorMap[colorBase];
      let green = simulation.colorMap[colorBase + 1];
      let blue = simulation.colorMap[colorBase + 2];

      if (dimLine) {
        red = (red * 0.92) | 0;
        green = (green * 0.92) | 0;
        blue = (blue * 0.92) | 0;
      }

      effect.setPixelRaw(x, y, red, green, blue, 255);
    }
  }
}
