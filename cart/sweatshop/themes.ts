// Theme token system for sweatshop.
// Three built-in themes: 'sharp' (terminal-feel, square, high contrast),
// 'soft' (the previous default, lightly tuned, crisp corners),
// 'studio' (pro-tool muted, tight density, square).
// Plus themed ports from tsz references.
import { VESPER_PALETTE, VESPER_TOKENS } from './lib/vesper/tokens';
//
// A theme is a flat token map. Components read tokens from the live `TOKENS`
// object and palette via the live `COLORS` object (both re-exported from
// theme.ts). Switching theme rewrites those objects in place and notifies
// subscribers so the app re-renders against the new values.

export type Corner = 'square' | 'soft' | 'round';
export type Density = 'compact' | 'comfortable';

export type ThemePalette = {
  appBg: string;
  panelBg: string;
  panelRaised: string;
  panelAlt: string;
  panelHover: string;
  border: string;
  borderSoft: string;
  text: string;
  textBright: string;
  textDim: string;
  textMuted: string;
  blue: string;
  blueDeep: string;
  green: string;
  greenDeep: string;
  yellow: string;
  yellowDeep: string;
  orange: string;
  orangeDeep: string;
  red: string;
  redDeep: string;
  purple: string;
  purpleDeep: string;
  grayChip: string;
  grayDeep: string;
};

export type ThemeTokens = {
  name: string;
  label: string;
  corner: Corner;
  density: Density;
  // radius scale — keep `md` the common default (2–3 is crisp, not bubbly)
  radiusNone: number;
  radiusXs: number;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusPill: number;
  // spacing scale
  spaceXxs: number;
  spaceXs: number;
  spaceSm: number;
  spaceMd: number;
  spaceLg: number;
  spaceXl: number;
  spaceXxl: number;
  // padding defaults (per-density tuned)
  padTight: number;
  padNormal: number;
  padLoose: number;
  rowHeight: number;
  chromeHeight: number;
  // borders + shadow depth
  borderW: number;
  shadowDepth: number; // 0 = none, 1 = low, 2 = mid, 3 = high
  // type
  fontUI: string;
  fontMono: string;
  fontXs: number;
  fontSm: number;
  fontMd: number;
  fontLg: number;
  fontXl: number;
  // typography scale (aliases — semantic names)
  typeXs: number;
  typeSm: number;
  typeBase: number;
  typeLg: number;
  typeXl: number;
  // shadow scale — resolved to CSS-ish strings (for boxShadow prop support)
  shadow0: string;
  shadow1: string;
  shadow2: string;
  shadow3: string;
  shadow4: string;
  // z-index scale
  zBase: number;
  zDock: number;
  zOverlay: number;
  zModal: number;
  zToast: number;
  // animation timing (ms)
  timingFast: number;
  timingBase: number;
  timingSlow: number;
};

export type Theme = {
  tokens: ThemeTokens;
  palette: ThemePalette;
};

// 'soft' — tuned version of the previous default. Crisp 3px corners
// (previous default was 10px). Comfortable density.
export const THEME_SOFT: Theme = {
  tokens: {
    name: 'soft',
    label: 'Soft',
    corner: 'soft',
    density: 'comfortable',
    radiusNone: 0,
    radiusXs: 1,
    radiusSm: 2,
    radiusMd: 3,
    radiusLg: 5,
    radiusPill: 9999,
    spaceXxs: 2,
    spaceXs: 4,
    spaceSm: 6,
    spaceMd: 10,
    spaceLg: 14,
    spaceXl: 20,
    spaceXxl: 28,
    padTight: 4,
    padNormal: 8,
    padLoose: 12,
    rowHeight: 24,
    chromeHeight: 32,
    borderW: 1,
    shadowDepth: 1,
    fontUI: 'system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 13,
    fontLg: 15,
    fontXl: 18,
    typeXs: 10,
    typeSm: 11,
    typeBase: 13,
    typeLg: 15,
    typeXl: 18,
    shadow0: 'none',
    shadow1: '0 1px 2px rgba(0,0,0,0.25)',
    shadow2: '0 2px 6px rgba(0,0,0,0.30)',
    shadow3: '0 6px 14px rgba(0,0,0,0.35)',
    shadow4: '0 14px 32px rgba(0,0,0,0.45)',
    zBase: 0,
    zDock: 50,
    zOverlay: 500,
    zModal: 1000,
    zToast: 2000,
    timingFast: 120,
    timingBase: 220,
    timingSlow: 420,
  },
  palette: {
    appBg: '#090d13',
    panelBg: '#0d1015',
    panelRaised: '#10151d',
    panelAlt: '#11161f',
    panelHover: '#121a24',
    border: '#1f2935',
    borderSoft: '#18202b',
    text: '#c9d2df',
    textBright: '#eef2f8',
    textDim: '#5d6a7c',
    textMuted: '#8ca0b8',
    blue: '#79c0ff',
    blueDeep: '#10213d',
    green: '#7ee787',
    greenDeep: '#102214',
    yellow: '#e6b450',
    yellowDeep: '#332200',
    orange: '#ffa657',
    orangeDeep: '#331608',
    red: '#ff7b72',
    redDeep: '#341316',
    purple: '#d2a8ff',
    purpleDeep: '#241233',
    grayChip: '#1d2330',
    grayDeep: '#1a1f2b',
  },
};

