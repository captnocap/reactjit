// Circle path debug — three isolated cases in one Graph viewport:
//   Left:   arc stroke only (no fill) — exercises SVG arc commands.
//   Center: 64-segment polygon circle with flat fill.
//   Right:  same polygon circle with fillEffect="debug-wheel" sampling from
//           a named Effect surface.
//
// Port of tsz/carts/conformance/mixed/effects/circle-path-debug.tsz.
// The named Effect uses an onRender JS callback (CPU path) because the
// framework's fillEffect sampling reads from CPU pixel buffers.

import { Box, Row, Text, Graph, Effect } from '@reactjit/runtime/primitives';
import { useMemo } from 'react';
function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function pair(p: { x: number; y: number }) {
  return round1(p.x) + ',' + round1(p.y);
}
function arcCirclePath(cx: number, cy: number, radius: number) {
  const r = round1(radius);
  return 'M ' + round1(cx) + ',' + round1(cy - r) +
    ' A ' + r + ',' + r + ' 0 1,1 ' + round1(cx) + ',' + round1(cy + r) +
    ' A ' + r + ',' + r + ' 0 1,1 ' + round1(cx) + ',' + round1(cy - r) + ' Z';
}
function polyCirclePath(cx: number, cy: number, radius: number, steps: number) {
  let path = '';
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const angle = -Math.PI * 0.5 + t * Math.PI * 2.0;
    const p = { x: Math.cos(angle) * radius + cx, y: Math.sin(angle) * radius + cy };
    path += (i === 0 ? 'M ' : ' L ') + pair(p);
  }
  return path + ' Z';
}

export default function CirclePathDebug() {
  const paths = useMemo(() => ({
    arc: arcCirclePath(-250, 0, 92),
    flat: polyCirclePath(0, 0, 92, 64),
    effect: polyCirclePath(250, 0, 92, 64),
  }), []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#120d1f', padding: 28, gap: 18 }}>
      <Effect
        name="debug-wheel"
        onRender={(e: any) => {
          for (let y = 0; y < e.height; y++) {
            for (let x = 0; x < e.width; x++) {
              const nx = x / e.width - 0.5;
              const ny = y / e.height - 0.5;
              const rr = e.sqrt(nx * nx + ny * ny);
              const spokes = e.sin(nx * 18.0 - ny * 14.0 + rr * 20.0) * 0.5 + 0.5;
              const ring = e.sin(rr * 26.0) * 0.5 + 0.5;
              const glow = e.clamp(1.0 - rr * 1.35, 0.0, 1.0);
              const r = 0.14 + spokes * 0.18 + glow * 0.18;
              const g = 0.18 + ring * 0.52 + glow * 0.22;
              const b = 0.34 + spokes * 0.46;
              e.setPixel(x, y, r, g, b, glow);
            }
          }
        }}
        style={{ width: 256, height: 256, position: 'absolute' }}
      />

      <Box style={{ width: 720, backgroundColor: '#1b1430d8', borderColor: '#f4e7bf1f', borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 }}>
        <Text fontSize={28} color="#fff1cf">Circle Path Debug</Text>
        <Text fontSize={13} color="#d4c4b7">Three isolated cases in one graph: left is stroke-only from SVG arc commands, center is a closed 64-segment circle with flat fill, right is the same closed circle with `fillEffect`.</Text>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <Box style={{ backgroundColor: '#221937', borderColor: '#ffe6a833', borderWidth: 1, borderRadius: 999, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
            <Text fontSize={12} color="#ffe6a8">Left: arc stroke</Text>
          </Box>
          <Box style={{ backgroundColor: '#221937', borderColor: '#7de8ff33', borderWidth: 1, borderRadius: 999, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
            <Text fontSize={12} color="#7de8ff">Center: flat fill</Text>
          </Box>
          <Box style={{ backgroundColor: '#221937', borderColor: '#8ef0b833', borderWidth: 1, borderRadius: 999, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
            <Text fontSize={12} color="#8ef0b8">Right: effect fill</Text>
          </Box>
        </Row>
      </Box>

      <Box style={{ flexGrow: 1, minHeight: 0, backgroundColor: '#0f0b19', borderColor: '#ffffff12', borderWidth: 1, borderRadius: 28, overflow: 'hidden' }}>
        <Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
          <Graph.Path d={paths.arc} stroke="#ffe6a8" strokeWidth={10} />
          <Graph.Path d={paths.flat} fill="#7de8ff33" stroke="#7de8ff" strokeWidth={6} />
          <Graph.Path d={paths.effect} fillEffect="debug-wheel" stroke="#eafff4" strokeWidth={6} />

          <Graph.Path d="M -350,0 L 350,0" stroke="#ffffff08" strokeWidth={1} />
          <Graph.Path d="M -250,-130 L -250,130" stroke="#ffffff08" strokeWidth={1} />
          <Graph.Path d="M 0,-130 L 0,130" stroke="#ffffff08" strokeWidth={1} />
          <Graph.Path d="M 250,-130 L 250,130" stroke="#ffffff08" strokeWidth={1} />

          <Graph.Path d="M -260,-92 L -240,-92" stroke="#ff8fab" strokeWidth={2} />
          <Graph.Path d="M -250,-102 L -250,-82" stroke="#ff8fab" strokeWidth={2} />
          <Graph.Path d="M -256,0 L -244,0" stroke="#c7b7ff" strokeWidth={2} />
          <Graph.Path d="M -250,-6 L -250,6" stroke="#c7b7ff" strokeWidth={2} />

          <Graph.Path d="M -6,0 L 6,0" stroke="#c7b7ff" strokeWidth={2} />
          <Graph.Path d="M 0,-6 L 0,6" stroke="#c7b7ff" strokeWidth={2} />

          <Graph.Path d="M 244,0 L 256,0" stroke="#c7b7ff" strokeWidth={2} />
          <Graph.Path d="M 250,-6 L 250,6" stroke="#c7b7ff" strokeWidth={2} />
        </Graph>
      </Box>
    </Box>
  );
}
