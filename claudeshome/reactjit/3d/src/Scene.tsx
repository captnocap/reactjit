import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { SceneProps } from './types';

/**
 * <Scene> — a 3D viewport that participates in the 2D layout.
 *
 * In native mode: creates a 'Scene3D' host element. The Lua-side scene3d.lua
 * renders the 3D scene to an off-screen Canvas, and the painter composites it
 * at this node's computed position.
 *
 * In web mode: renders a placeholder div (web 3D support is future work).
 *
 * Children should be 3D elements: <Camera>, <Mesh>, etc.
 */
export function Scene({ style, backgroundColor, stars, orbitControls, children }: SceneProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return React.createElement(
      'div',
      {
        style: {
          background: backgroundColor || '#12121b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c7086',
          fontSize: 14,
          ...(style as any),
        },
      },
      '3D viewport (Love2D only)',
    );
  }

  return React.createElement('Scene3D', {
    style,
    backgroundColor,
    stars,
    orbitControls,
  }, children);
}
