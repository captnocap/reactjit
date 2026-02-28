import { themes } from './themes';
import { defaultTypography, defaultSpacing, defaultRadii } from './defaults';
import type { Theme, CreateThemeOptions } from './types';

/**
 * Create a custom theme by extending a built-in one.
 *
 *   const myTheme = createTheme({
 *     name: 'my-brand',
 *     extends: 'catppuccin-mocha',
 *     colors: { primary: '#ff6b6b', accent: '#ffd93d' },
 *   });
 */
export function createTheme(opts: CreateThemeOptions): Theme {
  const base = opts.extends ? themes[opts.extends] : undefined;
  const basePalette = base?.colors.palette ?? {};
  const palette = { ...basePalette, ...opts.colors?.palette };

  return {
    name: opts.name,
    displayName: opts.displayName ?? opts.name,
    colors: {
      ...(base?.colors ?? {
        bg: '#1e1e2e',
        bgAlt: '#181825',
        bgElevated: '#313244',
        text: '#cdd6f4',
        textSecondary: '#bac2de',
        textDim: '#a6adc8',
        primary: '#89b4fa',
        primaryHover: '#74c7ec',
        primaryPressed: '#89dceb',
        surface: '#313244',
        surfaceHover: '#45475a',
        border: '#45475a',
        borderFocus: '#89b4fa',
        accent: '#cba6f7',
        error: '#f38ba8',
        warning: '#fab387',
        success: '#a6e3a1',
        info: '#89dceb',
        palette: {},
      }),
      ...opts.colors,
      palette,
    },
    typography: {
      ...(base?.typography ?? defaultTypography),
      ...opts.typography,
      fontSize: { ...(base?.typography?.fontSize ?? defaultTypography.fontSize), ...opts.typography?.fontSize },
      fontWeight: { ...(base?.typography?.fontWeight ?? defaultTypography.fontWeight), ...opts.typography?.fontWeight },
      lineHeight: { ...(base?.typography?.lineHeight ?? defaultTypography.lineHeight), ...opts.typography?.lineHeight },
    },
    spacing: { ...(base?.spacing ?? defaultSpacing), ...opts.spacing },
    radii: { ...(base?.radii ?? defaultRadii), ...opts.radii },
  };
}

/**
 * Register a custom theme so it's available via setTheme().
 */
export function registerTheme(theme: Theme): void {
  (themes as Record<string, Theme>)[theme.name] = theme;
}
