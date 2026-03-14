import React, { useState } from 'react';
import { Box, Text } from './primitives';
import { useLuaInterval } from './hooks';
import type { Style, Color } from './types';

export interface LoadingDotsProps {
  /** Number of dots (default: 3) */
  count?: number;
  /** Dot size in pixels (default: 6) */
  dotSize?: number;
  /** Dot color */
  color?: Color;
  /** Animation speed in ms per step (default: 400) */
  speed?: number;
  /** Gap between dots (default: 4) */
  gap?: number;
  /** Container style */
  style?: Style;
  /** Optional label shown next to dots */
  label?: string;
  /** Label text style */
  labelStyle?: Style;
}

export function LoadingDots({
  count = 3,
  dotSize = 6,
  color = '#64748b',
  speed = 400,
  gap = 4,
  style,
  label,
  labelStyle,
}: LoadingDotsProps) {
  const [activeDot, setActiveDot] = useState(0);

  useLuaInterval(speed, () => {
    setActiveDot(prev => (prev + 1) % (count + 1));
  });

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, ...style }}>
      {label && (
        <Text style={{ fontSize: 12, color: '#64748b', ...labelStyle }}>
          {label}
        </Text>
      )}
      <Box style={{ flexDirection: 'row', gap, alignItems: 'center' }}>
        {Array.from({ length: count }, (_, i) => (
          <Box
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              opacity: i < activeDot ? 1 : 0.3,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
