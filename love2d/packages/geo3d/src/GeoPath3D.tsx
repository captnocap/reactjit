import React from 'react';
import type { GeoPath3DProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (Array.isArray(ll)) return ll;
  if (ll && ll.lat !== undefined) return [ll.lat, ll.lng];
  return ll;
};

export function GeoPath3D({ positions, width, color }: GeoPath3DProps) {
  return React.createElement('GeoPath3D', {
    positions: positions.map(normalizeLatLng),
    width,
    color,
  });
}
