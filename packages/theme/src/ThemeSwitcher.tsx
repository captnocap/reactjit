/**
 * ThemeSwitcher -- compact click-to-cycle theme picker.
 *
 * Displays the active theme with a small token preview strip.
 */

import React, { useCallback } from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
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

  return (
    <Pressable
      onPress={cycleTheme}
      style={{
        flexDirection: 'row',
        gap: 3,
        alignItems: 'center',
        ...style,
      }}
    >
      <MiniSwatch color={currentColors.bg} size={8} />
      <MiniSwatch color={currentColors.primary} size={8} />
      <MiniSwatch color={currentColors.accent} size={8} />
    </Pressable>
  );
}
