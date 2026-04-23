import { useRef } from 'react';
import { Box, Col, Effect, Row, Text } from '../../../../runtime/primitives';

export type MatrixScalingDashboardProps = {};

const MATRIX_SIZE = 256;
const PANEL_SIZES = [512, 256, 128, 64, 32, 16] as const;
const STEP_MS = 48;
const HEAT_FADE = 2;
const INJECTION_INTERVAL = 45;
const INJECTION_SIZE = 10;
const INITIAL_SEED = 0x51f15eed;

type PanelSize = (typeof PANEL_SIZES)[number];

type Simulation = {
  current: Uint8Array;
  next: Uint8Array;
  decay: Uint8Array;
  colorMap: Uint8Array;
  seed: number;
  accumulatorMs: number;
  lastTickMs: number;
  stepCount: number;
};

function gridGlyph() {
  return (
    <Col style={{ gap: 3 }}>
      {[0, 1].map((rowIndex) => (
        <Row key={`glyph-row-${rowIndex}`} style={{ gap: 3 }}>
          {[0, 1].map((colIndex) => (
            <Box
              key={`glyph-cell-${rowIndex}-${colIndex}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: rowIndex === colIndex ? '#31d3a0' : '#0f5676',
                borderWidth: 1,
                borderColor: '#143746',
              }}
            />
          ))}
        </Row>
      ))}
    </Col>
  );
}

function deviceLabel(size: PanelSize): string {
  if (size >= 512) return 'wall';
  if (size >= 256) return 'desktop';
  if (size >= 128) return 'tablet';
  if (size >= 64) return 'phone';
  return 'wearable';
}

function projectionLabel(size: PanelSize): string {
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

    if (i === 0) {
      r = 5;
      g = 10;
      b = 21;
    } else if (i < 85) {
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

function nextRandom(simulation: Simulation): number {
  simulation.seed = (Math.imul(simulation.seed, 1664525) + 1013904223) >>> 0;
  return simulation.seed / 0x100000000;
}

function injectNoise(simulation: Simulation) {
  const startX = Math.floor(nextRandom(simulation) * (MATRIX_SIZE - INJECTION_SIZE));
  const startY = Math.floor(nextRandom(simulation) * (MATRIX_SIZE - INJECTION_SIZE));
  for (let dy = 0; dy < INJECTION_SIZE; dy++) {
    const rowBase = (startY + dy) * MATRIX_SIZE + startX;
    for (let dx = 0; dx < INJECTION_SIZE; dx++) {
      if (nextRandom(simulation) > 0.5) simulation.current[rowBase + dx] = 1;
    }
  }
}

function createSimulation(): Simulation {
  const numCells = MATRIX_SIZE * MATRIX_SIZE;
  const simulation: Simulation = {
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

function stepSimulation(simulation: Simulation) {
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

function advanceSimulation(simulation: Simulation) {
  const perf = (globalThis as any).performance;
  const nowMs =
    perf && typeof perf.now === 'function'
      ? perf.now()
      : Date.now();

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

function renderMatrix(simulation: Simulation, effect: any, size: PanelSize) {
  advanceSimulation(simulation);

  const width = effect.width | 0;
  const height = effect.height | 0;
  if (width <= 0 || height <= 0) return;

  const colorMap = simulation.colorMap;
  const decay = simulation.decay;
  const scaleX = MATRIX_SIZE / width;
  const scaleY = MATRIX_SIZE / height;
  const scanlines = size >= 128;

  for (let y = 0; y < height; y++) {
    let logicalY = (y * scaleY) | 0;
    if (logicalY >= MATRIX_SIZE) logicalY = MATRIX_SIZE - 1;
    const rowBase = logicalY * MATRIX_SIZE;
    const dimLine = scanlines && (y & 3) === 0;

    for (let x = 0; x < width; x++) {
      let logicalX = (x * scaleX) | 0;
      if (logicalX >= MATRIX_SIZE) logicalX = MATRIX_SIZE - 1;

      const colorBase = decay[rowBase + logicalX] * 4;
      let r = colorMap[colorBase];
      let g = colorMap[colorBase + 1];
      let b = colorMap[colorBase + 2];

      if (dimLine) {
        r = (r * 0.92) | 0;
        g = (g * 0.92) | 0;
        b = (b * 0.92) | 0;
      }

      effect.setPixelRaw(x, y, r, g, b, 255);
    }
  }
}

function MatrixViewport({
  size,
  simulation,
}: {
  size: PanelSize;
  simulation: Simulation;
}) {
  const isNative = size === MATRIX_SIZE;
  return (
    <Col style={{ alignItems: 'center', gap: 10 }}>
      <Row
        style={{
          width: size + 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Box
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 999,
            backgroundColor: '#08283b',
            borderWidth: 1,
            borderColor: '#154861',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#63dcff', fontFamily: 'monospace' }}>
            {`${size}x${size}`}
          </Text>
        </Box>

        <Text style={{ fontSize: 10, color: '#4a6675', fontFamily: 'monospace' }}>{deviceLabel(size)}</Text>
      </Row>

      <Box
        style={{
          width: size + 10,
          height: size + 10,
          padding: 4,
          borderRadius: isNative ? 8 : 10,
          backgroundColor: '#020409',
          borderWidth: 1,
          borderColor: isNative ? '#2de0a6' : '#33495a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Effect
          onRender={(effect: any) => renderMatrix(simulation, effect, size)}
          style={{ width: size, height: size }}
        />

        {size >= 128 ? (
          <Box
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 1,
              backgroundColor: '#ffffff10',
              opacity: 0.65,
            }}
          />
        ) : null}
      </Box>

      <Text style={{ fontSize: 10, color: '#6b8294', fontFamily: 'monospace', textTransform: 'uppercase' }}>
        {projectionLabel(size)}
      </Text>
    </Col>
  );
}

export function MatrixScalingDashboard(_props: MatrixScalingDashboardProps) {
  const simulationRef = useRef<Simulation | null>(null);
  if (!simulationRef.current) simulationRef.current = createSimulation();
  const simulation = simulationRef.current;

  return (
    <Box
      style={{
        width: '100%',
        minHeight: 760,
        padding: 28,
        borderRadius: 26,
        backgroundColor: '#02060d',
        borderWidth: 1,
        borderColor: '#163041',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          left: -60,
          top: -40,
          width: 220,
          height: 220,
          borderRadius: 220,
          backgroundColor: '#073c43',
          opacity: 0.2,
        }}
      />
      <Box
        style={{
          position: 'absolute',
          right: -80,
          bottom: -90,
          width: 280,
          height: 280,
          borderRadius: 280,
          backgroundColor: '#1d0f35',
          opacity: 0.24,
        }}
      />

      <Col style={{ width: '100%', gap: 22, position: 'relative' }}>
        <Col
          style={{
            width: '100%',
            gap: 10,
            paddingBottom: 18,
            borderBottomWidth: 1,
            borderBottomColor: '#102330',
          }}
        >
          <Row style={{ alignItems: 'center', gap: 14 }}>
            {gridGlyph()}
            <Col style={{ gap: 3 }}>
              <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#f4f8fb' }}>Matrix Array</Text>
              <Text style={{ fontSize: 11, color: '#4fb5d4', fontFamily: 'monospace' }}>
                Shared logical field • multi-surface pixel projection
              </Text>
            </Col>
          </Row>

          <Text
            style={{
              width: 760,
              fontSize: 12,
              color: '#75889a',
              lineHeight: 18,
              fontFamily: 'monospace',
            }}
          >
            {`A seeded ${MATRIX_SIZE}x${MATRIX_SIZE} cellular matrix drives six fixed buffers at once. Each panel rasterizes the same logical automaton at a different physical resolution so the square field can be inspected as it scales from 512px down to 16px.`}
          </Text>

          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {[
              `${MATRIX_SIZE * MATRIX_SIZE} logical cells`,
              `${PANEL_SIZES.length} physical targets`,
              'seeded heat trail',
            ].map((label) => (
              <Box
                key={label}
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 999,
                  backgroundColor: '#091826',
                  borderWidth: 1,
                  borderColor: '#17354b',
                }}
              >
                <Text style={{ fontSize: 10, color: '#85a4ba', fontFamily: 'monospace' }}>{label}</Text>
              </Box>
            ))}
          </Row>
        </Col>

        <Row
          style={{
            width: '100%',
            flexWrap: 'wrap',
            gap: 22,
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          {PANEL_SIZES.map((size) => (
            <MatrixViewport key={size} size={size} simulation={simulation} />
          ))}
        </Row>
      </Col>
    </Box>
  );
}
