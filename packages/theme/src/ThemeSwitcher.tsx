/**
 * ThemeSwitcher -- a dropdown-style theme picker.
 *
 * Displays the current theme name alongside 3 color swatches (bg, primary, accent).
 * When pressed, opens an overlay panel listing all themes grouped by family.
 * Each option shows the theme's displayName and 3 color swatches. The active theme
 * is highlighted. Clicking a theme calls setTheme() and closes the panel.
 *
 * Props:
 *   style? -- optional container styling applied to the outer wrapper.
 *
 * Usage:
 *   <ThemeSwitcher />
 *   <ThemeSwitcher style={{ marginLeft: 8 }} />
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useTheme, useThemeColors, themeNames } from './useTheme';
import { themes } from './themes';

export interface ThemeSwitcherProps {
  /** Optional styling for the outer container. */
  style?: any;
}

/**
 * Renders a small color swatch -- a rounded box filled with the given color.
 * Used inside both the trigger button and the dropdown options.
 */
function MiniSwatch({ color, size = 10 }: { color: string; size?: number }) {
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

/**
 * Groups theme IDs by their family prefix.
 * e.g. "catppuccin-mocha" -> family "Catppuccin", "nord" -> family "Nord".
 * Returns a Map of familyLabel -> themeId[].
 */
function groupThemesByFamily(names: string[]): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const name of names) {
    // Strip variant suffixes to derive the family key
    const familyKey = name.replace(
      /-(?:latte|frappe|macchiato|mocha|soft|light|dark|storm|dawn|moon)$/,
      '',
    );
    if (!families.has(familyKey)) families.set(familyKey, []);
    families.get(familyKey)!.push(name);
  }
  return families;
}

/**
 * Formats a family key into a human-readable label.
 * "catppuccin" -> "Catppuccin", "tokyo-night" -> "Tokyo Night", "one-dark" -> "One Dark".
 */
function familyLabel(key: string): string {
  return key
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A single theme option row inside the dropdown panel.
 * Shows displayName + 3 swatches, with a highlighted background for the active theme.
 */
function ThemeOption({
  themeId,
  isActive,
  onPress,
}: {
  themeId: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const theme = themes[themeId];
  if (!theme) return null;
  const tc = theme.colors;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        backgroundColor: isActive ? tc.surface : 'transparent',
        borderRadius: 4,
      }}
    >
      {/* Three color swatches representing the theme */}
      <MiniSwatch color={tc.bg} />
      <MiniSwatch color={tc.primary} />
      <MiniSwatch color={tc.accent} />

      {/* Theme display name */}
      <Text
        style={{
          color: isActive ? tc.primary : tc.text,
          fontSize: 10,
          fontWeight: isActive ? 'bold' : 'normal',
        }}
      >
        {theme.displayName}
      </Text>
    </Pressable>
  );
}

export function ThemeSwitcher({ style }: ThemeSwitcherProps) {
  const { themeId, setTheme } = useTheme();
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  /** Select a theme, then close the panel. */
  const handleSelect = useCallback(
    (id: string) => {
      setTheme(id);
      setOpen(false);
    },
    [setTheme],
  );

  /** Grouped themes, memoized so we don't recompute every render. */
  const families = useMemo(() => groupThemesByFamily(themeNames), []);

  // Resolve the current theme for the trigger swatches
  const currentTheme = themes[themeId];
  const currentColors = currentTheme?.colors ?? c;

  // Truncate theme name to fit the trigger button
  const label =
    (currentTheme?.displayName ?? themeId).length > 16
      ? (currentTheme?.displayName ?? themeId).slice(0, 14) + '..'
      : (currentTheme?.displayName ?? themeId);

  return (
    <Box style={{ position: 'relative', ...style }}>
      {/* ── Trigger button ─────────────────────────────────── */}
      <Pressable
        onPress={toggle}
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
        }}
      >
        {/* Three mini swatches showing the active theme at a glance */}
        <MiniSwatch color={currentColors.bg} size={8} />
        <MiniSwatch color={currentColors.primary} size={8} />
        <MiniSwatch color={currentColors.accent} size={8} />

        <Text style={{ color: c.primary, fontSize: 9 }}>{label}</Text>
      </Pressable>

      {/* ── Dropdown overlay ───────────────────────────────── */}
      {open && (
        <>
          {/* Invisible backdrop -- covers the full viewport to catch taps outside the panel */}
          <Pressable
            onPress={close}
            style={{
              position: 'absolute',
              top: -1000,
              left: -1000,
              width: 4000,
              height: 4000,
              backgroundColor: 'transparent',
              zIndex: 98,
            }}
          />

          {/* Floating panel positioned below the trigger */}
          <Box
            style={{
              position: 'absolute',
              top: 28,
              right: 0,
              width: 220,
              maxHeight: 400,
              backgroundColor: c.bgElevated,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 6,
              padding: 6,
              zIndex: 99,
              overflow: 'scroll',
            }}
          >
            {/* Header */}
            <Box style={{ paddingLeft: 10, paddingTop: 4, paddingBottom: 6 }}>
              <Text style={{ color: c.textDim, fontSize: 8, fontWeight: 'bold' }}>
                SELECT THEME
              </Text>
            </Box>

            {/* Theme list grouped by family */}
            {Array.from(families.entries()).map(([familyKey, ids]) => (
              <Box key={familyKey} style={{ paddingBottom: 4 }}>
                {/* Family group label */}
                <Box style={{ paddingLeft: 10, paddingTop: 4, paddingBottom: 2 }}>
                  <Text style={{ color: c.textDim, fontSize: 8 }}>
                    {familyLabel(familyKey)}
                  </Text>
                </Box>

                {/* Individual theme options */}
                {ids.map((id) => (
                  <ThemeOption
                    key={id}
                    themeId={id}
                    isActive={id === themeId}
                    onPress={() => handleSelect(id)}
                  />
                ))}
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
