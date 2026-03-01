import React, { useState } from 'react';
import { Box, Text, Badge, ProgressBar, Sparkline, Switch, useLuaInterval } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';

const SPARK_DATA = [14, 17, 16, 21, 20, 25, 23, 26, 30, 29, 31, 34];

export function Scene3DFrameworkCubeStory() {
  const c = useThemeColors();
  const [cubeSpin, setCubeSpin] = useState(0);
  const [displaySpin, setDisplaySpin] = useState(0);
  const [cubeEnabled, setCubeEnabled] = useState(true);

  useLuaInterval(16, () => {
    setDisplaySpin((prev) => prev + 0.01);
    if (cubeEnabled) {
      setCubeSpin((prev) => prev + 0.02);
    }
  });

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>
        Framework Canvas Cube
      </Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        g3d cube textured with a 2D framework-style canvas, mounted on a rotating display
      </Text>

      <Box style={{ flexDirection: 'row', gap: 12, flexGrow: 1, width: '100%', minHeight: 340 }}>
        <Box
          style={{
            width: 260,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.bgElevated,
            gap: 8,
          }}
        >
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>
            2D Framework Components
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>
            Badge + ProgressBar + Sparkline + Switch
          </Text>

          <Box style={{ flexDirection: 'row', gap: 6 }}>
            <Badge label="LIVE" variant="success" />
            <Badge label="NATIVE" variant="info" />
            <Badge label="G3D" variant="warning" />
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Texture Pipeline</Text>
            <ProgressBar value={0.88} color="#4cc2ff" height={12} showLabel />
          </Box>

          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Frame Trend</Text>
            <Sparkline data={SPARK_DATA} width={220} height={34} color="#c099ff" />
          </Box>

          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Cube Rotation</Text>
            <Switch value={cubeEnabled} onValueChange={setCubeEnabled} />
          </Box>
        </Box>

        <Scene style={{ flexGrow: 1, minHeight: 340 }} backgroundColor="#050811" stars>
          <Camera position={[0, -4, 2.3]} lookAt={[0, 0, 0.15]} fov={0.92} />
          <AmbientLight color="#1b2235" intensity={0.34} />
          <DirectionalLight direction={[-0.6, 0.8, -0.35]} color="#fff2d8" intensity={1.35} />

          <Mesh
            geometry="box"
            color="#141b2e"
            position={[0, 0, -1.0]}
            scale={[3.4, 3.4, 0.24]}
            specular={8}
          />
          <Mesh
            geometry="plane"
            color="#141f35"
            edgeColor="#2c4269"
            edgeWidth={0.012}
            position={[0, 0, -0.84]}
            scale={[2.85, 2.85, 1]}
            rotation={[0, 0, displaySpin]}
          />
          <Mesh
            geometry="cube"
            texture="framework-canvas"
            seed={11}
            position={[0, 0, 0.18]}
            scale={1.25}
            rotation={[cubeSpin * 0.5, cubeSpin, cubeSpin * 0.25]}
            edgeColor="#0f172a"
            edgeWidth={0.02}
            specular={72}
          />
          <Mesh
            geometry="cube"
            color="#8fd7ff"
            position={[0, 0, 0.18]}
            scale={1.31}
            rotation={[cubeSpin * 0.5, cubeSpin, cubeSpin * 0.25]}
            opacity={0.16}
            fresnel={2.8}
            unlit
          />
        </Scene>
      </Box>

      <Text style={{ fontSize: 10, color: c.textSecondary }}>
        Texture source: procedural 2D canvas (`framework-canvas`) mapped to a g3d cube
      </Text>
    </Box>
  );
}
