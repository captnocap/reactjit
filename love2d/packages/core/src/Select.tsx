/**
 * Select (dropdown) component — native (Love2D) mode only.
 *
 * All open/close, hover tracking, keyboard nav handled in lua/select.lua.
 * React is a declarative wrapper that passes props and receives boundary events.
 */

import React from 'react';
import type { Style, Color } from './types';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: Style;
  color?: Color;
}

export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  style,
  color = '#3b82f6',
}: SelectProps) {
  const selectedValue = controlledValue !== undefined ? controlledValue : defaultValue;

  return React.createElement('Select', {
    value: selectedValue,
    options: JSON.stringify(options),
    placeholder,
    disabled,
    color: typeof color === 'string' ? color : '#3b82f6',
    onValueChange: onValueChange
      ? (e: any) => onValueChange(e.value)
      : undefined,
    style: {
      minWidth: 160,
      height: 36 + 4,
      ...style,
    },
  });
}
