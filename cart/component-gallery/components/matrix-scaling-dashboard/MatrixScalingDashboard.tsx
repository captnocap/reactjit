import { useRef } from 'react';
import { Box, Col, Effect, Row, Text } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';

export type MatrixScalingDashboardProps = {
  theme?: Partial<MatrixScalingTheme>;
};

const MATRIX_SIZE = 256;
const PANEL_SIZES = [512, 256, 128, 64, 32, 16] as const;
const STEP_MS = 48;
const HEAT_FADE = 2;
const INJECTION_INTERVAL = 45;
const INJECTION_SIZE = 10;
const INITIAL_SEED = 0x51f15eed;

type PanelSize = (typeof PANEL_SIZES)[number];
type MatrixColorStop = readonly [number, readonly [number, number, number]];

type Simulation = {
  current: Uint8Array;
  next: Uint8Array;
  decay: Uint8Array;
  colorMap: Uint8Array;
  seed: number;
  accumulatorMs: number;
  lastTickMs: number;
  stepCount: number;
  themeSignature: string;
};

export type MatrixScalingTheme = {
  pageBackground: string;
  pageBorder: string;
  glowPrimary: string;
  glowSecondary: string;
  headerRule: string;
  titleText: string;
  subtitleText: string;
  bodyText: string;
  chipBackground: string;
  chipBorder: string;
  chipText: string;
  glyphOn: string;
  glyphOff: string;
  glyphBorder: string;
  labelBackground: string;
  labelBackgroundNative: string;
  labelBorder: string;
  labelBorderNative: string;
  labelText: string;
  labelTextNative: string;
  deviceText: string;
  panelBackground: string;
  panelBorder: string;
  panelBorderNative: string;
  footerText: string;
  scanlineColor: string;
  scanlineOpacity: number;
  scanlineShade: number;
  heatStops: readonly MatrixColorStop[];
};

export const DEFAULT_MATRIX_SCALING_THEME: MatrixScalingTheme = {
  pageBackground: '#02060d',
  pageBorder: '#163041',
  glowPrimary: '#073c43',
  glowSecondary: '#1d0f35',
  headerRule: '#102330',
  titleText: '#f4f8fb',
  subtitleText: '#4fb5d4',
  bodyText: '#75889a',
  chipBackground: '#091826',
  chipBorder: '#17354b',
  chipText: '#85a4ba',
  glyphOn: '#31d3a0',
  glyphOff: '#0f5676',
  glyphBorder: '#143746',
  labelBackground: '#08283b',
  labelBackgroundNative: '#103d33',
  labelBorder: '#154861',
  labelBorderNative: '#6aa390',
  labelText: '#63dcff',
  labelTextNative: '#b2ffdf',
  deviceText: '#4a6675',
  panelBackground: '#020409',
  panelBorder: '#33495a',
  panelBorderNative: '#6aa390',
  footerText: '#6b8294',
  scanlineColor: '#f2e8dc',
  scanlineOpacity: 0.08,
  scanlineShade: 0.92,
  heatStops: [
    [0.0, [5, 10, 21]],
    [0.333, [14, 165, 233]],
    [0.666, [192, 38, 211]],
    [0.999, [52, 211, 153]],
    [1.0, [255, 255, 255]],
  ],
};

export function resolveMatrixScalingTheme(overrides?: Partial<MatrixScalingTheme>): MatrixScalingTheme {
  if (!overrides) return DEFAULT_MATRIX_SCALING_THEME;
  return {
    ...DEFAULT_MATRIX_SCALING_THEME,
    ...overrides,
    heatStops: overrides.heatStops || DEFAULT_MATRIX_SCALING_THEME.heatStops,
  };
}

function themeSignature(theme: MatrixScalingTheme): string {
  const stops = theme.heatStops
    .map((stop) => `${stop[0]}:${stop[1][0]}-${stop[1][1]}-${stop[1][2]}`)
    .join('|');

  return [
    theme.pageBackground,
    theme.pageBorder,
    theme.glowPrimary,
    theme.glowSecondary,
    theme.headerRule,
    theme.titleText,
    theme.subtitleText,
    theme.bodyText,
    theme.chipBackground,
    theme.chipBorder,
    theme.chipText,
    theme.glyphOn,
    theme.glyphOff,
    theme.glyphBorder,
    theme.labelBackground,
    theme.labelBackgroundNative,
    theme.labelBorder,
    theme.labelBorderNative,
    theme.labelText,
    theme.labelTextNative,
    theme.deviceText,
    theme.panelBackground,
    theme.panelBorder,
    theme.panelBorderNative,
    theme.footerText,
    theme.scanlineColor,
    String(theme.scanlineOpacity),
    String(theme.scanlineShade),
    stops,
  ].join('::');
}

