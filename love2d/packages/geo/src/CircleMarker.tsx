import React from 'react';
import type { CircleMarkerProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return [0, 0];
};

export function CircleMarker({
  center,
  radius,
  pathOptions,
  eventHandlers,
  children,
}: CircleMarkerProps) {
  return React.createElement(
    'MapCircleMarker',
    {
      center: normalizeLatLng(center),
      radius: radius ?? 10,
      color: pathOptions?.color ?? '#3388ff',
      weight: pathOptions?.weight ?? 3,
      opacity: pathOptions?.opacity ?? 1,
      fillColor: pathOptions?.fillColor ?? pathOptions?.color ?? '#3388ff',
      fillOpacity: pathOptions?.fillOpacity ?? 0.2,
      fill: pathOptions?.fill !== false,
      stroke: pathOptions?.stroke !== false,
      onClick: eventHandlers?.click,
    },
    children,
  );
}
