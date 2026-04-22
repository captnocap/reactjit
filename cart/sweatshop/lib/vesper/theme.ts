import { applyTheme, getActiveThemeName } from '../../theme';
import { THEME_ORDER, THEMES, type Theme } from '../../themes';
import { VESPER_PALETTE, VESPER_TOKENS } from './tokens';

export const VESPER_THEME: Theme = {
  tokens: { ...VESPER_TOKENS },
  palette: { ...VESPER_PALETTE },
};

export function registerVesperTheme(): Theme {
  if (!THEMES.vesper) THEMES.vesper = VESPER_THEME;
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

registerVesperTheme();
