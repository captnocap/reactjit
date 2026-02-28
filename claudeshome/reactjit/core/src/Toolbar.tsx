import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style } from './types';

export type ToolbarEntry =
  | { type: 'item'; id: string; label: string; disabled?: boolean }
  | { type: 'divider' };

export interface ToolbarProps {
  items: ToolbarEntry[];
  onSelect?: (id: string) => void;
  style?: Style;
}

export function Toolbar({
  items,
  onSelect,
  style,
}: ToolbarProps) {
  return (
    <Box style={{
      flexDirection: 'row',
      width: '100%',
      alignItems: 'center',
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: '#1e293b',
      borderRadius: 6,
      padding: 4,
      gap: 2,
      ...style,
    }}>
      {items.map((entry, i) => {
        if (entry.type === 'divider') {
          return (
            <Box
              key={`divider-${i}`}
              style={{
                width: 1,
                height: 18,
                backgroundColor: '#334155',
                marginLeft: 4,
                marginRight: 4,
              }}
            />
          );
        }

        const disabled = entry.disabled ?? false;
        return (
          <Pressable
            key={entry.id}
            onPress={disabled ? undefined : () => onSelect?.(entry.id)}
            style={(state) => ({
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: 4,
              opacity: disabled ? 0.4 : 1,
              backgroundColor: disabled
                ? 'transparent'
                : state.pressed
                  ? '#334155'
                  : state.hovered
                    ? '#1e293b'
                    : 'transparent',
            })}
          >
            <Text style={{
              color: disabled ? '#475569' : '#cbd5e1',
              fontSize: 11,
            }}>
              {entry.label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}
