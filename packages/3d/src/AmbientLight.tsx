import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { AmbientLightProps } from './types';

/**
 * <AmbientLight> — uniform ambient illumination.
 *
 * Place inside a <Scene>. Provides a base light level so shadowed
 * areas aren't pure black. Only one ambient light per scene is supported.
 */
export function AmbientLight(props: AmbientLightProps) {
  const mode = useRendererMode();
  if (mode === 'web') return null;

  return React.createElement('AmbientLight3D', {
    color: props.color,
    intensity: props.intensity,
  });
}
