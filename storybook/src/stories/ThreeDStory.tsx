/**
 * ThreeD — Package documentation page (Layout2 zigzag narrative).
 *
 * Uses Band/Half/HeroBand/CalloutBand/Divider/SectionLabel from StoryScaffold.
 * Those components enforce alignment — both columns always start at (0,0).
 *
 * Live demos for Scene, Camera, Mesh, lights, orbit controls, wireframes,
 * procedural textures, fresnel, specular, opacity, and edge rendering.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, useLuaInterval } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';
import { Scene, Camera, Mesh, DirectionalLight, AmbientLight } from '../../../packages/3d/src';
import type { Vec3 } from '../../../packages/3d/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#89b4fa',
  accentDim: 'rgba(137, 180, 250, 0.12)',
  callout: 'rgba(137, 180, 250, 0.06)',
  calloutBorder: 'rgba(137, 180, 250, 0.30)',
  scene: '#89b4fa',
  mesh: '#a6e3a1',
  light: '#f9e2af',
  camera: '#cba6f7',
  material: '#f5c2e7',
  edge: '#fab387',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { Scene, Camera, Mesh } from '@reactjit/3d'
import { DirectionalLight, AmbientLight } from '@reactjit/3d'
import type { Vec3, GeometryType } from '@reactjit/3d'`;

const SCENE_CODE = `<Scene style={{ width: '100%', flexGrow: 1 }}
  backgroundColor="#12121b" stars orbitControls>
  <Camera position={[0, -3, 2]} lookAt={[0, 0, 0]} />
  <AmbientLight color="#1a1a2e" intensity={0.15} />
  <DirectionalLight direction={[1, -1, 1]} intensity={1.2} />
  <Mesh geometry="sphere" color="#89b4fa" />
</Scene>`;

const MESH_CODE = `// Built-in geometries
<Mesh geometry="box" color="#a6e3a1" />
<Mesh geometry="sphere" color="#f5c2e7" wireframe />
<Mesh geometry="plane" color="#89b4fa" />

// Transform
<Mesh geometry="cube"
  position={[2, 0, 0]}
  rotation={[0, spin, 0]}
  scale={0.8} />`;

const LIGHTING_CODE = `// Ambient fill light (no direction)
<AmbientLight color="#1a1a2e" intensity={0.15} />

// Directional light (Blinn-Phong)
<DirectionalLight
  direction={[1, -1, 1]}
  color="#fff5e0"
  intensity={1.2} />`;

const MATERIAL_CODE = `// Specular highlights (Blinn-Phong)
<Mesh geometry="sphere" specular={64} />

// Fresnel rim glow (atmosphere effect)
<Mesh geometry="sphere" fresnel={3} opacity={0.3} unlit />

// Edge borders (wireframe overlay)
<Mesh geometry="box" edgeColor="#000" edgeWidth={0.04} />

// Transparency
<Mesh geometry="sphere" opacity={0.5} />`;

const CAMERA_CODE = `<Camera
  position={[0, -5, 3]}   // where the eye is
  lookAt={[0, 0, 0]}      // what it's pointed at
  fov={Math.PI / 3}       // 60° field of view
  near={0.01}             // near clip
  far={1000}              // far clip
/>`;

const TEXTURE_CODE = `// Procedural planet texture (different seed = different terrain)
<Mesh geometry="sphere" texture="planet" seed={42} />

// Framework canvas mapped onto a cube
<Mesh geometry="cube" texture="framework-canvas" seed={11} />`;

// ── Helpers ──────────────────────────────────────────────

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

// ── Geometry Showcase Demo ──────────────────────────────

type GeoChoice = 'box' | 'sphere' | 'plane';
const GEO_CHOICES: GeoChoice[] = ['box', 'sphere', 'plane'];
const GEO_COLORS: Record<GeoChoice, string> = { box: '#a6e3a1', sphere: '#f5c2e7', plane: '#89b4fa' };

function GeometryDemo() {
  const c = useThemeColors();
  const [spin, setSpin] = useState(0);
  const [geo, setGeo] = useState<GeoChoice>('box');

  useLuaInterval(16, () => setSpin(p => p + 0.025));

  const cycleGeo = useCallback(() => {
    setGeo(prev => GEO_CHOICES[(GEO_CHOICES.indexOf(prev) + 1) % GEO_CHOICES.length]);
  }, []);

  return (
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="Scene" color={C.scene} />
        <Tag text="Camera" color={C.camera} />
        <Tag text="Mesh" color={C.mesh} />
      </Box>

      <Scene style={{ width: 240, height: 180, borderRadius: 6 }} backgroundColor="#12121b">
        <Camera position={[0, -3, 1.5]} lookAt={[0, 0, 0]} fov={1.05} />
        <AmbientLight color="#1a1a2e" intensity={0.2} />
        <DirectionalLight direction={[1, -1, 1]} color="#ffffff" intensity={1.0} />

        <Mesh
          geometry={geo}
          color={GEO_COLORS[geo]}
          edgeColor="#000000"
          edgeWidth={0.03}
          rotation={[spin * 0.7, spin, spin * 0.3]}
        />
      </Scene>

      <Label label="geometry" value={geo} color={GEO_COLORS[geo]} />
      <Label label="rotation" value={`[${(spin * 0.7).toFixed(1)}, ${spin.toFixed(1)}, ${(spin * 0.3).toFixed(1)}]`} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label="Next Shape" color={C.mesh} onPress={cycleGeo} />
      </Box>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'Shapes auto-rotate with useLuaInterval'}</Text>
    </Box>
  );
}

// ── Lighting Lab Demo ───────────────────────────────────

function LightingDemo() {
  const c = useThemeColors();
  const [spin, setSpin] = useState(0);
  const [lightAngle, setLightAngle] = useState(0.6);
  const [specular, setSpecular] = useState(32);

  useLuaInterval(16, () => setSpin(p => p + 0.012));

  const lightDir: Vec3 = [
    Math.cos(lightAngle),
    -Math.sin(lightAngle),
    0.5,
  ];

  return (
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="DirectionalLight" color={C.light} />
        <Tag text="AmbientLight" color={C.light} />
        <Tag text="specular" color={C.material} />
      </Box>

      <Scene style={{ width: 240, height: 180, borderRadius: 6 }} backgroundColor="#0a0a14">
        <Camera position={[0, -3.5, 1.5]} lookAt={[0, 0, 0]} fov={1.0} />
        <AmbientLight color="#1a1a2e" intensity={0.12} />
        <DirectionalLight direction={lightDir} color="#fff5e0" intensity={1.3} />

        <Mesh
          geometry="sphere"
          color="#cdd6f4"
          rotation={[0, spin, 0]}
          specular={specular}
        />
        <Mesh
          geometry="box"
          color="#a6e3a1"
          position={[-1.8, 0, 0]}
          rotation={[spin * 0.5, spin, 0]}
          specular={specular}
          edgeColor="#1e1e2e"
          edgeWidth={0.03}
        />
        <Mesh
          geometry="sphere"
          color="#f5c2e7"
          position={[1.8, 0, 0]}
          scale={0.7}
          wireframe
          rotation={[0, spin * 0.8, 0]}
        />
      </Scene>

      <Label label="light angle" value={`${(lightAngle * 180 / Math.PI).toFixed(0)}\u00B0`} color={C.light} />
      <Label label="specular" value={String(specular)} color={C.material} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={'\u2190 Light'} color={C.light} onPress={() => setLightAngle(p => p - 0.4)} />
        <ActionBtn label={'Light \u2192'} color={C.light} onPress={() => setLightAngle(p => p + 0.4)} />
      </Box>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label="Spec 16" color={C.material} onPress={() => setSpecular(16)} />
        <ActionBtn label="Spec 64" color={C.material} onPress={() => setSpecular(64)} />
        <ActionBtn label="Spec 128" color={C.material} onPress={() => setSpecular(128)} />
      </Box>
    </Box>
  );
}

// ── Planet Demo ─────────────────────────────────────────

function PlanetDemo() {
  const c = useThemeColors();
  const [time, setTime] = useState(0);
  const [seed, setSeed] = useState(42);

  useLuaInterval(16, () => setTime(p => p + 0.008));

  const moonX = Math.cos(time * 1.5) * 2.2;
  const moonY = Math.sin(time * 1.5) * 2.2;
  const moonZ = Math.sin(time * 0.7) * 0.4;

  return (
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="texture" color={C.material} />
        <Tag text="fresnel" color={C.material} />
        <Tag text="stars" color={C.scene} />
        <Tag text="orbitControls" color={C.scene} />
      </Box>

      <Scene style={{ width: 240, height: 180, borderRadius: 6 }} backgroundColor="#020208" stars orbitControls>
        <Camera position={[0, -3.5, 1.5]} lookAt={[0, 0, 0]} fov={1.0} />
        <AmbientLight color="#1a1a3a" intensity={0.12} />
        <DirectionalLight direction={[0.6, -0.8, 0.4]} color="#fff5e0" intensity={1.2} />

        <Mesh
          geometry="sphere"
          texture="planet"
          seed={seed}
          rotation={[0.3, time * 0.4, 0]}
          specular={64}
        />
        <Mesh
          geometry="sphere"
          color="#74c7ec"
          scale={1.04}
          rotation={[0.3, time * 0.4, 0]}
          opacity={0.3}
          fresnel={3}
          unlit
        />
        <Mesh
          geometry="sphere"
          color="#9ca0b0"
          scale={0.18}
          position={[moonX, moonY, moonZ]}
          rotation={[0, time, 0]}
          specular={16}
        />
      </Scene>

      <Label label="seed" value={String(seed)} color={C.material} />
      <Label label="moon pos" value={`[${moonX.toFixed(1)}, ${moonY.toFixed(1)}, ${moonZ.toFixed(1)}]`} color={C.camera} />
      <Text style={{ fontSize: 9, color: c.textDim }}>{'Drag to orbit. Each seed generates unique terrain.'}</Text>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label={`Seed ${seed + 1}`} color={C.material} onPress={() => setSeed(p => p + 1)} />
        <ActionBtn label={`Seed ${seed + 10}`} color={C.material} onPress={() => setSeed(p => p + 10)} />
      </Box>
    </Box>
  );
}

// ── Edge & Wireframe Demo ───────────────────────────────

function EdgeDemo() {
  const c = useThemeColors();
  const [spin, setSpin] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [edgeWidth, setEdgeWidth] = useState(0.04);

  useLuaInterval(16, () => setSpin(p => p + 0.02));

  return (
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="edgeColor" color={C.edge} />
        <Tag text="edgeWidth" color={C.edge} />
        <Tag text="wireframe" color={C.edge} />
      </Box>

      <Scene style={{ width: 240, height: 160, borderRadius: 6 }} backgroundColor="#12121b">
        <Camera position={[0, -4, 2]} lookAt={[0, 0, 0]} fov={1.0} />
        <AmbientLight color="#1a1a2e" intensity={0.25} />
        <DirectionalLight direction={[1, -1, 1]} intensity={1.0} />

        <Mesh
          geometry="box"
          color="#313244"
          edgeColor={C.edge}
          edgeWidth={edgeWidth}
          position={[-1.3, 0, 0]}
          rotation={[spin * 0.6, spin, 0]}
        />
        <Mesh
          geometry="sphere"
          color="#313244"
          wireframe={wireframe}
          edgeColor={wireframe ? C.scene : undefined}
          position={[1.3, 0, 0]}
          rotation={[0, spin * 0.5, 0]}
          specular={32}
        />
      </Scene>

      <Label label="edgeWidth" value={edgeWidth.toFixed(2)} color={C.edge} />
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: wireframe ? C.scene : c.textDim }} />
        <Text style={{ fontSize: 9, color: wireframe ? C.scene : c.textDim }}>
          {wireframe ? 'Wireframe on' : 'Wireframe off'}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label="Thin" color={C.edge} onPress={() => setEdgeWidth(0.02)} />
        <ActionBtn label="Medium" color={C.edge} onPress={() => setEdgeWidth(0.04)} />
        <ActionBtn label="Thick" color={C.edge} onPress={() => setEdgeWidth(0.08)} />
        <ActionBtn label="Wire" color={C.scene} onPress={() => setWireframe(w => !w)} />
      </Box>
    </Box>
  );
}

// ── Transparency & Fresnel Demo ─────────────────────────

function FresnelDemo() {
  const c = useThemeColors();
  const [spin, setSpin] = useState(0);
  const [fresnel, setFresnel] = useState(3.0);
  const [opacity, setOpacity] = useState(0.35);

  useLuaInterval(16, () => setSpin(p => p + 0.015));

  return (
    <Box style={{ gap: 8, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Tag text="fresnel" color={C.material} />
        <Tag text="opacity" color={C.material} />
        <Tag text="unlit" color={C.material} />
      </Box>

      <Scene style={{ width: 240, height: 160, borderRadius: 6 }} backgroundColor="#020208" stars>
        <Camera position={[0, -3, 1.2]} lookAt={[0, 0, 0]} fov={1.0} />
        <AmbientLight color="#1a1a3a" intensity={0.15} />
        <DirectionalLight direction={[0.5, -1, 0.5]} color="#ffffff" intensity={1.0} />

        <Mesh
          geometry="sphere"
          color="#89b4fa"
          specular={48}
          rotation={[0, spin, 0]}
        />
        <Mesh
          geometry="sphere"
          color="#74c7ec"
          scale={1.06}
          opacity={opacity}
          fresnel={fresnel}
          unlit
          rotation={[0, spin, 0]}
        />
      </Scene>

      <Label label="fresnel" value={fresnel.toFixed(1)} color={C.material} />
      <Label label="opacity" value={opacity.toFixed(2)} color={C.material} />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label="F 0" color={C.material} onPress={() => setFresnel(0)} />
        <ActionBtn label="F 3" color={C.material} onPress={() => setFresnel(3)} />
        <ActionBtn label="F 6" color={C.material} onPress={() => setFresnel(6)} />
      </Box>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionBtn label="Op 0.2" color={C.camera} onPress={() => setOpacity(0.2)} />
        <ActionBtn label="Op 0.5" color={C.camera} onPress={() => setOpacity(0.5)} />
        <ActionBtn label="Op 0.8" color={C.camera} onPress={() => setOpacity(0.8)} />
      </Box>
      <Text style={{ fontSize: 9, color: c.textDim }}>{'Outer shell: unlit + fresnel for atmosphere glow'}</Text>
    </Box>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  const features = [
    { label: 'Scene', desc: 'A 3D viewport in the 2D layout. backgroundColor, stars, orbitControls.', color: C.scene },
    { label: 'Camera', desc: 'Position, lookAt, fov, near, far. One per scene.', color: C.camera },
    { label: 'Mesh', desc: 'Geometry + material + transform. box, cube, sphere, plane, or OBJ model.', color: C.mesh },
    { label: 'DirectionalLight', desc: 'Blinn-Phong directional. direction, color, intensity.', color: C.light },
    { label: 'AmbientLight', desc: 'Fill light. color, intensity.', color: C.light },
    { label: 'orbitControls', desc: 'Lua-side drag-to-rotate. Zero latency, no bridge round-trip.', color: C.scene },
    { label: 'stars', desc: 'Procedural starfield background.', color: C.scene },
    { label: 'texture', desc: 'Procedural textures: "planet", "framework-canvas". seed for variation.', color: C.material },
    { label: 'specular', desc: 'Shininess power (1-128). Higher = tighter highlights.', color: C.material },
    { label: 'fresnel', desc: 'Rim glow power (0-8). Use with unlit + opacity for atmospheres.', color: C.material },
    { label: 'edgeColor', desc: 'Wireframe border on face edges. Works with edgeWidth.', color: C.edge },
    { label: 'wireframe', desc: 'Longitude/latitude grid lines on spheres.', color: C.edge },
    { label: 'opacity', desc: 'Alpha blending 0-1. Combine with fresnel for glass/glow.', color: C.material },
    { label: 'onClick', desc: 'Raycasting click handler on meshes.', color: C.mesh },
    { label: 'onPointerEnter', desc: 'Hover enter via raycast.', color: C.mesh },
  ];
  return (
    <>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 120 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </>
  );
}

// ── ThreeDStory ─────────────────────────────────────────

export function ThreeDStory() {
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
          {'3D'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/3d'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Declarative 3D scenes in JSX via g3d'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'One-liner 3D. React declares the scene, Lua renders it with OpenGL.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Each <Scene> is a 3D viewport in the 2D layout tree. Meshes, lights, and cameras are JSX children. The Lua renderer handles projection, Blinn-Phong shading, edge wireframes, procedural textures, and orbit controls \u2014 all at 60fps with zero bridge overhead per frame.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Five components. Scene is the viewport, Camera sets the view, Mesh renders geometry, DirectionalLight and AmbientLight handle Blinn-Phong shading. Everything lives in the same tree as your 2D layout.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── demo | text — GEOMETRY ── */}
        <Band>
          <Half>
            <GeometryDemo />
          </Half>
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'GEOMETRY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Four built-in geometry types: box (unit cube), cube (alias), sphere (UV sphere, 48 segments), and plane (flat quad). Pass position, rotation, and scale as props. Color is a hex string. Add edgeColor for visible face borders.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={MESH_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── text | demo — LIGHTING ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'LIGHTING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Blinn-Phong shading with directional and ambient lights. Direction points TO the light source (normalized internally). Specular power controls highlight tightness \u2014 16 for matte, 64 for plastic, 128 for metal. Multiple lights supported.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={LIGHTING_CODE} />
          </Half>
          <Half>
            <LightingDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'3D rendering runs entirely in Lua. Each Scene renders to an off-screen Love2D Canvas with a depth buffer. The 2D painter composites the Canvas at the node\u2019s computed position. React never touches the GL context \u2014 zero bridge overhead per frame.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── demo | text — PLANET / TEXTURES ── */}
        <Band>
          <Half>
            <PlanetDemo />
          </Half>
          <Half>
            <SectionLabel icon="globe" accentColor={C.accent}>{'PROCEDURAL TEXTURES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The texture prop activates procedural generation. "planet" creates terrain with continents and oceans \u2014 each seed produces a unique world. "framework-canvas" maps a 2D UI rendering onto the surface. Stars and orbitControls are Scene-level props for immersive viewports.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={TEXTURE_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── text | demo — EDGES & WIREFRAME ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'EDGES & WIREFRAME'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'edgeColor draws borders on face edges \u2014 makes cubes look cell-shaded or architectural. edgeWidth controls line thickness as a fraction of UV space (0.02 thin, 0.08 thick). wireframe draws longitude/latitude grid lines on spheres, making them visibly 3D even without lighting.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={MATERIAL_CODE} />
          </Half>
          <Half>
            <EdgeDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── demo | text — FRESNEL & TRANSPARENCY ── */}
        <Band>
          <Half>
            <FresnelDemo />
          </Half>
          <Half>
            <SectionLabel icon="shield" accentColor={C.accent}>{'FRESNEL & TRANSPARENCY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Fresnel controls alpha at glancing angles \u2014 the classic atmosphere glow effect. Combine with unlit (skip lighting, flat color only) and opacity for glass, force fields, and planetary atmospheres. Layer an outer shell over a solid inner sphere for the full planet look.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — CAMERA ── */}
        <Band>
          <Half>
            <SectionLabel icon="settings" accentColor={C.accent}>{'CAMERA'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'One Camera per Scene. Position is where the eye sits in world space. lookAt is the target point. fov is in radians (default \u03C0/3 = 60\u00B0). near/far control the clipping planes. When orbitControls is enabled on the Scene, mouse drag rotates the view at Lua speed with no React re-renders.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={CAMERA_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — SCENE SETUP ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={SCENE_CODE} />
          <Half>
            <SectionLabel icon="terminal" accentColor={C.accent}>{'MINIMAL SCENE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'A complete 3D scene in 7 lines of JSX. The Scene takes standard style props (width, height, flexGrow) since it participates in the 2D layout. backgroundColor fills the viewport before any 3D content. Stars and orbitControls are boolean toggles.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Feature catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="terminal" accentColor={C.accent}>{'API SURFACE'}</SectionLabel>
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
        <Text style={{ color: c.text, fontSize: 9 }}>{'3D'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
