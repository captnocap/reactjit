// EasingsLatchFull — same visual as Easings.tsx, but every per-frame
// mutation goes around React entirely:
//
//   1. Static curve frames (border + easing curve path) wrapped in
//      <StaticSurface>. Painted once, cached as a GPU texture.
//
//   2. The animated dot AND the bar's ball are positioned via host
//      latches, NOT React state. A single RAF loop in the parent
//      component computes the per-tile eased values and writes them
//      to the latch store via __latchSet. Each tile's dot/ball Box
//      uses style={{ left: 'latch:KEY' }} so the host's pre-frame
//      sync writes the current latch value into the resolved style
//      before layout runs. There is NO setState in this entire
//      animation path. React reconciles ZERO times after mount.
//
// Requires v8_app.zig:applyStyleEntry latch resolver for left/top
// (added 2026-05-04, ~30 lines mirroring the existing height
// handler). If you see the dots stuck at (0,0), you're on a binary
// that hasn't been rebuilt — run `scripts/ship app`.

import { useEffect, useRef } from 'react';
import { Box, Col, Row, Graph, StaticSurface, Text } from '@reactjit/runtime/primitives';
import { EASINGS, EASING_NAMES, type EasingName } from '@reactjit/runtime/easing';
import { useAnimationsDisabled } from '../../lib/useSpring';

const CYCLE_MS = 1800;
const TILE_W = 160;
const TILE_H = 140;
const PLOT = { x: 10, y: 10, w: TILE_W - 20, h: 70 };

function setLatch(key: string, value: number): void {
  const fn = (globalThis as any).__latchSet;
  if (typeof fn === 'function') fn(key, value);
}

function buildCurvePath(fn: (t: number) => number): string {
  const steps = 48;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = PLOT.x + u * PLOT.w;
    const y = PLOT.y + PLOT.h - fn(u) * PLOT.h;
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d;
}

// One RAF loop driving every tile's three latches (dot x, dot y,
// bar-ball x). Mounted once at the parent level, not per tile.
function useLatchAnimation(durationMs: number): void {
  const animationsDisabled = useAnimationsDisabled();
  const idRef = useRef<any>(null);
  useEffect(() => {
    if (animationsDisabled) return;
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    const tick = () => {
      const t = (Date.now() % durationMs) / durationMs;
      for (const name of EASING_NAMES) {
        const fn = EASINGS[name];
        const eased = fn(t);
        const dotX = PLOT.x + t * PLOT.w;
        const dotY = PLOT.y + PLOT.h - eased * PLOT.h;
        const barLeft = eased * PLOT.w - 5;
        // Three writes per tile per frame. Each is one host FFI call
        // — no React state, no JSON, no reconcile.
        setLatch('easing-full:' + name + ':dotX', dotX - 3);
        setLatch('easing-full:' + name + ':dotY', dotY - 3);
        setLatch('easing-full:' + name + ':barLeft', barLeft);
      }
      idRef.current = raf(tick);
    };
    idRef.current = raf(tick);
    return () => { if (idRef.current != null) { try { caf(idRef.current); } catch {} } };
  }, [durationMs, animationsDisabled]);
}

function EasingTileLatchFull(props: { name: EasingName }) {
  const fn = EASINGS[props.name];
  // Static path data — built once, never recomputed (no animated
  // props on this component, so it never re-renders after mount).
  const curve = buildCurvePath(fn);
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
        <StaticSurface staticKey={`easing-full:${props.name}`}>
          <Graph originTopLeft style={{ width: TILE_W - 16, height: PLOT.h + 20 }}>
            <Graph.Path d={frameBR} stroke="theme:bg2" strokeWidth={1} fill="none" />
            <Graph.Path d={frameTL} stroke="theme:bg1" strokeWidth={1} fill="none" />
            <Graph.Path d={curve} stroke="theme:atch" strokeWidth={1.75} fill="none" />
          </Graph>
        </StaticSurface>
        {/* Dot — left/top resolved from host latches per frame.
            React mounts this Box ONCE and never touches it again. */}
        <Box
          style={{
            position: 'absolute',
            left: `latch:easing-full:${props.name}:dotX`,
            top: `latch:easing-full:${props.name}:dotY`,
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
        {/* Bar ball — same trick. */}
        <Box
          style={{
            position: 'absolute',
            left: `latch:easing-full:${props.name}:barLeft`,
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

export type EasingsLatchFullProps = {};

export function EasingsLatchFull(_props: EasingsLatchFullProps) {
  // Single RAF loop at the parent level — drives all tile latches.
  useLatchAnimation(CYCLE_MS);
  const names = EASING_NAMES;

  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'theme:ink' }}>Easings (Combined)</Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDimmer' }}>
        StaticSurface caches the curves + __latchSet drives the dots — both techniques stacked.
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: TILE_W * 5 + 40 }}>
        {names.map((name) => (
          <EasingTileLatchFull key={name} name={name} />
        ))}
      </Row>
    </Col>
  );
}
