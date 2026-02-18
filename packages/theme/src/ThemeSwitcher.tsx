/**
 * ThemeSwitcher -- a click-to-cycle theme picker.
 *
 * Displays the current theme name alongside 3 color swatches (bg, primary, accent).
 * Each click cycles to the next theme in the registry.
 *
 * NOTE: A dropdown variant would require top-level overlay support in the
 * layout engine (parent bounds clip both painting and hit testing for
 * absolutely-positioned children). Until then, cycle-on-click is the
 * reliable approach.
 *
 * Props:
 *   style? -- optional styling applied to the outer Pressable.
 *
 * Usage:
 *   <ThemeSwitcher />
 *   <ThemeSwitcher style={{ marginLeft: 8 }} />
 */

import React, { useCallback } from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useTheme, useThemeColors, themeNames } from './useTheme';
import { themes } from './themes';

export interface ThemeSwitcherProps {
  /** Optional styling for the outer Pressable. */
  style?: any;
}

/** Small color swatch — a rounded box filled with the given color. */
function MiniSwatch({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Box
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      }}
    />
  );
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

  // Truncate theme name to fit the button
  const label =
    (currentTheme?.displayName ?? themeId).length > 16
      ? (currentTheme?.displayName ?? themeId).slice(0, 14) + '..'
      : (currentTheme?.displayName ?? themeId);

  return (
    <Pressable
      onPress={cycleTheme}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: c.primary,
        ...style,
      }}
    >
      <MiniSwatch color={currentColors.bg} />
      <MiniSwatch color={currentColors.primary} />
      <MiniSwatch color={currentColors.accent} />
      <Text style={{ color: c.primary, fontSize: 9 }}>{label}</Text>
    </Pressable>
  );
}
