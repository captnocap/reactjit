import React from 'react';
import type { PolylineProps } from './types';

export function Polyline({
  positions,
  color,
  width,
  dashArray,
  animated,
  arrowheads,
}: PolylineProps) {
  return React.createElement('MapPolyline', {
    positions,
    color: color || '#3498db',
    width: width || 2,
    dashArray,
    animated: animated || false,
    arrowheads: arrowheads || false,
  });
}
