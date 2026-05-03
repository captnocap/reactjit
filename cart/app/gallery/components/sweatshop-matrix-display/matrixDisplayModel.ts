export const LOGICAL_SIZE = 256;
export const MAIN_STAGE_SIZE = 512;
export const PROJECTION_SIZES = [256, 128, 64, 32, 16] as const;
export const SPEED_PRESETS = [0.45, 0.7, 1.0, 1.3, 1.65, 2.1] as const;
export const GAIN_PRESETS = [0.45, 0.65, 0.85, 1.0, 1.2, 1.35] as const;
export const UI_TICK_MS = 120;

const RAIN_DROP_COUNT = 80;
const LIFE_STEP_SEC = 0.085;
const BRAILLE_BASE = 0x2800;

export type ChannelId = 'plasma' | 'ripple' | 'sweep' | 'rain' | 'life' | 'noise' | 'orbit' | 'tunnel' | 'bars' | 'grid';
export type PaletteId = 'amber' | 'red' | 'teal' | 'mono';
export type ProjectionSize = (typeof PROJECTION_SIZES)[number];
export type BrailleProjectionTheme = {
  labelText: string;
  metaText: string;
  surfaceBorder: string;
  surfaceBackground: string;
};

export type ChannelDef = {
  id: ChannelId;
  label: string;
  sub: string;
  code: string;
};

export type PaletteDef = {
  id: PaletteId;
  label: string;
  accent: string;
  lut: Uint8Array;
};

export const DEFAULT_BRAILLE_PROJECTION_THEME: BrailleProjectionTheme = {
  labelText: '#d26a2a',
  metaText: '#7a6e5d',
  surfaceBorder: '#3a2a1e',
  surfaceBackground: '#0e0b09',
};

export function resolveBrailleProjectionTheme(
  overrides?: Partial<BrailleProjectionTheme>
): BrailleProjectionTheme {
  if (!overrides) return DEFAULT_BRAILLE_PROJECTION_THEME;
  return {
    ...DEFAULT_BRAILLE_PROJECTION_THEME,
    ...overrides,
  };
}

type RainDrop = {
  x: number;
  y: number;
  speed: number;
  length: number;
};

export type InstrumentSimulation = {
  field: Float32Array;
  lifeA: Uint8Array;
  lifeB: Uint8Array;
  rainDrops: RainDrop[];
  seed: number;
  timeSec: number;
  lastUpdateMs: number;
  lastLifeStepSec: number;
  fps: number;
  drawMs: number;
  signal: number;
  fpsWindowMs: number;
  fpsFrames: number;
};

export const CHANNELS: ChannelDef[] = [
  { id: 'plasma', label: 'plasma', sub: 'sine field', code: 'CH01' },
  { id: 'ripple', label: 'ripple', sub: 'wave pulse', code: 'CH02' },
  { id: 'sweep', label: 'sweep', sub: 'radar', code: 'CH03' },
  { id: 'rain', label: 'rain', sub: 'matrix drop', code: 'CH04' },
  { id: 'life', label: 'life', sub: 'automata', code: 'CH05' },
  { id: 'noise', label: 'noise', sub: 'static', code: 'CH06' },
  { id: 'orbit', label: 'orbit', sub: 'spirograph', code: 'CH07' },
  { id: 'tunnel', label: 'tunnel', sub: 'zoom', code: 'CH08' },
  { id: 'bars', label: 'bars', sub: 'equalizer', code: 'CH09' },
  { id: 'grid', label: 'grid', sub: 'pulse net', code: 'CH10' },
];

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function mixByte(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function buildPalette(stops: Array<[number, [number, number, number]]>): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let start = stops[0];
    let end = stops[stops.length - 1];
    for (let index = 0; index < stops.length - 1; index++) {
      if (t >= stops[index][0] && t <= stops[index + 1][0]) {
        start = stops[index];
        end = stops[index + 1];
        break;
      }
    }
    const span = end[0] - start[0] || 1;
    const local = (t - start[0]) / span;
    lut[i * 3] = mixByte(start[1][0], end[1][0], local);
    lut[i * 3 + 1] = mixByte(start[1][1], end[1][1], local);
    lut[i * 3 + 2] = mixByte(start[1][2], end[1][2], local);
  }
  return lut;
}

