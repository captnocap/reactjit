const React: any = require('react');
const { useState, useEffect, useMemo } = React;

import { Box, Col, Row, Text, Pressable } from '../runtime/primitives';

// ── Braille helpers ─────────────────────────────────────────
const BRAILLE_BASE = 0x2800;

function dotBit(x: number, y: number): number {
  if (x === 0) {
    if (y === 0) return 0x01;
    if (y === 1) return 0x02;
    if (y === 2) return 0x04;
    return 0x40;
  } else {
    if (y === 0) return 0x08;
    if (y === 1) return 0x10;
    if (y === 2) return 0x20;
    return 0x80;
  }
}

function brailleChar(bits: number): string {
  return String.fromCharCode(BRAILLE_BASE + bits);
}

// ── 1D line plot rasteriser with grid ───────────────────────

type GraphMode = 'sine' | 'ripple' | 'noise' | 'lissajous';

const FUNCTIONS: Record<GraphMode, (x: number, t: number) => number> = {
  sine: (x, t) => Math.sin(x * Math.PI * 2 + t) * 0.9,
  ripple: (x, t) => {
    const decay = Math.exp(-(x - 0.5) * (x - 0.5) * 4);
    return Math.sin(x * Math.PI * 6 + t * 2) * decay * 0.9;
  },
  noise: (x, t) => {
    const v =
      Math.sin(x * 8 + t) * 0.5 +
      Math.sin(x * 17 + t * 1.4) * 0.25 +
      Math.sin(x * 31 - t * 0.6) * 0.12;
    return v * 0.9;
  },
  lissajous: (x, t) => {
    const a = 3;
    const b = 4;
    const delta = t * 0.5;
    return Math.sin(a * x * Math.PI * 2 + delta) * Math.cos(b * x * Math.PI * 2) * 0.9;
  },
};

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

  const fn = FUNCTIONS[mode];
  const scale = zoom / 10;

  const pix = new Float32Array(pixelW * pixelH);

  // Dotted horizontal grid lines at 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75
  for (const yv of [0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75]) {
    const py = ((1 - yv) / 2) * (pixelH - 1);
    const pyi = Math.round(py);
    if (pyi >= 0 && pyi < pixelH) {
      for (let px = 0; px < pixelW; px += 2) {
        pix[pyi * pixelW + px] = 0.3;
      }
    }
  }

  // Dotted vertical grid lines
  for (const xv of [0.25, 0.5, 0.75]) {
    const pxi = Math.round(xv * (pixelW - 1));
    if (pxi >= 0 && pxi < pixelW) {
      for (let py = 0; py < pixelH; py += 2) {
        pix[py * pixelW + pxi] = 0.3;
      }
    }
  }

  // Draw the function curve
  let maxVal = -Infinity;
  let minVal = Infinity;

  for (let px = 0; px < pixelW; px++) {
    const x = (px / pixelW) * scale;
    const yNorm = fn(x, t);
    if (yNorm > maxVal) maxVal = yNorm;
    if (yNorm < minVal) minVal = yNorm;

    // Map -1..1 to pixel coordinates (0=top, pixelH-1=bottom)
    const py = ((1 - yNorm) / 2) * (pixelH - 1);
    const pyi = Math.round(py);
    if (pyi >= 0 && pyi < pixelH) {
      pix[pyi * pixelW + px] = 1.0;
    }
    // Thicken
    const py2 = py > pyi ? pyi + 1 : pyi - 1;
    if (py2 >= 0 && py2 < pixelH) {
      pix[py2 * pixelW + px] = Math.max(pix[py2 * pixelW + px], 0.5);
    }
  }

  // Convert pixels → Braille chars
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      let bits = 0;
      for (let dy = 0; dy < charH; dy++) {
        for (let dx = 0; dx < charW; dx++) {
          const px = c * charW + dx;
          const py = r * charH + dy;
          if (pix[py * pixelW + px] > 0.28) {
            bits |= dotBit(dx, dy);
          }
        }
      }
      line += brailleChar(bits);
    }
    out.push(line);
  }
  return { lines: out, maxVal, minVal };
}

// ── UI ──────────────────────────────────────────────────────

const MODES: { key: GraphMode; label: string }[] = [
  { key: 'sine', label: 'Sine' },
  { key: 'ripple', label: 'Ripple' },
  { key: 'noise', label: 'Noise' },
  { key: 'lissajous', label: 'Lissajous' },
];

const MODE_COLORS: Record<GraphMode, string> = {
  sine: '#4ade80',
  ripple: '#f472b6',
  noise: '#a78bfa',
  lissajous: '#fbbf24',
};

