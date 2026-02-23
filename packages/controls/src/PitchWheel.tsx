import React, { useCallback, useRef, useState } from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box, Text } from '@reactjit/core';
import { useScale, useScaledStyle } from '@reactjit/core';

export interface PitchWheelProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  springReturn?: boolean;
  height?: number;
  width?: number;
  color?: Color;
  trackColor?: Color;
  thumbColor?: Color;
  label?: string;
  disabled?: boolean;
  style?: Style;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function PitchWheel({
  value: controlledValue,
  defaultValue = 0,
  min = -1,
  max = 1,
  onChange,
  springReturn = true,
  height = 128,
  width = 34,
  color = '#22c55e',
  trackColor = '#141827',
  thumbColor = '#f8fafc',
  label = 'Pitch',
  disabled = false,
  style,
}: PitchWheelProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);
  const isControlled = controlledValue !== undefined;

  const [internalValue, setInternalValue] = useState(clamp(defaultValue, min, max));
  const currentValue = isControlled ? (controlledValue as number) : internalValue;
  const dragStartRef = useRef(currentValue);

  const scaledH = Math.round(height * scale);
  const scaledW = Math.round(width * scale);
  const thumbH = Math.max(10, Math.round(12 * scale));
  const centerValue = (min + max) / 2;

  const setValue = useCallback((nextValue: number) => {
    const clamped = clamp(nextValue, min, max);
    if (!isControlled) setInternalValue(clamped);
    onChange?.(clamped);
  }, [isControlled, max, min, onChange]);

  const t = (currentValue - min) / (max - min || 1);
  const thumbTop = Math.round((1 - t) * (scaledH - thumbH));

  return (
    <Box style={{ gap: Math.round(6 * scale), alignItems: 'center', opacity: disabled ? 0.45 : 1, ...scaledStyle }}>
      {label && (
        <Text style={{ color: '#94a3b8', fontSize: Math.round(10 * scale) }}>
          {label}
        </Text>
      )}

      <Box
        style={{
          width: scaledW,
          height: scaledH,
          borderRadius: Math.round(8 * scale),
          borderWidth: 1,
          borderColor: '#2e3348',
          backgroundColor: trackColor as string,
        }}
        onDragStart={() => {
          if (disabled) return;
          dragStartRef.current = currentValue;
        }}
        onDrag={(e: any) => {
          if (disabled) return;
          const dy = -(e.totalDeltaY || 0) / scaledH;
          setValue(dragStartRef.current + dy * (max - min));
        }}
        onDragEnd={() => {
          if (disabled) return;
          if (springReturn) setValue(centerValue);
        }}
      >
        <Box
          style={{
            position: 'absolute',
            left: 0,
            top: Math.round((scaledH - 1) / 2),
            width: scaledW,
            height: 1,
            backgroundColor: '#334155',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            left: Math.round(2 * scale),
            top: thumbTop,
            width: scaledW - Math.round(4 * scale),
            height: thumbH,
            borderRadius: Math.round(6 * scale),
            borderWidth: 2,
            borderColor: color as string,
            backgroundColor: thumbColor as string,
          }}
        />
      </Box>

      <Text style={{ color: '#64748b', fontSize: Math.round(9 * scale) }}>
        {`${currentValue.toFixed(2)}`}
      </Text>
    </Box>
  );
}

