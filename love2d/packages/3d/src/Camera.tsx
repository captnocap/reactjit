import React from 'react';
import { normalizeCameraProps } from './cameraUtils';
import type {
  CameraProps,
  FirstPersonCameraProps,
  OrbitCameraProps,
  OrthographicCameraProps,
  PerspectiveCameraProps,
  ThirdPersonCameraProps,
  ViewCameraProps,
} from './types';

type PresetCameraProps = Omit<ViewCameraProps, 'view'>;

function renderCamera(props: CameraProps) {
  return React.createElement('Camera3D', normalizeCameraProps(props));
}

export function Camera(props: CameraProps) {
  return renderCamera(props);
}

export function PerspectiveCamera(props: PerspectiveCameraProps) {
  return renderCamera({
    ...props,
    projection: 'perspective',
  });
}

export function OrthographicCamera(props: OrthographicCameraProps) {
  return renderCamera({
    ...props,
    projection: 'orthographic',
  });
}

export function OrbitCamera(props: OrbitCameraProps) {
  return renderCamera({
    ...props,
    kind: 'orbit',
  });
}

export function FirstPersonCamera(props: FirstPersonCameraProps) {
  return renderCamera({
    ...props,
    kind: 'firstPerson',
  });
}

export function ThirdPersonCamera(props: ThirdPersonCameraProps) {
  return renderCamera({
    ...props,
    kind: 'thirdPerson',
  });
}

export function ViewCamera(props: ViewCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
  });
}

export function FrontCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'front',
  });
}

export function BackCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'back',
  });
}

export function LeftCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'left',
  });
}

export function RightCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'right',
  });
}

export function TopCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'top',
  });
}

export function BottomCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'bottom',
  });
}

export function IsometricCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'isometric',
  });
}

export function DimetricCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'dimetric',
  });
}

export function TrimetricCamera(props: PresetCameraProps) {
  return renderCamera({
    ...props,
    kind: 'view',
    view: 'trimetric',
  });
}
