// Paisley Glassleaf — variant of paisley-garden that uses hand-tuned
// bezier control points (dropPath / paisleyBody / paisleyRibbon / paisleyHalo)
// instead of a cardioid-based procedural curve. Same named fill effects and
// background shader as paisley-garden.
//
// Port of tsz/carts/conformance/mixed/effects/paisley-glassleaf.tsz.

import { Box, Row, Text, Graph, Effect } from '../../runtime/primitives';
const React: any = require('react');
const { useMemo } = React;

type Palette = {
  effect: string; stroke: string; accent: string; innerFill: string; seedFill: string; halo: string;
};

const PALETTES: Palette[] = [
  { effect: 'paisley-peacock', stroke: '#f4e6c7', accent: '#ffd77b', innerFill: '#0f2f3fcc', seedFill: '#f6cf7b', halo: '#fff7da88' },
  { effect: 'paisley-ember',   stroke: '#ffe2c2', accent: '#ffb15f', innerFill: '#4a1d14bb', seedFill: '#ffca86', halo: '#ffd9b166' },
  { effect: 'paisley-jade',    stroke: '#e9f6db', accent: '#b7f08f', innerFill: '#15392ecc', seedFill: '#d7ffb4', halo: '#e5ffd666' },
  { effect: 'paisley-ink',     stroke: '#f1d9ff', accent: '#d9a8ff', innerFill: '#25153ecc', seedFill: '#ffd2a8', halo: '#f1dcff66' },
];

function round1(v: number) { return Math.round(v * 10) / 10; }
function point(cx: number, cy: number, scale: number, angle: number, x: number, y: number) {
  const px = x * scale;
  const py = y * scale;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return { x: round1(cx + px * ca - py * sa), y: round1(cy + px * sa + py * ca) };
}
function slimPoint(cx: number, cy: number, scale: number, angle: number, slim: number, x: number, y: number) {
  return point(cx, cy, scale, angle, x * slim, y);
}
function pair(p: { x: number; y: number }) { return p.x + ',' + p.y; }
function circlePath(cx: number, cy: number, r: number) {
  const rr = round1(r);
  const left = round1(cx - rr);
  const right = round1(cx + rr);
  const yy = round1(cy);
  return `M ${left},${yy} A ${rr},${rr} 0 1,0 ${right},${yy} A ${rr},${rr} 0 1,0 ${left},${yy} Z`;
}

