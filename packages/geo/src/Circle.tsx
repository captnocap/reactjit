import React from 'react';
import type { CircleProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return [0, 0];
};

export function Circle({
  center,
  radius,
  pathOptions,
  eventHandlers,
  children,
}: CircleProps) {
  return React.createElement(
    'MapCircle',
    {
      center: normalizeLatLng(center),
      radius,
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
