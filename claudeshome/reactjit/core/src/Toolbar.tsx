import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import { useThemeColorsOptional } from './context';
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
  const theme = useThemeColorsOptional();
  const colors = {
    barBg: theme?.surface ?? '#1e293b',
    barBorder: theme?.border ?? '#334155',
    divider: theme?.border ?? '#334155',
    itemBgHover: theme?.surfaceHover ?? '#2a3a52',
    itemBgPressed: theme?.bgElevated ?? '#111827',
    itemText: theme?.text ?? '#e2e8f0',
    itemTextDisabled: theme?.textDim ?? '#64748b',
  };

  return (
    <Box style={{
      flexDirection: 'row',
      width: '100%',
      alignItems: 'center',
      backgroundColor: colors.barBg,
      borderWidth: 1,
      borderColor: colors.barBorder,
      borderRadius: 8,
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
                backgroundColor: colors.divider,
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
                  ? colors.itemBgPressed
                  : state.hovered
                    ? colors.itemBgHover
                    : 'transparent',
            })}
          >
            <Text style={{
              color: disabled ? colors.itemTextDisabled : colors.itemText,
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