function dropPath(cx: number, cy: number, scale: number, angle: number, slim: number) {
  const p0 = slimPoint(cx, cy, scale, angle, slim, -0.04, 0.44);
  const c1 = slimPoint(cx, cy, scale, angle, slim, -0.34, 0.34);
  const c2 = slimPoint(cx, cy, scale, angle, slim, -0.42, -0.04);
  const p1 = slimPoint(cx, cy, scale, angle, slim,  0.06, -0.56);
  const c3 = slimPoint(cx, cy, scale, angle, slim,  0.42, -0.44);
  const c4 = slimPoint(cx, cy, scale, angle, slim,  0.50,  0.10);
  const p2 = slimPoint(cx, cy, scale, angle, slim,  0.16,  0.46);
  const c5 = slimPoint(cx, cy, scale, angle, slim,  0.04,  0.58);
  const c6 = slimPoint(cx, cy, scale, angle, slim, -0.08,  0.56);
  return `M ${pair(p0)} C ${pair(c1)} ${pair(c2)} ${pair(p1)} C ${pair(c3)} ${pair(c4)} ${pair(p2)} C ${pair(c5)} ${pair(c6)} ${pair(p0)} Z`;
}
function paisleyBody(cx: number, cy: number, scale: number, angle: number, slim: number) {
  const p0 = slimPoint(cx, cy, scale, angle, slim, -0.14,  0.98);
  const c1 = slimPoint(cx, cy, scale, angle, slim, -0.86,  0.78);
  const c2 = slimPoint(cx, cy, scale, angle, slim, -0.98,  0.02);
  const p1 = slimPoint(cx, cy, scale, angle, slim,  0.16, -1.12);
  const c3 = slimPoint(cx, cy, scale, angle, slim,  0.74, -1.04);
  const c4 = slimPoint(cx, cy, scale, angle, slim,  1.02, -0.30);
  const p2 = slimPoint(cx, cy, scale, angle, slim,  0.84,  0.50);
  const c5 = slimPoint(cx, cy, scale, angle, slim,  0.70,  1.06);
  const c6 = slimPoint(cx, cy, scale, angle, slim,  0.10,  1.10);
  const p3 = slimPoint(cx, cy, scale, angle, slim, -0.34,  0.74);
  const c7 = slimPoint(cx, cy, scale, angle, slim, -0.78,  0.44);
  const c8 = slimPoint(cx, cy, scale, angle, slim, -0.72, -0.10);
  const p4 = slimPoint(cx, cy, scale, angle, slim,  0.00, -0.20);
  const c9 = slimPoint(cx, cy, scale, angle, slim, -0.18,  0.10);
  const c10 = slimPoint(cx, cy, scale, angle, slim, -0.18,  0.62);
  return `M ${pair(p0)} C ${pair(c1)} ${pair(c2)} ${pair(p1)} C ${pair(c3)} ${pair(c4)} ${pair(p2)} C ${pair(c5)} ${pair(c6)} ${pair(p3)} C ${pair(c7)} ${pair(c8)} ${pair(p4)} C ${pair(c9)} ${pair(c10)} ${pair(p0)} Z`;
}
function paisleyRibbon(cx: number, cy: number, scale: number, angle: number, slim: number) {
  const p0 = slimPoint(cx, cy, scale, angle, slim, -0.10,  0.56);
  const c1 = slimPoint(cx, cy, scale, angle, slim,  0.18,  0.30);
  const c2 = slimPoint(cx, cy, scale, angle, slim,  0.42, -0.18);
  const p1 = slimPoint(cx, cy, scale, angle, slim,  0.20, -0.58);
  const c3 = slimPoint(cx, cy, scale, angle, slim,  0.00, -0.34);
  const c4 = slimPoint(cx, cy, scale, angle, slim, -0.12, -0.04);
  const p2 = slimPoint(cx, cy, scale, angle, slim,  0.08,  0.20);
  const c5 = slimPoint(cx, cy, scale, angle, slim,  0.22,  0.36);
  const c6 = slimPoint(cx, cy, scale, angle, slim,  0.36,  0.62);
  const p3 = slimPoint(cx, cy, scale, angle, slim,  0.14,  0.82);
  return `M ${pair(p0)} C ${pair(c1)} ${pair(c2)} ${pair(p1)} C ${pair(c3)} ${pair(c4)} ${pair(p2)} C ${pair(c5)} ${pair(c6)} ${pair(p3)}`;
}
function paisleyHalo(cx: number, cy: number, scale: number, angle: number, slim: number) {
  const p0 = slimPoint(cx, cy, scale, angle, slim, -0.42,  0.38);
  const c1 = slimPoint(cx, cy, scale, angle, slim, -0.70,  0.12);
  const c2 = slimPoint(cx, cy, scale, angle, slim, -0.46, -0.44);
  const p1 = slimPoint(cx, cy, scale, angle, slim,  0.02, -0.80);
  const c3 = slimPoint(cx, cy, scale, angle, slim,  0.26, -0.74);
  const c4 = slimPoint(cx, cy, scale, angle, slim,  0.60, -0.44);
  const p2 = slimPoint(cx, cy, scale, angle, slim,  0.56, -0.10);
  return `M ${pair(p0)} C ${pair(c1)} ${pair(c2)} ${pair(p1)} C ${pair(c3)} ${pair(c4)} ${pair(p2)}`;
}

