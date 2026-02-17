import type { Style, LoveEvent } from '@ilovereact/core';

/** 3D vector as [x, y, z] */
export type Vec3 = [number, number, number];

/** Props for the <Scene> component — a 3D viewport in the 2D layout */
export interface SceneProps {
  /** Style applied to the viewport box in the 2D layout (width, height, etc.) */
  style?: Style;
  /** Background color of the 3D viewport (hex string, default: #12121b) */
  backgroundColor?: string;
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
  /** Path to a texture image */
  texture?: string;
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
  /** Click handler (Phase 5 — raycasting) */
  onClick?: (event: LoveEvent) => void;
  /** Pointer enter handler (Phase 5 — raycasting) */
  onPointerEnter?: (event: LoveEvent) => void;
  /** Pointer leave handler (Phase 5 — raycasting) */
  onPointerLeave?: (event: LoveEvent) => void;
}
