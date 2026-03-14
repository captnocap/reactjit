import React from 'react';
import { Box, Text } from './primitives';
import type { Style, Color } from './types';

export interface ProgressBarProps {
  value: number;
  color?: Color;
  trackColor?: Color;
  height?: number;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  interactive?: boolean;
  style?: Style;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function ProgressBar({
  value,
  color = '#3b82f6',
  trackColor = '#1e293b',
  height = 8,
  showLabel = false,
  label,
  animated = false,
  interactive = false,
  style,
}: ProgressBarProps) {
  const clamped = clamp01(value);
  const fillWidth = clamped * 100;

  const pct = Math.round(clamped * 100);
  const labelText = label ?? `${pct}%`;
  const showText = showLabel && height >= 14;

  const tooltipContent = interactive
    ? (label ? `${label}\n${pct}%\n${clamped.toFixed(2)} / 1.00` : `${pct}%\n${clamped.toFixed(2)} / 1.00`)
    : undefined;

  return (
    <Box
      tooltip={tooltipContent ? { content: tooltipContent, type: 'anchor', anchor: 'top', layout: 'descriptive' } : undefined}
      style={{
        height,
        backgroundColor: trackColor,
        borderRadius: height / 2,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Box style={{
        width: `${fillWidth}%`,
        height,
        backgroundColor: color,
        borderRadius: height / 2,
        transition: animated
          ? { width: { duration: 320, easing: 'spring' } }
          : undefined,
      }} />
      {showText && (
        <Box style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{ color: '#ffffff', fontSize: Math.max(9, height - 4), fontWeight: 'bold' }}>
            {labelText}
          </Text>
        </Box>
      )}
    </Box>
  );
}
