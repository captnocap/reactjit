import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Style, Color } from '@ilovereact/core';
import { Box, Text } from '@ilovereact/core';
import { useRendererMode } from '@ilovereact/core';
import { useScaledStyle, useScale } from '@ilovereact/core';

export interface KnobProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  color?: Color;
  trackColor?: Color;
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

// Map value to angle: 0% = -135deg, 100% = +135deg (270deg sweep, gap at bottom)
function valueToAngle(value: number, min: number, max: number): number {
  const normalized = (value - min) / (max - min);
  return -135 + normalized * 270;
}

// Generate arc dots for the track
function arcDots(
  count: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): Array<{ x: number; y: number }> {
  const dots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = startAngle + t * (endAngle - startAngle);
    const rad = (angle * Math.PI) / 180;
    dots.push({
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
    });
  }
  return dots;
}

export function Knob({
  value: controlledValue,
  defaultValue = 0,
  onChange,
  min = 0,
  max = 1,
  step,
  size = 48,
  color = '#6366f1',
  trackColor = '#333333',
  label,
  disabled = false,
  style,
}: KnobProps) {
  const mode = useRendererMode();
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  // Controlled vs uncontrolled
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

  const scaledSize = Math.round(size * scale);
  const dotCount = 24;
  const arcRadius = scaledSize * 0.42;
  const dotSize = Math.max(2, Math.round(scaledSize * 0.05));
  const indicatorLen = scaledSize * 0.3;
  const indicatorWidth = Math.max(2, Math.round(scaledSize * 0.06));

  const dragStartValue = useRef(currentValue);

  const angle = valueToAngle(currentValue, min, max);
  const normalized = (currentValue - min) / (max - min);

  // All arc dots (full sweep -135 to +135)
  const allDots = arcDots(dotCount, arcRadius, -135, 135);
  // How many dots are "active" (filled)
  const activeDotCount = Math.round(normalized * (dotCount - 1)) + 1;

  // Indicator line endpoint
  const angleRad = (angle * Math.PI) / 180;
  const indX = Math.cos(angleRad) * indicatorLen;
  const indY = Math.sin(angleRad) * indicatorLen;

  // ── Web mode ──────────────────────────────────────────────
  if (mode === 'web') {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const dragStartValue = useRef(0);

    const sensitivity = (max - min) / (scaledSize * 2);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDragging(true);
        dragStartY.current = e.clientY;
        dragStartValue.current = currentValue;
      },
      [disabled, currentValue],
    );

    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDragging) return;
        const deltaY = dragStartY.current - e.clientY; // up = positive
        const deltaValue = deltaY * sensitivity;
        handleValueChange(dragStartValue.current + deltaValue);
      },
      [isDragging, sensitivity, handleValueChange],
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

    const center = scaledSize / 2;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: Math.round(4 * scale),
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'grab',
          ...scaledStyle,
        } as React.CSSProperties}
        onMouseDown={handleMouseDown}
      >
        <div
          style={{
            position: 'relative',
            width: scaledSize,
            height: scaledSize,
          }}
        >
          {/* Arc dots */}
          {allDots.map((dot, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: i < activeDotCount
                  ? (color as string)
                  : (trackColor as string),
                left: center + dot.x - dotSize / 2,
                top: center + dot.y - dotSize / 2,
              }}
            />
          ))}
          {/* Knob body */}
          <div
            style={{
              position: 'absolute',
              width: scaledSize * 0.65,
              height: scaledSize * 0.65,
              borderRadius: scaledSize * 0.325,
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              left: center - scaledSize * 0.325,
              top: center - scaledSize * 0.325,
            }}
          />
          {/* Indicator line */}
          <div
            style={{
              position: 'absolute',
              width: indicatorWidth,
              height: indicatorLen,
              backgroundColor: color as string,
              borderRadius: indicatorWidth / 2,
              left: center - indicatorWidth / 2,
              top: center - indicatorLen,
              transformOrigin: `${indicatorWidth / 2}px ${indicatorLen}px`,
              transform: `rotate(${angle}deg)`,
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

  // ── Native mode ───────────────────────────────────────────
  const center = scaledSize / 2;

  return (
    <Box
      style={{
        alignItems: 'center',
        gap: Math.round(4 * scale),
        opacity: disabled ? 0.4 : 1,
        ...scaledStyle,
      }}
      onDragStart={
        disabled
          ? undefined
          : () => {
              dragStartValue.current = currentValue;
            }
      }
      onDrag={
        disabled
          ? undefined
          : (e: any) => {
              const sensitivity = (max - min) / (scaledSize * 2);
              handleValueChange(dragStartValue.current + -e.totalDeltaY * sensitivity);
            }
      }
    >
      <Box style={{ width: scaledSize, height: scaledSize }}>
        {/* Arc dots */}
        {allDots.map((dot, i) => (
          <Box
            key={i}
            style={{
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: i < activeDotCount
                ? (color as string)
                : (trackColor as string),
              left: center + dot.x - dotSize / 2,
              top: center + dot.y - dotSize / 2,
            }}
          />
        ))}
        {/* Knob body */}
        <Box
          style={{
            position: 'absolute',
            width: scaledSize * 0.65,
            height: scaledSize * 0.65,
            borderRadius: scaledSize * 0.325,
            backgroundColor: '#2a2a2a',
            borderWidth: 1,
            borderColor: '#444',
            left: center - scaledSize * 0.325,
            top: center - scaledSize * 0.325,
          }}
        />
        {/* Indicator line */}
        <Box
          style={{
            position: 'absolute',
            width: indicatorWidth,
            height: indicatorLen,
            backgroundColor: color as string,
            borderRadius: indicatorWidth / 2,
            left: center - indicatorWidth / 2,
            top: center - indicatorLen,
            transformOrigin: `${indicatorWidth / 2}px ${indicatorLen}px`,
            transform: `rotate(${angle}deg)`,
          }}
        />
      </Box>
      {label && (
        <Text
          style={{
            color: '#94a3b8',
            fontSize: Math.round(10 * scale),
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      )}
    </Box>
  );
}
