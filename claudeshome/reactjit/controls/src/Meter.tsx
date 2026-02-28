import React from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box } from '@reactjit/core';
import { useRendererMode } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface MeterProps {
  value: number; // 0-1
  peak?: number; // 0-1, optional peak hold
  segments?: number;
  orientation?: 'vertical' | 'horizontal';
  colors?: { low?: Color; mid?: Color; high?: Color };
  width?: number;
  height?: number;
  style?: Style;
}

const DEFAULT_COLORS = {
  low: '#22c55e',
  mid: '#f59e0b',
  high: '#ef4444',
};

function segmentColor(
  index: number,
  total: number,
  colors: { low?: Color; mid?: Color; high?: Color },
): string {
  const pos = index / total;
  if (pos >= 0.8) return (colors.high ?? DEFAULT_COLORS.high) as string;
  if (pos >= 0.6) return (colors.mid ?? DEFAULT_COLORS.mid) as string;
  return (colors.low ?? DEFAULT_COLORS.low) as string;
}

export function Meter({
  value,
  peak,
  segments = 12,
  orientation = 'vertical',
  colors = {},
  width,
  height,
  style,
}: MeterProps) {
  const mode = useRendererMode();
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const isVertical = orientation === 'vertical';
  const defaultW = isVertical ? 12 : 120;
  const defaultH = isVertical ? 80 : 12;
  const scaledW = Math.round((width ?? defaultW) * scale);
  const scaledH = Math.round((height ?? defaultH) * scale);
  const gap = Math.max(1, Math.round(1 * scale));
  const clampedValue = Math.max(0, Math.min(1, value));
  const activeCount = Math.round(clampedValue * segments);
  const peakIndex = peak !== undefined ? Math.round(Math.max(0, Math.min(1, peak)) * (segments - 1)) : -1;

  const segSize = isVertical
    ? (scaledH - (segments - 1) * gap) / segments
    : (scaledW - (segments - 1) * gap) / segments;

  const segElements = Array.from({ length: segments }, (_, i) => {
    const isActive = i < activeCount;
    const isPeak = i === peakIndex;
    const col = segmentColor(i, segments, colors);
    const dimCol = col + '30';

    if (mode === 'web') {
      const pos = isVertical
        ? { bottom: i * (segSize + gap), left: 0 }
        : { left: i * (segSize + gap), top: 0 };

      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: isVertical ? scaledW : segSize,
            height: isVertical ? segSize : scaledH,
            backgroundColor: isActive || isPeak ? col : dimCol,
            borderRadius: Math.round(1 * scale),
            ...pos,
          } as React.CSSProperties}
        />
      );
    }

    // Native mode
    const pos = isVertical
      ? { bottom: i * (segSize + gap), left: 0 }
      : { left: i * (segSize + gap), top: 0 };

    return (
      <Box
        key={i}
        style={{
          position: 'absolute',
          width: isVertical ? scaledW : segSize,
          height: isVertical ? segSize : scaledH,
          backgroundColor: isActive || isPeak ? col : dimCol,
          borderRadius: Math.round(1 * scale),
          ...pos,
        }}
      />
    );
  });

  if (mode === 'web') {
    return (
      <div
        style={{
          position: 'relative',
          width: scaledW,
          height: scaledH,
          ...scaledStyle,
        } as React.CSSProperties}
      >
        {segElements}
      </div>
    );
  }

  return (
    <Box
      style={{
        width: scaledW,
        height: scaledH,
        ...scaledStyle,
      }}
    >
      {segElements}
    </Box>
  );
}
