import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style, Color } from './types';

export interface ActionBarItem {
  /** Unique key for this action */
  key: string;
  /** Display label */
  label: string;
  /** Whether this action is disabled */
  disabled?: boolean;
  /** Custom color for this action */
  color?: Color;
}

export interface ActionBarProps {
  /** Actions to display */
  items: ActionBarItem[];
  /** Called when an action is pressed */
  onAction?: (key: string) => void;
  /** Gap between action buttons */
  gap?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Container style */
  style?: Style;
}

const sizeConfig = {
  sm: { fontSize: 11, px: 8, py: 3 },
  md: { fontSize: 12, px: 10, py: 5 },
};

export function ActionBar({
  items,
  onAction,
  gap = 4,
  size = 'sm',
  style,
}: ActionBarProps) {
  const cfg = sizeConfig[size];

  return (
    <Box style={{ flexDirection: 'row', gap, alignItems: 'center', ...style }}>
      {items.map(item => (
        <Pressable
          key={item.key}
          onPress={item.disabled ? undefined : () => onAction?.(item.key)}
        >
          {({ pressed, hovered }) => (
            <Box style={{
              paddingLeft: cfg.px,
              paddingRight: cfg.px,
              paddingTop: cfg.py,
              paddingBottom: cfg.py,
              borderRadius: 6,
              backgroundColor: pressed
                ? '#334155'
                : hovered
                  ? '#1e293b'
                  : 'transparent',
              opacity: item.disabled ? 0.4 : 1,
            }}>
              <Text style={{
                fontSize: cfg.fontSize,
                color: item.color || '#94a3b8',
              }}>
                {item.label}
              </Text>
            </Box>
          )}
        </Pressable>
      ))}
    </Box>
  );
}
