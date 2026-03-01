import React, { useMemo, useState, useRef } from 'react';
import { Box, Text, Slider, Switch, Badge, useLoveRPC, useLuaInterval } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';

type CubeNode = {
  x: number;
  y: number;
  z: number;
  scale: number;
  spin: number;
  tilt: number;
  phase: number;
  seed: number;
};

const TAU = Math.PI * 2;

type PerfStats = {
  fps?: number;
  layoutMs?: number;
  paintMs?: number;
  nodeCount?: number;
};

function rand(i: number, salt: number) {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function buildGalaxy(count: number, arms: number, radius: number): CubeNode[] {
  const nodes: CubeNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    const arm = i % arms;
    const armBase = (arm / arms) * TAU;

    const dist = Math.pow(t, 0.78) * radius + rand(i, 1) * 0.65;
    const twist = dist * 0.85 + rand(i, 2) * 0.6;
    const angle = armBase + twist;
    const spread = (rand(i, 3) - 0.5) * 0.55;

    const px = Math.cos(angle + spread) * dist;
    const py = Math.sin(angle + spread) * dist;
    const pz = (rand(i, 4) - 0.5) * (1.8 - t * 1.2);

    nodes.push({
      x: px,
      y: py,
      z: pz,
      scale: 0.08 + rand(i, 5) * 0.12,
      spin: 0.4 + rand(i, 6) * 1.8,
      tilt: (rand(i, 7) - 0.5) * 1.1,
      phase: rand(i, 8) * TAU,
      seed: 11 + (i % 4),
    });
  }
  return nodes;
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>{label}</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          {value.toFixed(step < 1 ? 1 : 0)}
        </Text>
      </Box>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        style={{ width: 250, height: 20 }}
        trackColor="#303549"
        activeTrackColor="#7dc4ff"
        thumbColor="#d9ecff"
        thumbSize={14}
      />
    </Box>
  );
}

export function Scene3DFrameworkGalaxyStory() {
  const c = useThemeColors();
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(true);
  const [cubeCount, setCubeCount] = useState(220);
  const [arms, setArms] = useState(5);
  const [radius, setRadius] = useState(8.8);
  const [speed, setSpeed] = useState(1.0);
  const [perf, setPerf] = useState<PerfStats>({});
  const getPerf = useLoveRPC<PerfStats>('dev:perf');

  useLuaInterval(running ? 16 : null, () => {
    setTime((prev) => prev + 0.014 * speed);
  });

  useLuaInterval(500, async () => {
    try {
      const next = await getPerf();
      if (next && typeof next === 'object') {
        setPerf(next);
      }
    } catch (_err) {
      // Non-native bridge can no-op RPC; keep previous values.
    }
  });

  const nodes = useMemo(() => buildGalaxy(cubeCount, arms, radius), [cubeCount, arms, radius]);
  const denseMode = cubeCount >= 320;
  const fps = typeof perf.fps === 'number' ? perf.fps : 0;
  const layoutMs = typeof perf.layoutMs === 'number' ? perf.layoutMs : 0;
  const paintMs = typeof perf.paintMs === 'number' ? perf.paintMs : 0;
  const nodeCount = typeof perf.nodeCount === 'number' ? perf.nodeCount : 0;
  const totalMs = layoutMs + paintMs;
  const fpsVariant = fps >= 55 ? 'success' : fps >= 40 ? 'warning' : 'error';

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>
        Cube Galaxy Stress
      </Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        Stress test: galaxy field of `framework-canvas` cubes with real-time controls
      </Text>

      <Box style={{ flexDirection: 'row', gap: 12, flexGrow: 1 }}>
        <Box
          style={{
            width: 280,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.bgElevated,
            gap: 10,
          }}
        >
          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge label={`${cubeCount} cubes`} variant="info" />
            <Badge label={`${arms} arms`} variant="default" />
            <Badge label={denseMode ? 'dense mode' : 'edge mode'} variant={denseMode ? 'warning' : 'success'} />
            <Badge label={`FPS ${fps || '--'}`} variant={fpsVariant} />
          </Box>

          <LabeledSlider label="Cube Count" value={cubeCount} min={80} max={460} step={20} onChange={setCubeCount} />
          <LabeledSlider label="Galaxy Arms" value={arms} min={2} max={8} step={1} onChange={setArms} />
          <LabeledSlider label="Radius" value={radius} min={5} max={13} step={0.2} onChange={setRadius} />
          <LabeledSlider label="Speed" value={speed} min={0.2} max={2.5} step={0.1} onChange={setSpeed} />

          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Animation</Text>
            <Switch value={running} onValueChange={setRunning} />
          </Box>

          <Box
            style={{
              backgroundColor: c.bg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c.border,
              padding: 8,
              gap: 3,
            }}
          >
            <Text style={{ color: c.text, fontSize: 10, fontWeight: 'normal' }}>
              Runtime Perf
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {`fps ${fps || '--'} | layout ${layoutMs.toFixed(1)}ms | paint ${paintMs.toFixed(1)}ms`}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 10 }}>
              {`total frame work ${totalMs.toFixed(1)}ms | nodes ${nodeCount || '--'}`}
            </Text>
          </Box>

          <Text style={{ color: c.textDim, fontSize: 10 }}>
            Each cube uses the same 2D framework texture pipeline as the single-cube demo.
          </Text>
        </Box>

        <Scene style={{ flexGrow: 1 }} backgroundColor="#040812" stars>
          <Camera position={[0, -15, 8]} lookAt={[0, 0, 0.2]} fov={0.86} />
          <AmbientLight color="#1a2438" intensity={0.42} />
          <DirectionalLight direction={[-0.8, 0.7, -0.3]} color="#ffe8cd" intensity={1.1} />

          <Mesh
            geometry="plane"
            color="#0f1b2f"
            edgeColor="#1f365b"
            edgeWidth={0.01}
            position={[0, 0, -1.1]}
            scale={[4.2, 4.2, 1]}
            rotation={[0, 0, time * 0.25]}
          />
          <Mesh
            geometry="cube"
            texture="framework-canvas"
            seed={11}
            position={[0, 0, 0.1]}
            scale={1.45}
            rotation={[time * 0.35, time * 0.75, time * 0.2]}
            edgeColor="#0f172a"
            edgeWidth={0.02}
            specular={76}
          />
          <Mesh
            geometry="sphere"
            color="#78c8ff"
            position={[0, 0, 0.1]}
            scale={1.9}
            opacity={0.1}
            fresnel={2.5}
            unlit
          />

          {nodes.map((node, i) => (
            <Mesh
              key={`galaxy-cube-${i}`}
              geometry="cube"
              texture="framework-canvas"
              seed={node.seed}
              position={[node.x, node.y, node.z]}
              scale={node.scale}
              rotation={[
                node.tilt + time * node.spin * 0.45,
                node.phase + time * node.spin,
                time * 0.2 + (i % 9) * 0.07,
              ]}
              edgeColor={denseMode ? undefined : '#0b1220'}
              edgeWidth={0.012}
              specular={denseMode ? 20 : 34}
            />
          ))}
        </Scene>
      </Box>
    </Box>
  );
}
