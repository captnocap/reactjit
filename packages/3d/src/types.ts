import type { Style, LoveEvent } from '@reactjit/core';

/** 3D vector as [x, y, z] */
export type Vec3 = [number, number, number];

/** Projection model used by a camera */
export type CameraProjection = 'perspective' | 'orthographic';

/** High-level pose helper used by the generic <Camera> component */
export type CameraKind = 'lookAt' | 'orbit' | 'firstPerson' | 'thirdPerson' | 'view';

/** Built-in view presets for common scene layouts */
export type CameraViewPreset =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'isometric'
  | 'dimetric'
  | 'trimetric';

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
  /** Pose helper. "lookAt" uses explicit position/lookAt, orbit/firstPerson/view derive the pose. */
  kind?: CameraKind;
  /** Projection model. Orthographic keeps object size constant with distance. */
  projection?: CameraProjection;
  /** Camera position in world space [x, y, z] */
  position?: Vec3;
  /** Point the camera looks at [x, y, z] */
  lookAt?: Vec3;
  /** Alias for lookAt, useful for orbit/view/third-person cameras */
  target?: Vec3;
  /** Camera up vector. Defaults to [0, 0, 1] unless the preset requires another axis. */
  up?: Vec3;
  /** Forward direction for first-person cameras. Overrides yaw/pitch when provided. */
  direction?: Vec3;
  /** Yaw angle in radians around the Z axis */
  yaw?: number;
  /** Pitch angle in radians above/below the horizon */
  pitch?: number;
  /** Roll angle in radians around the forward axis */
  roll?: number;
  /** Common preset views like front/top/isometric */
  view?: CameraViewPreset;
  /** Distance from target for orbit/view/third-person cameras */
  distance?: number;
  /** Orbit angle in radians around the Z axis */
  azimuth?: number;
  /** Orbit elevation in radians above the ground plane */
  elevation?: number;
  /** Field of view in radians (default: Math.PI / 3 = 60deg) */
  fov?: number;
  /** Near clipping plane distance (default: 0.01) */
  near?: number;
  /** Far clipping plane distance (default: 1000) */
  far?: number;
  /** Orthographic zoom size (default: 5) */
  size?: number;
}

/** Explicit look-at camera, using perspective projection unless overridden */
export interface PerspectiveCameraProps extends Omit<CameraProps, 'projection'> {
  projection?: 'perspective';
}

/** Explicit look-at camera with orthographic projection */
export interface OrthographicCameraProps extends Omit<CameraProps, 'projection'> {
  projection?: 'orthographic';
}

/** Camera that orbits around a target using azimuth/elevation/distance */
export interface OrbitCameraProps extends Omit<
  CameraProps,
  'kind' | 'position' | 'lookAt' | 'direction' | 'yaw' | 'pitch' | 'view'
> {}

/** First-person camera using position plus direction or yaw/pitch */
export interface FirstPersonCameraProps extends Omit<
  CameraProps,
  'kind' | 'lookAt' | 'target' | 'distance' | 'azimuth' | 'elevation' | 'view'
> {}

/** Third-person follow camera using orbit semantics around a target */
export interface ThirdPersonCameraProps extends OrbitCameraProps {}

/** Camera using one of the built-in view presets */
export interface ViewCameraProps extends Omit<
  CameraProps,
  'kind' | 'position' | 'direction' | 'yaw' | 'pitch'
> {
  view: CameraViewPreset;
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
