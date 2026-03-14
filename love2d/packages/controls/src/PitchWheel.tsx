import React, { useCallback } from 'react';
import type { Style, Color } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface PitchWheelProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  springReturn?: boolean;
  height?: number;
  width?: number;
  color?: Color;
  trackColor?: Color;
  thumbColor?: Color;
  label?: string;
  disabled?: boolean;
  style?: Style;
}

export function PitchWheel({
  value,
  defaultValue = 0,
  min = -1,
  max = 1,
  onChange,
  springReturn = true,
  height = 128,
  width = 34,
  color = '#22c55e',
  trackColor = '#141827',
  thumbColor = '#f8fafc',
  label = 'Pitch',
  disabled = false,
  style,
}: PitchWheelProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);
  const scaledH = Math.round(height * scale);
  const scaledW = Math.round(width * scale);

  const handleChange = useCallback(
    (e: any) => onChange?.(e.value),
    [onChange],
  );

  // Lua-owned host element — all drawing, drag state, and interaction
  // handled in lua/pitchwheel.lua. React only receives onChange via pitchwheel:change events.
  return React.createElement('PitchWheel', {
    value,
    defaultValue,
    min,
    max,
    springReturn,
    height: scaledH,
    width: scaledW,
    color: color as string,
    trackColor: trackColor as string,
    thumbColor: thumbColor as string,
    label,
    disabled,
    onChange: handleChange,
    style: {
      width: scaledW,
      height: scaledH + (label ? Math.round(18 * scale) : 0) + Math.round(18 * scale),
      ...scaledStyle,
    },
  });
}
