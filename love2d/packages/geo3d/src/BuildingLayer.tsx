import React from 'react';
import type { BuildingLayerProps } from './types';

export function BuildingLayer({ data, defaultHeight, color }: BuildingLayerProps) {
  return React.createElement('GeoBuildingLayer', {
    data,
    defaultHeight,
    color,
  });
}
