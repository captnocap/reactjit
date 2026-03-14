import React from 'react';
import { Box } from '@reactjit/core';
import type { Style, Color } from '@reactjit/core';

export interface IconProps {
  /** Polyline path data from a named icon export */
  icon: number[][];
  /** Pixel size — width and height (default 24) */
  size?: number;
  /** Stroke color (defaults to inherited text color) */
  color?: Color;
  /** Line thickness before scaling (default 2) */
  strokeWidth?: number;
  /** Container style overrides */
  style?: Style;
}

export function Icon({ icon, size = 24, color, strokeWidth = 2, style }: IconProps) {
  return (
    <Box style={{
      width: size,
      height: size,
      strokePaths: icon,
      strokeWidth,
      strokeColor: color,
      ...style,
    }} />
  );
}
