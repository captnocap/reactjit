import React from 'react';
import type { TileLayerProps } from './types';

export function TileLayer({
  source,
  urlTemplate,
  type,
  minZoom,
  maxZoom,
  tileSize,
  opacity,
  attribution,
  headers,
}: TileLayerProps) {
  return React.createElement('MapTileLayer', {
    source: source || 'osm',
    urlTemplate,
    type: type || 'raster',
    minZoom,
    maxZoom,
    tileSize,
    opacity,
    attribution,
    headers,
  });
}
