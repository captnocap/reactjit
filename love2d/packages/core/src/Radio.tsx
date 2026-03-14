/**
 * Radio and RadioGroup components (Love2D native).
 *
 * RadioGroup provides context for exclusive selection.
 * Radio renders an individual option that reads group state from context.
 * Selection state and drawing handled in lua/radio.lua.
 */

import React, { useState, useCallback, useContext, createContext } from 'react';
import { Box } from './primitives';
import type { Style, Color } from './types';

// ── RadioGroup context ──────────────────────────────────

interface RadioGroupContextValue {
  selectedValue: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

// ── RadioGroup ──────────────────────────────────────────

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: Style;
}

export function RadioGroup({
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  style,
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const selectedValue = isControlled ? controlledValue : internalValue;

  // rjit-ignore-next-line — framework API: radio group handler
  const onChange = useCallback((newValue: string) => {
    if (disabled) return;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  }, [disabled, isControlled, onValueChange]);

  const ctx: RadioGroupContextValue = { selectedValue, onChange, disabled };

  return (
    <RadioGroupContext.Provider value={ctx}>
      <Box style={{ gap: 8, ...style }}>
        {children}
      </Box>
    </RadioGroupContext.Provider>
  );
}

// ── Radio ───────────────────────────────────────────────

export interface RadioProps {
  value: string;
  label?: string;
  disabled?: boolean;
  size?: number;
  color?: Color;
  uncheckedColor?: Color;
  style?: Style;
}

export function Radio({
  value,
  label,
  disabled: localDisabled = false,
  size = 20,
  color = '#3b82f6',
  uncheckedColor = '#6b7280',
  style,
}: RadioProps) {
  const group = useContext(RadioGroupContext);

  const isDisabled = localDisabled || (group?.disabled ?? false);

  return React.createElement('Radio', {
    value,
    selectedValue: group?.selectedValue,
    groupId: '__default',
    disabled: isDisabled,
    label,
    size,
    color: typeof color === 'string' ? color : '#3b82f6',
    uncheckedColor: typeof uncheckedColor === 'string' ? uncheckedColor : '#6b7280',
    onValueChange: (e: any) => {
      if (!isDisabled && group) {
        group.onChange(e.value);
      }
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
