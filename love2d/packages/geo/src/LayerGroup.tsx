import React from 'react';
import type { LayerGroupProps } from './types';

export function LayerGroup({ children }: LayerGroupProps) {
  return React.createElement('MapLayerGroup', null, children);
}
