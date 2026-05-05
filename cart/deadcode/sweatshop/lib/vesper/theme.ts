import { applyTheme, getActiveThemeName } from '../../theme';
import { THEME_ORDER, THEMES, type Theme } from '../../themes';

export function registerVesperTheme(): Theme {
  if (!THEME_ORDER.includes('vesper')) THEME_ORDER.splice(THEME_ORDER.length - 1, 0, 'vesper');
  return THEMES.vesper;
}

export function applyVesperTheme(): void {
  registerVesperTheme();
  applyTheme('vesper');
}

export function isVesperThemeActive(): boolean {
  return getActiveThemeName() === 'vesper';
}
