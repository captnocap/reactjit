/**
 * ThemeSwitcher -- compact click-to-cycle theme picker.
 *
 * Displays the active theme with a small token preview strip.
 */

import React, { useCallback } from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useTheme, useThemeColors, themeNames } from './useTheme';
import { themes } from './themes';

export interface ThemeSwitcherProps {
  /** Optional styling for the outer Pressable. */
  style?: any;
}

function MiniSwatch({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Box
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
      }}
    />
  );
}

function truncateLabel(text: string, max = 20) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 2)}..`;
}

export function ThemeSwitcher({ style }: ThemeSwitcherProps) {
  const { themeId, setTheme } = useTheme();
  const c = useThemeColors();

  const cycleTheme = useCallback(() => {
    const idx = themeNames.indexOf(themeId);
    const next = themeNames[(idx + 1) % themeNames.length];
    setTheme(next);
  }, [themeId, setTheme]);

  const currentTheme = themes[themeId];
  const currentColors = currentTheme?.colors ?? c;

  const displayName = truncateLabel(currentTheme?.displayName ?? themeId);
  const family = themeId.includes('-') ? themeId.split('-')[0] : themeId;

  return (
    <Pressable
      onPress={cycleTheme}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingLeft: 9,
        paddingRight: 9,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        ...style,
      }}
    >
      <Box style={{
        flexDirection: 'row',
        gap: 4,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 3,
        paddingBottom: 3,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}>
        <MiniSwatch color={currentColors.bg} />
        <MiniSwatch color={currentColors.primary} />
        <MiniSwatch color={currentColors.accent} />
      </Box>

      <Box style={{ gap: 1 }}>
        <Text style={{ color: c.textDim, fontSize: 7 }}>{family}</Text>
        <Text style={{ color: c.primary, fontSize: 9, fontWeight: 'bold' }}>{displayName}</Text>
      </Box>

      <Box style={{
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 1,
        paddingBottom: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}>
        <Text style={{ color: c.textDim, fontSize: 7 }}>F9</Text>
      </Box>
    </Pressable>
  );
}
