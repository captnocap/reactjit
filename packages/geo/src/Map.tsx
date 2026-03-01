import React from 'react';
import type { MapProps } from './types';

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
