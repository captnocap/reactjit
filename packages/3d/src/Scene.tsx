import React from 'react';
import type { SceneProps } from './types';

export function Scene({ style, backgroundColor, stars, orbitControls, children }: SceneProps) {
  return React.createElement('Scene3D', {
    style,
    backgroundColor,
    stars,
    orbitControls,
  }, children);
}