function gridGlyph(theme: MatrixScalingTheme) {
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
                backgroundColor: rowIndex === colIndex ? theme.glyphOn : theme.glyphOff,
                borderWidth: 1,
                borderColor: theme.glyphBorder,
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

function createColorMap(heatStops: readonly MatrixColorStop[]): Uint8Array {
  const map = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let start = heatStops[0];
    let end = heatStops[heatStops.length - 1];

    for (let index = 0; index < heatStops.length - 1; index++) {
      if (t >= heatStops[index][0] && t <= heatStops[index + 1][0]) {
        start = heatStops[index];
        end = heatStops[index + 1];
        break;
      }
    }

    const span = end[0] - start[0] || 1;
    const local = (t - start[0]) / span;
    const r = lerpByte(start[1][0], end[1][0], local);
    const g = lerpByte(start[1][1], end[1][1], local);
    const b = lerpByte(start[1][2], end[1][2], local);

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

function createSimulation(theme: MatrixScalingTheme): Simulation {
  const numCells = MATRIX_SIZE * MATRIX_SIZE;
  const simulation: Simulation = {
    current: new Uint8Array(numCells),
    next: new Uint8Array(numCells),
    decay: new Uint8Array(numCells),
    colorMap: createColorMap(theme.heatStops),
    seed: INITIAL_SEED,
    accumulatorMs: 0,
    lastTickMs: -1,
    stepCount: 0,
    themeSignature: themeSignature(theme),
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

function renderMatrix(simulation: Simulation, effect: any, size: PanelSize, theme: MatrixScalingTheme) {
  advanceSimulation(simulation);

  const width = effect.width | 0;
  const height = effect.height | 0;
  if (width <= 0 || height <= 0) return;

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

      const colorBase = simulation.decay[rowBase + logicalX] * 4;
      let red = simulation.colorMap[colorBase];
      let green = simulation.colorMap[colorBase + 1];
      let blue = simulation.colorMap[colorBase + 2];

      if (dimLine) {
        red = (red * theme.scanlineShade) | 0;
        green = (green * theme.scanlineShade) | 0;
        blue = (blue * theme.scanlineShade) | 0;
      }

      effect.setPixelRaw(x, y, red, green, blue, 255);
    }
  }
}

function MatrixViewport(props: {
  size: PanelSize;
  simulation: Simulation;
  theme: MatrixScalingTheme;
}) {
  const isNative = props.size === MATRIX_SIZE;
  const compactLabel = props.size < 128;
  const slotWidth = compactLabel ? Math.max(props.size + 10, 64) : props.size + 10;
  const footerLabel =
    props.size === MATRIX_SIZE ? '1:1' : props.size > MATRIX_SIZE ? `x${props.size / MATRIX_SIZE}` : `1:${MATRIX_SIZE / props.size}`;

  return (
    <S.StackX5Center style={{ width: slotWidth }}>
      {compactLabel ? (
        <Col style={{ width: slotWidth, alignItems: 'center', gap: 4 }}>
          <Box
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 6,
              backgroundColor: isNative ? props.theme.labelBackgroundNative : props.theme.labelBackground,
              borderWidth: 1,
              borderColor: isNative ? props.theme.labelBorderNative : props.theme.labelBorder,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: isNative ? props.theme.labelTextNative : props.theme.labelText,
                fontFamily: 'monospace',
              }}
            >
              {`${props.size}x${props.size}`}
            </Text>
          </Box>
          <Text style={{ fontSize: 8, color: props.theme.deviceText, fontFamily: 'monospace', textTransform: 'uppercase' }}>
            {deviceLabel(props.size)}
          </Text>
        </Col>
      ) : (
        <Row
          style={{
            width: slotWidth,
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
              borderRadius: 6,
              backgroundColor: isNative ? props.theme.labelBackgroundNative : props.theme.labelBackground,
              borderWidth: 1,
              borderColor: isNative ? props.theme.labelBorderNative : props.theme.labelBorder,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: isNative ? props.theme.labelTextNative : props.theme.labelText,
                fontFamily: 'monospace',
              }}
            >
              {`${props.size}x${props.size}`}
            </Text>
          </Box>

          <Text style={{ fontSize: 10, color: props.theme.deviceText, fontFamily: 'monospace' }}>
            {deviceLabel(props.size)}
          </Text>
        </Row>
      )}

      <Box
        style={{
          width: props.size + 10,
          height: props.size + 10,
          padding: 4,
          borderRadius: isNative ? 8 : 10,
          backgroundColor: props.theme.panelBackground,
          borderWidth: 1,
          borderColor: isNative ? props.theme.panelBorderNative : props.theme.panelBorder,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Effect
          onRender={(effect: any) => renderMatrix(props.simulation, effect, props.size, props.theme)}
          style={{ width: props.size, height: props.size }}
        />

        {props.size >= 128 ? (
          <Box
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 1,
              backgroundColor: props.theme.scanlineColor,
              opacity: props.theme.scanlineOpacity,
            }}
          />
        ) : null}
      </Box>

      <Text
        style={{
          fontSize: compactLabel ? 8 : 10,
          color: props.theme.footerText,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
        }}
      >
        {compactLabel ? footerLabel : projectionLabel(props.size)}
      </Text>
    </S.StackX5Center>
  );
}

