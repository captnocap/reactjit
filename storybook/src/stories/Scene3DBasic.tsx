import React, { useState } from 'react';
import { Box, Text, useLuaInterval } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh } from '../../../packages/3d/src';

export function Scene3DBasicStory() {
  const c = useThemeColors();
  const [spin, setSpin] = useState(0);

  useLuaInterval(16, () => {
    setSpin((prev) => prev + 0.03);
  });

  return (
    <Box style={{ width: '100%', height: '100%', gap: 12, padding: 16 }}>
      <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
        3D Scene
      </Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        Spinning cubes with edge borders + sphere, rendered via g3d
      </Text>

      <Scene style={{ width: '100%', flexGrow: 1 }} backgroundColor="#12121b">
        <Camera position={[0, -3, 2]} lookAt={[0, 0, 0]} fov={1.05} />
        <Mesh
          geometry="box"
          color="#89b4fa"
          edgeColor="#000000"
          edgeWidth={0.04}
          rotation={[spin * 0.7, spin, spin * 0.3]}
        />
        <Mesh
          geometry="sphere"
          color="#f5c2e7"
          wireframe
          edgeColor="#1e1e2e"
          position={[2.5, 0, 0]}
          rotation={[0, spin * 0.5, 0]}
        />
        <Mesh
          geometry="box"
          color="#a6e3a1"
          edgeColor="#000000"
          edgeWidth={0.03}
          position={[-2.5, 0, 0]}
          scale={0.6}
          rotation={[spin * 0.4, 0, spin]}
        />
      </Scene>

      <Box
        style={{
          flexDirection: 'row',
          gap: 16,
          padding: 8,
          backgroundColor: c.bgElevated,
          borderRadius: 8,
        }}
      >
        <Text style={{ fontSize: 11, color: c.textDim }}>
          Blue cube + Green cube (black edges) + Pink sphere
        </Text>
      </Box>
    </Box>
  );
}