// 'sharp' — square corners, terminal aesthetic, higher contrast, thin
// hairline borders, no shadows. Mono everywhere.
export const THEME_SHARP: Theme = {
  tokens: {
    name: 'sharp',
    label: 'Sharp',
    corner: 'square',
    density: 'compact',
    radiusNone: 0,
    radiusXs: 0,
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    spaceXxs: 2,
    spaceXs: 3,
    spaceSm: 5,
    spaceMd: 8,
    spaceLg: 12,
    spaceXl: 16,
    spaceXxl: 24,
    padTight: 3,
    padNormal: 6,
    padLoose: 10,
    rowHeight: 22,
    chromeHeight: 28,
    borderW: 1,
    shadowDepth: 0,
    fontUI: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 14,
    fontXl: 17,
    typeXs: 10,
    typeSm: 11,
    typeBase: 12,
    typeLg: 14,
    typeXl: 17,
    shadow0: 'none',
    shadow1: 'none',
    shadow2: 'none',
    shadow3: 'none',
    shadow4: 'none',
    zBase: 0,
    zDock: 50,
    zOverlay: 500,
    zModal: 1000,
    zToast: 2000,
    timingFast: 80,
    timingBase: 150,
    timingSlow: 300,
  },
  palette: {
    appBg: '#000000',
    panelBg: '#05080c',
    panelRaised: '#0a0f16',
    panelAlt: '#0a0f16',
    panelHover: '#101722',
    border: '#2a3644',
    borderSoft: '#1a2230',
    text: '#d6dde6',
    textBright: '#ffffff',
    textDim: '#5a6577',
    textMuted: '#8998ad',
    blue: '#6ed0ff',
    blueDeep: '#071a33',
    green: '#7ef0a0',
    greenDeep: '#0a1f10',
    yellow: '#f0c050',
    yellowDeep: '#2a1e00',
    orange: '#ffae5c',
    orangeDeep: '#2a1208',
    red: '#ff6d63',
    redDeep: '#2a0e12',
    purple: '#e1b4ff',
    purpleDeep: '#1e0e2a',
    grayChip: '#161d28',
    grayDeep: '#141a24',
  },
};

