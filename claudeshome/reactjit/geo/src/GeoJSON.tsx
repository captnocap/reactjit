import React from 'react';
import { useRendererMode } from '@reactjit/core';
import type { GeoJSONProps } from './types';

/**
 * <GeoJSON> — renders GeoJSON features on the map.
 *
 * Accepts a GeoJSON FeatureCollection or Feature. Each feature is rendered
 * according to its geometry type (Point → marker, LineString → polyline,
 * Polygon → polygon). An optional style function customizes appearance
 * per feature, including 3D extrusion for building footprints.
 */
export function GeoJSON({ data, style, onFeatureClick }: GeoJSONProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return null;
  }

  return React.createElement('MapGeoJSON', {
    data,
    style,
    onFeatureClick,
  });
}
