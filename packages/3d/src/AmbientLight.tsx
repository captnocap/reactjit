import React from 'react';
import type { AmbientLightProps } from './types';

export function AmbientLight(props: AmbientLightProps) {
  return React.createElement('AmbientLight3D', {
    color: props.color,
    intensity: props.intensity,
  });
}