// 'studio' — pro-tool muted palette, tight density, square corners,
// neutral greys, desaturated accents.
export const THEME_STUDIO: Theme = {
  tokens: {
    name: 'studio',
    label: 'Studio',
    corner: 'square',
    density: 'compact',
    radiusNone: 0,
    radiusXs: 1,
    radiusSm: 2,
    radiusMd: 2,
    radiusLg: 3,
    radiusPill: 9999,
    spaceXxs: 2,
    spaceXs: 3,
    spaceSm: 5,
    spaceMd: 8,
    spaceLg: 12,
    spaceXl: 16,
    spaceXxl: 22,
    padTight: 3,
    padNormal: 6,
    padLoose: 9,
    rowHeight: 22,
    chromeHeight: 28,
    borderW: 1,
    shadowDepth: 1,
    fontUI: 'Inter, system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 14,
    fontXl: 16,
    typeXs: 10,
    typeSm: 11,
    typeBase: 12,
    typeLg: 14,
    typeXl: 16,
    shadow0: 'none',
    shadow1: '0 1px 2px rgba(0,0,0,0.4)',
    shadow2: '0 2px 4px rgba(0,0,0,0.5)',
    shadow3: '0 4px 10px rgba(0,0,0,0.55)',
    shadow4: '0 10px 22px rgba(0,0,0,0.65)',
    zBase: 0,
    zDock: 50,
    zOverlay: 500,
    zModal: 1000,
    zToast: 2000,
    timingFast: 100,
    timingBase: 180,
    timingSlow: 340,
  },
  palette: {
    appBg: '#1a1c20',
    panelBg: '#1e2025',
    panelRaised: '#23262c',
    panelAlt: '#20232a',
    panelHover: '#282c33',
    border: '#32363f',
    borderSoft: '#282c33',
    text: '#b8bcc4',
    textBright: '#e4e6eb',
    textDim: '#6a6f78',
    textMuted: '#8a8f98',
    blue: '#82a8c8',
    blueDeep: '#1a2633',
    green: '#8aae8a',
    greenDeep: '#1a2820',
    yellow: '#c8a868',
    yellowDeep: '#2a2010',
    orange: '#c8936a',
    orangeDeep: '#2a1a10',
    red: '#c87878',
    redDeep: '#2a1418',
    purple: '#a898c8',
    purpleDeep: '#20182a',
    grayChip: '#2a2d34',
    grayDeep: '#24272d',
  },
};

// 'high-contrast' — accessible WCAG-oriented palette. Square corners,
// max-contrast foreground/background, brighter accents, thick hairlines.
export const THEME_HIGH_CONTRAST: Theme = {
  tokens: {
    ...THEME_SHARP.tokens,
    name: 'high-contrast',
    label: 'High Contrast',
    corner: 'square',
    density: 'comfortable',
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    borderW: 2,
    shadowDepth: 0,
    fontMd: 13,
    fontLg: 15,
    fontXl: 18,
    typeBase: 13,
    typeLg: 15,
    typeXl: 18,
  },
  palette: {
    appBg: '#000000',
    panelBg: '#000000',
    panelRaised: '#0a0a0a',
    panelAlt: '#0a0a0a',
    panelHover: '#1a1a1a',
    border: '#ffffff',
    borderSoft: '#8a8a8a',
    text: '#ffffff',
    textBright: '#ffffff',
    textDim: '#c0c0c0',
    textMuted: '#d0d0d0',
    blue: '#5ec8ff',
    blueDeep: '#001b3d',
    green: '#70ff90',
    greenDeep: '#002a10',
    yellow: '#ffe066',
    yellowDeep: '#2a2000',
    orange: '#ffb870',
    orangeDeep: '#2a1200',
    red: '#ff8078',
    redDeep: '#2a0a0a',
    purple: '#e4b8ff',
    purpleDeep: '#1a002a',
    grayChip: '#1a1a1a',
    grayDeep: '#0f0f0f',
  },
};

// 'aptioSetup' — BIOS/setup wizard blue with flat gray panels and
// stark white borders. Classic firmware UI, businesslike and utilitarian.
export const THEME_APTIO_SETUP: Theme = {
  tokens: {
    ...THEME_SHARP.tokens,
    name: 'aptioSetup',
    label: 'Aptio Setup',
    corner: 'square',
    density: 'comfortable',
    radiusXs: 0,
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    borderW: 1,
    shadowDepth: 0,
    fontUI: 'system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 13,
    fontXl: 16,
    typeBase: 12,
    typeLg: 13,
    typeXl: 16,
  },
  palette: {
    appBg: '#0000aa',
    panelBg: '#c6c6c6',
    panelRaised: '#d6d6d6',
    panelAlt: '#bfbfbf',
    panelHover: '#e6e6e6',
    border: '#ffffff',
    borderSoft: '#7f7f7f',
    text: '#d6d6d6',
    textBright: '#ffffff',
    textDim: '#555555',
    textMuted: '#8a8a8a',
    blue: '#0000aa',
    blueDeep: '#000066',
    green: '#008000',
    greenDeep: '#003300',
    yellow: '#ffd54a',
    yellowDeep: '#4a4200',
    orange: '#ff9900',
    orangeDeep: '#4a1e00',
    red: '#c00000',
    redDeep: '#4a0000',
    purple: '#6e3cff',
    purpleDeep: '#26104a',
    grayChip: '#a8a8a8',
    grayDeep: '#808080',
  },
};

