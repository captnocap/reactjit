/**
 * Select (dropdown) component for web and native (Love2D) modes.
 *
 * Uses a floating overlay panel (same pattern as inspector tooltips
 * and BarChart interactive tooltips). The trigger button stays in flow,
 * the options panel floats below it via absolute positioning.
 */

import React, { useCallback } from 'react';
import type { Style, LoveEvent, Color } from './types';

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
  const isControlled = controlledValue !== undefined;
  const selectedValue = isControlled ? controlledValue : defaultValue;

  const handleSelect = useCallback((optionValue: string) => {
    if (disabled) return;
    onValueChange?.(optionValue);
  }, [disabled, onValueChange]);

  // ── Native mode: Lua-owned host element ─────────────────
  // All open/close, hover tracking, keyboard nav handled in lua/select.lua.
  return React.createElement('Select', {
    value: selectedValue,
    options: JSON.stringify(options),
    placeholder,
    disabled,
    color: typeof color === 'string' ? color : '#3b82f6',
    onValueChange: (e: any) => {
      const optionValue = e.value;
      handleSelect(optionValue);
      onValueChange?.(optionValue);
    },
    style: {
      minWidth: 160,
      height: 36 + 4,  // trigger height + margin
      ...style,
    },
  });
}
