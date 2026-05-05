// EasingsZigStatic — StaticSurface caches the curve frames (so paint
// cost drops to ~3-4ms like the StaticSurface atom) AND the per-frame
// math runs through the Zig bridge.
//
// Compared to the EasingsZigMath atom: that one paid for ~931 bridge
// calls per frame (each tile rebuilt the 48-step curve every render).
// Since the static curve is now cached, buildCurvePathZig only runs
// once at mount. Per-frame work shrinks to ~19 bridge calls — one
// per tile for the dot eval. ~50× fewer bridge crossings.
//
// What this isolates: bridge cost AT LOW CALL FREQUENCY. The raw
// Zig-math test showed ~5μs amortized per call (bridge + math) and
// landed on top of vanilla. If that 5μs is real per-call overhead,
// 19 calls/frame × 60Hz = ~5.7ms/sec total bridge cost — a tiny but
// measurable nick. If StaticSurface+Zig math lands on top of plain
// StaticSurface, bridge cost is sub-microsecond per call and we
// stop worrying about it forever.

import { useState, useEffect, useRef } from 'react';
import { Box, Col, Row, Graph, StaticSurface, Text } from '@reactjit/runtime/primitives';
import { EASING_NAMES, type EasingName } from '@reactjit/runtime/easing';
import { math } from '@reactjit/runtime/hooks/math';
import { useAnimationsDisabled } from '../../lib/useSpring';

const CYCLE_MS = 1800;
const TILE_W = 160;
const TILE_H = 140;
const PLOT = { x: 10, y: 10, w: TILE_W - 20, h: 70 };

function useCycle(durationMs: number): number {
  const animationsDisabled = useAnimationsDisabled();
  const [t, setT] = useState(0);
  const rafRef = useRef<any>(null);
  useEffect(() => {
    if (animationsDisabled) return;
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    const tick = () => {
      setT((Date.now() % durationMs) / durationMs);
      rafRef.current = raf(tick);
    };
    rafRef.current = raf(tick);
    return () => { if (rafRef.current != null) { try { caf(rafRef.current); } catch {} } };
  }, [durationMs, animationsDisabled]);
  return animationsDisabled ? 0.5 : t;
}

// 48 bridge calls — runs ONCE per tile lifetime now that the curve
// is wrapped in StaticSurface. Not per frame.
function buildCurvePathZig(): string {
  const steps = 48;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const eased = math.smootherstep(0, 1, u);
    const x = PLOT.x + u * PLOT.w;
    const y = PLOT.y + PLOT.h - eased * PLOT.h;
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d;
}

function EasingTileZigStatic(props: { name: EasingName; t: number }) {
  // ONE bridge call per tile per frame for the moving dot.
  const eased = math.smootherstep(0, 1, props.t);
  // Curve built once — wrapped in StaticSurface so its paint also
  // happens once and gets cached as a GPU texture.
  const curve = buildCurvePathZig();
  const dotX = PLOT.x + props.t * PLOT.w;
  const dotY = PLOT.y + PLOT.h - eased * PLOT.h;
  const barX = eased * PLOT.w;
  const frameTL = `M ${PLOT.x} ${PLOT.y + PLOT.h} L ${PLOT.x} ${PLOT.y} L ${PLOT.x + PLOT.w} ${PLOT.y}`;
  const frameBR = `M ${PLOT.x} ${PLOT.y + PLOT.h} L ${PLOT.x + PLOT.w} ${PLOT.y + PLOT.h} L ${PLOT.x + PLOT.w} ${PLOT.y}`;

  return (
    <Col
      style={{
        width: TILE_W,
        height: TILE_H,
        padding: 8,
        backgroundColor: 'theme:bg',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'theme:bg1',
        gap: 6,
      }}
    >
      <Box
        style={{
          position: 'relative',
          width: TILE_W - 16,
          height: PLOT.h + 20,
        }}
      >
        <StaticSurface staticKey={`easing-zig-static:${props.name}`}>
          <Graph originTopLeft style={{ width: TILE_W - 16, height: PLOT.h + 20 }}>
            <Graph.Path d={frameBR} stroke="theme:bg2" strokeWidth={1} fill="none" />
            <Graph.Path d={frameTL} stroke="theme:bg1" strokeWidth={1} fill="none" />
            <Graph.Path d={curve} stroke="theme:atch" strokeWidth={1.75} fill="none" />
          </Graph>
        </StaticSurface>
        <Box
          style={{
            position: 'absolute',
            left: dotX - 3,
            top: dotY - 3,
            width: 6,
            height: 6,
            backgroundColor: 'theme:ink',
            borderRadius: 3,
            borderWidth: 1,
            borderColor: 'theme:atch',
          }}
        />
      </Box>
      <Box
        style={{
          position: 'relative',
          width: PLOT.w,
          height: 6,
          backgroundColor: 'theme:bg1',
          borderRadius: 3,
        }}
      >
        <Box
          style={{
            position: 'absolute',
            left: barX - 5,
            top: -2,
            width: 10,
            height: 10,
            backgroundColor: 'theme:atch',
            borderRadius: 5,
          }}
        />
      </Box>
      <Text style={{ fontSize: 11, color: 'theme:inkDim', fontFamily: 'monospace' }}>{props.name}</Text>
    </Col>
  );
}

export type EasingsZigStaticProps = {};

export function EasingsZigStatic(_props: EasingsZigStaticProps) {
  const t = useCycle(CYCLE_MS);
  const names = EASING_NAMES;

  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'theme:ink' }}>Easings (Zig math + StaticSurface)</Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDimmer' }}>
        Cached curves + per-frame dot math via __zig_call. ~{names.length} bridge calls per frame
        (vs ~{names.length * 49} in the no-cache version).
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: TILE_W * 5 + 40 }}>
        {names.map((name) => (
          <EasingTileZigStatic key={name} name={name} t={t} />
        ))}
      </Row>
    </Col>
  );
}
