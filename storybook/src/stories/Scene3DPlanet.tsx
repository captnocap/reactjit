import React, { useState, useCallback } from 'react';
import { Box, Text, Slider, useLuaInterval } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import type { LoveEvent } from '../../../packages/core/src';
import { Scene, Camera, Mesh, DirectionalLight, AmbientLight } from '../../../packages/3d/src';
import type { Vec3 } from '../../../packages/3d/src';

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
  step?: number;
  onChange: (v: number) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 24 }}>
      <Text style={{ fontSize: 11, color: c.textSecondary, width: 90 }}>{label}</Text>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        style={{ width: 120, height: 20 }}
        trackColor="#313244"
        activeTrackColor="#89b4fa"
        thumbColor="#cdd6f4"
        thumbSize={14}
        trackHeight={3}
      />
      <Text style={{ fontSize: 10, color: c.textDim, width: 36 }}>
        {value.toFixed(step && step < 0.1 ? 2 : 1)}
      </Text>
    </Box>
  );
}

export function Scene3DPlanetStory() {
  const c = useThemeColors();
  const [time, setTime] = useState(0);

  // Lighting controls
  const [lightAzimuth, setLightAzimuth] = useState(0.6);
  const [lightElevation, setLightElevation] = useState(0.4);
  const [lightIntensity, setLightIntensity] = useState(1.2);
  const [ambientIntensity, setAmbientIntensity] = useState(0.12);
  const [specularPower, setSpecularPower] = useState(64);
  const [fresnelPower, setFresnelPower] = useState(3.0);
  const [atmosphereOpacity, setAtmosphereOpacity] = useState(0.35);

  // Camera zoom (distance from origin)
  const [zoom, setZoom] = useState(3.5);

  const handleWheel = useCallback((event: LoveEvent) => {
    setZoom((prev) => {
      const delta = (event.deltaY || 0) * 0.3;
      return Math.max(1.5, Math.min(10, prev - delta));
    });
  }, []);

  useLuaInterval(16, () => {
    setTime((prev) => prev + 0.008);
  });

  // Moon orbits the planet in a tilted ellipse
  const moonDist = 2.2;
  const moonX = Math.cos(time * 1.5) * moonDist;
  const moonY = Math.sin(time * 1.5) * moonDist;
  const moonZ = Math.sin(time * 0.7) * 0.5;

  // Convert azimuth/elevation to direction vector
  const lightDir: Vec3 = [
    Math.cos(lightElevation) * Math.sin(lightAzimuth),
    -Math.cos(lightElevation) * Math.cos(lightAzimuth),
    Math.sin(lightElevation),
  ];

  // Camera position from zoom (along the same direction as default)
  const camDir = [0, -1, 0.43]; // normalized-ish direction from origin
  const camLen = Math.sqrt(camDir[0] ** 2 + camDir[1] ** 2 + camDir[2] ** 2);
  const camPos: Vec3 = [
    (camDir[0] / camLen) * zoom,
    (camDir[1] / camLen) * zoom,
    (camDir[2] / camLen) * zoom,
  ];

  return (
    <Box style={{ width: '100%', height: '100%' }} onWheel={handleWheel}>
      <Scene
        style={{ width: '100%', height: '100%' }}
        backgroundColor="#020208"
        stars
        orbitControls
      >
        <Camera position={camPos} lookAt={[0, 0, 0]} fov={1.0} />

        {/* Lighting */}
        <AmbientLight color="#1a1a3a" intensity={ambientIntensity} />
        <DirectionalLight direction={lightDir} color="#fff5e0" intensity={lightIntensity} />

        {/* Planet — auto-rotates, Lua orbit controls add drag offset on top */}
        <Mesh
          geometry="sphere"
          texture="planet"
          seed={42}
          rotation={[0.3, time * 0.4, 0]}
          specular={specularPower}
        />

        {/* Atmosphere */}
        <Mesh
          geometry="sphere"
          color="#74c7ec"
          scale={1.04}
          rotation={[0.3, time * 0.4, 0]}
          opacity={atmosphereOpacity}
          fresnel={fresnelPower}
          unlit
        />

        {/* Moon */}
        <Mesh
          geometry="sphere"
          color="#9ca0b0"
          scale={0.18}
          position={[moonX, moonY, moonZ]}
          rotation={[0, time, 0]}
          specular={16}
        />
      </Scene>

      {/* Control panel */}
      <Box
        style={{
          position: 'absolute',
          top: 40,
          right: 12,
          padding: 12,
          backgroundColor: 'rgba(17,17,27,0.85)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#313244',
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 12, color: c.text, fontWeight: 'normal', marginBottom: 4 }}>
          Lighting
        </Text>
        <LabeledSlider label="Azimuth" value={lightAzimuth} min={-3.14} max={3.14} step={0.05} onChange={setLightAzimuth} />
        <LabeledSlider label="Elevation" value={lightElevation} min={-1.5} max={1.5} step={0.05} onChange={setLightElevation} />
        <LabeledSlider label="Intensity" value={lightIntensity} min={0} max={3} step={0.1} onChange={setLightIntensity} />
        <LabeledSlider label="Ambient" value={ambientIntensity} min={0} max={1} step={0.02} onChange={setAmbientIntensity} />
        <LabeledSlider label="Specular" value={specularPower} min={1} max={128} step={1} onChange={setSpecularPower} />

        <Text style={{ fontSize: 12, color: c.text, fontWeight: 'normal', marginTop: 8, marginBottom: 4 }}>
          Camera
        </Text>
        <LabeledSlider label="Zoom" value={zoom} min={1.5} max={10} step={0.1} onChange={setZoom} />

        <Text style={{ fontSize: 12, color: c.text, fontWeight: 'normal', marginTop: 8, marginBottom: 4 }}>
          Atmosphere
        </Text>
        <LabeledSlider label="Fresnel" value={fresnelPower} min={0} max={8} step={0.1} onChange={setFresnelPower} />
        <LabeledSlider label="Opacity" value={atmosphereOpacity} min={0} max={1} step={0.02} onChange={setAtmosphereOpacity} />
      </Box>

      {/* Bottom HUD */}
      <Box
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: 8,
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: 6,
        }}
      >
        <Text style={{ fontSize: 11, color: c.textDim }}>
          Blinn-Phong shading | seed: 42 | drag to rotate
        </Text>
      </Box>
    </Box>
  );
}
