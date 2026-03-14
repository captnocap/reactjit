import React from 'react';
import type { PolygonProps } from './types';

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

export function Polygon({
  positions,
  pathOptions,
  eventHandlers,
  children,
}: PolygonProps) {
  return React.createElement(
    'MapPolygon',
    {
      positions: normalizePositions(positions),
      color: pathOptions?.color ?? '#3388ff',
      weight: pathOptions?.weight ?? 3,
      opacity: pathOptions?.opacity ?? 1,
      fillColor: pathOptions?.fillColor ?? pathOptions?.color ?? '#3388ff',
      fillOpacity: pathOptions?.fillOpacity ?? 0.2,
      dashArray: pathOptions?.dashArray,
      fill: pathOptions?.fill !== false,
      stroke: pathOptions?.stroke !== false,
      onClick: eventHandlers?.click,
    },
    children,
  );
}
