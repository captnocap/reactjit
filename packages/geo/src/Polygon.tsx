import React from 'react';
import type { PolygonProps } from './types';

export function Polygon({
  positions,
  fillColor,
  strokeColor,
  strokeWidth,
  extrude,
}: PolygonProps) {
  return React.createElement('MapPolygon', {
    positions,
    fillColor: fillColor || '#3498db40',
    strokeColor: strokeColor || '#3498db',
    strokeWidth: strokeWidth || 2,
    extrude: extrude || 0,
  });
}
