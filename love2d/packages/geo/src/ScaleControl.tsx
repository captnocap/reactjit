import React from 'react';
import type { ScaleControlProps } from './types';

export function ScaleControl({ position, maxWidth, metric, imperial }: ScaleControlProps) {
  return React.createElement('MapScaleControl', {
    position: position ?? 'bottomleft',
    maxWidth: maxWidth ?? 100,
    metric: metric !== false,
    imperial: imperial || false,
  });
}
