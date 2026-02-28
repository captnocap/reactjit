import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { TileLayerProps } from './types';

/**
 * <TileLayer> — declares a tile source for the parent <Map>.
 *
 * Supports built-in aliases ("osm") or custom URL templates with {z}/{x}/{y}.
 * In native mode, this creates a MapTileLayer node in the tree — map.lua
 * reads its props to configure tile fetching and rendering.
 */
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
  const mode = useRendererMode();

  if (mode === 'web') {
    return null; // Web mode: handled by web map library
  }

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
