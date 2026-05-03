// scene3d_lab — six-tile test surface for the rewritten <Scene3D> primitive.
//
// Each tile is one focused stress on the host wgpu 3D pipeline (paths in
// framework/gpu/3d.zig + framework/layout.zig:scene3d_*). Sitting them in a
// 3x2 grid lets us see which tiles paint and which don't in a single frame
// after a ship.
//
// What we're verifying, tile-by-tile:
//   1. SINGLE       — does any 3D mesh render at all?
//   2. GEO ZOO      — do all four procedural geometries (box/sphere/plane/torus) build?
//   3. LIGHTING     — do ambient/directional/point lights light a surface differently?
//   4. COLOR SPREAD — do per-mesh scene3d_color_r/g/b channels actually drive material color?
//   5. TRANSFORMS   — do position/rotation/scale survive the round-trip to gpu/3d.zig?
//   6. MINI AVATAR  — does a parts-taxonomy assembly compose cleanly (the eventual avatar shape)?

import { Box, Col, Row, Text, Scene3D } from '@reactjit/runtime/primitives';
import { Avatar } from '@reactjit/runtime/avatar';
import type { AvatarData } from '@reactjit/runtime/avatar';

const BG = '#0a0e18';
const TILE_BG = '#0e1116';
const PAGE_BG = '#06090f';
const FRAME = '#1a1f29';
const INK = '#e6e9ef';
const INK_DIM = '#8c93a0';
const ACCENT = '#ff9d3d';

const TILE_W = 400;
const TILE_H = 320;

