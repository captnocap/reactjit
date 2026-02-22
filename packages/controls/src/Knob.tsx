import React, { useCallback, useMemo } from 'react';
import type { Style, Color } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface KnobProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  color?: Color;
  trackColor?: Color;
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

// Map value to angle: 0% = -135deg, 100% = +135deg (270deg sweep, gap at bottom)
function valueToAngle(value: number, min: number, max: number): number {
  const normalized = (value - min) / (max - min);
  return -135 + normalized * 270;
}

// Generate arc dots for the track
function arcDots(
  count: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): Array<{ x: number; y: number }> {
  const dots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = startAngle + t * (endAngle - startAngle);
    const rad = (angle * Math.PI) / 180;
    dots.push({
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
    });
  }
  return dots;
}

export function Knob({
  value: controlledValue,
  defaultValue = 0,
  onChange,
  min = 0,
  max = 1,
  step,
  size = 48,
  color = '#6366f1',
  trackColor = '#333333',
  label,
  disabled = false,
  style,
}: KnobProps) {
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

  const scaledSize = Math.round(size * scale);

  // ── Native mode: Lua-owned host element ──────────────────
  // All drawing, drag state, and interaction handled in lua/knob.lua.
  // React only receives onChange via buffered knob:change events.
  return React.createElement('Knob', {
    value: currentValue,
    min,
    max,
    step,
    size: scaledSize,
    color: color as string,
    trackColor: trackColor as string,
    label,
    disabled,
    onChange: handleValueChange
      ? (e: any) => handleValueChange(e.value)
      : undefined,
    style: {
      width: scaledSize,
      height: scaledSize + (label ? Math.round(18 * scale) : 0),
      ...scaledStyle,
    },
  });
}
