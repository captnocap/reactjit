import React from 'react';
import type { DirectionalLightProps } from './types';

export function DirectionalLight(props: DirectionalLightProps) {
  return React.createElement('DirectionalLight3D', {
    direction: props.direction,
    color: props.color,
    intensity: props.intensity,
  });
}
