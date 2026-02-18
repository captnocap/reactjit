import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import { themes } from './themes';
import type { ThemeContextValue, ThemeColors } from './types';

/** All registered theme IDs. */
export const themeNames = Object.keys(themes);

/** Access the full theme context (themeId, setTheme, colors). */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}

/** Shorthand: returns just the semantic color tokens for the active theme. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
