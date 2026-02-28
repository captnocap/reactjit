import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { CameraProps } from './types';

/**
 * <Camera> — defines the viewpoint for a <Scene>.
 *
 * Place exactly one Camera inside a Scene. If omitted, a default camera
 * at position [0, -3, 2] looking at the origin is used.
 *
 * Props are reactive: changing position/lookAt/fov updates the camera each frame.
 */
export function Camera(props: CameraProps) {
  const mode = useRendererMode();
  if (mode === 'web') return null;

  return React.createElement('Camera3D', {
    position: props.position,
    lookAt: props.lookAt,
    fov: props.fov,
    near: props.near,
    far: props.far,
  });
}
