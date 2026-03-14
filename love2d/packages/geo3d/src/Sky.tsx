import React from 'react';
import type { SkyProps } from './types';

export function Sky({ fog, fogColor, backgroundColor }: SkyProps) {
  return React.createElement('GeoSky3D', {
    fog,
    fogColor,
    backgroundColor,
  });
}
