import React, { useState, useMemo } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import {
  Vec2, Vec3, Mat4, Quat,
  lerp, smoothstep, smootherstep, remap, clamp, damp, pingPong,
  BBox2,
  distancePointToSegment, circleContainsPoint, lineIntersection,
} from '../../../packages/math/src';
import type { Vec2 as Vec2T, Vec3 as Vec3T, BBox2 as BBox2T } from '../../../packages/math/src';

const C = {
  vec: '#4fc3f7',
  mat: '#ab47bc',
  quat: '#ff7043',
  geo: '#66bb6a',
  interp: '#ffa726',
  noise: '#26c6da',
  pool: '#ef5350',
};

// ── Helpers ──────────────────────────────────────────────

function CodeLabel({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Text style={{ color: c.textDim, fontSize: 9 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 9, fontFamily: 'monospace' }}>{value}</Text>
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

// ── Vec2 Demo ────────────────────────────────────────────

function VectorDemo() {
  const c = useThemeColors();
  const [angle, setAngle] = useState(0);

  const a: Vec2T = [3, 1];
  const b: Vec2T = Vec2.fromAngle(angle);
  const sum = Vec2.add(a, Vec2.scale(b, 2));
  const d = Vec2.dot(Vec2.normalize(a), b);
  const dist = Vec2.distance(a, sum);

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Tag text="Vec2" color={C.vec} />
        <Tag text="Vec3" color={C.vec} />
        <Tag text="Vec4" color={C.vec} />
      </Box>

      <CodeLabel label="a" value={`[${a[0]}, ${a[1]}]`} />
      <CodeLabel label="b = fromAngle" value={`[${b[0].toFixed(2)}, ${b[1].toFixed(2)}]`} />
      <CodeLabel label="a + 2b" value={`[${sum[0].toFixed(2)}, ${sum[1].toFixed(2)}]`} />
      <CodeLabel label="dot(norm(a), b)" value={d.toFixed(4)} />
      <CodeLabel label="distance(a, sum)" value={dist.toFixed(4)} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setAngle(prev => prev - 0.3)}
          style={{ backgroundColor: C.vec + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.vec, fontSize: 10 }}>{`\u2190 Rotate`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setAngle(prev => prev + 0.3)}
          style={{ backgroundColor: C.vec + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.vec, fontSize: 10 }}>{`Rotate \u2192`}</Text>
        </Pressable>
      </Box>

      <Text style={{ color: c.textDim, fontSize: 8 }}>
        {`angle: ${(angle * 180 / Math.PI).toFixed(1)}\u00B0`}
      </Text>
    </Box>
  );
}

// ── Mat4 Demo ────────────────────────────────────────────

