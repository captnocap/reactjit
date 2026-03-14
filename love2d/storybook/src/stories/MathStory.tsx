/**
 * Math — Package documentation page (Layout2 zigzag narrative).
 *
 * All math runs in Lua via useMath(). Demos call math:call RPC.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, Math as MathBlock, classifiers as S, useLuaQuery} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  vec: '#4fc3f7',
  mat: '#ab47bc',
  quat: '#ff7043',
  geo: '#66bb6a',
  interp: '#ffa726',
  noise: '#26c6da',
  fft: '#ec4899',
  bezier: '#a78bfa',
  pool: '#ef5350',
};

// ── Static code blocks (hoisted) ─────────────────────────

const INSTALL_CODE = `import { useMath } from '@reactjit/math'

const math = useMath()
const result = await math({ op: 'vec2.add', a: [1, 2], b: [3, 4] })
// Batch: await math({ batch: [{ op: 'vec2.add', a, b }, ...] })`;

const VECTOR_CODE = `const math = useMath()
const b = await math({ op: 'vec2.fromAngle', radians: angle })
const sum = await math({ op: 'vec2.add', a: [3, 1], b: scaled })
const d = await math({ op: 'vec2.dot', a: normA, b })
// Also: vec3.cross, vec3.reflect, vec3.slerp, vec4`;

const MATRIX_CODE = `const m = await math({ op: 'mat4.rotateX', m: identity, radians: angle })
const p = await math({ op: 'mat4.transformPoint', m, v: [1, 0, 0] })
const det = await math({ op: 'mat4.determinant', m })
// lookAt, perspective, ortho, decompose, fromQuat`;

const QUAT_CODE = `const q = await math({ op: 'quat.fromAxisAngle', axis: [0,1,0], radians: Math.PI/2 })
const interp = await math({ op: 'quat.slerp', a: identity, b: q, t })
const euler = await math({ op: 'quat.toEuler', q: interp })
const rotated = await math({ op: 'quat.rotateVec3', q, v: [1,0,0] })`;

const INTERP_CODE = `await math({ op: 'interp.lerp', a: 0, b: 100, t: 0.5 })       // 50
await math({ op: 'interp.smoothstep', edge0: 0, edge1: 1, x: 0.5 }) // 0.5
await math({ op: 'interp.remap', value: 0.5, inMin: 0, inMax: 1, outMin: 100, outMax: 200 })
await math({ op: 'interp.clamp', value: 150, min: 0, max: 100 })     // 100`;

const GEOMETRY_CODE = `await math({ op: 'geo.bbox2_intersects', a: boxA, b: boxB })
await math({ op: 'geo.bbox2_intersection', a: boxA, b: boxB })
await math({ op: 'geo.distancePointToSegment', point, a: segA, b: segB })
await math({ op: 'geo.circleContainsPoint', center, radius, point })
await math({ op: 'geo.lineIntersection', a1, a2, b1, b2 })`;

const NOISE_CODE = `const math = useMath()
const field = await math({
  op: 'noisefield', width: 24, height: 24,
  scale: 0.1, seed: 42, octaves: 4,
})  // Returns number[] (flat grid, Perlin via LuaJIT)`;

const FFT_CODE = `const spectrum = await math({
  op: 'fft', samples: mySamples,
})  // Returns magnitude[] (Cooley-Tukey radix-2)`;

const BEZIER_CODE = `const curve = await math({
  op: 'bezier',
  points: [[0,0], [100,200], [200,50], [300,150]],
  segments: 32,
})  // Returns [x,y][] (De Casteljau evaluation)`;

const POOL_CODE = `const math = useMath()
const results = await math({
  batch: [
    { op: 'noise2d', x: 1, y: 2, seed: 42 },
    { op: 'vec2.add', a: [1,2], b: [3,4] },
    { op: 'interp.lerp', a: 0, b: 100, t: 0.5 },
  ]
})  // results[0], results[1], results[2]`;

const TYPESET_CODE = `import { Math } from '@reactjit/core'

<Math tex="E = mc^2" />
<Math tex="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" fontSize={20} />`;

const TYPESET_FORMULAS: { label: string; tex: string }[] = [
  { label: "Euler's identity", tex: 'e^{i\\pi} + 1 = 0' },
  { label: 'Quadratic formula', tex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: 'Basel problem', tex: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
  { label: 'Gaussian integral', tex: '\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}' },
  { label: 'Taylor series', tex: 'e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}' },
  { label: "Euler's formula", tex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta' },
  { label: 'Matrix', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: 'Binomial theorem', tex: '(x+y)^n = \\sum_{k=0}^{n} \\binom{n}{k} x^k y^{n-k}' },
  { label: 'Gradient', tex: '\\nabla f = \\frac{\\partial f}{\\partial x} \\hat{x} + \\frac{\\partial f}{\\partial y} \\hat{y}' },
  { label: 'Pythagorean theorem', tex: 'a^2 + b^2 = c^2' },
];

const FEATURE_LIST = [
  { label: 'Vec2', desc: 'add, sub, mul, dot, cross, normalize, lerp, rotate, fromAngle', color: C.vec },
  { label: 'Vec3', desc: 'cross, reflect, slerp, up/forward/right + all Vec2 ops', color: C.vec },
  { label: 'Vec4', desc: '4D arithmetic, normalize, lerp, clamp (colors, homogeneous)', color: C.vec },
  { label: 'Mat4', desc: 'multiply, invert, lookAt, perspective, ortho, decompose, fromQuat', color: C.mat },
  { label: 'Quat', desc: 'slerp, fromAxisAngle, fromEuler, toEuler, toMat4, rotateVec3', color: C.quat },
  { label: 'BBox2/3', desc: 'fromPoints, contains, intersects, union, intersection, expand', color: C.geo },
  { label: 'Interpolation', desc: 'lerp, smoothstep, smootherstep, remap, clamp, wrap, damp, pingPong', color: C.interp },
  { label: 'Noise', desc: 'Perlin noise grid via LuaJIT', color: C.noise },
  { label: 'FFT', desc: 'Cooley-Tukey radix-2 via Lua', color: C.fft },
  { label: 'Bezier', desc: 'De Casteljau curve evaluation via Lua', color: C.bezier },
  { label: 'Batch', desc: 'N ops in one bridge call via { batch: [...] }', color: C.pool },
  { label: '<Math />', desc: 'LaTeX typesetting: fractions, roots, scripts, Greek, matrices, operators', color: C.accent },
];

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

function Label({ label, value, color }: { label: string; value: string; color?: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG8>
      <S.StoryCap>{label}</S.StoryCap>
      <Text style={{ color: color || c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
    </S.RowCenterG8>
  );
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Box style={{ backgroundColor: color + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}>
        <Text style={{ color, fontSize: 10 }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

// ── Band layout helpers ─────────────────────────────────

const BAND_STYLE = {
  flexDirection: 'row' as const,
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const HALF = { flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

// ── Vec2 Demo (Lua-backed) ──────────────────────────────

function VectorDemo() {
  const c = useThemeColors();
  const [angle, setAngle] = useState(0);

  // Query 1: independent base ops
  const { data: base } = useLuaQuery<any[]>('math:call', { batch: [
    { op: 'vec2.fromAngle', radians: angle },
    { op: 'vec2.normalize', v: [3, 1] },
  ]}, [angle]);

  const b = base?.[0] as number[] | undefined;
  const normA = base?.[1] as number[] | undefined;

  // Query 2: ops that depend on b and normA
  const { data: mid } = useLuaQuery<any[]>('math:call',
    b && normA ? { batch: [
      { op: 'vec2.scale', v: b, s: 2 },
      { op: 'vec2.dot', a: normA, b },
      { op: 'vec2.cross', a: [3, 1], b },
    ]} : { batch: [] },
    [b?.[0], b?.[1]],
  );

  const scaled = (b && mid?.[0]) as number[] | undefined;
  const dot = mid?.[1] as number | undefined;
  const cross = mid?.[2] as number | undefined;

  // Query 3: ops that depend on scaled
  const { data: final } = useLuaQuery<any[]>('math:call',
    scaled ? { batch: [
      { op: 'vec2.add', a: [3, 1], b: scaled },
      { op: 'vec2.length', v: scaled },
    ]} : { batch: [] },
    [scaled?.[0], scaled?.[1]],
  );

  const sum = final?.[0] as number[] | undefined;
  const dist = final?.[1] as number | undefined;

  return (
    <S.StackG8W100>
      <S.RowG8 style={{ flexWrap: 'wrap' }}>
        <Tag text="Vec2" color={C.vec} />
        <Tag text="Vec3" color={C.vec} />
        <Tag text="Vec4" color={C.vec} />
      </S.RowG8>
      <Label label="a" value={'[3, 1]'} />
      {b && sum && dot != null && cross != null && dist != null && <>
        <Label label="b = fromAngle" value={`[${b[0].toFixed(3)}, ${b[1].toFixed(3)}]`} color={C.vec} />
        <Label label="a + 2b" value={`[${sum[0].toFixed(3)}, ${sum[1].toFixed(3)}]`} color={C.vec} />
        <Label label="dot(norm(a), b)" value={dot.toFixed(4)} />
        <Label label="cross(a, b)" value={cross.toFixed(4)} />
        <Label label="distance(a, a+2b)" value={dist.toFixed(4)} />
      </>}
      <S.RowG8>
        <ActionBtn label={'\u2190 Rotate'} color={C.vec} onPress={() => setAngle(p => p - 0.3)} />
        <ActionBtn label={'Rotate \u2192'} color={C.vec} onPress={() => setAngle(p => p + 0.3)} />
      </S.RowG8>
      <S.StoryTiny>
        {`angle: ${(angle * 180 / Math.PI).toFixed(1)}\u00B0`}
      </S.StoryTiny>
    </S.StackG8W100>
  );
}

// ── Mat4 Demo (Lua-backed) ──────────────────────────────

function MatrixDemo() {
  const c = useThemeColors();
  const [rx, setRx] = useState(0);

  // Query 1: get identity matrix (mount-once)
  const { data: identity } = useLuaQuery<any>('math:call', { op: 'mat4.identity' }, []);

  // Query 2: rotate identity by rx (dep on rx, identity)
  const { data: m } = useLuaQuery<any>('math:call',
    identity ? { op: 'mat4.rotateX', m: identity, radians: rx } : { batch: [] },
    [rx, identity ? 1 : 0],
  );

  // Query 3: analyze the rotated matrix
  const { data: res } = useLuaQuery<any[]>('math:call',
    m && !Array.isArray(m) ? { batch: [] } :
    m ? { batch: [
      { op: 'mat4.transformPoint', m, v: [1, 0, 0] },
      { op: 'mat4.determinant', m },
      { op: 'mat4.decompose', m },
    ]} : { batch: [] },
    [m ? 1 : 0, rx],
  );

  const transformed = res?.[0];
  const det = res?.[1];
  const decomposed = res?.[2];

  return (
    <S.StackG8W100>
      <Tag text="Mat4" color={C.mat} />
      <Label label="rotateX" value={`${(rx * 180 / Math.PI).toFixed(1)}\u00B0`} color={C.mat} />
      {transformed && det != null && decomposed && <>
        <Label label="transform([1,0,0])" value={`[${transformed[0].toFixed(3)}, ${transformed[1].toFixed(3)}, ${transformed[2].toFixed(3)}]`} color={C.mat} />
        <Label label="determinant" value={det.toFixed(6)} />
        <Label label="decompose.scale" value={`[${decomposed.scale.map((v: number) => v.toFixed(2)).join(', ')}]`} />
      </>}
      <S.RowG8>
        <ActionBtn label={`Rotate +12\u00B0`} color={C.mat} onPress={() => setRx(p => p + Math.PI / 15)} />
        <ActionBtn label="Reset" color={c.textDim} onPress={() => setRx(0)} />
      </S.RowG8>
    </S.StackG8W100>
  );
}

// ── Quaternion Demo (Lua-backed) ────────────────────────

function QuaternionDemo() {
  const [t, setT] = useState(0);

  // Query 1: base quaternions (mount-once — these are constants)
  const { data: bases } = useLuaQuery<any[]>('math:call', { batch: [
    { op: 'quat.fromAxisAngle', axis: [0, 1, 0], radians: Math.PI / 2 },
    { op: 'quat.identity' },
  ]}, []);

  const q2 = bases?.[0];
  const q1 = bases?.[1];

  // Query 2: slerp interpolation (dep on t)
  const { data: interpolated } = useLuaQuery<any>('math:call',
    q1 && q2 ? { op: 'quat.slerp', a: q1, b: q2, t } : { batch: [] },
    [t, q1 ? 1 : 0],
  );

  // Query 3: analyze interpolated quaternion
  const { data: res } = useLuaQuery<any[]>('math:call',
    interpolated && !Array.isArray(interpolated) ? { batch: [] } :
    interpolated ? { batch: [
      { op: 'quat.toEuler', q: interpolated },
      { op: 'quat.rotateVec3', q: interpolated, v: [1, 0, 0] },
    ]} : { batch: [] },
    [interpolated ? 1 : 0, t],
  );

  const euler = res?.[0];
  const rotated = res?.[1];

  const clampT = (v: number) => Math.max(0, Math.min(1, v));

  return (
    <S.StackG8W100>
      <Tag text="Quat" color={C.quat} />
      <Label label="slerp t" value={t.toFixed(2)} color={C.quat} />
      {euler && rotated && <>
        <Label label="euler (deg)" value={`[${euler.map((v: number) => (v * 180 / Math.PI).toFixed(1)).join(', ')}]`} />
        <Label label="rotateVec3([1,0,0])" value={`[${rotated.map((v: number) => v.toFixed(3)).join(', ')}]`} color={C.quat} />
      </>}
      <S.RowG8>
        <ActionBtn label={'\u2190 t'} color={C.quat} onPress={() => setT(p => clampT(p - 0.1))} />
        <ActionBtn label={'t \u2192'} color={C.quat} onPress={() => setT(p => clampT(p + 0.1))} />
      </S.RowG8>
    </S.StackG8W100>
  );
}

// ── Interpolation Demo (Lua-backed) ─────────────────────

const INTERP_STEPS = 32;

function InterpolationDemo() {
  const c = useThemeColors();

  const batch: any[] = [];
  for (let n = 0; n < 4; n++) {
    for (let i = 0; i <= INTERP_STEPS; i++) {
      const t = i / INTERP_STEPS;
      if (n === 0) batch.push({ op: 'interp.lerp', a: 0, b: 1, t });
      else if (n === 1) batch.push({ op: 'interp.smoothstep', edge0: 0, edge1: 1, x: t });
      else if (n === 2) batch.push({ op: 'interp.smootherstep', edge0: 0, edge1: 1, x: t });
      else batch.push({ op: 'interp.damp', a: 0, b: 1, smoothing: 5, dt: t });
    }
  }
  batch.push({ op: 'interp.pingPong', value: 2.7, length: 1 });
  batch.push({ op: 'interp.remap', value: 0.5, inMin: 0, inMax: 1, outMin: 100, outMax: 200 });
  batch.push({ op: 'interp.inverseLerp', a: 10, b: 20, value: 15 });
  batch.push({ op: 'interp.wrap', value: 370, min: 0, max: 360 });

  const { data: res } = useLuaQuery<any[]>('math:call', { batch }, []);

  const names = ['lerp', 'smoothstep', 'smootherstep', 'damp(5)'];
  const colors = ['#4fc3f7', '#66bb6a', '#ffa726', '#ef5350'];
  const perCurve = INTERP_STEPS + 1;

  const curves = res ? names.map((name, n) => ({
    name,
    color: colors[n],
    values: res.slice(n * perCurve, (n + 1) * perCurve) as number[],
  })) : null;

  const base = 4 * perCurve;
  const extras = res ? {
    pingPong: res[base], remap: res[base + 1],
    inverseLerp: res[base + 2], wrap: res[base + 3],
  } : null;

  return (
    <S.StackG8W100>
      {curves ? curves.map(curve => (
        <Box key={curve.name} style={{ gap: 4 }}>
          <Text style={{ color: curve.color, fontSize: 8, fontFamily: 'monospace' }}>{curve.name}</Text>
          <Box style={{ flexDirection: 'row', gap: 1, height: 40, alignItems: 'end' }}>
            {curve.values.map((v, i) => (
              <Box key={i} style={{ flexGrow: 1, height: Math.max(1, v * 38), backgroundColor: curve.color + '66', borderRadius: 1 }} />
            ))}
          </Box>
        </Box>
      )) : <S.StoryMuted>Computing curves...</S.StoryMuted>}
      {extras && <>
        <Label label="pingPong(2.7, 1)" value={extras.pingPong.toFixed(3)} />
        <Label label="remap(0.5, 0, 1, 100, 200)" value={extras.remap.toFixed(1)} />
        <Label label="inverseLerp(10, 20, 15)" value={extras.inverseLerp.toFixed(2)} />
        <Label label="wrap(370, 0, 360)" value={extras.wrap.toFixed(1)} />
      </>}
    </S.StackG8W100>
  );
}

// ── Geometry Demo (Lua-backed) ──────────────────────────

function GeometryDemo() {
  const c = useThemeColors();
  const [px, setPx] = useState(3);

  const boxA = { min: [0, 0], max: [4, 4] };
  const boxB = { min: [px, 1], max: [px + 3, 5] };

  const { data: res } = useLuaQuery<any[]>('math:call', { batch: [
    { op: 'geo.bbox2_intersects', a: boxA, b: boxB },
    { op: 'geo.bbox2_intersection', a: boxA, b: boxB },
    { op: 'geo.bbox2_union', a: boxA, b: boxB },
    { op: 'geo.distancePointToSegment', point: [px, 3], a: [0, 0], b: [4, 4] },
    { op: 'geo.circleContainsPoint', center: [2, 2], radius: 3, point: [px, 3] },
    { op: 'geo.lineIntersection', a1: [0, 0], a2: [4, 4], b1: [0, 4], b2: [4, 0] },
  ]}, [px]);

  const r = res ? { intersects: res[0], overlap: res[1], union: res[2], segDist: res[3], inCircle: res[4], lineHit: res[5] } : null;

  return (
    <S.StackG8W100>
      <Label label="BBox A" value={'[0,0] \u2192 [4,4]'} />
      <Label label="BBox B" value={`[${px},1] \u2192 [${px + 3},5]`} color={C.geo} />
      {r && <>
        <S.RowCenterG6>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: r.intersects ? C.geo : C.pool }} />
          <Text style={{ fontSize: 9, color: r.intersects ? C.geo : C.pool }}>
            {r.intersects ? 'Intersects' : 'No intersection'}
          </Text>
        </S.RowCenterG6>
        {r.overlap && <Label label="overlap" value={`[${r.overlap.min[0]},${r.overlap.min[1]}] \u2192 [${r.overlap.max[0]},${r.overlap.max[1]}]`} />}
        <Label label="union" value={`[${r.union.min[0]},${r.union.min[1]}] \u2192 [${r.union.max[0]},${r.union.max[1]}]`} />
        <Label label="dist to segment" value={r.segDist.toFixed(3)} />
        <S.RowCenterG6>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: r.inCircle ? C.geo : C.pool }} />
          <Text style={{ fontSize: 9, color: r.inCircle ? C.geo : C.pool }}>
            {r.inCircle ? 'Inside circle(r=3)' : 'Outside circle(r=3)'}
          </Text>
        </S.RowCenterG6>
        {r.lineHit && <Label label="line \u2229" value={`[${r.lineHit[0].toFixed(1)}, ${r.lineHit[1].toFixed(1)}]`} />}
      </>}
      <S.RowG8>
        <ActionBtn label={'\u2190 Move B'} color={C.geo} onPress={() => setPx(p => p - 1)} />
        <ActionBtn label={'Move B \u2192'} color={C.geo} onPress={() => setPx(p => p + 1)} />
      </S.RowG8>
    </S.StackG8W100>
  );
}

// ── Noise Field Demo (Lua-backed) ───────────────────────

function NoiseFieldDemo() {
  const c = useThemeColors();
  const [seed, setSeed] = useState(42);
  const [scale, setScale] = useState(0.1);
  const SIZE = 24;

  const { data: field } = useLuaQuery<number[]>('math:call',
    { op: 'noisefield', width: SIZE, height: SIZE, scale, seed, octaves: 4 },
    [seed, scale],
  );

  let rows: string[][] | null = null;
  if (field) {
    rows = [];
    for (let row = 0; row < SIZE; row++) {
      const rowColors: string[] = [];
      for (let col = 0; col < SIZE; col++) {
        const v = field[row * SIZE + col] ?? 0;
        const brightness = Math.floor(Math.max(0, Math.min(1, v)) * 255);
        const hex = brightness.toString(16).padStart(2, '0');
        rowColors.push(`#${hex}${hex}${hex}`);
      }
      rows.push(rowColors);
    }
  }

  return (
    <S.StackG8W100>
      {rows ? (
        <Box style={{ gap: 0 }}>
          {rows.map((colors, row) => (
            <Box key={row} style={{ flexDirection: 'row', gap: 0 }}>
              {colors.map((color, col) => (
                <Box key={col} style={{ width: 12, height: 12, backgroundColor: color }} />
              ))}
            </Box>
          ))}
        </Box>
      ) : (
        <S.StoryMuted>Loading noise field...</S.StoryMuted>
      )}
      <Label label="seed" value={String(seed)} color={C.noise} />
      <Label label="scale" value={scale.toFixed(2)} color={C.noise} />
      <Label label="grid" value={`${SIZE}\u00D7${SIZE}`} />
      <S.RowG8>
        <ActionBtn label={`Seed ${seed + 1}`} color={C.noise} onPress={() => setSeed(p => p + 1)} />
        <ActionBtn label={`Scale ${scale === 0.1 ? '0.2' : scale === 0.2 ? '0.05' : '0.1'}`} color={C.noise} onPress={() => setScale(p => p === 0.1 ? 0.2 : p === 0.2 ? 0.05 : 0.1)} />
      </S.RowG8>
    </S.StackG8W100>
  );
}

// ── FFT Demo (Lua-backed) ───────────────────────────────

function FFTDemo() {
  const c = useThemeColors();
  const [freq, setFreq] = useState(4);
  const N = 64;

  const samples: number[] = [];
  for (let i = 0; i < N; i++) {
    samples.push(Math.sin(i * freq * 2 * Math.PI / N) + 0.5 * Math.sin(i * freq * 3 * 2 * Math.PI / N));
  }

  const { data: spectrum } = useLuaQuery<number[]>('math:call', { op: 'fft', samples }, [freq]);

  const halfN = N / 2;
  const spectrumSlice = spectrum ? spectrum.slice(0, halfN) : null;
  const maxSpectrum = spectrumSlice ? Math.max(...spectrumSlice) : 0;

  return (
    <S.StackG8W100>
      <Text style={{ color: c.textSecondary, fontSize: 9 }}>
        {`sin(${freq}x) + 0.5\u00B7sin(${freq * 3}x)  \u2014  ${N} samples`}
      </Text>
      <Box style={{ gap: 2 }}>
        <S.StoryTiny>Waveform</S.StoryTiny>
        <S.RowCenter style={{ gap: 0, height: 32 }}>
          {samples.map((v, i) => (
            <Box key={i} style={{ flexGrow: 1, height: Math.max(1, Math.abs(v) * 14), backgroundColor: C.fft + '88', borderRadius: 1 }} />
          ))}
        </S.RowCenter>
      </Box>
      {spectrumSlice ? (
        <Box style={{ gap: 2 }}>
          <S.StoryTiny>Magnitude spectrum</S.StoryTiny>
          <Box style={{ flexDirection: 'row', gap: 0, height: 40, alignItems: 'end' }}>
            {spectrumSlice.map((v, i) => {
              const h = maxSpectrum > 0 ? Math.max(1, (v / maxSpectrum) * 38) : 1;
              return <Box key={i} style={{ flexGrow: 1, height: h, backgroundColor: C.fft + '66', borderRadius: 1 }} />;
            })}
          </Box>
        </Box>
      ) : (
        <S.StoryMuted>Computing FFT...</S.StoryMuted>
      )}
      <S.RowG8>
        <ActionBtn label={`freq ${freq - 1}`} color={C.fft} onPress={() => setFreq(p => Math.max(1, p - 1))} />
        <ActionBtn label={`freq ${freq + 1}`} color={C.fft} onPress={() => setFreq(p => Math.min(16, p + 1))} />
      </S.RowG8>
    </S.StackG8W100>
  );
}

// ── Bezier Demo (Lua-backed) ────────────────────────────

function BezierDemo() {
  const c = useThemeColors();
  const [cy, setCy] = useState(150);
  const controlPoints: [number, number][] = [[0, 0], [80, cy], [220, 300 - cy], [300, 150]];

  const { data: curve } = useLuaQuery<[number, number][]>('math:call',
    { op: 'bezier', points: controlPoints, segments: 32 },
    [cy],
  );

  return (
    <S.StackG8W100>
      {controlPoints.map((p, i) => (
        <Label key={i} label={`P${i}`} value={`[${p[0]}, ${p[1]}]`} color={i === 1 || i === 2 ? C.bezier : undefined} />
      ))}
      {curve ? (
        <Box style={{ gap: 2 }}>
          <S.StoryTiny>{`${curve.length} evaluated points`}</S.StoryTiny>
          <Box style={{ flexDirection: 'row', gap: 1, height: 40, alignItems: 'end' }}>
            {curve.map((p, i) => {
              const h = Math.max(1, (p[1] / 300) * 38);
              return <Box key={i} style={{ flexGrow: 1, height: h, backgroundColor: C.bezier + '66', borderRadius: 1 }} />;
            })}
          </Box>
        </Box>
      ) : (
        <S.StoryMuted>Computing bezier...</S.StoryMuted>
      )}
      <S.RowG8>
        <ActionBtn label={'\u2190 Flatten'} color={C.bezier} onPress={() => setCy(p => Math.max(0, p - 30))} />
        <ActionBtn label={'Curve \u2192'} color={C.bezier} onPress={() => setCy(p => Math.min(300, p + 30))} />
      </S.RowG8>
    </S.StackG8W100>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  return (
    <>
      {FEATURE_LIST.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <S.StoryBody style={{ fontWeight: 'normal', width: 100 }}>{f.label}</S.StoryBody>
          <S.SecondaryBody>{f.desc}</S.SecondaryBody>
        </S.RowCenterG8>
      ))}
    </>
  );
}

// ── MathStory ─────────────────────────────────────────

export function MathStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="package" tintColor={C.accent} />
        <S.StoryTitle>
          {'Math'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/math'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {"All math in Lua. One hook."}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'All math runs in Lua via LuaJIT. React gets one hook: useMath().'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Vectors, matrices, quaternions, interpolation, geometry, noise, FFT, and bezier — all computed by LuaJIT and accessed through a single math:call RPC. Batch multiple ops in one bridge round-trip.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Install: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'One hook, one RPC endpoint. Pass { op, ...args } for a single call, or { batch: [...] } for multiple ops in one bridge round-trip.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
        </Box>

        <Divider />

        {/* ── Vectors: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <VectorDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="code">{'VECTORS'}</SectionLabel>
            <S.StoryBody>
              {'Vec2, Vec3, Vec4 as arrays. All operations run in LuaJIT — add, sub, mul, dot, cross, normalize, lerp, smoothstep, rotate, fromAngle, reflect, slerp.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={VECTOR_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Matrices: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'MATRICES'}</SectionLabel>
            <S.StoryBody>
              {'4\u00D74 matrix as 16-element array. Multiply, invert, transpose, decompose into translation + rotation + scale. Includes lookAt, perspective, and ortho projection builders.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={MATRIX_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={HALF}>
            <MatrixDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Quaternions: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <QuaternionDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="zap">{'QUATERNIONS'}</SectionLabel>
            <S.StoryBody>
              {'[x, y, z, w] array. Slerp for smooth rotation interpolation without gimbal lock. Convert to/from Euler angles, axis-angle, and Mat4.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={QUAT_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Interpolation: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="sliders">{'INTERPOLATION'}</SectionLabel>
            <S.StoryBody>
              {'Scalar easing and mapping. lerp, smoothstep (Hermite cubic), smootherstep (Perlin quintic), damp, remap, clamp, wrap, pingPong, moveTowards, smoothDamp.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={INTERP_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={HALF}>
            <InterpolationDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Geometry: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <GeometryDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="globe">{'GEOMETRY'}</SectionLabel>
            <S.StoryBody>
              {'BBox2 and BBox3 axis-aligned bounding boxes. Point-to-segment distance, circle-point containment, circle-rect intersection, line-line intersection.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={GEOMETRY_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Callout band ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Everything runs in LuaJIT. The bridge is an in-process FFI call, not a network hop. Use batch mode to send multiple ops in a single round-trip when you need several results at once.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Noise: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="gauge">{'NOISE'}</SectionLabel>
            <S.StoryBody>
              {'Perlin noise via LuaJIT. Noise field returns a flat grid of values for terrain, textures, and procedural generation. Configurable seed, scale, octaves, lacunarity, and persistence.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={NOISE_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={HALF}>
            <NoiseFieldDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── FFT: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <FFTDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="zap">{'FFT ANALYSIS'}</SectionLabel>
            <S.StoryBody>
              {'Cooley-Tukey radix-2 FFT via Lua. Pass time-domain samples, get back magnitude spectrum.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={FFT_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Bezier: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="code">{'BEZIER'}</SectionLabel>
            <S.StoryBody>
              {'De Casteljau curve evaluation via Lua. Pass control points and segment count, get back evaluated points along the curve.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={BEZIER_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={HALF}>
            <BezierDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Batch: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'BATCH'}</SectionLabel>
            <S.StoryBody>
              {'Batch multiple math operations into a single bridge call. Pass { batch: [...] } instead of { op: ... }. All ops execute in Lua and return as an array.'}
            </S.StoryBody>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={POOL_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
        </Box>

        <Divider />

        {/* ── LaTeX Typesetting: intro callout ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'LaTeX Typesetting'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Render real math notation with <Math tex="..." />. Parsed and typeset entirely in Lua \u2014 recursive descent parser, heuristic box layout, Latin Modern Math font.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Typesetting usage: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="code">{'USAGE'}</SectionLabel>
            <S.StoryBody>
              {'One-liner LaTeX math rendering. Supports fractions, roots, superscripts, subscripts, Greek letters, big operators, matrices, accents, and delimiters.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={TYPESET_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={HALF}>
            <MathBlock tex={'E = mc^2'} fontSize={24} color={c.text} />
            <MathBlock tex={'\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}'} fontSize={18} color={c.text} />
          </Box>
        </Box>

        <Divider />

        {/* ── Euler's identity: math | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[0].tex} fontSize={22} color={c.text} />
          </Box>
          <Box style={HALF}>
            <Tag text={TYPESET_FORMULAS[0].label} color={C.accent} />
            <S.SecondaryBody>
              {'The most beautiful equation in mathematics \u2014 connects five fundamental constants: e, i, \u03C0, 1, and 0.'}
            </S.SecondaryBody>
          </Box>
        </Box>

        <Divider />

        {/* ── Quadratic formula: text | math ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <Tag text={TYPESET_FORMULAS[1].label} color={C.accent} />
            <S.SecondaryBody>
              {'Solutions to ax\u00B2 + bx + c = 0. Nested fraction with square root.'}
            </S.SecondaryBody>
          </Box>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[1].tex} fontSize={20} color={c.text} />
          </Box>
        </Box>

        <Divider />

        {/* ── Basel + Gaussian: math | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[2].tex} fontSize={20} color={c.text} />
            <MathBlock tex={TYPESET_FORMULAS[3].tex} fontSize={20} color={c.text} />
          </Box>
          <Box style={HALF}>
            <Tag text={'Infinite Series & Integrals'} color={C.accent} />
            <S.SecondaryBody>
              {'Big operators with limits above and below. Sum and integral signs scale to match their content.'}
            </S.SecondaryBody>
          </Box>
        </Box>

        <Divider />

        {/* ── Taylor + Euler formula: text | math ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <Tag text={'Taylor Series & Euler'} color={C.accent} />
            <S.SecondaryBody>
              {'Function names render upright (not italic). Greek letters use Latin Modern Math glyphs.'}
            </S.SecondaryBody>
          </Box>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[4].tex} fontSize={20} color={c.text} />
            <MathBlock tex={TYPESET_FORMULAS[5].tex} fontSize={20} color={c.text} />
          </Box>
        </Box>

        <Divider />

        {/* ── Matrix: math | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[6].tex} fontSize={20} color={c.text} />
          </Box>
          <Box style={HALF}>
            <Tag text={TYPESET_FORMULAS[6].label} color={C.accent} />
            <S.SecondaryBody>
              {'Matrix environments with auto-sized parentheses. Supports pmatrix, bmatrix, vmatrix, and cases.'}
            </S.SecondaryBody>
          </Box>
        </Box>

        <Divider />

        {/* ── Binomial + Gradient + Pythagorean: text | math ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <Tag text={'More Formulas'} color={C.accent} />
            <S.SecondaryBody>
              {'Accents (hat, vec), partial derivatives, binomial coefficients, and simple expressions.'}
            </S.SecondaryBody>
          </Box>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[7].tex} fontSize={18} color={c.text} />
            <MathBlock tex={TYPESET_FORMULAS[8].tex} fontSize={18} color={c.text} />
            <MathBlock tex={TYPESET_FORMULAS[9].tex} fontSize={22} color={c.text} />
          </Box>
        </Box>

        <Divider />

        {/* ── Feature catalog ── */}
        <S.StoryFullBand>
          <SectionLabel icon="terminal">{'API SURFACE'}</SectionLabel>
          <FeatureCatalog />
        </S.StoryFullBand>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="package" />
        <S.StoryBreadcrumbActive>{'Math'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.2.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
