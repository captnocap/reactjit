// EasingsLatchOnly — isolated demonstration of the latch animation
// path WITHOUT StaticSurface caching. The static curve frames are
// drawn naked (no <StaticSurface> wrap), so the painter re-strokes
// them every frame. The dot and bar-ball are still positioned via
// __latchSet so React doesn't reconcile per frame.
//
// Expected: ~60fps, paint cost similar to the vanilla useEffect
// version (~16ms — paint-bound by the per-frame curve re-stroke),
// but JS work near zero (no React reconciliation). Proves that
// latches alone don't help when the bottleneck is paint, and that
// StaticSurface is the load-bearing optimization for visuals with
// many static paths.
//
// Sister atom to:
//   - Easings (vanilla useEffect — both costs)
//   - Easings (StaticSurface) (cached paint, React-driven dot)
//   - Easings (Combined) (cached paint + latch dot — full stack)

import { useEffect, useRef } from 'react';
import { Box, Col, Row, Graph, Text } from '@reactjit/runtime/primitives';
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
        setLatch('easing-latchonly:' + name + ':dotX', dotX - 3);
        setLatch('easing-latchonly:' + name + ':dotY', dotY - 3);
        setLatch('easing-latchonly:' + name + ':barLeft', barLeft);
      }
      idRef.current = raf(tick);
    };
    idRef.current = raf(tick);
    return () => { if (idRef.current != null) { try { caf(idRef.current); } catch {} } };
  }, [durationMs, animationsDisabled]);
}

function EasingTileLatchOnly(props: { name: EasingName }) {
  const fn = EASINGS[props.name];
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
        {/* No <StaticSurface> here — the curve re-strokes every
            frame. Compare to Easings (Combined) which is identical
            except for the StaticSurface wrap. */}
        <Graph originTopLeft style={{ width: TILE_W - 16, height: PLOT.h + 20 }}>
          <Graph.Path d={frameBR} stroke="theme:bg2" strokeWidth={1} fill="none" />
          <Graph.Path d={frameTL} stroke="theme:bg1" strokeWidth={1} fill="none" />
          <Graph.Path d={curve} stroke="theme:atch" strokeWidth={1.75} fill="none" />
        </Graph>
        <Box
          style={{
            position: 'absolute',
            left: `latch:easing-latchonly:${props.name}:dotX`,
            top: `latch:easing-latchonly:${props.name}:dotY`,
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
            left: `latch:easing-latchonly:${props.name}:barLeft`,
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

export type EasingsLatchOnlyProps = {};

export function EasingsLatchOnly(_props: EasingsLatchOnlyProps) {
  useLatchAnimation(CYCLE_MS);
  const names = EASING_NAMES;

  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'theme:ink' }}>Easings (Latches only)</Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDimmer' }}>
        __latchSet drives the dots, but no StaticSurface — curves re-stroke every frame. Paint-bound.
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: TILE_W * 5 + 40 }}>
        {names.map((name) => (
          <EasingTileLatchOnly key={name} name={name} />
        ))}
      </Row>
    </Col>
  );
}