function MatrixDemo() {
  const c = useThemeColors();
  const [rx, setRx] = useState(0);

  const m = Mat4.rotateX(Mat4.identity(), rx);
  const point: Vec3T = [1, 0, 0];
  const transformed = Mat4.transformPoint(m, point);
  const det = Mat4.determinant(m);

  return (
    <Box style={{ gap: 8 }}>
      <Tag text="Mat4" color={C.mat} />

      <CodeLabel label="rotateX" value={`${(rx * 180 / Math.PI).toFixed(1)}\u00B0`} />
      <CodeLabel label="transform([1,0,0])" value={`[${transformed[0].toFixed(3)}, ${transformed[1].toFixed(3)}, ${transformed[2].toFixed(3)}]`} />
      <CodeLabel label="determinant" value={det.toFixed(6)} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setRx(prev => prev + 0.2)}
          style={{ backgroundColor: C.mat + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.mat, fontSize: 10 }}>{`Rotate +12\u00B0`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setRx(0)}
          style={{ backgroundColor: c.bgElevated, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: c.textDim, fontSize: 10 }}>Reset</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Quaternion Demo ──────────────────────────────────────

function QuaternionDemo() {
  const c = useThemeColors();
  const [t, setT] = useState(0);

  const q1 = Quat.identity();
  const q2 = Quat.fromAxisAngle([0, 1, 0], Math.PI / 2);
  const interpolated = Quat.slerp(q1, q2, t);
  const euler = Quat.toEuler(interpolated);

  return (
    <Box style={{ gap: 8 }}>
      <Tag text="Quat" color={C.quat} />

      <CodeLabel label="slerp t" value={t.toFixed(2)} />
      <CodeLabel label="euler (deg)" value={`[${(euler[0]*180/Math.PI).toFixed(1)}, ${(euler[1]*180/Math.PI).toFixed(1)}, ${(euler[2]*180/Math.PI).toFixed(1)}]`} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setT(prev => clamp(prev - 0.1, 0, 1))}
          style={{ backgroundColor: C.quat + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.quat, fontSize: 10 }}>{`\u2190 t`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setT(prev => clamp(prev + 0.1, 0, 1))}
          style={{ backgroundColor: C.quat + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.quat, fontSize: 10 }}>{`t \u2192`}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Interpolation Demo ───────────────────────────────────

function InterpolationDemo() {
  const c = useThemeColors();
  const STEPS = 32;

  const curves = useMemo(() => {
    const result: { name: string; values: number[]; color: string }[] = [];
    const lerpV: number[] = [];
    const smoothV: number[] = [];
    const smootherV: number[] = [];
    const dampV: number[] = [];

    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      lerpV.push(lerp(0, 1, t));
      smoothV.push(smoothstep(0, 1, t));
      smootherV.push(smootherstep(0, 1, t));
      dampV.push(1 - Math.exp(-5 * t));
    }

    result.push({ name: 'lerp', values: lerpV, color: '#4fc3f7' });
    result.push({ name: 'smoothstep', values: smoothV, color: '#66bb6a' });
    result.push({ name: 'smootherstep', values: smootherV, color: '#ffa726' });
    result.push({ name: 'damp(5)', values: dampV, color: '#ef5350' });
    return result;
  }, []);

  const BAR_W = 16;

  return (
    <Box style={{ gap: 8 }}>
      <Tag text="Interpolation" color={C.interp} />
      {curves.map(curve => (
        <Box key={curve.name} style={{ gap: 4 }}>
          <Text style={{ color: curve.color, fontSize: 8, fontFamily: 'monospace' }}>{curve.name}</Text>
          <Box style={{ flexDirection: 'row', gap: 1, height: 40, alignItems: 'flex-end' }}>
            {curve.values.map((v, i) => (
              <Box key={i} style={{ width: BAR_W, height: Math.max(1, v * 38), backgroundColor: curve.color + '66', borderRadius: 1 }} />
            ))}
          </Box>
        </Box>
      ))}

      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 8 }}>Also available: remap, clamp, wrap, pingPong, moveTowards, smoothDamp</Text>
        <CodeLabel label="pingPong(2.7, 1)" value={pingPong(2.7, 1).toFixed(3)} />
        <CodeLabel label="remap(0.5, 0, 1, 100, 200)" value={remap(0.5, 0, 1, 100, 200).toFixed(1)} />
      </Box>
    </Box>
  );
}

// ── Geometry Demo ────────────────────────────────────────

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
      <Tag text="Geometry" color={C.geo} />

      <CodeLabel label="BBox A" value={`[0,0] \u2192 [4,4]`} />
      <CodeLabel label="BBox B" value={`[${px},1] \u2192 [${px+3},5]`} />
      <CodeLabel label="intersects" value={intersects ? 'true' : 'false'} />
      {overlap && (
        <CodeLabel label="overlap" value={`[${overlap.min[0]},${overlap.min[1]}] \u2192 [${overlap.max[0]},${overlap.max[1]}]`} />
      )}
      <CodeLabel label="union" value={`[${union.min[0]},${union.min[1]}] \u2192 [${union.max[0]},${union.max[1]}]`} />
      <CodeLabel label="dist to segment" value={segDist.toFixed(3)} />
      <CodeLabel label="in circle(r=3)" value={inCircle ? 'true' : 'false'} />
      {lineHit && (
        <CodeLabel label="line intersection" value={`[${lineHit[0].toFixed(1)}, ${lineHit[1].toFixed(1)}]`} />
      )}

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setPx(prev => prev - 1)}
          style={{ backgroundColor: C.geo + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.geo, fontSize: 10 }}>{`\u2190 Move B`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setPx(prev => prev + 1)}
          style={{ backgroundColor: C.geo + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.geo, fontSize: 10 }}>{`Move B \u2192`}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── Noise Preview (pure TS, computed in React) ───────────

