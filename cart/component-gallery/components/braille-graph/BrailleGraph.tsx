import { useEffect, useMemo, useState } from 'react';
import { math } from '../../../../runtime/hooks';
import { Box, Col, Row, Text } from '../../../../runtime/primitives';

// TAU is resolved at module load by calling into framework/math.zig. Keeps the
// constant's source-of-truth in zig; also exercises the JS→Zig bridge once
// per bundle rather than once per frame.
const TAU = math.tauValue();

export type BrailleGraphProps = {};

type GraphMode = 'sine' | 'ripple' | 'noise' | 'lissajous';
type SizeBadge = 'small' | 'medium' | 'large';

const BRAILLE_BASE = 0x2800;
const CARD_PADDING = 12;
const CARD_GAP = 8;
const HEADER_HEIGHT = 22;
const PLOT_PADDING = 4;
const PLOT_BORDER = 1;

const BRAILLE_ADVANCE_BY_FONT_SIZE: Record<number, number> = {
  10: 7,
  12: 9,
  13: 10,
};

const SPECIMENS: {
  key: GraphMode;
  label: string;
  badge: SizeBadge;
  fontSize: number;
  zoom: number;
  cardWidth: number;
  cardHeight: number;
}[] = [
  {
    key: 'sine',
    label: 'Sine',
    badge: 'small',
    fontSize: 10,
    zoom: 10,
    cardWidth: 250,
    cardHeight: 156,
  },
  {
    key: 'ripple',
    label: 'Ripple',
    badge: 'medium',
    fontSize: 12,
    zoom: 12,
    cardWidth: 300,
    cardHeight: 196,
  },
  {
    key: 'noise',
    label: 'Noise',
    badge: 'medium',
    fontSize: 12,
    zoom: 10,
    cardWidth: 300,
    cardHeight: 196,
  },
  {
    key: 'lissajous',
    label: 'Lissajous',
    badge: 'large',
    fontSize: 13,
    zoom: 14,
    cardWidth: 872,
    cardHeight: 246,
  },
];

const MODE_COLORS: Record<GraphMode, string> = {
  sine: '#35c878',
  ripple: '#db5f9c',
  noise: '#8c6fe5',
  lissajous: '#d99a26',
};

const BADGE_COLORS: Record<SizeBadge, { bg: string; text: string; border: string }> = {
  small: { bg: '#dff4e8', text: '#11633d', border: '#9cd9b8' },
  medium: { bg: '#e5efff', text: '#174f91', border: '#a9c9f8' },
  large: { bg: '#fff0d8', text: '#87510d', border: '#e7bf79' },
};

// Mode functions now route trig + noise through framework/math.zig via the
// JS→Zig bridge. Each call crosses the V8/C++/Zig boundary, which is fine at
// this resolution (~200 calls/frame across all cards) and demonstrates that
// the reflection trampoline exposes the full zig surface to cart code.
const FUNCTIONS: Record<GraphMode, (x: number, t: number) => number> = {
  sine: (x, t) => math.sin(x * TAU + t) * 0.9,
  ripple: (x, t) => {
    // Gaussian envelope × wave. exp + sin both from zig.
    const d = x - 0.5;
    const decay = math.exp(-d * d * 4);
    return math.sin(x * TAU * 3 + t * 2) * decay * 0.9;
  },
  noise: (x, t) => {
    // Real Perlin fBm — was sum-of-sines before, now uses framework/math.zig:
    // fbm2d(x, y, octaves, seed, lacunarity, persistence). `t` drifts the
    // second axis so the waveform moves through noise-space over time.
    return math.fbm2d(x * 3.0, t * 0.5, 4, /*seed*/ 1337, 2.0, 0.5) * 0.9;
  },
  lissajous: (x, t) => {
    const a = 3;
    const b = 4;
    const delta = t * 0.5;
    return math.sin(a * x * TAU + delta) * math.cos(b * x * TAU) * 0.9;
  },
};

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

function safeNow(): number {
  const perf = (globalThis as any).performance;
  const now = perf && typeof perf.now === 'function' ? perf.now() : Date.now();
  return Number.isFinite(now) ? now : Date.now();
}

function brailleAdvance(fontSize: number): number {
  return BRAILLE_ADVANCE_BY_FONT_SIZE[fontSize] ?? Math.max(1, Math.round(fontSize * 0.75));
}

function plotMetrics(specimen: (typeof SPECIMENS)[number]) {
  const maxPlotOuterWidth = specimen.cardWidth - CARD_PADDING * 2;
  const maxPlotOuterHeight = specimen.cardHeight - CARD_PADDING * 2 - HEADER_HEIGHT - CARD_GAP;
  const maxInnerWidth = maxPlotOuterWidth - (PLOT_PADDING + PLOT_BORDER) * 2;
  const maxInnerHeight = maxPlotOuterHeight - (PLOT_PADDING + PLOT_BORDER) * 2;
  const advance = brailleAdvance(specimen.fontSize);
  const cols = Math.max(2, Math.floor(maxInnerWidth / advance));
  const rows = Math.max(2, Math.floor(maxInnerHeight / specimen.fontSize));
  const textWidth = cols * advance;
  const textHeight = rows * specimen.fontSize;
  const lineHeight = specimen.fontSize;
  const plotOuterWidth = textWidth + (PLOT_PADDING + PLOT_BORDER) * 2;
  const plotOuterHeight = textHeight + (PLOT_PADDING + PLOT_BORDER) * 2;

  return {
    cols,
    rows,
    textWidth,
    textHeight,
    lineHeight,
    plotOuterWidth,
    plotOuterHeight,
  };
}