function generateVines() {
  const list: { d: string; stroke: string; width: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const y0 = -300 + i * 112;
    const amp = 30 + (i % 3) * 16;
    const hue = i % 2 === 0 ? '#f6d7a338' : '#b3f0de2e';
    const d =
      `M ${-620},${round1(y0 + Math.sin(i * 0.6) * amp)}` +
      ` C ${-470},${round1(y0 - amp * 0.8)}` +
      ` ${-220},${round1(y0 + amp * 0.6)}` +
      ` ${-20},${round1(y0 - amp * 0.35)}` +
      ` C ${170},${round1(y0 - amp * 1.05)}` +
      ` ${360},${round1(y0 + amp * 0.7)}` +
      ` ${620},${round1(y0 - amp * 0.15)}`;
    list.push({ d, stroke: hue, width: 2 + (i % 3) });
  }
  return list;
}

type Paisley = {
  bodyD: string; innerD: string; seedD: string; ribbonD: string; haloD: string; dotD: string; orbitD: string;
  fillEffect: string; stroke: string; accent: string; innerFill: string; seedFill: string; halo: string;
  bodyWidth: number; ribbonWidth: number; haloWidth: number;
};

function generatePaisleys(): Paisley[] {
  const list: Paisley[] = [];
  for (let i = 0; i < 16; i++) {
    const ring = Math.floor(i / 5);
    const lane = i % 5;
    const orbit = -2.55 + i * 0.58;
    const radius = 120 + ring * 122 + lane * 16;
    const cx = Math.cos(orbit) * radius * 1.12;
    const cy = Math.sin(orbit * 0.9) * radius * 0.68 + (ring - 1) * 18;
    const scale = 54 + ring * 18 + (i % 3) * 6;
    const angle = orbit + Math.sin(i * 1.37) * 0.42 + 0.72;
    const slim = 0.90 + (i % 4) * 0.05;
    const palette = PALETTES[i % PALETTES.length];
    const innerCenter = point(cx, cy, scale, angle, 0.10 * slim, 0.12);
    const seedCenter = point(cx, cy, scale, angle, 0.18 * slim, -0.24);
    const eye = point(cx, cy, scale, angle, 0.16 * slim, -0.28);
    const orbitDot = point(cx, cy, scale, angle, 0.04, 0.22);
    list.push({
      bodyD: paisleyBody(cx, cy, scale, angle, slim),
      innerD: dropPath(innerCenter.x, innerCenter.y, scale * 0.42, angle + 0.08, 0.82),
      seedD: dropPath(seedCenter.x, seedCenter.y, scale * 0.22, angle - 0.18, 0.72),
      ribbonD: paisleyRibbon(cx, cy, scale * 0.92, angle, slim * 0.95),
      haloD: paisleyHalo(cx, cy, scale * 0.96, angle, slim),
      dotD: circlePath(eye.x, eye.y, scale * 0.075),
      orbitD: circlePath(orbitDot.x, orbitDot.y, scale * 0.042),
      fillEffect: palette.effect,
      stroke: palette.stroke,
      accent: palette.accent,
      innerFill: palette.innerFill,
      seedFill: palette.seedFill,
      halo: palette.halo,
      bodyWidth: Math.max(2, round1(scale * 0.038)),
      ribbonWidth: Math.max(1.3, round1(scale * 0.028)),
      haloWidth: Math.max(1.0, round1(scale * 0.018)),
    });
  }
  return list;
}

