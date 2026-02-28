import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { MapProps } from './types';

/**
 * <Map> — an interactive map viewport that participates in the 2D layout.
 *
 * In native mode: creates a 'Map2D' host element. The Lua-side map.lua
 * renders tiles to an off-screen Canvas and handles pan/zoom/tilt interaction
 * with zero latency.
 *
 * In web mode: renders a placeholder div (web map support is future work —
 * will integrate with Leaflet or MapLibre GL).
 *
 * Children should be map elements: <TileLayer>, <Marker>, <Polyline>, etc.
 */
export function Map({
  center,
  zoom,
  bearing,
  pitch,
  minZoom,
  maxZoom,
  projection,
  style,
  markers,
  polylines,
  onViewChange,
  onClick,
  onLongPress,
  children,
}: MapProps & {
  markers?: Array<{ lat?: number; lng?: number;[key: number]: number; anchor?: string; draggable?: boolean }>;
  polylines?: Array<{ positions: [number, number][]; color?: string; width?: number; dashArray?: number[]; animated?: boolean; arrowheads?: boolean }>;
}) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return React.createElement(
      'div',
      {
        style: {
          background: '#e8e4d8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c7086',
          fontSize: 14,
          position: 'relative',
          ...(style as any),
        },
      },
      'Map viewport (Love2D only)',
    );
  }

  return React.createElement(
    'Map2D',
    {
      style,
      center,
      zoom,
      bearing,
      pitch,
      minZoom,
      projection,
      markers,
      polylines,
      onViewChange,
      onClick,
      onLongPress,
    },
    children,
  );
}
