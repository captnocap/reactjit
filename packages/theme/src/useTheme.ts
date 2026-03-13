import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import { themes } from './themes';
import type { ThemeContextValue, ThemeColors, ThemeTypography, ThemeSpacing, ThemeRadii, ThemeEffects, ThemeShaders, ThemeSprites } from './types';

/** All registered theme IDs. */
export const themeNames = Object.keys(themes);

/** Access the full theme context (themeId, setTheme, colors, typography, spacing, radii). */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}

/** Shorthand: returns just the semantic color tokens for the active theme. */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}

/** Shorthand: returns the typography scale for the active theme. */
export function useThemeTypography(): ThemeTypography {
  return useTheme().typography;
}

/** Shorthand: returns the spacing scale for the active theme. */
export function useThemeSpacing(): ThemeSpacing {
  return useTheme().spacing;
}

/** Shorthand: returns the border-radius scale for the active theme. */
export function useThemeRadii(): ThemeRadii {
  return useTheme().radii;
}

/** Shorthand: returns the visual effects config for the active theme. */
export function useThemeEffects(): ThemeEffects {
  return useTheme().effects;
}

/** Shorthand: returns the shader grading config for the active theme. */
export function useThemeShaders(): ThemeShaders {
  return useTheme().shaders;
}

/** Shorthand: returns the sprite atlas config for the active theme. */
export function useThemeSprites(): ThemeSprites {
  return useTheme().sprites;
}
