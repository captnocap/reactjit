// EasingsZigMath — same shape as the vanilla useEffect Easings, but
// every per-frame easing evaluation is routed through `math.zig` via
// the V8 ↔ Zig reflection bridge instead of running in JIT-compiled
// JavaScript.
//
// Hypothesis we're TESTING (not assuming):
//   - V8 JIT-compiles Math.sin/cos/pow on hot paths to native machine
//     code, so per-call cost is sub-10ns.
//   - The __zig_call bridge has per-call overhead (argument
//     marshalling, V8↔Zig context switch, return value packing) on
//     the order of microseconds.
//   - For trivial scalar math, the bridge cost should swamp the
//     native eval. Bridging makes things *slower*, not faster.
//
// We're checking if that intuition matches reality. If it does, this
// atom should run worse than vanilla Easings (more bridge calls per
// frame than per-frame easing evaluations). If by some miracle it
// runs faster, we've learned something important about the bridge.
//
// What we route through Zig:
//   1. Per-tile, per-frame: `math.smootherstep(0, 1, t)` instead of
//      EASINGS[name](t). One bridge call per tile per frame.
//   2. Per buildCurvePath rebuild: 48 calls into
//      `math.smootherstep` to fill the curve points. This is the
//      heavy bridge usage — N tiles × 48 calls × 60Hz.
//
// Visual fidelity: every tile shows the same smootherstep curve
// instead of its named easing. We're testing PERF, not VISUAL
// MATCH — the per-tile distinction is irrelevant for the bridge
// stress test.

import { useState, useEffect, useRef } from 'react';
import { Box, Col, Row, Graph, Text } from '@reactjit/runtime/primitives';
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

// Same shape as the original buildCurvePath, but the easing eval
// inside the loop hits the V8↔Zig bridge instead of a JS function
// call. 48 bridge crossings per tile per render.
function buildCurvePathZig(): string {
  const steps = 48;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const eased = math.smootherstep(0, 1, u);  // ← bridge call
    const x = PLOT.x + u * PLOT.w;
    const y = PLOT.y + PLOT.h - eased * PLOT.h;
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d;
}

function EasingTileZig(props: { name: EasingName; t: number }) {
  const eased = math.smootherstep(0, 1, props.t);  // ← bridge call per render per tile
  const curve = buildCurvePathZig();                 // ← 48 more bridge calls
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
      <Graph originTopLeft style={{ width: TILE_W - 16, height: PLOT.h + 20 }}>
        <Graph.Path d={frameBR} stroke="theme:bg2" strokeWidth={1} fill="none" />
        <Graph.Path d={frameTL} stroke="theme:bg1" strokeWidth={1} fill="none" />
        <Graph.Path d={curve} stroke="theme:atch" strokeWidth={1.75} fill="none" />
        <Graph.Path
          d={`M ${dotX - 3} ${dotY} A 3 3 0 1 1 ${dotX + 3} ${dotY} A 3 3 0 1 1 ${dotX - 3} ${dotY}`}
          fill="theme:ink"
          stroke="theme:atch"
          strokeWidth={1.25}
        />
      </Graph>
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

export type EasingsZigMathProps = {};

export function EasingsZigMath(_props: EasingsZigMathProps) {
  const t = useCycle(CYCLE_MS);
  const names = EASING_NAMES;

  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'theme:ink' }}>Easings (Zig math via bridge)</Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDimmer' }}>
        useEffect/RAF cycle, but every easing eval crosses V8↔Zig via __zig_call.
        ~{(names.length * 49)} bridge calls per frame. Test of bridge overhead.
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: TILE_W * 5 + 40 }}>
        {names.map((name) => (
          <EasingTileZig key={name} name={name} t={t} />
        ))}
      </Row>
    </Col>
  );
}
