import React from 'react';
import { Box, Text, VHS } from '@reactjit/core';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '@reactjit/3d';

export function App() {
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0d0d12',
      }}
    >
      <Scene style={{ width: '100%', height: '100%' }} backgroundColor="#ff2ef2" stars>
        <Camera position={[0, -4.8, 2.5]} lookAt={[0, 0, 0.8]} fov={1.0} near={0.05} far={80} />
        <AmbientLight color="#99ff00" intensity={0.25} />
        <DirectionalLight direction={[-0.4, 0.8, -0.5]} color="#00f0ff" intensity={1.25} />

        <Mesh
          geometry="plane"
          color="#14ff2f"
          position={[0, 0, 0]}
          scale={[10, 10, 1]}
          edgeColor="#0026ff"
          edgeWidth={0.012}
          unlit
        />
        <Mesh
          geometry="box"
          color="#ffe600"
          position={[0, 0, 1.1]}
          rotation={[0.25, 0.7, 0.2]}
          scale={[2, 2, 2]}
          edgeColor="#1a00ff"
          edgeWidth={0.03}
          specular={56}
        />
        <Mesh
          geometry="sphere"
          color="#00dcff"
          position={[2.2, 1.2, 0.9]}
          scale={1.1}
          wireframe
          gridLines={12}
          edgeColor="#ff007a"
          edgeWidth={0.02}
          specular={72}
        />
      </Scene>

      <Box
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 260,
          backgroundColor: 'rgba(12, 18, 36, 0.82)',
          borderWidth: 1,
          borderColor: '#6cf5ff',
          borderRadius: 10,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 14,
          paddingRight: 14,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 15, color: '#ffffff', fontWeight: 'bold' }}>
          Render Status
        </Text>
        <Text style={{ fontSize: 11, color: '#bde7ff' }}>
          Scene: active
        </Text>
        <Text style={{ fontSize: 11, color: '#bde7ff' }}>
          Overlay: card
        </Text>
        <Box
          style={{
            height: 8,
            backgroundColor: '#1d2a5a',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              width: '78%',
              height: '100%',
              backgroundColor: '#50f5ff',
            }}
          />
        </Box>
        <Text style={{ fontSize: 10, color: '#d2d8ef' }}>
          This card is rendered over 3D and under the mask.
        </Text>
      </Box>

      <VHS
        mask
        intensity={1}
        tracking={1}
        noise={1}
        colorBleed={10}
        tint="#ff00ff"
      />
    </Box>
  );
}
