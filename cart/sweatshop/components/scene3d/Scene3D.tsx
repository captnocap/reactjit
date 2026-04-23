// =============================================================================
// Scene3D — root viewport + registry provider + mockup renderer
// =============================================================================
// Until the cart host ships a wgpu-backed Scene3D primitive, this file draws
// a flat 2D perspective-hint mockup using Canvas.Node so the scene graph is
// visible and debuggable. A TODO marks the real wgpu path. The React-side
// scene graph ships independently — Mesh/Camera/lights already populate the
// registry; swapping the mockup for native is a single-file change here.
// =============================================================================

const React: any = require('react');
const { useEffect, useMemo, useRef, useState } = React;

import { Box, Canvas, Col, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { MeshNode, Scene3DProps, Vec3 } from './types';
import {
  Scene3DContext,
  createScene3DRegistry,
  type Scene3DRegistry,
} from './useScene3D';
import { boxBoundingRadius } from './geometry/Box';
import { sphereBoundingRadius } from './geometry/Sphere';
import { planeBoundingRadius } from './geometry/Plane';
import { torusBoundingRadius } from './geometry/Torus';

// ── helpers ─────────────────────────────────────────────────────────────────

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v: Vec3): Vec3 => {
  const m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function boundingRadius(m: MeshNode): number {
  switch (m.geometry.kind) {
    case 'box':    return boxBoundingRadius(m.geometry);
    case 'sphere': return sphereBoundingRadius(m.geometry);
    case 'plane':  return planeBoundingRadius(m.geometry);
    case 'torus':  return torusBoundingRadius(m.geometry);
  }
}

export function Scene3D(props: Scene3DProps) {
  const [registry] = useState<Scene3DRegistry>(() => createScene3DRegistry());
  const [, setTick] = useState(0);
  const frame = useRef<any>(null);

  // Subscribe once — registry mutations trigger repaints. useInterval-free.
  useEffect(() => {
    const unsubscribe = registry.subscribe(() => setTick((t: number) => t + 1));
    return () => { unsubscribe(); if (frame.current) { try { clearInterval(frame.current); } catch {} } };
  }, [registry]);

  const bg = props.backgroundColor ?? COLORS.panelBg;

  // Build a Canvas.Node per mesh, projected through a cheap pinhole:
  //   view_z = dot(pos - cam, forward);  screenX/Y via fov-scaled offsets
  const camera = registry.camera.get();
  const meshes = registry.meshes.list();
  const lights = registry.lights.list();

  const { projected } = useMemo(() => {
    const fwd = norm(sub(camera.target, camera.position));
    const upWorld: Vec3 = [0, 1, 0];
    const right = norm(cross(fwd, upWorld));
    const up = norm(cross(right, fwd));
    const focal = 0.5 / Math.tan((camera.fov || Math.PI / 3) / 2);

    const proj = meshes.map((m) => {
      const rel = sub(m.position, camera.position);
      const z = dot(rel, fwd);
      const x = dot(rel, right);
      const y = dot(rel, up);
      if (z < camera.near) return null;
      const sx = 0.5 + (x / z) * focal;
      const sy = 0.5 - (y / z) * focal;
      const radius = boundingRadius(m) * Math.max(m.scale[0], m.scale[1], m.scale[2]);
      const screenR = Math.max(4, (radius / z) * focal * 100);
      return { mesh: m, sx, sy, z, screenR };
    }).filter(Boolean) as Array<{ mesh: MeshNode; sx: number; sy: number; z: number; screenR: number }>;
    proj.sort((a, b) => b.z - a.z); // painter's algorithm, far first
    return { projected: proj };
  }, [camera, meshes]);

  const wireframeAll = !!props.wireframeAll;

  return React.createElement(Scene3DContext.Provider, { value: registry },
    <Box style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: TOKENS.radiusSm,
      backgroundColor: bg,
      ...(props.style || {}),
    }}>
      <Canvas style={{ width: '100%', height: '100%' }}>
        {projected.map(({ mesh, sx, sy, screenR }) => {
          const wire = wireframeAll || mesh.wireframe;
          // TODO(scene3d/wgpu): swap this 2D mockup block for a real wgpu
          // pipeline once the Zig host registers a Scene3D primitive.
          return (
            <Canvas.Node
              key={'m' + mesh.id}
              gx={sx - screenR / 1000} gy={sy - screenR / 1000}
              gw={(screenR * 2) / 1000} gh={(screenR * 2) / 1000}
              fill={wire ? 'transparent' : mesh.material.color}
              stroke={wire ? mesh.material.color : (mesh.material.emissive === '#000000' ? undefined : mesh.material.emissive)}
              strokeWidth={wire ? 2 : 1}
            />
          );
        })}
      </Canvas>
      {/* Full-width top banner — honest about what's painting. Scene graph is
          live (children register real meshes, the camera drives real projection
          math, orbit controls mutate the real camera); the *paint* is a CPU
          perspective projection. When the Zig host registers a Scene3D
          primitive with wgpu-backed painting, this banner goes away. */}
      <Box style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        paddingTop: 5, paddingBottom: 5, paddingLeft: 8, paddingRight: 8,
        backgroundColor: COLORS.orangeDeep,
        borderBottomWidth: 1, borderBottomColor: COLORS.orange,
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Text fontSize={9} color={COLORS.orange} style={{ fontWeight: 'bold', letterSpacing: 0.5 }}>
          CPU 3D
        </Text>
        <Text fontSize={9} color={COLORS.text} style={{ flexGrow: 1 }}>
          scene graph is live — paint is software perspective projection; native GPU backend not wired
        </Text>
      </Box>
      {/* Live scene-graph HUD, bottom-left. */}
      <Col style={{ position: 'absolute', left: 8, bottom: 8, padding: 4, gap: 2, backgroundColor: COLORS.panelAlt, borderRadius: TOKENS.radiusSm }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          {meshes.length} mesh{meshes.length === 1 ? '' : 'es'} · {lights.length} light{lights.length === 1 ? '' : 's'} · {camera.kind} {(camera.fov * 180 / Math.PI).toFixed(0)}°
        </Text>
      </Col>
      {props.children /* Camera/Mesh/lights/OrbitControls register via context, no DOM */}
    </Box>,
  );
}
