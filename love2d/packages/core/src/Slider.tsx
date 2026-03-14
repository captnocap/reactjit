/**
 * Slider component (Love2D native).
 *
 * Renders as a single 'Slider' host element. All interaction (drag, click)
 * and painting (track, thumb) are handled entirely in Lua for zero-latency
 * response. Value changes are pushed back to React via slider:change events.
 */

import React, { useState, useCallback } from 'react';
import type { Style, Color } from './types';
import { useScaledStyle, useScale } from './ScaleContext';

export interface SliderProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingEnd?: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  disabled?: boolean;
  style?: Style;
  trackColor?: Color;
  activeTrackColor?: Color;
  thumbColor?: Color;
  thumbSize?: number;
  trackHeight?: number;
  vertical?: boolean;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function Slider({
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  onSlidingStart,
  onSlidingEnd,
  minimumValue = 0,
  maximumValue = 1,
  step,
  disabled = false,
  style,
  trackColor = '#333333',
  activeTrackColor = '#4A90D9',
  thumbColor = '#ffffff',
  thumbSize = 20,
  trackHeight = 4,
  vertical = false,
}: SliderProps) {
  const scale = useScale();

  const [internalValue, setInternalValue] = useState(
    clamp(defaultValue, minimumValue, maximumValue)
  );
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  // rjit-ignore-next-line — framework API: slider value handler
  const handleValueChange = useCallback(
    (newValue: number) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  const scaledThumbSize = Math.round(thumbSize * scale);
  const scaledTrackHeight = Math.round(trackHeight * scale);
  const scaledStyle = useScaledStyle(style);

  const explicitWidth = style?.width as number | undefined;
  const nativeStyle: Style = {
    width: explicitWidth != null ? Math.round(explicitWidth * scale) : '100%',
    height: scaledThumbSize + Math.round(8 * scale),
    ...scaledStyle,
  };

  return React.createElement('Slider', {
    value: currentValue,
    minimumValue,
    maximumValue,
    step,
    disabled,
    trackColor,
    activeTrackColor,
    thumbColor,
    thumbSize: scaledThumbSize,
    trackHeight: scaledTrackHeight,
    style: nativeStyle,
    onValueChange: handleValueChange
      ? (event: any) => handleValueChange(event.value)
      : undefined,
    onSlidingStart: onSlidingStart
      ? () => onSlidingStart()
      : undefined,
    onSlidingEnd: onSlidingEnd
      ? (event: any) => onSlidingEnd(event.value)
      : undefined,
  });
}