function Tile({ label, kicker, children }: { label: string; kicker: string; children: any }) {
  return (
    <Col style={{ gap: 6 }}>
      <Row style={{ gap: 8, alignItems: 'baseline' }}>
        <Text fontSize={11} color={ACCENT} style={{ fontWeight: 'bold', letterSpacing: 1 }}>{label}</Text>
        <Text fontSize={10} color={INK_DIM}>{kicker}</Text>
      </Row>
      <Box style={{
        width: TILE_W,
        height: TILE_H,
        backgroundColor: TILE_BG,
        borderColor: FRAME,
        borderWidth: 1,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {children}
      </Box>
    </Col>
  );
}

// 1 ── Single mesh — baseline. If this is empty the pipeline isn't painting.
function SceneSingle() {
  return (
    <Scene3D style={{ width: '100%', height: '100%' }} backgroundColor={BG}>
      <Scene3D.Camera position={[0, 0, 4]} target={[0, 0, 0]} fov={55} />
      <Scene3D.AmbientLight color="#ffffff" intensity={0.35} />
      <Scene3D.DirectionalLight direction={[0.4, 0.7, 0.6]} color="#ffffff" intensity={0.9} />
      <Scene3D.Mesh geometry="sphere" material="#4aa3ff" position={[0, 0, 0]} radius={1} />
    </Scene3D>
  );
}

// 2 ── Geometry zoo — every procedural geometry kind side by side.
function SceneGeoZoo() {
  return (
    <Scene3D style={{ width: '100%', height: '100%' }} backgroundColor={BG}>
      <Scene3D.Camera position={[0, 1.5, 6]} target={[0, 0, 0]} fov={55} />
      <Scene3D.AmbientLight color="#ffffff" intensity={0.3} />
      <Scene3D.DirectionalLight direction={[0.5, 1, 0.4]} color="#ffffff" intensity={0.8} />

      <Scene3D.Mesh geometry="box"    material="#ff7a59" position={[-2.4, 0, 0]} sizeX={1} sizeY={1} sizeZ={1} />
      <Scene3D.Mesh geometry="sphere" material="#4aa3ff" position={[-0.8, 0, 0]} radius={0.6} />
      <Scene3D.Mesh geometry="plane"  material="#9be08e" position={[ 0.8, 0, 0]} rotation={[-0.6, 0, 0]} sizeX={1.4} sizeY={1.4} />
      <Scene3D.Mesh geometry="torus"  material="#ffd66a" position={[ 2.4, 0, 0]} radius={0.55} tubeRadius={0.2} />
    </Scene3D>
  );
}

// 3 ── Lighting — same sphere, different lights at slightly different angles.
//      Ambient sets a base, directional carves the shape, point colors a corner.
function SceneLighting() {
  return (
    <Scene3D style={{ width: '100%', height: '100%' }} backgroundColor={BG}>
      <Scene3D.Camera position={[0, 0.5, 4]} target={[0, 0, 0]} fov={55} />
      <Scene3D.AmbientLight color="#3a4566" intensity={0.4} />
      <Scene3D.DirectionalLight direction={[-0.6, 0.7, 0.4]} color="#ffffff" intensity={1.0} />
      <Scene3D.PointLight position={[1.8, 0.6, 1.4]} color="#ffc48a" intensity={1.4} />

      <Scene3D.Mesh geometry="sphere" material="#dcdcdc" position={[0, 0, 0]} radius={1.1} />
      <Scene3D.Mesh geometry="plane"  material="#1a3050" position={[0, -1.2, 0]} rotation={[-1.2, 0, 0]} sizeX={5} sizeY={5} />
    </Scene3D>
  );
}

// 4 ── Color spread — eight spheres in a hue arc. Verifies per-mesh color
//      channels survive the round-trip (each one carries a different RGB).
function SceneColorSpread() {
  const swatches = [
    '#ff5050', '#ff9d3d', '#f5d24a', '#7adb5e',
    '#3fc4c0', '#4aa3ff', '#9b6bff', '#ff5fa0',
  ];
  const spacing = 0.7;
  return (
    <Scene3D style={{ width: '100%', height: '100%' }} backgroundColor={BG}>
      <Scene3D.Camera position={[0, 0.4, 4.5]} target={[0, 0, 0]} fov={60} />
      <Scene3D.AmbientLight color="#ffffff" intensity={0.45} />
      <Scene3D.DirectionalLight direction={[0.3, 1, 0.6]} color="#ffffff" intensity={0.8} />
      {swatches.map((hex, i) => (
        <Scene3D.Mesh
          key={i}
          geometry="sphere"
          material={hex}
          position={[(i - (swatches.length - 1) / 2) * spacing, 0, 0]}
          radius={0.28}
        />
      ))}
    </Scene3D>
  );
}

// 5 ── Transforms — same box, different position/rotation/scale combos.
//      Tests that all three transform channels survive.
function SceneTransforms() {
  return (
    <Scene3D style={{ width: '100%', height: '100%' }} backgroundColor={BG}>
      <Scene3D.Camera position={[0, 1.2, 5.5]} target={[0, 0, 0]} fov={55} />
      <Scene3D.AmbientLight color="#ffffff" intensity={0.35} />
      <Scene3D.DirectionalLight direction={[0.4, 0.8, 0.6]} color="#ffffff" intensity={0.9} />

      {/* baseline cube */}
      <Scene3D.Mesh geometry="box" material="#4aa3ff" position={[-2.4, 0, 0]} />

      {/* rotated 45° around Y */}
      <Scene3D.Mesh geometry="box" material="#ff9d3d" position={[-0.8, 0, 0]} rotation={[0, Math.PI / 4, 0]} />

      {/* rotated through all three axes */}
      <Scene3D.Mesh geometry="box" material="#9be08e" position={[ 0.8, 0, 0]} rotation={[Math.PI / 6, Math.PI / 4, Math.PI / 8]} />

      {/* non-uniform scale */}
      <Scene3D.Mesh geometry="box" material="#ff5fa0" position={[ 2.4, 0, 0]} scale={[0.4, 1.4, 0.4]} />
    </Scene3D>
  );
}

// 6 ── Mini avatar — drives the AvatarData → <Avatar> path.
//      The 12-part taxonomy is now data, not JSX, and rendered through
//      the Avatar component (runtime/avatar/Avatar.tsx). Same chunky
//      RuneScape mannequin as before; the proof is that the visual
//      ecosystem is decoupled from any Character voice config and a
//      single component composes the whole figure from a parts list.
const AVATAR_SAGE: AvatarData = {
  id: 'sage',
  name: 'Sage',
  ownerKind: 'character',
  ownerId: 'char_default',
  parts: [
    { id: 'head',       kind: 'head',       geometry: 'sphere', color: '#d9b48c', position: [   0,  1.55, 0],    radius: 0.35 },
    { id: 'crown',      kind: 'crown',      geometry: 'box',    color: '#ffd66a', position: [   0,  1.95, 0],    size: [0.7, 0.12, 0.7] },
    { id: 'halo',       kind: 'halo',       geometry: 'torus',  color: '#ffd66a', position: [   0,  2.15, 0],    rotation: [Math.PI / 2, 0, 0], radius: 0.30, tubeRadius: 0.03 },
    { id: 'torso',      kind: 'torso',      geometry: 'box',    color: '#4aa3ff', position: [   0,  0.85, 0],    size: [0.85, 1.1, 0.5] },
    { id: 'arm-l',      kind: 'arm-left',   geometry: 'box',    color: '#4aa3ff', position: [-0.6,  0.85, 0],    size: [0.22, 1.0, 0.32] },
    { id: 'arm-r',      kind: 'arm-right',  geometry: 'box',    color: '#4aa3ff', position: [ 0.6,  0.85, 0],    size: [0.22, 1.0, 0.32] },
    { id: 'hand-l',     kind: 'hand-left',  geometry: 'sphere', color: '#d9b48c', position: [-0.6,  0.20, 0],    radius: 0.13 },
    { id: 'hand-r',     kind: 'hand-right', geometry: 'sphere', color: '#d9b48c', position: [ 0.6,  0.20, 0],    radius: 0.13 },
    { id: 'leg-l',      kind: 'leg-left',   geometry: 'box',    color: '#26314a', position: [-0.22, -0.10, 0],   size: [0.25, 1.05, 0.32] },
    { id: 'leg-r',      kind: 'leg-right',  geometry: 'box',    color: '#26314a', position: [ 0.22, -0.10, 0],   size: [0.25, 1.05, 0.32] },
    { id: 'foot-l',     kind: 'foot-left',  geometry: 'sphere', color: '#26314a', position: [-0.22, -0.72, 0.05], radius: 0.16 },
    { id: 'foot-r',     kind: 'foot-right', geometry: 'sphere', color: '#26314a', position: [ 0.22, -0.72, 0.05], radius: 0.16 },
  ],
};
function SceneAvatar() {
  return <Avatar avatar={AVATAR_SAGE} backgroundColor={BG} />;
}

// 7 ── User avatar — same component, different owner. ownerKind='user'
//      proves the visual ecosystem is decoupled from Character: an avatar
//      can belong to the user (or be a free prop) without any voice
//      config attached.
const AVATAR_USER: AvatarData = {
  id: 'user',
  name: 'You',
  ownerKind: 'user',
  ownerId: 'user_local',
  parts: [
    { id: 'head',       kind: 'head',       geometry: 'sphere', color: '#cdb4a4', position: [   0,  1.55, 0],    radius: 0.35 },
    { id: 'torso',      kind: 'torso',      geometry: 'box',    color: '#5a5f6e', position: [   0,  0.85, 0],    size: [0.85, 1.1, 0.5] },
    { id: 'arm-l',      kind: 'arm-left',   geometry: 'box',    color: '#5a5f6e', position: [-0.6,  0.85, 0],    size: [0.22, 1.0, 0.32] },
    { id: 'arm-r',      kind: 'arm-right',  geometry: 'box',    color: '#5a5f6e', position: [ 0.6,  0.85, 0],    size: [0.22, 1.0, 0.32] },
    { id: 'hand-l',     kind: 'hand-left',  geometry: 'sphere', color: '#cdb4a4', position: [-0.6,  0.20, 0],    radius: 0.13 },
    { id: 'hand-r',     kind: 'hand-right', geometry: 'sphere', color: '#cdb4a4', position: [ 0.6,  0.20, 0],    radius: 0.13 },
    { id: 'leg-l',      kind: 'leg-left',   geometry: 'box',    color: '#33384a', position: [-0.22, -0.10, 0],   size: [0.25, 1.05, 0.32] },
    { id: 'leg-r',      kind: 'leg-right',  geometry: 'box',    color: '#33384a', position: [ 0.22, -0.10, 0],   size: [0.25, 1.05, 0.32] },
    { id: 'foot-l',     kind: 'foot-left',  geometry: 'sphere', color: '#33384a', position: [-0.22, -0.72, 0.05], radius: 0.16 },
    { id: 'foot-r',     kind: 'foot-right', geometry: 'sphere', color: '#33384a', position: [ 0.22, -0.72, 0.05], radius: 0.16 },
  ],
};
function SceneUserAvatar() {
  return <Avatar avatar={AVATAR_USER} backgroundColor={BG} />;
}

export default function Scene3DLab() {
  return (
    <Box style={{
      width: '100%', height: '100%',
      backgroundColor: PAGE_BG,
      padding: 24,
      flexDirection: 'column',
      gap: 18,
    }}>
      {/* header */}
      <Col style={{ gap: 4 }}>
        <Text fontSize={18} color={INK} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>
          SCENE3D LAB
        </Text>
        <Text fontSize={11} color={INK_DIM}>
          Six tiles, one ship. Tile that doesn't paint = a hole in the host pipeline. Path: runtime/primitives.tsx → layout.zig:scene3d_* → framework/gpu/3d.zig.
        </Text>
      </Col>

      {/* grid */}
      <Col style={{ gap: 18 }}>
        <Row style={{ gap: 18 }}>
          <Tile label="01 SINGLE"       kicker="baseline — one sphere">                  <SceneSingle /></Tile>
          <Tile label="02 GEO ZOO"      kicker="box · sphere · plane · torus">           <SceneGeoZoo /></Tile>
          <Tile label="03 LIGHTING"     kicker="ambient + directional + point">          <SceneLighting /></Tile>
        </Row>
        <Row style={{ gap: 18 }}>
          <Tile label="04 COLOR SPREAD" kicker="per-mesh r/g/b channels">                <SceneColorSpread /></Tile>
          <Tile label="05 TRANSFORMS"   kicker="position · rotation · non-uniform scale"><SceneTransforms /></Tile>
          <Tile label="06 MINI AVATAR"  kicker="<Avatar> driven by parts data (character)"><SceneAvatar /></Tile>
        </Row>
        <Row style={{ gap: 18 }}>
          <Tile label="07 USER AVATAR" kicker="same <Avatar> component, ownerKind='user' — decoupled from Character"><SceneUserAvatar /></Tile>
        </Row>
      </Col>
    </Box>
  );
}
