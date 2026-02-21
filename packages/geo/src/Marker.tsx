import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { MarkerProps } from './types';

/**
 * <Marker> — a positioned overlay on the map at a lat/lng coordinate.
 *
 * Children become the marker visual. If no children are provided,
 * a default red circle marker is rendered by Lua.
 */
export function Marker({
  position,
  anchor,
  draggable,
  onDragEnd,
  onClick,
  children,
}: MarkerProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return null;
  }

  return React.createElement(
    'MapMarker',
    {
      position,
      anchor: anchor || 'bottom-center',
      draggable: draggable || false,
      onDragEnd,
      onClick,
    },
    children,
  );
}