export const PALETTES: PaletteDef[] = [
  {
    id: 'amber',
    label: 'amber',
    accent: '#d26a2a',
    lut: buildPalette([
      [0.0, [8, 4, 2]],
      [0.25, [48, 20, 8]],
      [0.55, [138, 74, 32]],
      [0.8, [210, 106, 42]],
      [1.0, [255, 210, 140]],
    ]),
  },
  {
    id: 'red',
    label: 'red',
    accent: '#e14a2a',
    lut: buildPalette([
      [0.0, [6, 3, 3]],
      [0.3, [60, 12, 8]],
      [0.65, [180, 40, 20]],
      [0.85, [232, 80, 28]],
      [1.0, [255, 180, 130]],
    ]),
  },
  {
    id: 'teal',
    label: 'teal',
    accent: '#6aa390',
    lut: buildPalette([
      [0.0, [4, 8, 8]],
      [0.3, [14, 40, 40]],
      [0.6, [42, 110, 100]],
      [0.85, [106, 163, 144]],
      [1.0, [196, 240, 220]],
    ]),
  },
  {
    id: 'mono',
    label: 'mono',
    accent: '#e8dcc4',
    lut: buildPalette([
      [0.0, [4, 4, 4]],
      [0.5, [90, 84, 76]],
      [0.85, [210, 196, 176]],
      [1.0, [255, 246, 232]],
    ]),
  },
];

export function getChannel(id: ChannelId): ChannelDef {
  return CHANNELS.find((channel) => channel.id === id) || CHANNELS[0];
}

export function getPalette(id: PaletteId): PaletteDef {
  return PALETTES.find((palette) => palette.id === id) || PALETTES[0];
}

function nextRandom(simulation: InstrumentSimulation): number {
  simulation.seed = (Math.imul(simulation.seed, 1664525) + 1013904223) >>> 0;
  return simulation.seed / 0x100000000;
}