// 'ditherKit' — 1-bit dither kit: monochrome carrier with bright,
// high-signal accent colors and hard UI edges.
export const THEME_DITHER_KIT: Theme = {
  tokens: {
    ...THEME_SHARP.tokens,
    name: 'ditherKit',
    label: 'Dither Kit',
    corner: 'square',
    density: 'compact',
    radiusXs: 0,
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    borderW: 1,
    shadowDepth: 0,
    fontUI: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 13,
    fontXl: 16,
    typeBase: 12,
    typeLg: 13,
    typeXl: 16,
  },
  palette: {
    appBg: '#0b0b0b',
    panelBg: '#111111',
    panelRaised: '#181818',
    panelAlt: '#1a1a1a',
    panelHover: '#232323',
    border: '#f2f2f2',
    borderSoft: '#8f8f8f',
    text: '#f4f4f4',
    textBright: '#ffffff',
    textDim: '#bcbcbc',
    textMuted: '#d8d8d8',
    blue: '#9af7ff',
    blueDeep: '#0a1630',
    green: '#7dffcf',
    greenDeep: '#0c2218',
    yellow: '#ffd166',
    yellowDeep: '#2a2000',
    orange: '#ffb060',
    orangeDeep: '#311608',
    red: '#ff5577',
    redDeep: '#2f1017',
    purple: '#c654ff',
    purpleDeep: '#220f33',
    grayChip: '#202020',
    grayDeep: '#141414',
  },
};

// 'ngardenRetroClassic' — playful retro garden UI: black carrier,
// bold white dividers, and saturated arcade accents.
export const THEME_NGARDEN_RETRO_CLASSIC: Theme = {
  tokens: {
    ...THEME_STUDIO.tokens,
    name: 'ngardenRetroClassic',
    label: 'NGarden Retro',
    corner: 'square',
    density: 'comfortable',
    radiusXs: 0,
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    borderW: 2,
    shadowDepth: 0,
    fontUI: 'system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 13,
    fontLg: 14,
    fontXl: 20,
    typeBase: 13,
    typeLg: 14,
    typeXl: 20,
  },
  palette: {
    appBg: '#000000',
    panelBg: '#111111',
    panelRaised: '#171717',
    panelAlt: '#1c1c1c',
    panelHover: '#242424',
    border: '#ffffff',
    borderSoft: '#737373',
    text: '#ffffff',
    textBright: '#ffffff',
    textDim: '#b0b0b0',
    textMuted: '#d8d8d8',
    blue: '#2d9fff',
    blueDeep: '#001e3d',
    green: '#78d943',
    greenDeep: '#12310a',
    yellow: '#ffd54a',
    yellowDeep: '#3a2f00',
    orange: '#ff8b4f',
    orangeDeep: '#3a1606',
    red: '#ff4778',
    redDeep: '#3a1020',
    purple: '#ff4aa6',
    purpleDeep: '#36113a',
    grayChip: '#2a2a2a',
    grayDeep: '#151515',
  },
};

// 'orionMonitor' — CRT terminal skin with phosphor greens, amber readouts,
// and dark glass panels.
export const THEME_ORION_MONITOR: Theme = {
  tokens: {
    ...THEME_SHARP.tokens,
    name: 'orionMonitor',
    label: 'Orion Monitor',
    corner: 'square',
    density: 'compact',
    radiusXs: 0,
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    radiusPill: 0,
    borderW: 1,
    shadowDepth: 0,
    fontUI: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 12,
    fontLg: 13,
    fontXl: 16,
    typeBase: 12,
    typeLg: 13,
    typeXl: 16,
  },
  palette: {
    appBg: '#050806',
    panelBg: '#091210',
    panelRaised: '#0d1815',
    panelAlt: '#0b1411',
    panelHover: '#12201c',
    border: '#3b6b5f',
    borderSoft: '#24443d',
    text: '#c5f7dd',
    textBright: '#f5fff9',
    textDim: '#7ea496',
    textMuted: '#9cc1b4',
    blue: '#77d7ff',
    blueDeep: '#09283a',
    green: '#7cffb8',
    greenDeep: '#0b2318',
    yellow: '#d7ff6a',
    yellowDeep: '#2a3107',
    orange: '#ffcf73',
    orangeDeep: '#3a2208',
    red: '#ff7d7d',
    redDeep: '#351111',
    purple: '#8ef0d5',
    purpleDeep: '#102a26',
    grayChip: '#13221d',
    grayDeep: '#0a1412',
  },
};

