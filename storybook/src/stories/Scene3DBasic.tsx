import React, { useState, useEffect } from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { Scene, Camera, Mesh } from '../../../packages/3d/src';

export function Scene3DBasicStory() {
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSpin((prev) => prev + 0.03);
    }, 16);
    return () => clearInterval(id);
  }, []);

  return (
    <Box style={{ width: '100%', height: '100%', gap: 12, padding: 16 }}>
      <Text style={{ fontSize: 18, color: '#cdd6f4', fontWeight: 'bold' }}>
        3D Scene
      </Text>
      <Text style={{ fontSize: 12, color: '#6c7086' }}>
        Spinning cubes with edge borders + sphere, rendered via g3d
      </Text>

      <Scene style={{ width: '100%', flexGrow: 1 }} backgroundColor="#12121b">
        <Camera position={[0, -3, 2]} lookAt={[0, 0, 0]} fov={1.05} />
        <Mesh
          geometry="box"
          color="#89b4fa"
          edgeColor="#cdd6f4"
          edgeWidth={0.04}
          rotation={[spin * 0.7, spin, spin * 0.3]}
        />
        <Mesh
          geometry="sphere"
          color="#f5c2e7"
          position={[2.5, 0, 0]}
          rotation={[0, spin * 0.5, 0]}
        />
        <Mesh
          geometry="box"
          color="#a6e3a1"
          edgeColor="#f9e2af"
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
          backgroundColor: '#1e1e2e',
          borderRadius: 8,
        }}
      >
        <Text style={{ fontSize: 11, color: '#6c7086' }}>
          Blue cube with white edges + Pink sphere + Green cube with yellow edges
        </Text>
      </Box>
    </Box>
  );
}
