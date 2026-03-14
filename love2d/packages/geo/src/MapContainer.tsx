import React from 'react';
import type { MapContainerProps } from './types';

const normalizeLatLng = (ll: any) => {
  if (!ll) return undefined;
  if (Array.isArray(ll)) return ll;
  if (ll.lat !== undefined) return [ll.lat, ll.lng];
  return undefined;
};

const normalizeBounds = (b: any) => {
  if (!b) return undefined;
  if (Array.isArray(b)) return [normalizeLatLng(b[0]), normalizeLatLng(b[1])];
  if (b.southWest) return [normalizeLatLng(b.southWest), normalizeLatLng(b.northEast)];
  return undefined;
};

export function MapContainer({
  center,
  zoom,
  bearing,
  pitch,
  minZoom,
  maxZoom,
  maxBounds,
  scrollWheelZoom,
  dragging,
  zoomControl,
  doubleClickZoom,
  attributionControl,
  projection,
  style,
  whenReady,
  children,
}: MapContainerProps) {
  return React.createElement(
    'Map2D',
    {
      style,
      center: normalizeLatLng(center),
      zoom,
      bearing,
      pitch,
      minZoom,
      maxZoom,
      maxBounds: normalizeBounds(maxBounds),
      scrollWheelZoom: scrollWheelZoom !== false,
      dragging: dragging !== false,
      zoomControl: zoomControl !== false,
      doubleClickZoom: doubleClickZoom !== false,
      attributionControl: attributionControl !== false,
      projection,
      onReady: whenReady,
    },
    children,
  );
}