export default function BrailleGraphCart() {
  const [mode, setMode] = useState<GraphMode>('sine');
  const [animate, setAnimate] = useState(true);
  const [t, setT] = useState(0);
  const [zoom, setZoom] = useState(10);

  useEffect(() => {
    if (!animate) return;
    const host = globalThis as any;
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    let id: any = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => prev + dt);
      id = raf ? raf(loop) : setTimeout(() => loop(performance.now()), 16);
    };
    id = raf ? raf(loop) : setTimeout(() => loop(performance.now()), 16);
    return () => {
      if (raf) host.cancelAnimationFrame(id);
      else clearTimeout(id);
    };
  }, [animate]);

  const gridCols = 48;
  const gridRows = 22;

  const { lines, maxVal, minVal } = useMemo(() => {
    return generatePlot(gridCols, gridRows, mode, t, zoom);
  }, [mode, t, zoom]);

  const color = MODE_COLORS[mode];

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0b0f1a',
        padding: 20,
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, color: '#e2e8f0', fontWeight: '700' }}>
          Braille Graph
        </Text>
        <Row style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#64748b' }}>
            max {maxVal.toFixed(2)}  min {minVal.toFixed(2)}
          </Text>
          <Pressable
            onPress={() => setAnimate((a) => !a)}
            style={{
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              backgroundColor: animate ? '#10b981' : '#1e293b',
            }}
          >
            <Text style={{ fontSize: 13, color: '#f1f5f9' }}>
              {animate ? 'Pause' : 'Play'}
            </Text>
          </Pressable>
        </Row>
      </Row>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={{
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 6,
              backgroundColor: mode === m.key ? '#3b82f6' : '#1e293b',
            }}
          >
            <Text style={{ fontSize: 13, color: '#f1f5f9' }}>{m.label}</Text>
          </Pressable>
        ))}
      </Row>

      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#94a3b8' }}>Zoom:</Text>
        <Pressable
          onPress={() => setZoom((z) => Math.max(1, z - 1))}
          style={{
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 10,
            paddingRight: 10,
            borderRadius: 4,
            backgroundColor: '#1e293b',
          }}
        >
          <Text style={{ fontSize: 13, color: '#f1f5f9' }}>−</Text>
        </Pressable>
        <Text style={{ fontSize: 13, color: '#94a3b8', minWidth: 24, textAlign: 'center' }}>
          {zoom}
        </Text>
        <Pressable
          onPress={() => setZoom((z) => Math.min(50, z + 1))}
          style={{
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 10,
            paddingRight: 10,
            borderRadius: 4,
            backgroundColor: '#1e293b',
          }}
        >
          <Text style={{ fontSize: 13, color: '#f1f5f9' }}>+</Text>
        </Pressable>
      </Row>

      <Box
        style={{
          flexGrow: 1,
          backgroundColor: '#020617',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <Row style={{ flexGrow: 1, gap: 6 }}>
          {/* Y-axis labels */}
          <Col
            style={{
              width: 32,
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <Text style={{ fontSize: 10, color: '#475569', lineHeight: 10 }}>1.0</Text>
            <Text style={{ fontSize: 10, color: '#475569', lineHeight: 10 }}>0.5</Text>
            <Text style={{ fontSize: 10, color: '#475569', lineHeight: 10 }}>0.0</Text>
            <Text style={{ fontSize: 10, color: '#475569', lineHeight: 10 }}>-0.5</Text>
            <Text style={{ fontSize: 10, color: '#475569', lineHeight: 10 }}>-1.0</Text>
          </Col>

          <Col style={{ flexGrow: 1, gap: 2 }}>
            {/* Plot */}
            <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Col style={{ gap: 0 }}>
                {lines.map((line, i) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 14,
                      lineHeight: 14,
                      color,
                      fontFamily: 'monospace',
                    }}
                  >
                    {line}
                  </Text>
                ))}
              </Col>
            </Box>

            {/* X-axis labels */}
            <Row style={{ justifyContent: 'space-between', paddingLeft: 2 }}>
              <Text style={{ fontSize: 10, color: '#475569' }}>0</Text>
              <Text style={{ fontSize: 10, color: '#475569' }}>{(zoom / 2).toFixed(1)}</Text>
              <Text style={{ fontSize: 10, color: '#475569' }}>{zoom.toFixed(1)}</Text>
            </Row>
          </Col>
        </Row>
      </Box>
    </Box>
  );
}
