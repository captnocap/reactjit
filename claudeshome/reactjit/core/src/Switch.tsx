/**
 * Switch component for web and native (Love2D) modes.
 *
 * A toggle switch with on/off states. Provides a track that changes color
 * and a thumb that slides left/right based on the current value.
 */

import React, { useState, useCallback } from 'react';
import type { Style, LoveEvent, Color } from './types';
import { useRendererMode } from './context';

export interface SwitchProps {
  value?: boolean;
  defaultValue?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;

  // Visual customization
  style?: Style;
  trackColor?: { true: Color; false: Color };
  thumbColor?: Color;

  // Sizing
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
  const mode = useRendererMode();

  // Controlled vs uncontrolled
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  /** Toggle the switch value. */
  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newValue = !currentValue;

    if (!isControlled) {
      setInternalValue(newValue);
    }

    onValueChange?.(newValue);
  }, [disabled, currentValue, isControlled, onValueChange]);

  // Container style
  const containerStyle: Style = {
    width,
    height,
    ...style,
  };

  // Track style
  const trackStyle: Style = {
    position: 'relative',
    width,
    height,
    borderRadius: height / 2,
    backgroundColor: currentValue ? trackColor.true : trackColor.false,
    opacity: disabled ? 0.5 : 1,
  };

  // Thumb dimensions
  const thumbDiameter = height - 4; // 2px padding on each side
  const thumbPadding = 2;

  // Thumb position: left edge when OFF, right edge when ON
  const thumbLeft = currentValue ? width - thumbDiameter - thumbPadding : thumbPadding;

  // Thumb style
  const thumbStyle: Style = {
    position: 'absolute',
    width: thumbDiameter,
    height: thumbDiameter,
    borderRadius: thumbDiameter / 2,
    backgroundColor: thumbColor,
    left: thumbLeft,
    top: thumbPadding,
  };

  if (mode === 'web') {
    return (
      <div
        style={{ display: 'flex', ...containerStyle } as React.CSSProperties}
        onClick={disabled ? undefined : handleToggle}
      >
        <div
          style={{
            ...trackStyle,
            cursor: disabled ? 'not-allowed' : 'pointer',
          } as React.CSSProperties}
        >
          <div
            style={{
              ...thumbStyle,
              transition: 'left 0.2s ease',
            } as React.CSSProperties}
          />
        </div>
      </div>
    );
  }

  // Native mode: Lua-owned host element
  // All toggle state, thumb animation, and drawing handled in lua/switch.lua.
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
