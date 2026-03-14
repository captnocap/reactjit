import React from 'react';
import type { GeoJSONProps } from './types';

export function GeoJSON({
  data,
  style,
  filter,
  onEachFeature,
  eventHandlers,
  children,
}: GeoJSONProps) {
  return React.createElement(
    'MapGeoJSON',
    {
      data,
      style,
      filter,
      onEachFeature,
      onClick: eventHandlers?.click,
    },
    children,
  );
}
