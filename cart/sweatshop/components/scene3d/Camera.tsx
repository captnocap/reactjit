// =============================================================================
// Camera — viewpoint for the active Scene3D
// =============================================================================
// Scene3D is expected to own exactly one camera; mounting <Camera /> inside a
// Scene3D replaces the default. Prop changes (position/target/fov/etc.) push
// to the registry immediately so the mockup renderer picks them up on the
// next repaint. Port of love2d/storybook/reactjit/3d/src/Camera.tsx,
// extended with kind ('perspective' | 'ortho') + orthoSize per the
// supervisor's brief.
// =============================================================================

const React: any = require('react');
const { useEffect } = React;

import type { CameraProps } from './types';
import { DEFAULT_CAMERA, useScene3D } from './useScene3D';

export function Camera(props: CameraProps) {
  const scene = useScene3D();

  useEffect(() => {
    if (!scene) return;
    scene.camera.set({
      id: 0,
      kind:      props.kind      ?? DEFAULT_CAMERA.kind,
      position:  props.position  ?? DEFAULT_CAMERA.position,
      target:    props.target    ?? DEFAULT_CAMERA.target,
      fov:       props.fov       ?? DEFAULT_CAMERA.fov,
      near:      props.near      ?? DEFAULT_CAMERA.near,
      far:       props.far       ?? DEFAULT_CAMERA.far,
      orthoSize: props.orthoSize ?? DEFAULT_CAMERA.orthoSize,
    });
  }, [
    scene,
    props.kind,
    props.position && props.position[0], props.position && props.position[1], props.position && props.position[2],
    props.target   && props.target[0],   props.target   && props.target[1],   props.target   && props.target[2],
    props.fov, props.near, props.far, props.orthoSize,
  ]);

  // No DOM — Camera is a pure registry entry. Scene3D paints from the data.
  return null;
}
