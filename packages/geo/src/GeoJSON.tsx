import React from 'react';
import type { GeoJSONProps } from './types';

export function GeoJSON({ data, style, onFeatureClick }: GeoJSONProps) {
  return React.createElement('MapGeoJSON', {
    data,
    style,
    onFeatureClick,
  });
}
