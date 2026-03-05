/**
 * Math — Package documentation page (Layout2 zigzag narrative).
 *
 * Live demos for vectors, matrices, quaternions, interpolation, geometry,
 * noise, FFT, and bezier. Pure TS for lightweight ops, Lua-backed for heavy compute.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, Math as MathBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  Vec2, Vec3, Mat4, Quat,
  lerp, smoothstep, smootherstep, remap, clamp, pingPong, inverseLerp, wrap,
  BBox2,
  distancePointToSegment, circleContainsPoint, lineIntersection,
  useNoiseField, useFFT, useBezier,
} from '../../../packages/math/src';
import type { Vec2 as Vec2T, Vec3 as Vec3T, BBox2 as BBox2T } from '../../../packages/math/src';

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

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { Vec2, Vec3, Vec4, Mat4, Quat } from '@reactjit/math'
import { lerp, smoothstep, clamp, remap } from '@reactjit/math'
import { BBox2, circleContainsPoint } from '@reactjit/math'
import { useNoiseField, useFFT, useBezier } from '@reactjit/math'`;

const VECTOR_CODE = `const a: Vec2 = [3, 1]
const b = Vec2.fromAngle(angle)
const sum = Vec2.add(a, Vec2.scale(b, 2))
const d = Vec2.dot(Vec2.normalize(a), b)
// Also: Vec3.cross, Vec3.reflect, Vec3.slerp, Vec4`;

const MATRIX_CODE = `const m = Mat4.rotateX(Mat4.identity(), angle)
const p = Mat4.transformPoint(m, [1, 0, 0])
const det = Mat4.determinant(m)
// lookAt, perspective, ortho, decompose, fromQuat`;

const QUAT_CODE = `const q = Quat.fromAxisAngle([0, 1, 0], Math.PI / 2)
const interpolated = Quat.slerp(Quat.identity(), q, t)
const euler = Quat.toEuler(interpolated)
const rotated = Quat.rotateVec3(q, [1, 0, 0])`;

const INTERP_CODE = `lerp(0, 100, 0.5)          // 50
smoothstep(0, 1, 0.5)      // 0.5 (Hermite cubic)
smootherstep(0, 1, 0.5)    // 0.5 (Perlin quintic)
remap(0.5, 0, 1, 100, 200) // 150
clamp(150, 0, 100)         // 100
pingPong(2.7, 1)           // 0.7`;

const GEOMETRY_CODE = `const hit = BBox2.intersects(boxA, boxB)
const overlap = BBox2.intersection(boxA, boxB)
const dist = distancePointToSegment(point, segA, segB)
const inside = circleContainsPoint(center, radius, point)
const cross = lineIntersection(a1, a2, b1, b2)`;

const NOISE_CODE = `const field = useNoiseField({
  width: 24, height: 24,
  scale: 0.1, seed: 42, octaves: 4,
})
// Returns number[] | null (flat grid, Perlin via Lua FFI)`;

const FFT_CODE = `const samples = Array.from({ length: 64 }, (_, i) =>
  Math.sin(i * freq * 2 * Math.PI / 64)
)
const spectrum = useFFT(samples)
// Returns magnitude[] | null (Cooley-Tukey radix-2)`;

const BEZIER_CODE = `const curve = useBezier({
  points: [[0,0], [100,200], [200,50], [300,150]],
  segments: 32,
})
// Returns Vec2[] | null (De Casteljau evaluation)`;

const POOL_CODE = `const pool = useMathPool()
const id = pool.enqueue('noise2d', { x: 1, y: 2, seed: 42 })
pool.flush()  // batches all enqueued ops into one bridge call
const result = pool.result(id)`;

const TYPESET_CODE = `import { Math } from '@reactjit/core'

<Math tex="E = mc^2" />
<Math tex="\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" fontSize={20} />
<Math tex="\\sum_{n=1}^{\\infty} \\frac{1}{n^2}" />
<Math tex="\\int_0^1 x^2 \\, dx = \\frac{1}{3}" />`;

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

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
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
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Text style={{ color: c.textDim, fontSize: 9 }}>{label}</Text>
      <Text style={{ color: color || c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
    </Box>
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

// ── Vec2 Demo ───────────────────────────────────────────

function VectorDemo() {
  const c = useThemeColors();
  const [angle, setAngle] = useState(0);

  const a: Vec2T = [3, 1];
  const b: Vec2T = Vec2.fromAngle(angle);
  const sum = Vec2.add(a, Vec2.scale(b, 2));
  const d = Vec2.dot(Vec2.normalize(a), b);
  const cross = Vec2.cross(a, b);
  const dist = Vec2.distance(a, sum);

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Tag text="Vec2" color={C.vec} />
        <Tag text="Vec3" color={C.vec} />
        <Tag text="Vec4" color={C.vec} />
      </Box>

      <Label label="a" value={`[${a[0]}, ${a[1]}]`} />
      <Label label="b = fromAngle" value={`[${b[0].toFixed(3)}, ${b[1].toFixed(3)}]`} color={C.vec} />
      <Label label="a + 2b" value={`[${sum[0].toFixed(3)}, ${sum[1].toFixed(3)}]`} color={C.vec} />
      <Label label="dot(norm(a), b)" value={d.toFixed(4)} />
      <Label label="cross(a, b)" value={cross.toFixed(4)} />
      <Label label="distance(a, a+2b)" value={dist.toFixed(4)} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={'\u2190 Rotate'} color={C.vec} onPress={() => setAngle(p => p - 0.3)} />
        <ActionBtn label={'Rotate \u2192'} color={C.vec} onPress={() => setAngle(p => p + 0.3)} />
      </Box>
      <Text style={{ color: c.textDim, fontSize: 8 }}>
        {`angle: ${(angle * 180 / Math.PI).toFixed(1)}\u00B0`}
      </Text>
    </Box>
  );
}

// ── Mat4 Demo ───────────────────────────────────────────

function MatrixDemo() {
  const c = useThemeColors();
  const [rx, setRx] = useState(0);

  const m = Mat4.rotateX(Mat4.identity(), rx);
  const point: Vec3T = [1, 0, 0];
  const transformed = Mat4.transformPoint(m, point);
  const det = Mat4.determinant(m);
  const decomposed = Mat4.decompose(m);

  return (
    <Box style={{ gap: 8 }}>
      <Tag text="Mat4" color={C.mat} />
      <Label label="rotateX" value={`${(rx * 180 / Math.PI).toFixed(1)}\u00B0`} color={C.mat} />
      <Label label="transform([1,0,0])" value={`[${transformed[0].toFixed(3)}, ${transformed[1].toFixed(3)}, ${transformed[2].toFixed(3)}]`} color={C.mat} />
      <Label label="determinant" value={det.toFixed(6)} />
      <Label label="decompose.scale" value={`[${decomposed.scale.map(v => v.toFixed(2)).join(', ')}]`} />
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={`Rotate +12\u00B0`} color={C.mat} onPress={() => setRx(p => p + Math.PI / 15)} />
        <ActionBtn label="Reset" color={c.textDim} onPress={() => setRx(0)} />
      </Box>
    </Box>
  );
}

// ── Quaternion Demo ─────────────────────────────────────

function QuaternionDemo() {
  const [t, setT] = useState(0);

  const q1 = Quat.identity();
  const q2 = Quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
  const interpolated = Quat.slerp(q1, q2, t);
  const euler = Quat.toEuler(interpolated);
  const rotated = Quat.rotateVec3(interpolated, [1, 0, 0]);

  return (
    <Box style={{ gap: 8 }}>
      <Tag text="Quat" color={C.quat} />
      <Label label="slerp t" value={t.toFixed(2)} color={C.quat} />
      <Label label="euler (deg)" value={`[${euler.map(v => (v * 180 / Math.PI).toFixed(1)).join(', ')}]`} />
      <Label label="rotateVec3([1,0,0])" value={`[${rotated.map(v => v.toFixed(3)).join(', ')}]`} color={C.quat} />
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={'\u2190 t'} color={C.quat} onPress={() => setT(p => clamp(p - 0.1, 0, 1))} />
        <ActionBtn label={'t \u2192'} color={C.quat} onPress={() => setT(p => clamp(p + 0.1, 0, 1))} />
      </Box>
    </Box>
  );
}

// ── Interpolation Demo ──────────────────────────────────

const INTERP_STEPS = 32;

function InterpolationDemo() {
  const c = useThemeColors();

  const curves = useMemo(() => {
    const sets: [string, (t: number) => number, string][] = [
      ['lerp', t => lerp(0, 1, t), '#4fc3f7'],
      ['smoothstep', t => smoothstep(0, 1, t), '#66bb6a'],
      ['smootherstep', t => smootherstep(0, 1, t), '#ffa726'],
      ['damp(5)', t => 1 - Math.exp(-5 * t), '#ef5350'],
    ];
    return sets.map(([name, fn, color]) => {
      const values: number[] = [];
      for (let i = 0; i <= INTERP_STEPS; i++) values.push(fn(i / INTERP_STEPS));
      return { name, values, color };
    });
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      {curves.map(curve => (
        <Box key={curve.name} style={{ gap: 4 }}>
          <Text style={{ color: curve.color, fontSize: 8, fontFamily: 'monospace' }}>{curve.name}</Text>
          <Box style={{ flexDirection: 'row', gap: 1, height: 40, alignItems: 'end' }}>
            {curve.values.map((v, i) => (
              <Box key={i} style={{ width: 16, height: Math.max(1, v * 38), backgroundColor: curve.color + '66', borderRadius: 1 }} />
            ))}
          </Box>
        </Box>
      ))}
      <Label label="pingPong(2.7, 1)" value={pingPong(2.7, 1).toFixed(3)} />
      <Label label="remap(0.5, 0, 1, 100, 200)" value={remap(0.5, 0, 1, 100, 200).toFixed(1)} />
      <Label label="inverseLerp(10, 20, 15)" value={inverseLerp(10, 20, 15).toFixed(2)} />
      <Label label="wrap(370, 0, 360)" value={wrap(370, 0, 360).toFixed(1)} />
    </Box>
  );
}

// ── Geometry Demo ───────────────────────────────────────

function GeometryDemo() {
  const c = useThemeColors();
  const [px, setPx] = useState(3);

  const boxA: BBox2T = { min: [0, 0], max: [4, 4] };
  const boxB: BBox2T = { min: [px, 1], max: [px + 3, 5] };
  const intersects = BBox2.intersects(boxA, boxB);
  const overlap = BBox2.intersection(boxA, boxB);
  const union = BBox2.union(boxA, boxB);
  const segDist = distancePointToSegment([px, 3], [0, 0], [4, 4]);
  const inCircle = circleContainsPoint([2, 2], 3, [px, 3]);
  const lineHit = lineIntersection([0, 0], [4, 4], [0, 4], [4, 0]);

  return (
    <Box style={{ gap: 8 }}>
      <Label label="BBox A" value={'[0,0] \u2192 [4,4]'} />
      <Label label="BBox B" value={`[${px},1] \u2192 [${px + 3},5]`} color={C.geo} />
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: intersects ? C.geo : C.pool }} />
        <Text style={{ fontSize: 9, color: intersects ? C.geo : C.pool }}>
          {intersects ? 'Intersects' : 'No intersection'}
        </Text>
      </Box>
      {overlap && <Label label="overlap" value={`[${overlap.min[0]},${overlap.min[1]}] \u2192 [${overlap.max[0]},${overlap.max[1]}]`} />}
      <Label label="union" value={`[${union.min[0]},${union.min[1]}] \u2192 [${union.max[0]},${union.max[1]}]`} />
      <Label label="dist to segment" value={segDist.toFixed(3)} />
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: inCircle ? C.geo : C.pool }} />
        <Text style={{ fontSize: 9, color: inCircle ? C.geo : C.pool }}>
          {inCircle ? 'Inside circle(r=3)' : 'Outside circle(r=3)'}
        </Text>
      </Box>
      {lineHit && <Label label="line \u2229" value={`[${lineHit[0].toFixed(1)}, ${lineHit[1].toFixed(1)}]`} />}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={'\u2190 Move B'} color={C.geo} onPress={() => setPx(p => p - 1)} />
        <ActionBtn label={'Move B \u2192'} color={C.geo} onPress={() => setPx(p => p + 1)} />
      </Box>
    </Box>
  );
}

// ── Noise Field Demo (Lua-backed) ───────────────────────

function NoiseFieldDemo() {
  const c = useThemeColors();
  const [seed, setSeed] = useState(42);
  const [scale, setScale] = useState(0.1);
  const SIZE = 24;
  const field = useNoiseField({ width: SIZE, height: SIZE, scale, seed, octaves: 4 });

  return (
    <Box style={{ gap: 8 }}>
      {field ? (
        <Box style={{ gap: 0 }}>
          {Array.from({ length: SIZE }, (_, row) => (
            <Box key={row} style={{ flexDirection: 'row', gap: 0 }}>
              {Array.from({ length: SIZE }, (_, col) => {
                const v = field[row * SIZE + col] ?? 0;
                const brightness = Math.floor(clamp(v, 0, 1) * 255);
                const hex = brightness.toString(16).padStart(2, '0');
                return <Box key={col} style={{ width: 12, height: 12, backgroundColor: `#${hex}${hex}${hex}` }} />;
              })}
            </Box>
          ))}
        </Box>
      ) : (
        <Text style={{ fontSize: 10, color: c.textDim }}>Loading noise field...</Text>
      )}
      <Label label="seed" value={String(seed)} color={C.noise} />
      <Label label="scale" value={scale.toFixed(2)} color={C.noise} />
      <Label label="grid" value={`${SIZE}\u00D7${SIZE}`} />
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={`Seed ${seed + 1}`} color={C.noise} onPress={() => setSeed(p => p + 1)} />
        <ActionBtn label={`Scale ${scale === 0.1 ? '0.2' : scale === 0.2 ? '0.05' : '0.1'}`} color={C.noise} onPress={() => setScale(p => p === 0.1 ? 0.2 : p === 0.2 ? 0.05 : 0.1)} />
      </Box>
    </Box>
  );
}

// ── FFT Demo (Lua-backed) ──────────────────────────────

function FFTDemo() {
  const c = useThemeColors();
  const [freq, setFreq] = useState(4);
  const N = 64;

  const samples = useMemo(() => {
    const s: number[] = [];
    for (let i = 0; i < N; i++) {
      s.push(Math.sin(i * freq * 2 * Math.PI / N) + 0.5 * Math.sin(i * freq * 3 * 2 * Math.PI / N));
    }
    return s;
  }, [freq]);

  const spectrum = useFFT(samples);
  const halfN = N / 2;

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ color: c.textSecondary, fontSize: 9 }}>
        {`sin(${freq}x) + 0.5\u00B7sin(${freq * 3}x)  \u2014  ${N} samples`}
      </Text>
      <Box style={{ gap: 2 }}>
        <Text style={{ color: c.textDim, fontSize: 8 }}>Waveform</Text>
        <Box style={{ flexDirection: 'row', gap: 0, height: 32, alignItems: 'center' }}>
          {samples.map((v, i) => (
            <Box key={i} style={{ width: 4, height: Math.max(1, Math.abs(v) * 14), backgroundColor: C.fft + '88', borderRadius: 1 }} />
          ))}
        </Box>
      </Box>
      {spectrum ? (
        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textDim, fontSize: 8 }}>Magnitude spectrum</Text>
          <Box style={{ flexDirection: 'row', gap: 0, height: 40, alignItems: 'end' }}>
            {spectrum.slice(0, halfN).map((v, i) => {
              const maxV = Math.max(...spectrum.slice(0, halfN));
              const h = maxV > 0 ? Math.max(1, (v / maxV) * 38) : 1;
              return <Box key={i} style={{ width: 6, height: h, backgroundColor: C.fft + '66', borderRadius: 1 }} />;
            })}
          </Box>
        </Box>
      ) : (
        <Text style={{ fontSize: 10, color: c.textDim }}>Computing FFT...</Text>
      )}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={`freq ${freq - 1}`} color={C.fft} onPress={() => setFreq(p => Math.max(1, p - 1))} />
        <ActionBtn label={`freq ${freq + 1}`} color={C.fft} onPress={() => setFreq(p => Math.min(16, p + 1))} />
      </Box>
    </Box>
  );
}

// ── Bezier Demo (Lua-backed) ────────────────────────────

function BezierDemo() {
  const c = useThemeColors();
  const [cy, setCy] = useState(150);
  const controlPoints: Vec2T[] = [[0, 0], [80, cy], [220, 300 - cy], [300, 150]];
  const curve = useBezier({ points: controlPoints as [number, number][], segments: 32 });

  return (
    <Box style={{ gap: 8 }}>
      {controlPoints.map((p, i) => (
        <Label key={i} label={`P${i}`} value={`[${p[0]}, ${p[1]}]`} color={i === 1 || i === 2 ? C.bezier : undefined} />
      ))}
      {curve ? (
        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textDim, fontSize: 8 }}>{`${curve.length} evaluated points`}</Text>
          <Box style={{ flexDirection: 'row', gap: 1, height: 40, alignItems: 'end' }}>
            {curve.map((p, i) => {
              const h = Math.max(1, (p[1] / 300) * 38);
              return <Box key={i} style={{ width: 8, height: h, backgroundColor: C.bezier + '66', borderRadius: 1 }} />;
            })}
          </Box>
        </Box>
      ) : (
        <Text style={{ fontSize: 10, color: c.textDim }}>Computing bezier...</Text>
      )}
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={'\u2190 Flatten'} color={C.bezier} onPress={() => setCy(p => Math.max(0, p - 30))} />
        <ActionBtn label={'Curve \u2192'} color={C.bezier} onPress={() => setCy(p => Math.min(300, p + 30))} />
      </Box>
    </Box>
  );
}

// ── Typesetting Bands (zigzag like every other section) ──

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  const features = [
    { label: 'Vec2', desc: 'add, sub, mul, dot, cross, normalize, lerp, rotate, fromAngle', color: C.vec },
    { label: 'Vec3', desc: 'cross, reflect, slerp, up/forward/right + all Vec2 ops', color: C.vec },
    { label: 'Vec4', desc: '4D arithmetic, normalize, lerp, clamp (colors, homogeneous)', color: C.vec },
    { label: 'Mat4', desc: 'multiply, invert, lookAt, perspective, ortho, decompose, fromQuat', color: C.mat },
    { label: 'Quat', desc: 'slerp, fromAxisAngle, fromEuler, toEuler, toMat4, rotateVec3', color: C.quat },
    { label: 'BBox2/3', desc: 'fromPoints, contains, intersects, union, intersection, expand', color: C.geo },
    { label: 'Interpolation', desc: 'lerp, smoothstep, smootherstep, remap, clamp, wrap, damp, pingPong', color: C.interp },
    { label: 'useNoiseField', desc: 'Perlin noise grid via Lua FFI', color: C.noise },
    { label: 'useFFT', desc: 'Cooley-Tukey radix-2 via Lua', color: C.fft },
    { label: 'useBezier', desc: 'De Casteljau curve evaluation via Lua', color: C.bezier },
    { label: 'useMathPool', desc: 'Batch N bridge ops into one call per frame', color: C.pool },
    { label: '<Math />', desc: 'LaTeX typesetting: fractions, roots, scripts, Greek, matrices, operators', color: C.accent },
  ];

  return (
    <>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 100 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </>
  );
}

// ── MathStory ─────────────────────────────────────────

export function MathStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="package" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Math'}
        </Text>
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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {"Dubs, check 'em"}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

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
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Pure TS math for lightweight ops. Lua-backed hooks for heavy compute.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Immutable tuple types for vectors, matrices, and quaternions with zero allocation overhead. Perlin noise, FFT, and bezier evaluation run on Lua via bridge hooks for O(n) workloads.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Install: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Pure TS exports (Vec2, Mat4, lerp, etc.) have zero dependencies. Lua-backed hooks (useNoiseField, useFFT, useBezier) require the bridge.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Vectors: demo | text ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <VectorDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="code">{'VECTORS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Vec2, Vec3, Vec4 as immutable tuples. All operations return new tuples \u2014 no mutation, no classes, no GC pressure from object headers. Includes add, sub, mul, dot, cross, normalize, lerp, smoothstep, rotate, fromAngle, reflect, slerp.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={VECTOR_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Matrices: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'MATRICES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'4\u00D74 matrix as a 16-element tuple. Multiply, invert, transpose, decompose into translation + rotation + scale. Includes lookAt, perspective, and ortho projection builders for 3D camera setups.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={MATRIX_CODE} />
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'[x, y, z, w] tuple. Slerp for smooth rotation interpolation without gimbal lock. Convert to/from Euler angles, axis-angle, and Mat4. Rotate Vec3 directly without building a matrix.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={QUAT_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Interpolation: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="sliders">{'INTERPOLATION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Scalar easing and mapping functions. lerp, smoothstep (Hermite cubic, C1), smootherstep (Perlin quintic, C2), damp (frame-rate independent exponential), remap, clamp, wrap, pingPong, moveTowards, smoothDamp (spring-damper).'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={INTERP_CODE} />
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'BBox2 and BBox3 axis-aligned bounding boxes with fromPoints, contains, intersects, union, intersection, expand. Point-to-segment distance, circle-point containment, circle-rect intersection, and line-line intersection.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={GEOMETRY_CODE} />
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
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Pure TS ops (vectors, matrices, interpolation) run in QuickJS with zero bridge overhead. Lua-backed hooks (noise, FFT, bezier) cross the bridge once per call \u2014 use useMathPool to batch multiple ops into a single bridge round-trip.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Noise: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="gauge">{'NOISE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Perlin noise via Lua FFI. useNoiseField returns a flat grid of values for terrain, textures, and procedural generation. Configurable seed, scale, octaves, lacunarity, and persistence.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={NOISE_CODE} />
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
            <SectionLabel icon="zap">{'FFT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Cooley-Tukey radix-2 FFT via Lua. Pass time-domain samples, get back magnitude spectrum. Use for audio visualization, frequency analysis, or signal processing.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={FFT_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Bezier: text | demo ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="code">{'BEZIER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'De Casteljau curve evaluation via Lua. Pass control points and segment count, get back evaluated Vec2 points along the curve. Works with any number of control points.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={BEZIER_CODE} />
          </Box>
          <Box style={HALF}>
            <BezierDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Math Pool: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="layers">{'MATH POOL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Batch multiple Lua-backed math operations into a single bridge call per frame. Enqueue ops, flush once, read results. Eliminates per-op bridge overhead when running many noise/FFT/bezier calls simultaneously.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={POOL_CODE} />
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
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'LaTeX Typesetting'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Render real math notation with <Math tex="..." />. Parsed and typeset entirely in Lua \u2014 recursive descent parser, heuristic box layout, Latin Modern Math font. No browser, no KaTeX, no external dependencies.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Typesetting usage: text | code ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <SectionLabel icon="code">{'USAGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'One-liner LaTeX math rendering. Supports fractions, roots, superscripts, subscripts, Greek letters, big operators, matrices, accents, and delimiters.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={TYPESET_CODE} />
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
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {'The most beautiful equation in mathematics \u2014 connects five fundamental constants: e, i, \u03C0, 1, and 0.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Quadratic formula: text | math ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <Tag text={TYPESET_FORMULAS[1].label} color={C.accent} />
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {'Solutions to ax\u00B2 + bx + c = 0. Nested fraction with square root \u2014 exercises the full layout pipeline.'}
            </Text>
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
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {'Big operators with limits above and below. Sum and integral signs scale to match their content.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Taylor + Euler formula: text | math ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <Tag text={'Taylor Series & Euler'} color={C.accent} />
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {'Function names render upright (not italic). Greek letters use Latin Modern Math glyphs.'}
            </Text>
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
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {'Matrix environments with auto-sized parentheses. Supports pmatrix, bmatrix, vmatrix, and cases.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Binomial + Gradient + Pythagorean: text | math ── */}
        <Box style={BAND_STYLE}>
          <Box style={HALF}>
            <Tag text={'More Formulas'} color={C.accent} />
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {'Accents (hat, vec), partial derivatives, binomial coefficients, and simple expressions all render correctly.'}
            </Text>
          </Box>
          <Box style={HALF}>
            <MathBlock tex={TYPESET_FORMULAS[7].tex} fontSize={18} color={c.text} />
            <MathBlock tex={TYPESET_FORMULAS[8].tex} fontSize={18} color={c.text} />
            <MathBlock tex={TYPESET_FORMULAS[9].tex} fontSize={22} color={c.text} />
          </Box>
        </Box>

        <Divider />

        {/* ── Feature catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="terminal">{'API SURFACE'}</SectionLabel>
          <FeatureCatalog />
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="package" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Math'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
