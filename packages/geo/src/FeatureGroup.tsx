import React from 'react';
import type { FeatureGroupProps } from './types';

export function FeatureGroup({ pathOptions, children }: FeatureGroupProps) {
  return React.createElement('MapFeatureGroup', { pathOptions }, children);
}
