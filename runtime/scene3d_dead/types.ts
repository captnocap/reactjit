// =============================================================================
// Scene3D types — shared type surface for the 3D scene package
// =============================================================================
// Ported from love2d/storybook/reactjit/3d/src/types.ts, extended for a
// standalone React scene graph that lives at runtime/scene3d/.
// The host does NOT yet have a wgpu/Scene3D primitive registered, so the
// actual renderer lives in runtime/scene3d/Scene3D.tsx and paints a 2D
// Canvas.Node mockup. The scene graph shape is preserved so children
// (Mesh/Camera/lights) plug in unchanged once wgpu lands.
// =============================================================================

/** 3D vector as [x, y, z] */
export type Vec3 = [number, number, number];

/** Built-in procedural geometry kinds */
export type GeometryKind = 'box' | 'sphere' | 'plane' | 'torus';

/** Camera projection types */
export type CameraKind = 'perspective' | 'ortho';

// ── Geometry descriptors ────────────────────────────────────────────────────

export interface BoxGeometry     { kind: 'box';     width: number; height: number; depth: number; }
export interface SphereGeometry  { kind: 'sphere';  radius: number; widthSegments: number; heightSegments: number; }
export interface PlaneGeometry   { kind: 'plane';   width: number; height: number; }
export interface TorusGeometry   { kind: 'torus';   radius: number; tube: number; radialSegments: number; tubularSegments: number; }
export type GeometryDescriptor = BoxGeometry | SphereGeometry | PlaneGeometry | TorusGeometry;

// ── Material descriptor ─────────────────────────────────────────────────────

export interface StandardMaterial {
  kind: 'standard';
  color: string;       // hex
  roughness: number;   // 0 = mirror, 1 = matte
  metalness: number;   // 0 = dielectric, 1 = metallic
  emissive: string;    // hex — self-lit tint; '#000000' = none
  opacity: number;     // 0..1
}

// ── Scene-graph node shapes ─────────────────────────────────────────────────

export interface MeshNode {
  id: number;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  geometry: GeometryDescriptor;
  material: StandardMaterial;
  wireframe: boolean;
  visible: boolean;
}

export interface CameraNode {
  id: number;
  kind: CameraKind;
  position: Vec3;
  target: Vec3;
  fov: number;      // radians
  near: number;
  far: number;
  // ortho-only extra:
  orthoSize: number;
}

export interface AmbientLightNode   { id: number; kind: 'ambient';     color: string; intensity: number; }
export interface DirectionalLightNode { id: number; kind: 'directional'; direction: Vec3; color: string; intensity: number; }
export interface PointLightNode     { id: number; kind: 'point';       position: Vec3; color: string; intensity: number; range: number; }

export type LightNode = AmbientLightNode | DirectionalLightNode | PointLightNode;

// ── Component prop shapes ──────────────────────────────────────────────────

export interface Scene3DProps {
  style?: Record<string, any>;
  backgroundColor?: string;
  orbit?: boolean;               // enable OrbitControls by default
  wireframeAll?: boolean;        // global wireframe override
  children?: any;
}

export interface CameraProps {
  kind?: CameraKind;
  position?: Vec3;
  target?: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  orthoSize?: number;
}

export interface MeshProps {
  geometry?: GeometryDescriptor | GeometryKind;
  material?: Partial<StandardMaterial> | string;    // string = color shortcut
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  wireframe?: boolean;
  visible?: boolean;
}

export interface AmbientLightProps     { color?: string; intensity?: number }
export interface DirectionalLightProps  { direction?: Vec3; color?: string; intensity?: number }
export interface PointLightProps        { position?: Vec3; color?: string; intensity?: number; range?: number }

export interface OrbitControlsProps {
  enabled?: boolean;
  minDistance?: number;
  maxDistance?: number;
  dampening?: number;
}
