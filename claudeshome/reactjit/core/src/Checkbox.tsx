/**
 * Checkbox component (Love2D native).
 *
 * A toggleable checkbox with optional label. Supports controlled
 * and uncontrolled modes with customizable colors and sizing.
 * All toggle state and drawing handled in lua/checkbox.lua.
 */

import React, { useState, useCallback } from 'react';
import type { Style, Color } from './types';

export interface CheckboxProps {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: number;
  color?: Color;
  uncheckedColor?: Color;
  style?: Style;
}

export function Checkbox({
  value: controlledValue,
  defaultValue = false,
  onValueChange,
  disabled = false,
  label,
  size = 20,
  color = '#3b82f6',
  uncheckedColor = '#6b7280',
  style,
}: CheckboxProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const checked = isControlled ? controlledValue : internalValue;

  return React.createElement('Checkbox', {
    value: checked,
    disabled,
    label,
    size,
    color: typeof color === 'string' ? color : '#3b82f6',
    uncheckedColor: typeof uncheckedColor === 'string' ? uncheckedColor : '#6b7280',
    onValueChange: (e: any) => {
      const newValue = e.value;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    style: {
      flexDirection: 'row',
      alignItems: 'center',
      height: size,
      width: label ? size + 8 + 100 : size,
      ...style,
    },
  });
}