function hashNoise(x: number, y: number, phase: number): number {
  let h = Math.imul((x | 0) + phase * 31, 374761393) ^ Math.imul((y | 0) - phase * 17, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function reseedLife(simulation: InstrumentSimulation) {
  for (let index = 0; index < simulation.lifeA.length; index++) {
    simulation.lifeA[index] = nextRandom(simulation) < 0.31 ? 1 : 0;
    simulation.lifeB[index] = 0;
  }
}

export function createInstrumentSimulation(): InstrumentSimulation {
  const simulation: InstrumentSimulation = {
    field: new Float32Array(LOGICAL_SIZE * LOGICAL_SIZE),
    lifeA: new Uint8Array(LOGICAL_SIZE * LOGICAL_SIZE),
    lifeB: new Uint8Array(LOGICAL_SIZE * LOGICAL_SIZE),
    rainDrops: [],
    seed: 0x4d545831,
    timeSec: 0,
    lastUpdateMs: -1,
    lastLifeStepSec: 0,
    fps: 0,
    drawMs: 0,
    signal: 0,
    fpsWindowMs: 0,
    fpsFrames: 0,
  };

  reseedLife(simulation);

  for (let index = 0; index < RAIN_DROP_COUNT; index++) {
    simulation.rainDrops.push({
      x: Math.floor(nextRandom(simulation) * LOGICAL_SIZE),
      y: nextRandom(simulation) * LOGICAL_SIZE,
      speed: 0.5 + nextRandom(simulation) * 2.5,
      length: 8 + Math.floor(nextRandom(simulation) * 28),
    });
  }

  return simulation;
}

export function resetInstrumentChannel(simulation: InstrumentSimulation, channelId: ChannelId) {
  simulation.field.fill(0);
  simulation.timeSec = 0;
  simulation.lastUpdateMs = -1;
  simulation.lastLifeStepSec = 0;
  simulation.fps = 0;
  simulation.drawMs = 0;
  simulation.signal = 0;
  simulation.fpsWindowMs = 0;
  simulation.fpsFrames = 0;
  if (channelId === 'life') reseedLife(simulation);
}

function estimateSignal(field: Float32Array): number {
  let total = 0;
  let count = 0;
  for (let y = 0; y < LOGICAL_SIZE; y += 8) {
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x += 8) {
      total += field[rowBase + x];
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

function renderPlasma(field: Float32Array, timeSec: number) {
  for (let y = 0; y < LOGICAL_SIZE; y++) {
    const yn = y / LOGICAL_SIZE - 0.5;
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x++) {
      const xn = x / LOGICAL_SIZE - 0.5;
      const value =
        Math.sin(xn * 10 + timeSec * 1.2) +
        Math.sin(yn * 10 + timeSec * 1.5) +
        Math.sin((xn + yn) * 8 + timeSec * 0.8) +
        Math.sin(Math.sqrt(xn * xn + yn * yn) * 14 - timeSec * 2.0);
      field[rowBase + x] = clamp01((value + 4) / 8);
    }
  }
}

function renderRipple(field: Float32Array, timeSec: number) {
  const centerX = LOGICAL_SIZE * 0.5;
  const centerY = LOGICAL_SIZE * 0.5;
  for (let y = 0; y < LOGICAL_SIZE; y++) {
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const wave = 0.5 + 0.5 * Math.sin(distance * 0.35 - timeSec * 3.5);
      const falloff = Math.max(0, 1 - distance / 180);
      field[rowBase + x] = clamp01(wave * falloff);
    }
  }
}

function renderSweep(field: Float32Array, timeSec: number) {
  const centerX = LOGICAL_SIZE * 0.5;
  const centerY = LOGICAL_SIZE * 0.5;
  const angle = (timeSec * 0.8) % (Math.PI * 2);
  for (let y = 0; y < LOGICAL_SIZE; y++) {
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      let delta = Math.atan2(dy, dx) - angle;
      while (delta < 0) delta += Math.PI * 2;
      while (delta > Math.PI * 2) delta -= Math.PI * 2;
      const tail = Math.exp(-delta * 2.2);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const ring = 0.15 + 0.25 * Math.sin(distance * 0.2 - timeSec * 1.2);
      const edge = Math.max(0, 1 - distance / 130);
      field[rowBase + x] = clamp01(tail * edge + ring * edge * 0.3);
    }
  }
}

function renderRain(simulation: InstrumentSimulation, dtSec: number) {
  for (let index = 0; index < simulation.field.length; index++) simulation.field[index] *= 0.78;

  for (const drop of simulation.rainDrops) {
    drop.y += drop.speed * dtSec * 52;
    if (drop.y - drop.length > LOGICAL_SIZE) {
      drop.y = -nextRandom(simulation) * 20;
      drop.x = Math.floor(nextRandom(simulation) * LOGICAL_SIZE);
      drop.speed = 0.5 + nextRandom(simulation) * 2.5;
      drop.length = 8 + Math.floor(nextRandom(simulation) * 28);
    }

    const headY = Math.floor(drop.y);
    for (let offset = 0; offset < drop.length; offset++) {
      const yy = headY - offset;
      if (yy < 0 || yy >= LOGICAL_SIZE) continue;
      const value = offset === 0 ? 1 : Math.max(0, 1 - offset / drop.length) * 0.85;
      const index = yy * LOGICAL_SIZE + drop.x;
      if (simulation.field[index] < value) simulation.field[index] = value;
    }
  }
}

function renderLife(simulation: InstrumentSimulation, timeSec: number) {
  if (timeSec - simulation.lastLifeStepSec >= LIFE_STEP_SEC) {
    simulation.lastLifeStepSec = timeSec;
    for (let y = 0; y < LOGICAL_SIZE; y++) {
      const north = ((y + LOGICAL_SIZE - 1) % LOGICAL_SIZE) * LOGICAL_SIZE;
      const center = y * LOGICAL_SIZE;
      const south = ((y + 1) % LOGICAL_SIZE) * LOGICAL_SIZE;
      for (let x = 0; x < LOGICAL_SIZE; x++) {
        const west = x === 0 ? LOGICAL_SIZE - 1 : x - 1;
        const east = x === LOGICAL_SIZE - 1 ? 0 : x + 1;
        const aliveNeighbors =
          simulation.lifeA[north + west] +
          simulation.lifeA[north + x] +
          simulation.lifeA[north + east] +
          simulation.lifeA[center + west] +
          simulation.lifeA[center + east] +
          simulation.lifeA[south + west] +
          simulation.lifeA[south + x] +
          simulation.lifeA[south + east];
        const index = center + x;
        const here = simulation.lifeA[index];
        let next = 0;
        if (here && (aliveNeighbors === 2 || aliveNeighbors === 3)) next = 1;
        if (!here && aliveNeighbors === 3) next = 1;
        simulation.lifeB[index] = next;
      }
    }

    let alive = 0;
    for (let index = 0; index < simulation.lifeB.length; index++) alive += simulation.lifeB[index];
    if (alive < simulation.lifeB.length * 0.03) reseedLife(simulation);
    else {
      const swap = simulation.lifeA;
      simulation.lifeA = simulation.lifeB;
      simulation.lifeB = swap;
    }
  }

  for (let index = 0; index < simulation.field.length; index++) {
    simulation.field[index] *= 0.8;
    if (simulation.lifeA[index]) simulation.field[index] = 1;
  }
}

function renderNoise(field: Float32Array, timeSec: number) {
  const phase = Math.floor(timeSec * 18);
  const bias = 0.4 + 0.3 * Math.sin(timeSec * 0.7);
  for (let y = 0; y < LOGICAL_SIZE; y++) {
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x++) {
      field[rowBase + x] = Math.pow(hashNoise(x, y, phase), 1.6) * bias;
    }
  }
}

