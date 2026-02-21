import React from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box, Text, Pressable } from '@reactjit/core';
import { useRendererMode } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface PadButtonProps {
  onPress?: () => void;
  onRelease?: () => void;
  label?: string;
  color?: Color;
  active?: boolean;
  size?: number;
  disabled?: boolean;
  style?: Style;
}

export function PadButton({
  onPress,
  onRelease,
  label,
  color = '#6366f1',
  active = false,
  size = 48,
  disabled = false,
  style,
}: PadButtonProps) {
  const mode = useRendererMode();
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const scaledSize = Math.round(size * scale);
  const colorStr = color as string;
  const radius = Math.round(6 * scale);

  if (mode === 'web') {
    return (
      <div
        style={{
          width: scaledSize,
          height: scaledSize,
          borderRadius: radius,
          backgroundColor: active ? colorStr : '#1e1e1e',
          border: `1px solid ${active ? colorStr : '#333'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          transition: 'background-color 0.08s',
          ...scaledStyle,
        } as React.CSSProperties}
        onMouseDown={() => {
          if (!disabled) onPress?.();
        }}
        onMouseUp={() => {
          if (!disabled) onRelease?.();
        }}
        onMouseLeave={() => {
          if (!disabled) onRelease?.();
        }}
      >
        {label && (
          <span
            style={{
              color: active ? '#fff' : '#666',
              fontSize: Math.round(10 * scale),
              fontWeight: 600,
              userSelect: 'none',
            }}
          >
            {label}
          </span>
        )}
      </div>
    );
  }

  // Native mode
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }) => ({
        width: scaledSize,
        height: scaledSize,
        borderRadius: radius,
        backgroundColor: pressed
          ? colorStr
          : active
            ? colorStr
            : hovered
              ? '#2a2a2a'
              : '#1e1e1e',
        borderWidth: 1,
        borderColor: active || pressed ? colorStr : '#333',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        opacity: disabled ? 0.4 : 1,
        ...scaledStyle,
      })}
    >
      {label && (
        <Text
          style={{
            color: active ? '#fff' : '#666',
            fontSize: Math.round(10 * scale),
            fontWeight: '600',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