function NoisePreview() {
  const c = useThemeColors();
  const [seed, setSeed] = useState(0);
  const [scale, setScale] = useState(0.15);

  const SIZE = 24;
  const grid = useMemo(() => {
    // Simple hash-based preview noise (real Perlin is on Lua side)
    const cells: number[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const nx = x * scale + seed * 7.3;
        const ny = y * scale + seed * 13.1;
        // Simple sine-based approximation for preview
        const v = (Math.sin(nx * 2.1 + ny * 3.7) * Math.cos(ny * 1.3 + nx * 2.9)
          + Math.sin(nx * 5.1 + ny * 1.2) * 0.5) / 1.5;
        cells.push((v + 1) / 2);
      }
    }
    return cells;
  }, [seed, scale]);

  return (
    <Box style={{ gap: 8 }}>
      <Tag text="Noise (preview)" color={C.noise} />
      <Text style={{ color: c.textDim, fontSize: 8 }}>
        {`Real Perlin noise runs on Lua via useNoise() / useNoiseField()`}
      </Text>

      <Box style={{ gap: 0 }}>
        {Array.from({ length: SIZE }, (_, row) => (
          <Box key={row} style={{ flexDirection: 'row', gap: 0 }}>
            {Array.from({ length: SIZE }, (_, col) => {
              const v = grid[row * SIZE + col];
              const brightness = Math.floor(v * 255);
              const hex = brightness.toString(16).padStart(2, '0');
              return (
                <Box
                  key={col}
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: `#${hex}${hex}${hex}`,
                  }}
                />
              );
            })}
          </Box>
        ))}
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setSeed(prev => prev + 1)}
          style={{ backgroundColor: C.noise + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.noise, fontSize: 10 }}>{`Seed: ${seed}`}</Text>
        </Pressable>
        <Pressable
          onPress={() => setScale(prev => prev === 0.15 ? 0.3 : prev === 0.3 ? 0.05 : 0.15)}
          style={{ backgroundColor: C.noise + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}
        >
          <Text style={{ color: C.noise, fontSize: 10 }}>{`Scale: ${scale}`}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// ── API Surface ──────────────────────────────────────────

function APISurface() {
  const c = useThemeColors();

  const sections = [
    { name: 'Pure TS (no bridge)', items: [
      'Vec2 / Vec3 / Vec4 — add, sub, mul, dot, cross, normalize, lerp, distance ...',
      'Mat4 — identity, multiply, invert, translate, rotate, scale, lookAt, perspective ...',
      'Quat — multiply, slerp, fromAxisAngle, fromEuler, toMat4, rotateVec3 ...',
      'BBox2 / BBox3 — fromPoints, contains, intersects, union, expand ...',
      'lerp, smoothstep, smootherstep, remap, clamp, wrap, damp, pingPong ...',
    ]},
    { name: 'Lua-backed (heavy compute)', items: [
      'useNoise({ x, y, seed, octaves }) — Perlin noise, single point',
      'useNoiseField({ width, height, scale, octaves }) — Perlin noise grid',
      'useFFT(samples) — Cooley-Tukey radix-2, returns magnitude spectrum',
      'useBezier({ points, segments }) — De Casteljau curve evaluation',
    ]},
    { name: 'React hooks', items: [
      'useVec2(x, y) / useVec3 / useVec4 — reactive vector state',
      'useMat4() — identity matrix with builder methods',
      'useTransform({ position, rotation, scale }) — composites into Mat4',
      'useLerp, useSmoothstep, useDistance, useBBox, useIntersection',
      'useMathPool() — batch N ops into one bridge call per frame',
    ]},
  ];

  return (
    <Box style={{ gap: 12 }}>
      {sections.map(section => (
        <Box key={section.name} style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 10, fontFamily: 'monospace' }}>{section.name}</Text>
          {section.items.map((item, i) => (
            <Text key={i} style={{ color: c.textDim, fontSize: 8, paddingLeft: 8 }}>{`\u2022 ${item}`}</Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── Main Story ───────────────────────────────────────────

export function MathStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      <StorySection index={1} title="@reactjit/math">
        <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
          {`Vector, matrix, quaternion, interpolation, geometry, noise, and FFT.\nPure TS for lightweight ops. Lua-backed for heavy compute.`}
        </Text>
      </StorySection>

      <StorySection index={2} title="Vectors">
        <VectorDemo />
      </StorySection>

      <StorySection index={3} title="Matrices">
        <MatrixDemo />
      </StorySection>

      <StorySection index={4} title="Quaternions">
        <QuaternionDemo />
      </StorySection>

      <StorySection index={5} title="Interpolation">
        <InterpolationDemo />
      </StorySection>

      <StorySection index={6} title="Geometry">
        <GeometryDemo />
      </StorySection>

      <StorySection index={7} title="Noise">
        <NoisePreview />
      </StorySection>

      <StorySection index={8} title="API Surface">
        <APISurface />
      </StorySection>
    </StoryPage>
  );
}