function renderOrbit(field: Float32Array, timeSec: number) {
  for (let index = 0; index < field.length; index++) field[index] *= 0.84;

  const centerX = LOGICAL_SIZE * 0.5;
  const centerY = LOGICAL_SIZE * 0.5;
  for (let ring = 0; ring < 3; ring++) {
    const radiusOuter = 60 + ring * 14;
    const radiusInner = 18 + ring * 6;
    for (let step = 0; step < 220; step++) {
      const angle = (step / 220) * Math.PI * 12 + timeSec * (0.8 + ring * 0.2);
      const px = Math.floor(
        centerX +
          (radiusOuter - radiusInner) * Math.cos(angle) +
          radiusInner * Math.cos(((radiusOuter - radiusInner) / radiusInner) * angle + timeSec * 0.5)
      );
      const py = Math.floor(
        centerY +
          (radiusOuter - radiusInner) * Math.sin(angle) -
          radiusInner * Math.sin(((radiusOuter - radiusInner) / radiusInner) * angle + timeSec * 0.5)
      );
      if (px < 0 || px >= LOGICAL_SIZE || py < 0 || py >= LOGICAL_SIZE) continue;
      const index = py * LOGICAL_SIZE + px;
      field[index] = 1;
      if (px > 0) field[index - 1] = Math.max(field[index - 1], 0.55);
      if (px < LOGICAL_SIZE - 1) field[index + 1] = Math.max(field[index + 1], 0.55);
      if (py > 0) field[index - LOGICAL_SIZE] = Math.max(field[index - LOGICAL_SIZE], 0.55);
      if (py < LOGICAL_SIZE - 1) field[index + LOGICAL_SIZE] = Math.max(field[index + LOGICAL_SIZE], 0.55);
    }
  }
}

function renderTunnel(field: Float32Array, timeSec: number) {
  const centerX = LOGICAL_SIZE * 0.5;
  const centerY = LOGICAL_SIZE * 0.5;
  for (let y = 0; y < LOGICAL_SIZE; y++) {
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const angle = Math.atan2(dy, dx);
      const rings = 0.5 + 0.5 * Math.sin((32 / distance) * 3 + angle * 6 / Math.PI + timeSec * 2.4);
      const spokes = 0.5 + 0.5 * Math.sin(angle * 8 + timeSec);
      const falloff = Math.min(1, distance / 10);
      field[rowBase + x] = clamp01(rings * 0.75 + spokes * 0.25) * falloff;
    }
  }
}

