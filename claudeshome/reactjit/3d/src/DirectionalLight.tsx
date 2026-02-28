import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { DirectionalLightProps } from './types';

/**
 * <DirectionalLight> — a directional (sun-like) light source.
 *
 * Place inside a <Scene>. Direction points TOWARD the light source.
 * Only one directional light per scene is currently supported.
 */
export function DirectionalLight(props: DirectionalLightProps) {
  const mode = useRendererMode();
  if (mode === 'web') return null;

  return React.createElement('DirectionalLight3D', {
    direction: props.direction,
    color: props.color,
    intensity: props.intensity,
  });
}
