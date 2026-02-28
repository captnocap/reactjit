import type { Theme } from '../types';
import { catppuccinThemes } from './catppuccin';
import { draculaThemes } from './dracula';
import { nordThemes } from './nord';
import { gruvboxThemes } from './gruvbox';
import { tokyoNightThemes } from './tokyo-night';
import { oneDarkThemes } from './one-dark';
import { solarizedThemes } from './solarized';
import { rosePineThemes } from './rose-pine';

export const themes: Record<string, Theme> = {
  ...catppuccinThemes,
  ...draculaThemes,
  ...nordThemes,
  ...gruvboxThemes,
  ...tokyoNightThemes,
  ...oneDarkThemes,
  ...solarizedThemes,
  ...rosePineThemes,
};

export const defaultThemeId = 'catppuccin-mocha';