function renderBars(field: Float32Array, timeSec: number) {
  const barCount = 32;
  const barWidth = LOGICAL_SIZE / barCount;
  field.fill(0);

  for (let bar = 0; bar < barCount; bar++) {
    const heightRatio =
      0.5 +
      0.45 * Math.sin(timeSec * (1 + (bar % 5) * 0.15) + bar * 0.7) *
        (0.5 + 0.5 * Math.sin(timeSec * 0.4 + bar));
    const barHeight = Math.floor(Math.max(0.04, heightRatio) * LOGICAL_SIZE);
    const x0 = Math.floor(bar * barWidth);
    const x1 = Math.floor((bar + 1) * barWidth) - 1;
    const topY = LOGICAL_SIZE - barHeight;
    for (let y = topY; y < LOGICAL_SIZE; y++) {
      const gradient = (y - topY) / Math.max(1, barHeight);
      const rowBase = y * LOGICAL_SIZE;
      for (let x = x0; x <= x1; x++) {
        field[rowBase + x] = 0.35 + gradient * 0.65;
      }
    }
  }
}

function renderGrid(field: Float32Array, timeSec: number) {
  for (let y = 0; y < LOGICAL_SIZE; y++) {
    const rowBase = y * LOGICAL_SIZE;
    for (let x = 0; x < LOGICAL_SIZE; x++) {
      const onX = x % 16 === 0;
      const onY = y % 16 === 0;
      const localX = x % 16;
      const localY = y % 16;
      const nearNode = (localX <= 1 || localX >= 15) && (localY <= 1 || localY >= 15);
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3 + (x + y) * 0.05);
      let value = 0;
      if (onX || onY) value = 0.25 + 0.25 * pulse;
      if (nearNode) value = 0.9 * pulse + 0.1;
      const scan = 0.5 + 0.5 * Math.sin(timeSec * 0.8 - x * 0.04 - y * 0.04);
      field[rowBase + x] = clamp01(value * (0.6 + scan * 0.4));
    }
  }
}

function renderChannel(simulation: InstrumentSimulation, channelId: ChannelId, dtSec: number) {
  switch (channelId) {
    case 'plasma':
      renderPlasma(simulation.field, simulation.timeSec);
      break;
    case 'ripple':
      renderRipple(simulation.field, simulation.timeSec);
      break;
    case 'sweep':
      renderSweep(simulation.field, simulation.timeSec);
      break;
    case 'rain':
      renderRain(simulation, dtSec);
      break;
    case 'life':
      renderLife(simulation, simulation.timeSec);
      break;
    case 'noise':
      renderNoise(simulation.field, simulation.timeSec);
      break;
    case 'orbit':
      renderOrbit(simulation.field, simulation.timeSec);
      break;
    case 'tunnel':
      renderTunnel(simulation.field, simulation.timeSec);
      break;
    case 'bars':
      renderBars(simulation.field, simulation.timeSec);
      break;
    case 'grid':
      renderGrid(simulation.field, simulation.timeSec);
      break;
  }
}

function advanceSimulation(simulation: InstrumentSimulation, channelId: ChannelId, speed: number) {
  const perf = (globalThis as any).performance;
  const nowMs = perf && typeof perf.now === 'function' ? perf.now() : Date.now();
  if (!Number.isFinite(nowMs)) return;

  let deltaMs = 16;
  if (simulation.lastUpdateMs >= 0) {
    deltaMs = nowMs - simulation.lastUpdateMs;
    if (deltaMs < 14) return;
  }
  simulation.lastUpdateMs = nowMs;

  const dtSec = Math.min(0.12, deltaMs / 1000);
  simulation.timeSec += dtSec * speed;

  const drawStart = perf && typeof perf.now === 'function' ? perf.now() : Date.now();
  renderChannel(simulation, channelId, dtSec);
  const drawEnd = perf && typeof perf.now === 'function' ? perf.now() : Date.now();

  const drawMs = Math.max(0, drawEnd - drawStart);
  simulation.drawMs = simulation.drawMs > 0 ? simulation.drawMs * 0.84 + drawMs * 0.16 : drawMs;
  simulation.signal = estimateSignal(simulation.field);
  simulation.fpsWindowMs += deltaMs;
  simulation.fpsFrames += 1;
  if (simulation.fpsWindowMs >= 480) {
    simulation.fps = Math.round((simulation.fpsFrames * 1000) / simulation.fpsWindowMs);
    simulation.fpsWindowMs = 0;
    simulation.fpsFrames = 0;
  }
}

