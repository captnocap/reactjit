import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import { useThemeColorsOptional } from './context';
import type { Style } from './types';

export interface Tab {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onSelect?: (id: string) => void;
  variant?: 'underline' | 'pill';
  style?: Style;
}

export function Tabs({
  tabs,
  activeId,
  onSelect,
  variant = 'underline',
  style,
}: TabsProps) {
  const theme = useThemeColorsOptional();
  const colors = {
    railBg: theme?.surface ?? '#1e293b',
    railBorder: theme?.border ?? '#334155',
    tabBgActive: theme?.bgElevated ?? '#111827',
    tabBgHover: theme?.surfaceHover ?? '#2a3a52',
    tabBgPressed: theme?.bgAlt ?? '#0f172a',
    tabBorderActive: theme?.borderFocus ?? '#4b5563',
    textActive: theme?.text ?? '#e2e8f0',
    textDefault: theme?.textSecondary ?? '#94a3b8',
    underlineActive: theme?.primary ?? '#3b82f6',
    underlineHover: theme?.borderFocus ?? '#4b5563',
  };

  if (variant === 'pill') {
    return (
      <Box style={{
        flexDirection: 'row',
        width: '100%',
        gap: 4,
        backgroundColor: colors.railBg,
        borderWidth: 1,
        borderColor: colors.railBorder,
        borderRadius: 8,
        padding: 4,
        ...style,
      }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelect?.(tab.id)}
              style={(state) => ({
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 6,
                borderWidth: isActive ? 1 : 0,
                borderColor: isActive ? colors.tabBorderActive : 'transparent',
                backgroundColor: isActive
                  ? colors.tabBgActive
                  : state.pressed
                    ? colors.tabBgPressed
                    : state.hovered
                      ? colors.tabBgHover
                      : 'transparent',
              })}
            >
              <Text style={{
                color: isActive ? colors.textActive : colors.textDefault,
                fontSize: 11,
                fontWeight: isActive ? 'bold' : 'normal',
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </Box>
    );
  }

  // underline variant
  return (
    <Box style={{
      flexDirection: 'row',
      width: '100%',
      borderBottomWidth: 1,
      borderColor: colors.railBorder,
      ...style,
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect?.(tab.id)}
            style={(state) => ({
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderBottomWidth: 2,
              borderColor: isActive
                ? colors.underlineActive
                : state.hovered
                  ? colors.underlineHover
                  : 'transparent',
            })}
          >
            <Text style={{
              color: isActive ? colors.textActive : colors.textDefault,
              fontSize: 11,
              fontWeight: isActive ? 'bold' : 'normal',
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}
