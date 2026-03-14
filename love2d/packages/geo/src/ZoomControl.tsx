import React from 'react';
import type { ZoomControlProps } from './types';

export function ZoomControl({ position, zoomInText, zoomOutText }: ZoomControlProps) {
  return React.createElement('MapZoomControl', {
    position: position ?? 'topleft',
    zoomInText: zoomInText ?? '+',
    zoomOutText: zoomOutText ?? '-',
  });
}