export function renderSurface(
  simulation: InstrumentSimulation,
  effect: any,
  physicalSize: number,
  channelId: ChannelId,
  paletteId: PaletteId,
  speed: number,
  gain: number
) {
  advanceSimulation(simulation, channelId, speed);

  const width = effect.width | 0;
  const height = effect.height | 0;
  if (width <= 0 || height <= 0) return;

  const palette = getPalette(paletteId).lut;
  const scaleX = LOGICAL_SIZE / width;
  const scaleY = LOGICAL_SIZE / height;

  for (let y = 0; y < height; y++) {
    let logicalY = (y * scaleY) | 0;
    if (logicalY >= LOGICAL_SIZE) logicalY = LOGICAL_SIZE - 1;
    const rowBase = logicalY * LOGICAL_SIZE;
    const scanlineShade =
      physicalSize >= MAIN_STAGE_SIZE ? ((y & 1) === 0 ? 0.84 : 1) :
      physicalSize >= 256 ? ((y & 3) === 0 ? 0.9 : 1) :
      physicalSize >= 128 ? ((y & 3) === 0 ? 0.94 : 1) :
      1;

    for (let x = 0; x < width; x++) {
      let logicalX = (x * scaleX) | 0;
      if (logicalX >= LOGICAL_SIZE) logicalX = LOGICAL_SIZE - 1;

      let value = simulation.field[rowBase + logicalX] * gain;
      if (value < 0) value = 0;
      if (value > 1) value = 1;

      const lutIndex = ((value * 255) | 0) * 3;
      effect.setPixelRaw(
        x,
        y,
        (palette[lutIndex] * scanlineShade) | 0,
        (palette[lutIndex + 1] * scanlineShade) | 0,
        (palette[lutIndex + 2] * scanlineShade) | 0,
        255
      );
    }
  }
}

function dotBit(x: number, y: number): number {
  if (x === 0) {
    if (y === 0) return 0x01;
    if (y === 1) return 0x02;
    if (y === 2) return 0x04;
    return 0x40;
  }
  if (y === 0) return 0x08;
  if (y === 1) return 0x10;
  if (y === 2) return 0x20;
  return 0x80;
}

function brailleChar(bits: number): string {
  return String.fromCharCode(BRAILLE_BASE + bits);
}

function buildBrailleBlock(
  field: Float32Array,
  startX: number,
  startY: number,
  sourceWidth: number,
  sourceHeight: number,
  cols: number,
  rows: number,
  threshold = 0.34
): string[] {
  const lines: string[] = [];
  const pixelWidth = cols * 2;
  const pixelHeight = rows * 4;
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      let bits = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = startX + Math.floor(((col * 2 + dx + 0.5) / pixelWidth) * sourceWidth);
          const sy = startY + Math.floor(((row * 4 + dy + 0.5) / pixelHeight) * sourceHeight);
          const clampedX = Math.max(0, Math.min(LOGICAL_SIZE - 1, sx));
          const clampedY = Math.max(0, Math.min(LOGICAL_SIZE - 1, sy));
          if (field[clampedY * LOGICAL_SIZE + clampedX] > threshold) bits |= dotBit(dx, dy);
        }
      }
      line += brailleChar(bits);
    }
    lines.push(line);
  }
  return lines;
}

export function buildTelemetryLines(field: Float32Array): string[] {
  return buildBrailleBlock(field, 18, 28, 220, 120, 28, 4);
}

export function buildProjectionSignature(field: Float32Array, size: ProjectionSize): string {
  const cols = size >= 256 ? 18 : size >= 128 ? 14 : size >= 64 ? 10 : 8;
  return buildBrailleBlock(field, 16, 168, 224, 24, cols, 1, 0.32)[0];
}

export function formatPhysicalScale(size: number): string {
  if (size === LOGICAL_SIZE) return 'native 1:1';
  if (size > LOGICAL_SIZE) return `up x${(size / LOGICAL_SIZE).toFixed(1)}`;
  return `down 1:${LOGICAL_SIZE / size}`;
}

export function signalHeadline(channel: ChannelDef, signal: number): string {
  const resonance = (1.2 + signal * 2.8).toFixed(1);
  const load = Math.round(signal * 100);
  return `${load}% ▸ ${channel.label.toUpperCase()} ${resonance}`;
}
