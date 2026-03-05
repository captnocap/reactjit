import React from 'react';
import type { MarkerProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return [0, 0];
};

export function Marker({
  position,
  icon,
  draggable,
  opacity,
  zIndexOffset,
  eventHandlers,
  children,
}: MarkerProps) {
  return React.createElement(
    'MapMarker',
    {
      position: normalizeLatLng(position),
      icon,
      draggable: draggable || false,
      opacity: opacity ?? 1,
      zIndexOffset,
      onClick: eventHandlers?.click,
      onDragEnd: eventHandlers?.dragend,
      onContextMenu: eventHandlers?.contextmenu,
    },
    children,
  );
}
