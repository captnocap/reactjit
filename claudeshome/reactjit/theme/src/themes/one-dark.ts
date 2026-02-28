import type { Theme } from '../types';
import { defaultTypography, defaultSpacing, defaultRadii } from '../defaults';

const oneDarkPalette: Record<string, string> = {
  mono1: '#abb2bf',
  mono2: '#828997',
  mono3: '#5c6370',
  cyan: '#56b6c2',
  blue: '#61afef',
  purple: '#c678dd',
  green: '#98c379',
  red1: '#e06c75',
  red2: '#be5046',
  orange: '#d19a66',
  yellow: '#e5c07b',
  bg: '#282c34',
  gutter: '#636d83',
  guide: '#3b4048',
  accent: '#528bff',
};

export const oneDarkThemes: Record<string, Theme> = {
  'one-dark': {
    name: 'one-dark',
    displayName: 'One Dark',
    colors: {
      bg: '#282c34',
      bgAlt: '#21252b',
      bgElevated: '#2c313a',
      text: '#abb2bf',
      textSecondary: '#9da5b4',
      textDim: '#5c6370',
      primary: '#61afef',
      primaryHover: '#56b6c2',
      primaryPressed: '#98c379',
      surface: '#2c313a',
      surfaceHover: '#333842',
      border: '#3e4452',
      borderFocus: '#61afef',
      accent: '#c678dd',
      error: '#e06c75',
      warning: '#d19a66',
      success: '#98c379',
      info: '#56b6c2',
      palette: { ...oneDarkPalette },
    },
    typography: defaultTypography,
    spacing: defaultSpacing,
    radii: defaultRadii,
  },
};
