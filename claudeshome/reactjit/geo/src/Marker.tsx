import React from 'react';
import type { MarkerProps } from './types';

export function Marker({
  position,
  anchor,
  draggable,
  onDragEnd,
  onClick,
  children,
}: MarkerProps) {
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
