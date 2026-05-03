import { useState, useEffect, useRef } from 'react';
import { Box, Col, Row, Graph, Text } from '@reactjit/runtime/primitives';
import { EASINGS, EASING_NAMES, type EasingName } from '@reactjit/runtime/easing';

const CYCLE_MS = 1800;
const TILE_W = 160;
const TILE_H = 140;
const PLOT = { x: 10, y: 10, w: TILE_W - 20, h: 70 };

function useCycle(durationMs: number): number {
  const [t, setT] = useState(0);
  const rafRef = useRef<any>(null);
  useEffect(() => {
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    const tick = () => {
      setT((Date.now() % durationMs) / durationMs);
      rafRef.current = raf(tick);
    };
    rafRef.current = raf(tick);
    return () => { if (rafRef.current != null) { try { caf(rafRef.current); } catch {} } };
  }, [durationMs]);
  return t;
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

function EasingTile(props: { name: EasingName; t: number }) {
  const fn = EASINGS[props.name];
  const eased = fn(props.t);
  const curve = buildCurvePath(fn);
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
        backgroundColor: '#0e0b09',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#14100d',
        gap: 6,
      }}
    >
      <Graph originTopLeft style={{ width: TILE_W - 16, height: PLOT.h + 20 }}>
        <Graph.Path d={frameBR} stroke="#1a1511" strokeWidth={1} fill="none" />
        <Graph.Path d={frameTL} stroke="#14100d" strokeWidth={1} fill="none" />
        <Graph.Path d={curve} stroke="#d48aa7" strokeWidth={1.75} fill="none" />
        <Graph.Path
          d={`M ${dotX - 3} ${dotY} A 3 3 0 1 1 ${dotX + 3} ${dotY} A 3 3 0 1 1 ${dotX - 3} ${dotY}`}
          fill="#f2e8dc"
          stroke="#d48aa7"
          strokeWidth={1.25}
        />
      </Graph>
      <Box
        style={{
          position: 'relative',
          width: PLOT.w,
          height: 6,
          backgroundColor: '#14100d',
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
            backgroundColor: '#d48aa7',
            borderRadius: 5,
          }}
        />
      </Box>
      <Text style={{ fontSize: 11, color: '#b8a890', fontFamily: 'monospace' }}>{props.name}</Text>
    </Col>
  );
}

export type EasingsProps = {};

export function Easings(_props: EasingsProps) {
  const t = useCycle(CYCLE_MS);
  const names = EASING_NAMES;

  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f2e8dc' }}>Easings</Text>
      <Text style={{ fontSize: 12, color: '#7a6e5d' }}>
        {names.length} first-class easing functions from runtime/easing.ts
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: TILE_W * 5 + 40 }}>
        {names.map((name) => (
          <EasingTile key={name} name={name} t={t} />
        ))}
      </Row>
    </Col>
  );
}
