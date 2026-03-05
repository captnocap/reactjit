import React from 'react';
import type { ImageOverlayProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return [0, 0];
};

const normalizeBounds = (b: any) => {
  if (Array.isArray(b)) return [normalizeLatLng(b[0]), normalizeLatLng(b[1])];
  if (b.southWest) return [normalizeLatLng(b.southWest), normalizeLatLng(b.northEast)];
  return [[0, 0], [0, 0]];
};

export function ImageOverlay({
  url,
  bounds,
  opacity,
  zIndex,
}: ImageOverlayProps) {
  return React.createElement('MapImageOverlay', {
    url,
    bounds: normalizeBounds(bounds),
    opacity: opacity ?? 1,
    zIndex,
  });
}