// ── Named fill surfaces (shared with paisley-garden, same renders) ──
const FILL_SIZE = 192;
function peacockRender(e: any) {
  const t = e.time * 0.22;
  for (let y = 0; y < e.height; y++) {
    for (let x = 0; x < e.width; x++) {
      const nx = x / e.width - 0.5; const ny = y / e.height - 0.5;
      const plume = e.sin(nx * 12.0 + t * 2.4) * 0.5 + 0.5;
      const ripple = e.sin((ny * 10.0 - nx * 3.0) - t * 1.5) * 0.5 + 0.5;
      const grain = e.noise3(nx * 3.0 + t * 0.3, ny * 3.0, t) * 0.5 + 0.5;
      const glow = plume * 0.45 + ripple * 0.25 + grain * 0.30;
      e.setPixel(x, y, 0.06 + glow * 0.20 + grain * 0.05, 0.18 + plume * 0.54 + ripple * 0.08, 0.24 + ripple * 0.42 + grain * 0.18, 1.0);
    }
  }
}
function emberRender(e: any) {
  const t = e.time * 0.28;
  for (let y = 0; y < e.height; y++) {
    for (let x = 0; x < e.width; x++) {
      const nx = x / e.width - 0.5; const ny = y / e.height - 0.5;
      const flame = e.sin(nx * 8.0 + t * 2.2) + e.sin(ny * 13.0 - t * 2.8);
      const marbling = e.noise3(nx * 4.5, ny * 4.5 + t * 0.5, t * 0.7) * 0.5 + 0.5;
      const ring = e.sin(e.sqrt(nx * nx + ny * ny) * 18.0 - t * 4.0) * 0.5 + 0.5;
      const heat = flame * 0.18 + marbling * 0.44 + ring * 0.38;
      e.setPixel(x, y, 0.18 + heat * 0.88, 0.06 + heat * 0.34 + marbling * 0.08, 0.03 + ring * 0.10, 1.0);
    }
  }
}
function jadeRender(e: any) {
  const t = e.time * 0.18;
  for (let y = 0; y < e.height; y++) {
    for (let x = 0; x < e.width; x++) {
      const nx = x / e.width - 0.5; const ny = y / e.height - 0.5;
      const wave = e.sin((nx + ny) * 11.0 + t * 2.0) * 0.5 + 0.5;
      const veins = e.sin((nx * 17.0 - ny * 4.0) - t * 1.2) * 0.5 + 0.5;
      const moss = e.noise3(nx * 3.8 - t * 0.2, ny * 3.8 + t * 0.3, t * 0.6) * 0.5 + 0.5;
      const lush = wave * 0.34 + veins * 0.16 + moss * 0.50;
      e.setPixel(x, y, 0.05 + lush * 0.12, 0.18 + lush * 0.64, 0.10 + moss * 0.24 + wave * 0.10, 1.0);
    }
  }
}
function inkRender(e: any) {
  const t = e.time * 0.24;
  for (let y = 0; y < e.height; y++) {
    for (let x = 0; x < e.width; x++) {
      const nx = x / e.width - 0.5; const ny = y / e.height - 0.5;
      const bloom = e.sin(nx * 9.0 - t * 1.8) * e.sin(ny * 9.0 + t * 1.3);
      const nebula = e.noise3(nx * 4.2 + t * 0.25, ny * 4.2 - t * 0.18, t * 0.8) * 0.5 + 0.5;
      const halo = e.sin(e.sqrt(nx * nx + ny * ny) * 14.0 + t * 3.4) * 0.5 + 0.5;
      const glow = bloom * 0.20 + nebula * 0.46 + halo * 0.34;
      e.setPixel(x, y, 0.10 + glow * 0.26 + halo * 0.08, 0.05 + glow * 0.12, 0.16 + glow * 0.58 + nebula * 0.10, 1.0);
    }
  }
}

const BACKGROUND_WGSL = `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let nx = in.uv.x - 0.5;
  let ny = in.uv.y - 0.5;
  let t = U.time * 0.18;
  let waveA = sin(nx * 9.0 + t * 1.8);
  let waveB = sin((ny + nx * 0.18) * 11.0 - t * 1.4);
  let cloud = snoise3(nx * 2.8 + t * 0.12, ny * 2.6 - t * 0.08, t * 0.25) * 0.5 + 0.5;
  let ring  = sin(sqrt(nx * nx + ny * ny) * 15.0 - t * 3.2) * 0.5 + 0.5;
  let glow  = cloud * 0.56 + ring * 0.28 + (waveA * 0.5 + 0.5) * 0.16;
  let r = 0.05 + glow * 0.15 + waveB * 0.02;
  let g = 0.04 + glow * 0.09 + waveA * 0.02;
  let b = 0.08 + glow * 0.18 + cloud * 0.08;
  return vec4f(r, g, b, 1.0);
}
`;

