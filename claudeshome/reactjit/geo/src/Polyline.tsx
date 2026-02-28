import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { PolylineProps } from './types';

/**
 * <Polyline> — a line path through lat/lng coordinates on the map.
 *
 * Supports colored lines, dashing, animated flow, and direction arrowheads.
 * In 3D mode (pitch > 0), polylines render as thin ribbons on the ground plane.
 */
export function Polyline({
  positions,
  color,
  width,
  dashArray,
  animated,
  arrowheads,
}: PolylineProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return null;
  }

  return React.createElement('MapPolyline', {
    positions,
    color: color || '#3498db',
    width: width || 2,
    dashArray,
    animated: animated || false,
    arrowheads: arrowheads || false,
  });
}
