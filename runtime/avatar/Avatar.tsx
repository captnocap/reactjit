// Avatar — visual primitive that wraps the existing <Scene3D> tree.
//
// Take an `AvatarData` (parts + ownership), drop in a sensible camera +
// lights, and emit one <Scene3D.Mesh> per part. The whole point is that
// every consumer of the avatar (chat bust portrait, character creator
// preview, /avatar wardrobe, scene composition) speaks the same
// component shape — the visual ecosystem stays decoupled from the
// Character/Voice ecosystem.
//
// Pose / emote / outfit / wardrobe systems are deferred. The component
// takes a `pose` prop today as a stub for the future shape; the only
// recognized value is 'idle' (the static parts list as authored).
//
// Defaults are tuned for the v1 "chunky little RuneScape mannequin"
// proportions exercised by `cart/scene3d_lab`. Override via props once
// non-default avatars surface.

import { Scene3D } from '../primitives';
import type { AvatarData, AvatarPart, Vec3 } from './types';

const DEFAULT_CAMERA_POSITION: Vec3 = [0, 1.2, 5];
const DEFAULT_CAMERA_TARGET: Vec3 = [0, 0.4, 0];
const DEFAULT_CAMERA_FOV = 50;

const DEFAULT_AMBIENT_COLOR = '#ffffff';
const DEFAULT_AMBIENT_INTENSITY = 0.4;
const DEFAULT_DIRECTIONAL_DIRECTION: Vec3 = [0.5, 0.9, 0.6];
const DEFAULT_DIRECTIONAL_COLOR = '#ffffff';
const DEFAULT_DIRECTIONAL_INTENSITY = 0.85;

const DEFAULT_BACKGROUND = '#0a0e18';

export type AvatarPose = 'idle';

export interface AvatarProps {
  /** Authoritative parts + ownership. */
  avatar: AvatarData;

  /**
   * Pose state. v1: 'idle' only — the parts render in the positions
   * authored on the data row, no per-tick transform deltas. The pose
   * vocabulary grows as the rig system lands.
   */
  pose?: AvatarPose;

  /** Camera overrides. Defaults match the v1 mannequin proportions. */
  cameraPosition?: Vec3;
  cameraTarget?: Vec3;
  cameraFov?: number;

  /** Light overrides. */
  ambientColor?: string;
  ambientIntensity?: number;
  directionalDirection?: Vec3;
  directionalColor?: string;
  directionalIntensity?: number;

  /** Scene clear color. */
  backgroundColor?: string;

  /**
   * Outer container style. The avatar fills the container; size it
   * via width/height in this style object.
   */
  style?: Record<string, any>;

  /**
   * Extra Scene3D children rendered inside the same Scene3D as the
   * avatar parts (e.g. <BlockFace3D> attaching block-pixel cubes
   * to the head sphere).
   */
  children?: any;
}

function renderPart(part: AvatarPart): any {
  if (part.visible === false) return null;
  return (
    <Scene3D.Mesh
      key={part.id}
      geometry={part.geometry}
      material={part.color}
      position={part.position}
      rotation={part.rotation}
      scale={part.scale}
      radius={part.radius}
      tubeRadius={part.tubeRadius}
      sizeX={part.size?.[0]}
      sizeY={part.size?.[1]}
      sizeZ={part.size?.[2]}
    />
  );
}

export function Avatar(props: AvatarProps): any {
  const {
    avatar,
    cameraPosition = DEFAULT_CAMERA_POSITION,
    cameraTarget = DEFAULT_CAMERA_TARGET,
    cameraFov = DEFAULT_CAMERA_FOV,
    ambientColor = DEFAULT_AMBIENT_COLOR,
    ambientIntensity = DEFAULT_AMBIENT_INTENSITY,
    directionalDirection = DEFAULT_DIRECTIONAL_DIRECTION,
    directionalColor = DEFAULT_DIRECTIONAL_COLOR,
    directionalIntensity = DEFAULT_DIRECTIONAL_INTENSITY,
    backgroundColor = DEFAULT_BACKGROUND,
    style,
    children,
  } = props;

  return (
    <Scene3D style={{ ...(style ?? { width: '100%', height: '100%' }), backgroundColor }}>
      <Scene3D.Camera position={cameraPosition} target={cameraTarget} fov={cameraFov} />
      <Scene3D.AmbientLight color={ambientColor} intensity={ambientIntensity} />
      <Scene3D.DirectionalLight
        direction={directionalDirection}
        color={directionalColor}
        intensity={directionalIntensity}
      />
      {avatar.parts.map(renderPart)}
      {children}
    </Scene3D>
  );
}
