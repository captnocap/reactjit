import React, { useCallback } from 'react';
import type { Style, Color } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface FaderProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  height?: number;
  width?: number;
  color?: Color;
  trackColor?: Color;
  thumbColor?: Color;
  label?: string;
  disabled?: boolean;
  style?: Style;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function snapToStep(value: number, step: number, min: number, max: number): number {
  const steps = Math.round((value - min) / step);
  return clamp(min + steps * step, min, max);
}

export function Fader({
  value: controlledValue,
  defaultValue = 0,
  onChange,
  min = 0,
  max = 1,
  step,
  height = 120,
  width = 32,
  color = '#6366f1',
  trackColor = '#1e1e1e',
  thumbColor = '#cccccc',
  label,
  disabled = false,
  style,
}: FaderProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : defaultValue;

  const handleValueChange = useCallback(
    (newValue: number) => {
      let clamped = clamp(newValue, min, max);
      if (step !== undefined) {
        clamped = snapToStep(clamped, step, min, max);
      }
      onChange?.(clamped);
    },
    [onChange, min, max, step],
  );

  const scaledHeight = Math.round(height * scale);
  const scaledWidth = Math.round(width * scale);

  // ── Native mode: Lua-owned host element ──────────────────
  // All drawing, drag state, and interaction handled in lua/fader.lua.
  // React only receives onChange via buffered fader:change events.
  return React.createElement('Fader', {
    value: currentValue,
    min,
    max,
    step,
    height: scaledHeight,
    width: scaledWidth,
    color: color as string,
    trackColor: trackColor as string,
    thumbColor: thumbColor as string,
    label,
    disabled,
    onChange: handleValueChange
      ? (e: any) => handleValueChange(e.value)
      : undefined,
    style: {
      width: scaledWidth,
      height: scaledHeight + (label ? Math.round(18 * scale) : 0),
      ...scaledStyle,
    },
  });
}