function generatePlot(
  cols: number,
  rows: number,
  mode: GraphMode,
  t: number,
  zoom: number
): { lines: string[]; maxVal: number; minVal: number } {
  const charW = 2;
  const charH = 4;
  const pixelW = cols * charW;
  const pixelH = rows * charH;
  const pixels = new Float32Array(pixelW * pixelH);
  const fn = FUNCTIONS[mode];
  const scale = zoom / 10;
  const phase = Number.isFinite(t) ? t : 0;
  let maxVal = -Infinity;
  let minVal = Infinity;

  for (const yv of [1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75, -1]) {
    const py = Math.round(((1 - yv) / 2) * (pixelH - 1));
    for (let px = 0; px < pixelW; px++) pixels[py * pixelW + px] = 0.3;
  }

  for (const xv of [0, 0.25, 0.5, 0.75, 1]) {
    const px = Math.round(xv * (pixelW - 1));
    for (let py = 0; py < pixelH; py++) pixels[py * pixelW + px] = 0.3;
  }

  for (let px = 0; px < pixelW; px++) {
    const x = (px / Math.max(1, pixelW - 1)) * scale;
    const yNorm = fn(x, phase);
    maxVal = Math.max(maxVal, yNorm);
    minVal = Math.min(minVal, yNorm);

    const py = ((1 - yNorm) / 2) * (pixelH - 1);
    const pyi = Math.round(py);
    if (pyi >= 0 && pyi < pixelH) pixels[pyi * pixelW + px] = 1;

    const py2 = py > pyi ? pyi + 1 : pyi - 1;
    if (py2 >= 0 && py2 < pixelH) {
      pixels[py2 * pixelW + px] = Math.max(pixels[py2 * pixelW + px], 0.5);
    }
  }

  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      let bits = 0;
      for (let dy = 0; dy < charH; dy++) {
        for (let dx = 0; dx < charW; dx++) {
          const px = col * charW + dx;
          const py = row * charH + dy;
          if (pixels[py * pixelW + px] > 0.28) bits |= dotBit(dx, dy);
        }
      }
      line += brailleChar(bits);
    }
    lines.push(line);
  }

  return { lines, maxVal, minVal };
}

function SizeBadge({ value }: { value: SizeBadge }) {
  const colors = BADGE_COLORS[value];
  return (
    <Box
      style={{
        height: 22,
        minWidth: 58,
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 8,
        paddingRight: 8,
        borderRadius: 8,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: 'bold', color: colors.text }}>{value}</Text>
    </Box>
  );
}

function GraphSpecimen({
  specimen,
  t,
}: {
  specimen: (typeof SPECIMENS)[number];
  t: number;
}) {
  const metrics = useMemo(() => plotMetrics(specimen), [specimen]);
  const plot = useMemo(
    () => generatePlot(metrics.cols, metrics.rows, specimen.key, t, specimen.zoom),
    [metrics, specimen, t]
  );
  const color = MODE_COLORS[specimen.key];

  return (
    <Col
      style={{
        width: specimen.cardWidth,
        height: specimen.cardHeight,
        padding: 12,
        gap: 8,
        borderRadius: 8,
        backgroundColor: '#07101e',
        borderWidth: 1,
        borderColor: '#26334b',
      }}
    >
      <Row
        style={{
          width: '100%',
          height: HEADER_HEIGHT,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Col>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color }}>{specimen.label}</Text>
        </Col>
        <SizeBadge value={specimen.badge} />
      </Row>

      <Box
        style={{
          width: metrics.plotOuterWidth,
          height: metrics.plotOuterHeight,
          alignItems: 'center',
          justifyContent: 'center',
          padding: PLOT_PADDING,
          borderRadius: 6,
          backgroundColor: '#030914',
          borderWidth: PLOT_BORDER,
          borderColor: '#111c2e',
        }}
      >
        <Col style={{ alignItems: 'center', justifyContent: 'center' }}>
          {plot.lines.map((line, index) => (
            <Text
              key={String(index)}
              noWrap={true}
              numberOfLines={1}
              style={{
                width: metrics.textWidth,
                fontSize: specimen.fontSize,
                lineHeight: metrics.lineHeight,
                color,
                fontFamily: 'monospace',
              }}
            >
              {line}
            </Text>
          ))}
        </Col>
      </Box>
    </Col>
  );
}

export function BrailleGraph(_props: BrailleGraphProps) {
  const [t, setT] = useState(0);

  useEffect(() => {
    const host = globalThis as any;
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    let id: any = 0;
    let last = safeNow();
    const loop = (frameNow?: number) => {
      const now = Number.isFinite(frameNow) ? Number(frameNow) : safeNow();
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      setT((value) => value + dt);
      id = raf ? raf(loop) : setTimeout(() => loop(safeNow()), 16);
    };
    id = raf ? raf(loop) : setTimeout(() => loop(safeNow()), 16);
    return () => {
      if (raf && typeof host.cancelAnimationFrame === 'function') host.cancelAnimationFrame(id);
      if (!raf) clearTimeout(id);
    };
  }, []);

  return (
    <Col
      style={{
        width: 880,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <Col style={{ alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#172033' }}>Braille Graph</Text>
        <Text style={{ fontSize: 12, color: '#657185' }}>cart/braille_graph.tsx</Text>
      </Col>

      <Col style={{ gap: 12 }}>
        <Row style={{ width: 872, gap: 11, alignItems: 'flex-end', justifyContent: 'center' }}>
          <GraphSpecimen specimen={SPECIMENS[0]} t={t} />
          <GraphSpecimen specimen={SPECIMENS[1]} t={t} />
          <GraphSpecimen specimen={SPECIMENS[2]} t={t} />
        </Row>
        <Row style={{ width: 872, alignItems: 'center', justifyContent: 'center' }}>
          <GraphSpecimen specimen={SPECIMENS[3]} t={t} />
        </Row>
      </Col>
    </Col>
  );
}
