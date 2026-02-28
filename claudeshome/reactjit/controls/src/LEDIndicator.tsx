import React from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box } from '@reactjit/core';
import { useRendererMode } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface LEDIndicatorProps {
  on?: boolean;
  color?: Color;
  size?: number;
  style?: Style;
}

export function LEDIndicator({
  on = false,
  color = '#22c55e',
  size = 8,
  style,
}: LEDIndicatorProps) {
  const mode = useRendererMode();
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const scaledSize = Math.round(size * scale);
  const glowSize = Math.round(scaledSize * 1.8);
  const colorStr = color as string;
  const dimColor = colorStr + '40';
  const glowColor = colorStr + '30';

  if (mode === 'web') {
    return (
      <div
        style={{
          position: 'relative',
          width: glowSize,
          height: glowSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...scaledStyle,
        } as React.CSSProperties}
      >
        {/* Glow */}
        {on && (
          <div
            style={{
              position: 'absolute',
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: glowColor,
            }}
          />
        )}
        {/* LED */}
        <div
          style={{
            width: scaledSize,
            height: scaledSize,
            borderRadius: scaledSize / 2,
            backgroundColor: on ? colorStr : dimColor,
          }}
        />
      </div>
    );
  }

  // Native mode
  return (
    <Box
      style={{
        width: glowSize,
        height: glowSize,
        alignItems: 'center',
        justifyContent: 'center',
        ...scaledStyle,
      }}
    >
      {on && (
        <Box
          style={{
            position: 'absolute',
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: glowColor,
          }}
        />
      )}
      <Box
        style={{
          width: scaledSize,
          height: scaledSize,
          borderRadius: scaledSize / 2,
          backgroundColor: on ? colorStr : dimColor,
        }}
      />
    </Box>
  );
}
