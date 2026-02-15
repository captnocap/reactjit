import React from 'react';
import { Box, Text } from './primitives';
import type { Style, Color } from './types';
import { useSpring } from './animation';

export interface ProgressBarProps {
  value: number;
  color?: Color;
  trackColor?: Color;
  height?: number;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
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
  style,
}: ProgressBarProps) {
  const clamped = clamp01(value);
  const fillWidth = animated
    ? useSpring(clamped * 100, { stiffness: 120, damping: 20 })
    : clamped * 100;

  const labelText = label ?? `${Math.round(clamped * 100)}%`;
  const showText = showLabel && height >= 14;

  return (
    <Box style={{
      height,
      backgroundColor: trackColor,
      borderRadius: height / 2,
      overflow: 'hidden',
      ...style,
    }}>
      <Box style={{
        width: `${typeof fillWidth === 'number' ? fillWidth : fillWidth}%`,
        height,
        backgroundColor: color,
        borderRadius: height / 2,
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
