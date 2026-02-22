/**
 * Slider component for web and native (Love2D) modes.
 *
 * In native mode: renders as a single 'Slider' host element.
 * All interaction (drag, click) and painting (track, thumb) are handled
 * entirely in Lua for zero-latency response. Value changes are pushed
 * back to React via slider:change events.
 *
 * In web mode: uses DOM elements with React pointer events.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Style, Color } from './types';
import { useRendererMode } from './context';
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

  // Visual customization
  style?: Style;
  trackColor?: Color;
  activeTrackColor?: Color;
  thumbColor?: Color;
  thumbSize?: number;
  trackHeight?: number;

  // Orientation
  vertical?: boolean;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function snapToStep(value: number, step: number, min: number, max: number): number {
  const steps = Math.round((value - min) / step);
  return clamp(min + steps * step, min, max);
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
  const mode = useRendererMode();
  const scale = useScale();

  // Controlled vs uncontrolled
  const [internalValue, setInternalValue] = useState(
    clamp(defaultValue, minimumValue, maximumValue)
  );
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  // Callback wrapper: updates internal state for uncontrolled mode, calls user callback
  const handleValueChange = useCallback(
    (newValue: number) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  // Scale visual props
  const scaledThumbSize = Math.round(thumbSize * scale);
  const scaledTrackHeight = Math.round(trackHeight * scale);
  const scaledStyle = useScaledStyle(style);

  // ── Native mode: single Lua-owned host element ──────────────────
  if (mode !== 'web') {
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
      // Lua events arrive as full event objects — unwrap to match public API
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

  // ── Web mode: DOM-based slider ──────────────────────────────────

  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const positionToValue = useCallback(
    (position: number): number => {
      return minimumValue + position * (maximumValue - minimumValue);
    },
    [minimumValue, maximumValue]
  );

  const valueToPosition = useCallback(
    (val: number): number => {
      return (val - minimumValue) / (maximumValue - minimumValue);
    },
    [minimumValue, maximumValue]
  );

  const updateValue = useCallback(
    (newValue: number, isEnd = false) => {
      let clampedValue = clamp(newValue, minimumValue, maximumValue);
      if (step !== undefined) {
        clampedValue = snapToStep(clampedValue, step, minimumValue, maximumValue);
      }
      handleValueChange(clampedValue);
      if (isEnd) {
        onSlidingEnd?.(clampedValue);
      }
    },
    [minimumValue, maximumValue, step, handleValueChange, onSlidingEnd]
  );

  const handleWebDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !trackRef.current) return;
      e.preventDefault();
      setIsDragging(true);
      onSlidingStart?.();
      const rect = trackRef.current.getBoundingClientRect();
      const position = vertical
        ? 1 - (e.clientY - rect.top) / rect.height
        : (e.clientX - rect.left) / rect.width;
      updateValue(positionToValue(clamp(position, 0, 1)));
    },
    [disabled, vertical, positionToValue, updateValue, onSlidingStart]
  );

  const handleWebDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const position = vertical
        ? 1 - (e.clientY - rect.top) / rect.height
        : (e.clientX - rect.left) / rect.width;
      updateValue(positionToValue(clamp(position, 0, 1)));
    },
    [isDragging, vertical, positionToValue, updateValue]
  );

  const handleWebDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    updateValue(currentValue, true);
  }, [isDragging, currentValue, updateValue]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleWebDragMove);
      document.addEventListener('mouseup', handleWebDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleWebDragMove);
        document.removeEventListener('mouseup', handleWebDragEnd);
      };
    }
  }, [isDragging, handleWebDragMove, handleWebDragEnd]);

  const thumbPosition = valueToPosition(currentValue);

  const sDefaultLen = Math.round(200 * scale);
  const sPad = Math.round(8 * scale);
  const containerStyle: Style = {
    flexDirection: vertical ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'start',
    ...(vertical ? { height: sDefaultLen, width: scaledThumbSize + sPad } : { width: sDefaultLen, height: scaledThumbSize + sPad }),
    opacity: disabled ? 0.5 : 1,
    ...scaledStyle,
  };

  const trackStyle: Style = {
    position: 'relative',
    backgroundColor: trackColor,
    borderRadius: scaledTrackHeight / 2,
    ...(vertical
      ? { width: scaledTrackHeight, height: '100%', flexGrow: 1 }
      : { height: scaledTrackHeight, width: '100%', flexGrow: 1 }),
  };

  const activeTrackStyle: Style = {
    position: 'absolute',
    backgroundColor: activeTrackColor,
    borderRadius: scaledTrackHeight / 2,
    ...(vertical
      ? {
          width: scaledTrackHeight,
          height: `${thumbPosition * 100}%`,
          bottom: 0,
          left: 0,
        }
      : {
          height: scaledTrackHeight,
          width: `${thumbPosition * 100}%`,
          top: 0,
          left: 0,
        }),
  };

  const thumbStyle: Style = {
    position: 'absolute',
    width: scaledThumbSize,
    height: scaledThumbSize,
    borderRadius: scaledThumbSize / 2,
    backgroundColor: thumbColor,
    ...(vertical
      ? {
          bottom: `calc(${thumbPosition * 100}% - ${scaledThumbSize / 2}px)`,
          left: `calc(50% - ${scaledThumbSize / 2}px)`,
        }
      : {
          left: `calc(${thumbPosition * 100}% - ${scaledThumbSize / 2}px)`,
          top: `calc(50% - ${scaledThumbSize / 2}px)`,
        }),
  };

  return (
    <div style={{ display: 'flex', ...containerStyle } as React.CSSProperties}>
      <div
        ref={trackRef}
        style={{ position: 'relative', ...trackStyle } as React.CSSProperties}
        onMouseDown={handleWebDragStart}
      >
        <div style={activeTrackStyle as React.CSSProperties} />
        <div
          style={{
            ...thumbStyle,
            cursor: disabled ? 'not-allowed' : 'grab',
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
