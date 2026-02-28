import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { PolygonProps } from './types';

/**
 * <Polygon> — a filled area from lat/lng coordinates on the map.
 *
 * In 3D mode (pitch > 0) with extrude > 0, the polygon is extruded
 * into a 3D building shape.
 */
export function Polygon({
  positions,
  fillColor,
  strokeColor,
  strokeWidth,
  extrude,
}: PolygonProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return null;
  }

  return React.createElement('MapPolygon', {
    positions,
    fillColor: fillColor || '#3498db40',
    strokeColor: strokeColor || '#3498db',
    strokeWidth: strokeWidth || 2,
    extrude: extrude || 0,
  });
}