function useMatrixSimulation(theme: MatrixScalingTheme): Simulation {
  const simulationRef = useRef<Simulation | null>(null);
  if (!simulationRef.current || simulationRef.current.themeSignature !== themeSignature(theme)) {
    simulationRef.current = createSimulation(theme);
  }
  return simulationRef.current;
}

export function MatrixProjectionSurface(props: {
  size: PanelSize;
  theme?: Partial<MatrixScalingTheme>;
}) {
  const resolvedTheme = resolveMatrixScalingTheme(props.theme);
  const simulation = useMatrixSimulation(resolvedTheme);

  return <MatrixViewport size={props.size} simulation={simulation} theme={resolvedTheme} />;
}

export function MatrixProjectionStrip(props: {
  theme?: Partial<MatrixScalingTheme>;
}) {
  const resolvedTheme = resolveMatrixScalingTheme(props.theme);
  const simulation = useMatrixSimulation(resolvedTheme);

  return (
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
        <MatrixViewport key={size} size={size} simulation={simulation} theme={resolvedTheme} />
      ))}
    </Row>
  );
}

export function MatrixScalingDashboard(props: MatrixScalingDashboardProps) {
  const resolvedTheme = resolveMatrixScalingTheme(props.theme);
  const simulation = useMatrixSimulation(resolvedTheme);

  return (
    <Box
      style={{
        width: '100%',
        minHeight: 760,
        padding: 28,
        borderRadius: 26,
        backgroundColor: resolvedTheme.pageBackground,
        borderWidth: 1,
        borderColor: resolvedTheme.pageBorder,
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
          backgroundColor: resolvedTheme.glowPrimary,
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
          backgroundColor: resolvedTheme.glowSecondary,
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
            borderBottomColor: resolvedTheme.headerRule,
          }}
        >
          <Row style={{ alignItems: 'center', gap: 14 }}>
            {gridGlyph(resolvedTheme)}
            <Col style={{ gap: 3 }}>
              <Text style={{ fontSize: 30, fontWeight: 'bold', color: resolvedTheme.titleText }}>Matrix Array</Text>
              <Text style={{ fontSize: 11, color: resolvedTheme.subtitleText, fontFamily: 'monospace' }}>
                Shared logical field • multi-surface pixel projection
              </Text>
            </Col>
          </Row>

          <Text
            style={{
              width: 760,
              fontSize: 12,
              color: resolvedTheme.bodyText,
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
                  borderRadius: 6,
                  backgroundColor: resolvedTheme.chipBackground,
                  borderWidth: 1,
                  borderColor: resolvedTheme.chipBorder,
                }}
              >
                <Text style={{ fontSize: 10, color: resolvedTheme.chipText, fontFamily: 'monospace' }}>{label}</Text>
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
            <MatrixViewport key={size} size={size} simulation={simulation} theme={resolvedTheme} />
          ))}
        </Row>
      </Col>
    </Box>
  );
}