function NamedPaisleyEffects() {
  const sizeStyle = { width: FILL_SIZE, height: FILL_SIZE, position: 'absolute' as const };
  return (
    <Box style={{ position: 'absolute', width: '100%', height: '100%' }}>
      <Effect name="paisley-peacock" onRender={peacockRender} style={sizeStyle} />
      <Effect name="paisley-ember"   onRender={emberRender}   style={sizeStyle} />
      <Effect name="paisley-jade"    onRender={jadeRender}    style={sizeStyle} />
      <Effect name="paisley-ink"     onRender={inkRender}     style={sizeStyle} />
    </Box>
  );
}

export default function PaisleyGlassleaf() {
  const { vines, paisleys } = useMemo(() => ({
    vines: generateVines(),
    paisleys: generatePaisleys(),
  }), []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0d12' }}>
      <Effect background shader={BACKGROUND_WGSL} style={{ position: 'absolute', width: '100%', height: '100%' }} />

      <NamedPaisleyEffects />

      <Box style={{ width: '100%', height: '100%', padding: 28, gap: 18 }}>
        <Box style={{ width: 460, backgroundColor: '#110d11d8', borderColor: '#f3d5a21f', borderWidth: 1, borderRadius: 26, padding: 22, gap: 10 }}>
          <Text fontSize={34} color="#fff1d0">Paisley Glassleaf</Text>
          <Text fontSize={14} color="#d7c7b2">Hand-tuned bezier bodies (no cardioid) filled from named effect surfaces. Same 4 fill palettes + GPU backdrop as paisley-garden.</Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Box style={{ backgroundColor: '#1e1720', borderColor: '#f7dfb82b', borderWidth: 1, borderRadius: 999, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}><Text fontSize={12} color="#f5e4bf">Bezier body/ribbon/halo</Text></Box>
            <Box style={{ backgroundColor: '#1e1720', borderColor: '#f7dfb82b', borderWidth: 1, borderRadius: 999, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}><Text fontSize={12} color="#f5e4bf">16 paisleys, 4 effects</Text></Box>
          </Row>
        </Box>

        <Box style={{ flexGrow: 1, minHeight: 0, backgroundColor: '#0f11161c', borderColor: '#ffe8b514', borderWidth: 1, borderRadius: 32, overflow: 'hidden' }}>
          <Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
            {vines.map((v: any, i: number) => <Graph.Path key={`v${i}`} d={v.d} stroke={v.stroke} strokeWidth={v.width} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`b${i}`} d={s.bodyD} fillEffect={s.fillEffect} stroke={s.stroke} strokeWidth={s.bodyWidth} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`h${i}`} d={s.haloD} fillEffect={s.fillEffect} stroke={s.halo} strokeWidth={s.haloWidth} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`i${i}`} d={s.innerD} fillEffect={s.fillEffect} stroke={s.stroke} strokeWidth={1.5} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`r${i}`} d={s.ribbonD} fillEffect={s.fillEffect} stroke={s.accent} strokeWidth={s.ribbonWidth} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`s${i}`} d={s.seedD} fillEffect={s.fillEffect} stroke={s.stroke} strokeWidth={1.4} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`d${i}`} d={s.dotD} fillEffect={s.fillEffect} />)}
            {paisleys.map((s: any, i: number) => <Graph.Path key={`o${i}`} d={s.orbitD} fillEffect={s.fillEffect} />)}
          </Graph>
        </Box>
      </Box>
    </Box>
  );
}
