import React from 'react';
import type { PolylineProps } from './types';

const normalizePositions = (positions: any): any => {
  if (!positions || !Array.isArray(positions)) return [];
  if (positions.length === 0) return [];
  const first = positions[0];
  if (Array.isArray(first) && typeof first[0] === 'number') {
    return positions.map((p: any) =>
      Array.isArray(p) ? p : [p.lat, p.lng]
    );
  }
  return positions.map(normalizePositions);
};

export function Polyline({
  positions,
  pathOptions,
  eventHandlers,
  children,
}: PolylineProps) {
  return React.createElement(
    'MapPolyline',
    {
      positions: normalizePositions(positions),
      color: pathOptions?.color ?? '#3388ff',
      weight: pathOptions?.weight ?? 3,
      opacity: pathOptions?.opacity ?? 1,
      dashArray: pathOptions?.dashArray,
      stroke: pathOptions?.stroke !== false,
      onClick: eventHandlers?.click,
    },
    children,
  );
}
