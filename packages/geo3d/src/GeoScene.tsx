import React from 'react';
import type { GeoSceneProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (!ll) return undefined;
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return undefined;
};

export function GeoScene({ center, zoom, cameraMode, style, children }: GeoSceneProps) {
  return React.createElement(
    'GeoScene3D',
    {
      style,
      center: normalizeLatLng(center),
      zoom,
      cameraMode: cameraMode || 'orbit',
    },
    children,
  );
}
