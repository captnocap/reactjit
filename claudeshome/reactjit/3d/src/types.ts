import type { Style, LoveEvent } from '@reactjit/core';

/** 3D vector as [x, y, z] */
export type Vec3 = [number, number, number];

/** Props for the <Scene> component — a 3D viewport in the 2D layout */
export interface SceneProps {
  /** Style applied to the viewport box in the 2D layout (width, height, etc.) */
  style?: Style;
  /** Background color of the 3D viewport (hex string, default: #12121b) */
  backgroundColor?: string;
  /** Render procedural stars in the background */
  stars?: boolean;
  /** Enable Lua-side orbit controls — drag to rotate all meshes with zero latency */
  orbitControls?: boolean;
  children?: React.ReactNode;
}

/** Props for the <Camera> component */
export interface CameraProps {
  /** Camera position in world space [x, y, z] */
  position?: Vec3;
  /** Point the camera looks at [x, y, z] */
  lookAt?: Vec3;
  /** Field of view in radians (default: Math.PI / 3 = 60deg) */
  fov?: number;
  /** Near clipping plane distance (default: 0.01) */
  near?: number;
  /** Far clipping plane distance (default: 1000) */
  far?: number;
}

/** Built-in geometry types */
export type GeometryType = 'box' | 'cube' | 'sphere' | 'plane';

/** Props for the <Mesh> component */
export interface MeshProps {
  /** Built-in geometry type */
  geometry?: GeometryType;
  /** Path to an OBJ model file */
  model?: string;
  /** Flat color (hex string) — used when no texture is provided */
  color?: string;
  /** Texture — procedural name (for example: "planet", "framework-canvas") */
  texture?: string;
  /** Seed for procedural textures (different seeds = different terrain) */
  seed?: number;
  /** Position in 3D world space [x, y, z] */
  position?: Vec3;
  /** Rotation in euler angles [rx, ry, rz] (radians) */
  rotation?: Vec3;
  /** Scale — uniform number or [sx, sy, sz] */
  scale?: number | Vec3;
  /** Edge/wireframe color (hex string) — draws borders on face edges */
  edgeColor?: string;
  /** Edge line width as fraction of face UV space (default: 0.03) */
  edgeWidth?: number;
  /** Draw longitude/latitude grid lines — makes spheres visibly 3D */
  wireframe?: boolean;
  /** Number of grid divisions per axis (default: 8 when wireframe=true) */
  gridLines?: number;
  /** Opacity 0-1 (default: 1). Values < 1 enable alpha blending. */
  opacity?: number;
  /** Specular shininess power (default: 32). Higher = tighter highlights. */
  specular?: number;
  /** Fresnel rim power. 0 = disabled, 3-5 = atmosphere glow. Controls alpha at glancing angles. */
  fresnel?: number;
  /** Skip lighting — render with flat texture color only */
  unlit?: boolean;
  /** Click handler (Phase 5 — raycasting) */
  onClick?: (event: LoveEvent) => void;
  /** Pointer enter handler (Phase 5 — raycasting) */
  onPointerEnter?: (event: LoveEvent) => void;
  /** Pointer leave handler (Phase 5 — raycasting) */
  onPointerLeave?: (event: LoveEvent) => void;
}

/** Props for the <DirectionalLight> component */
export interface DirectionalLightProps {
  /** Direction TO the light source [x, y, z] (will be normalized) */
  direction?: Vec3;
  /** Light color (hex string, default: #ffffff) */
  color?: string;
  /** Intensity multiplier (default: 1.0) */
  intensity?: number;
}

/** Props for the <AmbientLight> component */
export interface AmbientLightProps {
  /** Ambient color (hex string, default: #1a1a2e) */
  color?: string;
  /** Intensity multiplier (default: 0.15) */
  intensity?: number;
}
