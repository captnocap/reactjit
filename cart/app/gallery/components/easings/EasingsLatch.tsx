// EasingsLatch — same visual as Easings.tsx, but with two paint
// optimizations layered on:
//
//   1. Static curve frames (border + easing curve path) wrapped in
//      <StaticSurface>. Painted once at mount, cached as a GPU
//      texture, re-blitted per frame for ~free. Removes the per-tile
//      Graph.Path stroke cost from the per-frame paint budget.
//
//   2. The animated dot is a small absolute Box overlaid on the
//      cached surface, positioned via React state. (style.left /
//      style.top latch resolution isn't wired up host-side yet —
//      v8_app.zig:applyStyleEntry only handles `latch:` for height.
//      Once that's extended, swap setState for __latchSet here and
//      the moving dot becomes free too.)
//
// Side-by-side with /atoms/easings to compare paint times. Same
// number of tiles, same animation cycle, same visual fidelity.

import { useState, useEffect, useRef } from 'react';
import { Box, Col, Row, Graph, StaticSurface, Text } from '@reactjit/runtime/primitives';
import { EASINGS, EASING_NAMES, type EasingName } from '@reactjit/runtime/easing';
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

function EasingTileLatch(props: { name: EasingName; t: number }) {
  const fn = EASINGS[props.name];
  const eased = fn(props.t);
  const dotX = PLOT.x + props.t * PLOT.w;
  const dotY = PLOT.y + PLOT.h - eased * PLOT.h;
  const barX = eased * PLOT.w;
  // Curve and frame paths are static for this tile's lifetime.
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
      {/* Graph + dot share one coordinate frame: same-sized Box with
          position:relative anchors the absolute dot directly against
          the cached graph's pixel space — no padding/gap to fight. */}
      <Box
        style={{
          position: 'relative',
          width: TILE_W - 16,
          height: PLOT.h + 20,
        }}
      >
        <StaticSurface staticKey={`easing-latch:${props.name}`}>
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

export type EasingsLatchProps = {};

export function EasingsLatch(_props: EasingsLatchProps) {
  const t = useCycle(CYCLE_MS);
  const names = EASING_NAMES;

  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'theme:ink' }}>Easings (StaticSurface)</Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDimmer' }}>
        Same {names.length} curves as /atoms/easings — but each tile's static
        curve + frame is wrapped in StaticSurface so the painter caches them.
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: TILE_W * 5 + 40 }}>
        {names.map((name) => (
          <EasingTileLatch key={name} name={name} t={t} />
        ))}
      </Row>
    </Col>
  );
}
