import React from 'react';
import { Box } from '@reactjit/core';

export interface StatusBarProps {
  value: number;
  max: number;
  width?: number;
  height?: number;
  fillColor?: string;
  trackColor?: string;
  borderColor?: string;
}

export function StatusBar({
  value,
  max,
  width = 100,
  height = 8,
  fillColor = '#22c55e',
  trackColor = '#1e293b',
  borderColor = '#334155',
}: StatusBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return React.createElement(
    Box,
    {
      style: {
        width,
        height,
        backgroundColor: trackColor,
        borderWidth: 1,
        borderColor,
        borderRadius: 2,
        overflow: 'hidden',
      },
    },
    React.createElement(Box, {
      style: {
        width: pct * (width - 2),
        height: height - 2,
        backgroundColor: fillColor,
        borderRadius: 1,
      },
    }),
  );
}
