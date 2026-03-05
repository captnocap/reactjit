import React from 'react';
import type { TileLayerProps } from './types';

export function TileLayer({
  url,
  attribution,
  maxZoom,
  minZoom,
  opacity,
  tileSize,
  zIndex,
  subdomains,
  headers,
}: TileLayerProps) {
  return React.createElement('MapTileLayer', {
    url,
    attribution,
    maxZoom,
    minZoom,
    opacity,
    tileSize,
    zIndex,
    subdomains,
    headers,
  });
}