// 'psychedelicDither' — saturated blue-violet-pink dither palette with
// cold phosphor highlights and dark carrier surfaces.
export const THEME_PSYCHEDELIC_DITHER: Theme = {
  tokens: {
    ...THEME_SOFT.tokens,
    name: 'psychedelicDither',
    label: 'Psychedelic Dither',
    corner: 'soft',
    density: 'comfortable',
    radiusXs: 1,
    radiusSm: 2,
    radiusMd: 3,
    radiusLg: 5,
    radiusPill: 9999,
    borderW: 1,
    shadowDepth: 1,
    fontUI: 'system-ui, -apple-system, sans-serif',
    fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontXs: 10,
    fontSm: 11,
    fontMd: 13,
    fontLg: 15,
    fontXl: 18,
    typeBase: 13,
    typeLg: 15,
    typeXl: 18,
  },
  palette: {
    appBg: '#04030a',
    panelBg: '#09101a',
    panelRaised: '#0c1422',
    panelAlt: '#101827',
    panelHover: '#122034',
    border: '#9af7ff70',
    borderSoft: '#5b6f8f66',
    text: '#f4fbff',
    textBright: '#ffffff',
    textDim: '#9eb8da',
    textMuted: '#c4d6ef',
    blue: '#9af7ff',
    blueDeep: '#071a33',
    green: '#7dffcf',
    greenDeep: '#0a1f10',
    yellow: '#ffd166',
    yellowDeep: '#2a1d00',
    orange: '#ff8fe4',
    orangeDeep: '#331233',
    red: '#ff5577',
    redDeep: '#341316',
    purple: '#c654ff',
    purpleDeep: '#241233',
    grayChip: '#161d28',
    grayDeep: '#141a24',
  },
};

export const THEME_VESPER: Theme = {
  tokens: {
    ...THEME_SOFT.tokens,
    ...VESPER_TOKENS,
    name: 'vesper',
    label: 'Vesper',
    corner: 'soft',
    density: 'comfortable',
    radiusMd: 4,
    radiusLg: 6,
  },
  palette: {
    ...VESPER_PALETTE,
  },
};

// 'custom' — user-configurable slot. Starts as a clone of 'soft'; user
// overrides are merged on top via setCustomTheme().
export const THEME_CUSTOM_BASE: Theme = {
  tokens: { ...THEME_SOFT.tokens, name: 'custom', label: 'Custom' },
  palette: { ...THEME_SOFT.palette },
};

export const THEMES: Record<string, Theme> = {
  soft: THEME_SOFT,
  sharp: THEME_SHARP,
  studio: THEME_STUDIO,
  'high-contrast': THEME_HIGH_CONTRAST,
  aptioSetup: THEME_APTIO_SETUP,
  ditherKit: THEME_DITHER_KIT,
  vesper: THEME_VESPER,
  ngardenRetroClassic: THEME_NGARDEN_RETRO_CLASSIC,
  orionMonitor: THEME_ORION_MONITOR,
  psychedelicDither: THEME_PSYCHEDELIC_DITHER,
  custom: THEME_CUSTOM_BASE,
};

export const THEME_ORDER = ['soft', 'sharp', 'studio', 'high-contrast', 'aptioSetup', 'ditherKit', 'vesper', 'ngardenRetroClassic', 'orionMonitor', 'psychedelicDither', 'custom'];

// Custom theme overrides — partial token + palette patches applied on top
// of a chosen base. Persisted separately in theme.ts.
export type CustomThemeOverrides = {
  base?: string; // name of the theme to inherit from (default: 'soft')
  tokens?: Partial<ThemeTokens>;
  palette?: Partial<ThemePalette>;
};

export function buildCustomTheme(overrides: CustomThemeOverrides): Theme {
  const baseName = overrides.base && THEMES[overrides.base] ? overrides.base : 'soft';
  const base = THEMES[baseName];
  return {
    tokens: { ...base.tokens, ...(overrides.tokens || {}), name: 'custom', label: 'Custom' },
    palette: { ...base.palette, ...(overrides.palette || {}) },
  };
}
