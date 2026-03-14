import React from 'react';
import type { AttributionControlProps } from './types';

export function AttributionControl({ position, prefix }: AttributionControlProps) {
  return React.createElement('MapAttributionControl', {
    position: position ?? 'bottomright',
    prefix,
  });
}
