import React from 'react';
import type { GeoMarker3DProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (Array.isArray(ll)) return ll;
  if (ll && ll.lat !== undefined) return [ll.lat, ll.lng];
  return ll;
};

export function GeoMarker3D({ position, geometry, color, scale, altitude }: GeoMarker3DProps) {
  return React.createElement('GeoMarker3D', {
    position: normalizeLatLng(position),
    geometry,
    color,
    scale,
    altitude,
  });
}
