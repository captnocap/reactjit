import { defineThemeTokenCategory } from '../../theme-system';

// Cross-theme contract for non-color global values. Color values live in the
// active theme classifier variants so component code has one palette source.
export const sharedGlobalThemeTokens = [
  defineThemeTokenCategory({
    id: 'type',
    title: 'Type Sizes',
    tokens: {
      micro: 7,
      tiny: 8,
      caption: 9,
      body: 10,
      base: 11,
      meta: 12,
      strong: 14,
      heading: 18,
    },
  }),
  defineThemeTokenCategory({
    id: 'radius',
    title: 'Corner Radius',
    tokens: {
      sm: 4,
      md: 6,
      lg: 8,
      xl: 10,
      pill: 99,
      round: 999,
    },
  }),
];
