import React from 'react';
import type { TerrainLayerProps } from './types';

export function TerrainLayer({ elevation, imagery, heightScale, resolution }: TerrainLayerProps) {
  return React.createElement('GeoTerrainLayer', {
    elevation,
    imagery,
    heightScale,
    resolution,
  });
}
