import React, { useCallback } from 'react';
import type { Style, Color } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface XYPadProps {
  x?: number;
  y?: number;
  defaultX?: number;
  defaultY?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  onChange?: (x: number, y: number) => void;
  size?: number;
  color?: Color;
  backgroundColor?: Color;
  thumbColor?: Color;
  label?: string;
  disabled?: boolean;
  style?: Style;
}

export function XYPad({
  x,
  y,
  defaultX = 0.5,
  defaultY = 0.5,
  minX = 0,
  maxX = 1,
  minY = 0,
  maxY = 1,
  onChange,
  size = 132,
  color = '#6366f1',
  backgroundColor = '#141827',
  thumbColor = '#f8fafc',
  label,
  disabled = false,
  style,
}: XYPadProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);
  const scaledSize = Math.round(size * scale);

  const handleChange = useCallback(
    (e: any) => onChange?.(e.x, e.y),
    [onChange],
  );

  // Lua-owned host element — all drawing, drag state, and interaction
  // handled in lua/xypad.lua. React only receives onChange via xypad:change events.
  return React.createElement('XYPad', {
    x,
    y,
    defaultX,
    defaultY,
    minX,
    maxX,
    minY,
    maxY,
    size: scaledSize,
    color: color as string,
    backgroundColor: backgroundColor as string,
    thumbColor: thumbColor as string,
    label,
    disabled,
    onChange: handleChange,
    style: {
      width: scaledSize,
      height: scaledSize + (label ? Math.round(18 * scale) : 0) + Math.round(18 * scale),
      ...scaledStyle,
    },
  });
}
