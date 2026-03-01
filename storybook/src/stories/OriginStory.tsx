import React, { useState } from 'react';
import { Box, useLuaInterval } from '../../../packages/core/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';

// Spawn: (-33.25, -46.75, -7.375) from mapinfo
// Camera starts tight on monitor, pulls back to reveal office
const MONITOR_POS: [number, number, number] = [-33.25, -42, -6.5];
const CLOSE_POS:   [number, number, number] = [-33.25, -43.2, -6.5];
const FAR_POS:     [number, number, number] = [-33.25, -57, -5];

const DURATION_MS = 14000;

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function OriginStory() {
  const [t, setT] = useState(0);

  useLuaInterval(16, () => {
    setT((prev) => (prev + 16 / DURATION_MS) % 1);
  });

  const e = easeInOut(t);
  const camPos = lerp3(CLOSE_POS, FAR_POS, e);

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Scene
        style={{ width: '100%', height: '100%' }}
        backgroundColor="#111111"
        orbitControls
      >
        <Camera position={camPos} lookAt={MONITOR_POS} fov={1.05} />
        <AmbientLight color="#aaaacc" intensity={0.35} />
        <DirectionalLight direction={[0.4, -0.7, -0.6]} color="#ffe8c0" intensity={0.9} />

        {/* cs_office map geometry — solid color, no textures needed */}
        <Mesh
          model="assets/models/cs_office.obj"
          color="#888888"
        />

        {/* Monitor screen placeholder — will swap for ReactJIT logo texture */}
        <Mesh
          geometry="plane"
          color="#4d9de0"
          position={MONITOR_POS}
          rotation={[1.5708, 0, 0]}
          scale={0.6}
          unlit
        />
      </Scene>
    </Box>
  );
}
