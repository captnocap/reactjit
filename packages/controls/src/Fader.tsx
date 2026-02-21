import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box } from '@reactjit/core';
import { useRendererMode } from '@reactjit/core';
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
  const mode = useRendererMode();
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const [internalValue, setInternalValue] = useState(
    clamp(defaultValue, min, max),
  );
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = useCallback(
    (newValue: number) => {
      let clamped = clamp(newValue, min, max);
      if (step !== undefined) {
        clamped = snapToStep(clamped, step, min, max);
      }
      if (!isControlled) {
        setInternalValue(clamped);
      }
      onChange?.(clamped);
    },
    [isControlled, onChange, min, max, step],
  );

  const scaledHeight = Math.round(height * scale);
  const scaledWidth = Math.round(width * scale);
  const trackWidth = Math.round(4 * scale);
  const thumbHeight = Math.round(12 * scale);
  const thumbWidth = scaledWidth;
  const normalized = (currentValue - min) / (max - min);
  // Bottom = 0, top = 1
  const thumbY = scaledHeight - thumbHeight - normalized * (scaledHeight - thumbHeight);

  // ── Web mode ──────────────────────────────────────────────
  if (mode === 'web') {
    const [isDragging, setIsDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled || !trackRef.current) return;
        e.preventDefault();
        setIsDragging(true);
        const rect = trackRef.current.getBoundingClientRect();
        const pos = 1 - (e.clientY - rect.top) / rect.height;
        handleValueChange(min + clamp(pos, 0, 1) * (max - min));
      },
      [disabled, min, max, handleValueChange],
    );

    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDragging || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const pos = 1 - (e.clientY - rect.top) / rect.height;
        handleValueChange(min + clamp(pos, 0, 1) * (max - min));
      },
      [isDragging, min, max, handleValueChange],
    );

    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
    }, []);

    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: Math.round(4 * scale),
          opacity: disabled ? 0.4 : 1,
          ...scaledStyle,
        } as React.CSSProperties}
      >
        <div
          ref={trackRef}
          style={{
            position: 'relative',
            width: scaledWidth,
            height: scaledHeight,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Track groove */}
          <div
            style={{
              position: 'absolute',
              left: (scaledWidth - trackWidth) / 2,
              top: 0,
              width: trackWidth,
              height: scaledHeight,
              backgroundColor: trackColor as string,
              borderRadius: trackWidth / 2,
            }}
          />
          {/* Active track fill */}
          <div
            style={{
              position: 'absolute',
              left: (scaledWidth - trackWidth) / 2,
              bottom: 0,
              width: trackWidth,
              height: `${normalized * 100}%`,
              backgroundColor: color as string,
              borderRadius: trackWidth / 2,
            }}
          />
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: thumbY,
              width: thumbWidth,
              height: thumbHeight,
              backgroundColor: thumbColor as string,
              borderRadius: Math.round(2 * scale),
              border: '1px solid #666',
              cursor: disabled ? 'not-allowed' : 'grab',
            }}
          />
        </div>
        {label && (
          <div
            style={{
              color: '#94a3b8',
              fontSize: Math.round(10 * scale),
              textAlign: 'center',
            }}
          >
            {label}
          </div>
        )}
      </div>
    );
  }

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
