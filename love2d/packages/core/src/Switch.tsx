/**
 * Switch component (Love2D native).
 *
 * A toggle switch with on/off states. All toggle state, thumb animation,
 * and drawing handled in lua/switch.lua.
 */

import React, { useState } from 'react';
import type { Style, Color } from './types';

export interface SwitchProps {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  style?: Style;
  trackColor?: { true: Color; false: Color };
  thumbColor?: Color;
  width?: number;
  height?: number;
}

export function Switch({
  value: controlledValue,
  defaultValue = false,
  onValueChange,
  disabled = false,
  style,
  trackColor = { true: '#81b0ff', false: '#767577' },
  thumbColor = '#f4f3f4',
  width = 50,
  height = 28,
}: SwitchProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  return React.createElement('Switch', {
    value: currentValue,
    disabled,
    trackColorTrue: typeof trackColor.true === 'string' ? trackColor.true : '#81b0ff',
    trackColorFalse: typeof trackColor.false === 'string' ? trackColor.false : '#767577',
    thumbColor: typeof thumbColor === 'string' ? thumbColor : '#f4f3f4',
    width,
    height,
    onValueChange: (e: any) => {
      const newValue = e.value;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    style: { width, height, ...style },
  });
}
