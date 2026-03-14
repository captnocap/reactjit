import type { CameraProjection, CameraProps, CameraViewPreset, Vec3 } from './types';

export interface NormalizedCameraProps {
  projection: CameraProjection;
  position: Vec3;
  lookAt: Vec3;
  up: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  size?: number;
}

const DEFAULT_POSITION: Vec3 = [0, -3, 2];
const DEFAULT_TARGET: Vec3 = [0, 0, 0];
const DEFAULT_UP: Vec3 = [0, 0, 1];
const DEFAULT_ORTHOGRAPHIC_SIZE = 5;
const DEFAULT_ORBIT_AZIMUTH = -Math.PI / 2;
const DEFAULT_ORBIT_ELEVATION = Math.atan2(2, 3);
const DEFAULT_ORBIT_DISTANCE = Math.sqrt(13);
const DEFAULT_FIRST_PERSON_YAW = Math.PI / 2;
const DEFAULT_FIRST_PERSON_PITCH = -DEFAULT_ORBIT_ELEVATION;
const DEFAULT_THIRD_PERSON_DISTANCE = 5.5;
const DEFAULT_THIRD_PERSON_ELEVATION = 0.35;

function copyVec(vec: Vec3): Vec3 {
  return [vec[0], vec[1], vec[2]];
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec(vec: Vec3, scalar: number): Vec3 {
  return [vec[0] * scalar, vec[1] * scalar, vec[2] * scalar];
}

function crossVec(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lengthVec(vec: Vec3): number {
  return Math.sqrt(dotVec(vec, vec));
}

function normalizeVec(vec: Vec3, fallback: Vec3): Vec3 {
  const length = lengthVec(vec);
  if (length < 1e-6) return copyVec(fallback);
  return [vec[0] / length, vec[1] / length, vec[2] / length];
}

function rotateAroundAxis(vec: Vec3, axis: Vec3, angle: number): Vec3 {
  if (!angle) return copyVec(vec);
  const unitAxis = normalizeVec(axis, [0, 0, 1]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cross = crossVec(unitAxis, vec);
  const dot = dotVec(unitAxis, vec);

  return [
    vec[0] * cos + cross[0] * sin + unitAxis[0] * dot * (1 - cos),
    vec[1] * cos + cross[1] * sin + unitAxis[1] * dot * (1 - cos),
    vec[2] * cos + cross[2] * sin + unitAxis[2] * dot * (1 - cos),
  ];
}

function directionFromAngles(yaw: number, pitch: number): Vec3 {
  const cosPitch = Math.cos(pitch);
  return [
    Math.cos(yaw) * cosPitch,
    Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
  ];
}

function orbitOffset(distance: number, azimuth: number, elevation: number): Vec3 {
  const radius = Math.max(distance, 1e-6);
  const planar = Math.cos(elevation) * radius;
  return [
    Math.cos(azimuth) * planar,
    Math.sin(azimuth) * planar,
    Math.sin(elevation) * radius,
  ];
}

function presetDirection(view: CameraViewPreset): Vec3 {
  switch (view) {
    case 'front':
      return [0, -1, 0];
    case 'back':
      return [0, 1, 0];
    case 'left':
      return [-1, 0, 0];
    case 'right':
      return [1, 0, 0];
    case 'top':
      return [0, 0, 1];
    case 'bottom':
      return [0, 0, -1];
    case 'isometric':
      return [1, -1, 1];
    case 'dimetric':
      return [1, -1, 0.7];
    case 'trimetric':
      return [1.2, -0.85, 0.6];
    default:
      return [0, -1, 0];
  }
}

function presetUp(view: CameraViewPreset): Vec3 {
  switch (view) {
    case 'top':
    case 'bottom':
      return [0, 1, 0];
    default:
      return DEFAULT_UP;
  }
}

function resolveUp(forward: Vec3, preferredUp: Vec3, roll: number | undefined): Vec3 {
  const normalizedForward = normalizeVec(forward, [0, 1, 0]);
  const unitPreferredUp = normalizeVec(preferredUp, DEFAULT_UP);

  if (!roll && Math.abs(dotVec(normalizedForward, unitPreferredUp)) < 0.999) {
    return unitPreferredUp;
  }

  let right = crossVec(preferredUp, normalizedForward);

  if (lengthVec(right) < 1e-6) {
    const fallback: Vec3 = Math.abs(normalizedForward[2]) > 0.95 ? [0, 1, 0] : DEFAULT_UP;
    right = crossVec(fallback, normalizedForward);
  }
  if (lengthVec(right) < 1e-6) {
    right = crossVec([1, 0, 0], normalizedForward);
  }

  const unitRight = normalizeVec(right, [1, 0, 0]);
  const unitUp = normalizeVec(crossVec(normalizedForward, unitRight), DEFAULT_UP);
  return normalizeVec(rotateAroundAxis(unitUp, normalizedForward, roll ?? 0), unitUp);
}

function resolveProjection(props: CameraProps): CameraProjection {
  return props.projection ?? 'perspective';
}

function resolveTarget(props: CameraProps): Vec3 {
  return copyVec(props.target ?? props.lookAt ?? DEFAULT_TARGET);
}

export function normalizeCameraProps(props: CameraProps = {}): NormalizedCameraProps {
  const projection = resolveProjection(props);
  const target = resolveTarget(props);
  const normalized: NormalizedCameraProps = {
    projection,
    position: copyVec(DEFAULT_POSITION),
    lookAt: copyVec(DEFAULT_TARGET),
    up: copyVec(DEFAULT_UP),
    fov: props.fov,
    near: props.near,
    far: props.far,
    size: projection === 'orthographic' ? (props.size ?? DEFAULT_ORTHOGRAPHIC_SIZE) : props.size,
  };

  if (props.view || props.kind === 'view') {
    const view = props.view ?? 'front';
    const position = addVec(
      target,
      scaleVec(normalizeVec(presetDirection(view), [0, -1, 0]), props.distance ?? DEFAULT_ORBIT_DISTANCE),
    );
    const forward = subtractVec(target, position);
    normalized.position = position;
    normalized.lookAt = target;
    normalized.up = resolveUp(forward, presetUp(view), props.roll);
    return normalized;
  }

  if (props.kind === 'orbit' || props.kind === 'thirdPerson') {
    const distance = props.distance ?? (props.kind === 'thirdPerson'
      ? DEFAULT_THIRD_PERSON_DISTANCE
      : DEFAULT_ORBIT_DISTANCE);
    const azimuth = props.azimuth ?? DEFAULT_ORBIT_AZIMUTH;
    const elevation = props.elevation ?? (props.kind === 'thirdPerson'
      ? DEFAULT_THIRD_PERSON_ELEVATION
      : DEFAULT_ORBIT_ELEVATION);
    const position = addVec(target, orbitOffset(distance, azimuth, elevation));
    const forward = subtractVec(target, position);
    normalized.position = position;
    normalized.lookAt = target;
    normalized.up = resolveUp(forward, props.up ?? DEFAULT_UP, props.roll);
    return normalized;
  }

  if (
    props.kind === 'firstPerson' ||
    props.direction !== undefined ||
    props.yaw !== undefined ||
    props.pitch !== undefined
  ) {
    const position = copyVec(props.position ?? DEFAULT_POSITION);
    const forward = normalizeVec(
      props.direction
        ? copyVec(props.direction)
        : directionFromAngles(
          props.yaw ?? DEFAULT_FIRST_PERSON_YAW,
          props.pitch ?? DEFAULT_FIRST_PERSON_PITCH,
        ),
      [0, 1, 0],
    );
    normalized.position = position;
    normalized.lookAt = addVec(position, forward);
    normalized.up = resolveUp(forward, props.up ?? DEFAULT_UP, props.roll);
    return normalized;
  }

  const position = copyVec(props.position ?? DEFAULT_POSITION);
  const lookAt = copyVec(props.lookAt ?? props.target ?? DEFAULT_TARGET);
  const forward = subtractVec(lookAt, position);

  normalized.position = position;
  normalized.lookAt = lookAt;
  normalized.up = resolveUp(forward, props.up ?? DEFAULT_UP, props.roll);
  return normalized;
}
