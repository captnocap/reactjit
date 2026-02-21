import React from 'react';
import { Box } from '@reactjit/core';

export interface HealthBarProps {
  hp: number;
  maxHp: number;
  width?: number;
  height?: number;
  /** Show HP text overlay */
  showText?: boolean;
}

function getHealthColor(pct: number): string {
  if (pct > 0.6) return '#22c55e';   // green
  if (pct > 0.3) return '#eab308';   // yellow
  return '#ef4444';                    // red
}

export function HealthBar({
  hp,
  maxHp,
  width = 80,
  height = 6,
  showText = false,
}: HealthBarProps) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const color = getHealthColor(pct);

  return React.createElement(
    Box,
    {
      style: {
        width,
        height: showText ? height + 12 : height,
      },
    },
    // Bar track
    React.createElement(
      Box,
      {
        style: {
          width,
          height,
          backgroundColor: '#1e1e2e',
          borderRadius: 2,
          overflow: 'hidden',
        },
      },
      React.createElement(Box, {
        style: {
          width: pct * width,
          height,
          backgroundColor: color,
          borderRadius: 2,
        },
      }),
    ),
  );
}
