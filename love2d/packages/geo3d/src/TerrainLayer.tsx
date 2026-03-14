import React from 'react';
import type { TerrainLayerProps } from './types';

export function TerrainLayer({ elevation, format, imagery, heightScale, resolution }: TerrainLayerProps) {
  return React.createElement('GeoTerrainLayer', {
    elevation,
    format,
    imagery,
    heightScale,
    resolution,
  });
}
