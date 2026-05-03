import { defineThemeTokenCategory } from '../../theme-system';

// Cross-theme contract. Every theme variant in the gallery is expected to
// provide concrete values for these semantic categories. Values here are
// neutral fallbacks so a theme that omits a token still renders.
export const sharedGlobalThemeTokens = [
  defineThemeTokenCategory({
    id: 'surfaces',
    title: 'Surfaces',
    tokens: {
      bg: '#0e0b09',
      bg1: '#14100d',
      bg2: '#1a1511',
    },
  }),
  defineThemeTokenCategory({
    id: 'ink',
    title: 'Ink (Text)',
    tokens: {
      ink: '#f2e8dc',
      inkDim: '#b8a890',
      inkDimmer: '#7a6e5d',
      inkGhost: '#4a4238',
    },
  }),
  defineThemeTokenCategory({
    id: 'rules',
    title: 'Rules (Borders)',
    tokens: {
      rule: '#3a2a1e',
      ruleBright: '#8a4a20',
    },
  }),
  defineThemeTokenCategory({
    id: 'accent',
    title: 'Accent',
    tokens: {
      accent: '#d26a2a',
      accentHot: '#e8501c',
    },
  }),
  defineThemeTokenCategory({
    id: 'state',
    title: 'State Signals',
    tokens: {
      ok: '#6aa390',
      warn: '#d6a54a',
      flag: '#e14a2a',
    },
  }),
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
