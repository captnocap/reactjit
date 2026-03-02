import React from 'react';
import type { CameraProps } from './types';

export function Camera(props: CameraProps) {
  return React.createElement('Camera3D', {
    position: props.position,
    lookAt: props.lookAt,
    fov: props.fov,
    near: props.near,
    far: props.far,
  });
}
