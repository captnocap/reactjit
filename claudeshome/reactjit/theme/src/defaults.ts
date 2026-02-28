import type { ThemeTypography, ThemeSpacing, ThemeRadii } from './types';

export const defaultTypography: ThemeTypography = {
  fontSize: { xs: 8, sm: 10, md: 12, lg: 16, xl: 20, xxl: 28 },
  fontWeight: { normal: 'normal', medium: '500', bold: 'bold' },
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 },
};

export const defaultSpacing: ThemeSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const defaultRadii: ThemeRadii = { none: 0, sm: 4, md: 8, lg: 12, full: 9999 };
