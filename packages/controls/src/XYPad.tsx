import React, { useCallback, useRef, useState } from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box, Text } from '@reactjit/core';
import { useScale, useScaledStyle } from '@reactjit/core';

export interface XYPadProps {
  x?: number;
  y?: number;
  defaultX?: number;
  defaultY?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  onChange?: (x: number, y: number) => void;
  size?: number;
  color?: Color;
  backgroundColor?: Color;
  thumbColor?: Color;
  label?: string;
  disabled?: boolean;
  style?: Style;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function XYPad({
  x: controlledX,
  y: controlledY,
  defaultX = 0.5,
  defaultY = 0.5,
  minX = 0,
  maxX = 1,
  minY = 0,
  maxY = 1,
  onChange,
  size = 132,
  color = '#6366f1',
  backgroundColor = '#141827',
  thumbColor = '#f8fafc',
  label,
  disabled = false,
  style,
}: XYPadProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);
  const isControlled = controlledX !== undefined && controlledY !== undefined;

  const [internalX, setInternalX] = useState(clamp(defaultX, minX, maxX));
  const [internalY, setInternalY] = useState(clamp(defaultY, minY, maxY));

  const currentX = isControlled ? (controlledX as number) : internalX;
  const currentY = isControlled ? (controlledY as number) : internalY;

  const dragStartRef = useRef({ x: currentX, y: currentY });
  const scaledSize = Math.round(size * scale);
  const thumbSize = Math.max(10, Math.round(12 * scale));

  const setValue = useCallback((nextX: number, nextY: number) => {
    const clampedX = clamp(nextX, minX, maxX);
    const clampedY = clamp(nextY, minY, maxY);
    if (!isControlled) {
      setInternalX(clampedX);
      setInternalY(clampedY);
    }
    onChange?.(clampedX, clampedY);
  }, [isControlled, maxX, maxY, minX, minY, onChange]);

  const nx = (currentX - minX) / (maxX - minX || 1);
  const ny = (currentY - minY) / (maxY - minY || 1);
  const thumbLeft = Math.round(nx * (scaledSize - thumbSize));
  const thumbTop = Math.round((1 - ny) * (scaledSize - thumbSize));

  return (
    <Box style={{ gap: Math.round(6 * scale), alignItems: 'center', opacity: disabled ? 0.45 : 1, ...scaledStyle }}>
      {label && (
        <Text style={{ color: '#94a3b8', fontSize: Math.round(10 * scale) }}>
          {label}
        </Text>
      )}

      <Box
        style={{
          width: scaledSize,
          height: scaledSize,
          borderRadius: Math.round(8 * scale),
          borderWidth: 1,
          borderColor: '#2e3348',
          backgroundColor: backgroundColor as string,
        }}
        onDragStart={() => {
          if (disabled) return;
          dragStartRef.current = { x: currentX, y: currentY };
        }}
        onDrag={(e: any) => {
          if (disabled) return;
          const dx = (e.totalDeltaX || 0) / scaledSize;
          const dy = (e.totalDeltaY || 0) / scaledSize;
          const nextX = dragStartRef.current.x + dx * (maxX - minX);
          const nextY = dragStartRef.current.y - dy * (maxY - minY);
          setValue(nextX, nextY);
        }}
      >
        <Box
          style={{
            position: 'absolute',
            left: Math.round(scaledSize / 2),
            top: 0,
            width: 1,
            height: scaledSize,
            backgroundColor: '#2b3146',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            left: 0,
            top: Math.round(scaledSize / 2),
            width: scaledSize,
            height: 1,
            backgroundColor: '#2b3146',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: thumbTop,
            width: thumbSize,
            height: thumbSize,
            borderRadius: Math.round(thumbSize / 2),
            backgroundColor: thumbColor as string,
            borderWidth: 2,
            borderColor: color as string,
          }}
        />
      </Box>

      <Text style={{ color: '#64748b', fontSize: Math.round(9 * scale) }}>
        {`X ${currentX.toFixed(2)}  Y ${currentY.toFixed(2)}`}
      </Text>
    </Box>
  );
}

